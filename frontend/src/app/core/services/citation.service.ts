import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';

export interface CitationPreview {
  chunk_id: string;
  document: {
    id: string;
    title: string;
    filename: string;
    mime_type: string;
    uploaded_at: string;
  };
  content: {
    text: string;
    tokens: number;
    page: number | null;
    heading_path: string | null;
    span_start: number;
    span_end: number;
  };
}

export interface CitationLocation {
  chunk_id: string;
  document_id: string;
  document_title: string;
  document_filename: string;
  location: {
    page: number | null;
    span_start: number;
    span_end: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class CitationService {
  private readonly baseUrl = '/api/rag/citation'; // L'intercepteur ajoutera automatiquement l'URL de base
  private previewCache = new Map<string, Observable<CitationPreview>>();

  constructor(private http: HttpClient) {}

  /**
   * Récupère la prévisualisation d'une citation (avec cache)
   */
  getPreview(chunkId: string): Observable<CitationPreview> {
    if (!this.previewCache.has(chunkId)) {
      const preview$ = this.http.get<CitationPreview>(`${this.baseUrl}/preview/${chunkId}`).pipe(
        shareReplay(1),
        catchError(error => {
          console.error(`[CitationService] Error fetching preview for ${chunkId}:`, error);
          return of(null as any);
        })
      );
      this.previewCache.set(chunkId, preview$);
    }
    return this.previewCache.get(chunkId)!;
  }

  /**
   * Récupère la localisation d'une citation dans le document
   */
  getLocation(chunkId: string): Observable<CitationLocation> {
    return this.http.get<CitationLocation>(`${this.baseUrl}/locate/${chunkId}`).pipe(
      catchError(error => {
        console.error(`[CitationService] Error fetching location for ${chunkId}:`, error);
        return of(null as any);
      })
    );
  }

  /**
   * Récupère plusieurs prévisualisations en batch (optimisation)
   */
  getBatchPreviews(chunkIds: string[]): Observable<{chunks: CitationPreview[], count: number}> {
    return this.http.post<{chunks: CitationPreview[], count: number}>(
      `${this.baseUrl}/batch-preview`,
      { chunk_ids: chunkIds }
    ).pipe(
      catchError(error => {
        console.error('[CitationService] Error fetching batch previews:', error);
        return of({ chunks: [], count: 0 });
      })
    );
  }

  /**
   * Nettoie le cache des prévisualisations
   */
  clearCache(): void {
    this.previewCache.clear();
  }

  /**
   * Extrait les IDs de citations depuis le texte [1], [2], etc.
   */
  extractCitationIds(text: string): number[] {
    const regex = /\[(\d+)\]/g;
    const ids: number[] = [];
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const id = parseInt(match[1], 10);
      if (!ids.includes(id)) {
        ids.push(id);
      }
    }
    
    return ids.sort((a, b) => a - b);
  }
}
