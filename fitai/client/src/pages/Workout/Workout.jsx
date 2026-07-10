import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTodayChecklist, updateChecklistItem, logSet, getProgression, getTodaySets } from '../../services/workoutService';
import Button from '../../components/ui/Button';

const inputStyle = { width: '100%', marginBottom: '0.75rem' };

/**
 * Guided session for one exercise from today's plan: prefilled targets,
 * the progression engine's suggestion, per-set logging. `initialSetsDone`
 * comes from the server so a refresh mid-session resumes where it left off.
 */
function ExerciseCard({ exercise, initialSetsDone = 0, onSetLogged }) {
  const [suggestion, setSuggestion] = useState(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState(String(exercise.reps || ''));
  const [setsDone, setSetsDone] = useState(initialSetsDone);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getProgression(exercise.name)
      .then((s) => {
        setSuggestion(s);
        if (s?.weightKg) setWeight(String(s.weightKg));
      })
      .catch(() => {});
  }, [exercise.name]);

  async function logOneSet() {
    const repsNum = Number(reps);
    if (!Number.isFinite(repsNum) || repsNum < 1) {
      setError('Enter the reps you completed first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await logSet({
        exerciseName: exercise.name,
        weightKg: Number(weight) || 0, // 0kg is legitimate for bodyweight work
        reps: repsNum,
        setNumber: setsDone + 1,
        completedAllReps: repsNum >= exercise.reps,
      });
      setSetsDone((n) => n + 1);
      onSetLogged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const done = setsDone >= exercise.sets;

  return (
    <div className="card" style={{ padding: '0.9rem', marginBottom: '0.75rem', opacity: done ? 0.65 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong>{exercise.name}</strong>
        <span className="small">{setsDone}/{exercise.sets} sets · target {exercise.reps} reps</span>
      </div>
      {suggestion?.note && (
        <p className="tiny muted" style={{ margin: '0.3rem 0' }}>
          {suggestion.weightKg ? `Suggested: ${suggestion.weightKg}kg — ` : ''}{suggestion.note}
        </p>
      )}
      {!done ? (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="number" step="0.5" min="0" max="500" placeholder="kg" value={weight} onChange={(e) => setWeight(e.target.value)} style={{ width: 80 }} />
          <input type="number" min="1" max="100" placeholder="reps" value={reps} onChange={(e) => setReps(e.target.value)} style={{ width: 70 }} />
          <Button type="button" disabled={busy} onClick={logOneSet}>{busy ? 'Saving…' : `Log set ${setsDone + 1}`}</Button>
        </div>
      ) : (
        <p className="success-text" style={{ margin: 0 }}>✓ All sets done</p>
      )}
      {error && <p className="error-text tiny">{error}</p>}
    </div>
  );
}

export default function Workout() {
  const [checklist, setChecklist] = useState(null);
  const [todaySets, setTodaySets] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [totalSetsLogged, setTotalSetsLogged] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState('');

  // Quick-log form for ad-hoc training outside the plan. No set-number
  // field: the system already counts today's sets per exercise. No
  // completed-all-reps checkbox: with no target to compare against it was a
  // decision the user shouldn't have to make.
  const [form, setForm] = useState({ exerciseName: '', weightKg: '', reps: '' });
  const [quickResult, setQuickResult] = useState(null);
  const [quickBusy, setQuickBusy] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      // today-sets is enrichment: if it fails we still render the session,
      // just without rehydrated counts.
      const [cl, sets] = await Promise.all([
        getTodayChecklist(),
        getTodaySets().catch(() => ({})),
      ]);
      setChecklist(cl);
      setTodaySets(sets);
      setTotalSetsLogged(Object.values(sets).reduce((sum, n) => sum + n, 0));
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const workout = checklist?.plan_snapshot?.workout;
  const isWorkoutDay = workout?.type === 'workout' && workout.exercises?.length > 0;
  const alreadyDone = Boolean(checklist?.workout_completed);

  async function finishSession() {
    setFinishing(true);
    setError('');
    try {
      const updated = await updateChecklistItem('workout_completed', true);
      setChecklist((c) => ({ ...c, ...updated }));
    } catch (err) {
      setError(err.message);
    } finally {
      setFinishing(false);
    }
  }

  async function handleQuickLog(e) {
    e.preventDefault();
    if (quickBusy) return;
    setQuickBusy(true);
    setError('');
    try {
      const name = form.exerciseName.trim();
      await logSet({
        exerciseName: name,
        weightKg: Number(form.weightKg),
        reps: Number(form.reps),
        setNumber: (todaySets[name] || 0) + 1, // the system counts sets
        completedAllReps: true, // ad-hoc sets have no target to fall short of
      });
      setTodaySets((prev) => ({ ...prev, [name]: (prev[name] || 0) + 1 }));
      setQuickResult(await getProgression(name));
    } catch (err) {
      setError(err.message);
    } finally {
      setQuickBusy(false);
    }
  }

  if (loading) return <div className="page-loading">Loading today's session…</div>;

  // A fetch failure is NOT "you're not onboarded" — offering onboarding here
  // would send an established user off to regenerate their plan over a blip.
  if (loadError) {
    return (
      <div className="page page-mid page-enter">
        <h2 className="page-title">Workout</h2>
        <p className="muted">Couldn't load today's session: {loadError}</p>
        <Button type="button" onClick={load}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="page page-narrow page-enter">
      <h2 className="page-title">Workout</h2>

      {/* ---- Today's session, from the plan ---- */}
      <section style={{ marginBottom: '2rem' }}>
        {isWorkoutDay ? (
          <>
            <h3 style={{ marginBottom: '0.25rem' }}>
              Today: {workout.dayName}
              {workout.intensity === 'reduced' && <span className="tone-amber-text tiny"> · reduced intensity</span>}
            </h3>
            {(checklist.plan_snapshot.adaptations || []).map((a) => (
              <p key={a.code} className="notice">{a.message}</p>
            ))}
            {workout.exercises.map((ex, i) => (
              <ExerciseCard
                key={`${ex.name}-${i}`}
                exercise={ex}
                initialSetsDone={Math.min(todaySets[ex.name] || 0, ex.sets)}
                onSetLogged={() => setTotalSetsLogged((n) => n + 1)}
              />
            ))}
            {alreadyDone ? (
              <p className="success-text">
                ✓ Workout checked off for today. <Link to="/dashboard" className="small">Back to Today →</Link>
              </p>
            ) : (
              <Button type="button" disabled={finishing || totalSetsLogged === 0} onClick={finishSession}>
                {finishing ? 'Saving…' : totalSetsLogged === 0 ? 'Log a set to finish the session' : 'Finish session'}
              </Button>
            )}
          </>
        ) : workout?.type === 'rest' ? (
          <div className="card" style={{ padding: '1rem' }}>
            <strong>Rest day.</strong>
            <p className="small muted" style={{ margin: '0.25rem 0 0' }}>
              Recovery is part of the program — easy walk, mobility, sleep. You can still quick-log ad-hoc training below.
            </p>
          </div>
        ) : !checklist?.plan_snapshot ? (
          <p className="muted">
            You don't have a plan yet — <Link to="/onboarding">complete onboarding</Link> to get your program.
          </p>
        ) : (
          <p className="muted">
            No workout is scheduled for today. You can still quick-log ad-hoc training below.
          </p>
        )}
      </section>

      {/* ---- Quick log (collapsed: the exception path, not the main one) ---- */}
      <section>
        <details>
          <summary className="muted" style={{ cursor: 'pointer' }}>Log something outside the plan</summary>
          <form onSubmit={handleQuickLog} style={{ marginTop: '0.75rem' }}>
            <input placeholder="Exercise name" value={form.exerciseName} onChange={(e) => setForm((f) => ({ ...f, exerciseName: e.target.value }))} required style={inputStyle} />
            <input placeholder="Weight (kg)" type="number" step="0.5" min="0" value={form.weightKg} onChange={(e) => setForm((f) => ({ ...f, weightKg: e.target.value }))} required style={inputStyle} />
            <input placeholder="Reps" type="number" min="1" value={form.reps} onChange={(e) => setForm((f) => ({ ...f, reps: e.target.value }))} required style={inputStyle} />
            <Button type="submit" disabled={quickBusy}>{quickBusy ? 'Saving…' : 'Log set'}</Button>
          </form>
          {quickResult && (
            <div className="card" style={{ marginTop: '1rem', padding: '0.75rem' }}>
              <strong>Next session:</strong> {quickResult.weightKg ? `${quickResult.weightKg}kg` : 'no prior data'} — {quickResult.note}
            </div>
          )}
        </details>
      </section>

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
