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
      <button type="button" onClick={handleGenerate} disabled={loading}>
        {loading ? "Generating..." : typicalDay ? "Regenerate" : "Generate typical day"}
      </button>

      {error && <p role="alert">{error}</p>}

      {typicalDay && (
        <div>
          <section>
            <h2>1. What your day probably looks like</h2>
            <p>{typicalDay.overview}</p>
          </section>

          <section>
            <h2>2. Day breakdown</h2>
            {(["morning", "afternoon", "end_of_day"] as const).map((key) => {
              const period = typicalDay.day_breakdown[key];
              return (
                <div key={key}>
                  <h3>
                    {key === "end_of_day" ? "End of Day" : key[0].toUpperCase() + key.slice(1)} (
                    {period.approximate_time})
                  </h3>
                  <p>
                    <strong>{period.activity}</strong>
                  </p>
                  <p>{period.description}</p>
                  <p>
                    <em>{period.rationale}</em>
                  </p>
                </div>
              );
            })}
          </section>

          <section>
            <h2>3. What you will spend most time doing</h2>
            <ul>
              {(Object.keys(TIME_ALLOCATION_LABELS) as Array<keyof TypicalDay["time_allocation"]>).map((key) => (
                <li key={key}>
                  {TIME_ALLOCATION_LABELS[key]}: {typicalDay.time_allocation[key]}%
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2>4. Who you will work with</h2>
            {typicalDay.collaborators.map((collab) => (
              <div key={collab.who}>
                <strong>{collab.who}</strong>
                <p>{collab.why}</p>
                <p>
                  <em>Example: {collab.example_interaction}</em>
                </p>
              </div>
            ))}
          </section>

          <section>
            <h2>5. What may surprise you about this job</h2>
            <ul>
              {typicalDay.surprises.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {!typicalDay && !loading && <p>Generate a typical day to see it here.</p>}
    </div>
  );
}
