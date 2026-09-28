import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getPlan, updatePlan } from "../../services/planService";
import { useAuth } from "../../contexts/AuthContext";
import { readSessionDraft, saveSessionDraft } from "../../utils/productState";
import Button from "../../components/ui/Button";
import ButtonLink from "../../components/ui/ButtonLink";
import Icon from "../../components/ui/Icon";
import {
  PageHeader,
  LoadingState,
  EmptyState,
  SourceBadge,
  ConfirmDialog,
} from "../../components/ui/PageKit";
const FIELDS = [
  ["calorieTarget", "Daily energy", "kcal", 1200, 6000, 1],
  ["proteinGrams", "Protein", "g", 40, 400, 1],
  ["waterMl", "Water", "ml", 1000, 8000, 100],
  ["stepsTarget", "Steps", "steps", 1000, 40000, 100],
  ["sleepHours", "Sleep", "hours", 5, 12, 0.5],
];
const GOALS = {
  build_muscle: "Build strength",
  lose_fat: "Lose body fat",
  maintain: "Feel my best",
  improve_endurance: "Build endurance",
};
export default function Plan() {
  const { user } = useAuth();
  const location = useLocation();
  const key = `fitai.planDraft.${user.id}`;
  const [days, setDays] = useState(null);
  const [diet, setDiet] = useState(null);
  const [meta, setMeta] = useState(null);
  const [base, setBase] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [remove, setRemove] = useState(null);
  const [discard, setDiscard] = useState(false);
  const dirty = days !== null && JSON.stringify({ days, diet }) !== base;
  async function load() {
    setLoading(true);
    setError("");
    setMissing(false);
    try {
      const result = await getPlan();
      const plan = result.plan;
      const snapshot = JSON.stringify({
        days: plan.days || [],
        diet: plan.diet || null,
      });
      const draft = readSessionDraft(key, null);
      setBase(snapshot);
      setMeta({
        ...plan,
        planStartedAt: result.planStartedAt,
        timeframeWeeks: result.timeframeWeeks,
      });
      if (draft?.base === snapshot) {
        setDays(draft.days);
        setDiet(draft.diet);
        setEditing(true);
        setNotice(
          "Your unsaved draft has been restored. Save to apply it to your plan.",
        );
      } else {
        setDays(plan.days || []);
        setDiet(plan.diet || null);
        if (draft)
          setNotice(
            "Your saved plan changed since your last draft. We loaded the current plan so older edits cannot overwrite it.",
          );
      }
    } catch (e) {
      setError(e.message);
      setMissing(e.noPlan || e.noProfile);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (days !== null)
      saveSessionDraft(key, dirty ? { base, days, diet } : null);
  }, [key, base, days, diet, dirty]);
  useEffect(() => {
    const before = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  function dayChange(i, patch) {
    setNotice("");
    setDays((rows) =>
      rows.map((day, n) => (n === i ? { ...day, ...patch } : day)),
    );
  }
  function exerciseChange(dayIndex, exerciseIndex, patch) {
    dayChange(dayIndex, {
      exercises: days[dayIndex].exercises.map((e, i) =>
        i === exerciseIndex ? { ...e, ...patch } : e,
      ),
    });
  }
  async function save(e) {
    e.preventDefault();
    if (saving || !dirty) return;
    setError("");
    setNotice("");
    setSaving(true);
    try {
      if (!days.length || days.some((day) => !day.exercises.length))
        throw new Error("Each training day needs at least one exercise.");
      const payload = {
        days: days.map((day) => ({
          ...day,
          name: day.name.trim(),
          exercises: day.exercises.map((ex) => ({
            ...ex,
            name: ex.name.trim(),
            sets: Number(ex.sets),
            reps: Number(ex.reps),
            ...(ex.restSeconds != null
              ? { restSeconds: Number(ex.restSeconds) }
              : {}),
          })),
        })),
        ...(diet
          ? {
              diet: Object.fromEntries(
                FIELDS.map(([field]) => [field, Number(diet[field])]),
              ),
            }
          : {}),
      };
      const { plan } = await updatePlan(payload);
      setDays(plan.days);
      setDiet(plan.diet || null);
      setMeta((m) => ({ ...m, ...plan }));
      setBase(JSON.stringify({ days: plan.days, diet: plan.diet || null }));
      setEditing(false);
      setNotice(
        "Plan saved. Today’s session and targets now reflect your edits. Your timeline and past training logs are unchanged.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  if (loading) return <LoadingState title="Your plan, in perspective" />;
  if (!days)
    return (
      <div className="page">
        <EmptyState
          icon="plan"
          title={
            missing
              ? "Your plan starts with you."
              : "Let’s reconnect your plan."
          }
          description={error}
        >
          {missing ? (
            <ButtonLink to="/onboarding">Build my plan</ButtonLink>
          ) : (
            <Button onClick={load}>Try again</Button>
          )}
        </EmptyState>
      </div>
    );
  const template =
    meta.source === "fallback" || meta.generatedBy === "fallback_template";
  return (
    <div className="page page-mid page-enter">
      <PageHeader
        eyebrow="A DIRECTION, NOT A RULEBOOK"
        title="Made for your week."
        description="Your training and daily targets, together. Adjust the details without starting over."
      >
        {!editing && (
          <Button
            variant="ghost"
            onClick={() => {
              setEditing(true);
              setNotice("");
            }}
          >
            <Icon name="plan" size={16} />
            Edit plan
          </Button>
        )}
      </PageHeader>
      {location.state?.justGenerated && (
        <div className="notice tone-emerald">
          <strong>Your plan is ready.</strong> Review your week, then start with
          one small step. <Link to="/dashboard">Go to Today →</Link>
        </div>
      )}
      {location.state?.notice && (
        <p className="notice">{location.state.notice}</p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {template && (
        <div className="notice tone-amber">
          <strong>Starter plan · AI was unavailable</strong>
          <p style={{ margin: "8px 0" }}>
            This template uses your goal and equipment, but has not been
            personalized for your injuries, preferences, or history. Review it
            with a qualified trainer if you have limitations.
          </p>
          <Link to="/profile">Try generating a personalized plan →</Link>
        </div>
      )}
      <div className="plan-overview">
        {[
          ["Your focus", GOALS[meta.goal] || "Your goal"],
          ["Weekly rhythm", `${days.length} days`],
          [
            "Planning horizon",
            `${meta.timeframe?.weeks || meta.timeframeWeeks || "—"} weeks`,
          ],
        ].map(([label, value]) => (
          <div className="stat-card" key={label}>
            <div className="stat-label">{label}</div>
            <div
              className="stat-value"
              style={{ fontSize: "1.3rem", marginTop: 14 }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={save}>
        <fieldset disabled={saving}>
          <div className="section-heading">
            <h2>Your training week</h2>
            <SourceBadge source={template ? "fallback" : meta.source} />
          </div>
          {days.map((day, i) => (
            <section key={i} className="plan-day">
              <div className="plan-day-header">
                <span className="exercise-index">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {editing ? (
                  <input
                    className="field"
                    aria-label={`Name of day ${i + 1}`}
                    maxLength={60}
                    required
                    value={day.name}
                    onChange={(e) => dayChange(i, { name: e.target.value })}
                  />
                ) : (
                  <h3 style={{ flex: 1, margin: 0 }}>{day.name}</h3>
                )}
                {editing ? (
                  <button
                    type="button"
                    className="ghost-button"
                    aria-label={`Remove day ${day.name}`}
                    onClick={() => setRemove(i)}
                  >
                    <Icon name="close" size={17} />
                  </button>
                ) : (
                  <span className="chip">{day.exercises.length} exercises</span>
                )}
              </div>
              {day.exercises.map((ex, j) =>
                editing ? (
                  <div key={j} className="plan-exercise">
                    <input
                      required
                      maxLength={80}
                      aria-label={`Exercise ${j + 1} on day ${i + 1}`}
                      value={ex.name}
                      onChange={(e) =>
                        exerciseChange(i, j, { name: e.target.value })
                      }
                    />
                    <input
                      type="number"
                      aria-label={`Sets for ${ex.name}`}
                      min="1"
                      max="10"
                      step="1"
                      required
                      value={ex.sets}
                      onChange={(e) =>
                        exerciseChange(i, j, { sets: e.target.value })
                      }
                    />
                    <input
                      type="number"
                      aria-label={`Reps for ${ex.name}`}
                      min="1"
                      max="50"
                      step="1"
                      required
                      value={ex.reps}
                      onChange={(e) =>
                        exerciseChange(i, j, { reps: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      className="ghost-button"
                      aria-label={`Remove ${ex.name}`}
                      onClick={() =>
                        dayChange(i, {
                          exercises: day.exercises.filter((_, n) => n !== j),
                        })
                      }
                    >
                      <Icon name="close" size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="list-row" key={j}>
                    <div>
                      <strong style={{ fontSize: ".85rem", fontWeight: 500 }}>
                        {ex.name}
                      </strong>
                      {ex.notes && <div className="tiny muted">{ex.notes}</div>}
                    </div>
                    <span
                      className="small muted"
                      style={{ whiteSpace: "nowrap" }}
                    >
                      {ex.sets} × {ex.reps}
                      {ex.restSeconds ? (
                        <small
                          className="tiny"
                          style={{ display: "block", textAlign: "right" }}
                        >
                          {ex.restSeconds}s rest
                        </small>
                      ) : null}
                    </span>
                  </div>
                ),
              )}
              {editing && (
                <>
                  <p className="field-hint">Exercise · Sets · Reps</p>
                  <Button
                    variant="ghost"
                    disabled={day.exercises.length >= 12}
                    onClick={() =>
                      dayChange(i, {
                        exercises: [
                          ...day.exercises,
                          { name: "", sets: 3, reps: 10 },
                        ],
                      })
                    }
                  >
                    <Icon name="plus" size={15} />
                    Add exercise
                  </Button>
                </>
              )}
            </section>
          ))}
          {editing && (
            <Button
              variant="ghost"
              disabled={days.length >= 7}
              onClick={() => {
                setDays((d) => [
                  ...d,
                  {
                    name: `Day ${d.length + 1}`,
                    exercises: [{ name: "", sets: 3, reps: 10 }],
                  },
                ]);
                setNotice("");
              }}
            >
              <Icon name="plus" size={16} />
              Add training day
            </Button>
          )}
          {diet && (
            <section className="card" style={{ marginTop: 28 }}>
              <div className="section-heading">
                <h2>Your daily foundations</h2>
                <Icon name="fuel" />
              </div>
              {diet.maintenanceCalories && (
                <p className="small muted">
                  Estimated maintenance:{" "}
                  {Number(diet.maintenanceCalories).toLocaleString()} kcal/day.
                  Your target: {Number(diet.calorieTarget).toLocaleString()}{" "}
                  kcal/day. These are estimates from your profile, not
                  measurements of your metabolism.
                </p>
              )}
              <div className={editing ? "form-grid" : ""}>
                {FIELDS.map(([key, label, unit, min, max, step]) =>
                  editing ? (
                    <div key={key}>
                      <label className="label" htmlFor={`plan-${key}`}>
                        {label} · {unit}
                      </label>
                      <input
                        id={`plan-${key}`}
                        className="field"
                        type="number"
                        min={min}
                        max={max}
                        step={step}
                        required
                        value={diet[key] ?? ""}
                        onChange={(e) => {
                          setDiet((d) => ({ ...d, [key]: e.target.value }));
                          setNotice("");
                        }}
                      />
                      <p className="field-hint">
                        {min.toLocaleString()}–{max.toLocaleString()} {unit}
                      </p>
                    </div>
                  ) : (
                    <div className="list-row" key={key}>
                      <span className="small muted">{label}</span>
                      <strong className="small">
                        {Number(diet[key] || 0).toLocaleString()}{" "}
                        <span className="muted">{unit}</span>
                      </strong>
                    </div>
                  ),
                )}
              </div>
            </section>
          )}
          {meta.notes && !editing && <p className="notice">{meta.notes}</p>}
          {editing && (
            <div className="save-bar">
              <div>
                <p>
                  {dirty
                    ? "Unsaved changes · draft kept in this tab"
                    : "No changes yet"}
                </p>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => (dirty ? setDiscard(true) : setEditing(false))}
                >
                  Cancel editing
                </button>
              </div>
              <Button type="submit" disabled={saving || !dirty || !days.length}>
                {saving ? "Saving…" : "Save plan"}
                <Icon name="check" size={16} />
              </Button>
            </div>
          )}
          {error && (
            <p className="notice tone-red" role="alert">
              {error}
            </p>
          )}
        </fieldset>
      </form>
      <ConfirmDialog
        open={remove !== null}
        title="Remove this training day?"
        confirmLabel="Remove from draft"
        onCancel={() => setRemove(null)}
        onConfirm={() => {
          setDays((d) => d.filter((_, i) => i !== remove));
          setRemove(null);
        }}
      >
        <p>
          {days[remove]?.name} and its exercises will leave this draft. Nothing
          changes in your saved plan until you press Save plan.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={discard}
        title="Discard your edits?"
        confirmLabel="Discard draft"
        onCancel={() => setDiscard(false)}
        onConfirm={() => {
          const saved = JSON.parse(base);
          setDays(saved.days);
          setDiet(saved.diet);
          setEditing(false);
          setDiscard(false);
          setNotice("");
        }}
      >
        <p>Your saved plan and history stay unchanged.</p>
      </ConfirmDialog>
    </div>
  );
}
