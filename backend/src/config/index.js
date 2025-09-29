require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const config = {
  // Server configuration
  serverPort: process.env.SERVER_PORT || 8080,
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

  // RAG Configuration
  ragTopK: parseInt(process.env.RAG_TOP_K) || 50,
  ragCitationsMin: parseInt(process.env.RAG_CITATIONS_MIN) || 2,
  ragConfidenceThreshold: parseFloat(process.env.RAG_CONFIDENCE_THRESHOLD) || 0.6,
  rerankerMaxInputChars: parseInt(process.env.RERANKER_MAX_INPUT_CHARS, 10) || 512,
  rerankerMaxCandidates: parseInt(process.env.RERANKER_MAX_CANDIDATES, 10) || 100,
  rerankerAlpha: parseFloat(process.env.RERANKER_ALPHA) || 0.30,
  rerankerBeta: parseFloat(process.env.RERANKER_BETA) || 0.70,

  // Microservices
  rerankerApiUrl: process.env.RERANKER_API_URL || 'http://reranker:8000',
  llmApiUrl: process.env.LLM_API_URL || 'http://ollama:11434',
  llmModelName: process.env.LLM_MODEL_NAME || 'qwen2:7b-instruct',

  // URL Configuration
  backendExternalUrl: process.env.BACKEND_EXTERNAL_URL || '',
  frontendExternalUrl: process.env.FRONTEND_EXTERNAL_URL || '',
  corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:4200',
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
