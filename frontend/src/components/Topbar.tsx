import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { IconBriefcase, IconCompass, IconDocument, IconGrid, IconSearch } from "./Icons";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: <IconGrid /> },
  { to: "/job-analysis", label: "Job Analysis", icon: <IconSearch /> },
  { to: "/applications", label: "Applications", icon: <IconBriefcase /> },
  { to: "/resume-builder", label: "Resume Builder", icon: <IconDocument /> },
];

export default function Topbar() {
  const { session, signOut } = useAuth();
  const email = session?.user.email ?? "";

  return (
    <header className="topbar">
      <Link to="/dashboard" className="topbar-logo brand">
        <span className="brand-mark">
          <IconCompass size={19} />
        </span>
        CareerPilot
      </Link>

      <nav className="topbar-nav">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => "topbar-nav-item" + (isActive ? " active" : "")}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {session && (
        <div className="topbar-actions">
          <span className="topbar-email muted" title={email}>
            {email}
          </span>
          <span className="avatar" aria-hidden="true">
            {email.charAt(0) || "?"}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
