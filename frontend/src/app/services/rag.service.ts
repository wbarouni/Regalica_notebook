import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

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
  private readonly apiUrl = `${environment.apiBaseUrl}/rag`;
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public messages$ = this.messagesSubject.asObservable();
  
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Recherche des candidats pour une requête
   */
  searchCandidates(query: string, topK: number = 50, lang?: string): Observable<RagQueryResponse> {
    const body: any = { query, top_k: topK };
    if (lang) body.lang = lang;
    
    return this.http.post<RagQueryResponse>(`${this.apiUrl}/query`, body);
  }

  /**
   * Pose une question et obtient une réponse complète
   */
  askQuestion(query: string, topK: number = 50, lang?: string): Observable<RagAnswerResponse> {
    const body: any = { query, top_k: topK };
    if (lang) body.lang = lang;
    
    this.loadingSubject.next(true);
    
    const request = this.http.post<RagAnswerResponse>(`${this.apiUrl}/answer`, body);
    
    // Mettre à jour le loading state quand la requête se termine
    request.subscribe({
      next: () => this.loadingSubject.next(false),
      error: () => this.loadingSubject.next(false)
    });
    
    return request;
  }

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
  addAssistantMessage(content: string, sources?: RagSource[], confidence?: number, stats?: any): string {
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
   * Pose une question complète (ajoute les messages et fait l'appel API)
   */
  async chatWithRag(query: string, topK: number = 50, lang?: string): Promise<void> {
    // Ajouter le message utilisateur
    this.addUserMessage(query);
    
    try {
      // Faire l'appel API
      const response = await this.askQuestion(query, topK, lang).toPromise();
      
      if (response) {
        // Ajouter la réponse de l'assistant
        this.addAssistantMessage(
          response.answer,
          response.sources,
          response.confidence,
          response.stats
        );
      }
    } catch (error) {
      console.error('Erreur lors de la question RAG:', error);
      
      // Ajouter un message d'erreur
      this.addAssistantMessage(
        'Désolé, une erreur est survenue lors du traitement de votre question. Veuillez réessayer.',
        [],
        0
      );
    }
  }

  /**
   * Efface l'historique des messages
   */
  clearMessages(): void {
    this.messagesSubject.next([]);
  }

  /**
   * Obtient les statistiques RAG
   */
  getStats(): Observable<any> {
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
      // Assumons que match[3] contient les informations de span sous la forme 'start-end'
      const spanParts = match[3].split("-");
      const spanStart = parseInt(spanParts[0]);
      const spanEnd = parseInt(spanParts[1]);

      citations.push({
        id: `${match[1]}-${match[2]}-${match[3]}`, // Générer un ID unique
        title: match[1],
        page: parseInt(match[2]),
        spanStart: spanStart,
        spanEnd: spanEnd,
        text: "", // Le texte sera rempli par le viewer, ou peut être extrait si disponible
        // chunkId: undefined // Si chunkId est disponible dans le regex, l'ajouter ici
      });
    }
    
    return { text, citations };
  }
}
