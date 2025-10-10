import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Notebook } from './notebook.service';

/**
 * Service to manage the active notebook context
 * This service keeps track of which notebook is currently active
 * and broadcasts this information to all components that need it
 */
@Injectable({
  providedIn: 'root'
})
export class NotebookContextService {
  private activeNotebookSubject = new BehaviorSubject<Notebook | null>(null);
  public activeNotebook$ = this.activeNotebookSubject.asObservable();

  constructor() {}

  /**
   * Set the active notebook context
   */
  setActive(notebook: Notebook | null): void {
    this.activeNotebookSubject.next(notebook);
    if (notebook) {
      console.log('[NotebookContext] Active notebook set:', notebook.id, notebook.title);
    } else {
      console.log('[NotebookContext] Notebook context cleared');
    }
  }

  /**
   * Get the current active notebook
   */
  getActive(): Notebook | null {
    return this.activeNotebookSubject.value;
  }

  /**
   * Get the ID of the active notebook
   */
  getActiveId(): string | null {
    return this.activeNotebookSubject.value?.id || null;
  }

  /**
   * Clear the active notebook context
   */
  clearActive(): void {
    this.activeNotebookSubject.next(null);
    console.log('[NotebookContext] Context cleared');
  }

  /**
   * Check if a notebook is currently active
   */
  isActive(notebookId: string): boolean {
    return this.getActiveId() === notebookId;
  }
}
