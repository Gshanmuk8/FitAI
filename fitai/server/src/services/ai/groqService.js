/**
 * Fallback provider #3: Groq's hosted inference. Fast (LPU-backed) and
 * generous free tier, so it sits ahead of Cerebras/Cloudflare in the
 * default cascade order. Text-only.
 */
const { GROQ_API_KEY } = require("../../config/env");
const { callOpenAiCompatibleChat, ProviderError } = require("./providerUtils");
const { buildPlatformConfig } = require("./platform/platformConfig");

const NAME = "groq";
const cfg = buildPlatformConfig();

function isConfigured() {
  return Boolean(GROQ_API_KEY);
}

async function callText(prompt) {
  if (!isConfigured()) throw new ProviderError("Groq not configured");
  return callOpenAiCompatibleChat({
    url: "https://api.groq.com/openai/v1/chat/completions",
    apiKey: GROQ_API_KEY,
    model: cfg.models.groq,
    prompt,
    timeoutMs: cfg.timeoutsMs.groq,
  });
}

async function callVision() {
  throw new ProviderError("Groq vision not wired in this deployment");
}

module.exports = { name: NAME, supportsVision: false, isConfigured, callText, callVision };
