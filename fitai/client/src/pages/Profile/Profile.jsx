import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/apiClient";
import { useAuth } from "../../contexts/AuthContext";
import { readSessionDraft, saveSessionDraft } from "../../utils/productState";
import Button from "../../components/ui/Button";
import ButtonLink from "../../components/ui/ButtonLink";
import Icon from "../../components/ui/Icon";
import {
  PageHeader,
  LoadingState,
  EmptyState,
  ConfirmDialog,
} from "../../components/ui/PageKit";

const fields = {
  age: "age",
  heightCm: "height_cm",
  weightKg: "weight_kg",
  targetWeightKg: "target_weight_kg",
  timeframeWeeks: "timeframe_weeks",
  sex: "sex",
  goal: "goal",
  activityLevel: "activity_level",
  gymAvailability: "gym_availability",
  injuries: "injuries",
  dietaryRestrictions: "dietary_restrictions",
  trainingDaysPerWeek: "training_days_per_week",
  trainingStyle: "training_style",
};
const defaults = {
  sex: "other",
  goal: "maintain",
  activityLevel: "lightly_active",
  gymAvailability: "minimal",
  trainingDaysPerWeek: 3,
  timeframeWeeks: 12,
};
function formFrom(profile) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, col]) => [
      key,
      profile[col] ?? defaults[key] ?? "",
    ]),
  );
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const key = `fitai.profileDraft.${user.id}`;
  const [form, setForm] = useState(null);
  const [base, setBase] = useState("");
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [regenerate, setRegenerate] = useState(false);
  const [discard, setDiscard] = useState(false);
  const lock = useRef(false);
  const navigate = useNavigate();
  const dirty = Boolean(form) && JSON.stringify(form) !== base;
  async function load() {
    setLoading(true);
    setError("");
    setMissing(false);
    try {
      const { profile } = await apiFetch("/api/profile");
      const saved = formFrom(profile),
        snapshot = JSON.stringify(saved),
        draft = readSessionDraft(key, null);
      setBase(snapshot);
      setForm(draft?.base === snapshot ? draft.form : saved);
      if (draft?.base === snapshot)
        setNotice("Your unsaved profile draft has been restored.");
    } catch (e) {
      setError(e.message);
      setMissing(Boolean(e.noProfile));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (form) saveSessionDraft(key, dirty ? { base, form } : null);
  }, [key, base, form, dirty]);
  useEffect(() => {
    const before = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setNotice("");
    setError("");
  }
  function payload() {
    return {
      ...form,
      age: Number(form.age),
      heightCm: Number(form.heightCm),
      weightKg: Number(form.weightKg),
      targetWeightKg:
        form.targetWeightKg === "" ? null : Number(form.targetWeightKg),
      timeframeWeeks: Number(form.timeframeWeeks),
      trainingDaysPerWeek: Number(form.trainingDaysPerWeek),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
  async function save(rebuild = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(rebuild ? "rebuilding" : "saving");
    setError("");
    setNotice("");
    let saved = false;
    try {
      await apiFetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify(payload()),
      });
      saved = true;
      setBase(JSON.stringify(form));
      saveSessionDraft(key, null);
      if (rebuild) {
        await apiFetch("/api/plan/regenerate", { method: "POST" });
        navigate("/plan", {
          state: {
            notice:
              "New plan created. Your timeline starts at week 1; your past activity is still saved.",
          },
        });
      } else
        setNotice(
          "Profile saved. Your current plan and timeline are unchanged. Rebuild your plan to recalculate targets or change training.",
        );
    } catch (e) {
      setError(
        `${saved && rebuild ? "Your profile was saved, but the new plan could not be created. Your existing plan remains available. " : ""}${e.message}`,
      );
    } finally {
      setBusy("");
      lock.current = false;
      setRegenerate(false);
    }
  }
  async function leave() {
    if (lock.current) return;
    lock.current = true;
    setBusy("signout");
    setError("");
    try {
      await signOut();
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy("");
    }
  }
  function input(field, label, props = {}) {
    return (
      <div>
        <label className="label" htmlFor={`pf-${field}`}>
          {label}
        </label>
        <input
          className="field"
          id={`pf-${field}`}
          value={form[field]}
          onChange={(e) => update(field, e.target.value)}
          {...props}
        />
      </div>
    );
  }
  function select(field, label, options) {
    return (
      <div>
        <label className="label" htmlFor={`pf-${field}`}>
          {label}
        </label>
        <select
          className="field"
          id={`pf-${field}`}
          value={form[field]}
          onChange={(e) => update(field, e.target.value)}
        >
          {options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (loading) return <LoadingState title="Your starting point, up to date" />;
  if (!form)
    return (
      <div className="page">
        <EmptyState
          icon="user"
          title={
            missing ? "Let’s get to know you." : "Let’s reconnect your profile."
          }
          description={error}
        >
          {missing ? (
            <ButtonLink to="/onboarding">Build my plan</ButtonLink>
          ) : (
            <Button onClick={load}>Try again</Button>
          )}
        </EmptyState>
      </div>
    );
  return (
    <div className="page page-mid page-enter">
      <PageHeader
        eyebrow="BUILT AROUND YOUR LIFE"
        title="Your profile."
        description="As life changes, your plan can change with you. You’re always in control."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <fieldset disabled={Boolean(busy)}>
          <section className="card profile-card">
            <h2 className="section-title">Your starting point</h2>
            <p className="small muted">
              Used to estimate targets. Log daily weigh-ins on Today to see your
              trend.
            </p>
            <div className="form-grid">
              {input("age", "Age", {
                type: "number",
                min: 13,
                max: 100,
                required: true,
              })}
              {select("sex", "Sex for calorie estimate", [
                ["other", "Prefer not to say"],
                ["female", "Female"],
                ["male", "Male"],
              ])}
              {input("heightCm", "Height · cm", {
                type: "number",
                min: 100,
                max: 250,
                step: 0.1,
                required: true,
              })}
              {input("weightKg", "Current weight · kg", {
                type: "number",
                min: 30,
                max: 300,
                step: 0.1,
                required: true,
              })}
            </div>
          </section>
          <section className="card profile-card">
            <h2 className="section-title">Your direction</h2>
            <div className="form-grid">
              {select("goal", "Goal", [
                ["maintain", "Feel my best"],
                ["build_muscle", "Build strength"],
                ["lose_fat", "Lose body fat"],
                ["improve_endurance", "Build endurance"],
              ])}
              {input("timeframeWeeks", "Planning horizon · weeks", {
                type: "number",
                min: 1,
                max: 200,
                required: true,
              })}
              {input("targetWeightKg", "Target weight · kg (optional)", {
                type: "number",
                min: 30,
                max: 300,
                step: 0.1,
              })}
            </div>
            <p className="field-hint">
              Clear the optional weight target to focus on consistency instead
              of a number.
            </p>
          </section>
          <section className="card profile-card">
            <h2 className="section-title">Training that fits</h2>
            <div className="form-grid">
              {select("activityLevel", "Activity level", [
                ["sedentary", "Mostly sitting"],
                ["lightly_active", "Lightly active"],
                ["moderately_active", "Moderately active"],
                ["very_active", "Very active"],
                ["athlete", "Intensive athletic training"],
              ])}
              {select("gymAvailability", "Equipment", [
                ["minimal", "Bodyweight / minimal"],
                ["home", "Home equipment"],
                ["gym", "Full gym"],
              ])}
              {select(
                "trainingDaysPerWeek",
                "Training days each week",
                [1, 2, 3, 4, 5, 6, 7].map((n) => [
                  n,
                  `${n} ${n === 1 ? "day" : "days"}`,
                ]),
              )}
            </div>
            <label className="label" htmlFor="pf-trainingStyle">
              What you enjoy
            </label>
            <textarea
              className="field"
              id="pf-trainingStyle"
              maxLength={500}
              rows={3}
              value={form.trainingStyle}
              onChange={(e) => update("trainingStyle", e.target.value)}
              placeholder="Strength training, running, yoga…"
            />
            {input("injuries", "Injuries or movement limitations", {
              maxLength: 500,
            })}
            {input("dietaryRestrictions", "Food preferences or restrictions", {
              maxLength: 500,
            })}
            <p className="field-hint">
              AI guidance is not medical advice. Review any plan with a
              professional when an injury or condition affects training.
            </p>
          </section>
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className="notice tone-red" role="alert">
              {error}
            </p>
          )}
          <div className="save-bar">
            <div>
              <p>
                {dirty
                  ? "Unsaved changes · draft kept in this tab"
                  : "Your profile is up to date"}
              </p>
              {dirty && (
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setDiscard(true)}
                >
                  Discard edits
                </button>
              )}
            </div>
            <Button type="submit" disabled={!dirty || Boolean(busy)}>
              {busy === "saving" ? "Saving…" : "Save profile"}
              <Icon name="check" size={16} />
            </Button>
          </div>
          <section className="card profile-card" style={{ marginTop: 28 }}>
            <h2 className="section-title">Ready for a new chapter?</h2>
            <p className="small muted">
              Rebuilding saves your profile, creates a fresh plan, and restarts
              your timeline at week 1. Your activity history and learned
              preferences stay.
            </p>
            <Button
              variant="ghost"
              onClick={(e) => {
                if (e.currentTarget.form.reportValidity()) setRegenerate(true);
              }}
            >
              Rebuild my plan
            </Button>
          </section>
        </fieldset>
      </form>
      <section className="card">
        <div className="page-header" style={{ margin: 0 }}>
          <div style={{ minWidth: 0 }}>
            <p className="eyebrow">YOUR ACCOUNT</p>
            <p style={{ overflowWrap: "anywhere" }}>{user.email}</p>
          </div>
          <Button variant="ghost" disabled={Boolean(busy)} onClick={leave}>
            {busy === "signout" ? "Signing out…" : "Sign out"}
            <Icon name="logout" size={16} />
          </Button>
        </div>
        <p className="field-hint">
          Signing out clears this tab’s chat and unsaved drafts.
        </p>
      </section>
      <ConfirmDialog
        open={regenerate}
        title="Start a new plan?"
        confirmLabel="Save profile & rebuild"
        busy={Boolean(busy)}
        onCancel={() => setRegenerate(false)}
        onConfirm={() => save(true)}
      >
        <p>
          Your profile edits will be saved first. A successful rebuild replaces
          the plan and restarts your goal timeline at week 1. Past logs remain
          intact.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={discard}
        title="Discard profile edits?"
        confirmLabel="Discard edits"
        onCancel={() => setDiscard(false)}
        onConfirm={() => {
          setForm(JSON.parse(base));
          setDiscard(false);
          setNotice("");
        }}
      >
        <p>Your saved profile and plan won’t change.</p>
      </ConfirmDialog>
    </div>
  );
}
