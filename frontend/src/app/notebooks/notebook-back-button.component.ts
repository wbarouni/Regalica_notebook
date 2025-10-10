import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotebookContextService } from './notebook-context.service';

@Component({
  selector: 'app-notebook-back-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button 
      *ngIf="isInNotebookWorkspace()"
      class="notebook-back-button"
      (click)="goToNotebooks()"
      title="Retour aux notebooks">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
      </svg>
      <span>Notebooks</span>
    </button>
  `,
  styles: [`
    .notebook-back-button {
      position: fixed;
      top: 16px;
      left: 16px;
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: #FFFFFF;
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #000000;
      cursor: pointer;
      transition: all 150ms ease-in-out;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .notebook-back-button:hover {
      background: #F9FAFB;
      border-color: rgba(0, 0, 0, 0.2);
      transform: translateX(-2px);
    }

    .notebook-back-button svg {
      width: 20px;
      height: 20px;
    }

    @media (max-width: 768px) {
      .notebook-back-button {
        top: 8px;
        left: 8px;
        padding: 6px 12px;
        font-size: 13px;
      }

      .notebook-back-button span {
        display: none;
      }
    }
  `]
})
export class NotebookBackButtonComponent {
  constructor(
    public notebookContext: NotebookContextService,
    private router: Router
  ) {}

  /**
   * Check if we're in a notebook workspace (not the list)
   */
  isInNotebookWorkspace(): boolean {
    const url = this.router.url;
    // Match /notebooks/:id but not /notebooks alone
    return url.startsWith('/notebooks/') && url !== '/notebooks';
  }

  goToNotebooks(): void {
    this.notebookContext.clearActive();
    this.router.navigate(['/notebooks']);
  }
}
