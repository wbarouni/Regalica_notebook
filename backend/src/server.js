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
logger.info(`CORS allowed origins: ${allowedOrigins.join(', ')}`);

const corsOptions = {
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origine (ex: Postman, curl)
    if (!origin) {
      return callback(null, true);
    }

    if (isOriginAllowed(origin, allowedOrigins)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
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
  res.json(getPublicUrlConfig(config));
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
