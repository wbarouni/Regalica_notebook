const { countTokens } = require("../utils/tokencount");
const { estimateTokens, splitByTokens } = require("../rag/tokenizer");
const config = require("../config");
const logger = require("../utils/logger");
const { detectLanguage } = require("../rag/lang");
const crypto = require("crypto");

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
 * Découpe une section en chunks avec overlap et déduplication MinHash
 * @param {Object} section - La section à découper
 * @param {number} startSeq - Numéro de séquence de départ
 * @param {number} pageNo - Numéro de page
 * @returns {Array} Les chunks de la section
 */
const chunkSection = (section, startSeq, pageNo) => {
  const { text, heading_path, span_start, span_end } = section;
  
  // Détecter la langue du texte
  const lang = detectLanguage(text);
  
  // Découpe hiérarchique : d'abord par structure (titres), puis sliding-window par tokens
  const structuralChunks = splitByStructure(text, heading_path, span_start, span_end);
  
  const allChunks = [];
  let seq = startSeq;
  
  for (const structChunk of structuralChunks) {
    // Utiliser le nouveau tokenizer pour la segmentation par tokens
    const tokenSegments = splitByTokens(
      structChunk.text, 
      config.ragChunkMaxTokens, 
      config.ragChunkOverlapTokens
    );
    
    for (const segment of tokenSegments) {
      const chunk = {
        seq: seq++,
        text: segment.text,
        tokens: segment.tokens,
        heading_path: structChunk.heading_path,
        span_start: structChunk.span_start + segment.start,
        span_end: structChunk.span_start + segment.end,
        page_no: pageNo,
        meta: { 
          lang,
          section: structChunk.section,
          hpath: structChunk.heading_path.join(' > '),
          start_char: structChunk.span_start + segment.start,
          end_char: structChunk.span_start + segment.end
        }
      };
      
      allChunks.push(chunk);
    }
  }
  
  // Déduplication MinHash avec seuil Jaccard configurable
  const deduplicatedChunks = deduplicateChunks(allChunks, 0.9);
  
  logger.debug(`Section chunked: ${structuralChunks.length} structural -> ${allChunks.length} token-based -> ${deduplicatedChunks.length} deduplicated`);
  
  return deduplicatedChunks;
};

/**
 * Découpe un texte par structure hiérarchique (titres H1-H4)
 * @param {string} text - Texte à découper
 * @param {Array} heading_path - Chemin des titres
 * @param {number} span_start - Position de début
 * @param {number} span_end - Position de fin
 * @returns {Array} Chunks structurels
 */
const splitByStructure = (text, heading_path, span_start, span_end) => {
  // Pour l'instant, retourner le texte tel quel
  // TODO: Implémenter la découpe par titres H1-H4 si nécessaire
  return [{
    text,
    heading_path,
    span_start,
    span_end,
    section: heading_path.length > 0 ? heading_path[heading_path.length - 1] : 'content'
  }];
};

/**
 * Déduplication des chunks avec MinHash et seuil Jaccard
 * @param {Array} chunks - Chunks à dédupliquer
 * @param {number} jaccardThreshold - Seuil de similarité Jaccard (0.9 par défaut)
 * @returns {Array} Chunks dédupliqués
 */
const deduplicateChunks = (chunks, jaccardThreshold = 0.9) => {
  if (chunks.length <= 1) return chunks;
  
  const deduplicated = [];
  const seen = new Set();
  
  for (const chunk of chunks) {
    const signature = generateMinHashSignature(chunk.text);
    let isDuplicate = false;
    
    // Vérifier la similarité avec les chunks déjà vus
    for (const seenSig of seen) {
      const jaccard = calculateJaccardSimilarity(signature, seenSig);
      if (jaccard >= jaccardThreshold) {
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate) {
      deduplicated.push(chunk);
      seen.add(signature);
    }
  }
  
  return deduplicated;
};

/**
 * Génère une signature MinHash pour un texte
 * @param {string} text - Texte à analyser
 * @returns {Set} Signature MinHash (ensemble de hashes)
 */
const generateMinHashSignature = (text) => {
  const shingles = generateShingles(text, 3); // 3-grams
  const hashes = new Set();
  
  for (const shingle of shingles) {
    const hash = crypto.createHash('md5').update(shingle).digest('hex').substring(0, 8);
    hashes.add(hash);
  }
  
  return hashes;
};

/**
 * Génère des shingles (n-grams) à partir d'un texte
 * @param {string} text - Texte source
 * @param {number} n - Taille des shingles
 * @returns {Set} Ensemble de shingles
 */
const generateShingles = (text, n = 3) => {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const shingles = new Set();
  
  for (let i = 0; i <= words.length - n; i++) {
    const shingle = words.slice(i, i + n).join(' ');
    shingles.add(shingle);
  }
  
  return shingles;
};

/**
 * Calcule la similarité Jaccard entre deux signatures
 * @param {Set} sig1 - Première signature
 * @param {Set} sig2 - Deuxième signature
 * @returns {number} Coefficient Jaccard (0-1)
 */
const calculateJaccardSimilarity = (sig1, sig2) => {
  const intersection = new Set([...sig1].filter(x => sig2.has(x)));
  const union = new Set([...sig1, ...sig2]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
};

module.exports = { chunkSections };
