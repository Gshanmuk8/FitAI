import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../utils/apiClient';
import { getDailyBriefing } from '../../services/aiService';
import DailyChecklist from '../../components/checklist/DailyChecklist';
import Button from '../../components/ui/Button';
import ButtonLink from '../../components/ui/ButtonLink';

const STATUS_TONE = { ahead: 'emerald', on_track: 'emerald', behind: 'amber', no_data: 'cyan' };
const STATUS_LABEL = { ahead: 'Ahead of schedule', on_track: 'On track', behind: 'Behind schedule', no_data: 'Getting to know you' };

// The AI-authored daily briefing — the coach measures the user's pace vs their
// plan once every 24h. Enrichment only: never blocks the rest of the dashboard.
function BriefingCard({ briefing, loading, error, onRetry }) {
  if (loading) {
    return (
      <div className="card card-accent tone-cyan" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Coach's briefing</h3>
        {/* First look of the day runs the AI — set the expectation so the
            wait reads as work being done, not a hang. */}
        <p className="small muted">Your coach is reading your history — the first look of the day can take a moment…</p>
      </div>
    );
  }
  // Never render nothing. A vanished card is indistinguishable from a
  // removed feature; an honest one-liner with a retry is actionable.
  if (!briefing) {
    return (
      <div className="card card-accent tone-amber" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Coach's briefing</h3>
        <p className="small muted" style={{ margin: '0.5rem 0' }}>
          {error
            ? `Couldn't reach your coach just now — ${error}`
            : "Couldn't reach your coach just now."}
        </p>
        <Button onClick={onRetry}>Try again</Button>
      </div>
    );
  }
  const tone = STATUS_TONE[briefing.status] || 'cyan';
  // A stale or template briefing must not wear the live-pulse dot — the
  // disclaimers below are easy to miss, and a green pulse reads as "fresh".
  const degraded = Boolean(briefing.stale) || briefing.source === 'fallback';
  return (
    <div className={`card card-accent tone-${tone}`} style={{ marginBottom: '1rem' }}>
      <div className="page-header">
        <h3 style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
          {!degraded && (
            <span
              className="pulse-live"
              aria-hidden="true"
              style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--cyan)', display: 'inline-block', flex: 'none' }}
            />
          )}
          Coach's briefing
        </h3>
        <span className={`tone-${tone}-text`} style={{ fontWeight: 700 }}>
          {STATUS_LABEL[briefing.status] || 'Briefing ready'}
        </span>
      </div>
      <p className="small" style={{ margin: '0.5rem 0' }}>{briefing.summary}</p>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Plan pace</div>
          <div className="small" style={{ fontWeight: 600 }}>{briefing.currentPace}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Your actual pace</div>
          <div className="small" style={{ fontWeight: 600 }}>{briefing.actualPace}</div>
        </div>
      </div>
      {briefing.focus?.length > 0 && (
        <>
          <span className="stat-label" style={{ marginTop: '0.5rem', display: 'block' }}>Focus today</span>
          <ul className="small muted" style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem' }}>
            {briefing.focus.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </>
      )}
      {briefing.source === 'fallback' && (
        <p className="tiny faint" style={{ marginTop: '0.5rem' }}>AI coach unreachable right now — this will refresh on the next visit.</p>
      )}
      {briefing.stale && (
        <p className="tiny tone-amber-text" style={{ marginTop: '0.5rem' }}>
          This is the day's earlier briefing — your latest changes fold in as soon as the coach is reachable again.
        </p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [noProfile, setNoProfile] = useState(false);
  const [briefing, setBriefing] = useState(null);
  const [briefingError, setBriefingError] = useState('');
  const [briefingLoading, setBriefingLoading] = useState(true);

  // Retry the page's own loaders. A full window.location.reload() would
  // re-download the whole SPA and throw away every other bit of page state
  // for what is usually a one-off network blip.
  function reload() {
    setLoading(true);
    setError('');
    apiFetch('/api/onboarding')
      .then((p) => { setProfile(p); setError(''); setNoProfile(false); })
      .catch((err) => { setError(err.message); setNoProfile(Boolean(err.noProfile)); })
      .finally(() => setLoading(false));
    loadBriefing();
  }

  function loadBriefing() {
    setBriefingLoading(true);
    setBriefingError('');
    // The AI briefing is enrichment — its failure must never block the
    // dashboard, and the server caches it so this is one AI call per day.
    // But "never block" is not "never mention": swallowing the error made
    // the whole card disappear on a 429, which reads as the coach feature
    // being gone rather than briefly unreachable.
    return getDailyBriefing()
      .then((b) => { setBriefing(b); setBriefingError(''); })
      .catch((err) => setBriefingError(err.message))
      .finally(() => setBriefingLoading(false));
  }

  useEffect(() => {
    apiFetch('/api/onboarding')
      .then(setProfile)
      .catch((err) => { setError(err.message); setNoProfile(Boolean(err.noProfile)); })
      .finally(() => setLoading(false));
    loadBriefing();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="page-loading">Loading your day…</div>;

  // A genuine fetch failure (network, expired session) — show it and let them
  // retry. Don't misread it as "not onboarded" and shove them into onboarding.
  // The distinction comes from the response status, not the wording: a
  // reworded server string must never be able to push an established user
  // back through signup, which restarts their goal clock.
  const noProfileYet = noProfile;
  if (error && !noProfileYet) {
    return (
      <div className="dashboard-empty page-enter">
        <h2 className="page-title">Couldn't load your dashboard</h2>
        <p className="muted">{error}</p>
        <Button onClick={reload} disabled={loading}>{loading ? 'Retrying…' : 'Try again'}</Button>
      </div>
    );
  }

  // Onboarding is a SIGNUP-completion step, not a login gate — so we never
  // auto-redirect a logged-in user into it (that's the job of the signup flow:
  // Signup.jsx / AuthCallback.jsx). If an account somehow reaches the dashboard
  // without a plan (e.g. abandoned onboarding), render a prompt they can act on
  // rather than trapping them in a redirect loop.
  if (noProfileYet || !profile?.plan) {
    return (
      <div className="dashboard-empty page-enter">
        <h2 className="page-title">Finish setting up your plan</h2>
        <p className="muted">Complete a quick onboarding and we'll generate your training and nutrition plan.</p>
        <ButtonLink to="/onboarding">Complete onboarding</ButtonLink>
      </div>
    );
  }

  const plan = profile.plan;
  const calorieTarget = plan.diet?.calorieTarget ?? plan.calorieTarget ?? null;

  // Plan completion is a moment, not a silence: when the timeframe has
  // elapsed, say so and point at the one meaningful next action.
  const timeframeWeeks = plan.timeframe?.weeks || null;
  const planStartedAt = profile.profile?.plan_started_at || null;
  const weeksElapsed = planStartedAt ? (Date.now() - new Date(planStartedAt).getTime()) / (7 * 86400000) : null;
  const planComplete = Boolean(timeframeWeeks && weeksElapsed != null && weeksElapsed >= timeframeWeeks);

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="page page-wide page-enter" style={{ position: 'relative' }}>
      {/* The day's own light — the dashboard opens like a scene, not a form. */}
      <div className="aurora" aria-hidden="true" style={{ opacity: 0.55 }} />
      <p className="eyebrow reveal" style={{ margin: '0 0 0.3rem' }}>{dateLabel}</p>
      <h1 className="page-title reveal" style={{ animationDelay: '70ms' }}>Today</h1>

      {planComplete && (
        <p className="notice tone-emerald">
          Your <strong>{timeframeWeeks}-week plan is complete</strong> — well done for seeing it through.{' '}
          <Link to="/profile">Set your next goal →</Link>
        </p>
      )}

      <BriefingCard briefing={briefing} loading={briefingLoading} error={briefingError} onRetry={loadBriefing} />

      <DailyChecklist />

      {/* Today's two actions. The full weekly split lives on the Plan page —
          this screen is about today only. */}
      <div className="grid-cards">
        <Link to="/workout" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card card-hover" style={{ height: '100%' }}>
            <h3>Workout</h3>
            <p className="small muted">
              {plan.days?.length ? <><span className="mono">{plan.days.length}</span>-day split · log today's sets</> : "Log today's sets"}
            </p>
            <span className="small">Open today's workout →</span>
          </div>
        </Link>
        <Link to="/nutrition" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card card-hover" style={{ height: '100%' }}>
            <h3>Nutrition</h3>
            <p className="small muted">
              Daily target: <span className="mono">{calorieTarget ?? '—'}</span> kcal
              {plan.diet?.proteinGrams ? <> · <span className="mono">{plan.diet.proteinGrams}g</span> protein</> : null}
            </p>
            <span className="small">Log a meal or analyze a photo →</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
