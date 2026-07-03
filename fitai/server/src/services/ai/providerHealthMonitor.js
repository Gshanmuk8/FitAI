/**
 * Scores provider health from providerMetrics and reorders the default
 * cascade priority so a degraded provider sinks toward the back instead
 * of being tried first on every single request. This is read-side only —
 * it never calls a provider and never removes one permanently; a provider
 * with zero successes still gets retried once its cooldown expires.
 */
const metrics = require("./providerMetrics");

const COOLDOWN_MS = 2 * 60 * 1000; // a provider that just rate-limited sits out for 2 minutes
const MIN_CALLS_FOR_SCORING = 5; // don't punish a provider after one unlucky call

const cooldownUntil = new Map(); // name -> timestamp

function markRateLimited(name) {
  cooldownUntil.set(name, Date.now() + COOLDOWN_MS);
}

function isInCooldown(name) {
  const until = cooldownUntil.get(name);
  return Boolean(until && until > Date.now());
}

function healthScore(name) {
  if (isInCooldown(name)) return -1;
  const s = metrics.snapshot(name);
  // Neutral, not a free pass to the front: an untested provider sits
  // below a proven-healthy one (score near 1) but above a proven-degraded
  // one. This is what keeps the default cascade order (Gemini first)
  // stable until a provider actually earns a worse score through real
  // failures, while still letting a struggling Gemini fall behind a
  // provider that's been working fine.
  if (s.calls < MIN_CALLS_FOR_SCORING) return 0.5;
  const latencyPenalty = s.avgLatency ? Math.min(s.avgLatency / 10000, 0.5) : 0;
  return s.successRate - latencyPenalty;
}

// Re-sorts providerNames: healthiest first, ties broken by original
// (default priority) order, degraded/cooling-down providers pushed to
// the back. Nothing is ever dropped from the list.
function orderByHealth(providerNames) {
  return [...providerNames]
    .map((name, idx) => ({ name, idx, score: healthScore(name) }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .map((p) => p.name);
}

function recordOutcome(name, { success, latencyMs, rateLimited } = {}) {
  if (success) {
    metrics.recordSuccess(name, latencyMs ?? 0);
  } else {
    metrics.recordFailure(name, { rateLimited });
    if (rateLimited) markRateLimited(name);
  }
}

function report() {
  const names = new Set([...cooldownUntil.keys(), ...Object.keys(metrics.allSnapshots())]);
  const out = {};
  for (const name of names) {
    out[name] = { ...metrics.snapshot(name), inCooldown: isInCooldown(name), score: healthScore(name) };
  }
  return out;
}

module.exports = { markRateLimited, isInCooldown, healthScore, orderByHealth, recordOutcome, report };
