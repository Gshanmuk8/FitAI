// Read-only checks. Never print credentials, user records, or access tokens.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const root = path.join(__dirname, '..');
const backend = dotenv.parse(fs.readFileSync(path.join(root, 'server/.env')));
const frontend = dotenv.parse(fs.readFileSync(path.join(root, 'client/.env')));

async function apiCheck(name, route, key, summarize) {
  try {
    const response = await fetch(`${backend.SUPABASE_URL}${route}`, {
      headers: { apikey: key, ...(key.split('.').length === 3 ? { Authorization: `Bearer ${key}` } : {}) },
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json();
    console.log(JSON.stringify({ check: name, status: response.status,
      ...(response.ok ? summarize(body) : { errorCode: body.code || body.error_code }) }));
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ check: name, errorCode: error.cause?.code || error.code || error.name }));
    process.exitCode = 1;
  }
}

async function databaseCheck() {
  const { pool } = require('../server/src/config/db');
  try {
    const { rows: [row] } = await pool.query('select count(*)::int as migrations from public.schema_migrations');
    console.log(JSON.stringify({ check: 'database', connected: true, migrations: row.migrations }));
  } catch (error) {
    console.log(JSON.stringify({ check: 'database', connected: false, errorCode: error.code || error.name }));
    process.exitCode = 1;
  } finally { await pool.end(); }
}

async function main() {
  if (backend.SUPABASE_URL !== frontend.VITE_SUPABASE_URL) throw new Error('Client/server project URLs differ');
  await Promise.all([
    apiCheck('auth-settings', '/auth/v1/settings', frontend.VITE_SUPABASE_ANON_KEY, body => ({
      emailSignupEnabled: body.external?.email,
      signupDisabled: body.disable_signup,
      emailConfirmationRequired: !body.mailer_autoconfirm,
    })),
    apiCheck('server-key', '/auth/v1/admin/users?page=1&per_page=1', backend.SUPABASE_SERVICE_KEY,
      () => ({ accepted: true })),
    apiCheck('schema-rest', '/rest/v1/schema_migrations?select=name', backend.SUPABASE_SERVICE_KEY,
      body => ({ migrations: Array.isArray(body) ? body.length : null })),
    databaseCheck(),
  ]);
}

main().catch(() => {
  console.error('Configuration check failed. Verify the private environment files.');
  process.exitCode = 1;
});
