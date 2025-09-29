# Guide de Déploiement Regalica Notebook

## Configurations Disponibles

### 1. Développement Local (Docker Compose)

**Fichier :** `deploy/docker/docker-compose.yml`

**Fonctionnalités complètes :**
- ✅ Backend Express.js
- ✅ Microservice Embedder (Python + sentence-transformers)
- ✅ Microservice Reranker (Python + BGE-reranker-v2-m3)
- ✅ Frontend Angular 17
- ✅ PostgreSQL + pgvector
- ✅ Redis
- ✅ Ollama LLM

**Commandes :**
```bash
# Démarrer tous les services
make up

# Première installation
./scripts/first-run.sh

# Tests
make check
```

### 2. Déploiement Cloud Render (Version Complète)

**Fichier :** `render.yaml`

**Fonctionnalités :**
- ✅ Backend Express.js
- ✅ Microservice Embedder
- ✅ Microservice Reranker  
- ✅ Frontend Angular 17
- ✅ PostgreSQL

**Limitations :**
- ⚠️ Nécessite un plan payant pour les microservices Python
- ⚠️ Ressources importantes requises

### 3. Déploiement Cloud Render (Version Allégée)

**Fichier :** `render-cloud.yaml`

**Fonctionnalités :**
- ✅ Backend Express.js (mode simulation)
- ✅ Frontend Angular 17
- ✅ PostgreSQL
- ⚠️ Embeddings simulés
- ⚠️ RAG simulé

**Avantages :**
- ✅ Compatible plan gratuit Render
- ✅ Déploiement rapide
- ✅ Interface utilisateur complète

## Instructions de Déploiement Render

### Option A : Version Complète (Plan Payant)

1. Connecter le repository GitHub à Render
2. Utiliser le fichier `render.yaml`
3. Configurer les variables d'environnement
4. Déployer

### Option B : Version Allégée (Plan Gratuit)

1. Dans Render Dashboard, créer un nouveau service
2. Connecter le repository GitHub
3. **Important :** Renommer `render-cloud.yaml` en `render.yaml`
4. Déployer

**Commande pour basculer :**
```bash
# Sauvegarder la version complète
mv render.yaml render-full.yaml

# Utiliser la version cloud
mv render-cloud.yaml render.yaml

# Committer
git add . && git commit -m "deploy: use cloud configuration for Render"
```

## Variables d'Environnement

### Mode Développement Local
Toutes les variables dans `.env.example` sont utilisées.

### Mode Cloud Simulation
Les microservices sont remplacés par des simulations :
- `EMBED_API_URL=simulation`
- `RERANKER_API_URL=simulation`
- `LLM_API_URL=simulation`

## Troubleshooting

### Erreur "Exited with status 1"
- Vérifier que les dépendances npm sont correctes
- Utiliser `npm ci --legacy-peer-deps`
- Réduire la taille des uploads (`MAX_UPLOAD_MB=10`)

### Erreur TypeScript
- Vérifier que toutes les méthodes utilisées dans les templates sont définies dans les classes
- Éviter l'utilisation directe d'objets globaux comme `Math` dans les templates

### Microservices Python
- Les microservices nécessitent des ressources importantes
- Utiliser la version simulation pour les plans gratuits
- Pour la production, considérer des services dédiés (AWS Lambda, Google Cloud Functions)

## Recommandations

### Pour la Démonstration
Utiliser `render-cloud.yaml` avec simulations pour un déploiement rapide et gratuit.

### Pour la Production
Utiliser `render.yaml` avec des plans payants ou déployer les microservices séparément.

### Pour le Développement
Utiliser Docker Compose local pour toutes les fonctionnalités.
