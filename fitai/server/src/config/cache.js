const { REDIS_URL } = require("./env");

let client;

if (REDIS_URL) {
  const Redis = require("ioredis");
  // The AI cache is optional enrichment: a Redis outage must degrade to
  // "no cache", never hang or crash a request. Default ioredis queues
  // commands while disconnected and retries each 20x before rejecting with
  // MaxRetriesPerRequestError — which, uncaught, 500s the user's request
  // (this was the "Internal server error while generating plan" bug). Fail
  // commands fast instead so cacheManager's guards treat them as a miss.
  client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 3000,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });
  // Without an 'error' listener ioredis emits an *unhandled* 'error' event
  // on connection loss, which can crash the process. Log once, then stay
  // quiet — reads/writes are already best-effort in cacheManager.
  const logger = require("../utils/logger");
  let warned = false;
  client.on("error", (err) => {
    if (warned) return;
    warned = true;
    logger.warn("Redis cache unavailable — serving AI without cache", { error: err.message });
  });
} else {
  // Bounded on purpose: most AI cache keys are content hashes written once
  // and never requested again, so lazy delete-on-read never fires for them.
  // Without a ceiling this Map grows for the life of the process. On write
  // pressure: sweep expired entries first, then evict oldest (Map preserves
  // insertion order) until under the cap.
  const MAX_ENTRIES = 5000;
  const store = new Map();
  client = {
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, _flag, ttlSeconds) {
      if (store.size >= MAX_ENTRIES && !store.has(key)) {
        const now = Date.now();
        for (const [k, e] of store) {
          if (e.expiresAt && e.expiresAt < now) store.delete(k);
        }
        while (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value);
      }
      store.delete(key); // re-insert so live keys stay newest in eviction order
      store.set(key, {
        value,
        expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
      });
    },
    async del(key) {
      store.delete(key);
    },
  };
}

module.exports = { cacheClient: client, usingRedis: Boolean(REDIS_URL) };
