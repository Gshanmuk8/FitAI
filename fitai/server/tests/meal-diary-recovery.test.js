const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function fixture() {
  const s = {
    failTotals: false,
    failSync: false,
    inserts: 0,
    deletes: 0,
    writes: [],
  };
  const checklist = {
    userDate: "2026-09-28",
    values_source: {},
    plan_snapshot: {
      targets: { proteinGrams: 100, calorieTarget: 2000 },
      goal: "maintain",
    },
  };
  const dependencies = {
    "../../models/Meal": {
      insertMeal: async (_id, meal) => {
        s.inserts++;
        return { id: "saved-meal", ...meal };
      },
      deleteMeal: async () => {
        s.deletes++;
        return true;
      },
      todayTotals: async () => {
        if (s.failTotals) throw new Error("Synthetic totals read failed");
        return { calories: 500, protein: 30, meals: 1 };
      },
    },
    "../../models/DailyChecklist": {
      updateChecklistFields: async (_id, fields) => {
        if (s.failSync) throw new Error("Synthetic checklist write failed");
        s.writes.push(fields);
        return fields;
      },
    },
    "../checklist/checklistService": {
      getTodayEnriched: async () => checklist,
      valueCompletion: () => false,
    },
    "../../utils/logger": { error() {} },
  };
  const context = {
    module: { exports: {} },
    require: (name) => {
      assert.ok(dependencies[name], `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  };
  vm.runInNewContext(
    fs.readFileSync(
      path.join(__dirname, "../src/services/nutrition/mealDiaryService.js"),
      "utf8",
    ),
    context,
  );
  return { s, checklist, diary: context.module.exports };
}

test("a committed meal remains acknowledged when the totals read fails", async () => {
  const { s, diary } = fixture();
  s.failTotals = true;
  const result = await diary.addMealAndSync("test-user", { name: "Lunch" });
  assert.equal(s.inserts, 1);
  assert.equal(result.meal.id, "saved-meal");
  assert.match(result.summary.syncWarning, /change saved/);
  assert.equal(
    result.summary.calories,
    undefined,
    "do not invent a zero total",
  );
});

test("a committed deletion remains acknowledged when syncing fails", async () => {
  const { s, diary } = fixture();
  s.failSync = true;
  const result = await diary.removeMealAndSync("test-user", "saved-meal");
  assert.equal(s.deletes, 1);
  assert.match(result.syncWarning, /could not be refreshed/);
  assert.equal(result.calories, 500);
});

test("refresh repairs derived totals without overwriting a manually entered daily value", async () => {
  const { s, checklist, diary } = fixture();
  checklist.values_source.calories_kcal = "manual";
  s.failSync = true;
  const saved = await diary.addMealAndSync("test-user", { name: "Lunch" });
  assert.ok(saved.summary.syncWarning);
  s.failSync = false;
  const refreshed = await diary.getTodaySummary("test-user");
  assert.equal(refreshed.syncWarning, undefined);
  assert.equal(s.inserts, 1);
  assert.equal(s.writes.length, 1);
  assert.equal(s.writes[0].protein_grams, 30);
  assert.equal(s.writes[0].calories_kcal, undefined);
  assert.equal(refreshed.manualFields[0], "calories_kcal");
});

test("unavailable totals on a read are an error, not an empty diary", async () => {
  const { s, diary } = fixture();
  s.failTotals = true;
  await assert.rejects(
    diary.getTodaySummary("test-user"),
    /temporarily unavailable/,
  );
});
