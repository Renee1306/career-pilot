import { useEffect, useState } from "react";
import {
  generateInterviewQuestions,
  jobOptionLabel,
  listJobDescriptions,
  listResumeDocuments,
  type ApplicationOut,
  type InterviewRoundType,
  type JobDescriptionOut,
  type ResumeDocumentListItem,
} from "../lib/api";

const ROUND_LABELS: Record<InterviewRoundType, string> = {
  behavioural: "Behavioural",
  hiring_manager: "Hiring manager",
};

const ROUND_BLURBS: Record<InterviewRoundType, string> = {
  behavioural:
    "How you've worked with people and handled real situations, tuned to what this company seems to value.",
  hiring_manager:
    "Whether you can do this specific job — your past work, the decisions you made, and how it maps to the role.",
};

const PRIORITY_LABELS: Record<"high" | "medium" | "lower", string> = {
  high: "High priority",
  medium: "Medium priority",
  lower: "Lower priority",
};

const QUESTIONS_PER_PAGE = 5;

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
  const [resumeDocs, setResumeDocs] = useState<ResumeDocumentListItem[]>([]);
  const [resumeDocId, setResumeDocId] = useState("");
  const [round, setRound] = useState<InterviewRoundType>("behavioural");
  const [loading, setLoading] = useState<InterviewRoundType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    listJobDescriptions()
      .then(setSavedJobs)
      .catch(() => {});
    listResumeDocuments()
      .then((docs) => {
        setResumeDocs(docs);
        // Prefer the resume already linked to this application - that's the one they actually
        // sent. Otherwise, if there's only one resume on file at all, preselecting it means the
        // common path is just "Generate".
        if (application.resume_document_id && docs.some((d) => d.id === application.resume_document_id)) {
          setResumeDocId(application.resume_document_id);
        } else if (docs.length === 1) {
          setResumeDocId(docs[0].id);
        }
      })
      .catch(() => {});
  }, [application.resume_document_id]);

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
    setPage(0);
    try {
      onUpdated(await generateInterviewQuestions(application.id, roundType, jdText, resumeDocId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate interview questions");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div>
      {resumeDocs.length > 0 && (
        <div className="field">
          <label htmlFor="interview-resume">Resume to prepare from</label>
          <select
            id="interview-resume"
            className="input"
            value={resumeDocId}
            onChange={(e) => setResumeDocId(e.target.value)}
          >
            <option value="">No resume</option>
            {resumeDocs.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.name}
              </option>
            ))}
          </select>
          <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
            Questions point back at real experience on this resume, so pick the one you actually
            sent.
          </p>
        </div>
      )}

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
        {!canGenerate && (
          <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
            Pick a saved job description or paste one — generating is disabled until there's a job
            description to ground it in.
          </p>
        )}
      </div>

      <div className="form-row" style={{ gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        {(Object.keys(ROUND_LABELS) as InterviewRoundType[]).map((key, i) => (
          <button
            key={key}
            type="button"
            className={`btn btn-sm ${i === 0 ? "btn-primary" : "btn-secondary"}`}
            onClick={() => handleGenerate(key)}
            disabled={loading !== null || !canGenerate}
            title={canGenerate ? ROUND_BLURBS[key] : "Add a job description first"}
          >
            {loading === key
              ? "Generating..."
              : `${generated?.[key] ? "Regenerate" : "Generate"} ${ROUND_LABELS[key].toLowerCase()} round`}
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
        Usually takes about 10 seconds.
      </p>

      {error && (
        <p className="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}

      {generated && (generated.behavioural || generated.hiring_manager) && (
        <div className="tabs" style={{ marginTop: 18 }}>
          {(Object.keys(ROUND_LABELS) as InterviewRoundType[])
            .filter((key) => generated[key])
            .map((key) => (
              <button
                key={key}
                type="button"
                className={"tab-button" + (round === key ? " active" : "")}
                onClick={() => {
                  setRound(key);
                  setPage(0);
                }}
              >
                {ROUND_LABELS[key]}
              </button>
            ))}
        </div>
      )}

      {current ? (
        <>
          <p className="muted" style={{ fontSize: 12, margin: "14px 0 0" }}>
            {ROUND_BLURBS[round]} These aren't scripts — prepare each one in your own words.
          </p>
          <ol className="qna-list" start={page * QUESTIONS_PER_PAGE + 1}>
            {current.questions.slice(page * QUESTIONS_PER_PAGE, page * QUESTIONS_PER_PAGE + QUESTIONS_PER_PAGE).map((item, i) => (
              <li key={page * QUESTIONS_PER_PAGE + i} className="qna-card">
                <div className="qna-question">
                  <span className="qna-question-number">{page * QUESTIONS_PER_PAGE + i + 1}</span>
                  <span>{item.question}</span>
                </div>
                {(item.category || item.priority) && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginLeft: 32, marginTop: 6 }}>
                    {item.category && <span className="badge badge-muted">{item.category}</span>}
                    {item.priority && (
                      <span className={`badge ${item.priority === "high" ? "badge-primary" : "badge-muted"}`}>
                        {PRIORITY_LABELS[item.priority]}
                      </span>
                    )}
                  </div>
                )}
                {item.answer_should_cover.length > 0 && (
                  <>
                    <div className="qna-label" style={{ marginLeft: 32, marginTop: 10 }}>
                      Your answer should cover
                    </div>
                    <ul className="qna-cover">
                      {item.answer_should_cover.map((point, j) => (
                        <li key={j}>{point}</li>
                      ))}
                    </ul>
                  </>
                )}
                {item.draw_on && (
                  <div className="qna-draw-on">
                    <span className="qna-label">Draw on</span>
                    <span className="qna-draw-on-text">{item.draw_on}</span>
                  </div>
                )}
              </li>
            ))}
          </ol>

          {current.questions.length > QUESTIONS_PER_PAGE && (
            <div className="form-row" style={{ justifyContent: "center", alignItems: "center", gap: 12, marginTop: 14 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                ← Previous
              </button>
              <span className="muted" style={{ fontSize: 12 }}>
                Page {page + 1} of {Math.ceil(current.questions.length / QUESTIONS_PER_PAGE)}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  setPage((p) =>
                    Math.min(Math.ceil(current.questions.length / QUESTIONS_PER_PAGE) - 1, p + 1)
                  )
                }
                disabled={page >= Math.ceil(current.questions.length / QUESTIONS_PER_PAGE) - 1}
              >
                Next →
              </button>
            </div>
          )}
        </>
      ) : (
        !loading && (
          <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
            {generated && Object.keys(generated).length > 0
              ? "Nothing generated for this round yet."
              : "Get the questions you're likely to be asked, plus what a strong answer needs to cover — grounded in this role and your resume."}
          </p>
        )
      )}
    </div>
  );
}
