# Mind Map Sprint 4 - Deep Integration Plan

**Sprint:** 4 (Semaines 7-8)  
**Focus:** Auto-génération depuis Chat + Integration profonde  
**Status:** 🟡 EN COURS

---

## 🎯 OBJECTIFS SPRINT 4

### Priorité 1: Auto-génération depuis Chat ⭐⭐⭐
**Objectif:** Générer automatiquement un Mind Map après chaque réponse RAG

**Fonctionnalités:**
1. Toggle "Auto Mind Map" dans chat
2. Génération automatique après réponse
3. Mini aperçu dans sidebar
4. Click → ouvre Magic Studio avec Mind Map
5. Historique des Mind Maps générés

### Priorité 2: Integration Chat ↔ Mind Map ⭐⭐
**Objectif:** Flux bidirectionnel entre Chat et Mind Map

**Fonctionnalités:**
1. Depuis Mind Map → Ask question (déjà fait ✅)
2. Depuis Chat → Generate Mind Map
3. Context sharing (même query, même sources)
4. Navigation seamless

### Priorité 3: Quick Actions ⭐
**Objectif:** Actions rapides sur Mind Map

**Fonctionnalités:**
1. Bouton "Generate Mind Map" dans chat UI
2. Bouton "Ask about this" dans node modal
3. Shortcut keyboard (Ctrl/Cmd+M)

---

## 📋 TASKS DÉTAILLÉES

### TASK 1: Chat Auto-Generation Toggle

**Backend:** Aucun changement nécessaire (API déjà prête)

**Frontend:**

**1.1 Service Extension**
**Fichier:** `frontend/src/app/services/studio.service.ts`
```typescript
// Ajouter méthode:
generateMindMapFromChat(query: string, sources: any[], notebookId?: string)
```

**1.2 Chat Component Integration**
**Fichier:** `frontend/src/app/chat/chat.component.ts`
```typescript
// Ajouter properties:
autoGenerateMindMap: boolean = false
latestMindMapId: string | null = null

// Ajouter méthode:
onMessageReceived(message: ChatMessage) {
  if (this.autoGenerateMindMap && message.role === 'assistant') {
    this.generateMindMapInBackground(message)
  }
}

async generateMindMapInBackground(message: ChatMessage) {
  // Generate mind map
  // Store in service
  // Show notification "Mind Map ready!"
}
```

**1.3 Chat Template Toggle**
**Fichier:** `frontend/src/app/chat/chat.component.html`
```html
<!-- Add toggle button in chat header -->
<div class="chat-header">
  <h2>Chat</h2>
  <label class="toggle-mindmap">
    <input type="checkbox" [(ngModel)]="autoGenerateMindMap">
    <span>Auto Mind Map</span>
  </label>
</div>

<!-- Add quick action button after message -->
<div class="message-actions" *ngIf="message.role === 'assistant'">
  <button (click)="generateMindMapForMessage(message)">
    🗺️ Generate Mind Map
  </button>
</div>
```

---

### TASK 2: Mind Map Sidebar Preview

**2.1 Create Preview Component**
**Fichier:** `frontend/src/app/chat/mindmap-preview.component.ts`
```typescript
@Component({
  selector: 'app-mindmap-preview',
  standalone: true,
  template: `
    <div class="mindmap-preview" *ngIf="mindMapData">
      <div class="preview-header">
        <span class="icon">🗺️</span>
        <span class="title">Mind Map Ready</span>
        <button class="close-btn" (click)="close()">×</button>
      </div>
      <div class="preview-canvas">
        <canvas #preview></canvas>
      </div>
      <button class="open-btn" (click)="openInStudio()">
        Open in Studio
      </button>
    </div>
  `
})
export class MindMapPreviewComponent {
  @Input() mindMapData: any
  @Output() opened = new EventEmitter()
  
  // Mini canvas rendering
  // Click → emit opened event
}
```

**2.2 Integrate in Chat Sidebar**
```html
<div class="chat-sidebar">
  <!-- Existing sidebar content -->
  
  <!-- Mind Map Preview -->
  <app-mindmap-preview
    *ngIf="latestMindMap"
    [mindMapData]="latestMindMap"
    (opened)="openMindMapInStudio()">
  </app-mindmap-preview>
</div>
```

---

### TASK 3: Shared State Service

**3.1 Create Mindmap State Service**
**Fichier:** `frontend/src/app/services/mindmap-state.service.ts`
```typescript
@Injectable({ providedIn: 'root' })
export class MindMapStateService {
  private mindMapSubject = new BehaviorSubject<MindMapData | null>(null)
  mindMap$ = this.mindMapSubject.asObservable()
  
  private historySubject = new BehaviorSubject<MindMapData[]>([])
  history$ = this.historySubject.asObservable()
  
  // Méthodes:
  setCurrentMindMap(data: MindMapData): void
  addToHistory(data: MindMapData): void
  getHistory(): MindMapData[]
  clearHistory(): void
}

interface MindMapData {
  id: string
  query: string
  timestamp: Date
  nodes: any[]
  connections: any[]
  sourceMessageId?: string
}
```

**3.2 Use in Chat Component**
```typescript
constructor(
  private mindMapState: MindMapStateService
) {}

async generateMindMapInBackground(message: ChatMessage) {
  const mindMapData = await this.studioService.generateMindMap(...)
  
  // Store in shared state
  this.mindMapState.setCurrentMindMap({
    id: uuidv4(),
    query: message.content,
    timestamp: new Date(),
    nodes: mindMapData.nodes,
    connections: [],
    sourceMessageId: message.id
  })
  
  // Add to history
  this.mindMapState.addToHistory(mindMapData)
  
  // Show notification
  this.showNotification('Mind Map generated!')
}
```

**3.3 Use in Magic Studio**
```typescript
ngOnInit() {
  // Subscribe to shared mind map
  this.mindMapState.mindMap$
    .pipe(takeUntil(this.destroy$))
    .subscribe(mindMap => {
      if (mindMap && this.activeTab === 'mindmap') {
        this.loadMindMapFromState(mindMap)
      }
    })
}
```

---

### TASK 4: Navigation Integration

**4.1 Router Navigation**
**Fichier:** `frontend/src/app/chat/chat.component.ts`
```typescript
import { Router } from '@angular/router'

constructor(private router: Router) {}

openMindMapInStudio() {
  // Navigate to Magic Studio
  this.router.navigate(['/magic-studio'], {
    queryParams: { tab: 'mindmap' }
  })
}
```

**4.2 Magic Studio Route Handler**
**Fichier:** `frontend/src/app/layout/magic-studio/magic-studio.component.ts`
```typescript
import { ActivatedRoute } from '@angular/router'

ngOnInit() {
  // Check query params
  this.route.queryParams.subscribe(params => {
    if (params['tab']) {
      this.setActiveTab(params['tab'])
    }
  })
  
  // ... rest of init
}
```

---

### TASK 5: Quick Actions & Shortcuts

**5.1 Keyboard Shortcuts**
**Fichier:** `frontend/src/app/chat/chat.component.ts`
```typescript
@HostListener('document:keydown', ['$event'])
handleKeyboardEvent(event: KeyboardEvent) {
  // Ctrl/Cmd + M → Generate Mind Map
  if ((event.ctrlKey || event.metaKey) && event.key === 'm') {
    event.preventDefault()
    this.generateMindMapForLastMessage()
  }
}
```

**5.2 Context Menu**
```html
<!-- Right-click context menu on messages -->
<div class="message-context-menu" *ngIf="showContextMenu">
  <button (click)="generateMindMap()">
    🗺️ Generate Mind Map
  </button>
  <button (click)="copyMessage()">
    📋 Copy
  </button>
  <button (click)="exportMessage()">
    💾 Export
  </button>
</div>
```

---

## 🎨 UI/UX DESIGN

### Toggle Switch Design
```scss
.toggle-mindmap {
  display: flex;
  align-items: center;
  gap: 8px;
  
  input[type="checkbox"] {
    width: 40px;
    height: 20px;
    appearance: none;
    background: #e5e7eb;
    border-radius: 10px;
    position: relative;
    cursor: pointer;
    transition: background 150ms;
    
    &:checked {
      background: #3b82f6;
      
      &::before {
        transform: translateX(20px);
      }
    }
    
    &::before {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: white;
      top: 2px;
      left: 2px;
      transition: transform 150ms;
    }
  }
  
  span {
    font-size: 14px;
    color: #6b7280;
  }
}
```

### Mind Map Preview Card
```scss
.mindmap-preview {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  animation: slideUp 300ms ease-out;
  
  .preview-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    
    .icon {
      font-size: 20px;
    }
    
    .title {
      flex: 1;
      font-weight: 500;
      color: #111827;
    }
  }
  
  .preview-canvas {
    width: 100%;
    height: 150px;
    background: #f9fafb;
    border-radius: 8px;
    margin-bottom: 12px;
    
    canvas {
      width: 100%;
      height: 100%;
    }
  }
  
  .open-btn {
    width: 100%;
    padding: 10px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms;
    
    &:hover {
      background: #2563eb;
    }
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Notification Toast
```scss
.mindmap-notification {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: white;
  padding: 16px 20px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  display: flex;
  align-items: center;
  gap: 12px;
  animation: slideInRight 300ms ease-out;
  z-index: 1000;
  
  .icon {
    font-size: 24px;
  }
  
  .content {
    flex: 1;
    
    .title {
      font-weight: 500;
      color: #111827;
      margin-bottom: 4px;
    }
    
    .message {
      font-size: 14px;
      color: #6b7280;
    }
  }
  
  .action-btn {
    padding: 8px 16px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    
    &:hover {
      background: #2563eb;
    }
  }
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(100px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

---

## 📊 ARCHITECTURE FLOW

```
Chat Component
├── User sends message
├── RAG responds
├── Auto-gen check (if enabled)
│   ├── Generate Mind Map (background)
│   ├── Store in MindMapStateService
│   ├── Show notification
│   └── Update preview in sidebar
└── User clicks "Open in Studio"
    ├── Navigate to /magic-studio?tab=mindmap
    ├── Magic Studio loads
    ├── Subscribe to MindMapStateService
    └── Display Mind Map

Mind Map State Service
├── BehaviorSubject<MindMapData>
├── History management
├── Persistence (localStorage)
└── Shared across components
```

---

## ✅ CHECKLIST SPRINT 4

### Backend
- [ ] Aucun changement nécessaire (API déjà prête ✅)

### Frontend
- [ ] TASK 1: Chat auto-generation toggle
- [ ] TASK 2: Mind Map sidebar preview
- [ ] TASK 3: Shared state service
- [ ] TASK 4: Navigation integration
- [ ] TASK 5: Quick actions & shortcuts

### UI/UX
- [ ] Toggle switch design
- [ ] Preview card design
- [ ] Notification toast
- [ ] Keyboard shortcuts
- [ ] Context menu

### Testing
- [ ] Test auto-generation
- [ ] Test navigation flow
- [ ] Test shared state
- [ ] Test keyboard shortcuts
- [ ] Test on different screen sizes

---

## 🎯 SUCCESS CRITERIA

1. ✅ Toggle "Auto Mind Map" fonctionne
2. ✅ Mind Map génère automatiquement après réponse
3. ✅ Preview s'affiche dans sidebar
4. ✅ Click "Open in Studio" navigue correctement
5. ✅ Shared state sync entre Chat et Studio
6. ✅ Keyboard shortcut Ctrl/Cmd+M fonctionne
7. ✅ Historique des Mind Maps accessible
8. ✅ Notifications claires et non-intrusives

---

## 📝 NOTES TECHNIQUES

**Performance:**
- Génération en background (non-bloquant)
- Cache les Mind Maps générés
- Lazy load du canvas preview

**State Management:**
- BehaviorSubject pour reactive updates
- LocalStorage pour persistence
- Clear on logout

**Navigation:**
- Query params pour tab selection
- Browser back button fonctionne
- Deep linking support

**Accessibility:**
- Keyboard navigation
- ARIA labels
- Screen reader friendly

---

## 🚀 ESTIMATION

**Durée:** 2-3 jours  
**Complexité:** Moyenne  
**Priorité:** Haute (grande valeur utilisateur)

**Breakdown:**
- TASK 1: 4h
- TASK 2: 3h
- TASK 3: 2h
- TASK 4: 2h
- TASK 5: 2h
- Testing: 2h
- **TOTAL:** ~15h

---

## 📦 LIVRABLES

1. ✅ MindMapStateService (shared state)
2. ✅ MindMapPreviewComponent (sidebar)
3. ✅ Chat component integration (toggle + actions)
4. ✅ Magic Studio route handling
5. ✅ Keyboard shortcuts
6. ✅ Notification system
7. ✅ Documentation updated
8. ✅ Tests end-to-end

**Sprint 4 will make Mind Map generation seamless and integrated into the natural chat workflow! 🎊**
