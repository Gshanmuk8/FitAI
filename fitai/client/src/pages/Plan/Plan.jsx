import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getPlan, updatePlan } from '../../services/planService';
import Button from '../../components/ui/Button';
import ButtonLink from '../../components/ui/ButtonLink';

const DIET_FIELDS = [
  { key: 'calorieTarget', label: 'Calories (kcal/day)', min: 1200, max: 6000 },
  { key: 'proteinGrams', label: 'Protein (g/day)', min: 40, max: 400 },
  { key: 'waterMl', label: 'Water (ml/day)', min: 1000, max: 8000 },
  { key: 'stepsTarget', label: 'Steps (per day)', min: 1000, max: 40000 },
  { key: 'sleepHours', label: 'Sleep (hours)', min: 5, max: 12 },
];

const inputStyle = { width: '100%', marginBottom: '0.5rem' };
const smallInput = { width: 70, marginRight: '0.5rem' };

export default function Plan() {
  const [days, setDays] = useState(null);
  const [diet, setDiet] = useState(null);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState({ loading: true, saving: false, error: '', saved: false });
  // Set when arriving from onboarding (justGenerated) or a regenerate
  // (notice) — this page owns the "here's your new plan" moment.
  const location = useLocation();
  const arrival = location.state || {};

  useEffect(() => {
    getPlan()
      .then(({ plan, planStartedAt, timeframeWeeks }) => {
        setDays(plan.days || []);
        setDiet(plan.diet || null);
        setMeta({ goal: plan.goal, timeframe: plan.timeframe, planStartedAt, timeframeWeeks, customized: plan.customized });
        setStatus((s) => ({ ...s, loading: false }));
      })
      .catch((err) => setStatus((s) => ({ ...s, loading: false, error: err.message })));
  }, []);

  function updateDay(dayIdx, patch) {
    // Any edit invalidates a previous "Plan saved." message.
    setStatus((s) => (s.saved ? { ...s, saved: false } : s));
    setDays((d) => d.map((day, i) => (i === dayIdx ? { ...day, ...patch } : day)));
  }
  function updateExercise(dayIdx, exIdx, patch) {
    setDays((d) =>
      d.map((day, i) =>
        i === dayIdx
          ? { ...day, exercises: day.exercises.map((ex, j) => (j === exIdx ? { ...ex, ...patch } : ex)) }
          : day
      )
    );
  }
  function addExercise(dayIdx) {
    updateDay(dayIdx, { exercises: [...days[dayIdx].exercises, { name: 'New exercise', sets: 3, reps: 10 }] });
  }
  function removeExercise(dayIdx, exIdx) {
    updateDay(dayIdx, { exercises: days[dayIdx].exercises.filter((_, j) => j !== exIdx) });
  }
  function addDay() {
    setDays((d) => [...d, { name: `Day ${d.length + 1}`, exercises: [{ name: 'New exercise', sets: 3, reps: 10 }] }]);
  }
  function removeDay(dayIdx) {
    // A whole training day (with all its exercises) is real work to rebuild
    // — confirm before discarding, matching the meal-delete convention.
    const day = days[dayIdx];
    if (day?.exercises?.length && !window.confirm(`Remove "${day.name}" and its ${day.exercises.length} exercises?`)) return;
    setStatus((s) => (s.saved ? { ...s, saved: false } : s));
    setDays((d) => d.filter((_, i) => i !== dayIdx));
  }

  async function handleSave() {
    setStatus((s) => ({ ...s, saving: true, error: '', saved: false }));
    try {
      const payload = {
        days: days.map((day) => ({
          name: day.name,
          exercises: day.exercises.map((ex) => ({
            name: ex.name,
            sets: Number(ex.sets),
            reps: Number(ex.reps),
            ...(ex.restSeconds != null && ex.restSeconds !== '' ? { restSeconds: Number(ex.restSeconds) } : {}),
            ...(ex.notes ? { notes: ex.notes } : {}),
          })),
        })),
        ...(diet ? { diet: Object.fromEntries(DIET_FIELDS.filter(({ key }) => diet[key] != null && diet[key] !== '').map(({ key }) => [key, Number(diet[key])])) } : {}),
      };
      const { plan } = await updatePlan(payload);
      setDays(plan.days || []);
      setDiet(plan.diet || null);
      setStatus((s) => ({ ...s, saving: false, saved: true }));
    } catch (err) {
      setStatus((s) => ({ ...s, saving: false, error: err.message }));
    }
  }

  if (status.loading) return <div className="page-loading">Loading your plan editor…</div>;
  if (status.error && !days) {
    // Only a genuine "no plan yet" should point at onboarding — a network
    // blip must offer a retry, or an established user could be led into
    // re-onboarding (which regenerates the plan and resets the timeline).
    const noPlanYet = /no plan found/i.test(status.error);
    return (
      <div className="page page-mid page-enter">
        <h2 className="page-title">Your plan</h2>
        <p className="muted">{status.error}</p>
        {noPlanYet ? (
          <ButtonLink to="/onboarding">Complete onboarding</ButtonLink>
        ) : (
          <Button type="button" onClick={() => window.location.reload()}>Try again</Button>
        )}
      </div>
    );
  }

  return (
    <div className="page page-mid page-enter">
      <header className="page-header">
        <h2 className="page-title">Your plan</h2>
        <Link to="/dashboard" className="small">Go to Today →</Link>
      </header>

      {arrival.justGenerated && (
        <p className="notice tone-emerald">
          <strong>Your plan is ready.</strong> Review it below and tweak anything — then head to Today to start.
        </p>
      )}
      {arrival.notice && <p className="notice">{arrival.notice}</p>}

      {meta && (
        <p className="muted">
          Goal: {meta.goal?.replace(/_/g, ' ')} · Timeframe: {meta.timeframe?.weeks || meta.timeframeWeeks || '—'} weeks
          {meta.customized ? ' · customized by you' : ''}
        </p>
      )}
      <p className="small muted">
        Your edits are saved to your live plan — tomorrow's daily mission uses them, and the coach learns which
        exercises you add or remove. Editing never resets your goal timeline.
      </p>

      <section>
        <h3 className="section-title">Workout days</h3>
        {days.map((day, dayIdx) => (
          <div key={dayIdx} className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input value={day.name} onChange={(e) => updateDay(dayIdx, { name: e.target.value })} style={{ flex: 1 }} />
              <Button variant="ghost" type="button" onClick={() => removeDay(dayIdx)}>Remove day</Button>
            </div>
            {day.exercises.map((ex, exIdx) => (
              <div key={exIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                <input value={ex.name} onChange={(e) => updateExercise(dayIdx, exIdx, { name: e.target.value })} style={{ flex: 2, minWidth: 140 }} />
                <input type="number" min="1" max="10" value={ex.sets} onChange={(e) => updateExercise(dayIdx, exIdx, { sets: e.target.value })} style={smallInput} title="Sets" />
                <span style={{ opacity: 0.6 }}>×</span>
                <input type="number" min="1" max="50" value={ex.reps} onChange={(e) => updateExercise(dayIdx, exIdx, { reps: e.target.value })} style={smallInput} title="Reps" />
                <Button variant="ghost" type="button" aria-label={`Remove ${ex.name || 'exercise'}`} onClick={() => removeExercise(dayIdx, exIdx)}>✕</Button>
              </div>
            ))}
            <Button variant="ghost" type="button" onClick={() => addExercise(dayIdx)}>+ Add exercise</Button>
          </div>
        ))}
        {days.length < 7 && <Button variant="ghost" type="button" onClick={addDay}>+ Add workout day</Button>}
        {days.length === 0 && (
          <p className="small muted">A plan needs at least one workout day — add one to enable saving.</p>
        )}
      </section>

      {diet && (
        <section style={{ marginTop: '1.5rem' }}>
          <h3 className="section-title">Daily diet & lifestyle targets</h3>
          {DIET_FIELDS.map(({ key, label, min, max }) => (
            <label key={key} style={{ display: 'block', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.85rem' }}>{label} <em style={{ opacity: 0.5 }}>({min}–{max})</em></span>
              <input
                type="number"
                min={min}
                max={max}
                value={diet[key] ?? ''}
                onChange={(e) => {
                  setStatus((s) => (s.saved ? { ...s, saved: false } : s));
                  setDiet((d) => ({ ...d, [key]: e.target.value }));
                }}
                style={inputStyle}
              />
            </label>
          ))}
        </section>
      )}

      {status.error && <p className="error-text">{status.error}</p>}
      {status.saved && <p className="success-text">Plan saved.</p>}
      <Button type="button" onClick={handleSave} disabled={status.saving || !days.length}>
        {status.saving ? 'Saving…' : 'Save plan'}
      </Button>
    </div>
  );
}
