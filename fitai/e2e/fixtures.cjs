const { test: base, expect } = require("@playwright/test");
const user = {
  id: "a0000000-0000-4000-8000-000000000001",
  email: "alex@fitai.test",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
};
const exp = Math.floor(Date.now() / 1000) + 86400;
const token = [
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  ),
  Buffer.from(
    JSON.stringify({ sub: user.id, exp, role: "authenticated" }),
  ).toString("base64url"),
  "local-test-only",
].join(".");
const session = {
  access_token: token,
  refresh_token: "local-test-only",
  expires_at: exp,
  expires_in: 86400,
  token_type: "bearer",
  user,
};
function fixtureState() {
  const diet = {
    calorieTarget: 2400,
    proteinGrams: 140,
    waterMl: 2500,
    steps: 8000,
    sleepHours: 8,
    maintenanceCalories: 2400,
    direction: "maintenance",
    dailyCalorieDelta: 0,
  };
  const day = {
    name: "Full-body strength",
    exercises: [
      {
        name: "Goblet squat",
        sets: 3,
        reps: 10,
        restSeconds: 60,
        notes: "Move with control.",
      },
      { name: "Dumbbell row", sets: 3, reps: 12, restSeconds: 60 },
      { name: "Incline push-up", sets: 3, reps: 10, restSeconds: 60 },
    ],
  };
  const plan = {
    source: "ai",
    goal: "maintain",
    timeframeWeeks: 12,
    notes: "Build a rhythm you can repeat.",
    workout: {
      days: [
        day,
        {
          name: "Strength & stability",
          exercises: [
            { name: "Split squat", sets: 3, reps: 10 },
            { name: "Plank", sets: 3, reps: 1 },
          ],
        },
        {
          name: "Move & build",
          exercises: [
            { name: "Hip bridge", sets: 3, reps: 12 },
            { name: "Dumbbell press", sets: 3, reps: 10 },
          ],
        },
      ],
    },
    diet,
  };
  const checklist = {
    id: "local-day",
    date: "2026-09-28",
    userDate: "2026-09-28",
    plan_snapshot: {
      workout: {
        type: "workout",
        dayName: day.name,
        weekday: "Monday",
        exercises: day.exercises,
      },
      targets: diet,
      goal: "maintain",
      adaptations: [],
    },
    items: ["workout", "protein", "calories", "water", "sleep", "steps"].map(
      (name) => ({
        field: `${name}_completed`,
        label: name[0].toUpperCase() + name.slice(1),
      }),
    ),
    calories_consumed: 650,
    protein_grams: 35,
    water_ml: 1500,
    sleep_hours: 8,
    steps_count: 4100,
    sleep_completed: true,
    values_source: {},
    custom_items: [],
  };
  const profile = {
    user_id: user.id,
    age: 28,
    sex: "other",
    height_cm: 175,
    weight_kg: 75,
    goal: "maintain",
    activity_level: "moderately_active",
    gym_availability: "gym",
    injuries: "",
    dietary_restrictions: "vegetarian",
    timeframe_weeks: 12,
    training_days_per_week: 3,
    timezone: "Asia/Kolkata",
    plan_started_at: "2026-09-14",
    ai_plan: plan,
  };
  diet.stepsTarget = 8000;
  plan.days = plan.workout.days;
  delete plan.workout;
  checklist.calories_kcal = 650;
  return {
    diet,
    plan,
    profile,
    checklist,
    meals: [
      {
        id: "meal-1",
        name: "Paneer grain bowl",
        calories: 650,
        protein: 35,
        source: "manual",
      },
    ],
    sets: { "Goblet squat": 1 },
    missing: false,
    fail: {},
    authFail: {},
    authCalls: [],
    calls: [],
    aiSource: "ai",
  };
}
const test = base.extend({
  product: async ({ page }, use) => {
    const s = fixtureState();
    await page.route("**/*", async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        method = req.method(),
        path = url.pathname;
      const headers = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      };
      const send = (data, status = 200) =>
        route.fulfill({
          status,
          headers,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      if (url.hostname === "fitai-local-qa.supabase.co") {
        if (method === "OPTIONS") return send({}, 200);
        s.authCalls.push({ path, method });
        if (s.authFail[path]) return send(s.authFail[path], 400);
        if (path.endsWith("/signup") && s.confirmationRequired)
          return send({ ...user, identities: [{ provider: "email" }] });
        if (path.endsWith("/logout")) return send({});
        return send(path.endsWith("/user") ? user : session);
      }
      if (url.hostname === "127.0.0.1" && url.port === "4015") {
        if (method === "OPTIONS") return send({}, 200);
        let body = {};
        try {
          body = req.postDataJSON() || {};
        } catch {}
        s.calls.push({ path, method, body });
        const failure =
          typeof s.fail[path] === "function"
            ? await s.fail[path]({ body, method })
            : s.fail[path];
        if (failure)
          return send(
            { error: "Test connection interrupted. Try again." },
            typeof failure === "number" ? failure : 503,
          );
        if (path === "/api/onboarding") {
          if (method === "POST") s.missing = false;
          return s.missing
            ? send({ error: "No profile found" }, 404)
            : send({ profile: s.profile, plan: s.plan });
        }
        if (path === "/api/profile") {
          if (s.missing) return send({ error: "No profile found" }, 404);
          if (method === "PATCH")
            Object.assign(s.profile, {
              age: body.age,
              height_cm: body.heightCm,
              weight_kg: body.weightKg,
              target_weight_kg: body.targetWeightKg,
            });
          return send({ profile: s.profile });
        }
        if (path === "/api/plan") {
          if (method === "PUT")
            Object.assign(s.plan, body, { customized: true });
          return send({
            plan: s.plan,
            timeframeWeeks: 12,
            planStartedAt: "2026-09-14",
          });
        }
        if (path === "/api/plan/regenerate") return send({ plan: s.plan });
        if (path === "/api/checklist/today") {
          if (method === "PATCH") s.checklist[body.field] = body.value;
          return send(s.checklist);
        }
        if (path === "/api/checklist/today/values") {
          Object.assign(s.checklist, body);
          return send(s.checklist);
        }
        if (path.startsWith("/api/checklist/today/custom")) {
          if (method === "POST")
            s.checklist.custom_items.push({
              id: "custom-" + Date.now(),
              label: body.label,
              done: false,
            });
          if (method === "PATCH") {
            const item = s.checklist.custom_items.find(
              (i) => i.id === path.split("/").pop(),
            );
            if (item) item.done = body.done;
          }
          if (method === "DELETE")
            s.checklist.custom_items = s.checklist.custom_items.filter(
              (i) => i.id !== path.split("/").pop(),
            );
          return send(s.checklist);
        }
        if (path === "/api/workout/today-sets") return send(s.sets);
        if (path === "/api/workout/log") {
          s.sets[body.exerciseName] = (s.sets[body.exerciseName] || 0) + 1;
          return send({ status: "saved" });
        }
        if (path.startsWith("/api/workout/progression/"))
          return send({ weightKg: 12, note: "Keep the movement controlled." });
        if (path === "/api/nutrition/meals/today")
          return send({
            meals: s.meals,
            summary: {
              calories: s.meals.reduce((a, m) => a + m.calories, 0),
              protein: s.meals.reduce((a, m) => a + m.protein, 0),
              targets: s.diet,
              manualFields: [],
            },
          });
        if (path === "/api/nutrition/meals") {
          if (s.holdMeal) await s.holdMeal;
          const meal = { ...body, id: "meal-" + Date.now() };
          s.meals.push(meal);
          return send({ meal, summary: { syncWarning: s.syncWarning } });
        }
        if (path.startsWith("/api/nutrition/meals/")) {
          s.meals = s.meals.filter((m) => m.id !== path.split("/").pop());
          return send({
            deleted: true,
            summary: { syncWarning: s.syncWarning },
          });
        }
        if (path === "/api/nutrition/analyze")
          return send({
            source: s.aiSource,
            confidence: 0.8,
            needsManualInput: s.aiSource === "fallback",
            foods:
              s.aiSource === "fallback"
                ? []
                : [
                    {
                      name: "Brown rice",
                      grams: 150,
                      calories: 165,
                      protein: 4,
                    },
                    {
                      name: "Chickpeas",
                      grams: 100,
                      calories: 164,
                      protein: 9,
                    },
                  ],
          });
        if (path === "/api/ai/briefing")
          return send({
            source: s.aiSource,
            headline: "A steady start. Keep it simple.",
            summary: "Your next step is a focused strength session.",
            focus: ["Move with control.", "Leave time for recovery."],
            status: "on_track",
          });
        if (path === "/api/ai/tutor") {
          if (s.holdTutor) await s.holdTutor;
          return send({
            source: s.aiSource,
            answer:
              s.aiSource === "fallback"
                ? "Personalized coaching is unavailable. Keep activity comfortable and try again later."
                : "### Your next step\nKeep three training days this week.\n\n- Use a controlled pace.\n- Leave a rest day between sessions.\n\nHow did your last session feel?",
            mode: body.mode,
          });
        }
        if (path === "/api/progress")
          return send({
            date: "2026-09-28",
            data: {
              goal: { type: "maintain", dietTargets: s.diet },
              weighIns: [
                { date: "2026-09-14", kg: 75.2 },
                { date: "2026-09-18", kg: 75.1 },
                { date: "2026-09-22", kg: 75.3 },
                { date: "2026-09-28", kg: 75 },
              ],
              training: [920, 1060, 1140].map((volumeKg, i) => ({
                date: `2026-09-${24 + i}`,
                volumeKg,
              })),
              nutrition: [2280, 2410, 2360].map((calories, i) => ({
                date: `2026-09-${24 + i}`,
                calories,
                protein: 130 + i * 5,
              })),
            },
            analysis: {
              source: s.aiSource,
              headline: "Consistency is becoming your strength.",
              status: "on_track",
              statusLabel: "Steady progress",
              summary: "Your recent logs show a repeatable rhythm.",
              weightTrend: "Your logged weight is broadly stable.",
              trainingAnalysis: "Training volume is building gradually.",
              nutritionAnalysis: "Your logged intake is close to your plan.",
              wins: ["Three training sessions logged."],
              risks: ["Keep recovery in the plan."],
              recommendations: ["Keep the next week manageable."],
              stats: [],
            },
          });
        if (path === "/api/memory/summaries")
          return send(
            s.memoryDeleted
              ? []
              : [
                  {
                    id: "a0000000-0000-4000-8000-000000000002",
                    summary:
                      "Prefers vegetarian meals and three training days.",
                    mode: "diet",
                    category: "preference",
                    importance: 2,
                    created_at: "2026-09-27T12:00:00Z",
                  },
                ],
          );
        if (path.startsWith("/api/memory/summaries/") && method === "DELETE") {
          s.memoryDeleted = true;
          return send({ deleted: true });
        }
        return send(
          { error: `Unhandled local test endpoint: ${method} ${path}` },
          500,
        );
      }
      if (
        url.hostname === "127.0.0.1" ||
        url.hostname === "fonts.googleapis.com" ||
        url.hostname === "fonts.gstatic.com"
      )
        return route.continue();
      return route.abort(); // Never touch production services from UI fixtures.
    });
    s.signIn = () =>
      page.addInitScript(
        ({ session }) => {
          // Seed once per tab. Reload must not silently sign a logged-out
          // user back in (which would hide real logout bugs).
          if (sessionStorage.getItem("qa-auth-seeded")) return;
          sessionStorage.setItem("qa-auth-seeded", "1");
          localStorage.setItem(
            "sb-fitai-local-qa-auth-token",
            JSON.stringify(session),
          );
          localStorage.setItem("fitai.theme", "light");
        },
        { session },
      );
    await use(s);
  },
});
module.exports = { test, expect };
