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
          <span className="nav-brand">Fit<em>AI</em></span>
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
