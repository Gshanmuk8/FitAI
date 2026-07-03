import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-links">
        <Link to="/about">About</Link>
        <Link to="/learn">Learn</Link>
        <Link to="/features">Features</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
      </div>
      <p className="tiny faint">© 2026 FitAI. All rights reserved.</p>
    </footer>
  );
}
