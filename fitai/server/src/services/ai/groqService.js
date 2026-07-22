/**
 * Fallback provider #3: Groq's hosted inference. Fast (LPU-backed) and
 * generous free tier, so it sits ahead of Cerebras/Cloudflare in the
 * default cascade order. Vision goes through llama-4-scout so food-photo
 * analysis has a fallback when Gemini (the primary) is down or rate-limited.
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
    jsonMode: true,
  });
}

async function callVision(prompt, imageBase64, mimeType) {
  if (!isConfigured()) throw new ProviderError("Groq not configured");
  return callOpenAiCompatibleChat({
    url: "https://api.groq.com/openai/v1/chat/completions",
    apiKey: GROQ_API_KEY,
    model: cfg.models.groqVision,
    prompt,
    timeoutMs: cfg.timeoutsMs.groq,
    jsonMode: true,
    imageBase64,
    imageMimeType: mimeType,
  });
}

// supportsVision is FALSE as of 2026-07: Groq retired every multimodal model
// it hosted (llama-4-scout/maverick are all gone from /v1/models), so the
// configured groqVision slug 404s on every call. Leaving the flag true meant
// Groq sat FIRST in the vision cascade and failed every single food photo
// before Gemini even got a turn — burning seconds and tripping its breaker.
// callVision is kept intact: if Groq ships a vision model again, set
// AI_MODEL_GROQ_VISION and flip this back to true.
module.exports = { name: NAME, supportsVision: false, isConfigured, callText, callVision };
