# Mind Map Enhancement - NotebookLM Grade UX

## 📊 Vue d'Ensemble

Transformation complète de la fonctionnalité Mind Map pour atteindre le niveau d'expérience utilisateur de Google NotebookLM.

**Date:** 2025-10-10  
**Version:** 1.0  
**Status:** 🚧 En Développement

---

## 🎯 Objectifs Principaux

### 1. UX Visuelle Immersive
- Hiérarchie visuelle claire avec code couleur (3+ niveaux)
- Design épuré et minimaliste
- Animations fluides et transitions smooth
- Layout force-directed optimisé

### 2. Interactions Intelligentes
- Expand/collapse branches interactif
- Clic sur nœud → Modal chat contextuel
- Questions suggérées automatiques
- Navigation zoom/pan performante

### 3. Intégration Notebook
- Isolation complète par notebook
- Multi-document clustering
- Context propagation automatique

### 4. Export & Partage
- Export PNG haute qualité
- Export Markdown structuré
- Templates (rapport, présentation)
- Share URLs

---

## 🆚 Analyse Comparative

### Regalica Actuel vs NotebookLM

| Feature | NotebookLM | Regalica Actuel | Gap | Priorité |
|---------|------------|-----------------|-----|----------|
| **Hiérarchie 3 niveaux** | ✅ Violet/Bleu/Vert | ⚠️ 2 niveaux | +1 niveau | 🔴 HIGH |
| **Expand/Collapse** | ✅ Flèches interactives | ❌ Non implémenté | Feature complète | 🔴 HIGH |
| **Clic nœud → Chat** | ✅ Modal contextuel | ❌ Non implémenté | Modal + API | 🔴 HIGH |
| **Export PNG** | ✅ Haute qualité | ❌ Non implémenté | Canvas export | 🟡 MED |
| **Isolation Notebook** | ✅ Par workspace | ⚠️ Partiel | Integration | 🔴 HIGH |
| **Questions suggérées** | ✅ Auto-generated | ❌ Non implémenté | LLM templates | 🟡 MED |
| **Export Markdown** | ✅ Hiérarchique | ❌ Non implémenté | Template engine | 🟡 MED |

---

## 🎨 Design System

### Palette Couleurs (NotebookLM-Inspired)

```scss
$mindmap-colors: (
  // Niveau hiérarchique
  'level1-bg': #6B46C1,      // Violet (Concept central)
  'level1-text': #FFFFFF,
  'level1-border': #553C9A,
  
  'level2-bg': #3B82F6,      // Bleu (Branches principales)
  'level2-text': #FFFFFF,
  'level2-border': #2563EB,
  
  'level3-bg': #10B981,      // Vert (Détails)
  'level3-text': #FFFFFF,
  'level3-border': #059669,
  
  'level4-bg': #8B5CF6,      // Lavande (Sub-details)
  'level4-text': #FFFFFF,
  'level4-border': #7C3AED,
  
  // Edges & UI
  'edge-default': #E5E7EB,
  'edge-highlight': #6366F1,
  'bg-canvas': #FFFFFF,
  'text-meta': #6B7280
);
```

### Tailles Nodes

| Niveau | Width | Height | Font Size | Font Weight |
|--------|-------|--------|-----------|-------------|
| Level 1 | 200px | 80px | 18px | 600 |
| Level 2 | 160px | 60px | 14px | 500 |
| Level 3 | 140px | 50px | 12px | 400 |
| Level 4 | 120px | 45px | 11px | 400 |

### Animations

```scss
// Transitions
$transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
$transition-normal: 300ms cubic-bezier(0.4, 0, 0.2, 1);
$transition-slow: 500ms cubic-bezier(0.4, 0, 0.2, 1);

// Hover effects
.node:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

// Expand/collapse
.node.collapsed {
  opacity: 0.7;
}
```

---

## 📐 Architecture Technique

### Backend APIs

#### Nouveaux Endpoints

```javascript
// Mind Map pour Notebook
POST /api/studio/mindmap/notebook/:notebookId
Body: { query?, topK, lang, maxDepth }
Response: { nodes, edges, meta }

// Contexte Nœud
GET /api/studio/mindmap/:mapId/node/:nodeId/context
Response: { 
  summary, 
  citations, 
  suggestedQuestions,
  relatedChunks 
}

// Export
POST /api/studio/mindmap/:mapId/export
Body: { format: 'png'|'markdown'|'pdf', template? }
Response: Blob ou { content, filename }

// Annotations
PUT /api/studio/mindmap/:mapId/node/:nodeId/annotate
Body: { note, tags }
Response: { success, annotation }
```

#### Modifications Backend

**backend/src/studio/mindmap.js:**
```javascript
// Ajouter support notebookId
async function generateMindMap(params) {
  const { query, docId, notebookId, topK, lang, maxDepth } = params;
  
  if (notebookId) {
    // Get notebook documents only
    const notebookDocs = await getNotebookDocuments(notebookId);
    candidates = await retrieveFromDocuments(notebookDocs, query, topK);
  }
  
  // Hierarchical clustering (3+ levels)
  const hierarchy = await buildHierarchy(candidates, maxDepth || 3);
  
  return { nodes, edges, meta };
}

// Nouveau: Node context
async function getNodeContext(mapId, nodeId) {
  const node = await getNode(mapId, nodeId);
  const chunks = await getNodeChunks(node.chunkIds);
  
  // Generate summary
  const summary = await generateClusterSummary(chunks);
  
  // Suggested questions
  const questions = generateContextualQuestions(node, chunks);
  
  return { node, summary, citations, questions, chunks };
}
```

### Frontend Structure

```
frontend/src/app/studio/mindmap/
├── mindmap.component.ts              # Container
├── mindmap.component.html
├── mindmap.component.scss
│
├── components/
│   ├── mindmap-canvas/
│   │   ├── mindmap-canvas.component.ts    # D3.js visualization
│   │   ├── mindmap-canvas.component.html
│   │   └── mindmap-canvas.component.scss
│   │
│   ├── mindmap-node/
│   │   ├── mindmap-node.component.ts      # Individual node
│   │   └── mindmap-node.component.scss
│   │
│   ├── mindmap-modal/
│   │   ├── mindmap-modal.component.ts     # Context modal
│   │   ├── mindmap-modal.component.html
│   │   └── mindmap-modal.component.scss
│   │
│   └── mindmap-controls/
│       ├── mindmap-controls.component.ts  # Zoom/Export/Settings
│       └── mindmap-controls.component.html
│
├── services/
│   ├── mindmap.service.ts                 # API calls
│   ├── mindmap-layout.service.ts          # D3 force layout
│   ├── mindmap-export.service.ts          # Export handlers
│   └── mindmap-context.service.ts         # Node context
│
├── models/
│   ├── mindmap-node.model.ts
│   ├── mindmap-edge.model.ts
│   ├── mindmap-config.model.ts
│   └── mindmap-export.model.ts
│
└── styles/
    └── _mindmap-theme.scss                # Design system
```

---

## 🔄 4 Flux Utilisateurs

### Flux 1: Génération & Exploration 🗺️

**User Journey:**
```
1. Créer Notebook → Upload documents
2. Clic "Mind Map" button dans chat
3. Backend analyse → Clustering → Génération
4. Affichage hiérarchique (Violet → Bleu → Vert)
5. Zoom/Pan pour naviguer
6. Expand/Collapse branches (flèches)
7. Passage vue macro → vue détaillée
```

**Implémentation:**
- Button "Generate Mind Map" dans chat UI
- Loading indicator pendant génération
- Canvas full-screen avec contrôles
- Smooth zoom/pan (D3.js)
- Toggle branches avec animations

### Flux 2: Approfondissement Interactif 🤔

**User Journey:**
```
1. Mind Map générée et affichée
2. User
