const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../db/pool');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Helper: Generate detailed summary using LLM
 */
async function generateDetailedSummary(chunks, lang = 'en') {
  try {
    const context = chunks.map(c => c.text).join('\n\n').substring(0, 4000);
    
    const prompt = lang === 'fr'
      ? `Fournissez un résumé détaillé et structuré du contenu suivant:\n\n${context}\n\nRésumé détaillé:`
      : `Provide a detailed and structured summary of the following content:\n\n${context}\n\nDetailed summary:`;
    
    const response = await axios.post(`${config.llmApiUrl}/api/generate`, {
      model: config.llmNodeSummaryModel || config.llmModelName,
      prompt,
      temperature: 0.3,
      num_predict: 500,
      stream: false
    }, {
      timeout: 30000
    });
    
    return response.data?.response?.trim() || 'Summary generation failed';
  } catch (error) {
    logger.error(`[Context] Summary generation failed: ${error.message}`);
    return 'Summary generation unavailable';
  }
}

/**
 * Helper: Generate suggested questions using LLM
 */
async function generateQuestions(chunks, label, lang = 'en', count = 5) {
  try {
    const context = chunks.slice(0, 5).map(c => c.text).join('\n\n').substring(0, 2000);
    
    const prompt = lang === 'fr'
      ? `Basé sur le concept "${label}" et le contexte suivant, générez ${count} questions pertinentes qu'un utilisateur pourrait poser:\n\n${context}\n\nQuestions (une par ligne):`
      : `Based on the concept "${label}" and the following context, generate ${count} relevant questions a user might ask:\n\n${context}\n\nQuestions (one per line):`;
    
    const response = await axios.post(`${config.llmApiUrl}/api/generate`, {
      model: config.llmModelName,
      prompt,
      temperature: 0.7,
      num_predict: 200,
      stream: false
    }, {
      timeout: 30000
    });
    
    const text = response.data?.response?.trim() || '';
    return text.split('\n')
      .map(q => q.trim().replace(/^[0-9]+\.?\s*/, '').replace(/^-\s*/, ''))
      .filter(q => q && q.length > 10 && q.endsWith('?'))
      .slice(0, count);
  } catch (error) {
    logger.error(`[Context] Question generation failed: ${error.message}`);
    return [];
  }
}

/**
 * Helper: Find related nodes by chunk similarity
 */
async function findRelatedNodes(nodeId, notebookId) {
  const client = await pool.connect();
  try {
    // Note: This is a simplified version since we don't have mindmap_node_chunks table yet
    // For now, we'll return empty array
    // TODO: Implement proper chunk-based similarity when table is created
    return [];
  } catch (error) {
    logger.error(`[Context] Failed to find related nodes: ${error.message}`);
    return [];
  } finally {
    client.release();
  }
}

/**
 * Helper: Get chunks for a node
 */
async function getNodeChunks(chunkIds, notebookId) {
  const client = await pool.connect();
  try {
    let query = 'SELECT id, text, document_id FROM chunks WHERE id = ANY($1)';
    const params = [chunkIds];
    
    if (notebookId) {
      // Filter by notebook documents
      query += ` AND document_id IN (
        SELECT document_id FROM notebook_documents WHERE notebook_id = $2
      )`;
      params.push(notebookId);
    }
    
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * GET /api/studio/mindmap/node/:nodeId/context
 * 
 * Get enriched context for a mind map node
 */
router.get('/node/:nodeId/context', async (req, res) => {
  const { nodeId } = req.params;
  const { notebookId, lang } = req.query;
  
  try {
    logger.info(`[Context] Getting context for node: ${nodeId}`);
    
    // For now, we'll use the node data from the request
    // In a real implementation, we'd fetch from a mindmap_nodes table
    
    // Mock node data (in production, fetch from DB)
    const node = {
      id: nodeId,
      label: 'Concept Node',
      summary: 'Short summary of the concept',
      citations: [],
      chunkIds: [],
      clusterId: 0,
      level: 1
    };
    
    // Get chunks if available
    let chunks = [];
    if (node.chunkIds && node.chunkIds.length > 0) {
      chunks = await getNodeChunks(node.chunkIds, notebookId);
    }
    
    // Generate detailed summary
    let fullSummary = node.summary || 'No summary available';
    if (chunks.length > 0) {
      fullSummary = await generateDetailedSummary(chunks, lang || 'en');
    }
    
    // Generate suggested questions
    let suggestedQuestions = [];
    if (chunks.length > 0) {
      suggestedQuestions = await generateQuestions(chunks, node.label, lang || 'en');
    }
    
    // Find related nodes
    const relatedNodes = await findRelatedNodes(nodeId, notebookId);
    
    // Prepare response
    const context = {
      nodeId: node.id,
      label: node.label,
      summary: node.summary,
      fullSummary,
      citations: node.citations || [],
      relatedNodes,
      suggestedQuestions,
      chunkCount: chunks.length,
      metadata: {
        clusterId: node.clusterId,
        level: node.level
      }
    };
    
    logger.info(`[Context] Context generated successfully for node: ${nodeId}`);
    res.json(context);
    
  } catch (error) {
    logger.error(`[Context] Failed to get node context: ${error.message}`);
    res.status(500).json({ 
      error: 'Failed to retrieve node context',
      details: error.message 
    });
  }
});

module.exports = router;
