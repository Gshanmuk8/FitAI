/**
 * Shared low-level helpers for AI provider adapters: timeout-bounded
 * fetch, JSON extraction from markdown-fenced LLM output, and a small
 * OpenAI-compatible chat completion caller reused by OpenRouter, Groq,
 * and Cerebras (all three expose an OpenAI-style /chat/completions
 * endpoint, so the request/response shape only needs writing once).
 */

function stripMarkdownFence(text) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function parseJsonResponse(text) {
  return JSON.parse(stripMarkdownFence(text.trim()));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Throws ProviderError with `rateLimited: true` on HTTP 429 so
// providerHealthMonitor can put the provider on a cooldown instead of
// just counting it as a generic failure.
class ProviderError extends Error {
  constructor(message, { rateLimited = false } = {}) {
    super(message);
    this.name = "ProviderError";
    this.rateLimited = rateLimited;
  }
}

async function callOpenAiCompatibleChat({ url, apiKey, model, prompt, timeoutMs, extraHeaders = {} }) {
  let res;
  try {
    res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...extraHeaders,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4,
        }),
      },
      timeoutMs
    );
  } catch (err) {
    throw new ProviderError(`Network/timeout error: ${err.message}`);
  }

  if (res.status === 429) {
    throw new ProviderError("Rate limited", { rateLimited: true });
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ProviderError(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content;
  if (!text) throw new ProviderError("Empty completion content");
  return parseJsonResponse(text);
}

module.exports = {
  stripMarkdownFence,
  parseJsonResponse,
  fetchWithTimeout,
  callOpenAiCompatibleChat,
  ProviderError,
};
