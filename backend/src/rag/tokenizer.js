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
 * Divise un texte en segments avec sliding window précis par tokens
 * @param {string} text - Texte à diviser
 * @param {number} maxTokens - Nombre maximum de tokens par segment
 * @param {number} overlapTokens - Nombre de tokens de chevauchement
 * @returns {Array<{text: string, tokens: number, start: number, end: number}>} - Segments
 */
function splitByTokens(text, maxTokens = 800, overlapTokens = 200) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const cleanText = text.trim();
  if (!cleanText) {
    return [];
  }

  const totalTokens = estimateTokens(cleanText);
  if (totalTokens <= maxTokens) {
    return [{
      text: cleanText,
      tokens: totalTokens,
      start: 0,
      end: cleanText.length
    }];
  }

  // Validation des paramètres
  if (overlapTokens >= maxTokens) {
    throw new Error('overlapTokens must be less than maxTokens');
  }

  const segments = [];
  const sentences = splitIntoSentences(cleanText);
  
  let currentSegment = '';
  let currentTokens = 0;
  let currentStart = 0;
  let sentenceIndex = 0;
  
  while (sentenceIndex < sentences.length) {
    const sentence = sentences[sentenceIndex];
    const sentenceTokens = estimateTokens(sentence);
    
    // Si la phrase seule dépasse maxTokens, la découper par mots
    if (sentenceTokens > maxTokens) {
      // Traiter les segments précédents s'ils existent
      if (currentSegment.trim()) {
        segments.push({
          text: currentSegment.trim(),
          tokens: currentTokens,
          start: currentStart,
          end: currentStart + currentSegment.length
        });
      }
      
      // Découper la phrase longue par mots
      const wordSegments = splitLongSentenceByWords(sentence, maxTokens, overlapTokens);
      for (const wordSegment of wordSegments) {
        segments.push({
          text: wordSegment.text,
          tokens: wordSegment.tokens,
          start: currentStart + wordSegment.start,
          end: currentStart + wordSegment.end
        });
      }
      
      // Réinitialiser pour la suite
      currentSegment = '';
      currentTokens = 0;
      currentStart = currentStart + sentence.length + 1; // +1 pour l'espace
      sentenceIndex++;
      continue;
    }
    
    // Si ajouter cette phrase dépasse la limite
    if (currentTokens + sentenceTokens > maxTokens && currentSegment.trim()) {
      // Créer le segment actuel
      segments.push({
        text: currentSegment.trim(),
        tokens: currentTokens,
        start: currentStart,
        end: currentStart + currentSegment.length
      });
      
      // Calculer l'overlap pour le prochain segment
      const overlapInfo = calculateOverlap(currentSegment, overlapTokens);
      
      // Commencer le nouveau segment avec l'overlap
      currentSegment = overlapInfo.text + (overlapInfo.text ? ' ' : '') + sentence;
      currentTokens = estimateTokens(currentSegment);
      currentStart = currentStart + currentSegment.length - overlapInfo.text.length - sentence.length - (overlapInfo.text ? 1 : 0);
    } else {
      // Ajouter la phrase au segment actuel
      if (currentSegment) {
        currentSegment += ' ' + sentence;
      } else {
        currentSegment = sentence;
      }
      currentTokens = estimateTokens(currentSegment);
    }
    
    sentenceIndex++;
  }
  
  // Ajouter le dernier segment s'il existe
  if (currentSegment.trim()) {
    segments.push({
      text: currentSegment.trim(),
      tokens: currentTokens,
      start: currentStart,
      end: currentStart + currentSegment.length
    });
  }
  
  return segments;
}

/**
 * Découpe une phrase trop longue par mots avec overlap
 * @param {string} sentence - Phrase à découper
 * @param {number} maxTokens - Tokens maximum par segment
 * @param {number} overlapTokens - Tokens d'overlap
 * @returns {Array} - Segments de mots
 */
function splitLongSentenceByWords(sentence, maxTokens, overlapTokens) {
  const words = sentence.split(/\s+/);
  const segments = [];
  
  let currentWords = [];
  let currentTokens = 0;
  let wordIndex = 0;
  
  while (wordIndex < words.length) {
    const word = words[wordIndex];
    const wordTokens = estimateTokens(word);
    
    if (currentTokens + wordTokens > maxTokens && currentWords.length > 0) {
      // Créer le segment actuel
      const segmentText = currentWords.join(' ');
      segments.push({
        text: segmentText,
        tokens: currentTokens,
        start: 0, // Position relative, sera ajustée par l'appelant
        end: segmentText.length
      });
      
      // Calculer l'overlap en mots
      const overlapWordCount = Math.floor(overlapTokens / 4); // Approximation
      const overlapWords = currentWords.slice(-Math.min(overlapWordCount, currentWords.length));
      
      // Commencer le nouveau segment avec l'overlap
      currentWords = [...overlapWords, word];
      currentTokens = estimateTokens(currentWords.join(' '));
    } else {
      currentWords.push(word);
      currentTokens += wordTokens;
    }
    
    wordIndex++;
  }
  
  // Ajouter le dernier segment
  if (currentWords.length > 0) {
    const segmentText = currentWords.join(' ');
    segments.push({
      text: segmentText,
      tokens: currentTokens,
      start: 0,
      end: segmentText.length
    });
  }
  
  return segments;
}

/**
 * Calcule l'overlap optimal pour un segment
 * @param {string} segment - Segment source
 * @param {number} overlapTokens - Tokens d'overlap souhaités
 * @returns {Object} - {text: string, tokens: number}
 */
function calculateOverlap(segment, overlapTokens) {
  if (overlapTokens <= 0 || !segment) {
    return { text: '', tokens: 0 };
  }
  
  const sentences = splitIntoSentences(segment);
  let overlapText = '';
  let overlapTokenCount = 0;
  
  // Prendre les dernières phrases jusqu'à atteindre overlapTokens
  for (let i = sentences.length - 1; i >= 0; i--) {
    const sentence = sentences[i];
    const sentenceTokens = estimateTokens(sentence);
    
    if (overlapTokenCount + sentenceTokens <= overlapTokens) {
      overlapText = sentence + (overlapText ? ' ' + overlapText : '');
      overlapTokenCount += sentenceTokens;
    } else {
      break;
    }
  }
  
  // Si pas assez de phrases complètes, prendre les derniers mots
  if (overlapTokenCount < overlapTokens * 0.5) {
    overlapText = getLastTokensText(segment, overlapTokens);
    overlapTokenCount = estimateTokens(overlapText);
  }
  
  return { text: overlapText, tokens: overlapTokenCount };
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
