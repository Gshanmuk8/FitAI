/**
 * Per-request AI tracing. Every gateway execution creates one trace;
 * every notable event (cache hit, attempt, retry, provider failure,
 * breaker skip, fallback) is appended; end() emits ONE structured log
 * line containing the whole lifecycle. One line per AI request is the
 * observability contract: grep a request id and you see the entire story
 * — which providers were tried, why each failed, what finally answered,
 * how long it took, and what it (approximately) cost.
 */
function createTelemetry({ logger, now = Date.now } = {}) {
  let seq = 0;

  function startTrace(task, meta = {}) {
    const id = `ai_${now().toString(36)}_${(seq++).toString(36)}`;
    const startedAt = now();
    const events = [];

    return {
      id,
      event(name, data = {}) {
        events.push({ name, atMs: now() - startedAt, ...data });
      },
      end(status, data = {}) {
        const line = {
          aiTrace: id,
          task,
          status, // 'ai' | 'cache' | 'stale_cache' | 'fallback' | 'budget_blocked'
          latencyMs: now() - startedAt,
          events,
          ...meta,
          ...data,
        };
        if (logger) {
          (status === 'fallback' || status === 'budget_blocked' ? logger.warn : logger.info)(
            `ai:${task} -> ${status}`,
            line
          );
        }
        return line;
      },
    };
  }

  return { startTrace };
}

module.exports = { createTelemetry };
