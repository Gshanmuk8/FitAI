/**
 * End-to-end product smoke test. Boots a REAL embedded Postgres, runs all
 * four migrations from scratch, then walks the entire user journey through
 * the actual service layer with ZERO AI keys configured:
 *
 *   onboarding -> plan (fallback template + deterministic diet/timeframe)
 *   -> today's checklist from the plan -> meal diary + protein auto-check
 *   -> weigh-ins -> progress report (pace, snapshot, achievements)
 *   -> plan edit + preference learning + behavior memory
 *   -> weekly review -> tutor fallback -> HTTP /health + auth rejection.
 *
 * Run: node scripts/smoke-test.js   (dev-only; uses devDependency embedded-postgres)
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PORT = 54329;
const DB_NAME = 'fitai_smoke';
const DATA_DIR = path.join(__dirname, '..', '.pgdata-smoke');

// Env must be set BEFORE any server module is required.
process.env.DATABASE_URL = `postgresql://postgres:password@localhost:${PORT}/${DB_NAME}`;
process.env.SUPABASE_URL = 'https://your-project.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'your-service-role-key';
process.env.NODE_ENV = 'development';
// The whole point is exercising the KEYLESS path (fallbacks, never blank
// screens) — a developer's .env with real provider keys must not leak in,
// or "keyless -> template plan" turns into a live AI call and fails.
// Placeholders (not deletes): dotenv only fills ABSENT vars, so a deleted
// key would be re-populated from .env; a "your-*" placeholder wins and is
// treated as unconfigured by config/env's isPlaceholder().
for (const key of [
  'GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'CEREBRAS_API_KEY',
  'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN',
]) {
  process.env[key] = 'your-placeholder';
}

let passed = 0;
function step(name) {
  passed += 1;
  console.log(`  ✔ ${String(passed).padStart(2)}. ${name}`);
}

async function main() {
  const EmbeddedPostgres = require('embedded-postgres');
  const PgClass = EmbeddedPostgres.default || EmbeddedPostgres;
  const epg = new PgClass({
    databaseDir: DATA_DIR,
    user: 'postgres',
    password: 'password',
    port: PORT,
    persistent: false,
  });

  console.log('Starting embedded Postgres…');
  await epg.initialise();
  await epg.start();
  await epg.createDatabase(DB_NAME);

  try {
    await run(epg);
    console.log(`\nSMOKE TEST PASSED — ${passed} steps green.`);
  } finally {
    const { pool } = require('../server/src/config/db');
    await pool.end().catch(() => {});
    await epg.stop().catch(() => {});
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }
}

async function run(epg) {
  const { pool } = require('../server/src/config/db');

  // ---- migrations from scratch ----
  const migrationsDir = path.join(__dirname, '..', 'server', 'migrations');
  for (const file of fs.readdirSync(migrationsDir).sort()) {
    await pool.query(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
  step(`all ${fs.readdirSync(migrationsDir).length} migrations apply cleanly on an empty database`);

  // ---- a user signs up (auth shim stands in for Supabase auth) ----
  const { rows: [user] } = await pool.query(
    `INSERT INTO auth.users (email) VALUES ('smoke@test.local') RETURNING id`
  );
  const userId = user.id;
  step('user created');

  // ---- onboarding ----
  const { upsertProfile, savePlan, getProfile } = require('../server/src/models/UserProfile');
  const { generateUserPlan, syncUserState, generationInputFromProfileRow } = require('../server/src/services/workout/planService');

  const profileRow = await upsertProfile(userId, {
    age: 30, heightCm: 180, weightKg: 90, targetWeightKg: 80,
    goal: 'lose_fat', activityLevel: 'moderately_active',
    injuries: '', dietaryRestrictions: 'vegetarian',
    gymAvailability: 'gym', sex: 'male', timeframeWeeks: 6, // unsafely fast on purpose
    trainingDaysPerWeek: 4, trainingStyle: 'powerlifting 3 days, yoga on rest days',
  });
  assert.equal(profileRow.training_days_per_week, 4, 'training days persisted');
  assert.equal(profileRow.training_style, 'powerlifting 3 days, yoga on rest days', 'training style persisted');
  const plan = await generateUserPlan(generationInputFromProfileRow(userId, profileRow));
  await savePlan(userId, plan, { restartClock: true });
  await syncUserState(userId, plan, 'lose_fat');

  assert.ok(plan.days?.length >= 1, 'plan has workout days');
  assert.equal(plan.source, 'fallback', 'keyless -> template plan');
  assert.equal(plan.timeframe.adjusted, true, 'unsafe 6-week request was clamped');
  assert.equal(plan.timeframe.weeks, 10, '10kg at max 1kg/wk -> 10 weeks');
  // BMR(male,30y,180cm,90kg)=1880; TDEE=1880*1.55=2914; lose_fat -500 = 2414
  assert.equal(plan.diet.calorieTarget, 2414, 'diet layer is exact rules-engine math');
  assert.ok(plan.roadmap.length >= 1, 'roadmap checkpoints exist');
  step('onboarding: fallback plan + safety-clamped timeframe + deterministic diet');

  const saved = await getProfile(userId);
  assert.ok(saved.plan_started_at, 'goal clock started');
  assert.ok(saved.ai_plan.days, 'plan persisted as jsonb');
  step('plan persisted, goal clock running');

  // ---- today's mission, generated from the plan ----
  const { getTodayEnriched } = require('../server/src/services/checklist/checklistService');
  const checklist = await getTodayEnriched(userId);
  assert.ok(checklist.plan_snapshot, 'plan snapshot frozen into today');
  assert.ok(['workout', 'rest'].includes(checklist.plan_snapshot.workout.type));
  assert.equal(checklist.plan_snapshot.targets.calorieTarget, 2414, 'checklist targets come from the live plan');
  const proteinItem = checklist.items.find((i) => i.field === 'protein_completed');
  assert.match(proteinItem.label, /Protein: \d+g/, 'concrete protein label');
  step(`daily mission built from plan (today: ${checklist.plan_snapshot.workout.type}, ${proteinItem.label})`);

  const again = await getTodayEnriched(userId);
  assert.equal(again.id, checklist.id, 'same day -> same row, no duplicates');
  step('checklist is idempotent within the day');

  // ---- user-authored mission items ----
  const { addCustomItem, setCustomItemDone, removeCustomItem, setChecklistValues } =
    require('../server/src/services/checklist/checklistService');
  let withCustom = await addCustomItem(userId, '20 min yoga');
  await addCustomItem(userId, 'no sugar today');
  withCustom = await getTodayEnriched(userId);
  assert.equal(withCustom.custom_items.length, 2, 'two custom items on today\'s row');
  const yoga = withCustom.custom_items.find((i) => i.label === '20 min yoga');
  const ticked = await setCustomItemDone(userId, yoga.id, true);
  assert.equal(ticked.custom_items.find((i) => i.id === yoga.id).done, true, 'custom item ticked');
  const sugar = ticked.custom_items.find((i) => i.label === 'no sugar today');
  const afterRemove = await removeCustomItem(userId, sugar.id);
  assert.equal(afterRemove.custom_items.length, 1, 'custom item removed');
  await assert.rejects(() => setCustomItemDone(userId, 'not-a-real-id', true), /not found/i, 'unknown id -> 404 error');
  step('custom mission items: add, tick, remove, unknown-id rejected');

  // ---- meal diary + protein/calories auto-check ----
  const { addMealAndSync, removeMealAndSync, getTodaySummary } = require('../server/src/services/nutrition/mealDiaryService');
  await addMealAndSync(userId, { name: 'Paneer bowl', calories: 650, protein: 45, source: 'manual' });
  let summary = await getTodaySummary(userId);
  assert.equal(summary.calories, 650);
  assert.equal(summary.proteinTargetHit, false, 'target (160g = 90kg*1.8 rounded to 5) not hit yet');

  // sync is awaited inside addMealAndSync — the returned summary is post-sync
  const { meal: shake } = await addMealAndSync(userId, { name: 'Protein shake x3', calories: 900, protein: 125, source: 'manual' });
  summary = await getTodaySummary(userId);
  assert.equal(summary.proteinTargetHit, true, '170g >= 165g target');
  assert.equal(summary.proteinCompleted, true, 'checklist item auto-checked');
  let mealRow = await getTodayEnriched(userId);
  assert.equal(Number(mealRow.calories_kcal), 1550, 'diary calories synced into the checklist as a value');
  assert.equal(mealRow.calories_completed, true, '1550 kcal is within a 2414 kcal cut budget -> on track');
  // manual toggle parity: calories is a first-class checklist field — the
  // model whitelist must accept it like the original five.
  const { updateChecklistItem: toggleField } = require('../server/src/models/DailyChecklist');
  const toggledOff = await toggleField(userId, 'calories_completed', false, mealRow.userDate ?? null);
  assert.equal(toggledOff.calories_completed, false, 'calories tick toggles off by hand');
  await toggleField(userId, 'calories_completed', true, mealRow.userDate ?? null);
  step('meal diary tallies and auto-checks protein + calories (tick toggles by hand too)');

  // deleting a meal re-syncs DOWNWARD: totals drop and a no-longer-met
  // target's checkmark comes off — number and checkbox never disagree.
  summary = await removeMealAndSync(userId, shake.id);
  assert.equal(summary.protein, 45, 'protein total re-synced down after delete');
  mealRow = await getTodayEnriched(userId);
  assert.equal(Number(mealRow.protein_grams), 45, 'checklist value follows the diary down');
  assert.equal(mealRow.protein_completed, false, 'checkmark comes OFF when the total falls below target');
  // restore the shake so the rest of the journey keeps its 170g day
  await addMealAndSync(userId, { name: 'Protein shake x3', calories: 900, protein: 125, source: 'manual' });
  step('deleting a meal re-syncs values and checkmarks downward');

  // ---- workout logging ----
  const { logSet } = require('../server/src/models/WorkoutLog');
  await logSet({ userId, exerciseName: 'Squat', weightKg: 60, reps: 8, setNumber: 1, completedAllReps: true });
  const { suggestNextLoad } = require('../server/src/services/workout/progressionService');
  const suggestion = await suggestNextLoad(userId, 'Squat', { min: 8, max: 12 });
  assert.ok(suggestion.weightKg != null && suggestion.note, 'progression suggestion from real log');
  step(`workout logged, progression says: ${suggestion.weightKg}kg — "${suggestion.note}"`);

  // ---- plan edit + preference learning ----
  const { applyPlanEdit } = require('../server/src/services/workout/planEditingService');
  const removed = saved.ai_plan.days[0].exercises[0].name;
  const editedDays = saved.ai_plan.days.map((d, i) =>
    i === 0 ? { ...d, exercises: d.exercises.slice(1).length ? d.exercises.slice(1) : d.exercises } : d
  );
  const { plan: editedPlan } = await applyPlanEdit(userId, { days: editedDays, diet: { proteinGrams: 150 } });
  assert.equal(editedPlan.customized, true);
  assert.equal(editedPlan.diet.proteinGrams, 150, 'diet override merged');
  await new Promise((r) => setTimeout(r, 300)); // learning is fire-and-forget
  const { rows: prefs } = await pool.query(
    `SELECT * FROM user_exercise_preferences WHERE user_id = $1`, [userId]
  );
  assert.ok(prefs.some((p) => p.exercise_name === removed.toLowerCase() && p.sentiment === 'disliked'),
    'removed exercise learned as disliked');
  const stillStarted = await getProfile(userId);
  assert.equal(String(stillStarted.plan_started_at), String(saved.plan_started_at), 'edit did NOT restart goal clock');
  step(`plan edited: "${removed}" learned as disliked, diet override saved, goal clock untouched`);

  // ---- plan change propagates to TODAY immediately (no midnight wait) ----
  const refreshed = await getTodayEnriched(userId);
  assert.equal(refreshed.plan_snapshot.targets.proteinGrams, 150, 'today\'s frozen snapshot now carries the edited target');
  assert.equal(refreshed.protein_completed, true, 'protein completion re-derived against the NEW target (170g >= 150g)');
  const refreshedProteinItem = refreshed.items.find((i) => i.field === 'protein_completed');
  assert.match(refreshedProteinItem.label, /Protein: 150g/, 'mission label shows the new target');
  assert.equal(refreshed.custom_items.length, 1, 'user\'s own items survive the plan change');
  assert.ok(refreshed.protein_grams != null, 'logged values survive the plan change');
  step('plan edit updates today\'s mission in place — user data and history untouched');

  // ---- AI progress analysis: keyless -> honest fallback over real data ----
  await setChecklistValues(userId, { weight_kg: 89.4 });
  const { getProgress } = require('../server/src/services/progress/progressAnalysisService');
  const progress = await getProgress(userId);
  assert.equal(progress.analysis.source, 'fallback', 'keyless -> fallback analysis');
  assert.ok(progress.data.weighIns.length >= 1 && progress.data.weighIns[0].kg === 89.4, 'weigh-in flows from checklist into progress data');
  assert.ok(progress.data.training.length >= 1, 'logged sets appear in training summary');
  assert.ok(progress.data.nutrition.length >= 1, 'meals appear in nutrition summary');
  assert.ok(progress.data.checklist.length >= 1, 'raw checklist log feeds the analysis (no precomputed adherence)');
  assert.ok(progress.data.checklist.every((d) => typeof d.workout === 'boolean'), 'checklist rows carry raw per-item booleans');
  assert.ok(progress.data.customItems.some((i) => i.label === '20 min yoga' && i.done), 'custom habits feed the analysis data');
  assert.ok(!JSON.stringify(progress.analysis).match(/gemini|groq|cerebras|openrouter|cloudflare/i), 'provider names never leak');
  const { rows: analysisRows } = await pool.query(`SELECT * FROM progress_analyses WHERE user_id = $1`, [userId]);
  assert.equal(analysisRows.length, 0, 'fallback analysis is NOT persisted (must refresh when AI is back)');
  step('progress: AI-analysis pipeline assembles the full journey; keyless degrades honestly');

  // ---- last-known-good: once ANY real analysis exists, an outage serves
  // it marked stale — the template fallback must never shadow real words ----
  const ProgressAnalysis = require('../server/src/models/ProgressAnalysis');
  await ProgressAnalysis.upsertToday(userId, {
    analysis: {
      status: 'on_track', summary: 'REAL WORDS from the last reachable run',
      weightTrend: 'w', trainingAnalysis: 't', nutritionAnalysis: 'n',
      wins: [], risks: [], recommendations: [], stats: [], charts: [], source: 'ai',
    },
    inputHash: 'outdated-hash',
  });
  // New data -> new hash, bypassing the outage memo — steps, NOT weight,
  // because later steps assert today's 89.4 weigh-in survives untouched.
  await setChecklistValues(userId, { steps_count: 4321 });
  const progressStale = await getProgress(userId);
  assert.equal(progressStale.stale, true, 'outage + stored analysis -> served stale, not template');
  assert.equal(progressStale.analysis.summary, 'REAL WORDS from the last reachable run', 'the stored analysis is what renders');
  assert.ok(progressStale.staleDate, 'stale result says which day it came from');
  step('provider outage serves the last REAL analysis marked stale — never a template');

  // ---- memory: system rows exist, retrieval is importance-first ----
  const { getRecentConversationalMemory } = require('../server/src/services/memory/memoryRetriever');
  const memories = await getRecentConversationalMemory(userId);
  assert.ok(memories.some((m) => m.category === 'behavior'), 'plan edit wrote a behavior memory');
  step(`long-term memory populated by the system (${memories.length} entries, categorized)`);

  // ---- the coach's live activity view: measured from real logs ----
  const { buildActivitySnapshot } = require('../server/src/services/analytics/activitySnapshot');
  const activity = await buildActivitySnapshot(userId);
  assert.ok(activity.recentWeighIns.length >= 1 && activity.recentWeighIns[0].kg === 89.4, 'coach sees the weigh-in');
  assert.ok(activity.training14d.sessions >= 1 && activity.training14d.sets >= 1, 'coach sees training reality');
  assert.ok(activity.nutrition7d.daysLogged >= 1 && activity.nutrition7d.avgProtein > 0, 'coach sees nutrition reality');
  const { buildTutorPrompt: buildTutorPromptForBlock } = require('../shared/prompts/templates');
  const promptWithActivity = buildTutorPromptForBlock({ mode: 'gym', profile: {}, question: 'test', activity });
  assert.match(promptWithActivity, /Their recent activity/, 'activity block lands in the coach prompt');
  step('coach chat is grounded in the user\'s measured activity (weigh-ins, training, nutrition)');

  // ---- tutor, keyless -> safe fallback with provider hidden ----
  const { buildContextForUser } = require('../server/src/services/memory/contextBuilder');
  const { buildTutorPrompt } = require('../shared/prompts/templates');
  const { askTutor } = require('../server/src/services/ai/aiOrchestrator');
  const ctx = await buildContextForUser(userId);
  assert.ok(ctx.profile.dislikedExercises === undefined || Array.isArray(ctx.profile.dislikedExercises));
  const tutorRes = await askTutor({
    mode: 'gym', question: 'How heavy should I squat?', profile: ctx.profile,
    recentMemorySummaries: ctx.recentMemorySummaries,
    prompt: buildTutorPrompt({ mode: 'gym', profile: ctx.profile, recentMemorySummaries: ctx.recentMemorySummaries, question: 'How heavy should I squat?' }),
  });
  assert.equal(tutorRes.source, 'fallback', 'no providers -> fallback');
  assert.ok(tutorRes.answer.length > 10, 'usable answer, never a blank');
  assert.ok(!JSON.stringify(tutorRes).match(/gemini|groq|cerebras|openrouter|cloudflare/i), 'provider names never leak');
  step('tutor answers keyless via fallback, provider identity hidden');

  // ---- timezone-aware "today" ----
  const { localDateInZone } = require('../server/src/utils/userDate');
  const east = localDateInZone('Pacific/Kiritimati'); // UTC+14
  const west = localDateInZone('Pacific/Midway'); // UTC-11
  assert.match(east, /^\d{4}-\d{2}-\d{2}$/);
  assert.notEqual(east, west, '25h apart -> different calendar days, always');
  assert.equal(localDateInZone('Not/AZone'), null, 'bad tz -> null -> server-date fallback');
  assert.equal(localDateInZone(null), null, 'no tz -> pre-004 behavior');
  step('user-local date resolution (rollover at the user\'s midnight, safe fallbacks)');

  // ---- real HTTP layer ----
  const app = require('../server/src/app');
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://localhost:${server.address().port}`;
  const health = await (await fetch(`${base}/health`)).json();
  assert.equal(health.status, 'ok');
  assert.equal(health.database, 'ok');
  const unauth = await fetch(`${base}/api/plan`);
  assert.equal(unauth.status, 401, 'protected route rejects missing token');
  await new Promise((resolve) => server.close(resolve));
  step('HTTP: /health reports db ok; protected routes reject unauthenticated requests');
}

main().catch((err) => {
  console.error('\nSMOKE TEST FAILED:', err);
  process.exit(1);
});
