import { useState } from "react";
import LanguageSelect from "./LanguageSelect";
import { translateTypicalDay, type TypicalDay } from "../lib/api";

const TIME_ALLOCATION_LABELS: Record<keyof TypicalDay["time_allocation"], string> = {
  technical_development: "Technical / Development",
  meetings_communication: "Meetings",
  analysis_problem_solving: "Analysis / Problem Solving",
  testing_qa: "Testing / QA",
  documentation_administrative: "Documentation / Other",
  research_learning: "Research / Learning",
  other: "Other",
};

export default function TypicalDayTab({
  jobId,
  typicalDay,
  translations,
  onUpdated,
}: {
  jobId: string;
  typicalDay: TypicalDay | null;
  translations: Record<string, TypicalDay>;
  onUpdated: (typicalDay: TypicalDay, translations: Record<string, TypicalDay>) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState("");
  const [translating, setTranslating] = useState(false);

  const handleTranslate = async () => {
    if (!language.trim()) return;
    setError(null);
    setTranslating(true);
    try {
      const analysis = await translateTypicalDay(jobId, language.trim());
      onUpdated(analysis.typical_day!, analysis.typical_day_translations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to translate");
    } finally {
      setTranslating(false);
    }
  };

  const hasTranslation = !!language && !!translations[language];
  const shown = hasTranslation ? translations[language] : typicalDay;

  return (
    <div>
      {typicalDay && (
        <div className="form-row">
          <LanguageSelect value={language} onChange={setLanguage} translatedLanguages={Object.keys(translations)} />
          {language && !hasTranslation && (
            <button type="button" className="btn btn-secondary" onClick={handleTranslate} disabled={translating}>
              {translating ? "Translating..." : `Translate to ${language}`}
            </button>
          )}
        </div>
      )}

      {error && <p className="alert" style={{ marginTop: 12 }}>{error}</p>}

      {shown && (
        <div style={{ marginTop: 20 }}>
          <section>
            <div className="section-title">1. What your day probably looks like</div>
            <p>{shown.overview}</p>
          </section>

          <hr className="divider" />

          <section>
            <div className="section-title">2. Day breakdown</div>
            {(["morning", "afternoon", "end_of_day"] as const).map((key) => {
              const period = shown.day_breakdown[key];
              return (
                <div className="subcard" key={key}>
                  <h3>
                    {key === "end_of_day" ? "End of Day" : key[0].toUpperCase() + key.slice(1)} (
                    {period.approximate_time})
                  </h3>
                  <p>
                    <strong>{period.activity}</strong>
                  </p>
                  <p>{period.description}</p>
                  <p className="evidence">{period.rationale}</p>
                </div>
              );
            })}
          </section>

          <hr className="divider" />

          <section>
            <div className="section-title">3. What you will spend most time doing</div>
            {(Object.keys(TIME_ALLOCATION_LABELS) as Array<keyof TypicalDay["time_allocation"]>).map((key) => (
              <div className="progress-row" key={key}>
                <span className="progress-row-label">{TIME_ALLOCATION_LABELS[key]}</span>
                <span className="progress-track">
                  <span className="progress-fill" style={{ width: `${shown.time_allocation[key]}%` }} />
                </span>
                <span className="progress-value">{shown.time_allocation[key]}%</span>
              </div>
            ))}
          </section>

          <hr className="divider" />

          <section>
            <div className="section-title">4. Who you will work with</div>
            {shown.collaborators.map((collab) => (
              <div className="subcard" key={collab.who}>
                <strong>{collab.who}</strong>
                <p>{collab.why}</p>
                <p className="evidence">Example: {collab.example_interaction}</p>
              </div>
            ))}
          </section>

          <hr className="divider" />

          <section>
            <div className="section-title">5. What may surprise you about this job</div>
            <ul>
              {shown.surprises.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {!typicalDay && <p className="muted">Click Generate on the left to see this here.</p>}
    </div>
  );
}
