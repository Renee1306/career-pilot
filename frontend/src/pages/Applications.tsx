import { useEffect, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import GmailSync from "../components/GmailSync";
import IconPopover from "../components/IconPopover";
import {
  createApplication,
  deleteApplication,
  listApplications,
  listJobDescriptions,
  listResumeDocuments,
  updateApplication,
  type ApplicationOut,
  type ApplicationStatus,
  type JobDescriptionOut,
  type ResumeDocumentListItem,
} from "../lib/api";

const COLUMNS: { status: ApplicationStatus; label: string }[] = [
  { status: "applied", label: "Applied" },
  { status: "pending_interview", label: "Pending Interview" },
  { status: "offer", label: "Offer" },
  { status: "rejected", label: "Rejected" },
];

function IconPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function cardCompany(app: ApplicationOut, job: JobDescriptionOut | undefined): string {
  return app.company || job?.company || "Unknown company";
}

function cardPosition(app: ApplicationOut, job: JobDescriptionOut | undefined): string | null {
  return app.position || job?.title || null;
}

function formatUpdatedDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function Applications() {
  const [applications, setApplications] = useState<ApplicationOut[]>([]);
  const [jobs, setJobs] = useState<JobDescriptionOut[]>([]);
  const [resumeDocs, setResumeDocs] = useState<ResumeDocumentListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Only the very first load blanks the board. Later reloads (after a drag, a delete, a Gmail
  // sync) keep the existing cards on screen, because swapping a populated board for a spinner
  // on every small change reads as the page breaking rather than as progress.
  const [loading, setLoading] = useState(true);

  const [companyDraft, setCompanyDraft] = useState("");
  const [positionDraft, setPositionDraft] = useState("");
  const [resumeDocumentId, setResumeDocumentId] = useState("");
  const [creating, setCreating] = useState(false);
  const [dragOverStatus, setDragOverStatus] = useState<ApplicationStatus | null>(null);

  const loadAll = () => {
    Promise.all([listApplications(), listJobDescriptions(), listResumeDocuments()])
      .then(([apps, jobList, docList]) => {
        setApplications(apps);
        setJobs(jobList);
        setResumeDocs(docList);
        setError(null);
      })
      .catch(() => setError("Failed to load applications"))
      .finally(() => setLoading(false));
  };

  useEffect(loadAll, []);

  const handleCreate = async (close: () => void) => {
    if (!companyDraft.trim()) return;
    setError(null);
    setCreating(true);
    try {
      await createApplication({
        company: companyDraft.trim(),
        position: positionDraft.trim() || undefined,
        resume_document_id: resumeDocumentId || undefined,
      });
      setCompanyDraft("");
      setPositionDraft("");
      setResumeDocumentId("");
      loadAll();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create application");
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (applicationId: string, status: ApplicationStatus) => {
    setError(null);
    try {
      await updateApplication(applicationId, { status });
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleDelete = async (app: ApplicationOut, job: JobDescriptionOut | undefined) => {
    if (!window.confirm(`Remove ${cardCompany(app, job)} from your applications? This can't be undone.`)) return;
    setError(null);
    try {
      await deleteApplication(app.id);
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete application");
    }
  };

  const handleDrop = (status: ApplicationStatus) => (e: DragEvent) => {
    e.preventDefault();
    setDragOverStatus(null);
    const applicationId = e.dataTransfer.getData("text/plain");
    const app = applications.find((a) => a.id === applicationId);
    if (!app || app.status === status) return;
    handleStatusChange(applicationId, status);
  };

  const jobById = (id: string | null) => jobs.find((j) => j.id === id);
  const resumeDocById = (id: string | null) => resumeDocs.find((r) => r.id === id);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Applications</h1>
          <p className="muted">Drag a card between columns to update where it stands.</p>
        </div>
        <div className="applications-actions">
          <GmailSync onApplicationsChanged={loadAll} />
          <IconPopover icon={<IconPlus />} title="Track a new application">
            {(close) => (
              <div>
                <div className="section-title">Track a new application</div>
                <div className="field">
                  <label htmlFor="track-company">Company</label>
                  <input
                    id="track-company"
                    className="input"
                    value={companyDraft}
                    onChange={(e) => setCompanyDraft(e.target.value)}
                    placeholder="Company name"
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label htmlFor="track-position">Position</label>
                  <input
                    id="track-position"
                    className="input"
                    value={positionDraft}
                    onChange={(e) => setPositionDraft(e.target.value)}
                    placeholder="Position (optional)"
                  />
                </div>
                <div className="field">
                  <label htmlFor="track-resume">Resume</label>
                  <select
                    id="track-resume"
                    className="input"
                    value={resumeDocumentId}
                    onChange={(e) => setResumeDocumentId(e.target.value)}
                  >
                    <option value="">No resume</option>
                    {resumeDocs.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleCreate(close)}
                  disabled={creating || !companyDraft.trim()}
                >
                  {creating ? "Adding..." : "Add application"}
                </button>
              </div>
            )}
          </IconPopover>
        </div>
      </div>

      {error && <p className="alert" style={{ marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <div className="board">
          {COLUMNS.map((col) => (
            <div key={col.status} className="board-column">
              <div className="board-column-title">
                <span className={`board-column-dot board-column-dot-${col.status}`} />
                {col.label}
              </div>
              <div className="board-card-skeleton" />
              <div className="board-card-skeleton" />
            </div>
          ))}
        </div>
      ) : (
      <div className="board">
        {COLUMNS.map((col) => {
          const colApps = applications.filter((app) => app.status === col.status);
          return (
            <div
              key={col.status}
              className={`board-column${dragOverStatus === col.status ? " board-column-drag-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverStatus !== col.status) setDragOverStatus(col.status);
              }}
              onDragLeave={() => setDragOverStatus((prev) => (prev === col.status ? null : prev))}
              onDrop={handleDrop(col.status)}
            >
              <div className="board-column-title">
                <span className={`board-column-dot board-column-dot-${col.status}`} />
                {col.label}
                <span className="board-column-count">{colApps.length}</span>
              </div>
              {colApps.length === 0 && <div className="board-empty">Drop a card here</div>}
              {colApps.map((app) => {
                const job = jobById(app.job_description_id);
                const position = cardPosition(app, job);
                return (
                  <div
                    key={app.id}
                    className="board-card"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", app.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                  >
                    <button
                      type="button"
                      className="board-card-delete"
                      title="Remove application"
                      aria-label="Remove application"
                      onClick={() => handleDelete(app, job)}
                    >
                      &minus;
                    </button>
                    <Link className="board-card-company" to={`/applications/${app.id}`}>
                      {cardCompany(app, job)}
                    </Link>
                    {position && <div className="board-card-position">{position}</div>}
                    {app.resume_document_id && (
                      <span className="board-card-meta">
                        Resume: {resumeDocById(app.resume_document_id)?.name ?? app.resume_document_id}
                      </span>
                    )}
                    <div className="board-card-updated">Updated {formatUpdatedDate(app.updated_at)}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
