const pool = require("./pool");
const fs = require("fs");
const path = require("path");

const runMigrations = async () => {
  const client = await pool.connect();
  try {
    const migrationFile = path.resolve(__dirname, "../../../deploy/sql/0002_ingest_pgvector_up.sql");
    const migrationScript = fs.readFileSync(migrationFile, "utf8");
    
    console.log("Running database migrations...");
    await client.query(migrationScript);
    console.log("Database migrations completed successfully.");

  } catch (error) {
    console.error("Error running migrations:", error);
    process.exit(1);
  } finally {
    client.release();
  }
};

module.exports = { runMigrations };
