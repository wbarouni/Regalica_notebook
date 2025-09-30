## Analyse des points d'intégration et des dépendances pour les fonctionnalités multi-tenant et de gouvernance étendues

L'implémentation des fonctionnalités multi-tenant et de gouvernance étendues, telles que décrites dans le prompt, nécessitera des modifications significatives à travers les différentes couches de l'application Regalica_notebook : la base de données, le backend Express.js, et le frontend Angular. Cette section détaille les points d'intégration identifiés et les dépendances associées.

### 1. Base de Données (PostgreSQL)

Les modifications de la base de données sont fondamentales pour supporter le multi-tenant et la gouvernance. Elles incluent la création de nouvelles tables, l'extension de tables existantes et la mise en œuvre de la sécurité au niveau des lignes (RLS).

**Points d'intégration :**

*   **Nouvelles tables :**
    *   `nbk_workspaces` : Pour stocker les informations sur chaque espace de travail (ID, nom, slug, dates de création/mise à jour).
    *   `nbk_users` : Pour gérer les utilisateurs (ID, email, nom d'affichage). Bien qu'une table `users` puisse exister, le prompt spécifie `nbk_users`, suggérant une table dédiée ou une extension.
    *   `nbk_role` (ENUM) : Définir les rôles (`OWNER`, `ADMIN`, `EDITOR`, `VIEWER`).
    *   `nbk_memberships` : Table de jonction pour associer les utilisateurs aux espaces de travail avec un rôle spécifique.
    *   `nbk_workspace_settings` : Pour stocker les paramètres spécifiques à chaque espace de travail (RAG, UI features, quotas, rétention, data residency, PNP agents) sous forme de `jsonb`.
    *   `nbk_audit_log` : Pour enregistrer les actions importantes (ingestion, chat, modifications de paramètres, gestion des membres) avec `workspace_id`, `user_id` et des métadonnées `jsonb`.
*   **Extension des tables existantes :**
    *   `nbk_sources`, `nbk_chunks`, `nbk_chats`, `nbk_audit_log` (si elle existe déjà sous un autre nom) : Ajout d'une colonne `workspace_id` et d'un index pour permettre le filtrage par espace de travail.
*   **Sécurité au niveau des lignes (RLS) :**
    *   Activation de RLS sur `nbk_sources`, `nbk_chunks`, `nbk_chats`, `nbk_audit_log` (et potentiellement d'autres tables liées aux données utilisateur) avec une politique basée sur `current_setting('nbk.current_workspace')`.

**Dépendances :**

*   **`backend/src/db/init.js`** : Ce fichier est responsable de l'exécution des migrations. Il devra être mis à jour pour inclure les nouveaux scripts de migration SQL.
*   **`deploy/sql/`** : Un nouveau fichier de migration SQL (`2025_10_05_workspaces.sql` comme suggéré) devra être créé pour définir les nouvelles tables et modifier les existantes.
*   **`backend/src/config/index.js`** : La configuration du schéma de la base de données (`dbSchema`) est déjà présente et sera utilisée par les nouvelles tables.

### 2. Backend (Express.js)

Le backend nécessitera de nouveaux middlewares pour gérer l'authentification et l'autorisation multi-tenant, ainsi que l'adaptation des routes API existantes et la création de nouvelles.

**Points d'intégration :**

*   **Nouveaux Middlewares :**
    *   `useWorkspace` : Résoudra le `workspace_id` à partir de l'en-tête `X-Workspace-Slug` ou du chemin `/api/workspaces/:workspaceSlug/*` et définira `current_setting('nbk.current_workspace')` pour RLS.
    *   `requireUser` : Exigera un `req.userId` (authentification minimale pour le développement, avec une future intégration JWT/SSO).
    *   `requireRole(...roles)` : Vérifiera les rôles de l'utilisateur dans `nbk_memberships` pour l'autorisation.
*   **API (préfixe `/api/workspaces/:workspaceSlug`) :**
    *   **Settings :** `GET /settings`, `PUT /settings` (ADMIN+), avec validation JSON Schema stricte.
    *   **Members :** `GET /members` (ADMIN+), `POST /members/invite` (ADMIN+), `PUT /members/:userId/role` (OWNER/ADMIN), `DELETE /members/:userId`.
    *   **Usage/Quotas :** `GET /usage` (sources, bytes, asks 24h/30j), avec des garde-fous avant ingestion/ask.
    *   **Ingestion :** `POST /ingest/upload` — devra être adapté pour imposer les quotas `MAX_SOURCES`/`MAX_BYTES` et associer le document au `workspace_id` courant.
    *   **RAG :** `POST /rag/query` et `POST /rag/answer` (SSE) — devront filtrer par `workspace_id` et s'appuyer sur RLS.
*   **Guardrails :**
    *   Implémentation de *rate limiting* (ex. 60 rpm par IP et par espace de travail).
    *   Gestion des *timeouts* pour les microservices (embedder/reranker/ollama).
    *   Cartographie d'erreurs propre (4xx pour quotas/CORS/auth, 5xx pour infra).
*   **Audit Log :** Intégration du logging dans `nbk_audit_log` pour les actions `INGEST.*`, `CHAT.ASK`, `SETTINGS.UPD`, `MEMBER.*`.

**Dépendances :**

*   **`backend/src/server.js`** : Le point d'entrée principal devra intégrer les nouveaux middlewares et les routes API namespacées.
*   **`backend/src/config/index.js`** : Les paramètres de quotas et de rétention devront être lus depuis `nbk_workspace_settings` plutôt que des variables d'environnement globales pour être spécifiques à chaque espace de travail.
*   **`backend/src/ingest/routes.js` et `backend/src/rag/routes.js`** : Ces fichiers devront être modifiés pour intégrer le `workspace_id` dans les requêtes de base de données et appliquer les logiques de quotas/RLS.
*   **Nouveaux fichiers** : `backend/src/middlewares/workspace.js`, `backend/src/middlewares/auth.js`, `backend/src/middlewares/rbac.js` seront nécessaires.

### 3. Frontend (Angular)

Le frontend nécessitera des modifications pour gérer la sélection de l'espace de travail, l'affichage des pages de gouvernance et l'isolation de l'interface utilisateur.

**Points d'intégration :**

*   **Bootstrap & Interceptor :**
    *   `AppConfigService` (au boot) : Devra appeler `GET /api/config` pour récupérer `backendBaseUrl` et les `features` (zéro hardcoding).
    *   `HttpInterceptor` : Ajoutera l'en-tête `X-Workspace-Slug` et préfixera toutes les requêtes avec `backendBaseUrl`.
*   **Sélecteur d'Espace :**
    *   `workspace-switcher` dans la barre supérieure : Affichera la liste des espaces de travail (`GET /api/me/workspaces`), permettra de changer l'espace de travail courant (via un Signal/Store Angular).
    *   Routes namespacées : `/w/:workspaceSlug/sources`, `/w/:workspaceSlug/chat`, etc., avec `WorkspaceGuard` et `RoleGuard` pour la protection des routes.
*   **Pages Gouvernance :**
    *   **Settings (ADMIN+) :** Formulaire réactif pour gérer les paramètres RAG/UI/Quotas/Retention/Residency.
    *   **Members (ADMIN/OWNER) :** Tableau des membres (email, rôle), fonctionnalités d'ajout/suppression/mise à jour.
    *   **Usage :** Graphiques (Recharts) pour les requêtes/jour, octets, nombre de sources, avec filtres temporels.
    *   Toasts explicites pour les erreurs (429 quotas, 403 rôle, etc.).
*   **Isolation UI :** Toutes les vues (Sources, Chat, Viewer, Magic Studio) devront s'appuyer exclusivement sur l'espace courant.

**Dépendances :**

*   **`frontend/src/app/core/services/app-config.service.ts`** : Devra être modifié pour charger la configuration au démarrage.
*   **`frontend/src/app/core/interceptors/api-base.interceptor.ts`** : Devra être créé ou modifié pour ajouter l'en-tête `X-Workspace-Slug` et gérer le préfixe `backendBaseUrl`.
*   **`frontend/src/app/app.routes.ts`** : Les routes devront être mises à jour pour inclure le paramètre `:workspaceSlug` et utiliser les Guards.
*   **Nouveaux composants/services** : Pour le sélecteur d'espace de travail, les pages Settings, Members, Usage, ainsi que les Guards (`WorkspaceGuard`, `RoleGuard`).
*   **`frontend/src/app/services/`** : Les services existants (`documents.service.ts`, `ingest.service.ts`, `rag.service.ts`) devront être adaptés pour inclure le `workspaceSlug` dans leurs appels API.

### 4. Scripts et CI

Les scripts existants devront être adaptés et de nouveaux scripts ajoutés pour supporter les nouvelles fonctionnalités.

**Points d'intégration :**

*   **`scripts/retention.js` et `scripts/usage_rollup.js`** : Devront être mis à jour pour prendre en compte les paramètres de rétention et les quotas définis dans `nbk_workspace_settings` et filtrer par `workspace_id`.
*   **`scripts/denylist.sh`** : Le script de denylist doit être étendu avec les patterns fournis et intégré dans la CI.
*   **`scripts/ci.sh`** : Le workflow de CI devra inclure les étapes de denylist, lint, unit, docker build, smoke et e2e, en s'assurant qu'il échoue si les conditions ne sont pas remplies.

**Dépendances :**

*   Les scripts existants dans `Regalica_notebook/scripts/`.
*   Le fichier `CI-WORKFLOW.md` et les configurations Vercel devront être mis à jour.

### 5. Tests

Une suite de tests complète est essentielle pour garantir l'absence de régression et la bonne implémentation des nouvelles fonctionnalités.

**Points d'intégration :**

*   **Tests unitaires Backend :** Pour RLS (sans `set_config`), `requireRole` sur chaque rôle, et les quotas d'ingestion/ask.
*   **Tests unitaires Frontend :** Pour l'Interceptor (header + baseUrl), les Guards, et le Switcher d'espace de travail.
*   **Tests E2E Playwright :** Scénarios multi-workspaces pour prouver l'isolation (User A / Workspace A vs User B / Workspace B), le changement d'espace (refresh listes & chat sans fuite), les quotas (dépasser MAX_DAILY_ASKS -> 429 + toast), l'impact des settings (modifier TOPKs/Seuil -> effet mesurable sur un ask suivant), et la compatibilité mobile.

**Dépendances :**

*   Les frameworks de test existants (Jest pour le backend, Playwright pour l'E2E).
*   Les fichiers de test existants dans `backend/src/` et `frontend/tests/e2e/` devront être étendus ou de nouveaux fichiers créés.

Cette analyse met en évidence la complexité et l'interdépendance des modifications nécessaires. Une approche par étapes, avec des tests rigoureux à chaque phase, sera cruciale pour éviter les régressions et assurer la stabilité du système.
