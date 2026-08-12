import { useState } from "react";
import {
  generateInterviewQuestions,
  type ApplicationOut,
  type InterviewRoundType,
  type JobDescriptionOut,
} from "../lib/api";

const ROUND_LABELS: Record<InterviewRoundType, string> = {
  hr: "HR / recruiter screen",
  technical: "Technical round",
};

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
  // job_description_id) start empty and the user pastes.
  const [jdText, setJdText] = useState(job?.raw_text ?? "");
  const [round, setRound] = useState<InterviewRoundType>("hr");
  const [loading, setLoading] = useState<InterviewRoundType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generated = application.interview_questions ?? null;
  const current = generated?.[round];

  const handleGenerate = async (roundType: InterviewRoundType) => {
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
      <div className="field">
        <label htmlFor="interview-jd">Job description</label>
        <textarea
          id="interview-jd"
          className="input"
          rows={6}
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          placeholder={
            job
              ? "Using this application's saved job description — edit if you like."
              : "Paste the job description to ground the questions in the real role..."
          }
        />
        <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
          {job
            ? "Prefilled from this application's saved job description."
            : application.company
              ? `No saved job description — without one, questions are based only on ${application.company}${application.position ? ` / ${application.position}` : ""}.`
              : "No saved job description for this application."}
        </p>
      </div>

      <div className="form-row" style={{ gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => handleGenerate("hr")}
          disabled={loading !== null}
        >
          {loading === "hr" ? "Generating..." : generated?.hr ? "Regenerate HR questions" : "Generate HR questions"}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => handleGenerate("technical")}
          disabled={loading !== null}
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
