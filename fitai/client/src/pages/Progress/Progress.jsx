import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProgress } from '../../services/progressService';
import Button from '../../components/ui/Button';

const STATUS_TONE = { ahead: 'emerald', on_track: 'emerald', behind: 'amber', no_data: 'cyan' };
const STATUS_LABEL = { ahead: 'Ahead of schedule', on_track: 'On track', behind: 'Needs attention', no_data: 'Building your picture' };

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);

/**
 * Weigh-in trend as a plain SVG — no chart dependency for one line. The
 * viewBox keeps it responsive; a dashed rule marks the target weight when
 * the goal has one.
 */
function WeightChart({ weighIns, targetKg }) {
  if (!weighIns || weighIns.length < 2) {
    return (
      <p className="small muted">
        {weighIns?.length === 1
          ? 'One weigh-in so far — log a few more on the dashboard and the trend appears here.'
          : 'No weigh-ins yet — log today\'s weight on the dashboard\'s Today\'s Mission.'}
      </p>
    );
  }

  const W = 640, H = 220, PAD = { top: 14, right: 14, bottom: 26, left: 44 };
  const kgs = weighIns.map((p) => p.kg);
  const lo = Math.min(...kgs, targetKg ?? Infinity);
  const hi = Math.max(...kgs, targetKg ?? -Infinity);
  const span = Math.max(hi - lo, 1);
  const yMin = lo - span * 0.1;
  const yMax = hi + span * 0.1;

  const x = (i) => PAD.left + (i / (weighIns.length - 1)) * (W - PAD.left - PAD.right);
  const y = (kg) => PAD.top + (1 - (kg - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);
  const path = weighIns.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');

  const first = weighIns[0], last = weighIns[weighIns.length - 1];
  const gridKgs = [yMin + (yMax - yMin) * 0.25, yMin + (yMax - yMin) * 0.5, yMin + (yMax - yMin) * 0.75];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weight trend chart" style={{ width: '100%', height: 'auto' }}>
      {gridKgs.map((kg) => (
        <g key={kg}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(kg)} y2={y(kg)} stroke="currentColor" opacity="0.08" />
          <text x={PAD.left - 6} y={y(kg) + 4} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.5">
            {kg.toFixed(1)}
          </text>
        </g>
      ))}
      {targetKg != null && (
        <g>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(targetKg)} y2={y(targetKg)} stroke="var(--accent, #cd853a)" strokeDasharray="5 4" opacity="0.7" />
          <text x={W - PAD.right} y={y(targetKg) - 5} textAnchor="end" fontSize="11" fill="var(--accent, #cd853a)">
            target {targetKg}kg
          </text>
        </g>
      )}
      <path d={path} fill="none" stroke="var(--gold, #cfa752)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {weighIns.map((p, i) => (
        <circle key={p.date + i} cx={x(i)} cy={y(p.kg)} r="2.6" fill="var(--gold, #cfa752)" />
      ))}
      <text x={PAD.left} y={H - 8} fontSize="11" fill="currentColor" opacity="0.5">{first.date}</text>
      <text x={W - PAD.right} y={H - 8} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.5">{last.date}</text>
    </svg>
  );
}

function AnalysisList({ title, items, tone }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginTop: '0.6rem' }}>
      <span className="stat-label">{title}</span>
      <ul className={`small ${tone || 'muted'}`} style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem' }}>
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  );
}

export default function Progress() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getProgress()
      .then(setReport)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    const notOnboarded = /no profile found/i.test(error);
    return (
      <div className="page page-mid page-enter">
        <h2 className="page-title">Progress</h2>
        <p className="muted">{notOnboarded ? 'Complete onboarding first — progress tracking starts with your plan.' : error}</p>
        {notOnboarded
          ? <Link to="/onboarding"><Button>Complete onboarding</Button></Link>
          : <Button onClick={() => window.location.reload()}>Try again</Button>}
      </div>
    );
  }
  if (!report) {
    // First view of the day runs the AI over the full history — set that
    // expectation so the wait reads as analysis, not a hang.
    return <div className="page-loading">Your coach is reading your whole journey…</div>;
  }

  const { data, analysis } = report;
  const { goal, weighIns, adherence, training } = data;
  const tone = STATUS_TONE[analysis.status] || 'cyan';
  const latestWeight = weighIns.length ? weighIns[weighIns.length - 1].kg : null;
  const totalVolume = training.reduce((sum, t) => sum + (t.volumeKg || 0), 0);
  // Readable units: "12,400 kg" until tonnes actually mean something.
  const volumeLabel = !totalVolume
    ? '—'
    : totalVolume >= 10000
      ? `${(totalVolume / 1000).toFixed(1)}t`
      : `${Math.round(totalVolume).toLocaleString()} kg`;

  return (
    <div className="page page-wide page-enter">
      <header className="page-header">
        <h2 className="page-title">Progress</h2>
        <Link to="/plan">Edit plan →</Link>
      </header>

      {/* ---- The coach's analysis — the heart of the page ---- */}
      <div className={`card card-accent tone-${tone}`} style={{ marginBottom: '1rem' }}>
        <div className="page-header">
          <div>
            <h3 style={{ margin: 0 }}>
              {goal.type?.replace(/_/g, ' ')}
              {goal.targetWeightKg ? <span className="mono"> → {goal.targetWeightKg}kg</span> : ''}
            </h3>
            {goal.timeframeWeeks && (
              <p className="muted small" style={{ margin: '0.25rem 0' }}>
                {goal.timeframeWeeks}-week plan{goal.weeksElapsed != null ? ` · week ${Math.max(1, Math.ceil(goal.weeksElapsed))}` : ''}
              </p>
            )}
          </div>
          <span className={`tone-${tone}-text`} style={{ fontWeight: 700 }}>{STATUS_LABEL[analysis.status] || ''}</span>
        </div>
        <p className="small" style={{ margin: '0.5rem 0' }}>{analysis.summary}</p>
        <AnalysisList title="Going well" items={analysis.wins} />
        <AnalysisList title="Watch out" items={analysis.risks} />
        <AnalysisList title="Do next" items={analysis.recommendations} />
        {analysis.source === 'fallback' && (
          <p className="tiny faint" style={{ marginTop: '0.5rem' }}>AI coach unreachable right now — the analysis will refresh on your next visit.</p>
        )}
      </div>

      {/* ---- Weight trend: the raw truth the analysis was read from ---- */}
      <section className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div className="page-header">
          <h3 style={{ margin: 0 }}>Weight trend</h3>
          {latestWeight != null && <span className="chip">{latestWeight}kg now</span>}
        </div>
        <WeightChart weighIns={weighIns} targetKg={goal.targetWeightKg} />
        <p className="small muted" style={{ margin: '0.5rem 0 0' }}>{analysis.weightTrend}</p>
        <p className="tiny faint" style={{ margin: '0.25rem 0 0' }}>
          Weigh in each morning on <Link to="/dashboard">Today's Mission</Link> — the analysis updates as soon as new data lands.
        </p>
      </section>

      {/* ---- Training & nutrition, data + the coach's read ---- */}
      <div className="grid-cards" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Training</h3>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Sessions (28d)</div>
              <div className="stat-value">{training.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Volume lifted (28d)</div>
              <div className="stat-value">{volumeLabel}</div>
            </div>
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>{analysis.trainingAnalysis}</p>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Consistency</h3>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Last 7 days</div>
              <div className="stat-value">{pct(adherence.last7)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Last 28 days</div>
              <div className="stat-value">{pct(adherence.last28)}</div>
            </div>
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>{analysis.nutritionAnalysis}</p>
        </div>
      </div>
    </div>
  );
}
