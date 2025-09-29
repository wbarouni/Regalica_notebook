import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { RagService, ChatMessage, RagSource } from '../../services/rag.service';
import { AudioService } from '../../core/services/audio.service';

interface MindMapNode {
  id: string;
  text: string;
  x: number;
  y: number;
  level: number;
  sourceIds: string[];
  connections: string[];
}

interface MindMapConnection {
  from: string;
  to: string;
  strength: number;
}

@Component({
  selector: 'app-magic-studio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="magic-studio">
      <!-- Header -->
      <div class="studio-header">
        <div class="header-content">
          <h2 class="studio-title">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364-.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
            Magic Studio
          </h2>
          
          <div class="studio-tabs">
            <button class="tab-btn" 
                    [class.active]="activeTab === 'mindmap'"
                    (click)="setActiveTab('mindmap')">
              Mind Map
            </button>
            <button class="tab-btn" 
                    [class.active]="activeTab === 'podcast'"
                    (click)="setActiveTab('podcast')">
              Podcast
            </button>
            <button class="tab-btn" 
                    [class.active]="activeTab === 'actions'"
                    (click)="setActiveTab('actions')">
              Actions
            </button>
          </div>
        </div>
      </div>

      <!-- Mind Map Tab -->
      <div class="studio-content" *ngIf="activeTab === 'mindmap'">
        <div class="mindmap-container">
          <div class="mindmap-header">
            <div class="mindmap-info">
              <span class="node-count">{{ mindMapNodes.length }} concepts</span>
              <span class="connection-count">{{ mindMapConnections.length }} connections</span>
            </div>
            <div class="mindmap-actions">
              <button class="action-btn" 
                      (click)="regenerateMindMap()"
                      [disabled]="!hasLastResponse || isGenerating">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                Regenerate
              </button>
              <button class="action-btn" 
                      (click)="exportMindMap()"
                      [disabled]="mindMapNodes.length === 0">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                Export
              </button>
            </div>
          </div>
          
          <div class="mindmap-canvas-container">
            <canvas #mindmapCanvas 
                    class="mindmap-canvas"
                    (click)="onCanvasClick($event)"
                    (mousemove)="onCanvasMouseMove($event)">
            </canvas>
            
            <div class="mindmap-empty" *ngIf="mindMapNodes.length === 0 && !isGenerating">
              <div class="empty-icon">
                <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364-.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                </svg>
              </div>
              <h3 class="empty-title">No Mind Map Available</h3>
              <p class="empty-description">Ask a question in the chat to generate a mind map from the response citations.</p>
            </div>
            
            <div class="mindmap-loading" *ngIf="isGenerating">
              <div class="loading-spinner"></div>
              <span>Generating mind map...</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Podcast Tab -->
      <div class="studio-content" *ngIf="activeTab === 'podcast'">
        <div class="podcast-container">
          <div class="podcast-header">
            <div class="podcast-info">
              <h3 class="podcast-title">{{ podcastTitle }}</h3>
              <span class="podcast-duration" *ngIf="podcastDuration > 0">
                {{ formatDuration(podcastDuration) }}
              </span>
            </div>
          </div>
          
          <div class="podcast-content">
            <div class="podcast-text" *ngIf="podcastScript">
              <h4>Podcast Script</h4>
              <div class="script-content">{{ podcastScript }}</div>
            </div>
            
            <div class="podcast-controls">
              <button class="control-btn play-btn" 
                      (click)="togglePodcastPlayback()"
                      [disabled]="!podcastScript">
                <svg *ngIf="!isPlaying" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15M9 10v4a2 2 0 002 2h2a2 2 0 002-2v-4m-6 0a2 2 0 012-2h2a2 2 0 012 2m-6 0V6a2 2 0 012-2h2a2 2 0 012 2v4"></path>
                </svg>
                <svg *ngIf="isPlaying" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                {{ isPlaying ? 'Pause' : 'Play' }}
              </button>
              
              <button class="control-btn" 
                      (click)="stopPodcast()"
                      [disabled]="!isPlaying && !isPaused">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10h6v4H9z"></path>
                </svg>
                Stop
              </button>
              
              <div class="speed-control">
                <label for="speed">Speed:</label>
                <select id="speed" 
                        [(ngModel)]="playbackSpeed" 
                        (change)="updatePlaybackSpeed()">
                  <option value="0.5">0.5x</option>
                  <option value="0.75">0.75x</option>
                  <option value="1">1x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>
              </div>
            </div>
            
            <div class="podcast-progress" *ngIf="podcastDuration > 0">
              <div class="progress-bar">
                <div class="progress-fill" 
                     [style.width.%]="(currentTime / podcastDuration) * 100">
                </div>
              </div>
              <div class="progress-time">
                <span>{{ formatDuration(currentTime) }}</span>
                <span>{{ formatDuration(podcastDuration) }}</span>
              </div>
            </div>
          </div>
          
          <div class="podcast-empty" *ngIf="!podcastScript && !isGenerating">
            <div class="empty-icon">
              <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
              </svg>
            </div>
            <h3 class="empty-title">No Podcast Available</h3>
            <p class="empty-description">Generate a podcast from the last chat response using the Actions tab.</p>
          </div>
        </div>
      </div>

      <!-- Actions Tab -->
      <div class="studio-content" *ngIf="activeTab === 'actions'">
        <div class="actions-container">
          <div class="actions-grid">
            <div class="action-card">
              <div class="action-header">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <h3>Summary</h3>
              </div>
              <p class="action-description">Generate a concise summary of the last response</p>
              <button class="action-execute-btn" 
                      (click)="generateSummary()"
                      [disabled]="!hasLastResponse || isGenerating">
                Generate Summary
              </button>
            </div>
            
            <div class="action-card">
              <div class="action-header">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
                </svg>
                <h3>Action Plan</h3>
              </div>
              <p class="action-description">Create a structured action plan with steps</p>
              <button class="action-execute-btn" 
                      (click)="generateActionPlan()"
                      [disabled]="!hasLastResponse || isGenerating">
                Generate Plan
              </button>
            </div>
            
            <div class="action-card">
              <div class="action-header">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                </svg>
                <h3>Flashcards</h3>
              </div>
              <p class="action-description">Generate study flashcards from key concepts</p>
              <button class="action-execute-btn" 
                      (click)="generateFlashcards()"
                      [disabled]="!hasLastResponse || isGenerating">
                Generate Flashcards
              </button>
            </div>
            
            <div class="action-card">
              <div class="action-header">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                </svg>
                <h3>Podcast</h3>
              </div>
              <p class="action-description">Convert response to podcast script with TTS</p>
              <button class="action-execute-btn" 
                      (click)="generatePodcast()"
                      [disabled]="!hasLastResponse || isGenerating">
                Generate Podcast
              </button>
            </div>
          </div>
          
          <div class="generated-content" *ngIf="generatedContent">
            <div class="content-header">
              <h3>{{ generatedContentType }}</h3>
              <div class="content-actions">
                <button class="content-btn" (click)="copyContent()">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                  </svg>
                  Copy
                </button>
                <button class="content-btn" (click)="exportContent()">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  Export .md
                </button>
              </div>
            </div>
            <div class="content-body">
              <pre>{{ generatedContent }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./magic-studio.component.scss']
})
export class MagicStudioComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('mindmapCanvas') mindmapCanvas!: ElementRef<HTMLCanvasElement>;

  activeTab: 'mindmap' | 'podcast' | 'actions' = 'mindmap';
  
  // Mind Map
  mindMapNodes: MindMapNode[] = [];
  mindMapConnections: MindMapConnection[] = [];
  
  // Podcast
  podcastTitle: string = '';
  podcastScript: string = '';
  podcastDuration: number = 0;
  currentTime: number = 0;
  isPlaying: boolean = false;
  isPaused: boolean = false;
  playbackSpeed: number = 1;
  
  // Actions
  generatedContent: string = '';
  generatedContentType: string = '';
  
  // State
  isGenerating: boolean = false;
  hasLastResponse: boolean = false;
  lastChatMessage: ChatMessage | null = null;
  
  private destroy$ = new Subject<void>();
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrame: number | null = null;

  constructor(
    private ragService: RagService,
    private audioService: AudioService
  ) {}

  ngOnInit(): void {
    this.setupSubscriptions();
  }

  ngAfterViewInit(): void {
    this.initializeCanvas();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    this.stopPodcast();
  }

  private setupSubscriptions(): void {
    // Écouter les nouveaux messages du chat
    this.ragService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(messages => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.sources && lastMessage.sources.length > 0) {
          this.lastChatMessage = lastMessage;
          this.hasLastResponse = true;
          
          // Auto-générer la mind map si on est sur l'onglet mindmap
          if (this.activeTab === 'mindmap') {
            this.generateMindMapFromResponse(lastMessage);
          }
        }
      });

    // Écouter les événements audio
    this.audioService.isPlaying$
      .pipe(takeUntil(this.destroy$))
      .subscribe(playing => {
        this.isPlaying = playing;
      });

    this.audioService.currentTime$
      .pipe(takeUntil(this.destroy$))
      .subscribe(time => {
        this.currentTime = time;
      });

    this.audioService.duration$
      .pipe(takeUntil(this.destroy$))
      .subscribe(duration => {
        this.podcastDuration = duration;
      });
  }

  setActiveTab(tab: 'mindmap' | 'podcast' | 'actions'): void {
    this.activeTab = tab;
    
    if (tab === 'mindmap' && this.hasLastResponse && this.mindMapNodes.length === 0) {
      this.generateMindMapFromResponse(this.lastChatMessage!);
    }
  }

  // Mind Map Methods
  private initializeCanvas(): void {
    if (this.mindmapCanvas) {
      this.canvas = this.mindmapCanvas.nativeElement;
      this.ctx = this.canvas.getContext('2d');
      this.resizeCanvas();
      this.startRenderLoop();
    }
  }

  private resizeCanvas(): void {
    if (this.canvas) {
      const container = this.canvas.parentElement!;
      this.canvas.width = container.clientWidth;
      this.canvas.height = container.clientHeight;
    }
  }

  private startRenderLoop(): void {
    const render = () => {
      this.renderMindMap();
      this.animationFrame = requestAnimationFrame(render);
    };
    render();
  }

  private renderMindMap(): void {
    if (!this.ctx || !this.canvas) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw connections
    this.ctx.strokeStyle = '#e5e7eb';
    this.ctx.lineWidth = 2;
    
    this.mindMapConnections.forEach(connection => {
      const fromNode = this.mindMapNodes.find(n => n.id === connection.from);
      const toNode = this.mindMapNodes.find(n => n.id === connection.to);
      
      if (fromNode && toNode) {
        this.ctx!.beginPath();
        this.ctx!.moveTo(fromNode.x, fromNode.y);
        this.ctx!.lineTo(toNode.x, toNode.y);
        this.ctx!.stroke();
      }
    });

    // Draw nodes
    this.mindMapNodes.forEach(node => {
      this.drawNode(node);
    });
  }

  private drawNode(node: MindMapNode): void {
    if (!this.ctx) return;

    const radius = Math.max(30, node.text.length * 3);
    const color = this.getNodeColor(node.level);

    // Draw circle
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    this.ctx.fill();

    // Draw border
    this.ctx.strokeStyle = '#111827';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Draw text
    this.ctx.fillStyle = '#111827';
    this.ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    const maxWidth = radius * 1.5;
    const words = node.text.split(' ');
    const lines = this.wrapText(words, maxWidth);
    
    lines.forEach((line, index) => {
      const y = node.y + (index - (lines.length - 1) / 2) * 14;
      this.ctx!.fillText(line, node.x, y);
    });
  }

  private wrapText(words: string[], maxWidth: number): string[] {
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = this.ctx!.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  private getNodeColor(level: number): string {
    const colors = ['#f3f4f6', '#e5e7eb', '#d1d5db', '#9ca3af'];
    return colors[Math.min(level, colors.length - 1)];
  }

  regenerateMindMap(): void {
    if (this.lastChatMessage) {
      this.generateMindMapFromResponse(this.lastChatMessage);
    }
  }

  private generateMindMapFromResponse(message: ChatMessage): void {
    if (!message.sources || message.sources.length === 0) return;

    this.isGenerating = true;
    this.mindMapNodes = [];
    this.mindMapConnections = [];

    // Extraire les concepts des sources citées
    const concepts = this.extractConceptsFromSources(message.sources);
    
    // Créer les nœuds
    this.createMindMapNodes(concepts);
    
    // Créer les connexions
    this.createMindMapConnections();
    
    this.isGenerating = false;
  }

  private extractConceptsFromSources(sources: RagSource[]): string[] {
    const concepts: string[] = [];
    
    sources.forEach(source => {
      // Extraire les mots-clés du texte de la source
      const text = source.text || '';
      const words = text.split(/\s+/)
        .filter(word => word.length > 3)
        .filter(word => !/^(the|and|or|but|in|on|at|to|for|of|with|by)$/i.test(word))
        .slice(0, 3); // Limiter à 3 concepts par source
      
      concepts.push(...words);
    });

    // Déduplication et limitation
    return [...new Set(concepts)].slice(0, 10);
  }

  private createMindMapNodes(concepts: string[]): void {
    if (!this.canvas) return;

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const radius = Math.min(this.canvas.width, this.canvas.height) / 3;

    concepts.forEach((concept, index) => {
      const angle = (index / concepts.length) * 2 * Math.PI;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      this.mindMapNodes.push({
        id: `node-${index}`,
        text: concept,
        x,
        y,
        level: index === 0 ? 0 : 1,
        sourceIds: [],
        connections: []
      });
    });
  }

  private createMindMapConnections(): void {
    // Connecter les nœuds proches
    for (let i = 0; i < this.mindMapNodes.length; i++) {
      for (let j = i + 1; j < this.mindMapNodes.length; j++) {
        const node1 = this.mindMapNodes[i];
        const node2 = this.mindMapNodes[j];
        
        const distance = Math.sqrt(
          Math.pow(node1.x - node2.x, 2) + Math.pow(node1.y - node2.y, 2)
        );

        if (distance < 200) {
          this.mindMapConnections.push({
            from: node1.id,
            to: node2.id,
            strength: 1 - (distance / 200)
          });
        }
      }
    }
  }

  onCanvasClick(event: MouseEvent): void {
    // Gérer les clics sur les nœuds
    const rect = this.canvas!.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const clickedNode = this.mindMapNodes.find(node => {
      const distance = Math.sqrt(Math.pow(node.x - x, 2) + Math.pow(node.y - y, 2));
      return distance < 30;
    });

    if (clickedNode) {
      console.log('Node clicked:', clickedNode.text);
      // Ici on pourrait ajouter une action, comme rechercher ce concept
    }
  }

  onCanvasMouseMove(event: MouseEvent): void {
    // Gérer le hover des nœuds
    if (this.canvas) {
      this.canvas.style.cursor = 'default';
      
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const hoveredNode = this.mindMapNodes.find(node => {
        const distance = Math.sqrt(Math.pow(node.x - x, 2) + Math.pow(node.y - y, 2));
        return distance < 30;
      });

      if (hoveredNode) {
        this.canvas.style.cursor = 'pointer';
      }
    }
  }

  exportMindMap(): void {
    const mindMapData = {
      nodes: this.mindMapNodes,
      connections: this.mindMapConnections,
      generatedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(mindMapData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindmap-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Podcast Methods
  togglePodcastPlayback(): void {
    if (this.isPlaying) {
      this.audioService.pause();
      this.isPaused = true;
    } else {
      if (this.isPaused) {
        this.audioService.resume();
        this.isPaused = false;
      } else {
        this.audioService.speak(this.podcastScript, {
          rate: this.playbackSpeed,
          pitch: 1,
          volume: 1
        });
      }
    }
  }

  stopPodcast(): void {
    this.audioService.stop();
    this.isPaused = false;
    this.currentTime = 0;
  }

  updatePlaybackSpeed(): void {
    this.audioService.setRate(this.playbackSpeed);
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Actions Methods
  async generateSummary(): Promise<void> {
    if (!this.lastChatMessage) return;

    this.isGenerating = true;
    this.generatedContentType = 'Summary';

    try {
      const prompt = `Create a concise summary of the following response:\n\n${this.lastChatMessage.content}`;
      const response = await this.ragService.askQuestion(prompt).toPromise();
      
      if (response) {
        this.generatedContent = response.answer;
        this.activeTab = 'actions';
      }
    } catch (error) {
      console.error('Error generating summary:', error);
    } finally {
      this.isGenerating = false;
    }
  }

  async generateActionPlan(): Promise<void> {
    if (!this.lastChatMessage) return;

    this.isGenerating = true;
    this.generatedContentType = 'Action Plan';

    try {
      const prompt = `Create a structured action plan with numbered steps based on this response:\n\n${this.lastChatMessage.content}`;
      const response = await this.ragService.askQuestion(prompt).toPromise();
      
      if (response) {
        this.generatedContent = response.answer;
        this.activeTab = 'actions';
      }
    } catch (error) {
      console.error('Error generating action plan:', error);
    } finally {
      this.isGenerating = false;
    }
  }

  async generateFlashcards(): Promise<void> {
    if (!this.lastChatMessage) return;

    this.isGenerating = true;
    this.generatedContentType = 'Flashcards';

    try {
      const prompt = `Create study flashcards in Q&A format from this content:\n\n${this.lastChatMessage.content}`;
      const response = await this.ragService.askQuestion(prompt).toPromise();
      
      if (response) {
        this.generatedContent = response.answer;
        this.activeTab = 'actions';
      }
    } catch (error) {
      console.error('Error generating flashcards:', error);
    } finally {
      this.isGenerating = false;
    }
  }

  async generatePodcast(): Promise<void> {
    if (!this.lastChatMessage) return;

    this.isGenerating = true;

    try {
      const prompt = `Convert this response into a natural podcast script with conversational tone:\n\n${this.lastChatMessage.content}`;
      const response = await this.ragService.askQuestion(prompt).toPromise();
      
      if (response) {
        this.podcastScript = response.answer;
        this.podcastTitle = `Podcast: ${new Date().toLocaleDateString()}`;
        this.activeTab = 'podcast';
      }
    } catch (error) {
      console.error('Error generating podcast:', error);
    } finally {
      this.isGenerating = false;
    }
  }

  async copyContent(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.generatedContent);
    } catch (error) {
      console.error('Error copying content:', error);
    }
  }

  exportContent(): void {
    const blob = new Blob([this.generatedContent], {
      type: 'text/markdown'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.generatedContentType.toLowerCase().replace(' ', '-')}-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
