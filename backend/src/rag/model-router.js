const config = require('../config');
const logger = require('../utils/logger');

/**
 * Sélectionne le modèle LLM optimal selon heuristiques
 * @param {string} query - Requête utilisateur
 * @param {Array} contextChunks - Contexte RAG
 * @param {Object} options - { depth: 'high'|undefined, params: {...} }
 * @returns {string} - Nom du modèle Ollama
 */
function pickModel(query, contextChunks, options = {}) {
  const wordCount = query.split(/\s+/).length;
  const docCount = contextChunks?.length || 0;
  const depthFlag = options.depth === 'high';
  
  // MICRO: Requêtes ultra-courtes avec peu de contexte
  if (wordCount <= 5 && docCount <= 2) {
    logger.debug(`[model-router] MICRO selected (${config.llmModelMicro}): words=${wordCount}, docs=${docCount}`);
    return config.llmModelMicro;
  }
  
  // DEEP: Requêtes complexes OU flag explicite OU contexte riche
  if (depthFlag || 
      wordCount > 25 || 
      docCount >= 8 ||
      /pourquoi|comment|évaluer|risque|analyse|expliquer/i.test(query)) {
    logger.debug(`[model-router] DEEP selected (${config.llmModelDeep}): depth=${depthFlag}, words=${wordCount}, docs=${docCount}`);
    return config.llmModelDeep;
  }
  
  // FAST (défaut)
  logger.debug(`[model-router] FAST selected (${config.llmModelFast}): words=${wordCount}, docs=${docCount}`);
  return config.llmModelFast;
}

module.exports = { pickModel };
