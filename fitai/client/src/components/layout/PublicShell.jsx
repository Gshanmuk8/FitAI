import React, { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import Footer from "./Footer";
import ThemeToggle from "../ui/ThemeToggle";
import Icon, { Brand } from "../ui/Icon";
export default function PublicShell({ children }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const authPage = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ].includes(pathname);
  return (
    <div className="public-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="public-nav">
        <Link to="/" className="brand-link" aria-label="FitAI home">
          <Brand />
        </Link>
        <nav
          className={`public-links${open ? " open" : ""}`}
          aria-label="Main navigation"
        >
          {[
            ["/features", "The experience"],
            ["/learn", "How it works"],
            ["/about", "Our approach"],
          ].map(([to, label]) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-actions">
          <ThemeToggle />
          <Link to="/login" className="public-signin">
            Sign in
          </Link>
          <Link to="/signup" className="btn btn-primary nav-cta">
            Get started <Icon name="arrow" size={16} />
          </Link>
          <button
            className="icon-button public-menu"
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <Icon name={open ? "close" : "plan"} />
          </button>
        </div>
      </header>
      <main id="main-content" className={authPage ? "auth-layout" : ""}>
        {authPage && (
          <aside className="auth-story">
            <span className="eyebrow">BUILT AROUND YOUR LIFE</span>
            <h2>
              Find your rhythm.
              <br />
              <span>Keep your edge.</span>
            </h2>
            <p>
              A thoughtful plan. A little consistency.
              <br />A coach that grows with you.
            </p>
            <div className="orbit-art" aria-hidden="true">
              <div />
              <div />
              <div />
              <Icon name="coach" size={48} />
            </div>
            <div className="auth-story-foot">
              <Icon name="shield" />
              <span>Your own pace. Your own progress.</span>
            </div>
          </aside>
        )}
        {children}
      </main>
      {!authPage && <Footer />}
    </div>
  );
}
