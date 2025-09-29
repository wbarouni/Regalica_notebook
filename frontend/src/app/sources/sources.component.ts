import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentsService, Document, PaginatedDocuments } from '../services/documents.service';
import { IngestService, UploadResult, PaginatedChunks } from '../services/ingest.service';
import { UploadComponent } from './upload.component';

@Component({
  selector: 'app-sources',
  standalone: true,
  imports: [CommonModule, FormsModule, UploadComponent],
  template: `
    <div class="min-h-screen bg-gray-50" data-testid="sources-page">
      <!-- Header -->
      <header class="bg-white border-b border-gray-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center h-16">
            <h1 class="text-2xl font-semibold text-black" data-testid="page-title">Sources</h1>
            <div class="text-sm text-gray-600">
              {{ totalDocuments }} documents • {{ totalChunks }} chunks
            </div>
          </div>
        </div>
      </header>

      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <!-- Upload Panel -->
          <div class="lg:col-span-1">
            <app-upload (uploadComplete)="onUploadComplete($event)" data-testid="upload-panel"></app-upload>
          </div>

          <!-- Documents List Panel -->
          <div class="lg:col-span-2">
            <div class="bg-white rounded-lg border border-gray-200" data-testid="documents-panel">
              <div class="p-6 border-b border-gray-200">
                <div class="flex justify-between items-center mb-4">
                  <h2 class="text-lg font-semibold text-black">Documents</h2>
                  <button 
                    (click)="refreshDocuments()"
                    class="p-2 text-gray-600 hover:text-black transition-colors"
                    data-testid="refresh-button"
                  >
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                  </button>
                </div>

                <!-- Filters -->
                <div class="flex space-x-4 mb-4">
                  <select 
                    [(ngModel)]="selectedMimeFilter"
                    (change)="applyFilters()"
                    class="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black"
                    data-testid="mime-filter"
                  >
                    <option value="">Tous les types</option>
                    <option value="application/pdf">PDF</option>
                    <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">DOCX</option>
                    <option value="text/html">HTML</option>
                    <option value="text/plain">TXT</option>
                  </select>

                  <input 
                    type="text"
                    [(ngModel)]="searchQuery"
                    (input)="applyFilters()"
                    placeholder="Rechercher..."
                    class="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black"
                    data-testid="search-input"
                  />
                </div>
              </div>

              <!-- Documents Table -->
              <div class="overflow-x-auto" data-testid="documents-table">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Taille</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chunks</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <tr *ngFor="let doc of filteredDocuments; trackBy: trackByDocId" 
                        class="hover:bg-gray-50 transition-colors"
                        [attr.data-testid]="'document-row-' + doc.id">
                      <td class="px-6 py-4">
                        <div class="text-sm font-medium text-black truncate max-w-xs" [title]="doc.title">
                          {{ doc.title }}
                        </div>
                      </td>
                      <td class="px-6 py-4">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                              [class]="getMimeTypeClass(doc.mime)">
                          {{ getMimeTypeLabel(doc.mime) }}
                        </span>
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600">
                        {{ formatFileSize(doc.bytes) }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600">
                        {{ doc.chunks_count }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600">
                        {{ formatDate(doc.created_at) }}
                      </td>
                      <td class="px-6 py-4 text-sm">
                        <button 
                          (click)="viewChunks(doc)"
                          class="text-black hover:text-gray-700 font-medium"
                          [attr.data-testid]="'view-chunks-' + doc.id"
                        >
                          Voir chunks
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <!-- Empty State -->
                <div *ngIf="filteredDocuments.length === 0" 
                     class="text-center py-12" 
                     data-testid="empty-state">
                  <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  <h3 class="mt-2 text-sm font-medium text-gray-900">Aucun document</h3>
                  <p class="mt-1 text-sm text-gray-500">Commencez par uploader votre premier document.</p>
                </div>
              </div>

              <!-- Pagination -->
              <div *ngIf="pagination && pagination.totalPages > 1" 
                   class="px-6 py-4 border-t border-gray-200 flex items-center justify-between"
                   data-testid="pagination">
                <div class="text-sm text-gray-700">
                  Affichage {{ (pagination.page - 1) * pagination.pageSize + 1 }} à 
                  {{ Math.min(pagination.page * pagination.pageSize, pagination.total) }} 
                  sur {{ pagination.total }} résultats
                </div>
                <div class="flex space-x-2">
                  <button 
                    (click)="goToPage(pagination.page - 1)"
                    [disabled]="pagination.page <= 1"
                    class="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="prev-page"
                  >
                    Précédent
                  </button>
                  <span class="px-3 py-1 text-sm">
                    Page {{ pagination.page }} sur {{ pagination.totalPages }}
                  </span>
                  <button 
                    (click)="goToPage(pagination.page + 1)"
                    [disabled]="pagination.page >= pagination.totalPages"
                    class="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="next-page"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Chunks Modal -->
        <div *ngIf="selectedDocument" 
             class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
             (click)="closeChunksModal()"
             data-testid="chunks-modal">
          <div class="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col"
               (click)="$event.stopPropagation()">
            <div class="p-6 border-b border-gray-200">
              <div class="flex justify-between items-center">
                <h3 class="text-lg font-semibold text-black">
                  Chunks - {{ selectedDocument.title }}
                </h3>
                <button 
                  (click)="closeChunksModal()"
                  class="text-gray-400 hover:text-gray-600"
                  data-testid="close-modal"
                >
                  <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            </div>
            
            <div class="flex-1 overflow-y-auto p-6" data-testid="chunks-list">
              <div *ngIf="loadingChunks" class="text-center py-8">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto"></div>
                <p class="mt-2 text-gray-600">Chargement des chunks...</p>
              </div>
              
              <div *ngIf="!loadingChunks && chunks.length > 0" class="space-y-4">
                <div *ngFor="let chunk of chunks; trackBy: trackByChunkId"
                     class="border border-gray-200 rounded-md p-4"
                     [attr.data-testid]="'chunk-' + chunk.id">
                  <div class="flex justify-between items-start mb-2">
                    <div class="text-sm text-gray-600">
                      Chunk {{ chunk.seq + 1 }} • {{ chunk.tokens }} tokens
                      <span *ngIf="chunk.page_no"> • Page {{ chunk.page_no }}</span>
                    </div>
                    <div class="text-xs text-gray-500">
                      {{ chunk.span_start }}-{{ chunk.span_end }}
                    </div>
                  </div>
                  
                  <div *ngIf="chunk.heading_path.length > 0" class="mb-2">
                    <div class="text-xs text-gray-500">
                      {{ chunk.heading_path.join(' > ') }}
                    </div>
                  </div>
                  
                  <div class="text-sm text-gray-800 whitespace-pre-wrap">
                    {{ chunk.text }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SourcesComponent implements OnInit {
  documents: Document[] = [];
  filteredDocuments: Document[] = [];
  pagination: any = null;
  selectedMimeFilter = '';
  searchQuery = '';
  
  selectedDocument: Document | null = null;
  chunks: any[] = [];
  loadingChunks = false;
  
  totalDocuments = 0;
  totalChunks = 0;

  constructor(
    private documentsService: DocumentsService,
    private ingestService: IngestService
  ) {}

  ngOnInit(): void {
    this.loadDocuments();
  }

  loadDocuments(page: number = 1): void {
    this.documentsService.getDocuments(page).subscribe({
      next: (result: PaginatedDocuments) => {
        this.documents = result.documents;
        this.pagination = result.pagination;
        this.applyFilters();
        this.calculateTotals();
      },
      error: (error) => {
        console.error('Error loading documents:', error);
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.documents];
    
    if (this.selectedMimeFilter) {
      filtered = filtered.filter(doc => doc.mime === this.selectedMimeFilter);
    }
    
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(doc => 
        doc.title.toLowerCase().includes(query)
      );
    }
    
    this.filteredDocuments = filtered;
  }

  calculateTotals(): void {
    this.totalDocuments = this.pagination?.total || 0;
    this.totalChunks = this.documents.reduce((sum, doc) => sum + doc.chunks_count, 0);
  }

  onUploadComplete(result: UploadResult): void {
    this.refreshDocuments();
  }

  refreshDocuments(): void {
    this.loadDocuments(this.pagination?.page || 1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.pagination.totalPages) {
      this.loadDocuments(page);
    }
  }

  viewChunks(document: Document): void {
    this.selectedDocument = document;
    this.loadingChunks = true;
    this.chunks = [];
    
    this.ingestService.getDocumentChunks(document.id).subscribe({
      next: (result: PaginatedChunks) => {
        this.chunks = result.chunks;
        this.loadingChunks = false;
      },
      error: (error) => {
        console.error('Error loading chunks:', error);
        this.loadingChunks = false;
      }
    });
  }

  closeChunksModal(): void {
    this.selectedDocument = null;
    this.chunks = [];
  }

  trackByDocId(index: number, doc: Document): string {
    return doc.id;
  }

  trackByChunkId(index: number, chunk: any): string {
    return chunk.id;
  }

  getMimeTypeLabel(mime: string): string {
    switch (mime) {
      case 'application/pdf': return 'PDF';
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return 'DOCX';
      case 'text/html': return 'HTML';
      case 'text/plain': return 'TXT';
      default: return mime;
    }
  }

  getMimeTypeClass(mime: string): string {
    switch (mime) {
      case 'application/pdf': return 'bg-red-100 text-red-800';
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return 'bg-blue-100 text-blue-800';
      case 'text/html': return 'bg-orange-100 text-orange-800';
      case 'text/plain': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('fr-FR');
  }
}
