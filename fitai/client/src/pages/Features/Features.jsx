import React from 'react';
import ButtonLink from '../../components/ui/ButtonLink';

// The tone-per-group accents are gone. Four groups × a coloured stem was
// four pigment moments on one page, which under the spend rule means none of
// them meant anything — the colour was labelling a heading that already
// labelled itself. The groups are now separated by rules and space, and the
// only pigment on the page is the action at the bottom.
const GROUPS = [
  {
    heading: 'Plan',
    items: [
      { title: 'Personalized plan with a deadline', body: 'Onboarding asks your goal AND your timeframe. Unsafe timelines are automatically extended to a healthy pace — with the reason explained.' },
      { title: 'Fully editable', body: 'Change days, exercises, sets, reps, calories, protein, water, steps — within safety bounds. Your edits never reset your goal timeline.' },
      { title: 'Preference learning', body: 'Remove an exercise twice and future plans stop suggesting it. Add one and it becomes a favorite.' },
      { title: 'Life-change regeneration', body: 'New injury, new schedule, new goal? Update your profile and regenerate — learned preferences carry over.' },
    ],
  },
  {
    heading: 'Every day',
    items: [
      { title: 'Adaptive daily mission', body: 'Rebuilt every morning from your live plan: today\'s workout or rest day, protein, water, sleep, and step targets — real numbers, not generic goals.' },
      { title: 'Reacts to yesterday', body: 'Missed workout → moved to today\'s rest day. Poor sleep → reduced intensity. Perfect day → progression nudge. Every adaptation shows its reason.' },
      { title: 'Guided workout sessions', body: 'Each exercise pre-filled with a suggested weight from your own history. Progressive overload is computed, not guessed.' },
      { title: 'Photo food logging', body: 'Snap your plate, confirm the AI\'s estimates, done. Hitting your protein target checks the mission item automatically.' },
    ],
  },
  {
    heading: 'Intelligence',
    items: [
      { title: 'AI coach with long-term memory', body: 'Gym, diet, and recovery modes. It knows your plan, your injuries, and what you told it last month.' },
      { title: 'Transparent memory', body: 'A dedicated page shows exactly what the coach remembers — categorized and ranked. No black box.' },
      { title: 'Never down', body: 'Multiple AI providers in cascade, then deterministic fallbacks. No API outage ever leaves you without an answer or a plan.' },
      { title: 'Safe numbers', body: 'Calorie targets, safety bounds, and progression come from exact formulas over your own data — with hard floors the AI can\'t cross.' },
    ],
  },
  {
    heading: 'Progress',
    items: [
      { title: 'Daily coach\'s briefing', body: 'Every day your coach reads your plan, weigh-ins, and adherence, measures your actual pace against the plan\'s pace, and tells you where you stand — ahead, on track, or behind.' },
      { title: 'Log it where you live', body: 'Weigh-ins, protein, water, sleep, steps, and a daily note — typed straight into Today\'s Mission. Entering a value checks the item off for you.' },
      { title: 'Focus for today', body: 'The briefing ends with up to three concrete things to focus on today — drawn from your own data, not a generic tip list.' },
    ],
  },
];

const ROW = { padding: 'var(--s4) 0', borderTop: '1px solid var(--border)' };
const INDEX = { fontSize: 'var(--t-label)', letterSpacing: '0.14em', color: 'var(--faint)' };

export default function Features() {
  return (
    <div className="page page-wide page-enter">
      <h1 className="page-title">Everything FitAI does</h1>
      <p className="muted" style={{ maxWidth: '46ch', margin: 0 }}>
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
              style={{ ...ROW, borderTop: i === 0 ? 0 : ROW.borderTop, animationDelay: `${gi * 60 + i * 40}ms` }}
            >
              <span className="mono" aria-hidden="true" style={INDEX}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 style={{ margin: 0 }}>{f.title}</h3>
              <p className="muted small" style={{ margin: 0, maxWidth: '52ch' }}>{f.body}</p>
            </article>
          ))}
        </section>
      ))}

      <div style={{ borderTop: '1px solid var(--border)', marginTop: 'var(--s7)', paddingTop: 'var(--s6)' }}>
        <ButtonLink to="/signup">Create your plan</ButtonLink>
      </div>
    </div>
  );
}
