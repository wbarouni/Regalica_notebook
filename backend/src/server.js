const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const axios = require("axios");
const pool = require("./db/pool");
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

// Security Middleware
// Enhanced Helmet configuration for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Required for some CSS-in-JS frameworks
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"], // Prevent clickjacking
      baseUri: ["'self'"],
      formAction: ["'self'"]
    },
  },
  crossOriginEmbedderPolicy: isProduction, // Enable in production only
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' }, // X-Frame-Options: DENY
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true, // X-Content-Type-Options: nosniff
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true
}));

// Rate limiting - general API protection
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !isProduction, // Skip rate limiting in development
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please slow down and try again later',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Stricter rate limiting for resource-intensive operations
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit to 20 requests per 15 minutes
  message: 'Too many resource-intensive requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !isProduction,
  handler: (req, res) => {
    logger.warn(`Strict rate limit exceeded for IP: ${req.ip} on ${req.path}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'This endpoint has stricter rate limits. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Apply general rate limiter to all routes
app.use(generalLimiter);

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

  // Check database connectivity
  const checkDatabase = async () => {
    try {
      const client = await pool.connect();
      try {
        // Verify connection with simple query
        await client.query('SELECT 1');
        // Verify pgvector extension is loaded
        const extCheck = await client.query(`
          SELECT extname FROM pg_extension WHERE extname = 'vector'
        `);
        return extCheck.rows.length > 0;
      } finally {
        client.release();
      }
    } catch (err) {
      logger.error(`Database health check failed: ${err.message}`);
      return false;
    }
  };

  const services = {
    database: await checkDatabase(),
    embedder: await checkService('http://embedder:8000/health'),
    reranker: await checkService('http://reranker:8001/health'),
    llm: await checkService(`${config.llmApiUrl}/api/tags`)
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

// Routes d'ingestion (with strict rate limiting for uploads)
const ingestRoutes = require("./ingest/routes");
app.use("/api/ingest", strictLimiter, ingestRoutes);

// Route pour lister les documents (alias pour compatibilité)
app.use("/api/docs", ingestRoutes);

// Routes RAG (with strict rate limiting for queries)
const ragRoutes = require("./rag/routes");
const citationRoutes = require("./rag/citation-routes");
const streamRoutes = require("./rag/stream-routes");
const batchRoutes = require("./rag/batch-routes");
app.use("/api/rag", strictLimiter, ragRoutes);
app.use("/api/rag/citation", strictLimiter, citationRoutes);
app.use("/api/rag", strictLimiter, streamRoutes);  // Streaming SSE routes
app.use("/api/rag", strictLimiter, batchRoutes);   // Batch processing routes

// Dynamic model management routes
const modelRoutes = require("./rag/model-routes");
app.use("/api/rag", modelRoutes);

// Studio routes
const studioRoutes = require("./studio/routes");
app.use("/api/studio", studioRoutes);

// Notebooks routes
const notebookRoutes = require("./notebooks/routes");
app.use("/api/notebooks", notebookRoutes);

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

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received: Starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Close database pool
      await pool.end();
      logger.info('Database pool closed');
      
      // Close Socket.IO if enabled
      if (config.features.realtimeMindmap && io) {
        io.close(() => {
          logger.info('Socket.IO closed');
        });
      }
      
      logger.info('Graceful shutdown completed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Graceful shutdown timeout - forcing exit');
    process.exit(1);
  }, 30000);
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

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
      logger.info('Server is ready to accept connections');
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
