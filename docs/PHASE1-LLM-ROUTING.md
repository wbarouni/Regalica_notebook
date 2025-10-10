# Phase 1: LLM Multi-Model Routing

## ✅ Implémentation Complète

La Phase 1 implémente un système de routing intelligent qui sélectionne automatiquement le meilleur modèle LLM parmi 3 options selon la complexité de la requête.

---

## 🎯 Modèles Disponibles

| Modèle | Type | Use Case | Performance |
|--------|------|----------|-------------|
| **tinyllama:1.1b-instruct-q4_k_m** | MICRO | Résumés ultra-courts (≤5 mots) | TTFB < 200ms |
| **qwen2.5:3b-instruct-q4_k_m** | FAST | Requêtes standard (80% des cas) | TTFB ~400ms |
| **qwen2:7b-instruct-q4_k_m** | DEEP | Analyses complexes, depth=high | TTFB ~800ms |

---

## 📝 Fichiers Modifiés

### Backend
```
✅ .env.example                     # Variables LLM_MODEL_FAST/DEEP/MICRO
✅ backend/src/config/index.js      # Configuration multi-modèles
✅ backend/src/rag/model-router.js  # Logique de sélection (nouveau)
✅ backend/src/rag/synthesize.js    # Utilisation pickModel()
✅ backend/src/rag/routes.js        # Support param depth
```

---

## 🔧 Configuration

### Variables d'environnement (.env)

```bash
# LLM Multi-model routing (Phase 1)
LLM_MODEL_FAST=qwen2.5:3b-instruct-q4_k_m
LLM_MODEL_DEEP=qwen2:7b-instruct-q4_k_m
LLM_MODEL_MICRO=tinyllama:1.1b-instruct-q4_k_m
OLLAMA_KEEP_ALIVE=3600

# Feature flag
ENABLE_MODEL_ROUTING=true
```

### Heuristiques de Sélection

Le système choisit automatiquement selon:

**MICRO** si:
- wordCount ≤ 5 ET docCount ≤ 2

**DEEP** si:
- `depth=high` (flag explicite) OU
- wordCount > 25 OU
- docCount ≥ 8 OU
- Mots-clés: pourquoi|comment|évaluer|risque|analyse|expliquer

**FAST** (défaut):
- Tous les autres cas

---

## 🚀 Utilisation

### API Standard (routing automatique)

```bash
curl -X POST http://localhost:5200/api/rag/answer \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Qu'est-ce que le RGPD?",
    "top_k": 8
  }'
```

Réponse contient `stats.model_used`:
```json
{
  "answer": "...",
  "stats": {
    "model_used": "qwen2.5:3b-instruct-q4_k_m"
  }
}
```

### Forcer modèle DEEP

```bash
curl -X POST http://localhost:5200/api/rag/answer \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Question normale",
    "top_k": 8,
    "depth": "high"
  }'
```

---

## 🧪 Tests Manuels

### Test 1: MICRO Model
```bash
curl -X POST http://localhost:5200/api/rag/answer \
  -d '{"query":"Qui?","top_k":2}' | jq '.stats.model_used'
# Attendu: "tinyllama:1.1b-instruct-q4_k_m"
```

### Test 2: FAST Model (défaut)
```bash
curl -X POST http://localhost:5200/api/rag/answer \
  -d '{"query":"Qu'est-ce que le RGPD?","top_k":8}' | jq '.stats.model_used'
# Attendu: "qwen2.5:3b-instruct-q4_k_m"
```

### Test 3: DEEP Model (complexe)
```bash
curl -X POST http://localhost:5200/api/rag/answer \
  -d '{"query":"Pourquoi le RGPD impose-t-il ces contraintes?","top_k":8}' | jq '.stats.model_used'
# Attendu: "qwen2:7b-instruct-q4_k_m"
```

### Test 4: DEEP Model (flag)
```bash
curl -X POST http://localhost:5200/api/rag/answer \
  -d '{"query":"Question","top_k":8,"depth":"high"}' | jq '.stats.model_used'
# Attendu: "qwen2:7b-instruct-q4_k_m"
```

---

## 📊 Vérification Logs

Les logs backend montrent la sélection:
```
[rag/synthesize] Model selected: qwen2.5:3b-instruct-q4_k_m
[model-router] FAST selected (default): words=5, docs=3
```

---

## 🔄 Rollback

### Option 1: Désactiver routing
```bash
# Dans .env
ENABLE_MODEL_ROUTING=false

# Restart
docker-compose restart backend
```

### Option 2: Rollback Git complet
```bash
git checkout HEAD -- backend/src/rag/model-router.js
git checkout HEAD -- backend/src/rag/synthesize.js
git checkout HEAD -- backend/src/rag/routes.js
git checkout HEAD -- backend/src/config/index.js
docker-compose restart backend
```

---

## 📈 Métriques Attendues

| Modèle | TTFB (p95) | Tokens/sec | RAM |
|--------|------------|------------|-----|
| MICRO  | < 200ms    | 80-120     | ~1GB |
| FAST   | 300-500ms  | 40-60      | ~2GB |
| DEEP   | 600-1000ms | 20-30      | ~4GB |

---

## 🐛 Troubleshooting

### Modèle non trouvé
```bash
# Pull manuellement
ollama pull qwen2.5:3b-instruct-q4_k_m
ollama pull qwen2:7b-instruct-q4_k_m
ollama pull tinyllama:1.1b-instruct-q4_k_m
```

### Keep-alive non actif
```bash
# Vérifier config Ollama
docker exec ollama env | grep KEEP_ALIVE
```

### Toujours même modèle
```bash
# Vérifier logs routing
docker logs backend | grep "model-router"
```

---

## ✅ Validation

Phase 1 est complète si:
- [x] Les 3 modèles sont configurés
- [x] `stats.model_used` change selon la requête
- [x] Flag `depth=high` force DEEP
- [x] Logs montrent la sélection
- [x] Performance conforme (TTFB)

---

## ➡️ Prochaines Étapes

- **Phase 2**: JSON Contraint + Zod validation
- **Phase 3**: Prompt Packs YAML
- **Phase 4**: Citations UX cliquables

---

*Date: 2025-10-09*  
*Version: 1.0*  
*Status: ✅ Production Ready*
