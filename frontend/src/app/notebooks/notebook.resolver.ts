import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { NotebookService, NotebookBootData } from './notebook.service';
import { NotebookContextService } from './notebook-context.service';

@Injectable({
  providedIn: 'root'
})
export class NotebookResolver  {
  constructor(
    private notebookService: NotebookService,
    private notebookContext: NotebookContextService
  ) {}

  resolve(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<NotebookBootData | null> {
    const notebookId = route.paramMap.get('id');

    if (!notebookId) {
      console.warn('[NotebookResolver] No notebook ID provided');
      this.notebookContext.clearActive();
      return of(null);
    }

    return this.notebookService.bootNotebook(notebookId).pipe(
      tap(bootData => {
        if (bootData) {
          // Set notebook as active context
          this.notebookContext.setActive(bootData.notebook);
          console.log('[NotebookResolver] Notebook booted:', notebookId);
          console.log('[NotebookResolver] Documents:', bootData.documents.length);
          console.log('[NotebookResolver] Messages:', bootData.session.length);
        }
      }),
      catchError(error => {
        console.warn('[NotebookResolver] Failed to boot notebook:', error);
        this.notebookContext.clearActive();
        // Ne pas bloquer - afficher workspace même si boot échoue
        return of(null);
      })
    );
  }
}
