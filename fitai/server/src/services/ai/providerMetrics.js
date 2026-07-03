/**
 * Raw operational counters per AI provider: call counts, success/failure
 * counts, rate-limit counts, and a rolling window of latency samples.
 * Pure bookkeeping — no routing decisions live here. providerHealthMonitor
 * reads these to score and reorder the provider cascade.
 *
 * In-memory by design, same tradeoff cacheManager makes without Redis:
 * this is operational telemetry, not user data, so it's fine for it to
 * reset on a restart.
 */
const LATENCY_WINDOW = 50; // keep the last N latency samples per provider

const state = new Map(); // name -> { calls, successes, failures, rateLimited, latencies: [] }

function ensure(name) {
  if (!state.has(name)) {
    state.set(name, { calls: 0, successes: 0, failures: 0, rateLimited: 0, latencies: [] });
  }
  return state.get(name);
}

function recordSuccess(name, latencyMs) {
  const s = ensure(name);
  s.calls += 1;
  s.successes += 1;
  s.latencies.push(latencyMs);
  if (s.latencies.length > LATENCY_WINDOW) s.latencies.shift();
}

function recordFailure(name, { rateLimited = false } = {}) {
  const s = ensure(name);
  s.calls += 1;
  s.failures += 1;
  if (rateLimited) s.rateLimited += 1;
}

function snapshot(name) {
  const s = ensure(name);
  const avgLatency = s.latencies.length
    ? Math.round(s.latencies.reduce((a, b) => a + b, 0) / s.latencies.length)
    : null;
  const successRate = s.calls ? s.successes / s.calls : 1;
  return { calls: s.calls, successes: s.successes, failures: s.failures, rateLimited: s.rateLimited, avgLatency, successRate };
}

function allSnapshots() {
  const out = {};
  for (const name of state.keys()) out[name] = snapshot(name);
  return out;
}

function reset(name) {
  if (name) state.delete(name);
  else state.clear();
}

module.exports = { recordSuccess, recordFailure, snapshot, allSnapshots, reset };
