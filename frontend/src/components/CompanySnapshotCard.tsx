import { useState } from "react";
import { generateCompanySnapshot, type ApplicationOut } from "../lib/api";

export default function CompanySnapshotCard({
  application,
  onUpdated,
}: {
  application: ApplicationOut;
  onUpdated: (app: ApplicationOut) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await generateCompanySnapshot(application.id);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate company snapshot");
    } finally {
      setLoading(false);
    }
  };

  const snapshot = application.company_snapshot;

  // Renders bare (no wrapping .card) - ApplicationDetail hosts this inside a tabbed card
  // alongside InterviewQuestionsCard, so wrapping here would nest a card inside a card.
  return (
    <div>
      <div className="form-row" style={{ justifyContent: "flex-end", marginBottom: snapshot ? 14 : 0 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleGenerate} disabled={loading}>
          {loading ? "Generating..." : snapshot ? "Regenerate" : "Generate"}
        </button>
      </div>

      {error && (
        <p className="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}

      {!snapshot && !loading && (
        <p className="muted">
          Get a quick AI-generated orientation to {application.company || "this company"}'s culture and
          interview themes before you prep.
        </p>
      )}

      {snapshot && (
        <div>
          <div className="section-title">Culture</div>
          <p style={{ marginTop: 0 }}>{snapshot.culture}</p>

          <div className="section-title">Core Values</div>
          <div className="pill-list" style={{ marginBottom: 14 }}>
            {snapshot.core_values.map((value, i) => (
              <span key={i} className="badge badge-primary">
                {value}
              </span>
            ))}
          </div>

          <div className="section-title">Engineering Focus</div>
          <p style={{ marginTop: 0 }}>{snapshot.engineering_focus}</p>

          <div className="section-title">Interview Themes</div>
          <ul style={{ marginTop: 0, paddingLeft: 20 }}>
            {snapshot.interview_themes.map((theme, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {theme}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
