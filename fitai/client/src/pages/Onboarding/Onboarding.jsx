import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitOnboarding } from '../../services/aiService';
import Button from '../../components/ui/Button';

const GOALS = ['lose_fat', 'build_muscle', 'maintain', 'improve_endurance'];
const ACTIVITY_LEVELS = ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'athlete'];
const EQUIPMENT = ['gym', 'home', 'minimal'];
const SEXES = ['male', 'female', 'other'];

const inputStyle = { width: '100%', marginBottom: '0.75rem' };
const isWeightGoal = (goal) => goal === 'lose_fat' || goal === 'build_muscle';

export default function Onboarding() {
  const [form, setForm] = useState({
    age: '', heightCm: '', weightKg: '', targetWeightKg: '',
    sex: SEXES[0], goal: GOALS[0], activityLevel: ACTIVITY_LEVELS[0],
    equipment: EQUIPMENT[0], timeframeWeeks: '12', injuries: '', dietaryRestrictions: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
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
        targetWeightKg: form.targetWeightKg ? Number(form.targetWeightKg) : undefined,
      };
      const result = await submitOnboarding(payload);
      // If the safety engine stretched an over-ambitious timeframe, say so
      // before moving on — silent adjustment would feel like a bug later.
      const tf = result?.plan?.timeframe;
      if (tf?.adjusted && tf.adjustedReason) {
        window.alert(`Heads up: your timeframe was adjusted to ${tf.weeks} weeks.\n\n${tf.adjustedReason}`);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="page-enter" style={{ maxWidth: 420, margin: '4rem auto', padding: '0 1rem' }}>
      <h2 className="font-display">Tell us about you</h2>
      <input placeholder="Age" type="number" value={form.age} onChange={(e) => update('age', e.target.value)} required style={inputStyle} />
      <select value={form.sex} onChange={(e) => update('sex', e.target.value)} style={inputStyle}>
        {SEXES.map((s) => <option key={s} value={s}>{s === 'other' ? 'prefer not to say' : s}</option>)}
      </select>
      <input placeholder="Height (cm)" type="number" value={form.heightCm} onChange={(e) => update('heightCm', e.target.value)} required style={inputStyle} />
      <input placeholder="Weight (kg)" type="number" step="0.1" value={form.weightKg} onChange={(e) => update('weightKg', e.target.value)} required style={inputStyle} />
      <select value={form.goal} onChange={(e) => update('goal', e.target.value)} style={inputStyle}>
        {GOALS.map((g) => <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>)}
      </select>
      {isWeightGoal(form.goal) && (
        <input placeholder="Target weight (kg)" type="number" step="0.1" value={form.targetWeightKg} onChange={(e) => update('targetWeightKg', e.target.value)} style={inputStyle} />
      )}
      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', opacity: 0.8 }}>
        In how many weeks do you want to reach this goal?
      </label>
      <input placeholder="Timeframe (weeks)" type="number" min="1" max="200" value={form.timeframeWeeks} onChange={(e) => update('timeframeWeeks', e.target.value)} required style={inputStyle} />
      <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '-0.5rem', marginBottom: '0.75rem' }}>
        We'll extend this automatically if it would require an unsafe pace.
      </p>
      <select value={form.activityLevel} onChange={(e) => update('activityLevel', e.target.value)} style={inputStyle}>
        {ACTIVITY_LEVELS.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
      </select>
      <select value={form.equipment} onChange={(e) => update('equipment', e.target.value)} style={inputStyle}>
        {EQUIPMENT.map((eq) => <option key={eq} value={eq}>{eq === 'gym' ? 'full gym access' : eq === 'home' ? 'home equipment' : 'minimal / bodyweight'}</option>)}
      </select>
      <input placeholder="Injuries (comma separated, optional)" value={form.injuries} onChange={(e) => update('injuries', e.target.value)} style={inputStyle} />
      <input placeholder="Dietary restrictions (optional)" value={form.dietaryRestrictions} onChange={(e) => update('dietaryRestrictions', e.target.value)} style={inputStyle} />
      {error && <p className="error-text">{error}</p>}
      <Button type="submit" disabled={loading}>{loading ? 'Generating your plan…' : 'Generate my plan'}</Button>
    </form>
  );
}
