import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { SidebarSourcesComponent } from './sidebar-sources.component';
import { ChatPanelComponent } from './chat-panel.component';
import { ViewerPanelComponent } from './viewer-panel.component';
import { MagicButtonComponent } from './magic-studio/magic-button.component';
import { AppConfigService } from '../core/services/app-config.service';

export type PanelLayout = 'desktop' | 'tablet' | 'mobile';
export type ActivePanel = 'sources' | 'chat' | 'viewer';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    SidebarSourcesComponent,
    ChatPanelComponent,
    ViewerPanelComponent,
    MagicButtonComponent
  ],
  template: `
    <div class="shell-container" 
         [class]="'layout-' + currentLayout"
         [attr.data-theme]="currentTheme">
      
      <!-- Desktop Layout: 3 panneaux côte à côte -->
      <div class="desktop-layout" *ngIf="currentLayout === 'desktop'">
        <aside class="sources-panel panel-shadow" 
               role="complementary" 
               aria-label="Sources panel">
          <app-sidebar-sources></app-sidebar-sources>
        </aside>
        
        <main class="chat-panel" 
              role="main" 
              aria-label="Chat panel">
          <app-chat-panel></app-chat-panel>
        </main>
        
        <aside class="viewer-panel panel-shadow" 
               role="complementary" 
               aria-label="Document viewer">
          <app-viewer-panel></app-viewer-panel>
        </aside>
      </div>

      <!-- Tablet Layout: 2 panneaux avec tabs pour le viewer -->
      <div class="tablet-layout" *ngIf="currentLayout === 'tablet'">
        <aside class="sources-panel panel-shadow" 
               [class.hidden]="activePanel === 'viewer'"
               role="complementary">
          <app-sidebar-sources></app-sidebar-sources>
        </aside>
        
        <main class="chat-panel" 
              [class.hidden]="activePanel === 'viewer'"
              role="main">
          <app-chat-panel></app-chat-panel>
        </main>
        
        <aside class="viewer-panel panel-shadow full-width" 
               [class.hidden]="activePanel !== 'viewer'"
               role="complementary">
          <app-viewer-panel></app-viewer-panel>
        </aside>

        <!-- Tab Navigation pour tablet -->
        <nav class="tablet-tabs" role="tablist">
          <button class="tab-button" 
                  [class.active]="activePanel !== 'viewer'"
                  (click)="setActivePanel('chat')"
                  role="tab"
                  [attr.aria-selected]="activePanel !== 'viewer'">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
            </svg>
            Chat
          </button>
          
          <button class="tab-button" 
                  [class.active]="activePanel === 'viewer'"
                  (click)="setActivePanel('viewer')"
                  role="tab"
                  [attr.aria-selected]="activePanel === 'viewer'">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            Document
          </button>
        </nav>
      </div>

      <!-- Mobile Layout: Single panel avec navigation -->
      <div class="mobile-layout" *ngIf="currentLayout === 'mobile'">
        <div class="mobile-content">
          <app-sidebar-sources *ngIf="activePanel === 'sources'"></app-sidebar-sources>
          <app-chat-panel *ngIf="activePanel === 'chat'"></app-chat-panel>
          <app-viewer-panel *ngIf="activePanel === 'viewer'"></app-viewer-panel>
        </div>

        <!-- Navigation mobile -->
        <nav class="mobile-nav" role="tablist">
          <button class="nav-button" 
                  [class.active]="activePanel === 'sources'"
                  (click)="setActivePanel('sources')"
                  role="tab"
                  [attr.aria-selected]="activePanel === 'sources'">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
            </svg>
            <span>Sources</span>
          </button>
          
          <button class="nav-button" 
                  [class.active]="activePanel === 'chat'"
                  (click)="setActivePanel('chat')"
                  role="tab"
                  [attr.aria-selected]="activePanel === 'chat'">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
            </svg>
            <span>Chat</span>
          </button>
          
          <button class="nav-button" 
                  [class.active]="activePanel === 'viewer'"
                  (click)="setActivePanel('viewer')"
                  role="tab"
                  [attr.aria-selected]="activePanel === 'viewer'">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <span>Document</span>
          </button>
        </nav>
      </div>

      <!-- Magic Studio Button (toujours visible) -->
      <app-magic-button></app-magic-button>

      <!-- Theme Toggle -->
      <button class="theme-toggle" 
              (click)="toggleTheme()"
              [attr.aria-label]="'Switch to ' + (currentTheme === 'light' ? 'dark' : 'light') + ' theme'">
        <svg *ngIf="currentTheme === 'light'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
        </svg>
        <svg *ngIf="currentTheme === 'dark'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
        </svg>
      </button>
    </div>
  `,
  styleUrls: ['./shell.component.scss']
})
export class ShellComponent implements OnInit, OnDestroy {
  currentLayout: PanelLayout = 'desktop';
  activePanel: ActivePanel = 'chat';
  currentTheme: 'light' | 'dark' = 'light';

  private destroy$ = new Subject<void>();

  constructor(private appConfig: AppConfigService) {}

  ngOnInit(): void {
    this.updateLayout();
    this.loadThemePreference();
    this.setupKeyboardShortcuts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.updateLayout();
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case '1':
          event.preventDefault();
          this.setActivePanel('sources');
          break;
        case '2':
          event.preventDefault();
          this.setActivePanel('chat');
          break;
        case '3':
          event.preventDefault();
          this.setActivePanel('viewer');
          break;
        case 'k':
          event.preventDefault();
          this.focusChatInput();
          break;
      }
    }
  }

  /**
   * Met à jour le layout en fonction de la taille de l'écran
   */
  private updateLayout(): void {
    const width = window.innerWidth;
    
    if (width >= 1280) {
      this.currentLayout = 'desktop';
    } else if (width >= 768) {
      this.currentLayout = 'tablet';
    } else {
      this.currentLayout = 'mobile';
    }
  }

  /**
   * Change le panneau actif
   */
  setActivePanel(panel: ActivePanel): void {
    this.activePanel = panel;
    
    // Focus automatique sur l'input chat quand on passe au chat
    if (panel === 'chat') {
      setTimeout(() => this.focusChatInput(), 100);
    }
  }

  /**
   * Met le focus sur l'input du chat
   */
  private focusChatInput(): void {
    const chatInput = document.querySelector('[data-testid="query-input"]') as HTMLElement;
    if (chatInput) {
      chatInput.focus();
    }
  }

  /**
   * Bascule entre les thèmes clair et sombre
   */
  toggleTheme(): void {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.saveThemePreference();
    this.applyTheme();
  }

  /**
   * Charge la préférence de thème sauvegardée
   */
  private loadThemePreference(): void {
    const saved = localStorage.getItem('regalica-theme');
    if (saved === 'dark' || saved === 'light') {
      this.currentTheme = saved;
    } else {
      // Détecter la préférence système
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.currentTheme = prefersDark ? 'dark' : 'light';
    }
    this.applyTheme();
  }

  /**
   * Sauvegarde la préférence de thème
   */
  private saveThemePreference(): void {
    localStorage.setItem('regalica-theme', this.currentTheme);
  }

  /**
   * Applique le thème au document
   */
  private applyTheme(): void {
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    document.documentElement.classList.toggle('dark', this.currentTheme === 'dark');
  }

  /**
   * Configure les raccourcis clavier
   */
  private setupKeyboardShortcuts(): void {
    // Les raccourcis sont gérés dans onKeyDown
    // Cette méthode peut être étendue pour des raccourcis plus complexes
  }
}
