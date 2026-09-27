import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/utils/apiTransport.js';
import { authResult } from '../src/utils/authErrors.js';
import { validateClientConfig } from '../src/utils/clientConfig.js';

function setup(overrides = {}) {
  let signOuts = 0;
  const auth = {
    getSession: async () => ({ data: { session: { access_token: 'old-token' } } }),
    refreshSession: async () => ({ data: { session: null }, error: { status: 400, code: 'refresh_token_not_found' } }),
    signOut: async () => { signOuts++; return { error: null }; },
    ...overrides,
  };
  return { auth, signOuts: () => signOuts };
}
const reply = (status, body) => new Response(JSON.stringify(body), { status });

test('an auth outage during token refresh preserves the existing login', async () => {
  for (const error of [{ name: 'AuthRetryableFetchError', status: 0 }, { status: 503 }, { status: 429 }]) {
    const fixture = setup({ refreshSession: async () => ({ data: {}, error }) });
    const api = createApiClient({ auth: fixture.auth, fetchImpl: async () => reply(401, {}) });
    await assert.rejects(api.apiFetch('/api/plan'), e => e.status === 503);
    assert.equal(fixture.signOuts(), 0);
  }
});

test('a revoked refresh token returns the user to sign-in', async () => {
  const fixture = setup();
  const api = createApiClient({ auth: fixture.auth, fetchImpl: async () => reply(401, {}) });
  await assert.rejects(api.apiFetch('/api/plan'), /session has expired/);
  assert.equal(fixture.signOuts(), 1);
});

test('expired access token is retried with the refreshed token and normalized API origin', async () => {
  let token = 'old-token';
  const requests = [];
  const fixture = setup({
    getSession: async () => ({ data: { session: { access_token: token } } }),
    refreshSession: async () => { token = 'new-token'; return { data: { session: { access_token: token } } }; },
  });
  const api = createApiClient({ auth: fixture.auth, apiUrl: ' https://api.example.com/ ', fetchImpl: async (url, options) => {
    requests.push({ url, token: options.headers.Authorization });
    return options.headers.Authorization === 'Bearer old-token' ? reply(401, {}) : reply(200, { plan: 'saved-plan' });
  } });
  assert.deepEqual(await api.apiFetch('/api/plan'), { plan: 'saved-plan' });
  assert.deepEqual(requests, [
    { url: 'https://api.example.com/api/plan', token: 'Bearer old-token' },
    { url: 'https://api.example.com/api/plan', token: 'Bearer new-token' },
  ]);
  assert.equal(fixture.signOuts(), 0);
});

test('a backend outage never looks like a missing user profile', async () => {
  const fixture = setup();
  const api = createApiClient({ auth: fixture.auth, fetchImpl: async () => reply(503, { error: 'No profile found upstream' }) });
  await assert.rejects(api.apiFetch('/api/onboarding'), e => e.status === 503 && !e.noProfile);
  assert.equal(fixture.signOuts(), 0);
});

test('only the actual missing-profile response permits fresh onboarding', async () => {
  const api = createApiClient({ auth: setup().auth, fetchImpl: async () => reply(404, { error: 'No profile found' }) });
  await assert.rejects(api.apiFetch('/api/onboarding'), e => e.noProfile && e.status === 404);
});

test('network failure has an actionable message and never signs out', async () => {
  const fixture = setup();
  const api = createApiClient({ auth: fixture.auth, fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(api.apiFetch('/api/plan'), /cannot reach FitAI/);
  assert.equal(fixture.signOuts(), 0);
});

test('request deadline also bounds a stalled session lookup', async () => {
  const api = createApiClient({ auth: setup({ getSession: () => new Promise(() => {}) }).auth, timeoutMs: 15 });
  await assert.rejects(api.apiFetch('/api/plan'), /longer than expected/);
});

test('multipart upload preserves the browser boundary and bearer token', async () => {
  const form = new FormData();
  form.set('image', new Blob(['test']), 'meal.png');
  const api = createApiClient({ auth: setup().auth, fetchImpl: async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer old-token');
    assert.equal(options.headers['Content-Type'], undefined);
    assert.equal(options.body, form);
    return reply(200, { food: 'meal' });
  } });
  assert.deepEqual(await api.apiUpload('/api/nutrition/analyze', form), { food: 'meal' });
});

test('auth service failures stay failures and preserve error codes', async () => {
  await assert.rejects(authResult(async () => ({ error: { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' } })), /cannot reach the account service/);
  await assert.rejects(authResult(async () => ({ error: { code: 'email_not_confirmed', message: 'unconfirmed' } })), e => e.code === 'email_not_confirmed' && /confirm your email/.test(e.message));
  assert.deepEqual(await authResult(async () => ({ data: { session: null }, error: null })), { session: null });
});

test('deployment config rejects Render IDs, placeholders and secret keys', () => {
  const valid = { VITE_SUPABASE_URL: 'https://project.supabase.co', VITE_SUPABASE_ANON_KEY: 'sb_publishable_test', VITE_API_URL: 'https://fitai.onrender.com' };
  assert.deepEqual(validateClientConfig(valid), []);
  assert.ok(validateClientConfig({ ...valid, VITE_API_URL: 'srv-1234' }).length);
  assert.ok(validateClientConfig({ ...valid, VITE_API_URL: 'https://fitai.onrender.com/api' }).length);
  assert.ok(validateClientConfig({ ...valid, VITE_SUPABASE_ANON_KEY: 'sb_secret_private' }).length);
  assert.ok(validateClientConfig({ ...valid, VITE_SUPABASE_URL: 'https://your-project.supabase.co' }).length);
  const jwt = `header.${Buffer.from(JSON.stringify({ role: 'anon', ref: 'other' })).toString('base64url')}.signature`;
  assert.ok(validateClientConfig({ ...valid, VITE_SUPABASE_ANON_KEY: jwt }).some(p => /different projects/.test(p)));
});
