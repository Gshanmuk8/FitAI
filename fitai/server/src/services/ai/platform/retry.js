/**
 * The platform's ONE retry engine. Adapters make exactly one attempt;
 * the gateway wraps them with this. Centralizing retries here fixes two
 * real problems the previous design had:
 *   1. Every adapter re-implemented its own retry loop (duplicated logic,
 *      drift risk).
 *   2. Gateway-level fallback around adapter-level retries multiplied
 *      attempts (retry storms under provider brownouts).
 *
 * Backoff is exponential with FULL jitter (delay = random(0, min(cap,
 * base * 2^attempt))) — under simultaneous failures, full jitter spreads
 * the retry herd instead of synchronizing it.
 */

function classifyError(err) {
  const msg = String(err?.message || '').toLowerCase();
  if (err?.rateLimited || /429|rate limit/.test(msg)) return 'rate_limited';
  if (/not configured|api key|401|403|invalid model|404/.test(msg)) return 'permanent';
  if (/schema validation/.test(msg)) return 'invalid_output';
  // network/timeout/5xx/abort → worth another try
  return 'transient';
}

// Retrying makes things WORSE for these classes:
//  - rate_limited: hammering a 429 deepens the limit; cooldown + next provider.
//  - permanent: bad key/model won't heal in 300ms.
//  - invalid_output: same prompt, same model → likely same malformed shape;
//    a DIFFERENT provider is the better second opinion.
function isRetryable(err) {
  return classifyError(err) === 'transient';
}

function fullJitterDelay(attempt, { baseDelayMs, maxDelayMs }) {
  const cap = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  return Math.floor(Math.random() * cap);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs fn() up to `attempts` times. Non-retryable errors exit immediately.
 * onRetry(attempt, delayMs, err) lets telemetry record each retry.
 */
async function executeWithRetry(fn, { attempts = 2, baseDelayMs = 300, maxDelayMs = 2000, onRetry } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const canRetry = attempt < attempts - 1 && isRetryable(err);
      if (!canRetry) throw err;
      const delay = fullJitterDelay(attempt, { baseDelayMs, maxDelayMs });
      if (onRetry) onRetry(attempt + 1, delay, err);
      await sleep(delay);
    }
  }
  throw lastErr;
}

module.exports = { executeWithRetry, classifyError, isRetryable, fullJitterDelay };
