import test from "node:test";
import assert from "node:assert/strict";
import { getNutritionDraft } from "../src/utils/nutritionDraft.js";

const values = new Map();
globalThis.sessionStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};

test("food actions share one lock and acknowledged state across page remounts", () => {
  const a = getNutritionDraft("fitai.foodDraft.test-one");
  a.update({ manual: { name: "Lunch", calories: "500", protein: "30" } });
  assert.equal(a.begin("saving"), true);
  const b = getNutritionDraft("fitai.foodDraft.test-one");
  assert.equal(b, a);
  assert.equal(b.begin("saving"), false);
  a.update({ manual: { name: "", calories: "", protein: "" } });
  a.end();
  assert.equal(b.getSnapshot().busy, "");
  assert.equal(b.getSnapshot().manual.name, "");
  assert.equal(
    getNutritionDraft("fitai.foodDraft.test-one").getSnapshot().manual.name,
    "",
  );
});

test("late food results cannot recreate data purged by sign-out or change a new draft", () => {
  const key = "fitai.foodDraft.test-two";
  const a = getNutritionDraft(key);
  a.begin("saving");
  sessionStorage.removeItem(key);
  assert.equal(a.update({ notice: "Old saved result" }), false);
  assert.equal(sessionStorage.getItem(key), null);
  const b = getNutritionDraft(key);
  b.update({
    manual: { name: "New account session", calories: "", protein: "" },
  });
  a.end();
  assert.equal(a.update({ manual: { name: "Old request" } }), false);
  assert.equal(b.getSnapshot().manual.name, "New account session");
});
