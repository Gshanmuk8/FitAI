/**
 * Gemini adapter (primary provider, and the only vision-capable one in
 * this deployment). Adapters make exactly ONE attempt per call — retries,
 * backoff, jitter, and fallback all belong to the AI gateway. The retry
 * loop that used to live here was removed deliberately: gateway retries
 * around adapter retries multiplied attempts under brownouts (retry
 * storms) and duplicated the same logic in every adapter.
 */
const { textModel, visionModel, isGeminiConfigured } = require("../../config/gemini");
const { stripMarkdownFence } = require("./providerUtils");
const { buildPlatformConfig } = require("./platform/platformConfig");

const cfg = buildPlatformConfig();

// The Gemini SDK has no request timeout option — race it manually so a
// hung call can't hold a gateway slot past the configured budget.
function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Gemini timeout after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function callGeminiText(prompt) {
  if (!isGeminiConfigured()) throw new Error("Gemini is not configured (no GEMINI_API_KEY)");
  const result = await withTimeout(textModel.generateContent(prompt), cfg.timeoutsMs.gemini);
  const text = stripMarkdownFence(result.response.text().trim());
  return JSON.parse(text);
}

async function callGeminiVision(prompt, imageBase64, mimeType) {
  if (!isGeminiConfigured()) throw new Error("Gemini is not configured (no GEMINI_API_KEY)");
  const imagePart = { inlineData: { data: imageBase64, mimeType } };
  const result = await withTimeout(visionModel.generateContent([prompt, imagePart]), cfg.timeoutsMs.gemini);
  const text = stripMarkdownFence(result.response.text().trim());
  return JSON.parse(text);
}

module.exports = {
  callGeminiText,
  callGeminiVision,
  // Uniform provider interface used by the AI gateway's cascade.
  name: "gemini",
  supportsVision: true,
  isConfigured: isGeminiConfigured,
  callText: callGeminiText,
  callVision: callGeminiVision,
};
