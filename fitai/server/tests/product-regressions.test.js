const test = require("node:test");
const assert = require("node:assert/strict");
const { ProfileUpdateSchema } = require("../src/validators/requestSchemas");
const {
  fetchWithTimeout,
  withinDeadline,
  remainingTimeout,
} = require("../src/services/ai/providerUtils");
const {
  buildSystemPrompt,
  buildTutorPrompt,
  buildFoodAnalysisPrompt,
  buildProgressAnalysisPrompt,
} = require("../../shared/prompts/templates");

test("profile can explicitly clear its optional target without accepting invalid weights", () => {
  assert.equal(
    ProfileUpdateSchema.parse({ targetWeightKg: null }).targetWeightKg,
    null,
  );
  assert.equal(
    ProfileUpdateSchema.safeParse({ targetWeightKg: 0 }).success,
    false,
  );
  assert.equal(ProfileUpdateSchema.safeParse({}).success, false);
});

test("a long AI plan label does not discard a valid plan or weaken exercise validation", () => {
  const { validate } = require("../src/services/ai/responseValidator");
  const { PlanSchema } = require("../../shared/schemas/aiSchemas");
  const raw = {
    goal: "A personal maintenance plan. ".repeat(10),
    days: [
      { name: "Strength", exercises: [{ name: "Squat", sets: 3, reps: 10 }] },
    ],
  };
  const result = validate("plan", raw);
  assert.equal(result.valid, true);
  assert.ok(result.data.goal.length <= 120);
  assert.equal(
    PlanSchema.safeParse(raw).success,
    false,
    "the user-edit contract stays strict",
  );
  raw.days[0].exercises[0].sets = 999;
  assert.equal(validate("plan", raw).valid, false);
});
test("coaching is honest about AI identity, estimates, missing data and image uncertainty", () => {
  assert.match(
    buildSystemPrompt({ mode: "gym" }),
    /not a licensed professional/,
  );
  const chat = buildTutorPrompt({
    mode: "gym",
    profile: {},
    question: "hello",
  });
  assert.match(chat, /at most 150 words/);
  assert.match(chat, /Missing logs are unknown/);
  assert.match(buildFoodAnalysisPrompt(), /never invent food/);
  assert.match(buildFoodAnalysisPrompt(), /Do not infer allergens/);
  const progress = buildProgressAnalysisPrompt({
    profile: {},
    data: { goal: {} },
  });
  assert.doesNotMatch(progress, /an unlogged day is a missed day/);
});
test("provider timeout remains active while the response body is stalled", async () => {
  const original = global.fetch;
  global.fetch = async (_url, { signal }) =>
    new Response(
      new ReadableStream({
        start(controller) {
          signal.addEventListener(
            "abort",
            () => controller.error(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        },
      }),
    );
  try {
    await assert.rejects(fetchWithTimeout("https://synthetic.test", {}, 20), {
      name: "AbortError",
    });
  } finally {
    global.fetch = original;
  }
});
test("each concurrent AI request gets its own remaining timeout budget", async () => {
  const start = Date.now();
  const [short, long] = await Promise.all([
    withinDeadline(start + 100, async () => {
      await Promise.resolve();
      return remainingTimeout(5000);
    }),
    withinDeadline(start + 1000, async () => {
      await Promise.resolve();
      return remainingTimeout(5000);
    }),
  ]);
  assert.ok(short > 0 && short <= 100);
  assert.ok(long > short && long <= 1000);
});
