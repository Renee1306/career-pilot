import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CoverLetterPanel from "../components/resume-builder/CoverLetterPanel";
import JDCoachPanel, { INITIAL_JD_COACH_STATE, type JDCoachState } from "../components/resume-builder/JDCoachPanel";
import ResumePreview from "../components/resume-builder/ResumePreview";
import SectionList from "../components/resume-builder/SectionList";
import StylePanel from "../components/resume-builder/StylePanel";
import TemplatePickerModal from "../components/resume-builder/TemplatePickerModal";
import {
  applyResumeHint,
  getResumeDocument,
  updateResumeDocument,
  type ResumeContent,
  type ResumeHint,
  type ResumeStyle,
} from "../lib/api";

interface EditorState {
  name: string;
  template_id: string;
  content: ResumeContent;
  style: ResumeStyle;
  photo_url: string | null;
}

export default function ResumeEditor() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<EditorState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [rail, setRail] = useState<"style" | "coach" | "cover-letter">("style");
  const [railOpen, setRailOpen] = useState(true);
  // Pending JD suggestions. These live only for the session and are deliberately NOT part of the
  // saved document - a hint is an offer, and the resume only changes when one is accepted.
  const [hints, setHints] = useState<ResumeHint[]>([]);
  // The JD Coach's own in-progress review (JD text, match score, gap-interview transcripts, ...).
  // Lifted here rather than local to JDCoachPanel so switching to Style/Cover Letter (or hiding
  // the rail) and back doesn't wipe out a half-finished review - see JDCoachState.
  const [coachState, setCoachState] = useState<JDCoachState>(INITIAL_JD_COACH_STATE);

  const loadedRef = useRef(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!documentId) return;
    loadedRef.current = false;
    getResumeDocument(documentId)
      .then((doc) => {
        setState({
          name: doc.name,
          template_id: doc.template_id,
          content: doc.content,
          style: doc.style,
          photo_url: doc.photo_url,
        });
      })
      .catch(() => setError("Failed to load resume"));
  }, [documentId]);

  useEffect(() => {
    if (!state || !documentId) return;
    if (!loadedRef.current) {
      loadedRef.current = true;
      return;
    }
    setSaveStatus("saving");
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      updateResumeDocument(documentId, {
        name: state.name,
        template_id: state.template_id,
        content: state.content,
        style: state.style,
      })
        .then(() => setSaveStatus("saved"))
        .catch(() => setError("Failed to save changes"));
    }, 800);
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.name, state?.template_id, state?.content, state?.style]);

  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, []);

  const dismissHint = (hint: ResumeHint) => setHints((prev) => prev.filter((h) => h.id !== hint.id));

  const acceptHint = (hint: ResumeHint) => {
    setState((prev) => (prev ? { ...prev, content: applyResumeHint(prev.content, hint) } : prev));
    dismissHint(hint);
  };

  if (error) {
    return (
      <div className="page-fill">
        <p className="alert">{error}</p>
      </div>
    );
  }

  if (!state || !documentId) {
    return (
      <div className="page-fill">
        <p className="muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="page-fill">
      <div className="page-header">
        <div className="form-row" style={{ gap: 12 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("/resume-builder")}>
            ← Library
          </button>
          <input
            className="input"
            style={{ width: 260, fontWeight: 700 }}
            value={state.name}
            onChange={(e) => setState({ ...state, name: e.target.value })}
          />
          <span className="muted" style={{ fontSize: 12 }}>
            {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : ""}
          </span>
        </div>
        <div className="form-row" style={{ gap: 10 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTemplatePickerOpen(true)}>
            Templates
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
            Export
          </button>
        </div>
      </div>

      <div className="builder-layout">
        <SectionList
          documentId={documentId}
          content={state.content}
          photoUrl={state.photo_url}
          onContentChange={(content) => setState({ ...state, content })}
          onPhotoUrlChange={(photo_url) => setState({ ...state, photo_url })}
        />
        <div className="builder-preview-pane">
          <ResumePreview
            templateId={state.template_id}
            content={state.content}
            style={state.style}
            photoUrl={state.photo_url}
            hints={hints}
            onAcceptHint={acceptHint}
            onDismissHint={dismissHint}
          />
        </div>

        {railOpen ? (
          <div className="builder-rail">
            <div className="builder-rail-head">
              <div className="builder-rail-tabs">
                <button
                  type="button"
                  className={`builder-rail-tab${rail === "style" ? " is-active" : ""}`}
                  onClick={() => setRail("style")}
                >
                  Style
                </button>
                <button
                  type="button"
                  className={`builder-rail-tab${rail === "coach" ? " is-active" : ""}`}
                  onClick={() => setRail("coach")}
                >
                  Tailor to JD
                  {hints.length > 0 && <span className="builder-rail-count">{hints.length}</span>}
                </button>
                <button
                  type="button"
                  className={`builder-rail-tab${rail === "cover-letter" ? " is-active" : ""}`}
                  onClick={() => setRail("cover-letter")}
                >
                  Cover Letter
                </button>
              </div>
              <button
                type="button"
                className="builder-reorder-btn"
                title="Hide panel"
                aria-label="Hide panel"
                onClick={() => setRailOpen(false)}
              >
                ›
              </button>
            </div>

            <div className="builder-rail-body">
              {rail === "style" ? (
                <StylePanel style={state.style} onChange={(style) => setState({ ...state, style })} />
              ) : rail === "coach" ? (
                <JDCoachPanel
                  documentId={documentId}
                  hints={hints}
                  onHintsChange={setHints}
                  coachState={coachState}
                  onCoachStateChange={setCoachState}
                />
              ) : (
                <CoverLetterPanel documentId={documentId} />
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="builder-rail-reopen"
            title="Show panel"
            aria-label="Show panel"
            onClick={() => setRailOpen(true)}
          >
            ‹{hints.length > 0 && <span className="builder-rail-count">{hints.length}</span>}
          </button>
        )}
      </div>

      {templatePickerOpen && (
        <TemplatePickerModal
          activeTemplateId={state.template_id}
          onSelect={(template_id) => setState({ ...state, template_id })}
          onClose={() => setTemplatePickerOpen(false)}
        />
      )}
    </div>
  );
}
