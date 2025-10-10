# Mind Map Enhancement - Roadmap Détaillée

## 📅 Timeline: 10 Semaines (400h)

**Start Date:** 2025-10-10  
**Target Completion:** 2025-12-19

---

## 🎯 SPRINT 1-2: UX FOUNDATION (Semaines 1-2)

### Objectifs
- Implémenter hiérarchie visuelle avec code couleur
- Créer design system complet
- Optimiser D3.js force layout
- Animations et transitions

### Livrables

#### 1. Design System
**File:** `frontend/src/app/studio/mindmap/styles/_mindmap-theme.scss`

```scss
// Color system
$mindmap-level1: #6B46C1;  // Violet (Central)
$mindmap-level2: #3B82F6;  // Bleu (Branches)
$mindmap-level3: #10B981;  // Vert (Détails)
$mindmap-level4: #8B5CF6;  // Lavande (Sub-details)

// Node sizes
$node-level1-width: 200px;
$node-level1-height: 80px;
$node-level2-width: 160px;
// ... etc

// Transitions
$transition-fast: 150ms ease-out;
$transition-normal: 300ms ease-in-out;
$transition-slow: 500ms ease-in-out;
```

#### 2. TypeScript Models
**File:** `frontend/src/app/studio/mindmap/models/mindmap-node.model.ts`

```typescript
export interface MindMapNode {
  id: string;
  label: string;
  level: 1 | 2 | 3 | 4;
  summary?: string;
  citations?: Citation[];
  chunkIds: string[];
  clusterId: number;
  
  // Visual properties
  x?: number;
  y?: number;
  collapsed: boolean;
  visible: boolean;
  
  // Metadata
  childCount?: number;
  parentId?: string;
}

export interface MindMapEdge {
  source: string;
  target: string;
  weight: number;
  visible: boolean;
}

export interface MindMapConfig {
  width: number;
  height: number;
  nodeDistance: number;
  chargeStrength: number;
  centerForce: number;
  collisionRadius: number;
}
```

#### 3. Layout Service
**File:** `frontend/src/app/studio/mindmap/services/mindmap-layout.service.ts`

```typescript
import { Injectable } from '@angular/core';
import * as d3 from 'd3';

@Injectable({ providedIn: 'root' })
export class MindMapLayoutService {
  
  createForceSimulation(
    nodes: MindMapNode[],
    edges: MindMapEdge[],
    config: MindMapConfig
  ) {
    return d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges)
        .id((d: any) => d.id)
        .distance(d => this.calculateDistance(d))
      )
      .force('charge', d3.forceManyBody()
        .strength(d => this.calculateCharge(d))
      )
      .force('center', d3.forceCenter(
        config.width / 2,
        config.height / 2
      ))
      .force('collision', d3.forceCollide()
        .radius(d => this.calculateCollisionRadius(d))
      )
      .force('radial', d3.forceRadial(
        d => d.level * 150,
        config.width / 2,
        config.height / 2
      ).strength(0.5));
  }
  
  private calculateDistance(edge: any): number {
    const sourceLevel = edge.source.level || 1;
    const targetLevel = edge.target.level || 1;
    return 80 + Math.abs(sourceLevel - targetLevel) * 30;
  }
  
  private calculateCharge(node: any): number {
    return node.level === 1 ? -500 : -200;
  }
  
  private calculateCollisionRadius(node: any): number {
    const sizes = {
      1: 100, 2: 80, 3: 70, 4: 60
    };
    return (sizes[node.level] || 60) + 20;
  }
}
```

### Tasks Sprint 1-2
- [ ] Créer structure folders mindmap/
- [ ] Implémenter design system SCSS
- [ ] Créer models TypeScript
- [ ] Implémenter layout service
- [ ] Créer canvas component base
- [ ] Tests visuels couleurs/tailles
- [ ] Performance benchmarks

**Effort:** 80h  
**Team:** 2 devs × 2 semaines

---

## 🎯 SPRINT 3-4: INTERACTIVE MODAL (Semaines 3-4)

### Objectifs
- Expand/collapse branches
- Modal chat contextuel
- Node summaries
- Suggested questions

### Livrables

#### 1. Toggle Branches
**Component:** `mindmap-canvas.component.ts`

```typescript
toggleNode(nodeId: string) {
  const node = this.nodes.find(n => n.id === nodeId);
  if (!node) return;
  
  node.collapsed = !node.collapsed;
  
  // Get descendants
  const descendants = this.getDescendants(nodeId);
  
  // Animate visibility
  descendants.forEach(child => {
    child.visible = !node.collapsed;
    this.animateNode(child, node.collapsed ? 'fadeOut' : 'fadeIn');
  });
  
  // Update layout
  this.updateSimulation();
}

private animateNode(node: MindMapNode, animation: 'fadeIn' | 'fadeOut') {
  const element = d3.select(`#node-${node.id}`);
  
  if (animation === 'fadeOut') {
    element.transition()
      .duration(300)
      .style('opacity', 0)
      .on('end', () => element.style('display', 'none'));
  } else {
    element
      .style('display', 'block')
      .style('opacity', 0)
      .transition()
      .duration(300)
      .style('opacity', 1);
  }
}
```

#### 2. Context Modal
**Component:** `mindmap-modal.component.ts`

```typescript
@Component({
  selector: 'app-mindmap-modal',
  template: `
    <div class="modal-overlay" (click)="close()">
      <div class="modal-panel" (click)="$event.stopPropagation()">
        <header class="modal-header">
          <h2>{{ node?.label }}</h2>
          <button (click)="close()" class="close-btn">×</button>
        </header>
        
        <div class="modal-body">
          <!-- Summary -->
          <section class="summary-section">
            <h3>Résumé</h3>
            <p>{{ context?.summary }}</p>
          </section>
          
          <!-- Citations -->
          <section class="citations-section" *ngIf="context?.citations?.length">
            <h3>Sources ({{ context.citations.length }})</h3>
            <div class="citation-list">
              <div *ngFor="let citation of context.citations" 
                   class="citation-item"
                   (click)="openCitation(citation)">
                <span class="doc-title">{{ citation.docTitle }}</span>
                <span class="page-no" *ngIf="citation.page">Page {{ citation.page }}</span>
              </div>
            </div>
          </section>
          
          <!-- Suggested Questions -->
          <section class="questions-section">
            <h3>Questions suggérées</h3>
            <div class="question-list">
              <button *ngFor="let question of context?.suggestedQuestions"
                      class="question-btn"
                      (click)="askQuestion(question)">
                {{ question }}
              </button>
            </div>
          </section>
          
          <!-- Chat Input -->
          <section class="chat-section">
            <h3>Poser une question</h3>
            <textarea [(ngModel)]="userQuestion" 
                      placeholder="Demandez des détails sur ce concept..."></textarea>
            <button (click)="submitQuestion()" 
                    [disabled]="!userQuestion.trim()"
                    class="submit-btn">
              Envoyer
            </button>
          </section>
        </div>
      </div>
    </div>
  `
})
export class MindMapModalComponent {
  @Input() node: MindMapNode;
  @Output() closed = new EventEmitter<void>();
  
  context: NodeContext;
  userQuestion = '';
  
  constructor(
    private contextService: MindMapContextService,
    private chatService: ChatService
  ) {}
  
  ngOnInit() {
    this.loadContext();
  }
  
  async loadContext() {
    this.context = await this.contextService.getNodeContext(this.node.id);
  }
  
  askQuestion(question: string) {
    this.chatService.sendMessage(question, {
      context: 'mindmap',
      nodeId: this.node.id,
      chunkIds: this.node.chunkIds
    });
    this.close();
  }
  
  submitQuestion() {
    if (this.userQuestion.trim()) {
      this.askQuestion(this.userQuestion);
    }
  }
  
  close() {
    this.closed.emit();
  }
}
```

#### 3. Context Service
**Service:** `mindmap-context.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class MindMapContextService {
  
  async getNodeContext(nodeId: string): Promise<NodeContext> {
    const response = await this.http.get<NodeContext>(
      `/api/studio/mindmap/node/${nodeI
