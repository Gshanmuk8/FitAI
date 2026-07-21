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
      {/* ---- The opening ----
           Two columns: the argument on the left, the instrument on the
           right. The old hero was a single narrow column of text stranded
           in a 1440px page — all that empty space read as unfinished
           rather than generous, because nothing anchored the other half.
           The specimen answers "what do I actually get?" in the same
           breath as the claim, which no amount of copy does as fast. */}
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow reveal">Your goal · measured daily</p>

          {/* No gradient across the headline, no tinted word. The emphasis
              is italic — a gradient headline is the most reliable tell of
              a template. */}
          <h1 className="hero-title reveal" style={{ animationDelay: '60ms' }}>
            Train like the <em>hero</em> of your own story.
          </h1>

          <p className="hero-standfirst reveal muted" style={{ animationDelay: '140ms' }}>
            An AI coach that builds the plan, keeps the score, and rewrites tomorrow
            based on how today actually went.
          </p>

          <div className="hero-actions reveal" style={{ animationDelay: '220ms' }}>
            <ButtonLink to="/signup">Create your plan</ButtonLink>
            <ButtonLink to="/learn" variant="ghost">How it works</ButtonLink>
          </div>

          {/* ---- The manifesto, as a quiet caption under a rule ---- */}
          <p className="hero-manifesto eyebrow reveal" style={{ animationDelay: '300ms' }}>
            {MANIFESTO.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </p>
        </div>

        {/* The specimen: the app's own vocabulary, at rest. Decorative and
            inert — it is a picture of the product, so it is hidden from
            assistive tech rather than read out as if it were live data. */}
        <aside className="hero-specimen reveal" aria-hidden="true" style={{ animationDelay: '260ms' }}>
          <div className="specimen-head">
            <span className="eyebrow">Today</span>
            <span className="chip tone-emerald">On pace</span>
          </div>

          <div className="specimen-figure">
            <span className="specimen-value">86.4</span>
            <span className="specimen-unit">kg</span>
          </div>
          <p className="specimen-caption">7-day mean 86.9 · −0.5 kg / wk</p>

          {/* A weight trend is a LINE — bars imply discrete quantities per
              day, and a descending bar chart of bodyweight reads as "less
              is happening" rather than "the number is coming down". The
              band beneath carries the eye without adding a second colour. */}
          <svg className="specimen-spark" viewBox="0 0 240 64" preserveAspectRatio="none" role="presentation">
            <defs>
              <linearGradient id="specimen-fade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--blue)" stopOpacity="0.16" />
                <stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 10 L22 15 L44 12 L66 21 L88 19 L110 28 L132 33 L154 31 L176 41 L198 45 L220 44 L240 52 L240 64 L0 64 Z"
              fill="url(#specimen-fade)"
            />
            <path
              d="M0 10 L22 15 L44 12 L66 21 L88 19 L110 28 L132 33 L154 31 L176 41 L198 45 L220 44 L240 52"
              fill="none" stroke="var(--blue)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
            />
          </svg>

          <ul className="specimen-rows">
            <li><span>Protein</span><span className="specimen-metric">156 / 150 g</span></li>
            <li><span>Session</span><span className="specimen-metric">Push · 18 sets</span></li>
            <li><span>Adherence</span><span className="specimen-metric">84%</span></li>
          </ul>
        </aside>
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
