import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../utils/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import ButtonLink from '../../components/ui/ButtonLink';

const GOALS = ['lose_fat', 'build_muscle', 'maintain', 'improve_endurance'];
const ACTIVITY_LEVELS = ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'athlete'];
const SEXES = ['male', 'female', 'other'];
const EQUIPMENT = ['gym', 'home', 'minimal'];

// Settings read as groups, not as a scroll. Short fields pair up; the
// section rule does the grouping so no box is needed around anything.
const PAIR = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: '0 var(--s4)',
};
const SECTION = { marginBottom: 'var(--s1)' };

export default function Profile() {
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState({ busy: '', error: '', saved: false });
  const [noProfile, setNoProfile] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  function loadProfile() {
    setStatus((s) => ({ ...s, error: '' }));
    return apiFetch('/api/profile')
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
      .catch((err) => {
        setNoProfile(Boolean(err.noProfile));
        setStatus((s) => ({ ...s, error: err.message }));
      });
  }

  useEffect(() => { loadProfile(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // An account that abandoned onboarding has no profile row. "Try again"
  // would fail forever here — the only thing that helps is finishing
  // onboarding, so offer that instead. Same branch Dashboard and Progress
  // already had; Profile was the one dead end.
  if (noProfile) {
    return (
      <div className="dashboard-empty page-enter">
        <h1 className="page-title">Finish setting up first</h1>
        <p className="muted" style={{ margin: '0 0 var(--s5)' }}>
          Your profile is created when you complete onboarding.
        </p>
        <ButtonLink to="/onboarding">Complete onboarding</ButtonLink>
      </div>
    );
  }
  if (status.error && !form) {
    return (
      <div className="dashboard-empty page-enter">
        <h1 className="page-title">Couldn't load your profile</h1>
        <p className="muted" style={{ margin: '0 0 var(--s5)' }}>{status.error}</p>
        <Button type="button" onClick={loadProfile}>Try again</Button>
      </div>
    );
  }
  if (!form) return <p className="page-loading">Loading profile…</p>;

  return (
    <div className="page page-mid page-enter">
      <h1 className="page-title">Profile</h1>

      <form onSubmit={handleSave}>
        <h2 className="section-title" style={SECTION}>Body</h2>
        <div style={PAIR}>
          <div>
            <label className="label" htmlFor="pf-age">Age</label>
            <input className="field" id="pf-age" type="number" min="13" max="100" value={form.age} onChange={(e) => update('age', e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="pf-sex">Sex</label>
            <select className="field" id="pf-sex" value={form.sex} onChange={(e) => update('sex', e.target.value)}>
              {SEXES.map((s) => <option key={s} value={s}>{s === 'other' ? 'prefer not to say' : s}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pf-height">Height (cm)</label>
            <input className="field" id="pf-height" type="number" min="100" max="250" value={form.heightCm} onChange={(e) => update('heightCm', e.target.value)} required />
          </div>
          <div>
            {/* The label states the field; the aside about where daily
                weigh-ins live drops beneath it as a hint, so a tracked
                uppercase label isn't carrying a whole sentence. */}
            <label className="label" htmlFor="pf-weight">Current weight (kg)</label>
            <input className="field" id="pf-weight" type="number" step="0.1" min="30" max="300" value={form.weightKg} onChange={(e) => update('weightKg', e.target.value)} required />
            <p className="tiny muted" style={{ margin: 'var(--s1) 0 0' }}>
              Daily weigh-ins go on the dashboard's Today's Mission.
            </p>
          </div>
        </div>

        <h2 className="section-title" style={SECTION}>Goal</h2>
        <div style={PAIR}>
          <div>
            <label className="label" htmlFor="pf-goal">Goal</label>
            <select className="field" id="pf-goal" value={form.goal} onChange={(e) => update('goal', e.target.value)}>
              {GOALS.map((g) => <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pf-target">Target weight (kg)</label>
            <input className="field" id="pf-target" type="number" step="0.1" min="30" max="300" value={form.targetWeightKg} onChange={(e) => update('targetWeightKg', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="pf-timeframe">Timeframe (weeks)</label>
            <input className="field" id="pf-timeframe" type="number" min="1" max="200" value={form.timeframeWeeks} onChange={(e) => update('timeframeWeeks', e.target.value)} />
          </div>
        </div>

        <h2 className="section-title" style={SECTION}>Training</h2>
        <div style={PAIR}>
          <div>
            <label className="label" htmlFor="pf-activity">Activity level</label>
            <select className="field" id="pf-activity" value={form.activityLevel} onChange={(e) => update('activityLevel', e.target.value)}>
              {ACTIVITY_LEVELS.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pf-equipment">Equipment</label>
            <select className="field" id="pf-equipment" value={form.gymAvailability} onChange={(e) => update('gymAvailability', e.target.value)}>
              {EQUIPMENT.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pf-days">Training days per week</label>
            <input className="field" id="pf-days" type="number" min="1" max="7" value={form.trainingDaysPerWeek} onChange={(e) => update('trainingDaysPerWeek', e.target.value)} placeholder="e.g. 4" />
          </div>
        </div>
        <label className="label" htmlFor="pf-style">Your training, in your own words</label>
        <textarea
          className="field"
          id="pf-style"
          maxLength={500}
          rows={3}
          value={form.trainingStyle}
          onChange={(e) => update('trainingStyle', e.target.value)}
          placeholder="e.g. powerlifting 3 days, yoga on rest days — regenerating rebuilds your plan around this"
          style={{ resize: 'vertical' }}
        />

        <h2 className="section-title" style={SECTION}>Constraints</h2>
        <label className="label" htmlFor="pf-injuries">Injuries (comma separated)</label>
        <input className="field" id="pf-injuries" value={form.injuries} onChange={(e) => update('injuries', e.target.value)} />
        <label className="label" htmlFor="pf-diet">Dietary restrictions</label>
        <input className="field" id="pf-diet" value={form.dietaryRestrictions} onChange={(e) => update('dietaryRestrictions', e.target.value)} />

        {/* The action bar. The explanation of what the two actions DO now
            sits above them rather than below — a caveat read after the click
            is not a caveat. Regenerate stays ghost: it restarts the goal
            clock, and a second filled button would make the two look
            equivalent. */}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 'var(--s7)', paddingTop: 'var(--s5)' }}>
          <p className="tiny muted" style={{ margin: '0 0 var(--s4)', maxWidth: '62ch' }}>
            "Save profile" updates your facts without touching the plan. "Regenerate plan" builds a new program from
            this profile (respecting injuries and your learned exercise preferences) and starts the goal timeline over.
          </p>

          {status.error && <p className="error-text" style={{ margin: '0 0 var(--s3)' }}>{status.error}</p>}
          {status.saved && (
            <p className="success-text" style={{ margin: '0 0 var(--s3)' }}>
              Profile saved. Your current plan and goal timeline are unchanged.
            </p>
          )}

          <div style={{ display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap' }}>
            <Button type="submit" disabled={Boolean(status.busy)}>
              {status.busy === 'saving' ? 'Saving…' : 'Save profile'}
            </Button>
            <Button type="button" variant="ghost" disabled={Boolean(status.busy)} onClick={handleRegenerate}>
              {status.busy === 'regenerating' ? 'Regenerating…' : 'Life changed? Regenerate plan'}
            </Button>
          </div>
        </div>
      </form>

      {/* Account is a different object from the profile facts, so it gets a
          surface of its own — and sign-out stays ghost. A destructive action
          should be findable, never eye-catching. */}
      <h2 className="section-title" style={SECTION}>Account</h2>
      <section className="card">
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 'var(--s3)', flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p className="eyebrow" style={{ margin: 0 }}>Signed in as</p>
            <p style={{ margin: 'var(--s1) 0 0', overflowWrap: 'anywhere' }}>{user?.email}</p>
          </div>
          <Button variant="ghost" type="button" onClick={handleSignOut}>Sign out</Button>
        </div>
        {signOutError && <p className="error-text small" style={{ margin: 'var(--s3) 0 0' }}>{signOutError}</p>}
      </section>
    </div>
  );
}
