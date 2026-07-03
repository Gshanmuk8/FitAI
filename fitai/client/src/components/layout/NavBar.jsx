import React from 'react';
import { NavLink } from 'react-router-dom';

// One persistent nav for every authenticated page — each destination
// appears exactly once, in the order of the daily flow: check the mission,
// train, eat, talk to the coach, review progress, manage the plan/self.
const LINKS = [
  { to: '/dashboard', label: 'Today' },
  { to: '/workout', label: 'Workout' },
  { to: '/nutrition', label: 'Nutrition' },
  { to: '/tutor', label: 'Coach' },
  { to: '/progress', label: 'Progress' },
  { to: '/plan', label: 'Plan' },
  { to: '/memory', label: 'Memory' },
  { to: '/profile', label: 'Profile' },
  { to: '/settings', label: 'Settings' },
];

export default function NavBar() {
  return (
    <nav className="app-nav">
      <span className="nav-brand">Fit<em>AI</em></span>
      {LINKS.map(({ to, label }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
