/**
 * Fallback provider #2: OpenRouter's free model tier. Text-only — vision
 * is intentionally not wired here since the free vision-capable models on
 * OpenRouter are unreliable enough that it's safer to fall through to the
 * next provider (or the "needs manual input" path) than to trust them.
 */
const { OPENROUTER_API_KEY } = require("../../config/env");
const { callOpenAiCompatibleChat, ProviderError } = require("./providerUtils");
const { buildPlatformConfig } = require("./platform/platformConfig");

const NAME = "openrouter";
const cfg = buildPlatformConfig();

function isConfigured() {
  return Boolean(OPENROUTER_API_KEY);
}

async function callText(prompt) {
  if (!isConfigured()) throw new ProviderError("OpenRouter not configured");
  return callOpenAiCompatibleChat({
    url: "https://openrouter.ai/api/v1/chat/completions",
    apiKey: OPENROUTER_API_KEY,
    model: cfg.models.openrouter,
    prompt,
    timeoutMs: cfg.timeoutsMs.openrouter,
    // OpenRouter asks free-tier callers to identify the app; harmless if ignored.
    extraHeaders: { "HTTP-Referer": "https://fitai.app", "X-Title": "FitAI" },
  });
}

async function callVision() {
  throw new ProviderError("OpenRouter vision not supported in this deployment");
}

module.exports = { name: NAME, supportsVision: false, isConfigured, callText, callVision };
