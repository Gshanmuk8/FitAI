import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function Learn() {
  // Learn is useful both pre-signup and in-app — but "create your plan"
  // makes no sense to someone who already has one.
  const { user } = useAuth();
  return (
    <div className="page page-mid page-enter prose">
      <h2 className="page-title">How to use FitAI effectively</h2>
      <p>
        FitAI rewards consistency over intensity. Here's how to get the most out of it, in the
        order that matters.
      </p>

      <h2>1. Be honest at onboarding</h2>
      <p>
        Your plan, calorie target, and timeline are all computed from what you enter — age, weight,
        target, activity level, injuries. Overstate your activity level and your calorie target will
        be too high; hide an injury and the plan can't protect it. If your timeframe is too
        aggressive, FitAI extends it to a safe pace and tells you why — that's a feature, not a bug.
      </p>

      <h2>2. Live in "Today"</h2>
      <p>
        The dashboard's daily mission is the whole product in five checkboxes: today's workout (or
        rest day), protein, water, sleep, steps — with real numbers from <strong>your</strong> plan.
        It regenerates every morning and adapts: miss a workout and it moves to your next rest day;
        sleep badly and today's session drops intensity. Just clear the list.
      </p>

      <h2>3. Weigh in a few times a week</h2>
      <p>
        Pace tracking needs data. Two or three weigh-ins a week (same time of day, ideally morning)
        is enough — type it into Today's Mission on the dashboard. Without weigh-ins, your coach's
        daily briefing can't tell you whether you're ahead or behind.
      </p>

      <h2>4. Log workouts from the plan</h2>
      <p>
        Open Workout on a training day and log sets against today's session — each exercise comes
        pre-filled with a suggested weight from your own history (finish all reps → the suggestion
        goes up next time). Finishing the session checks off the mission automatically.
      </p>

      <h2>5. Log food the lazy way</h2>
      <p>
        Photograph your plate and confirm the AI's estimates, or type "chicken bowl, 650 kcal, 45g"
        manually. When your protein total crosses the target, the checklist item completes itself.
        You don't need perfection — you need most days to be roughly right.
      </p>

      <h2>6. Edit your plan — it learns</h2>
      <p>
        Hate running? Remove it in the plan editor. Do it twice and FitAI stops suggesting it in
        future plans. Adding exercises marks them as favorites. Diet targets are editable within
        safe bounds. Edits never reset your goal timeline.
      </p>

      <h2>7. Talk to the coach like a person</h2>
      <p>
        Ask the AI coach anything — "why is my squat stalling?", "what do I eat before a morning
        session?". It knows your plan, pace, injuries, and what you've told it before, and durable
        facts from your chats land on the Memory page where you can see exactly what it remembers.
      </p>

      <h2>8. Read the briefing daily, judge weekly</h2>
      <p>
        Your coach's briefing on the dashboard refreshes once a day — it measures your actual pace
        against the plan and picks today's focus. Direction over days matters; single data points
        don't. When life changes (injury, new goal, new schedule), update your Profile and hit
        "Regenerate plan".
      </p>

      <p style={{ marginTop: '2rem' }}>
        {user
          ? <Link to="/dashboard">Open Today →</Link>
          : <>Ready? <Link to="/signup">Create your plan →</Link></>}
      </p>
    </div>
  );
}
