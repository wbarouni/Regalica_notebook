/**
 * Tokenizer minimal pour estimation des tokens
 * Utilise une heuristique simple (≈ 1 token/4 chars) pour éviter les dépendances externes
 */

/**
 * Estime le nombre de tokens dans un texte
 * @param {string} text - Texte à analyser
 * @returns {number} - Nombre estimé de tokens
 */
function estimateTokens(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  const cleanText = text.trim();
  if (cleanText.length === 0) {
    return 0;
  }

  // Heuristique simple : environ 1 token pour 4 caractères
  // Cette estimation est basée sur les observations empiriques pour l'anglais et le français
  // Pour l'arabe, le ratio peut être légèrement différent mais reste dans la même gamme
  const estimatedTokens = Math.ceil(cleanText.length / 4);
  
  // Ajustement pour les espaces et la ponctuation
  const wordCount = cleanText.split(/\s+/).length;
  const punctuationCount = (cleanText.match(/[.,!?;:]/g) || []).length;
  
  // Formule ajustée : base sur les caractères + bonus pour les mots + ponctuation
  const adjustedTokens = Math.max(
    estimatedTokens,
    Math.ceil(wordCount * 1.3 + punctuationCount * 0.5)
  );
  
  return adjustedTokens;
}

/**
 * Divise un texte en segments de taille approximative en tokens
 * @param {string} text - Texte à diviser
 * @param {number} maxTokens - Nombre maximum de tokens par segment
 * @param {number} overlapTokens - Nombre de tokens de chevauchement
 * @returns {Array<{text: string, tokens: number, start: number, end: number}>} - Segments
 */
function splitByTokens(text, maxTokens = 800, overlapTokens = 200) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const totalTokens = estimateTokens(text);
  if (totalTokens <= maxTokens) {
    return [{
      text: text.trim(),
      tokens: totalTokens,
      start: 0,
      end: text.length
    }];
  }

  const segments = [];
  const sentences = splitIntoSentences(text);
  
  let currentSegment = '';
  let currentTokens = 0;
  let segmentStart = 0;
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceTokens = estimateTokens(sentence);
    
    // Si ajouter cette phrase dépasse la limite
    if (currentTokens + sentenceTokens > maxTokens && currentSegment) {
      // Créer le segment actuel
      segments.push({
        text: currentSegment.trim(),
        tokens: currentTokens,
        start: segmentStart,
        end: segmentStart + currentSegment.length
      });
      
      // Calculer l'overlap pour le prochain segment
      const overlapText = getLastTokensText(currentSegment, overlapTokens);
      const overlapLength = overlapText.length;
      
      // Commencer le nouveau segment avec l'overlap
      currentSegment = overlapText + (overlapText ? ' ' : '') + sentence;
      currentTokens = estimateTokens(currentSegment);
      segmentStart = segmentStart + currentSegment.length - overlapLength - sentence.length - 1;
    } else {
      // Ajouter la phrase au segment actuel
      currentSegment += (currentSegment ? ' ' : '') + sentence;
      currentTokens += sentenceTokens;
    }
  }
  
  // Ajouter le dernier segment s'il existe
  if (currentSegment.trim()) {
    segments.push({
      text: currentSegment.trim(),
      tokens: currentTokens,
      start: segmentStart,
      end: segmentStart + currentSegment.length
    });
  }
  
  return segments;
}

/**
 * Divise un texte en phrases
 * @param {string} text - Texte à diviser
 * @returns {string[]} - Phrases
 */
function splitIntoSentences(text) {
  // Pattern amélioré pour diviser en phrases
  // Gère les abréviations courantes et évite les faux positifs
  return text
    .split(/(?<![A-Z][a-z]\.)\s*[.!?]+\s+(?=[A-Z])/g)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Récupère les derniers tokens d'un texte pour l'overlap
 * @param {string} text - Texte source
 * @param {number} tokenCount - Nombre de tokens à récupérer
 * @returns {string} - Texte d'overlap
 */
function getLastTokensText(text, tokenCount) {
  if (tokenCount <= 0 || !text) {
    return '';
  }
  
  const totalTokens = estimateTokens(text);
  if (tokenCount >= totalTokens) {
    return text;
  }
  
  // Estimation inverse : approximativement 4 caractères par token
  const targetChars = tokenCount * 4;
  
  if (targetChars >= text.length) {
    return text;
  }
  
  // Prendre les derniers caractères et ajuster sur les limites de mots
  const roughCut = text.slice(-targetChars);
  const firstSpaceIndex = roughCut.indexOf(' ');
  
  // Si on trouve un espace, commencer après pour éviter de couper un mot
  return firstSpaceIndex > 0 ? roughCut.slice(firstSpaceIndex + 1) : roughCut;
}

module.exports = {
  estimateTokens,
  splitByTokens,
  splitIntoSentences,
  getLastTokensText
};
