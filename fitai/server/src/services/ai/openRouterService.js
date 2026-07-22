/**
 * Fallback provider #2: OpenRouter's free model tier.
 *
 * Vision IS wired here now, and deliberately so. Groq retired every
 * multimodal model it hosted, which left Gemini as the ONLY vision-capable
 * provider — so a single Gemini 429 (routine on the free quota) meant the
 * food-photo path fell straight to "we couldn't read that image". A cascade
 * of one is not a cascade. The model below was picked by probing OpenRouter's
 * free vision models against the real FoodAnalysisSchema: it was the only one
 * that returned schema-valid JSON in reasonable time (~5s), where the
 * nemotron VL took two minutes and returned nothing.
 *
 * It is the FALLBACK, not the primary — Gemini stays first for photo quality,
 * because these numbers become the user's calorie ledger.
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
    // Vision needs a longer budget than text: the image upload plus a larger
    // prompt routinely outruns the 20s text timeout on a free endpoint, and a
    // timeout here costs the user their photo.
    timeoutMs: cfg.timeoutsMs.openrouterVision,
    jsonMode: true,
    imageBase64,
    imageMimeType: mimeType,
    extraHeaders: { "HTTP-Referer": "https://fitai.app", "X-Title": "FitAI" },
  });
}

module.exports = { name: NAME, supportsVision: true, isConfigured, callText, callVision };
