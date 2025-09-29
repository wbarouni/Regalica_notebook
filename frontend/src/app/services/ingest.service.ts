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

@Injectable({
  providedIn: 'root'
})
export class IngestService {
  private readonly apiUrl = `${environment.apiBaseUrl}/ingest`;

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
}
