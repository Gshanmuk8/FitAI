import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProgress } from '../../services/progressService';
import Button from '../../components/ui/Button';

// status → CSS tone is the only mapping this file owns, and it's pure
// presentation (which accent color a status gets). The words next to it —
// headline, statusLabel, every number, every chart — are the coach's.
const STATUS_TONE = { ahead: 'emerald', on_track: 'emerald', behind: 'amber', no_data: 'cyan' };

// Tone → text class. Everything the page shows as a number is the coach's
// own arithmetic (analysis.stats / analysis.charts) — this file only
// renders; it deliberately computes nothing from the raw data.
const toneClass = (tone) => (tone && tone !== 'neutral' ? `tone-${tone}-text` : '');

const fmtAxis = (v) =>
  Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : Number.isInteger(v) ? String(v) : v.toFixed(1);

/**
 * Weigh-in trend as a plain SVG — no chart dependency for one line. Used
 * ONLY in the coach-unreachable-and-never-analyzed state, where AI content
 * doesn't exist by definition: it shows the raw logged series, labeled as
 * raw data. On the real page every graph is coach-authored (CoachChart).
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
          <line x1={PAD.left} x2={W - PAD.right} y1={y(targetKg)} y2={y(targetKg)} stroke="var(--amber, #d97706)" strokeDasharray="5 4" opacity="0.7" />
          <text x={W - PAD.right} y={y(targetKg) - 5} textAnchor="end" fontSize="11" fill="var(--amber, #d97706)">
            target {targetKg}kg
          </text>
        </g>
      )}
      <path d={path} fill="none" stroke="var(--gold, #5a5ce0)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {weighIns.map((p, i) => (
        <circle key={p.date + i} cx={x(i)} cy={y(p.kg)} r="2.6" fill="var(--gold, #5a5ce0)" />
      ))}
      <text x={PAD.left} y={H - 8} fontSize="11" fill="currentColor" opacity="0.5">{first.date}</text>
      <text x={W - PAD.right} y={H - 8} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.5">{last.date}</text>
    </svg>
  );
}

/**
 * Renders one coach-authored chart ({ title, type, unit, points, targetValue,
 * note }) as an SVG. Line and bar, nothing else — the coach picks the series
 * and computed every value; this component is pure presentation.
 */
function CoachChart({ chart }) {
  const points = Array.isArray(chart.points) ? chart.points : [];
  if (points.length < 2) return null;

  const W = 640, H = 230, PAD = { top: 16, right: 14, bottom: 28, left: 48 };
  const values = points.map((p) => p.value);
  const lo = Math.min(...values, chart.targetValue ?? Infinity, chart.type === 'bar' ? 0 : Infinity);
  const hi = Math.max(...values, chart.targetValue ?? -Infinity);
  const span = Math.max(hi - lo, 1e-9);
  const yMin = chart.type === 'bar' ? Math.min(lo, 0) : lo - span * 0.1;
  const yMax = hi + span * 0.1;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  // At most ~6 x-labels so dense series stay readable.
  const step = Math.max(1, Math.ceil(points.length / 6));
  const showLabel = (i) => i % step === 0 || i === points.length - 1;

  const gridVals = [0.25, 0.5, 0.75].map((t) => yMin + (yMax - yMin) * t);
  const barW = (plotW / points.length) * 0.62;
  const barX = (i) => PAD.left + (i + 0.5) * (plotW / points.length) - barW / 2;
  const linePath = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');

  return (
    <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
      <div className="page-header">
        <h3 style={{ margin: 0 }}>{chart.title}</h3>
        {chart.unit && <span className="chip">{chart.unit}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={chart.title} style={{ width: '100%', height: 'auto', marginTop: '0.4rem' }}>
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="currentColor" opacity="0.08" />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.5">
              {fmtAxis(v)}
            </text>
          </g>
        ))}
        {chart.targetValue != null && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(chart.targetValue)} y2={y(chart.targetValue)} stroke="var(--amber, #d97706)" strokeDasharray="5 4" opacity="0.7" />
            <text x={W - PAD.right} y={y(chart.targetValue) - 5} textAnchor="end" fontSize="11" fill="var(--amber, #d97706)">
              target {fmtAxis(chart.targetValue)}{chart.unit ? ` ${chart.unit}` : ''}
            </text>
          </g>
        )}
        {chart.type === 'bar' ? (
          points.map((p, i) => (
            <rect
              key={`${p.label}-${i}`}
              x={barX(i)}
              y={Math.min(y(p.value), y(0))}
              width={barW}
              height={Math.max(1.5, Math.abs(y(p.value) - y(0)))}
              rx="3"
              fill="var(--gold, #5a5ce0)"
              opacity="0.85"
            />
          ))
        ) : (
          <>
            <path d={linePath} fill="none" stroke="var(--gold, #5a5ce0)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (
              <circle key={`${p.label}-${i}`} cx={x(i)} cy={y(p.value)} r="2.6" fill="var(--gold, #5a5ce0)" />
            ))}
          </>
        )}
        {points.map((p, i) =>
          showLabel(i) ? (
            <text
              key={`lbl-${p.label}-${i}`}
              x={chart.type === 'bar' ? barX(i) + barW / 2 : x(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize="11"
              fill="currentColor"
              opacity="0.5"
            >
              {p.label}
            </text>
          ) : null
        )}
      </svg>
      {chart.note && <p className="small muted" style={{ margin: '0.5rem 0 0' }}>{chart.note}</p>}
    </div>
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
  const [retrying, setRetrying] = useState(false);

  async function load() {
    try {
      setReport(await getProgress());
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setRetrying(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Anything logged in another tab (or a long-open tab crossing new data)
  // must show here without a manual reload — same pattern as the checklist.
  // Server-side this is cheap: unchanged data serves the stored analysis.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') load();
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function retry() {
    setRetrying(true);
    load();
  }

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
  const { goal, weighIns } = data;
  const tone = STATUS_TONE[analysis.status] || 'cyan';
  const stats = Array.isArray(analysis.stats) ? analysis.stats : [];
  const charts = Array.isArray(analysis.charts) ? analysis.charts : [];

  // Coach unreachable AND this account has never had a real analysis: show
  // ONE honest state — real logged data, no template filler dressed up as
  // analysis. (When a past analysis exists, the server serves it instead,
  // marked stale, and we render it in full below.)
  if (analysis.source === 'fallback') {
    const latestWeight = weighIns.length ? weighIns[weighIns.length - 1].kg : null;
    return (
      <div className="page page-wide page-enter">
        <header className="page-header">
          <h2 className="page-title">Progress</h2>
          <Link to="/plan">Edit plan →</Link>
        </header>
        <div className="card card-accent tone-amber" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Your coach couldn't be reached</h3>
          <p className="small" style={{ margin: '0.5rem 0' }}>
            Nothing here is made up while the AI is away — your logged data below is safe, and the full
            analysis, stats and charts are generated the moment the coach is back.
          </p>
          <Button onClick={retry} disabled={retrying}>{retrying ? 'Retrying…' : 'Try again now'}</Button>
        </div>
        <section className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <div className="page-header">
            <h3 style={{ margin: 0 }}>Weight trend</h3>
            {latestWeight != null && <span className="chip">{latestWeight}kg now</span>}
          </div>
          <WeightChart weighIns={weighIns} targetKg={goal.targetWeightKg} />
          <p className="tiny faint" style={{ margin: '0.5rem 0 0' }}>
            Weigh in each morning on <Link to="/dashboard">Today's Mission</Link> — every entry lands in the coach's next analysis.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="page page-wide page-enter">
      <header className="page-header">
        <h2 className="page-title">Progress</h2>
        <Link to="/plan">Edit plan →</Link>
      </header>

      {/* ---- Stale: a REAL past analysis served while a refresh is blocked
              by a provider outage — say so plainly and offer the retry ---- */}
      {report.stale && (
        <div className="notice tone-amber" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <span className="small" style={{ flex: 1 }}>
            Showing your last analysis{report.staleDate ? ` (${report.staleDate})` : ''} — the coach couldn't be
            reached to fold in your latest changes yet.
          </span>
          <Button onClick={retry} disabled={retrying}>{retrying ? 'Retrying…' : 'Refresh now'}</Button>
        </div>
      )}

      {/* ---- The coach's analysis — the heart of the page. Headline and
              status label are its words too; the only non-AI text on this
              path is the raw goal type shown while a pre-headline stored
              analysis is served stale during an outage. ---- */}
      <div className={`card card-accent tone-${tone}`} style={{ marginBottom: '1rem' }}>
        <div className="page-header">
          <h3 style={{ margin: 0 }}>{analysis.headline || goal.type?.replace(/_/g, ' ')}</h3>
          {analysis.statusLabel && (
            <span className={`tone-${tone}-text`} style={{ fontWeight: 700 }}>{analysis.statusLabel}</span>
          )}
        </div>
        <p className="small" style={{ margin: '0.5rem 0' }}>{analysis.summary}</p>
        <AnalysisList title="Going well" items={analysis.wins} />
        <AnalysisList title="Watch out" items={analysis.risks} />
        <AnalysisList title="Do next" items={analysis.recommendations} />
      </div>

      {/* ---- The coach's numbers — every figure computed by the AI from the
              logs (implausible entries excluded by its own judgment), so a
              tile can never contradict the analysis above ---- */}
      {stats.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: '1rem' }}>
          {stats.map((s, i) => (
            <div key={`${s.label}-${i}`} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className={`stat-value ${toneClass(s.tone)}`}>{s.value}</div>
              {s.detail && <div className="stat-sub">{s.detail}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ---- The coach's charts — the page's ONLY graphs: series it chose,
              values it computed. The weight line (with the target rule) is
              chart #1 by the prompt's contract. ---- */}
      {charts.map((chart, i) => (
        <CoachChart key={`${chart.title}-${i}`} chart={chart} />
      ))}

      {/* ---- Weight, training & nutrition — the coach's read, in words ---- */}
      <div className="grid-cards" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Weight</h3>
          <p className="small muted" style={{ marginBottom: 0 }}>{analysis.weightTrend}</p>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Training</h3>
          <p className="small muted" style={{ marginBottom: 0 }}>{analysis.trainingAnalysis}</p>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Nutrition</h3>
          <p className="small muted" style={{ marginBottom: 0 }}>{analysis.nutritionAnalysis}</p>
        </div>
      </div>
      <p className="tiny faint" style={{ margin: '0 0 1rem' }}>
        Everything above is your coach's own read of your logs. Weigh in each morning on{' '}
        <Link to="/dashboard">Today's Mission</Link> — the analysis regenerates as soon as new data lands.
      </p>
    </div>
  );
}
