/**
 * Per-provider circuit breaker: closed → open → half-open → closed.
 *
 * Why this exists next to the health monitor's cooldown: the cooldown is
 * a polite response to an explicit 429 ("come back later, they said so").
 * The breaker handles the uglier case — a provider that keeps FAILING
 * (timeouts, 5xx, auth broken) without ever asking us to stop. Without
 * it, every request still pays that provider's full timeout before
 * falling through the cascade; with it, a provider that hard-failed
 * `failureThreshold` times in a row is skipped instantly for `openMs`,
 * then given exactly ONE probe request (half-open). Probe succeeds →
 * circuit closes and traffic resumes; probe fails → another full open
 * period. Recovery is automatic, never manual.
 *
 * Factory (not singleton) so tests can build breakers with tiny windows.
 */
function createCircuitBreaker({ failureThreshold = 4, openMs = 60_000, now = Date.now } = {}) {
  // name -> { state: 'closed'|'open'|'half_open', consecutiveFailures, openedAt }
  const circuits = new Map();

  function circuit(name) {
    if (!circuits.has(name)) {
      circuits.set(name, { state: 'closed', consecutiveFailures: 0, openedAt: 0 });
    }
    return circuits.get(name);
  }

  // May this provider receive a request right now? Transitions open →
  // half_open when the window has elapsed (the caller becomes the probe).
  function canRequest(name) {
    const c = circuit(name);
    if (c.state === 'closed') return true;
    if (c.state === 'open') {
      if (now() - c.openedAt >= openMs) {
        c.state = 'half_open';
        return true; // this request is the probe
      }
      return false;
    }
    // half_open: one probe is already in flight; hold the line.
    return false;
  }

  function recordSuccess(name) {
    const c = circuit(name);
    c.state = 'closed';
    c.consecutiveFailures = 0;
  }

  function recordFailure(name) {
    const c = circuit(name);
    if (c.state === 'half_open') {
      // Probe failed — straight back to open for another full window.
      c.state = 'open';
      c.openedAt = now();
      return;
    }
    c.consecutiveFailures += 1;
    if (c.consecutiveFailures >= failureThreshold) {
      c.state = 'open';
      c.openedAt = now();
    }
  }

  function stateOf(name) {
    return { ...circuit(name) };
  }

  function report() {
    const out = {};
    for (const [name, c] of circuits) out[name] = { ...c };
    return out;
  }

  return { canRequest, recordSuccess, recordFailure, stateOf, report };
}

module.exports = { createCircuitBreaker };
