import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  analyzeFoodImage,
  saveMeal,
  getTodayMeals,
  deleteMeal,
} from "../../services/nutritionService";
import { useAuth } from "../../contexts/AuthContext";
import { savePendingFoods } from "../../utils/productState";
import { getNutritionDraft } from "../../utils/nutritionDraft";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import {
  PageHeader,
  EmptyState,
  SourceBadge,
  ConfirmDialog,
} from "../../components/ui/PageKit";
const emptyManual = () => ({ name: "", calories: "", protein: "" });
function Metric({ label, value, target, unit }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {Number(value || 0).toLocaleString()}{" "}
        <span className="metric-unit">{unit}</span>
      </div>
      <div className="stat-sub">
        {target
          ? `of ${Number(target).toLocaleString()} ${unit} daily target`
          : "No target set yet"}
      </div>
      <div className="progress-track" style={{ marginTop: 17 }}>
        <div
          className="progress-fill"
          style={{
            width: `${target ? Math.min(100, ((value || 0) / target) * 100) : 0}%`,
          }}
        />
      </div>
    </div>
  );
}
function mealPayload(food, source = "photo") {
  const result = {
    name: food.name.trim(),
    calories: Math.round(Number(food.calories)),
    protein: Number(food.protein || 0),
    source,
  };
  if (!result.name) throw new Error("Give the food a name.");
  if (food.calories === "" || food.calories == null)
    throw new Error(
      "Enter the calories for this item, even if your estimate is 0.",
    );
  if (
    !Number.isFinite(result.calories) ||
    result.calories < 0 ||
    result.calories > 5000
  )
    throw new Error("Calories must be between 0 and 5,000.");
  if (
    !Number.isFinite(result.protein) ||
    result.protein < 0 ||
    result.protein > 300
  )
    throw new Error("Protein must be between 0 and 300 g.");
  if (food.grams !== "" && food.grams != null) {
    result.grams = Number(food.grams);
    if (
      !Number.isFinite(result.grams) ||
      result.grams <= 0 ||
      result.grams > 2000
    )
      throw new Error("Portion must be between 1 and 2,000 g.");
  }
  return result;
}
export default function Nutrition() {
  const { user } = useAuth();
  const key = `fitai.foodDraft.${user.id}`;
  const [draft] = useState(() => getNutritionDraft(key));
  const { analysis, manual, error, notice, busy } = useSyncExternalStore(
    draft.subscribe,
    draft.getSnapshot,
  );
  const setAnalysis = (value) =>
    draft.update((s) => ({
      analysis: typeof value === "function" ? value(s.analysis) : value,
    }));
  const setManual = (value) => draft.update({ manual: value });
  const setError = (value) => draft.update({ error: value });
  const setNotice = (value) => draft.update({ notice: value });
  const [mode, setMode] = useState(
    analysis?.foods?.length || busy === "analyzing" ? "photo" : "manual",
  );
  const [meals, setMeals] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [diaryError, setDiaryError] = useState("");
  const [remove, setRemove] = useState(null);
  const fileInput = useRef(null);
  const cameraInput = useRef(null);
  async function refreshDiary() {
    try {
      const result = await getTodayMeals();
      setMeals(result.meals);
      setSummary(result.summary);
      setDiaryError("");
    } catch (e) {
      setDiaryError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!busy) refreshDiary();
  }, [busy]);
  useEffect(() => {
    const focus = () => {
      if (!draft.getSnapshot().busy && document.visibilityState === "visible")
        refreshDiary();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, []);
  function begin(action) {
    return draft.begin(action);
  }
  function end() {
    draft.end();
  }
  async function analyze(file) {
    if (!file || !begin("analyzing")) return;
    draft.lastPhoto = file;
    setMode("photo");
    try {
      const result = await analyzeFoodImage(file);
      setAnalysis({
        ...result,
        foods: (result.foods || []).map((food) => ({
          ...food,
          draftId: crypto.randomUUID(),
        })),
      });
    } catch (e) {
      setError(e.message);
    } finally {
      end();
    }
  }
  function fileChanged(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    analyze(file);
  }
  function editFood(id, field, value) {
    setAnalysis((a) => ({
      ...a,
      foods: a.foods.map((f) =>
        f.draftId === id ? { ...f, [field]: value } : f,
      ),
    }));
  }
  async function confirmFoods(foods) {
    if (!foods.length || !begin("saving")) return;
    let saved = 0;
    let syncWarning = "";
    try {
      // Validate the whole selected batch before the first write.
      foods.forEach((food) => mealPayload(food));
      await savePendingFoods(
        foods,
        (food) => {
          if (!draft.isCurrent())
            throw new Error("Signed out. Remaining foods were not added.");
          return saveMeal(mealPayload(food));
        },
        (food, result) => {
          saved += 1;
          setAnalysis((a) =>
            a
              ? {
                  ...a,
                  foods: a.foods.filter((f) => f.draftId !== food.draftId),
                }
              : null,
          );
          if (result.summary?.syncWarning)
            syncWarning = result.summary.syncWarning;
        },
      );
      setNotice(
        `${saved} ${saved === 1 ? "item" : "items"} added to your diary.${syncWarning ? ` ${syncWarning}` : ""}`,
      );
    } catch (e) {
      setError(
        `${saved ? `${saved} already saved. Only the remaining items need retrying. ` : ""}${e.message}`,
      );
    } finally {
      end();
    }
  }
  async function saveManual(e) {
    e.preventDefault();
    if (!begin("saving")) return;
    try {
      const result = await saveMeal(mealPayload(manual, "manual"));
      setManual(emptyManual());
      setNotice(
        result.summary?.syncWarning ||
          "Meal added. A little more of the picture, captured.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      end();
    }
  }
  async function removeMeal() {
    if (!remove || !begin("deleting")) return;
    try {
      const result = await deleteMeal(remove.id);
      setRemove(null);
      setNotice(
        result.summary?.syncWarning ||
          "Meal removed. Your diary totals have been updated.",
      );
    } catch (e) {
      setError(e.message);
      setRemove(null);
    } finally {
      end();
    }
  }
  return (
    <div className="page page-wide page-enter">
      <PageHeader
        eyebrow="EAT WELL. LIVE WELL."
        title="Fuel your rhythm."
        description="A useful picture of your day—not a score to be perfect at."
      />
      {summary && (
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <Metric
            label="Energy logged"
            value={summary.calories}
            target={summary.targets?.calorieTarget}
            unit="kcal"
          />
          <Metric
            label="Protein logged"
            value={summary.protein}
            target={summary.targets?.proteinGrams}
            unit="g"
          />
        </div>
      )}
      {summary?.manualFields?.some((f) =>
        ["calories_kcal", "protein_grams"].includes(f),
      ) && (
        <p className="notice">
          You entered a daily total on Today. It stays separate from this meal
          diary, so new meals won’t overwrite that total.
        </p>
      )}
      {diaryError && (
        <div className="notice tone-amber" role="alert">
          <p>
            We couldn’t refresh your diary. {diaryError} Check your saved meals
            before adding the same food again.
          </p>
          <Button variant="ghost" onClick={refreshDiary}>
            Refresh diary
          </Button>
        </div>
      )}
      {summary?.syncWarning && !diaryError && (
        <div className="notice tone-amber" role="alert">
          <p>{summary.syncWarning}</p>
          <Button variant="ghost" onClick={refreshDiary}>
            Refresh diary
          </Button>
        </div>
      )}
      <div className="fuel-layout">
        <section className="card">
          <div className="section-heading">
            <h2>What’s on the menu?</h2>
            <Icon name="fuel" />
          </div>
          <div className="food-mode-switch" aria-label="How to log a meal">
            <button
              aria-pressed={mode === "manual"}
              onClick={() => setMode("manual")}
            >
              Quick entry
            </button>
            <button
              aria-pressed={mode === "photo"}
              onClick={() => setMode("photo")}
            >
              <Icon name="camera" size={16} /> Photo estimate
            </button>
          </div>
          {mode === "manual" ? (
            <form onSubmit={saveManual}>
              <fieldset disabled={Boolean(busy)}>
                <label className="label" htmlFor="meal-name">
                  Food or meal
                </label>
                <input
                  id="meal-name"
                  className="field"
                  placeholder="e.g. Paneer rice bowl"
                  maxLength={120}
                  value={manual.name}
                  onChange={(e) =>
                    setManual({ ...manual, name: e.target.value })
                  }
                  required
                />
                <div className="form-grid">
                  <div>
                    <label className="label" htmlFor="meal-calories">
                      Calories · kcal
                    </label>
                    <input
                      id="meal-calories"
                      className="field"
                      type="number"
                      min="0"
                      max="5000"
                      step="1"
                      placeholder="450"
                      value={manual.calories}
                      onChange={(e) =>
                        setManual({ ...manual, calories: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="meal-protein">
                      Protein · g
                    </label>
                    <input
                      id="meal-protein"
                      className="field"
                      type="number"
                      min="0"
                      max="300"
                      step="0.1"
                      placeholder="Optional"
                      value={manual.protein}
                      onChange={(e) =>
                        setManual({ ...manual, protein: e.target.value })
                      }
                    />
                  </div>
                </div>
                <p className="field-hint">
                  Use the label or your best estimate. You don’t need to be
                  exact.
                </p>
                <Button
                  type="submit"
                  className="btn-block"
                  style={{ marginTop: 24 }}
                >
                  {busy === "saving" ? "Adding your meal…" : "Add to diary"}
                  <Icon name="plus" size={17} />
                </Button>
              </fieldset>
            </form>
          ) : (
            <>
              <input
                ref={fileInput}
                aria-label="Upload food photo"
                type="file"
                accept="image/*"
                onChange={fileChanged}
                hidden
                disabled={Boolean(busy)}
              />
              <input
                ref={cameraInput}
                aria-label="Take food photo"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={fileChanged}
                hidden
                disabled={Boolean(busy)}
              />
              <div className="photo-dropzone">
                <span className="icon-tile">
                  <Icon name="camera" size={28} />
                </span>
                <h3 style={{ margin: "8px 0" }}>A photo. A starting point.</h3>
                <p>
                  Keep your whole plate in view. Review and edit every estimate
                  before anything is saved.
                </p>
                <div className="button-row">
                  <Button
                    disabled={Boolean(busy) || Boolean(analysis?.foods?.length)}
                    onClick={() => cameraInput.current?.click()}
                  >
                    <Icon name="camera" size={17} />
                    Take photo
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={Boolean(busy) || Boolean(analysis?.foods?.length)}
                    onClick={() => fileInput.current?.click()}
                  >
                    <Icon name="upload" size={16} />
                    Upload
                  </Button>
                </div>
              </div>
              {busy === "analyzing" && (
                <div className="thinking" role="status">
                  <i />
                  <i />
                  <i />
                  <span>Identifying foods and estimating portions…</span>
                </div>
              )}
              {analysis &&
                (!analysis.foods?.length || analysis.needsManualInput) && (
                  <div className="notice">
                    <p>
                      {analysis.source === "fallback"
                        ? "Photo AI is unavailable right now. Your photo is not the problem—quick entry still works."
                        : "No pending items. If food wasn’t detected, try a clearer photo or enter your meal manually."}
                    </p>
                    <Button variant="ghost" onClick={() => setMode("manual")}>
                      Use quick entry
                    </Button>
                  </div>
                )}
              {analysis?.foods?.length > 0 && (
                <div style={{ marginTop: 22 }}>
                  <div className="section-heading">
                    <h3>Review your plate</h3>
                    <SourceBadge
                      source={analysis.source}
                      stale={analysis.stale}
                    />
                  </div>
                  <p className="field-hint">
                    Portions and macros are estimates. Editing the grams does
                    not recalculate the calories—adjust both if needed.
                  </p>
                  <fieldset disabled={Boolean(busy)}>
                    {analysis.foods.map((food, i) => (
                      <div className="food-estimate" key={food.draftId}>
                        <div className="food-estimate-head">
                          <strong>Item {i + 1}</strong>
                          <button
                            className="ghost-button"
                            aria-label={`Discard ${food.name}`}
                            onClick={() =>
                              setAnalysis((a) => ({
                                ...a,
                                foods: a.foods.filter(
                                  (f) => f.draftId !== food.draftId,
                                ),
                              }))
                            }
                          >
                            <Icon name="close" size={16} />
                          </button>
                        </div>
                        <label
                          className="label"
                          htmlFor={`food-${food.draftId}`}
                        >
                          Food
                        </label>
                        <input
                          id={`food-${food.draftId}`}
                          className="field"
                          maxLength={120}
                          value={food.name}
                          onChange={(e) =>
                            editFood(food.draftId, "name", e.target.value)
                          }
                        />
                        <div className="form-grid">
                          {[
                            ["grams", "Portion · g", 2000],
                            ["calories", "Calories · kcal", 5000],
                            ["protein", "Protein · g", 300],
                          ].map(([field, label, max]) => (
                            <div key={field}>
                              <label
                                className="label"
                                htmlFor={`${food.draftId}-${field}`}
                              >
                                {label}
                              </label>
                              <input
                                id={`${food.draftId}-${field}`}
                                type="number"
                                className="field"
                                min={field === "grams" ? 1 : 0}
                                max={max}
                                step="0.1"
                                value={food[field] ?? ""}
                                onChange={(e) =>
                                  editFood(food.draftId, field, e.target.value)
                                }
                              />
                            </div>
                          ))}
                        </div>
                        <Button
                          variant="ghost"
                          style={{ marginTop: 16 }}
                          onClick={() => confirmFoods([food])}
                        >
                          Add this item
                        </Button>
                      </div>
                    ))}
                  </fieldset>
                  <Button
                    className="btn-block"
                    disabled={Boolean(busy)}
                    onClick={() => confirmFoods(analysis.foods)}
                  >
                    {busy === "saving"
                      ? "Adding your plate…"
                      : `Add ${analysis.foods.length} ${analysis.foods.length === 1 ? "item" : "items"} to diary`}
                  </Button>
                  <button
                    className="ghost-button"
                    disabled={Boolean(busy)}
                    onClick={() => setAnalysis(null)}
                  >
                    Discard estimates
                  </button>
                </div>
              )}
            </>
          )}
          {error && (
            <div className="notice tone-red" role="alert">
              {error}
              {mode === "photo" &&
                draft.lastPhoto &&
                !analysis?.foods?.length && (
                  <div style={{ marginTop: 12 }}>
                    <Button
                      variant="ghost"
                      disabled={Boolean(busy)}
                      onClick={() => analyze(draft.lastPhoto)}
                    >
                      Retry this photo
                    </Button>
                  </div>
                )}
            </div>
          )}
          {notice && (
            <p className="inline-feedback success-text" role="status">
              <Icon name="check" size={16} />
              {notice}
            </p>
          )}
        </section>
        <section className="card">
          <div className="section-heading">
            <h2>Today’s diary</h2>
            <span className="chip">
              {meals
                ? `${meals.length} ${meals.length === 1 ? "entry" : "entries"}`
                : "Loading"}
            </span>
          </div>
          {loading ? (
            <div role="status">
              <p className="small muted">Loading your meals…</p>
              <div className="skeleton" />
              <div className="skeleton short" />
            </div>
          ) : meals?.length === 0 ? (
            <EmptyState
              icon="fuel"
              title="Make a little space for fuel."
              description="Your first meal will appear here. Add it by hand or start with a photo."
            />
          ) : (
            (meals || []).map((meal) => (
              <article className="diary-item" key={meal.id}>
                <span className="diary-icon">
                  <Icon
                    name={meal.source === "photo" ? "camera" : "fuel"}
                    size={18}
                  />
                </span>
                <div className="diary-item-body">
                  <strong>{meal.name}</strong>
                  <small>
                    {Number(meal.calories).toLocaleString()} kcal ·{" "}
                    {Number(meal.protein)} g protein
                    {meal.source === "photo" ? " · photo estimate" : ""}
                  </small>
                </div>
                <button
                  className="ghost-button"
                  disabled={Boolean(busy)}
                  aria-label={`Remove ${meal.name}`}
                  onClick={() => setRemove(meal)}
                >
                  <Icon name="close" size={16} />
                </button>
              </article>
            ))
          )}
          <p className="field-hint" style={{ marginTop: 20 }}>
            Meal totals are estimates, not medical guidance. Eating well is
            about patterns over time.
          </p>
        </section>
      </div>
      <ConfirmDialog
        open={Boolean(remove)}
        title="Remove this meal?"
        confirmLabel="Remove meal"
        busy={busy === "deleting"}
        onCancel={() => setRemove(null)}
        onConfirm={removeMeal}
      >
        <p>
          {remove?.name} will be removed from today’s diary and its totals. This
          cannot be undone.
        </p>
      </ConfirmDialog>
    </div>
  );
}
