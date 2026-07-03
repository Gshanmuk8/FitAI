import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../utils/apiClient';
import Button from '../../components/ui/Button';

const GOALS = ['lose_fat', 'build_muscle', 'maintain', 'improve_endurance'];
const ACTIVITY_LEVELS = ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'athlete'];
const SEXES = ['male', 'female', 'other'];
const EQUIPMENT = ['gym', 'home', 'minimal'];

const inputStyle = { width: '100%', marginBottom: '0.75rem' };
const labelStyle = { display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.15rem' };

export default function Profile() {
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState({ busy: '', error: '', saved: false });
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch('/api/profile')
      .then(({ profile }) =>
        setForm({
          age: profile.age ?? '',
          heightCm: profile.height_cm ?? '',
          weightKg: profile.weight_kg ?? '',
          targetWeightKg: profile.target_weight_kg ?? '',
          timeframeWeeks: profile.timeframe_weeks ?? '',
          sex: profile.sex || 'other',
          goal: profile.goal || GOALS[0],
          activityLevel: profile.activity_level || ACTIVITY_LEVELS[0],
          gymAvailability: profile.gym_availability || 'gym',
          injuries: profile.injuries || '',
          dietaryRestrictions: profile.dietary_restrictions || '',
        })
      )
      .catch((err) => setStatus((s) => ({ ...s, error: err.message })));
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setStatus((s) => ({ ...s, saved: false }));
  }

  function payload() {
    return {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      age: Number(form.age),
      heightCm: Number(form.heightCm),
      weightKg: Number(form.weightKg),
      ...(form.targetWeightKg ? { targetWeightKg: Number(form.targetWeightKg) } : {}),
      ...(form.timeframeWeeks ? { timeframeWeeks: Number(form.timeframeWeeks) } : {}),
      sex: form.sex,
      goal: form.goal,
      activityLevel: form.activityLevel,
      gymAvailability: form.gymAvailability,
      injuries: form.injuries,
      dietaryRestrictions: form.dietaryRestrictions,
    };
  }

  async function handleSave(e) {
    e.preventDefault();
    setStatus({ busy: 'saving', error: '', saved: false });
    try {
      await apiFetch('/api/profile', { method: 'PATCH', body: JSON.stringify(payload()) });
      setStatus({ busy: '', error: '', saved: true });
    } catch (err) {
      setStatus({ busy: '', error: err.message, saved: false });
    }
  }

  async function handleRegenerate() {
    const ok = window.confirm(
      'Regenerate your plan from the profile below?\n\n' +
        'This creates a fresh plan and RESTARTS your goal timeline (week 1 again). ' +
        'Learned preferences (exercises you removed/added) are kept. Unsaved profile changes are saved first.'
    );
    if (!ok) return;
    setStatus({ busy: 'regenerating', error: '', saved: false });
    try {
      await apiFetch('/api/profile', { method: 'PATCH', body: JSON.stringify(payload()) });
      await apiFetch('/api/plan/regenerate', { method: 'POST' });
      navigate('/dashboard');
    } catch (err) {
      setStatus({ busy: '', error: err.message, saved: false });
    }
  }

  if (status.error && !form) return <p className="page-loading">{status.error}</p>;
  if (!form) return <p className="page-loading">Loading profile…</p>;

  return (
    <div className="page-enter" style={{ maxWidth: 480, margin: '2.5rem auto', padding: '0 2rem' }}>
      <h2 className="page-title">Profile</h2>

      <form onSubmit={handleSave}>
        <label style={labelStyle}>Age</label>
        <input type="number" min="13" max="100" value={form.age} onChange={(e) => update('age', e.target.value)} required style={inputStyle} />
        <label style={labelStyle}>Sex</label>
        <select value={form.sex} onChange={(e) => update('sex', e.target.value)} style={inputStyle}>
          {SEXES.map((s) => <option key={s} value={s}>{s === 'other' ? 'prefer not to say' : s}</option>)}
        </select>
        <label style={labelStyle}>Height (cm)</label>
        <input type="number" min="100" max="250" value={form.heightCm} onChange={(e) => update('heightCm', e.target.value)} required style={inputStyle} />
        <label style={labelStyle}>Current weight (kg) — day-to-day weigh-ins belong on the Progress page</label>
        <input type="number" step="0.1" min="30" max="300" value={form.weightKg} onChange={(e) => update('weightKg', e.target.value)} required style={inputStyle} />
        <label style={labelStyle}>Goal</label>
        <select value={form.goal} onChange={(e) => update('goal', e.target.value)} style={inputStyle}>
          {GOALS.map((g) => <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>)}
        </select>
        <label style={labelStyle}>Target weight (kg)</label>
        <input type="number" step="0.1" min="30" max="300" value={form.targetWeightKg} onChange={(e) => update('targetWeightKg', e.target.value)} style={inputStyle} />
        <label style={labelStyle}>Timeframe (weeks)</label>
        <input type="number" min="1" max="200" value={form.timeframeWeeks} onChange={(e) => update('timeframeWeeks', e.target.value)} style={inputStyle} />
        <label style={labelStyle}>Activity level</label>
        <select value={form.activityLevel} onChange={(e) => update('activityLevel', e.target.value)} style={inputStyle}>
          {ACTIVITY_LEVELS.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
        </select>
        <label style={labelStyle}>Equipment</label>
        <select value={form.gymAvailability} onChange={(e) => update('gymAvailability', e.target.value)} style={inputStyle}>
          {EQUIPMENT.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
        </select>
        <label style={labelStyle}>Injuries (comma separated)</label>
        <input value={form.injuries} onChange={(e) => update('injuries', e.target.value)} style={inputStyle} />
        <label style={labelStyle}>Dietary restrictions</label>
        <input value={form.dietaryRestrictions} onChange={(e) => update('dietaryRestrictions', e.target.value)} style={inputStyle} />

        {status.error && <p className="error-text">{status.error}</p>}
        {status.saved && <p className="success-text">Profile saved. Your current plan and goal timeline are unchanged.</p>}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button type="submit" disabled={Boolean(status.busy)}>
            {status.busy === 'saving' ? 'Saving…' : 'Save profile'}
          </Button>
          <Button type="button" variant="ghost" disabled={Boolean(status.busy)} onClick={handleRegenerate}>
            {status.busy === 'regenerating' ? 'Regenerating…' : 'Life changed? Regenerate plan'}
          </Button>
        </div>
      </form>

      <p style={{ fontSize: '0.78rem', opacity: 0.6, marginTop: '1rem' }}>
        "Save profile" updates your facts without touching the plan. "Regenerate plan" builds a new program from
        this profile (respecting injuries and your learned exercise preferences) and starts the goal timeline over.
      </p>
    </div>
  );
}
