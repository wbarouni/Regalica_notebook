import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ViewerService, ViewerDocument } from '../core/services/viewer.service';

@Component({
  selector: 'app-viewer-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="viewer-panel">
      <!-- Header -->
      <div class="viewer-header">
        <div class="header-content">
          <h3 class="viewer-title">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            Document Viewer
          </h3>
          
          <div class="header-actions" *ngIf="currentDocument">
            <button class="header-btn"
                    (click)="zoomOut()"
                    [disabled]="zoomLevel <= 0.5"
                    title="Zoom out">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"></path>
              </svg>
            </button>
            
            <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
            
            <button class="header-btn"
                    (click)="zoomIn()"
                    [disabled]="zoomLevel >= 2"
                    title="Zoom in">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path>
              </svg>
            </button>
          </div>
        </div>
        
        <!-- Document Info -->
        <div class="document-info" *ngIf="currentDocument">
          <h4 class="document-title">{{ currentDocument.title }}</h4>
          <div class="document-meta">
            <span class="page-info">
              Page {{ currentPage }} of {{ currentDocument.pages?.length || 0 }}
            </span>
          </div>
        </div>
      </div>

      <!-- Content Area -->
      <div class="viewer-content" [class.has-document]="currentDocument">
        
        <!-- Empty State -->
        <div *ngIf="!currentDocument" class="empty-state">
          <div class="empty-icon">
            <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <h3 class="empty-title">No Document Selected</h3>
          <p class="empty-description">
            Select a document from the sources panel or click on a citation to view it here.
          </p>
        </div>

        <!-- Document Content -->
        <div *ngIf="currentDocument" class="document-container">
          <div class="document-page" 
               [style.transform]="'scale(' + zoomLevel + ')'"
               [style.transform-origin]="'top left'">
            
            <!-- Page Content -->
            <div class="page-content" 
                 [innerHTML]="getHighlightedContent(getCurrentPageContent())">
            </div>
            
            <!-- Highlights Overlay -->
            <div class="highlights-overlay">
              <div *ngFor="let highlight of currentHighlights"
                   class="highlight-span"
                   [class]="'highlight-' + highlight.type"
                   [style.top.px]="highlight.top"
                   [style.left.px]="highlight.left"
                   [style.width.px]="highlight.width"
                   [style.height.px]="highlight.height"
                   [title]="highlight.text">
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation -->
      <div class="viewer-navigation" *ngIf="currentDocument && currentDocument.pages && currentDocument.pages.length > 1">
        <button class="nav-btn"
                (click)="previousPage()"
                [disabled]="currentPage === 1"
                title="Previous page">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
          </svg>
        </button>
        
        <div class="page-selector">
          <select [(ngModel)]="currentPage" 
                  (ngModelChange)="goToPage(+$event)"
                  class="page-select">
            <option *ngFor="let page of currentDocument.pages; let i = index" 
                    [value]="i + 1">
              Page {{ i + 1 }}
            </option>
          </select>
        </div>
        
        <button class="nav-btn"
                (click)="nextPage()"
                [disabled]="currentPage === (currentDocument.pages?.length || 0)"
                title="Next page">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./viewer-panel.component.scss']
})
export class ViewerPanelComponent implements OnInit, OnDestroy {
  currentDocument: ViewerDocument | null = null;
  currentPage: number = 1;
  zoomLevel: number = 1;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  currentHighlights: { type: string; pageNumber: number; spanStart: number; spanEnd: number; text: string; top: number; left: number; width: number; height: number; }[] = [];

  private destroy$ = new Subject<void>();

  constructor(private viewerService: ViewerService) {}

  ngOnInit(): void {
    this.setupSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Configure les abonnements aux services
   */
  private setupSubscriptions(): void {
    // Document actuel
    this.viewerService.currentDocument$
      .pipe(takeUntil(this.destroy$))
      .subscribe(document => {
        this.currentDocument = document;
        if (document) {
          this.currentPage = 1;
          this.zoomLevel = 1;
        }
      });
  }

  /**
   * Obtient le contenu de la page actuelle
   */
  getCurrentPageContent(): string {
    if (!this.currentDocument || !this.currentDocument.pages || !this.currentDocument.pages[this.currentPage - 1]) {
      return '';
    }
    return this.currentDocument.pages[this.currentPage - 1].content || '';
  }

  /**
   * Obtient le contenu avec surbrillance
   */
  getHighlightedContent(content: string): string {
    // Appliquer les highlights au contenu
    let highlightedContent = content;
    
    this.currentHighlights.forEach(highlight => {
      if (highlight.pageNumber === this.currentPage) {
        const beforeText = highlightedContent.substring(0, highlight.spanStart);
        const highlightText = highlightedContent.substring(highlight.spanStart, highlight.spanEnd);
        const afterText = highlightedContent.substring(highlight.spanEnd);
        
        highlightedContent = beforeText + 
          `<mark class="highlight-${highlight.type}">${highlightText}</mark>` + 
          afterText;
      }
    });
    
    return highlightedContent;
  }

  /**
   * Fait défiler vers un span spécifique
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private scrollToSpan(scrollData: { top: number; left: number; width: number; height: number; }): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
// console.log('Scroll to span:', scrollData);
    // Implémentation simplifiée pour éviter les erreurs
  }

  /**
   * Page précédente
   */
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  /**
   * Page suivante
   */
  nextPage(): void {
    if (this.currentDocument && this.currentDocument.pages && this.currentPage < this.currentDocument.pages.length) {
      this.currentPage++;
    }
  }

  /**
   * Va à une page spécifique
   */
  goToPage(page: number): void {
    if (this.currentDocument && this.currentDocument.pages && page >= 1 && page <= this.currentDocument.pages.length) {
      this.currentPage = page;
    }
  }

  /**
   * Zoom avant
   */
  zoomIn(): void {
    if (this.zoomLevel < 2) {
      this.zoomLevel = Math.min(2, this.zoomLevel + 0.25);
    }
  }

  /**
   * Zoom arrière
   */
  zoomOut(): void {
    if (this.zoomLevel > 0.5) {
      this.zoomLevel = Math.max(0.5, this.zoomLevel - 0.25);
    }
  }

  /**
   * Expose Math pour le template
   */
  Math = Math;
}
