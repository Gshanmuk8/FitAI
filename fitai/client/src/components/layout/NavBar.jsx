import React from 'react';
import { NavLink } from 'react-router-dom';

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
