/**
 * Fallback provider #4: Cerebras inference. Text-only, tried after Groq —
 * both are OpenAI-compatible so this is a thin config wrapper around the
 * shared caller.
 */
const { CEREBRAS_API_KEY } = require("../../config/env");
const { callOpenAiCompatibleChat, ProviderError } = require("./providerUtils");
const { buildPlatformConfig } = require("./platform/platformConfig");

const NAME = "cerebras";
const cfg = buildPlatformConfig();

function isConfigured() {
  return Boolean(CEREBRAS_API_KEY);
}

async function callText(prompt) {
  if (!isConfigured()) throw new ProviderError("Cerebras not configured");
  return callOpenAiCompatibleChat({
    url: "https://api.cerebras.ai/v1/chat/completions",
    apiKey: CEREBRAS_API_KEY,
    model: cfg.models.cerebras,
    prompt,
    timeoutMs: cfg.timeoutsMs.cerebras,
    jsonMode: true,
  });
}

async function callVision() {
  throw new ProviderError("Cerebras vision not wired in this deployment");
}

module.exports = { name: NAME, supportsVision: false, isConfigured, callText, callVision };
