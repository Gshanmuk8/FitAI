import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../utils/apiClient";
import { getDailyBriefing } from "../../services/aiService";
import { useChecklist } from "../../hooks/useChecklist";
import { formatToday } from "../../utils/productState";
import DailyChecklist from "../../components/checklist/DailyChecklist";
import Button from "../../components/ui/Button";
import ButtonLink from "../../components/ui/ButtonLink";
import Icon from "../../components/ui/Icon";
import {
  PageHeader,
  LoadingState,
  EmptyState,
  Ring,
  SourceBadge,
} from "../../components/ui/PageKit";
function Briefing() {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  async function load() {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const data = await getDailyBriefing();
      setState({ data, loading: false, error: "" });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message }));
    }
  }
  useEffect(() => {
    load();
  }, []);
  const b = state.data;
  return (
    <section className="coach-card" aria-busy={state.loading}>
      <div className="coach-heading">
        <span className="coach-orb">
          <Icon name="coach" size={18} />
        </span>
        <h3>Your daily perspective</h3>
        {b && <SourceBadge source={b.source} stale={b.stale} />}
      </div>
      {b && (
        <button
          className="ghost-button"
          style={{ paddingLeft: 0 }}
          disabled={state.loading}
          onClick={load}
        >
          {state.loading ? "Updating insight…" : "Update from my latest logs"}{" "}
          <Icon name="refresh" size={13} />
        </button>
      )}
      {state.loading && !b ? (
        <div role="status">
          <p className="small muted">
            Your coach is connecting the dots in your latest logs…
          </p>
          <div className="skeleton" />
          <div className="skeleton short" />
        </div>
      ) : (
        <>
          <p className="coach-summary">
            {b?.source === "fallback"
              ? "Keep your rhythm. Your logged progress is still here."
              : b?.summary || "Your coach is taking a moment."}
          </p>
          {(state.error || b?.source === "fallback" || b?.stale) && (
            <div className="notice tone-amber">
              <p className="small" style={{ margin: "0 0 12px" }}>
                {state.error ||
                  (b?.stale
                    ? "Showing an earlier insight while your latest update is unavailable."
                    : "Personalized AI guidance is temporarily unavailable. Training and logging still work.")}
              </p>
              <Button variant="ghost" disabled={state.loading} onClick={load}>
                {state.loading ? "Checking…" : "Try coach again"}
              </Button>
            </div>
          )}
          {b?.source !== "fallback" && b?.focus?.length > 0 && (
            <ol className="focus-list">
              {b.focus.slice(0, 3).map((f, i) => (
                <li key={i}>
                  <span className="focus-index">0{i + 1}</span>
                  <span>{f}</span>
                </li>
              ))}
            </ol>
          )}
          <Link to="/tutor" className="quiet-link">
            Talk it through with your coach <Icon name="arrow" size={16} />
          </Link>
        </>
      )}
    </section>
  );
}
function Today({ profile }) {
  const model = useChecklist();
  const c = model.checklist;
  const workout = c?.plan_snapshot?.workout;
  const items = c?.items || [];
  const custom = c?.custom_items || [];
  const done =
    items.filter((item) => c?.[item.field]).length +
    custom.filter((item) => item.done).length;
  const total = items.length + custom.length;
  const targets = c?.plan_snapshot?.targets || profile.plan.diet || {};
  const rest = workout?.type === "rest";
  const complete = Boolean(c?.workout_completed);
  const label = formatToday(profile.profile?.timezone || undefined);
  const hasSession = Boolean(workout?.exercises?.length);
  return (
    <div className="page page-wide page-enter">
      <PageHeader
        eyebrow="TODAY IS A FRESH START"
        title="Make today count."
        description="A little training. Thoughtful fuel. Room to recover."
      >
        <span className="date-pill">
          <Icon name="today" size={15} />
          {label}
        </span>
      </PageHeader>
      <div className="today-grid">
        <div className="today-main">
          <section className="next-session">
            <div className="session-topline">
              <span className="eyebrow">
                {rest ? "RECOVERY IS PROGRESS" : "YOUR NEXT CHAPTER"}
              </span>
              <span className="chip">
                {complete
                  ? "Session complete"
                  : rest
                    ? "Recovery day"
                    : "Your plan"}
              </span>
            </div>
            <h2>
              {model.loading
                ? "Your day, on its way."
                : model.error
                  ? "Let’s reconnect your day."
                  : complete
                    ? "Good work. Take it in."
                    : rest
                      ? "Take a breath."
                      : workout?.dayName || "Ready when you are."}
            </h2>
            <p>
              {rest
                ? "An easier day makes space for your next strong one. Move gently, refuel, and rest."
                : hasSession
                  ? `${workout.exercises.length} exercises · ${workout.exercises.reduce((n, e) => n + Number(e.sets || 0), 0)} planned sets · Your pace`
                  : "Your training and daily habits are built around the plan you chose."}
            </p>
            <ButtonLink to={rest || complete ? "/progress" : "/workout"}>
              {rest
                ? "See your journey"
                : complete
                  ? "See your progress"
                  : "Open today’s session"}
              <Icon name="arrow" size={17} />
            </ButtonLink>
            <div className="session-art" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} style={{ "--i": i }} />
              ))}
            </div>
          </section>
          <DailyChecklist model={model} />
        </div>
        <div className="today-side">
          <section className="card rhythm-card">
            <Ring
              value={done}
              total={total || 6}
              size={120}
              label={
                c
                  ? `${done} of ${total} daily habits complete`
                  : "Daily habits not loaded"
              }
            >
              {!c && (
                <>
                  <strong>—</strong>
                  <span>not loaded</span>
                </>
              )}
            </Ring>
            <div>
              <p className="eyebrow" style={{ margin: "0 0 9px" }}>
                DAILY RHYTHM
              </p>
              <h3>
                {done === total && total > 0
                  ? "You showed up."
                  : done > 0
                    ? "Keep building."
                    : "Start with one thing."}
              </h3>
              <p>
                {done === total && total > 0
                  ? "Your daily habits are complete. Make room for rest, too."
                  : "This is your checklist, not a health score. Every logged habit is a small win."}
              </p>
            </div>
          </section>
          <section className="card fuel-card">
            <div className="section-heading">
              <h3>Fuel for your day</h3>
              <Icon name="fuel" size={18} />
            </div>
            <div className="fuel-preview">
              {[
                ["Energy", c?.calories_kcal, targets.calorieTarget, "kcal"],
                ["Protein", c?.protein_grams, targets.proteinGrams, "g"],
              ].map(([name, value, target, unit]) => (
                <div key={name}>
                  <div className="metric-label">{name}</div>
                  <div className="metric-value">
                    {value == null ? "—" : Number(value).toLocaleString()}
                    <span className="metric-unit"> {unit}</span>
                  </div>
                  <div className="metric-unit">
                    {target
                      ? `of ${Number(target).toLocaleString()} ${unit}`
                      : "Set in your plan"}
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${target && value != null ? Math.min(100, (value / target) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Link to="/nutrition" className="quiet-link">
              <span>Log a meal</span>
              <Icon name="plus" size={17} />
            </Link>
          </section>
          <Briefing />
        </div>
      </div>
    </div>
  );
}
export default function Dashboard() {
  const [state, setState] = useState({
    profile: null,
    loading: true,
    error: "",
    missing: false,
  });
  async function load() {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const profile = await apiFetch("/api/onboarding");
      setState({ profile, loading: false, error: "", missing: !profile.plan });
    } catch (e) {
      setState({
        profile: null,
        loading: false,
        error: e.message,
        missing: Boolean(e.noProfile),
      });
    }
  }
  useEffect(() => {
    load();
  }, []);
  if (state.loading) return <LoadingState title="A fresh start for today" />;
  if (state.missing)
    return (
      <div className="page">
        <EmptyState
          icon="plan"
          title="Your rhythm starts here."
          description="Tell us a little about your goals and your week. We’ll bring your training and daily habits together."
        >
          <ButtonLink to="/onboarding">
            Build my plan <Icon name="arrow" size={16} />
          </ButtonLink>
        </EmptyState>
      </div>
    );
  if (state.error)
    return (
      <div className="page">
        <EmptyState
          icon="refresh"
          title="Let’s reconnect."
          description={state.error}
        >
          <Button onClick={load}>Try again</Button>
        </EmptyState>
      </div>
    );
  return <Today profile={state.profile} />;
}
