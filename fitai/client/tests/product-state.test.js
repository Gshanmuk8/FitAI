import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSerialQueue,
  workoutNumbers,
  savePendingFoods,
} from "../src/utils/productState.js";

test("checklist mutations run in submission order even after a failed write", async () => {
  const queue = createSerialQueue(),
    seen = [];
  let release;
  const first = queue(async () => {
    seen.push("first");
    await new Promise((r) => {
      release = r;
    });
    throw new Error("offline");
  });
  const caught = assert.rejects(first, /offline/);
  const second = queue(async () => {
    seen.push("second");
    return "saved";
  });
  await Promise.resolve();
  assert.deepEqual(seen, ["first"]);
  release();
  await caught;
  assert.equal(await second, "saved");
  assert.deepEqual(seen, ["first", "second"]);
});
test("only acknowledged photo items leave the pending batch", async () => {
  const pending = [{ id: 1 }, { id: 2 }, { id: 3 }],
    acknowledged = [];
  await assert.rejects(
    savePendingFoods(
      pending,
      async (f) => {
        if (f.id === 2) throw new Error("offline");
        return f;
      },
      (f) => acknowledged.push(f.id),
    ),
    /offline/,
  );
  assert.deepEqual(acknowledged, [1]);
  const remaining = pending.filter((f) => !acknowledged.includes(f.id));
  await savePendingFoods(
    remaining,
    async (f) => f,
    (f) => acknowledged.push(f.id),
  );
  assert.deepEqual(acknowledged, [1, 2, 3]);
});
test("workout validation accepts bodyweight and rejects fractional or invalid reps", () => {
  assert.deepEqual(workoutNumbers("", "10"), { weightKg: 0, reps: 10 });
  assert.deepEqual(workoutNumbers("12.5", "8"), { weightKg: 12.5, reps: 8 });
  for (const reps of ["", 0, -1, 1.2, 101, "ten"])
    assert.throws(() => workoutNumbers(10, reps));
  for (const weight of [-1, 501, Infinity, "heavy"])
    assert.throws(() => workoutNumbers(weight, 10));
});
