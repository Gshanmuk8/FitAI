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

// Supabase's direct-connection host (db.<ref>.supabase.co) is now IPv6-only.
// IPv4-only networks (Render, many CI runners) can't route to it, so every
// connection dies with `connect ENETUNREACH …:5432` before TLS even starts.
// If we're handed a direct URL, transparently rewrite it to the Session
// pooler (aws-0-<region>.pooler.supabase.com) — IPv4-reachable and the
// Supabase-recommended endpoint for such networks. Setting DATABASE_URL to a
// pooler URL directly is still preferred; this is a safety net so a stale
// direct URL doesn't take prod down. Region defaults to this project's
// (ap-northeast-1); override with SUPABASE_POOLER_REGION for other projects.
function toReachableConnString(url) {
  try {
    const u = new URL(url);
    const m = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    if (!m) return { url, rewritten: false };
    const ref = m[1];
    const region = process.env.SUPABASE_POOLER_REGION || "ap-northeast-1";
    u.hostname = `aws-0-${region}.pooler.supabase.com`;
    if (u.username === "postgres") u.username = `postgres.${ref}`; // pooler tenant form
    return { url: u.toString(), rewritten: true };
  } catch {
    return { url, rewritten: false };
  }
}
const { url: CONN_STRING, rewritten: POOLER_REWRITE } = toReachableConnString(DATABASE_URL);

const sslEnabled = process.env.DATABASE_SSL != null && process.env.DATABASE_SSL !== ""
  ? process.env.DATABASE_SSL === "true"
  : NODE_ENV === "production" || !isLocalHost(CONN_STRING);

// TLS is on, but by default the certificate is NOT verified — the historical
// setting, kept as the default because tightening it blindly would break any
// deploy whose provider serves a cert Node's bundled roots don't chain to,
// and a database that won't connect is a worse failure than this one. It is
// still a real weakness: an attacker who can occupy the network path can
// present their own cert and read every query.
//
// To close it, set either:
//   DATABASE_SSL_CA=<PEM contents, or a path to a .crt/.pem file>
//   DATABASE_SSL_REJECT_UNAUTHORIZED=true   (verify against Node's own roots)
// Verify in staging before production — a wrong CA fails closed, as it should.
function resolveSslConfig() {
  if (!sslEnabled) return {};

  const rawCa = process.env.DATABASE_SSL_CA;
  let ca;
  if (rawCa) {
    try {
      ca = rawCa.includes("BEGIN CERTIFICATE")
        ? rawCa
        : require("fs").readFileSync(rawCa, "utf8");
    } catch (err) {
      // Fail loudly rather than silently downgrading: an operator who set a
      // CA path expects verification, and must not get an unverified link.
      throw new Error(`DATABASE_SSL_CA could not be read (${rawCa}): ${err.message}`);
    }
  }

  const rejectUnauthorized = Boolean(ca) || process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true";
  if (!rejectUnauthorized && NODE_ENV === "production") {
    require("../utils/logger").warn(
      "Postgres TLS: certificate verification is OFF — set DATABASE_SSL_CA or " +
      "DATABASE_SSL_REJECT_UNAUTHORIZED=true to verify the server certificate."
    );
  }
  return { ssl: { rejectUnauthorized, ...(ca ? { ca } : {}) } };
}

// Log which host we're actually dialing (never the password). This makes
// deploy logs say plainly whether DATABASE_URL points at the IPv4 pooler
// (aws-0-*.pooler.supabase.com) or the IPv6-only direct host
// (db.*.supabase.co) — the latter is unreachable from IPv4-only networks
// like Render and is the usual cause of "connect ENETUNREACH …:5432".
try {
  const host = new URL(CONN_STRING).host;
  require("../utils/logger").info(
    `Postgres: connecting to ${host} (ssl: ${sslEnabled})${POOLER_REWRITE ? " [rewrote Supabase direct->pooler]" : ""}`
  );
} catch {
  require("../utils/logger").warn("Postgres: DATABASE_URL is unparseable");
}

const pool = new Pool({
  connectionString: CONN_STRING,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // A hung query must not pin a client forever — with only 10 clients,
  // one bad query class could starve the whole pool and 500 the site.
  statement_timeout: 15000,
  query_timeout: 20000,
  ...resolveSslConfig(),
});

pool.on("error", (err) => {
  // Structured logger, same as everything else — a lost idle client is
  // recoverable (pg reconnects on next query) but worth seeing in logs.
  require("../utils/logger").error("Unexpected idle Postgres client error", { error: err.message });
});

module.exports = { pool };
