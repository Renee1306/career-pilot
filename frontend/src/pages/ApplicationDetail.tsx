import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import InterviewRounds from "../components/InterviewRounds";
import {
  addTimelineEntry,
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

  const [note, setNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

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

  const handleAddNote = async () => {
    if (!applicationId || !note.trim()) return;
    setError(null);
    setAddingNote(true);
    try {
      const updated = await addTimelineEntry(applicationId, note.trim());
      setApplication(updated);
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setAddingNote(false);
    }
  };

  if (error) return <p className="alert">{error}</p>;
  if (!application) return <p className="muted">Loading...</p>;

  return (
    <div>
      <div className="page-header">
        <h1>{job ? [job.title, job.company].filter(Boolean).join(" @ ") || "Application" : "Application"}</h1>
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

      <div className="card">
        <h2>Position</h2>
        {job ? (
          <div>
            <p>
              {job.title ?? "Untitled"} {job.company ? `at ${job.company}` : ""}
            </p>
            <details>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>Full job description</summary>
              <p style={{ whiteSpace: "pre-wrap", marginTop: 10 }}>{job.raw_text}</p>
            </details>
          </div>
        ) : (
          <p className="muted">No job description linked.</p>
        )}
        {resume && <p className="muted">Resume used: {resume.label ?? resume.id}</p>}
      </div>

      <div className="card">
        <h2>Timeline</h2>
        {application.timeline.length === 0 ? (
          <p className="muted">No timeline entries yet.</p>
        ) : (
          <ul className="stack" style={{ listStyle: "none", padding: 0, marginBottom: 14 }}>
            {application.timeline.map((entry, i) => (
              <li key={i} className="subcard">
                <span className="muted">{new Date(entry.date).toLocaleString()}</span> — {entry.note}
              </li>
            ))}
          </ul>
        )}
        <div className="form-row">
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="e.g. Called HR, phone screen scheduled for next Tuesday"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button type="button" className="btn btn-primary" onClick={handleAddNote} disabled={addingNote || !note.trim()}>
            {addingNote ? "Adding..." : "Add note"}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Interview Prep</h2>
        {(!job || !resume) && (
          <p className="muted" style={{ marginBottom: 12 }}>
            Link both a job description and a resume to this application to generate interview Q&amp;A.
          </p>
        )}
        <InterviewRounds applicationId={application.id} />
      </div>
    </div>
  );
}
