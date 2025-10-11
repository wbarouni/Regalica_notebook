const pool = require("./pool");
const fs = require("fs");
const path = require("path");

const runMigrations = async () => {
  const client = await pool.connect();
  try {
    console.log("Running database migrations...");
    
    await client.query('CREATE SCHEMA IF NOT EXISTS nbk');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS nbk.documents (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        mime VARCHAR(255),
        bytes INTEGER,
        sha256 VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS nbk.pages (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES nbk.documents(id) ON DELETE CASCADE,
        page_no INTEGER NOT NULL,
        text TEXT,
        bbox_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS nbk.chunks (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES nbk.documents(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        text TEXT NOT NULL,
        tokens INTEGER,
        heading_path TEXT,
        span_start INTEGER,
        span_end INTEGER,
        page_no INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create embeddings table with proper vector type
    // Note: Using vector without dimension allows any dimension (pgvector 0.5.0+)
    // The dim column tracks the actual dimension for validation
    await client.query(`
      CREATE TABLE IF NOT EXISTS nbk.embeddings (
        id SERIAL PRIMARY KEY,
        chunk_id INTEGER REFERENCES nbk.chunks(id) ON DELETE CASCADE,
        model VARCHAR(255) NOT NULL,
        dim INTEGER NOT NULL,
        vec vector NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_chunk_embedding UNIQUE(chunk_id, model)
      )
    `);
    
    // HNSW index management
    // TECHNICAL CONSTRAINT: pgvector HNSW cannot be created on empty tables
    // This is a hard limitation of the HNSW algorithm implementation in pgvector
    // Solution: Check if embeddings exist, create index if present, skip if not
    // The index will be automatically created after first document upload via ensureHNSWIndex()
    
    const embeddingCount = await client.query(`
      SELECT COUNT(*) as count FROM nbk.embeddings
    `);
    
    const hasEmbeddings = parseInt(embeddingCount.rows[0].count) > 0;
    
    if (hasEmbeddings) {
      // Check if index already exists
      const indexCheck = await client.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'nbk' 
          AND tablename = 'embeddings' 
          AND indexname = 'embeddings_vec_hnsw_idx'
      `);
      
      if (indexCheck.rows.length === 0) {
        try {
          console.log('Creating HNSW index (embeddings present)');
          await client.query(`
            CREATE INDEX embeddings_vec_hnsw_idx 
            ON nbk.embeddings 
            USING hnsw (vec vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
          `);
          console.log('HNSW index created successfully');
        } catch (hnswError) {
          console.log('⚠️  HNSW index creation skipped:', hnswError.message);
          console.log('    Index will be created automatically after next document upload');
        }
      } else {
        console.log('HNSW index already exists');
      }
    } else {
      console.log('⚠️  HNSW index creation deferred (no embeddings yet)');
      console.log('    Index will be created automatically after first document upload');
    }
    
    // Add validation function for vector dimensions
    await client.query(`
      CREATE OR REPLACE FUNCTION nbk.validate_embedding_dimension()
      RETURNS TRIGGER AS $$
      BEGIN
        IF array_length(NEW.vec::real[], 1) != NEW.dim THEN
          RAISE EXCEPTION 'Vector dimension mismatch: expected %, got %', 
            NEW.dim, array_length(NEW.vec::real[], 1);
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Add trigger to validate dimensions on insert/update
    await client.query(`
      DROP TRIGGER IF EXISTS validate_embedding_dim_trigger ON nbk.embeddings;
      CREATE TRIGGER validate_embedding_dim_trigger
      BEFORE INSERT OR UPDATE ON nbk.embeddings
      FOR EACH ROW
      EXECUTE FUNCTION nbk.validate_embedding_dimension();
    `);
    
    // Create index on chunk_id for faster joins
    await client.query(`
      CREATE INDEX IF NOT EXISTS embeddings_chunk_id_idx 
      ON nbk.embeddings(chunk_id)
    `);
    
    // Verify pgvector extension and get version
    const vectorCheck = await client.query(`
      SELECT extname, extversion 
      FROM pg_extension 
      WHERE extname = 'vector'
    `);
    
    if (vectorCheck.rows.length === 0) {
      throw new Error('pgvector extension not found - vector operations will fail');
    }
    
    console.log(`pgvector extension verified: version ${vectorCheck.rows[0].extversion}`);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS nbk.rag_logs (
        id SERIAL PRIMARY KEY,
        query TEXT NOT NULL,
        answer TEXT,
        confidence FLOAT,
        processing_time INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create notebooks table for organizing documents
    await client.query(`
      CREATE TABLE IF NOT EXISTS nbk.notebooks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create junction table for notebook-document relationships
    await client.query(`
      CREATE TABLE IF NOT EXISTS nbk.notebook_documents (
        id SERIAL PRIMARY KEY,
        notebook_id INTEGER REFERENCES nbk.notebooks(id) ON DELETE CASCADE,
        document_id INTEGER REFERENCES nbk.documents(id) ON DELETE CASCADE,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_notebook_document UNIQUE(notebook_id, document_id)
      )
    `);
    
    // Create indexes for notebook queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS notebook_documents_notebook_id_idx 
      ON nbk.notebook_documents(notebook_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS notebook_documents_document_id_idx 
      ON nbk.notebook_documents(document_id)
    `);
    
    // Create notebook_sessions table for chat history
    await client.query(`
      CREATE TABLE IF NOT EXISTS nbk.notebook_sessions (
        id SERIAL PRIMARY KEY,
        notebook_id INTEGER REFERENCES nbk.notebooks(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        citations JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create index for notebook sessions
    await client.query(`
      CREATE INDEX IF NOT EXISTS notebook_sessions_notebook_id_idx 
      ON nbk.notebook_sessions(notebook_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS notebook_sessions_created_at_idx 
      ON nbk.notebook_sessions(created_at DESC)
    `);
    
    console.log("Database migrations completed successfully.");
  } catch (error) {
    console.error("Error running migrations:", error);
    process.exit(1);
  } finally {
    client.release();
  }
};

/**
 * Create or rebuild HNSW index for embeddings table
 * This should be called after the first embeddings are inserted
 * @param {number} dimension - The vector dimension (optional, will be detected from existing embeddings)
 */
const ensureHNSWIndex = async (dimension = null) => {
  const client = await pool.connect();
  try {
    // If dimension not provided, detect from existing embeddings
    if (!dimension) {
      const embeddingCheck = await client.query(`
        SELECT dim FROM nbk.embeddings LIMIT 1
      `);
      
      if (embeddingCheck.rows.length === 0) {
        console.log('[HNSW] No embeddings found - cannot create index yet');
        return { created: false, reason: 'no_embeddings' };
      }
      
      dimension = embeddingCheck.rows[0].dim;
    }
    
    console.log(`[HNSW] Ensuring index exists for dimension ${dimension}`);
    
    // Check if index already exists
    const indexCheck = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'nbk' 
        AND tablename = 'embeddings' 
        AND indexname = 'embeddings_vec_hnsw_idx'
    `);
    
    if (indexCheck.rows.length > 0) {
      console.log('[HNSW] Index already exists');
      return { created: false, reason: 'already_exists', dimension };
    }
    
    // Create HNSW index
    await client.query(`
      CREATE INDEX embeddings_vec_hnsw_idx 
      ON nbk.embeddings 
      USING hnsw (vec vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);
    
    console.log(`[HNSW] Index created successfully for dimension ${dimension}`);
    return { created: true, dimension };
    
  } catch (error) {
    console.error(`[HNSW] Error creating index: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { runMigrations, ensureHNSWIndex };
