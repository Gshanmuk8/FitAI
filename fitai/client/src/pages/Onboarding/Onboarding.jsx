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

const inputStyle = { width: '100%', marginBottom: '0.75rem' };
const labelStyle = { display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.15rem' };
const isWeightGoal = (goal) => goal === 'lose_fat' || goal === 'build_muscle';

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
      <div className="page page-form page-enter" style={{ textAlign: 'center' }}>
        <h2 className="page-title">You already have a plan</h2>
        <p className="muted">
          Re-running onboarding would generate a new plan and restart your goal timeline.
          If life changed, update your profile and regenerate from there.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
          <ButtonLink to="/dashboard">Go to Today</ButtonLink>
          <ButtonLink to="/profile" variant="ghost">Update profile</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="page page-form page-enter">
      <h2 className="page-title">Tell us about you</h2>
      <label style={labelStyle}>Age</label>
      <input type="number" min="13" max="100" value={form.age} onChange={(e) => update('age', e.target.value)} required style={inputStyle} />
      <label style={labelStyle}>Sex</label>
      <select value={form.sex} onChange={(e) => update('sex', e.target.value)} style={inputStyle}>
        {SEXES.map((s) => <option key={s} value={s}>{s === 'other' ? 'prefer not to say' : s}</option>)}
      </select>
      <label style={labelStyle}>Height (cm)</label>
      <input type="number" min="100" max="250" value={form.heightCm} onChange={(e) => update('heightCm', e.target.value)} required style={inputStyle} />
      <label style={labelStyle}>Weight (kg)</label>
      <input type="number" step="0.1" min="30" max="300" value={form.weightKg} onChange={(e) => update('weightKg', e.target.value)} required style={inputStyle} />
      <label style={labelStyle}>Goal</label>
      <select value={form.goal} onChange={(e) => update('goal', e.target.value)} style={inputStyle}>
        {GOALS.map((g) => <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>)}
      </select>
      {isWeightGoal(form.goal) && (
        <>
          <label style={labelStyle}>Target weight (kg)</label>
          <input type="number" step="0.1" min="30" max="300" value={form.targetWeightKg} onChange={(e) => update('targetWeightKg', e.target.value)} style={inputStyle} />
        </>
      )}
      <label style={labelStyle}>In how many weeks do you want to reach this goal?</label>
      <input type="number" min="1" max="200" value={form.timeframeWeeks} onChange={(e) => update('timeframeWeeks', e.target.value)} required style={inputStyle} />
      <p className="tiny muted" style={{ marginTop: '-0.5rem', marginBottom: '0.75rem' }}>
        We'll extend this automatically if it would require an unsafe pace.
      </p>
      <label style={labelStyle}>Activity level</label>
      <select value={form.activityLevel} onChange={(e) => update('activityLevel', e.target.value)} style={inputStyle}>
        {ACTIVITY_LEVELS.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
      </select>
      <label style={labelStyle}>Equipment</label>
      <select value={form.equipment} onChange={(e) => update('equipment', e.target.value)} style={inputStyle}>
        {EQUIPMENT.map((eq) => <option key={eq} value={eq}>{eq === 'gym' ? 'full gym access' : eq === 'home' ? 'home equipment' : 'minimal / bodyweight'}</option>)}
      </select>
      <label style={labelStyle}>How many days a week can you train?</label>
      <input type="number" min="1" max="7" value={form.trainingDaysPerWeek} onChange={(e) => update('trainingDaysPerWeek', e.target.value)} placeholder="e.g. 4" style={inputStyle} />
      <label style={labelStyle}>Your training, in your own words (optional)</label>
      <textarea
        maxLength={500}
        rows={3}
        value={form.trainingStyle}
        onChange={(e) => update('trainingStyle', e.target.value)}
        placeholder="e.g. powerlifting 3 days, yoga on rest days · calisthenics and running · anything you want your plan built around"
        style={{ ...inputStyle, resize: 'vertical' }}
      />
      <label style={labelStyle}>Injuries (comma separated, optional)</label>
      <input maxLength={500} value={form.injuries} onChange={(e) => update('injuries', e.target.value)} style={inputStyle} />
      <label style={labelStyle}>Dietary restrictions (optional)</label>
      <input maxLength={500} value={form.dietaryRestrictions} onChange={(e) => update('dietaryRestrictions', e.target.value)} style={inputStyle} />
      {error && <p className="error-text">{error}</p>}
      <Button type="submit" disabled={loading}>{loading ? 'Generating your plan…' : 'Generate my plan'}</Button>
      {loading && (
        <p className="tiny muted" style={{ marginTop: '0.5rem' }}>
          Your coach is building your program — this usually takes under a minute.
        </p>
      )}
    </form>
  );
}
