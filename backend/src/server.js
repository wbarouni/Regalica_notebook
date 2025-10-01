const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const config = require("./config");
const logger = require("./utils/logger");
const { errorHandler } = require("./utils/errors");
const { parseCorsOrigins, isOriginAllowed, getPublicUrlConfig } = require("./utils/url");

const app = express();

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

// Routes
app.get("/health/ready", (req, res) => {
  res.json({ status: "ready" });
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
app.use("/api/rag", ragRoutes);

// Error handler
app.use(errorHandler);

// Initialisation de la base de données
const { runMigrations } = require("./db/init");

// Démarrage du serveur
const startServer = async () => {
  try {
    await runMigrations();
    
    app.listen(config.serverPort, () => {
      logger.info(`Server running on port ${config.serverPort}`);
      logger.info(`Log level: ${config.logLevel}`);
      logger.info(`Database schema: ${config.dbSchema}`);
      logger.info(`Max upload size: ${config.maxUploadMb}MB`);
      logger.info(`Embed model: ${config.embedModel} (dim: ${config.embedDim})`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
