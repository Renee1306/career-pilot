import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createApplication,
  listApplications,
  listJobDescriptions,
  listResumes,
  updateApplication,
  type ApplicationOut,
  type ApplicationStatus,
  type JobDescriptionOut,
  type ResumeOut,
} from "../lib/api";

const COLUMNS: { status: ApplicationStatus; label: string }[] = [
  { status: "applied", label: "Applied" },
  { status: "pending_interview", label: "Pending Interview" },
  { status: "offer", label: "Offer" },
  { status: "rejected", label: "Rejected" },
];

function jobLabel(job: JobDescriptionOut | undefined): string {
  if (!job) return "Unknown job";
  if (job.title || job.company) return [job.title, job.company].filter(Boolean).join(" @ ");
  return job.raw_text.slice(0, 60) + (job.raw_text.length > 60 ? "..." : "");
}

export default function Applications() {
  const [applications, setApplications] = useState<ApplicationOut[]>([]);
  const [jobs, setJobs] = useState<JobDescriptionOut[]>([]);
  const [resumes, setResumes] = useState<ResumeOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [jobId, setJobId] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [creating, setCreating] = useState(false);

  const loadAll = () => {
    Promise.all([listApplications(), listJobDescriptions(), listResumes()])
      .then(([apps, jobList, resumeList]) => {
        setApplications(apps);
        setJobs(jobList);
        setResumes(resumeList);
        if (jobList.length > 0 && !jobId) setJobId(jobList[0].id);
      })
      .catch(() => setError("Failed to load applications"));
  };

  useEffect(loadAll, []);

  const handleCreate = async () => {
    if (!jobId) return;
    setError(null);
    setCreating(true);
    try {
      await createApplication({ job_description_id: jobId, resume_id: resumeId || undefined });
      loadAll();
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

  const jobById = (id: string | null) => jobs.find((j) => j.id === id);
  const resumeById = (id: string | null) => resumes.find((r) => r.id === id);

  return (
    <div>
      <div className="page-header">
        <h1>Applications</h1>
      </div>

      {jobs.length === 0 ? (
        <p className="muted">
          No saved job descriptions yet. <Link to="/">Analyze a job</Link> first, then track it here.
        </p>
      ) : (
        <div className="card">
          <h2>Track a new application</h2>
          <div className="form-row">
            <select className="input" style={{ width: 320 }} value={jobId} onChange={(e) => setJobId(e.target.value)}>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {jobLabel(job)}
                </option>
              ))}
            </select>
            <select className="input" style={{ width: 200 }} value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
              <option value="">No resume</option>
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.label ?? resume.id}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={creating || !jobId}>
              {creating ? "Adding..." : "Add application"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="alert" style={{ marginTop: 12 }}>{error}</p>}

      <div className="board" style={{ marginTop: 20 }}>
        {COLUMNS.map((col) => {
          const colApps = applications.filter((app) => app.status === col.status);
          return (
            <div key={col.status} className="board-column">
              <div className="board-column-title">
                {col.label} ({colApps.length})
              </div>
              {colApps.map((app) => (
                <div key={app.id} className="board-card">
                  <Link className="board-card-title" to={`/applications/${app.id}`}>
                    {jobLabel(jobById(app.job_description_id))}
                  </Link>
                  {app.resume_id && (
                    <span className="board-card-meta">Resume: {resumeById(app.resume_id)?.label ?? app.resume_id}</span>
                  )}
                  <select
                    className="input"
                    value={app.status}
                    onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                  >
                    {COLUMNS.map((c) => (
                      <option key={c.status} value={c.status}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
