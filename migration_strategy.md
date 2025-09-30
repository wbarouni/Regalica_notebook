## Stratégie de Migration et Étapes d'Implémentation pour les Fonctionnalités Multi-Tenant et de Gouvernance Étendues

L'implémentation des fonctionnalités multi-tenant et de gouvernance étendues dans le projet Regalica_notebook est une tâche complexe qui nécessite une approche structurée et progressive pour minimiser les risques de régression et assurer la stabilité du système. La stratégie proposée ci-dessous est décomposée en phases logiques, chacune avec des étapes d'implémentation détaillées et des considérations clés.

### Principes Directeurs

1.  **Approche Incrémentale et Modulaire :** Découper la tâche en petites étapes gérables et indépendantes, en validant minutieusement chaque étape avant de passer à la suivante. Cela permet de circonscrire les modifications et de faciliter l'identification et la correction des problèmes.
2.  **Tests Rigoureux et Exhaustifs :** Mettre à jour et étendre systématiquement la suite de tests (unitaires, d'intégration, E2E) à chaque phase. L'objectif est de garantir non seulement la conformité aux nouvelles exigences, mais surtout l'absence de régression sur les fonctionnalités existantes. Les tests doivent couvrir les cas nominaux, les cas limites et les scénarios d'erreur.
3.  **Isolation des Changements :** Développer les nouvelles fonctionnalités sur des branches Git dédiées. Utiliser des mécanismes comme le Row-Level Security (RLS) dès le début pour assurer une isolation stricte des données entre les espaces de travail, même pendant le développement.
4.  **Configuration Externe et Flexible :** Maintenir la configuration externe via des variables d'environnement et des paramètres de base de données pour une flexibilité maximale et une adaptation facile aux différents environnements (développement, staging, production).
5.  **Zéro Hardcoding :** Respecter strictement la règle de "zéro hardcoding" pour les URLs, les identifiants et les configurations, afin de garantir la portabilité et la maintenabilité du code.
6.  **Documentation Continue :** Documenter chaque modification, décision architecturale et procédure de test pour faciliter la compréhension, la maintenance et l'onboarding de nouveaux contributeurs.

### Gestion des Risques et Prévention des Régressions

La prévention des régressions est au cœur de cette stratégie. Pour y parvenir, les mesures suivantes seront appliquées :

*   **Revue de Code Systématique :** Chaque modification de code sera soumise à une revue par les pairs pour identifier les erreurs potentielles, les vulnérabilités et les non-conformités aux standards de codage.
*   **Intégration Continue (CI) Renforcée :** Le pipeline CI sera mis à jour pour exécuter l'ensemble des tests (lint, unitaires, E2E) à chaque *push* sur une branche de fonctionnalité. Tout échec de test bloquera le processus de fusion.
*   **Déploiement Progressif :** Les nouvelles fonctionnalités seront déployées d'abord dans des environnements de staging, où des tests d'acceptation utilisateur (UAT) et des tests de performance pourront être effectués avant la mise en production.
*   **Surveillance et Alerting :** Des outils de surveillance seront mis en place pour détecter rapidement toute anomalie ou dégradation de performance en production après un déploiement.
*   **Rollback Facilité :** L'architecture et les procédures de déploiement seront conçues pour permettre un retour arrière rapide et sûr en cas de problème critique en production.
*   **Compatibilité Ascendante :** Les modifications de l'API et de la base de données seront conçues avec une attention particulière à la compatibilité ascendante, en utilisant des versions et des schémas de données pour éviter de casser les clients existants.

### Phases de Migration et d'Implémentation

#### Phase 1 : Préparation de la Base de Données et du Backend (Fondations Multi-Tenant)

Cette phase se concentre sur la mise en place des structures de données et des mécanismes backend essentiels pour le multi-tenant, avec une attention particulière à la non-régression des fonctionnalités existantes.

**Étapes d'Implémentation :**

1.  **Création des Migrations SQL (avec prudence) :**
    *   Créer un nouveau fichier de migration SQL (`backend/db/migrations/2025_10_05_workspaces.sql`) qui inclura :
        *   La définition des tables `nbk_workspaces`, `nbk_users`, `nbk_role` (ENUM), `nbk_memberships`, `nbk_workspace_settings`.
        *   L'ajout de la colonne `workspace_id` aux tables `nbk.documents`, `nbk.pages`, `nbk.chunks`, `nbk.embeddings`, `nbk.rag_logs`. **Ces ajouts devront être faits de manière non-bloquante et avec des valeurs par défaut appropriées pour les données existantes (ex: NULL ou un `workspace_id` par défaut pour les données héritées).**
        *   L'ajout de la table `nbk_audit_log`.
        *   La création des index nécessaires sur `workspace_id`.
    *   Mettre à jour `backend/src/db/init.js` pour inclure le nouveau fichier de migration dans la séquence d'exécution. **Vérifier que l'ordre des migrations est correct et ne perturbe pas les migrations existantes.**
2.  **Implémentation du Middleware `useWorkspace` :**
    *   Créer `backend/src/middlewares/workspace.js`.
    *   Ce middleware doit résoudre le `workspace_id` à partir de l'en-tête `X-Workspace-Slug` ou du paramètre d'URL `:workspaceSlug`.
    *   Exécuter `SELECT set_config(\'nbk.current_workspace\', $1, true)` pour chaque requête afin d'activer le RLS. **S'assurer que ce `set_config` n'impacte pas les requêtes qui ne sont pas encore adaptées au multi-tenant.**
    *   Intégrer ce middleware dans `backend/src/server.js` pour les routes concernées (`/api/workspaces/:workspaceSlug/*`). **Initialement, ce middleware pourrait être activé uniquement pour les nouvelles routes multi-tenant pour éviter les régressions.**
3.  **Mise en place du RLS (progressive) :**
    *   Ajouter les politiques de sécurité au niveau des lignes (RLS) sur `nbk.documents`, `nbk.pages`, `nbk.chunks`, `nbk.embeddings`, `nbk.rag_logs` (et `nbk_audit_log`). **Activer le RLS progressivement, en commençant par les tables les moins critiques ou en mode `FORCED` pour les nouvelles tables, et en `PERMISSIVE` pour les tables existantes jusqu'à ce que toutes les requêtes soient adaptées.**
    *   Tester le RLS pour s'assurer que les utilisateurs ne peuvent accéder qu'aux données de leur espace de travail, et que les utilisateurs sans `workspace_id` (hérités) peuvent toujours accéder à leurs données.
4.  **Adaptation des Routes Existantes (Backend) :**
    *   Modifier `backend/src/ingest/routes.js` et `backend/src/rag/routes.js` pour s'assurer que toutes les requêtes de base de données incluent le `workspace_id` et respectent le RLS. **Ces modifications seront faites après la validation du RLS et des middlewares.**
    *   S'assurer que les fonctions `checkExistingDocument` et `persistDocument` dans `ingest/routes.js` gèrent correctement le `workspace_id`.

**Tests de Validation (Phase 1) :**

*   **Unitaires SQL :** Vérifier que les migrations s'exécutent sans erreur, que les tables sont créées/modifiées correctement et que les données existantes ne sont pas corrompues.
*   **Unitaires Backend :** Tester le middleware `useWorkspace` et la bonne configuration de `nbk.current_workspace`.
*   **Intégration Backend-DB :** Vérifier que les opérations d'ingestion et de RAG respectent le RLS et que les données sont isolées par `workspace_id`. **Des tests spécifiques seront ajoutés pour les scénarios de non-régression sur les fonctionnalités existantes (ingestion/RAG sans `workspace_id` explicite).**
*   **Tests de performance :** Mesurer l'impact des modifications de la base de données et des middlewares sur les performances des requêtes existantes.

#### Phase 2 : Gestion des Utilisateurs, Rôles et Paramètres (Backend)

Cette phase se concentre sur l'implémentation des mécanismes d'authentification, d'autorisation et de gestion des paramètres spécifiques aux espaces de travail, en veillant à la sécurité et à la non-régression.

**Étapes d'Implémentation :**

1.  **Implémentation des Middlewares d'Authentification et d'Autorisation :**
    *   Créer `backend/src/middlewares/auth.js` pour `requireUser` (authentification minimale pour le développement). **S'assurer que ce middleware est configurable pour ne pas bloquer les routes existantes qui ne nécessitent pas encore d'authentification multi-tenant.**
    *   Créer `backend/src/middlewares/rbac.js` pour `requireRole(...roles)` qui vérifie les `nbk_memberships`. **Ce middleware sera appliqué uniquement aux routes nécessitant une autorisation spécifique.**
    *   Intégrer ces middlewares dans `backend/src/server.js` et les appliquer aux routes API appropriées.
2.  **Nouvelles Routes API (Backend) :**
    *   Définir les routes sous `/api/workspaces/:workspaceSlug/` pour :
        *   `GET /settings`, `PUT /settings` (ADMIN+), avec validation JSON Schema stricte. **La validation stricte est cruciale pour éviter l'injection de données invalides.**
        *   `GET /members` (ADMIN+), `POST /members/invite` (ADMIN+), `PUT /members/:userId/role` (OWNER/ADMIN), `DELETE /members/:userId`.
        *   `GET /usage` (sources, bytes, asks 24h/30j).
    *   Mettre à jour `backend/src/config/index.js` pour lire les paramètres de quotas et de rétention depuis `nbk_workspace_settings` (via la base de données) au lieu des variables d'environnement globales. **Cette transition sera gérée avec une logique de fallback pour les environnements qui n'ont pas encore de `nbk_workspace_settings` configurés.**
3.  **Implémentation des Guardrails :**
    *   Ajouter le *rate limiting* (ex. 60 rpm par IP et par espace de travail) en utilisant un middleware approprié. **Tester l'impact sur les performances et la stabilité sous charge.**
    *   Mettre en place la gestion des *timeouts* pour les appels aux microservices (embedder/reranker/ollama). **Cela évitera les blocages de l'application en cas de défaillance d'un microservice.**
    *   Améliorer la cartographie d'erreurs pour les codes 4xx (quotas/CORS/auth) et 5xx (infra). **Des messages d'erreur clairs et informatifs sont essentiels pour le débogage et l'expérience utilisateur.**
4.  **Intégration de l'Audit Log :**
    *   Modifier les services backend pertinents (ingestion, RAG, settings, membres) pour enregistrer les actions dans `nbk_audit_log`. **S'assurer que le logging est asynchrone pour ne pas impacter les performances des opérations principales.**

**Tests de Validation (Phase 2) :**

*   **Unitaires Backend :** Tester `requireUser`, `requireRole`, la validation des paramètres des routes `settings` et `members`.
*   **Intégration Backend :** Vérifier le bon fonctionnement des nouvelles routes API, l'application des rôles et des quotas. **Des tests d'intégration seront ajoutés pour simuler des scénarios d'accès concurrents et vérifier la robustesse des gardes-fous.**
*   **E2E (partiel) :** Commencer à tester des scénarios d'accès basés sur les rôles et les espaces de travail, en s'assurant que les utilisateurs non autorisés sont correctement bloqués.

#### Phase 3 : Développement du Frontend (Angular)

Cette phase se concentre sur l'adaptation de l'interface utilisateur pour supporter le multi-tenant et la gouvernance, en garantissant une expérience utilisateur fluide et sans régression.

**Étapes d'Implémentation :**

1.  **Configuration au Démarrage et Intercepteur HTTP :**
    *   Modifier `frontend/src/app/core/services/app-config.service.ts` pour appeler `GET /api/config` au démarrage et charger `backendBaseUrl` et les `features`. **Implémenter un mécanisme de chargement asynchrone pour ne pas bloquer le rendu initial de l'application.**
    *   Créer ou modifier `frontend/src/app/core/interceptors/api-base.interceptor.ts` pour ajouter l'en-tête `X-Workspace-Slug` et préfixer les requêtes avec `backendBaseUrl`. **S'assurer que l'intercepteur gère correctement les requêtes qui ne nécessitent pas de `workspaceSlug` (ex: `GET /api/config`).**
2.  **Sélecteur d'Espace de Travail :**
    *   Développer un composant `workspace-switcher` pour la barre supérieure. **Concevoir une UI/UX intuitive et conforme aux préférences de design (blanc et noir, raffiné, minimaliste).**
    *   Implémenter un service pour récupérer la liste des espaces de travail (`GET /api/me/workspaces`) et gérer l'état de l'espace de travail courant (via un Signal/Store Angular). **La gestion de l'état doit être robuste pour éviter les incohérences entre les vues.**
3.  **Routes Namespacées et Guards :**
    *   Mettre à jour `frontend/src/app/app.routes.ts` pour inclure le paramètre `:workspaceSlug` dans les routes (`/w/:workspaceSlug/sources`, etc.). **Utiliser des routes paramétrées pour une meilleure gestion de l'état et de la navigation.**
    *   Créer `WorkspaceGuard` et `RoleGuard` pour protéger l'accès aux routes en fonction de l'espace de travail et du rôle de l'utilisateur. **Ces Guards doivent être testés pour s'assurer qu'ils bloquent correctement l'accès non autorisé et redirigent l'utilisateur de manière appropriée.**
4.  **Pages de Gouvernance :**
    *   Développer les pages Angular pour `Settings`, `Members` et `Usage` en utilisant les nouvelles API backend. **Prioriser la réutilisabilité des composants et la cohérence visuelle.**
    *   Utiliser des formulaires réactifs avec validation pour la page `Settings`. **La validation côté client doit compléter la validation côté serveur pour une meilleure expérience utilisateur.**
    *   Intégrer des graphiques (ex: Recharts) pour la page `Usage`. **S'assurer que les graphiques sont performants et affichent des données précises.**
    *   Afficher des messages `Toast` explicites pour les erreurs (quotas, rôles). **Les messages doivent être clairs, concis et actionnables.**
5.  **Isolation UI :**
    *   S'assurer que toutes les vues existantes (Sources, Chat, Viewer, Magic Studio) filtrent leurs données en fonction de l'espace de travail courant. **Cela implique une révision des services et des composants existants pour intégrer le `workspaceSlug` dans les appels API et la logique d'affichage.**

**Tests de Validation (Phase 3) :**

*   **Unitaires Frontend :** Tester l'intercepteur HTTP, les Guards, le service de sélection d'espace de travail, et les composants des nouvelles pages.
*   **E2E Playwright :** Tester les scénarios multi-workspaces (isolation, changement d'espace, quotas, impact des settings, mobile). **Les tests E2E seront la dernière ligne de défense pour détecter les régressions visuelles et fonctionnelles.**
*   **Tests d'accessibilité et de réactivité :** S'assurer que l'interface utilisateur est accessible et fonctionne correctement sur différents appareils et tailles d'écran.

#### Phase 4 : Scripts, CI/CD et Finalisation

Cette phase vise à adapter les scripts existants, renforcer la CI/CD et effectuer les ajustements finaux, avec un accent sur l'automatisation et la robustesse.

**Étapes d'Implémentation :**

1.  **Adaptation des Scripts :**
    *   Modifier `scripts/retention.js` et `scripts/usage_rollup.js` pour qu'ils utilisent les paramètres de `nbk_workspace_settings` et filtrent par `workspace_id`. **Tester ces scripts dans un environnement de staging avec des données représentatives pour valider leur comportement.**
2.  **Renforcement de la CI/CD :**
    *   Mettre à jour `scripts/denylist.sh` avec les patterns fournis (`mock`, `placeholder`, `simulate`, `stub`, `dummy`, `lorem`, `ipsum`, `...`, `http://localhost`, `https://localhost`, `127\.0\.0\.1(?![:/])`, `onrender\.com`).
    *   Intégrer `denylist.sh` dans `scripts/ci.sh` pour qu'il échoue si des termes interdits sont détectés. **Ce script agira comme un garde-fou pour maintenir la qualité du code.**
    *   Mettre à jour `scripts/ci.sh` pour inclure les étapes de lint, unit, docker build, smoke et e2e, avec les critères de succès définis. **Le pipeline CI/CD doit être le garant de la non-régression.**
    *   Vérifier/mettre à jour la configuration CORS pour autoriser Vercel et supprimer `localhost` en production. **Une configuration CORS sécurisée est essentielle pour la sécurité de l'application.**
3.  **Actions Spécifiques du Prompt :**
    *   **Supprimer hardcoding d'URL dans Angular :** S'assurer que `backendBaseUrl` est chargé via `/api/config` et utilisé par l'intercepteur. **Vérifier que toutes les URLs sont dynamiques.**
    *   **Remplacer détection de langue :** Utiliser `franc/langs` comme spécifié. **Tester la précision de la détection de langue.**
    *   **Compléter ViewerService :** Pour surligner exactement les spans (start, end) renvoyés par l'API. **Vérifier la précision du surlignage.**
    *   **Implémenter Magic Studio :** Mind Map, Podcast TTS, Actions (résumé, plan, flashcards), Export Markdown. **Ces fonctionnalités seront développées de manière modulaire et testées indépendamment.**
    *   **Suppression RGPD :** Implémenter `DELETE /api/workspaces/:slug/me/chats`. **S'assurer de la conformité RGPD et de la suppression complète des données de l'utilisateur.**
    *   **Data residency :** Préparer les champs de settings pour hinting. **Cela implique des modifications de la base de données et du backend pour stocker et utiliser cette information.**

**Tests de Validation (Phase 4) :**

*   **CI/CD :** Vérifier que tous les pipelines CI/CD s'exécutent avec succès et que les scripts de denylist fonctionnent. **Le temps d'exécution du pipeline doit être optimisé.**
*   **Tests E2E complets :** Exécuter la suite complète de tests E2E pour valider toutes les fonctionnalités multi-tenant et de gouvernance, y compris les scénarios de régression. **Ces tests seront la validation finale avant la mise en production.**
*   **Tests de sécurité :** Effectuer des tests de pénétration et des audits de sécurité pour identifier et corriger les vulnérabilités.

### Conclusion

Cette stratégie propose une feuille de route détaillée et renforcée pour l'implémentation des fonctionnalités multi-tenant et de gouvernance étendues. L'accent est mis sur une approche prudente, incrémentale et testée à chaque étape, avec des mécanismes clairs de gestion des risques et de prévention des régressions. L'adhésion à ces principes, la rigueur des tests et une communication continue entre les équipes de développement seront les piliers du succès de cette migration complexe.
