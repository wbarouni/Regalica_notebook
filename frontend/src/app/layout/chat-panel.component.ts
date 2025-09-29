import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { RagService, ChatMessage, RagSource } from '../services/rag.service';
import { ViewerService } from '../core/services/viewer.service';
import { AppConfigService } from '../core/services/app-config.service';

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="chat-panel">
      <!-- Header -->
      <div class="chat-header">
        <div class="header-content">
          <h2 class="chat-title">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
            </svg>
            Chat Assistant
          </h2>
          
          <div class="header-actions">
            <button class="header-btn"
                    (click)="clearChat()"
                    [disabled]="messages.length === 0"
                    title="Clear chat history">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
            
            <button class="header-btn"
                    (click)="exportChat()"
                    [disabled]="messages.length === 0"
                    title="Export chat">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Messages Container -->
      <div class="messages-container" 
           #messagesContainer
           [class.empty]="messages.length === 0">
        
        <!-- Welcome State -->
        <div *ngIf="messages.length === 0" class="welcome-state">
          <div class="welcome-icon">
            <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364-.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
          </div>
          <h3 class="welcome-title">Welcome to Regalica Notebook</h3>
          <p class="welcome-description">
            Ask questions about your uploaded documents. I'll provide answers with precise citations and sources.
          </p>
          
          <!-- Example Questions -->
          <div class="example-questions" *ngIf="exampleQuestions.length > 0">
            <h4 class="examples-title">Try asking:</h4>
            <div class="examples-grid">
              <button *ngFor="let question of exampleQuestions"
                      class="example-btn"
                      (click)="useExampleQuestion(question)">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                {{ question }}
              </button>
            </div>
          </div>
        </div>

        <!-- Messages List -->
        <div class="messages-list" *ngIf="messages.length > 0">
          <div *ngFor="let message of messages; trackBy: trackByMessageId" 
               class="message-wrapper"
               [attr.data-testid]="'message-' + message.role"
               [class]="'message-' + message.role">
            
            <!-- User Message -->
            <div *ngIf="message.role === 'user'" class="user-message">
              <div class="message-bubble">
                <div class="message-content">{{ message.content }}</div>
                <div class="message-timestamp">
                  {{ formatTime(message.timestamp) }}
                </div>
              </div>
              <div class="message-avatar">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
              </div>
            </div>

            <!-- Assistant Message -->
            <div *ngIf="message.role === 'assistant'" class="assistant-message">
              <div class="message-avatar">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364-.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                </svg>
              </div>
              
              <div class="message-bubble">
                <!-- No Answer State -->
                <div *ngIf="isNoAnswer(message)" class="no-answer-state">
                  <div class="no-answer-icon">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                  </div>
                  <div class="no-answer-content">
                    <h4>No relevant information found</h4>
                    <p>{{ getNoAnswerExplanation() }}</p>
                  </div>
                </div>

                <!-- Regular Answer -->
                <div *ngIf="!isNoAnswer(message)" class="message-content">
                  <div class="answer-text" [innerHTML]="formatMessageContent(message.content)"></div>
                  
                  <!-- Sources -->
                  <div *ngIf="message.sources && message.sources.length > 0" class="message-sources">
                    <h4 class="sources-title">Sources:</h4>
                    <div class="sources-list">
                      <button *ngFor="let source of message.sources; trackBy: trackBySourceId"
                              class="source-citation"
                              [class]="'confidence-' + getConfidenceLevel(source.confidence)"
                              (click)="onCitationClick(source)"
                              [title]="'Confidence: ' + formatConfidence(source.confidence)">
                        <div class="citation-content">
                          <span class="citation-title">{{ source.title }}</span>
                          <span class="citation-location" *ngIf="source.page">
                            Page {{ source.page }}
                          </span>
                        </div>
                        <div class="citation-confidence">
                          {{ formatConfidence(source.confidence) }}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Message Footer -->
                <div class="message-footer">
                  <div class="message-meta">
                    <span class="message-timestamp">
                      {{ formatTime(message.timestamp) }}
                    </span>
                    <span *ngIf="message.processingTimeMs" class="processing-time">
                      {{ formatProcessingTime(message.processingTimeMs) }}
                    </span>
                  </div>
                  
                  <!-- Confidence Bar -->
                  <div *ngIf="message.confidence !== undefined" 
                       class="confidence-bar"
                       [class]="getConfidenceClass(message.confidence)">
                    <div class="confidence-fill" 
                         [style.width.%]="message.confidence * 100"></div>
                    <span class="confidence-label">
                      {{ formatConfidence(message.confidence) }} confidence
                    </span>
                  </div>

                  <!-- Actions -->
                  <div class="message-actions">
                    <button class="action-btn"
                            (click)="copyMessage(message)"
                            title="Copy message">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                      </svg>
                    </button>
                    
                    <button class="action-btn"
                            (click)="improveQuestion(message)"
                            title="Improve this question">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Streaming Indicator -->
          <div *ngIf="isStreaming" class="streaming-indicator">
            <div class="message-avatar">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364-.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
              </svg>
            </div>
            <div class="streaming-bubble">
              <div class="streaming-content">
                <div class="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span class="streaming-text">Thinking...</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="input-area">
        <div class="input-container">
          <textarea #queryInput
                    [(ngModel)]="currentQuery"
                    (keydown)="onKeyPress($event)"
                    placeholder="Ask a question about your documents..."
                    rows="2"
                    class="query-input"
                    data-testid="query-input"
                    [disabled]="isStreaming"
                    [attr.aria-label]="'Ask a question about your documents'"></textarea>
          
          <button class="send-btn"
                  (click)="sendQuery()"
                  [disabled]="!currentQuery.trim() || isStreaming"
                  data-testid="send-btn"
                  [attr.aria-label]="'Send message'">
            <svg *ngIf="!isStreaming" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
            </svg>
            <div *ngIf="isStreaming" class="loading-spinner"></div>
          </button>
        </div>
        
        <!-- Input Footer -->
        <div class="input-footer">
          <div class="input-hints">
            <span class="hint">Press <kbd>Enter</kbd> to send, <kbd>Shift+Enter</kbd> for new line</span>
          </div>
          
          <div class="input-status" *ngIf="connectionStatus !== 'connected'">
            <span class="status-indicator" [class]="'status-' + connectionStatus"></span>
            <span class="status-text">{{ getConnectionStatusText() }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./chat-panel.component.scss']
})
export class ChatPanelComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('queryInput') private queryInput!: ElementRef;

  messages: ChatMessage[] = [];
  currentQuery: string = '';
  isStreaming: boolean = false;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' = 'connected';
  
  private destroy$ = new Subject<void>();
  private shouldScrollToBottom = false;

  // Exemples de questions
  exampleQuestions = [
    "What are the main topics covered in the documents?",
    "Can you summarize the key findings?",
    "What are the most important recommendations?",
    "Are there any specific conclusions mentioned?"
  ];

  constructor(
    private ragService: RagService,
    private viewerService: ViewerService,
    private appConfig: AppConfigService
  ) {}

  ngOnInit(): void {
    this.setupSubscriptions();
    this.loadChatHistory();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  /**
   * Configure les abonnements aux services
   */
  private setupSubscriptions(): void {
    // Messages
    this.ragService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(messages => {
        this.messages = messages;
        this.shouldScrollToBottom = true;
      });

    // État de streaming
    this.ragService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.isStreaming = loading;
        if (loading) {
          this.shouldScrollToBottom = true;
        }
      });
  }

  /**
   * Charge l'historique du chat
   */
  private loadChatHistory(): void {
    // L'historique est géré par le RagService
    // Cette méthode peut être étendue pour charger depuis le localStorage
  }

  /**
   * Envoie une question
   */
  async sendQuery(): Promise<void> {
    const query = this.currentQuery.trim();
    if (!query || this.isStreaming) {
      return;
    }

    // Vider le champ de saisie
    this.currentQuery = '';

    try {
      await this.ragService.chatWithRag(query);
    } catch (error) {
      console.error('Error sending query:', error);
      this.connectionStatus = 'disconnected';
      
      // Réessayer la connexion après un délai
      setTimeout(() => {
        this.connectionStatus = 'connected';
      }, 3000);
    }
  }

  /**
   * Utilise une question d'exemple
   */
  useExampleQuestion(question: string): void {
    this.currentQuery = question;
    this.focusInput();
  }

  /**
   * Gère l'appui sur les touches
   */
  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendQuery();
    }
  }

  /**
   * Efface l'historique des messages
   */
  clearChat(): void {
    if (confirm('Are you sure you want to clear the chat history?')) {
      this.ragService.clearMessages();
    }
  }

  /**
   * Exporte le chat
   */
  async exportChat(): Promise<void> {
    if (this.messages.length === 0) return;

    try {
      const chatData = this.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        sources: msg.sources || [],
        confidence: msg.confidence,
        processingTimeMs: msg.processingTimeMs
      }));

      const blob = new Blob([JSON.stringify(chatData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `regalica-chat-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting chat:', error);
    }
  }

  /**
   * Clique sur une citation
   */
  onCitationClick(source: RagSource): void {
    this.viewerService.scrollToSpan({
      docId: source.id,
      page: source.page,
      spanStart: source.spanStart,
      spanEnd: source.spanEnd,
      chunkId: source.chunkId
    });
  }

  /**
   * Copie un message dans le presse-papiers
   */
  async copyMessage(message: ChatMessage): Promise<void> {
    try {
      await navigator.clipboard.writeText(message.content);
      // TODO: Afficher une notification de succès
    } catch (error) {
      console.error('Error copying message:', error);
    }
  }

  /**
   * Améliore une question
   */
  improveQuestion(message: ChatMessage): void {
    // Trouver la question utilisateur correspondante
    const messageIndex = this.messages.indexOf(message);
    if (messageIndex > 0) {
      const userMessage = this.messages[messageIndex - 1];
      if (userMessage.role === 'user') {
        this.currentQuery = `Please provide more details about: ${userMessage.content}`;
        this.focusInput();
      }
    }
  }

  /**
   * Formate le contenu d'un message (support basique du markdown)
   */
  formatMessageContent(content: string): string {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  /**
   * Formate l'heure
   */
  formatTime(timestamp: Date): string {
    return timestamp.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  /**
   * Formate le temps de traitement
   */
  formatProcessingTime(timeMs: number): string {
    if (timeMs < 1000) {
      return `${Math.round(timeMs)}ms`;
    } else {
      return `${(timeMs / 1000).toFixed(1)}s`;
    }
  }

  /**
   * Formate le score de confiance
   */
  formatConfidence(confidence: number): string {
    return `${Math.round(confidence * 100)}%`;
  }

  /**
   * Obtient le niveau de confiance
   */
  getConfidenceLevel(confidence: number): string {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  }

  /**
   * Obtient la classe CSS pour le score de confiance
   */
  getConfidenceClass(confidence: number): string {
    return `confidence-${this.getConfidenceLevel(confidence)}`;
  }

  /**
   * Vérifie si un message est une réponse "NO_ANSWER"
   */
  isNoAnswer(message: ChatMessage): boolean {
    return message.role === 'assistant' && message.content.trim() === 'NO_ANSWER';
  }

  /**
   * Obtient un message d'explication pour NO_ANSWER
   */
  getNoAnswerExplanation(): string {
    return "I couldn't find relevant information in the uploaded documents to answer your question. Try rephrasing your question or asking about a different topic.";
  }

  /**
   * Obtient le texte du statut de connexion
   */
  getConnectionStatusText(): string {
    switch (this.connectionStatus) {
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Connection lost';
      default: return 'Connected';
    }
  }

  /**
   * TrackBy pour optimiser le rendu des messages
   */
  trackByMessageId(index: number, message: ChatMessage): string {
    return message.id;
  }

  /**
   * TrackBy pour optimiser le rendu des sources
   */
  trackBySourceId(index: number, source: RagSource): string {
    return source.id + source.spanStart + source.spanEnd;
  }

  /**
   * Fait défiler vers le bas
   */
  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        const element = this.messagesContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (error) {
      console.error('Error scrolling to bottom:', error);
    }
  }

  /**
   * Met le focus sur le champ de saisie
   */
  private focusInput(): void {
    setTimeout(() => {
      if (this.queryInput) {
        this.queryInput.nativeElement.focus();
      }
    }, 100);
  }
}
