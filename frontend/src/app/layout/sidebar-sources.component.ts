import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { UploadDropzoneComponent } from '../features/upload/upload-dropzone.component';
import { Document, DocumentFilter, IngestService } from '../services/ingest.service';
import { ViewerService } from '../core/services/viewer.service';

@Component({
  selector: 'app-sidebar-sources',
  standalone: true,
  imports: [CommonModule, FormsModule, UploadDropzoneComponent],
  template: `
    <div class="sources-sidebar">
      <!-- Header -->
      <div class="sidebar-header">
        <h2 class="sidebar-title">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
          </svg>
          Sources
        </h2>
        
        <button class="upload-toggle-btn"
                (click)="toggleUpload()"
                [class.active]="showUpload"
                title="Toggle upload panel">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
        </button>
      </div>

      <!-- Upload Panel -->
      <div class="upload-panel" [class.expanded]="showUpload">
        <app-upload-dropzone 
          (uploadComplete)="onUploadComplete()"
          (uploadError)="onUploadError($event)">
        </app-upload-dropzone>
      </div>

      <!-- Filters -->
      <div class="filters-section">
        <!-- Search -->
        <div class="search-box">
          <svg class="search-icon w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <input type="text"
                 [(ngModel)]="filters.search"
                 (ngModelChange)="onFilterChange()"
                 placeholder="Search documents..."
                 class="search-input"
                 [attr.aria-label]="'Search documents'">
          <button *ngIf="filters.search"
                  (click)="clearSearch()"
                  class="clear-search-btn"
                  title="Clear search"
                  aria-label="Effacer la recherche">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <!-- Type Filter -->
        <div class="filter-group">
          <label class="filter-label" for="typeFilter">Type</label>
          <select [(ngModel)]="filters.mimeType"
                  (ngModelChange)="onFilterChange()"
                  class="filter-select"
                  id="typeFilter">
            <option value="">All types</option>
            <option value="application/pdf">PDF</option>
            <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">Word</option>
            <option value="text/html">HTML</option>
            <option value="text/plain">Text</option>
          </select>
        </div>

        <!-- Status Filter -->
        <div class="filter-group">
          <label class="filter-label" for="statusFilter">Status</label>
          <select [(ngModel)]="filters.status"
                  (ngModelChange)="onFilterChange()"
                  class="filter-select"
                  id="statusFilter">
            <option value="">All status</option>
            <option value="ready">Ready</option>
            <option value="processing">Processing</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      <!-- Documents List -->
      <div class="documents-section">
        <div class="documents-header">
          <span class="documents-count">
            {{ totalDocuments }} document{{ totalDocuments !== 1 ? 's' : '' }}
          </span>
          
          <button class="refresh-btn"
                  (click)="refreshDocuments()"
                  [disabled]="isLoading"
                  title="Refresh documents">
            <svg class="w-4 h-4" [class.animate-spin]="isLoading" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          </button>
        </div>

        <div class="documents-list" [class.loading]="isLoading">
          <!-- Loading State -->
          <div *ngIf="isLoading && documents.length === 0" class="loading-state">
            <div class="loading-spinner"></div>
            <span>Loading documents...</span>
          </div>

          <!-- Empty State -->
          <div *ngIf="!isLoading && documents.length === 0" class="empty-state">
            <svg class="w-12 h-12 empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <p class="empty-message">
              {{ filters.search || filters.mimeType || filters.status ? 'No documents match your filters' : 'No documents uploaded yet' }}
            </p>
            <button *ngIf="!showUpload && !filters.search && !filters.mimeType && !filters.status"
                    (click)="toggleUpload()"
                    class="upload-cta-btn">
              Upload your first document
            </button>
          </div>

          <!-- Documents -->
          <div *ngFor="let doc of documents; trackBy: trackByDocId" 
               class="document-item"
               [class.selected]="selectedDocumentId === doc.id"
               (click)="selectDocument(doc)"
               (keydown.enter)="selectDocument(doc)"
               role="button"
               tabindex="0">
            
            <!-- Document Icon -->
            <div class="document-icon" [class]="'type-' + getDocumentTypeClass(doc.mimeType)">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>

            <!-- Document Info -->
            <div class="document-info">
              <h3 class="document-title" [title]="doc.title">{{ doc.title }}</h3>
              <div class="document-meta">
                <span class="document-size">{{ formatFileSize(doc.size) }}</span>
                <span class="document-date">{{ formatDate(doc.uploadedAt) }}</span>
              </div>
              <div class="document-stats" *ngIf="doc.chunksCount || doc.tokensCount">
                <span *ngIf="doc.chunksCount" class="stat">{{ doc.chunksCount }} chunks</span>
                <span *ngIf="doc.tokensCount" class="stat">{{ doc.tokensCount }} tokens</span>
              </div>
            </div>

            <!-- Status Badge -->
            <div class="document-status" [class]="'status-' + doc.status">
              <svg *ngIf="doc.status === 'ready'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <svg *ngIf="doc.status === 'processing'" class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              <svg *ngIf="doc.status === 'error'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>

            <!-- Action Button -->
            <button class="document-action-btn"
                    (click)="openDocument(doc, $event)"
                    [disabled]="doc.status !== 'ready'"
                    title="Open document">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Pagination -->
        <div *ngIf="totalPages > 1" class="pagination">
          <button class="pagination-btn"
                  [disabled]="currentPage === 1"
                  (click)="goToPage(currentPage - 1)">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          
          <span class="pagination-info">
            {{ currentPage }} / {{ totalPages }}
          </span>
          
          <button class="pagination-btn"
                  [disabled]="currentPage === totalPages"
                  (click)="goToPage(currentPage + 1)">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./sidebar-sources.component.scss']
})
export class SidebarSourcesComponent implements OnInit, OnDestroy {
  documents: Document[] = [];
  totalDocuments = 0;
  currentPage = 1;
  totalPages = 1;
  pageSize = 20;
  isLoading = false;
  showUpload = false;
  selectedDocumentId: string | null = null;

  filters: DocumentFilter = {
    search: '',
    mimeType: '',
    status: ''
  };

  private destroy$ = new Subject<void>();
  private filterChange$ = new Subject<void>();

  constructor(
    private ingestService: IngestService,
    private viewerService: ViewerService
  ) {}

  ngOnInit(): void {
    this.setupFilterDebounce();
    this.loadDocuments();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Configure le debounce pour les filtres
   */
  private setupFilterDebounce(): void {
    this.filterChange$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.currentPage = 1;
        this.loadDocuments();
      });
  }

  /**
   * Charge la liste des documents
   */
  private async loadDocuments(): Promise<void> {
    this.isLoading = true;
    
    try {
      const response = await this.ingestService.getDocuments({
        page: this.currentPage,
        pageSize: this.pageSize,
        ...this.filters
      }).toPromise();
      
      if (response) {
        this.documents = response.items;
        this.totalDocuments = response.total;
        this.totalPages = response.totalPages;
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
      this.documents = [];
      this.totalDocuments = 0;
      this.totalPages = 1;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Appelé quand les filtres changent
   */
  onFilterChange(): void {
    this.filterChange$.next();
  }

  /**
   * Efface la recherche
   */
  clearSearch(): void {
    this.filters.search = '';
    this.onFilterChange();
  }

  /**
   * Actualise la liste des documents
   */
  refreshDocuments(): void {
    this.loadDocuments();
  }

  /**
   * Bascule l'affichage du panneau d'upload
   */
  toggleUpload(): void {
    this.showUpload = !this.showUpload;
  }

  /**
   * Sélectionne un document
   */
  selectDocument(doc: Document): void {
    this.selectedDocumentId = doc.id;
  }

  /**
   * Ouvre un document dans le viewer
   */
  async openDocument(doc: Document, event: Event): Promise<void> {
    event.stopPropagation();
    
    if (doc.status !== 'ready') return;

    try {
      // Charger le contenu du document
      const content = await this.ingestService.getDocumentContent(doc.id).toPromise();
      
      if (content) {
        // Charger dans le viewer
        this.viewerService.loadDocument({
          id: doc.id,
          title: doc.title,
          pages: (content.pages || []).map(page => ({
            ...page,
            spans: []
          }))
        });
        
        this.selectedDocumentId = doc.id;
      }
    } catch (error) {
      console.error('Failed to open document:', error);
    }
  }

  /**
   * Va à une page spécifique
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadDocuments();
    }
  }

  /**
   * Appelé quand un upload se termine avec succès
   */
  onUploadComplete(): void {
    // Actualiser la liste
    this.refreshDocuments();
    
    // Fermer le panneau d'upload
    this.showUpload = false;
  }

  /**
   * Appelé quand un upload échoue
   */
  onUploadError(error: string): void {
    console.error('Upload error:', error);
    // TODO: Afficher une notification d'erreur
  }

  /**
   * TrackBy pour optimiser le rendu de la liste
   */
  trackByDocId(index: number, doc: Document): string {
    return doc.id;
  }

  /**
   * Obtient la classe CSS pour le type de document
   */
  getDocumentTypeClass(mimeType: string): string {
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('word')) return 'word';
    if (mimeType.includes('html')) return 'html';
    if (mimeType.includes('text')) return 'text';
    return 'unknown';
  }

  /**
   * Formate la taille d'un fichier
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Formate une date
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
}
