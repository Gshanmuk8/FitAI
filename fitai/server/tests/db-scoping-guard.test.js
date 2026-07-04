// Structural drift net (not a security boundary — see src/db/userAccess.js).
//
// The invariant: ALL database access flows through src/db/userAccess.js, so
// user scoping is enforced at one door instead of being re-remembered in
// every new model function. This test fails the build if any code outside
// that layer touches the pool directly — which is the exact shape of the
// accidental future regression we're guarding against ("a dev adds an
// endpoint and forgets user_id"). It's a file-boundary check, deliberately
// NOT a SQL/AST parser: it verifies WHERE the DB is reached, not whether a
// given query string is semantically scoped — the former is reliable, the
// latter is bypassable theater.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const ROOT = path.join(__dirname, '..');
// The one place allowed to touch the pool directly.
const DB_LAYER = path.join('src', 'db');
// config/db.js constructs the pool but never queries it; the access layer is
// the only module that calls .query.
const POOL_DEFINITION = path.join('src', 'config', 'db.js');

function jsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      out.push(...jsFiles(full));
    } else if (entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

const files = jsFiles(SRC).map((f) => ({ rel: path.relative(ROOT, f), src: fs.readFileSync(f, 'utf8') }));

test('no pool/client .query() outside the db access layer', () => {
  const offenders = files
    .filter((f) => !f.rel.startsWith(DB_LAYER))
    .filter((f) => /\b(pool|client)\.query\s*\(/.test(f.src))
    .map((f) => f.rel);
  assert.deepStrictEqual(
    offenders,
    [],
    `Direct DB access found outside src/db/. Route it through db/userAccess ` +
    `(queryAs for user-scoped, querySystem for genuinely userless):\n  ${offenders.join('\n  ')}`
  );
});

test('nothing outside the db layer imports the raw pool', () => {
  const offenders = files
    .filter((f) => !f.rel.startsWith(DB_LAYER) && f.rel !== POOL_DEFINITION)
    .filter((f) => /require\(['"][^'"]*config\/db['"]\)/.test(f.src) && /\bpool\b/.test(f.src.split('\n').find((l) => /config\/db/.test(l)) || ''))
    .map((f) => f.rel);
  assert.deepStrictEqual(
    offenders,
    [],
    `The raw pool is imported outside src/db/. Import from db/userAccess instead:\n  ${offenders.join('\n  ')}`
  );
});

test('the access layer actually enforces a userId (contract sanity)', () => {
  const gate = fs.readFileSync(path.join(SRC, 'db', 'userAccess.js'), 'utf8');
  assert.match(gate, /if \(!userId\)/, 'queryAs must reject a missing userId');
  assert.match(gate, /user_id/, 'queryAs must check the query references user_id');
});
