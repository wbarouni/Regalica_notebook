import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { RagService, ChatMessage, RagSource } from '../services/rag.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  constructor(private ragService: RagService) {}

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
  }

  ngOnDestroy(): void {
    this.messagesSubscription?.unsubscribe();
    this.loadingSubscription?.unsubscribe();
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
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la question:', error);
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
   * Clique sur une citation
   */
  onCitationClick(source: RagSource): void {
    console.log('Citation cliquée:', source);
    // TODO: Implémenter la navigation vers le document/page
    // Cela sera fait dans le Bloc 10 avec le viewer
  }

  /**
   * Copie un message dans le presse-papiers
   */
  async copyMessage(message: ChatMessage): Promise<void> {
    try {
      await navigator.clipboard.writeText(message.content);
      console.log('Message copié dans le presse-papiers');
    } catch (error) {
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
}
