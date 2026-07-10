/**
 * Token/cost accounting and budget enforcement.
 *
 * Tokens are ESTIMATED (chars/4) because the adapter contract returns
 * parsed JSON, not raw provider payloads — a deliberate tradeoff: exact
 * usage would couple every adapter to its provider's response envelope.
 * Estimates are consistently labeled and good enough for budget rails and
 * relative cost comparison; exact billing belongs to the provider console.
 *
 * In-memory, day-keyed counters: per-instance guardrails, not a ledger.
 * For a multi-instance fleet, swap `store` for Redis INCRBY — the
 * interface is already shaped for it.
 *
 * Factory for testability (inject clock, config).
 */
function createUsageTracker({ pricing = {}, budget = {}, now = () => new Date() } = {}) {
  const dayKey = () => now().toISOString().slice(0, 10);
  const monthKey = () => now().toISOString().slice(0, 7);

  // period -> aggregate; aggregates also keyed per provider/model/user/task
  const store = new Map();

  function bump(map, key, promptTokens, completionTokens) {
    const cur = map.get(key) || { calls: 0, promptTokens: 0, completionTokens: 0 };
    cur.calls += 1;
    cur.promptTokens += promptTokens;
    cur.completionTokens += completionTokens;
    map.set(key, cur);
  }

  function period(key) {
    if (!store.has(key)) {
      store.set(key, {
        totals: { calls: 0, promptTokens: 0, completionTokens: 0 },
        byProvider: new Map(),
        byTask: new Map(),
        byUser: new Map(),
      });
    }
    return store.get(key);
  }

  // Keep only the current day + month plus a short tail — without pruning,
  // a long-lived instance accumulates one period entry (with per-user maps)
  // per day forever.
  const KEEP_PERIODS = 4; // today, yesterday, this month, last month

  function prune() {
    if (store.size <= KEEP_PERIODS) return;
    const keep = new Set([dayKey(), monthKey()]);
    const rest = [...store.keys()].filter((k) => !keep.has(k)).sort().reverse();
    for (const key of rest.slice(KEEP_PERIODS - keep.size)) store.delete(key);
  }

  function record({ provider, model, task, userId, promptTokens = 0, completionTokens = 0 }) {
    for (const key of [dayKey(), monthKey()]) {
      const p = period(key);
      p.totals.calls += 1;
      p.totals.promptTokens += promptTokens;
      p.totals.completionTokens += completionTokens;
      bump(p.byProvider, `${provider}/${model || 'default'}`, promptTokens, completionTokens);
      bump(p.byTask, task || 'unknown', promptTokens, completionTokens);
      if (userId) bump(p.byUser, userId, promptTokens, completionTokens);
    }
    prune();
  }

  function totalTokens(agg) {
    return agg.promptTokens + agg.completionTokens;
  }

  // Budget gate, checked BEFORE spending: block AI (fallbacks still run —
  // a blown budget degrades quality, never availability).
  function checkBudget(userId) {
    const p = period(dayKey());
    if (budget.dailyTokens > 0 && totalTokens(p.totals) >= budget.dailyTokens) {
      return { allowed: false, reason: 'daily_budget_exhausted' };
    }
    if (budget.dailyTokensPerUser > 0 && userId) {
      const u = p.byUser.get(userId);
      if (u && totalTokens(u) >= budget.dailyTokensPerUser) {
        return { allowed: false, reason: 'user_daily_budget_exhausted' };
      }
    }
    return { allowed: true };
  }

  function estimateCostUsd(providerKey, agg) {
    const name = providerKey.split('/')[0];
    const price = pricing[name];
    if (!price) return 0;
    return (agg.promptTokens / 1e6) * price.prompt + (agg.completionTokens / 1e6) * price.completion;
  }

  function report(key = dayKey()) {
    const p = store.get(key);
    if (!p) return { period: key, totals: { calls: 0, promptTokens: 0, completionTokens: 0 }, byProvider: {}, byTask: {}, estimated: true };
    const byProvider = {};
    for (const [k, v] of p.byProvider) byProvider[k] = { ...v, estCostUsd: Number(estimateCostUsd(k, v).toFixed(4)) };
    const byTask = {};
    for (const [k, v] of p.byTask) byTask[k] = { ...v };
    return { period: key, totals: { ...p.totals }, byProvider, byTask, estimated: true };
  }

  return { record, checkBudget, report };
}

// chars/4 — the industry rule of thumb; consistently wrong beats
// inconsistently precise for rails and trend lines.
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}

module.exports = { createUsageTracker, estimateTokens };
