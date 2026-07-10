import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ButtonLink from '../../components/ui/ButtonLink';

// Each chapter panel carries its own pigment and its own vertical drift —
// the row reads as an arranged still life, not a component grid.
const PANELS = [
  {
    numeral: 'I',
    title: 'It remembers',
    body: 'Injuries, preferences, wins — a coach you never have to re-brief.',
    wash: 'var(--cyan-dim)',
    edge: 'var(--cyan)',
    drift: '0',
  },
  {
    numeral: 'II',
    title: 'It tells the truth',
    body: 'Ahead, on track, or behind — your coach measures your pace from your own logged days, and says it straight.',
    wash: 'var(--lime-dim)',
    edge: 'var(--gold)',
    drift: '2.2rem',
  },
  {
    numeral: 'III',
    title: 'It adapts daily',
    body: 'Missed a session? Slept badly? Tomorrow’s plan already knows.',
    wash: 'var(--emerald-dim)',
    edge: 'var(--emerald)',
    drift: '0.9rem',
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
      {/* ---- Opening spread ---- */}
      <section style={{ padding: '12vh 0 6vh', position: 'relative' }}>
        <div className="aurora" aria-hidden="true" />

        <p className="eyebrow reveal">Chapter one · your goal</p>
        <h1
          className="font-display reveal"
          style={{
            fontSize: 'clamp(2.9rem, 8.5vw, 5.6rem)',
            fontWeight: 420,
            letterSpacing: '-0.015em',
            lineHeight: 1.02,
            maxWidth: '16ch',
            margin: '1rem 0 1.4rem',
            animationDelay: '90ms',
          }}
        >
          Train like the{' '}
          <em
            style={{
              fontStyle: 'italic',
              fontWeight: 520,
              background: 'linear-gradient(120deg, var(--gold-deep), var(--gold) 55%, var(--gold-hi))',
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
          style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'flex-end', animationDelay: '200ms' }}
        >
          <p className="muted" style={{ maxWidth: '44ch', fontSize: '1.12rem', margin: 0 }}>
            An AI coach that builds the plan, keeps the score, and rewrites tomorrow
            based on how today actually went.
          </p>
          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <ButtonLink to="/signup">Create your plan</ButtonLink>
            <ButtonLink to="/learn" variant="ghost">How it works</ButtonLink>
          </div>
        </div>

        {/* ---- Manifesto strip — an engraved caption under the spread ---- */}
        <p
          className="eyebrow reveal"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.6rem 1.1rem',
            alignItems: 'center',
            margin: '3.2rem 0 0',
            color: 'var(--muted)',
            animationDelay: '320ms',
          }}
        >
          {MANIFESTO.map((line, i) => (
            <span key={line} style={{ display: 'inline-flex', alignItems: 'center', gap: '1.1rem' }}>
              {i > 0 && <span aria-hidden="true" style={{ color: 'var(--gold-deep)', fontSize: '0.55rem' }}>✦</span>}
              {line}
            </span>
          ))}
        </p>
      </section>

      {/* ---- Three chapters, hung at different heights ---- */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.6rem',
          alignItems: 'start',
          padding: '1.5rem 0 5rem',
        }}
      >
        {PANELS.map((p, i) => (
          <article
            key={p.title}
            className="card reveal"
            style={{
              background: `linear-gradient(180deg, ${p.wash}, var(--surface) 62%)`,
              marginTop: p.drift,
              borderTop: `3px solid ${p.edge}`,
              animationDelay: `${380 + i * 120}ms`,
            }}
          >
            <div
              className="font-display"
              style={{ fontStyle: 'italic', fontWeight: 430, fontSize: '1.5rem', color: p.edge, lineHeight: 1 }}
            >
              {p.numeral}
            </div>
            <h3 style={{ margin: '0.55rem 0 0.35rem', fontSize: '1.3rem' }}>{p.title}</h3>
            <p className="muted small" style={{ margin: 0 }}>{p.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
