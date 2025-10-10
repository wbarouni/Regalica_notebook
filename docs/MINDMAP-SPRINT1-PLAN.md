# Mind Map Sprint 1: UX Foundation

## 🎯 Objectif
Améliorer la visualisation Mind Map avec hiérarchie visuelle NotebookLM-grade (code couleur, niveaux, layout optimisé).

**Durée:** 2 semaines  
**Effort:** 80h  
**Status:** 🚀 EN COURS

---

## ✅ ACQUIS (Phase 0 - Isolation)

### Backend
- [x] Support notebookId parameter
- [x] getNotebookDocuments() + getAllChunksFromDocuments()
- [x] Routes API fonctionnelles
- [x] Isolation BDD garantie

### Frontend  
- [x] NotebookContextService integration
- [x] Dynamic context propagation
- [x] Zero hardcoding
- [x] TypeScript interfaces

### AI Pipeline
- [x] HDBSCAN clustering connecté
- [x] LLM summaries fonctionnel
- [x] Performance 8-13s acceptable

---

## 🎨 SPRINT 1: Hiérarchie Visuelle

### Objectifs Spécifiques

**1. Code Couleur par Niveau**
```
🟣 Level 1 (Central):  #6B46C1 Violet
🔵 Level 2 (Branches): #3B82F6 Bleu  
🟢 Level 3 (Details):  #10B981 Vert
🟣 Level 4 (Sub):      #8B5CF6 Lavande
```

**2. Tailles Progressives**
```
Level 1: 200×80px, font 18px, weight 600
Level 2: 160×60px, font 14px, weight 500
Level 3: 140×50px, font 12px, weight 400
Level 4: 120×45px, font 11px, weight 400
```

**3. Layout Force-Directed Amélioré**
- Radial force par niveau
- Collision radius adaptatif
- Charge strength par niveau
- Smooth animations

---

## 📝 TASKS DÉTAILLÉES

### TASK 1: Backend - Hierarchical Levels

**Fichier:** `backend/src/studio/mindmap.js`

**Objectif:** Ajouter niveau hiérarchique aux nodes

**Code à implémenter:**
```javascript
// Identifier concept central (most connected)
function identifyCentralConcept(clusterChunks) {
  const connectivity = new Map();
  
  for (const [clusterId, chunks] of clusterChunks.entries()) {
    let connections = 0;
    const terms = extractTerms(chunks);
    
    for (const [otherId, otherChunks] of clusterChunks.entries()) {
      if (otherId === clusterId) continue;
      const otherTerms = extractTerms(otherChunks);
      connections += intersection(terms, otherTerms).size;
    }
    
    connectivity.set(clusterId, connections);
  }
  
  // Most connected = central
  const central = [...connectivity.entries()]
    .sort((a, b) => b[1] - a[1])[0][0];
  
  return central;
}

// Assigner levels hiérarchiques
function assignHierarchicalLevels(nodes, edges) {
  // Level 1: Central node (most connected)
  const centralNodeId = identifyCentralConcept(nodes);
  nodes.find(n => n.id === centralNodeId).level = 1;
  
  // Level 2: Direct neighbors of central
  const level2 = edges
    .filter(e => e.source === centralNodeId || e.target === centralNodeId)
    .map(e => e.source === centralNodeId ? e.target : e.source);
  
  level2.forEach(nodeId => {
    const node = nodes.find(n => n.id === nodeId);
    if (node && !node.level) node.level = 2;
  });
  
  // Level 3: Neighbors of level 2
  level2.forEach(l2NodeId => {
    const neighbors = edges
      .filter(e => e.source === l2NodeId || e.target === l2NodeId)
      .map(e => e.source === l2NodeId ? e.target : e.source);
    
    neighbors.forEach(nodeId => {
      const node = nodes.find(n => n.id === nodeId);
      if (node && !node.level) node.level = 3;
    });
  });
  
  // Level 4: Remaining nodes
  nodes.forEach(node => {
    if (!node.level) node.level = 4;
  });
  
  return nodes;
}
```

**Modifications:**
```javascript
// Dans generateMindMap(), après construction nodes:
nodes = assignHierarchicalLevels(nodes, edges);

// Ajouter level dans node data:
nodes.push({
  id: `node-${clusterId}`,
  label,
  summary,
  citations,
  clusterId,
  chunkIds: chunks.map(c => c.chunk_id),
  level: node.level || 2  // Default level 2
});
```

---

### TASK 2: Frontend - Design System SCSS

**Fichier:** `frontend/src/app/layout/magic-studio/magic-studio.component.scss`

**Objectif:** Créer design tokens NotebookLM

**Code à implémenter:**
```scss
// Mind Map Design Tokens (NotebookLM-inspired)
$mindmap-colors: (
  'level1-bg': #6B46C1,
  'level1-text': #FFFFFF,
  'level1-border': #553C9A,
  'level1-shadow': rgba(107, 70, 193, 0.2),
  
  'level2-bg': #3B82F6,
  'level2-text': #FFFFFF,
  'level2-border': #2563EB,
  'level2-shadow': rgba(59, 130, 246, 0.2),
  
  'level3-bg': #10B981,
  'level3-text': #FFFFFF,
  'level3-border': #059669,
  'level3-shadow': rgba(16, 185, 129, 0.2),
  
  'level4-bg': #8B5CF6,
  'level4-text': #FFFFFF,
  'level4-border': #7C3AED,
  'level4-shadow': rgba(139, 92, 246, 0.2),
  
  'edge-default': #E5E7EB,
  'edge-highlight': #6366F1,
  'bg-canvas': #FFFFFF
);

// Node sizes
$node-sizes: (
  'level1': (width: 200px, height: 80px, fontSize: 18px, fontWeight: 600),
  'level2': (width: 160px, height: 60px, fontSize: 14px, fontWeight: 500),
  'level3': (width: 140px, height: 50px, fontSize: 12px, fontWeight: 400),
  'level4': (width: 120px, height: 45px, fontSize: 11px, fontWeight: 400)
);

// Transitions
$transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
$transition-normal: 300ms cubic-bezier(0.4, 0, 0.2, 1);
$transition-slow: 500ms cubic-bezier(0.4, 0, 0.2, 1);

// Mind Map Node Styles
.mindmap-node {
  border-radius: 8px;
  transition: all $transition-normal;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 12px 16px;
  
  &:hover {
    transform: translateY(-2px);
    filter: brightness(1.1);
  }
  
  // Level-specific styles
  &--level1 {
    background: map-get($mindmap-colors, 'level1-bg');
    color: map-get($mindmap-colors, 'level1-text');
    border: 2px solid map-get($mindmap-colors, 'level1-border');
    box-shadow: 0 4px 12px map-get($mindmap-colors, 'level1-shadow');
    width: map-get(map-get($node-sizes, 'level1'), width);
    height: map-get(map-get($node-sizes, 'level1'), height);
    font-size: map-get(map-get($node-sizes, 'level1'), fontSize);
    font-weight: map-get(map-get($node-sizes, 'level1'), fontWeight);
  }
  
  &--level2 {
    background: map-get($mindmap-colors, 'level2-bg');
    color: map-get($mindmap-colors, 'level2-text');
    border: 2px solid map-get($mindmap-colors, 'level2-border');
    box-shadow: 0 2px 8px map-get($mindmap-colors, 'level2-shadow');
    width: map-get(map-get($node-sizes, 'level2'), width);
    height: map-get(map-get($node-sizes, 'level2'), height);
    font-size: map-get(map-get($node-sizes, 'level2'), fontSize);
    font-weight: map-get(map-get($node-sizes, 'level2'), fontWeight);
  }
  
  &--level3 {
    background: map-get($mindmap-colors, 'level3-bg');
    color: map-get($mindmap-colors, 'level3-text');
    border: 2px solid map-get($mindmap-colors, 'level3-border');
    box-shadow: 0 2px 6px map-get($mindmap-colors, 'level3-shadow');
    width: map-get(map-get($node-sizes, 'level3'), width);
    height: map-get(map-get($node-sizes, 'level3'), height);
    font-size: map-get(map-get($node-sizes, 'level3'), fontSize);
    font-weight: map-get(map-get($node-sizes, 'level3'), fontWeight);
  }
  
  &--level4 {
    background: map-get($mindmap-colors, 'level4-bg');
    color: map-get($mindmap-colors, 'level4-text');
    border: 2px solid map-get($mindmap-colors, 'level4-border');
    box-shadow: 0 2px 4px map-get($mindmap-colors, 'level4-shadow');
    width: map-get(map-get($node-sizes, 'level4'), width);
    height: map-get(map-get($node-sizes, 'level4'), height);
    font-size: map-get(map-get($node-sizes, 'level4'), fontSize);
    font-weight: map-get(map-get($node-sizes, 'level4'), fontWeight);
  }
}

// Edge styles
.mindmap-edge {
  stroke: map-get($mindmap-colors, 'edge-default');
  stroke-width: 2px;
  fill: none;
  transition: stroke $transition-fast;
  
  &:hover,
  &--highlighted {
    stroke: map-get($mindmap-colors, 'edge-highlight');
    stroke-width: 3px;
  }
}
```

---

### TASK 3: Frontend - D3.js Enhanced Layout

**Fichier:** `frontend/src/app/layout/magic-studio/magic-studio.component.ts`

**Objectif:** Layout force-directed optimisé avec radial force

**Code à modifier:**
```typescript
private layoutMindMap(): void {
  const width = this.canvas?.width || 800;
  const height = this.canvas?.height || 600;
  
  // Force simulation avec radial force par niveau
  const simulation = d3.forceSimulation(this.mindMapNodes)
    .force('link', d3.forceLink(this.mindMapConnections)
      .id((d: any) => d.id)
      .distance((d: any) => {
        const sourceLevel = d.source.level || 2;
        const targetLevel = d.target.level || 2;
        return 80 + Math.abs(sourceLevel - targetLevel) * 30;
      })
    )
    .force('charge', d3.forceManyBody()
      .strength((d: any) => {
        // Stronger force for central nodes
        return d.level === 1 ? -500 : (d.level === 2 ? -300 : -200);
      })
    )
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide()
      .radius((d: any) => {
        const sizes = { 1: 100, 2: 80, 3: 70, 4: 60 };
        return (sizes[d.level] || 60) + 20;
      })
    )
    .force('radial', d3.forceRadial(
      (d: any) => d.level * 120,  // Distance from center by level
      width / 2,
      height / 2
    ).strength(0.5));
  
  // Iterate simulation
  for (let i = 0; i < 300; i++) {
    simulation.tick();
  }
  
  simulation.stop();
  this.drawMindMap();
}
```

---

### TASK 4: Frontend - Enhanced Drawing

**Code à modifier dans drawMindMap():**
```typescript
private drawMindMap(): void {
  if (!this.canvas || !this.ctx) return;

  this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

  const centerX = this.canvas.width / 2;
  const centerY = this.canvas.height / 2;

  // Draw edges
  this.mindMapConnections.forEach(conn => {
    const fromNode = this.mindMapNodes.find(n => n.id === conn.from);
    const toNode = this.mindMapNodes.find(n => n.id === conn.to);

    if (fromNode && toNode) {
      this.ctx!.beginPath();
      this.ctx!.moveTo(fromNode.x + centerX, fromNode.y + centerY);
      this.ctx!.lineTo(toNode.x + centerX, toNode.y + centerY);
      this.ctx!.strokeStyle = '#E5E7EB';
      this.ctx!.lineWidth = 2;
      this.ctx!.stroke();
    }
  });

  // Draw nodes with level-based styling
  this.mindMapNodes.forEach(node => {
    const x = node.x + centerX;
    const y = node.y + centerY;
    
    // Color by level
    const colors = {
      1: { bg: '#6B46C1', border: '#553C9A', text: '#FFFFFF' },
      2: { bg: '#3B82F6', border: '#2563EB', text: '#FFFFFF' },
      3: { bg: '#10B981', border: '#059669', text: '#FFFFFF' },
      4: { bg: '#8B5CF6', border: '#7C3AED', text: '#FFFFFF' }
    };
    
    const color = colors[node.level as keyof typeof colors] || colors[2];
    
    // Size by level
    const sizes = {
      1: { w: 100, h: 40, fontSize: 18 },
      2: { w: 80, h: 30, fontSize: 14 },
      3: { w: 70, h: 25, fontSize: 12 },
      4: { w: 60, h: 22, fontSize: 11 }
    };
    
    const size = sizes[node.level as keyof typeof sizes] || sizes[2];
    
    // Draw rounded rectangle
    this.ctx!.fillStyle = color.bg;
    this.ctx!.strokeStyle = color.border;
    this.ctx!.lineWidth = 2;
    
    this.roundRect(x - size.w/2, y - size.h/2, size.w, size.h, 8);
    this.ctx!.fill();
    this.ctx!.stroke();
    
    // Draw text
    this.ctx!.font = `${size.fontSize}px Arial`;
    this.ctx!.fillStyle = color.text;
    this.ctx!.textAlign = 'center';
    this.ctx!.textBaseline = 'middle';
    
    // Truncate text if too long
    let text = node.text;
    if (text.length > 15) {
      text = text.substring(0, 12) + '...';
    }
    
    this.ctx!.fillText(text, x, y);
  });
}

// Helper for rounded rectangles
private roundRect(x: number, y: number, w: number, h: number, r: number): void {
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
}
```

---

## 📊 RÉSULTAT ATTENDU

### Avant (Actuel)
```
- Tous nodes mêm
