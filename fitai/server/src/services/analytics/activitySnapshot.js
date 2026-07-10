/**
 * A compact, token-bounded digest of the user's recent logged activity —
 * what the coach chat reads so it "sees" every move (weigh-ins, training,
 * meals, adherence) without dragging the full 90-day journey into every
 * message. Deliberately small: a handful of numbers, not row dumps —
 * chat happens many times a day and each token here is paid on every send.
 *
 * All figures are measured from the user's own records via three indexed
 * queries; nothing here is estimated or invented.
 */
const { getHistory } = require('../../models/DailyChecklist');
const { trainingDaySummary } = require('../../models/WorkoutLog');
const { dailyTotalsRecent } = require('../../models/Meal');
const { adherenceFrom, ymd } = require('./adherence');
const { getUserToday } = require('../../utils/userDate');

async function buildActivitySnapshot(userId) {
  const userDate = (await getUserToday(userId)) || ymd(new Date());
  const [history, training, nutrition] = await Promise.all([
    getHistory(userId, 28),
    trainingDaySummary(userId, 14),
    dailyTotalsRecent(userId, 7),
  ]);

  const weighIns = history
    .filter((r) => r.weight_kg != null)
    .slice(0, 5) // history is date-DESC: the 5 most recent
    .map((r) => ({ date: ymd(r.date), kg: Number(r.weight_kg) }))
    .reverse();

  const totalSets = training.reduce((s, t) => s + t.sets, 0);
  const totalVolumeKg = Math.round(training.reduce((s, t) => s + Number(t.volume_kg || 0), 0));

  const nutritionDays = nutrition.length;
  const avg = (key) => (nutritionDays ? Math.round(nutrition.reduce((s, n) => s + Number(n[key] || 0), 0) / nutritionDays) : null);

  return {
    date: userDate,
    adherence: adherenceFrom(history, userDate),
    recentWeighIns: weighIns,
    training14d: { sessions: training.length, sets: totalSets, volumeKg: totalVolumeKg },
    nutrition7d: { daysLogged: nutritionDays, avgCalories: avg('calories'), avgProtein: avg('protein') },
  };
}

module.exports = { buildActivitySnapshot };
