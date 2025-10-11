const { Pool } = require("pg");
const config = require("../config");
const logger = require("../utils/logger");

// Robust connection pool configuration
const pool = new Pool({
  connectionString: config.dbUrl,
  ssl: false,
  
  // Connection pool limits
  max: 20,                          // Maximum number of clients in the pool
  min: 2,                           // Minimum number of clients in the pool
  
  // Timeout configurations
  connectionTimeoutMillis: 10000,   // Max time to wait for connection (10s)
  idleTimeoutMillis: 30000,         // Close idle clients after 30s
  query_timeout: 30000,             // Query timeout (30s)
  statement_timeout: 30000,         // Statement timeout (30s)
  
  // Keep-alive to detect broken connections
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  
  // Application name for connection tracking
  application_name: 'regalica_notebook'
});

// Connection event handlers
pool.on("connect", (client) => {
  logger.info("Database pool: New client connected");
  
  // Set session parameters for this connection
  client.query(`SET search_path TO ${config.dbSchema}, public`)
    .catch(err => logger.error("Failed to set search_path:", err));
});

pool.on("acquire", () => {
  logger.debug("Database pool: Client acquired from pool");
});

pool.on("remove", () => {
  logger.debug("Database pool: Client removed from pool");
});

// Error handler - log but don't crash the entire service
pool.on("error", (err, client) => {
  logger.error("Unexpected database pool error:", {
    message: err.message,
    stack: err.stack,
    code: err.code
  });
  
  // Don't crash the entire service - let pool handle recovery
  // Individual queries will fail and can be retried
});

// Note: Graceful shutdown is handled by server.js to avoid duplicate handlers
// The server.js will call pool.end() during its shutdown sequence

module.exports = pool;
