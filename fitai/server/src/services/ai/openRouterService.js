/**
 * Fallback provider #2: OpenRouter's free model tier, text and vision.
 * Vision exists here because Groq retired its multimodal models, which left
 * Gemini as the only vision provider — one 429 and the food photo failed.
 * Gemini stays primary for accuracy; this is the second chance.
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

async function callVision(prompt, imageBase64, mimeType) {
  if (!isConfigured()) throw new ProviderError("OpenRouter not configured");
  return callOpenAiCompatibleChat({
    url: "https://openrouter.ai/api/v1/chat/completions",
    apiKey: OPENROUTER_API_KEY,
    model: cfg.models.openrouterVision,
    prompt,
    // Longer budget than text — an image payload outruns the 20s text timeout.
    timeoutMs: cfg.timeoutsMs.openrouterVision,
    jsonMode: true,
    imageBase64,
    imageMimeType: mimeType,
    extraHeaders: { "HTTP-Referer": "https://fitai.app", "X-Title": "FitAI" },
  });
}

module.exports = { name: NAME, supportsVision: true, isConfigured, callText, callVision };
