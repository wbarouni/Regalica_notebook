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

  // Enhanced input validation
  const trimmedQuery = query.trim();
  const MAX_QUERY_LENGTH = 5000;
  
  if (trimmedQuery.length > MAX_QUERY_LENGTH) {
    throw new Error(`Requête trop longue: ${trimmedQuery.length} caractères (max: ${MAX_QUERY_LENGTH})`);
  }
  
  // Validate query doesn't contain only special characters
  if (!/[a-zA-Z0-9]/.test(trimmedQuery)) {
    throw new Error('Requête invalide: doit contenir au moins un caractère alphanumérique');
  }

  const startTime = Date.now();
  
  try {
    logger.info(`[rag/query] Génération embedding pour requête: "${trimmedQuery.substring(0, 100)}..."`);
    
    // Use embedder microservice with circuit breaker logic
    const response = await axios.post(`${config.embedApiUrl}/embed`, {
      texts: [trimmedQuery]
    }, {
      timeout: 30000,
      maxRetries: 2,
      validateStatus: (status) => status >= 200 && status < 500
    });
    
    if (response.status !== 200) {
      throw new Error(`Embedder API error: ${response.status} - ${JSON.stringify(response.data)}`);
    }

    const { vectors, dim } = response.data;
    const embedding = vectors[0];
    
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Réponse embedding invalide');
    }

    const processingTime = Date.now() - startTime;
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
 * @param {Object} options - Options de filtrage (minScore, docIds, etc.)
 * @returns {Promise<Array>} - Liste des candidats avec métadonnées
 */
async function retrieveCandidates(embedding, topK = 50, options = {}) {
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error('Embedding invalide');
  }
  
  // Enhanced validation for embedding vector
  if (embedding.length === 0 || embedding.length > 2048) {
    throw new Error(`Dimension d'embedding invalide: ${embedding.length} (attendu: 1-2048)`);
  }
  
  // Validate all values are finite numbers
  if (!embedding.every(val => typeof val === 'number' && isFinite(val))) {
    throw new Error('Embedding contient des valeurs non numériques ou infinies');
  }
  
  // Validate vector is normalized (L2 norm should be ~1.0)
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (Math.abs(norm - 1.0) > 0.1) {
    logger.warn(`[rag/query] Embedding non normalisé: norme=${norm.toFixed(4)}`);
  }

  if (topK <= 0 || topK > 200) {
    throw new Error('topK doit être entre 1 et 200');
  }
  
  const { minScore = 0.1, docIds = null } = options;

  const startTime = Date.now();
  const client = await pool.connect();

  try {
    logger.info(`[rag/query] Recherche des ${topK} meilleurs candidats`);

    // Validate schema name to prevent SQL injection (whitelist approach)
    const validSchemas = ['nbk', 'public'];
    if (!validSchemas.includes(config.dbSchema)) {
      throw new Error(`Invalid schema name: ${config.dbSchema}`);
    }

    // Formater l'embedding pour pgvector: '[1,2,3,...]'
    // Use parameterized values to prevent injection, but still need string format for pgvector
    // Sanitize by ensuring all values are finite numbers
    const sanitizedEmbedding = embedding.map(val => {
      if (!isFinite(val)) return 0;
      // Clamp extreme values to prevent overflow
      return Math.max(-1000, Math.min(1000, val));
    });
    const vectorStr = `[${sanitizedEmbedding.join(',')}]`;
    
    // Additional length check after formatting
    if (vectorStr.length > 100000) {
      throw new Error('Vector string trop long après formatage');
    }

    // Requête SQL avec similarité cosinus et filtres optionnels
    // Using native vector type (fixed in database schema)
    // Schema name validated above to prevent SQL injection
    let query = `
      SELECT 
        c.id as chunk_id,
        c.document_id as document_id,
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
      WHERE (1 - (e.vec <=> $1::vector)) >= $3
    `;
    
    const params = [vectorStr, topK, minScore];
    
    // Filtrer par documents spécifiques si demandé
    if (docIds && Array.isArray(docIds) && docIds.length > 0) {
      query += ` AND c.document_id = ANY($4::int[])`;
      params.push(docIds);
    }
    
    query += `
      ORDER BY e.vec <=> $1::vector
      LIMIT $2
    `;

    const result = await client.query(query, params);
    
    // Mapper et enrichir les candidats
    const candidates = result.rows.map(row => {
      const score = parseFloat(row.score_cosine);
      
      return {
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
        score_cosine: score,
        // Indicateurs de qualité
        has_heading: !!row.heading_path,
        has_page: !!row.page_no,
        text_length: row.text ? row.text.length : 0,
        quality_score: score * (row.heading_path ? 1.05 : 1) * (row.page_no ? 1.03 : 1)
      };
    });
    
    // Filtrer uniquement les candidats vides
    const qualityCandidates = candidates.filter(c => 
      c.text_length >= 10 && c.score_cosine >= minScore
    );

    const processingTime = Date.now() - startTime;
    logger.info(`[rag/query] ${qualityCandidates.length}/${result.rows.length} candidats de qualité récupérés en ${processingTime}ms`);
    
    if (qualityCandidates.length > 0) {
      const scores = qualityCandidates.map(c => c.score_cosine);
      const qualityScores = qualityCandidates.map(c => c.quality_score);
      logger.info(`[rag/query] Scores cosinus: min=${Math.min(...scores).toFixed(4)}, max=${Math.max(...scores).toFixed(4)}, avg=${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(4)}`);
      logger.info(`[rag/query] Scores qualité: min=${Math.min(...qualityScores).toFixed(4)}, max=${Math.max(...qualityScores).toFixed(4)}`);
      logger.info(`[rag/query] Candidats avec heading: ${qualityCandidates.filter(c => c.has_heading).length}, avec page: ${qualityCandidates.filter(c => c.has_page).length}`);
    }

    return qualityCandidates;

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
