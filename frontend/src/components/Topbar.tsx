import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function IconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  );
}

export default function Topbar() {
  const { session, signOut } = useAuth();

  return (
    <header className="topbar">
      <div className="topbar-logo">
        <span className="sidebar-logo-mark">C</span>
        CareerPilot
      </div>

      <nav className="topbar-nav">
        <NavLink to="/" end className={({ isActive }) => "topbar-nav-item" + (isActive ? " active" : "")}>
          <IconSearch />
          Job Analysis
        </NavLink>
        <NavLink
          to="/applications"
          className={({ isActive }) => "topbar-nav-item" + (isActive ? " active" : "")}
        >
          <IconBriefcase />
          Applications
        </NavLink>
        <NavLink
          to="/resume-builder"
          className={({ isActive }) => "topbar-nav-item" + (isActive ? " active" : "")}
        >
          <IconDocument />
          Resume Builder
        </NavLink>
      </nav>

      {session && (
        <div className="topbar-actions">
          <span className="topbar-email muted">{session.user.email}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
