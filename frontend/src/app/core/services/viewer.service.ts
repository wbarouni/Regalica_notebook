import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ViewerDocument {
  id: string;
  title: string;
  content: string;
  pages?: ViewerPage[];
}

export interface ViewerPage {
  number: number;
  content: string;
  spans: ViewerSpan[];
}

export interface ViewerSpan {
  start: number;
  end: number;
  text: string;
  chunkId?: string;
}

export interface HighlightRequest {
  docId: string;
  page?: number;
  spanStart: number;
  spanEnd: number;
  chunkId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ViewerService {
  private currentDocumentSubject = new BehaviorSubject<ViewerDocument | null>(null);
  public currentDocument$ = this.currentDocumentSubject.asObservable();

  private highlightedSpansSubject = new BehaviorSubject<HighlightRequest[]>([]);
  public highlightedSpans$ = this.highlightedSpansSubject.asObservable();

  private currentPageSubject = new BehaviorSubject<number>(1);
  public currentPage$ = this.currentPageSubject.asObservable();

  constructor() {}

  /**
   * Charge un document dans le viewer
   */
  loadDocument(document: ViewerDocument): void {
    this.currentDocumentSubject.next(document);
    this.currentPageSubject.next(1);
    this.clearHighlights();
  }

  /**
   * Obtient le document actuellement affiché
   */
  getCurrentDocument(): ViewerDocument | null {
    return this.currentDocumentSubject.value;
  }

  /**
   * Change la page courante
   */
  setCurrentPage(page: number): void {
    const doc = this.getCurrentDocument();
    if (doc && doc.pages && page >= 1 && page <= doc.pages.length) {
      this.currentPageSubject.next(page);
    }
  }

  /**
   * Obtient la page courante
   */
  getCurrentPage(): number {
    return this.currentPageSubject.value;
  }

  /**
   * Fait défiler vers un span spécifique et le met en surbrillance
   */
  scrollToSpan(request: HighlightRequest): void {
    const doc = this.getCurrentDocument();
    if (!doc || doc.id !== request.docId) {
      console.warn('Document not loaded or ID mismatch:', request.docId);
      return;
    }

    // Changer de page si nécessaire
    if (request.page && request.page !== this.getCurrentPage()) {
      this.setCurrentPage(request.page);
    }

    // Ajouter le highlight
    this.addHighlight(request);

    // Scroll vers l'élément après un court délai pour permettre le rendu
    setTimeout(() => {
      this.performScroll(request);
    }, 100);
  }

  /**
   * Ajoute un highlight à la liste
   */
  private addHighlight(request: HighlightRequest): void {
    const currentHighlights = this.highlightedSpansSubject.value;
    
    // Éviter les doublons
    const exists = currentHighlights.some(h => 
      h.docId === request.docId &&
      h.page === request.page &&
      h.spanStart === request.spanStart &&
      h.spanEnd === request.spanEnd
    );

    if (!exists) {
      this.highlightedSpansSubject.next([...currentHighlights, request]);
    }
  }

  /**
   * Effectue le scroll physique vers l'élément
   */
  private performScroll(request: HighlightRequest): void {
    // Chercher l'élément par attribut data
    const selector = `[data-span-start="${request.spanStart}"][data-span-end="${request.spanEnd}"]`;
    const element = document.querySelector(selector);

    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });

      // Ajouter une classe temporaire pour l'animation
      element.classList.add('viewer-highlight-flash');
      setTimeout(() => {
        element.classList.remove('viewer-highlight-flash');
      }, 2000);
    } else {
      // Fallback: scroll vers le début du contenu
      const contentElement = document.querySelector('.viewer-content');
      if (contentElement) {
        contentElement.scrollTop = Math.max(0, (request.spanStart / 1000) * contentElement.scrollHeight);
      }
    }
  }

  /**
   * Efface tous les highlights
   */
  clearHighlights(): void {
    this.highlightedSpansSubject.next([]);
  }

  /**
   * Supprime un highlight spécifique
   */
  removeHighlight(request: HighlightRequest): void {
    const currentHighlights = this.highlightedSpansSubject.value;
    const filtered = currentHighlights.filter(h => 
      !(h.docId === request.docId &&
        h.page === request.page &&
        h.spanStart === request.spanStart &&
        h.spanEnd === request.spanEnd)
    );
    this.highlightedSpansSubject.next(filtered);
  }

  /**
   * Vérifie si un span est actuellement en surbrillance
   */
  isHighlighted(docId: string, page: number | undefined, spanStart: number, spanEnd: number): boolean {
    const highlights = this.highlightedSpansSubject.value;
    return highlights.some(h => 
      h.docId === docId &&
      h.page === page &&
      h.spanStart === spanStart &&
      h.spanEnd === spanEnd
    );
  }

  /**
   * Obtient les highlights pour la page courante
   */
  getHighlightsForCurrentPage(): HighlightRequest[] {
    const currentPage = this.getCurrentPage();
    const doc = this.getCurrentDocument();
    
    if (!doc) return [];

    return this.highlightedSpansSubject.value.filter(h => 
      h.docId === doc.id && h.page === currentPage
    );
  }
}
