/**
 * Weekly and monthly reviews, generated lazily: the first request after a
 * period completes computes deterministic stats for that period, asks the
 * AI cascade for a coaching narrative around them (deterministic template
 * if no provider answers), and persists the result immutably. No cron
 * needed — "every week automatically" is satisfied by generate-on-read,
 * which also works on serverless/spun-down deployments.
 */
const Review = require('../../models/Review');
const { getRange } = require('../../models/DailyChecklist');
const { statsBetween } = require('../../models/WorkoutLog');
const { listBetween } = require('../../models/BodyWeightLog');
const { getProfile } = require('../../models/UserProfile');
const { generateReviewNarrative } = require('../ai/aiOrchestrator');
const { buildReviewNarrativePrompt } = require('../../../../shared/prompts/templates');

const DAY_MS = 24 * 60 * 60 * 1000;
const iso = (d) => d.toISOString().slice(0, 10);

// Last completed Mon–Sun week strictly before today.
function lastCompletedWeek(now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const mondayFirstIndex = (today.getDay() + 6) % 7; // Mon=0
  const thisMonday = new Date(today.getTime() - mondayFirstIndex * DAY_MS);
  const periodEnd = new Date(thisMonday.getTime() - DAY_MS); // last Sunday
  const periodStart = new Date(periodEnd.getTime() - 6 * DAY_MS);
  return { periodStart: iso(periodStart), periodEnd: iso(periodEnd) };
}

// Previous calendar month.
function lastCompletedMonth(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { periodStart: iso(start), periodEnd: iso(end) };
}

async function computeStats(userId, periodStart, periodEnd) {
  const [checklists, workouts, weights] = await Promise.all([
    getRange(userId, periodStart, periodEnd),
    statsBetween(userId, periodStart, periodEnd),
    listBetween(userId, periodStart, periodEnd),
  ]);

  const fields = ['workout_completed', 'protein_completed', 'water_completed', 'sleep_completed', 'steps_completed'];
  const daysTracked = checklists.length;
  const totalChecks = checklists.reduce((sum, d) => sum + fields.filter((f) => d[f]).length, 0);

  return {
    periodStart,
    periodEnd,
    daysTracked,
    adherence: daysTracked ? Number((totalChecks / (daysTracked * fields.length)).toFixed(2)) : null,
    workoutsCompleted: checklists.filter((d) => d.workout_completed).length,
    proteinDaysHit: checklists.filter((d) => d.protein_completed).length,
    sleepDaysHit: checklists.filter((d) => d.sleep_completed).length,
    trainingDaysLogged: workouts.workout_days,
    totalSets: workouts.total_sets,
    totalVolumeKg: Math.round(workouts.total_volume_kg),
    weightChangeKg:
      weights.length >= 2 ? Number((weights[weights.length - 1].weight_kg - weights[0].weight_kg).toFixed(1)) : null,
    weighIns: weights.length,
  };
}

async function getOrGenerateReview(userId, periodType) {
  const { periodStart, periodEnd } =
    periodType === 'monthly' ? lastCompletedMonth() : lastCompletedWeek();

  const existing = await Review.getReview(userId, periodType, periodStart);
  if (existing) return existing;

  const stats = await computeStats(userId, periodStart, periodEnd);

  // A period with no data at all gets a stub review rather than an AI call
  // about nothing — still persisted so we don't recompute on every request.
  let narrative;
  if (stats.daysTracked === 0 && stats.trainingDaysLogged === 0) {
    narrative = {
      headline: 'No activity recorded this period',
      wins: [],
      focusNext: ['Open the app daily and work the checklist — reviews get useful once there is data.'],
      recommendation: 'Start with the daily mission; the rest follows.',
    };
  } else {
    const profile = await getProfile(userId);
    narrative = await generateReviewNarrative({
      stats,
      userId,
      prompt: buildReviewNarrativePrompt({
        periodType,
        stats,
        profile: {
          age: profile?.age,
          goal: profile?.goal,
          activityLevel: profile?.activity_level,
        },
      }),
    });
  }

  return Review.insertReview(userId, { periodType, periodStart, periodEnd, data: stats, narrative });
}

module.exports = { getOrGenerateReview, lastCompletedWeek, lastCompletedMonth, computeStats };
