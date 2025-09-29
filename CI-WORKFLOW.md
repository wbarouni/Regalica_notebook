# Workflow CI à ajouter manuellement

En raison des permissions GitHub Actions, le workflow CI doit être ajouté manuellement dans l'interface GitHub.

## Fichier à créer : `.github/workflows/ci.yml`

```yaml
name: Regalica Notebook CI
on:
  push: { branches: ["bloc1"] }
  pull_request: { branches: ["main"] }

jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    steps:
      - uses: actions/checkout@v4
      - name: Install deps
        run: sudo apt-get update && sudo apt-get install -y jq curl ripgrep

      - name: Docker Compose up
        run: |
          docker compose -f deploy/docker/docker-compose.yml up -d --build
          # wait for backend
          for i in {1..40}; do
            curl -fsS http://localhost:8080/health/ready && break
            sleep 2
            [ $i -eq 40 ] && exit 1
          done

      - name: Smoke test
        run: bash scripts/smoke.sh
```

## Instructions

1. Aller sur GitHub dans l'onglet "Actions"
2. Créer un nouveau workflow
3. Copier le contenu ci-dessus
4. Sauvegarder le fichier

Le workflow testera automatiquement :
- Installation des dépendances
- Build et démarrage des services Docker
- Healthcheck du backend
- Smoke test complet
