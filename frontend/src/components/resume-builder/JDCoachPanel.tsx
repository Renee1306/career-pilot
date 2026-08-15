import { useEffect, useRef, useState } from "react";
import {
  jobOptionLabel,
  listJobDescriptions,
  reviewResumeForJD,
  runGapTurn,
  type CoachMessage,
  type JDGap,
  type JDReview,
  type JobDescriptionOut,
  type ResumeHint,
} from "../../lib/api";

type Phase = "input" | "reviewing" | "review";

/** Per-gap conversation state. A gap is only ever in one of these:
 *  - "open"     - not started yet.
 *  - "asking"   - mid-interview; `history` holds the transcript.
 *  - "resolved" - the candidate confirmed it and hints were produced.
 *  - "declined" - the candidate doesn't have it. Nothing was written, and that is the point. */
interface GapState {
  status: "open" | "asking" | "resolved" | "declined";
  history: CoachMessage[];
  draft: string;
  busy: boolean;
}

const NEW_GAP: GapState = { status: "open", history: [], draft: "", busy: false };

export default function JDCoachPanel({
  documentId,
  hints,
  onHintsChange,
}: {
  documentId: string;
  hints: ResumeHint[];
  onHintsChange: (hints: ResumeHint[]) => void;
}) {
  const [phase, setPhase] = useState<Phase>("input");
  const [jdText, setJdText] = useState("");
  const [savedJobs, setSavedJobs] = useState<JobDescriptionOut[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [review, setReview] = useState<JDReview | null>(null);
  const [gapStates, setGapStates] = useState<Record<string, GapState>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listJobDescriptions()
      .then(setSavedJobs)
      .catch(() => {});
  }, []);

  const handlePickSaved = (jobId: string) => {
    setSelectedJobId(jobId);
    const picked = savedJobs.find((j) => j.id === jobId);
    if (picked) setJdText(picked.raw_text);
  };

  const gapState = (id: string) => gapStates[id] ?? NEW_GAP;
  const patchGap = (id: string, patch: Partial<GapState>) =>
    setGapStates((prev) => ({ ...prev, [id]: { ...(prev[id] ?? NEW_GAP), ...patch } }));

  const handleReview = async () => {
    if (!jdText.trim()) return;
    setPhase("reviewing");
    setError(null);
    try {
      const result = await reviewResumeForJD(documentId, jdText);
      setReview(result);
      setGapStates({});
      onHintsChange(result.hints);
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to review this resume");
      setPhase("input");
    }
  };

  // One turn of a gap interview. The whole transcript goes up each time rather than being kept
  // server-side: the backend stays stateless, and the user can abandon a gap without leaving a
  // half-finished session behind.
  const sendGapTurn = async (gap: JDGap, answer: string | null) => {
    if (!review) return;
    const state = gapState(gap.id);
    const history = answer === null ? state.history : [...state.history, { role: "user" as const, content: answer }];

    patchGap(gap.id, { status: "asking", history, draft: "", busy: true });
    setError(null);
    try {
      const turn = await runGapTurn(documentId, {
        jd_text: jdText,
        gap,
        strengths: review.strengths,
        history,
      });
      const withReply = [...history, { role: "assistant" as const, content: turn.message }];

      if (turn.status === "ready") {
        // Hints are only ever *offered* here - they land on the preview for the user to accept
        // or dismiss one at a time, and nothing touches the resume until they do.
        onHintsChange([...hints, ...turn.hints]);
        patchGap(gap.id, { status: "resolved", history: withReply, busy: false });
      } else if (turn.status === "declined") {
        patchGap(gap.id, { status: "declined", history: withReply, busy: false });
      } else {
        patchGap(gap.id, { status: "asking", history: withReply, busy: false });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to continue that conversation");
      patchGap(gap.id, { busy: false });
    }
  };

  const startOver = () => {
    setPhase("input");
    setReview(null);
    setGapStates({});
    setSelectedJobId("");
    onHintsChange([]);
  };

  const pendingReframes = hints.filter((h) => h.source === "reframe").length;

  return (
    <div className="jdc-panel">
      {error && <p className="alert jdc-alert">{error}</p>}

      {phase !== "review" && (
        <>
          <p className="jdc-intro">
            Paste the job description you're targeting. I'll check this resume against it, point out
            wording worth changing, and ask you about anything it's missing — nothing gets written
            unless you say you actually have the experience.
          </p>

          {savedJobs.length > 0 && (
            <div className="field">
              <label htmlFor="jdc-saved-jd">Use a job description from Job Analysis</label>
              <select
                id="jdc-saved-jd"
                className="input"
                value={selectedJobId}
                onChange={(e) => handlePickSaved(e.target.value)}
                disabled={phase === "reviewing"}
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

          <label htmlFor="jdc-jd-text" className="muted" style={{ fontSize: 12.5, display: "block", marginBottom: 4 }}>
            {savedJobs.length > 0 ? "Or paste a job description" : "Job description"}
          </label>
          <textarea
            id="jdc-jd-text"
            className="input"
            rows={10}
            value={jdText}
            onChange={(e) => {
              setJdText(e.target.value);
              setSelectedJobId("");
            }}
            placeholder="Paste the job description here..."
            disabled={phase === "reviewing"}
          />
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 10 }}
            onClick={handleReview}
            disabled={phase === "reviewing" || !jdText.trim()}
          >
            {phase === "reviewing" ? "Reading the JD..." : "Check my match"}
          </button>
          <p className="muted" style={{ fontSize: 11.5, marginTop: 6, textAlign: "center" }}>
            Usually takes about 45 seconds - it reads the whole resume against the JD.
          </p>
        </>
      )}

      {phase === "review" && review && (
        <>
          <div className="jdc-score-row">
            <div className="jdc-score">{review.match_score}%</div>
            <div style={{ flex: 1 }}>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${review.match_score}%` }} />
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Match against this JD
              </div>
            </div>
          </div>

          <div className="section-title">Strengths</div>
          {review.strengths.length === 0 ? (
            <p className="muted jdc-empty">Nothing on this resume lines up with the JD yet.</p>
          ) : (
            <ul className="jdc-list">
              {review.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}

          {pendingReframes > 0 && (
            <p className="jdc-hint-note">
              {pendingReframes} highlighted {pendingReframes === 1 ? "line" : "lines"} on the preview —
              click any of them to see the change and accept or dismiss it.
            </p>
          )}

          <div className="section-title" style={{ marginTop: 18 }}>
            Gaps
          </div>
          {review.gaps.length === 0 ? (
            <p className="muted jdc-empty">
              Nothing material is missing — this resume already covers what the JD asks for.
            </p>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {review.gaps.map((gap) => (
                <GapCard
                  key={gap.id}
                  gap={gap}
                  state={gapState(gap.id)}
                  onStart={() => sendGapTurn(gap, null)}
                  onAnswer={(answer) => sendGapTurn(gap, answer)}
                  onDraftChange={(draft) => patchGap(gap.id, { draft })}
                />
              ))}
            </div>
          )}

          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 16 }} onClick={startOver}>
            ← Use a different JD
          </button>
        </>
      )}
    </div>
  );
}

function GapCard({
  gap,
  state,
  onStart,
  onAnswer,
  onDraftChange,
}: {
  gap: JDGap;
  state: GapState;
  onStart: () => void;
  onAnswer: (answer: string) => void;
  onDraftChange: (draft: string) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [state.history.length, state.busy]);

  const submit = () => {
    const answer = state.draft.trim();
    if (answer && !state.busy) onAnswer(answer);
  };

  return (
    <div className="subcard jdc-gap">
      <div className="jdc-gap-title">
        {gap.title}
        {state.status === "resolved" && <span className="badge jdc-badge-ok">Added</span>}
        {state.status === "declined" && <span className="badge">Left off</span>}
      </div>
      <p className="jdc-gap-detail">{gap.detail}</p>

      {state.status === "open" && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onStart}>
          Do I have this?
        </button>
      )}

      {state.history.length > 0 && (
        <div className="jdc-thread">
          {state.history.map((message, i) => (
            <div key={i} className={message.role === "user" ? "jdc-msg-user" : "jdc-msg-bot"}>
              {message.content}
            </div>
          ))}
          {state.busy && <div className="jdc-msg-bot jdc-msg-typing">Thinking…</div>}
          <div ref={endRef} />
        </div>
      )}

      {state.status === "asking" && (
        <div className="jdc-composer">
          <textarea
            className="input"
            rows={2}
            value={state.draft}
            placeholder="Your answer..."
            disabled={state.busy}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line - these answers are usually one sentence,
              // so reaching for a Send button every turn would be the slower path.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={submit}
            disabled={state.busy || !state.draft.trim()}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
