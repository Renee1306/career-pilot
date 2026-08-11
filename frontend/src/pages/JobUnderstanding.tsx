import { useState, type ChangeEvent, type FormEvent } from "react";
import JobExplanationTab from "../components/JobExplanationTab";
import ResumeMatchTab from "../components/ResumeMatchTab";
import TypicalDayTab from "../components/TypicalDayTab";
import {
  createJobDescription,
  uploadResume,
  type JobDescriptionOut,
  type JobExplanation,
  type ResumeMatch,
  type ResumeOut,
  type TypicalDay,
} from "../lib/api";

type Tab = "explanation" | "typical_day" | "resume_match";

export default function JobUnderstanding() {
  const [tab, setTab] = useState<Tab>("explanation");

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resume, setResume] = useState<ResumeOut | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [jdText, setJdText] = useState("");
  const [jobDescription, setJobDescription] = useState<JobDescriptionOut | null>(null);
  const [jdError, setJdError] = useState<string | null>(null);
  const [savingJd, setSavingJd] = useState(false);

  const [explanation, setExplanation] = useState<JobExplanation | null>(null);
  const [translations, setTranslations] = useState<Record<string, JobExplanation>>({});
  const [typicalDay, setTypicalDay] = useState<TypicalDay | null>(null);
  const [match, setMatch] = useState<ResumeMatch | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setResumeFile(event.target.files?.[0] ?? null);
  };

  const handleResumeUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!resumeFile) return;
    setResumeError(null);
    setUploading(true);
    try {
      const result = await uploadResume(resumeFile, resumeFile.name);
      setResume(result);
    } catch (err) {
      setResumeError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleJdSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!jdText.trim()) return;
    setJdError(null);
    setSavingJd(true);
    try {
      const result = await createJobDescription({ raw_text: jdText });
      setJobDescription(result);
      setExplanation(null);
      setTranslations({});
      setTypicalDay(null);
      setMatch(null);
    } catch (err) {
      setJdError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingJd(false);
    }
  };

  return (
    <div>
      <h1>Understand a Job</h1>
      <p>Upload a resume and job description to get started.</p>

      <section>
        <h2>Resume</h2>
        <form onSubmit={handleResumeUpload}>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={handleFileChange} />
          <button type="submit" disabled={!resumeFile || uploading}>
            {uploading ? "Uploading..." : "Upload resume"}
          </button>
        </form>
        {resumeError && <p role="alert">{resumeError}</p>}
        {resume && (
          <div>
            <p>Parsed: {(resume.parsed_json?.full_name as string) ?? resume.label}</p>
            <ul>
              {((resume.parsed_json?.skills as string[]) ?? []).map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2>Job Description</h2>
        <form onSubmit={handleJdSave}>
          <textarea
            rows={8}
            style={{ width: "100%" }}
            placeholder="Paste the job description here"
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
          />
          <button type="submit" disabled={!jdText.trim() || savingJd}>
            {savingJd ? "Saving..." : "Save job description"}
          </button>
        </form>
        {jdError && <p role="alert">{jdError}</p>}
        {jobDescription && <p>Saved job description ({jobDescription.raw_text.length} chars).</p>}
      </section>

      {jobDescription ? (
        <>
          <nav>
            <button onClick={() => setTab("explanation")} disabled={tab === "explanation"}>
              Job Explanation
            </button>
            <button onClick={() => setTab("typical_day")} disabled={tab === "typical_day"}>
              Typical Day
            </button>
            <button onClick={() => setTab("resume_match")} disabled={tab === "resume_match"}>
              Resume Match
            </button>
          </nav>

          {tab === "explanation" && (
            <JobExplanationTab
              jobId={jobDescription.id}
              explanation={explanation}
              translations={translations}
              onUpdated={(newExplanation, newTranslations) => {
                setExplanation(newExplanation);
                setTranslations(newTranslations);
              }}
            />
          )}
          {tab === "typical_day" && (
            <TypicalDayTab jobId={jobDescription.id} typicalDay={typicalDay} onUpdated={setTypicalDay} />
          )}
          {tab === "resume_match" && (
            <ResumeMatchTab jobId={jobDescription.id} match={match} onUpdated={setMatch} />
          )}
        </>
      ) : (
        <p>Save a job description above to unlock these tabs.</p>
      )}
    </div>
  );
}
