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
      <button type="button" onClick={handleGenerate} disabled={loading}>
        {loading ? "Generating..." : explanation ? "Regenerate explanation" : "Generate explanation"}
      </button>

      {explanation && (
        <div>
          <input
            placeholder="Translate to (e.g. Spanish)"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          />
          <button type="button" onClick={handleTranslate} disabled={translating || !language.trim()}>
            {translating ? "Translating..." : "Translate"}
          </button>
        </div>
      )}

      {error && <p role="alert">{error}</p>}

      {shown && (
        <div>
          <section>
            <h2>1. Understand this job in 1 sentence</h2>
            <p>{shown.one_sentence_summary}</p>
          </section>

          <section>
            <h2>2. Top 3 things you will do</h2>
            {shown.top_responsibilities.map((item) => (
              <div key={item.responsibility}>
                <h3>{item.responsibility}</h3>
                <p>{item.simple_explanation}</p>
                <p>
                  <em>Example: {item.example}</em>
                </p>
              </div>
            ))}
          </section>

          <section>
            <h2>3. What do they really require?</h2>

            <h3>🔴 Hard requirement</h3>
            {shown.requirements.hard_requirements.map((req) => (
              <div key={req.requirement}>
                <strong>{req.requirement}</strong>
                <p>{req.why_it_matters}</p>
                <p>
                  <em>Evidence: "{req.evidence}"</em>
                </p>
                <p>{req.explanation}</p>
              </div>
            ))}

            <h3>🟡 Can be learned / trained</h3>
            {shown.requirements.learnable.map((req) => (
              <div key={req.requirement}>
                <strong>{req.requirement}</strong>
                <p>{req.why_it_matters}</p>
                <p>
                  <em>Evidence: "{req.evidence}"</em>
                </p>
                <p>{req.explanation}</p>
              </div>
            ))}

            <h3>🟢 Bonus point</h3>
            {shown.requirements.bonus.map((req) => (
              <div key={req.requirement}>
                <strong>{req.requirement}</strong>
                <p>{req.why_it_matters}</p>
                <p>
                  <em>Evidence: "{req.evidence}"</em>
                </p>
                <p>{req.explanation}</p>
              </div>
            ))}
          </section>

          <section>
            <h2>4. Key terms explained simply</h2>
            {shown.key_terms.map((term) => (
              <div key={term.term}>
                <strong>{term.term}</strong>
                <p>{term.simple_explanation}</p>
                <p>
                  <em>Example: {term.example}</em>
                </p>
              </div>
            ))}
          </section>

          <section>
            <h2>5. Questions they may ask</h2>
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

      {!explanation && !loading && <p>Generate an explanation to see it here.</p>}
    </div>
  );
}
