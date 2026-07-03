import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../utils/apiClient';
import { getProgressReport } from '../../services/progressService';
import DailyChecklist from '../../components/checklist/DailyChecklist';
import Button from '../../components/ui/Button';

const PACE_TONES = { ahead: 'emerald', on_track: 'emerald', behind: 'amber', no_data: 'muted' };
const PACE_LABELS = { ahead: 'Ahead of schedule', on_track: 'On track', behind: 'Behind schedule', no_data: 'Log data to track pace' };

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/onboarding')
      .then(setProfile)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // Progress card is enrichment — its failure must not block the dashboard.
    getProgressReport().then(setProgress).catch(() => {});
  }, []);

  if (loading) return <div className="page-loading">Loading your plan…</div>;

  if (error || !profile?.plan) {
    return (
      <div className="dashboard-empty page-enter">
        <h2 className="page-title">No plan found</h2>
        <p className="muted">{error || 'Complete onboarding to generate your plan.'}</p>
        <Link to="/onboarding"><Button>Complete onboarding</Button></Link>
      </div>
    );
  }

  const plan = profile.plan;
  const calorieTarget = plan.diet?.calorieTarget ?? plan.calorieTarget ?? null;
  const tone = PACE_TONES[progress?.pace?.status] || 'muted';

  return (
    <div className="page page-wide page-enter">
      <header className="dashboard-header">
        <h1>Today</h1>
      </header>

      <DailyChecklist />

      <div className="grid-cards">
        {progress && (
          <Link to="/progress" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className={`card card-hover card-accent tone-${tone}`} style={{ height: '100%' }}>
              <h3>Progress</h3>
              <p className={`tone-${tone === 'muted' ? 'cyan' : tone}-text small`} style={{ fontWeight: 600, margin: '0 0 0.25rem' }}>
                {PACE_LABELS[progress.pace?.status] || '—'}
              </p>
              <p className="small muted" style={{ margin: '0 0 0.25rem' }}>
                Week <span className="mono">{Math.max(1, Math.ceil(progress.timeline?.weeksElapsed ?? 0))}</span> of{' '}
                <span className="mono">{progress.goal?.timeframeWeeks}</span> · {progress.timeline?.weeksRemaining} weeks left
              </p>
              {progress.streaks?.current > 0 && (
                <p className="small tone-lime-text" style={{ margin: 0 }}>🔥 {progress.streaks.current}-day streak</p>
              )}
              <span className="small">Full progress report →</span>
            </div>
          </Link>
        )}
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
        <Link to="/tutor" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card card-hover card-accent tone-cyan" style={{ height: '100%' }}>
            <h3>AI Coach</h3>
            <p className="small muted">Training, diet, or recovery — answered with your history in mind.</p>
            <span className="small">Ask your coach →</span>
          </div>
        </Link>
      </div>

      <section className="weekly-plan">
        <header className="page-header">
          <h2 className="section-title" style={{ margin: 0 }}>
            Weekly split{plan.customized ? <span className="chip tone-blue" style={{ marginLeft: 8 }}>customized</span> : ''}
          </h2>
          <Link to="/plan" className="small">Edit plan →</Link>
        </header>
        {plan.timeframe?.adjusted && plan.timeframe.adjustedReason && (
          <p className="notice">{plan.timeframe.adjustedReason}</p>
        )}
        {plan.days?.map((day) => (
          <div key={day.name} className="plan-day">
            <h3>{day.name}</h3>
            <ul>
              {day.exercises.map((ex) => (
                <li key={ex.name}>{ex.name} — <span className="mono">{ex.sets}×{ex.reps}</span></li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
