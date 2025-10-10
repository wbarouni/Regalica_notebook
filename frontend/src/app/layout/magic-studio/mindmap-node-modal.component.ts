import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MindMapContextService } from '../../services/mindmap-context.service';
import { NodeContext } from '../../services/node-context.model';
import { RagService } from '../../services/rag.service';

interface MindMapNode {
  id: string;
  text: string;
  level: number;
  x: number;
  y: number;
  sourceIds: string[];
  connections: string[];
}

@Component({
  selector: 'app-mindmap-node-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="onOverlayClick($event)" *ngIf="node">
      <div class="modal-container" (click)="$event.stopPropagation()">
        <!-- Header -->
        <header class="modal-header">
          <div class="header-content">
            <div class="node-icon" [style.background-color]="getLevelColor()">
              <span class="level-badge">L{{ node.level }}</span>
            </div>
            <div class="header-text">
              <h2 class="node-title">{{ node.text }}</h2>
              <p class="node-meta" *ngIf="context">
                <span>{{ context.chunkCount }} chunks</span>
                <span>•</span>
                <span>{{ context.citations?.length || 0 }} sources</span>
              </p>
            </div>
          </div>
          <button class="close-btn" (click)="close()" aria-label="Close">
            ×
          </button>
        </header>

        <!-- Body -->
        <div class="modal-body">
          <!-- Loading State -->
          <div class="loading-state" *ngIf="isLoading">
            <div class="spinner"></div>
            <p>Chargement du contexte...</p>
          </div>

          <!-- Content -->
          <div class="modal-content" *ngIf="!isLoading && context && !error">
            <!-- Summary Section -->
            <section class="summary-section">
              <h3 class="section-title">📋 Résumé Détaillé</h3>
              <div class="summary-content">
                {{ summaryExpanded ? context.fullSummary : getTruncatedSummary() }}
              </div>
              <button class="show-more-btn" 
                      *ngIf="context.fullSummary.length > 300"
                      (click)="toggleSummary()">
                {{ summaryExpanded ? 'Voir moins' : 'Voir plus' }}
              </button>
            </section>

            <!-- Citations Section -->
            <section class="citations-section" *ngIf="context.citations?.length">
              <h3 class="section-title">📚 Sources ({{ context.citations.length }})</h3>
              <div class="citations-list">
                <div *ngFor="let citation of context.citations" 
                     class="citation-card"
                     (click)="openCitation(citation)">
                  <div class="citation-header">
                    <span class="doc-title">{{ citation.docTitle }}</span>
                    <span class="page-badge" *ngIf="citation.page">
                      Page {{ citation.page }}
                    </span>
                  </div>
                  <p class="citation-text">{{ citation.text.substring(0, 100) }}...</p>
                </div>
              </div>
            </section>

            <!-- Related Nodes Section -->
            <section class="related-section" *ngIf="context.relatedNodes?.length">
              <h3 class="section-title">🔗 Concepts Connexes ({{ context.relatedNodes.length }})</h3>
              <div class="related-nodes-grid">
                <button *ngFor="let related of context.relatedNodes"
                        class="related-node-btn"
                        (click)="navigateToNode(related.id)">
                  <span class="related-label">{{ related.label }}</span>
                  <span class="similarity-badge">{{ related.similarity }}%</span>
                </button>
              </div>
            </section>

            <!-- Suggested Questions Section -->
            <section class="questions-section" *ngIf="context.suggestedQuestions?.length">
              <h3 class="section-title">❓ Questions Suggérées</h3>
              <div class="questions-list">
                <button *ngFor="let question of context.suggestedQuestions"
                        class="question-btn"
                        (click)="askQuestion(question)">
                  {{ question }}
                </button>
              </div>
            </section>

            <!-- Chat Section -->
            <section class="chat-section">
              <h3 class="section-title">💬 Poser une Question</h3>
              <div class="chat-input-group">
                <textarea 
                  [(ngModel)]="userQuestion"
                  placeholder="Demandez des détails sur ce concept..."
                  (keydown.enter)="onEnter($event)"
                  rows="3"></textarea>
                <button class="send-btn" 
                        (click)="submitQuestion()"
                        [disabled]="!userQuestion.trim() || isSending">
                  {{ isSending ? 'Envoi...' : 'Envoyer' }}
                </button>
              </div>
            </section>
          </div>

          <!-- Error State -->
          <div class="error-state" *ngIf="error">
            <h3>⚠️ Erreur de Chargement</h3>
            <p>{{ error }}</p>
            <button class="retry-btn" (click)="loadContext()">Réessayer</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 200ms ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-container {
      width: 90vw;
      max-width: 800px;
      max-height: 90vh;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      animation: slideIn 300ms ease-out;
    }

    @keyframes slideIn {
      from { transform: translateY(50px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .modal-header {
      padding: 24px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .header-content {
      display: flex;
      gap: 16px;
      flex: 1;
    }

    .node-icon {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      flex-shrink: 0;
    }

    .header-text {
      flex: 1;
    }

    .node-title {
      margin: 0 0 8px 0;
      font-size: 20px;
      font-weight: 600;
      color: #111827;
    }

    .node-meta {
      margin: 0;
      font-size: 14px;
      color: #6b7280;
      display: flex;
      gap: 8px;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 32px;
      color: #6b7280;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 150ms;
    }

    .close-btn:hover {
      background: #f3f4f6;
      color: #111827;
    }

    .modal-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }

    .loading-state, .error-state {
      text-align: center;
      padding: 40px 20px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f4f6;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .modal-content section {
      margin-bottom: 24px;
    }

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      margin: 0 0 12px 0;
    }

    .summary-content {
      color: #374151;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .show-more-btn {
      margin-top: 12px;
      background: none;
      border: none;
      color: #3b82f6;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }

    .citations-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .citation-card {
      padding: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      cursor: pointer;
      transition: all 150ms;
    }

    .citation-card:hover {
      border-color: #3b82f6;
      background: #f9fafb;
    }

    .citation-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .doc-title {
      font-weight: 500;
      color: #111827;
    }

    .page-badge {
      font-size: 12px;
      color: #6b7280;
    }

    .citation-text {
      font-size: 14px;
      color: #6b7280;
      margin: 0;
    }

    .related-nodes-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }

    .related-node-btn {
      padding: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: white;
      cursor: pointer;
      transition: all 150ms;
      text-align: left;
    }

    .related-node-btn:hover {
      border-color: #3b82f6;
      background: #f9fafb;
    }

    .related-label {
      display: block;
      font-weight: 500;
      color: #111827;
      margin-bottom: 4px;
    }

    .similarity-badge {
      font-size: 12px;
      color: #3b82f6;
    }

    .questions-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .question-btn {
      padding: 12px 16px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: white;
      cursor: pointer;
      text-align: left;
      transition: all 150ms;
      color: #374151;
    }

    .question-btn:hover {
      border-color: #3b82f6;
      background: #f9fafb;
      color: #3b82f6;
    }

    .chat-input-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .chat-input-group textarea {
      padding: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-family: inherit;
      font-size: 14px;
      resize: vertical;
    }

    .send-btn {
      padding: 12px 24px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
      transition: all 150ms;
      align-self: flex-end;
    }

    .send-btn:hover:not(:disabled) {
      background: #2563eb;
    }

    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .retry-btn {
      padding: 12px 24px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
    }
  `]
})
export class MindMapNodeModalComponent implements OnInit {
  @Input() node!: MindMapNode;
  @Input() notebookId?: string;
  @Output() closed = new EventEmitter<void>();
  @Output() nodeNavigate = new EventEmitter<string>();
  
  context?: NodeContext;
  isLoading = false;
  isSending = false;
  error?: string;
  
  userQuestion = '';
  summaryExpanded = false;
  
  constructor(
    private contextService: MindMapContextService,
    private ragService: RagService
  ) {}
  
  ngOnInit() {
    this.loadContext();
  }
  
  async loadContext() {
    this.isLoading = true;
    this.error = undefined;
    
    try {
      this.context = await this.contextService.getNodeContext(
        this.node.id,
        this.notebookId
      );
    } catch (err: any) {
      this.error = err.message || 'Failed to load context';
    } finally {
      this.isLoading = false;
    }
  }
  
  getLevelColor(): string {
    const colors: Record<number, string> = {
      0: '#6B46C1',
      1: '#6B46C1',
      2: '#3B82F6',
      3: '#10B981',
      4: '#8B5CF6'
    };
    return colors[this.node.level] || colors[1];
  }
  
  getTruncatedSummary(): string {
    if (!this.context) return '';
    const summary = this.context.fullSummary;
    return summary.length > 300 ? summary.substring(0, 300) + '...' : summary;
  }
  
  toggleSummary() {
    this.summaryExpanded = !this.summaryExpanded;
  }
  
  openCitation(citation: any) {
    console.log('Open citation:', citation);
    // TODO: Implement navigation to document
  }
  
  navigateToNode(nodeId: string) {
    this.nodeNavigate.emit(nodeId);
    this.close();
  }
  
  askQuestion(question: string) {
    this.userQuestion = question;
    this.submitQuestion();
  }
  
  async submitQuestion() {
    if (!this.userQuestion.trim()) return;
    
    this.isSending = true;
    
    try {
      // Send question to RAG service
      await this.ragService.askQuestion(this.userQuestion, 5).toPromise();
      this.close();
    } catch (err) {
      console.error('Failed to send question:', err);
    } finally {
      this.isSending = false;
    }
  }
  
  onEnter(event: Event) {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.ctrlKey || keyEvent.metaKey) {
      keyEvent.preventDefault();
      this.submitQuestion();
    }
  }
  
  onOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }
  
  close() {
    this.closed.emit();
  }
}
