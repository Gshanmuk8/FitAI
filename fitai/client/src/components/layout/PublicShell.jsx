import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import Footer from './Footer';
import ThemeToggle from '../ui/ThemeToggle';

// Shell for logged-out pages: marketing nav on top, footer below.
const LINKS = [
  { to: '/about', label: 'About' },
  { to: '/learn', label: 'Learn' },
  { to: '/features', label: 'Features' },
];

export default function PublicShell({ children }) {
  // Mobile-only disclosure, mirroring NavBar. Without this the marketing nav
  // simply wrapped onto a second line on a phone — it had no hamburger at
  // all, so the links had nowhere to collapse to.
  const [open, setOpen] = useState(false);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav className="app-nav">
        <Link to="/" style={{ textDecoration: 'none' }}>
          {/* Mark in ink, wordmark in ink, the italic AI in pigment — the
              chrome's single tinted glyph, and the same brand object the
              signed-in rail carries. */}
          <span className="nav-brand" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s1)' }}>
            <BrandMark />
            {/* One flex item — see NavBar. */}
            <span>Fit<em>AI</em></span>
          </span>
        </Link>

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
          <NavLink to="/login" className="nav-link" onClick={() => setOpen(false)}>
            Sign in
          </NavLink>
        </div>

        {/* The CTA never collapses: it is the one thing this page is for. */}
        <div className="nav-actions">
          <ThemeToggle />
          {/* The site's primary CTA is a button, not tinted text. */}
          <Link to="/signup" className="btn btn-primary nav-cta">
            Get started
          </Link>
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
      <main style={{ flex: 1 }}>{children}</main>
      <Footer />
    </div>
  );
}

// A bezel and a rising trace — see NavBar. Duplicated rather than shared
// because it is four elements and the two shells are otherwise independent.
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
