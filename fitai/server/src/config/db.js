const { Pool } = require("pg");
const { DATABASE_URL, NODE_ENV } = require("./env");

// Managed Postgres (Render, Supabase, Neon, …) requires TLS; local docker
// Postgres does not. Auto-decision: SSL on unless the DB host is local.
// This is more robust than keying off NODE_ENV alone — a deploy that forgot
// to set NODE_ENV=production would otherwise connect WITHOUT SSL to a hosted
// DB, which Supabase refuses, 500ing every DB-backed route. Explicit
// DATABASE_SSL=true|false always wins for edge cases (e.g. a non-TLS
// internal DB, or forcing SSL in local dev against a hosted DB).
function isLocalHost(connString) {
  try {
    const host = new URL(connString).hostname;
    return ["localhost", "127.0.0.1", "::1", ""].includes(host);
  } catch {
    return false; // unparseable -> assume remote, prefer SSL
  }
}
const sslEnabled = process.env.DATABASE_SSL != null && process.env.DATABASE_SSL !== ""
  ? process.env.DATABASE_SSL === "true"
  : NODE_ENV === "production" || !isLocalHost(DATABASE_URL);

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
