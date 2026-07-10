import React, { useEffect, useState } from 'react';

/**
 * The theme switch — the swap itself is choreographed, not flipped:
 * a View Transitions crossfade where supported, plus a synchronized
 * 600ms color morph on every element (html.theme-morph in theme.css).
 * The icon is one SVG whose sun morphs into a moon by sliding a mask.
 *
 * The chosen theme persists in localStorage and is applied before first
 * paint by the inline script in index.html — no flash of the wrong theme.
 */
const STORAGE_KEY = 'fitai.theme';

function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* private mode */ }
  // Browser chrome (mobile address bar) follows the surface.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0c1017' : '#F5F5F5');
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme);

  useEffect(() => { setTheme(currentTheme()); }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    root.classList.add('theme-morph');
    const swap = () => { applyTheme(next); setTheme(next); };
    if (document.startViewTransition) {
      document.startViewTransition(swap);
    } else {
      swap();
    }
    window.setTimeout(() => root.classList.remove('theme-morph'), 650);
  }

  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <mask id="moon-bite">
          <rect x="0" y="0" width="24" height="24" fill="#fff" />
          {/* slides in to bite the sun into a crescent */}
          <circle cx={dark ? 10 : 26} cy={dark ? 7 : 2} r="8" fill="#000" style={{ transition: 'cx 500ms cubic-bezier(0.25, 0.8, 0.3, 1), cy 500ms cubic-bezier(0.25, 0.8, 0.3, 1)' }} />
        </mask>
        <circle cx="12" cy="12" r={dark ? 8 : 5} mask="url(#moon-bite)" fill="currentColor"
          style={{ transition: 'r 500ms cubic-bezier(0.25, 0.8, 0.3, 1)' }} />
        <g className="sun-rays" style={{ opacity: dark ? 0 : 1, transformOrigin: 'center', transform: dark ? 'rotate(45deg) scale(0.6)' : 'none', transition: 'opacity 400ms ease, transform 500ms cubic-bezier(0.25, 0.8, 0.3, 1)' }} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="12" y1="1.5" x2="12" y2="3.8" />
          <line x1="12" y1="20.2" x2="12" y2="22.5" />
          <line x1="1.5" y1="12" x2="3.8" y2="12" />
          <line x1="20.2" y1="12" x2="22.5" y2="12" />
          <line x1="4.6" y1="4.6" x2="6.2" y2="6.2" />
          <line x1="17.8" y1="17.8" x2="19.4" y2="19.4" />
          <line x1="4.6" y1="19.4" x2="6.2" y2="17.8" />
          <line x1="17.8" y1="6.2" x2="19.4" y2="4.6" />
        </g>
      </svg>
    </button>
  );
}
