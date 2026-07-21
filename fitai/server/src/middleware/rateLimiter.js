const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

/**
 * A stable, non-reversible fingerprint of the caller's bearer token.
 *
 * apiLimiter runs BEFORE requireAuth (it has to — it also protects the
 * unauthenticated surface), so req.user does not exist yet and we cannot key
 * on a verified user id. Hashing the token gives a key that is stable per
 * session and distinct per account without verifying anything.
 *
 * Never the raw token: rate-limit keys sit in memory and can surface in
 * diagnostics, and a bearer token is a credential.
 */
function tokenFingerprint(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return 'anon';
  return crypto.createHash('sha256').update(header.slice(7)).digest('hex').slice(0, 16);
}

/**
 * General API limiter.
 *
 * Keyed by IP **and** token fingerprint, not IP alone. IP alone means every
 * account behind one address — a gym's wifi, a household, a corporate NAT,
 * a mobile carrier's CGNAT — shares a single 200-request budget, so one
 * user's normal session can 429 a stranger's. That is one account's
 * behaviour degrading another account's, which is exactly what must never
 * happen.
 *
 * The IP stays in the key so unauthenticated traffic from a single source is
 * still bounded (an attacker sending no token collapses to one bucket per
 * IP). Authenticated users get their own bucket each.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${tokenFingerprint(req)}`,
});

// Tighter limiter on AI routes specifically — these are the expensive ones.
// Keyed per USER, not per IP: requireAuth always runs before this on AI
// routes, so req.user exists. Per-IP would throttle a whole gym's wifi
// together and let one user dodge the cap by rotating IPs.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many AI requests, slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  // req.user is guaranteed here, but fall back to the token fingerprint
  // rather than a single shared 'unauthenticated' bucket — if this limiter
  // is ever mounted before auth, one anonymous caller must not be able to
  // exhaust the AI budget for every other anonymous caller.
  keyGenerator: (req) => req.user?.id || `anon:${req.ip}:${tokenFingerprint(req)}`,
});

module.exports = { apiLimiter, aiLimiter, tokenFingerprint };
