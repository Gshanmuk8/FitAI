const crypto = require("crypto");
const { cacheClient } = require("../../config/cache");
const { CACHE_TTL_SECONDS } = require("../../../../shared/constants");

const DEFAULT_TTL_SECONDS = CACHE_TTL_SECONDS.WORKOUT_PLANS;

// Maps the orchestrator's cache namespaces to the spec's content
// categories, so each gets the TTL the architecture doc actually asks for.
const NAMESPACE_TTL = {
  plan: CACHE_TTL_SECONDS.WORKOUT_PLANS,
  tutor: CACHE_TTL_SECONDS.EDUCATIONAL_CONTENT,
  nutrition: CACHE_TTL_SECONDS.NUTRITION_ANALYSIS,
  fact: CACHE_TTL_SECONDS.SIMPLE_FACTS,
};

function hashQuestion(input) {
  const normalized = JSON.stringify(input).toLowerCase().replace(/\s+/g, " ").trim();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

async function getCached(namespace, input) {
  const key = `ai:${namespace}:${hashQuestion(input)}`;
  const raw = await cacheClient.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function setCached(namespace, input, value, ttlSeconds) {
  const key = `ai:${namespace}:${hashQuestion(input)}`;
  const ttl = ttlSeconds ?? NAMESPACE_TTL[namespace] ?? DEFAULT_TTL_SECONDS;
  await cacheClient.set(key, JSON.stringify(value), "EX", ttl);
}

// "Cached responses" as its own fallback tier (see architecture doc's
// provider cascade: ... -> rules engine -> cached responses -> static
// templates). Distinct from the normal cache above: it's written on
// every successful AI response and read only when every live provider
// has failed, so a user can still get something personalized-ish past
// the normal cache's TTL, rather than dropping straight to a generic
// template.
async function getLastKnownGood(namespace, input) {
  const key = `ai:lkg:${namespace}:${hashQuestion(input)}`;
  const raw = await cacheClient.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function setLastKnownGood(namespace, input, value) {
  const key = `ai:lkg:${namespace}:${hashQuestion(input)}`;
  await cacheClient.set(key, JSON.stringify(value), "EX", CACHE_TTL_SECONDS.LAST_KNOWN_GOOD);
}

module.exports = { getCached, setCached, getLastKnownGood, setLastKnownGood, hashQuestion };
