# Mind Map - Plan de Complétion Totale

**Date:** 10 Octobre 2025  
**Objectif:** Compléter 100% de tous les sprints (3, 4, 5)

---

## 📊 ÉTAT ACTUEL

```
Sprint 1: UX Foundation           ████████████████████ 100% ✅
Sprint 2: Interactive Modal       ████████████████████ 100% ✅
Sprint 3: Export & Sharing        ░░░░░░░░░░░░░░░░░░░░   0% ⏸️
Sprint 4: Deep Integration        ████████░░░░░░░░░░░░  40% 🟡
Sprint 5: Advanced Features       ░░░░░░░░░░░░░░░░░░░░   0% ⏸️
────────────────────────────────────────────────────────────
TOTAL (5 sprints):                ████████████░░░░░░░░  48%
```

---

## 🎯 ORDRE D'IMPLÉMENTATION

### Phase 1: Compléter Sprint 4 (60% restant)
**Durée:** 2-3 heures

#### TASK 1: Chat Integration ⭐ Priorité 1
**Fichiers à modifier:**
- `frontend/src/app/chat/chat.component.ts`
- `frontend/src/app/chat/chat.component.html`
- `frontend/src/app/chat/chat.component.scss`

**Fonctionnalités:**
1. Ajouter bouton "Generate Mind Map" après chaque message assistant
2. Integration avec MindMapStateService
3. Navigation vers Magic Studio avec query params
4. Toast notification

**Code minimal:**
```typescript
// Dans chat.component.ts
import { Router } from '@angular/router';
import { MindMapStateService } from '../services/mindmap-state.service';

generateMindMapForMessage(message: ChatMessage) {
  // Store in state
  this.mindMapState.setCurrentMindMap({
    id: uuid(),
    query: message.content,
    timestamp: new Date(),
    nodes: [],
    connections: [],
    sourceMessageId: message.id
  });
  
  // Navigate
  this.router.navigate(['/magic-studio'], {
    queryParams: { tab: 'mindmap' }
  });
}
```

**Template:**
```html
<div class="message-actions" *ngIf="message.role === 'assistant'">
  <button (click)="generateMindMapForMessage(message)" class="mind-map-btn">
    🗺️ Generate Mind Map
  </button>
</div>
```

#### TASK 2: Preview Component (Optionnel - Simplifié)
**Note:** On peut simplifier en affichant juste un lien/button au lieu d'un preview canvas complet.

```html
<!-- Dans chat sidebar -->
<div class="mindmap-quick-link" *ngIf="latestMindMap">
  <span>🗺️ Mind Map Ready</span>
  <button (click)="openMindMapInStudio()">Open</button>
</div>
```

#### TASK 5: Keyboard Shortcuts ⭐ Priorité 2
**Fichier:** `frontend/src/app/chat/chat.component.ts`

```typescript
@HostListener('document:keydown', ['$event'])
handleKeyboardEvent(event: KeyboardEvent) {
  // Ctrl/Cmd + M → Generate Mind Map pour dernier message
  if ((event.ctrlKey || event.metaKey) && event.key === 'm') {
    event.preventDefault();
    const lastMessage = this.getLastAssistantMessage();
    if (lastMessage) {
      this.generateMindMapForMessage(lastMessage);
    }
  }
}
```

---

### Phase 2: Sprint 3 - Export & Sharing
**Durée:** 1-2 heures

#### TASK 1: Export PNG
**Fichier:** `frontend/src/app/layout/magic-studio/magic-studio.component.ts`

```typescript
exportMindMapAsPNG(): void {
  if (!this.canvas) return;
  
  const link = document.createElement('a');
  link.download = `mindmap-${Date.now()}.png`;
  link.href = this.canvas.toDataURL('image/png');
  link.click();
}
```

**Template:**
```html
<button (click)="exportMindMapAsPNG()" class="action-btn">
  <svg>...</svg> Export PNG
</button>
```

#### TASK 2: Export PDF
**Installation:** `npm install jspdf`

```typescript
import jsPDF from 'jspdf';

exportMindMapAsPDF(): void {
  if (!this.canvas) return;
  
  const imgData = this.canvas.toDataURL('image/png');
  const pdf = new jsPDF('landscape');
  const imgWidth = 280;
  const imgHeight = (this.canvas.height * imgWidth) / this.canvas.width;
  
  pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
  pdf.save(`mindmap-${Date.now()}.pdf`);
}
```

#### TASK 3: Share Link (Optionnel)
```typescript
shareMindMap(): void {
  const data = {
    nodes: this.mindMapNodes,
    connections: this.mindMapConnections,
    timestamp: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  navigator.clipboard.writeText(url);
  // Show toast: "Link copied to clipboard"
}
```

---

### Phase 3: Sprint 5 - Advanced Features
**Durée:** 2-3 heures

#### TASK 1: Zoom & Pan
```typescript
// Dans magic-studio.component.ts
private zoom = 1;
private panX = 0;
private panY = 0;

onCanvasWheel(event: WheelEvent): void {
  event.preventDefault();
  const delta = event.deltaY > 0 ? 0.9 : 1.1;
  this.zoom *= delta;
  this.zoom = Math.max(0.1, Math.min(5, this.zoom));
  this.drawMindMap();
}

onCanvasMouseDown(event: MouseEvent): void {
  this.isDragging = true;
  this.lastX = event.clientX;
  this.lastY = event.clientY;
}

onCanvasMouseMove(event: MouseEvent): void {
  if (this.isDragging) {
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.panX += dx;
    this.panY += dy;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.drawMindMap();
  }
}
```

#### TASK 2: Search Nodes
```html
<input type="text" 
       [(ngModel)]="searchQuery" 
       (input)="onSearchNodes()"
       placeholder="Search nodes...">
```

```typescript
onSearchNodes(): void {
  if (!this.searchQuery) {
    this.highlightedNodes = [];
    return;
  }
  
  this.highlightedNodes = this.mindMapNodes.filter(node =>
    node.text.toLowerCase().includes(this.searchQuery.toLowerCase())
  );
  
  this.drawMindMap();
}
```

#### TASK 3: Filter by Level
```html
<div class="level-filters">
  <button *ngFor="let level of [0, 1, 2, 3, 4]"
          [class.active]="visibleLevels.includes(level)"
          (click)="toggleLevel(level)">
    Level {{ level }}
  </button>
</div>
```

```typescript
visibleLevels: number[] = [0, 1, 2, 3, 4];

toggleLevel(level: number): void {
  const index = this.visibleLevels.indexOf(level);
  if (index >= 0) {
    this.visibleLevels.splice(index, 1);
  } else {
    this.visibleLevels.push(level);
  }
  this.drawMindMap();
}

// Dans drawMindMap(), skip nodes not in visibleLevels
this.mindMapNodes.forEach(node => {
  if (!this.visibleLevels.includes(node.level || 1)) return;
  // ... draw node
});
```

#### TASK 4: Node Editing (Optionnel)
```typescript
onCanvasDoubleClick(event: MouseEvent): void {
  const clickedNode = this.getNodeAtPosition(event);
  if (clickedNode) {
    const newText = prompt('Edit node text:', clickedNode.text);
    if (newText) {
      clickedNode.text = newText;
      this.drawMindMap();
      // Optionnel: Sync avec backend
      this.socketService.emitNodeUpdate(clickedNode.id, { label: newText });
    }
  }
}
```

---

## 📦 DÉPENDANCES À INSTALLER

```bash
# Pour PDF export
npm install jspdf --save

# Pour clipboard (déjà inclus dans navigator.clipboard)
# Rien à installer
```

---

## 🎯 PRIORITÉS

### Must Have (Phase 1 & 2):
1. ✅ Sprint 1 & 2 (déjà fait)
2. ⭐ Sprint 4 TASK 1: Chat Integration
3. ⭐ Sprint 4 TASK 5: Keyboard Shortcuts  
4. ⭐ Sprint 3 TASK 1: Export PNG
5. Sprint 3 TASK 2: Export PDF

### Nice to Have (Phase 3):
6. Sprint 4 TASK 2: Preview Component
7. Sprint 5 TASK 1: Zoom & Pan
8. Sprint 5 TASK 2: Search
9. Sprint 5 TASK 3: Filter by Level

### Optional:
10. Sprint 3 TASK 3: Share Link
11. Sprint 5 TASK 4: Node Editing
12. Sprint 5 TASK 5: Themes
13. Sprint 5 TASK 6: Analytics

---

## 📝 ORDRE D'EXÉCUTION

### Session 1 (1h): Sprint 4 - Chat Integration
1. Modifier `chat.component.ts` (inject Router + MindMapStateService)
2. Ajouter méthode `generateMindMapForMessage()`
3. Modifier `chat.component.html` (ajouter button)
4. Ajouter styles dans `chat.component.scss`
5. Test: Click button → Navigate to mind map

### Session 2 (30min): Sprint 4 - Shortcuts
1. Ajouter `@HostListener` dans chat.component
2. Implement Ctrl/Cmd+M shortcut
3. Test: Press Ctrl+M → Navigate to mind map

### Session 3 (1h): Sprint 3 - Export
1. Ajouter export PNG method
2. Installer jspdf
3. Ajouter export PDF method
4. Ajouter buttons dans template
5. Ajouter styles
6. Test: Export PNG → Download file
7. Test: Export PDF → Download file

### Session 4 (2h): Sprint 5 - Advanced
1. Zoom & Pan implementation
2. Search implementation
3. Filter by level implementation
4. Test all features

---

## ✅ CRITÈRES DE SUCCÈS

### Sprint 4 Complet:
- [ ] Button "Generate Mind Map" visible après messages
- [ ] Click button → Navigate to Mind Map tab
- [ ] Ctrl/Cmd+M → Generate Mind Map
- [ ] State sync entre Chat et Magic Studio

### Sprint 3 Complet:
- [ ] Export PNG fonctionne
- [ ] Export PDF fonctionne
- [ ] Files téléchargés avec bon format

### Sprint 5 Complet:
- [ ] Zoom in/out avec molette
- [ ] Pan avec drag
- [ ] Search trouve nodes
- [ ] Filter toggle levels
- [ ] Toutes features smooth

---

## 🚀 COMMANDES DE TEST

```bash
# Après chaque phase
ng serve
# Ouvrir: http://localhost:4200

# Test Sprint 4:
1. Chat → Send message
2. See "Generate Mind Map" button
3. Click → Mind Map opens
4. Press Ctrl+M → Mind Map opens

# Test Sprint 3:
1. Mind Map → Click Export PNG
2. File downloads
3. Click Export PDF
4. File downloads

# Test Sprint 5:
1. Mouse wheel → Zoom
2. Drag → Pan
3. Type search → Nodes highlight
4. Toggle levels → Nodes show/hide
```

---

## 📈 PROGRESSION CIBLE

```
Après Session 1:  ████████████████░░░░  60%
Après Session 2:  █████████████████░░░  65%
Après Session 3:  ██████████████████░░  75%
Après Session 4:  ████████████████████ 100% ✅
```

**Durée totale estimée:** 4-5 heures  
**Livrables:** 100% features complètes

🎯 **Let's complete everything!**
