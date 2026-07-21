// adherenceFrom feeds the daily briefing and the coach chat. Its windows are
// CALENDAR days clamped to the account's history span, which makes the span
// calculation the load-bearing part — and the part that failed silently.
const { test } = require('node:test');
const assert = require('node:assert');
const { adherenceFrom } = require('../src/services/analytics/adherence');

const ALL_DONE = {
  workout_completed: true, protein_completed: true,
  water_completed: true, sleep_completed: true, steps_completed: true,
};

// history is date-DESC, exactly as getHistory returns it.
const day = (date, fields = ALL_DONE) => ({ date, ...fields });

test('no history at all reports null, not zero', () => {
  const a = adherenceFrom([], '2026-07-22');
  assert.equal(a.last7, null);
  assert.equal(a.daysLogged, 0);
});

test('a perfect trailing week reports 100%', () => {
  const history = [];
  for (let i = 0; i < 7; i++) {
    history.push(day(`2026-07-${String(22 - i).padStart(2, '0')}`));
  }
  const a = adherenceFrom(history, '2026-07-22');
  assert.equal(a.last7, 1);
  assert.equal(a.workoutConsistency, 1);
});

// Invariant (held before the fix too, since the oldest row was still in the
// past): a future row is outside every backward-looking window, so it must
// not move the score.
test('a future-dated row does not change the score', () => {
  const history = [
    day('2026-07-25'), // ahead of "today"
    day('2026-07-22'),
    day('2026-07-21'),
    day('2026-07-20'),
  ];
  const a = adherenceFrom(history, '2026-07-22');
  assert.ok(a.last7 > 0, `expected real adherence, got ${a.last7}`);
  assert.equal(a.last7, adherenceFrom(history.slice(1), '2026-07-22').last7,
    'a future row must not change the score — the windows only look backwards');
});

// THIS is the regression. When every row was dated after todayStr,
// (today - earliest) went negative and historySpanDays collapsed to 1. The
// single inspected day had no row, so the score came out 0/(1*5) = 0% and a
// diligent user was told 0% adherence on both the dashboard and in chat.
// Verified against the pre-fix span calculation: it returned 1 here.
test('history entirely in the future reports null rather than a false zero', () => {
  const a = adherenceFrom([day('2026-08-01')], '2026-07-22');
  assert.equal(a.last7, null);
  assert.equal(a.daysLogged, 1);
});

// Days the app was never opened must count against adherence — otherwise the
// AI is handed a systematically inflated number.
test('unlogged calendar days count as missed, not skipped', () => {
  const history = [day('2026-07-22'), day('2026-07-16')];
  const a = adherenceFrom(history, '2026-07-22');
  assert.ok(a.last7 < 1, 'a week with one logged day cannot be 100%');
  assert.ok(a.last7 > 0);
});
