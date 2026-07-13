const test = require('node:test');
const assert = require('node:assert');
const { createExpiringMap } = require('../src/utils/expiringMap');

test('entries expire after their TTL', (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const map = createExpiringMap({ ttlMs: 1000 });
  map.set('a', 1);
  assert.equal(map.get('a'), 1);
  t.mock.timers.tick(1001);
  assert.equal(map.get('a'), undefined);
  assert.equal(map.size, 0); // expired read also evicts
});

test('size never exceeds maxEntries; expired entries are swept first', (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const map = createExpiringMap({ ttlMs: 1000, maxEntries: 3 });
  map.set('a', 1);
  map.set('b', 2);
  t.mock.timers.tick(1001); // a and b now expired
  map.set('c', 3);
  map.set('d', 4); // at cap: sweep removes a and b, c and d live on
  assert.equal(map.size, 2);
  assert.equal(map.get('c'), 3);
  assert.equal(map.get('d'), 4);
});

test('at cap with nothing expired, the oldest entry is evicted', () => {
  const map = createExpiringMap({ ttlMs: 60000, maxEntries: 2 });
  map.set('a', 1);
  map.set('b', 2);
  map.set('c', 3);
  assert.equal(map.size, 2);
  assert.equal(map.get('a'), undefined); // oldest went first
  assert.equal(map.get('b'), 2);
  assert.equal(map.get('c'), 3);
});

test('re-setting an existing key refreshes its recency, not the map size', () => {
  const map = createExpiringMap({ ttlMs: 60000, maxEntries: 2 });
  map.set('a', 1);
  map.set('b', 2);
  map.set('a', 10); // a becomes newest
  map.set('c', 3); // evicts b (now oldest), not a
  assert.equal(map.get('a'), 10);
  assert.equal(map.get('b'), undefined);
  assert.equal(map.get('c'), 3);
});
