const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Réordonne les candidats selon leur pertinence par rapport à la requête
 * @param {string} query - La requête utilisateur
 * @param {Array} candidates - Liste des candidats à réordonner
 * @returns {Promise<Array>} - Candidats réordonnés avec scores
 */
async function rerank(query, candidates) {
  if (!query || !query.trim()) {
    throw new Error('Query cannot be empty');
  }

  if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
    logger.warn('[rag/rerank] No candidates to rerank');
    return [];
  }

  // Validation stricte du nombre maximum de candidats depuis l'environnement
  const maxCandidates = config.rerankerMaxCandidates || 8;
  if (candidates.length > maxCandidates) {
    logger.warn(`[rag/rerank] Too many candidates (${candidates.length}), limiting to top ${maxCandidates} by cosine score`);
    // Trier par score cosinus avant de limiter pour garder les meilleurs
    candidates = candidates
      .sort((a, b) => (b.score_cosine || 0) - (a.score_cosine || 0))
      .slice(0, maxCandidates);
  }

  // Validation minimale des candidats
  const validCandidates = candidates.filter(candidate => {
    if (!candidate || !candidate.text || candidate.text.trim().length === 0) {
      logger.debug('[rag/rerank] Skipping empty candidate');
      return false;
    }
    // Accepter tous les candidats avec un minimum de texte
    if (candidate.text.trim().length < 10) {
      logger.debug('[rag/rerank] Skipping too short candidate');
      return false;
    }
    return true;
  });

  if (validCandidates.length === 0) {
    logger.warn('[rag/rerank] No valid candidates after filtering');
    return [];
  }

  if (validCandidates.length !== candidates.length) {
    logger.info(`[rag/rerank] Filtered ${candidates.length - validCandidates.length} empty candidates`);
    candidates = validCandidates;
  }

  const startTime = Date.now();

  try {
    logger.info(`[rag/rerank] Réordonnancement de ${candidates.length} candidats`);

    // Préparer les textes des candidats pour le reranker avec normalisation
    const candidateTexts = candidates.map(candidate => {
      // Utiliser le texte du chunk
      let text = candidate.text || '';
      
      // Normaliser le texte : trim et collapse whitespace
      text = text.trim().replace(/\s+/g, ' ');
      
      // Ajouter le contexte du document si disponible
      if (candidate.document_title) {
        text = `[${candidate.document_title}] ${text}`;
      }
      
      // Ajouter le chemin de heading si disponible
      if (candidate.heading_path) {
        text = `${candidate.heading_path}: ${text}`;
      }
      
      // Tronquer à RERANKER_MAX_INPUT_CHARS sans couper au milieu d'une citation
      return truncatePreservingCitations(text, config.rerankerMaxInputChars);
    });

    // Appel au microservice reranker
    const response = await axios.post(`${config.rerankerApiUrl}/rerank`, {
      query: query.trim(),
      candidates: candidateTexts
    }, {
      timeout: config.rerankerTimeoutMs
    });

    const { scores, processing_time_ms, model } = response.data;

    if (!scores || !Array.isArray(scores) || scores.length !== candidates.length) {
      throw new Error(`Réponse reranker invalide: ${scores?.length} scores pour ${candidates.length} candidats`);
    }

    // Combiner les scores avec pondération adaptative
    const alpha = config.rerankerAlpha; // Poids du score cosinus
    const beta = config.rerankerBeta;   // Poids du score rerank
    
    // Normaliser les scores rerank pour éviter les biais
    const maxRerankScore = Math.max(...scores);
    const minRerankScore = Math.min(...scores);
    const rerankRange = maxRerankScore - minRerankScore;
    
    const rerankedCandidates = candidates.map((candidate, index) => {
      // Normalisation du score rerank si nécessaire
      const normalizedRerankScore = rerankRange > 0 
        ? (scores[index] - minRerankScore) / rerankRange
        : scores[index];
      
      // Score final avec pondération
      const scoreFinal = alpha * candidate.score_cosine + beta * normalizedRerankScore;
      
      // Bonus si le chunk contient des mots-clés de la query (simple matching)
      const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 3);
      const textLower = candidate.text.toLowerCase();
      const keywordMatches = queryTokens.filter(token => textLower.includes(token)).length;
      const keywordBonus = Math.min(keywordMatches * 0.02, 0.1);
      
      return {
        ...candidate,
        score_rerank: scores[index],
        score_rerank_normalized: normalizedRerankScore,
        score_final: Math.min(scoreFinal + keywordBonus, 1),
        keyword_matches: keywordMatches
      };
    });

    // Trier par score final décroissant
    rerankedCandidates.sort((a, b) => b.score_final - a.score_final);

    const processingTime = Date.now() - startTime;
    
    // Statistiques de logging avec écart-type
    const rerankScores = scores;
    const finalScores = rerankedCandidates.map(c => c.score_final);
    
    // Calcul écart-type rerank
    const rerankMean = rerankScores.reduce((a, b) => a + b, 0) / rerankScores.length;
    const rerankVariance = rerankScores.reduce((a, b) => a + Math.pow(b - rerankMean, 2), 0) / rerankScores.length;
    const rerankStdDev = Math.sqrt(rerankVariance);
    
    // Calcul écart-type final
    const finalMean = finalScores.reduce((a, b) => a + b, 0) / finalScores.length;
    const finalVariance = finalScores.reduce((a, b) => a + Math.pow(b - finalMean, 2), 0) / finalScores.length;
    const finalStdDev = Math.sqrt(finalVariance);
    
    logger.info(`[rag/rerank] Réordonnancement terminé en ${processingTime}ms (reranker: ${processing_time_ms}ms)`);
    logger.info(`[rag/rerank] Modèle utilisé: ${model}`);
    logger.info(`[rag/rerank] Scores rerank: min=${Math.min(...rerankScores).toFixed(4)}, max=${Math.max(...rerankScores).toFixed(4)}, avg=${rerankMean.toFixed(4)}, std=${rerankStdDev.toFixed(4)}`);
    logger.info(`[rag/rerank] Scores finaux: min=${Math.min(...finalScores).toFixed(4)}, max=${Math.max(...finalScores).toFixed(4)}, avg=${finalMean.toFixed(4)}, std=${finalStdDev.toFixed(4)}`);
    
    // Alertes si distribution anormale
    if (Math.max(...rerankScores) < 0.15) {
      logger.warn(`[rag/rerank] ⚠️ All rerank scores < 0.15 - model may be miscalibrated for this content`);
    }
    if (rerankStdDev < 0.02) {
      logger.warn(`[rag/rerank] ⚠️ Very low variance (${rerankStdDev.toFixed(4)}) - rerank scores are too similar`);
    }

    return rerankedCandidates;

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[rag/rerank] Erreur réordonnancement (${processingTime}ms): ${error.message}`);
    
    if (error.response) {
      logger.error(`[rag/rerank] Réponse API: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }

    // En cas d'erreur, fallback intelligent avec score cosinus + heuristiques
    logger.warn('[rag/rerank] Fallback: utilisation des scores cosinus avec heuristiques');
    
    const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 3);
    
    return candidates.map(candidate => {
      const textLower = candidate.text.toLowerCase();
      const keywordMatches = queryTokens.filter(token => textLower.includes(token)).length;
      const keywordBonus = Math.min(keywordMatches * 0.03, 0.15);
      
      // Bonus pour les documents récents ou avec metadata riche
      const metadataBonus = (candidate.heading_path ? 0.02 : 0) + 
                           (candidate.page_no ? 0.01 : 0);
      
      return {
        ...candidate,
        score_rerank: 0,
        score_final: Math.min(candidate.score_cosine + keywordBonus + metadataBonus, 1),
        keyword_matches: keywordMatches,
        fallback_mode: true
      };
    }).sort((a, b) => b.score_final - a.score_final);
  }
}

/**
 * Sélectionne les meilleurs candidats après reranking
 * @param {Array} rerankedCandidates - Candidats réordonnés
 * @param {number} topN - Nombre de candidats à sélectionner
 * @returns {Array} - Top N candidats
 */
function selectTopCandidates(rerankedCandidates, topN = 8) {
  if (!rerankedCandidates || !Array.isArray(rerankedCandidates)) {
    return [];
  }

  const selected = rerankedCandidates.slice(0, topN);
  
  logger.info(`[rag/rerank] Sélection des ${selected.length} meilleurs candidats (topN=${topN})`);
  
  if (selected.length > 0) {
    const scores = selected.map(c => c.score_final);
    logger.info(`[rag/rerank] Scores sélectionnés: min=${Math.min(...scores).toFixed(4)}, max=${Math.max(...scores).toFixed(4)}`);
  }

  return selected;
}

/**
 * Tronque un texte à une longueur donnée sans couper au milieu d'une citation
 * @param {string} text - Texte à tronquer
 * @param {number} maxChars - Nombre maximum de caractères
 * @returns {string} - Texte tronqué
 */
function truncatePreservingCitations(text, maxChars) {
  if (!text || text.length <= maxChars) {
    return text;
  }

  // Trouver la position de troncature
  let truncatePos = maxChars;
  
  // Vérifier s'il y a une citation en cours à la position de troncature
  const beforeTruncate = text.substring(0, truncatePos);
  const afterTruncate = text.substring(truncatePos);
  
  // Pattern pour détecter les citations [title#page:x-y]
  const citationPattern = /\[[^\]]*#[^\]]*:[^\]]*\]/g;
  
  // Vérifier si on coupe au milieu d'une citation
  const lastOpenBracket = beforeTruncate.lastIndexOf('[');
  const lastCloseBracket = beforeTruncate.lastIndexOf(']');
  
  if (lastOpenBracket > lastCloseBracket) {
    // On est au milieu d'une citation, trouver la fin de la citation
    const nextCloseBracket = afterTruncate.indexOf(']');
    if (nextCloseBracket !== -1 && nextCloseBracket < 50) { // Limite raisonnable
      truncatePos = maxChars + nextCloseBracket + 1;
    } else {
      // Citation trop longue, tronquer avant le début de la citation
      truncatePos = lastOpenBracket;
    }
  }
  
  // S'assurer qu'on ne dépasse pas trop la limite
  if (truncatePos > maxChars + 50) {
    truncatePos = maxChars;
  }
  
  return text.substring(0, truncatePos);
}

module.exports = {
  rerank,
  selectTopCandidates,
  truncatePreservingCitations
};
