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
      <span className="nav-brand">Fit<em>AI</em></span>
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
      <ThemeToggle />
    </nav>
  );
}
