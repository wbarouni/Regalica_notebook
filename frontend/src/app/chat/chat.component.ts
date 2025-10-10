import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { RagService, ChatMessage, RagSource } from '../services/rag.service';
import { InlineCitationsPipe } from './inline-citations.pipe';
import { MindMapStateService } from '../services/mindmap-state.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, InlineCitationsPipe],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('queryInput') private queryInput!: ElementRef;

  messages: ChatMessage[] = [];
  currentQuery: string = '';
  isLoading: boolean = false;
  
  private messagesSubscription?: Subscription;
  private loadingSubscription?: Subscription;
  private shouldScrollToBottom = false;

  // Exemples de questions
  exampleQuestions = [
    "Quel est le sujet principal de ce document ?",
    "Pouvez-vous résumer les points clés ?",
    "Quelles sont les conclusions importantes ?",
    "Y a-t-il des recommandations spécifiques ?"
  ];

  constructor(
    private ragService: RagService,
    private router: Router,
    private mindMapState: MindMapStateService
  ) {}

  ngOnInit(): void {
    // S'abonner aux messages
    this.messagesSubscription = this.ragService.messages$.subscribe(messages => {
      this.messages = messages;
      this.shouldScrollToBottom = true;
    });

    // S'abonner au state de loading
    this.loadingSubscription = this.ragService.loading$.subscribe(loading => {
      this.isLoading = loading;
      if (loading) {
        this.shouldScrollToBottom = true;
      }
    });

    // Configurer window.citationClick pour les citations inline
    (window as any).citationClick = (chunkId: string, citationNum: number) => {
      this.handleCitationClick(chunkId, citationNum);
    };
  }

  ngOnDestroy(): void {
    this.messagesSubscription?.unsubscribe();
    this.loadingSubscription?.unsubscribe();
    
    // Nettoyer window.citationClick
    delete (window as any).citationClick;
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  /**
   * Envoie une question
   */
  async sendQuery(): Promise<void> {
    const query = this.currentQuery.trim();
    if (!query || this.isLoading) {
      return;
    }

    // Vider le champ de saisie
    this.currentQuery = '';

    try {
      await this.ragService.chatWithRag(query);
    } catch {
      // console.error(\'Error sending query:\', error);
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
   * Gère l'appui sur Enter
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
    this.ragService.clearMessages();
  }

  /**
   * Gère le clic sur une citation inline
   */
  handleCitationClick(chunkId: string, citationNum: number): void {
    // Trouver la source correspondante dans le dernier message assistant
    const lastAssistantMsg = [...this.messages].reverse().find(m => m.role === 'assistant');
    if (lastAssistantMsg?.sources) {
      const source = lastAssistantMsg.sources[citationNum - 1];
      if (source) {
        this.onCitationClick(source);
      }
    }
  }

  /**
   * Clique sur une citation (placeholder pour futur viewer)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onCitationClick(source: RagSource): void {
    // TODO: Implémenter la navigation vers le document/page
    // Cela sera fait dans le Bloc 10 avec le viewer
    console.log('Citation clicked:', source);
  }

  /**
   * Copie un message dans le presse-papiers
   */
  async copyMessage(message: ChatMessage): Promise<void> {
    try {
      await navigator.clipboard.writeText(message.content);
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      console.error('Erreur lors de la copie:', error);
    }
  }

  /**
   * Formate le temps de traitement
   */
  formatProcessingTime(timeMs?: number): string {
    if (!timeMs) return '';
    
    if (timeMs < 1000) {
      return `${Math.round(timeMs)}ms`;
    } else {
      return `${(timeMs / 1000).toFixed(1)}s`;
    }
  }

  /**
   * Formate le score de confiance
   */
  formatConfidence(confidence?: number): string {
    if (confidence === undefined) return '';
    return `${Math.round(confidence * 100)}%`;
  }

  /**
   * Obtient la classe CSS pour le score de confiance
   */
  getConfidenceClass(confidence?: number): string {
    if (!confidence) return 'confidence-unknown';
    
    if (confidence >= 0.8) return 'confidence-high';
    if (confidence >= 0.6) return 'confidence-medium';
    return 'confidence-low';
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
    return "Je n'ai pas trouvé suffisamment d'informations pertinentes dans les documents pour répondre à votre question. Essayez de reformuler votre question ou de poser une question plus spécifique.";
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      console.error('Erreur lors du scroll:', error);
    }
  }

  /**
   * TrackBy function pour optimiser le rendu des messages
   */
  trackByMessageId(index: number, message: ChatMessage): string {
    return message.id;
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

  /**
   * Génère un Mind Map pour un message spécifique
   */
  generateMindMapForMessage(message: ChatMessage): void {
    if (message.role !== 'assistant' || !message.sources || message.sources.length === 0) {
      return;
    }

    // Store in Mind Map state
    this.mindMapState.setCurrentMindMap({
      id: crypto.randomUUID(),
      query: this.getQueryForMessage(message),
      timestamp: new Date(),
      nodes: [],
      connections: [],
      sourceMessageId: message.id
    });

    // Add to history
    this.mindMapState.addToHistory(this.mindMapState.getCurrentMindMap()!);

    // Navigate to Magic Studio Mind Map
    this.router.navigate(['/magic-studio'], {
      queryParams: { tab: 'mindmap' }
    });
  }

  /**
   * Obtient la requête associée à un message assistant
   */
  private getQueryForMessage(message: ChatMessage): string {
    // Trouve le message user précédent
    const messageIndex = this.messages.indexOf(message);
    if (messageIndex > 0) {
      const previousMessage = this.messages[messageIndex - 1];
      if (previousMessage.role === 'user') {
        return previousMessage.content;
      }
    }
    return message.content.substring(0, 100);
  }

  /**
   * Keyboard shortcuts handler
   */
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    // Ctrl/Cmd + M → Generate Mind Map pour dernier message
    if ((event.ctrlKey || event.metaKey) && event.key === 'm') {
      event.preventDefault();
      const lastAssistantMessage = [...this.messages]
        .reverse()
        .find(m => m.role === 'assistant' && m.sources && m.sources.length > 0);
      
      if (lastAssistantMessage) {
        this.generateMindMapForMessage(lastAssistantMessage);
      }
    }
  }

  /**
   * Vérifie si un message peut générer un Mind Map
   */
  canGenerateMindMap(message: ChatMessage): boolean {
    return message.role === 'assistant' && 
           !!message.sources && 
           message.sources.length > 0 &&
           !this.isNoAnswer(message);
  }
}
