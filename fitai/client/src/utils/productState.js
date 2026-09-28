// Small, testable state helpers. Browser storage is per-user and per-tab.
export function readSessionDraft(key, fallback) {
  try {
    return JSON.parse(sessionStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
export function saveSessionDraft(key, value) {
  try {
    if (value == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode */
  }
}
export function createSerialQueue() {
  let tail = Promise.resolve();
  return (work) => {
    const next = tail.then(work);
    tail = next.catch(() => {});
    return next;
  };
}
export function workoutNumbers(weight, reps) {
  const kg = weight === "" ? 0 : Number(weight);
  const count = Number(reps);
  if (!Number.isFinite(kg) || kg < 0 || kg > 500)
    throw new Error("Enter a weight from 0 to 500 kg. Use 0 for bodyweight.");
  if (!Number.isInteger(count) || count < 1 || count > 100)
    throw new Error("Enter a whole number of reps from 1 to 100.");
  return { weightKg: kg, reps: count };
}
export function formatToday(timeZone) {
  const options = { weekday: "short", month: "short", day: "numeric" };
  try {
    return new Date().toLocaleDateString(undefined, { ...options, timeZone });
  } catch {
    return new Date().toLocaleDateString(undefined, options);
  }
}
// Remove each acknowledged save immediately. A retry can then only include
// items still pending; a partial batch must never duplicate the first items.
export async function savePendingFoods(foods, save, onSaved) {
  let count = 0;
  for (const food of foods) {
    const result = await save(food);
    onSaved(food, result);
    count += 1;
  }
  return count;
}
