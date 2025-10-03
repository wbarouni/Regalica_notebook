const pool = require("./pool");
const fs = require("fs");
const path = require("path");

const runMigrations = async () => {
  const client = await pool.connect();
  try {
    const migIngest = fs.readFileSync(path.resolve(__dirname, "../../../deploy/sql/0002_ingest_pgvector_up.sql"), "utf8");
    const migRagLogsPath = path.resolve(__dirname, "../../../deploy/sql/0003_rag_logs_up.sql");
    const migRagLogs = fs.existsSync(migRagLogsPath) ? fs.readFileSync(migRagLogsPath, "utf8") : '';
    
    console.log("Running database migrations...");
    await client.query(migIngest);
    if (migRagLogs) {
      await client.query(migRagLogs);
    }
    console.log("Database migrations completed successfully.");

  } catch (error) {
    console.error("Error running migrations:", error);
    process.exit(1);
  } finally {
    client.release();
  }
};

module.exports = { runMigrations };
