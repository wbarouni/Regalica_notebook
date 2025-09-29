-- Bloc 2: Rollback Ingestion & Embeddings

BEGIN;

DROP TABLE IF EXISTS nbk.embeddings CASCADE;
DROP TABLE IF EXISTS nbk.chunks CASCADE;
DROP TABLE IF EXISTS nbk.pages CASCADE;
DROP TABLE IF EXISTS nbk.documents CASCADE;

-- Optionnel: supprimer le schéma si vide
-- DROP SCHEMA IF EXISTS nbk CASCADE;

COMMIT;
