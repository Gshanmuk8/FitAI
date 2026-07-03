const { REDIS_URL } = require("./env");

let client;

if (REDIS_URL) {
  const Redis = require("ioredis");
  client = new Redis(REDIS_URL);
} else {
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
