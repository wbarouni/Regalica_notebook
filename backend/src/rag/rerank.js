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
    throw new Error('Requête vide');
  }

  if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
    logger.warn('[rag/rerank] Aucun candidat à réordonner');
    return [];
  }

  if (candidates.length > 200) {
    logger.warn(`[rag/rerank] Trop de candidats (${candidates.length}), limitation à 200`);
    candidates = candidates.slice(0, 200);
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
      timeout: 30000 // 30 secondes pour le reranking
    });

    const { scores, processing_time_ms, model } = response.data;

    if (!scores || !Array.isArray(scores) || scores.length !== candidates.length) {
      throw new Error(`Réponse reranker invalide: ${scores?.length} scores pour ${candidates.length} candidats`);
    }

    // Combiner les scores cosinus et rerank avec pondération configurables
    const alpha = config.rerankerAlpha; // Poids du score cosinus
    const beta = config.rerankerBeta;   // Poids du score rerank
    
    const rerankedCandidates = candidates.map((candidate, index) => ({
      ...candidate,
      score_rerank: scores[index],
      score_final: alpha * candidate.score_cosine + beta * scores[index]
    }));

    // Trier par score final décroissant
    rerankedCandidates.sort((a, b) => b.score_final - a.score_final);

    const processingTime = Date.now() - startTime;
    
    // Statistiques de logging
    const rerankScores = scores;
    const finalScores = rerankedCandidates.map(c => c.score_final);
    
    logger.info(`[rag/rerank] Réordonnancement terminé en ${processingTime}ms (reranker: ${processing_time_ms}ms)`);
    logger.info(`[rag/rerank] Modèle utilisé: ${model}`);
    logger.info(`[rag/rerank] Scores rerank: min=${Math.min(...rerankScores).toFixed(4)}, max=${Math.max(...rerankScores).toFixed(4)}, avg=${(rerankScores.reduce((a, b) => a + b, 0) / rerankScores.length).toFixed(4)}`);
    logger.info(`[rag/rerank] Scores finaux: min=${Math.min(...finalScores).toFixed(4)}, max=${Math.max(...finalScores).toFixed(4)}, avg=${(finalScores.reduce((a, b) => a + b, 0) / finalScores.length).toFixed(4)}`);

    return rerankedCandidates;

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[rag/rerank] Erreur réordonnancement (${processingTime}ms): ${error.message}`);
    
    if (error.response) {
      logger.error(`[rag/rerank] Réponse API: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }

    // En cas d'erreur, retourner les candidats avec seulement le score cosinus
    logger.warn('[rag/rerank] Fallback: utilisation des scores cosinus uniquement');
    return candidates.map(candidate => ({
      ...candidate,
      score_rerank: 0,
      score_final: candidate.score_cosine
    }));
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
