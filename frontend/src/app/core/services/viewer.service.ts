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
   * Fait défiler vers un span spécifique et le met en surbrillance avec Range DOM précis
   */
  scrollToSpan(docId: string, page: number | undefined, start: number, end: number, chunkId?: string): void {
    const doc = this.getCurrentDocument();
    if (!doc || doc.id !== docId) {
      console.warn('ViewerService: Document not loaded or ID mismatch:', docId);
      return;
    }

    const request: HighlightRequest = {
      docId,
      page,
      spanStart: start,
      spanEnd: end,
      chunkId
    };

    // Changer de page si nécessaire
    if (page && page !== this.getCurrentPage()) {
      this.setCurrentPage(page);
    }

    // Ajouter le highlight
    this.addHighlight(request);

    // Scroll vers l'élément après un court délai pour permettre le rendu
    setTimeout(() => {
      this.performDOMRangeScroll(request);
    }, 150);
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
   * Effectue le scroll physique vers l'élément avec Range DOM précis
   */
  private performDOMRangeScroll(request: HighlightRequest): void {
    try {
      // Chercher d'abord par attribut data (méthode préférée)
      const selector = `[data-span-start="${request.spanStart}"][data-span-end="${request.spanEnd}"]`;
      let targetElement = document.querySelector(selector);

      if (targetElement) {
        this.scrollToElementAndHighlight(targetElement, request);
        return;
      }

      // Fallback: utiliser Range API pour trouver le texte par position
      const contentElement = document.querySelector('.viewer-content, .document-content, .page-content');
      if (!contentElement) {
        console.warn('ViewerService: No content element found for scrolling');
        return;
      }

      const range = this.createRangeFromCharacterPositions(contentElement, request.spanStart, request.spanEnd);
      if (range) {
        targetElement = this.createHighlightElement(range, request);
        if (targetElement) {
          this.scrollToElementAndHighlight(targetElement, request);
        }
      } else {
        // Fallback final: scroll proportionnel
        this.performProportionalScroll(contentElement, request);
      }

    } catch (error) {
      console.error('ViewerService: Error during DOM range scroll:', error);
      // Fallback silencieux
      const contentElement = document.querySelector('.viewer-content, .document-content');
      if (contentElement) {
        this.performProportionalScroll(contentElement, request);
      }
    }
  }

  /**
   * Crée un Range DOM à partir de positions de caractères
   */
  private createRangeFromCharacterPositions(container: Element, start: number, end: number): Range | null {
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentPos = 0;
    let startNode: Node | null = null;
    let startOffset = 0;
    let endNode: Node | null = null;
    let endOffset = 0;

    let node: Node | null;
    while (node = walker.nextNode()) {
      const textLength = node.textContent?.length || 0;
      
      if (!startNode && currentPos + textLength >= start) {
        startNode = node;
        startOffset = start - currentPos;
      }
      
      if (!endNode && currentPos + textLength >= end) {
        endNode = node;
        endOffset = end - currentPos;
        break;
      }
      
      currentPos += textLength;
    }

    if (startNode && endNode) {
      const range = document.createRange();
      range.setStart(startNode, Math.max(0, startOffset));
      range.setEnd(endNode, Math.min(endNode.textContent?.length || 0, endOffset));
      return range;
    }

    return null;
  }

  /**
   * Crée un élément de surbrillance à partir d'un Range
   */
  private createHighlightElement(range: Range, request: HighlightRequest): Element | null {
    try {
      // Créer un span de surbrillance
      const highlightSpan = document.createElement('span');
      highlightSpan.className = 'viewer-highlight-span';
      highlightSpan.setAttribute('data-span-start', request.spanStart.toString());
      highlightSpan.setAttribute('data-span-end', request.spanEnd.toString());
      if (request.chunkId) {
        highlightSpan.setAttribute('data-chunk-id', request.chunkId);
      }

      // Entourer le contenu du range
      range.surroundContents(highlightSpan);
      return highlightSpan;

    } catch (error) {
      // Si surroundContents échoue (range complexe), utiliser extractContents
      try {
        const contents = range.extractContents();
        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'viewer-highlight-span';
        highlightSpan.setAttribute('data-span-start', request.spanStart.toString());
        highlightSpan.setAttribute('data-span-end', request.spanEnd.toString());
        if (request.chunkId) {
          highlightSpan.setAttribute('data-chunk-id', request.chunkId);
        }
        highlightSpan.appendChild(contents);
        range.insertNode(highlightSpan);
        return highlightSpan;
      } catch (innerError) {
        console.warn('ViewerService: Could not create highlight element:', innerError);
        return null;
      }
    }
  }

  /**
   * Scroll vers un élément et applique l'animation de surbrillance
   */
  private scrollToElementAndHighlight(element: Element, request: HighlightRequest): void {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    });

    // Ajouter les classes de surbrillance
    element.classList.add('viewer-highlight-active', 'viewer-highlight-flash');
    
    // Supprimer l'animation flash après 2 secondes
    setTimeout(() => {
      element.classList.remove('viewer-highlight-flash');
    }, 2000);
  }

  /**
   * Scroll proportionnel basé sur la position du caractère
   */
  private performProportionalScroll(contentElement: Element, request: HighlightRequest): void {
    const textContent = contentElement.textContent || '';
    const totalLength = textContent.length;
    
    if (totalLength > 0) {
      const scrollRatio = request.spanStart / totalLength;
      const scrollTop = Math.max(0, scrollRatio * contentElement.scrollHeight);
      
      contentElement.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
      });
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
