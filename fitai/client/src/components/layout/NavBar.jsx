import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import ThemeToggle from "../ui/ThemeToggle";
import Icon, { Brand } from "../ui/Icon";
import { useAuth } from "../../contexts/AuthContext";
const LINKS = [
  { to: "/dashboard", label: "Today", icon: "today" },
  { to: "/workout", label: "Train", icon: "train" },
  { to: "/nutrition", label: "Fuel", icon: "fuel" },
  { to: "/progress", label: "Progress", icon: "progress" },
  { to: "/tutor", label: "Coach", icon: "coach" },
];
const SECONDARY = [
  { to: "/plan", label: "My plan", icon: "plan" },
  { to: "/memory", label: "Coach memory", icon: "memory" },
];
function NavigationLink({ to, label, icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `rail-link${isActive ? " active" : ""}`}
    >
      <Icon name={icon} />
      <span>{label}</span>
    </NavLink>
  );
}
export default function NavBar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const section =
    [...LINKS, ...SECONDARY, { to: "/profile", label: "Profile" }].find(
      (item) => item.to === pathname,
    )?.label || "Your space";
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="app-rail">
        <Link to="/dashboard" className="brand-link" aria-label="FitAI Today">
          <Brand />
        </Link>
        <p className="rail-caption">YOUR EVERYDAY EDGE</p>
        <nav className="rail-main" aria-label="Main navigation">
          {LINKS.map((item) => (
            <NavigationLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="rail-divider" />
        <nav className="rail-secondary" aria-label="Your program">
          {SECONDARY.map((item) => (
            <NavigationLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="rail-bottom">
          <div className="rail-note">
            <span className="status-dot" />
            <span>Small steps. Lasting change.</span>
          </div>
          <NavigationLink
            to="/profile"
            label="Profile & settings"
            icon="user"
          />
        </div>
      </aside>
      <header className="app-topbar">
        <Link to="/dashboard" className="mobile-brand" aria-label="FitAI Today">
          <Brand compact />
        </Link>
        <div className="breadcrumb">
          YOUR SPACE<span>/</span>
          <strong>{section}</strong>
        </div>
        <div className="topbar-actions">
          <Link
            className="icon-button mobile-plan"
            to="/plan"
            aria-label="My plan"
          >
            <Icon name="plan" />
          </Link>
          <ThemeToggle />
          <Link
            to="/profile"
            className="avatar"
            aria-label="Profile and settings"
          >
            {user?.email?.slice(0, 1).toUpperCase() || "F"}
          </Link>
        </div>
      </header>
      <nav className="mobile-tabs" aria-label="Mobile navigation">
        {LINKS.map((item) => (
          <NavigationLink key={item.to} {...item} />
        ))}
      </nav>
    </>
  );
}
