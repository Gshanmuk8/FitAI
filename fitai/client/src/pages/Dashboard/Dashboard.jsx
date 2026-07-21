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
      <section className="card" style={{ padding: 'var(--s6) var(--s5)', marginBottom: 'var(--s5)' }}>
        <p className="eyebrow" style={{ margin: '0 0 var(--s3)' }}>Coach's briefing</p>
        {/* First look of the day runs the AI — set the expectation so the
            wait reads as work being done, not a hang. The skeleton rules
            below hold the shape the answer will arrive in, so nothing
            jumps when it does. */}
        <p className="muted lead">
          Your coach is reading your history — the first look of the day can take a moment…
        </p>
        <div style={{ marginTop: 'var(--s5)', borderTop: '1px solid var(--border)' }} aria-hidden="true">
          <div className="skeleton" style={{ height: 12, width: '38%', margin: 'var(--s4) 0' }} />
          <div className="skeleton" style={{ height: 12, width: '52%', marginBottom: 'var(--s2)' }} />
        </div>
      </section>
    );
  }
  // Never render nothing. A vanished card is indistinguishable from a
  // removed feature; an honest one-liner with a retry is actionable.
  if (!briefing) {
    return (
      <section className="card card-accent tone-amber" style={{ padding: 'var(--s6) var(--s5)', marginBottom: 'var(--s5)' }}>
        <p className="eyebrow" style={{ margin: '0 0 var(--s3)' }}>Coach's briefing</p>
        <p className="lead">
          {error
            ? `Couldn't reach your coach just now — ${error}`
            : "Couldn't reach your coach just now."}
        </p>
        <div style={{ marginTop: 'var(--s4)' }}>
          <Button onClick={onRetry}>Try again</Button>
        </div>
      </section>
    );
  }
  const tone = STATUS_TONE[briefing.status] || 'cyan';
  // A stale or template briefing must not wear the live-pulse dot — the
  // disclaimers below are easy to miss, and a green pulse reads as "fresh".
  const degraded = Boolean(briefing.stale) || briefing.source === 'fallback';
  return (
    <section className={`card card-accent tone-${tone}`} style={{ padding: 'var(--s6) var(--s5)', marginBottom: 'var(--s5)' }}>
      {/* The status is this screen's one pigment moment, and it is spent on
          a chip — a 4px dot carrying the colour so the words stay ink. The
          old bold tinted string competed with the summary for rank. */}
      <div className="page-header" style={{ marginBottom: 'var(--s4)' }}>
        <p className="eyebrow" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          {!degraded && (
            <span
              className="pulse-live"
              aria-hidden="true"
              style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cyan)', display: 'inline-block', flex: 'none' }}
            />
          )}
          Coach's briefing
        </p>
        <span className={`chip tone-${tone}`}>
          {STATUS_LABEL[briefing.status] || 'Briefing ready'}
        </span>
      </div>

      <p className="lead">{briefing.summary}</p>

      {/* Plan pace vs actual pace is a two-row comparison, not two big
          numbers — they are phrases, and phrases in stat tiles read as
          broken tiles. Ruled rows put them on one vertical to compare. */}
      <dl style={{ margin: 'var(--s5) 0 0', borderTop: '1px solid var(--border)' }}>
        <div className="list-row">
          <dt className="muted">Plan pace</dt>
          <dd className="ledger-figure">{briefing.currentPace}</dd>
        </div>
        <div className="list-row">
          <dt className="muted">Your actual pace</dt>
          <dd className="ledger-figure">{briefing.actualPace}</dd>
        </div>
      </dl>

      {briefing.focus?.length > 0 && (
        <div style={{ marginTop: 'var(--s5)' }}>
          <p className="eyebrow" style={{ margin: '0 0 var(--s2)' }}>Focus today</p>
          {/* Numbered ruled rows rather than bullets: three ordered
              instructions read as a sequence, and the mono index gives the
              list a left vertical to hang on. */}
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {briefing.focus.map((f, i) => (
              <li
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.75rem minmax(0, 1fr)',
                  gap: 'var(--s2)',
                  alignItems: 'baseline',
                  padding: 'var(--s2) 0',
                  borderTop: '1px solid var(--border)',
                  fontSize: 'var(--t-small)',
                }}
              >
                <span
                  className="mono faint"
                  aria-hidden="true"
                  style={{ fontSize: 'var(--t-label)', letterSpacing: '0.14em' }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {(briefing.source === 'fallback' || briefing.stale) && (
        // The provenance footnotes sit below a rule, in the footnote voice —
        // present and findable, but never mistaken for the coach's read.
        <div style={{ marginTop: 'var(--s5)', paddingTop: 'var(--s3)', borderTop: '1px solid var(--border)' }}>
          {briefing.source === 'fallback' && (
            <p className="tiny faint" style={{ margin: 0 }}>AI coach unreachable right now — this will refresh on the next visit.</p>
          )}
          {briefing.stale && (
            <p className="tiny tone-amber-text" style={{ margin: briefing.source === 'fallback' ? 'var(--s1) 0 0' : 0 }}>
              This is the day's earlier briefing — your latest changes fold in as soon as the coach is reachable again.
            </p>
          )}
        </div>
      )}
    </section>
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
        <p className="muted" style={{ fontSize: 'var(--t-h3)', margin: '0 0 var(--s5)' }}>{error}</p>
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
        <p className="muted" style={{ fontSize: 'var(--t-h3)', margin: '0 0 var(--s5)' }}>
          Complete a quick onboarding and we'll generate your training and nutrition plan.
        </p>
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
    <div className="page page-wide page-enter">
      {/* The masthead: date, then the day. No atmosphere behind it — a wash
          of coloured light over a page of measurements is decoration, and
          decoration is the one thing this system will not spend on. */}
      <p className="eyebrow reveal" style={{ margin: '0 0 var(--s1)' }}>{dateLabel}</p>
      <h1 className="page-title reveal" style={{ animationDelay: '70ms', marginBottom: 'var(--s5)' }}>Today</h1>

      {planComplete && (
        <p className="notice tone-emerald" style={{ marginBottom: 'var(--s5)' }}>
          Your <strong>{timeframeWeeks}-week plan is complete</strong> — well done for seeing it through.{' '}
          <Link to="/profile">Set your next goal →</Link>
        </p>
      )}

      <BriefingCard briefing={briefing} loading={briefingLoading} error={briefingError} onRetry={loadBriefing} />

      <DailyChecklist />

      {/* Today's two actions. The full weekly split lives on the Plan page —
          this screen is about today only. Set as a ruled ledger beneath the
          briefing and the mission: still one tap, no longer competing for
          the eye with the two things the user came for. */}
      <nav style={{ marginTop: 'var(--s6)', borderTop: '1px solid var(--border)' }}>
        <Link to="/workout" className="ledger-row">
          <div style={{ minWidth: 0 }}>
            <h3 className="ledger-label" style={{ margin: 0 }}>Workout</h3>
            <p className="small muted" style={{ margin: '0.15rem 0 0' }}>
              {plan.days?.length ? <><span className="mono">{plan.days.length}</span>-day split · log today's sets</> : "Log today's sets"}
            </p>
          </div>
          <span className="small muted" style={{ whiteSpace: 'nowrap' }}>Open today's workout →</span>
        </Link>
        <Link to="/nutrition" className="ledger-row">
          <div style={{ minWidth: 0 }}>
            <h3 className="ledger-label" style={{ margin: 0 }}>Nutrition</h3>
            <p className="small muted" style={{ margin: '0.15rem 0 0' }}>
              Daily target: <span className="mono">{calorieTarget ?? '—'}</span> kcal
              {plan.diet?.proteinGrams ? <> · <span className="mono">{plan.diet.proteinGrams}g</span> protein</> : null}
            </p>
          </div>
          <span className="small muted" style={{ whiteSpace: 'nowrap' }}>Log a meal or analyze a photo →</span>
        </Link>
      </nav>
    </div>
  );
}
