import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-magic-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="magic-button-wrapper">
      <!-- Preview Panel (slide-out au hover) -->
      <div class="magic-preview" [class.show]="showPreview && !active">
        <div class="preview-header">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
          <span>Quick Actions</span>
        </div>
        <div class="preview-items">
          <div class="preview-item">✨ Summary</div>
          <div class="preview-item">📋 Action Plan</div>
          <div class="preview-item">🎴 Flashcards</div>
          <div class="preview-item">🎙️ Podcast</div>
          <div class="preview-item">🗺️ Mind Map</div>
        </div>
      </div>
      
      <!-- Bouton Magic (design inchangé) -->
      <button class="magic-button" 
              [class.active]="active"
              (click)="onToggle()"
              (mouseenter)="showPreview = true"
              (mouseleave)="showPreview = false"
              title="Magic Studio">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364-.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
        </svg>
        <span>{{ active ? 'Exit Magic' : 'Magic Studio' }}</span>
      </button>
    </div>
  `,
  styles: [`
    /* Wrapper pour position relative */
    .magic-button-wrapper {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      z-index: 50;
    }
    
    /* Preview Panel - Slide-out au hover */
    .magic-preview {
      position: absolute;
      bottom: 0;
      right: calc(100% + 1rem);
      width: 200px;
      background: white;
      border-radius: 1rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
      padding: 1rem;
      transform: translateX(50px);
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .magic-preview.show {
      transform: translateX(0);
      opacity: 1;
    }
    
    .preview-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: #6b7280;
      margin-bottom: 0.75rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .preview-items {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .preview-item {
      padding: 0.5rem 0.75rem;
      background: #f9fafb;
      border-radius: 0.5rem;
      font-size: 0.813rem;
      color: #374151;
      transition: all 0.2s;
      cursor: default;
    }
    
    .preview-item:hover {
      background: #f3f4f6;
    }
    
    /* Bouton Magic - styles existants inchangés */
    .magic-button {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #111827;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 2rem;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      transition: all 0.2s;
    }
    
    .magic-button:hover {
      background: #374151;
      transform: translateY(-2px);
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    }
    
    .magic-button:active {
      transform: translateY(0);
    }
    
    .magic-button.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      animation: pulse 2s ease-in-out infinite;
    }
    
    .magic-button.active:hover {
      background: linear-gradient(135deg, #5568d3 0%, #6a3f92 100%);
    }
    
    @keyframes pulse {
      0%, 100% {
        box-shadow: 0 10px 15px -3px rgba(102, 126, 234, 0.3);
      }
      50% {
        box-shadow: 0 20px 25px -5px rgba(102, 126, 234, 0.5);
      }
    }
  `]
})
export class MagicButtonComponent {
  @Input() active = false;
  @Output() toggle = new EventEmitter<void>();
  
  showPreview = false;

  onToggle(): void {
    this.toggle.emit();
  }
}
