# Guide de Déploiement Regalica Notebook

Ce guide fournit les instructions pour déployer l'application Regalica Notebook en utilisant Docker Compose pour le développement local et Render pour la production.

## 1. Développement Local avec Docker Compose

La configuration Docker Compose fournit un environnement de développement complet et prêt à l'emploi.

**Fichier de configuration :** `deploy/docker/docker-compose.yml`

### Fonctionnalités Incluses

- ✅ **Backend** : Express.js
- ✅ **Microservices** : Embedder (Python + sentence-transformers) et Reranker (Python + BGE-reranker-v2-m3)
- ✅ **Frontend** : Angular 17
- ✅ **Base de données** : PostgreSQL + pgvector
- ✅ **Cache** : Redis
- ✅ **LLM** : Ollama (modèle `qwen2:7b-instruct`)

### Commandes

Pour une première installation, exécutez le script `first-run.sh` qui initialise la base de données et installe les dépendances.

```bash
# Cloner le repository
git clone https://github.com/wbarouni/Regalica_notebook.git
cd Regalica_notebook

# Exécuter la première installation
./scripts/first-run.sh

# Démarrer tous les services
make up

# Arrêter les services
make down

# Lancer tous les tests de qualité et de validation
make check
```

## 2. Déploiement en Production avec Render

La configuration Render est conçue pour un déploiement en production et inclut tous les services nécessaires.

**Fichier de configuration :** `render.yaml`

### Prérequis

- Un compte Render avec un plan supportant les services web (`starter` ou supérieur) pour les microservices Python.
- Une clé d'API OpenAI valide configurée dans les secrets de votre environnement Render (`OPENAI_API_KEY`).

### Services Déployés

| Service             | Type     | Runtime | Plan     | Description                                      |
| ------------------- | -------- | ------- | -------- | ------------------------------------------------ |
| `regalica-backend`  | `web`    | Node    | `starter`| Serveur principal Express.js                     |
| `regalica-embedder` | `web`    | Python  | `starter`| Microservice pour la génération d'embeddings     |
| `regalica-reranker` | `web`    | Python  | `starter`| Microservice pour le reranking des résultats     |
| `regalica-frontend` | `static` | -       | `starter`| Interface utilisateur Angular 17                 |
| `regalica-db`       | `db`     | -       | `starter`| Base de données PostgreSQL avec extension pgvector |

### Instructions de Déploiement

1.  **Connecter le Repository** : Dans le tableau de bord Render, connectez votre fork du repository `wbarouni/Regalica_notebook`.
2.  **Créer un "Blueprint"** : Créez un nouveau service de type "Blueprint" et sélectionnez votre repository.
3.  **Configuration** : Render détectera et utilisera automatiquement le fichier `render.yaml` à la racine du projet.
4.  **Variables d'Environnement** : Assurez-vous d'ajouter la variable `OPENAI_API_KEY` dans les secrets de l'environnement sur Render pour que le service backend puisse l'utiliser.
5.  **Déployer** : Lancez le déploiement. Render construira et déploiera tous les services définis dans le fichier de configuration.

## 3. Variables d'Environnement

Le fichier `.env.example` contient la liste complète des variables d'environnement utilisées par l'application. Pour le déploiement sur Render, la plupart de ces variables sont automatiquement configurées par le `render.yaml`, à l'exception des secrets qui doivent être ajoutés manuellement.

### Variables Clés pour Render

-   `DATABASE_URL` : Fourni automatiquement par le service de base de données Render.
-   `EMBED_API_URL` et `RERANKER_API_URL` : Injectés automatiquement via la découverte de services internes de Render.
-   `OPENAI_API_KEY` : **Doit être configuré manuellement** dans les secrets de l'environnement Render.

## 4. Dépannage (Troubleshooting)

-   **Échec du build** : Vérifiez les logs de build sur Render. Assurez-vous que les dépendances dans `package.json` et `requirements.txt` sont correctes. La commande `npm ci` est utilisée pour des installations reproductibles.
-   **Problèmes de connexion aux microservices** : Assurez-vous que les noms de service dans `render.yaml` correspondent bien aux noms utilisés dans les variables `fromService`.
-   **Erreurs `502`** : Vérifiez les logs du service concerné pour identifier la cause de l'arrêt ou du crash de l'application. Assurez-vous que le `healthCheckPath` est correctement configuré et répond.

