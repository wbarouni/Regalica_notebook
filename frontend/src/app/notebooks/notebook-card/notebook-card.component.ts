import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Notebook } from '../notebook.service';

@Component({
  selector: 'app-notebook-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="notebook-card" (click)="cardClick.emit()">
      <!-- Header -->
      <div class="card-header">
        <div class="card-icon">📔</div>
        <button 
          class="card-delete"
          (click)="deleteClick.emit($event)"
          title="Supprimer">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Title -->
      <h3 class="card-title">{{ notebook.title }}</h3>

      <!-- Description -->
      <p class="card-description" *ngIf="notebook.description">
        {{ notebook.description }}
      </p>

      <!-- Stats -->
      <div class="card-stats">
        <div class="stat">
          <svg class="stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <span>{{ notebook.document_count }} docs</span>
        </div>
        
        <div class="stat">
          <svg class="stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
          </svg>
          <span>{{ notebook.message_count }} messages</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="card-footer">
        <span class="card-date">{{ getRelativeTime(notebook.updated_at) }}</span>
      </div>
    </div>
  `,
  styleUrls: ['./notebook-card.component.scss']
})
export class NotebookCardComponent {
  @Input() notebook!: Notebook;
  @Output() cardClick = new EventEmitter<void>();
  @Output() deleteClick = new EventEmitter<Event>();

  /**
   * Get relative time string
   */
  getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'short',
      year: diffDays > 365 ? 'numeric' : undefined
    });
  }
}
