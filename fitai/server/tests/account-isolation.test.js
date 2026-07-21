/**
 * Two properties this app must never lose:
 *
 *   1. UNIFORMITY  — every account gets the same functionality. Behaviour
 *      must not depend on when the account was created or which optional
 *      fields its stored rows happen to carry.
 *   2. ISOLATION   — no account can observe or degrade another. Not its
 *      data, not its cached answers, and not its share of a rate limit or
 *      an AI budget.
 *
 * The isolation failures worth guarding are the quiet ones: a shared rate
 * limit bucket and an unbounded per-user AI budget don't leak data, they
 * just let one person's behaviour change another person's experience.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { tokenFingerprint } = require('../src/middleware/rateLimiter');
const { buildPlatformConfig } = require('../src/services/ai/platform/platformConfig');
const { resolveEffectiveDiet } = require('../src/services/plan/dietResolver');

// ---- ISOLATION: rate limiting ----

const reqWith = (ip, token) => ({ ip, headers: token ? { authorization: `Bearer ${token}` } : {} });

test('two accounts on the SAME ip get different rate-limit buckets', () => {
  // A gym's wifi, a household, a carrier-grade NAT. Sharing one bucket means
  // one member's session can 429 another's.
  const a = tokenFingerprint(reqWith('203.0.113.7', 'token-for-alice'));
  const b = tokenFingerprint(reqWith('203.0.113.7', 'token-for-bob'));
  assert.notEqual(a, b);
});

test('the same account keeps ONE bucket across requests', () => {
  const a = tokenFingerprint(reqWith('203.0.113.7', 'token-for-alice'));
  const b = tokenFingerprint(reqWith('198.51.100.2', 'token-for-alice'));
  assert.equal(a, b, 'the fingerprint is the credential, not the network path');
});

test('the raw bearer token never becomes the rate-limit key', () => {
  const token = 'super-secret-jwt-value';
  const fp = tokenFingerprint(reqWith('203.0.113.7', token));
  assert.ok(!fp.includes(token), 'a limiter key can surface in diagnostics');
  assert.match(fp, /^[0-9a-f]{16}$/, 'a short, opaque digest');
});

test('unauthenticated callers collapse to one bucket so abuse stays bounded', () => {
  assert.equal(tokenFingerprint(reqWith('203.0.113.7')), 'anon');
  assert.equal(tokenFingerprint({ ip: '203.0.113.7', headers: { authorization: 'Basic xyz' } }), 'anon');
});

// ---- ISOLATION: AI budget ----

test('a per-user AI budget is enabled by default', () => {
  // With this at 0 there is no per-account ceiling, so one runaway account
  // burns the shared provider quota and degrades everyone else to fallback.
  const cfg = buildPlatformConfig();
  assert.ok(cfg.budget.dailyTokensPerUser > 0,
    'the per-user rail is what stops one account changing another\'s experience');
});

test('the per-user budget is generous enough that honest use never meets it', () => {
  const cfg = buildPlatformConfig();
  assert.ok(cfg.budget.dailyTokensPerUser >= 100_000,
    'a rail that real users hit is a broken feature, not a safety rail');
});

// ---- UNIFORMITY: behaviour must not depend on an account's vintage ----

const PROFILE = {
  weight_kg: 95, height_cm: 185, age: 30, sex: 'male',
  activity_level: 'very_active', goal: 'lose_fat',
};

test('an account whose plan predates the diet context still gets the full explanation', () => {
  // The exact split observed in production: one account showed the
  // maintenance line and another did not, purely because of when its plan
  // was generated.
  const legacy = { diet: { calorieTarget: 3321, proteinGrams: 150 } }; // no maintenance
  const modern = { diet: { calorieTarget: 3321, proteinGrams: 150, maintenanceCalories: 3821, calorieDelta: -500, calorieDirection: 'deficit' } };

  const a = resolveEffectiveDiet(PROFILE, legacy);
  const b = resolveEffectiveDiet(PROFILE, modern);

  for (const d of [a, b]) {
    assert.ok(d.maintenanceCalories > 0, 'both vintages must carry maintenance');
    assert.ok(['deficit', 'surplus', 'maintenance'].includes(d.calorieDirection));
  }
  assert.equal(a.maintenanceCalories, b.maintenanceCalories,
    'maintenance is a function of the body, so it cannot differ by plan age');
  assert.equal(a.calorieDirection, b.calorieDirection);
});

test('an account with no plan at all still gets targets', () => {
  const d = resolveEffectiveDiet(PROFILE, null);
  assert.ok(d.calorieTarget > 0);
  assert.equal(d.calorieDirection, 'deficit');
});

test("the user's own edited targets always win over the recomputed ones", () => {
  const edited = { diet: { calorieTarget: 2000, proteinGrams: 999 } };
  const d = resolveEffectiveDiet(PROFILE, edited);
  assert.equal(d.calorieTarget, 2000, 'the user\'s number is the user\'s number');
  assert.equal(d.proteinGrams, 999);
  // ...but the context around it is re-derived, so the label cannot lie.
  assert.equal(d.calorieDirection, 'deficit');
  assert.equal(d.calorieDelta, 2000 - d.maintenanceCalories);
});

test('maintenance is recomputed from the CURRENT body, not frozen at plan time', () => {
  const stale = { diet: { calorieTarget: 3321, maintenanceCalories: 9999 } };
  const d = resolveEffectiveDiet(PROFILE, stale);
  assert.notEqual(d.maintenanceCalories, 9999,
    'a user who has since lost weight must see today\'s deficit, not the plan\'s');
});

test('an incomplete profile yields no invented figures', () => {
  const d = resolveEffectiveDiet({ ...PROFILE, activity_level: null }, null);
  assert.equal(d, null, 'no numbers beats wrong numbers');
});
