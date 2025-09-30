import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { RagService, ChatMessage } from '../../services/rag.service';
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

  private initializeCanvas(): void {
    if (this.mindmapCanvas) {
      this.canvas = this.mindmapCanvas.nativeElement;
      this.ctx = this.canvas.getContext('2d');
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
      this.drawMindMap();
    }
  }

  private resizeCanvas(): void {
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.width = this.canvas.parentElement.clientWidth;
      this.canvas.height = this.canvas.parentElement.clientHeight;
      this.drawMindMap();
    }
  }

  setActiveTab(tab: 'mindmap' | 'podcast' | 'actions'): void {
    this.activeTab = tab;
    if (tab === 'mindmap' && this.lastChatMessage) {
      this.generateMindMapFromResponse(this.lastChatMessage);
    }
  }

  // Mind Map Logic
  private generateMindMapFromResponse(message: ChatMessage): void {
    if (this.isGenerating) return;
    this.isGenerating = true;
    this.mindMapNodes = [];
    this.mindMapConnections = [];

    // Simuler la génération d'une mind map à partir des sources
    // Dans une vraie application, cela ferait un appel API au backend RAG
    setTimeout(() => {
      if (message.sources && message.sources.length > 0) {
        const nodes: MindMapNode[] = [];
        const connections: MindMapConnection[] = [];
        const uniqueConcepts = new Map<string, MindMapNode>();

        // Ajouter un nœud central pour le sujet principal
        const mainConcept = message.content.split('.')[0]; // Première phrase comme concept principal
        const mainNode: MindMapNode = {
          id: 'main',
          text: mainConcept,
          x: 0,
          y: 0,
          level: 0,
          sourceIds: [],
          connections: []
        };
        nodes.push(mainNode);
        uniqueConcepts.set(mainConcept.toLowerCase(), mainNode);

        message.sources.forEach((source, index) => {
          const conceptText = source.title; // Utiliser le titre de la source comme concept
          let conceptNode = uniqueConcepts.get(conceptText.toLowerCase());

          if (!conceptNode) {
            conceptNode = {
              id: `node-${index}`,
              text: conceptText,
              x: Math.random() * 400 - 200,
              y: Math.random() * 400 - 200,
              level: 1,
              sourceIds: [source.id],
              connections: []
            };
            nodes.push(conceptNode);
            uniqueConcepts.set(conceptText.toLowerCase(), conceptNode);
          } else {
            conceptNode.sourceIds.push(source.id);
          }

          // Ajouter une connexion au nœud principal
          connections.push({
            from: mainNode.id,
            to: conceptNode.id,
            strength: 1
          });
          mainNode.connections.push(conceptNode.id);
          conceptNode.connections.push(mainNode.id);
        });

        this.mindMapNodes = nodes;
        this.mindMapConnections = connections;
        this.layoutMindMap();
      }
      this.isGenerating = false;
    }, 2000);
  }

  private layoutMindMap(): void {
    // Simple force-directed layout simulation
    const k = 100; // Force constant
    const repulsion = 10000; // Repulsion strength
    const attraction = 0.01; // Attraction strength
    const damping = 0.8; // Damping factor
    const maxIterations = 100;

    // Initialize positions if not set
    this.mindMapNodes.forEach(node => {
      if (node.x === undefined || node.y === undefined) {
        node.x = Math.random() * (this.canvas?.width || 800);
        node.y = Math.random() * (this.canvas?.height || 600);
      }
    });

    for (let i = 0; i < maxIterations; i++) {
      const forces = new Map<string, { fx: number; fy: number }>();

      this.mindMapNodes.forEach(node => {
        forces.set(node.id, { fx: 0, fy: 0 });
      });

      // Calculate repulsion forces
      this.mindMapNodes.forEach(node1 => {
        this.mindMapNodes.forEach(node2 => {
          if (node1.id === node2.id) return;

          const dx = node2.x - node1.x;
          const dy = node2.y - node1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.1; // Add a small epsilon to prevent division by zero

          const force = repulsion / (dist * dist);

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          forces.get(node1.id)!.fx -= fx;
          forces.get(node1.id)!.fy -= fy;
          forces.get(node2.id)!.fx += fx;
          forces.get(node2.id)!.fy += fy;
        });
      });

      // Calculate attraction forces
      this.mindMapConnections.forEach(conn => {
        const node1 = this.mindMapNodes.find(n => n.id === conn.from);
        const node2 = this.mindMapNodes.find(n => n.id === conn.to);

        if (node1 && node2) {
          const dx = node2.x - node1.x;
          const dy = node2.y - node1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const force = (dist * dist) / k * attraction * conn.strength;

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          forces.get(node1.id)!.fx += fx;
          forces.get(node1.id)!.fy += fy;
          forces.get(node2.id)!.fx -= fx;
          forces.get(node2.id)!.fy -= fy;
        }
      });

      // Apply forces
      this.mindMapNodes.forEach(node => {
        const force = forces.get(node.id)!;
        node.x += force.fx * damping;
        node.y += force.fy * damping;

        // Keep nodes within bounds
        if (this.canvas) {
          node.x = Math.max(0, Math.min(this.canvas.width, node.x));
          node.y = Math.max(0, Math.min(this.canvas.height, node.y));
        }
      });
    }

    this.drawMindMap();
  }

  private drawMindMap(): void {
    if (!this.canvas || !this.ctx) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    // Draw connections
    this.mindMapConnections.forEach(conn => {
      const fromNode = this.mindMapNodes.find(n => n.id === conn.from);
      const toNode = this.mindMapNodes.find(n => n.id === conn.to);

      if (fromNode && toNode) {
        this.ctx!.beginPath();
        this.ctx!.moveTo(fromNode.x + centerX, fromNode.y + centerY);
        this.ctx!.lineTo(toNode.x + centerX, toNode.y + centerY);
        this.ctx!.strokeStyle = '#ccc';
        this.ctx!.stroke();
      }
    });

    // Draw nodes
    this.mindMapNodes.forEach(node => {
      this.ctx!.beginPath();
      this.ctx!.arc(node.x + centerX, node.y + centerY, 10, 0, Math.PI * 2);
      this.ctx!.fillStyle = '#007bff';
      this.ctx!.fill();
      this.ctx!.strokeStyle = '#0056b3';
      this.ctx!.stroke();

      this.ctx!.font = '12px Arial';
      this.ctx!.fillStyle = '#333';
      this.ctx!.textAlign = 'center';
      this.ctx!.textBaseline = 'middle';
      this.ctx!.fillText(node.text, node.x + centerX, node.y + centerY + 20);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onCanvasClick(event: MouseEvent): void {
    // Handle node clicks if needed
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onCanvasMouseMove(event: MouseEvent): void {
    // Handle node hovers if needed
  }

  exportMindMap(): void {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ nodes: this.mindMapNodes, connections: this.mindMapConnections }, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "mindmap.json");
    document.body.appendChild(downloadAnchorNode); // Required for Firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  // Podcast Logic
  togglePodcastPlayback(): void {
    if (this.podcastScript) {
      if (this.isPlaying) {
        this.audioService.pause();
        this.isPaused = true;
      } else {
        this.audioService.play(this.podcastScript, this.playbackSpeed);
        this.isPaused = false;
      }
    }
  }

  stopPodcast(): void {
    this.audioService.stop();
    this.isPlaying = false;
    this.isPaused = false;
    this.currentTime = 0;
  }

  updatePlaybackSpeed(): void {
    this.audioService.setPlaybackSpeed(this.playbackSpeed);
  }

  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  }

  // Actions Logic
  async generateSummary(): Promise<void> {
    if (!this.lastChatMessage || this.isGenerating) return;
    this.isGenerating = true;
    this.generatedContent = '';
    this.generatedContentType = 'Summary';

    try {
      const response = await this.ragService.askQuestion(`Summarize the following content: ${this.lastChatMessage.content}`, 1).toPromise();
      if (response) {
        this.generatedContent = response.answer;
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // console.error('Error generating summary:', error);
      this.generatedContent = 'Failed to generate summary.';
    } finally {
      this.isGenerating = false;
    }
  }

  async generateActionPlan(): Promise<void> {
    if (!this.lastChatMessage || this.isGenerating) return;
    this.isGenerating = true;
    this.generatedContent = '';
    this.generatedContentType = 'Action Plan';

    try {
      const response = await this.ragService.askQuestion(`Create an action plan based on the following content: ${this.lastChatMessage.content}`, 1).toPromise();
      if (response) {
        this.generatedContent = response.answer;
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // console.error('Error generating action plan:', error);
      this.generatedContent = 'Failed to generate action plan.';
    } finally {
      this.isGenerating = false;
    }
  }

  async generateFlashcards(): Promise<void> {
    if (!this.lastChatMessage || this.isGenerating) return;
    this.isGenerating = true;
    this.generatedContent = '';
    this.generatedContentType = 'Flashcards';

    try {
      const response = await this.ragService.askQuestion(`Generate flashcards (question: answer format) from the key concepts in the following content: ${this.lastChatMessage.content}`, 1).toPromise();
      if (response) {
        this.generatedContent = response.answer;
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // console.error('Error generating flashcards:', error);
      this.generatedContent = 'Failed to generate flashcards.';
    } finally {
      this.isGenerating = false;
    }
  }

  async generatePodcast(): Promise<void> {
    if (!this.lastChatMessage || this.isGenerating) return;
    this.isGenerating = true;
    this.podcastScript = '';
    this.podcastTitle = 'Generated Podcast';

    try {
      const response = await this.ragService.askQuestion(`Generate a podcast script from the following content: ${this.lastChatMessage.content}`, 1).toPromise();
      if (response) {
        this.podcastScript = response.answer;
        // Automatically play the podcast after generation
        this.togglePodcastPlayback();
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // console.error('Error generating podcast:', error);
      this.podcastScript = 'Failed to generate podcast script.';
    } finally {
      this.isGenerating = false;
    }
  }

  copyContent(): void {
    if (this.generatedContent) {
      navigator.clipboard.writeText(this.generatedContent).then(() => {
          // Optionally, show a success message
        // eslint-disable-next-line no-console
        console.log('Content copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy content:', err);
      });
    }
  }

  exportContent(): void {
    if (this.generatedContent) {
      const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(this.generatedContent);
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `${this.generatedContentType.toLowerCase().replace(/ /g, '-')}.md`);
      document.body.appendChild(downloadAnchorNode); // Required for Firefox
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    }
  }
}

