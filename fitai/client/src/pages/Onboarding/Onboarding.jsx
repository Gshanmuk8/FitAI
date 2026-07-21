import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitOnboarding } from '../../services/aiService';
import { apiFetch } from '../../utils/apiClient';
import Button from '../../components/ui/Button';
import ButtonLink from '../../components/ui/ButtonLink';

const GOALS = ['lose_fat', 'build_muscle', 'maintain', 'improve_endurance'];
const ACTIVITY_LEVELS = ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'athlete'];
const EQUIPMENT = ['gym', 'home', 'minimal'];
const SEXES = ['male', 'female', 'other'];

const isWeightGoal = (goal) => goal === 'lose_fat' || goal === 'build_muscle';

// Short fields pair up on a line so the form is four readable groups rather
// than a fourteen-item vertical crawl. auto-fit collapses to one column on a
// phone without a second breakpoint.
const PAIR = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: '0 var(--s4)',
};

// .section-title carries its own bottom margin sized for prose; the first
// .label under it adds another, so the pair is pulled back to one step.
const SECTION = { marginBottom: 'var(--s1)' };

export default function Onboarding() {
  const [form, setForm] = useState({
    age: '', heightCm: '', weightKg: '', targetWeightKg: '',
    sex: SEXES[0], goal: GOALS[0], activityLevel: ACTIVITY_LEVELS[0],
    equipment: EQUIPMENT[0], timeframeWeeks: '12', injuries: '', dietaryRestrictions: '',
    trainingDaysPerWeek: '', trainingStyle: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // null = still checking, false = fresh account, true = plan exists.
  const [alreadyOnboarded, setAlreadyOnboarded] = useState(null);
  const navigate = useNavigate();

  // Guard against the refresh trap: a user who refreshes mid-submit (or
  // wanders back here) gets a blank form whose resubmission would silently
  // generate a SECOND plan and restart their goal clock. If a plan already
  // exists, say so instead of showing the form.
  useEffect(() => {
    apiFetch('/api/onboarding')
      .then((res) => setAlreadyOnboarded(Boolean(res?.plan)))
      .catch(() => setAlreadyOnboarded(false)); // 404 = not onboarded; show the form
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        age: Number(form.age),
        heightCm: Number(form.heightCm),
        weightKg: Number(form.weightKg),
        timeframeWeeks: Number(form.timeframeWeeks) || undefined,
        trainingDaysPerWeek: Number(form.trainingDaysPerWeek) || undefined,
        // Only weight goals carry a target: the field is hidden for
        // maintain/endurance, but its state survives a goal switch — don't
        // let a stale value leak into the plan generator.
        targetWeightKg: isWeightGoal(form.goal) && form.targetWeightKg ? Number(form.targetWeightKg) : undefined,
      };
      const result = await submitOnboarding(payload);
      // Land on the plan itself so the user can review and change it right
      // away. replace: Back must not return to a blank onboarding form.
      // The timeframe-adjustment explanation rides along as an in-system
      // notice instead of a dismissible native alert.
      const tf = result?.plan?.timeframe;
      navigate('/plan', {
        replace: true,
        state: {
          justGenerated: true,
          notice: tf?.adjusted && tf.adjustedReason ? `Your timeframe was adjusted to ${tf.weeks} weeks. ${tf.adjustedReason}` : null,
        },
      });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  if (alreadyOnboarded === null) return <div className="page-loading">Loading…</div>;

  if (alreadyOnboarded) {
    return (
      <div className="page page-form page-enter">
        <div className="auth-card">
          <h1 className="page-title">You already have a plan</h1>
          <p className="muted" style={{ margin: '0 0 var(--s5)' }}>
            Re-running onboarding would generate a new plan and restart your goal timeline.
            If life changed, update your profile and regenerate from there.
          </p>
          {/* One primary, one alternative — the primary carries the screen's
              only pigment. */}
          <div style={{ display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap' }}>
            <ButtonLink to="/dashboard">Go to Today</ButtonLink>
            <ButtonLink to="/profile" variant="ghost">Update profile</ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  // Four numbered groups on a ruled column. The numbering is the sense of
  // progress: you can see how much form is left without a fake progress bar,
  // and each rule gives the eye a place to rest. Nothing here is a step in a
  // wizard — it is one submit, as it always was.
  return (
    <form onSubmit={handleSubmit} className="page page-narrow page-enter">
      <h1 className="page-title">Tell us about you</h1>

      <h2 className="section-title" style={SECTION}>01 · You</h2>
      <div style={PAIR}>
        <div>
          <label className="label" htmlFor="ob-age">Age</label>
          <input className="field" id="ob-age" type="number" min="13" max="100" value={form.age} onChange={(e) => update('age', e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="ob-sex">Sex</label>
          <select className="field" id="ob-sex" value={form.sex} onChange={(e) => update('sex', e.target.value)}>
            {SEXES.map((s) => <option key={s} value={s}>{s === 'other' ? 'prefer not to say' : s}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ob-height">Height (cm)</label>
          <input className="field" id="ob-height" type="number" min="100" max="250" value={form.heightCm} onChange={(e) => update('heightCm', e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="ob-weight">Weight (kg)</label>
          <input className="field" id="ob-weight" type="number" step="0.1" min="30" max="300" value={form.weightKg} onChange={(e) => update('weightKg', e.target.value)} required />
        </div>
      </div>

      <h2 className="section-title" style={SECTION}>02 · Goal</h2>
      <div style={PAIR}>
        <div>
          <label className="label" htmlFor="ob-goal">Goal</label>
          <select className="field" id="ob-goal" value={form.goal} onChange={(e) => update('goal', e.target.value)}>
            {GOALS.map((g) => <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        {isWeightGoal(form.goal) && (
          <div>
            <label className="label" htmlFor="ob-target">Target weight (kg)</label>
            <input className="field" id="ob-target" type="number" step="0.1" min="30" max="300" value={form.targetWeightKg} onChange={(e) => update('targetWeightKg', e.target.value)} />
          </div>
        )}
      </div>
      <label className="label" htmlFor="ob-timeframe">In how many weeks do you want to reach this goal?</label>
      <input className="field" id="ob-timeframe" type="number" min="1" max="200" value={form.timeframeWeeks} onChange={(e) => update('timeframeWeeks', e.target.value)} required />
      <p className="tiny muted" style={{ margin: 'var(--s1) 0 0' }}>
        We'll extend this automatically if it would require an unsafe pace.
      </p>

      <h2 className="section-title" style={SECTION}>03 · Training</h2>
      <div style={PAIR}>
        <div>
          <label className="label" htmlFor="ob-activity">Activity level</label>
          <select className="field" id="ob-activity" value={form.activityLevel} onChange={(e) => update('activityLevel', e.target.value)}>
            {ACTIVITY_LEVELS.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ob-equipment">Equipment</label>
          <select className="field" id="ob-equipment" value={form.equipment} onChange={(e) => update('equipment', e.target.value)}>
            {EQUIPMENT.map((eq) => <option key={eq} value={eq}>{eq === 'gym' ? 'full gym access' : eq === 'home' ? 'home equipment' : 'minimal / bodyweight'}</option>)}
          </select>
        </div>
      </div>
      <label className="label" htmlFor="ob-days">How many days a week can you train?</label>
      <input className="field" id="ob-days" type="number" min="1" max="7" value={form.trainingDaysPerWeek} onChange={(e) => update('trainingDaysPerWeek', e.target.value)} placeholder="e.g. 4" />
      <label className="label" htmlFor="ob-style">Your training, in your own words (optional)</label>
      <textarea
        className="field"
        id="ob-style"
        maxLength={500}
        rows={3}
        value={form.trainingStyle}
        onChange={(e) => update('trainingStyle', e.target.value)}
        placeholder="e.g. powerlifting 3 days, yoga on rest days · calisthenics and running · anything you want your plan built around"
        style={{ resize: 'vertical' }}
      />

      <h2 className="section-title" style={SECTION}>04 · Constraints</h2>
      <label className="label" htmlFor="ob-injuries">Injuries (comma separated, optional)</label>
      <input className="field" id="ob-injuries" maxLength={500} value={form.injuries} onChange={(e) => update('injuries', e.target.value)} />
      <label className="label" htmlFor="ob-diet">Dietary restrictions (optional)</label>
      <input className="field" id="ob-diet" maxLength={500} value={form.dietaryRestrictions} onChange={(e) => update('dietaryRestrictions', e.target.value)} />

      {/* The close: a rule, then one action across the full measure. There is
          nothing else to press on this screen and the layout says so. */}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 'var(--s7)', paddingTop: 'var(--s5)' }}>
        {error && <p className="error-text" style={{ margin: '0 0 var(--s3)' }}>{error}</p>}
        <Button type="submit" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Generating your plan…' : 'Generate my plan'}
        </Button>
        {loading && (
          <p className="tiny muted" style={{ margin: 'var(--s2) 0 0', textAlign: 'center' }}>
            Your coach is building your program — this usually takes under a minute.
          </p>
        )}
      </div>
    </form>
  );
}
