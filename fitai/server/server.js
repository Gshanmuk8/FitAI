const app = require('./src/app');
const { PORT, validateEnv } = require('./src/config/env');
const { pool } = require('./src/config/db');
const logger = require('./src/utils/logger');

// Fail fast on placeholder config in production; warn-and-boot in dev.
const { problems, aiProviders } = validateEnv();
problems.forEach((p) => logger.warn(`env: ${p}`));
logger.info(
  aiProviders.length
    ? `AI providers configured: ${aiProviders.join(', ')}`
    : 'No AI providers configured — running on rules engine and static templates only.'
);

const server = app.listen(PORT, () => {
  logger.info(`fitai server listening on port ${PORT}`);
  // pg connects lazily, so without this the FIRST user request after a cold
  // start pays the TCP + TLS handshake to the pooler (~200-700ms) on top of
  // the platform's own spin-up. Warming one client here moves that cost off
  // the critical path. Failure is ignored on purpose: an unreachable DB is
  // already reported by /health, and it must not prevent the process from
  // accepting connections.
  pool.query('SELECT 1').catch(() => {});
});

// Graceful shutdown: stop accepting connections, let in-flight requests
// finish, then release the Postgres pool. A second signal (or 10s) forces
// exit so a hung request can't block a deploy.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) process.exit(1);
  shuttingDown = true;
  logger.info(`${signal} received — shutting down gracefully`);
  const force = setTimeout(() => {
    logger.error('Forced shutdown after 10s');
    process.exit(1);
  }, 10000);
  force.unref();

  server.close(async () => {
    try {
      await pool.end();
    } catch (err) {
      logger.error('Error closing Postgres pool', { error: err.message });
    }
    logger.info('Shutdown complete');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
