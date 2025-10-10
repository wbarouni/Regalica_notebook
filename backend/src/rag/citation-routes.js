const express = require('express');
const pool = require('../db/pool');
const config = require('../config');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /rag/citation/preview/:chunk_id
 * Récupère le contexte complet d'un chunk pour prévisualisation
 */
router.get('/preview/:chunk_id', async (req, res) => {
  const { chunk_id } = req.params;
  const client = await pool.connect();
  
  try {
    logger.info(`[rag/citation-routes] GET /preview/${chunk_id}`);
    
    const result = await client.query(`
      SELECT 
        c.chunk_id,
        c.document_id,
        c.text,
        c.tokens,
        c.span_start,
        c.span_end,
        c.page_no,
        c.heading_path,
        d.title as document_title,
        d.filename,
        d.mime_type,
        d.uploaded_at
      FROM ${config.dbSchema}.chunks c
      JOIN ${config.dbSchema}.documents d ON c.document_id = d.document_id
      WHERE c.chunk_id = $1
    `, [chunk_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'CHUNK_NOT_FOUND',
        message: 'Chunk non trouvé'
      });
    }

    const chunk = result.rows[0];
    
    res.json({
      chunk_id: chunk.chunk_id,
      document: {
        id: chunk.document_id,
        title: chunk.document_title,
        filename: chunk.filename,
        mime_type: chunk.mime_type,
        uploaded_at: chunk.uploaded_at
      },
      content: {
        text: chunk.text,
        tokens: chunk.tokens,
        page: chunk.page_no,
        heading_path: chunk.heading_path,
        span_start: chunk.span_start,
        span_end: chunk.span_end
      }
    });

  } catch (error) {
    logger.error(`[rag/citation-routes] Erreur /preview/${chunk_id}: ${error.message}`);
    res.status(500).json({
      error: 'PREVIEW_FAILED',
      message: 'Erreur lors de la récupération du chunk'
    });
  } finally {
    client.release();
  }
});

/**
 * GET /rag/citation/locate/:chunk_id
 * Récupère la position d'un chunk dans le document original (pour navigation)
 */
router.get('/locate/:chunk_id', async (req, res) => {
  const { chunk_id } = req.params;
  const client = await pool.connect();
  
  try {
    logger.info(`[rag/citation-routes] GET /locate/${chunk_id}`);
    
    const result = await client.query(`
      SELECT 
        c.chunk_id,
        c.document_id,
        c.page_no,
        c.span_start,
        c.span_end,
        d.title,
        d.filename
      FROM ${config.dbSchema}.chunks c
      JOIN ${config.dbSchema}.documents d ON c.document_id = d.document_id
      WHERE c.chunk_id = $1
    `, [chunk_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'CHUNK_NOT_FOUND',
        message: 'Chunk non trouvé'
      });
    }

    const chunk = result.rows[0];
    
    res.json({
      chunk_id: chunk.chunk_id,
      document_id: chunk.document_id,
      document_title: chunk.title,
      document_filename: chunk.filename,
      location: {
        page: chunk.page_no,
        span_start: chunk.span_start,
        span_end: chunk.span_end
      }
    });

  } catch (error) {
    logger.error(`[rag/citation-routes] Erreur /locate/${chunk_id}: ${error.message}`);
    res.status(500).json({
      error: 'LOCATE_FAILED',
      message: 'Erreur lors de la localisation du chunk'
    });
  } finally {
    client.release();
  }
});

/**
 * POST /rag/citation/batch-preview
 * Récupère plusieurs chunks en une seule requête (optimisation)
 */
router.post('/batch-preview', async (req, res) => {
  const { chunk_ids } = req.body;
  
  if (!Array.isArray(chunk_ids) || chunk_ids.length === 0) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'chunk_ids doit être un array non vide'
    });
  }

  if (chunk_ids.length > 20) {
    return res.status(400).json({
      error: 'TOO_MANY_IDS',
      message: 'Maximum 20 chunks par requête'
    });
  }

  const client = await pool.connect();
  
  try {
    logger.info(`[rag/citation-routes] POST /batch-preview: ${chunk_ids.length} chunks`);
    
    const result = await client.query(`
      SELECT 
        c.chunk_id,
        c.document_id,
        c.text,
        c.page_no,
        d.title as document_title,
        d.filename
      FROM ${config.dbSchema}.chunks c
      JOIN ${config.dbSchema}.documents d ON c.document_id = d.document_id
      WHERE c.chunk_id = ANY($1)
    `, [chunk_ids]);

    const chunks = result.rows.map(row => ({
      chunk_id: row.chunk_id,
      document_id: row.document_id,
      document_title: row.document_title,
      document_filename: row.filename,
      text: row.text,
      page: row.page_no
    }));

    res.json({
      chunks,
      count: chunks.length
    });

  } catch (error) {
    logger.error(`[rag/citation-routes] Erreur /batch-preview: ${error.message}`);
    res.status(500).json({
      error: 'BATCH_PREVIEW_FAILED',
      message: 'Erreur lors de la récupération des chunks'
    });
  } finally {
    client.release();
  }
});

module.exports = router;
