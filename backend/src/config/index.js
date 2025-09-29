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
  chunkTokensMax: parseInt(process.env.CHUNK_TOKENS_MAX, 10) || 1800,
  chunkOverlapPct: parseFloat(process.env.CHUNK_OVERLAP_PCT) || 0.25,
  allowedMime: (process.env.ALLOWED_MIME || "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html,text/plain").split(","),
  ocrEnable: process.env.OCR_ENABLE === "true",
};

// Validation
if (config.chunkOverlapPct < 0 || config.chunkOverlapPct > 0.9) {
  throw new Error("CHUNK_OVERLAP_PCT must be between 0 and 0.9");
}

if (!config.embedApiUrl || !config.embedModelName) {
  throw new Error("EMBED_API_URL and EMBED_MODEL_NAME are required");
}

module.exports = config;
