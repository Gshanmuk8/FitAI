import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { submitOnboarding } from "../../services/aiService";
import { apiFetch } from "../../utils/apiClient";
import { useAuth } from "../../contexts/AuthContext";
import { readSessionDraft, saveSessionDraft } from "../../utils/productState";
import Button from "../../components/ui/Button";
import ButtonLink from "../../components/ui/ButtonLink";
import Icon, { Brand } from "../../components/ui/Icon";
import {
  PageHeader,
  LoadingState,
  EmptyState,
} from "../../components/ui/PageKit";
const GOALS = [
  ["build_muscle", "Build strength", "Get stronger and build muscle.", "train"],
  [
    "lose_fat",
    "Lose body fat",
    "Work toward a sustainable change.",
    "progress",
  ],
  ["maintain", "Feel my best", "Build a routine that lasts.", "today"],
  [
    "improve_endurance",
    "Go the distance",
    "Build stamina, at your own pace.",
    "steps",
  ],
];
const ACTIVITY = [
  ["sedentary", "Mostly sitting"],
  ["lightly_active", "Some walking, light activity"],
  ["moderately_active", "Active most days"],
  ["very_active", "Very active work or training"],
  ["athlete", "Intensive athletic training"],
];
const initial = {
  age: "",
  heightCm: "",
  weightKg: "",
  targetWeightKg: "",
  sex: "other",
  goal: "",
  activityLevel: "lightly_active",
  equipment: "minimal",
  timeframeWeeks: "12",
  trainingDaysPerWeek: "3",
  trainingStyle: "",
  injuries: "",
  dietaryRestrictions: "",
};
const weighted = (goal) => ["lose_fat", "build_muscle"].includes(goal);
export default function Onboarding() {
  const { user } = useAuth();
  const key = `fitai.onboarding.${user.id}`;
  const [form, setForm] = useState(() => ({
    ...initial,
    ...readSessionDraft(key, {}).form,
  }));
  const [step, setStep] = useState(() =>
    Math.max(0, Math.min(2, readSessionDraft(key, {}).step || 0)),
  );
  const [checking, setChecking] = useState(true);
  const [existing, setExisting] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    saveSessionDraft(key, { form, step });
  }, [key, form, step]);
  async function check() {
    setCheckError("");
    setChecking(true);
    try {
      const data = await apiFetch("/api/onboarding");
      setExisting(Boolean(data.plan));
    } catch (e) {
      if (!e.noProfile) setCheckError(e.message);
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    check();
  }, []);
  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (!form.goal) {
      setError("Choose the goal that feels right for you.");
      return;
    }
    if (step === 1 && form.targetWeightKg && weighted(form.goal)) {
      if (
        form.goal === "lose_fat" &&
        Number(form.targetWeightKg) >= Number(form.weightKg)
      ) {
        setError(
          "For a fat-loss goal, choose a target below your current weight—or change your goal.",
        );
        return;
      }
      if (
        form.goal === "build_muscle" &&
        Number(form.targetWeightKg) < Number(form.weightKg)
      ) {
        setError(
          "For this muscle-building weight goal, choose a target at or above your current weight, or leave it blank.",
        );
        return;
      }
    }
    if (step < 2) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await submitOnboarding({
        ...form,
        age: Number(form.age),
        heightCm: Number(form.heightCm),
        weightKg: Number(form.weightKg),
        timeframeWeeks: Number(form.timeframeWeeks),
        trainingDaysPerWeek: Number(form.trainingDaysPerWeek),
        targetWeightKg:
          weighted(form.goal) && form.targetWeightKg
            ? Number(form.targetWeightKg)
            : undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      saveSessionDraft(key, null);
      navigate("/plan", {
        replace: true,
        state: {
          justGenerated: true,
          notice: result.plan?.timeframe?.adjusted
            ? result.plan.timeframe.adjustedReason
            : null,
        },
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  if (checking)
    return (
      <LoadingState
        title="Making room for your plan"
        detail="Checking your account so we never replace an existing plan by mistake."
      />
    );
  if (checkError)
    return (
      <div className="page">
        <EmptyState
          title="Let’s reconnect your account."
          description={checkError}
        >
          <Button onClick={check}>Try again</Button>
          <ButtonLink to="/dashboard" variant="ghost">
            Back to Today
          </ButtonLink>
        </EmptyState>
      </div>
    );
  if (existing)
    return (
      <div className="page">
        <EmptyState
          icon="check"
          title="Your plan is already here."
          description="Keep your progress going. If your goals or schedule changed, update your profile to create a new plan."
        >
          <ButtonLink to="/plan">View my plan</ButtonLink>
          <ButtonLink to="/profile" variant="ghost">
            Update profile
          </ButtonLink>
        </EmptyState>
      </div>
    );
  const titles = [
    "What moves you?",
    "A little about you.",
    "Make it fit your life.",
  ];
  const descriptions = [
    "One direction to start. You can change it as you grow.",
    "These details help estimate your daily targets. They’re a starting point, not a diagnosis.",
    "A realistic plan is one you can keep showing up for.",
  ];
  return (
    <div className="onboarding page-enter">
      <div className="onboarding-top">
        <Link to="/" className="brand-link" aria-label="FitAI home">
          <Brand />
        </Link>
        <Link className="small muted" to="/dashboard">
          Finish later
        </Link>
      </div>
      <div className="onboarding-card">
        <div className="step-count">
          YOUR STARTING POINT · STEP {step + 1} OF 3
        </div>
        <div
          className="onboarding-progress"
          aria-label={`Step ${step + 1} of 3`}
        >
          {[0, 1, 2].map((s) => (
            <span key={s} className={s <= step ? "active" : ""} />
          ))}
        </div>
        <PageHeader title={titles[step]} description={descriptions[step]} />
        <form onSubmit={submit} className="card">
          <fieldset disabled={busy}>
            {step === 0 && (
              <>
                <div
                  className="goal-options"
                  role="group"
                  aria-label="Choose your goal"
                >
                  {GOALS.map(([value, label, hint, icon]) => (
                    <button
                      key={value}
                      type="button"
                      className="goal-option"
                      aria-pressed={form.goal === value}
                      onClick={() => update("goal", value)}
                    >
                      <Icon name={icon} />
                      <strong>{label}</strong>
                      <span>{hint}</span>
                    </button>
                  ))}
                </div>
                <label className="label" htmlFor="ob-timeframe">
                  Your planning horizon · weeks
                </label>
                <input
                  id="ob-timeframe"
                  className="field"
                  type="number"
                  min="1"
                  max="200"
                  step="1"
                  required
                  value={form.timeframeWeeks}
                  onChange={(e) => update("timeframeWeeks", e.target.value)}
                />
                <p className="field-hint">
                  12 weeks is a starting point. An overly aggressive
                  weight-change timeline will be extended automatically.
                </p>
              </>
            )}
            {step === 1 && (
              <div className="form-grid">
                <div>
                  <label className="label" htmlFor="ob-age">
                    Age
                  </label>
                  <input
                    className="field"
                    id="ob-age"
                    type="number"
                    min="13"
                    max="100"
                    step="1"
                    required
                    value={form.age}
                    onChange={(e) => update("age", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="ob-sex">
                    Sex for calorie estimate
                  </label>
                  <select
                    className="field"
                    id="ob-sex"
                    value={form.sex}
                    onChange={(e) => update("sex", e.target.value)}
                  >
                    <option value="other">Prefer not to say</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="ob-height">
                    Height · cm
                  </label>
                  <input
                    className="field"
                    id="ob-height"
                    type="number"
                    min="100"
                    max="250"
                    step="0.1"
                    required
                    value={form.heightCm}
                    onChange={(e) => update("heightCm", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="ob-weight">
                    Current weight · kg
                  </label>
                  <input
                    className="field"
                    id="ob-weight"
                    type="number"
                    min="30"
                    max="300"
                    step="0.1"
                    required
                    value={form.weightKg}
                    onChange={(e) => update("weightKg", e.target.value)}
                  />
                </div>
                {weighted(form.goal) && (
                  <div className="form-wide">
                    <label className="label" htmlFor="ob-target">
                      Target weight · kg{" "}
                      <span className="muted">(optional)</span>
                    </label>
                    <input
                      className="field"
                      id="ob-target"
                      type="number"
                      min="30"
                      max="300"
                      step="0.1"
                      value={form.targetWeightKg}
                      onChange={(e) => update("targetWeightKg", e.target.value)}
                    />
                    <p className="field-hint">
                      You don’t need a weight target to build a consistent
                      routine.
                    </p>
                  </div>
                )}
              </div>
            )}
            {step === 2 && (
              <>
                <div className="form-grid">
                  <div>
                    <label className="label" htmlFor="ob-days">
                      Training days each week
                    </label>
                    <select
                      className="field"
                      id="ob-days"
                      value={form.trainingDaysPerWeek}
                      onChange={(e) =>
                        update("trainingDaysPerWeek", e.target.value)
                      }
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <option value={n} key={n}>
                          {n} {n === 1 ? "day" : "days"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="ob-equipment">
                      Where you train
                    </label>
                    <select
                      className="field"
                      id="ob-equipment"
                      value={form.equipment}
                      onChange={(e) => update("equipment", e.target.value)}
                    >
                      <option value="minimal">Bodyweight / minimal</option>
                      <option value="home">Home equipment</option>
                      <option value="gym">Full gym</option>
                    </select>
                  </div>
                </div>
                <label className="label" htmlFor="ob-activity">
                  Activity outside your workouts
                </label>
                <select
                  className="field"
                  id="ob-activity"
                  value={form.activityLevel}
                  onChange={(e) => update("activityLevel", e.target.value)}
                >
                  {ACTIVITY.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <label className="label" htmlFor="ob-style">
                  What do you enjoy? <span className="muted">(optional)</span>
                </label>
                <textarea
                  className="field"
                  id="ob-style"
                  maxLength={500}
                  rows={2}
                  placeholder="e.g. Strength training and weekend runs"
                  value={form.trainingStyle}
                  onChange={(e) => update("trainingStyle", e.target.value)}
                />
                <label className="label" htmlFor="ob-injuries">
                  Injuries or movement limitations{" "}
                  <span className="muted">(optional)</span>
                </label>
                <input
                  className="field"
                  id="ob-injuries"
                  maxLength={500}
                  placeholder="Anything your coach should consider"
                  value={form.injuries}
                  onChange={(e) => update("injuries", e.target.value)}
                />
                <label className="label" htmlFor="ob-diet">
                  Food preferences or restrictions{" "}
                  <span className="muted">(optional)</span>
                </label>
                <input
                  className="field"
                  id="ob-diet"
                  maxLength={500}
                  placeholder="e.g. Vegetarian, nut allergy"
                  value={form.dietaryRestrictions}
                  onChange={(e) =>
                    update("dietaryRestrictions", e.target.value)
                  }
                />
                <p className="field-hint">
                  FitAI provides general fitness guidance. Medical conditions
                  and injuries need a qualified professional’s advice.
                </p>
              </>
            )}
            {error && (
              <p className="notice tone-red" role="alert">
                {error}
              </p>
            )}
            <div className="step-actions">
              {step > 0 ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setStep(step - 1);
                    setError("");
                  }}
                >
                  <Icon name="back" size={16} />
                  Back
                </Button>
              ) : (
                <span className="step-count">
                  Your draft saves in this tab.
                </span>
              )}
              <Button type="submit">
                {busy
                  ? "Building your plan…"
                  : step === 2
                    ? "Build my plan"
                    : "Continue"}
                {!busy && <Icon name="arrow" size={17} />}
              </Button>
            </div>
          </fieldset>
          {busy && (
            <div className="thinking" role="status">
              <i />
              <i />
              <i />
              <span>
                Your coach is considering your schedule, goals, and preferences.
                This can take a moment.
              </span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
