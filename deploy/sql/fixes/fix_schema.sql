-- Drop existing tables
DROP TABLE IF EXISTS nbk.embeddings CASCADE;
DROP TABLE IF EXISTS nbk.chunks CASCADE;
DROP TABLE IF EXISTS nbk.pages CASCADE;
DROP TABLE IF EXISTS nbk.documents CASCADE;

-- Recreate with correct schema
CREATE TABLE nbk.documents (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    mime TEXT NOT NULL,
    bytes BIGINT NOT NULL,
    sha256 CHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE nbk.pages (
    id SERIAL PRIMARY KEY,
    doc_id INTEGER NOT NULL REFERENCES nbk.documents(id) ON DELETE CASCADE,
    page_no INT NOT NULL,
    text TEXT NOT NULL,
    bbox_json JSONB
);

CREATE TABLE nbk.chunks (
    id SERIAL PRIMARY KEY,
    doc_id INTEGER NOT NULL REFERENCES nbk.documents(id) ON DELETE CASCADE,
    seq INT NOT NULL,
    text TEXT NOT NULL,
    tokens INT NOT NULL,
    heading_path TEXT[] NOT NULL DEFAULT '{}',
    span_start INT NOT NULL,
    span_end INT NOT NULL,
    page_no INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE nbk.embeddings (
    id SERIAL PRIMARY KEY,
    chunk_id INTEGER NOT NULL UNIQUE REFERENCES nbk.chunks(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    dim INT NOT NULL,
    vec VECTOR(1024) NOT NULL
);

-- Create indexes
CREATE INDEX chunks_doc_seq_idx ON nbk.chunks (doc_id, seq);
CREATE INDEX documents_sha256_idx ON nbk.documents (sha256);
CREATE INDEX embeddings_vec_idx ON nbk.embeddings USING ivfflat (vec vector_cosine_ops) WITH (lists = 100);
