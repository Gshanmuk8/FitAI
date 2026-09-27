const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.DATABASE_URL = 'postgres://postgres:password@localhost/unused';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
const { isAuthServiceUnavailable } = require('../src/middleware/auth');

test('Supabase returned network and server errors are service outages, not invalid tokens', () => {
  for (const error of [{ name: 'AuthRetryableFetchError' }, { status: 0 }, { status: 503 }, { status: 429 }]) {
    assert.equal(isAuthServiceUnavailable(error), true);
  }
  assert.equal(isAuthServiceUnavailable({ status: 401, code: 'bad_jwt' }), false);
  assert.equal(isAuthServiceUnavailable(null), false);
});
