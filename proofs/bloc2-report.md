# Rapport de Preuves - Bloc 2: Pipeline d'Ingestion

## 1. Description de la Pipeline

La pipeline d'ingestion du Bloc 2 est conçue pour traiter des documents multi-formats (PDF, DOCX, HTML, TXT) et les transformer en chunks sémantiques avec embeddings pour la recherche vectorielle. Elle suit les étapes suivantes :

1.  **Upload & Validation** : Le fichier est uploadé via une API REST, sa taille et son type MIME sont validés.
2.  **SHA-256 Hashing** : Un hash SHA-256 est calculé pour détecter les doublons et éviter la ré-ingestion.
3.  **Extraction de Texte** : Le texte brut est extrait en utilisant des bibliothèques spécialisées pour chaque format.
4.  **Normalisation** : Le texte est structuré en sections avec des chemins de titres (`heading_path`).
5.  **Chunking Hybride** : Les sections sont découpées en chunks avec une stratégie structurelle et sémantique, incluant un overlap configurable.
6.  **Génération d'Embeddings** : Des embeddings sont générés pour chaque chunk en utilisant un modèle configurable (e5 ou nomic).
7.  **Persistance Transactionnelle** : Toutes les données (document, pages, chunks, embeddings) sont stockées dans une base de données PostgreSQL avec pgvector de manière transactionnelle.

## 2. Schéma des Tables

Le schéma `nbk` a été créé pour héberger les données d'ingestion :

-   `nbk.documents` : Stocke les métadonnées des documents sources.
-   `nbk.pages` : Contient le texte extrait par page pour les PDFs.
-   `nbk.chunks` : Stocke les chunks de texte avec leurs métadonnées de citation.
-   `nbk.embeddings` : Contient les vecteurs d'embeddings pour chaque chunk.

Des index ont été créés sur `sha256`, `document_id`, `seq`, et les vecteurs pour optimiser les performances.

## 3. Captures d'Interface Utilisateur

L'interface utilisateur du module Sources a été développée pour permettre l'upload, la liste, le filtrage et la consultation des documents et de leurs chunks.

*(Des captures d'écran seront ajoutées ici après le déploiement et les tests E2E)*

## 4. Échantillon de Réponses API

### POST /ingest/upload

```json
{
  "document": {
    "id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    "title": "test.pdf",
    "mime": "application/pdf",
    "bytes": 123456,
    "created_at": "2025-09-29T12:00:00.000Z"
  },
  "stats": {
    "pages": 10,
    "chunks": 50,
    "embed_ms_total": 1500
  }
}
```

### GET /ingest/:docId/chunks

```json
{
  "chunks": [
    {
      "id": "...",
      "seq": 1,
      "heading_path": ["Introduction"],
      "tokens": 250,
      "span_start": 100,
      "span_end": 1100,
      "page_no": 1,
      "text": "..."
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 1,
    "total": 50,
    "totalPages": 50
  }
}
```

## 5. Métriques de Performance

Les métriques de performance seront mesurées à l'aide du script `scripts/bench_ingest.sh`.

-   **Temps d'ingestion E2E** : Mesure du temps total entre la requête d'upload et la réponse.
-   **Temps d'embedding par chunk** : Mesuré dans les logs du backend.

*(Les résultats des benchmarks seront ajoutés ici après les tests)*

## 6. Indicateurs de Volumétrie

Les statistiques de volumétrie (nombre de pages, chunks) sont retournées par l'API d'upload et visibles dans l'interface utilisateur.

