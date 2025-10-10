-- Rollback: Index HNSW + BM25
-- Date: 2025-10-08
-- Objectif: Revenir à l'état précédent si nécessaire

-- ============================================
-- 1. Supprimer index HNSW
-- ============================================

DROP INDEX IF EXISTS nbk.embeddings_vec_hnsw_idx;

-- ============================================
-- 2. Supprimer trigger et fonction tsvector
-- ============================================

DROP TRIGGER IF EXISTS chunks_text_tsv_trigger ON nbk.chunks;
DROP FUNCTION IF EXISTS nbk.chunks_text_tsv_update();

-- ============================================
-- 3. Supprimer index BM25
-- ============================================

DROP INDEX IF EXISTS nbk.chunks_text_tsv_idx;

-- ============================================
-- 4. Supprimer colonne tsvector
-- ============================================

ALTER TABLE nbk.chunks 
DROP COLUMN IF EXISTS text_tsv;

-- ============================================
-- 5. Supprimer index additionnels (si créés par cette migration)
-- ============================================

-- Note: On garde chunks_document_id_idx et embeddings_chunk_id_idx
-- car ils peuvent être utiles même sans HNSW

-- ============================================
-- 6. Recréer index basique cosine si besoin
-- ============================================

-- Créer un index ivfflat basique pour fallback
CREATE INDEX IF NOT EXISTS embeddings_vec_cosine_idx 
ON nbk.embeddings 
USING ivfflat (vec vector_cosine_ops)
WITH (lists = 100);

-- ============================================
-- 7. Statistiques
-- ============================================

ANALYZE nbk.chunks;
ANALYZE nbk.embeddings;

-- Vérification
DO $$
BEGIN
  RAISE NOTICE 'Rollback completed: HNSW and BM25 indexes removed';
END;
$$;
