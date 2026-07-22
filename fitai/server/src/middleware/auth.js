const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = require('../config/env');
const { userLimiter } = require('./rateLimiter');
const { createExpiringMap } = require('../utils/expiringMap');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Verified-token cache.
 *
 * supabase.auth.getUser() is a network call to the Supabase auth service,
 * and it ran on EVERY request — a dashboard load makes three in parallel, a
 * meal save makes two, a tab switch makes two. At ~100-200ms each that was
 * the largest fixed latency in the app, paid on every endpoint.
 *
 * Keyed on a SHA-256 of the token, never the token itself: this map lives in
 * memory and can surface in a heap dump or a debugger, and a bearer token is
 * a credential. Only SUCCESSFUL verifications are cached — a rejected token
 * must be re-checked every time, or a user whose session is restored a
 * second later would keep being turned away.
 *
 * The security trade is explicit: a session revoked upstream stays usable
 * here for up to TTL. 60s is well inside normal JWT semantics (the tokens
 * themselves live far longer), and the client already handles a mid-session
 * 401 with a refresh-and-retry.
 */
const TOKEN_TTL_MS = 60 * 1000;
const verifiedTokens = createExpiringMap({ ttlMs: TOKEN_TTL_MS, maxEntries: 10_000 });
const tokenKey = (token) => crypto.createHash('sha256').update(token).digest('hex');

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  const token = authHeader.slice('Bearer '.length);
  try {
    const key = tokenKey(token);
    const cached = verifiedTokens.get(key);
    if (cached) {
      req.user = cached;
      return userLimiter(req, res, next);
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    verifiedTokens.set(key, data.user);
    req.user = data.user;
    // Per-account rate limiting happens HERE, not globally, because this is
    // the first moment the user id is trustworthy. Keying a limiter on an
    // unverified token lets an attacker mint a fresh bucket per request.
    // Placing it inside requireAuth covers every protected route without
    // each router having to remember to add it.
    return userLimiter(req, res, next);
  } catch (err) {
    // A thrown error here is the auth SERVICE failing (network, outage) —
    // not a bad token. Saying 401 would make every client force-logout its
    // user during a Supabase blip; 503 tells them to retry instead.
    require('../utils/logger').error('auth service unreachable', { error: err.message });
    res.status(503).json({ error: 'Authentication service unavailable — try again shortly.' });
  }
}

module.exports = { requireAuth };
