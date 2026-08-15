import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import IconPopover from "../components/IconPopover";
import {
  createResumeDocument,
  deleteResumeDocument,
  duplicateResumeDocument,
  importResumeDocument,
  listResumeDocuments,
  updateResumeDocument,
  type ResumeDocumentListItem,
} from "../lib/api";

function IconDots() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

// Inline SVGs, matching Topbar.tsx's no-icon-package precedent.
function IconPencil() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function ResumeLibrary() {
  const [documents, setDocuments] = useState<ResumeDocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const navigate = useNavigate();

  // This page is the source of truth for the list (create/rename/duplicate/delete all happen
  // here), so it always forces a fresh fetch rather than reading the shared picker cache (see
  // listResumeDocuments in lib/api.ts) - a rename in particular doesn't update that cache, since
  // patching every cached entry for every autosave elsewhere would defeat the point of caching.
  const load = () => {
    listResumeDocuments({ force: true })
      .then((docs) => {
        setDocuments(docs);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load resumes");
        setLoading(false);
      });
  };

  useEffect(load, []);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const doc = await createResumeDocument({});
      navigate(`/resume-builder/${doc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create resume");
      setCreating(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the input up front so re-picking the same file after an error still fires onChange.
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      const doc = await importResumeDocument(file);
      navigate(`/resume-builder/${doc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import resume");
      setImporting(false);
    }
  };

  const handleDuplicate = async (id: string, close: () => void) => {
    try {
      await duplicateResumeDocument(id);
      load();
      close();
    } catch {
      setError("Failed to duplicate resume");
    }
  };

  const handleDelete = async (id: string, close: () => void) => {
    if (!confirm("Delete this resume? This cannot be undone.")) return;
    try {
      await deleteResumeDocument(id);
      load();
      close();
    } catch {
      setError("Failed to delete resume");
    }
  };

  const startRename = (doc: ResumeDocumentListItem, close: () => void) => {
    setRenamingId(doc.id);
    setRenameValue(doc.name);
    close();
  };

  const commitRename = async (id: string) => {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name) return;
    try {
      await updateResumeDocument(id, { name });
      load();
    } catch {
      setError("Failed to rename resume");
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Resume Builder</h1>
      </div>

      {error && (
        <p className="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}

      <div className="resume-library-grid">
        <div className="card resume-library-new-card" onClick={handleCreate}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{creating ? "Creating..." : "+ New Resume"}</div>
          <p className="muted" style={{ fontSize: 13 }}>
            Start a new resume from scratch
          </p>
        </div>

        {/* Styled label wrapping a hidden native file input - same pattern as the resume picker on
            the Understand a Job page, since a bare <input type="file"> can't be styled. */}
        <label className="card resume-library-new-card" style={{ cursor: importing ? "wait" : "pointer" }}>
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            style={{ display: "none" }}
            disabled={importing}
            onChange={handleImport}
          />
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {importing ? "Reading resume..." : "↑ Upload Resume"}
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            {importing
              ? "Extracting your details — this takes a few seconds"
              : "Import a PDF or image and we'll fill in the sections"}
          </p>
        </label>

        {documents.map((doc) => (
          <div key={doc.id} className="card resume-library-card">
            <div onClick={() => navigate(`/resume-builder/${doc.id}`)} style={{ cursor: "pointer" }}>
              <div className="resume-library-thumb">
                {doc.photo_url ? (
                  <img src={doc.photo_url} alt="" />
                ) : (
                  <span className="muted" style={{ fontSize: 24 }}>
                    📄
                  </span>
                )}
              </div>
              {renamingId === doc.id ? (
                <input
                  className="input"
                  autoFocus
                  value={renameValue}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(doc.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(doc.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                />
              ) : (
                <div style={{ fontWeight: 700, fontSize: 14 }}>{doc.name}</div>
              )}
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Updated {formatDate(doc.updated_at)}
              </div>
            </div>
            <div className="resume-library-card-menu">
              <IconPopover icon={<IconDots />} title="Resume options" variant="menu">
                {(close) => (
                  <>
                    <button type="button" className="menu-item" onClick={() => startRename(doc, close)}>
                      <IconPencil />
                      Rename
                    </button>
                    <button type="button" className="menu-item" onClick={() => handleDuplicate(doc.id, close)}>
                      <IconCopy />
                      Duplicate
                    </button>
                    <div className="menu-separator" />
                    <button
                      type="button"
                      className="menu-item menu-item-danger"
                      onClick={() => handleDelete(doc.id, close)}
                    >
                      <IconTrash />
                      Delete
                    </button>
                  </>
                )}
              </IconPopover>
            </div>
          </div>
        ))}
      </div>

      {!loading && documents.length === 0 && !error && (
        <p className="muted" style={{ marginTop: 20 }}>
          No resumes yet — click "+ New Resume" to build your first one.
        </p>
      )}
    </div>
  );
}
