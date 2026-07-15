import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ButtonLink from '../../components/ui/ButtonLink';

// Three claims, set as a ruled index rather than a row of cards. A card is
// a container, and a container around one sentence is packaging around
// nothing — the rule and the space do the same job with less noise.
const CLAIMS = [
  {
    title: 'It remembers',
    body: 'Injuries, preferences, wins — a coach you never have to re-brief.',
  },
  {
    title: 'It tells the truth',
    body: 'Ahead, on track, or behind — your coach measures your pace from your own logged days, and says it straight.',
  },
  {
    title: 'It adapts daily',
    body: 'Missed a session? Slept badly? Tomorrow’s plan already knows.',
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
      {/* ---- The opening ---- */}
      <section style={{ padding: '16vh 0 12vh', position: 'relative' }}>
        <div className="aurora" aria-hidden="true" />

        <p className="eyebrow reveal">Your goal · measured daily</p>

        {/* No gradient across the headline, no tinted word. The emphasis is
            italic — the display face is expressive enough to carry it, and
            a gradient headline is the most reliable tell of a template. */}
        <h1
          className="font-display reveal"
          style={{
            fontSize: 'var(--t-hero)',
            fontWeight: 450,
            letterSpacing: '-0.03em',
            lineHeight: 1.06,
            maxWidth: '17ch',
            margin: 'var(--s4) 0 0',
            fontVariationSettings: "'SOFT' 8, 'WONK' 0, 'opsz' 144",
            animationDelay: '60ms',
          }}
        >
          Train like the <em style={{ fontStyle: 'italic' }}>hero</em> of your own story.
        </h1>

        {/* The standfirst holds a 46ch measure and sits on its own line —
            the CTAs get their own row beneath rather than fighting it for
            the baseline. Two elements side by side that aren't related is
            what made the old hero feel arbitrary. */}
        <p
          className="reveal muted"
          style={{
            maxWidth: '46ch',
            fontSize: '1.075rem',
            lineHeight: 1.6,
            margin: 'var(--s5) 0 var(--s6)',
            animationDelay: '140ms',
          }}
        >
          An AI coach that builds the plan, keeps the score, and rewrites tomorrow
          based on how today actually went.
        </p>

        <div
          className="reveal"
          style={{ display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap', alignItems: 'center', animationDelay: '220ms' }}
        >
          <ButtonLink to="/signup">Create your plan</ButtonLink>
          <ButtonLink to="/learn" variant="ghost">How it works</ButtonLink>
        </div>

        {/* ---- The manifesto, as a quiet caption under a rule ---- */}
        <p
          className="eyebrow reveal"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--s2) var(--s4)',
            alignItems: 'center',
            margin: 'var(--s8) 0 0',
            paddingTop: 'var(--s4)',
            borderTop: '1px solid var(--border)',
            animationDelay: '300ms',
          }}
        >
          {MANIFESTO.map((line, i) => (
            <span key={line} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s4)' }}>
              {i > 0 && (
                <span
                  className="manifesto-dot"
                  aria-hidden="true"
                  style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--faint)', display: 'inline-block' }}
                />
              )}
              {line}
            </span>
          ))}
        </p>
      </section>

      {/* ---- The index: three claims on ruled rows ----
           Each row is a hairline, a number, a heading and a line of body,
           aligned to a shared grid. The alignment IS the design; there is
           nothing here to decorate. */}
      <section style={{ paddingBottom: 'var(--s9)' }}>
        {CLAIMS.map((c, i) => (
          // Three explicit columns — index, claim, elaboration — on a shared
          // grid so all three rows align to the same two verticals. The
          // heading column is sized to the content (14rem), not left to
          // auto-fit, which was handing it a 600px column and stranding the
          // body text half a screen away.
          <article
            key={c.title}
            className="claim-row reveal"
            style={{
              padding: 'var(--s6) 0',
              borderTop: '1px solid var(--border)',
              animationDelay: `${360 + i * 90}ms`,
            }}
          >
            <span
              className="mono"
              aria-hidden="true"
              style={{ fontSize: 'var(--t-label)', letterSpacing: '0.14em', color: 'var(--faint)' }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <h2 style={{ margin: 0 }}>{c.title}</h2>
            <p className="muted" style={{ margin: 0, maxWidth: '46ch', fontSize: 'var(--t-small)' }}>{c.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
