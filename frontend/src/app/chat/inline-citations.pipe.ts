import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Pipe Angular pour transformer les citations inline [1], [2], etc.
 * en liens cliquables avec styling
 * 
 * Usage:
 * <div [innerHTML]="answer | inlineCitations:sources"></div>
 */
@Pipe({
  name: 'inlineCitations',
  standalone: true
})
export class InlineCitationsPipe implements PipeTransform {
  
  constructor(private sanitizer: DomSanitizer) {}

  transform(text: string, sources?: any[]): SafeHtml {
    if (!text) {
      return '';
    }

    // Remplacer [1], [2], etc. par des liens cliquables
    const transformed = text.replace(/\[(\d+)\]/g, (match, num) => {
      const index = parseInt(num, 10) - 1;
      
      // Vérifier si la source existe
      const source = sources && sources[index];
      const title = source 
        ? `${source.title || 'Document'} - Page ${source.page || '?'}`
        : 'Source non disponible';
      
      const chunkId = source?.chunk_id || '';
      
      return `<a 
        href="javascript:void(0)" 
        class="citation-link" 
        data-citation-id="${num}"
        data-chunk-id="${chunkId}"
        title="${title}"
        onclick="window.citationClick && window.citationClick('${chunkId}', ${num})"
      >[${num}]</a>`;
    });

    return this.sanitizer.bypassSecurityTrustHtml(transformed);
  }
}
