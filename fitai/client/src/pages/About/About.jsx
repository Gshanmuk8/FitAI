import React from 'react';
import ButtonLink from '../../components/ui/ButtonLink';

// Editorial rhythm. Each section is a <section> rather than a loose run of
// h2/p, so every heading can carry a hairline above it and a full space step
// of air. Wrapping them also stops `.prose > p:first-of-type` from randomly
// promoting whichever paragraph happens to come first into a standfirst —
// the lede is chosen here, deliberately, and set once.
const SECTION = {
  borderTop: '1px solid var(--border)',
  marginTop: 'var(--s7)',
  paddingTop: 'var(--s5)',
};
const HEAD = { marginTop: 0, marginBottom: 'var(--s3)' };

export default function About() {
  return (
    <div className="page page-mid page-enter">
      <h1 className="page-title">About FitAI</h1>

      <div className="prose">
        {/* The opening section carries no rule above it — it sits directly
            under the title — and its answer is set as the lede, one size up
            from body at regular weight, ink not pigment. It is already the
            page's standfirst; it just wasn't being set like one. */}
        <section style={{ marginTop: 'var(--s5)' }}>
          <h2 style={HEAD}>What is this?</h2>
          <p style={{ fontSize: 'var(--t-h3)', lineHeight: 1.6, color: 'var(--text)' }}>
            FitAI is an AI fitness coach. You tell it who you are, what you want to achieve, and{' '}
            <strong>by when</strong> — it builds a personalized workout and diet plan, then coaches you
            every single day: a daily mission that adapts to how yesterday actually went, an AI coach
            that remembers your injuries and preferences long-term, photo-based food logging, and honest
            pace tracking that tells you whether you're ahead of schedule, on track, or behind — and why.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEAD}>Who is it for?</h2>
          <p>
            Anyone with a body and a goal: complete beginners who don't know where to start, busy
            professionals who need decisions made for them, people losing weight who want a realistic
            timeline instead of a crash diet, lifters chasing progressive overload, and people getting
            back into fitness after time away. If your circumstances are unusual — injuries, home-only
            equipment, dietary restrictions — that's exactly the context FitAI is built to respect.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEAD}>Why are we building it?</h2>
          <p>
            Modern fitness apps force you to become your own trainer, nutritionist, physiotherapist,
            analyst, and motivator — five jobs spread across five disconnected screens. Trackers record
            what happened but never tell you <strong>what to do about it</strong>. Coaches who do are
            expensive and don't scale.
          </p>
          <p>
            FitAI unifies those jobs into one intelligence layer with three principles:
          </p>

          {/* The three principles as a ruled index rather than bullets: the
              term sits in its own column so the three can be compared at a
              glance, which is what a principle list is for. */}
          <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--s5) 0 0' }}>
            {[
              ['Memory', "A coach you have to re-brief every session isn't a coach. FitAI permanently remembers your injuries, preferences, and progress — and learns from every plan edit you make."],
              ['Honesty', "Every day your coach reads your own logged data — weigh-ins, workouts, adherence — measures your pace against your plan, and says it straight. If you're behind, it says so, and says why. Your targets and safety bounds are exact formulas the AI can't bend."],
              ['Adaptation', 'A plan that ignores a missed workout or a bad night’s sleep is a PDF, not a program. Your daily mission rebuilds itself every morning.'],
            ].map(([term, body]) => (
              <li
                key={term}
                style={{
                  display: 'grid', gridTemplateColumns: 'minmax(0, 9rem) minmax(0, 1fr)',
                  gap: 'var(--s4)', padding: 'var(--s4) 0',
                  borderTop: '1px solid var(--border)', margin: 0,
                }}
              >
                <strong style={{ color: 'var(--text)' }}>{term}.</strong>
                <span className="small">{body}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', marginTop: 'var(--s7)', paddingTop: 'var(--s6)' }}>
        <ButtonLink to="/signup">Create your plan</ButtonLink>
      </div>
    </div>
  );
}
