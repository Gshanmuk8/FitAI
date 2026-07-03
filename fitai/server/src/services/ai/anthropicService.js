/**
 * Anthropic adapter. Not OpenAI-compatible (its own /v1/messages envelope),
 * which makes it the useful second proof that the provider contract holds
 * for non-uniform APIs too. Enable via ANTHROPIC_API_KEY.
 */
const { ANTHROPIC_API_KEY } = require("../../config/env");
const { fetchWithTimeout, parseJsonResponse, ProviderError } = require("./providerUtils");
const { buildPlatformConfig } = require("./platform/platformConfig");

const NAME = "anthropic";
const cfg = buildPlatformConfig();

function isConfigured() {
  return Boolean(ANTHROPIC_API_KEY);
}

async function callText(prompt) {
  if (!isConfigured()) throw new ProviderError("Anthropic not configured");

  let res;
  try {
    res = await fetchWithTimeout(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: cfg.models.anthropic,
          max_tokens: cfg.maxTokens,
          temperature: cfg.temperature,
          messages: [{ role: "user", content: prompt }],
        }),
      },
      cfg.timeoutsMs.anthropic
    );
  } catch (err) {
    throw new ProviderError(`Network/timeout error: ${err.message}`);
  }

  if (res.status === 429) throw new ProviderError("Rate limited", { rateLimited: true });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ProviderError(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  const text = json?.content?.[0]?.text;
  if (!text) throw new ProviderError("Empty Anthropic response");
  return parseJsonResponse(text);
}

async function callVision() {
  throw new ProviderError("Anthropic vision not wired in this deployment");
}

module.exports = { name: NAME, supportsVision: false, isConfigured, callText, callVision };
