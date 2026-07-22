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

/**
 * Pull the text out of a Gemini result, or throw an error that says what
 * actually went wrong.
 *
 * `response.text()` assumes there IS a content part. When Gemini blocks a
 * prompt, trips a safety filter, or returns an empty candidate, there isn't
 * one — and the SDK dies inside its own accessor with
 * "Cannot use 'in' operator to search for 'functionResponse' in undefined".
 * That message tells the operator nothing, and because it looks like a
 * generic TypeError the gateway grades it TRANSIENT and burns a retry on a
 * request that can never succeed. Inspect the response first so a block is
 * reported as a block.
 */
function extractText(result) {
  const response = result?.response;
  const blockReason = response?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`Gemini blocked the request (${blockReason})`);
  }
  const candidate = response?.candidates?.[0];
  const finish = candidate?.finishReason;
  if (finish && !['STOP', 'MAX_TOKENS'].includes(finish)) {
    throw new Error(`Gemini returned no usable content (finishReason: ${finish})`);
  }
  if (!candidate?.content?.parts?.length) {
    throw new Error('Gemini returned an empty response (no content parts)');
  }
  return stripMarkdownFence(response.text().trim());
}

async function callGeminiText(prompt) {
  if (!isGeminiConfigured()) throw new Error("Gemini is not configured (no GEMINI_API_KEY)");
  const result = await withTimeout(textModel.generateContent(prompt), cfg.timeoutsMs.gemini);
  return JSON.parse(extractText(result));
}

async function callGeminiVision(prompt, imageBase64, mimeType) {
  if (!isGeminiConfigured()) throw new Error("Gemini is not configured (no GEMINI_API_KEY)");
  const imagePart = { inlineData: { data: imageBase64, mimeType } };
  const result = await withTimeout(visionModel.generateContent([prompt, imagePart]), cfg.timeoutsMs.gemini);
  return JSON.parse(extractText(result));
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
