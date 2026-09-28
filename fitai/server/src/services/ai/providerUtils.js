/**
 * Shared low-level helpers for AI provider adapters: timeout-bounded
 * fetch, JSON extraction from markdown-fenced LLM output, and a small
 * OpenAI-compatible chat completion caller reused by OpenRouter, Groq,
 * and Cerebras (all three expose an OpenAI-style /chat/completions
 * endpoint, so the request/response shape only needs writing once).
 */

const { AsyncLocalStorage } = require("node:async_hooks");
const deadlines = new AsyncLocalStorage();
function remainingTimeout(timeoutMs) {
  return Math.max(
    1,
    Math.min(timeoutMs, (deadlines.getStore() ?? Infinity) - Date.now()),
  );
}
function withinDeadline(deadline, work) {
  return deadlines.run(deadline, work);
}

function stripMarkdownFence(text) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

// LLMs (especially small ones) often wrap the JSON in prose or keep
// talking after the closing brace. Parse strictly first; on failure,
// re-parse just the outermost {...} span before giving up.
function parseJsonResponse(text) {
  const cleaned = stripMarkdownFence(text.trim());
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw err;
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    remainingTimeout(timeoutMs),
  );
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    // Headers arriving does not mean a completion arrived. Keep the abort
    // timer active until the entire body is read, including stalled streams.
    const body = await res.arrayBuffer();
    return new Response([204, 205, 304].includes(res.status) ? null : body, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
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

async function callOpenAiCompatibleChat({
  url,
  apiKey,
  model,
  prompt,
  timeoutMs,
  extraHeaders = {},
  jsonMode = false,
  imageBase64 = null,
  imageMimeType = null,
}) {
  // Multimodal messages use the OpenAI content-array form with the image
  // inlined as a data URL; plain text keeps the simple string form.
  const content = imageBase64
    ? [
        { type: "text", text: prompt },
        {
          type: "image_url",
          image_url: {
            url: `data:${imageMimeType || "image/jpeg"};base64,${imageBase64}`,
          },
        },
      ]
    : prompt;
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
          messages: [{ role: "user", content }],
          // GPT-5-family models reject any non-default temperature with a
          // hard 400 — omit it for them or every call dies before retrying.
          ...(/^gpt-5/i.test(model) ? {} : { temperature: 0.4 }),
          // Constrained JSON decoding where the provider supports it —
          // free-form output from small models is the top parse-failure
          // source on plan-sized responses.
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
      },
      timeoutMs,
    );
  } catch (err) {
    throw Object.assign(
      new ProviderError(`Network/timeout error: ${err.message}`),
      { timedOut: err.name === "AbortError" },
    );
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
  remainingTimeout,
  withinDeadline,
  stripMarkdownFence,
  parseJsonResponse,
  fetchWithTimeout,
  callOpenAiCompatibleChat,
  ProviderError,
};
