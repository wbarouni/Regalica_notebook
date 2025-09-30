
import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from '../services/app-config.service';

@Injectable()
export class ApiBaseInterceptor implements HttpInterceptor {
  
  constructor(private appConfig: AppConfigService) {}

  intercept(_request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Ne traiter que les requêtes relatives qui commencent par /api/, /rag/, /sources/, /ingest/
    if (this.shouldPrefixUrl(_request.url)) {
      const baseUrl = this.appConfig.getBackendBaseUrl();
      
      if (baseUrl) {
        // Créer une nouvelle requête avec l\'URL préfixée
        const apiRequest = _request.clone({
          url: `${baseUrl}${_request.url}`
        });
        
        return next.handle(apiRequest);
      }
    }

    // Passer la requête sans modification
    return next.handle(_request);
  }

  /**
   * Détermine si l'URL doit être préfixée avec l'URL de base du backend
   */
  private shouldPrefixUrl(url: string): boolean {
    // Ne pas préfixer les URLs absolues
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return false;
    }

    // Préfixer les URLs API relatives
    return url.startsWith('/api/') || 
           url.startsWith('/rag/') || 
           url.startsWith('/sources/') || 
           url.startsWith('/ingest/');
  }
}
