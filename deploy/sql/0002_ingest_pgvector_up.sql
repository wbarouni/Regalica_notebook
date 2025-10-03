-- Bloc 2: Ingestion & Embeddings

BEGIN;

-- 1. Créer le schéma s'il n'existe pas
CREATE SCHEMA IF NOT EXISTS nbk;

-- 2. Activer l'extension vector
CREATE EXTENSION IF NOT EXISTS "vector";

-- 3. Table des documents sources
CREATE TABLE IF NOT EXISTS nbk.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    mime TEXT NOT NULL,
    bytes BIGINT NOT NULL,
    sha256 CHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Table des pages extraites (pour PDF)
CREATE TABLE IF NOT EXISTS nbk.pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES nbk.documents(id) ON DELETE CASCADE,
    page_no INT NOT NULL,
    text TEXT NOT NULL,
    bbox_json JSONB
);

-- 5. Table des chunks
CREATE TABLE IF NOT EXISTS nbk.chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES nbk.documents(id) ON DELETE CASCADE,
    seq INT NOT NULL,
    text TEXT NOT NULL,
    tokens INT NOT NULL,
    heading_path TEXT[] NOT NULL DEFAULT 	'{}',
    span_start INT NOT NULL,
    span_end INT NOT NULL,
    page_no INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Table des embeddings
CREATE TABLE IF NOT EXISTS nbk.embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id UUID NOT NULL UNIQUE REFERENCES nbk.chunks(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    dim INT NOT NULL,
    -- Dimension fix: pgvector requires an explicit dimension for IVF indexes
    vec VECTOR(1024) NOT NULL
);

-- 7. Créer les index
CREATE INDEX IF NOT EXISTS embeddings_vec_idx ON nbk.embeddings USING ivfflat (vec vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS chunks_doc_seq_idx ON nbk.chunks (document_id, seq);
CREATE INDEX IF NOT EXISTS documents_sha256_idx ON nbk.documents (sha256);

COMMIT;
