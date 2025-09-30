import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

export interface PublicConfig {
  backendBaseUrl: string;
  maxUploadSizeMb: number;
  features: {
    mindmap: boolean;
    podcast: boolean;
    export: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AppConfigService {
  private configSubject = new BehaviorSubject<PublicConfig | null>(null);
  public config$ = this.configSubject.asObservable();

  private defaultConfig: PublicConfig = {
    backendBaseUrl: 'http://localhost:8080',
    maxUploadSizeMb: 10,
    features: {
      mindmap: true,
      podcast: true,
      export: true
    }
  };

  constructor(private http: HttpClient) {}

  /**
   * Charge la configuration depuis le backend au démarrage de l'application
   */
  async loadConfig(): Promise<PublicConfig> {
    try {
      // Essayer de charger depuis le backend
      const config = await firstValueFrom(
        this.http.get<PublicConfig>('/api/config')
      );
      
      // Valider et normaliser la configuration
      const validatedConfig = this.validateConfig(config);
      this.configSubject.next(validatedConfig);
      
      return validatedConfig;
    } catch {      
      // Fallback vers la configuration par défaut
      this.configSubject.next(this.defaultConfig);
      return this.defaultConfig;
    }
  }

  /**
   * Obtient la configuration actuelle de manière synchrone
   */
  getConfig(): PublicConfig {
    return this.configSubject.value || this.defaultConfig;
  }

  /**
   * Obtient l'URL de base du backend
   */
  getBackendBaseUrl(): string {
    return this.getConfig().backendBaseUrl;
  }

  /**
   * Vérifie si une fonctionnalité est activée
   */
  isFeatureEnabled(feature: keyof PublicConfig['features']): boolean {
    return this.getConfig().features[feature];
  }

  /**
   * Obtient la taille maximale d'upload en MB
   */
  getMaxUploadSizeMb(): number {
    return this.getConfig().maxUploadSizeMb;
  }

  /**
   * Valide et normalise la configuration reçue
   */
  private validateConfig(config: Partial<PublicConfig>): PublicConfig {
    return {
      backendBaseUrl: this.validateUrl(config.backendBaseUrl) || this.defaultConfig.backendBaseUrl,
      maxUploadSizeMb: this.validateNumber(config.maxUploadSizeMb, 1, 1000) || this.defaultConfig.maxUploadSizeMb,
      features: {
        mindmap: Boolean(config.features?.mindmap ?? this.defaultConfig.features.mindmap),
        podcast: Boolean(config.features?.podcast ?? this.defaultConfig.features.podcast),
        export: Boolean(config.features?.export ?? this.defaultConfig.features.export)
      }
    };
  }

  /**
   * Valide une URL
   */
  private validateUrl(url: unknown): string | null {
    if (typeof url !== 'string') return null;
    
    try {
      new URL(url);
      return url.replace(/\/$/, ''); // Supprimer le slash final
    } catch {
      return null;
    }
  }

  /**
   * Valide un nombre dans une plage
   */
  private validateNumber(value: unknown, min: number, max: number): number | null {
    const num = Number(value);
    if (isNaN(num) || num < min || num > max) return null;
    return num;
  }
}
