import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UploadResult {
  document: {
    id: string;
    title: string;
    mime: string;
    bytes: number;
    created_at: string;
  };
  stats: {
    pages?: number;
    chunks: number;
    embed_ms_total: number;
    duplicate?: boolean;
  };
}

export interface Chunk {
  id: string;
  seq: number;
  heading_path: string[];
  tokens: number;
  span_start: number;
  span_end: number;
  page_no?: number;
  text: string;
}

export interface PaginatedChunks {
  chunks: Chunk[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface Document {
  id: string;
  title: string;
  filename: string;
  mimeType: string;
  size: number;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  uploadedAt: string;
  processedAt?: string;
  chunksCount?: number;
  tokensCount?: number;
  error?: string;
}

export interface DocumentContent {
  id: string;
  title: string;
  content: string;
  pages: DocumentPage[];
}

export interface DocumentPage {
  number: number;
  content: string;
}

export interface DocumentFilter {
  search?: string;
  status?: string;
  mimeType?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable({
  providedIn: 'root'
})
export class IngestService {
  private readonly apiUrl = '/api/ingest'; // L'intercepteur ajoutera automatiquement l'URL de base

  constructor(private http: HttpClient) {}

  uploadDocument(file: File): Observable<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<UploadResult>(`${this.apiUrl}/upload`, formData);
  }

  getDocumentChunks(docId: string, page: number = 1, pageSize: number = environment.pageSize): Observable<PaginatedChunks> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    return this.http.get<PaginatedChunks>(`${this.apiUrl}/${docId}/chunks`, { params });
  }

  /**
   * Obtient la liste des documents avec pagination et filtres
   */
  getDocuments(params: DocumentFilter & { page?: number; pageSize?: number } = {}): Observable<PaginatedResponse<Document>> {
    return this.http.get<PaginatedResponse<Document>>(`${this.apiUrl}/documents`, { params: params as HttpParams });
  }

  /**
   * Obtient le contenu d'un document
   */
  getDocumentContent(documentId: string): Observable<DocumentContent> {
    return this.http.get<DocumentContent>(`${this.apiUrl}/documents/${documentId}/content`);
  }

  /**
   * Supprime un document
   */
  deleteDocument(documentId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/documents/${documentId}`);
  }

  /**
   * Retraite un document en erreur
   */
  retryDocument(documentId: string): Observable<Document> {
    return this.http.post<Document>(`${this.apiUrl}/documents/${documentId}/retry`, {});
  }

  /**
   * Obtient les statistiques d'ingestion
   */
  getStats(): Observable<unknown> {
    return this.http.get(`${this.apiUrl}/stats`);
  }
}
