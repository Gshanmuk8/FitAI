import React from "react";
import ButtonLink from "../../components/ui/ButtonLink";

const GROUPS = [
  {
    heading: "Plan",
    items: [
      {
        title: "A plan for your next chapter",
        body: "Start with your goal, schedule, equipment and timeframe. Estimated targets and conservative pace limits provide a starting point, not a medical assessment.",
      },
      {
        title: "Fully editable",
        body: "Change days, exercises, sets, reps, calories, protein, water, steps — within safety bounds. Your edits never reset your goal timeline.",
      },
      {
        title: "Preference learning",
        body: "Remove an exercise twice and future plans stop suggesting it. Add one and it becomes a favorite.",
      },
      {
        title: "Life-change regeneration",
        body: "New injury, new schedule, new goal? Update your profile and regenerate — learned preferences carry over.",
      },
    ],
  },
  {
    heading: "Every day",
    items: [
      {
        title: "A clear Today view",
        body: "Your current plan becomes today's workout or rest day, alongside food, water, sleep and step targets. Log a little at a time and see what is recorded.",
      },
      {
        title: "Daily adjustments",
        body: "Your saved logs can inform session timing, intensity and progression suggestions. Each adjustment shows a reason; you decide what fits your day.",
      },
      {
        title: "Guided workout sessions",
        body: "Each exercise pre-filled with a suggested weight from your own history. Progressive overload is computed, not guessed.",
      },
      {
        title: "Photo food logging",
        body: "Snap your plate, confirm the AI's estimates, done. Hitting your protein target checks the mission item automatically.",
      },
    ],
  },
  {
    heading: "Intelligence",
    items: [
      {
        title: "A coach with context",
        body: "Training, nutrition and recovery conversations use your profile, recent activity and selected coaching notes. You can ask a follow-up instead of starting over.",
      },
      {
        title: "Memory you can manage",
        body: "Read stored coaching notes, filter by topic, and forget individual notes. Your profile and activity logs remain separate.",
      },
      {
        title: "A clear fallback",
        body: "When personalized AI is unavailable, the app labels general guidance clearly. You can still use manual logging and your saved plan while the coach reconnects.",
      },
      {
        title: "Transparent estimates",
        body: "Daily targets come from formulas using your profile, not measurements of your metabolism. Bounds help catch unusual entries, but do not replace professional advice.",
      },
    ],
  },
  {
    heading: "Progress",
    items: [
      {
        title: "A daily perspective",
        body: "The briefing interprets available logs and your plan. Refresh it after logging, and distinguish live AI insight from general fallback guidance.",
      },
      {
        title: "Your logs, in perspective",
        body: "Weight, training and nutrition charts use your recorded data. Missing days stay unknown, and the coach's interpretation is shown separately.",
      },
      {
        title: "Focus for today",
        body: "The briefing ends with up to three concrete things to focus on today — drawn from your own data, not a generic tip list.",
      },
    ],
  },
];

const ROW = { padding: "var(--s4) 0", borderTop: "1px solid var(--border)" };
const INDEX = {
  fontSize: "var(--t-label)",
  letterSpacing: "0.14em",
  color: "var(--faint)",
};

export default function Features() {
  return (
    <div className="page page-wide page-enter">
      <h1 className="page-title">Everything FitAI does</h1>
      <p className="muted" style={{ maxWidth: "46ch", margin: 0 }}>
        One coach, four jobs. Every feature below ships today.
      </p>

      {GROUPS.map((group, gi) => (
        <section key={group.heading}>
          {/* The group label is the section rule; the row index is continuous
              within the group so the list reads as an inventory, which is
              exactly what this page is. */}
          <h2 className="section-title">{group.heading}</h2>

          {group.items.map((f, i) => (
            // The section label already draws a rule; a second one directly
            // beneath it reads as a mistake. Rules go BETWEEN rows.
            <article
              key={f.title}
              className="claim-row reveal"
              style={{
                ...ROW,
                borderTop: i === 0 ? 0 : ROW.borderTop,
                animationDelay: `${gi * 60 + i * 40}ms`,
              }}
            >
              <span className="mono" aria-hidden="true" style={INDEX}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 style={{ margin: 0 }}>{f.title}</h3>
              <p
                className="muted small"
                style={{ margin: 0, maxWidth: "52ch" }}
              >
                {f.body}
              </p>
            </article>
          ))}
        </section>
      ))}

      <div
        style={{
          borderTop: "1px solid var(--border)",
          marginTop: "var(--s7)",
          paddingTop: "var(--s6)",
        }}
      >
        <ButtonLink to="/signup">Create your plan</ButtonLink>
      </div>
    </div>
  );
}
