import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTodayChecklist, updateChecklistItem, logSet, getProgression } from '../../services/workoutService';
import Button from '../../components/ui/Button';

const inputStyle = { width: '100%', marginBottom: '0.75rem' };

/**
 * Guided session for one exercise from today's plan: prefilled targets,
 * the progression engine's suggestion, per-set logging.
 */
function ExerciseCard({ exercise, onSetLogged }) {
  const [suggestion, setSuggestion] = useState(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState(String(exercise.reps || ''));
  const [setsDone, setSetsDone] = useState(0);
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
    setBusy(true);
    setError('');
    try {
      await logSet({
        exerciseName: exercise.name,
        weightKg: Number(weight) || 0,
        reps: Number(reps) || 0,
        setNumber: setsDone + 1,
        completedAllReps: Number(reps) >= exercise.reps,
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
    <div className="intelligence-card" style={{ padding: '0.9rem', marginBottom: '0.75rem', opacity: done ? 0.65 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong>{exercise.name}</strong>
        <span style={{ fontSize: '0.85rem' }}>{setsDone}/{exercise.sets} sets · target {exercise.reps} reps</span>
      </div>
      {suggestion?.note && (
        <p style={{ fontSize: '0.78rem', opacity: 0.7, margin: '0.3rem 0' }}>
          {suggestion.weightKg ? `Suggested: ${suggestion.weightKg}kg — ` : ''}{suggestion.note}
        </p>
      )}
      {!done ? (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="number" step="0.5" min="0" max="500" placeholder="kg" value={weight} onChange={(e) => setWeight(e.target.value)} style={{ width: 80 }} />
          <input type="number" min="0" max="100" placeholder="reps" value={reps} onChange={(e) => setReps(e.target.value)} style={{ width: 70 }} />
          <Button type="button" disabled={busy} onClick={logOneSet}>Log set {setsDone + 1}</Button>
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
  const [loading, setLoading] = useState(true);
  const [totalSetsLogged, setTotalSetsLogged] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState('');

  // Quick-log form for ad-hoc training outside the plan.
  const [form, setForm] = useState({ exerciseName: '', weightKg: '', reps: '', setNumber: '1', completedAllReps: true });
  const [quickResult, setQuickResult] = useState(null);

  useEffect(() => {
    getTodayChecklist()
      .then(setChecklist)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
    setError('');
    try {
      await logSet({
        exerciseName: form.exerciseName,
        weightKg: Number(form.weightKg),
        reps: Number(form.reps),
        setNumber: Number(form.setNumber),
        completedAllReps: form.completedAllReps,
      });
      setQuickResult(await getProgression(form.exerciseName));
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="page-loading">Loading today's session…</div>;

  return (
    <div className="page-enter" style={{ maxWidth: 560, margin: '2.5rem auto', padding: '0 2rem' }}>
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
            {workout.exercises.map((ex) => (
              <ExerciseCard key={ex.name} exercise={ex} onSetLogged={() => setTotalSetsLogged((n) => n + 1)} />
            ))}
            {alreadyDone ? (
              <p className="success-text">✓ Workout checked off for today.</p>
            ) : (
              <Button type="button" disabled={finishing || totalSetsLogged === 0} onClick={finishSession}>
                {finishing ? 'Saving…' : totalSetsLogged === 0 ? 'Log a set to finish the session' : 'Finish session ✓'}
              </Button>
            )}
          </>
        ) : workout?.type === 'rest' ? (
          <div className="intelligence-card" style={{ padding: '1rem' }}>
            <strong>Rest day.</strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', opacity: 0.75 }}>
              Recovery is part of the program — easy walk, mobility, sleep. You can still quick-log ad-hoc training below.
            </p>
          </div>
        ) : (
          <p style={{ opacity: 0.7 }}>
            No plan found for today. <Link to="/onboarding">Complete onboarding</Link> to get a program.
          </p>
        )}
      </section>

      {/* ---- Quick log ---- */}
      <section>
        <h3>Quick log</h3>
        <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: 0 }}>For sets outside today's plan.</p>
        <form onSubmit={handleQuickLog}>
          <input placeholder="Exercise name" value={form.exerciseName} onChange={(e) => setForm((f) => ({ ...f, exerciseName: e.target.value }))} required style={inputStyle} />
          <input placeholder="Weight (kg)" type="number" step="0.5" value={form.weightKg} onChange={(e) => setForm((f) => ({ ...f, weightKg: e.target.value }))} required style={inputStyle} />
          <input placeholder="Reps" type="number" value={form.reps} onChange={(e) => setForm((f) => ({ ...f, reps: e.target.value }))} required style={inputStyle} />
          <input placeholder="Set number" type="number" value={form.setNumber} onChange={(e) => setForm((f) => ({ ...f, setNumber: e.target.value }))} required style={inputStyle} />
          <label style={{ display: 'block', marginBottom: '0.75rem' }}>
            <input type="checkbox" checked={form.completedAllReps} onChange={(e) => setForm((f) => ({ ...f, completedAllReps: e.target.checked }))} /> Completed all reps
          </label>
          <Button type="submit">Log set</Button>
        </form>
        {quickResult && (
          <div className="intelligence-card" style={{ marginTop: '1rem', padding: '0.75rem' }}>
            <strong>Next session:</strong> {quickResult.weightKg ? `${quickResult.weightKg}kg` : 'no prior data'} — {quickResult.note}
          </div>
        )}
      </section>

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
