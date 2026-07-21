import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Eight numbered steps. The number is pulled out of the heading and set in
// the mono label voice in its own column, so the headings all start on one
// vertical and the sequence is readable as a sequence rather than as eight
// sentences that happen to begin with a digit.
const STEPS = [
  {
    heading: 'Be honest at onboarding',
    body: (
      <>
        Your plan, calorie target, and timeline are all computed from what you enter — age, weight,
        target, activity level, injuries. Overstate your activity level and your calorie target will
        be too high; hide an injury and the plan can't protect it. If your timeframe is too
        aggressive, FitAI extends it to a safe pace and tells you why — that's a feature, not a bug.
      </>
    ),
  },
  {
    heading: 'Live in "Today"',
    body: (
      <>
        The dashboard's daily mission is the whole product in five checkboxes: today's workout (or
        rest day), protein, water, sleep, steps — with real numbers from <strong>your</strong> plan.
        It regenerates every morning and adapts: miss a workout and it moves to your next rest day;
        sleep badly and today's session drops intensity. Just clear the list.
      </>
    ),
  },
  {
    heading: 'Weigh in a few times a week',
    body: (
      <>
        Pace tracking needs data. Two or three weigh-ins a week (same time of day, ideally morning)
        is enough — type it into Today's Mission on the dashboard. Without weigh-ins, your coach's
        daily briefing can't tell you whether you're ahead or behind.
      </>
    ),
  },
  {
    heading: 'Log workouts from the plan',
    body: (
      <>
        Open Workout on a training day and log sets against today's session — each exercise comes
        pre-filled with a suggested weight from your own history (finish all reps → the suggestion
        goes up next time). Finishing the session checks off the mission automatically.
      </>
    ),
  },
  {
    heading: 'Log food the lazy way',
    body: (
      <>
        Photograph your plate and confirm the AI's estimates, or type "chicken bowl, 650 kcal, 45g"
        manually. When your protein total crosses the target, the checklist item completes itself.
        You don't need perfection — you need most days to be roughly right.
      </>
    ),
  },
  {
    heading: 'Edit your plan — it learns',
    body: (
      <>
        Hate running? Remove it in the plan editor. Do it twice and FitAI stops suggesting it in
        future plans. Adding exercises marks them as favorites. Diet targets are editable within
        safe bounds. Edits never reset your goal timeline.
      </>
    ),
  },
  {
    heading: 'Talk to the coach like a person',
    body: (
      <>
        Ask the AI coach anything — "why is my squat stalling?", "what do I eat before a morning
        session?". It knows your plan, pace, injuries, and what you've told it before, and durable
        facts from your chats land on the Memory page where you can see exactly what it remembers.
      </>
    ),
  },
  {
    heading: 'Read the briefing daily, judge weekly',
    body: (
      <>
        Your coach's briefing on the dashboard refreshes once a day — it measures your actual pace
        against the plan and picks today's focus. Direction over days matters; single data points
        don't. When life changes (injury, new goal, new schedule), update your Profile and hit
        "Regenerate plan".
      </>
    ),
  },
];

const STEP = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 3rem) minmax(0, 1fr)',
  gap: '0 var(--s4)',
  // The step number sits on the heading's baseline — see Terms.
  alignItems: 'baseline',
  borderTop: '1px solid var(--border)',
  padding: 'var(--s6) 0 0',
  marginTop: 'var(--s6)',
};
const INDEX = { fontSize: 'var(--t-label)', letterSpacing: '0.14em', color: 'var(--faint)' };

export default function Learn() {
  // Learn is useful both pre-signup and in-app — but "create your plan"
  // makes no sense to someone who already has one.
  const { user } = useAuth();
  return (
    <div className="page page-mid page-enter">
      <h1 className="page-title">How to use FitAI effectively</h1>

      {/* The lede, set one size up in ink — the sentence that frames the
          eight steps beneath it. */}
      <p style={{ fontSize: 'var(--t-h3)', lineHeight: 1.6, color: 'var(--text)', maxWidth: '48ch', margin: 0 }}>
        FitAI rewards consistency over intensity. Here's how to get the most out of it, in the
        order that matters.
      </p>

      <div className="prose" style={{ maxWidth: 'none' }}>
        {STEPS.map((step, i) => (
          <section key={step.heading} style={STEP}>
            <span className="mono" aria-hidden="true" style={INDEX}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ marginTop: 0, marginBottom: 'var(--s3)' }}>{step.heading}</h2>
              <p style={{ margin: 0, maxWidth: 'var(--measure)' }}>{step.body}</p>
            </div>
          </section>
        ))}
      </div>

      <p style={{ borderTop: '1px solid var(--border)', marginTop: 'var(--s7)', paddingTop: 'var(--s6)' }}>
        {user
          ? <Link to="/dashboard">Open Today →</Link>
          : <>Ready? <Link to="/signup">Create your plan →</Link></>}
      </p>
    </div>
  );
}
