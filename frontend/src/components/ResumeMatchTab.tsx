import { useEffect, useState } from "react";
import {
  exportResumePdf,
  generateResumeMatch,
  listResumes,
  type ResumeEdit,
  type ResumeMatch,
  type ResumeOut,
} from "../lib/api";

type Segment =
  | { type: "text"; content: string }
  | { type: "highlight"; content: string; editIndex: number };

function buildSegments(text: string, edits: ResumeEdit[], appliedKeys: Set<number>): Segment[] {
  const matches: { start: number; end: number; editIndex: number }[] = [];
  edits.forEach((edit, i) => {
    if (appliedKeys.has(i)) return;
    const idx = text.indexOf(edit.original_text);
    if (idx !== -1) matches.push({ start: idx, end: idx + edit.original_text.length, editIndex: i });
  });
  matches.sort((a, b) => a.start - b.start);

  const filtered: typeof matches = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }

  const segments: Segment[] = [];
  let cursor = 0;
  for (const m of filtered) {
    if (m.start > cursor) segments.push({ type: "text", content: text.slice(cursor, m.start) });
    segments.push({ type: "highlight", content: text.slice(m.start, m.end), editIndex: m.editIndex });
    cursor = m.end;
  }
  if (cursor < text.length) segments.push({ type: "text", content: text.slice(cursor) });
  return segments;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ResumeMatchTab({
  jobId,
  match,
  onUpdated,
  preferredResumeId,
}: {
  jobId: string;
  match: ResumeMatch | null;
  onUpdated: (match: ResumeMatch) => void;
  preferredResumeId?: string;
}) {
  const [resumes, setResumes] = useState<ResumeOut[]>([]);
  const [resumeId, setResumeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tailoredText, setTailoredText] = useState("");
  const [appliedKeys, setAppliedKeys] = useState<Set<number>>(new Set());
  const [activeEdit, setActiveEdit] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    listResumes()
      .then((list) => {
        setResumes(list);
        if (list.length > 0) {
          const preferred = list.find((r) => r.id === preferredResumeId);
          const initial = preferred ?? list[0];
          setResumeId(initial.id);
          setTailoredText(initial.parsed_text ?? "");
        }
      })
      .catch(() => setError("Failed to load resumes"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResumeChange = (id: string) => {
    setResumeId(id);
    const resume = resumes.find((r) => r.id === id);
    setTailoredText(resume?.parsed_text ?? "");
    setAppliedKeys(new Set());
    setActiveEdit(null);
  };

  const handleGenerate = async () => {
    if (!resumeId) return;
    setError(null);
    setLoading(true);
    try {
      const analysis = await generateResumeMatch(jobId, resumeId);
      onUpdated(analysis.match_suggestions!);
      setAppliedKeys(new Set());
      setActiveEdit(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate resume match");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (index: number) => {
    if (!match) return;
    const edit = match.edits[index];
    setTailoredText((text) => text.replace(edit.original_text, edit.suggested_text));
    setAppliedKeys((prev) => new Set(prev).add(index));
    setActiveEdit(null);
  };

  const handleExport = async () => {
    setError(null);
    setExporting(true);
    try {
      const resume = resumes.find((r) => r.id === resumeId);
      const blob = await exportResumePdf(tailoredText, resume?.label ?? "resume");
      triggerDownload(blob, `${resume?.label ?? "resume"}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (resumes.length === 0) {
    return <p className="muted">Upload a resume above first.</p>;
  }

  const segments = match ? buildSegments(tailoredText, match.edits, appliedKeys) : [];
  const active = match && activeEdit !== null ? match.edits[activeEdit] : null;
  const appliedCount = appliedKeys.size;

  return (
    <div>
      <div className="form-row">
        <select className="input" style={{ width: 240 }} value={resumeId} onChange={(e) => handleResumeChange(e.target.value)}>
          {resumes.map((resume) => (
            <option key={resume.id} value={resume.id}>
              {resume.label ?? resume.id}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={loading || !resumeId}>
          {loading ? "Generating..." : match ? "Regenerate" : "Generate match"}
        </button>
      </div>

      {error && <p className="alert" style={{ marginTop: 12 }}>{error}</p>}

      {match && (
        <div style={{ marginTop: 20 }}>
          <div className="form-row" style={{ marginBottom: 16 }}>
            <span className="badge badge-primary" style={{ fontSize: 14, padding: "6px 16px" }}>
              Match score: {match.match_score}/100
            </span>
            {match.edits.length > 0 && (
              <span className="badge badge-muted">
                {appliedCount}/{match.edits.length} suggestions applied
              </span>
            )}
          </div>

          <details className="subcard">
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>Matched / missing skills</summary>
            <div className="pill-list" style={{ marginTop: 10 }}>
              {match.matched_skills.map((s) => (
                <span key={s} className="badge badge-success">
                  {s}
                </span>
              ))}
            </div>
            <div className="pill-list" style={{ marginTop: 10 }}>
              {match.missing_skills.map((s) => (
                <span key={s} className="badge badge-danger">
                  {s}
                </span>
              ))}
            </div>
          </details>

          <p className="muted" style={{ marginTop: 16 }}>
            Click a highlighted phrase in the resume below to see the suggested change.
          </p>

          <div className="subcard" style={{ whiteSpace: "pre-wrap", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            {segments.map((seg, i) =>
              seg.type === "text" ? (
                <span key={i}>{seg.content}</span>
              ) : (
                <mark key={i} className="highlight" onClick={() => setActiveEdit(seg.editIndex)}>
                  {seg.content}
                </mark>
              )
            )}
          </div>

          {active && (
            <div className="subcard" style={{ border: "1px solid var(--color-primary)", marginTop: 12 }}>
              <h4>Original</h4>
              <p>{active.original_text}</p>
              <h4>Suggestion</h4>
              <p>{active.suggested_text}</p>
              <h4>Reason</h4>
              <p className="muted">{active.reason}</p>
              <div className="form-row">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => handleApply(activeEdit!)}>
                  Apply
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActiveEdit(null)}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <hr className="divider" />

          <section>
            <div className="section-title">Summary of changes</div>
            <p>{match.summary}</p>
            <ul>
              {match.edits.map((edit, i) => (
                <li key={i}>
                  {appliedKeys.has(i) ? "✅ Applied" : "⬜ Pending"}: {edit.original_text.slice(0, 60)}
                  {edit.original_text.length > 60 ? "..." : ""}
                </li>
              ))}
            </ul>
          </section>

          <button type="button" className="btn btn-primary" onClick={handleExport} disabled={exporting}>
            {exporting ? "Exporting..." : "Export to PDF"}
          </button>
        </div>
      )}
    </div>
  );
}
