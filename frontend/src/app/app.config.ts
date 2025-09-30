import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, HTTP_INTERCEPTORS } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { AppConfigService } from './core/services/app-config.service';
import { ApiBaseInterceptor } from './core/interceptors/api-base.interceptor';

/**
 * Factory function pour initialiser la configuration de l'application
 */
export function initializeApp(appConfig: AppConfigService): () => Promise<void> {
  return () => appConfig.loadConfig();
}

export const appConfig: ApplicationConfig = {
  providers: [
    // Router
    provideRouter(routes),
    
    // HTTP Client
    provideHttpClient(),
    
    // Animations
    provideAnimationsAsync(),
    
    // Intercepteurs
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ApiBaseInterceptor,
      multi: true
    },
    
    // Initialisation de l'application
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [AppConfigService],
      multi: true
    }
  ]
};
