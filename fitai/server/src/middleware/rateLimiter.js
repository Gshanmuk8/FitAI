const rateLimit = require('express-rate-limit');

/**
 * Rate limiting has to satisfy two things that pull against each other:
 *
 *   ABUSE must be bounded by something the caller cannot forge. The only
 *   such thing before authentication is the IP.
 *   ACCOUNTS must not share a budget, or one user behind a gym's wifi or a
 *   carrier NAT can 429 a stranger.
 *
 * An earlier attempt keyed the global limiter on `ip + hash(bearer token)`
 * to get both at once. That was a hole: the token is not verified at that
 * point, so an attacker sending a fresh random token per request minted a
 * fresh bucket per request and was effectively unlimited from one IP.
 *
 * The split below is the honest version:
 *   - ipLimiter   — keyed on IP alone, unforgeable, generous. A floor that
 *                   only abuse reaches, so shared-NAT users don't trip it.
 *   - userLimiter — keyed on a VERIFIED req.user.id, applied inside
 *                   requireAuth. Each account gets its own budget, and it
 *                   cannot be dodged because the id came from a validated
 *                   token.
 *   - aiLimiter   — the tight budget on provider-spending routes.
 */

// The key functions are exported so they can be asserted directly — the
// middleware object does not expose its keyGenerator, and this invariant is
// too easy to break silently to leave untested.
const accountKey = (req) => req.user?.id || req.ip;

// The unforgeable floor. High enough that a household or gym sharing one
// address never notices, low enough to blunt a flood. Real per-account
// fairness is enforced by userLimiter once identity is known.
const ipLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this network — please slow down.' },
});

// Per-account fairness. Applied AFTER the token is verified, so the key
// cannot be forged by rotating tokens. This is the limit an individual user
// actually lives within.
const userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down.' },
  keyGenerator: accountKey,
});

// Tighter limiter on AI routes specifically — these are the expensive ones.
// Keyed per USER, not per IP: requireAuth always runs before this on AI
// routes, so req.user exists. Per-IP would throttle a whole gym's wifi
// together and let one user dodge the cap by rotating IPs.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests, slow down.' },
  keyGenerator: accountKey,
});

// `apiLimiter` is the name app.js has always mounted globally; it is the IP
// floor. Kept as an alias so the mount point does not have to care.
module.exports = {
  apiLimiter: ipLimiter, ipLimiter, userLimiter, aiLimiter,
  accountKey, IP_MAX: 1000, USER_MAX: 300, AI_MAX: 20,
};
