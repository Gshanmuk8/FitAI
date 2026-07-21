/**
 * Adherence math over daily_checklists rows — shared by the daily briefing
 * and the chat activity snapshot so those AI surfaces can never disagree
 * about what "70% adherence" means. The Progress page deliberately does NOT
 * use this: its AI receives the raw day-by-day checklist log and measures
 * adherence itself — nothing on that page is precomputed.
 *
 * Windows are CALENDAR days, not last-N-rows: a day the app was never opened
 * has no row, and counting only logged days would feed the AI systematically
 * inflated numbers. The window is clamped to the account's actual history
 * span so a three-day-old account isn't graded on 28 days it didn't exist for.
 */
// calories_completed (008) is deliberately NOT in this list: rows from
// before the column existed can never score it, so including it would
// systematically deflate every historical window. The AI still sees
// calories day-by-day via dailyValues and the live today block.
const ADHERENCE_FIELDS = ['workout_completed', 'protein_completed', 'water_completed', 'sleep_completed', 'steps_completed'];
const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (n) => Math.round(n * 100) / 100;

// pg DATE columns come back as a JS Date at SERVER-local midnight —
// toISOString() would shift them a day on any non-UTC server. Format from
// local components instead.
function ymd(d) {
  if (typeof d === 'string') return d.slice(0, 10);
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// history: daily_checklists rows, date-DESC. todayStr: user-local YYYY-MM-DD.
function adherenceFrom(history, todayStr) {
  if (!history.length) return { last7: null, last28: null, workoutConsistency: null, nutritionConsistency: null, daysLogged: 0 };
  const byDate = new Map(history.map((r) => [ymd(r.date), r]));
  const today = new Date(`${todayStr}T12:00:00`);

  // Span is measured from the earliest row that is not in the future
  // relative to todayStr. A row dated after today (a clock skew, or a
  // timezone that briefly ran ahead) would otherwise make (today - earliest)
  // negative, collapse the span to 1, and report a diligent user's adherence
  // as 0% — the windows below only ever look backwards from today, so a
  // future row can't contribute anyway.
  const past = history.map((r) => ymd(r.date)).filter((d) => d <= todayStr);
  if (!past.length) return { last7: null, last28: null, workoutConsistency: null, nutritionConsistency: null, daysLogged: history.length };
  const earliest = new Date(`${past[past.length - 1]}T12:00:00`);
  const historySpanDays = Math.max(1, Math.floor((today - earliest) / DAY_MS) + 1);

  const windowStats = (days) => {
    const span = Math.min(days, historySpanDays);
    let hits = 0, workoutDays = 0, proteinDays = 0;
    for (let i = 0; i < span; i++) {
      const row = byDate.get(ymd(new Date(today.getTime() - i * DAY_MS)));
      if (!row) continue;
      hits += ADHERENCE_FIELDS.filter((f) => row[f]).length;
      if (row.workout_completed) workoutDays += 1;
      if (row.protein_completed) proteinDays += 1;
    }
    return {
      overall: round2(hits / (span * ADHERENCE_FIELDS.length)),
      workout: round2(workoutDays / span),
      protein: round2(proteinDays / span),
    };
  };

  const w7 = windowStats(7);
  const w28 = windowStats(28);
  return {
    last7: w7.overall,
    last28: w28.overall,
    workoutConsistency: w28.workout,
    nutritionConsistency: w28.protein,
    daysLogged: history.length,
  };
}

module.exports = { adherenceFrom, ymd, ADHERENCE_FIELDS, DAY_MS };
