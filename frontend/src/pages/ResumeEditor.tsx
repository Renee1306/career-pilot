import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ResumePreview from "../components/resume-builder/ResumePreview";
import SectionList from "../components/resume-builder/SectionList";
import StylePanel from "../components/resume-builder/StylePanel";
import TemplatePickerModal from "../components/resume-builder/TemplatePickerModal";
import {
  enhanceResumeText,
  getResumeDocument,
  updateResumeDocument,
  type ResumeContent,
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

  const handleEnhance = (text: string, context?: string) =>
    enhanceResumeText({ text, context }).then((res) => res.text);

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
          onEnhance={handleEnhance}
        />
        <div className="builder-preview-pane">
          <ResumePreview
            templateId={state.template_id}
            content={state.content}
            style={state.style}
            photoUrl={state.photo_url}
          />
        </div>
        <StylePanel style={state.style} onChange={(style) => setState({ ...state, style })} />
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
