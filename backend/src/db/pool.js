const { Pool } = require("pg");
const config = require("../config");

const pool = new Pool({
  connectionString: config.dbUrl,
  ssl: config.dbUrl.includes("localhost") ? false : { rejectUnauthorized: false },
});

pool.on("connect", () => {
  console.log("Database pool connected");
});

pool.on("error", (err) => {
  console.error("Database pool error:", err);
  process.exit(-1);
});

module.exports = pool;
