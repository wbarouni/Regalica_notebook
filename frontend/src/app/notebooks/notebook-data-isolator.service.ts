import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { NotebookContextService } from './notebook-context.service';

/**
 * Service to isolate data by notebook context
 * When a notebook is active, filters all data to show only notebook-specific items
 */
@Injectable({
  providedIn: 'root'
})
export class NotebookDataIsolatorService {
  private readonly apiUrl = '/api/notebooks';

  constructor(
    private http: HttpClient,
    private notebookContext: NotebookContextService
  ) {}

  /**
   * Get documents - filtered by notebook if one is active
   */
  getDocuments(): Observable<any[]> {
    const notebookId = this.notebookContext.getActiveId();
    
    if (notebookId) {
      // Load only notebook documents
      return this.http.get<any>(`${this.apiUrl}/${notebookId}/boot`).pipe(
        map(data => data.documents || [])
      );
    }
    
    // No notebook active - return empty or all documents
    return of([]);
  }

  /**
   * Get chat history - filtered by notebook if one is active
   */
  getChatHistory(): Observable<any[]> {
    const notebookId = this.notebookContext.getActiveId();
    
    if (notebookId) {
      // Load only notebook session
      return this.http.get<any>(`${this.apiUrl}/${notebookId}/boot`).pipe(
        map(data => data.session || [])
      );
    }
    
    // No notebook active - return empty
    return of([]);
  }

  /**
   * Save message to notebook if one is active
   */
  saveMessage(role: 'user' | 'assistant', content: string, citations: any[] = []): Observable<any> {
    const notebookId = this.notebookContext.getActiveId();
    
    if (notebookId) {
      return this.http.post(`${this.apiUrl}/${notebookId}/messages`, {
        role,
        content,
        citations
      });
    }
    
    // No notebook active - no-op
    return of(null);
  }

  /**
   * Bind document to notebook if one is active
   */
  bindDocument(documentId: number): Observable<any> {
    const notebookId = this.notebookContext.getActiveId();
    
    if (notebookId) {
      return this.http.post(`${this.apiUrl}/${notebookId}/bind-document`, {
        document_id: documentId
      });
    }
    
    // No notebook active - no-op
    return of(null);
  }

  /**
   * Check if currently in notebook context
   */
  isInNotebookContext(): boolean {
    return this.notebookContext.getActiveId() !== null;
  }
}
