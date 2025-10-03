const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Client pour le microservice d'embeddings
 */
class EmbedderClient {
  constructor() {
    this.apiUrl = config.embedApiUrl;
    this.modelName = config.embedModelName;
    this.timeout = 30000; // 30 secondes
    
    // Configuration axios
    this.client = axios.create({
      baseURL: this.apiUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    logger.info(`[embed] Client initialisé - API: ${this.apiUrl}, Modèle: ${this.modelName}`);
  }

  /**
   * Vérifie la santé du microservice
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      logger.error(`[embed] Healthcheck failed: ${error.message}`);
      throw new Error(`Microservice embedder non disponible: ${error.message}`);
    }
  }

  /**
   * Récupère les informations du modèle
   */
  async getModelInfo() {
    try {
      const response = await this.client.get('/info');
      return response.data;
    } catch (error) {
      logger.error(`[embed] Erreur récupération info modèle: ${error.message}`);
      throw error;
    }
  }

  /**
   * Génère des embeddings pour une liste de textes
   * @param {string[]} texts - Liste des textes
   * @returns {Promise<{vectors: number[][], dim: number, processing_time_ms: number}>}
   */
  async generateEmbeddings(texts) {
    if (!texts || texts.length === 0) {
      throw new Error('Liste de textes vide');
    }

    const startTime = Date.now();
    
    try {
      logger.info(`[embed] Génération embeddings pour ${texts.length} textes`);
      
      // Use Ollama directly for embeddings
      const vectors = [];
      
      for (const text of texts) {
        const response = await axios.post(`${this.apiUrl}/api/embeddings`, {
          model: 'nomic-embed-text:latest',
          prompt: text.trim()
        }, {
          timeout: this.timeout
        });

        const { embedding } = response.data;
        
        if (!embedding || !Array.isArray(embedding)) {
          throw new Error('Réponse embedding invalide');
        }
        
        vectors.push(embedding);
      }
      
      const dim = vectors.length > 0 ? vectors[0].length : 0;
      const processing_time_ms = Date.now() - startTime;
      const totalTime = Date.now() - startTime;

      // Validation des embeddings
      if (!vectors || vectors.length !== texts.length) {
        throw new Error(`Nombre d'embeddings incorrect: attendu ${texts.length}, reçu ${vectors?.length || 0}`);
      }

      // Vérification de la dimension
      if (vectors.length > 0 && vectors[0].length !== dim) {
        throw new Error(`Dimension incorrecte: attendue ${dim}, reçue ${vectors[0].length}`);
      }

      // Vérification de la normalisation L2
      for (let i = 0; i < Math.min(vectors.length, 5); i++) {
        const norm = Math.sqrt(vectors[i].reduce((sum, val) => sum + val * val, 0));
        if (Math.abs(norm - 1.0) > 0.01) {
          logger.warn(`[embed] Vecteur ${i} non normalisé: norme = ${norm.toFixed(4)}`);
        }
      }

      logger.info(`[embed] Embeddings générés: ${vectors.length} vecteurs, dim=${dim}, temps=${totalTime}ms (API: ${processing_time_ms}ms)`);

      return {
        vectors,
        dim,
        processing_time_ms: totalTime,
        api_time_ms: processing_time_ms
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      logger.error(`[embed] Erreur génération embeddings (${totalTime}ms): ${error.message}`);
      
      if (error.response) {
        logger.error(`[embed] Réponse API: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      
      throw new Error(`Génération embeddings échouée: ${error.message}`);
    }
  }

  /**
   * Génère des embeddings par batch avec gestion des erreurs
   * @param {string[]} texts - Liste des textes
   * @param {number} batchSize - Taille des batches (défaut: 50)
   * @returns {Promise<{vectors: number[][], dim: number, stats: object}>}
   */
  async generateEmbeddingsBatch(texts, batchSize = 50) {
    if (!texts || texts.length === 0) {
      return { vectors: [], dim: 0, stats: { total: 0, batches: 0, total_time_ms: 0 } };
    }

    const startTime = Date.now();
    const allVectors = [];
    let totalApiTime = 0;
    let dimension = 0;

    logger.info(`[embed] Génération par batch: ${texts.length} textes, taille batch=${batchSize}`);

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(texts.length / batchSize);

      try {
        logger.info(`[embed] Traitement batch ${batchIndex}/${totalBatches} (${batch.length} textes)`);
        
        const result = await this.generateEmbeddings(batch);
        
        allVectors.push(...result.vectors);
        totalApiTime += result.api_time_ms;
        dimension = result.dim;

      } catch (error) {
        logger.error(`[embed] Erreur batch ${batchIndex}: ${error.message}`);
        throw new Error(`Échec batch ${batchIndex}/${totalBatches}: ${error.message}`);
      }
    }

    const totalTime = Date.now() - startTime;
    const stats = {
      total: texts.length,
      batches: Math.ceil(texts.length / batchSize),
      batch_size: batchSize,
      total_time_ms: totalTime,
      api_time_ms: totalApiTime,
      avg_time_per_text_ms: Math.round(totalTime / texts.length)
    };

    logger.info(`[embed] Batch terminé: ${stats.total} embeddings en ${stats.total_time_ms}ms (${stats.avg_time_per_text_ms}ms/texte)`);

    return {
      vectors: allVectors,
      dim: dimension,
      stats
    };
  }
}

// Instance singleton
let embedderClient = null;

/**
 * Récupère l'instance du client embedder
 */
function getEmbedderClient() {
  if (!embedderClient) {
    embedderClient = new EmbedderClient();
  }
  return embedderClient;
}

/**
 * Génère des embeddings pour une liste de chunks
 * @param {Array} chunks - Liste des chunks avec id et text
 * @returns {Promise<Array>} - Liste des embeddings avec chunk_id et vector
 */
async function generateEmbeddings(chunks) {
  if (!chunks || chunks.length === 0) {
    return [];
  }

  const client = getEmbedderClient();
  
  // Extraction des textes
  const texts = chunks.map(chunk => chunk.text);
  const chunkIds = chunks.map(chunk => chunk.id);

  try {
    // Génération des embeddings
    const result = await client.generateEmbeddingsBatch(texts);
    
    // Association des vecteurs aux chunk_ids
    const embeddings = result.vectors.map((vector, index) => ({
      chunk_id: chunkIds[index],
      vector: vector,
      dim: result.dim
    }));

    logger.info(`[embed] Embeddings associés: ${embeddings.length} chunks`);
    
    return {
      embeddings,
      stats: result.stats,
      model_info: {
        name: client.modelName,
        dimension: result.dim
      }
    };

  } catch (error) {
    logger.error(`[embed] Erreur génération embeddings pour chunks: ${error.message}`);
    throw error;
  }
}

/**
 * Teste la connexion au microservice embedder
 */
async function testEmbedderConnection() {
  try {
    const client = getEmbedderClient();
    const health = await client.healthCheck();
    const info = await client.getModelInfo();
    
    logger.info(`[embed] Test connexion réussi - Modèle: ${info.model_name}, Dimension: ${info.dimension}`);
    
    return {
      status: 'ok',
      health,
      info
    };
  } catch (error) {
    logger.error(`[embed] Test connexion échoué: ${error.message}`);
    throw error;
  }
}

module.exports = {
  generateEmbeddings,
  testEmbedderConnection,
  getEmbedderClient
};
