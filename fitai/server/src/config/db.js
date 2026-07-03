const { Pool } = require("pg");
const { DATABASE_URL } = require("./env");

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  // Structured logger, same as everything else — a lost idle client is
  // recoverable (pg reconnects on next query) but worth seeing in logs.
  require("../utils/logger").error("Unexpected idle Postgres client error", { error: err.message });
});

module.exports = { pool };
