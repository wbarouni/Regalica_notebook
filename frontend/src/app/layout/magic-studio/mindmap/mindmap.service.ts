import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, tap, throwError } from 'rxjs';
import { MindMapData, MindMapNode, MindMapState } from './mindmap.model';

@Injectable({
  providedIn: 'root'
})
export class MindMapService {
  private readonly apiUrl = '/api/studio/mindmap';
  
  private stateSubject = new BehaviorSubject<MindMapState>({
    data: null,
    selectedNode: null,
    loading: false,
    error: null,
    searchTerm: ''
  });

  public state$ = this.stateSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Get current state
   */
  get state(): MindMapState {
    return this.stateSubject.value;
  }

  /**
   * Generate mind map from query
   */
  generateFromQuery(query: string, topK: number = 50, lang: string = 'en'): Observable<MindMapData> {
    this.updateState({ loading: true, error: null });

    let params = new HttpParams()
      .set('query', query)
      .set('topK', topK.toString())
      .set('lang', lang);

    return this.http.get<MindMapData>(this.apiUrl, { params }).pipe(
      tap(data => {
        this.updateState({ 
          data, 
          loading: false,
          selectedNode: null 
        });
      }),
      catchError(error => {
        const errorMessage = error.error?.error || 'Failed to generate mind map';
        this.updateState({ 
          loading: false, 
          error: errorMessage 
        });
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  /**
   * Generate mind map from document ID
   */
  generateFromDocument(docId: string, topK: number = 50, lang: string = 'en'): Observable<MindMapData> {
    this.updateState({ loading: true, error: null });

    let params = new HttpParams()
      .set('docId', docId)
      .set('topK', topK.toString())
      .set('lang', lang);

    return this.http.get<MindMapData>(this.apiUrl, { params }).pipe(
      tap(data => {
        this.updateState({ 
          data, 
          loading: false,
          selectedNode: null 
        });
      }),
      catchError(error => {
        const errorMessage = error.error?.error || 'Failed to generate mind map';
        this.updateState({ 
          loading: false, 
          error: errorMessage 
        });
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  /**
   * Save mind map to database
   */
  saveMindMap(workspaceId?: string, createdBy?: string): Observable<{mindMapId: string; message: string}> {
    const currentData = this.state.data;
    if (!currentData) {
      return throwError(() => new Error('No mind map data to save'));
    }

    const body = {
      mindMapData: currentData,
      workspaceId,
      createdBy
    };

    return this.http.post<{mindMapId: string; message: string}>(this.apiUrl, body).pipe(
      catchError(error => {
        const errorMessage = error.error?.error || 'Failed to save mind map';
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  /**
   * Select a node
   */
  selectNode(node: MindMapNode | null): void {
    this.updateState({ selectedNode: node });
  }

  /**
   * Set search term
   */
  setSearchTerm(term: string): void {
    this.updateState({ searchTerm: term });
  }

  /**
   * Clear mind map data
   */
  clear(): void {
    this.updateState({
      data: null,
      selectedNode: null,
      loading: false,
      error: null,
      searchTerm: ''
    });
  }

  /**
   * Reset error state
   */
  clearError(): void {
    this.updateState({ error: null });
  }

  /**
   * Find nodes by search term
   */
  searchNodes(term: string): MindMapNode[] {
    const data = this.state.data;
    if (!data || !term.trim()) {
      return [];
    }

    const searchLower = term.toLowerCase();
    return data.nodes.filter(node => 
      node.label.toLowerCase().includes(searchLower) ||
      node.summary.toLowerCase().includes(searchLower)
    );
  }

  /**
   * Update state partially
   */
  private updateState(partial: Partial<MindMapState>): void {
    this.stateSubject.next({
      ...this.state,
      ...partial
    });
  }
}
