/**
 * Task-level facade over the AI gateway — the single entry point every
 * controller calls for AI work. Nothing else in the codebase may import a
 * provider adapter directly: that bypasses budgets, cache, breaker-gated
 * routing, validation, and fallback.
 *
 * This module owns exactly two things:
 *   1. Per-task policy: which schema validates the output, what the cache
 *      key is, whether last-known-good applies, which deterministic
 *      fallback floors the response, and any post-processing (e.g. the
 *      low-confidence hedge on tutor answers).
 *   2. The privacy contract: sanitize() collapses the internal source
 *      (which provider, cache tier, fallback) to 'ai' | 'cache' |
 *      'fallback' before anything leaves for the frontend. A provider
 *      outage is an implementation detail the client never sees.
 *
 * Everything transport-shaped — routing, retries, jitter, circuit
 * breaking, health ordering, timeouts, token accounting, telemetry —
 * lives in platform/aiGateway.js and is deliberately NOT visible here.
 */
const { gateway } = require('./platform/instance');
const { hashQuestion } = require('./cacheManager');
const fallback = require('./fallbackEngine');
const { CONFIDENCE_LOW_THRESHOLD } = require('../../../../shared/constants');

// Internal sources -> the three values the frontend contract allows.
function sanitize(data, source) {
  const publicSource = source === 'ai' ? 'ai' : source === 'fallback' ? 'fallback' : 'cache';
  return { ...data, status: 'success', source: publicSource };
}

async function generatePlan({ profile, prompt }) {
  const { data, source } = await gateway.execute({
    task: 'plan',
    schemaName: 'plan',
    mode: 'text',
    prompt,
    userId: profile.userId,
    cacheKey: { namespace: 'plan', input: profile },
    useLastKnownGood: true,
    fallback: () => fallback.fallbackPlan(profile),
  });
  return sanitize(data, source);
}

async function analyzeFoodImage({ imageBase64, mimeType, prompt, userId }) {
  // Keyed by image content: the same plate photo retried (e.g. a flaky
  // upload) shouldn't re-spend an AI call.
  const { data, source } = await gateway.execute({
    task: 'nutrition',
    schemaName: 'foodAnalysis',
    mode: 'vision',
    prompt,
    imageBase64,
    mimeType,
    userId,
    cacheKey: { namespace: 'nutrition', input: { imageHash: hashQuestion(imageBase64) } },
    useLastKnownGood: true,
    fallback: () => fallback.fallbackFoodAnalysis(),
  });
  return sanitize(data, source);
}

async function askTutor({ mode, question, profile, prompt, history, userId }) {
  const { data, source } = await gateway.execute({
    task: 'tutor',
    schemaName: 'tutorResponse',
    mode: 'text',
    prompt,
    userId,
    // history is part of the key: the same question means something
    // different mid-conversation than cold.
    cacheKey: { namespace: 'tutor', input: { mode, question, goal: profile.goal, history: history || [] } },
    useLastKnownGood: true,
    fallback: () => fallback.fallbackTutorResponse(mode),
  });

  const result = { ...data };
  const hedge = ' (Lower confidence — please verify with a professional trainer or dietitian.)';
  if (result.confidence != null && result.confidence < CONFIDENCE_LOW_THRESHOLD && !result.answer.endsWith(hedge)) {
    result.answer += hedge;
  }
  return sanitize(result, source);
}

async function generateReviewNarrative({ stats, prompt, userId }) {
  // No cache layer: reviews are generated once per period and persisted
  // in the reviews table, which IS the cache.
  const { data, source } = await gateway.execute({
    task: 'review',
    schemaName: 'reviewNarrative',
    mode: 'text',
    prompt,
    userId,
    cacheKey: null,
    useLastKnownGood: false,
    fallback: () => fallback.fallbackReviewNarrative(stats),
  });
  return sanitize(data, source);
}

module.exports = { generatePlan, analyzeFoodImage, askTutor, generateReviewNarrative };
