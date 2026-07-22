/**
 * The AI Gateway — the single choke point every AI request flows through.
 * No route, controller, or service may call a provider adapter directly;
 * they call task functions on aiOrchestrator, which delegate here.
 *
 * Response lifecycle (identical for every task, always terminating in a
 * usable object — this function does not throw):
 *
 *   budget check ──blocked──────────────────────────────┐
 *   cache lookup ──hit──> return {source:'cache'}       │
 *   for each provider (config order ∩ enabled ∩ configured,
 *                      health-reordered, breaker-gated):│
 *     retry-with-jitter( adapter call, timeout )        │
 *     schema validation ──invalid──> next provider      │
 *     record usage/health/breaker                       │
 *     cache set + last-known-good set                   │
 *     return {source:'ai'}                              │
 *   stale last-known-good ──hit──> {source:'stale_cache'}
 *   deterministic fallback ──────> {source:'fallback'} <┘
 *
 * Everything is INJECTED (providers, cache, validator, breaker, health,
 * usage, telemetry, config) — production wires singletons in
 * gatewayInstance.js; tests wire fakes. That inversion is what makes the
 * fallback matrix actually testable instead of theoretically correct.
 */
const { executeWithRetry, classifyError } = require('./retry');
const { estimateTokens } = require('./usageTracker');

// Counting semaphore for the provider cascade: bounds how many outbound AI
// calls run at once per instance. Everything else in execute() (cache reads,
// budget checks, fallbacks) stays outside the gate so a queue of AI work can
// never delay a cache hit.
function createSemaphore(limit) {
  let active = 0;
  const waiters = [];
  return {
    async acquire() {
      if (active >= limit) await new Promise((resolve) => waiters.push(resolve));
      active += 1;
    },
    release() {
      active -= 1;
      const next = waiters.shift();
      if (next) next();
    },
  };
}

function createGateway({
  providers, // Map/obj name -> { name, supportsVision, isConfigured(), callText(prompt), callVision(prompt, img, mime) }
  config, // platformConfig
  cache, // { getCached, setCached, getLastKnownGood, setLastKnownGood }
  validate, // (schemaName, data) -> { valid, data }
  health, // providerHealthMonitor-compatible: orderByHealth, recordOutcome
  breaker, // circuitBreaker
  usage, // usageTracker
  telemetry, // createTelemetry(...)
}) {
  const byName = providers instanceof Map ? providers : new Map(Object.entries(providers));
  const aiSlots = createSemaphore(config.maxConcurrentCalls || 8);

  function eligibleProviders({ vision = false } = {}) {
    const baseOrder = vision && config.providerOrderVision?.length
      ? config.providerOrderVision
      : config.providerOrder;
    const ordered = baseOrder
      .filter((name) => byName.has(name))
      .filter((name) => !config.disabledProviders.has(name))
      .filter((name) => !vision || byName.get(name).supportsVision);
    if (!health) return ordered;
    if (!vision || typeof health.healthScore !== 'function') return health.orderByHealth(ordered);
    // Vision keeps its explicit priority (the primary is a product choice,
    // not a latency race) — health only DEMOTES providers that are proven
    // degraded or cooling down; it never promotes one over the configured
    // primary the way orderByHealth's score sort can.
    const healthy = ordered.filter((name) => health.healthScore(name) >= 0.5);
    const degraded = ordered.filter((name) => health.healthScore(name) < 0.5);
    return [...healthy, ...degraded];
  }

  /**
   * opts: {
   *   task, schemaName, userId,
   *   mode: 'text' | 'vision', prompt, imageBase64, mimeType,
   *   cacheKey: { namespace, input } | null,   // null = uncachable task
   *   useLastKnownGood: boolean,
   *   fallback: () => object                    // deterministic, never throws
   * }
   * Returns { data, source: 'ai' | 'cache' | 'stale_cache' | 'fallback' }.
   */
  async function execute(opts) {
    const trace = telemetry.startTrace(opts.task, { userId: opts.userId ? 'present' : 'anonymous' });

    // 1. Budget rail — degrade to cache/fallback, never to an error.
    const budgetCheck = usage.checkBudget(opts.userId);
    if (!budgetCheck.allowed) {
      trace.event('budget_blocked', { reason: budgetCheck.reason });
      const rescue = await tryCachePaths(opts, trace, { includeFresh: true, includeStale: true });
      if (rescue) return rescue;
      trace.end('budget_blocked');
      return { data: opts.fallback(), source: 'fallback' };
    }

    // 2. An empty prompt is a CALLER bug, not a provider outage. Without this
    // guard every provider is tried, each 400s on missing content, and those
    // failures count against provider health and the breakers — so one bad
    // call degrades routing for every OTHER user while this one is told the
    // coach is unreachable. Fail straight to the deterministic floor and make
    // the real cause loud in the logs.
    if (typeof opts.prompt !== 'string' || !opts.prompt.trim()) {
      trace.event('empty_prompt', { task: opts.task });
      trace.end('fallback');
      return { data: opts.fallback(), source: 'fallback' };
    }

    // 3. Fresh cache.
    const cached = await tryCachePaths(opts, trace, { includeFresh: true, includeStale: false });
    if (cached) return cached;

    // 4. Provider cascade — gated by the concurrency semaphore.
    await aiSlots.acquire();
    try {
      for (const name of eligibleProviders({ vision: opts.mode === 'vision' })) {
        const provider = byName.get(name);
        if (!provider.isConfigured()) continue;
        if (breaker && !breaker.canRequest(name)) {
          trace.event('breaker_skip', { provider: name });
          continue;
        }

        const started = Date.now();
        try {
          const raw = await executeWithRetry(
            () => (opts.mode === 'vision'
              ? provider.callVision(opts.prompt, opts.imageBase64, opts.mimeType)
              : provider.callText(opts.prompt)),
            {
              ...config.retry,
              onRetry: (attempt, delayMs, err) =>
                trace.event('retry', { provider: name, attempt, delayMs, error: classifyError(err) }),
            }
          );

          const { valid, data } = validate(opts.schemaName, raw);
          if (!valid) {
            // Malformed-but-parsed output: the provider "worked" transport-
            // wise but produced junk — count it against health, try the next
            // provider (a different model is the best second opinion).
            const err = new Error(`${name} response failed schema validation`);
            err.invalidOutput = true;
            throw err;
          }

          const latencyMs = Date.now() - started;
          health?.recordOutcome(name, { success: true, latencyMs });
          breaker?.recordSuccess(name);
          usage.record({
            provider: name,
            model: config.models[name],
            task: opts.task,
            userId: opts.userId,
            promptTokens: estimateTokens(opts.prompt),
            completionTokens: estimateTokens(JSON.stringify(raw)),
          });
          trace.event('provider_success', { provider: name, latencyMs });

          if (opts.cacheKey) {
            await cache.setCached(opts.cacheKey.namespace, opts.cacheKey.input, data);
            if (opts.useLastKnownGood) {
              await cache.setLastKnownGood(opts.cacheKey.namespace, opts.cacheKey.input, data);
            }
          }
          trace.end('ai');
          return { data, source: 'ai' };
        } catch (err) {
          const latencyMs = Date.now() - started;
          const errorClass = err.invalidOutput ? 'invalid_output' : classifyError(err);
          health?.recordOutcome(name, {
            success: false,
            latencyMs,
            rateLimited: errorClass === 'rate_limited',
          });
          // Rate limits open the health cooldown, not the breaker — the
          // provider is healthy, just throttling us. Everything else counts
          // toward tripping the circuit.
          if (breaker && errorClass !== 'rate_limited') breaker.recordFailure(name);
          trace.event('provider_failure', { provider: name, errorClass, latencyMs, message: String(err.message).slice(0, 160) });
        }
      }
    } finally {
      aiSlots.release();
    }

    // 5. Stale last-known-good beats a generic template.
    const stale = await tryCachePaths(opts, trace, { includeFresh: false, includeStale: true });
    if (stale) return stale;

    // 6. Deterministic floor — rules engine / static templates.
    trace.event('fallback');
    trace.end('fallback');
    return { data: opts.fallback(), source: 'fallback' };
  }

  async function tryCachePaths(opts, trace, { includeFresh, includeStale }) {
    if (!opts.cacheKey) return null;
    if (includeFresh) {
      const hit = await cache.getCached(opts.cacheKey.namespace, opts.cacheKey.input);
      if (hit) {
        trace.event('cache_hit');
        trace.end('cache');
        return { data: hit, source: 'cache' };
      }
    }
    if (includeStale && opts.useLastKnownGood) {
      const stale = await cache.getLastKnownGood(opts.cacheKey.namespace, opts.cacheKey.input);
      if (stale) {
        trace.event('stale_cache_hit');
        trace.end('stale_cache');
        return { data: stale, source: 'stale_cache' };
      }
    }
    return null;
  }

  return { execute, eligibleProviders };
}

module.exports = { createGateway };
