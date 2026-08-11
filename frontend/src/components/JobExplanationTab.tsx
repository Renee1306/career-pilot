import { useState } from "react";
import { generateExplanation, translateExplanation, type JobExplanation } from "../lib/api";

export default function JobExplanationTab({
  jobId,
  explanation,
  translations,
  onUpdated,
}: {
  jobId: string;
  explanation: JobExplanation | null;
  translations: Record<string, JobExplanation>;
  onUpdated: (explanation: JobExplanation, translations: Record<string, JobExplanation>) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState("");
  const [translating, setTranslating] = useState(false);

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);
    try {
      const analysis = await generateExplanation(jobId);
      onUpdated(analysis.explanation!, analysis.translations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate explanation");
    } finally {
      setLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (!language.trim()) return;
    setError(null);
    setTranslating(true);
    try {
      const analysis = await translateExplanation(jobId, language.trim());
      onUpdated(analysis.explanation!, analysis.translations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to translate");
    } finally {
      setTranslating(false);
    }
  };

  const shown = language.trim() && translations[language.trim()] ? translations[language.trim()] : explanation;

  return (
    <div>
      <div className="form-row">
        <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={loading}>
          {loading ? "Generating..." : explanation ? "Regenerate explanation" : "Generate explanation"}
        </button>

        {explanation && (
          <>
            <input
              className="input"
              style={{ width: 200 }}
              placeholder="Translate to (e.g. Spanish)"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTranslate}
              disabled={translating || !language.trim()}
            >
              {translating ? "Translating..." : "Translate"}
            </button>
          </>
        )}
      </div>

      {error && <p className="alert" style={{ marginTop: 12 }}>{error}</p>}

      {shown && (
        <div style={{ marginTop: 20 }}>
          <section>
            <div className="section-title">1. Understand this job in 1 sentence</div>
            <p>{shown.one_sentence_summary}</p>
          </section>

          <hr className="divider" />

          <section>
            <div className="section-title">2. Top 3 things you will do</div>
            {shown.top_responsibilities.map((item) => (
              <div className="subcard" key={item.responsibility}>
                <h3>{item.responsibility}</h3>
                <p>{item.simple_explanation}</p>
                <p className="evidence">Example: {item.example}</p>
              </div>
            ))}
          </section>

          <hr className="divider" />

          <section>
            <div className="section-title">3. What do they really require?</div>

            <p style={{ fontWeight: 700, marginTop: 12 }}>🔴 Hard requirement</p>
            {shown.requirements.hard_requirements.map((req) => (
              <div className="subcard tier-hard" key={req.requirement}>
                <strong>{req.requirement}</strong>
                <p>{req.why_it_matters}</p>
                <p className="evidence">Evidence: "{req.evidence}"</p>
                <p>{req.explanation}</p>
              </div>
            ))}

            <p style={{ fontWeight: 700, marginTop: 12 }}>🟡 Can be learned / trained</p>
            {shown.requirements.learnable.map((req) => (
              <div className="subcard tier-learnable" key={req.requirement}>
                <strong>{req.requirement}</strong>
                <p>{req.why_it_matters}</p>
                <p className="evidence">Evidence: "{req.evidence}"</p>
                <p>{req.explanation}</p>
              </div>
            ))}

            <p style={{ fontWeight: 700, marginTop: 12 }}>🟢 Bonus point</p>
            {shown.requirements.bonus.map((req) => (
              <div className="subcard tier-bonus" key={req.requirement}>
                <strong>{req.requirement}</strong>
                <p>{req.why_it_matters}</p>
                <p className="evidence">Evidence: "{req.evidence}"</p>
                <p>{req.explanation}</p>
              </div>
            ))}
          </section>

          <hr className="divider" />

          <section>
            <div className="section-title">4. Key terms explained simply</div>
            {shown.key_terms.map((term) => (
              <div className="subcard" key={term.term}>
                <strong>{term.term}</strong>
                <p>{term.simple_explanation}</p>
                <p className="evidence">Example: {term.example}</p>
              </div>
            ))}
          </section>

          <hr className="divider" />

          <section>
            <div className="section-title">5. Questions they may ask</div>
            <h3>HR questions</h3>
            <ul>
              {shown.likely_questions.hr_questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
            <h3>Basic technical / role questions</h3>
            <ul>
              {shown.likely_questions.role_questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {!explanation && !loading && <p className="muted">Generate an explanation to see it here.</p>}
    </div>
  );
}
