import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { NotebookService, Notebook } from '../notebook.service';
import { NotebookCardComponent } from '../notebook-card/notebook-card.component';

@Component({
  selector: 'app-notebook-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, NotebookCardComponent],
  templateUrl: './notebook-manager.component.html',
  styleUrls: ['./notebook-manager.component.scss']
})
export class NotebookManagerComponent implements OnInit {
  notebooks$: Observable<Notebook[]>;
  showNewModal = false;
  searchQuery = '';
  sortBy: 'recent' | 'oldest' | 'name' = 'recent';

  constructor(
    private notebookService: NotebookService,
    private router: Router
  ) {
    this.notebooks$ = this.notebookService.notebooks$;
  }

  ngOnInit(): void {
    // Reload notebooks on component init
    this.notebookService.loadNotebooks().subscribe();
  }

  /**
   * Open notebook workspace
   */
  openNotebook(notebook: Notebook): void {
    this.router.navigate(['/notebooks', notebook.id]);
  }

  /**
   * Show new notebook modal
   */
  showCreateModal(): void {
    this.showNewModal = true;
  }

  /**
   * Hide new notebook modal
   */
  hideCreateModal(): void {
    this.showNewModal = false;
  }

  /**
   * Create new notebook
   */
  createNotebook(title: string, description: string): void {
    if (!title.trim()) return;

    this.notebookService.createNotebook(title, description).subscribe({
      next: (notebook) => {
        this.hideCreateModal();
        // Navigate to new notebook workspace immediately
        this.router.navigate(['/notebooks', notebook.id]);
      },
      error: (error) => {
        console.error('Failed to create notebook:', error);
        alert('Erreur lors de la création du notebook');
      }
    });
  }

  /**
   * Delete notebook
   */
  deleteNotebook(notebook: Notebook, event: Event): void {
    event.stopPropagation();
    
    if (!confirm(`Supprimer "${notebook.title}" ?`)) return;

    this.notebookService.deleteNotebook(notebook.id).subscribe({
      next: () => {
        console.log('Notebook deleted');
      },
      error: (error) => {
        console.error('Failed to delete notebook:', error);
        alert('Erreur lors de la suppression');
      }
    });
  }

  /**
   * Track by function for ngFor
   */
  trackByNotebookId(index: number, notebook: Notebook): string {
    return notebook.id;
  }
}
