/**
 * The "living plan" rules: how yesterday's outcome reshapes today's
 * mission. Deterministic on purpose — adaptation must be explainable
 * ("why is today different?") and must work with zero AI providers.
 * The AI tutor layers coaching language on top; it never decides these.
 */

/**
 * entryToday / entryYesterday: output of schedule.todaysPlanEntry
 * yesterday: yesterday's daily_checklists row (or null on day one)
 * Returns { entry, intensity: 'normal'|'reduced', adaptations: [{code, message}] }.
 */
function adaptTodaysPlan({ entryToday, entryYesterday, yesterday }) {
  let entry = entryToday;
  const adaptations = [];
  let intensity = 'normal';

  const missedWorkoutYesterday =
    yesterday && entryYesterday?.type === 'workout' && yesterday.workout_completed === false;

  // Missed session + today is a rest day -> swap in the missed day so the
  // week's volume survives one slip. Never stack two workouts on one day.
  if (missedWorkoutYesterday && entryToday.type === 'rest') {
    entry = { ...entryYesterday, weekday: entryToday.weekday };
    adaptations.push({
      code: 'catch_up_workout',
      message: `Yesterday's ${entryYesterday.day?.name || 'workout'} was missed — moved to today instead of resting.`,
    });
  } else if (missedWorkoutYesterday) {
    adaptations.push({
      code: 'missed_workout',
      message: 'Yesterday\'s session was missed — stay on schedule today rather than doubling up.',
    });
  }

  // Poor sleep -> keep the session but pull intensity down.
  if (yesterday && yesterday.sleep_completed === false && entry.type === 'workout') {
    intensity = 'reduced';
    adaptations.push({
      code: 'reduced_intensity',
      message: 'Sleep target was missed — keep 1-2 reps in reserve and drop optional sets today.',
    });
  }

  // High soreness -> flag recovery emphasis (soreness_level is free text
  // set by the user; only obvious values trigger this).
  if (yesterday && /high|severe/i.test(yesterday.soreness_level || '') && entry.type === 'workout') {
    intensity = 'reduced';
    adaptations.push({
      code: 'soreness_caution',
      message: 'High soreness reported yesterday — warm up longer and stop any movement with sharp pain.',
    });
  }

  // A fully green day earns a progression nudge.
  const perfectYesterday =
    yesterday &&
    yesterday.workout_completed &&
    yesterday.protein_completed &&
    yesterday.water_completed &&
    yesterday.sleep_completed &&
    yesterday.steps_completed;
  if (perfectYesterday && entry.type === 'workout' && intensity === 'normal') {
    adaptations.push({
      code: 'progression_nudge',
      message: 'Perfect day yesterday — if last session felt easy, add 2.5kg or a rep on your main lifts.',
    });
  }

  return { entry, intensity, adaptations };
}

module.exports = { adaptTodaysPlan };
