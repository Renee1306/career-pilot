import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconBriefcase,
  IconCalendar,
  IconDocument,
  IconPlus,
  IconSearch,
  IconSparkle,
  IconTrophy,
} from "../components/Icons";
import { useAuth } from "../context/AuthContext";
import {
  listApplications,
  listResumeDocuments,
  type ApplicationOut,
  type ApplicationStatus,
  type ResumeDocumentListItem,
  type TimelineEntryOut,
} from "../lib/api";

const STATUS_META: Record<ApplicationStatus, { label: string; badge: string }> = {
  applied: { label: "Applied", badge: "badge-info" },
  pending_interview: { label: "Interview", badge: "badge-warning" },
  offer: { label: "Offer", badge: "badge-success" },
  rejected: { label: "Rejected", badge: "badge-danger" },
};

interface UpcomingInterview {
  applicationId: string;
  company: string;
  entry: TimelineEntryOut;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function displayName(email: string | undefined): string {
  if (!email) return "there";
  const handle = email.split("@")[0]?.replace(/[._-]+/g, " ") ?? "there";
  return handle.charAt(0).toUpperCase() + handle.slice(1);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Dashboard() {
  const { session } = useAuth();
  const [applications, setApplications] = useState<ApplicationOut[]>([]);
  const [resumeDocs, setResumeDocs] = useState<ResumeDocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listApplications(), listResumeDocuments()])
      .then(([apps, docs]) => {
        if (cancelled) return;
        setApplications(apps);
        setResumeDocs(docs);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your dashboard. Check that the API is running.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const byStatus: Record<ApplicationStatus, number> = {
      applied: 0,
      pending_interview: 0,
      offer: 0,
      rejected: 0,
    };
    applications.forEach((app) => {
      byStatus[app.status] += 1;
    });
    return byStatus;
  }, [applications]);

  const recent = useMemo(
    () =>
      [...applications]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 6),
    [applications]
  );

  /** Interview timeline entries dated from today onward, soonest first. The board itself
   *  never surfaces these - they're only visible inside an application's own timeline. */
  const upcoming = useMemo<UpcomingInterview[]>(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return applications
      .flatMap((app) =>
        (app.timeline ?? [])
          .filter((entry) => entry.entry_type === "interview")
          .filter((entry) => new Date(entry.occurred_at).getTime() >= startOfToday.getTime())
          .map((entry) => ({
            applicationId: app.id,
            company: app.company || "Untitled application",
            entry,
          }))
      )
      .sort(
        (a, b) =>
          new Date(a.entry.occurred_at).getTime() - new Date(b.entry.occurred_at).getTime()
      )
      .slice(0, 4);
  }, [applications]);

  const total = applications.length;
  const decided = counts.offer + counts.rejected;
  const responseRate = total ? Math.round(((counts.pending_interview + counts.offer) / total) * 100) : 0;

  if (loading) {
    return <div className="spinner spinner-page" role="status" aria-label="Loading dashboard" />;
  }

  return (
    <div>
      <section className="dash-hero">
        <div className="dash-hero-copy">
          <span className="eyebrow eyebrow-on-dark">
            <IconSparkle size={13} /> Your copilot
          </span>
          <h1>
            {greeting()}, {displayName(session?.user.email)}
          </h1>
          <p>
            {total === 0
              ? "Nothing tracked yet. Start by decoding a job description — the rest of the flow follows from there."
              : `${total} application${total === 1 ? "" : "s"} tracked · ${counts.pending_interview} in interview · ${counts.offer} offer${counts.offer === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="dash-hero-actions">
          <Link to="/job-analysis" className="btn btn-accent">
            <IconSearch size={16} /> Analyze a job
          </Link>
          <Link to="/resume-builder" className="btn btn-ghost-light">
            <IconPlus size={16} /> New resume
          </Link>
        </div>
      </section>

      {error && (
        <p className="alert" style={{ marginTop: 16 }}>
          {error}
        </p>
      )}

      <section className="stat-grid">
        <div className="stat-tile">
          <div className="stat-tile-head">
            <span className="stat-tile-label">Applications</span>
            <span className="stat-tile-icon">
              <IconBriefcase size={16} />
            </span>
          </div>
          <div className="stat-tile-tally">
            <span className="stat-tile-value">{total}</span>
            <span className="stat-tile-note">{decided} closed out</span>
          </div>
        </div>

        <div className="stat-tile">
          <div className="stat-tile-head">
            <span className="stat-tile-label">In interview</span>
            <span className="stat-tile-icon stat-tile-icon-accent">
              <IconCalendar size={16} />
            </span>
          </div>
          <div className="stat-tile-tally">
            <span className="stat-tile-value">{counts.pending_interview}</span>
            <span className="stat-tile-note">
              {upcoming.length ? `${upcoming.length} scheduled ahead` : "Nothing scheduled yet"}
            </span>
          </div>
        </div>

        <div className="stat-tile">
          <div className="stat-tile-head">
            <span className="stat-tile-label">Offers</span>
            <span className="stat-tile-icon stat-tile-icon-success">
              <IconTrophy size={16} />
            </span>
          </div>
          <div className="stat-tile-tally">
            <span className="stat-tile-value">{counts.offer}</span>
            <span className="stat-tile-note">{responseRate}% moved past applied</span>
          </div>
        </div>

        <div className="stat-tile">
          <div className="stat-tile-head">
            <span className="stat-tile-label">Resumes</span>
            <span className="stat-tile-icon stat-tile-icon-info">
              <IconDocument size={16} />
            </span>
          </div>
          <div className="stat-tile-tally">
            <span className="stat-tile-value">{resumeDocs.length}</span>
            <span className="stat-tile-note">In your resume library</span>
          </div>
        </div>
      </section>

      <div className="dash-columns">
        <div>
          <div className="card">
            <div className="card-head">
              <h2>Recent activity</h2>
              <Link to="/applications" className="link-button">
                View board
              </Link>
            </div>

            {recent.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">
                  <IconBriefcase size={22} />
                </span>
                <p style={{ margin: 0 }}>No applications tracked yet.</p>
                <Link to="/applications" className="btn btn-secondary btn-sm">
                  Track your first one
                </Link>
              </div>
            ) : (
              recent.map((app) => (
                <div className="list-row" key={app.id}>
                  <div className="list-row-main">
                    <Link className="list-row-title" to={`/applications/${app.id}`}>
                      {app.company || "Untitled application"}
                    </Link>
                    <div className="list-row-sub">
                      {app.position || "No position set"} · updated {formatDate(app.updated_at)}
                    </div>
                  </div>
                  <span className={`badge ${STATUS_META[app.status].badge}`}>
                    {STATUS_META[app.status].label}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-head">
              <h2>Your resumes</h2>
              {resumeDocs.length > 0 && (
                <Link to="/resume-builder" className="link-button">
                  All
                </Link>
              )}
            </div>

            {resumeDocs.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">
                  <IconDocument size={22} />
                </span>
                <p style={{ margin: 0 }}>No resumes yet.</p>
                <Link to="/resume-builder" className="btn btn-secondary btn-sm">
                  Build your first one
                </Link>
              </div>
            ) : (
              resumeDocs.slice(0, 4).map((doc) => (
                <div className="list-row" key={doc.id}>
                  <div className="list-row-main">
                    <Link className="list-row-title" to={`/resume-builder/${doc.id}`}>
                      {doc.name}
                    </Link>
                    <div className="list-row-sub">Updated {formatDate(doc.updated_at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
