const { countTokens } = require("../utils/tokencount");
const config = require("../config");
const logger = require("../utils/logger");

/**
 * Découpe les sections normalisées en chunks avec overlap
 * @param {Array} sections - Les sections normalisées
 * @param {number} pageNo - Numéro de page (optionnel)
 * @returns {Array<{seq: number, text: string, tokens: number, heading_path: string[], span_start: number, span_end: number, page_no?: number}>}
 */
const chunkSections = (sections, pageNo = null) => {
  const chunks = [];
  let globalSeq = 0;
  
  for (const section of sections) {
    const sectionChunks = chunkSection(section, globalSeq, pageNo);
    chunks.push(...sectionChunks);
    globalSeq += sectionChunks.length;
  }
  
  logger.debug(`Created ${chunks.length} chunks from ${sections.length} sections`);
  return chunks;
};

/**
 * Découpe une section en chunks avec overlap
 * @param {Object} section - La section à découper
 * @param {number} startSeq - Numéro de séquence de départ
 * @param {number} pageNo - Numéro de page
 * @returns {Array} Les chunks de la section
 */
const chunkSection = (section, startSeq, pageNo) => {
  const { text, heading_path, span_start, span_end } = section;
  const tokens = countTokens(text);
  
  // Si la section est déjà assez petite, la retourner telle quelle
  if (tokens <= config.chunkTokensMax) {
    return [{
      seq: startSeq,
      text,
      tokens,
      heading_path,
      span_start,
      span_end,
      page_no: pageNo
    }];
  }
  
  // Découper la section en chunks avec overlap
  const chunks = [];
  const sentences = splitIntoSentences(text);
  
  let currentChunk = "";
  let currentTokens = 0;
  let chunkStart = span_start;
  let seq = startSeq;
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceTokens = countTokens(sentence);
    
    // Si ajouter cette phrase dépasse la limite
    if (currentTokens + sentenceTokens > config.chunkTokensMax && currentChunk) {
      // Créer le chunk actuel
      chunks.push({
        seq: seq++,
        text: currentChunk.trim(),
        tokens: currentTokens,
        heading_path,
        span_start: chunkStart,
        span_end: chunkStart + currentChunk.length - 1,
        page_no: pageNo
      });
      
      // Calculer l'overlap
      const overlapSize = Math.floor(currentTokens * config.chunkOverlapPct);
      const overlapText = getLastTokens(currentChunk, overlapSize);
      
      // Commencer le nouveau chunk avec l'overlap
      currentChunk = overlapText + (overlapText ? " " : "") + sentence;
      currentTokens = countTokens(currentChunk);
      chunkStart = chunkStart + currentChunk.length - overlapText.length - sentence.length - 1;
    } else {
      // Ajouter la phrase au chunk actuel
      currentChunk += (currentChunk ? " " : "") + sentence;
      currentTokens += sentenceTokens;
    }
  }
  
  // Ajouter le dernier chunk s'il existe
  if (currentChunk.trim()) {
    chunks.push({
      seq: seq,
      text: currentChunk.trim(),
      tokens: currentTokens,
      heading_path,
      span_start: chunkStart,
      span_end: span_end,
      page_no: pageNo
    });
  }
  
  return chunks;
};

/**
 * Divise un texte en phrases
 * @param {string} text - Le texte à diviser
 * @returns {string[]} Les phrases
 */
const splitIntoSentences = (text) => {
  // Pattern simple pour diviser en phrases
  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => s + ".");
};

/**
 * Récupère les derniers tokens d'un texte pour l'overlap
 * @param {string} text - Le texte
 * @param {number} tokenCount - Nombre de tokens à récupérer
 * @returns {string} Le texte d'overlap
 */
const getLastTokens = (text, tokenCount) => {
  if (tokenCount <= 0) return "";
  
  const words = text.split(" ");
  const targetWords = Math.ceil(tokenCount / 4); // Approximation inverse
  
  if (targetWords >= words.length) return text;
  
  return words.slice(-targetWords).join(" ");
};

module.exports = { chunkSections };
