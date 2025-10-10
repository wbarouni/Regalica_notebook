# Mind Map AI Flow - Architecture Technique Complète

## 📊 Vue d'Ensemble du Flux AI

Ce document explique comment l'AI génère une Mind Map à partir des documents d'un notebook, en utilisant le système RAG existant.

---

## 🔄 FLUX COMPLET: De Notebook à Mind Map

```
┌─────────────────────────────────────────────────────────────┐
│                    USER ACTION                               │
│  User clique "Générer Mind Map" dans Notebook               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            STEP 1: RÉCUPÉRATION DOCUMENTS                    │
│  • Query notebook_documents table                            │
│  • Get document IDs for THIS notebook only                   │
│  • Isolation garantie par notebook_id                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            STEP 2: EXTRACTION CHUNKS                         │
│  • Query chunks table avec document_ids                      │
│  • Get top-K chunks (100 par défaut)                         │
│  • Include metadata: heading_path, page_no, document_title   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            STEP 3: AI CLUSTERING (HDBSCAN)                   │
│  • Convert chunks to embeddings (Embedder service)           │
│  • HDBSCAN algorithm finds natural groups                    │
│  • Produces cluster labels [0,0,1,1,2,2,...]                │
│  • -1 = noise (excluded from mind map)                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            STEP 4: HIERARCHICAL ORGANIZATION                 │
│  • Level 1 (Central): Identify most connected cluster        │
│  • Level 2 (Branches): Main clusters (5-8)                   │
│  • Level 3 (Details): Sub-clusters within each branch        │
│  • Level 4 (Optional): Fine-grained sub-topics              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            STEP 5: LLM SUMMARIZATION                         │
│  • For each cluster → Generate summary (LLM)                 │
│  • Extract key concept as node label                         │
│  • Identify citations from cluster chunks                    │
│  • Use Ollama with qwen2.5:3b model                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            STEP 6: GRAPH CONSTRUCTION                        │
│  • Create nodes from clusters (with labels, summaries)       │
│  • Calculate edges based on inter-cluster similarity         │
│  • Assign colors based on hierarchy level                    │
│  • Prepare metadata (source counts, quality scores)          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            STEP 7: FRONTEND VISUALIZATION                    │
│  • D3.js force-directed layout                               │
│  • Apply color scheme (Violet/Blue/Green/Lavender)          │
│  • Render interactive nodes with expand/collapse            │
│  • Enable zoom/pan navigation                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 DÉTAILS TECHNIQUES PAR ÉTAPE

### STEP 1: Récupération Documents

**Code Backend:**
```javascript
// backend/src/studio/mindmap.js

async function getNotebookDocuments(notebookId) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT document_id 
      FROM ${config.dbSchema}.notebook_documents 
      WHERE notebook_id = $1
    `, [notebookId]);
    
    return result.rows.map(r => r.document_id);
  } finally {
    client.release();
  }
}
```

**Exemple Output:**
```javascript
documentIds = [
  "550e8400-e29b-41d4-a716-446655440000",
  "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "7c9e6679-7425-40de-944b-e07fc1f90ae7"
]
```

---

### STEP 2: Extraction Chunks

**Code Backend:**
```javascript
async function getAllChunksFromDocuments(documentIds, topK = 100) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        c.id as chunk_id,
        c.document_id,
        c.text,
        c.tokens,
        c.heading_path,
        c.page_no,
        c.span_start,
        c.span_end,
        d.title as document_title
      FROM ${config.dbSchema}.chunks c
      JOIN ${config.dbSchema}.documents d ON c.document_id = d.id
      WHERE c.document_id = ANY($1::uuid[])
      ORDER BY c.seq
      LIMIT $2
    `, [documentIds, topK]);
    
    return result.rows;
  } finally {
    client.release();
  }
}
```

**Exemple Output:**
```javascript
chunks = [
  {
    chunk_id: "chunk-1-uuid",
    document_id: "doc-1-uuid",
    text: "Le cadre réglementaire tunisien des changes repose sur la Loi n°76-18...",
    tokens: 245,
    heading_path: "Cadre Juridique Général",
    page_no: 5,
    document_title: "Réglementation Changes 2024.pdf"
  },
  {
    chunk_id: "chunk-2-uuid",
    document_id: "doc-1-uuid",
    text: "Les opérations de change avec l'étranger sont soumises à autorisation...",
    tokens: 198,
    heading_path: "Opérations de Change",
    page_no: 12,
    document_title: "Réglementation Changes 2024.pdf"
  },
  // ... 98 autres chunks
]
```

---

### STEP 3: AI Clustering (HDBSCAN)

**Flow détaillé:**

#### A. Préparation
```javascript
// Extract texts for clustering
const texts = chunks.map(c => c.text);
```

#### B. Appel Clusterer Service
```javascript
const clusterResult = await axios.post(
  `${config.clustererApiUrl}/cluster`,
  {
    texts: texts,
    min_cluster_size: 5,
    min_samples: 5,
    metric: 'cosine'
  },
  { timeout: 30000 }
);
```

#### C. Algorithme Python (HDBSCAN)
```python
# clusterer/hdbscan_clusterer.py

from sentence_transformers import SentenceTransformer
import hdbscan
import numpy as np

def cluster_texts(texts, min_cluster_size=5):
    # 1. Generate embeddings
    model = SentenceTransformer('all-MiniLM-L6-v2')
    embeddings = model.encode(texts)
    # Shape: (100, 384) → 100 texts, 384 dimensions
    
    # 2. HDBSCAN clustering
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=5,
        metric='euclidean',
        cluster_selection_method='eom'
    )
    
    # 3. Fit and predict
    cluster_labels = clusterer.fit_predict(embeddings)
    
    # 4. Calculate quality metrics
    from sklearn.metrics import silhouette_score
    if len(set(cluster_labels)) > 1:
        score = silhouette_score(embeddings, cluster_labels)
    else:
        score = 0
    
    # 5. Generate labels using TF-IDF
    labels = generate_cluster_labels(texts, cluster_labels)
    
    return {
        'clusters': cluster_labels.tolist(),
        'n_clusters': len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0),
        'labels': labels,
        'silhouette_score': float(score),
        'method': 'HDBSCAN'
    }

def generate_cluster_labels(texts, cluster_labels):
    from sklearn.feature_extraction.text import TfidfVectorizer
    
    labels = {}
    unique_clusters = set(cluster_labels)
    
    for cluster_id in unique_clusters:
        if cluster_id == -1:
            continue
            
        # Get texts for this cluster
        cluster_texts = [texts[i] for i, label in enumerate(cluster_labels) if label == cluster_id]
        
        # TF-IDF to find key terms
        vectorizer = TfidfVectorizer(max_features=3, stop_words='french')
        try:
            tfidf = vectorizer.fit_transform(cluster_texts)
            terms = vectorizer.get_feature_names_out()
            labels[cluster_id] = ' '.join(terms).title()
        except:
            labels[cluster_id] = f"Cluster {cluster_id}"
    
    return labels
```

**Exemple Output:**
```javascript
clusterResult = {
  clusters: [0, 0, 1, 1, 1, 2, 2, 0, -1, 3, 3, 2, 1, ...],
  n_clusters: 8,
  labels: {
    0: "Cadre Juridique Général",
    1: "Opérations Change Étranger",
    2: "Investissements",
    3: "Reporting BCT",
    4: "Services Clients",
    5: "Dispositions Contrôle",
    6: "Gestion Risques",
    7: "Autres Sujets"
  },
  silhouette_score: 0.68,
  method: "HDBSCAN"
}
```

---

### STEP 4: Organisation Hiérarchique

**Code Backend:**
```javascript
async function buildHierarchy(chunks, clusterResult, maxDepth = 3) {
  const hierarchy = {
    levels: [],
    central: null
  };
  
  // Group chunks by cluster
  const clusterChunks = new Map();
  chunks.forEach((chunk, index) => {
    const clusterId = clusterResult.clusters[index];
    if (clusterId === -1) return; // Skip noise
    
    if (!clusterChunks.has(clusterId)) {
      clusterChunks.set(clusterId, []);
    }
    clusterChunks.get(clusterId).push(chunk);
  });
  
  // Level 1: Identify central concept (most connected)
  const connectivity = calculateConnectivity(clusterChunks);
  const centralClusterId = getMostConnected(connectivity);
  hierarchy.central = {
    level: 1,
    clusterId: centralClusterId,
    label: clusterResult.labels[centralClusterId],
    chunks: clusterChunks.get(centralClusterId)
  };
  
  // Level 2: Main branches
  const level2Clusters = Array.from(clusterChunks.keys())
    .filter(id => id !== centralClusterId)
    .sort((a, b) => clusterChunks.get(b).length - clusterChunks.get(a).length)
    .slice(0, 7); // Max 7 branches
  
  hierarchy.levels.push({
    level: 2,
    clusters: level2Clusters.map(id => ({
      clusterId: id,
      label: clusterResult.labels[id],
      chunks: clusterChunks.get(id),
      parentId: centralClusterId
    }))
  });
  
  // Level 3: Sub-clusters (if depth >= 3)
  if (maxDepth >= 3) {
    for (const level2Cluster of level2Clusters) {
      const subChunks = clusterChunks.get(level2Cluster);
      
      if (subChunks.length > 10) {
        // Re-cluster this branch
        const subClusterResult = await clusterTexts(
          subChunks.map(c => c.text),
          { min_cluster_size: 3 }
        );
        
        hierarchy.levels.push({
          level: 3,
          parentId: level2Cluster,
          clusters: buildSubClusters(subChunks, subClusterResult, level2Cluster)
        });
      }
    }
  }
  
  return hierarchy;
}

function calculateConnectivity(clusterChunks) {
  const connectivity = new Map();
  
  for (const [clusterId, chunks] of clusterChunks.entries()) {
    // Count shared terms with other clusters
    let connections = 0;
    const clusterTerms = extractTerms(chunks);
    
    for (const [otherId, otherChunks] of clusterChunks.entries()) {
      if (otherId === clusterId) continue;
      
      const otherTerms = extractTerms(otherChunks);
      const shared = intersection(clusterTerms, otherTerms);
      connections += shared.size;
    }
    
    connectivity.set(clusterId, connections);
  }
  
  return connectivity;
}
```

---

### STEP 5: LLM Summarization

**Code Backend:**
```javascript
async function generateClusterSummary(chunks, lang = 'fr') {
  // Concatenate chunk texts
  const context = chunks
    .map(c => c.text)
    .join('\n\n')
    .substring(0, 2000); // Limit context
  
  // Build prompt
  const prompt = lang === 'fr'
    ? `Résume ce groupe de textes en UN SEUL concept clé (maximum 5 mots).\n\nTextes:\n${context}\n\nConcept clé:`
    : `Summarize this group of texts into ONE key concept (maximum 5 words).\n\nTexts:\n${context}\n\nKey concept:`;
  
  // Call LLM (Ollama)
  const response = await axios.post(
    `${config.llmApiUrl}/api/generate`,
    {
      model: config.llmModelName || 'qwen2.5:3b-instruct-q4_k_m',
      prompt,
      temperature: 0.2,
      num_predict: 50,
      stop: ['\n\n']
    },
    { timeout: 30000 }
  );
  
  const summary = response.data.response.trim();
  
  // Extract citations
  const citations = chunks.slice(0, 3).map(chunk => ({
    docId: chunk.document_id,
    docTitle: chunk.document_title,
    page: chunk.page_no,
    spanStart: chunk.span_start,
    spanEnd: chunk.span_end,
    text: chunk.text.substring(0, 150)
  }));
  
  return { summary, citations };
}
```

**Exemple LLM Call:**
```
Prompt: "Résume ce groupe de textes en UN SEUL concept clé...

Textes:
Le cadre réglementaire tunisien des changes...
Les opérations de change avec l'étranger...
..."

LLM Response: "Cadre Juridique Général"
```

---

### STEP 6: Construction du Graph

**Code Backend:**
```javascript
async function buildGraph(hierarchy, clusterResult) {
  const nodes = [];
  const edges = [];
  
  // Central node (Level 1)
  const { summary, citations } = await generateClusterSummary(
    hierarchy.central.chunks
  );
  
  nodes.push({
    id: `node-${hierarchy.central.clusterId}`,
    label: summary || hierarchy.central.label,
    level: 1,
    summary,
    citations,
    clusterId: hierarchy.central.clusterId,
    chunkIds: hierarchy.central.chunks.map(c => c.chunk_id),
    collapsed: false,
    visible: true
  });
  
  // Level 2+ nodes
  for (const levelData of hierarchy.levels) {
    for (const cluster of levelData.clusters) {
      const { summary, citations } = await generateClusterSummary(
        cluster.chunks
      );
      
      const nodeId = `node-${cluster.clusterId}`;
      
      nodes.push({
        id: nodeId,
        label: summary || cluster.label,
        level: levelData.level,
        summary,
        citations,
        clusterId: cluster.clusterId,
        chunkIds: cluster.chunks.map(c => c.chunk_id),
        parentId: cluster.parentId ? `node-${cluster.parentId}` : null,
        collapsed: false,
        visible: true
      });
      
      // Add edge to parent
      if (cluster.parentId) {
        edges.push({
          source: `node-${cluster.parentId}`,
          target: nodeId,
          weight: calculateSimilarity(
            hierarchy.central.chunks,
            cluster.chunks
          )
        });
      }
    }
  }
  
  // Calculate inter-node edges (same level)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[i].level === nodes[j].level && nodes[i].level > 1) {
        const similarity = calculateNodeSimilarity(nodes[i], nodes[j]);
        if (similarity > 0.15) {
          edges.push({
            source: nodes[i].id,
            target: nodes[j].id,
            weight: similarity,
            visible: true
          });
        }
      }
    }
  }
  
  return { nodes, edges };
}
```

---

### STEP 7: Frontend Visualization

**TypeScript Frontend:**
```typescript
// D3.js Force Layout
createVisualization(data: MindMapData) {
  const simulation = d3.forceSimulation(data.nodes)
    .force('link', d3.forceLink(data.edges)
      .id((d: any) => d.id)
      .distance(d => this.calculateDistance(d))
    )
    .force('charge', d3.forceManyBody()
      .strength(d => d.level === 1 ? -500 : -200)
    )
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide()
      .radius(d => this.getNodeSize(d.level) + 20)
    )
    .force('radial', d3.forceRadial(
      d => d.level * 150,
      width / 2,
      height / 2
    ).strength(0.5));
  
  // Render nodes with colors
  const nodeElements = svg.selectAll('.node')
    .data(data.nodes)
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('data-level', d => d.level)
    .style('fill', d => this.getNodeColor(d.level))
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended)
    )
    .on('click', (event, d) => this.onNodeClick(d));
  
  // Render edges
  const edgeElements = svg.selectAll('.edge')
    .data(data.edges)
    .enter()
    .append('line')
    .attr('class', 'edge')
    .style('stroke', '#E5E7EB')
    .style('stroke-width', d => d.weight * 2);
  
  // Update positions on tick
  simulation.on('tick', () => {
    edgeElements
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);
    
    nodeElements
      .attr('transform', d => `translate(${d.x},${d.y})`);
  });
}

getNodeColor(level: number): string {
  const colors = {
    1: '#6B46C1',  // Violet
    2: '#3B82F6',  // Bleu
    3: '#10B981',  // Vert
    4: '#8B5CF6'   // Lavande
  };
  return colors[level] || '#9CA3AF';
}
```

---

## 🔗 CONNEXION AU SYSTÈME RAG EXISTANT

### Services Utilisés

1. **Embedder Service** (Port 8000)
   - Génère embeddings pour clustering
   - Modèle: `all-MiniLM-L6-v2`
   - Utilisé par Clusterer

2. **Clusterer Service** (Port 8002)
   - HDBSCAN clustering
   - TF-IDF label generation
   - Python/FastAPI

3. **Ollama LLM** (Port 11434)
   - Génère summaries des clusters
   - Modèle: `qwen2.5:3b-instruct-q4_k_m`
   - Utilisé pour labels et descriptions

4. **PostgreSQL + pgvector** (Port 5432)
   - Stocke documents/chunks
   - Table `notebook_documents` pour isolation
   - Table `mindmaps` pour cache

---

## 📊 EXEMPLE COMPLET

### Input
```
Notebook: "Réglementation Tunisienne"
Documents: 3 PDFs (127 pages total)
Chunks: 100 chunks extraits
```

### Process
```
1. Query chunks → 100 chunks from notebook docs
2. HDBSCAN → 8 clusters trouvés
3. LLM summaries → 8 labels générés
4. Hierarchy → 1 central + 7 branches + 15 sub-nodes
5. Graph → 23 nodes, 34 edges
```

### Output Mind Map
```
🟣 Réglementation des Changes 2024 (Central - Level 1)
   ├── 🔵 Cadre Juridique Général (Branch - Level 2)
   │   ├── 🟢 Loi n°76-18 (Detail - Level 3)
   │   ├── 🟢 Code Investissements
   │   └── 🟢 Code Hydrocarbures
   │
   ├── 🔵 Opérations Change Étranger (Branch - Level 2)
   │   ├── 🟢 Sociétés Commerce International
   │   └── 🟢 Code Relatif
   │
   ├── 🔵 Investissements (Branch - Level 2)
   │   ├── 🟢 Décret n°77-608
   │   └── 🟢 Loi n°2016-35
   │
   └── ... (4 autres branches)
```

---

## ⚡ PERFORMANCE

### Temps de Génération
```
Récupération chunks:     100-200ms
Clustering HDBSCAN:      2-4s
LLM Summaries (8 nodes): 5-8s
Graph construction:      300-500ms
──────────────────────────────────
TOTAL:                   8-13s
```

### Optimisations
- Cache embeddings déjà calculés
- Batch LLM calls (parallel)
- Limit topK à 100 chunks
- Pre-compute si possible

---

## 🎯 MÉTRIQUES QUALITÉ

### Silhouette Score
```
> 0.7  : Excellent clustering
0.5-0.7: Bon clustering
0.3-0.5: Acceptable
< 0.3  : Faible (re-cluster avec params différents)
```

### Node Count
```
Optimal: 15-25 nodes total
Minimum: 5 nodes
Maximum: 40 nodes
```

### Depth
```
Level 1: 1 node (central)
Level 2: 5-8 nodes (branches)
Level 3: 8-15 nodes (details)
Level 4: 0-10 nodes (optional)
```

---

**Prochaine étape:** Implémentation Sprint 1 avec cette architecture! 🚀
