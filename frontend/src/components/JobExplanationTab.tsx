import { useState } from "react";
import LanguageSelect from "./LanguageSelect";
import { translateExplanation, type JobExplanation } from "../lib/api";

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
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState("");
  const [translating, setTranslating] = useState(false);

  const handleTranslate = async () => {
    if (!language.trim()) return;
    setError(null);
    setTranslating(true);
    try {
      const analysis = await translateExplanation(jobId, language.trim());
      onUpdated(analysis.explanation!, analysis.explanation_translations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to translate");
    } finally {
      setTranslating(false);
    }
  };

  const hasTranslation = !!language && !!translations[language];
  const shown = hasTranslation ? translations[language] : explanation;

  return (
    <div>
      {explanation && (
        <div className="form-row">
          <LanguageSelect value={language} onChange={setLanguage} translatedLanguages={Object.keys(translations)} />
          {language && !hasTranslation && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTranslate}
              disabled={translating}
            >
              {translating ? "Translating..." : `Translate to ${language}`}
            </button>
          )}
        </div>
      )}

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
            <div className="section-title">5. Questions they may ask about this role</div>
            <ul>
              {/* Falls back to [] for analyses generated before role_questions moved onto
                  JobExplanation directly - older rows still carry the retired
                  likely_questions.role_questions shape instead. */}
              {(shown.role_questions ?? []).map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {!explanation && <p className="muted">Click Generate on the left to see this here.</p>}
    </div>
  );
}
