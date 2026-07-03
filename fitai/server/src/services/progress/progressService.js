/**
 * The intelligent progress report. Recomputed at most once per 24h
 * (lazily, on the first GET of the day) and persisted as an immutable
 * daily snapshot; a fresh weigh-in invalidates today's snapshot so the
 * card updates immediately after new data.
 *
 * Every number here is deterministic math over the user's own records —
 * the AI never touches this path, which is why the dashboard can promise
 * "ahead/on-track/behind" with a straight face and zero API keys.
 */
const { getProfile } = require('../../models/UserProfile');
const BodyWeightLog = require('../../models/BodyWeightLog');
const Snapshot = require('../../models/ProgressSnapshot');
const { getHistory } = require('../../models/DailyChecklist');
const { countDistinctWorkoutDays } = require('../../models/WorkoutLog');
const { awardMany } = require('../../models/Achievement');
const { recordSystemMemory } = require('../memory/memoryWriter');
const { localDateInZone } = require('../../utils/userDate');
const { FLAGS } = require('../../config/featureFlags');
const logger = require('../../utils/logger');
const {
  weeksBetween,
  expectedWeightAt,
  expectedWeeklyRateKg,
  actualWeeklyRateKg,
  movingAverage,
  paceStatus,
  projectedWeeksToTarget,
  checklistStreaks,
} = require('../../../../shared/calculations/paceTracking');
const { evaluateAchievements, goalProgressFraction } = require('../../../../shared/calculations/achievements');

async function getProgressReport(userId) {
  const profile = await getProfile(userId);
  if (!profile) return null;
  // "Today" is the user's day (their timezone), not the server's.
  const userDate = localDateInZone(profile.timezone);

  if (FLAGS.progressSnapshots) {
    const existing = await Snapshot.getToday(userId, userDate);
    if (existing) return { ...existing.metrics, snapshotDate: existing.date, fresh: false };
  }

  const metrics = await computeMetrics(userId, profile, userDate);

  if (FLAGS.progressSnapshots) {
    const stored = await Snapshot.insertToday(userId, metrics, userDate);
    // Side effects only on the request that actually computed today's
    // snapshot — pace-change memories and achievements fire once per day.
    await recordPaceChange(userId, metrics, userDate).catch((err) =>
      logger.error('pace-change memory failed', { error: err.message })
    );
    if (FLAGS.achievements) {
      metrics.newAchievements = await evaluateAndAward(userId, metrics).catch((err) => {
        logger.error('achievement evaluation failed', { error: err.message });
        return [];
      });
    }
    return { ...(stored?.metrics || metrics), newAchievements: metrics.newAchievements || [], snapshotDate: stored?.date, fresh: true };
  }
  return { ...metrics, fresh: true };
}

async function computeMetrics(userId, profile, userDate) {

  const plan = profile.ai_plan
    ? typeof profile.ai_plan === 'string' ? JSON.parse(profile.ai_plan) : profile.ai_plan
    : null;

  const [weightLogs, history, workoutDayCount] = await Promise.all([
    BodyWeightLog.listRecent(userId, 180),
    getHistory(userId, 28),
    countDistinctWorkoutDays(userId),
  ]);

  const startWeightKg = profile.weight_kg != null ? Number(profile.weight_kg) : null;
  const targetWeightKg = profile.target_weight_kg != null ? Number(profile.target_weight_kg) : null;
  // The plan's timeframe is safety-clamped at generation; the profile
  // column holds the raw request — clamped wins.
  const timeframeWeeks = plan?.timeframe?.weeks || profile.timeframe_weeks || 12;
  const planStartedAt = profile.plan_started_at || profile.updated_at;
  const goal = profile.goal;

  const now = userDate ? new Date(`${userDate}T12:00:00`) : new Date();
  const weeksElapsed = Number(weeksBetween(planStartedAt, now).toFixed(1));
  const weeksRemaining = Math.max(0, Number((timeframeWeeks - weeksElapsed).toFixed(1)));
  const targetDate = planStartedAt
    ? new Date(new Date(planStartedAt).getTime() + timeframeWeeks * 7 * 86400000).toISOString().slice(0, 10)
    : null;

  const currentWeightKg = weightLogs.length ? weightLogs[weightLogs.length - 1].weight_kg : startWeightKg;
  const expectedWeightNow = expectedWeightAt({ startWeightKg, targetWeightKg, timeframeWeeks, weeksElapsed });
  const actualRate = actualWeeklyRateKg(weightLogs);

  const adherence = computeAdherence(history);
  const streaks = checklistStreaks(history, { today: now });

  const pace = paceStatus({
    goal,
    expectedWeightNow,
    currentWeightKg: weightLogs.length ? currentWeightKg : null, // profile weight is a start point, not a measurement
    adherenceRatio: adherence.last28,
  });

  const projected = projectedWeeksToTarget({ currentWeightKg, targetWeightKg, actualRateKgPerWeek: actualRate });
  const { riskLevel, explanations, recommendations } = explainPace({ pace, adherence, weeksRemaining, projected, weightLogCount: weightLogs.length });

  const avg = movingAverage(weightLogs.map((l) => l.weight_kg), 7);
  const progressFraction = goalProgressFraction({ startWeightKg, targetWeightKg, currentWeightKg });

  return {
    computedAt: now.toISOString(),
    goal: { type: goal, startWeightKg, targetWeightKg, timeframeWeeks, planStartedAt, targetDate },
    timeline: {
      weeksElapsed,
      weeksRemaining,
      percentTimeElapsed: Math.min(100, Math.round((weeksElapsed / timeframeWeeks) * 100)),
    },
    weight: {
      currentKg: currentWeightKg,
      totalChangeKg: weightLogs.length && startWeightKg != null ? Number((currentWeightKg - startWeightKg).toFixed(1)) : null,
      logCount: weightLogs.length,
      trend: weightLogs.map((l, i) => ({ date: l.date, weightKg: l.weight_kg, avg7: avg[i] })),
    },
    expected: { weightNowKg: expectedWeightNow, weeklyRateKg: expectedWeeklyRateKg(goal) },
    actual: { weeklyRateKg: actualRate },
    pace: { ...pace, riskLevel, projectedWeeksToTarget: projected, explanations, recommendations },
    adherence,
    streaks,
    progressPercent: progressFraction != null ? Math.min(100, Math.round(progressFraction * 100)) : null,
    stats: { workoutDayCount },
    roadmap: plan?.roadmap || [],
  };
}

function ratio(history, field) {
  if (!history.length) return null;
  return Number((history.filter((d) => d[field]).length / history.length).toFixed(2));
}

function computeAdherence(history) {
  const last7 = history.slice(0, 7);
  const overall = (rows) => {
    if (!rows.length) return null;
    const fields = ['workout_completed', 'protein_completed', 'water_completed', 'sleep_completed', 'steps_completed'];
    const total = rows.reduce((sum, d) => sum + fields.filter((f) => d[f]).length, 0);
    return Number((total / (rows.length * fields.length)).toFixed(2));
  };
  const sleepScore = ratio(history, 'sleep_completed');
  const highSoreness = history.filter((d) => /high|severe/i.test(d.soreness_level || '')).length;
  return {
    last7: overall(last7),
    last28: overall(history),
    workoutConsistency: ratio(history, 'workout_completed'),
    nutritionConsistency: ratio(history, 'protein_completed'),
    sleepScore,
    recoveryScore:
      sleepScore == null
        ? null
        : Number((sleepScore * 0.7 + (1 - (history.length ? highSoreness / history.length : 0)) * 0.3).toFixed(2)),
  };
}

// "If behind — explain why, provide recommendations." Deterministic:
// the explanation is read off the adherence components, worst first.
function explainPace({ pace, adherence, weeksRemaining, projected, weightLogCount }) {
  const explanations = [];
  const recommendations = [];

  if (pace.status === 'no_data' && weightLogCount < 2) {
    recommendations.push('Log your body weight a few times a week — pace tracking needs at least two weigh-ins a few days apart.');
  }

  if (pace.status === 'behind') {
    if (adherence.workoutConsistency != null && adherence.workoutConsistency < 0.7) {
      explanations.push(`Workouts are being completed only ${Math.round(adherence.workoutConsistency * 100)}% of days.`);
      recommendations.push('Protect your scheduled training days — consistency moves the needle more than intensity.');
    }
    if (adherence.nutritionConsistency != null && adherence.nutritionConsistency < 0.7) {
      explanations.push(`The protein/nutrition target is hit only ${Math.round(adherence.nutritionConsistency * 100)}% of days.`);
      recommendations.push('Plan protein first at each meal; the calorie target follows much more easily.');
    }
    if (adherence.sleepScore != null && adherence.sleepScore < 0.6) {
      explanations.push(`Sleep target met only ${Math.round(adherence.sleepScore * 100)}% of days — recovery drives results.`);
      recommendations.push('Set a fixed wind-down time; poor sleep quietly stalls both fat loss and muscle gain.');
    }
    if (!explanations.length) {
      explanations.push('Adherence looks fine — the plan\'s pace may simply be aggressive for your body right now.');
      recommendations.push('Consider extending the timeframe or adjusting the calorie target in the plan editor.');
    }
  }

  let riskLevel = 'low';
  if (pace.status === 'behind') {
    riskLevel = weeksRemaining <= 2 || (projected != null && projected > weeksRemaining * 1.5) ? 'high' : 'medium';
  }
  return { riskLevel, explanations, recommendations };
}

async function evaluateAndAward(userId, metrics) {
  const weighInCount = await BodyWeightLog.countForUser(userId);
  const earned = evaluateAchievements({
    workoutDayCount: metrics.stats.workoutDayCount,
    weighInCount,
    bestStreak: metrics.streaks.best,
    startWeightKg: metrics.goal.startWeightKg,
    targetWeightKg: metrics.goal.targetWeightKg,
    currentWeightKg: metrics.weight.logCount ? metrics.weight.currentKg : null,
  });
  const newlyUnlocked = await awardMany(userId, earned);
  for (const a of newlyUnlocked) {
    await recordSystemMemory(userId, {
      summary: `User unlocked achievement: ${a.name}.`,
      category: 'progress',
      importance: 1,
    });
  }
  return newlyUnlocked;
}

// The tutor should "notice" pace shifts — a status change writes a
// progress memory the context builder will surface in future chats.
async function recordPaceChange(userId, metrics, userDate = null) {
  const previous = await Snapshot.getPrevious(userId, userDate);
  const prevStatus = previous?.metrics?.pace?.status;
  const newStatus = metrics.pace.status;
  if (prevStatus && prevStatus !== newStatus && newStatus !== 'no_data' && prevStatus !== 'no_data') {
    await recordSystemMemory(userId, {
      summary: `User's progress pace changed from ${prevStatus} to ${newStatus} on their ${metrics.goal.type} goal.`,
      category: 'progress',
      importance: 2,
    });
  }
}

async function logWeight(userId, weightKg) {
  const profile = await getProfile(userId);
  const userDate = localDateInZone(profile?.timezone);
  const entry = await BodyWeightLog.upsertToday(userId, weightKg, userDate);
  await Snapshot.invalidateToday(userId, userDate); // new data -> today's report is stale
  return entry;
}

module.exports = { getProgressReport, logWeight };
