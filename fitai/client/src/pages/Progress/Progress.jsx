import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { getProgressReport, logWeight, getAchievements, getReview } from '../../services/progressService';
import { apiFetch } from '../../utils/apiClient';
import Button from '../../components/ui/Button';

// Semantic tones per docs/design-system.md — emerald means on-pace,
// amber means attention, never decorative.
const PACE_TONES = { ahead: 'emerald', on_track: 'emerald', behind: 'amber', no_data: 'muted' };
const PACE_LABELS = { ahead: 'Ahead of schedule', on_track: 'On track', behind: 'Behind schedule', no_data: 'Not enough data yet' };
// Porcelain pigments (see styles/theme.css): anchor blue for the raw
// line, anchor emerald for the smoothed truth, saffron target rule.
const CHART = { line: '#3b82f6', avg: '#10b981', target: '#cd853a', axis: '#8d96a0' };

function Stat({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? '—'}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

const pct = (v) => (v == null ? null : `${Math.round(v * 100)}%`);

export default function Progress() {
  const [report, setReport] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [review, setReview] = useState(null);
  const [history, setHistory] = useState([]);
  const [weightInput, setWeightInput] = useState('');
  const [error, setError] = useState('');
  const [logging, setLogging] = useState(false);

  async function loadAll() {
    const results = await Promise.allSettled([
      getProgressReport(),
      getAchievements(),
      getReview('weekly'),
      apiFetch('/api/checklist/history?days=28'),
    ]);
    if (results[0].status === 'fulfilled') setReport(results[0].value);
    else setError(results[0].reason?.message || 'Could not load progress');
    if (results[1].status === 'fulfilled') setAchievements(results[1].value);
    if (results[2].status === 'fulfilled') setReview(results[2].value);
    if (results[3].status === 'fulfilled') setHistory(results[3].value);
  }

  useEffect(() => { loadAll(); }, []);

  async function handleLogWeight(e) {
    e.preventDefault();
    setLogging(true);
    setError('');
    try {
      await logWeight(Number(weightInput));
      setWeightInput('');
      await loadAll(); // a new weigh-in invalidates today's snapshot server-side
    } catch (err) {
      setError(err.message);
    } finally {
      setLogging(false);
    }
  }

  if (!report && !error) return <div className="page-loading">Computing your progress…</div>;
  if (!report) {
    return (
      <div className="page page-mid page-enter">
        <h2 className="page-title">Progress</h2>
        <p className="muted">{error}</p>
        <Link to="/onboarding"><Button>Complete onboarding</Button></Link>
      </div>
    );
  }

  const { goal, timeline, weight, expected, actual, pace, adherence, streaks, progressPercent } = report;
  const tone = PACE_TONES[pace.status] || 'muted';
  const chartData = (weight?.trend || []).map((p) => ({
    date: typeof p.date === 'string' ? p.date.slice(5, 10) : p.date,
    weight: p.weightKg,
    avg: p.avg7,
  }));

  return (
    <div className="page page-wide page-enter">
      <header className="page-header">
        <h2 className="page-title">Progress</h2>
        <Link to="/plan">Edit plan →</Link>
      </header>

      {/* ---- The plan & pace card ---- */}
      <div className={`card card-accent tone-${tone}`} style={{ marginBottom: '1rem' }}>
        <div className="page-header">
          <div>
            <h3 style={{ margin: 0 }}>
              {goal.type?.replace(/_/g, ' ')}
              {goal.targetWeightKg ? <span className="mono"> → {goal.targetWeightKg}kg</span> : ''}
            </h3>
            <p className="muted small" style={{ margin: '0.25rem 0' }}>
              {goal.timeframeWeeks}-week plan · week {Math.max(1, Math.ceil(timeline.weeksElapsed))} of {goal.timeframeWeeks}
              {goal.targetDate ? ` · target ${goal.targetDate}` : ''}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className={`tone-${tone === 'muted' ? 'cyan' : tone}-text`} style={{ fontWeight: 700 }}>
              {PACE_LABELS[pace.status]}
            </div>
            <div className="tiny faint mono">risk: {pace.riskLevel}</div>
          </div>
        </div>
        <p className="small" style={{ marginBottom: '0.5rem' }}>{pace.message}</p>
        {pace.explanations?.length > 0 && (
          <ul className="small muted" style={{ margin: '0.25rem 0', paddingLeft: '1.25rem' }}>
            {pace.explanations.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        )}
        {pace.recommendations?.length > 0 && (
          <p className="small"><strong>Coach suggests:</strong> <span className="muted">{pace.recommendations.join(' ')}</span></p>
        )}
        <div className="progress-track" style={{ marginTop: '0.5rem' }}>
          <div className={`progress-fill tone-${tone === 'muted' ? 'emerald' : tone}`} style={{ width: `${timeline.percentTimeElapsed}%` }} />
        </div>
        <div className="progress-meta">
          <span>{timeline.percentTimeElapsed}% of time elapsed</span>
          <span>{progressPercent != null ? `${progressPercent}% of goal covered` : ''}</span>
          <span>{timeline.weeksRemaining} wks left</span>
        </div>
      </div>

      {/* ---- Stat grid ---- */}
      <div className="stat-grid">
        <Stat label="Current weight" value={weight.currentKg ? `${weight.currentKg}kg` : null} sub={weight.totalChangeKg != null ? `${weight.totalChangeKg > 0 ? '+' : ''}${weight.totalChangeKg}kg since start` : 'log a weigh-in below'} />
        <Stat label="Expected now" value={expected.weightNowKg ? `${expected.weightNowKg}kg` : null} sub={`plan pace ${expected.weeklyRateKg}kg/wk`} />
        <Stat label="Your pace" value={actual.weeklyRateKg != null ? `${actual.weeklyRateKg}kg/wk` : null} sub={pace.projectedWeeksToTarget != null ? `~${pace.projectedWeeksToTarget} wks to target at this rate` : null} />
        <Stat label="Streak" value={<span className={streaks.current > 0 ? 'tone-lime-text' : ''}>{streaks.current}d</span>} sub={`best ${streaks.best}d`} />
      </div>
      <div className="stat-grid">
        <Stat label="Adherence (7d)" value={pct(adherence.last7)} sub={`28d: ${pct(adherence.last28) ?? '—'}`} />
        <Stat label="Workout consistency" value={pct(adherence.workoutConsistency)} />
        <Stat label="Nutrition consistency" value={pct(adherence.nutritionConsistency)} />
        <Stat label="Recovery score" value={pct(adherence.recoveryScore)} sub={`sleep ${pct(adherence.sleepScore) ?? '—'}`} />
      </div>

      {/* ---- Weight logging + trend chart ---- */}
      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>Body weight</h3>
        <form onSubmit={handleLogWeight} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input type="number" step="0.1" min="30" max="300" placeholder="Today's weight (kg)" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} required style={{ flex: 1 }} />
          <Button type="submit" disabled={logging}>{logging ? 'Saving…' : 'Log weigh-in'}</Button>
        </form>
        {chartData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" fontSize={11} stroke={CHART.axis} tickLine={false} axisLine={false} />
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} fontSize={11} width={40} stroke={CHART.axis} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(42,52,64,0.15)', borderRadius: 12, color: '#212b36', boxShadow: '0 12px 32px -12px rgba(42,52,64,0.3)' }} />
              {goal.targetWeightKg && <ReferenceLine y={goal.targetWeightKg} stroke={CHART.target} strokeDasharray="4 4" label={{ value: 'target', fontSize: 10, fill: CHART.target }} />}
              <Line type="monotone" dataKey="weight" stroke={CHART.line} dot={{ r: 2, fill: CHART.line }} name="weight (kg)" strokeWidth={1.5} />
              <Line type="monotone" dataKey="avg" stroke={CHART.avg} dot={false} strokeWidth={2} name="7-day avg" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="faint small">Log at least two weigh-ins to see your trend against the plan.</p>
        )}
      </section>

      {/* ---- Weekly review ---- */}
      {review?.narrative && (
        <section className="card card-accent tone-cyan" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>
            Weekly review <span className="tiny faint mono">{review.period_start} → {review.period_end}</span>
          </h3>
          <p style={{ fontWeight: 600 }}>{review.narrative.headline}</p>
          {review.narrative.wins?.length > 0 && (
            <>
              <span className="stat-label">Wins</span>
              <ul className="small" style={{ marginTop: '0.25rem' }}>{review.narrative.wins.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </>
          )}
          {review.narrative.focusNext?.length > 0 && (
            <>
              <span className="stat-label">Focus next week</span>
              <ul className="small" style={{ marginTop: '0.25rem' }}>{review.narrative.focusNext.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </>
          )}
          <p className="small muted">{review.narrative.recommendation}</p>
        </section>
      )}

      {/* ---- Achievements ---- */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h3 className="section-title">Achievements {achievements.length ? `(${achievements.length})` : ''}</h3>
        {achievements.length === 0 && <p className="faint small">None yet — log workouts and weigh-ins to start unlocking.</p>}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {achievements.map((a) => (
            <div key={a.code} className="badge-card" title={a.description}>
              🏅 <strong>{a.name}</strong>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Daily consistency (28d) ---- */}
      <section>
        <h3 className="section-title">Daily consistency (last 28 days)</h3>
        <div className="heat-strip">
          {[...history].reverse().map((day) => {
            const done = Object.values(day).filter((v) => v === true).length;
            const dateLabel = typeof day.date === 'string' ? day.date.slice(0, 10) : day.date;
            return (
              <div
                key={dateLabel}
                title={`${dateLabel}: ${done}/5`}
                className="heat-cell"
                style={done > 0 ? { background: `rgba(16, 185, 129, ${0.18 + (done / 5) * 0.75})`, borderColor: 'transparent' } : undefined}
              />
            );
          })}
        </div>
      </section>

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
