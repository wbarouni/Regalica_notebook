import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';

export interface Notebook {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  document_count: number;
  message_count: number;
  last_activity: string | null;
}

export interface NotebookDocument {
  id: number;
  title: string;
  filename: string;
  content_type: string;
  page_count: number;
  created_at: string;
  added_at: string;
}

export interface NotebookMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: any[];
  created_at: string;
}

export interface NotebookBootData {
  notebook: Notebook;
  documents: NotebookDocument[];
  session: NotebookMessage[];
  stats: {
    document_count: number;
    message_count: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class NotebookService {
  private apiUrl = '/api/notebooks';
  
  // Current notebook state
  private currentNotebookSubject = new BehaviorSubject<Notebook | null>(null);
  public currentNotebook$ = this.currentNotebookSubject.asObservable();
  
  // Notebooks list
  private notebooksSubject = new BehaviorSubject<Notebook[]>([]);
  public notebooks$ = this.notebooksSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadNotebooks();
  }

  /**
   * Get current notebook ID
   */
  getCurrentNotebookId(): string | null {
    return this.currentNotebookSubject.value?.id || null;
  }

  /**
   * Set current notebook
   */
  setCurrentNotebook(notebook: Notebook | null): void {
    this.currentNotebookSubject.next(notebook);
    if (notebook) {
      localStorage.setItem('current-notebook-id', notebook.id);
    } else {
      localStorage.removeItem('current-notebook-id');
    }
  }

  /**
   * Load all notebooks
   */
  loadNotebooks(): Observable<Notebook[]> {
    return this.http.get<{ notebooks: Notebook[] }>(`${this.apiUrl}/list`).pipe(
      tap(response => {
        this.notebooksSubject.next(response.notebooks);
        console.log('[NotebookService] Notebooks loaded');
      }),
      map(response => response.notebooks)
    );
  }

  /**
   * Create a new notebook
   */
  createNotebook(title: string, description?: string): Observable<Notebook> {
    return this.http.post<{ notebook: Notebook }>(`${this.apiUrl}/create`, {
      title,
      description
    }).pipe(
      tap(response => {
        // Add to local list
        const current = this.notebooksSubject.value;
        this.notebooksSubject.next([response.notebook, ...current]);
        console.log('[NotebookService] Notebook created:', response.notebook.id);
      }),
      map(response => response.notebook)
    );
  }

  /**
   * Get notebook by ID
   */
  getNotebook(id: string): Observable<Notebook> {
    return this.http.get<{ notebook: Notebook }>(`${this.apiUrl}/${id}`).pipe(
      map(response => response.notebook)
    );
  }

  /**
   * Boot notebook - load all data needed for workspace
   */
  bootNotebook(id: string, limit = 10): Observable<NotebookBootData> {
    return this.http.get<NotebookBootData>(`${this.apiUrl}/${id}/boot?limit=${limit}`).pipe(
      tap(data => {
        this.setCurrentNotebook(data.notebook);
        console.log('[NotebookService] Notebook booted:', id);
      })
    );
  }

  /**
   * Save a message to notebook session
   */
  saveMessage(
    notebookId: string,
    role: 'user' | 'assistant',
    content: string,
    citations: any[] = []
  ): Observable<NotebookMessage> {
    return this.http.post<{ message: NotebookMessage }>(
      `${this.apiUrl}/${notebookId}/save-message`,
      { role, content, citations }
    ).pipe(
      tap(() => console.log(`[NotebookService] ${role} message saved to ${notebookId}`)),
      map(response => response.message)
    );
  }

  /**
   * Bind a document to a notebook
   */
  bindDocument(notebookId: string, documentId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${notebookId}/bind-document`, {
      documentId
    }).pipe(
      tap(() => console.log('[NotebookService] Document bound:', documentId))
    );
  }

  /**
   * Update notebook metadata
   */
  updateNotebook(id: string, title: string, description?: string): Observable<Notebook> {
    return this.http.put<{ notebook: Notebook }>(`${this.apiUrl}/${id}`, {
      title,
      description
    }).pipe(
      tap(response => {
        // Update in local list
        const current = this.notebooksSubject.value;
        const index = current.findIndex(n => n.id === id);
        if (index !== -1) {
          current[index] = response.notebook;
          this.notebooksSubject.next([...current]);
        }
        // Update current if it's the active one
        if (this.currentNotebookSubject.value?.id === id) {
          this.setCurrentNotebook(response.notebook);
        }
        console.log('[NotebookService] Notebook updated:', id);
      }),
      map(response => response.notebook)
    );
  }

  /**
   * Delete a notebook
   */
  deleteNotebook(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        // Remove from local list
        const current = this.notebooksSubject.value;
        this.notebooksSubject.next(current.filter(n => n.id !== id));
        // Clear current if it's the deleted one
        if (this.currentNotebookSubject.value?.id === id) {
          this.setCurrentNotebook(null);
        }
        console.log('[NotebookService] Notebook deleted:', id);
      })
    );
  }
}
