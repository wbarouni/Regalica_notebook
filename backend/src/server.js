const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const config = require("./config");
const logger = require("./utils/logger");
const { errorHandler } = require("./utils/errors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: `${config.maxUploadMb}mb` }));
app.use(morgan("combined", { stream: { write: (message) => logger.info(message.trim()) } }));

// Routes
app.get("/health/ready", (req, res) => {
  res.json({ status: "ready" });
});

// Routes d'ingestion
const ingestRoutes = require("./ingest/routes");
app.use("/ingest", ingestRoutes);

// Route pour lister les documents (alias pour compatibilité)
app.use("/docs", ingestRoutes);

// Routes RAG
const ragRoutes = require("./rag/routes");
app.use("/rag", ragRoutes);

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
