const rateLimit = require('express-rate-limit');

// General API limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter limiter on AI routes specifically — these are the expensive ones.
// Keyed per USER, not per IP: requireAuth always runs before this on AI
// routes, so req.user exists. Per-IP would throttle a whole gym's wifi
// together and let one user dodge the cap by rotating IPs.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many AI requests, slow down.' },
  keyGenerator: (req) => req.user?.id || 'unauthenticated',
});

module.exports = { apiLimiter, aiLimiter };
