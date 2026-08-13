import { useEffect, useState } from "react";
import {
  generateInterviewQuestions,
  listJobDescriptions,
  type ApplicationOut,
  type InterviewRoundType,
  type JobDescriptionOut,
} from "../lib/api";

const ROUND_LABELS: Record<InterviewRoundType, string> = {
  hr: "HR / recruiter screen",
  technical: "Technical round",
};

/** Job Analysis only ever saves `raw_text` - `title`/`company` are almost always null in
 *  practice, so a dropdown built on those alone reads as a wall of "Untitled role". Fall back to
 *  a snippet of the pasted text plus the save date, which is always distinguishing. */
function jobOptionLabel(job: JobDescriptionOut): string {
  const date = new Date(job.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (job.title) {
    return job.company ? `${job.company} — ${job.title}` : job.title;
  }
  const snippet = job.raw_text.trim().replace(/\s+/g, " ").slice(0, 60);
  return `${date} — ${snippet}${job.raw_text.length > 60 ? "..." : ""}`;
}

export default function InterviewQuestionsCard({
  application,
  job,
  onUpdated,
}: {
  application: ApplicationOut;
  job: JobDescriptionOut | null;
  onUpdated: (app: ApplicationOut) => void;
}) {
  // Prefilled from the application's linked JD when it has one, so an application created from
  // the Job Analysis page needs no pasting at all; Gmail-created ones (which never get a linked
  // job_description_id) start empty - the user either picks one they analyzed earlier or pastes.
  const [jdText, setJdText] = useState(job?.raw_text ?? "");
  const [savedJobs, setSavedJobs] = useState<JobDescriptionOut[]>([]);
  const [selectedJobId, setSelectedJobId] = useState(job?.id ?? "");
  const [round, setRound] = useState<InterviewRoundType>("hr");
  const [loading, setLoading] = useState<InterviewRoundType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listJobDescriptions()
      .then(setSavedJobs)
      .catch(() => {});
  }, []);

  const generated = application.interview_questions ?? null;
  const current = generated?.[round];
  const canGenerate = jdText.trim().length > 0;

  const handlePickSaved = (jobId: string) => {
    setSelectedJobId(jobId);
    const picked = savedJobs.find((j) => j.id === jobId);
    if (picked) setJdText(picked.raw_text);
  };

  const handleGenerate = async (roundType: InterviewRoundType) => {
    if (!canGenerate) return;
    setLoading(roundType);
    setError(null);
    setRound(roundType);
    try {
      onUpdated(await generateInterviewQuestions(application.id, roundType, jdText));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate interview questions");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div>
      {savedJobs.length > 0 && (
        <div className="field">
          <label htmlFor="interview-saved-jd">Use a job description from Job Analysis</label>
          <select
            id="interview-saved-jd"
            className="input"
            value={selectedJobId}
            onChange={(e) => handlePickSaved(e.target.value)}
          >
            <option value="">Choose one...</option>
            {savedJobs.map((saved) => (
              <option key={saved.id} value={saved.id}>
                {jobOptionLabel(saved)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="field">
        <label htmlFor="interview-jd">
          {savedJobs.length > 0 ? "Or paste a job description" : "Job description"}
        </label>
        <textarea
          id="interview-jd"
          className="input"
          rows={6}
          value={jdText}
          onChange={(e) => {
            setJdText(e.target.value);
            setSelectedJobId("");
          }}
          placeholder="Paste the job description to ground the questions in the real role..."
        />
        <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
          {canGenerate
            ? "Questions and suggested answers will be grounded in this job description."
            : "Pick a saved job description or paste one — generating is disabled until there's a job description to ground it in."}
        </p>
      </div>

      <div className="form-row" style={{ gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => handleGenerate("hr")}
          disabled={loading !== null || !canGenerate}
          title={canGenerate ? undefined : "Add a job description first"}
        >
          {loading === "hr" ? "Generating..." : generated?.hr ? "Regenerate HR questions" : "Generate HR questions"}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => handleGenerate("technical")}
          disabled={loading !== null || !canGenerate}
          title={canGenerate ? undefined : "Add a job description first"}
        >
          {loading === "technical"
            ? "Generating..."
            : generated?.technical
              ? "Regenerate technical questions"
              : "Generate technical questions"}
        </button>
      </div>

      {error && (
        <p className="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}

      {generated && (generated.hr || generated.technical) && (
        <div className="tabs" style={{ marginTop: 18 }}>
          {(Object.keys(ROUND_LABELS) as InterviewRoundType[])
            .filter((key) => generated[key])
            .map((key) => (
              <button
                key={key}
                type="button"
                className={"tab-button" + (round === key ? " active" : "")}
                onClick={() => setRound(key)}
              >
                {ROUND_LABELS[key]}
              </button>
            ))}
        </div>
      )}

      {current ? (
        <ol style={{ marginTop: 16, paddingLeft: 20 }}>
          {current.questions.map((item, i) => (
            <li key={i} style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{item.question}</div>
              <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
                {item.suggested_answer}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        !loading && (
          <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
            {generated && Object.keys(generated).length > 0
              ? "Nothing generated for this round yet."
              : "Generate a set of likely questions with suggested answers, grounded in this role and your resume."}
          </p>
        )
      )}
    </div>
  );
}
