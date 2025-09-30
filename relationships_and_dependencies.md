## Analyse des Relations et Dépendances entre le Frontend, le Backend et la Base de Données

Cette section détaille les interconnexions et les dépendances fonctionnelles entre les principaux composants du projet Regalica_notebook : le frontend Angular, le backend Express.js et la base de données PostgreSQL. L'analyse est menée sans simplification, simulation ou recours à des éléments non concrets, en se basant sur le code source de la branche `main`.

### 1. Frontend (Angular) et Backend (Express.js)

La communication entre le frontend Angular et le backend Express.js s'effectue via des appels API HTTP. Le frontend initie les requêtes, et le backend les traite, interagit avec la base de données ou d'autres microservices, puis renvoie une réponse.

**Points d'interaction clés :**

*   **Configuration du Backend :** Le frontend est conçu pour récupérer la configuration publique du backend via l'endpoint `GET /api/config`. Le fichier `backend/src/server.js` expose cette route, qui renvoie les informations obtenues de `backend/src/config/index.js` via la fonction `getPublicUrlConfig`.
    *   **Dépendance :** Le frontend dépend de la disponibilité de cet endpoint pour obtenir des paramètres essentiels tels que `backendExternalUrl` et `frontendExternalUrl`, bien que le prompt initial mentionne la suppression du hardcoding d'URL et l'utilisation d'un `HttpInterceptor` pour préfixer les requêtes. Actuellement, `backendExternalUrl` est une variable d'environnement (`process.env.BACKEND_EXTERNAL_URL`).
*   **Routes d'Ingestion :** Le frontend utilise les routes exposées par `backend/src/ingest/routes.js` pour l'upload et l'ingestion de documents. La route principale est `POST /api/ingest/upload`.
    *   **Dépendance :** Le frontend envoie des fichiers et des métadonnées au backend. Le backend dépend du service `embedder` pour la génération d'embeddings et de la base de données pour la persistance.
*   **Routes RAG (Retrieval Augmented Generation) :** Le frontend interagit avec les routes définies dans `backend/src/rag/routes.js` pour les requêtes de recherche et la génération de réponses. Les routes clés sont `POST /api/rag/query` et `POST /api/rag/answer`.
    *   **Dépendance :** Le frontend envoie la requête utilisateur au backend. Le backend dépend des services `embedder` (via `retrieveForQuery`), `reranker` (via `rerank`) et `ollama` (via `generateAnswer`) pour traiter la requête et générer une réponse.
*   **Gestion des Erreurs :** Le backend utilise un `errorHandler` (`backend/src/utils/errors.js`) pour centraliser la gestion des erreurs et renvoyer des réponses standardisées au frontend.
*   **CORS :** Le `backend/src/server.js` configure CORS pour autoriser les requêtes provenant d'origines spécifiées dans `config.corsAllowedOrigins` (variable d'environnement `CORS_ALLOWED_ORIGINS`).

### 2. Backend (Express.js) et Base de Données (PostgreSQL)

Le backend est l'unique interface directe avec la base de données PostgreSQL. Toutes les opérations de lecture et d'écriture sont gérées par le backend.

**Points d'interaction clés :**

*   **Connexion à la Base de Données :** Le fichier `backend/src/db/pool.js` gère la création et la gestion du pool de connexions à PostgreSQL, en utilisant les informations de connexion définies dans `backend/src/config/index.js` (variable d'environnement `DB_URL`).
*   **Migrations :** Le fichier `backend/src/db/init.js` est responsable de l'exécution des scripts de migration SQL situés dans `deploy/sql/`. Ces scripts définissent et modifient le schéma de la base de données.
    *   **Dépendance :** Le backend dépend de la bonne exécution de ces migrations pour que la structure de la base de données corresponde aux attentes du code.
*   **Opérations CRUD (Create, Read, Update, Delete) :**
    *   **Ingestion :** Les fonctions `checkExistingDocument` et `persistDocument` dans `backend/src/ingest/routes.js` effectuent des insertions dans `nbk.documents`, `nbk.pages`, `nbk.chunks` et `nbk.embeddings`.
    *   **RAG :** Les fonctions de `backend/src/rag/query.js` et `backend/src/rag/routes.js` effectuent des requêtes sur `nbk.documents`, `nbk.chunks` et `nbk.embeddings` pour récupérer les informations pertinentes. Les logs RAG sont insérés dans `nbk.rag_logs`.
*   **Schéma de la Base de Données :** Le backend utilise le schéma `nbk` pour toutes ses opérations, comme spécifié dans `backend/src/config/index.js` (variable d'environnement `DB_SCHEMA`).

### 3. Backend (Express.js) et Microservices Externes

Le backend s'appuie sur des microservices externes pour des tâches spécifiques, principalement liées au traitement du langage naturel et aux embeddings.

**Points d'interaction clés :**

*   **Service d'Embeddings (`embedder`) :** Le fichier `backend/src/ingest/embed.js` est responsable de la communication avec le service d'embeddings. Il envoie les *chunks* de texte et reçoit en retour les vecteurs d'embeddings.
    *   **Dépendance :** L'URL de ce service est configurée via `config.embedApiUrl` (variable d'environnement `EMBED_API_URL`). Le backend dépend de la disponibilité et de la performance de ce service.
*   **Service de Reranking (`reranker`) :** Le fichier `backend/src/rag/rerank.js` communique avec le service de reranking pour réordonner les candidats récupérés en fonction de leur pertinence par rapport à la requête.
    *   **Dépendance :** L'URL de ce service est configurée via `config.rerankerApiUrl` (variable d'environnement `RERANKER_API_URL`). Le backend dépend de la disponibilité et de la performance de ce service.
*   **Service LLM (`ollama`) :** Le fichier `backend/src/rag/synthesize.js` interagit avec un modèle de langage étendu (LLM) pour générer des réponses basées sur la requête et les candidats sélectionnés.
    *   **Dépendance :** L'URL de ce service est configurée via `config.llmApiUrl` (variable d'environnement `LLM_API_URL`). Le backend dépend de la disponibilité et de la performance de ce service.

### 4. Dépendances Croisées et Flux de Données

Le flux de données et les dépendances peuvent être résumés comme suit :

*   **Frontend -> Backend :** Requêtes API (ingestion, RAG, configuration).
*   **Backend -> Base de Données :** Lecture/écriture des documents, chunks, embeddings, logs RAG.
*   **Backend -> Microservices Externes :** Appels HTTP pour la génération d'embeddings, le reranking et la génération de réponses LLM.
*   **Microservices Externes :** Indépendants les uns des autres, mais essentiels au fonctionnement du backend.

**Exemple de flux de données (Ingestion) :**

1.  Frontend envoie un fichier à `POST /api/ingest/upload`.
2.  Backend reçoit le fichier, l'extrait, le normalise et le découpe en *chunks*.
3.  Backend envoie les *chunks* au service `embedder`.
4.  Service `embedder` renvoie les vecteurs d'embeddings.
5.  Backend persiste le document, les pages, les *chunks* et les embeddings dans la base de données PostgreSQL.

**Exemple de flux de données (RAG) :**

1.  Frontend envoie une requête à `POST /api/rag/answer`.
2.  Backend reçoit la requête, détecte la langue.
3.  Backend interroge la base de données pour récupérer les *chunks* pertinents (via `retrieveForQuery`).
4.  Backend envoie les *chunks* et la requête au service `reranker`.
5.  Service `reranker` renvoie les *chunks* réordonnés.
6.  Backend envoie les *chunks* sélectionnés et la requête au service LLM (`ollama`).
7.  Service LLM génère une réponse.
8.  Backend enregistre la requête et la réponse dans `nbk.rag_logs`.
9.  Backend renvoie la réponse au frontend.

Cette analyse met en évidence une architecture modulaire où chaque composant a des responsabilités claires et des points d'intégration bien définis. La robustesse du système dépendra de la bonne configuration et de la disponibilité de chacun de ces services et de la base de données.
