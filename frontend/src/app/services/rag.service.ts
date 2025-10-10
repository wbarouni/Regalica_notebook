import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { finalize } from 'rxjs/operators';
// environment import removed; base URL handled by interceptor

export interface RagCandidate {
  chunk_id: string;
  document_id: string;
  document_title: string;
  page_no: number;
  heading_path?: string;
  text: string;
  tokens: number;
  score_cosine: number;
  span_start?: number;
  span_end?: number;
}

export interface RagQueryResponse {
  query: string;
  lang: string;
  candidates: RagCandidate[];
  stats: {
    total_processing_time_ms: number;
    candidates_count: number;
    embedding_dim: number;
    top_k: number;
  };
}

export interface RagSource {
  id: string;
  title: string;
  page?: number;
  spanStart: number;
  spanEnd: number;
  text: string;
  chunkId?: string;
  confidence?: number;
  // Additional properties from backend
  score?: number;
  index?: number;
  document_id?: string;
  span_start?: number;
  span_end?: number;
  chunk_id?: string;
}

export interface RagAnswerResponse {
  query: string;
  lang: string;
  answer: string;
  sources: RagSource[];
  confidence: number;
  reasoning: string;
  stats: {
    retrieved_count: number;
    reranked_count: number;
    selected_count: number;
    total_processing_time_ms: number;
    retrieval_time_ms: number;
    synthesis_time_ms: number;
    model_used: string;
    lang_detected: string;
  };
}

// AgentChatResponse removed (agent feature rolled back)

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: RagSource[];
  confidence?: number;
  timestamp: Date;
  processing_time_ms?: number;
  lang?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RagService {
  private readonly apiUrl = '/api/rag'; // L'intercepteur ajoutera automatiquement l'URL de base
  // Agent API URL removed (agent feature rolled back)
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public messages$ = this.messagesSubject.asObservable();
  
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();
  private inFlight = false;

  constructor(private http: HttpClient) {}

  /**
   * Recherche des candidats pour une requête
   */
  searchCandidates(query: string, topK: number = 50, lang?: string): Observable<RagQueryResponse> {
    const body: { query: string; top_k: number; lang?: string } = { query, top_k: topK };
    if (lang) body.lang = lang;
    
    return this.http.post<RagQueryResponse>(`${this.apiUrl}/query`, body);
  }

  /**
   * Pose une question et obtient une réponse complète
   */
  askQuestion(query: string, topK: number = 50, lang?: string): Observable<RagAnswerResponse> {
    const body: { query: string; top_k: number; lang?: string } = { query, top_k: topK };
    if (lang) body.lang = lang;
    
    if (this.inFlight) {
      return new Observable<RagAnswerResponse>(subscriber => {
        subscriber.error(new Error('REQUEST_IN_FLIGHT'));
      });
    }

    this.inFlight = true;
    this.loadingSubject.next(true);

    return this.http
      .post<RagAnswerResponse>(`${this.apiUrl}/answer`, body)
      .pipe(finalize(() => { this.loadingSubject.next(false); this.inFlight = false; }));
  }

  // askAgent removed (agent feature rolled back)

  /**
   * Ajoute un message utilisateur au chat
   */
  addUserMessage(content: string): string {
    const messageId = this.generateMessageId();
    const message: ChatMessage = {
      id: messageId,
      role: 'user',
      content,
      timestamp: new Date()
    };
    
    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, message]);
    
    return messageId;
  }

  /**
   * Ajoute une réponse de l'assistant au chat
   */
  addAssistantMessage(content: string, sources?: RagSource[], confidence?: number, stats?: { total_processing_time_ms?: number; lang_detected?: string }): string {
    const messageId = this.generateMessageId();
    const message: ChatMessage = {
      id: messageId,
      role: 'assistant',
      content,
      sources,
      confidence,
      timestamp: new Date(),
      processing_time_ms: stats?.total_processing_time_ms,
      lang: stats?.lang_detected
    };
    
    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, message]);
    
    return messageId;
  }

  /**
   * Pose une question avec streaming SSE
   */
  async chatWithRagStreaming(query: string, topK: number = 50): Promise<void> {
    this.addUserMessage(query);
    
    const messageId = this.generateMessageId();
    let fullAnswer = '';
    let sources: RagSource[] = [];
    let confidence = 0;
    
    // Message assistant temporaire
    const tempMessage: ChatMessage = {
      id: messageId,
      role: 'assistant',
      content: '...',
      timestamp: new Date()
    };
    
    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, tempMessage]);
    
    this.inFlight = true;
    this.loadingSubject.next(true);
    
    try {
      const response = await fetch(`${this.apiUrl}/answer/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, top_k: topK })
      });
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) throw new Error('No reader');
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'token') {
              fullAnswer += data.text;
              this.updateMessage(messageId, fullAnswer, sources, confidence);
            } else if (data.type === 'done') {
              fullAnswer = data.answer;
              sources = data.sources || [];
              confidence = data.confidence || 0;
              this.updateMessage(messageId, fullAnswer, sources, confidence);
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error);
      this.updateMessage(messageId, 'Erreur lors du streaming', [], 0);
    } finally {
      this.loadingSubject.next(false);
      this.inFlight = false;
    }
  }

  /**
   * Met à jour un message existant
   */
  private updateMessage(id: string, content: string, sources: RagSource[], confidence: number): void {
    const messages = this.messagesSubject.value;
    const index = messages.findIndex(m => m.id === id);
    if (index !== -1) {
      messages[index] = { ...messages[index], content, sources, confidence };
      this.messagesSubject.next([...messages]);
    }
  }

  /**
   * Pose une question complète (ajoute les messages et fait l'appel API)
   */
  async chatWithRag(query: string, topK: number = 50, lang?: string): Promise<void> {
    // Utiliser streaming
    return this.chatWithRagStreaming(query, topK);
  }

  // chatWithAgent removed (agent feature rolled back)

  /**
   * Efface l'historique des messages
   */
  clearMessages(): void {
    this.messagesSubject.next([]);
  }

  /**
   * Obtient les statistiques RAG
   */
  getStats(): Observable<unknown> {
    return this.http.get(`${this.apiUrl}/stats`);
  }

  /**
   * Génère un ID unique pour les messages
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Formate une citation pour l'affichage
   */
  formatCitation(source: RagSource): string {
    return `${source.title} (page ${source.page})`;
  }

  /**
   * Extrait les citations d'un texte
   */
  extractCitations(text: string): { text: string; citations: RagSource[] } {
    const citationRegex = /\[([^\]]+)#([^:]+):([^\]]+)\]/g;
    const citations: RagSource[] = [];
    let match;
    
    while ((match = citationRegex.exec(text)) !== null) {
      citations.push({
        id: `citation-${citations.length}`,
        title: match[1],
        text: match[3],
        page: parseInt(match[2]),
        confidence: 0.8,
        spanStart: 0,
        spanEnd: match[3].length
      });
    }
    
    return { text, citations };
  }
}
