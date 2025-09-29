const express = require('express');
const pool = require('../db/pool');
const config = require('../config');
const logger = require('../utils/logger');
const { retrieveForQuery } = require('./query');
const { rerank, selectTopCandidates } = require('./rerank');
const { detectLanguage, generateAnswer } = require('./synthesize');

const router = express.Router();

/**
 * Enregistre une requête RAG dans les logs
 * @param {Object} logData - Données à enregistrer
 */
async function logRagQuery(logData) {
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO ${config.dbSchema}.rag_logs 
      (query, lang, topk, retrieved, reranked, answer, confidence)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      logData.query,
      logData.lang,
      logData.topk,
      JSON.stringify(logData.retrieved),
      JSON.stringify(logData.reranked),
      JSON.stringify(logData.answer),
      logData.confidence
    ]);
  } catch (error) {
    logger.error(`[rag/routes] Erreur enregistrement log: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * POST /rag/query
 * Récupère les candidats pertinents pour une requête
 */
router.post('/query', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { query, top_k = config.ragTopK, lang } = req.body;

    // Validation des paramètres
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        error: 'INVALID_QUERY',
        message: 'Requête manquante ou invalide'
      });
    }

    const topK = parseInt(top_k);
    if (isNaN(topK) || topK <= 0 || topK > 200) {
      return res.status(400).json({
        error: 'INVALID_TOP_K',
        message: 'top_k doit être un nombre entre 1 et 200'
      });
    }

    logger.info(`[rag/routes] POST /query: "${query.substring(0, 100)}..." (top_k=${topK})`);

    // Détection de langue si non fournie
    const detectedLang = lang || detectLanguage(query);

    // Récupération des candidats
    const result = await retrieveForQuery(query.trim(), topK);
    
    // Formatage de la réponse
    const candidates = result.candidates.map(candidate => ({
      chunk_id: candidate.chunk_id,
      document_id: candidate.document_id,
      document_title: candidate.document_title,
      page_no: candidate.page_no,
      heading_path: candidate.heading_path,
      text: candidate.text.substring(0, 500) + (candidate.text.length > 500 ? '...' : ''), // Texte tronqué
      tokens: candidate.tokens,
      score_cosine: candidate.score_cosine,
      span_start: candidate.span_start,
      span_end: candidate.span_end
    }));

    const processingTime = Date.now() - startTime;

    res.json({
      query: query.trim(),
      lang: detectedLang,
      candidates,
      stats: {
        ...result.stats,
        total_processing_time_ms: processingTime
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[rag/routes] Erreur /query (${processingTime}ms): ${error.message}`);
    
    res.status(500).json({
      error: 'QUERY_FAILED',
      message: 'Erreur lors de la récupération des candidats',
      details: error.message
    });
  }
});

/**
 * POST /rag/answer
 * Génère une réponse complète avec RAG
 */
router.post('/answer', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { query, top_k = config.ragTopK, lang } = req.body;

    // Validation des paramètres
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        error: 'INVALID_QUERY',
        message: 'Requête manquante ou invalide'
      });
    }

    const topK = parseInt(top_k);
    if (isNaN(topK) || topK <= 0 || topK > 200) {
      return res.status(400).json({
        error: 'INVALID_TOP_K',
        message: 'top_k doit être un nombre entre 1 et 200'
      });
    }

    logger.info(`[rag/routes] POST /answer: "${query.substring(0, 100)}..." (top_k=${topK})`);

    // Détection de langue si non fournie
    const detectedLang = lang || detectLanguage(query);

    // 1. Récupération des candidats
    const retrievalResult = await retrieveForQuery(query.trim(), topK);
    const retrievedCandidates = retrievalResult.candidates;

    if (retrievedCandidates.length === 0) {
      logger.warn('[rag/routes] Aucun candidat récupéré');
      
      const logData = {
        query: query.trim(),
        lang: detectedLang,
        topk: topK,
        retrieved: [],
        reranked: [],
        answer: { answer: 'NO_ANSWER', reasoning: 'Aucun candidat trouvé' },
        confidence: 0
      };
      
      await logRagQuery(logData);
      
      return res.json({
        query: query.trim(),
        lang: detectedLang,
        answer: 'NO_ANSWER',
        sources: [],
        confidence: 0,
        reasoning: 'Aucun document pertinent trouvé',
        stats: {
          retrieved_count: 0,
          reranked_count: 0,
          selected_count: 0,
          total_processing_time_ms: Date.now() - startTime
        }
      });
    }

    // 2. Réordonnancement des candidats
    const rerankedCandidates = await rerank(query.trim(), retrievedCandidates);
    
    // 3. Sélection des meilleurs candidats pour le contexte
    const selectedCandidates = selectTopCandidates(rerankedCandidates, 8);

    // 4. Génération de la réponse
    const answerResult = await generateAnswer(query.trim(), selectedCandidates, detectedLang);

    // 5. Logging de la requête complète
    const logData = {
      query: query.trim(),
      lang: detectedLang,
      topk: topK,
      retrieved: retrievedCandidates.map(c => ({
        chunk_id: c.chunk_id,
        document_title: c.document_title,
        score_cosine: c.score_cosine
      })),
      reranked: selectedCandidates.map(c => ({
        chunk_id: c.chunk_id,
        document_title: c.document_title,
        score_cosine: c.score_cosine,
        score_rerank: c.score_rerank,
        score_final: c.score_final
      })),
      answer: {
        answer: answerResult.answer,
        sources: answerResult.sources,
        reasoning: answerResult.reasoning,
        model_used: answerResult.model_used
      },
      confidence: answerResult.confidence
    };

    await logRagQuery(logData);

    const processingTime = Date.now() - startTime;

    // 6. Réponse finale
    res.json({
      query: query.trim(),
      lang: detectedLang,
      answer: answerResult.answer,
      sources: answerResult.sources,
      confidence: answerResult.confidence,
      reasoning: answerResult.reasoning,
      stats: {
        retrieved_count: retrievedCandidates.length,
        reranked_count: rerankedCandidates.length,
        selected_count: selectedCandidates.length,
        total_processing_time_ms: processingTime,
        retrieval_time_ms: retrievalResult.stats.total_time_ms,
        synthesis_time_ms: answerResult.processing_time_ms,
        model_used: answerResult.model_used,
        lang_detected: answerResult.lang_detected
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[rag/routes] Erreur /answer (${processingTime}ms): ${error.message}`);
    
    // Log de l'erreur
    try {
      const logData = {
        query: req.body.query || '',
        lang: req.body.lang || 'unknown',
        topk: parseInt(req.body.top_k) || config.ragTopK,
        retrieved: [],
        reranked: [],
        answer: { error: error.message },
        confidence: 0
      };
      await logRagQuery(logData);
    } catch (logError) {
      logger.error(`[rag/routes] Erreur logging: ${logError.message}`);
    }
    
    res.status(500).json({
      error: 'ANSWER_FAILED',
      message: 'Erreur lors de la génération de la réponse',
      details: error.message
    });
  }
});

/**
 * GET /rag/stats
 * Statistiques des requêtes RAG
 */
router.get('/stats', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT 
        COUNT(*) as total_queries,
        COUNT(CASE WHEN (answer->>'answer') != 'NO_ANSWER' THEN 1 END) as successful_queries,
        AVG(confidence) as avg_confidence,
        COUNT(DISTINCT lang) as languages_count,
        lang,
        COUNT(*) as queries_per_lang
      FROM ${config.dbSchema}.rag_logs 
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY lang
      ORDER BY queries_per_lang DESC
    `);

    res.json({
      stats: result.rows,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`[rag/routes] Erreur /stats: ${error.message}`);
    res.status(500).json({
      error: 'STATS_FAILED',
      message: 'Erreur lors de la récupération des statistiques'
    });
  } finally {
    client.release();
  }
});

module.exports = router;
