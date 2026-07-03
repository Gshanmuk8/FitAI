# AI Platform Layer

The independent AI platform under `server/src/services/ai/`. Business
logic never talks to a model; it calls task functions on `aiOrchestrator`,
which delegate to the **AI Gateway** — the single choke point for every
AI request in the system.

## Architecture

```
controllers / services
        │  (task calls: generatePlan, askTutor, analyzeFoodImage, generateReviewNarrative)
        ▼
aiOrchestrator.js ── task policy: schema, cache key, LKG, deterministic
        │            fallback, post-processing, source sanitization
        ▼
platform/aiGateway.js ─── THE lifecycle (identical for every task):
        │   budget rail → fresh cache → cascade → stale cache → fallback
        │   cascade per provider: breaker gate → retry+jitter → timeout →
        │   schema validation → health/usage/telemetry recording
        ▼
provider adapters (one file each, ONE attempt each, common interface):
  gemini · openai · anthropic · openrouter · groq · cerebras · cloudflare
```

Supporting modules, each existing to solve one named problem:

| Module | Problem it solves |
|---|---|
| `platform/platformConfig.js` | Routing/models/timeouts/budgets were code constants; now every knob is env-overridable. Swapping providers = editing `AI_PROVIDER_ORDER`. |
| `platform/retry.js` | Retries were duplicated inside every adapter, and gateway-level fallback around adapter-level retries multiplied attempts (retry storms). One engine, full-jitter exponential backoff, error-class-aware. |
| `platform/circuitBreaker.js` | A hard-failing provider (timeouts/5xx/dead key) made every request pay its full timeout before falling through. Closed→open→half-open with a single automatic probe; recovery needs no human. |
| `platform/usageTracker.js` | Zero cost visibility. Estimated tokens per provider/model/task/user/day+month, cost estimates from a pricing map, and budget rails that degrade to fallback — never to an error. |
| `platform/telemetry.js` | Debugging a cascade required correlating scattered logs. One structured line per AI request containing the whole story: every attempt, retry, breaker skip, failure class, latency, final source. |
| `platform/instance.js` | The only place real singletons meet. Tests build gateways from fakes via the same `createGateway`. |

## The response lifecycle (never throws)

1. **Budget rail** — if the daily (global or per-user) estimated-token
   budget is spent, skip providers entirely; serve cache → stale cache →
   deterministic fallback. A blown budget degrades quality, never uptime.
2. **Fresh cache** (task-appropriate TTLs, Redis or in-memory).
3. **Cascade** over `AI_PROVIDER_ORDER` ∩ installed ∩ not-disabled ∩
   breaker-permitting, reordered by live health scores. Per provider:
   retry with full jitter for *transient* classes only —
   - `rate_limited` (429): no retry, health cooldown, next provider
     (hammering a rate limit deepens it; the breaker is NOT tripped
     because the provider is healthy, just throttling).
   - `permanent` (401/403/bad model): no retry (won't heal in 300ms).
   - `invalid_output` (schema fail): no retry — same model, same junk;
     a *different* provider is the better second opinion.
4. **Schema validation** (Zod) on every output; sanity checks beyond types.
5. **Stale last-known-good** — yesterday's real answer beats a template.
6. **Deterministic fallback** — rules engine / static templates. The
   floor of the platform: works with zero keys, zero network.

The envelope returned to controllers carries `source: 'ai' | 'cache' |
'fallback'` only — provider identity, failure reasons, and cache tiers are
internal. Clients can never learn (or depend on) which vendor answered.

## Review findings that drove the refactor

1. **Duplicated retry logic** — every adapter had its own loop; gemini
   retried 3× internally while the cascade also retried → up to N×M
   attempts under brownouts. *Fix:* adapters make one attempt; the
   gateway owns retries. (Adapters shrank; see `openaiService.js` — a new
   provider is ~30 lines.)
2. **Config in code** — order/timeouts/models lived in
   `shared/constants`. *Fix:* `platformConfig` + env overrides; constants
   file now holds only true business constants.
3. **No hard-failure protection** — only a 429 cooldown existed. *Fix:*
   circuit breaker; the cooldown remains for the politeness case.
4. **Untestable cascade** — providers were hard-required singletons.
   *Fix:* `createGateway` takes everything by injection;
   `server/tests/aiPlatform.test.js` proves the failure matrix (17 tests):
   fallback order, schema-invalid fallthrough, retry-then-success,
   429-no-retry, breaker open/half-open/probe-fail/recovery, breaker
   integration (open circuit = zero calls), stale-cache rescue,
   never-throws floor, provider-identity leak check, budget exhaustion,
   disabled providers, vision-only routing, jitter bounds, error
   classification, cost math.
5. **No cost story** — fixed via usageTracker (estimated tokens by
   design: exact usage would couple adapters to provider envelopes;
   consistently-estimated beats inconsistently-precise for rails).

## What stayed, deliberately

- **Prompt/memory layers** were already right: prompts only in
  `shared/prompts/templates.js` (versioned, injection-sanitized), context
  only via `contextBuilder` — the AI service never touches the database.
- **Health-ordered routing + 429 cooldown** (`providerHealthMonitor`) —
  latency/health-aware ordering complements the breaker.
- **The deterministic floor** (`fallbackEngine`) — the reason the whole
  product works with zero API keys.

## Scaling notes (honest limits)

Per-instance in-memory state: breaker, health scores, usage counters,
non-Redis cache. Correct for one node; for a fleet, point `REDIS_URL` at
shared cache (already supported) and move usage/breaker state to Redis —
their factory interfaces are shaped for that swap. Token counts are
estimates (chars/4), labeled as such everywhere.

## Config reference

See the commented block in `.env`. Key envs: `AI_PROVIDER_ORDER`,
`AI_DISABLE_PROVIDERS`, `AI_MODEL_<PROVIDER>`, `AI_TIMEOUT_<PROVIDER>_MS`,
`AI_RETRY_ATTEMPTS`, `AI_BREAKER_FAILURES`, `AI_BREAKER_OPEN_MS`,
`AI_BUDGET_DAILY_TOKENS`, `AI_BUDGET_DAILY_TOKENS_PER_USER`,
`AI_TEMPERATURE`, `AI_MAX_TOKENS`, `AI_PRICE_*`.

Adding a provider: one adapter file implementing
`{ name, supportsVision, isConfigured, callText, callVision }`, register
it in `platform/instance.js`, add its key to `env.js`, list it in
`AI_PROVIDER_ORDER`. Nothing else changes — that's the contract.
