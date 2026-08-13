import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ApplicationTimeline from "../components/ApplicationTimeline";
import CompanySnapshotCard from "../components/CompanySnapshotCard";
import InterviewQuestionsCard from "../components/InterviewQuestionsCard";
import {
  getApplication,
  getJobDescription,
  getResume,
  updateApplication,
  type ApplicationOut,
  type ApplicationStatus,
  type JobDescriptionOut,
  type ResumeOut,
} from "../lib/api";

const STATUSES: ApplicationStatus[] = ["applied", "pending_interview", "offer", "rejected"];

export default function ApplicationDetail() {
  const { applicationId } = useParams();

  const [application, setApplication] = useState<ApplicationOut | null>(null);
  const [job, setJob] = useState<JobDescriptionOut | null>(null);
  const [resume, setResume] = useState<ResumeOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sideTab, setSideTab] = useState<"snapshot" | "interview">("snapshot");
  const [editingHeader, setEditingHeader] = useState(false);
  const [companyDraft, setCompanyDraft] = useState("");
  const [positionDraft, setPositionDraft] = useState("");

  const load = () => {
    if (!applicationId) return;
    getApplication(applicationId)
      .then((app) => {
        setApplication(app);
        if (app.job_description_id) getJobDescription(app.job_description_id).then(setJob).catch(() => {});
        if (app.resume_id) getResume(app.resume_id).then(setResume).catch(() => {});
      })
      .catch(() => setError("Failed to load application"));
  };

  useEffect(load, [applicationId]);

  const handleStatusChange = async (status: ApplicationStatus) => {
    if (!applicationId) return;
    setError(null);
    try {
      const updated = await updateApplication(applicationId, { status });
      setApplication(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const displayCompany = application?.company || job?.company || null;
  const displayPosition = application?.position || job?.title || null;

  const startEditingHeader = () => {
    setCompanyDraft(displayCompany ?? "");
    setPositionDraft(displayPosition ?? "");
    setEditingHeader(true);
  };

  const saveHeader = async () => {
    if (!applicationId) return;
    setError(null);
    try {
      const updated = await updateApplication(applicationId, {
        company: companyDraft.trim(),
        position: positionDraft.trim(),
      });
      setApplication(updated);
      setEditingHeader(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  if (error) return <p className="alert">{error}</p>;
  if (!application) return <p className="muted">Loading...</p>;

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="form-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="form-row" style={{ alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "var(--radius-md)",
                background: "var(--color-primary)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              {(displayCompany || "?").charAt(0).toUpperCase()}
            </div>
            {editingHeader ? (
              <div className="stack" style={{ gap: 8 }}>
                <input
                  className="input"
                  style={{ fontWeight: 700 }}
                  placeholder="Company"
                  value={companyDraft}
                  onChange={(e) => setCompanyDraft(e.target.value)}
                  autoFocus
                />
                <input
                  className="input"
                  placeholder="Position"
                  value={positionDraft}
                  onChange={(e) => setPositionDraft(e.target.value)}
                />
                <div className="form-row">
                  <button type="button" className="btn btn-primary btn-sm" onClick={saveHeader}>
                    Save
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingHeader(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div onClick={startEditingHeader} style={{ cursor: "pointer" }}>
                <h1 style={{ margin: 0 }}>{displayCompany || "Add company name"}</h1>
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  {displayPosition || "Add position"}
                  {application.applied_date && ` · Applied ${new Date(application.applied_date).toLocaleDateString()}`}
                </p>
              </div>
            )}
          </div>
          <select
            className="input"
            style={{ width: 200 }}
            value={application.status}
            onChange={(e) => handleStatusChange(e.target.value as ApplicationStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {job && (
        <div className="card">
          <h2>Position</h2>
          <p>
            {job.title ?? "Untitled"} {job.company ? `at ${job.company}` : ""}
          </p>
          <details>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Full job description</summary>
            <p style={{ whiteSpace: "pre-wrap", marginTop: 10 }}>{job.raw_text}</p>
          </details>
          {resume && <p className="muted">Resume used: {resume.label ?? resume.id}</p>}
        </div>
      )}

      <div className="form-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 20, marginTop: 20 }}>
        <div style={{ flex: "1 1 420px", minWidth: 0 }}>
          <div className="card">
            <h2>Application Timeline</h2>
            <ApplicationTimeline
              applicationId={application.id}
              entries={application.timeline}
              onChanged={setApplication}
            />
          </div>
        </div>
        <div style={{ flex: "1 1 420px", minWidth: 0 }}>
          <div className="card">
            <div className="tabs">
              <button
                type="button"
                className={"tab-button" + (sideTab === "snapshot" ? " active" : "")}
                onClick={() => setSideTab("snapshot")}
              >
                Company Snapshot
              </button>
              <button
                type="button"
                className={"tab-button" + (sideTab === "interview" ? " active" : "")}
                onClick={() => setSideTab("interview")}
              >
                Interview Questions
              </button>
            </div>
            <div style={{ marginTop: 16 }}>
              {sideTab === "snapshot" ? (
                <CompanySnapshotCard application={application} onUpdated={setApplication} />
              ) : (
                <InterviewQuestionsCard application={application} job={job} onUpdated={setApplication} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
