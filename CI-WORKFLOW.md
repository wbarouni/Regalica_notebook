# Workflow CI - Version finale

## Fichier créé : `.github/workflows/ci.yml`

```yaml
name: CI
on:
  pull_request: { branches: ["main"] }
  push: { branches: ["bloc1"] }
jobs:
  build-test:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    steps:
      - uses: actions/checkout@v4
      - run: sudo apt-get update && sudo apt-get install -y jq curl
      - name: Compose up
        run: docker compose -f deploy/docker/docker-compose.yml up -d --build
      - name: Wait backend
        run: |
          for i in {1..40}; do curl -fsS http://localhost:5200/health/ready && break; sleep 2; [[ $i -eq 40 ]] && exit 1; done
      - name: Smoke
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
