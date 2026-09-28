import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  getTodayChecklist,
  updateChecklistItem,
  logSet,
  getProgression,
  getTodaySets,
} from "../../services/workoutService";
import { workoutNumbers } from "../../utils/productState";
import Button from "../../components/ui/Button";
import ButtonLink from "../../components/ui/ButtonLink";
import Icon from "../../components/ui/Icon";
import {
  PageHeader,
  LoadingState,
  EmptyState,
  Ring,
  ConfirmDialog,
} from "../../components/ui/PageKit";

function Exercise({ exercise, index, count, open, onOpen, onLogged }) {
  const [suggestion, setSuggestion] = useState(null);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState(String(exercise.reps));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const touchedWeight = useRef(false);
  useEffect(() => {
    let active = true;
    getProgression(exercise.name)
      .then((value) => {
        if (active) {
          setSuggestion(value);
          if (!touchedWeight.current && value.weightKg != null)
            setWeight(String(value.weightKg));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [exercise.name]);
  async function save(e) {
    e.preventDefault();
    if (lock.current) return;
    setError("");
    let values;
    try {
      values = workoutNumbers(weight, reps);
    } catch (err) {
      setError(err.message);
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      await logSet({
        exerciseName: exercise.name,
        ...values,
        setNumber: count + 1,
        completedAllReps: values.reps >= exercise.reps,
      });
      onLogged(exercise.name, exercise.restSeconds ?? 60);
    } catch (err) {
      setError(err.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const done = count >= exercise.sets;
  return (
    <article className={`exercise-card${done ? " is-complete" : ""}`}>
      <button
        className="exercise-head"
        aria-expanded={open}
        aria-controls={`exercise-${index}`}
        onClick={onOpen}
      >
        <span className="exercise-index">
          {done ? (
            <Icon name="check" size={18} />
          ) : (
            String(index + 1).padStart(2, "0")
          )}
        </span>
        <span className="exercise-title">
          <strong>{exercise.name}</strong>
          <small>
            {exercise.sets} sets · {exercise.reps} reps
            {exercise.restSeconds ? ` · ${exercise.restSeconds}s rest` : ""}
          </small>
        </span>
        <span className="set-count">
          {Math.min(count, exercise.sets)}/{exercise.sets}
        </span>
        <Icon
          name="chevron"
          size={16}
          style={{ transform: open ? "rotate(90deg)" : undefined }}
        />
      </button>
      {open && (
        <div id={`exercise-${index}`} className="exercise-body">
          <div className="set-pips" aria-hidden="true">
            {Array.from({ length: exercise.sets }, (_, i) => (
              <span key={i} className={i < count ? "done" : ""} />
            ))}
          </div>
          {exercise.notes && <p className="small muted">{exercise.notes}</p>}
          {suggestion?.note && (
            <p className="small muted">
              {suggestion.weightKg != null
                ? `Suggested load: ${suggestion.weightKg} kg. `
                : ""}
              {suggestion.note}
            </p>
          )}
          {done ? (
            <p className="success-text small" role="status">
              All planned sets logged. Nicely done.
            </p>
          ) : (
            <form onSubmit={save}>
              <fieldset disabled={busy}>
                <div className="form-grid">
                  <div>
                    <label className="label" htmlFor={`kg-${index}`}>
                      Weight · kg
                    </label>
                    <input
                      id={`kg-${index}`}
                      className="field workout-input"
                      type="number"
                      min="0"
                      max="500"
                      step="0.5"
                      placeholder="0"
                      value={weight}
                      onChange={(e) => {
                        touchedWeight.current = true;
                        setWeight(e.target.value);
                      }}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`reps-${index}`}>
                      Reps completed
                    </label>
                    <input
                      id={`reps-${index}`}
                      className="field workout-input"
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      value={reps}
                      onChange={(e) => setReps(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <p className="field-hint">
                  Use 0 kg for bodyweight. Log what you actually completed.
                </p>
                <Button
                  type="submit"
                  className="btn-block"
                  style={{ marginTop: 20 }}
                >
                  {busy ? "Saving set…" : `Log set ${count + 1}`}
                  <Icon name="plus" size={17} />
                </Button>
              </fieldset>
            </form>
          )}
          {error && (
            <p className="error-text small" role="alert">
              {error}
            </p>
          )}
          <Link
            className="quiet-link"
            to="/tutor"
            state={{
              mode: "gym",
              question: `Help me with safe technique for ${exercise.name}.`,
            }}
          >
            Ask your coach about this movement
            <Icon name="coach" size={16} />
          </Link>
        </div>
      )}
    </article>
  );
}
export default function Workout() {
  const [checklist, setChecklist] = useState(null);
  const [sets, setSets] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [restUntil, setRestUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [quick, setQuick] = useState({
    exerciseName: "",
    weight: "",
    reps: "",
  });
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickNotice, setQuickNotice] = useState("");
  const quickLock = useRef(false);
  const finishLock = useRef(false);
  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      // Counts are essential, not optional enrichment. Logging against a
      // failed count request would quietly restart an existing session.
      const [row, counts] = await Promise.all([
        getTodayChecklist(),
        getTodaySets(),
      ]);
      setChecklist(row);
      setSets(counts);
      const first = row?.plan_snapshot?.workout?.exercises?.findIndex(
        (ex) => (counts[ex.name] || 0) < ex.sets,
      );
      setOpen(first >= 0 ? first : 0);
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!restUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [restUntil]);
  const workout = checklist?.plan_snapshot?.workout;
  const exercises = workout?.exercises || [];
  const planned = exercises.reduce((n, e) => n + Number(e.sets), 0);
  const done = exercises.reduce(
    (n, e) => n + Math.min(sets[e.name] || 0, e.sets),
    0,
  );
  const remaining = Math.max(0, Math.ceil((restUntil - now) / 1000));
  const complete = Boolean(checklist?.workout_completed);
  function logged(name, seconds) {
    setSets((current) => ({ ...current, [name]: (current[name] || 0) + 1 }));
    setNow(Date.now());
    setRestUntil(seconds ? Date.now() + seconds * 1000 : 0);
  }
  useEffect(() => {
    if (
      open < 0 ||
      !exercises[open] ||
      (sets[exercises[open].name] || 0) < exercises[open].sets
    )
      return;
    const nextIndex = exercises.findIndex((e) => (sets[e.name] || 0) < e.sets);
    if (nextIndex >= 0) setOpen(nextIndex);
  }, [sets]);
  async function finish() {
    if (finishLock.current) return;
    finishLock.current = true;
    setFinishing(true);
    setError("");
    try {
      const row = await updateChecklistItem("workout_completed", true);
      setChecklist((c) => ({ ...c, ...row }));
      setConfirmFinish(false);
      setRestUntil(0);
    } catch (e) {
      setError(e.message);
      setConfirmFinish(false);
    } finally {
      setFinishing(false);
      finishLock.current = false;
    }
  }
  async function quickLog(e) {
    e.preventDefault();
    if (quickLock.current) return;
    setError("");
    setQuickNotice("");
    let values;
    try {
      values = workoutNumbers(quick.weight, quick.reps);
      if (!quick.exerciseName.trim())
        throw new Error("Enter an exercise name.");
    } catch (err) {
      setError(err.message);
      return;
    }
    quickLock.current = true;
    setQuickBusy(true);
    try {
      const name = quick.exerciseName.trim();
      await logSet({
        exerciseName: name,
        ...values,
        setNumber: (sets[name] || 0) + 1,
        completedAllReps: true,
      });
      setSets((s) => ({ ...s, [name]: (s[name] || 0) + 1 }));
      setQuickNotice("Set saved to your training log.");
      // A failed suggestion is NOT a failed save. Never invite duplicate logs.
      getProgression(name)
        .then((p) => setQuickNotice(`Set saved. Next session: ${p.note}`))
        .catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setQuickBusy(false);
      quickLock.current = false;
    }
  }
  if (loading)
    return (
      <LoadingState
        title="Your session, ready for you"
        detail="Restoring your plan and every set already logged today."
      />
    );
  if (loadError)
    return (
      <div className="page">
        <EmptyState
          icon="refresh"
          title="Let’s reconnect your session."
          description={loadError}
        >
          <Button onClick={load}>Try again</Button>
        </EmptyState>
      </div>
    );
  return (
    <div className="page page-wide page-enter">
      <PageHeader
        eyebrow={
          workout?.type === "rest"
            ? "RECOVERY COUNTS, TOO"
            : "ONE GOOD SET AT A TIME"
        }
        title={
          workout?.type === "workout" ? workout.dayName : "Move with intention."
        }
        description={
          workout?.type === "workout"
            ? "Your targets are a guide. Your actual effort is what we log."
            : "Listen to your body. Make room for an easier day."
        }
      >
        <Link to="/plan" className="btn btn-ghost">
          View my plan
          <Icon name="plan" size={16} />
        </Link>
      </PageHeader>
      {(checklist?.plan_snapshot?.adaptations || []).map((a) => (
        <p className="notice" key={a.code}>
          {a.message}
        </p>
      ))}
      <div className="workout-layout">
        <div>
          {exercises.length ? (
            exercises.map((exercise, i) => (
              <Exercise
                key={`${exercise.name}-${i}`}
                exercise={exercise}
                index={i}
                count={sets[exercise.name] || 0}
                open={open === i}
                onOpen={() => setOpen(open === i ? -1 : i)}
                onLogged={logged}
              />
            ))
          ) : (
            <EmptyState
              icon="moon"
              title={
                workout?.type === "rest"
                  ? "Rest is part of the plan."
                  : "Your next session starts with a plan."
              }
              description={
                workout?.type === "rest"
                  ? "A walk, some gentle mobility, or simply a quieter day. You don’t have to earn recovery."
                  : "Set up your training preferences to get a session built around you."
              }
            >
              <ButtonLink
                to={workout?.type === "rest" ? "/tutor" : "/onboarding"}
                state={
                  workout?.type === "rest" ? { mode: "recovery" } : undefined
                }
                variant="ghost"
              >
                {workout?.type === "rest"
                  ? "Talk to your recovery coach"
                  : "Set up my plan"}
              </ButtonLink>
            </EmptyState>
          )}
          <details className="card" style={{ marginTop: 22 }}>
            <summary style={{ cursor: "pointer", fontWeight: 500 }}>
              Doing something different? Quick-log a set.
            </summary>
            <form onSubmit={quickLog}>
              <fieldset disabled={quickBusy}>
                <label className="label" htmlFor="quick-exercise">
                  Exercise
                </label>
                <input
                  className="field"
                  id="quick-exercise"
                  required
                  maxLength={120}
                  placeholder="e.g. Goblet squat"
                  value={quick.exerciseName}
                  onChange={(e) =>
                    setQuick({ ...quick, exerciseName: e.target.value })
                  }
                />
                <div className="form-grid">
                  <div>
                    <label className="label" htmlFor="quick-weight">
                      Weight · kg
                    </label>
                    <input
                      className="field"
                      id="quick-weight"
                      type="number"
                      min="0"
                      max="500"
                      step="0.5"
                      placeholder="0 for bodyweight"
                      value={quick.weight}
                      onChange={(e) =>
                        setQuick({ ...quick, weight: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="quick-reps">
                      Reps
                    </label>
                    <input
                      className="field"
                      id="quick-reps"
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      required
                      value={quick.reps}
                      onChange={(e) =>
                        setQuick({ ...quick, reps: e.target.value })
                      }
                    />
                  </div>
                </div>
                <Button type="submit" variant="ghost" style={{ marginTop: 20 }}>
                  {quickBusy ? "Saving…" : "Log extra set"}
                </Button>
              </fieldset>
            </form>
            {quickNotice && (
              <p className="small success-text" role="status">
                {quickNotice}
              </p>
            )}
          </details>
        </div>
        <aside className="workout-sidebar">
          {planned > 0 && (
            <section className="card session-summary">
              <Ring
                value={done}
                total={planned}
                size={130}
                label={`${done} of ${planned} planned sets logged`}
              />
              <div>
                <h3>
                  {complete
                    ? "Session in the books."
                    : done
                      ? "You’re doing the work."
                      : "A fresh start."}
                </h3>
                <p>
                  {complete
                    ? "Your effort is saved. Take time to recover."
                    : `${done} of ${planned} planned sets logged.`}
                </p>
              </div>
              {complete ? (
                <ButtonLink to="/dashboard" variant="ghost">
                  Back to Today
                  <Icon name="check" size={16} />
                </ButtonLink>
              ) : (
                <Button
                  className="btn-block"
                  style={{ marginTop: 20 }}
                  disabled={!done || finishing}
                  onClick={() =>
                    done < planned ? setConfirmFinish(true) : finish()
                  }
                >
                  {finishing ? "Saving session…" : "Finish session"}
                </Button>
              )}
            </section>
          )}
          {remaining > 0 && (
            <div
              className="rest-timer"
              role="timer"
              aria-label="Suggested rest remaining"
            >
              <span>
                Take a breath
                <br />
                <strong>
                  {Math.floor(remaining / 60)}:
                  {String(remaining % 60).padStart(2, "0")}
                </strong>
              </span>
              <button className="ghost-button" onClick={() => setRestUntil(0)}>
                Skip rest
              </button>
            </div>
          )}
          <p className="field-hint" style={{ marginTop: 18 }}>
            Stop if an exercise causes pain. Your plan is guidance, not a
            medical assessment.
          </p>
        </aside>
      </div>
      {error && (
        <p className="notice tone-red" role="alert">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={confirmFinish}
        title="Call it a session?"
        confirmLabel="Finish with logged sets"
        busy={finishing}
        onCancel={() => setConfirmFinish(false)}
        onConfirm={finish}
      >
        <p>
          You logged {done} of {planned} planned sets. We’ll mark today’s
          session finished and keep only the sets you actually logged. Stopping
          early is okay.
        </p>
      </ConfirmDialog>
    </div>
  );
}
