import React from 'react';
import { Link } from 'react-router-dom';

// A link that looks like a button — <a><button> nesting is invalid HTML and
// double-stops keyboard focus, so every "button that navigates" uses this.
export default function ButtonLink({ to, children, variant = 'primary', ...props }) {
  return (
    <Link to={to} className={`btn btn-${variant}`} {...props}>
      {children}
    </Link>
  );
}
