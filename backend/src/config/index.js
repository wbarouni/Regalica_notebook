require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const config = {
  // Server configuration
  serverPort: process.env.SERVER_PORT || 5200,
  logLevel: process.env.LOG_LEVEL || "info",

  // Database configuration
  dbUrl: process.env.DB_URL || "postgres://postgres:postgres@postgres:5432/notebook",
  dbSchema: process.env.DB_SCHEMA || "nbk",

  // Ingestion pipeline configuration
  maxUploadMb: parseInt(process.env.MAX_UPLOAD_MB, 10) || 100,
  embedApiUrl: process.env.EMBED_API_URL || "http://embedder:8000",
  embedModelName: process.env.EMBED_MODEL_NAME || "intfloat/multilingual-e5-large",
  ragChunkMaxTokens: parseInt(process.env.RAG_CHUNK_MAX_TOKENS, 10) || 800,
  ragChunkOverlapTokens: parseInt(process.env.RAG_CHUNK_OVERLAP_TOKENS, 10) || 200,
  chunkTokensMax: parseInt(process.env.CHUNK_TOKENS_MAX, 10) || 1800,
  chunkOverlapPct: parseFloat(process.env.CHUNK_OVERLAP_PCT) || 0.25,
  allowedMime: (process.env.ALLOWED_MIME || "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html,text/plain").split(","),
  ocrEnable: process.env.OCR_ENABLE === "true",

  // RAG Configuration - Optimisé pour CPU
  ragTopK: parseInt(process.env.RAG_TOP_K) || 6,  // Équilibre entre performance et résultats
  ragCitationsMin: parseInt(process.env.RAG_CITATIONS_MIN) || 0,
  hnswEfSearch: parseInt(process.env.HNSW_EF_SEARCH) || 64,
  ragBm25CoarseLimit: parseInt(process.env.RAG_BM25_COARSE_LIMIT) || 200,
  ragConfidenceThreshold: parseFloat(process.env.RAG_CONFIDENCE_THRESHOLD) || 0.1,
  ragMinCosineScore: parseFloat(process.env.RAG_MIN_COSINE_SCORE) || 0.15,
  ragMinChunkLength: parseInt(process.env.RAG_MIN_CHUNK_LENGTH) || 30,
  rerankerMaxInputChars: parseInt(process.env.RERANKER_MAX_INPUT_CHARS, 10) || 300,
  rerankerMaxCandidates: parseInt(process.env.RERANKER_MAX_CANDIDATES, 10) || 4,  // Réduit de 8 à 4
  rerankerAlpha: parseFloat(process.env.RERANKER_ALPHA) || 0.60,  // Augmenté: donner plus de poids au cosine (qui marche)
  rerankerBeta: parseFloat(process.env.RERANKER_BETA) || 0.40,   // Réduit: moins de poids au rerank (scores trop bas)
  rerankerTimeoutMs: parseInt(process.env.RERANKER_TIMEOUT_MS, 10) || 20000,
  llmChatTimeoutMs: parseInt(process.env.LLM_CHAT_TIMEOUT_MS, 10) || 60000,
  llmNumPredict: parseInt(process.env.LLM_NUM_PREDICT, 10) || 300,
  llmTemperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.1,
  llmTopP: parseFloat(process.env.LLM_TOP_P) || 0.9,
  llmRepeatPenalty: parseFloat(process.env.LLM_REPEAT_PENALTY) || 1.1,

  // Microservices
  rerankerApiUrl: process.env.RERANKER_API_URL || 'http://reranker:8001',
  llmApiUrl: process.env.LLM_API_URL || 'http://ollama:11434',
  llmModelName: process.env.LLM_MODEL_NAME || 'qwen2.5:3b-instruct-q4_k_m',
  clustererApiUrl: process.env.CLUSTERER_API_URL || 'http://clusterer:8002',

  // LLM Multi-model routing (Phase 1)
  llmModelFast: process.env.LLM_MODEL_FAST || 'qwen2.5:3b-instruct-q4_k_m',
  llmModelDeep: process.env.LLM_MODEL_DEEP || 'qwen2.5:7b-instruct-q4_k_m',
  llmModelMicro: process.env.LLM_MODEL_MICRO || 'tinyllama:latest',

  // Studio Features
  features: {
    mindmap: process.env.FEATURE_MINDMAP !== 'false',
    workspaces: process.env.FEATURE_WORKSPACES !== 'false',
    realtimeMindmap: process.env.FEATURE_REALTIME_MINDMAP === 'true'
  },
  
  // Studio Configuration
  llmNodeSummaryModel: process.env.LLM_NODE_SUMMARY_MODEL || process.env.LLM_MODEL_NAME || 'tinyllama:latest',
  minClusterSize: parseInt(process.env.MIN_CLUSTER_SIZE, 10) || 5,
  minSamples: parseInt(process.env.MIN_SAMPLES, 10) || 5,
  clusterMetric: process.env.CLUSTER_METRIC || 'cosine',

  // URL Configuration
  backendExternalUrl: process.env.BACKEND_EXTERNAL_URL || '',
  frontendExternalUrl: process.env.FRONTEND_EXTERNAL_URL || '',
  corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS || '',
};

// Validation
if (config.chunkOverlapPct < 0 || config.chunkOverlapPct > 0.9) {
  throw new Error("CHUNK_OVERLAP_PCT must be between 0 and 0.9");
}

if (config.ragChunkOverlapTokens >= config.ragChunkMaxTokens) {
  throw new Error("RAG_CHUNK_OVERLAP_TOKENS must be less than RAG_CHUNK_MAX_TOKENS");
}

if (config.rerankerAlpha + config.rerankerBeta !== 1.0) {
  throw new Error("RERANKER_ALPHA + RERANKER_BETA must equal 1.0");
}

if (!config.embedApiUrl || !config.embedModelName) {
  throw new Error("EMBED_API_URL and EMBED_MODEL_NAME are required");
}

module.exports = config;
