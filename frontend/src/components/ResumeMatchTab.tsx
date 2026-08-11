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
}: {
  jobId: string;
  match: ResumeMatch | null;
  onUpdated: (match: ResumeMatch) => void;
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
          setResumeId(list[0].id);
          setTailoredText(list[0].parsed_text ?? "");
        }
      })
      .catch(() => setError("Failed to load resumes"));
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
    return <p>Upload a resume above first.</p>;
  }

  const segments = match ? buildSegments(tailoredText, match.edits, appliedKeys) : [];
  const active = match && activeEdit !== null ? match.edits[activeEdit] : null;

  return (
    <div>
      <select value={resumeId} onChange={(e) => handleResumeChange(e.target.value)}>
        {resumes.map((resume) => (
          <option key={resume.id} value={resume.id}>
            {resume.label ?? resume.id}
          </option>
        ))}
      </select>
      <button type="button" onClick={handleGenerate} disabled={loading || !resumeId}>
        {loading ? "Generating..." : match ? "Regenerate" : "Generate match"}
      </button>

      {error && <p role="alert">{error}</p>}

      {match && (
        <div>
          <p>Match score: {match.match_score}/100</p>

          <details>
            <summary>Matched / missing skills</summary>
            <h4>Matched</h4>
            <ul>
              {match.matched_skills.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <h4>Missing</h4>
            <ul>
              {match.missing_skills.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </details>

          <p>Click a highlighted phrase in the resume below to see the suggested change.</p>

          <div style={{ whiteSpace: "pre-wrap", border: "1px solid #ccc", padding: "1rem" }}>
            {segments.map((seg, i) =>
              seg.type === "text" ? (
                <span key={i}>{seg.content}</span>
              ) : (
                <mark
                  key={i}
                  style={{ backgroundColor: "#fff59d", cursor: "pointer" }}
                  onClick={() => setActiveEdit(seg.editIndex)}
                >
                  {seg.content}
                </mark>
              )
            )}
          </div>

          {active && (
            <div style={{ border: "1px solid #999", padding: "1rem", marginTop: "0.5rem" }}>
              <h4>Original</h4>
              <p>{active.original_text}</p>
              <h4>Suggestion</h4>
              <p>{active.suggested_text}</p>
              <h4>Reason</h4>
              <p>{active.reason}</p>
              <button type="button" onClick={() => handleApply(activeEdit!)}>
                Apply
              </button>
              <button type="button" onClick={() => setActiveEdit(null)}>
                Dismiss
              </button>
            </div>
          )}

          <section>
            <h3>Summary of changes</h3>
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

          <button type="button" onClick={handleExport} disabled={exporting}>
            {exporting ? "Exporting..." : "Export to PDF"}
          </button>
        </div>
      )}
    </div>
  );
}
