import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  applyResumeSuggestion,
  customizeResumeForJD,
  evaluateResumeForJD,
  suggestResumeEditsForJD,
  type JDMatchEvaluation,
  type ResumeContent,
  type ResumeSuggestion,
} from "../../lib/api";

type Step = "input" | "results" | "suggestions";

const TARGET_LABELS: Record<ResumeSuggestion["target"], string> = {
  summary: "Personal Statement",
  work_experience: "Work Experience",
  skills: "Skills",
};

export default function JDCustomizeModal({
  documentId,
  content,
  onContentChange,
  onClose,
}: {
  documentId: string;
  content: ResumeContent;
  onContentChange: (content: ResumeContent) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("input");
  const [jdText, setJdText] = useState("");
  const [evaluation, setEvaluation] = useState<JDMatchEvaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<ResumeSuggestion[]>([]);
  // What's currently in each suggestion's textarea (the model's text until the user edits it),
  // and what was actually written into the resume - kept apart so an edit made *after* applying
  // shows up as a re-appliable change rather than silently diverging from the document.
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [appliedText, setAppliedText] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Adopting a suggestion reads the *current* document, not the one captured when the modal
  // opened - the user can keep editing behind it, and adopts are applied one at a time.
  const contentRef = useRef(content);
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const handleEvaluate = async () => {
    if (!jdText.trim()) return;
    setEvaluating(true);
    setError(null);
    try {
      const result = await evaluateResumeForJD(documentId, jdText);
      setEvaluation(result);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to evaluate match");
    } finally {
      setEvaluating(false);
    }
  };

  const handleBuild = async () => {
    setAdopting(true);
    setError(null);
    try {
      const newDoc = await customizeResumeForJD(documentId, jdText);
      // Navigating only changes the :documentId route param - ResumeEditor (and this modal's
      // parent SectionList, which owns the open/closed state) stays mounted, so without an
      // explicit close the modal lingers on "Building..." forever over the new resume.
      onClose();
      navigate(`/resume-builder/${newDoc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build tailored resume");
      setAdopting(false);
    }
  };

  const handleSuggest = async () => {
    setSuggesting(true);
    setError(null);
    try {
      const result = await suggestResumeEditsForJD(documentId, jdText);
      setSuggestions(result.suggestions);
      setDrafts({});
      setAppliedText({});
      setStep("suggestions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get suggestions");
    } finally {
      setSuggesting(false);
    }
  };

  const draftFor = (suggestion: ResumeSuggestion, index: number) =>
    drafts[index] ?? suggestion.suggested_text;

  const handleAdoptOne = (suggestion: ResumeSuggestion, index: number) => {
    const text = draftFor(suggestion, index);
    onContentChange(applyResumeSuggestion(contentRef.current, { ...suggestion, suggested_text: text }));
    setAppliedText((prev) => ({ ...prev, [index]: text }));
  };

  const handleUndoOne = (suggestion: ResumeSuggestion, index: number) => {
    onContentChange(
      applyResumeSuggestion(contentRef.current, {
        ...suggestion,
        suggested_text: suggestion.original_text,
      })
    );
    setAppliedText((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const busy = evaluating || adopting || suggesting;

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal-panel modal-panel-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <strong>Customize for a JD</strong>
            <p className="muted" style={{ fontSize: 12, margin: "2px 0 0" }}>
              Help optimize this resume to match a target job description
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>

        <div style={{ padding: 20, overflowY: "auto" }}>
          {error && (
            <p className="alert" style={{ marginBottom: 16 }}>
              {error}
            </p>
          )}

          {step === "input" && (
            <div className="field">
              <label>Job description</label>
              <textarea
                className="input"
                rows={10}
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="Paste the job description here..."
              />
              <div className="form-row" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleEvaluate}
                  disabled={evaluating || !jdText.trim()}
                >
                  {evaluating ? "Evaluating..." : "Evaluate match"}
                </button>
              </div>
            </div>
          )}

          {step === "results" && evaluation && (
            <div>
              <div className="form-row" style={{ gap: 16, alignItems: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: "var(--color-primary)" }}>
                  {evaluation.match_score}%
                </div>
                <div style={{ flex: 1 }}>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${evaluation.match_score}%` }} />
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Match score
                  </div>
                </div>
              </div>

              <div className="section-title">Strengths</div>
              <ul style={{ marginTop: 0, marginBottom: 16, paddingLeft: 20 }}>
                {evaluation.strengths.map((s, i) => (
                  <li key={i} style={{ fontSize: 13, marginBottom: 4 }}>
                    {s}
                  </li>
                ))}
              </ul>

              <div className="section-title">Gaps</div>
              <ul style={{ marginTop: 0, marginBottom: 20, paddingLeft: 20 }}>
                {evaluation.gaps.map((g, i) => (
                  <li key={i} style={{ fontSize: 13, marginBottom: 4 }}>
                    {g}
                  </li>
                ))}
              </ul>

              <div className="section-title">How do you want to apply this?</div>
              <div className="stack" style={{ gap: 10, marginTop: 10 }}>
                <div className="subcard">
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Review suggestions one by one</div>
                  <p className="muted" style={{ fontSize: 12, margin: "4px 0 10px" }}>
                    See each proposed change with its reason and accept or skip it individually.
                    Applies to <strong>this</strong> resume.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSuggest}
                    disabled={busy}
                  >
                    {suggesting ? "Finding suggestions..." : "Review suggestions"}
                  </button>
                </div>

                <div className="subcard">
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Build a tailored copy</div>
                  <p className="muted" style={{ fontSize: 12, margin: "4px 0 10px" }}>
                    Rewrite everything at once into a <strong>new</strong> resume, inheriting this
                    template and style. Your original is left unchanged.
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleBuild}
                    disabled={busy}
                  >
                    {adopting ? "Building..." : "Build tailored resume"}
                  </button>
                </div>
              </div>

              <div className="form-row" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setStep("input")}
                  disabled={busy}
                >
                  ← Back to edit JD
                </button>
              </div>
            </div>
          )}

          {step === "suggestions" && (
            <div>
              {suggestions.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>
                  No changes suggested — this resume already reads well against that job description.
                </p>
              ) : (
                <>
                  <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
                    {Object.keys(appliedText).length} of {suggestions.length} applied. Edit any
                    suggestion before (or after) applying it — changes save automatically.
                  </p>
                  <div className="stack" style={{ gap: 12 }}>
                    {suggestions.map((suggestion, index) => {
                      const draft = draftFor(suggestion, index);
                      const applied = appliedText[index] !== undefined;
                      const dirty = applied && appliedText[index] !== draft;
                      return (
                        <div key={index} className="subcard">
                          <div className="form-row" style={{ justifyContent: "space-between", gap: 8 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>
                              {suggestion.entry_label || TARGET_LABELS[suggestion.target]}
                            </div>
                            {/* Whole-section targets already say "Skills"/"Personal Statement" in
                                the label - only the per-entry ones need the section badge too. */}
                            {suggestion.entry_label !== TARGET_LABELS[suggestion.target] && (
                              <span className="badge">{TARGET_LABELS[suggestion.target]}</span>
                            )}
                          </div>

                          {suggestion.reason && (
                            <p className="muted" style={{ fontSize: 12, margin: "6px 0 10px" }}>
                              {suggestion.reason}
                            </p>
                          )}

                          {suggestion.original_text && (
                            <div style={{ marginBottom: 8 }}>
                              <div className="muted" style={{ fontSize: 11, marginBottom: 2 }}>
                                Current
                              </div>
                              <div style={{ fontSize: 12, opacity: 0.7 }}>{suggestion.original_text}</div>
                            </div>
                          )}

                          <div style={{ marginBottom: 10 }}>
                            <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
                              Suggested — edit freely before applying
                            </div>
                            <textarea
                              className="input suggestion-textarea"
                              rows={Math.min(8, Math.max(2, Math.ceil(draft.length / 70)))}
                              value={draft}
                              onChange={(e) =>
                                setDrafts((prev) => ({ ...prev, [index]: e.target.value }))
                              }
                            />
                          </div>

                          <div className="form-row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            {applied && !dirty && (
                              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)" }}>
                                ✓ Applied
                              </span>
                            )}
                            {(!applied || dirty) && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleAdoptOne(suggestion, index)}
                                disabled={!draft.trim()}
                              >
                                {dirty ? "Apply your edit" : "Apply this change"}
                              </button>
                            )}
                            {applied && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleUndoOne(suggestion, index)}
                              >
                                Undo
                              </button>
                            )}
                            {drafts[index] !== undefined && drafts[index] !== suggestion.suggested_text && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() =>
                                  setDrafts((prev) => {
                                    const next = { ...prev };
                                    delete next[index];
                                    return next;
                                  })
                                }
                              >
                                Reset to suggestion
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="form-row" style={{ marginTop: 16, justifyContent: "space-between" }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep("results")}>
                  ← Back to match results
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
