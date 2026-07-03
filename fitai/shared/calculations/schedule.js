/**
 * Maps a plan's workout days onto the calendar week, deterministically.
 * A 3-day plan becomes e.g. Mon/Wed/Fri with rest days between — the same
 * plan always yields the same weekly layout, so "today's mission" is
 * stable across requests and across server restarts. Pure functions only.
 */

const DAYS_PER_WEEK = 7;
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Distributes N workout days evenly across a Monday-first week using the
 * same even-spacing idea as Bresenham's line algorithm. Returns an array
 * of 7 slots (index 0 = Monday) of { type: 'workout', day } | { type: 'rest' }.
 */
function weeklySchedule(planDays) {
  const days = Array.isArray(planDays) ? planDays.slice(0, DAYS_PER_WEEK) : [];
  const slots = new Array(DAYS_PER_WEEK).fill(null).map(() => ({ type: 'rest' }));
  const n = days.length;
  if (n === 0) return slots;

  for (let i = 0; i < n; i++) {
    const slotIndex = Math.floor((i * DAYS_PER_WEEK) / n);
    slots[slotIndex] = { type: 'workout', day: days[i] };
  }
  return slots;
}

/**
 * What the plan says today is: a specific workout day or a rest day.
 * `date` is Monday-first indexed into weeklySchedule.
 */
function todaysPlanEntry(planDays, date = new Date()) {
  const schedule = weeklySchedule(planDays);
  const mondayFirstIndex = (new Date(date).getDay() + 6) % 7; // JS Sunday=0 -> Monday=0
  const entry = schedule[mondayFirstIndex];
  return {
    ...entry,
    weekday: WEEKDAY_NAMES[new Date(date).getDay()],
  };
}

module.exports = { weeklySchedule, todaysPlanEntry, WEEKDAY_NAMES };
