import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ButtonLink from '../../components/ui/ButtonLink';

// Three confections, each with its own fruit and its own hang height. The
// orbs step along the arc (--orb-1 → --orb-2 → --orb-3), so the row ripens
// left to right instead of being three unrelated colours. These are TOKENS,
// never literal gradients: each theme re-pitches the ramps so the ornament
// stays adjacent to its ground (see the orb-ramp note in theme.css — a
// literal mango here would turn to mud on the dark berry surface).
const PLATES = [
  {
    title: 'It remembers',
    body: 'Injuries, preferences, wins — a coach you never have to re-brief.',
    orb: 'var(--orb-1)',
    hang: '0',
  },
  {
    title: 'It tells the truth',
    body: 'Ahead, on track, or behind — your coach measures your pace from your own logged days, and says it straight.',
    orb: 'var(--orb-2)',
    hang: '2rem',
  },
  {
    title: 'It adapts daily',
    body: 'Missed a session? Slept badly? Tomorrow’s plan already knows.',
    orb: 'var(--orb-3)',
    hang: '1rem',
  },
];

const MANIFESTO = ['no generic plans', 'no forgotten injuries', 'no lying dashboards'];

export default function Home() {
  // Already signed in (e.g. arriving from the email confirmation link)?
  // The marketing page isn't for you — go to the app. Dashboard sends
  // users without a plan onward to onboarding.
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="page page-wide" style={{ marginTop: 0 }}>
      {/* ---- The opening spread ---- */}
      <section style={{ padding: '14vh 0 8vh', position: 'relative' }}>
        <div className="aurora" aria-hidden="true" />

        <p className="eyebrow reveal">Your goal · measured daily</p>

        {/* The hero is the one place licensed to use the full arc
            (--grad-spectrum). Fraunces at opsz 144 with SOFT and WONK fully
            on: the letterforms are the identity as much as the colour is. */}
        <h1
          className="font-display reveal"
          style={{
            fontSize: 'clamp(3rem, 9vw, 6.5rem)',
            fontWeight: 700,
            letterSpacing: '-0.042em',
            lineHeight: 0.98,
            maxWidth: '14ch',
            margin: 'var(--s4) 0 var(--s5)',
            fontVariationSettings: "'SOFT' 100, 'WONK' 1, 'opsz' 144",
            animationDelay: '90ms',
          }}
        >
          Train like the{' '}
          <em
            style={{
              fontStyle: 'italic',
              background: 'var(--grad-spectrum)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            hero
          </em>{' '}
          of your own story.
        </h1>

        <div
          className="reveal"
          style={{
            display: 'flex',
            gap: 'var(--s6)',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            animationDelay: '200ms',
          }}
        >
          <p className="muted" style={{ maxWidth: '42ch', fontSize: '1.15rem', margin: 0 }}>
            An AI coach that builds the plan, keeps the score, and rewrites tomorrow
            based on how today actually went.
          </p>
          <div style={{ display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <ButtonLink to="/signup">Create your plan</ButtonLink>
            <ButtonLink to="/learn" variant="ghost">How it works</ButtonLink>
          </div>
        </div>

        {/* ---- The manifesto, set as an engraved caption under the spread ---- */}
        <p
          className="eyebrow reveal"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.6rem 1.2rem',
            alignItems: 'center',
            margin: 'var(--s7) 0 0',
            paddingTop: 'var(--s4)',
            borderTop: '1px solid var(--border)',
            color: 'var(--muted)',
            animationDelay: '320ms',
          }}
        >
          {MANIFESTO.map((line, i) => (
            <span key={line} style={{ display: 'inline-flex', alignItems: 'center', gap: '1.2rem' }}>
              {i > 0 && (
                <span
                  className="manifesto-dot"
                  aria-hidden="true"
                  style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--faint)', display: 'inline-block' }}
                />
              )}
              {line}
            </span>
          ))}
        </p>
      </section>

      {/* ---- Three plates, hung at different heights ---- */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 'var(--s5)',
          alignItems: 'start',
          padding: 'var(--s5) 0 var(--s8)',
        }}
      >
        {PLATES.map((p, i) => (
          <article
            key={p.title}
            className="card reveal"
            style={{
              marginTop: p.hang,
              // each card's fruit orb is overridden to its own arc stop, so
              // the row ripens across rather than repeating one gradient
              ['--card-orb']: p.orb,
              animationDelay: `${380 + i * 120}ms`,
            }}
          >
            {/* the number, set as a big soft numeral behind the heading —
                ornament that doubles as the card's index */}
            <div
              aria-hidden="true"
              className="font-display"
              style={{
                fontSize: '3.4rem',
                fontWeight: 700,
                lineHeight: 0.8,
                letterSpacing: '-0.05em',
                background: p.orb,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                fontVariationSettings: "'SOFT' 100, 'WONK' 1, 'opsz' 96",
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </div>

            <h3 style={{ margin: 'var(--s3) 0 var(--s2)', fontSize: '1.45rem' }}>{p.title}</h3>
            <p className="muted small" style={{ margin: 0 }}>{p.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
