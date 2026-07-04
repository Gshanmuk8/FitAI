// Applies every SQL file in ../migrations in filename order, exactly once,
// tracked in a schema_migrations table. Idempotent: already-applied files are
// skipped, so it is safe to run on every deploy. Each file runs in its own
// transaction and rolls back on failure. Run with: npm run migrate
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');
const logger = require('../src/utils/logger');

async function migrate() {
  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  await pool.query(
    `create table if not exists schema_migrations (
       name text primary key,
       applied_at timestamptz default now()
     )`
  );
  const { rows } = await pool.query('select name from schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) {
      logger.info(`migrate: skip ${file} (already applied)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
      logger.info(`migrate: applied ${file}`);
    } catch (err) {
      await client.query('rollback');
      logger.error(`migrate: FAILED ${file} — rolled back`, { error: err.message });
      throw err;
    } finally {
      client.release();
    }
  }
  logger.info('migrate: schema up to date');
}

migrate()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('migrate: aborted', { error: err.message });
    process.exit(1);
  });
