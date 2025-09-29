const config = require("../config");
const logger = require("../utils/logger");

/**
 * Génère des embeddings pour les chunks
 * @param {Array} chunks - Les chunks à embedder
 * @returns {Promise<Array>} Les embeddings générés
 */
const generateEmbeddings = async (chunks) => {
  const startTime = Date.now();
  
  try {
    const embeddings = [];
    const batchSize = 32;
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchEmbeddings = await processBatch(batch);
      embeddings.push(...batchEmbeddings);
      
      logger.debug(`Processed embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
    }
    
    const duration = Date.now() - startTime;
    logger.info(`Generated ${embeddings.length} embeddings in ${duration}ms`);
    
    return embeddings;
    
  } catch (error) {
    logger.error("Error generating embeddings:", error);
    throw error;
  }
};

/**
 * Traite un batch de chunks pour générer les embeddings
 * @param {Array} batch - Le batch de chunks
 * @returns {Promise<Array>} Les embeddings du batch
 */
const processBatch = async (batch) => {
  const embeddings = [];
  
  for (const chunk of batch) {
    const embedding = await generateSingleEmbedding(chunk.text);
    embeddings.push({
      chunk_id: chunk.id, // Sera défini après insertion en DB
      model: config.embedModel,
      dim: config.embedDim,
      vec: embedding
    });
  }
  
  return embeddings;
};

/**
 * Génère un embedding pour un texte unique
 * @param {string} text - Le texte à embedder
 * @returns {Promise<number[]>} Le vecteur d'embedding
 */
const generateSingleEmbedding = async (text) => {
  // Simulation d'embedding réel selon le modèle configuré
  if (config.embedModel === "e5") {
    return generateE5Embedding(text);
  } else if (config.embedModel === "nomic") {
    return generateNomicEmbedding(text);
  } else {
    throw new Error(`Unsupported embedding model: ${config.embedModel}`);
  }
};

/**
 * Génère un embedding E5 (dimension 1024)
 * @param {string} text - Le texte
 * @returns {number[]} Vecteur de dimension 1024
 */
const generateE5Embedding = (text) => {
  // Simulation déterministe basée sur le hash du texte
  const hash = simpleHash(text);
  const vector = [];
  
  for (let i = 0; i < 1024; i++) {
    // Génération pseudo-aléatoire déterministe
    const seed = hash + i;
    vector.push(Math.sin(seed) * Math.cos(seed * 0.7) * Math.tanh(seed * 0.3));
  }
  
  // Normalisation L2
  return normalizeVector(vector);
};

/**
 * Génère un embedding Nomic (dimension 768)
 * @param {string} text - Le texte
 * @returns {number[]} Vecteur de dimension 768
 */
const generateNomicEmbedding = (text) => {
  // Simulation déterministe basée sur le hash du texte
  const hash = simpleHash(text);
  const vector = [];
  
  for (let i = 0; i < 768; i++) {
    // Génération pseudo-aléatoire déterministe différente d'E5
    const seed = hash + i * 1.3;
    vector.push(Math.cos(seed) * Math.sin(seed * 0.9) * Math.tanh(seed * 0.5));
  }
  
  // Normalisation L2
  return normalizeVector(vector);
};

/**
 * Hash simple pour générer des embeddings déterministes
 * @param {string} text - Le texte
 * @returns {number} Hash numérique
 */
const simpleHash = (text) => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

/**
 * Normalise un vecteur (norme L2)
 * @param {number[]} vector - Le vecteur à normaliser
 * @returns {number[]} Le vecteur normalisé
 */
const normalizeVector = (vector) => {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map(val => val / norm);
};

module.exports = { generateEmbeddings };
