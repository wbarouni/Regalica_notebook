import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Document {
  id: string;
  title: string;
  mime: string;
  bytes: number;
  created_at: string;
  chunks_count: number;
}

export interface PaginatedDocuments {
  documents: Document[];
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
export class DocumentsService {
  private readonly apiUrl = `${environment.apiBaseUrl}/docs`;

  constructor(private http: HttpClient) {}

  getDocuments(page: number = 1, pageSize: number = environment.pageSize): Observable<PaginatedDocuments> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    return this.http.get<PaginatedDocuments>(this.apiUrl, { params });
  }
}
