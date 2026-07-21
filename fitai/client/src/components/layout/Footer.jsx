import React from 'react';
import { Link } from 'react-router-dom';

// Structural, not decorative. The footer's job is to end the page and hold
// the secondary routes — so it gets the same measure as the widest page,
// a hairline above it, and nothing that competes with the content it
// follows. No pigment lives here at all.
export default function Footer() {
  return (
    <footer className="site-footer">
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <p className="eyebrow" style={{ margin: '0 0 var(--s4)' }}>FitAI</p>

        <div className="site-footer-links">
          <Link to="/about">About</Link>
          <Link to="/learn">Learn</Link>
          <Link to="/features">Features</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </div>

        <p className="tiny faint">© 2026 FitAI. All rights reserved.</p>
      </div>
    </footer>
  );
}
