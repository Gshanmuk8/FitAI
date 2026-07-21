/**
 * Pure rules about the SHAPE of a plan, independent of who generated it.
 *
 * Lives in shared/ rather than in the plan service because it is arithmetic
 * over a plain object — no DB, no provider, no logger — which means it can
 * be tested directly and reused by the fallback engine.
 */

/**
 * The user's stated training days are a COMMITMENT, not a suggestion.
 *
 * The prompt asks for exactly N days, but a prompt is a request: models
 * routinely return 4 or 5 when asked for 3, and nothing downstream checked.
 * A user who said "I can train 3 days" was handed a 5-day split and
 * reasonably concluded the app had ignored them.
 *
 * Repair rather than reject. A plan with the wrong day count is still full
 * of good work, and failing generation over it would drop the user to the
 * generic fallback template — strictly worse than reshaping.
 *   too many days -> keep the first N (days are ordered hardest-first)
 *   too few days  -> cycle the returned days until N, numbering the repeats
 *                    so a duplicated name doesn't read as a bug
 *
 * Returns the SAME object when nothing needs changing, so callers can cheaply
 * detect whether a correction happened.
 */
function enforceDayCount(plan, { trainingDaysPerWeek } = {}) {
  const wanted = trainingDaysPerWeek;
  const days = Array.isArray(plan?.days) ? plan.days : null;
  if (!wanted || !days?.length || days.length === wanted) return plan;

  if (days.length > wanted) {
    return { ...plan, days: days.slice(0, wanted) };
  }

  const filled = Array.from({ length: wanted }, (_, i) => {
    const src = days[i % days.length];
    const pass = Math.floor(i / days.length);
    return pass === 0 ? src : { ...src, name: `${src.name} ${pass + 1}` };
  });
  return { ...plan, days: filled };
}

module.exports = { enforceDayCount };
