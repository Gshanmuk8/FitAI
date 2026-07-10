import React from 'react';
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
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav className="app-nav">
        <Link to="/" style={{ textDecoration: 'none' }}>
          <span className="nav-brand">Fit<em>AI</em></span>
        </Link>
        {LINKS.map(({ to, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            {label}
          </NavLink>
        ))}
        <span style={{ flex: 1 }} />
        <ThemeToggle />
        <NavLink to="/login" className="nav-link">Sign in</NavLink>
        {/* The site's primary CTA is a button, not tinted text. */}
        <Link to="/signup" className="btn btn-primary" style={{ minHeight: 36, padding: '0.3rem 1.1rem', fontSize: '0.86rem' }}>
          Get started
        </Link>
      </nav>
      <main style={{ flex: 1 }}>{children}</main>
      <Footer />
    </div>
  );
}
