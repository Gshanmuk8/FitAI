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

// The plan is a DOCUMENT you can type into, not a form. So the fields state
// their edge as a hairline and nothing else until you engage them — the
// focus ring in theme.css is what announces "you are editing this".
const quietField = {
  width: '100%',
  background: 'transparent',
  borderColor: 'var(--border)',
};
const numberField = {
  ...quietField,
  width: 64,
  textAlign: 'center',
  fontVariantNumeric: 'tabular-nums',
  padding: '0.5rem 0.35rem',
};

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
        setMeta({
          goal: plan.goal, timeframe: plan.timeframe, planStartedAt, timeframeWeeks,
          customized: plan.customized,
          // A plan the coach never wrote must say so. generatedBy is set by
          // the fallback engine; source is set by the orchestrator.
          isTemplate: plan.generatedBy === 'fallback_template' || plan.source === 'fallback',
        });
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
        <div className="notice tone-red" style={{ padding: 'var(--s4)', marginBottom: 'var(--s4)' }}>
          <p className="muted" style={{ margin: '0 0 var(--s3)' }}>{status.error}</p>
          {noPlanYet ? (
            <ButtonLink to="/onboarding">Complete onboarding</ButtonLink>
          ) : (
            <Button type="button" onClick={() => window.location.reload()}>Try again</Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page page-mid page-enter">
      <header className="page-header">
        <div>
          <p className="eyebrow" style={{ margin: '0 0 var(--s1)' }}>Editable · saved to your live plan</p>
          <h2 className="page-title" style={{ marginBottom: 0 }}>Your plan</h2>
        </div>
        <Link to="/dashboard" className="small">Go to Today →</Link>
      </header>

      {arrival.justGenerated && (
        <p className="notice tone-emerald">
          <strong>Your plan is ready.</strong> Review it below and tweak anything — then head to Today to start.
        </p>
      )}
      {arrival.notice && <p className="notice">{arrival.notice}</p>}

      {/* The single most important thing this page can tell you: whether a
          human-shaped coach actually read your profile, or whether the
          providers were unreachable and you are looking at a starter
          template. The template ignores your training style, your injuries
          and your history — it only knows your goal and your equipment — so
          presenting it silently reads as "the AI ignored everything I told
          it", which is exactly what it looks like from the outside. */}
      {meta.isTemplate && (
        <div className="notice tone-amber" style={{ padding: 'var(--s4)', marginBottom: 'var(--s4)' }}>
          <strong style={{ color: 'var(--text)' }}>This is a starter template, not your coach's plan.</strong>
          <p className="small" style={{ margin: 'var(--s2) 0 0' }}>
            Your coach couldn't be reached when this plan was generated, so the app fell back to a
            general plan built only from your goal and your equipment. It does not reflect your
            training style, your injuries or your logged history. Regenerate from your profile to get
            a plan written for you.
          </p>
          <p style={{ margin: 'var(--s3) 0 0' }}>
            <Link to="/profile">Regenerate my plan →</Link>
          </p>
        </div>
      )}

      {/* The document's colophon: what this plan is, and what editing it
          does. Set as metadata under a rule, not as body copy. */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--s3)', marginTop: 'var(--s4)' }}>
        {meta && (
          <p className="eyebrow" style={{ margin: '0 0 var(--s2)' }}>
            Goal: {meta.goal?.replace(/_/g, ' ')} · Timeframe: {meta.timeframe?.weeks || meta.timeframeWeeks || '—'} weeks
            {meta.customized ? ' · customized by you' : ''}
          </p>
        )}
        <p className="small muted" style={{ margin: 0, maxWidth: '58ch' }}>
          Your edits are saved to your live plan — tomorrow's daily mission uses them, and the coach learns which
          exercises you add or remove. Editing never resets your goal timeline.
        </p>
      </div>

      <section>
        <h3 className="section-title">Workout days</h3>

        {days.map((day, dayIdx) => (
          // A day is a section of the document: its name is set at heading
          // size in the field itself, on a rule, with its exercises as rows
          // beneath. No card edge — the rule is the structure.
          <div key={dayIdx} style={{ marginBottom: 'var(--s6)' }}>
            <div
              style={{
                display: 'flex',
                gap: 'var(--s2)',
                alignItems: 'center',
                paddingBottom: 'var(--s2)',
                borderBottom: '1px solid var(--border2)',
              }}
            >
              <input
                value={day.name}
                aria-label={`Name of day ${dayIdx + 1}`}
                onChange={(e) => updateDay(dayIdx, { name: e.target.value })}
                style={{
                  ...quietField,
                  flex: 1,
                  minWidth: 0,
                  fontSize: 'var(--t-h2)',
                  fontWeight: 600,
                  letterSpacing: '-0.024em',
                  borderColor: 'transparent',
                  padding: '0.35rem 0.5rem',
                  margin: '0 0 0 -0.5rem',
                }}
              />
              <button type="button" className="ghost-button" onClick={() => removeDay(dayIdx)} style={{ flex: 'none' }}>
                Remove day
              </button>
            </div>

            {day.exercises.map((ex, exIdx) => (
              <div
                key={exIdx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--s2)',
                  padding: 'var(--s2) 0',
                  borderBottom: '1px solid var(--border)',
                  flexWrap: 'wrap',
                }}
              >
                <input
                  value={ex.name}
                  aria-label="Exercise name"
                  onChange={(e) => updateExercise(dayIdx, exIdx, { name: e.target.value })}
                  style={{ ...quietField, flex: '2 1 150px', minWidth: 120, borderColor: 'transparent', margin: '0 0 0 -0.5rem' }}
                />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flex: 'none' }}>
                  <input type="number" min="1" max="10" value={ex.sets} onChange={(e) => updateExercise(dayIdx, exIdx, { sets: e.target.value })} style={numberField} title="Sets" aria-label="Sets" />
                  <span className="faint mono" aria-hidden="true">×</span>
                  <input type="number" min="1" max="50" value={ex.reps} onChange={(e) => updateExercise(dayIdx, exIdx, { reps: e.target.value })} style={numberField} title="Reps" aria-label="Reps" />
                </span>
                <button
                  type="button"
                  className="ghost-button"
                  aria-label={`Remove ${ex.name || 'exercise'}`}
                  onClick={() => removeExercise(dayIdx, exIdx)}
                  style={{ flex: 'none', minWidth: 32, color: 'var(--faint)' }}
                >
                  ✕
                </button>
              </div>
            ))}

            <button type="button" className="ghost-button" onClick={() => addExercise(dayIdx)} style={{ marginTop: 'var(--s2)' }}>
              + Add exercise
            </button>
          </div>
        ))}

        {days.length < 7 && <Button variant="ghost" type="button" onClick={addDay}>+ Add workout day</Button>}
        {days.length === 0 && (
          <p
            className="small muted"
            style={{
              margin: 'var(--s3) 0 0',
              padding: 'var(--s6) var(--s4)',
              textAlign: 'center',
              border: '1px dashed var(--border2)',
              borderRadius: 'var(--r-lg)',
            }}
          >
            A plan needs at least one workout day — add one to enable saving.
          </p>
        )}
      </section>

      {diet && (
        <section>
          <h3 className="section-title">Daily diet &amp; lifestyle targets</h3>

          {/* A bare calorie number invites the wrong reading. A very active
              user on a cut gets ~2,700 kcal and reasonably asks why their
              "deficit plan" feeds them more than they currently eat. Stating
              the target against maintenance turns it from an assertion into
              an argument — and it is the same pair of figures the coach is
              given, so the page and the AI can never disagree. */}
          {diet.maintenanceCalories != null && (
            <p className="notice" style={{ marginBottom: 'var(--s4)' }}>
              Your maintenance is about{' '}
              <span className="mono" style={{ color: 'var(--text)' }}>
                {Number(diet.maintenanceCalories).toLocaleString()}
              </span>{' '}
              kcal/day.{' '}
              {diet.calorieDirection === 'deficit' && (
                <>
                  This plan targets{' '}
                  <span className="mono" style={{ color: 'var(--text)' }}>
                    {Number(diet.calorieTarget).toLocaleString()}
                  </span>{' '}
                  — a {Math.abs(diet.calorieDelta).toLocaleString()} kcal daily deficit.
                </>
              )}
              {diet.calorieDirection === 'surplus' && (
                <>
                  This plan targets{' '}
                  <span className="mono" style={{ color: 'var(--text)' }}>
                    {Number(diet.calorieTarget).toLocaleString()}
                  </span>{' '}
                  — a {Math.abs(diet.calorieDelta).toLocaleString()} kcal daily surplus to fuel the build.
                </>
              )}
              {diet.calorieDirection === 'maintenance' && <>This plan holds you there.</>}
            </p>
          )}
          {/* Label left, value right, on a rule: the same ledger reading as
              the rest of the document, so the numbers form one column. */}
          {DIET_FIELDS.map(({ key, label, min, max }) => (
            <label
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--s3)',
                padding: 'var(--s2) 0',
                borderBottom: '1px solid var(--border)',
                flexWrap: 'wrap',
              }}
            >
              <span className="small" style={{ minWidth: 0 }}>
                {label} <em className="faint" style={{ fontStyle: 'italic' }}>({min}–{max})</em>
              </span>
              <input
                type="number"
                min={min}
                max={max}
                value={diet[key] ?? ''}
                onChange={(e) => {
                  setStatus((s) => (s.saved ? { ...s, saved: false } : s));
                  setDiet((d) => ({ ...d, [key]: e.target.value }));
                }}
                style={{ ...quietField, width: 120, textAlign: 'right', fontVariantNumeric: 'tabular-nums', flex: 'none' }}
              />
            </label>
          ))}
        </section>
      )}

      {/* The save bar: the document's one committing action, under a rule,
          with its status beside it rather than floating above it. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--s3)',
          flexWrap: 'wrap',
          marginTop: 'var(--s6)',
          paddingTop: 'var(--s4)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <Button type="button" onClick={handleSave} disabled={status.saving || !days.length}>
          {status.saving ? 'Saving…' : 'Save plan'}
        </Button>
        {status.saved && <p className="small muted" style={{ margin: 0 }}>Plan saved.</p>}
        {status.error && <p className="error-text small" style={{ margin: 0 }}>{status.error}</p>}
      </div>
    </div>
  );
}
