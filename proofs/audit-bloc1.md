# Audit Bloc 1 - Regalica Notebook JS

## Arborescence du projet

```
.
├── .env.example
├── .github/
│   └── CODEOWNERS
├── CI-WORKFLOW.md
├── CONTRIBUTING.md
├── Makefile
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       └── server.js
├── deploy/
│   └── docker/
│       ├── docker-compose.yml
│       └── initdb/
│           └── 01-extensions.sql
├── frontend/
│   ├── Dockerfile
│   ├── angular.json
│   ├── package.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.component.html
│   │   │   ├── app.component.scss
│   │   │   ├── app.component.ts
│   │   │   ├── app.config.ts
│   │   │   └── app.routes.ts
│   │   ├── assets/
│   │   ├── favicon.ico
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── styles.scss
│   ├── tailwind.config.js
│   ├── tests/
│   │   └── e2e/
│   │       ├── app.spec.ts
│   │       └── playwright.config.ts
│   ├── tsconfig.app.json
│   ├── tsconfig.json
│   └── tsconfig.spec.json
├── proofs/
│   ├── SHA256SUMS.txt
│   ├── healthcheck.log
│   ├── ollama-tags.json
│   ├── quality-check.log
│   ├── screenshot-backend-ready.txt
│   └── screenshot-frontend.txt
├── scripts/
│   ├── denylist.sh
│   ├── dev-reset.sh
│   ├── first-run.sh
│   ├── healthcheck.sh
│   ├── quality-check.sh
│   └── smoke.sh
└── tests/
    └── fixtures/
        └── sample.pdf
```

## deploy/docker/docker-compose.yml
```yaml
version: "3.8"
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: notebook
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    healthcheck:
      test: ["CMD-SHELL","pg_isready -U postgres -d notebook"]
      interval: 5s
      timeout: 5s
      retries: 30
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  ollama:
    image: ollama/ollama:latest
    ports: ["11434:11434"]
    healthcheck:
      test: ["CMD","curl","-fsS","http://localhost:11434/api/version"]
      interval: 5s
      timeout: 5s
      retries: 120

  backend:
    build: ../../backend
    environment:
      PORT: 8080
    ports: ["8080:8080"]
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_started }
      ollama: { condition: service_healthy }

  frontend:
    build: ../../frontend
    ports: ["4200:80"]
    depends_on: [ backend ]
```

## backend/Dockerfile
```dockerfile
FROM node:lts-alpine

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci --only=production

# Copier le code source
COPY . .

EXPOSE 8080
# Démarrer l'application (un seul CMD)
CMD ["node", "src/server.js"]
```

## backend/package.json
```json
{
  "name": "regalica-notebook-backend",
  "version": "0.1.0",
  "description": "Backend Express JS pour Regalica Notebook",
  "main": "server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "pg": "^8.11.3",
    "redis": "^4.6.10",
    "multer": "^1.4.5-lts.1",
    "uuid": "^9.0.1"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "author": "Regalica Team",
  "license": "MIT"
}
```

## backend/src/server.js
```javascript
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();

// Configuration depuis les variables d'environnement
const PORT = process.env.PORT_BACKEND || 8080;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:4200';

// Créer le dossier uploads s'il n'existe pas
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuration multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accepter seulement les fichiers PDF
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers PDF sont acceptés'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

// Store en mémoire pour les sources (en production, utiliser une base de données)
const sources = new Map();

// Middleware
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true
}));

app.use(express.json());

// Route de healthcheck obligatoire
app.get('/health/ready', (req, res) => {
  res.json({ status: 'ready' });
});

// Route de base
app.get('/', (req, res) => {
  res.json({ 
    message: 'Regalica Notebook Backend',
    version: '0.1.0',
    status: 'running'
  });
});

// Endpoint pour uploader des sources (PDF)
app.post('/sources', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const sourceId = uuidv4();
    const sourceData = {
      source_id: sourceId,
      filename: req.file.originalname,
      filepath: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploaded_at: new Date().toISOString()
    };

    // Stocker les métadonnées de la source
    sources.set(sourceId, sourceData);

    console.log(`Source uploaded: ${sourceData.filename} (${sourceId})`);

    res.json({
      source_id: sourceId,
      filename: req.file.originalname,
      size: req.file.size,
      status: 'uploaded'
    });

  } catch (error) {
    console.error('Error uploading source:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload' });
  }
});

// Endpoint pour poser des questions sur les sources
app.post('/chat/ask', (req, res) => {
  try {
    const { message, source_id } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message requis' });
    }

    if (!source_id) {
      return res.status(400).json({ error: 'source_id requis' });
    }

    // Vérifier que la source existe
    const source = sources.get(source_id);
    if (!source) {
      return res.status(404).json({ error: 'Source non trouvée' });
    }

    // Simulation d'une réponse basée sur le document
    // En production, ici on ferait appel à Ollama pour analyser le PDF
    const simulatedAnswer = generateSimulatedAnswer(message, source);

    console.log(`Chat question: "${message}" for source ${source_id}`);

    res.json({
      answer: simulatedAnswer,
      source_id: source_id,
      message: message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing chat question:', error);
    res.status(500).json({ error: 'Erreur lors du traitement de la question' });
  }
});

// Fonction pour générer une réponse simulée
function generateSimulatedAnswer(message, source) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('titre') || lowerMessage.includes('title')) {
    return `Le document "${source.filename}" semble être un fichier PDF de test. Le titre exact nécessiterait une analyse plus approfondie du contenu.`;
  }
  
  if (lowerMessage.includes('contenu') || lowerMessage.includes('content')) {
    return `Ce document PDF contient du texte de test. Pour une analyse détaillée, l'intégration avec Ollama permettrait d'extraire et d'analyser le contenu complet.`;
  }
  
  if (lowerMessage.includes('taille') || lowerMessage.includes('size')) {
    return `Le document fait ${Math.round(source.size / 1024)} KB.`;
  }
  
  // Réponse générique
  return `J'ai reçu votre question "${message}" concernant le document "${source.filename}". En mode simulation, je peux confirmer que le document a été traité et est disponible pour analyse. L'intégration complète avec Ollama permettrait des réponses plus précises basées sur le contenu réel du PDF.`;
}

// Endpoint pour lister les sources
app.get('/sources', (req, res) => {
  const sourcesList = Array.from(sources.values()).map(source => ({
    source_id: source.source_id,
    filename: source.filename,
    size: source.size,
    uploaded_at: source.uploaded_at
  }));
  
  res.json({ sources: sourcesList });
});

// Gestion des erreurs multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Fichier trop volumineux (max 10MB)' });
    }
  }
  
  if (error.message === 'Seuls les fichiers PDF sont acceptés') {
    return res.status(400).json({ error: error.message });
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Démarrage du serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`CORS origin: ${CORS_ORIGIN}`);
  console.log(`Uploads directory: ${uploadsDir}`);
});
```

## frontend/angular.json
```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "regalica-frontend": {
      "projectType": "application",
      "schematics": {
        "@schematics/angular:component": {
          "style": "scss"
        }
      },
      "root": "",
      "sourceRoot": "src",
      "prefix": "app",
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:browser",
          "options": {
            "outputPath": "dist/regalica-frontend",
            "index": "src/index.html",
            "main": "src/main.ts",
            "polyfills": [],
            "tsConfig": "tsconfig.app.json",
            "inlineStyleLanguage": "scss",
            "assets": [
              "src/favicon.ico",
              "src/assets"
            ],
            "styles": [
              "src/styles.scss"
            ],
            "scripts": []
          },
          "configurations": {
            "production": {
              "budgets": [
                {
                  "type": "initial",
                  "maximumWarning": "500kb",
                  "maximumError": "1mb"
                },
                {
                  "type": "anyComponentStyle",
                  "maximumWarning": "2kb",
                  "maximumError": "4kb"
                }
              ],
              "outputHashing": "all"
            },
            "development": {
              "buildOptimizer": false,
              "optimization": false,
              "vendorChunk": true,
              "extractLicenses": false,
              "sourceMap": true,
              "namedChunks": true
            }
          },
          "defaultConfiguration": "production"
        },
        "serve": {
          "builder": "@angular-devkit/build-angular:dev-server",
          "configurations": {
            "production": {
              "buildTarget": "regalica-frontend:build:production"
            },
            "development": {
              "buildTarget": "regalica-frontend:build:development"
            }
          },
          "defaultConfiguration": "development"
        },
        "extract-i18n": {
          "builder": "@angular-devkit/build-angular:extract-i18n",
          "options": {
            "buildTarget": "regalica-frontend:build"
          }
        },
        "test": {
          "builder": "@angular-devkit/build-angular:karma",
          "options": {
            "polyfills": [],
            "tsConfig": "tsconfig.spec.json",
            "inlineStyleLanguage": "scss",
            "assets": [
              "src/favicon.ico",
              "src/assets"
            ],
            "styles": [
              "src/styles.scss"
            ],
            "scripts": []
          }
        }
      }
    }
  }
}
```

## frontend/package.json
```json
{
  "name": "regalica-frontend",
  "version": "0.1.0",
  "scripts": {
    "ng": "ng",
    "start": "ng serve --host 0.0.0.0 --port 4200",
    "build": "ng build",
    "watch": "ng build --watch --configuration development",
    "test": "ng test",
    "e2e": "npx playwright test"
  },
  "private": true,
  "dependencies": {
    "@angular/animations": "^17.0.0",
    "@angular/common": "^17.0.0",
    "@angular/compiler": "^17.0.0",
    "@angular/core": "^17.0.0",
    "@angular/forms": "^17.0.0",
    "@angular/platform-browser": "^17.0.0",
    "@angular/platform-browser-dynamic": "^17.0.0",
    "@angular/router": "^17.0.0",
    "rxjs": "~7.8.0",
    "tslib": "^2.3.0",
    "zone.js": "~0.14.0"
  },
  "devDependencies": {
    "@angular-devkit/build-angular": "^17.0.0",
    "@angular/cli": "^17.0.0",
    "@angular/compiler-cli": "^17.0.0",
    "@playwright/test": "^1.40.0",
    "@types/jasmine": "~5.1.0",
    "jasmine-core": "~5.1.0",
    "karma": "~6.4.0",
    "karma-chrome-headless": "~3.1.0",
    "karma-coverage": "~2.2.0",
    "karma-jasmine": "~5.1.0",
    "karma-jasmine-html-reporter": "~2.1.0",
    "tailwindcss": "^3.3.0",
    "typescript": "~5.2.0"
  }
}
```

## frontend/src/main.ts
```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
```

## frontend/src/app/app.component.ts
```typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Regalica Notebook JS';
}
```

## frontend/src/app/app.component.html
```html
<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
  <!-- Header -->
  <header class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <div class="flex items-center">
          <svg class="h-8 w-8 text-indigo-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <h1 class="text-xl font-semibold text-gray-900">{{ title }}</h1>
        </div>
        <div class="flex items-center space-x-4">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            v0.1.0
          </span>
        </div>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
    <div class="text-center">
      <div class="mx-auto max-w-md">
        <svg class="mx-auto h-24 w-24 text-indigo-500 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
      </div>
      
      <h2 class="text-4xl font-bold text-gray-900 mb-4">
        Regalica Notebook JS – Skeleton OK
      </h2>
      
      <p class="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
        Application de notebook intelligent, entièrement auto-hébergée et fonctionnant sur des infrastructures standards (CPU-only).
      </p>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
        <!-- Backend Status -->
        <div class="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div class="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-4">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12l5 5L20 7"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Backend Express</h3>
          <p class="text-sm text-gray-600">API REST avec endpoints /health/ready, /sources, /chat/ask</p>
        </div>

        <!-- Frontend Status -->
        <div class="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div class="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-4">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Frontend Angular 17</h3>
          <p class="text-sm text-gray-600">Interface moderne avec Tailwind CSS et architecture standalone</p>
        </div>

        <!-- Infrastructure Status -->
        <div class="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div class="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-4">
            <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Infrastructure Docker</h3>
          <p class="text-sm text-gray-600">PostgreSQL, Redis, Ollama avec healthchecks automatiques</p>
        </div>
      </div>

      <div class="mt-12">
        <div class="bg-white rounded-lg shadow-md p-6 border border-gray-200 max-w-2xl mx-auto">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Prochaines étapes</h3>
          <div class="text-left space-y-2">
            <div class="flex items-center">
              <svg class="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
              </svg>
              <span class="text-sm text-gray-600">Walking skeleton complet</span>
            </div>
            <div class="flex items-center">
              <svg class="w-4 h-4 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" fill="none"></circle>
              </svg>
              <span class="text-sm text-gray-600">Interface utilisateur avancée</span>
            </div>
            <div class="flex items-center">
              <svg class="w-4 h-4 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" fill="none"></circle>
              </svg>
              <span class="text-sm text-gray-600">Intégration Ollama complète</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="bg-white border-t border-gray-200 mt-16">
    <div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div class="text-center text-sm text-gray-500">
        <p>&copy; 2025 Regalica Team. Notebook intelligent auto-hébergé.</p>
      </div>
    </div>
  </footer>
</div>

<router-outlet></router-outlet>
```

## frontend/src/app/app.component.scss
```scss
// Styles spécifiques au composant principal
// Tailwind CSS gère la plupart du styling via les classes utilitaires
```

## scripts/smoke.sh
```bash
#!/usr/bin/env bash
set -euo pipefail

echo "[smoke] wait backend…"
for i in {1..40}; do
  curl -fsS http://localhost:8080/health/ready && break
  sleep 2
  [[ $i -eq 40 ]] && { echo "backend KO"; exit 1; }
done

echo "[smoke] upload sample.pdf"
SRC_JSON=$(curl -fsS -F file=@tests/fixtures/sample.pdf http://localhost:8080/sources)
echo "$SRC_JSON"
SRC_ID=$(echo "$SRC_JSON" | jq -r .source_id)

echo "[smoke] ask chat"
curl -fsS -H 'Content-Type: application/json' \
  -d "{\"message\":\"Quel est le titre ?\",\"source_id\":\"$SRC_ID\"}" \
  http://localhost:8080/chat/ask | tee /tmp/smoke.json

jq -e '.answer' /tmp/smoke.json >/dev/null
echo "✅ smoke OK"
```

## Makefile
```makefile
.PHONY: up down reset check smoke
up:
	docker compose -f deploy/docker/docker-compose.yml up -d
down:
	docker compose -f deploy/docker/docker-compose.yml down

reset:
	./scripts/dev-reset.sh

check:
	./scripts/denylist.sh && ./scripts/healthcheck.sh

smoke:
	./scripts/smoke.sh
```

## .env.example
```env
# Backend Configuration
PORT_BACKEND=8080
CORS_ORIGIN=http://localhost:4200

# Database Configuration
POSTGRES_DB=notebook
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Ollama Configuration
OLLAMA_HOST=localhost
OLLAMA_PORT=11434
```
