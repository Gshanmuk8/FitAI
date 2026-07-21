// Documentation drift net.
//
// docs/api.md had, before this test existed, drifted badly enough to
// document five endpoints that did not exist and omit seven that did —
// which is worse than no docs, because someone builds against it. The
// invariant this restores: the documented route table and the mounted route
// table are the same set. Add a route, add a row.
//
// Deliberately static, like db-scoping-guard: it reads app.js and
// routes/*.js as text rather than importing them, so the test never
// constructs a DB pool or an AI client and can run anywhere, offline, with
// no env. It verifies WHICH routes exist, not what they return.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SERVER_SRC = path.join(__dirname, '..', 'src');
const ROUTES_DIR = path.join(SERVER_SRC, 'routes');
const API_DOC = path.join(__dirname, '..', '..', 'docs', 'api.md');

// `app.use('/api/checklist', checklistRoutes)` -> mount prefix per router
// variable, plus the routers' own require paths so we can pair variable to
// file without importing anything.
function readMounts(appSource) {
  const requires = new Map(); // variable -> route file basename
  const requireRe = /const\s+(\w+)\s*=\s*require\(['"]\.\/routes\/(\w+)['"]\)/g;
  for (const [, variable, file] of appSource.matchAll(requireRe)) {
    requires.set(variable, file);
  }

  const mounts = new Map(); // route file basename -> mount prefix
  const useRe = /app\.use\(\s*['"](\/[^'"]*)['"]\s*,\s*(\w+)\s*\)/g;
  for (const [, prefix, variable] of appSource.matchAll(useRe)) {
    const file = requires.get(variable);
    if (file) mounts.set(file, prefix);
  }
  return mounts;
}

// `router.get('/history', ...)` -> ['GET', '/history']
function readRouterPaths(source) {
  const out = [];
  const re = /router\.(get|post|put|patch|delete)\(\s*['"]([^'"]*)['"]/g;
  for (const [, method, routePath] of source.matchAll(re)) {
    out.push({ method: method.toUpperCase(), path: routePath });
  }
  return out;
}

// Routes registered directly on the app rather than through a router — /health.
function readAppLevelRoutes(appSource) {
  const out = [];
  const re = /app\.(get|post|put|patch|delete)\(\s*['"](\/[^'"]*)['"]/g;
  for (const [, method, routePath] of appSource.matchAll(re)) {
    out.push({ method: method.toUpperCase(), path: routePath });
  }
  return out;
}

function join(prefix, routePath) {
  if (routePath === '/' || routePath === '') return prefix;
  return `${prefix}${routePath}`;
}

function mountedRoutes() {
  const appSource = fs.readFileSync(path.join(SERVER_SRC, 'app.js'), 'utf8');
  const mounts = readMounts(appSource);
  const routes = readAppLevelRoutes(appSource);

  for (const [file, prefix] of mounts) {
    const source = fs.readFileSync(path.join(ROUTES_DIR, `${file}.js`), 'utf8');
    for (const r of readRouterPaths(source)) {
      routes.push({ method: r.method, path: join(prefix, r.path) });
    }
  }
  return routes;
}

// The doc's table rows look like: | GET | /api/checklist/history?days=28 | ...
// Query strings are documentation of the params, not part of the route
// identity, so they're stripped before comparing. Escaped pipes inside a
// cell (`weekly\|monthly`) would break the column split, so they're removed
// before splitting.
function documentedRoutes() {
  const doc = fs.readFileSync(API_DOC, 'utf8');
  const out = [];
  for (const line of doc.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.replace(/\\\|/g, '').split('|').map((c) => c.trim());
    const [, method, routePath] = cells;
    if (!/^(GET|POST|PUT|PATCH|DELETE)$/.test(method || '')) continue;
    if (!routePath?.startsWith('/')) continue;
    out.push({ method, path: routePath.split('?')[0] });
  }
  return out;
}

const key = (r) => `${r.method} ${r.path}`;

test('every mounted route is documented in docs/api.md', () => {
  const documented = new Set(documentedRoutes().map(key));
  const undocumented = mountedRoutes().map(key).filter((k) => !documented.has(k));
  assert.deepEqual(
    undocumented, [],
    `These routes are mounted but missing from docs/api.md — add a row for each:\n  ${undocumented.join('\n  ')}`
  );
});

test('every documented route is actually mounted', () => {
  const mounted = new Set(mountedRoutes().map(key));
  const fictional = documentedRoutes().map(key).filter((k) => !mounted.has(k));
  assert.deepEqual(
    fictional, [],
    `docs/api.md documents routes that do not exist — remove them:\n  ${fictional.join('\n  ')}`
  );
});

// Guards the parser itself: if a refactor changes how routes are registered
// (an app.use() form this regex misses), both tests above would pass
// vacuously on an empty set. This makes that failure loud.
test('the route parser actually found the route table', () => {
  const mounted = mountedRoutes();
  assert.ok(
    mounted.length >= 20,
    `only parsed ${mounted.length} mounted routes — the parser has probably drifted from how app.js registers them`
  );
  assert.ok(
    mounted.some((r) => r.method === 'GET' && r.path === '/health'),
    'expected /health among the parsed routes'
  );
  assert.ok(
    mounted.some((r) => r.method === 'PATCH' && r.path === '/api/checklist/today/values'),
    'expected a nested router route among the parsed routes'
  );
});
