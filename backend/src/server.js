const express = require("express");
const http = require("http");
const cors = require("cors");
const morgan = require("morgan");
const axios = require("axios");
const config = require("./config");
const logger = require("./utils/logger");
const { errorHandler } = require("./utils/errors");
const { parseCorsOrigins, isOriginAllowed, getPublicUrlConfig } = require("./utils/url");

const app = express();
const server = http.createServer(app);

// Configuration CORS avancée
const allowedOrigins = parseCorsOrigins(config.corsAllowedOrigins);
const isProduction = process.env.NODE_ENV === 'production';

logger.info(`Environment: ${isProduction ? 'production' : 'development'}`);
logger.info(`CORS allowed origins: ${allowedOrigins.length > 0 ? allowedOrigins.join(', ') : 'none configured'}`);

const corsOptions = {
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origine (ex: Postman, curl) uniquement en développement
    if (!origin) {
      return callback(null, !isProduction);
    }

    if (isOriginAllowed(origin, allowedOrigins)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin} (production: ${isProduction})`);
      callback(new Error(`CORS policy violation: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200 // Pour supporter les anciens navigateurs
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: `${config.maxUploadMb}mb` }));
app.use(morgan("combined", { stream: { write: (message) => logger.info(message.trim()) } }));

// Root route - API information
app.get("/", (req, res) => {
  res.json({
    name: "Regalica Notebook API",
    version: "1.0.0",
    status: "running",
    endpoints: {
      health: "/health/ready",
      config: "/api/config",
      ingest: "/api/ingest",
      documents: "/api/docs",
      rag: "/api/rag",
      studio: "/api/studio"
    },
    documentation: "Access API endpoints using the paths listed above",
    timestamp: new Date().toISOString()
  });
});

// Routes
app.get("/health/ready", async (req, res) => {
  const checkService = async (url) => {
    try {
      const response = await axios.get(url, { timeout: 3000 });
      return response.status === 200;
    } catch (err) {
      logger.error(`Health check failed for ${url}: ${err.message}`);
      return false;
    }
  };

  const services = {
    embedder: await checkService('http://embedder:8000/health'),
    reranker: await checkService('http://reranker:8001/health'),
    llm: await checkService('http://ollama:11434/api/tags'),
    database: true
  };

  const allReady = Object.values(services).every(s => s === true);
  res.status(allReady ? 200 : 503).json({
    status: allReady ? 'ready' : 'not_ready',
    services,
    timestamp: new Date().toISOString()
  });
});

// Configuration publique (sans secrets)
app.get("/api/config", (req, res) => {
  // Déterminer l'URL backend dynamiquement
  let backendBaseUrl = config.backendExternalUrl;
  
  if (!backendBaseUrl) {
    // En production, utiliser l'URL de la requête
    if (isProduction && req.headers.host) {
      const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
      backendBaseUrl = `${protocol}://${req.headers.host}`;
    } else {
      // En développement, utiliser localhost
      backendBaseUrl = `http://localhost:${config.serverPort}`;
    }
  }

  const publicConfig = {
    backendBaseUrl,
    maxUploadSizeMb: config.maxUploadMb,
    features: {
      mindmap: true,
      podcast: true,
      export: true
    },
    environment: isProduction ? 'production' : 'development',
    version: '1.0.0'
  };
  
  res.json(publicConfig);
});

// Routes d'ingestion
const ingestRoutes = require("./ingest/routes");
app.use("/api/ingest", ingestRoutes);

// Route pour lister les documents (alias pour compatibilité)
app.use("/api/docs", ingestRoutes);

// Routes RAG
const ragRoutes = require("./rag/routes");
const citationRoutes = require("./rag/citation-routes");
const streamRoutes = require("./rag/stream-routes");
const batchRoutes = require("./rag/batch-routes");
app.use("/api/rag", ragRoutes);
app.use("/api/rag/citation", citationRoutes);
app.use("/api/rag", streamRoutes);  // Streaming SSE routes
app.use("/api/rag", batchRoutes);   // Batch processing routes

// Dynamic model management routes
const modelRoutes = require("./rag/model-routes");
app.use("/api/rag", modelRoutes);

// Studio routes
const studioRoutes = require("./studio/routes");
app.use("/api/studio", studioRoutes);

// Notebooks routes
const notebookRoutes = require("./notebooks/routes");
app.use("/api/notebooks", notebookRoutes);

// Agent routes removed per request

// Error handler
app.use(errorHandler);

// Initialize Socket.IO for real-time features
if (config.features.realtimeMindmap) {
  const socketIO = require("socket.io");
  const { initializeSocketIO } = require("./studio/socket");
  
  const io = socketIO(server, {
    cors: corsOptions,
    transports: ['websocket', 'polling']
  });
  
  initializeSocketIO(io);
  logger.info('[Socket.IO] Real-time features enabled');
}

// Initialisation de la base de données
const { runMigrations } = require("./db/init");

// Démarrage du serveur
const startServer = async () => {
  try {
    await runMigrations();
    
    server.listen(config.serverPort, () => {
      logger.info(`Server running on port ${config.serverPort}`);
      logger.info(`Log level: ${config.logLevel}`);
      logger.info(`Database schema: ${config.dbSchema}`);
      logger.info(`Max upload size: ${config.maxUploadMb}MB`);
      logger.info(`Embed model: ${config.embedModelName}`);
      logger.info(`LLM base URL: ${config.llmApiUrl}`);
      logger.info(`LLM current model: ${config.llmModelName}`);
      if (config.features.realtimeMindmap) {
        logger.info(`Socket.IO enabled on port ${config.serverPort}`);
      }
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
