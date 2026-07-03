/**
 * OpenAI adapter. Exists as much as proof-of-contract as capability:
 * a new provider is ~20 lines because the interface is
 * { name, supportsVision, isConfigured, callText, callVision } and
 * everything else (retries, timeouts, breaker, validation, telemetry)
 * lives in the gateway. Enable by setting OPENAI_API_KEY and (optionally)
 * placing "openai" where you want it in AI_PROVIDER_ORDER.
 */
const { OPENAI_API_KEY } = require("../../config/env");
const { callOpenAiCompatibleChat, ProviderError } = require("./providerUtils");
const { buildPlatformConfig } = require("./platform/platformConfig");

const NAME = "openai";
const cfg = buildPlatformConfig();

function isConfigured() {
  return Boolean(OPENAI_API_KEY);
}

async function callText(prompt) {
  if (!isConfigured()) throw new ProviderError("OpenAI not configured");
  return callOpenAiCompatibleChat({
    url: "https://api.openai.com/v1/chat/completions",
    apiKey: OPENAI_API_KEY,
    model: cfg.models.openai,
    prompt,
    timeoutMs: cfg.timeoutsMs.openai,
  });
}

async function callVision() {
  throw new ProviderError("OpenAI vision not wired in this deployment");
}

module.exports = { name: NAME, supportsVision: false, isConfigured, callText, callVision };
