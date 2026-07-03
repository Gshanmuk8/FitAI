/**
 * Fallback provider #5 (last AI provider before the rules engine):
 * Cloudflare Workers AI. Not OpenAI-compatible — different URL shape and
 * response envelope — so it doesn't use providerUtils' shared chat caller.
 */
const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = require("../../config/env");
const { fetchWithTimeout, parseJsonResponse, ProviderError } = require("./providerUtils");
const { buildPlatformConfig } = require("./platform/platformConfig");

const NAME = "cloudflare";
const cfg = buildPlatformConfig();
const MODEL = cfg.models.cloudflare;

function isConfigured() {
  return Boolean(CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_API_TOKEN);
}

async function callText(prompt) {
  if (!isConfigured()) throw new ProviderError("Cloudflare AI not configured");

  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${MODEL}`;
  let res;
  try {
    res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
      },
      cfg.timeoutsMs.cloudflare
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
  const text = json?.result?.response;
  if (!text) throw new ProviderError("Empty Cloudflare AI response");
  return parseJsonResponse(text);
}

async function callVision() {
  throw new ProviderError("Cloudflare AI vision not wired in this deployment");
}

module.exports = { name: NAME, supportsVision: false, isConfigured, callText, callVision };
