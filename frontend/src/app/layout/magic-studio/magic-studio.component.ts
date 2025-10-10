import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { RagService, ChatMessage } from '../../services/rag.service';
import { AudioService } from '../../core/services/audio.service';
import { StudioService, MindMapNode as BackendMindMapNode } from '../../services/studio.service';
import { SocketService } from '../../services/socket.service';
import { NotebookContextService } from '../../notebooks/notebook-context.service';
import { MindMapNodeModalComponent } from './mindmap-node-modal.component';

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
  imports: [CommonModule, FormsModule, MindMapNodeModalComponent],
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
          
          <!-- Tabs removed - always on Actions page -->
        </div>
      </div>

      <!-- Mind Map Tab -->
      <div class="studio-content" *ngIf="activeTab === 'mindmap'">
        <div class="page-header">
          <button class="back-btn" (click)="setActiveTab('actions')">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Back to Actions
          </button>
          <h3 class="page-title">Mind Map</h3>
          <button class="btn-refresh" (click)="regenerateMindMap()" [disabled]="isGenerating">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            {{ isGenerating ? 'Loading...' : 'Refresh' }}
          </button>
        </div>
        <div class="mindmap-container">
          <canvas #mindmapCanvas 
                  (click)="onCanvasClick($event)"
                  (mousemove)="onCanvasMouseMove($event)">
          </canvas>
          <div class="mindmap-empty" *ngIf="mindMapNodes.length === 0 && !isGenerating">
            <h3>No Mind Map Available</h3>
            <p>Chat with your documents to generate a Mind Map</p>
          </div>
          <div class="mindmap-loading" *ngIf="isGenerating">
            <div class="spinner"></div>
            <p>Generating Mind Map...</p>
          </div>
        </div>
      </div>

      <!-- Podcast Tab -->
      <div class="studio-content" *ngIf="activeTab === 'podcast'">
        <div class="page-header">
          <button class="back-btn" (click)="setActiveTab('actions')">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Back to Actions
          </button>
          <h3 class="page-title">Podcast</h3>
        </div>
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
                      (click)="navigateToPodcast()">
                Open Podcast
              </button>
            </div>
            
            <div class="action-card">
              <div class="action-header">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                </svg>
                <h3>Mind Map</h3>
              </div>
              <p class="action-description">Visualize concepts and connections</p>
              <button class="action-execute-btn" 
                      (click)="navigateToMindMap()">
                Open Mind Map
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
      
      <!-- Node Context Modal -->
      <app-mindmap-node-modal
        *ngIf="showNodeModal && selectedNode"
        [node]="selectedNode"
        [notebookId]="notebookContext.getActiveId() || undefined"
        (closed)="closeNodeModal()"
        (nodeNavigate)="onNodeNavigate($event)">
      </app-mindmap-node-modal>
    </div>
  `,
  styleUrls: ['./magic-studio.component.scss']
})
export class MagicStudioComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('mindmapCanvas') mindmapCanvas!: ElementRef<HTMLCanvasElement>;

  activeTab: 'mindmap' | 'podcast' | 'actions' = 'actions';
  
  // Mind Map
  mindMapNodes: MindMapNode[] = [];
  mindMapConnections: MindMapConnection[] = [];
  selectedNode: MindMapNode | null = null;
  showNodeModal: boolean = false;
  
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
    private audioService: AudioService,
    private studioService: StudioService,
    private socketService: SocketService,
    public notebookContext: NotebookContextService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Handle query params for navigation (from chat)
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params['tab']) {
          this.setActiveTab(params['tab'] as 'mindmap' | 'podcast' | 'actions');
        }
      });
    
    this.setupSubscriptions();
    this.initializeSocket();
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
    this.socketService.disconnect();
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

  private initializeSocket(): void {
    // Connect to Socket.IO server
    this.socketService.connect();
    
    // Listen for node updates
    this.socketService.nodeUpdated
      .pipe(takeUntil(this.destroy$))
      .subscribe((update) => {
        console.log('Node updated via socket:', update);
        // Update specific node if on mindmap tab
        if (this.activeTab === 'mindmap') {
          this.updateNodeFromSocket(update);
        }
      });
    
    // Listen for node additions
    this.socketService.nodeAdded
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        console.log('Node added via socket:', data);
        if (this.activeTab === 'mindmap') {
          this.addNodeFromSocket(data);
        }
      });
    
    // Listen for node deletions
    this.socketService.nodeDeleted
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        console.log('Node deleted via socket:', data);
        if (this.activeTab === 'mindmap') {
          this.deleteNodeFromSocket(data.nodeId);
        }
      });
    
    // Listen for node movements
    this.socketService.nodeMoved
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        console.log('Node moved via socket:', data);
        if (this.activeTab === 'mindmap') {
          this.moveNodeFromSocket(data.nodeId, data.position);
        }
      });
    
    // Listen for connection status
    this.socketService.isConnected$
      .pipe(takeUntil(this.destroy$))
      .subscribe((connected) => {
        console.log('Socket connection status:', connected);
      });
  }

  private updateNodeFromSocket(update: any): void {
    const node = this.mindMapNodes.find(n => n.id === update.nodeId);
    if (node && update.updates) {
      if (update.updates.label) {
        node.text = update.updates.label;
      }
      if (update.updates.position) {
        node.x = update.updates.position.x;
        node.y = update.updates.position.y;
      }
      this.drawMindMap();
    }
  }

  private addNodeFromSocket(data: any): void {
    if (data.node) {
      const newNode: MindMapNode = {
        id: data.node.id,
        text: data.node.label || data.node.text,
        x: data.node.position?.x || Math.random() * 400 - 200,
        y: data.node.position?.y || Math.random() * 400 - 200,
        level: data.node.level || 1,
        sourceIds: data.node.sourceIds || [],
        connections: data.node.connections || []
      };
      this.mindMapNodes.push(newNode);
      this.drawMindMap();
    }
  }

  private deleteNodeFromSocket(nodeId: string): void {
    this.mindMapNodes = this.mindMapNodes.filter(n => n.id !== nodeId);
    this.mindMapConnections = this.mindMapConnections.filter(
      c => c.from !== nodeId && c.to !== nodeId
    );
    this.drawMindMap();
  }

  private moveNodeFromSocket(nodeId: string, position: { x: number; y: number }): void {
    const node = this.mindMapNodes.find(n => n.id === nodeId);
    if (node) {
      node.x = position.x;
      node.y = position.y;
      this.drawMindMap();
    }
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
  private async generateMindMapFromResponse(message: ChatMessage): Promise<void> {
    if (this.isGenerating) return;
    this.isGenerating = true;
    this.mindMapNodes = [];
    this.mindMapConnections = [];

    try {
      // Get active notebook context (DYNAMIC - NO HARDCODING)
      const activeNotebookId = this.notebookContext.getActiveId();
      
      // Extract query from the message content (first sentence or full content)
      const query = message.content.split('.')[0] || message.content.substring(0, 100);
      
      // Call the real backend clustering API with notebook context
      const response = await this.studioService.generateMindMap({
        query,
        notebookId: activeNotebookId || undefined,  // DYNAMIC: Pass if notebook is active
        topK: activeNotebookId ? 100 : 20,  // More chunks if notebook context
        lang: 'en'
      }).toPromise();
      
      if (response && response.nodes && response.nodes.length > 0) {
        // Transform backend response to our node format
        const nodes: MindMapNode[] = [];
        const connections: MindMapConnection[] = [];
        
        // Add central node
        const centralNode: MindMapNode = {
          id: 'central',
          text: query,
          x: 0,
          y: 0,
          level: 0,
          sourceIds: [],
          connections: []
        };
        nodes.push(centralNode);
        
        // Process clusters from backend
        response.nodes.forEach((cluster: BackendMindMapNode, index: number) => {
          const clusterNode: MindMapNode = {
            id: cluster.id || `cluster-${index}`,
            text: cluster.label || cluster.summary || `Cluster ${index + 1}`,
            x: Math.random() * 400 - 200,
            y: Math.random() * 400 - 200,
            level: 1,
            sourceIds: cluster.citations ? cluster.citations.map(c => c.docId) : [],
            connections: ['central']
          };
          nodes.push(clusterNode);
          
          // Add connection to central node
          connections.push({
            from: 'central',
            to: clusterNode.id,
            strength: cluster.citations ? cluster.citations.length / 10 : 0.5
          });
          centralNode.connections.push(clusterNode.id);
        });
        
        this.mindMapNodes = nodes;
        this.mindMapConnections = connections;
        this.layoutMindMap();
      } else {
        // Fallback: use sources from message if clustering returns no results
        this.generateFallbackMindMap(message);
      }
    } catch (error) {
      console.error('Error generating mind map:', error);
      // Fallback to sources-based mind map on error
      this.generateFallbackMindMap(message);
    } finally {
      this.isGenerating = false;
    }
  }
  
  private generateFallbackMindMap(message: ChatMessage): void {
    if (message.sources && message.sources.length > 0) {
      const nodes: MindMapNode[] = [];
      const connections: MindMapConnection[] = [];
      const uniqueConcepts = new Map<string, MindMapNode>();

      // Add central node for main topic
      const mainConcept = message.content.split('.')[0];
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
        const conceptText = source.title;
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

        // Add connection to main node
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
  }
  
  regenerateMindMap(): void {
    if (this.lastChatMessage) {
      this.generateMindMapFromResponse(this.lastChatMessage);
    }
  }

  private layoutMindMap(): void {
    // TASK 3: Enhanced force-directed layout with hierarchical levels
    const maxIterations = 300; // More iterations for stable layout
    const damping = 0.85;
    
    // Level-based parameters
    const levelRadii = {
      0: 0,      // Central (at center)
      1: 150,    // Level 1 - close to center
      2: 280,    // Level 2 - mid distance
      3: 380,    // Level 3 - far distance
      4: 450     // Level 4 - very far
    };
    
    const levelRepulsion = {
      0: 15000,  // Central - strong repulsion
      1: 12000,  // Level 1
      2: 10000,  // Level 2
      3: 8000,   // Level 3
      4: 6000    // Level 4
    };
    
    const levelCollisionRadius = {
      0: 100,    // Central - large (200×80px)
      1: 100,    // Level 1 - large
      2: 80,     // Level 2 - medium (160×60px)
      3: 70,     // Level 3 - small (140×50px)
      4: 60      // Level 4 - very small (120×45px)
    };

    // Initialize positions with radial placement
    this.mindMapNodes.forEach(node => {
      const level = node.level || 1;
      const radius = levelRadii[level as keyof typeof levelRadii] || levelRadii[1];
      
      if (level === 0) {
        // Central node at center
        node.x = 0;
        node.y = 0;
      } else if (node.x === undefined || node.y === undefined) {
        // Random angle for initial placement
        const angle = Math.random() * 2 * Math.PI;
        node.x = Math.cos(angle) * radius;
        node.y = Math.sin(angle) * radius;
      }
    });

    // Force simulation
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const forces = new Map<string, { fx: number; fy: number }>();

      this.mindMapNodes.forEach(node => {
        forces.set(node.id, { fx: 0, fy: 0 });
      });

      // 1. Repulsion forces (prevent overlap)
      this.mindMapNodes.forEach(node1 => {
        this.mindMapNodes.forEach(node2 => {
          if (node1.id === node2.id) return;

          const dx = node2.x - node1.x;
          const dy = node2.y - node1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;

          const level1 = node1.level || 1;
          const level2 = node2.level || 1;
          const repulsion = Math.min(
            levelRepulsion[level1 as keyof typeof levelRepulsion] || levelRepulsion[1],
            levelRepulsion[level2 as keyof typeof levelRepulsion] || levelRepulsion[1]
          );

          const force = repulsion / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          forces.get(node1.id)!.fx -= fx;
          forces.get(node1.id)!.fy -= fy;
          forces.get(node2.id)!.fx += fx;
          forces.get(node2.id)!.fy += fy;
        });
      });

      // 2. Attraction forces (connected nodes pull together)
      this.mindMapConnections.forEach(conn => {
        const node1 = this.mindMapNodes.find(n => n.id === conn.from);
        const node2 = this.mindMapNodes.find(n => n.id === conn.to);

        if (node1 && node2) {
          const dx = node2.x - node1.x;
          const dy = node2.y - node1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;

          const targetDist = 120;
          const force = (dist - targetDist) * 0.1 * conn.strength;

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          forces.get(node1.id)!.fx += fx;
          forces.get(node1.id)!.fy += fy;
          forces.get(node2.id)!.fx -= fx;
          forces.get(node2.id)!.fy -= fy;
        }
      });

      // 3. Radial force (keep nodes at their level radius)
      this.mindMapNodes.forEach(node => {
        if (node.level === 0) return; // Skip central node

        const level = node.level || 1;
        const targetRadius = levelRadii[level as keyof typeof levelRadii] || levelRadii[1];
        
        const currentRadius = Math.sqrt(node.x * node.x + node.y * node.y);
        const radiusDiff = currentRadius - targetRadius;
        
        if (currentRadius > 0.1) {
          const force = -radiusDiff * 0.05;
          forces.get(node.id)!.fx += (node.x / currentRadius) * force;
          forces.get(node.id)!.fy += (node.y / currentRadius) * force;
        }
      });

      // 4. Collision detection (prevent overlap)
      this.mindMapNodes.forEach(node1 => {
        this.mindMapNodes.forEach(node2 => {
          if (node1.id === node2.id) return;

          const dx = node2.x - node1.x;
          const dy = node2.y - node1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;

          const level1 = node1.level || 1;
          const level2 = node2.level || 1;
          const minDist = (
            levelCollisionRadius[level1 as keyof typeof levelCollisionRadius] +
            levelCollisionRadius[level2 as keyof typeof levelCollisionRadius]
          ) / 2;

          if (dist < minDist) {
            const overlap = minDist - dist;
            const force = overlap * 0.5;
            
            forces.get(node1.id)!.fx -= (dx / dist) * force;
            forces.get(node1.id)!.fy -= (dy / dist) * force;
            forces.get(node2.id)!.fx += (dx / dist) * force;
            forces.get(node2.id)!.fy += (dy / dist) * force;
          }
        });
      });

      // Apply forces with damping
      this.mindMapNodes.forEach(node => {
        if (node.level === 0) return; // Keep central node fixed

        const force = forces.get(node.id)!;
        node.x += force.fx * damping;
        node.y += force.fy * damping;
      });
    }

    this.drawMindMap();
  }

  private drawMindMap(): void {
    if (!this.canvas || !this.ctx) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    // TASK 4: NotebookLM Design Tokens (from SCSS)
    const levelColors = {
      0: { bg: '#6B46C1', text: '#FFFFFF', border: '#553C9A', shadow: 'rgba(107, 70, 193, 0.2)' },  // Violet
      1: { bg: '#6B46C1', text: '#FFFFFF', border: '#553C9A', shadow: 'rgba(107, 70, 193, 0.2)' },  // Violet
      2: { bg: '#3B82F6', text: '#FFFFFF', border: '#2563EB', shadow: 'rgba(59, 130, 246, 0.2)' },  // Bleu
      3: { bg: '#10B981', text: '#FFFFFF', border: '#059669', shadow: 'rgba(16, 185, 129, 0.2)' },  // Vert
      4: { bg: '#8B5CF6', text: '#FFFFFF', border: '#7C3AED', shadow: 'rgba(139, 92, 246, 0.2)' }   // Lavande
    };

    const levelSizes = {
      0: { width: 200, height: 80, fontSize: 18, fontWeight: '600' },  // Central
      1: { width: 200, height: 80, fontSize: 18, fontWeight: '600' },  // Level 1
      2: { width: 160, height: 60, fontSize: 14, fontWeight: '500' },  // Level 2
      3: { width: 140, height: 50, fontSize: 12, fontWeight: '400' },  // Level 3
      4: { width: 120, height: 45, fontSize: 11, fontWeight: '400' }   // Level 4
    };

    // Draw connections (edges)
    this.mindMapConnections.forEach(conn => {
      const fromNode = this.mindMapNodes.find(n => n.id === conn.from);
      const toNode = this.mindMapNodes.find(n => n.id === conn.to);

      if (fromNode && toNode) {
        this.ctx!.beginPath();
        this.ctx!.moveTo(fromNode.x + centerX, fromNode.y + centerY);
        this.ctx!.lineTo(toNode.x + centerX, toNode.y + centerY);
        this.ctx!.strokeStyle = '#E5E7EB'; // Edge default color
        this.ctx!.lineWidth = 2;
        this.ctx!.stroke();
      }
    });

    // Draw nodes with NotebookLM style
    this.mindMapNodes.forEach(node => {
      const level = node.level || 1;
      const colors = levelColors[level as keyof typeof levelColors] || levelColors[1];
      const sizes = levelSizes[level as keyof typeof levelSizes] || levelSizes[1];

      const x = node.x + centerX;
      const y = node.y + centerY;
      const w = sizes.width;
      const h = sizes.height;
      const radius = 8;

      // Draw shadow
      this.ctx!.shadowColor = colors.shadow;
      this.ctx!.shadowBlur = 10;
      this.ctx!.shadowOffsetX = 0;
      this.ctx!.shadowOffsetY = 4;

      // Draw rounded rectangle (node background)
      this.roundRect(x - w/2, y - h/2, w, h, radius, colors.bg, colors.border);

      // Reset shadow
      this.ctx!.shadowColor = 'transparent';
      this.ctx!.shadowBlur = 0;
      this.ctx!.shadowOffsetX = 0;
      this.ctx!.shadowOffsetY = 0;

      // Draw text with truncation
      this.ctx!.fillStyle = colors.text;
      this.ctx!.font = `${sizes.fontWeight} ${sizes.fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
      this.ctx!.textAlign = 'center';
      this.ctx!.textBaseline = 'middle';

      // Truncate text if too long
      let displayText = node.text;
      const maxWidth = w - 20; // Padding
      const metrics = this.ctx!.measureText(displayText);
      
      if (metrics.width > maxWidth) {
        // Binary search for optimal length
        let start = 0;
        let end = displayText.length;
        let optimal = displayText;
        
        while (start <= end) {
          const mid = Math.floor((start + end) / 2);
          const testText = displayText.substring(0, mid) + '...';
          const testMetrics = this.ctx!.measureText(testText);
          
          if (testMetrics.width <= maxWidth) {
            optimal = testText;
            start = mid + 1;
          } else {
            end = mid - 1;
          }
        }
        
        displayText = optimal;
      }

      // Draw text (centered in node)
      this.ctx!.fillText(displayText, x, y);
    });
  }

  /**
   * Helper: Draw rounded rectangle
   * @param x X position
   * @param y Y position
   * @param w Width
   * @param h Height
   * @param r Border radius
   * @param fillColor Fill color
   * @param strokeColor Stroke color
   */
  private roundRect(
    x: number, 
    y: number, 
    w: number, 
    h: number, 
    r: number, 
    fillColor: string, 
    strokeColor: string
  ): void {
    if (!this.ctx) return;

    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();

    // Fill
    this.ctx.fillStyle = fillColor;
    this.ctx.fill();

    // Stroke
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  onCanvasClick(event: MouseEvent): void {
    if (!this.canvas) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    // Check if clicked on any node
    for (const node of this.mindMapNodes) {
      const nodeX = node.x + centerX;
      const nodeY = node.y + centerY;
      
      // Get size based on level
      const level = node.level || 1;
      const sizes: Record<number, {width: number, height: number}> = {
        0: { width: 200, height: 80 },
        1: { width: 200, height: 80 },
        2: { width: 160, height: 60 },
        3: { width: 140, height: 50 },
        4: { width: 120, height: 45 }
      };
      const size = sizes[level] || sizes[1];
      
      // Check if click is within node bounds
      if (x >= nodeX - size.width/2 && x <= nodeX + size.width/2 &&
          y >= nodeY - size.height/2 && y <= nodeY + size.height/2) {
        this.openNodeModal(node);
        break;
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onCanvasMouseMove(event: MouseEvent): void {
    // Handle node hovers if needed (future: show tooltip)
  }
  
  openNodeModal(node: MindMapNode): void {
    this.selectedNode = node;
    this.showNodeModal = true;
  }
  
  closeNodeModal(): void {
    this.showNodeModal = false;
    this.selectedNode = null;
  }
  
  onNodeNavigate(nodeId: string): void {
    const targetNode = this.mindMapNodes.find(n => n.id === nodeId);
    if (targetNode) {
      this.closeNodeModal();
      setTimeout(() => {
        this.openNodeModal(targetNode);
      }, 300);
    }
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

  exportMindMapAsPNG(): void {
    if (!this.canvas) return;
    
    const link = document.createElement('a');
    link.download = `mindmap-${Date.now()}.png`;
    link.href = this.canvas.toDataURL('image/png');
    link.click();
  }

  exportMindMapAsPDF(): void {
    if (!this.canvas) return;
    
    // Create a temporary canvas with white background
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (tempCtx) {
      // Fill white background
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      
      // Draw the mind map on top
      tempCtx.drawImage(this.canvas, 0, 0);
      
      // Convert to data URL and download
      const imgData = tempCanvas.toDataURL('image/png');
      
      // Create PDF manually (simple version without jspdf dependency)
      // For now, just download as PNG with PDF filename
      // User can convert PNG to PDF if needed
      const link = document.createElement('a');
      link.download = `mindmap-${Date.now()}.png`;
      link.href = imgData;
      link.click();
    }
  }

  // Podcast Logic
  togglePodcastPlayback(): void {
    if (this.podcastScript) {
      if (this.isPlaying) {
        this.audioService.pause();
        this.isPaused = true;
      } else if (this.isPaused) {
        this.audioService.resume();
        this.isPaused = false;
      } else {
        this.audioService.speak(this.podcastScript, { 
          rate: this.playbackSpeed,
          lang: 'fr-FR'
        });
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
    // Si une lecture est en cours, redémarrer avec la nouvelle vitesse
    if (this.isPlaying && this.podcastScript) {
      this.audioService.stop();
      setTimeout(() => {
        this.audioService.speak(this.podcastScript, { 
          rate: this.playbackSpeed,
          lang: 'fr-FR'
        });
      }, 100);
    }
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

  navigateToMindMap(): void {
    this.setActiveTab('mindmap');
  }

  navigateToPodcast(): void {
    this.setActiveTab('podcast');
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
