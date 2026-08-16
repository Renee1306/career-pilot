import { useEffect, useState } from "react";
import {
  exportCoverLetterDocx,
  generateCoverLetter,
  jobOptionLabel,
  listJobDescriptions,
  type JobDescriptionOut,
} from "../../lib/api";

type Phase = "input" | "generating" | "result";

export default function CoverLetterPanel({ documentId }: { documentId: string }) {
  const [phase, setPhase] = useState<Phase>("input");
  const [jdText, setJdText] = useState("");
  const [savedJobs, setSavedJobs] = useState<JobDescriptionOut[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [letter, setLetter] = useState("");
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listJobDescriptions()
      .then(setSavedJobs)
      .catch(() => {});
  }, []);

  const handlePickSaved = (jobId: string) => {
    setSelectedJobId(jobId);
    const picked = savedJobs.find((j) => j.id === jobId);
    if (picked) {
      setJdText(picked.raw_text);
      setCompany(picked.company ?? "");
      setPosition(picked.title ?? "");
    }
  };

  const handleGenerate = async () => {
    if (!jdText.trim()) return;
    setPhase("generating");
    setError(null);
    setCopied(false);
    try {
      const result = await generateCoverLetter(documentId, {
        jd_text: jdText,
        company: company.trim() || undefined,
        position: position.trim() || undefined,
      });
      setLetter(result.text);
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate a cover letter");
      setPhase("input");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy automatically - select the text above and copy it manually.");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const { blob, filename } = await exportCoverLetterDocx(documentId, {
        text: letter,
        company: company.trim() || undefined,
        position: position.trim() || undefined,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export this cover letter");
    } finally {
      setExporting(false);
    }
  };

  const startOver = () => {
    setPhase("input");
    setLetter("");
    setSelectedJobId("");
    setCopied(false);
  };

  return (
    <div className="jdc-panel">
      {error && <p className="alert jdc-alert">{error}</p>}

      {phase !== "result" && (
        <>
          <p className="jdc-intro">
            Paste the job description you're applying to and I'll draft a cover letter from this
            resume — tailored to the role, using only experience that's actually on the page.
          </p>

          {savedJobs.length > 0 && (
            <div className="field">
              <label htmlFor="cl-saved-jd">Use a job description from Job Analysis</label>
              <select
                id="cl-saved-jd"
                className="input"
                value={selectedJobId}
                onChange={(e) => handlePickSaved(e.target.value)}
                disabled={phase === "generating"}
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

          <label htmlFor="cl-jd-text" className="muted" style={{ fontSize: 12.5, display: "block", marginBottom: 4 }}>
            {savedJobs.length > 0 ? "Or paste a job description" : "Job description"}
          </label>
          <textarea
            id="cl-jd-text"
            className="input"
            rows={8}
            value={jdText}
            onChange={(e) => {
              setJdText(e.target.value);
              setSelectedJobId("");
            }}
            placeholder="Paste the job description here..."
            disabled={phase === "generating"}
          />

          <div className="form-row" style={{ gap: 10, marginTop: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="cl-company">Company (optional)</label>
              <input
                id="cl-company"
                className="input"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Acme Inc."
                disabled={phase === "generating"}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="cl-position">Position (optional)</label>
              <input
                id="cl-position"
                className="input"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="e.g. Backend Engineer"
                disabled={phase === "generating"}
              />
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 10 }}
            onClick={handleGenerate}
            disabled={phase === "generating" || !jdText.trim()}
          >
            {phase === "generating" ? "Writing..." : "Generate cover letter"}
          </button>
          <p className="muted" style={{ fontSize: 11.5, marginTop: 6, textAlign: "center" }}>
            Usually takes about 20 seconds.
          </p>
        </>
      )}

      {phase === "result" && (
        <>
          <label htmlFor="cl-result" className="muted" style={{ fontSize: 12.5, display: "block", marginBottom: 4 }}>
            Edit freely before you copy it — this is a draft, not a script.
          </label>
          <textarea
            id="cl-result"
            className="input"
            rows={20}
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            style={{ fontFamily: "inherit", lineHeight: 1.6 }}
          />
          <div className="form-row" style={{ gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy to clipboard"}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleExport} disabled={exporting}>
              {exporting ? "Exporting..." : "Export to Word"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={startOver}>
              ← Use a different JD
            </button>
          </div>
          <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
            The Word export follows a standard cover letter layout — fields we don't have (like the
            hiring manager's name) are left as {"<placeholders>"} for you to fill in.
          </p>
        </>
      )}
    </div>
  );
}
