# Regalica Notebook JS

Regalica Notebook JS est une application de notebook intelligent, conçue pour être entièrement auto-hébergée et fonctionner sur des infrastructures standards (CPU-only). Ce projet intègre un backend Express.js, un frontend Angular 17, et une suite de services conteneurisés avec Docker, incluant PostgreSQL avec des extensions vectorielles, Redis, et le serveur d'inférence LLM Ollama.

Ce document vous guide à travers les étapes d'installation, de configuration et d'utilisation du projet.

## Prérequis

Avant de commencer, assurez-vous d'avoir les outils suivants installés sur votre machine :

- **Docker & Docker Compose** : Pour la gestion des conteneurs.
- **Node.js & npm** : Pour la gestion des dépendances et l'exécution des scripts (version LTS recommandée).
- **Angular CLI** : L'interface de ligne de commande pour Angular (`npm install -g @angular/cli@17`).
- **curl** & **jq** : Utilitaires de ligne de commande pour les requêtes HTTP et le traitement JSON.
- **Git** : Pour le versionnement du code.

## Démarrage Rapide (10 Étapes)

Suivez ces étapes pour lancer l'application en environnement de développement local.

1.  **Clonez le repository** :
    ```bash
    git clone https://github.com/wbarouni/Regalica_notebook.git
    cd Regalica_notebook
    ```

2.  **Créez votre fichier d'environnement** :
    Copiez le fichier d'exemple pour créer votre configuration locale.
    ```bash
    cp .env.example .env
    ```
    *Vous pouvez ajuster les variables dans `.env` si nécessaire, mais les valeurs par défaut sont conçues pour fonctionner directement avec Docker Compose.*

3.  **Démarrez tous les services** :
    Cette commande va construire les images et démarrer tous les conteneurs en arrière-plan.
    ```bash
    make up
    ```

4.  **Exécutez le script de première installation** :
    Ce script attend que tous les services soient prêts, télécharge les modèles de langage (LLM) nécessaires via Ollama, et effectue une vérification de santé complète.
    ```bash
    ./scripts/first-run.sh
    ```
    *Cette opération peut prendre plusieurs minutes, en fonction de votre connexion internet pour le téléchargement des modèles.*

5.  **Accédez au Frontend** :
    Ouvrez votre navigateur et allez à l'adresse suivante : [http://localhost:4200](http://localhost:4200). Vous devriez voir la page d'accueil "Regalica Notebook JS – Skeleton OK".

6.  **Vérifiez le Backend** :
    Accédez à l'endpoint de healthcheck du backend pour confirmer qu'il est opérationnel : [http://localhost:8080/health/ready](http://localhost:8080/health/ready). Vous devriez voir `{"status":"ready"}`.

7.  **Explorez les services** :
    - **PostgreSQL** est accessible sur le port `5432`.
    - **Redis** est accessible sur le port `6379`.
    - **Ollama API** est accessible sur [http://localhost:11434](http://localhost:11434).

8.  **Arrêtez l'environnement** :
    Pour arrêter tous les conteneurs :
    ```bash
    make down
    ```

9.  **Réinitialisez l'environnement** :
    Pour une réinitialisation complète (arrêt des conteneurs, suppression des volumes et des `node_modules`) :
    ```bash
    make reset
    ```

10. **Vérifiez la qualité du code** :
    Pour lancer les vérifications de la denylist et le healthcheck :
    ```bash
    make check
    ```

## Dépannage

- **Erreurs de port** : Si vous avez des erreurs `port is already allocated`, assurez-vous qu'aucun autre service ne tourne sur les ports utilisés (4200, 8080, 5432, 6379, 11434).
- **Manque de RAM** : Le service Ollama et les modèles de langage peuvent être gourmands en mémoire. Assurez-vous d'allouer suffisamment de RAM à Docker (8 Go ou plus est recommandé).
- **Problèmes de proxy** : Si vous êtes derrière un proxy d'entreprise, vous devrez peut-être configurer Docker et npm pour l'utiliser.

## Contribution et CI

Ce projet utilise une intégration continue (CI) avec GitHub Actions pour garantir la qualité et la stabilité du code. Toutes les contributions doivent être soumises via une Pull Request (PR).

- **Politique de PR** : La branche `main` est protégée. Chaque PR doit passer les vérifications suivantes : `denylist`, `build`, et `e2e`.
- **Conventions de commit** : Nous suivons les [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Veuillez vous référer au fichier `CONTRIBUTING.md` pour plus de détails.
- **Workflow CI** : Vous pouvez consulter l'état des actions de CI dans l'onglet "Actions" du repository GitHub.

## Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

