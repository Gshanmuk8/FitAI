import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getProgress } from "../../services/progressService";
import { useElementWidth } from "../../hooks/useElementWidth";
import Button from "../../components/ui/Button";
import {
  PageHeader,
  LoadingState,
  EmptyState,
  SourceBadge,
} from "../../components/ui/PageKit";

// status → CSS tone is the only mapping this file owns, and it's pure
// presentation (which accent color a status gets). The words next to it —
// headline, statusLabel, every number, every chart — are the coach's.
const STATUS_TONE = {
  ahead: "emerald",
  on_track: "emerald",
  behind: "amber",
  no_data: "cyan",
};

// Tone → a token, for the 4px dot beside a stat's label. The coach's tone is
// information and must survive, but a wall of pigmented 38px numerals is the
// screen shouting six things at once. The dot keeps the meaning; the figure
// stays ink, so the stat row reads as one tabular ledger. Whitelisted so an
// unexpected tone name can never emit an undefined custom property.
const fmtAxis = (v) =>
  Math.abs(v) >= 1000
    ? Math.round(v).toLocaleString()
    : Number.isInteger(v)
      ? String(v)
      : v.toFixed(1);

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
  fontFamily: "var(--font-mono)",
  fontSize: `${AXIS_FONT_PX}px`,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "0.04em",
};

// Narrow screens get a taller plot so it stays readable instead of a strip.
function chartMetrics(width) {
  const W = width > 0 ? width : 640; // 640 covers the first paint, pre-measure
  const aspect = W < 480 ? 0.72 : W < 720 ? 0.48 : 0.34;
  const H = Math.round(Math.min(320, Math.max(190, W * aspect)));
  const PAD = { top: 16, right: 16, bottom: 30, left: 46 };
  return {
    W,
    H,
    PAD,
    plotW: W - PAD.left - PAD.right,
    plotH: H - PAD.top - PAD.bottom,
  };
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
    {
      title: "Daily calories",
      unit: "kcal",
      target: targets?.calorieTarget,
      points: nutrition
        .filter((n) => n.calories > 0)
        .map((n) => ({ label: day(n.date), value: n.calories })),
    },
    {
      title: "Daily protein",
      unit: "g",
      target: targets?.proteinGrams,
      points: nutrition
        .filter((n) => n.protein > 0)
        .map((n) => ({ label: day(n.date), value: n.protein })),
    },
    {
      title: "Training volume",
      unit: "kg",
      target: null,
      points: training
        .filter((t) => t.volumeKg > 0)
        .map((t) => ({ label: day(t.date), value: t.volumeKg })),
    },
  ];
  return series
    .filter((s) => s.points.length >= 2)
    .map((s) => ({
      title: s.title,
      type: "bar",
      unit: s.unit,
      points: s.points,
      targetValue: s.target ?? undefined,
    }));
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
      <div
        ref={ref}
        style={{ padding: "var(--s6) 0", borderTop: "1px solid var(--border)" }}
      >
        <p className="small muted" style={{ margin: 0, maxWidth: "44ch" }}>
          {weighIns?.length === 1
            ? "One weigh-in so far — log a few more on the dashboard and the trend appears here."
            : "No weigh-ins yet — log today's weight on the dashboard's Today's Mission."}
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
  const path = weighIns
    .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`)
    .join(" ");

  const first = weighIns[0],
    last = weighIns[weighIns.length - 1];
  const gridKgs = [0.25, 0.5, 0.75].map((t) => yMin + (yMax - yMin) * t);

  return (
    <div ref={ref}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label="Weight trend chart"
        style={{ display: "block", maxWidth: "100%" }}
      >
        {gridKgs.map((kg) => (
          <g key={kg}>
            {/* hairlines, at the same weight as every other rule on the page */}
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(kg)}
              y2={y(kg)}
              stroke="var(--border)"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={PAD.left - 8}
              y={y(kg) + 4}
              textAnchor="end"
              fill="var(--faint)"
              style={AXIS_TEXT}
            >
              {kg.toFixed(1)}
            </text>
          </g>
        ))}
        {targetKg != null && (
          <g>
            {/* The target is a REFERENCE, not a warning — it gets a dashed rule
                in ink, leaving the series as the only pigment in the frame. */}
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(targetKg)}
              y2={y(targetKg)}
              stroke="var(--border2)"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={W - PAD.right}
              y={y(targetKg) - 6}
              textAnchor="end"
              fill="var(--muted)"
              style={AXIS_TEXT}
            >
              target {targetKg}kg
            </text>
          </g>
        )}
        <path
          d={path}
          fill="none"
          stroke="var(--blue)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {weighIns.map((p, i) => (
          <circle
            key={p.date + i}
            cx={x(i)}
            cy={y(p.kg)}
            r="2.6"
            fill="var(--blue)"
          />
        ))}
        <text x={PAD.left} y={H - 9} fill="var(--faint)" style={AXIS_TEXT}>
          {first.date}
        </text>
        <text
          x={W - PAD.right}
          y={H - 9}
          textAnchor="end"
          fill="var(--faint)"
          style={AXIS_TEXT}
        >
          {last.date}
        </text>
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
  const lo = Math.min(
    ...values,
    chart.targetValue ?? Infinity,
    chart.type === "bar" ? 0 : Infinity,
  );
  const hi = Math.max(...values, chart.targetValue ?? -Infinity);
  const span = Math.max(hi - lo, 1e-9);
  const yMin = chart.type === "bar" ? Math.min(lo, 0) : lo - span * 0.1;
  const yMax = hi + span * 0.1;

  const x = (i) =>
    PAD.left +
    (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  // Label density follows the actual pixel width, not a fixed count — a phone
  // shows fewer so they never overlap, a wide screen shows more.
  const step = labelStep(points.length, plotW);
  const showLabel = (i) => i % step === 0 || i === points.length - 1;

  const gridVals = [0.25, 0.5, 0.75].map((t) => yMin + (yMax - yMin) * t);
  const barW = (plotW / points.length) * 0.62;
  const barX = (i) => PAD.left + (i + 0.5) * (plotW / points.length) - barW / 2;
  const linePath = points
    .map(
      (p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`,
    )
    .join(" ");

  return (
    // A plate, not a card. Six charts in six boxes is six containers of equal
    // rank stacked down a page; the same six under hairlines read as one
    // continuous report — which is what they are.
    <figure
      ref={ref}
      style={{
        margin: "0 0 var(--s6)",
        borderTop: "1px solid var(--border)",
        paddingTop: "var(--s4)",
      }}
    >
      <figcaption className="page-header" style={{ marginBottom: "var(--s3)" }}>
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
        style={{ display: "block", maxWidth: "100%" }}
      >
        {gridVals.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--border)"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={PAD.left - 8}
              y={y(v) + 4}
              textAnchor="end"
              fill="var(--faint)"
              style={AXIS_TEXT}
            >
              {fmtAxis(v)}
            </text>
          </g>
        ))}
        {chart.targetValue != null && (
          <g>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(chart.targetValue)}
              y2={y(chart.targetValue)}
              stroke="var(--border2)"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={W - PAD.right}
              y={y(chart.targetValue) - 6}
              textAnchor="end"
              fill="var(--muted)"
              style={AXIS_TEXT}
            >
              target {fmtAxis(chart.targetValue)}
              {chart.unit ? ` ${chart.unit}` : ""}
            </text>
          </g>
        )}
        {chart.type === "bar" ? (
          points.map((p, i) => (
            <rect
              key={`${p.label}-${i}`}
              x={barX(i)}
              y={Math.min(y(p.value), y(0))}
              width={barW}
              height={Math.max(1.5, Math.abs(y(p.value) - y(0)))}
              rx="2"
              fill="var(--blue)"
              opacity="0.9"
            />
          ))
        ) : (
          <>
            <path
              d={linePath}
              fill="none"
              stroke="var(--blue)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((p, i) => (
              <circle
                key={`${p.label}-${i}`}
                cx={x(i)}
                cy={y(p.value)}
                r="2.2"
                fill="var(--blue)"
              />
            ))}
          </>
        )}
        {points.map((p, i) =>
          showLabel(i) ? (
            <text
              key={`lbl-${p.label}-${i}`}
              x={chart.type === "bar" ? barX(i) + barW / 2 : x(i)}
              y={H - 6}
              textAnchor="middle"
              fill="var(--faint)"
              style={AXIS_TEXT}
            >
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
      {chart.note && (
        <p
          className="small muted"
          style={{ margin: "var(--s3) 0 0", maxWidth: "62ch" }}
        >
          {chart.note}
        </p>
      )}
    </figure>
  );
}

// One column of the coach's read: an eyebrow, a rule above it, and the
// items on ruled rows. Returns null when the coach didn't author this list —
// the grid simply closes up, so an absent array never leaves a titled void.
function AnalysisList({ title, items, tone }) {
  if (!items?.length) return null;
  return (
    <div
      style={{
        minWidth: 0,
        borderTop: "1px solid var(--border)",
        paddingTop: "var(--s3)",
      }}
    >
      <p className="eyebrow" style={{ margin: "0 0 var(--s2)" }}>
        {title}
      </p>
      <ul
        className={`small ${tone || "muted"}`}
        style={{ listStyle: "none", margin: 0, padding: 0 }}
      >
        {items.map((s, i) => (
          <li
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "0.9rem minmax(0, 1fr)",
              gap: "var(--s1)",
              alignItems: "baseline",
              padding: "0.35rem 0",
            }}
          >
            <span className="faint" aria-hidden="true">
              ·
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Progress() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function load() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      setReport(await getProgress());
      setMissing(false);
    } catch (e) {
      setError(e.message);
      setMissing(Boolean(e.noProfile || e.noPlan));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    const visible = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  if (!report && !error)
    return (
      <LoadingState
        title="Putting your effort in perspective"
        detail="Reading your logged history and preparing your coach’s analysis."
      />
    );
  if (!report)
    return (
      <div className="page">
        <EmptyState
          icon="progress"
          title={
            missing
              ? "Your journey starts with a plan."
              : "Let’s reconnect your progress."
          }
          description={error}
        >
          {missing ? (
            <Link className="btn btn-primary" to="/onboarding">
              Build my plan
            </Link>
          ) : (
            <Button disabled={busy} onClick={load}>
              Try again
            </Button>
          )}
        </EmptyState>
      </div>
    );
  const { data, analysis } = report;
  const { goal, weighIns = [], training = [], nutrition = [] } = data;
  const charts = buildCharts(data);
  const fallback = analysis.source === "fallback";
  const lastWeight = weighIns.at(-1);
  return (
    <div className="page page-wide page-enter">
      <PageHeader
        eyebrow="THE BIGGER PICTURE"
        title="Your effort, in perspective."
        description="Patterns from what you log. A direction for what comes next."
      >
        <Button variant="ghost" disabled={busy} onClick={load}>
          {busy ? "Refreshing…" : "Refresh insights"}
        </Button>
      </PageHeader>
      {error && (
        <p className="notice tone-amber" role="alert">
          Couldn’t refresh. Your last loaded report is still here. {error}
        </p>
      )}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {[
          [
            "Latest weigh-in",
            lastWeight ? lastWeight.kg + " kg" : "—",
            lastWeight?.date || "No weigh-ins logged",
          ],
          [
            "Training days logged",
            training.length,
            "In the loaded training history",
          ],
          [
            "Nutrition days logged",
            nutrition.length,
            "In the loaded meal history",
          ],
        ].map(([label, value, detail]) => (
          <div className="stat-card" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-sub">{detail}</div>
          </div>
        ))}
      </div>
      <section className="card" style={{ marginBottom: 24 }}>
        <div className="section-heading">
          <span className="eyebrow">YOUR COACH’S PERSPECTIVE</span>
          <SourceBadge
            source={analysis.source}
            stale={report.stale || analysis.stale}
          />
        </div>
        <h2 style={{ fontSize: "clamp(1.4rem,3vw,2rem)", maxWidth: "32ch" }}>
          {fallback
            ? "Your effort is here. The insight can wait."
            : analysis.headline}
        </h2>
        <p className="muted" style={{ maxWidth: "76ch" }}>
          {fallback
            ? "Personalized analysis is unavailable right now. Your actual logs and charts below are still available. Refresh to try your coach again."
            : analysis.summary}
        </p>
        {!fallback && analysis.statusLabel && (
          <span
            className={`chip tone-${STATUS_TONE[analysis.status] || "cyan"}`}
          >
            {analysis.statusLabel}
          </span>
        )}
        {report.stale && (
          <p className="notice tone-amber">
            This is an earlier analysis
            {report.staleDate ? ` from ${report.staleDate}` : ""}. It may not
            reflect the most recent logs shown below.
          </p>
        )}
      </section>
      {!fallback && (
        <div className="insight-grid" style={{ marginBottom: 28 }}>
          <AnalysisList title="Going well" items={analysis.wins} />
          <AnalysisList title="Worth noticing" items={analysis.risks} />
          <AnalysisList
            title="Your next small step"
            items={analysis.recommendations}
          />
        </div>
      )}
      <section className="chart-card">
        <div className="section-heading">
          <h2>Weight over time</h2>
          <span className="chip">Your logged data</span>
        </div>
        <WeightChart weighIns={weighIns} targetKg={goal?.targetWeightKg} />
        {weighIns.length > 0 && (
          <details className="chart-data">
            <summary>View weigh-in data</summary>
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Weight · kg</th>
                </tr>
              </thead>
              <tbody>
                {weighIns.map((w, i) => (
                  <tr key={i}>
                    <td>{w.date}</td>
                    <td>{w.kg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </section>
      {charts.map((chart) => (
        <section className="chart-card" key={chart.title}>
          <CoachChart chart={chart} />
          <details className="chart-data">
            <summary>View {chart.title.toLowerCase()} data</summary>
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">{chart.unit}</th>
                </tr>
              </thead>
              <tbody>
                {chart.points.map((p, i) => (
                  <tr key={i}>
                    <td>{p.label}</td>
                    <td>{p.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
      ))}
      {!charts.length && (
        <EmptyState
          icon="progress"
          title="Every log adds a little clarity."
          description="Charts appear once you have at least two logged days for a measure. An unlogged day is unknown, not proof of no effort."
        >
          <Link className="btn btn-ghost" to="/dashboard">
            Log today’s essentials
          </Link>
        </EmptyState>
      )}
      {!fallback && (
        <div className="insight-grid" style={{ marginTop: 28 }}>
          {[
            ["Weight", analysis.weightTrend],
            ["Training", analysis.trainingAnalysis],
            ["Nutrition", analysis.nutritionAnalysis],
          ]
            .filter(([, text]) => text)
            .map(([label, text]) => (
              <div key={label}>
                <h3>{label}</h3>
                <p className="small muted">{text}</p>
              </div>
            ))}
        </div>
      )}
      <p className="field-hint" style={{ marginTop: 24 }}>
        Charts and counts come from your saved logs; your coach’s interpretation
        is AI-generated and may be wrong. Missing logs are unknown, not
        failures. <Link to="/plan">Review your plan</Link>.
      </p>
    </div>
  );
}
