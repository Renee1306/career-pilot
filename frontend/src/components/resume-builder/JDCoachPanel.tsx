import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  jobOptionLabel,
  listJobDescriptions,
  reviewResumeForJD,
  runGapTurn,
  runQuantifyTurn,
  type CoachMessage,
  type JDGap,
  type JDReview,
  type JobDescriptionOut,
  type QuantifyCandidate,
  type ResumeHint,
} from "../../lib/api";

type Phase = "input" | "reviewing" | "review";

const GAP_CATEGORY_LABELS: Record<JDGap["category"], string> = {
  hard_skill: "Hard skill",
  soft_skill: "Soft skill",
  industry_term: "Industry term",
};

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

/** Everything about an in-progress JD review that has to survive the panel unmounting - switching
 *  to the Style or Cover Letter rail tab (or hiding the rail entirely) previously reset all of
 *  this back to a blank "paste a JD" screen, silently discarding a half-finished gap interview.
 *  Owned by ResumeEditor (same lifting `hints` already gets) rather than local useState here, so
 *  it outlives this component's mount lifecycle. */
export interface JDCoachState {
  phase: Phase;
  jdText: string;
  selectedJobId: string;
  review: JDReview | null;
  gapStates: Record<string, GapState>;
  quantifyStates: Record<string, GapState>;
}

export const INITIAL_JD_COACH_STATE: JDCoachState = {
  phase: "input",
  jdText: "",
  selectedJobId: "",
  review: null,
  gapStates: {},
  quantifyStates: {},
};

export default function JDCoachPanel({
  documentId,
  hints,
  onHintsChange,
  coachState,
  onCoachStateChange,
}: {
  documentId: string;
  hints: ResumeHint[];
  onHintsChange: (hints: ResumeHint[]) => void;
  coachState: JDCoachState;
  onCoachStateChange: Dispatch<SetStateAction<JDCoachState>>;
}) {
  const { phase, jdText, selectedJobId, review, gapStates, quantifyStates } = coachState;
  const [savedJobs, setSavedJobs] = useState<JobDescriptionOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const patchState = (patch: Partial<JDCoachState>) => onCoachStateChange((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    listJobDescriptions()
      .then(setSavedJobs)
      .catch(() => {});
  }, []);

  const handlePickSaved = (jobId: string) => {
    const picked = savedJobs.find((j) => j.id === jobId);
    patchState({ selectedJobId: jobId, jdText: picked ? picked.raw_text : jdText });
  };

  const gapState = (id: string) => gapStates[id] ?? NEW_GAP;
  const patchGap = (id: string, patch: Partial<GapState>) =>
    onCoachStateChange((prev) => ({
      ...prev,
      gapStates: { ...prev.gapStates, [id]: { ...(prev.gapStates[id] ?? NEW_GAP), ...patch } },
    }));

  const quantifyState = (id: string) => quantifyStates[id] ?? NEW_GAP;
  const patchQuantify = (id: string, patch: Partial<GapState>) =>
    onCoachStateChange((prev) => ({
      ...prev,
      quantifyStates: { ...prev.quantifyStates, [id]: { ...(prev.quantifyStates[id] ?? NEW_GAP), ...patch } },
    }));

  const handleReview = async () => {
    if (!jdText.trim()) return;
    patchState({ phase: "reviewing" });
    setError(null);
    try {
      const result = await reviewResumeForJD(documentId, jdText);
      onHintsChange(result.hints);
      patchState({ review: result, gapStates: {}, quantifyStates: {}, phase: "review" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to review this resume");
      patchState({ phase: "input" });
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

  // Same stateless shape as sendGapTurn - the only difference is what's being confirmed, a
  // number instead of a skill.
  const sendQuantifyTurn = async (candidate: QuantifyCandidate, answer: string | null) => {
    if (!review) return;
    const state = quantifyState(candidate.id);
    const history = answer === null ? state.history : [...state.history, { role: "user" as const, content: answer }];

    patchQuantify(candidate.id, { status: "asking", history, draft: "", busy: true });
    setError(null);
    try {
      const turn = await runQuantifyTurn(documentId, { candidate, history });
      const withReply = [...history, { role: "assistant" as const, content: turn.message }];

      if (turn.status === "ready") {
        onHintsChange([...hints, ...turn.hints]);
        patchQuantify(candidate.id, { status: "resolved", history: withReply, busy: false });
      } else if (turn.status === "declined") {
        patchQuantify(candidate.id, { status: "declined", history: withReply, busy: false });
      } else {
        patchQuantify(candidate.id, { status: "asking", history: withReply, busy: false });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to continue that conversation");
      patchQuantify(candidate.id, { busy: false });
    }
  };

  const startOver = () => {
    patchState({ phase: "input", review: null, gapStates: {}, quantifyStates: {}, selectedJobId: "" });
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
            onChange={(e) => patchState({ jdText: e.target.value, selectedJobId: "" })}
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

          <div className="section-title" style={{ marginTop: 18 }}>
            Bullets that could use a number
          </div>
          {review.quantify_candidates.length === 0 ? (
            <p className="muted jdc-empty">Every bullet already has a number backing it up.</p>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {review.quantify_candidates.map((candidate) => (
                <QuantifyCard
                  key={candidate.id}
                  candidate={candidate}
                  state={quantifyState(candidate.id)}
                  onStart={() => sendQuantifyTurn(candidate, null)}
                  onAnswer={(answer) => sendQuantifyTurn(candidate, answer)}
                  onDraftChange={(draft) => patchQuantify(candidate.id, { draft })}
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
  return (
    <CoachCard
      title={gap.title}
      badge={<span className="badge badge-muted">{GAP_CATEGORY_LABELS[gap.category]}</span>}
      detail={gap.detail}
      state={state}
      startLabel="Do I have this?"
      resolvedLabel="Added"
      declinedLabel="Left off"
      onStart={onStart}
      onAnswer={onAnswer}
      onDraftChange={onDraftChange}
    />
  );
}

function QuantifyCard({
  candidate,
  state,
  onStart,
  onAnswer,
  onDraftChange,
}: {
  candidate: QuantifyCandidate;
  state: GapState;
  onStart: () => void;
  onAnswer: (answer: string) => void;
  onDraftChange: (draft: string) => void;
}) {
  return (
    <CoachCard
      title={candidate.entry_label}
      detail={candidate.text}
      state={state}
      startLabel="Add a number?"
      resolvedLabel="Quantified"
      declinedLabel="Left as-is"
      onStart={onStart}
      onAnswer={onAnswer}
      onDraftChange={onDraftChange}
    />
  );
}

/** Shared shell for a one-topic back-and-forth: a title, an optional status badge, the
 *  thing being discussed, and the asking/resolved/declined states GapCard and QuantifyCard both
 *  drive off the same GapState shape. */
function CoachCard({
  title,
  badge,
  detail,
  state,
  startLabel,
  resolvedLabel,
  declinedLabel,
  onStart,
  onAnswer,
  onDraftChange,
}: {
  title: string;
  badge?: ReactNode;
  detail: string;
  state: GapState;
  startLabel: string;
  resolvedLabel: string;
  declinedLabel: string;
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
        {title}
        {badge}
        {state.status === "resolved" && <span className="badge jdc-badge-ok">{resolvedLabel}</span>}
        {state.status === "declined" && <span className="badge">{declinedLabel}</span>}
      </div>
      <p className="jdc-gap-detail">{detail}</p>

      {state.status === "open" && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onStart}>
          {startLabel}
        </button>
      )}

      {(state.history.length > 0 || state.busy) && (
        <div className="jdc-thread">
          {state.history.map((message, i) => (
            <div key={i} className={message.role === "user" ? "jdc-msg-user" : "jdc-msg-bot"}>
              {message.content}
            </div>
          ))}
          {/* Only the very first turn is a cold start worth announcing - once the thread is going,
              the disabled composer is enough of a "wait" signal. */}
          {state.busy && state.history.length === 0 && (
            <div className="jdc-msg-bot jdc-msg-typing">Connecting to agent…</div>
          )}
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
