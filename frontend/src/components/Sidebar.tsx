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

export default function Sidebar() {
  const { session, signOut } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-mark">C</span>
        CareerPilot
      </div>

      <div>
        <div className="sidebar-section-label">Menu</div>
        <nav className="sidebar-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => "sidebar-nav-item" + (isActive ? " active" : "")}
          >
            <IconSearch />
            Understand a Job
          </NavLink>
          <NavLink
            to="/applications"
            className={({ isActive }) => "sidebar-nav-item" + (isActive ? " active" : "")}
          >
            <IconBriefcase />
            Applications
          </NavLink>
        </nav>
      </div>

      {session && (
        <div className="sidebar-footer">
          <button type="button" className="btn btn-ghost" style={{ width: "100%" }} onClick={signOut}>
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
