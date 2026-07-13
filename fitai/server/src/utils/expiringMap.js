/**
 * A Map with a TTL and a hard size ceiling — for per-user memos and caches
 * that live for the process lifetime. A plain Map in that position is a slow
 * leak: entries written for users who never return are never read again, so
 * lazy "delete on read" eviction never fires and memory grows with every
 * distinct user until restart. This wrapper guarantees a bound instead:
 * expired entries are swept on write pressure, and if the map is still full
 * the oldest entries go first (Map preserves insertion order; set() re-inserts
 * so recently-touched keys survive).
 */
function createExpiringMap({ ttlMs, maxEntries = 10000 }) {
  const store = new Map();

  function get(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  function set(key, value, entryTtlMs = ttlMs) {
    if (store.size >= maxEntries && !store.has(key)) {
      const now = Date.now();
      for (const [k, e] of store) {
        if (e.expiresAt <= now) store.delete(k);
      }
      while (store.size >= maxEntries) store.delete(store.keys().next().value);
    }
    store.delete(key); // re-insert so this key becomes the newest
    store.set(key, { value, expiresAt: Date.now() + entryTtlMs });
  }

  return {
    get,
    set,
    delete: (key) => store.delete(key),
    get size() {
      return store.size;
    },
  };
}

module.exports = { createExpiringMap };
