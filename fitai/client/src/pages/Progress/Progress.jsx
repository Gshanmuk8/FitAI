import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProgress } from '../../services/progressService';
import { useElementWidth } from '../../hooks/useElementWidth';
import Button from '../../components/ui/Button';

// status → CSS tone is the only mapping this file owns, and it's pure
// presentation (which accent color a status gets). The words next to it —
// headline, statusLabel, every number, every chart — are the coach's.
const STATUS_TONE = { ahead: 'emerald', on_track: 'emerald', behind: 'amber', no_data: 'cyan' };

// Tone → a token, for the 4px dot beside a stat's label. The coach's tone is
// information and must survive, but a wall of pigmented 38px numerals is the
// screen shouting six things at once. The dot keeps the meaning; the figure
// stays ink, so the stat row reads as one tabular ledger. Whitelisted so an
// unexpected tone name can never emit an undefined custom property.
const TONE_VAR = {
  emerald: 'var(--emerald)',
  amber: 'var(--amber)',
  red: 'var(--red)',
  cyan: 'var(--cyan)',
  lime: 'var(--lime)',
  blue: 'var(--blue)',
};
const toneDot = (tone) => (tone && tone !== 'neutral' ? TONE_VAR[tone] : null);

const fmtAxis = (v) =>
  Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : Number.isInteger(v) ? String(v) : v.toFixed(1);

// Chart type, in the label voice: mono, tracked, quiet, and — because these
// are axis figures — tabular. An axis set in the body face at a browser
// default size is the tell of a chart nobody drew on purpose.
// Charts use a viewBox set to their real pixel width, so 1 SVG unit = 1 CSS
// pixel and an 11px axis label stays 11px on a phone (a fixed 640 viewBox
// scaled it down to ~6px). Both charts also set an explicit height rather than
// `height: auto`: iOS Safari and some Android WebViews don't derive height from
// the viewBox and collapse the SVG to zero — the "charts missing on mobile" bug.
const AXIS_FONT_PX = 11; // matches --t-label
const AXIS_TEXT = {
  fontFamily: 'var(--font-mono)',
  fontSize: `${AXIS_FONT_PX}px`,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '0.04em',
};

// Narrow screens get a taller plot so it stays readable instead of a strip.
function chartMetrics(width) {
  const W = width > 0 ? width : 640; // 640 covers the first paint, pre-measure
  const aspect = W < 480 ? 0.72 : W < 720 ? 0.48 : 0.34;
  const H = Math.round(Math.min(320, Math.max(190, W * aspect)));
  const PAD = { top: 16, right: 16, bottom: 30, left: 46 };
  return { W, H, PAD, plotW: W - PAD.left - PAD.right, plotH: H - PAD.top - PAD.bottom };
}

// Graphs are built from the user's OWN logged rows, never from the coach.
// The coach used to author them, and returned zero charts for a well-logged
// account often enough that the same data showed graphs one day and none the
// next. Same rows in, same graphs out — on every account.
// A series needs 2 points to draw a line, so shorter ones are simply omitted.
function buildCharts({ nutrition = [], training = [], goal }) {
  const targets = goal?.dietTargets;
  const day = (d) => String(d).slice(5); // YYYY-MM-DD -> MM-DD
  const series = [
    { title: 'Daily calories', unit: 'kcal', target: targets?.calorieTarget,
      points: nutrition.filter((n) => n.calories > 0).map((n) => ({ label: day(n.date), value: n.calories })) },
    { title: 'Daily protein', unit: 'g', target: targets?.proteinGrams,
      points: nutrition.filter((n) => n.protein > 0).map((n) => ({ label: day(n.date), value: n.protein })) },
    { title: 'Training volume', unit: 'kg', target: null,
      points: training.filter((t) => t.volumeKg > 0).map((t) => ({ label: day(t.date), value: t.volumeKg })) },
  ];
  return series
    .filter((s) => s.points.length >= 2)
    .map((s) => ({ title: s.title, type: 'bar', unit: s.unit, points: s.points, targetValue: s.target ?? undefined }));
}

// Thin x-axis labels to what fits: a date needs ~64px. The ends always show.
function labelStep(count, plotW) {
  return Math.max(1, Math.ceil(count / Math.max(2, Math.floor(plotW / 64))));
}

/**
 * Weigh-in trend as a plain SVG — no chart dependency for one line. Used
 * ONLY in the coach-unreachable-and-never-analyzed state, where AI content
 * doesn't exist by definition: it shows the raw logged series, labeled as
 * raw data. On the real page every graph is coach-authored (CoachChart).
 */
function WeightChart({ weighIns, targetKg }) {
  const [ref, width] = useElementWidth();

  if (!weighIns || weighIns.length < 2) {
    // An empty chart is not an error — it is a chart waiting for its second
    // point. Given room and a rule, the absence reads as designed.
    return (
      <div ref={ref} style={{ padding: 'var(--s6) 0', borderTop: '1px solid var(--border)' }}>
        <p className="small muted" style={{ margin: 0, maxWidth: '44ch' }}>
          {weighIns?.length === 1
            ? 'One weigh-in so far — log a few more on the dashboard and the trend appears here.'
            : 'No weigh-ins yet — log today\'s weight on the dashboard\'s Today\'s Mission.'}
        </p>
      </div>
    );
  }

  const { W, H, PAD, plotW, plotH } = chartMetrics(width);
  const kgs = weighIns.map((p) => p.kg);
  const lo = Math.min(...kgs, targetKg ?? Infinity);
  const hi = Math.max(...kgs, targetKg ?? -Infinity);
  const span = Math.max(hi - lo, 1);
  const yMin = lo - span * 0.1;
  const yMax = hi + span * 0.1;

  const x = (i) => PAD.left + (i / (weighIns.length - 1)) * plotW;
  const y = (kg) => PAD.top + (1 - (kg - yMin) / (yMax - yMin)) * plotH;
  const path = weighIns.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');

  const first = weighIns[0], last = weighIns[weighIns.length - 1];
  const gridKgs = [0.25, 0.5, 0.75].map((t) => yMin + (yMax - yMin) * t);

  return (
    <div ref={ref}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label="Weight trend chart"
        style={{ display: 'block', maxWidth: '100%' }}
      >
        {gridKgs.map((kg) => (
          <g key={kg}>
            {/* hairlines, at the same weight as every other rule on the page */}
            <line x1={PAD.left} x2={W - PAD.right} y1={y(kg)} y2={y(kg)} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
            <text x={PAD.left - 8} y={y(kg) + 4} textAnchor="end" fill="var(--faint)" style={AXIS_TEXT}>
              {kg.toFixed(1)}
            </text>
          </g>
        ))}
        {targetKg != null && (
          <g>
            {/* The target is a REFERENCE, not a warning — it gets a dashed rule
                in ink, leaving the series as the only pigment in the frame. */}
            <line x1={PAD.left} x2={W - PAD.right} y1={y(targetKg)} y2={y(targetKg)} stroke="var(--border2)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            <text x={W - PAD.right} y={y(targetKg) - 6} textAnchor="end" fill="var(--muted)" style={AXIS_TEXT}>
              target {targetKg}kg
            </text>
          </g>
        )}
        <path d={path} fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {weighIns.map((p, i) => (
          <circle key={p.date + i} cx={x(i)} cy={y(p.kg)} r="2.6" fill="var(--gold)" />
        ))}
        <text x={PAD.left} y={H - 9} fill="var(--faint)" style={AXIS_TEXT}>{first.date}</text>
        <text x={W - PAD.right} y={H - 9} textAnchor="end" fill="var(--faint)" style={AXIS_TEXT}>{last.date}</text>
      </svg>
    </div>
  );
}

/**
 * Renders one coach-authored chart ({ title, type, unit, points, targetValue,
 * note }) as an SVG. Line and bar, nothing else — the coach picks the series
 * and computed every value; this component is pure presentation.
 */
function CoachChart({ chart }) {
  const [ref, width] = useElementWidth();
  const points = Array.isArray(chart.points) ? chart.points : [];
  if (points.length < 2) return null;

  const { W, H, PAD, plotW, plotH } = chartMetrics(width);
  const values = points.map((p) => p.value);
  const lo = Math.min(...values, chart.targetValue ?? Infinity, chart.type === 'bar' ? 0 : Infinity);
  const hi = Math.max(...values, chart.targetValue ?? -Infinity);
  const span = Math.max(hi - lo, 1e-9);
  const yMin = chart.type === 'bar' ? Math.min(lo, 0) : lo - span * 0.1;
  const yMax = hi + span * 0.1;

  const x = (i) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  // Label density follows the actual pixel width, not a fixed count — a phone
  // shows fewer so they never overlap, a wide screen shows more.
  const step = labelStep(points.length, plotW);
  const showLabel = (i) => i % step === 0 || i === points.length - 1;

  const gridVals = [0.25, 0.5, 0.75].map((t) => yMin + (yMax - yMin) * t);
  const barW = (plotW / points.length) * 0.62;
  const barX = (i) => PAD.left + (i + 0.5) * (plotW / points.length) - barW / 2;
  const linePath = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');

  return (
    // A plate, not a card. Six charts in six boxes is six containers of equal
    // rank stacked down a page; the same six under hairlines read as one
    // continuous report — which is what they are.
    <figure ref={ref} style={{ margin: '0 0 var(--s6)', borderTop: '1px solid var(--border)', paddingTop: 'var(--s4)' }}>
      <figcaption className="page-header" style={{ marginBottom: 'var(--s3)' }}>
        <h3 style={{ margin: 0 }}>{chart.title}</h3>
        {/* a unit is metadata, not a status — it belongs in the label voice */}
        {chart.unit && <span className="eyebrow">{chart.unit}</span>}
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={chart.title}
        style={{ display: 'block', maxWidth: '100%' }}
      >
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
            <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fill="var(--faint)" style={AXIS_TEXT}>
              {fmtAxis(v)}
            </text>
          </g>
        ))}
        {chart.targetValue != null && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(chart.targetValue)} y2={y(chart.targetValue)} stroke="var(--border2)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            <text x={W - PAD.right} y={y(chart.targetValue) - 6} textAnchor="end" fill="var(--muted)" style={AXIS_TEXT}>
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
              rx="2"
              fill="var(--gold)"
              opacity="0.9"
            />
          ))
        ) : (
          <>
            <path d={linePath} fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (
              <circle key={`${p.label}-${i}`} cx={x(i)} cy={y(p.value)} r="2.2" fill="var(--gold)" />
            ))}
          </>
        )}
        {points.map((p, i) =>
          showLabel(i) ? (
            <text
              key={`lbl-${p.label}-${i}`}
              x={chart.type === 'bar' ? barX(i) + barW / 2 : x(i)}
              y={H - 6}
              textAnchor="middle"
              fill="var(--faint)"
              style={AXIS_TEXT}
            >
              {p.label}
            </text>
          ) : null
        )}
      </svg>
      {chart.note && <p className="small muted" style={{ margin: 'var(--s3) 0 0', maxWidth: '62ch' }}>{chart.note}</p>}
    </figure>
  );
}

// One column of the coach's read: an eyebrow, a rule above it, and the
// items on ruled rows. Returns null when the coach didn't author this list —
// the grid simply closes up, so an absent array never leaves a titled void.
function AnalysisList({ title, items, tone }) {
  if (!items?.length) return null;
  return (
    <div style={{ minWidth: 0, borderTop: '1px solid var(--border)', paddingTop: 'var(--s3)' }}>
      <p className="eyebrow" style={{ margin: '0 0 var(--s2)' }}>{title}</p>
      <ul className={`small ${tone || 'muted'}`} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((s, i) => (
          <li
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '0.9rem minmax(0, 1fr)',
              gap: 'var(--s1)',
              alignItems: 'baseline',
              padding: '0.35rem 0',
            }}
          >
            <span className="faint" aria-hidden="true">·</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Progress() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [notOnboarded, setNotOnboarded] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const inFlight = useRef(false);
  // The focus/visibility listeners are registered once, so they hold the
  // FIRST `load` closure forever — where `report` is still null. Reading the
  // ref instead means a background refresh knows whether there is anything
  // on screen worth protecting.
  const reportRef = useRef(null);

  async function load() {
    // Focus and visibilitychange both fire on a single tab switch, and this
    // endpoint is AI-rate-limited — without a guard a couple of alt-tabs
    // stack requests and earn a 429 for no new data.
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const next = await getProgress();
      reportRef.current = next;
      setReport(next);
      setError('');
      setRefreshError('');
      setNotOnboarded(false);
    } catch (err) {
      setNotOnboarded(Boolean(err.noProfile));
      // A background refresh that fails must not delete what's on screen.
      // Losing a whole analysis to a transient 429 on tab-focus reads to the
      // user as their history being gone.
      if (reportRef.current) setRefreshError(err.message);
      else setError(err.message);
    } finally {
      inFlight.current = false;
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
    return (
      <div className="page page-mid page-enter">
        <h2 className="page-title">Progress</h2>
        <p className="muted" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--t-h3)', fontWeight: 400, lineHeight: 1.6, maxWidth: '48ch', margin: '0 0 var(--s5)' }}>
          {notOnboarded ? 'Complete onboarding first — progress tracking starts with your plan.' : error}
        </p>
        {notOnboarded
          ? <Link to="/onboarding"><Button>Complete onboarding</Button></Link>
          : <Button onClick={retry} disabled={retrying}>{retrying ? 'Retrying…' : 'Try again'}</Button>}
      </div>
    );
  }
  if (!report) {
    // First view of the day runs the AI over the full history — set that
    // expectation so the wait reads as analysis, not a hang.
    return <div className="page-loading">Your coach is reading your whole journey…</div>;
  }

  // A failed background refresh is a note above the page, never a
  // replacement for it — everything below is still the user's real data.
  // A margin note, not a card: a card here outranked the analysis it was
  // apologising for.
  const refreshBanner = refreshError ? (
    <div
      className="notice tone-amber"
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)', flexWrap: 'wrap', marginBottom: 'var(--s5)' }}
    >
      <span style={{ flex: 1, minWidth: '18ch' }}>
        Couldn't refresh just now — showing your last loaded analysis. {refreshError}
      </span>
      <Button onClick={retry} disabled={retrying}>{retrying ? 'Retrying…' : 'Refresh'}</Button>
    </div>
  ) : null;

  const { data, analysis } = report;
  const { goal, weighIns } = data;
  const tone = STATUS_TONE[analysis.status] || 'cyan';
  const stats = Array.isArray(analysis.stats) ? analysis.stats : [];
  const charts = buildCharts(data);

  // Coach unreachable AND this account has never had a real analysis: show
  // ONE honest state — real logged data, no template filler dressed up as
  // analysis. (When a past analysis exists, the server serves it instead,
  // marked stale, and we render it in full below.)
  if (analysis.source === 'fallback') {
    const latestWeight = weighIns.length ? weighIns[weighIns.length - 1].kg : null;
    return (
      <div className="page page-wide page-enter">
        {/* In this state the ONE thing that needs answering is that the coach
            is away — so it takes the headline slot instead of being a card
            wedged under a generic page title. */}
        <div className="page-header" style={{ marginBottom: 'var(--s3)' }}>
          <p className="eyebrow" style={{ margin: 0 }}>Progress</p>
          <Link to="/plan" className="small muted">Edit plan →</Link>
        </div>
        {refreshBanner}
        <h2 className="page-title" style={{ maxWidth: '18ch' }}>Your coach couldn't be reached</h2>
        <p className="muted" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--t-h3)', fontWeight: 400, lineHeight: 1.6, maxWidth: '56ch', margin: '0 0 var(--s5)' }}>
          Nothing here is made up while the AI is away — your logged data below is safe, and the full
          analysis, stats and charts are generated the moment the coach is back.
        </p>
        <Button onClick={retry} disabled={retrying}>{retrying ? 'Retrying…' : 'Try again now'}</Button>

        <figure style={{ margin: 'var(--s7) 0 0' }}>
          <figcaption className="page-header" style={{ marginBottom: 'var(--s3)' }}>
            <h3 style={{ margin: 0 }}>Weight trend</h3>
            {latestWeight != null && <span className="eyebrow">{latestWeight}kg now</span>}
          </figcaption>
          <WeightChart weighIns={weighIns} targetKg={goal.targetWeightKg} />
          <p className="tiny faint" style={{ margin: 'var(--s3) 0 0', maxWidth: '62ch' }}>
            Weigh in each morning on <Link to="/dashboard">Today's Mission</Link> — every entry lands in the coach's next analysis.
          </p>
        </figure>

        {/* The graphs come from logged rows, not from the coach, so they are
            the same here as on the analysed page — an outage costs the words,
            never the data. */}
        {buildCharts(data).map((chart, i) => (
          <CoachChart key={`${chart.title}-${i}`} chart={chart} />
        ))}
      </div>
    );
  }

  return (
    <div className="page page-wide page-enter">
      {/* ---- The masthead ----
              The coach's headline IS the page title: "am I on track?" has to
              be answerable before the eye reaches a number. "Progress" drops
              to the eyebrow — it names the screen, it isn't the news. The
              status chip is this page's single pigment moment. ---- */}
      <header style={{ marginBottom: 'var(--s6)' }}>
        <div className="page-header" style={{ marginBottom: 'var(--s3)' }}>
          <p className="eyebrow" style={{ margin: 0 }}>Progress</p>
          <Link to="/plan" className="small muted">Edit plan →</Link>
        </div>

        {refreshBanner}

        {/* ---- Stale: a REAL past analysis served while a refresh is blocked
                by a provider outage — say so plainly and offer the retry ---- */}
        {report.stale && (
          <div
            className="notice tone-amber"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)', flexWrap: 'wrap', marginBottom: 'var(--s5)' }}
          >
            <span style={{ flex: 1, minWidth: '18ch' }}>
              Showing your last analysis{report.staleDate ? ` (${report.staleDate})` : ''} — the coach couldn't be
              reached to fold in your latest changes yet.
            </span>
            <Button onClick={retry} disabled={retrying}>{retrying ? 'Retrying…' : 'Refresh now'}</Button>
          </div>
        )}

        <h2 className="page-title" style={{ maxWidth: '20ch', marginBottom: 'var(--s3)' }}>
          {analysis.headline || goal.type?.replace(/_/g, ' ')}
        </h2>
        {analysis.statusLabel && <span className={`chip tone-${tone}`}>{analysis.statusLabel}</span>}
        <p
          className="muted"
          style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--t-h3)', fontWeight: 400, lineHeight: 1.6, maxWidth: '58ch', margin: 'var(--s4) 0 0' }}
        >
          {analysis.summary}
        </p>
      </header>

      {/* ---- The coach's read, in three ruled columns. Bullets stacked in a
              tinted card made three different kinds of advice look like one
              undifferentiated list. ---- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 'var(--s5)', marginBottom: 'var(--s7)' }}>
        <AnalysisList title="Going well" items={analysis.wins} />
        <AnalysisList title="Watch out" items={analysis.risks} />
        <AnalysisList title="Do next" items={analysis.recommendations} />
      </div>

      {/* ---- The coach's numbers — every figure computed by the AI from the
              logs (implausible entries excluded by its own judgment), so a
              tile can never contradict the analysis above. Optional: when the
              coach authored none, the ledger simply isn't there. ---- */}
      {stats.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: 'var(--s6)' }}>
          {stats.map((s, i) => {
            const dot = toneDot(s.tone);
            return (
              <div key={`${s.label}-${i}`} className="stat-card">
                <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {dot && (
                    <span
                      aria-hidden="true"
                      style={{ width: 4, height: 4, borderRadius: '50%', background: dot, flex: 'none' }}
                    />
                  )}
                  {s.label}
                </div>
                <div className="stat-value">{s.value}</div>
                {s.detail && <div className="stat-sub">{s.detail}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Weight trend — drawn by the app from the user's own weigh-ins,
              NOT by the coach. It used to be chart #1 of the AI's output,
              which meant an account whose analysis fell back (or whose model
              simply skipped it) saw no graph at all while another account saw
              several. Every account with 2+ weigh-ins now gets this one. ---- */}
      <figure style={{ margin: '0 0 var(--s6)', borderTop: '1px solid var(--border)', paddingTop: 'var(--s4)' }}>
        <figcaption className="page-header" style={{ marginBottom: 'var(--s3)' }}>
          <h3 style={{ margin: 0 }}>Weight trend</h3>
          {goal.targetWeightKg != null && <span className="eyebrow">target {goal.targetWeightKg}kg</span>}
        </figcaption>
        <WeightChart weighIns={weighIns} targetKg={goal.targetWeightKg} />
      </figure>

      {/* ---- Calories, protein and volume — same source, same rule: the
              user's own rows. A series with under 2 points is left out
              rather than padded. ---- */}
      {charts.map((chart, i) => (
        <CoachChart key={`${chart.title}-${i}`} chart={chart} />
      ))}

      {/* ---- Weight, training & nutrition — the coach's read, in words.
              Three ruled columns rather than three cards: this is supporting
              prose, and it should sit under the numbers, not beside them in
              matching containers. ---- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--s5)', marginBottom: 'var(--s5)' }}>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--s3)', minWidth: 0 }}>
          <p className="eyebrow" style={{ margin: '0 0 var(--s2)' }}>Weight</p>
          <p className="small muted" style={{ margin: 0 }}>{analysis.weightTrend}</p>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--s3)', minWidth: 0 }}>
          <p className="eyebrow" style={{ margin: '0 0 var(--s2)' }}>Training</p>
          <p className="small muted" style={{ margin: 0 }}>{analysis.trainingAnalysis}</p>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--s3)', minWidth: 0 }}>
          <p className="eyebrow" style={{ margin: '0 0 var(--s2)' }}>Nutrition</p>
          <p className="small muted" style={{ margin: 0 }}>{analysis.nutritionAnalysis}</p>
        </div>
      </div>

      <p className="tiny faint" style={{ margin: 'var(--s5) 0 0', maxWidth: '62ch' }}>
        Everything above is your coach's own read of your logs. Weigh in each morning on{' '}
        <Link to="/dashboard">Today's Mission</Link> — the analysis regenerates as soon as new data lands.
      </p>
    </div>
  );
}
