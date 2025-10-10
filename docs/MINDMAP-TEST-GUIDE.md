# Mind Map Hierarchical Levels - Guide de Test

## 🎯 Objectif
Vérifier que les modifications TASK 1 & 2 fonctionnent correctement en local:
- Backend génère des nodes avec propriété `level` (1-4)
- Niveaux assignés par analyse de connectivité
- API retourne les levels dans la réponse

---

## 🚀 DÉMARRAGE RAPIDE

### Option 1: Script Automatique (Recommandé)

```powershell
# Dans le dossier racine du projet
.\test-mindmap-levels.ps1
```

Le script va:
- ✅ Vérifier tous les services
- ✅ Démarrer les services manquants
- ✅ Ouvrir le navigateur à http://localhost:4200
- ✅ Afficher les instructions de test

### Option 2: Démarrage Manuel

```powershell
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend  
cd frontend
npm start

# Terminal 3: PostgreSQL (si pas démarré)
# Démarrer via pgAdmin ou services Windows
```

---

## 📋 PROCÉDURE DE TEST

### Étape 1: Vérifier les Services

**Backend (Port 3000):**
```
✓ Backend logs: [Server] Listening on port 3000
```

**Frontend (Port 4200):**
```
✓ Browser: http://localhost:4200
✓ Page charge sans erreurs console
```

**PostgreSQL (Port 5432):**
```
✓ Backend logs: [DB] Connected to database
```

### Étape 2: Préparer les Données

**A. Créer ou Ouvrir un Notebook:**
```
1. Clic "Create Notebook" ou ouvrir existant
2. Uploader 2-3 documents (PDFs ou TXT)
3. Attendre que l'ingestion termine
```

**B. Générer du Contexte:**
```
1. Dans le chat, poser une question
2. Exemple: "Quels sont les concepts principaux?"
3. Attendre la réponse du chat
```

### Étape 3: Générer Mind Map

**A. Ouvrir Magic Studio:**
```
1. Clic sur bouton "Magic Studio" (icon ampoule)
2. Naviguer vers onglet "Mind Map"
3. Clic "Generate Mind Map"
```

**B. Observer les Logs Backend:**

**Dans le terminal backend, vous devriez voir:**

```bash
[MindMap] Generating mind map (query="...", notebookId="xxx", topK=100)
[MindMap] Notebook has 3 documents
[MindMap] Retrieved 100 chunks from notebook
[MindMap] Clustered into 8 clusters using HDBSCAN
[MindMap] Generated 8 nodes
[MindMap] Generated 15 edges
[MindMap] Assigned hierarchical levels: L1=1, L2=3, L3=3, L4=1  # ✅ IMPORTANT!
```

**Ligne clé:**
```
[MindMap] Assigned hierarchical levels: L1=1, L2=3, L3=3, L4=1
```

Cela confirme:
- ✅ 1 node Level 1 (Central)
- ✅ 3 nodes Level 2 (Branches)
- ✅ 3 nodes Level 3 (Details)
- ✅ 1 node Level 4 (Sub)

### Étape 4: Vérifier la Réponse API

**A. Ouvrir DevTools (F12):**
```
1. Onglet "Network"
2. Filtrer: XHR
3. Chercher: GET /api/studio/mindmap?notebookId=...
```

**B. Inspecter la Réponse:**

```json
{
  "nodes": [
    {
      "id": "node-0",
      "label": "Concept Principal",
      "summary": "...",
      "citations": [...],
      "clusterId": 0,
      "level": 1  // ✅ Central node
    },
    {
      "id": "node-1",
      "label": "Sous-thème A",
      "summary": "...",
      "citations": [...],
      "clusterId": 1,
      "level": 2  // ✅ Branch node
    },
    {
      "id": "node-2",
      "label": "Détail Technique",
      "summary": "...",
      "citations": [...],
      "clusterId": 2,
      "level": 3  // ✅ Detail node
    }
    // ... autres nodes
  ],
  "edges": [...],
  "meta": {
    "notebookId": "xxx",
    "chunksCount": 100,
    "nodesCount": 8,
    "edgesCount": 15,
    "processingTimeMs": 12345
  }
}
```

**Vérifications:**
- ✅ Chaque node a une propriété `level`
- ✅ Au moins 1 node avec `level: 1`
- ✅ Plusieurs nodes avec `level: 2`
- ✅ Distribution logique des levels

---

## ✅ CRITÈRES DE SUCCÈS

### Backend
- [x] Logs montrent "Assigned hierarchical levels: L1=X, L2=X, L3=X, L4=X"
- [x] Distribution des levels semble logique (pas tous level 2)
- [x] Pas d'erreurs dans les logs

### API Response
- [x] Chaque node contient `"level": number`
- [x] Levels entre 1 et 4 inclus
- [x] Au moins un node level 1 (central)

### Frontend
- [x] Pas d'erreurs console JavaScript
- [x] Mind Map se génère sans crash
- [x] Nodes visibles sur le canvas (même si pas encore colorés)

---

## 🐛 TROUBLESHOOTING

### Problème: "Backend logs ne montrent pas les levels"

**Solution:**
```bash
# Vérifier que le code est bien à jour
cd backend
git status
# Si modifications non sauvegardées, recharger le fichier
```

### Problème: "API Response ne contient pas level"

**Causes possibles:**
1. Backend pas redémarré après modifications
2. Cache navigateur

**Solutions:**
```bash
# Redémarrer backend
cd backend
npm run dev

# Vider cache navigateur
F12 → Network → "Disable cache" ✓
Ctrl+Shift+R (Hard Refresh)
```

### Problème: "Erreur HDBSCAN clustering"

**Cause:** Service Clusterer pas démarré

**Solution:**
```bash
# Option 1: Docker
cd deploy/docker
docker-compose up clusterer

# Option 2: Python direct
cd clusterer
pip install -r requirements.txt
python app.py
```

### Problème: "No documents in notebook"

**Cause:** Notebook vide ou documents
