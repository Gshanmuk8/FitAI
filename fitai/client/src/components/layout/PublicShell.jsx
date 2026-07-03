import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import Footer from './Footer';

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
        <NavLink to="/login" className="nav-link">Log in</NavLink>
        <NavLink to="/signup" className="nav-link" style={{ color: 'var(--blue)' }}>Get started</NavLink>
      </nav>
      <main style={{ flex: 1 }}>{children}</main>
      <Footer />
    </div>
  );
}
