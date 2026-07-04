const { Pool } = require("pg");
const { DATABASE_URL, NODE_ENV } = require("./env");

// Managed Postgres (Render, Supabase, Neon, …) requires TLS; local docker
// Postgres does not. Default to SSL in production, overridable with
// DATABASE_SSL=true|false for edge cases (e.g. a non-TLS internal DB).
const sslEnabled = process.env.DATABASE_SSL
  ? process.env.DATABASE_SSL === "true"
  : NODE_ENV === "production";

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ...(sslEnabled ? { ssl: { rejectUnauthorized: false } } : {}),
});

pool.on("error", (err) => {
  // Structured logger, same as everything else — a lost idle client is
  // recoverable (pg reconnects on next query) but worth seeing in logs.
  require("../utils/logger").error("Unexpected idle Postgres client error", { error: err.message });
});

module.exports = { pool };
