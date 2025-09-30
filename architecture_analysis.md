## Analyse de l'architecture actuelle du projet Regalica_notebook

L'analyse des fichiers clés du dépôt `Regalica_notebook` a permis de dégager une compréhension de son architecture actuelle, qui se compose principalement d'un backend Express.js, d'un frontend Angular, et d'une base de données PostgreSQL avec l'extension `pgvector`.

### 1. Backend (Express.js)

Le backend est le cœur de l'application, gérant la logique métier, l'accès aux données et l'intégration avec les microservices d'embedding et de reranking. Il est structuré comme suit :

*   **Point d'entrée (`server.js`)** : Initialise l'application Express, configure les middlewares (CORS, JSON parsing, logging avec `morgan`), et expose les routes API. Il gère également l'initialisation de la base de données via `runMigrations()`.
*   **Configuration (`config/index.js`)** : Centralise la gestion des variables d'environnement et des paramètres de l'application (ports, URL de la base de données, schémas, limites d'upload, paramètres RAG, URL des microservices, CORS). Il est crucial de noter l'existence de `/api/config` qui expose une configuration publique (sans secrets) au frontend.
*   **Routes d'ingestion (`ingest/routes.js`)** : Gère le processus d'upload et d'ingestion de documents. Cela inclut :
    *   La validation du type de fichier et de la taille (`multer`).
    *   Le calcul du SHA256 du document pour la déduplication.
    *   L'extraction de texte (`extractText`).
    *   La normalisation du texte (`normalizeText`).
    *   Le découpage en *chunks* (`chunkSections`).
    *   La génération d'embeddings (`generateEmbeddings`) via un microservice externe (`embedder`).
    *   La persistance des documents, pages, chunks et embeddings en base de données, le tout au sein d'une transaction.
*   **Routes RAG (`rag/routes.js`)** : Implémente la logique de *Retrieval Augmented Generation*. Cela comprend :
    *   La détection de la langue de la requête (`detectLanguage`).
    *   La récupération des candidats pertinents (`retrieveForQuery`).
    *   Le réordonnancement des candidats (`rerank`) via un microservice externe (`reranker`).
    *   La sélection des meilleurs candidats pour le contexte (`selectTopCandidates`).
    *   La génération de la réponse (`generateAnswer`) via un LLM externe (`ollama`).
    *   Le logging des requêtes RAG dans la table `rag_logs`.
*   **Base de données (`db/init.js`, `db/pool.js`)** : Gère la connexion à PostgreSQL et l'exécution des migrations. Les migrations sont des scripts SQL qui créent ou modifient la structure de la base de données.

### 2. Base de Données (PostgreSQL + pgvector)

La base de données utilise PostgreSQL avec l'extension `pgvector` pour stocker et interroger les embeddings. Les tables principales identifiées par les migrations existantes (`0002_ingest_pgvector_up.sql`, `0003_rag_logs_up.sql`) sont :

*   `nbk.documents` : Stocke les métadonnées des documents ingérés (titre, MIME, taille, SHA256).
*   `nbk.pages` : Stocke le texte extrait page par page (pour les PDF).
*   `nbk.chunks` : Stocke les segments de texte (chunks) des documents, avec des métadonnées comme le chemin de titre, les spans et le numéro de page.
*   `nbk.embeddings` : Stocke les vecteurs d'embeddings associés aux chunks.
*   `nbk.rag_logs` : Enregistre les détails de chaque requête RAG pour l'audit et les statistiques.

### 3. Frontend (Angular)

Le frontend est une application Angular. L'analyse initiale des fichiers `frontend/` indique une structure typique d'une application Angular moderne, avec des composants, des services et une gestion des routes. Le fichier `angular.json` confirme l'utilisation d'Angular CLI. La présence de `tailwind.config.js` indique l'utilisation de Tailwind CSS pour le stylisme. Le prompt mentionne Angular 17 standalone, ce qui implique une architecture basée sur des composants et des services autonomes.

### 4. Microservices

Le projet s'appuie sur plusieurs microservices externes, configurables via les variables d'environnement :

*   **Embedder** (`EMBED_API_URL`) : Pour la génération des embeddings.
*   **Reranker** (`RERANKER_API_URL`) : Pour le réordonnancement des candidats RAG.
*   **LLM** (`LLM_API_URL`) : Pour la génération de réponses (ex: Ollama).

### 5. Scripts et CI

Le répertoire `scripts/` contient des scripts utilitaires. Le fichier `CI-WORKFLOW.md` et les fichiers `deploy/` (`deploy-vercel-safe.sh`, `vercel.json`, `vercel-safe.json`) indiquent une intégration continue et un déploiement sur Vercel.

### Conclusion

L'architecture est modulaire, avec une séparation claire des préoccupations entre le backend, la base de données et les microservices. Le système de migration basé sur des scripts SQL et l'utilisation de variables d'environnement pour la configuration facilitent la gestion et le déploiement. Les points d'intégration pour les fonctionnalités multi-tenant et de gouvernance étendues devront toucher à la base de données (nouvelles tables, RLS, modification des tables existantes), au backend (nouveaux middlewares, routes API, logique métier) et au frontend (nouvelles pages, composants, gestion de l'état).
