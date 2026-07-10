/**
 * AI platform configuration — every routing/behavior knob in one place,
 * every knob overridable by environment variable, code supplies only
 * defaults. This is what makes "swap a provider in minutes" literally
 * true: change AI_PROVIDER_ORDER (or a model env var) and restart —
 * zero code changes.
 *
 * Nothing here is read at import time by business logic; the gateway
 * receives this object via injection, which is also what makes the
 * platform testable with synthetic configs.
 */

function envStr(name, fallback) {
  const v = process.env[name];
  return v == null || v === '' ? fallback : v;
}
function envInt(name, fallback) {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) ? v : fallback;
}
function envFloat(name, fallback) {
  const v = parseFloat(process.env[name]);
  return Number.isFinite(v) ? v : fallback;
}
function envList(name, fallback) {
  const v = process.env[name];
  return v ? v.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : fallback;
}

function buildPlatformConfig() {
  return {
    // Cascade order. Providers not installed/configured are skipped at
    // runtime; listing here is priority, not a requirement.
    providerOrder: envList('AI_PROVIDER_ORDER', [
      'gemini', 'openai', 'anthropic', 'openrouter', 'groq', 'cerebras', 'cloudflare',
    ]),

    // Vision (food-photo) cascade order — separate from text because the
    // best text provider is not the best vision provider. Groq first:
    // llama-4-scout is fast, generous free tier, and not subject to the
    // Gemini quota pressure that was killing photo analysis.
    providerOrderVision: envList('AI_PROVIDER_ORDER_VISION', [
      'groq', 'gemini', 'openai', 'anthropic', 'openrouter', 'cerebras', 'cloudflare',
    ]),

    // Per-provider hard disable (feature flag): AI_DISABLE_PROVIDERS=openai,groq
    disabledProviders: new Set(envList('AI_DISABLE_PROVIDERS', [])),

    // Models — swappable without touching adapter code.
    models: {
      gemini: envStr('AI_MODEL_GEMINI', 'gemini-2.5-flash'),
      openai: envStr('AI_MODEL_OPENAI', 'gpt-5'),
      anthropic: envStr('AI_MODEL_ANTHROPIC', 'claude-sonnet-5'),
      openrouter: envStr('AI_MODEL_OPENROUTER', 'meta-llama/llama-3.3-70b-instruct:free'),
      groq: envStr('AI_MODEL_GROQ', 'llama-3.3-70b-versatile'),
      // Vision fallback so food-photo analysis survives a Gemini outage —
      // llama-4-scout is Groq's multimodal model.
      groqVision: envStr('AI_MODEL_GROQ_VISION', 'meta-llama/llama-4-scout-17b-16e-instruct'),
      cerebras: envStr('AI_MODEL_CEREBRAS', 'gpt-oss-120b'),
      cloudflare: envStr('AI_MODEL_CLOUDFLARE', '@cf/meta/llama-3.1-8b-instruct'),
    },

    // Generation defaults.
    temperature: envFloat('AI_TEMPERATURE', 0.4),
    maxTokens: envInt('AI_MAX_TOKENS', 2048),

    // Per-provider timeout (ms); default applies when not listed.
    // gemini-2.5-flash is a thinking model: plan-sized outputs routinely
    // take 15-25s, so its budget must be well past that or every plan
    // generation dies at the timeout and cascades to fallback.
    timeoutsMs: {
      default: envInt('AI_TIMEOUT_MS', 20000),
      gemini: envInt('AI_TIMEOUT_GEMINI_MS', 45000),
      openai: envInt('AI_TIMEOUT_OPENAI_MS', 30000),
      anthropic: envInt('AI_TIMEOUT_ANTHROPIC_MS', 30000),
      openrouter: envInt('AI_TIMEOUT_OPENROUTER_MS', 20000),
      groq: envInt('AI_TIMEOUT_GROQ_MS', 15000),
      cerebras: envInt('AI_TIMEOUT_CEREBRAS_MS', 20000),
      cloudflare: envInt('AI_TIMEOUT_CLOUDFLARE_MS', 15000),
    },

    // Retries live in the GATEWAY only (adapters make exactly one attempt).
    // Full-jitter exponential backoff; retries apply per provider before
    // falling to the next one, and only for transient error classes.
    retry: {
      attempts: envInt('AI_RETRY_ATTEMPTS', 2), // total tries per provider
      baseDelayMs: envInt('AI_RETRY_BASE_MS', 300),
      maxDelayMs: envInt('AI_RETRY_MAX_MS', 2000),
    },

    // Circuit breaker: N consecutive hard failures opens the circuit for
    // openMs; then one half-open probe decides recovery.
    breaker: {
      failureThreshold: envInt('AI_BREAKER_FAILURES', 4),
      openMs: envInt('AI_BREAKER_OPEN_MS', 60_000),
    },

    // Budgets (estimated tokens/day; 0 = unlimited). In-memory counters —
    // per-instance guardrails, not billing; move to Redis for fleets.
    budget: {
      dailyTokens: envInt('AI_BUDGET_DAILY_TOKENS', 0),
      dailyTokensPerUser: envInt('AI_BUDGET_DAILY_TOKENS_PER_USER', 0),
    },

    // USD per 1M tokens (prompt/completion) for cost estimates in reports.
    // Rough public prices; override as they change. Unlisted = free tier.
    pricing: {
      gemini: { prompt: envFloat('AI_PRICE_GEMINI_PROMPT', 0.3), completion: envFloat('AI_PRICE_GEMINI_COMPLETION', 2.5) },
      openai: { prompt: envFloat('AI_PRICE_OPENAI_PROMPT', 1.25), completion: envFloat('AI_PRICE_OPENAI_COMPLETION', 10) },
      anthropic: { prompt: envFloat('AI_PRICE_ANTHROPIC_PROMPT', 3), completion: envFloat('AI_PRICE_ANTHROPIC_COMPLETION', 15) },
    },
  };
}

module.exports = { buildPlatformConfig };
