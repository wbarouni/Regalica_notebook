import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';

export interface AudioState {
  isPlaying: boolean;
  isPaused: boolean;
  currentText: string;
  progress: number; // 0-1
  duration: number; // estimated in seconds
  currentPosition: number; // current position in seconds
}

export interface SpeechOptions {
  lang?: string;
  rate?: number; // 0.1 - 10
  pitch?: number; // 0 - 2
  volume?: number; // 0 - 1
  voice?: SpeechSynthesisVoice;
}

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private audioStateSubject = new BehaviorSubject<AudioState>({
    isPlaying: false,
    isPaused: false,
    currentText: '',
    progress: 0,
    duration: 0,
    currentPosition: 0
  });

  public audioState$ = this.audioStateSubject.asObservable();

  // Observables séparés pour compatibilité avec Magic Studio
  public isPlaying$ = this.audioState$.pipe(map(state => state.isPlaying));
  public currentTime$ = this.audioState$.pipe(map(state => state.currentPosition));
  public duration$ = this.audioState$.pipe(map(state => state.duration));

  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private availableVoices: SpeechSynthesisVoice[] = [];
  private textSegments: string[] = [];
  private currentSegmentIndex = 0;
  private startTime = 0;
  private estimatedDuration = 0;

  constructor() {
    this.initializeVoices();
  }

  /**
   * Initialise les voix disponibles
   */
  private initializeVoices(): void {
    if ('speechSynthesis' in window) {
      // Charger les voix
      this.loadVoices();
      
      // Écouter les changements de voix (certains navigateurs chargent les voix de manière asynchrone)
      speechSynthesis.onvoiceschanged = () => {
        this.loadVoices();
      };
    }
  }

  /**
   * Charge la liste des voix disponibles
   */
  private loadVoices(): void {
    this.availableVoices = speechSynthesis.getVoices();
  }

  /**
   * Obtient les voix disponibles
   */
  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.availableVoices;
  }

  /**
   * Trouve la meilleure voix pour une langue donnée
   */
  getBestVoiceForLanguage(lang: string): SpeechSynthesisVoice | null {
    const voices = this.availableVoices;
    
    // Chercher une voix exacte pour la langue
    let voice = voices.find(v => v.lang === lang && v.localService);
    if (voice) return voice;

    // Chercher une voix pour la langue principale (ex: 'fr' pour 'fr-FR')
    const mainLang = lang.split('-')[0];
    voice = voices.find(v => v.lang.startsWith(mainLang) && v.localService);
    if (voice) return voice;

    // Fallback vers n'importe quelle voix de la langue
    voice = voices.find(v => v.lang.startsWith(mainLang));
    if (voice) return voice;

    // Fallback vers anglais
    voice = voices.find(v => v.lang.startsWith('en'));
    if (voice) return voice;

    // Dernière option: première voix disponible
    return voices[0] || null;
  }

  /**
   * Démarre la lecture d'un texte
   */
  speak(text: string, options: SpeechOptions = {}): void {
    if (!('speechSynthesis' in window)) {
      console.error('Speech synthesis not supported');
      return;
    }

    // Arrêter toute lecture en cours
    this.stop();

    // Préparer le texte (segmenter pour de longs textes)
    this.textSegments = this.segmentText(text);
    this.currentSegmentIndex = 0;
    this.estimatedDuration = this.estimateTextDuration(text, options.rate || 1);

    // Mettre à jour l'état
    this.updateAudioState({
      currentText: text,
      isPlaying: true,
      isPaused: false,
      progress: 0,
      duration: this.estimatedDuration,
      currentPosition: 0
    });

    this.startTime = Date.now();
    this.speakNextSegment(options);
  }

  /**
   * Lit le segment suivant
   */
  private speakNextSegment(options: SpeechOptions): void {
    if (this.currentSegmentIndex >= this.textSegments.length) {
      this.onSpeechEnd();
      return;
    }

    const segment = this.textSegments[this.currentSegmentIndex];
    this.currentUtterance = new SpeechSynthesisUtterance(segment);

    // Configuration de la voix
    const voice = options.voice || this.getBestVoiceForLanguage(options.lang || 'fr-FR');
    if (voice) {
      this.currentUtterance.voice = voice;
    }

    this.currentUtterance.lang = options.lang || 'fr-FR';
    this.currentUtterance.rate = options.rate || 1;
    this.currentUtterance.pitch = options.pitch || 1;
    this.currentUtterance.volume = options.volume || 1;

    // Événements
    this.currentUtterance.onend = () => {
      this.currentSegmentIndex++;
      this.updateProgress();
      
      // Continuer avec le segment suivant
      setTimeout(() => {
        this.speakNextSegment(options);
      }, 100);
    };

    this.currentUtterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      this.onSpeechEnd();
    };

    this.currentUtterance.onboundary = () => {
      this.updateProgress();
    };

    // Démarrer la lecture
    speechSynthesis.speak(this.currentUtterance);
  }

  /**
   * Met en pause la lecture
   */
  pause(): void {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause();
      this.updateAudioState({ isPaused: true, isPlaying: false });
    }
  }

  /**
   * Reprend la lecture
   */
  resume(): void {
    if (speechSynthesis.paused) {
      speechSynthesis.resume();
      this.updateAudioState({ isPaused: false, isPlaying: true });
    }
  }

  /**
   * Arrête la lecture
   */
  stop(): void {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    
    this.currentUtterance = null;
    this.textSegments = [];
    this.currentSegmentIndex = 0;
    
    this.updateAudioState({
      isPlaying: false,
      isPaused: false,
      progress: 0,
      currentPosition: 0
    });
  }

  /**
   * Passe au paragraphe suivant
   */
  skipToNext(): void {
    if (this.currentSegmentIndex < this.textSegments.length - 1) {
      speechSynthesis.cancel();
      this.currentSegmentIndex++;
      this.updateProgress();
      
      // Continuer avec le segment suivant si on était en train de lire
      if (this.audioStateSubject.value.isPlaying) {
        setTimeout(() => {
          this.speakNextSegment({});
        }, 100);
      }
    }
  }

  /**
   * Revient au paragraphe précédent
   */
  skipToPrevious(): void {
    if (this.currentSegmentIndex > 0) {
      speechSynthesis.cancel();
      this.currentSegmentIndex--;
      this.updateProgress();
      
      // Continuer avec le segment précédent si on était en train de lire
      if (this.audioStateSubject.value.isPlaying) {
        setTimeout(() => {
          this.speakNextSegment({});
        }, 100);
      }
    }
  }

  /**
   * Segmente le texte en chunks plus petits pour éviter les timeouts
   */
  private segmentText(text: string): string[] {
    // Segmenter par phrases ou paragraphes
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const segments: string[] = [];
    let currentSegment = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (currentSegment.length + trimmedSentence.length < 200) {
        currentSegment += (currentSegment ? '. ' : '') + trimmedSentence;
      } else {
        if (currentSegment) {
          segments.push(currentSegment + '.');
        }
        currentSegment = trimmedSentence;
      }
    }

    if (currentSegment) {
      segments.push(currentSegment + '.');
    }

    return segments.length > 0 ? segments : [text];
  }

  /**
   * Estime la durée de lecture d'un texte
   */
  private estimateTextDuration(text: string, rate: number): number {
    // Estimation basée sur ~150 mots par minute à vitesse normale
    const wordsPerMinute = 150 * rate;
    const wordCount = text.split(/\s+/).length;
    return (wordCount / wordsPerMinute) * 60;
  }

  /**
   * Met à jour le progrès de lecture
   */
  private updateProgress(): void {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const progress = this.textSegments.length > 0 
      ? this.currentSegmentIndex / this.textSegments.length 
      : 0;

    this.updateAudioState({
      progress: Math.min(progress, 1),
      currentPosition: elapsed
    });
  }

  /**
   * Appelé à la fin de la lecture
   */
  private onSpeechEnd(): void {
    this.updateAudioState({
      isPlaying: false,
      isPaused: false,
      progress: 1,
      currentPosition: this.estimatedDuration
    });
  }

  /**
   * Met à jour l'état audio
   */
  private updateAudioState(updates: Partial<AudioState>): void {
    const currentState = this.audioStateSubject.value;
    this.audioStateSubject.next({ ...currentState, ...updates });
  }

  /**
   * Vérifie si le TTS est supporté
   */
  isSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  /**
   * Obtient l'état audio actuel
   */
  getAudioState(): AudioState {
    return this.audioStateSubject.value;
  }

  /**
   * Modifie la vitesse de lecture en cours
   */
  setRate(rate: number): void {
    if (this.currentUtterance && speechSynthesis.speaking) {
      // Pour changer la vitesse, il faut redémarrer avec la nouvelle vitesse
      const currentState = this.audioStateSubject.value;
      if (currentState.isPlaying) {
        const remainingText = this.textSegments.slice(this.currentSegmentIndex).join(' ');
        speechSynthesis.cancel();
        
        setTimeout(() => {
          this.speak(remainingText, { rate });
        }, 100);
      }
    }
  }
}
