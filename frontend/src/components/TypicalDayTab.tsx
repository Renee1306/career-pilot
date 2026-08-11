import { useState } from "react";
import { generateTypicalDay, type TypicalDay } from "../lib/api";

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
          <p>{typicalDay.summary}</p>
          {typicalDay.schedule.map((block) => (
            <div key={block.time_block}>
              <h3>{block.time_block}</h3>
              <p>{block.activities}</p>
            </div>
          ))}
        </div>
      )}

      {!typicalDay && !loading && <p>Generate a typical day to see it here.</p>}
    </div>
  );
}
