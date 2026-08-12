import { useState } from "react";

export default function SummaryForm({
  text,
  onChange,
  onEnhance,
}: {
  text: string;
  onChange: (text: string) => void;
  onEnhance: (text: string, context?: string) => Promise<string>;
}) {
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnhance = async () => {
    if (!text.trim()) return;
    setEnhancing(true);
    setError(null);
    try {
      const improved = await onEnhance(text);
      onChange(improved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enhance failed");
    } finally {
      setEnhancing(false);
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
      <div className="form-row" style={{ marginTop: 4 }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleEnhance}
          disabled={enhancing || !text.trim()}
        >
          {enhancing ? "Enhancing..." : "AI enhance"}
        </button>
      </div>
      {error && (
        <p className="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}
    </div>
  );
}
