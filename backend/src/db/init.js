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
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS nbk.embeddings (
        id SERIAL PRIMARY KEY,
        chunk_id INTEGER REFERENCES nbk.chunks(id) ON DELETE CASCADE,
        model VARCHAR(255),
        dim INTEGER,
        vec TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
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
    
    console.log("Database migrations completed successfully.");
  } catch (error) {
    console.error("Error running migrations:", error);
    process.exit(1);
  } finally {
    client.release();
  }
};

module.exports = { runMigrations };
