const pool = require("./pool");
const fs = require("fs");
const path = require("path");

const runMigrations = async () => {
  const client = await pool.connect();
  try {
    const migrationFiles = [
      path.resolve(__dirname, "../../../deploy/sql/0002_ingest_pgvector_up.sql"),
      path.resolve(__dirname, "../../../deploy/sql/0003_rag_logs_up.sql"),
      path.resolve(__dirname, "../../../deploy/sql/2025_10_05_workspaces.sql")
    ];
    console.log("Running database migrations...");
    for (const file of migrationFiles) {
      const migrationScript = fs.readFileSync(file, "utf8");
      await client.query(migrationScript);
      console.log(`Migration ${path.basename(file)} completed.`);
    }
    console.log("All database migrations completed successfully.");

  } catch (error) {
    console.error("Error running migrations:", error);
    process.exit(1);
  } finally {
    client.release();
  }
};

module.exports = { runMigrations };
