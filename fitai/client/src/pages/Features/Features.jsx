import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';

const GROUPS = [
  {
    heading: 'Plan',
    tone: 'blue',
    items: [
      { title: 'Personalized plan with a deadline', body: 'Onboarding asks your goal AND your timeframe. Unsafe timelines are automatically extended to a healthy pace — with the reason explained.' },
      { title: 'Fully editable', body: 'Change days, exercises, sets, reps, calories, protein, water, steps — within safety bounds. Your edits never reset your goal timeline.' },
      { title: 'Preference learning', body: 'Remove an exercise twice and future plans stop suggesting it. Add one and it becomes a favorite.' },
      { title: 'Life-change regeneration', body: 'New injury, new schedule, new goal? Update your profile and regenerate — learned preferences carry over.' },
    ],
  },
  {
    heading: 'Every day',
    tone: 'emerald',
    items: [
      { title: 'Adaptive daily mission', body: 'Rebuilt every morning from your live plan: today\'s workout or rest day, protein, water, sleep, and step targets — real numbers, not generic goals.' },
      { title: 'Reacts to yesterday', body: 'Missed workout → moved to today\'s rest day. Poor sleep → reduced intensity. Perfect day → progression nudge. Every adaptation shows its reason.' },
      { title: 'Guided workout sessions', body: 'Each exercise pre-filled with a suggested weight from your own history. Progressive overload is computed, not guessed.' },
      { title: 'Photo food logging', body: 'Snap your plate, confirm the AI\'s estimates, done. Hitting your protein target checks the mission item automatically.' },
    ],
  },
  {
    heading: 'Intelligence',
    tone: 'cyan',
    items: [
      { title: 'AI coach with long-term memory', body: 'Gym, diet, and recovery modes. It knows your plan, your pace, your injuries, and what you told it last month.' },
      { title: 'Transparent memory', body: 'A dedicated page shows exactly what the coach remembers — categorized and ranked. No black box.' },
      { title: 'Never down', body: 'Five AI providers in cascade, then deterministic fallbacks. No API outage ever leaves you without an answer or a plan.' },
      { title: 'Numbers are math, not AI', body: 'Calories, pace, projections, and progression come from exact formulas over your own data. The AI writes words, never invents numbers.' },
    ],
  },
  {
    heading: 'Progress',
    tone: 'amber',
    items: [
      { title: 'Honest pace tracking', body: 'Ahead, on track, or behind — measured against your plan\'s timeline, with a projected finish date at your actual rate.' },
      { title: 'Explains "why"', body: 'Behind schedule? FitAI reads your adherence data and tells you which lever slipped — workouts, protein, or sleep — and what to do.' },
      { title: 'Weekly & monthly reviews', body: 'Auto-generated coaching reviews from your real stats: wins, misses, and next week\'s focus.' },
      { title: 'Streaks & achievements', body: 'Earned milestones — 7-day streaks, workout counts, goal percentages — unlocked by data, not by opening the app.' },
    ],
  },
];

export default function Features() {
  return (
    <div className="page page-wide page-enter">
      <h2 className="page-title">Everything FitAI does</h2>
      <p className="muted">One coach, four jobs. Every feature below ships today.</p>

      {GROUPS.map((group) => (
        <section key={group.heading}>
          <h3 className="section-title">{group.heading}</h3>
          <div className="grid-cards" style={{ marginTop: '0.5rem' }}>
            {group.items.map((f) => (
              <div key={f.title} className={`card card-accent tone-${group.tone}`}>
                <h3>{f.title}</h3>
                <p className="small muted" style={{ margin: 0 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      ))}

      <p style={{ marginTop: '2rem', textAlign: 'center' }}>
        <Link to="/signup"><Button>Start with your plan</Button></Link>
      </p>
    </div>
  );
}
