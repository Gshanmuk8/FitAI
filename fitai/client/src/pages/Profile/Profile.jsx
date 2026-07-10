import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../utils/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';

const GOALS = ['lose_fat', 'build_muscle', 'maintain', 'improve_endurance'];
const ACTIVITY_LEVELS = ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'athlete'];
const SEXES = ['male', 'female', 'other'];
const EQUIPMENT = ['gym', 'home', 'minimal'];

const inputStyle = { width: '100%', marginBottom: '0.75rem' };
const labelStyle = { display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.15rem' };

export default function Profile() {
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState({ busy: '', error: '', saved: false });
  const [signOutError, setSignOutError] = useState('');
  const { user, signOut } = useAuth();
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
          trainingDaysPerWeek: profile.training_days_per_week ?? '',
          trainingStyle: profile.training_style || '',
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
      ...(form.trainingDaysPerWeek ? { trainingDaysPerWeek: Number(form.trainingDaysPerWeek) } : {}),
      trainingStyle: form.trainingStyle,
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

  async function handleRegenerate(e) {
    // type="button" skips HTML form validation — run it explicitly, or a
    // cleared Age field would PATCH age: Number('') = 0 to the server.
    const formEl = e.currentTarget.form;
    if (formEl && !formEl.reportValidity()) return;
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
      // Land on the NEW plan with an explanation — the highest-stakes action
      // in the app (timeline reset) must not end in a silent dashboard.
      navigate('/plan', { state: { notice: 'New plan generated — your goal timeline restarted at week 1.' } });
    } catch (err) {
      setStatus({ busy: '', error: err.message, saved: false });
    }
  }

  async function handleSignOut() {
    setSignOutError('');
    try {
      await signOut();
    } catch (err) {
      setSignOutError(err.message || "Couldn't sign out — try again.");
    }
  }

  if (status.error && !form) {
    return (
      <div className="dashboard-empty page-enter">
        <h2 className="page-title">Couldn't load your profile</h2>
        <p className="muted">{status.error}</p>
        <Button type="button" onClick={() => window.location.reload()}>Try again</Button>
      </div>
    );
  }
  if (!form) return <p className="page-loading">Loading profile…</p>;

  return (
    <div className="page page-narrow page-enter">
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
        <label style={labelStyle}>Current weight (kg) — daily weigh-ins go on the dashboard's Today's Mission</label>
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
        <label style={labelStyle}>Training days per week</label>
        <input type="number" min="1" max="7" value={form.trainingDaysPerWeek} onChange={(e) => update('trainingDaysPerWeek', e.target.value)} placeholder="e.g. 4" style={inputStyle} />
        <label style={labelStyle}>Your training, in your own words</label>
        <textarea
          maxLength={500}
          rows={3}
          value={form.trainingStyle}
          onChange={(e) => update('trainingStyle', e.target.value)}
          placeholder="e.g. powerlifting 3 days, yoga on rest days — regenerating rebuilds your plan around this"
          style={{ ...inputStyle, resize: 'vertical' }}
        />
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

      <p className="tiny muted" style={{ marginTop: '1rem' }}>
        "Save profile" updates your facts without touching the plan. "Regenerate plan" builds a new program from
        this profile (respecting injuries and your learned exercise preferences) and starts the goal timeline over.
      </p>

      <section className="card" style={{ marginTop: '2rem' }}>
        <h3 style={{ marginTop: 0 }}>Account</h3>
        <p className="muted small">{user?.email}</p>
        <Button variant="ghost" type="button" onClick={handleSignOut}>Sign out</Button>
        {signOutError && <p className="error-text small">{signOutError}</p>}
      </section>
    </div>
  );
}
