const express = require('express');
const config = require('../config');
const logger = require('../utils/logger');
const { retrieveForQuery } = require('./query');
const { rerank, selectTopCandidates } = require('./rerank');
const { detectLanguage, generateAnswer } = require('./synthesize');

const router = express.Router();

/**
 * Traite une seule query RAG
 */
async function processQuery(query, top_k, depth) {
  const startTime = Date.now();
  
  try {
    const topK = parseInt(top_k) || config.ragTopK;
    const detectedLang = detectLanguage(query);

    // 1. Récupération
    const retrievalResult = await retrieveForQuery(query.trim(), topK);
    const retrievedCandidates = retrievalResult.candidates;

    if (retrievedCandidates.length === 0) {
      return {
        query: query.trim(),
        lang: detectedLang,
        answer: 'NO_ANSWER',
        sources: [],
        confidence: 0,
        processing_time_ms: Date.now() - startTime,
        status: 'success'
      };
    }

    // 2. Reranking optimisé
    const rerankedCandidates = await rerank(query.trim(), retrievedCandidates);
    const selectedCandidates = selectTopCandidates(rerankedCandidates, 4); // Optimisé CPU

    // 3. Génération
    const answerResult = await generateAnswer(query.trim(), selectedCandidates, detectedLang, { depth });

    return {
      query: query.trim(),
      lang: detectedLang,
      answer: answerResult.answer,
      sources: answerResult.sources,
      confidence: answerResult.confidence,
      processing_time_ms: Date.now() - startTime,
      model_used: answerResult.model_used,
      status: 'success'
    };

  } catch (error) {
    logger.error(`[rag/batch] Erreur query "${query}": ${error.message}`);
    
    return {
      query: query.trim(),
      answer: 'NO_ANSWER',
      sources: [],
      confidence: 0,
      processing_time_ms: Date.now() - startTime,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * POST /rag/answer/batch
 * Traitement parallèle de plusieurs requêtes
 */
router.post('/answer/batch', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { queries, top_k, depth } = req.body;

    // Validation
    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({
        error: 'INVALID_QUERIES',
        message: 'queries doit être un tableau non vide'
      });
    }

    if (queries.length > 10) {
      return res.status(400).json({
        error: 'TOO_MANY_QUERIES',
        message: 'Maximum 10 queries par batch'
      });
    }

    // Valider chaque query
    for (const query of queries) {
      if (!query || typeof query !== 'string' || !query.trim()) {
        return res.status(400).json({
          error: 'INVALID_QUERY',
          message: 'Toutes les queries doivent être des chaînes non vides'
        });
      }
    }

    logger.info(`[rag/batch] POST /answer/batch: ${queries.length} queries`);

    // Traitement parallèle avec limite de 5 simultanées
    const batchSize = 5;
    const results = [];
    
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(query => processQuery(query, top_k, depth))
      );
      
      results.push(...batchResults);
      
      logger.info(`[rag/batch] Traité batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(queries.length/batchSize)}`);
    }

    const totalProcessingTime = Date.now() - startTime;
    const successCount = results.filter(r => r.status === 'success').length;
    const avgConfidence = results
      .filter(r => r.status === 'success')
      .reduce((sum, r) => sum + r.confidence, 0) / successCount || 0;

    res.json({
      total_queries: queries.length,
      success_count: successCount,
      error_count: queries.length - successCount,
      avg_confidence: avgConfidence,
      total_processing_time_ms: totalProcessingTime,
      results
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[rag/batch] Erreur batch (${processingTime}ms): ${error.message}`);
    
    res.status(500).json({
      error: 'BATCH_FAILED',
      message: 'Erreur lors du traitement batch',
      details: error.message
    });
  }
});

/**
 * POST /rag/answer/parallel
 * Traitement parallèle optimisé avec partage de contexte
 */
router.post('/answer/parallel', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { queries, share_context = true, top_k, depth } = req.body;

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({
        error: 'INVALID_QUERIES',
        message: 'queries requis'
      });
    }

    if (queries.length > 5) {
      return res.status(400).json({
        error: 'TOO_MANY_QUERIES',
        message: 'Maximum 5 queries pour mode parallèle'
      });
    }

    logger.info(`[rag/batch] POST /answer/parallel: ${queries.length} queries (share_context=${share_context})`);

    let sharedContext = null;
    
    // Si partage contexte, utiliser première query pour contexte commun
    if (share_context && queries.length > 1) {
      const topK = parseInt(top_k) || config.ragTopK;
      const mainQuery = queries[0];
      
      const retrievalResult = await retrieveForQuery(mainQuery.trim(), topK * 2);
      const rerankedCandidates = await rerank(mainQuery.trim(), retrievalResult.candidates);
      sharedContext = selectTopCandidates(rerankedCandidates, 6);
      
      logger.info(`[rag/batch] Contexte partagé créé: ${sharedContext.length} chunks`);
    }

    // Traiter toutes les queries en parallèle
    const results = await Promise.all(
      queries.map(async (query) => {
        try {
          const detectedLang = detectLanguage(query);
          
          let selectedCandidates;
          if (sharedContext) {
            selectedCandidates = sharedContext.slice(0, 4);
          } else {
            const topK = parseInt(top_k) || config.ragTopK;
            const retrievalResult = await retrieveForQuery(query.trim(), topK);
            const rerankedCandidates = await rerank(query.trim(), retrievalResult.candidates);
            selectedCandidates = selectTopCandidates(rerankedCandidates, 4);
          }

          const answerResult = await generateAnswer(query.trim(), selectedCandidates, detectedLang, { depth });

          return {
            query: query.trim(),
            lang: detectedLang,
            answer: answerResult.answer,
            sources: answerResult.sources,
            confidence: answerResult.confidence,
            model_used: answerResult.model_used,
            status: 'success'
          };

        } catch (error) {
          return {
            query: query.trim(),
            answer: 'NO_ANSWER',
            sources: [],
            confidence: 0,
            status: 'error',
            error: error.message
          };
        }
      })
    );

    const totalProcessingTime = Date.now() - startTime;
    const successCount = results.filter(r => r.status === 'success').length;

    res.json({
      total_queries: queries.length,
      success_count: successCount,
      shared_context: share_context,
      total_processing_time_ms: totalProcessingTime,
      results
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[rag/batch] Erreur parallel (${processingTime}ms): ${error.message}`);
    
    res.status(500).json({
      error: 'PARALLEL_FAILED',
      message: 'Erreur traitement parallèle',
      details: error.message
    });
  }
});

module.exports = router;
