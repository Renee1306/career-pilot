import { useState } from "react";
import { generateResumeSummary } from "../../lib/api";

export default function SummaryForm({
  documentId,
  text,
  onChange,
}: {
  documentId: string;
  text: string;
  onChange: (text: string) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateResumeSummary(documentId);
      onChange(result.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate a summary");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="field">
      <label>Personal statement</label>
      <textarea
        className="input"
        rows={6}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="A short summary of who you are and what you're looking for..."
      />
      {/* Only offered while the field is empty - once there's real text here, generating over it
          would silently discard something the candidate wrote themselves. */}
      {!text.trim() && (
        <div style={{ marginTop: 4 }}>
          <div className="form-row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleGenerate} disabled={generating}>
              {generating ? "Drafting..." : "Draft from my resume"}
            </button>
          </div>
          <p className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
            Usually takes about 15 seconds.
          </p>
        </div>
      )}
      {error && (
        <p className="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}
    </div>
  );
}
