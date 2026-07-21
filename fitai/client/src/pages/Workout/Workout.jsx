import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTodayChecklist, updateChecklistItem, logSet, getProgression, getTodaySets } from '../../services/workoutService';
import Button from '../../components/ui/Button';

const inputStyle = { width: '100%', marginBottom: 'var(--s2)' };

// Mid-session this page is read at arm's length, one-handed, in a hurry.
// Every control here clears 52px and every figure is tabular.
const fieldStyle = {
  width: '100%',
  minHeight: 56,
  fontSize: 'var(--t-h2)',
  fontWeight: 550,
  textAlign: 'center',
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '-0.02em',
};

/**
 * Guided session for one exercise from today's plan: prefilled targets,
 * the progression engine's suggestion, per-set logging. `initialSetsDone`
 * comes from the server so a refresh mid-session resumes where it left off.
 *
 * The card carries the whole hierarchy: a finished exercise collapses to a
 * quiet ruled row, an unfinished one stays a full surface with a 56px
 * keypad. That alone makes "what am I doing right now" unmistakable —
 * the next thing to do is simply the next thing that still has a card.
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

  // A cleared exercise recedes to a rule — done work gets quieter, so the
  // eye lands on what is still outstanding.
  if (done) {
    return (
      <div className="list-row" style={{ alignItems: 'baseline', gap: 'var(--s3)' }}>
        <span className="muted" style={{ minWidth: 0 }}>
          {exercise.name}
          {suggestion?.note && (
            <span className="tiny faint" style={{ display: 'block', marginTop: '0.15rem' }}>
              {suggestion.weightKg ? `Suggested: ${suggestion.weightKg}kg — ` : ''}{suggestion.note}
            </span>
          )}
        </span>
        <span className="mono faint" style={{ whiteSpace: 'nowrap' }}>
          ✓ {setsDone}/{exercise.sets} · All sets done
        </span>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 'var(--s4)', marginBottom: 'var(--s3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 'var(--s1) var(--s3)' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--t-h2)' }}>{exercise.name}</h3>
        {/* The set count is the number you glance at between sets — display
            size, tabular, so 2/4 and 3/4 occupy identical width. */}
        <span
          className="mono"
          style={{ fontSize: 'var(--t-h2)', fontWeight: 600, letterSpacing: '-0.02em', flex: 'none' }}
        >
          {setsDone}/{exercise.sets}
        </span>
      </div>

      <div className="eyebrow" style={{ marginTop: '0.15rem' }}>
        {setsDone}/{exercise.sets} sets · target {exercise.reps} reps
      </div>

      {/* Sets as pips: countable without reading, which is the whole point
          when you are three breaths into a rest period. */}
      <div style={{ display: 'flex', gap: '0.3rem', margin: 'var(--s3) 0 var(--s4)' }} aria-hidden="true">
        {Array.from({ length: exercise.sets }).map((_, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 'var(--r-pill)',
              background: i < setsDone ? 'var(--text)' : 'var(--bg1)',
            }}
          />
        ))}
      </div>

      {suggestion?.note && (
        <p className="small muted" style={{ margin: '0 0 var(--s3)' }}>
          {suggestion.weightKg ? <span className="mono" style={{ color: 'var(--text)' }}>{`Suggested: ${suggestion.weightKg}kg`}</span> : ''}
          {suggestion.weightKg ? ' — ' : ''}{suggestion.note}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s2)' }}>
        <label style={{ minWidth: 0 }}>
          <span className="eyebrow" style={{ display: 'block', marginBottom: '0.3rem' }}>kg</span>
          <input type="number" step="0.5" min="0" max="500" placeholder="kg" aria-label="Weight in kilograms" value={weight} onChange={(e) => setWeight(e.target.value)} style={fieldStyle} />
        </label>
        <label style={{ minWidth: 0 }}>
          <span className="eyebrow" style={{ display: 'block', marginBottom: '0.3rem' }}>reps</span>
          <input type="number" min="1" max="100" placeholder="reps" aria-label="Reps completed" value={reps} onChange={(e) => setReps(e.target.value)} style={fieldStyle} />
        </label>
      </div>

      {/* One target, full width, unmissable with a thumb. */}
      <Button type="button" disabled={busy} onClick={logOneSet} className="btn btn-primary btn-block" style={{ minHeight: 56, marginTop: 'var(--s3)', fontSize: 'var(--t-body)' }}>
        {busy ? 'Saving…' : `Log set ${setsDone + 1}`}
      </Button>

      {error && <p className="error-text small" style={{ margin: 'var(--s2) 0 0' }}>{error}</p>}
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
        <div className="notice tone-red" style={{ padding: 'var(--s4)', marginBottom: 'var(--s4)' }}>
          <p style={{ margin: '0 0 var(--s3)', color: 'var(--text)' }}>Couldn't load today's session: {loadError}</p>
          <Button type="button" onClick={load}>Try again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page page-mid page-enter">
      <header className="page-header">
        <div>
          <p className="eyebrow" style={{ margin: '0 0 var(--s1)' }}>Today's session</p>
          <h2 className="page-title" style={{ marginBottom: 0 }}>
            {isWorkoutDay ? workout.dayName : 'Workout'}
          </h2>
        </div>
        {isWorkoutDay && workout.intensity === 'reduced' && (
          <span className="chip tone-amber">reduced intensity</span>
        )}
      </header>

      {/* ---- Today's session, from the plan ---- */}
      <section style={{ marginBottom: 'var(--s7)' }}>
        {isWorkoutDay ? (
          <>
            {(checklist.plan_snapshot.adaptations || []).map((a) => (
              <p key={a.code} className="notice">{a.message}</p>
            ))}

            <div style={{ marginTop: 'var(--s4)' }}>
              {workout.exercises.map((ex, i) => (
                <ExerciseCard
                  key={`${ex.name}-${i}`}
                  exercise={ex}
                  initialSetsDone={Math.min(todaySets[ex.name] || 0, ex.sets)}
                  onSetLogged={() => setTotalSetsLogged((n) => n + 1)}
                />
              ))}
            </div>

            {/* The session's terminal action, given its own air above a rule
                so it never reads as one more exercise control. */}
            <div style={{ marginTop: 'var(--s5)', paddingTop: 'var(--s4)', borderTop: '1px solid var(--border)' }}>
              {alreadyDone ? (
                <p className="small muted" style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 'var(--s3)', flexWrap: 'wrap' }}>
                  <span>✓ Workout checked off for today.</span>
                  <Link to="/dashboard" className="small">Back to Today →</Link>
                </p>
              ) : (
                <Button type="button" disabled={finishing || totalSetsLogged === 0} onClick={finishSession} className="btn btn-primary btn-block" style={{ minHeight: 56, fontSize: 'var(--t-body)' }}>
                  {finishing ? 'Saving…' : totalSetsLogged === 0 ? 'Log a set to finish the session' : 'Finish session'}
                </Button>
              )}
            </div>
          </>
        ) : workout?.type === 'rest' ? (
          <div className="card">
            <h3 style={{ margin: '0 0 var(--s2)' }}>Rest day.</h3>
            <p className="small muted" style={{ margin: 0 }}>
              Recovery is part of the program — easy walk, mobility, sleep. You can still quick-log ad-hoc training below.
            </p>
          </div>
        ) : !checklist?.plan_snapshot ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--s6) var(--s5)' }}>
            <p className="muted" style={{ margin: 0 }}>
              You don't have a plan yet — <Link to="/onboarding">complete onboarding</Link> to get your program.
            </p>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--s6) var(--s5)' }}>
            <p className="muted" style={{ margin: 0 }}>
              No workout is scheduled for today. You can still quick-log ad-hoc training below.
            </p>
          </div>
        )}
      </section>

      {/* ---- Quick log (collapsed: the exception path, not the main one) ---- */}
      <section>
        <details>
          <summary className="eyebrow" style={{ cursor: 'pointer', padding: 'var(--s3) 0', borderTop: '1px solid var(--border)' }}>
            Log something outside the plan
          </summary>
          <form onSubmit={handleQuickLog} style={{ marginTop: 'var(--s3)' }}>
            <input placeholder="Exercise name" value={form.exerciseName} onChange={(e) => setForm((f) => ({ ...f, exerciseName: e.target.value }))} required style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s2)' }}>
              <input placeholder="Weight (kg)" type="number" step="0.5" min="0" value={form.weightKg} onChange={(e) => setForm((f) => ({ ...f, weightKg: e.target.value }))} required style={{ ...inputStyle, minHeight: 52, fontVariantNumeric: 'tabular-nums' }} />
              <input placeholder="Reps" type="number" min="1" value={form.reps} onChange={(e) => setForm((f) => ({ ...f, reps: e.target.value }))} required style={{ ...inputStyle, minHeight: 52, fontVariantNumeric: 'tabular-nums' }} />
            </div>
            <Button type="submit" variant="ghost" disabled={quickBusy} style={{ minHeight: 48 }}>{quickBusy ? 'Saving…' : 'Log set'}</Button>
          </form>
          {quickResult && (
            <p className="notice" style={{ marginTop: 'var(--s3)' }}>
              <strong style={{ color: 'var(--text)' }}>Next session:</strong>{' '}
              <span className="mono">{quickResult.weightKg ? `${quickResult.weightKg}kg` : 'no prior data'}</span> — {quickResult.note}
            </p>
          )}
        </details>
      </section>

      {error && <p className="error-text" style={{ marginTop: 'var(--s4)' }}>{error}</p>}
    </div>
  );
}
