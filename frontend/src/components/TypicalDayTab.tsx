import { useState } from "react";
import { generateTypicalDay, type TypicalDay } from "../lib/api";

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
  onUpdated,
}: {
  jobId: string;
  typicalDay: TypicalDay | null;
  onUpdated: (typicalDay: TypicalDay) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);
    try {
      const analysis = await generateTypicalDay(jobId);
      onUpdated(analysis.typical_day!);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate typical day");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={loading}>
        {loading ? "Generating..." : typicalDay ? "Regenerate" : "Generate typical day"}
      </button>

      {error && <p className="alert" style={{ marginTop: 12 }}>{error}</p>}

      {typicalDay && (
        <div style={{ marginTop: 20 }}>
          <section>
            <div className="section-title">1. What your day probably looks like</div>
            <p>{typicalDay.overview}</p>
          </section>

          <hr className="divider" />

          <section>
            <div className="section-title">2. Day breakdown</div>
            {(["morning", "afternoon", "end_of_day"] as const).map((key) => {
              const period = typicalDay.day_breakdown[key];
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
                  <span className="progress-fill" style={{ width: `${typicalDay.time_allocation[key]}%` }} />
                </span>
                <span className="progress-value">{typicalDay.time_allocation[key]}%</span>
              </div>
            ))}
          </section>

          <hr className="divider" />

          <section>
            <div className="section-title">4. Who you will work with</div>
            {typicalDay.collaborators.map((collab) => (
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
              {typicalDay.surprises.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {!typicalDay && !loading && <p className="muted">Generate a typical day to see it here.</p>}
    </div>
  );
}
