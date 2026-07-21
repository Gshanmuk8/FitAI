import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import ThemeToggle from '../ui/ThemeToggle';

// One persistent nav for every authenticated page, in the order of the
// daily flow: check the mission, train, eat, see the journey, talk to the
// coach, manage the plan, manage yourself. Account actions live on Profile;
// the coach's memory is reached from the Coach page — neither earns a
// top-level slot of its own.
const LINKS = [
  { to: '/dashboard', label: 'Today' },
  { to: '/workout', label: 'Workout' },
  { to: '/nutrition', label: 'Nutrition' },
  { to: '/progress', label: 'Progress' },
  { to: '/tutor', label: 'Coach' },
  { to: '/plan', label: 'Plan' },
  { to: '/profile', label: 'Profile' },
];

export default function NavBar() {
  // Mobile-only disclosure state; on desktop the links list renders inline
  // (display: contents) and the hamburger is hidden, so this never applies.
  const [open, setOpen] = useState(false);

  return (
    <nav className="app-nav">
      {/* The brand is a mark plus a wordmark. The mark is drawn in ink
          (currentColor) on purpose: the italic AI is already the chrome's
          one tinted glyph, and a second pigment in the same 90px would
          spend the screen's whole colour budget on decoration. */}
      <span className="nav-brand" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s1)' }}>
        <BrandMark />
        {/* One flex item, not three: a bare text node either side of <em>
            would each become their own item and the gap would open up
            inside the word. */}
        <span>Fit<em>AI</em></span>
      </span>

      {/* display:contents on desktop — these sit inline in the rail; on
          mobile the wrapper becomes the drop-down sheet. */}
      <div className={`nav-links${open ? ' open' : ''}`}>
        {LINKS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            onClick={() => setOpen(false)}
          >
            {label}
          </NavLink>
        ))}
      </div>

      {/* Actions live in one cluster at the right edge, in the same order
          as the public shell, so the rail reads identically signed-in and
          signed-out. Previously the toggle and the hamburger each carried
          `margin-left: auto` and split the slack between them. */}
      <div className="nav-actions">
        <ThemeToggle />
        <button
          type="button"
          className={`nav-hamburger${open ? ' open' : ''}`}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </nav>
  );
}

// A bezel and a rising trace: the product is an instrument that reads a
// number over time, and that is the whole glyph. Hairline bezel, solid
// trace — the same two weights the cards use.
function BrandMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flex: 'none' }}>
      <rect x="1" y="1" width="18" height="18" rx="5.5" stroke="currentColor" strokeOpacity="0.24" strokeWidth="1.25" />
      <path
        d="M5 13.6 L8.4 9.8 L11.4 11.9 L15.2 6.4"
        stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}
