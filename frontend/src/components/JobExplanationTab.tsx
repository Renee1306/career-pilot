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
          <p>{shown.overview}</p>

          <h3>Key responsibilities</h3>
          <ul>
            {shown.key_responsibilities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h3>Key skills</h3>
          <ul>
            {shown.key_skills.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h3>Examples</h3>
          <ul>
            {shown.examples.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h3>Who thrives in this role</h3>
          <p>{shown.who_thrives}</p>
        </div>
      )}

      {!explanation && !loading && <p>Generate an explanation to see it here.</p>}
    </div>
  );
}
