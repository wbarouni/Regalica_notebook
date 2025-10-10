const express = require('express');
const pool = require('../db/pool');
const config = require('../config');
const logger = require('../utils/logger');
const { retrieveForQuery } = require('./query');
const { rerank, selectTopCandidates } = require('./rerank');
const { detectLanguage } = require('./synthesize');
const { pickModel } = require('./model-router');
const axios = require('axios');

const router = express.Router();

/**
 * POST /rag/answer/stream
 * Streaming SSE de la réponse RAG
 */
router.post('/answer/stream', async (req, res) => {
  const startTime = Date.now();
  
  // Configuration SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx compatibility
  
  try {
    const { query, top_k = config.ragTopK, lang, depth } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Requête invalide' })}\n\n`);
      return res.end();
    }

    const topK = parseInt(top_k);
    if (isNaN(topK) || topK <= 0 || topK > 200) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'top_k invalide' })}\n\n`);
      return res.end();
    }

    logger.info(`[rag/stream] POST /answer/stream: "${query.substring(0, 100)}..."`);

    // Événement: Début du traitement
    res.write(`data: ${JSON.stringify({ type: 'start', query: query.trim() })}\n\n`);

    // Détection langue
    const detectedLang = lang || detectLanguage(query);
    res.write(`data: ${JSON.stringify({ type: 'lang', lang: detectedLang })}\n\n`);

    // 1. Récupération des candidats
    res.write(`data: ${JSON.stringify({ type: 'status', message: 'Recherche documents...' })}\n\n`);
    
    const retrievalResult = await retrieveForQuery(query.trim(), topK);
    const retrievedCandidates = retrievalResult.candidates;

    if (retrievedCandidates.length === 0) {
      res.write(`data: ${JSON.stringify({ 
        type: 'done', 
        answer: 'NO_ANSWER', 
        sources: [], 
        confidence: 0 
      })}\n\n`);
      return res.end();
    }

    res.write(`data: ${JSON.stringify({ 
      type: 'context', 
      retrieved: retrievedCandidates.length 
    })}\n\n`);

    // 2. Reranking
    res.write(`data: ${JSON.stringify({ type: 'status', message: 'Analyse pertinence...' })}\n\n`);
    
    const rerankedCandidates = await rerank(query.trim(), retrievedCandidates);
    const selectedCandidates = selectTopCandidates(rerankedCandidates, 4); // Optimisé pour CPU

    res.write(`data: ${JSON.stringify({ 
      type: 'context', 
      selected: selectedCandidates.length 
    })}\n\n`);

    // 3. Génération streaming
    res.write(`data: ${JSON.stringify({ type: 'status', message: 'Génération réponse...' })}\n\n`);

    // Construire prompt
    const limitedChunks = selectedCandidates.slice(0, 4);
    let contextText = 'DOCUMENTS:\n\n';
    
    limitedChunks.forEach((chunk, index) => {
      const text = (chunk.text || '').trim().replace(/\s+/g, ' ');
      const snippet = text.length > 400 ? text.substring(0, 400) + '...' : text;
      contextText += `[${index + 1}] ${chunk.document_title}${chunk.page_no ? ` - Page ${chunk.page_no}` : ''}\n${snippet}\n\n`;
    });

    // Sélection modèle
    const selectedModel = pickModel(query.trim(), selectedCandidates, { depth });
    
    res.write(`data: ${JSON.stringify({ type: 'model', model: selectedModel })}\n\n`);

    // Instructions selon langue
    const instructions = {
      fr: "Tu es un assistant expert. Réponds en français avec citations [1], [2], etc.",
      en: "You are an expert assistant. Answer in English with citations [1], [2], etc.",
      ar: "أنت مساعد خبير. أجب بالعربية مع الاستشهادات [1], [2], إلخ."
    };
    const systemPrompt = instructions[detectedLang] || instructions.en;

    // Streaming Ollama
    const response = await axios.post(`${config.llmApiUrl}/api/chat`, {
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${contextText}\nQUESTION: ${query.trim()}\n\nRéponds avec citations.` }
      ],
      stream: true,
      options: {
        temperature: 0.2,
        top_p: 0.95,
        num_predict: 200,
        num_ctx: 2048
      }
    }, {
      responseType: 'stream',
      timeout: 120000
    });

    let fullAnswer = '';
    
    // Traiter le stream
    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          
          if (data.message && data.message.content) {
            const token = data.message.content;
            fullAnswer += token;
            
            // Envoyer token au client
            res.write(`data: ${JSON.stringify({ type: 'token', text: token })}\n\n`);
          }
          
          if (data.done) {
            // Extraire citations
            const citedIndices = new Set();
            const citationRegex = /\[(\d+)\]/g;
            let match;
            
            while ((match = citationRegex.exec(fullAnswer)) !== null) {
              const index = parseInt(match[1]) - 1;
              if (index >= 0 && index < selectedCandidates.length) {
                citedIndices.add(index);
              }
            }
            
            const sources = Array.from(citedIndices).map(index => {
              const chunk = selectedCandidates[index];
              return {
                index: index + 1,
                chunk_id: chunk.chunk_id,
                document_id: chunk.document_id,
                title: chunk.document_title,
                page: chunk.page_no || '?',
                citation: `[${index + 1}]`
              };
            });

            const avgScore = selectedCandidates.reduce((sum, c) => sum + (c.score_final || 0), 0) / selectedCandidates.length;
            const confidence = Math.min(avgScore + (sources.length >= 1 ? 0.1 : 0), 1);

            const processingTime = Date.now() - startTime;
            
            // Événement final
            res.write(`data: ${JSON.stringify({ 
              type: 'done',
              answer: fullAnswer,
              sources,
              confidence,
              processing_time_ms: processingTime,
              model_used: selectedModel
            })}\n\n`);
            
            res.end();
          }
        } catch (parseError) {
          logger.warn(`[rag/stream] Parse error: ${parseError.message}`);
        }
      }
    });

    response.data.on('error', (error) => {
      logger.error(`[rag/stream] Stream error: ${error.message}`);
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[rag/stream] Erreur (${processingTime}ms): ${error.message}`);
    
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      message: error.message 
    })}\n\n`);
    res.end();
  }
});

module.exports = router;
