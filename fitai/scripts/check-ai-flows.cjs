// Opt-in live-provider check. Fictional profiles and a public-domain photo only;
// no Supabase reads/writes. These checks do not establish nutritional accuracy.
// Never print credentials or response headers. Run: node scripts/check-ai-flows.cjs
const path = require("node:path");
require("dotenv").config({
  path: path.join(__dirname, "../server/.env"),
  quiet: true,
});
process.env.REDIS_URL = ""; // keep cache local; never write to hosted infrastructure
const logger = require("../server/src/utils/logger");
const events = [];
for (const level of ["info", "warn", "error", "debug"])
  logger[level] = (...args) => {
    const meta = args[1];
    for (const event of meta?.events || []) {
      events.push({
        event: event.name,
        provider: event.provider,
        outcome: event.error || event.errorClass,
        issues: event.issues,
        reason: String(event.message || "")
          .match(
            /HTTP \d{3}|\b[45]\d{2}\b|fetch failed|timeout|aborted|quota|rate limit|schema validation|invalid api key|invalid model|not found|empty response|no usable content|JSON|unexpected token/gi,
          )
          ?.join(", "),
        atMs: event.atMs,
      });
    }
  };
const ai = require("../server/src/services/ai/aiOrchestrator");
const prompts = require("../shared/prompts/templates");
const { fetchWithTimeout } = require("../server/src/services/ai/providerUtils");
const profile = {
  userId: "local-synthetic-qa",
  age: 28,
  sex: "other",
  heightCm: 175,
  weightKg: 75,
  goal: "maintain",
  activityLevel: "moderately_active",
  equipment: "minimal",
  injuries: [],
  dietaryRestrictions: "Vegetarian; peanut allergy",
  trainingDaysPerWeek: 3,
  trainingStyle: "Bodyweight strength",
  timeframeWeeks: 12,
  diet: {
    calorieTarget: 2400,
    maintenanceCalories: 2400,
    calorieDirection: "maintenance",
    calorieDelta: 0,
    proteinGrams: 140,
    waterMl: 2500,
    stepsTarget: 8000,
    sleepHours: 8,
  },
};
const data = {
  asOfDate: "2026-09-28",
  firstLoggedDate: null,
  goal: { type: "maintain", timeframeWeeks: 12, dietTargets: profile.diet },
  weighIns: [],
  adherence: { last7: null, last28: null, daysLogged: 0 },
  checklist: [],
  training: [],
  nutrition: [],
};
const cases = [
  [
    "plan",
    () =>
      ai.generatePlan({
        profile,
        prompt: prompts.buildPlanGenerationPrompt(profile),
        skipCache: true,
      }),
    (r) => ({
      days: r.days?.length,
      exercises: r.days?.reduce((n, d) => n + d.exercises.length, 0),
    }),
  ],
  ...["gym", "diet", "recovery"].map((mode) => {
    const question = {
      gym: "How should I start training with no equipment?",
      diet: "Suggest a vegetarian meal with no peanuts.",
      recovery: "I have sharp knee pain during squats. Should I continue?",
    }[mode];
    return [
      `coach-${mode}`,
      () =>
        ai.askTutor({
          mode,
          question,
          profile,
          prompt: prompts.buildTutorPrompt({
            mode,
            profile,
            recentMemorySummaries: [],
            question,
            history: [],
            activity: null,
          }),
          userId: profile.userId,
        }),
      (r) => ({
        answer: r.answer,
        recommendSeeProfessional: r.recommendSeeProfessional,
      }),
    ];
  }),
  [
    "briefing-empty-history",
    () =>
      ai.generateBriefing({
        profile,
        prompt: prompts.buildBriefingPrompt({ profile, data }),
        userId: profile.userId,
      }),
    (r) => ({ status: r.status, summary: r.summary }),
  ],
  [
    "progress-empty-history",
    () =>
      ai.analyzeProgress({
        prompt: prompts.buildProgressAnalysisPrompt({ profile, data }),
        userId: profile.userId,
      }),
    (r) => ({ status: r.status, summary: r.summary }),
  ],
  [
    "memory",
    () =>
      ai.generateMemorySummary({
        prompt: prompts.buildMemorySummaryPrompt({
          userMessage:
            "I prefer vegetarian food and can train three days weekly.",
          aiAnswer: "We can build around that schedule.",
        }),
        userId: profile.userId,
      }),
    (r) => ({ summary: r.summary }),
  ],
  [
    "vision-nonfood",
    () =>
      ai.analyzeFoodImage({
        imageBase64:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        mimeType: "image/png",
        prompt: prompts.buildFoodAnalysisPrompt(),
        userId: profile.userId,
      }),
    (r) => ({ foods: r.foods, confidence: r.confidence }),
  ],
  [
    "vision-food",
    async () => {
      // Public domain, Titus Tscharntke. Source/license:
      // https://commons.wikimedia.org/wiki/File:Banana_fruit_on_white_background.jpg
      const photo = await fetchWithTimeout(
        "https://upload.wikimedia.org/wikipedia/commons/e/e7/Banana_fruit_on_white_background.jpg",
        { headers: { "User-Agent": "FitAI-local-QA/1.0" } },
        15000,
      );
      if (!photo.ok) throw new Error("Public-domain test photo unavailable");
      return ai.analyzeFoodImage({
        imageBase64: Buffer.from(await photo.arrayBuffer()).toString("base64"),
        mimeType: "image/jpeg",
        prompt: prompts.buildFoodAnalysisPrompt(),
        userId: profile.userId,
      });
    },
    (r) => ({ foods: r.foods, confidence: r.confidence }),
  ],
];
(async () => {
  let failed = false;
  const selected = cases.filter(
    (c) => !process.argv[2] || c[0] === process.argv[2],
  );
  if (!selected.length) throw new Error("Unknown test case");
  for (const [name, run, summarize] of selected) {
    const started = Date.now();
    events.length = 0;
    const result = await run();
    const genuine = result.source === "ai";
    const contracts = {
      plan: () => result.days?.length === profile.trainingDaysPerWeek,
      "coach-recovery": () => result.recommendSeeProfessional === true,
      "briefing-empty-history": () => result.status === "no_data",
      "progress-empty-history": () => result.status === "no_data",
      memory: () => Boolean(result.summary && result.summary !== "SKIP"),
      "vision-nonfood": () =>
        result.foods?.length === 0 && result.confidence === 0,
      "vision-food": () =>
        result.foods?.some((food) => /banana/i.test(food.name)),
    };
    const contractPassed = contracts[name]
      ? contracts[name]()
      : Boolean(result.answer?.trim());
    if (!genuine || !contractPassed) failed = true;
    const summary = summarize(result);
    if (summary.answer) {
      summary.wordCount = summary.answer.trim().split(/\s+/).length;
      summary.answer = summary.answer.slice(0, 1100);
    }
    console.log(
      JSON.stringify({
        name,
        source: result.source,
        contractPassed,
        durationMs: Date.now() - started,
        events,
        result: summary,
      }),
    );
  }
  process.exitCode = failed ? 2 : 0;
})().catch(() => {
  console.error("AI check failed before completion. No credentials printed.");
  process.exitCode = 1;
});
