-- Migration: Index HNSW + BM25 pour optimisation retrieval
-- Date: 2025-10-08
-- Objectif: Réduire latence retrieval avec index HNSW (ANN) + pré-filtre BM25

-- ============================================
-- 1. Créer index HNSW sur embeddings
-- ============================================

-- Drop index existant si présent
DROP INDEX IF EXISTS nbk.embeddings_vec_hnsw_idx;
DROP INDEX IF EXISTS nbk.embeddings_vec_cosine_idx;

-- Créer index HNSW optimisé
-- m=16: nombre de connexions par nœud (bon compromis qualité/performance)
-- ef_construction=200: qualité construction (plus = meilleur mais plus lent)
CREATE INDEX embeddings_vec_hnsw_idx 
ON nbk.embeddings 
USING hnsw (vec vector_cosine_ops)
WITH (m = 16, ef_construction = 200);

-- ============================================
-- 2. Créer colonne tsvector pour BM25
-- ============================================

-- Ajouter colonne tsvector si elle n'existe pas
ALTER TABLE nbk.chunks 
ADD COLUMN IF NOT EXISTS text_tsv tsvector;

-- Créer fonction de mise à jour tsvector
CREATE OR REPLACE FUNCTION nbk.chunks_text_tsv_update() 
RETURNS trigger AS $$
BEGIN
  NEW.text_tsv := to_tsvector('english', COALESCE(NEW.text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer trigger pour mise à jour automatique
DROP TRIGGER IF EXISTS chunks_text_tsv_trigger ON nbk.chunks;
CREATE TRIGGER chunks_text_tsv_trigger 
BEFORE INSERT OR UPDATE ON nbk.chunks
FOR EACH ROW 
EXECUTE FUNCTION nbk.chunks_text_tsv_update();

-- Remplir tsvector pour chunks existants
UPDATE nbk.chunks 
SET text_tsv = to_tsvector('english', COALESCE(text, ''))
WHERE text_tsv IS NULL;

-- Créer index GIN sur tsvector (pour BM25)
CREATE INDEX IF NOT EXISTS chunks_text_tsv_idx 
ON nbk.chunks 
USING gin(text_tsv);

-- ============================================
-- 3. Créer index additionnels pour performance
-- ============================================

-- Index sur document_id pour jointures rapides
CREATE INDEX IF NOT EXISTS chunks_document_id_idx 
ON nbk.chunks(document_id);

-- Index sur embeddings chunk_id
CREATE INDEX IF NOT EXISTS embeddings_chunk_id_idx 
ON nbk.embeddings(chunk_id);

-- ============================================
-- 4. Configuration HNSW ef_search
-- ============================================

-- Définir ef_search pour queries
-- Plus haut = plus précis mais plus lent (défaut=40)
-- On utilise 64 pour bon compromis
-- Cette valeur peut être override avec SET hnsw.ef_search = X;

COMMENT ON INDEX nbk.embeddings_vec_hnsw_idx IS 'HNSW index for fast ANN search (m=16, ef_construction=200, use ef_search=64 at runtime)';

-- ============================================
-- 5. Statistiques
-- ============================================

-- Analyser tables pour optimiser query planner
ANALYZE nbk.chunks;
ANALYZE nbk.embeddings;
ANALYZE nbk.documents;

-- ============================================
-- 6. Vérification
-- ============================================

-- Vérifier que les index sont créés
DO $$
DECLARE
  hnsw_count INTEGER;
  tsv_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO hnsw_count
  FROM pg_indexes
  WHERE schemaname = 'nbk' 
    AND indexname = 'embeddings_vec_hnsw_idx';
  
  SELECT COUNT(*) INTO tsv_count
  FROM pg_indexes
  WHERE schemaname = 'nbk' 
    AND indexname = 'chunks_text_tsv_idx';
  
  IF hnsw_count = 0 THEN
    RAISE EXCEPTION 'HNSW index not created!';
  END IF;
  
  IF tsv_count = 0 THEN
    RAISE EXCEPTION 'tsvector index not created!';
  END IF;
  
  RAISE NOTICE 'Migration successful: HNSW index (%) and tsvector index (%) created', hnsw_count, tsv_count;
END;
$$;
