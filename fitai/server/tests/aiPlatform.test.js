/**
 * AI platform failure-matrix tests. Everything runs against FAKE providers
 * injected into a real gateway — no network, no keys, no database — which
 * is the point of the dependency-injected design: the fallback claims are
 * verified, not asserted.
 *
 * Run: node --test server/tests/aiPlatform.test.js (included in npm test)
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { createGateway } = require('../src/services/ai/platform/aiGateway');
const { createCircuitBreaker } = require('../src/services/ai/platform/circuitBreaker');
const { createUsageTracker, estimateTokens } = require('../src/services/ai/platform/usageTracker');
const { createTelemetry } = require('../src/services/ai/platform/telemetry');
const { executeWithRetry, classifyError, fullJitterDelay } = require('../src/services/ai/platform/retry');

// ---------- harness ----------

function fakeProvider(name, behavior, { vision = false } = {}) {
  let calls = 0;
  return {
    name,
    supportsVision: vision,
    isConfigured: () => true,
    get calls() { return calls; },
    callText: async (prompt) => {
      calls += 1;
      return behavior(calls, prompt);
    },
    callVision: async (prompt) => {
      calls += 1;
      return behavior(calls, prompt);
    },
  };
}

const ok = (payload = { answer: 'hello', confidence: 0.9 }) => () => payload;
const fail = (message = 'HTTP 500: boom') => () => { throw new Error(message); };
const rateLimited = () => () => {
  const err = new Error('Rate limited');
  err.rateLimited = true;
  throw err;
};

function memoryCache() {
  const fresh = new Map();
  const stale = new Map();
  const key = (ns, input) => `${ns}:${JSON.stringify(input)}`;
  return {
    getCached: async (ns, input) => fresh.get(key(ns, input)) ?? null,
    setCached: async (ns, input, data) => fresh.set(key(ns, input), data),
    getLastKnownGood: async (ns, input) => stale.get(key(ns, input)) ?? null,
    setLastKnownGood: async (ns, input, data) => stale.set(key(ns, input), data),
    _fresh: fresh,
    _stale: stale,
  };
}

function makeGateway({ providers, configOverrides = {}, budget = {}, breakerOpts, cache = memoryCache(), health = null }) {
  const config = {
    providerOrder: providers.map((p) => p.name),
    disabledProviders: new Set(),
    models: {},
    retry: { attempts: 2, baseDelayMs: 1, maxDelayMs: 2 },
    breaker: { failureThreshold: 3, openMs: 1000 },
    budget,
    pricing: {},
    timeoutsMs: { default: 1000 },
    ...configOverrides,
  };
  const breaker = createCircuitBreaker(breakerOpts || config.breaker);
  const usage = createUsageTracker({ budget: config.budget });
  const telemetry = createTelemetry({ logger: null });
  const validate = (schemaName, data) =>
    data && typeof data === 'object' && !data.__invalid ? { valid: true, data } : { valid: false };
  const gateway = createGateway({
    providers: new Map(providers.map((p) => [p.name, p])),
    config, cache, validate, health, breaker, usage, telemetry,
  });
  return { gateway, breaker, usage, cache };
}

const baseOpts = (overrides = {}) => ({
  task: 'test',
  schemaName: 'any',
  mode: 'text',
  prompt: 'p',
  cacheKey: { namespace: 't', input: { q: 1 } },
  useLastKnownGood: true,
  fallback: () => ({ answer: 'deterministic floor', generatedBy: 'fallback_template' }),
  ...overrides,
});

// ---------- lifecycle ----------

test('healthy first provider answers; result is cached', async () => {
  const a = fakeProvider('a', ok({ v: 1 }));
  const b = fakeProvider('b', ok({ v: 2 }));
  const { gateway, cache } = makeGateway({ providers: [a, b] });

  const r = await gateway.execute(baseOpts());
  assert.equal(r.source, 'ai');
  assert.deepEqual(r.data, { v: 1 });
  assert.equal(b.calls, 0, 'second provider never touched');
  assert.equal(cache._fresh.size, 1, 'response cached');

  const r2 = await gateway.execute(baseOpts());
  assert.equal(r2.source, 'cache');
  assert.equal(a.calls, 1, 'cache hit spends no provider call');
});

test('fallback order: dead providers fall through in configured order', async () => {
  const a = fakeProvider('a', fail());
  const b = fakeProvider('b', fail('timeout'));
  const c = fakeProvider('c', ok({ from: 'c' }));
  const { gateway } = makeGateway({ providers: [a, b, c] });

  const r = await gateway.execute(baseOpts());
  assert.equal(r.source, 'ai');
  assert.equal(r.data.from, 'c');
});

test('schema-invalid output falls through to the next provider, not a retry of the same one', async () => {
  const junk = fakeProvider('junk', ok({ __invalid: true }));
  const good = fakeProvider('good', ok({ fine: true }));
  const { gateway } = makeGateway({ providers: [junk, good] });

  const r = await gateway.execute(baseOpts());
  assert.equal(r.data.fine, true);
  assert.equal(junk.calls, 1, 'invalid output is not retried against the same model');
});

test('every provider dead -> stale last-known-good beats generic fallback', async () => {
  const dead = fakeProvider('dead', fail());
  const cache = memoryCache();
  await cache.setLastKnownGood('t', { q: 1 }, { answer: 'yesterday' });
  const { gateway } = makeGateway({ providers: [dead], cache });

  const r = await gateway.execute(baseOpts());
  assert.equal(r.source, 'stale_cache');
  assert.equal(r.data.answer, 'yesterday');
});

test('nothing anywhere -> deterministic fallback; gateway never throws', async () => {
  const dead = fakeProvider('dead', fail());
  const { gateway } = makeGateway({ providers: [dead] });

  const r = await gateway.execute(baseOpts());
  assert.equal(r.source, 'fallback');
  assert.equal(r.data.answer, 'deterministic floor');
});

test('provider identity never appears in the returned envelope', async () => {
  const dead = fakeProvider('gemini-super-secret', fail());
  const { gateway } = makeGateway({ providers: [dead] });
  const r = await gateway.execute(baseOpts());
  assert.ok(!JSON.stringify(r).includes('gemini-super-secret'));
});

// ---------- retries ----------

test('transient failure retries the SAME provider with backoff, then succeeds', async () => {
  const flaky = fakeProvider('flaky', (call) => {
    if (call === 1) throw new Error('network hiccup');
    return { ok: true };
  });
  const { gateway } = makeGateway({ providers: [flaky] });

  const r = await gateway.execute(baseOpts());
  assert.equal(r.data.ok, true);
  assert.equal(flaky.calls, 2, 'one retry, one success');
});

test('429 is NOT retried against the same provider — next provider takes over', async () => {
  const limited = fakeProvider('limited', rateLimited());
  const next = fakeProvider('next', ok({ saved: true }));
  const { gateway } = makeGateway({ providers: [limited, next] });

  const r = await gateway.execute(baseOpts());
  assert.equal(r.data.saved, true);
  assert.equal(limited.calls, 1, 'hammering a rate limit would deepen it');
});

test('retry engine: error classification and jitter bounds', () => {
  assert.equal(classifyError(new Error('HTTP 500: x')), 'transient');
  assert.equal(classifyError(Object.assign(new Error('x'), { rateLimited: true })), 'rate_limited');
  assert.equal(classifyError(new Error('HTTP 401: bad api key')), 'permanent');
  for (let i = 0; i < 50; i++) {
    const d = fullJitterDelay(3, { baseDelayMs: 100, maxDelayMs: 500 });
    assert.ok(d >= 0 && d < 500, 'full jitter stays within [0, cap)');
  }
});

test('permanent errors (bad key) exit retry immediately', async () => {
  let attempts = 0;
  await assert.rejects(
    executeWithRetry(() => { attempts += 1; throw new Error('HTTP 401: invalid key'); }, { attempts: 3, baseDelayMs: 1, maxDelayMs: 2 })
  );
  assert.equal(attempts, 1);
});

// ---------- circuit breaker ----------

test('breaker: opens after threshold, blocks instantly, half-open probe recovers', async () => {
  let clock = 0;
  const breaker = createCircuitBreaker({ failureThreshold: 3, openMs: 1000, now: () => clock });

  for (let i = 0; i < 3; i++) breaker.recordFailure('p');
  assert.equal(breaker.stateOf('p').state, 'open');
  assert.equal(breaker.canRequest('p'), false, 'open circuit blocks traffic');

  clock += 1001; // window elapses
  assert.equal(breaker.canRequest('p'), true, 'first request becomes the probe');
  assert.equal(breaker.stateOf('p').state, 'half_open');
  assert.equal(breaker.canRequest('p'), false, 'only ONE probe at a time');

  breaker.recordSuccess('p');
  assert.equal(breaker.stateOf('p').state, 'closed');
  assert.equal(breaker.canRequest('p'), true, 'recovered automatically');
});

test('breaker: failed probe reopens for a full window', () => {
  let clock = 0;
  const breaker = createCircuitBreaker({ failureThreshold: 1, openMs: 1000, now: () => clock });
  breaker.recordFailure('p');
  clock += 1001;
  assert.equal(breaker.canRequest('p'), true); // probe
  breaker.recordFailure('p'); // probe fails
  assert.equal(breaker.stateOf('p').state, 'open');
  clock += 999;
  assert.equal(breaker.canRequest('p'), false, 'still open until the new window elapses');
});

test('gateway integration: broken provider gets skipped without paying its timeout', async () => {
  const dying = fakeProvider('dying', fail());
  const healthy = fakeProvider('healthy', ok({ up: true }));
  const { gateway, breaker } = makeGateway({
    providers: [dying, healthy],
    breakerOpts: { failureThreshold: 2, openMs: 60_000 },
    configOverrides: { retry: { attempts: 1, baseDelayMs: 1, maxDelayMs: 2 } },
  });

  await gateway.execute(baseOpts({ cacheKey: null })); // failure 1
  await gateway.execute(baseOpts({ cacheKey: null })); // failure 2 -> opens
  assert.equal(breaker.stateOf('dying').state, 'open');

  const before = dying.calls;
  await gateway.execute(baseOpts({ cacheKey: null }));
  assert.equal(dying.calls, before, 'open circuit = zero calls to the dying provider');
});

// ---------- budgets & usage ----------

test('exhausted budget degrades to fallback without touching providers', async () => {
  const p = fakeProvider('p', ok());
  const { gateway, usage } = makeGateway({ providers: [p], budget: { dailyTokens: 10, dailyTokensPerUser: 0 } });

  usage.record({ provider: 'p', task: 'test', promptTokens: 20, completionTokens: 0 }); // blow the budget
  const r = await gateway.execute(baseOpts({ cacheKey: null }));
  assert.equal(r.source, 'fallback');
  assert.equal(p.calls, 0, 'no spend past the budget rail');
});

test('usage tracker aggregates per provider/task and estimates cost', () => {
  const usage = createUsageTracker({ pricing: { x: { prompt: 1, completion: 2 } } });
  usage.record({ provider: 'x', model: 'm', task: 'plan', userId: 'u1', promptTokens: 500_000, completionTokens: 500_000 });
  const report = usage.report();
  assert.equal(report.totals.calls, 1);
  assert.equal(report.byProvider['x/m'].estCostUsd, 1.5); // 0.5*1 + 0.5*2
  assert.equal(report.byTask.plan.promptTokens, 500_000);
  assert.equal(report.estimated, true);
  assert.equal(estimateTokens('abcdefgh'), 2);
});

// ---------- routing config ----------

test('disabled provider is never called even when first in order', async () => {
  const off = fakeProvider('off', ok({ from: 'off' }));
  const on = fakeProvider('on', ok({ from: 'on' }));
  const { gateway } = makeGateway({
    providers: [off, on],
    configOverrides: { disabledProviders: new Set(['off']) },
  });
  const r = await gateway.execute(baseOpts());
  assert.equal(r.data.from, 'on');
  assert.equal(off.calls, 0);
});

test('vision requests only route to vision-capable providers', async () => {
  const textOnly = fakeProvider('textonly', ok({ from: 'textonly' }));
  const eyes = fakeProvider('eyes', ok({ from: 'eyes' }), { vision: true });
  const { gateway } = makeGateway({ providers: [textOnly, eyes] });
  const r = await gateway.execute(baseOpts({ mode: 'vision', imageBase64: 'x', mimeType: 'image/png' }));
  assert.equal(r.data.from, 'eyes');
  assert.equal(textOnly.calls, 0);
});

test('vision uses its own provider order (Groq-primary config), text keeps the default', async () => {
  const gem = fakeProvider('gemini', ok({ from: 'gemini' }), { vision: true });
  const grq = fakeProvider('groq', ok({ from: 'groq' }), { vision: true });
  const { gateway } = makeGateway({
    providers: [gem, grq], // text order: gemini first
    configOverrides: { providerOrder: ['gemini', 'groq'], providerOrderVision: ['groq', 'gemini'] },
  });

  const vis = await gateway.execute(baseOpts({ mode: 'vision', imageBase64: 'x', mimeType: 'image/png', cacheKey: null }));
  assert.equal(vis.data.from, 'groq', 'vision order puts groq first');
  assert.equal(gem.calls, 0);

  const txt = await gateway.execute(baseOpts({ cacheKey: null }));
  assert.equal(txt.data.from, 'gemini', 'text order unaffected');
});

test('vision order: health can demote a degraded primary but never promote past a healthy one', async () => {
  const grq = fakeProvider('groq', ok({ from: 'groq' }), { vision: true });
  const gem = fakeProvider('gemini', ok({ from: 'gemini' }), { vision: true });
  // gemini is proven-great, groq untested (neutral 0.5): explicit vision
  // priority must still win — that's the difference from orderByHealth,
  // which would sort gemini (0.9) ahead of groq (0.5).
  const scores = { groq: 0.5, gemini: 0.9 };
  const health = {
    healthScore: (name) => scores[name],
    orderByHealth: (names) => [...names].sort((a, b) => scores[b] - scores[a]),
    recordOutcome: () => {},
  };
  const { gateway } = makeGateway({
    providers: [grq, gem],
    health,
    configOverrides: { providerOrder: ['groq', 'gemini'], providerOrderVision: ['groq', 'gemini'] },
  });

  const r = await gateway.execute(baseOpts({ mode: 'vision', imageBase64: 'x', mimeType: 'image/png', cacheKey: null }));
  assert.equal(r.data.from, 'groq', 'healthy-enough primary keeps its slot');

  // Now groq is proven degraded (in cooldown / failing) — it sinks.
  scores.groq = -1;
  const r2 = await gateway.execute(baseOpts({ mode: 'vision', imageBase64: 'x', mimeType: 'image/png', cacheKey: null }));
  assert.equal(r2.data.from, 'gemini', 'degraded primary is demoted');
});
