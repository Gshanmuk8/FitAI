import { readSessionDraft, saveSessionDraft } from "./productState.js";

// A page-local React lock disappears on navigation. Keep only in-flight
// actions shared within this tab so returning to Fuel cannot submit twice.
const activeDrafts = new Map();
const emptyManual = () => ({ name: "", calories: "", protein: "" });

export function getNutritionDraft(key) {
  const existing = activeDrafts.get(key);
  if (existing?.isCurrent()) return existing;
  const saved = readSessionDraft(key, {});
  const draftId = saved.draftId || crypto.randomUUID();
  let snapshot = {
    draftId,
    analysis: saved.analysis || null,
    manual: saved.manual || emptyManual(),
    busy: "",
    error: saved.pending
      ? "The previous request was interrupted. Check your saved meals before adding the same food again."
      : "",
    notice: saved.notice || "",
  };
  const listeners = new Set();
  function persist() {
    saveSessionDraft(key, {
      ...snapshot,
      pending: snapshot.busy,
      busy: undefined,
    });
  }
  persist();
  const storageAvailable = readSessionDraft(key, null)?.draftId === draftId;
  const store = {
    lastPhoto: null,
    getSnapshot: () => snapshot,
    isCurrent: () =>
      !storageAvailable || readSessionDraft(key, null)?.draftId === draftId,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(patch) {
      // A late result must not recreate a draft removed by sign-out.
      if (!store.isCurrent()) return false;
      snapshot = {
        ...snapshot,
        ...(typeof patch === "function" ? patch(snapshot) : patch),
      };
      persist();
      listeners.forEach((listener) => listener());
      return true;
    },
    begin(action) {
      if (snapshot.busy || !store.isCurrent()) return false;
      activeDrafts.set(key, store);
      return store.update({ busy: action, error: "", notice: "" });
    },
    end() {
      store.update({ busy: "" });
      if (activeDrafts.get(key) === store) activeDrafts.delete(key);
    },
  };
  return store;
}
