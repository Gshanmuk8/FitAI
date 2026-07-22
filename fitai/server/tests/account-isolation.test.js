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
const { accountKey, IP_MAX, USER_MAX, AI_MAX } = require('../src/middleware/rateLimiter');
const { buildPlatformConfig } = require('../src/services/ai/platform/platformConfig');
const { resolveEffectiveDiet } = require('../src/services/plan/dietResolver');

// ---- ISOLATION: rate limiting ----
//
// The design has to bound abuse by something UNFORGEABLE while still giving
// each account its own budget. An earlier attempt keyed the global limiter
// on `ip + hash(bearer token)` to get both at once; because the token is not
// verified at that point, an attacker minting a fresh random token per
// request minted a fresh bucket per request. These tests pin the corrected
// split so that hole cannot reappear.

test('the IP floor cannot be escaped by rotating bearer tokens', () => {
  // THE REGRESSION. Five different unverified tokens from one address must
  // still land in ONE bucket, or the floor is decorative.
  // The floor uses express-rate-limit's DEFAULT key (the IP). Asserted by
  // source, because the middleware does not expose its key function and a
  // custom keyGenerator here is exactly the mistake being guarded against.
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'middleware', 'rateLimiter.js'), 'utf8');
  const floor = src.slice(src.indexOf('const ipLimiter'), src.indexOf('const userLimiter'));
  assert.doesNotMatch(floor, /keyGenerator/,
    'the IP floor must use the default IP key — any token-derived key is forgeable');
});

test('the IP floor is generous enough that a shared network is not throttled', () => {
  // A household or gym behind one address must never hit this in normal use;
  // per-account fairness is userLimiter's job, not the floor's.
  assert.ok(IP_MAX >= 600, `floor is ${IP_MAX}, too low for a shared NAT`);
});

test('two accounts get separate per-user buckets', () => {
  const a = accountKey({ user: { id: 'user-alice' }, ip: '203.0.113.7' });
  const b = accountKey({ user: { id: 'user-bob' }, ip: '203.0.113.7' });
  assert.notEqual(a, b, 'same network, different accounts, different budgets');
  assert.equal(a, 'user-alice', 'the key is the VERIFIED user id');
  assert.ok(USER_MAX > 0);
});

test('one account keeps one bucket wherever it connects from', () => {
  const a = accountKey({ user: { id: 'user-alice' }, ip: '203.0.113.7' });
  const b = accountKey({ user: { id: 'user-alice' }, ip: '198.51.100.2' });
  assert.equal(a, b, 'switching wifi must not hand out a fresh budget');
});

test('the AI limiter is also keyed on the verified account', () => {
  assert.notEqual(
    accountKey({ user: { id: 'user-alice' }, ip: '203.0.113.7' }),
    accountKey({ user: { id: 'user-bob' }, ip: '203.0.113.7' }));
  assert.ok(AI_MAX <= 30, 'the provider-spending route needs a tight cap');
});

test('the per-user limit is applied inside requireAuth, not mounted globally', () => {
  // Mounting it globally would mean keying on an unverified identity again.
  // This asserts the wiring, which is the part that is easy to undo later.
  const fs = require('fs');
  const path = require('path');
  const auth = fs.readFileSync(path.join(__dirname, '..', 'src', 'middleware', 'auth.js'), 'utf8');
  assert.match(auth, /userLimiter\(req, res, next\)/,
    'requireAuth must run the per-user limiter once the token is verified');
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  assert.doesNotMatch(app, /app\.use\(\s*userLimiter/,
    'the per-user limiter must not be mounted before authentication');
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

test("the user's own edited targets win while the goal they were set under holds", () => {
  // planEditingService stamps dietGoal on every edit, so an edit made under
  // the current goal is unambiguously an edit rather than a leftover.
  const edited = { diet: { calorieTarget: 2000, proteinGrams: 999, dietGoal: 'lose_fat' } };
  const d = resolveEffectiveDiet(PROFILE, edited);
  assert.equal(d.calorieTarget, 2000, 'the user\'s number is the user\'s number');
  assert.equal(d.proteinGrams, 999);
  // ...but the context around it is re-derived, so the label cannot lie.
  assert.equal(d.calorieDirection, 'deficit');
  assert.equal(d.calorieDelta, 2000 - d.maintenanceCalories);
});

test('an UNSTAMPED stored target yields to the current goal', () => {
  // Plans written before the stamp existed are ambiguous: the number could
  // be a deliberate edit or a leftover from an abandoned goal, and nothing
  // distinguishes them. Serving a surplus to someone cutting is harmful
  // health advice; overriding an edit is recoverable — they re-enter it, the
  // new edit IS stamped, and it sticks from then on. Correctness wins, and
  // the trade is written down here rather than being a silent surprise.
  const legacy = { diet: { calorieTarget: 2000, proteinGrams: 999 } };
  const d = resolveEffectiveDiet(PROFILE, legacy);
  assert.notEqual(d.calorieTarget, 2000);
  assert.equal(d.calorieDirection, 'deficit', 'and it agrees with the stated goal');
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
