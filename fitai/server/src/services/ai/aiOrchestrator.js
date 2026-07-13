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
const { PROMPT_VERSION } = require('../../../../shared/prompts/templates');

// Internal sources -> the three values the frontend contract allows.
// NOTE: this must never add keys that collide with schema fields — the
// briefing schema owns `status`, so the envelope contributes only `source`.
function sanitize(data, source) {
  const publicSource = source === 'ai' ? 'ai' : source === 'fallback' ? 'fallback' : 'cache';
  return { ...data, source: publicSource };
}

async function generatePlan({ profile, prompt, skipCache = false }) {
  const { data, source } = await gateway.execute({
    task: 'plan',
    schemaName: 'plan',
    mode: 'text',
    prompt,
    userId: profile.userId,
    // skipCache: an explicit "regenerate" is a user asking for a FRESH
    // plan — serving the 7-day cache back would make the action a no-op.
    // PROMPT_VERSION in the key stops stale answers outliving a prompt change.
    cacheKey: skipCache ? null : { namespace: 'plan', input: { ...profile, promptVersion: PROMPT_VERSION } },
    useLastKnownGood: !skipCache,
    fallback: () => fallback.fallbackPlan(profile),
  });
  return sanitize(data, source);
}

async function analyzeFoodImage({ imageBase64, mimeType, prompt, userId }) {
  // Keyed by image content: the same plate photo retried (e.g. a flaky
  // upload) shouldn't re-spend an AI call. userId is in the key so no
  // cached analysis can ever cross accounts, even once the response
  // becomes personalized.
  const { data, source } = await gateway.execute({
    task: 'nutrition',
    schemaName: 'foodAnalysis',
    mode: 'vision',
    prompt,
    imageBase64,
    mimeType,
    userId,
    cacheKey: { namespace: 'nutrition', input: { userId, imageHash: hashQuestion(imageBase64) } },
    useLastKnownGood: true,
    fallback: () => fallback.fallbackFoodAnalysis(),
  });
  return sanitize(data, source);
}

async function askTutor({ mode, question, profile, prompt, history, userId, activity }) {
  const { data, source } = await gateway.execute({
    task: 'tutor',
    schemaName: 'tutorResponse',
    mode: 'text',
    prompt,
    userId,
    // history is part of the key: the same question means something
    // different mid-conversation than cold. userId is part of the key
    // because the ANSWER is personalized (injuries, memories, targets) —
    // without it, one user's cached answer would serve to another user
    // with the same question. Privacy boundary, not an optimization knob.
    // activity is part of the key so an answer grounded in yesterday's
    // logs is not served after today's weigh-in/workout changed the facts.
    cacheKey: {
      namespace: 'tutor',
      input: { userId, mode, question, goal: profile.goal, history: history || [], activity: activity || null, promptVersion: PROMPT_VERSION },
    },
    useLastKnownGood: true,
    fallback: () => fallback.fallbackTutorResponse(mode),
  });

  const result = { ...data };
  // Hedge low-confidence AI answers — but not the deterministic fallback,
  // which already says it couldn't reach the coach (double-hedging reads
  // like the app apologizing twice).
  const hedge = ' (Lower confidence — please verify with a professional trainer or dietitian.)';
  if (
    source !== 'fallback' &&
    result.confidence != null && result.confidence < CONFIDENCE_LOW_THRESHOLD &&
    !result.answer.endsWith(hedge)
  ) {
    result.answer += hedge;
  }
  return sanitize(result, source);
}

async function generateBriefing({ profile, prompt, userId }) {
  // Cached at the table layer (one row per user per local day), so the
  // gateway cache is off here — a second dashboard load the same day reads
  // the stored briefing, not this path.
  const { data, source } = await gateway.execute({
    task: 'briefing',
    schemaName: 'briefing',
    mode: 'text',
    prompt,
    userId,
    cacheKey: null,
    useLastKnownGood: false,
    fallback: () => fallback.fallbackBriefing(),
  });
  return sanitize(data, source);
}

async function analyzeProgress({ prompt, userId }) {
  // Cached at the table layer (progress_analyses: one row per user per local
  // day, invalidated by an input-hash change), so the gateway cache is off.
  const { data, source } = await gateway.execute({
    task: 'progressAnalysis',
    schemaName: 'progressAnalysis',
    mode: 'text',
    prompt,
    userId,
    cacheKey: null,
    useLastKnownGood: false,
    fallback: () => fallback.fallbackProgressAnalysis(),
  });
  return sanitize(data, source);
}

// One-line durable memory from a chat exchange. Fire-and-forget caller;
// the SKIP fallback means "nothing worth remembering" — the caller already
// treats that as a quiet no-op, so an outage degrades to not summarizing.
async function generateMemorySummary({ prompt, userId }) {
  const { data, source } = await gateway.execute({
    task: 'memorySummary',
    schemaName: 'memorySummary',
    mode: 'text',
    prompt,
    userId,
    cacheKey: null, // every exchange is unique — caching would be a no-op
    useLastKnownGood: false,
    fallback: () => ({ summary: 'SKIP', category: 'conversation', importance: 1 }),
  });
  return sanitize(data, source);
}

module.exports = { generatePlan, analyzeFoodImage, askTutor, generateBriefing, analyzeProgress, generateMemorySummary };
