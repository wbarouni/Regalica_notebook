# Mind Map Sprint 2 - Interactive Modal

**Sprint:** 2 (Semaines 3-4)  
**Durée:** 2 semaines (80h)  
**Status:** 🚀 READY TO START  
**Dépendances:** ✅ Sprint 1 complété

---

## 🎯 OBJECTIFS SPRINT 2

### Vision
Permettre aux utilisateurs d'explorer en profondeur chaque concept du Mind Map via un modal interactif avec chat contextuel, résumés intelligents et questions suggérées.

### Livrables Clés
1. ✅ **Expand/Collapse Branches** - Contrôle hiérarchique de l'affichage
2. ✅ **Context Modal** - Modal riche avec résumé, citations, et chat
3. ✅ **Suggested Questions** - IA génère questions pertinentes par node
4. ✅ **Contextual Chat** - Chat focalisé sur le concept sélectionné

---

## 📋 TASKS DÉTAILLÉES

### TASK 1: Backend - Node Context API (1 jour)

**Objectif:** Créer endpoint pour récupérer contexte enrichi d'un node

**Fichier:** `backend/src/studio/context-routes.js`

```javascript
/**
 * GET /api/studio/mindmap/node/:nodeId/context
 * 
 * Response:
 * {
 *   nodeId: string,
 *   label: string,
 *   summary: string,
 *   fullSummary: string,
 *   citations: Citation[],
 *   relatedNodes: { id, label, similarity }[],
 *   suggestedQuestions: string[],
 *   chunkCount: number,
 *   metadata: { ... }
 * }
 */
router.get('/mindmap/node/:nodeId/context', async (req, res) => {
  const { nodeId } = req.params;
  const { notebookId } = req.query;
  
  try {
    // 1. Get node data from mind map
    const node = await getNodeById(nodeId);
    
    // 2. Get chunks associated with this node
    const chunks = await getNodeChunks(node.chunkIds, notebookId);
    
    // 3. Generate full summary with LLM
    const fullSummary = await generateDetailedSummary(chunks);
    
    // 4. Find related nodes (similar clusters)
    const relatedNodes = await findRelatedNodes(nodeId, notebookId);
    
    // 5. Generate suggested questions
    const suggestedQuestions = await generateQuestions(chunks, node.label);
    
    res.json({
      nodeId: node.id,
      label: node.label,
      summary: node.summary, // Short version
      fullSummary,           // Detailed version
      citations: node.citations,
      relatedNodes,
      suggestedQuestions,
      chunkCount: chunks.length,
      metadata: {
        clusterId: node.clusterId,
        level: node.level
      }
    });
  } catch (error) {
    logger.error(`[Context] Failed to get node context: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve node context' });
  }
});
```

**Fonctions Helper:**

```javascript
async function generateDetailedSummary(chunks, lang = 'en') {
  const context = chunks.map(c => c.text).join('\n\n').substring(0, 4000);
  
  const prompt = lang === 'fr'
    ? `Fournissez un résumé détaillé et structuré du contenu suivant:\n\n${context}\n\nRésumé détaillé:`
    : `Provide a detailed and structured summary of the following content:\n\n${context}\n\nDetailed summary:`;
  
  const response = await axios.post(`${config.llmApiUrl}/api/generate`, {
    model: config.llmNodeSummaryModel || config.llmModelName,
    prompt,
    temperature: 0.3,
    num_predict: 500
  });
  
  return response.data?.response?.trim() || 'Summary generation failed';
}

async function generateQuestions(chunks, label, lang = 'en', count = 5) {
  const context = chunks.slice(0, 5).map(c => c.text).join('\n\n').substring(0, 2000);
  
  const prompt = lang === 'fr'
    ? `Basé sur le concept "${label}" et le contexte suivant, générez ${count} questions pertinentes qu'un utilisateur pourrait poser:\n\n${context}\n\nQuestions (une par ligne):`
    : `Based on the concept "${label}" and the following context, generate ${count} relevant questions a user might ask:\n\n${context}\n\nQuestions (one per line):`;
  
  const response = await axios.post(`${config.llmApiUrl}/api/generate`, {
    model: config.llmModelName,
    prompt,
    temperature: 0.7,
    num_predict: 200
  });
  
  const text = response.data?.response?.trim() || '';
  return text.split('\n')
    .map(q => q.trim())
    .filter(q => q && q.length > 10)
    .slice(0, count);
}

async function findRelatedNodes(nodeId, notebookId) {
  // Find nodes with similar content (via chunk similarity)
  const client = await pool.connect();
  try {
    const result = await client.query(`
      WITH current_node_chunks AS (
        SELECT chunk_id FROM mindmap_node_chunks WHERE node_id = $1
      ),
      similar_chunks AS (
        SELECT 
          mnc.node_id,
          COUNT(*) as shared_chunks
        FROM mindmap_node_chunks mnc
        WHERE mnc.chunk_id IN (SELECT chunk_id FROM current_node_chunks)
          AND mnc.node_id != $1
        GROUP BY mnc.node_id
        ORDER BY shared_chunks DESC
        LIMIT 5
      )
      SELECT 
        mn.id,
        mn.label,
        sc.shared_chunks as similarity
      FROM similar_chunks sc
      JOIN mindmap_nodes mn ON sc.node_id = mn.id
    `, [nodeId]);
    
    return result.rows;
  } finally {
    client.release();
  }
}
```

**Checklist TASK 1:**
- [ ] Créer `backend/src/studio/context-routes.js`
- [ ] Implémenter endpoint GET `/node/:nodeId/context`
- [ ] Implémenter `generateDetailedSummary()`
- [ ] Implémenter `generateQuestions()`
- [ ] Implémenter `findRelatedNodes()`
- [ ] Intégrer dans `backend/src/server.js`
- [ ] Tests unitaires fonctions helper
- [ ] Tests API endpoint

---

### TASK 2: Frontend - Node Modal Component (2 jours)

**Objectif:** Créer modal interactif pour afficher contexte node

**Structure Folders:**
```
frontend/src/app/studio/mindmap/
├── components/
│   ├── mindmap-canvas/
│   ├── mindmap-node-modal/          # NEW
│   │   ├── mindmap-node-modal.component.ts
│   │   ├── mindmap-node-modal.component.html
│   │   ├── mindmap-node-modal.component.scss
│   │   └── mindmap-node-modal.component.spec.ts
```

**Component Template:**
```html
<!-- mindmap-node-modal.component.html -->
<div class="modal-overlay" (click)="onOverlayClick($event)" [@fadeIn]>
  <div class="modal-container" (click)="$event.stopPropagation()" [@slideIn]>
    <!-- Header -->
    <header class="modal-header">
      <div class="header-content">
        <div class="node-icon" [style.background-color]="getLevelColor()">
          <span class="level-badge">L{{ node?.level }}</span>
        </div>
        <div class="header-text">
          <h2 class="node-title">{{ node?.label }}</h2>
          <p class="node-meta">
            <span>{{ context?.chunkCount }} chunks</span>
            <span>•</span>
            <span>{{ context?.citations?.length }} sources</span>
          </p>
        </div>
      </div>
      <button class="close-btn" (click)="close()" aria-label="Close">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M6 18L18 6M6 6l12 12" stroke-width="2"/>
        </svg>
      </button>
    </header>

    <!-- Body -->
    <div class="modal-body" #modalBody>
      <!-- Loading State -->
      <div class="loading-state" *ngIf="isLoading">
        <div class="spinner"></div>
        <p>Chargement du contexte...</p>
      </div>

      <!-- Content -->
      <div class="modal-content" *ngIf="!isLoading && context">
        <!-- Summary Section -->
        <section class="summary-section">
          <h3 class="section-title">
            <svg width="20" height="20" fill="currentColor">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
              <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"/>
            </svg>
            Résumé Détaillé
          </h3>
          <div class="summary-content" [innerHTML]="formatSummary(context.fullSummary)"></div>
          
          <!-- Show More Toggle -->
          <button class="show-more-btn" 
                  *ngIf="context.fullSummary.length > 500"
                  (click)="toggleSummary()">
            {{ summaryExpanded ? 'Voir moins' : 'Voir plus' }}
          </button>
        </section>

        <!-- Citations Section -->
        <section class="citations-section" *ngIf="context.citations?.length">
          <h3 class="section-title">
            <svg width="20" height="20" fill="currentColor">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/>
            </svg>
            Sources ({{ context.citations.length }})
          </h3>
          <div class="citations-list">
            <div *ngFor="let citation of context.citations" 
                 class="citation-card"
                 (click)="openCitation(citation)">
              <div class="citation-header">
                <span class="doc-title">{{ citation.docTitle }}</span>
                <span class="page-badge" *ngIf="citation.page">
                  Page {{ citation.page }}
                </span>
              </div>
              <p class="citation-text">{{ citation.text }}</p>
            </div>
          </div>
        </section>

        <!-- Related Nodes Section -->
        <section class="related-section" *ngIf="context.relatedNodes?.length">
          <h3 class="section-title">
            <svg width="20" height="20" fill="currentColor">
              <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/>
              <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/>
            </svg>
            Concepts Connexes ({{ context.relatedNodes.length }})
          </h3>
          <div class="related-nodes-grid">
            <button *ngFor="let related of context.relatedNodes"
                    class="related-node-btn"
                    (click)="navigateToNode(related.id)">
              <span class="related-label">{{ related.label }}</span>
              <span class="similarity-badge">{{ related.similarity }}%</span>
            </button>
          </div>
        </section>

        <!-- Suggested Questions Section -->
        <section class="questions-section" *ngIf="context.suggestedQuestions?.length">
          <h3 class="section-title">
            <svg width="20" height="20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"/>
            </svg>
            Questions Suggérées
          </h3>
          <div class="questions-list">
            <button *ngFor="let question of context.suggestedQuestions"
                    class="question-btn"
                    (click)="askQuestion(question)">
              <svg width="16" height="16" fill="currentColor">
                <path d="M2 10a1 1 0 011-1h8a1 1 0 110 2H3a1 1 0 01-1-1zM2 6a1 1 0 011-1h8a1 1 0 110 2H3a1 1 0 01-1-1zM6 13a1 1 0 011-1h4a1 1 0 110 2H7a1 1 0 01-1-1z"/>
              </svg>
              {{ question }}
            </button>
          </div>
        </section>

        <!-- Chat Section -->
        <section class="chat-section">
          <h3 class="section-title">
            <svg width="20" height="20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z"/>
            </svg>
            Poser une Question
          </h3>
          <div class="chat-input-group">
            <textarea 
              [(ngModel)]="userQuestion"
              placeholder="Demandez des détails sur ce concept..."
              (keydown.enter)="onEnter($event)"
              rows="3"></textarea>
            <button class="send-btn" 
                    (click)="submitQuestion()"
                    [disabled]="!userQuestion.trim() || isSending">
              <svg *ngIf="!isSending" width="20" height="20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
              </svg>
              <span>{{ isSending ? 'Envoi...' : 'Envoyer' }}</span>
            </button>
          </div>
        </section>
      </div>

      <!-- Error State -->
      <div class="error-state" *ngIf="error">
        <svg width="48" height="48" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"/>
        </svg>
        <h3>Erreur de Chargement</h3>
        <p>{{ error }}</p>
        <button class="retry-btn" (click)="loadContext()">Réessayer</button>
      </div>
    </div>
  </div>
</div>
```

**Component TypeScript:**
```typescript
import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { MindMapNode } from '../../models/mindmap-node.model';
import { NodeContext } from '../../models/node-context.model';
import { MindMapContextService } from '../../services/mindmap-context.service';
import { ChatService } from '../../../services/chat.service';

@Component({
  selector: 'app-mindmap-node-modal',
  templateUrl: './mindmap-node-modal.component.html',
  styleUrls: ['./mindmap-node-modal.component.scss'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0 }))
      ])
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateY(100px)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateY(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ transform: 'translateY(50px)', opacity: 0 }))
      ])
    ])
  ]
})
export class MindMapNodeModalComponent implements OnInit {
  @Input() node!: MindMapNode;
  @Input() notebookId?: string;
  @Output() closed = new EventEmitter<void>();
  @Output() nodeNavigate = new EventEmitter<string>();
  
  context?: NodeContext;
  isLoading = false;
  isSending = false;
  error?: string;
  
  userQuestion = '';
  summaryExpanded = false;
  
  constructor(
    private contextService: MindMapContextService,
    private chatService: ChatService
  ) {}
  
  ngOnInit() {
    this.loadContext();
  }
  
  async loadContext() {
    this.isLoading = true;
    this.error = undefined;
    
    try {
      this.context = await this.contextService.getNodeContext(
        this.node.id,
        this.notebookId
      );
    } catch (err: any) {
      this.error = err.message || 'Failed to load context';
    } finally {
      this.isLoading = false;
    }
  }
  
  getLevelColor(): string {
    const colors = {
      1: '#6B46C1',
      2: '#3B82F6',
      3: '#10B981',
      4: '#8B5CF6'
    };
    return colors[this.node.level] || colors[1];
  }
  
  formatSummary(summary: string): string {
    if (!this.summaryExpanded && summary.length > 500) {
      return summary.substring(0, 500) + '...';
    }
    return summary.replace(/\n/g, '<br>');
  }
  
  toggleSummary() {
    this.summaryExpanded = !this.summaryExpanded;
  }
  
  openCitation(citation: any) {
    // Navigate to source document
    this.chatService.openDocument(citation.docId, {
      page: citation.page,
      highlight: { start: citation.spanStart, end: citation.spanEnd }
    });
  }
  
  navigateToNode(nodeId: string) {
    this.nodeNavigate.emit(nodeId);
    this.close();
  }
  
  askQuestion(question: string) {
    this.userQuestion = question;
    this.submitQuestion();
  }
  
  async submitQuestion() {
    if (!this.userQuestion.trim()) return;
    
    this.isSending = true;
    
    try {
      // Send question with node context
      await this.chatService.sendContextualQuestion(
        this.userQuestion,
        {
          nodeId: this.node.id,
          chunkIds: this.node.chunkIds,
          notebookId: this.notebookId
        }
      );
      
      this.close();
    } catch (err) {
      console.error('Failed to send question:', err);
    } finally {
      this.isSending = false;
    }
  }
  
  onEnter(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      this.submitQuestion();
    }
  }
  
  onOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }
  
  close() {
    this.closed.emit();
  }
}
```

**Checklist TASK 2:**
- [ ] Créer structure folders `mindmap-node-modal/`
- [ ] Créer template HTML
- [ ] Créer component TypeScript
- [ ] Créer styles SCSS (design NotebookLM)
- [ ] Implémenter animations
- [ ] Implémenter formatage summary
- [ ] Implémenter navigation citations
- [ ] Tests unitaires component

---

### TASK 3: Frontend - Context Service (1 jour)

**Fichier:** `frontend/src/app/studio/mindmap/services/mindmap-context.service.ts`

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NodeContext } from '../models/node-context.model';

@Injectable({ providedIn: 'root' })
export class MindMapContextService {
  private readonly apiUrl = '/api/studio/mindmap';
  
  constructor(private http: HttpClient) {}
  
  /**
   * Get full context for a node
   */
  async getNodeContext(nodeId: string, notebookId?: string): Promise<NodeContext> {
    const params = notebookId ? `?notebookId=${notebookId}` : '';
    const response = await this.http.get<NodeContext>(
      `${this.apiUrl}/node/${nodeId}/context${params}`
    ).toPromise();
    
    if (!response) {
      throw new Error('Failed to load node context');
    }
    
    return response;
  }
  
  /**
   * Get suggested questions for a node (cached)
   */
  private questionCache = new Map<string, string[]>();
  
  async getSuggestedQuestions(nodeId: string, refresh = false): Promise<string[]> {
    if (!refresh && this.questionCache.has(nodeId)) {
      return this.questionCache.get(nodeId)!;
    }
    
    const context = await this.getNodeContext(nodeId);
    const questions = context.suggestedQuestions || [];
    
    this.questionCache.set(nodeId, questions);
    return questions;
  }
}
```

**Model:** `frontend/src/app/studio/mindmap/models/node-context.model.ts`

```typescript
export interface NodeContext {
  nodeId: string;
  label: string;
  summary: string;
  fullSummary: string;
  citations: Citation[];
  relatedNodes: RelatedNode[];
  suggestedQuestions: string[];
  chunkCount: number;
  metadata: {
    clusterId: number;
    level: number;
  };
}

export interface Citation {
  docId: string;
  docTitle: string;
  page?: number;
  spanStart: number;
  spanEnd: number;
  text: string;
}

export interface RelatedNode {
  id: string;
  label: string;
  similarity: number;
}
```

**Checklist TASK 3:**
- [ ] Créer `mindmap-context.service.ts`
- [ ] Créer models `node-context.model.ts`
- [ ] Implémenter getNodeContext()
- [ ] Implémenter cache questions
- [ ] Tests unitaires service
- [ ] Integration avec component

---

### TASK 4: Integration Canvas + Modal (1 jour)

**Objectif:** Connecter modal au canvas (click sur node ouvre modal)

**Modifications:** `frontend/src/app/layout/magic-studio/magic-studio.component.ts`

```typescript
// Add to component
selectedNode: MindMapNode | null = null;
showNodeModal = false;

// In drawMindMap(), add click handlers
private drawMindMap(): void {
  // ... existing code ...
  
  // Draw nodes with click handlers
  this.mindMapNodes.forEach(node => {
    // ... existing drawing code ...
    
    // Add click area (invisible larger circle for easier clicks)
    const clickRadius = Math.max(w, h) / 2 + 10;
    
    // Store node position for click detection
    (node as any).clickBounds = {
      x: x - clickRadius,
      y: y - clickRadius,
      width: clickRadius * 2,
      height: clickRadius * 2
    };
  });
}

// Add canvas click handler
onCanvasClick(event: MouseEvent): void {
  const rect = this.canvas!.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  // Check if clicked on any node
  for (const node of this.mindMapNodes) {
    const bounds = (node as any).clickBounds;
    if (bounds && 
        x >= bounds.x && x <= bounds.x + bounds.width &&
        y >= bounds.y && y <= bounds.y + bounds.width) {
      this.openNodeModal(node);
      break;
    }
  }
}

openNodeModal(node: MindMapNode) {
  this.selectedNode = node;
  this.showNodeModal = true;
}

closeNodeModal() {
  this.showNodeModal = false;
  this.selectedNode = null;
}

navigateToNode(nodeId: string) {
  const targetNode = this.mindMapNodes.find(n => n.id === nodeId);
  if (targetNode) {
    this.openNodeModal(targetNode);
    
    // Optionally: animate camera to target node
    this.animateCameraToNode(targetNode);
  }
}
```

**Template Update:**
```html
<!-- Add to template -->
<app-mindmap-node-modal
  *ngIf="showNodeModal && selectedNode"
  [node]="selectedNode"
  [notebookId]="activeNotebookId"
  (closed)="closeNodeModal()"
  (nodeNavigate)="navigateToNode($event)">
</app-mindmap-node-modal>
```

**Checklist TASK 4:**
- [ ] Ajouter click detection au canvas
- [ ] Implémenter openNodeModal()
- [ ] Implémenter closeNodeModal()
- [ ] Implémenter navigateToNode()
- [ ] Ajouter modal au template
- [ ] Tests interaction click → modal
- [ ] Tests navigation entre nodes

---

## 🎨 DESIGN SPECS

### Modal Dimensions
```scss
.modal-container {
  width: 90vw;
  max-width: 800px;
  max-height: 90vh;
  border-radius: 16px;
  background: #FFFFFF;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
```

### Color Tokens (from Sprint 1)
```scss
$level-1-color: #6B46C1;
$level-2-color: #3B82F6;
$level-3-color: #10B981;
$level-4-color: #8B5CF6;
```

---

## ✅ CRITÈRES DE SUCCÈS

### Fonctionnel
- [ ] Click sur node ouvre modal
- [ ] Modal affiche résumé détaillé
- [ ] Citations cliquables (navigate to source)
- [ ] Questions suggérées générées
