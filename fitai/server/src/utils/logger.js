/**
 * Minimal structured logger — JSON lines in production (machine-parseable
 * for any log shipper), human-readable in development. Zero dependencies
 * on purpose; swap the transport here if a real aggregator is added.
 * New code should use this instead of bare console.*; existing call sites
 * are migrated incrementally, not big-banged.
 */
const NODE_ENV = process.env.NODE_ENV || 'development';

function emit(level, message, meta) {
  const entry = { time: new Date().toISOString(), level, message, ...(meta || {}) };
  const line =
    NODE_ENV === 'production'
      ? JSON.stringify(entry)
      : `[${level}] ${message}${meta && Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''}`;
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
}

module.exports = {
  info: (message, meta) => emit('info', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  error: (message, meta) => emit('error', message, meta),
  // Binds a request id so all logs for one request correlate.
  forRequest: (req) => ({
    info: (message, meta) => emit('info', message, { requestId: req.id, ...meta }),
    warn: (message, meta) => emit('warn', message, { requestId: req.id, ...meta }),
    error: (message, meta) => emit('error', message, { requestId: req.id, ...meta }),
  }),
};
