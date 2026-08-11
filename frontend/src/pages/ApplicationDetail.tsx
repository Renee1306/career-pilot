import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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

  if (error) return <p role="alert">{error}</p>;
  if (!application) return <p>Loading...</p>;

  return (
    <div>
      <h1>{job ? [job.title, job.company].filter(Boolean).join(" @ ") || "Application" : "Application"}</h1>

      <section>
        <h2>Status</h2>
        <select value={application.status} onChange={(e) => handleStatusChange(e.target.value as ApplicationStatus)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </section>

      <section>
        <h2>Position</h2>
        {job ? (
          <div>
            <p>
              {job.title ?? "Untitled"} {job.company ? `at ${job.company}` : ""}
            </p>
            <details>
              <summary>Full job description</summary>
              <p style={{ whiteSpace: "pre-wrap" }}>{job.raw_text}</p>
            </details>
          </div>
        ) : (
          <p>No job description linked.</p>
        )}
        {resume && <p>Resume used: {resume.label ?? resume.id}</p>}
      </section>

      <section>
        <h2>Timeline</h2>
        {application.timeline.length === 0 ? (
          <p>No timeline entries yet.</p>
        ) : (
          <ul>
            {application.timeline.map((entry, i) => (
              <li key={i}>
                {new Date(entry.date).toLocaleString()} - {entry.note}
              </li>
            ))}
          </ul>
        )}
        <input
          placeholder="e.g. Called HR, phone screen scheduled for next Tuesday"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button type="button" onClick={handleAddNote} disabled={addingNote || !note.trim()}>
          {addingNote ? "Adding..." : "Add note"}
        </button>
      </section>

      <section>
        <h2>Interview Prep</h2>
        <button disabled>Generate interview questions</button>
        <p>Coming soon.</p>
      </section>
    </div>
  );
}
