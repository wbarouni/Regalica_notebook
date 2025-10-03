const axios = require('axios');
const pool = require('../db/pool');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Génère un embedding pour une requête utilisateur
 * @param {string} query - La requête utilisateur
 * @returns {Promise<{vector: number[], dim: number}>}
 */
async function embedQuery(query) {
  if (!query || !query.trim()) {
    throw new Error('Requête vide');
  }

  const startTime = Date.now();
  
  try {
    logger.info(`[rag/query] Génération embedding pour requête: "${query.substring(0, 100)}..."`);
    
    // Use Ollama directly for embeddings
    const response = await axios.post(`${config.embedApiUrl}/api/embeddings`, {
      model: 'nomic-embed-text:latest',
      prompt: query.trim()
    }, {
      timeout: 30000
    });

    const { embedding } = response.data;
    
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Réponse embedding invalide');
    }

    const processingTime = Date.now() - startTime;
    const dim = embedding.length;
    logger.info(`[rag/query] Embedding généré en ${processingTime}ms, dim=${dim}`);

    return {
      vector: embedding,
      dim: dim
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[rag/query] Erreur génération embedding (${processingTime}ms): ${error.message}`);
    
    if (error.response) {
      logger.error(`[rag/query] Réponse API: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    
    throw new Error(`Génération embedding échouée: ${error.message}`);
  }
}

/**
 * Récupère les candidats les plus similaires via recherche vectorielle
 * @param {number[]} embedding - Le vecteur de la requête
 * @param {number} topK - Nombre de candidats à récupérer
 * @returns {Promise<Array>} - Liste des candidats avec métadonnées
 */
async function retrieveCandidates(embedding, topK = 50) {
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error('Embedding invalide');
  }

  if (topK <= 0 || topK > 200) {
    throw new Error('topK doit être entre 1 et 200');
  }

  const startTime = Date.now();
  const client = await pool.connect();

  try {
    logger.info(`[rag/query] Recherche des ${topK} meilleurs candidats`);

    // Requête SQL avec similarité cosinus (1 - cosine_distance)
    const query = `
      SELECT 
        c.id as chunk_id,
        c.document_id,
        c.text,
        c.tokens,
        c.heading_path,
        c.span_start,
        c.span_end,
        c.page_no,
        d.title as document_title,
        d.mime as document_mime,
        d.bytes as document_bytes,
        d.created_at as document_created_at,
        (1 - (e.vec <=> $1::vector)) as score_cosine
      FROM ${config.dbSchema}.chunks c
      JOIN ${config.dbSchema}.documents d ON c.document_id = d.id
      JOIN ${config.dbSchema}.embeddings e ON c.id = e.chunk_id
      ORDER BY e.vec <=> $1::vector
      LIMIT $2
    `;

    const result = await client.query(query, [JSON.stringify(embedding), topK]);
    
    const candidates = result.rows.map(row => ({
      chunk_id: row.chunk_id,
      document_id: row.document_id,
      text: row.text,
      tokens: row.tokens,
      heading_path: row.heading_path,
      span_start: row.span_start,
      span_end: row.span_end,
      page_no: row.page_no,
      document_title: row.document_title,
      document_mime: row.document_mime,
      document_bytes: row.document_bytes,
      document_created_at: row.document_created_at,
      score_cosine: parseFloat(row.score_cosine)
    }));

    const processingTime = Date.now() - startTime;
    logger.info(`[rag/query] ${candidates.length} candidats récupérés en ${processingTime}ms`);
    
    if (candidates.length > 0) {
      const scores = candidates.map(c => c.score_cosine);
      logger.info(`[rag/query] Scores cosinus: min=${Math.min(...scores).toFixed(4)}, max=${Math.max(...scores).toFixed(4)}, avg=${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(4)}`);
    }

    return candidates;

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[rag/query] Erreur récupération candidats (${processingTime}ms): ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Pipeline complète de récupération: embedding + recherche vectorielle
 * @param {string} query - La requête utilisateur
 * @param {number} topK - Nombre de candidats à récupérer
 * @returns {Promise<{candidates: Array, embedding: Object, stats: Object}>}
 */
async function retrieveForQuery(query, topK = 50) {
  const startTime = Date.now();
  
  try {
    logger.info(`[rag/query] Pipeline de récupération pour: "${query.substring(0, 100)}..."`);

    // 1. Générer l'embedding de la requête
    const embeddingResult = await embedQuery(query);
    
    // 2. Récupérer les candidats
    const candidates = await retrieveCandidates(embeddingResult.vector, topK);
    
    const totalTime = Date.now() - startTime;
    const stats = {
      total_time_ms: totalTime,
      candidates_count: candidates.length,
      embedding_dim: embeddingResult.dim,
      top_k: topK
    };

    logger.info(`[rag/query] Pipeline terminée en ${totalTime}ms: ${candidates.length} candidats`);

    return {
      candidates,
      embedding: embeddingResult,
      stats
    };

  } catch (error) {
    const totalTime = Date.now() - startTime;
    logger.error(`[rag/query] Erreur pipeline récupération (${totalTime}ms): ${error.message}`);
    throw error;
  }
}

module.exports = {
  embedQuery,
  retrieveCandidates,
  retrieveForQuery
};
