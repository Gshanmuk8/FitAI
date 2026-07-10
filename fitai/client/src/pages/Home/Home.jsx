import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ButtonLink from '../../components/ui/ButtonLink';

const PANELS = [
  { title: 'It remembers', body: 'Injuries, preferences, wins — a coach you never have to re-brief.', wash: 'var(--cyan-dim)', tilt: '-1.6deg' },
  { title: 'It tells the truth', body: 'Ahead, on track, or behind — your coach measures your pace from your own logged days, and says it straight.', wash: 'var(--lime-dim)', tilt: '1.2deg' },
  { title: 'It adapts daily', body: 'Missed a session? Slept badly? Tomorrow’s plan already knows.', wash: 'var(--emerald-dim)', tilt: '-0.8deg' },
];

export default function Home() {
  // Already signed in (e.g. arriving from the email confirmation link)?
  // The marketing page isn't for you — go to the app. Dashboard sends
  // users without a plan onward to onboarding.
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="page page-wide page-enter" style={{ marginTop: 0 }}>
      {/* ---- Opening spread ---- */}
      <section style={{ padding: '10vh 0 5vh', position: 'relative' }}>
        <p className="eyebrow">Chapter one · your goal</p>
        <h1
          className="font-display"
          style={{
            fontSize: 'clamp(2.6rem, 7.5vw, 4.8rem)',
            fontWeight: 800,
            letterSpacing: '-0.025em',
            lineHeight: 1.02,
            maxWidth: '15ch',
            margin: '0.75rem 0 1rem',
          }}
        >
          Train like the{' '}
          <span
            style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #4b8ef8, var(--blue))',
              color: '#fff',
              borderRadius: 14,
              padding: '0 0.35em',
              boxShadow: '0 10px 26px -8px rgba(59, 130, 246, 0.55)',
              transform: 'rotate(-2deg)',
            }}
          >
            hero
          </span>{' '}
          of your own story.
        </h1>
        <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <p className="muted" style={{ maxWidth: '44ch', fontSize: '1.1rem', margin: 0 }}>
            An AI coach that builds the plan, keeps the score, and rewrites tomorrow
            based on how today actually went.
          </p>
          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <ButtonLink to="/signup">Create your plan</ButtonLink>
            <ButtonLink to="/learn" variant="ghost">How it works</ButtonLink>
          </div>
        </div>
        <p className="font-accent" style={{ fontSize: '1.25rem', color: 'var(--emerald)', transform: 'rotate(-1.5deg)', margin: '1.5rem 0 0', display: 'inline-block' }}>
          no generic plans. no forgotten injuries. no lying dashboards. ↓
        </p>
      </section>

      {/* ---- Three panels ---- */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.6rem', padding: '1rem 0 4.5rem' }}>
        {PANELS.map((p, i) => (
          <article
            key={p.title}
            className="card"
            style={{
              background: `linear-gradient(180deg, ${p.wash}, var(--surface) 60%)`,
              transform: `rotate(${p.tilt})`,
            }}
          >
            <div className="mono tiny faint">{String(i + 1).padStart(2, '0')}</div>
            <h3 style={{ margin: '0.3rem 0 0.35rem' }}>{p.title}</h3>
            <p className="muted small" style={{ margin: 0 }}>{p.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
