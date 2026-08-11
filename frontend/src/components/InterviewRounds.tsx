import { useEffect, useState } from "react";
import {
  createInterviewRound,
  generateInterviewQnA,
  listInterviewRounds,
  updateInterviewRound,
  type InterviewRoundOut,
  type RoundType,
} from "../lib/api";

const ROUND_TYPES: { value: RoundType; label: string }[] = [
  { value: "hr", label: "HR Screen" },
  { value: "hiring_manager", label: "Hiring Manager" },
  { value: "technical", label: "Technical" },
  { value: "other", label: "Other" },
];

export default function InterviewRounds({ applicationId }: { applicationId: string }) {
  const [rounds, setRounds] = useState<InterviewRoundOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const [roundType, setRoundType] = useState<RoundType>("hr");
  const [scheduledAt, setScheduledAt] = useState("");
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => {
    listInterviewRounds(applicationId)
      .then(setRounds)
      .catch(() => setError("Failed to load interview rounds"));
  };

  useEffect(load, [applicationId]);

  const handleCreate = async () => {
    setError(null);
    setCreating(true);
    try {
      await createInterviewRound({
        application_id: applicationId,
        round_type: roundType,
        scheduled_at: scheduledAt || undefined,
        link: link || undefined,
        notes: notes || undefined,
      });
      setScheduledAt("");
      setLink("");
      setNotes("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add round");
    } finally {
      setCreating(false);
    }
  };

  const handleGenerate = async (roundId: string) => {
    setError(null);
    setGeneratingId(roundId);
    try {
      const updated = await generateInterviewQnA(roundId);
      setRounds((prev) => prev.map((r) => (r.id === roundId ? updated : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate Q&A");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleNotesBlur = async (roundId: string, value: string) => {
    try {
      const updated = await updateInterviewRound(roundId, { notes: value });
      setRounds((prev) => prev.map((r) => (r.id === roundId ? updated : r)));
    } catch {
      // best-effort autosave
    }
  };

  return (
    <div>
      {error && <p className="alert" style={{ marginBottom: 12 }}>{error}</p>}

      {rounds.length === 0 && <p className="muted">No interview rounds yet.</p>}

      <div className="stack">
        {rounds.map((round) => (
          <div key={round.id} className="subcard">
            <div className="form-row" style={{ justifyContent: "space-between" }}>
              <strong>{ROUND_TYPES.find((t) => t.value === round.round_type)?.label ?? round.round_type}</strong>
              {round.scheduled_at && (
                <span className="muted">{new Date(round.scheduled_at).toLocaleString()}</span>
              )}
            </div>
            {round.link && (
              <p>
                <a href={round.link} target="_blank" rel="noreferrer">
                  Meeting link
                </a>
              </p>
            )}
            <textarea
              className="input"
              rows={2}
              placeholder="Notes from the recruiter call, process details..."
              defaultValue={round.notes ?? ""}
              onBlur={(e) => handleNotesBlur(round.id, e.target.value)}
            />

            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleGenerate(round.id)}
                disabled={generatingId === round.id}
              >
                {generatingId === round.id
                  ? "Generating..."
                  : round.generated_qna
                    ? "Regenerate interview questions"
                    : "Generate interview questions"}
              </button>
            </div>

            {round.generated_qna && (
              <div style={{ marginTop: 12 }}>
                {round.generated_qna.questions.map((qa, i) => (
                  <div key={i} className="subcard" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                    <p style={{ fontWeight: 700 }}>{qa.question}</p>
                    <p className="muted">{qa.suggested_answer}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <hr className="divider" />

      <div className="section-title">Add interview round</div>
      <div className="form-row">
        <select className="input" style={{ width: 160 }} value={roundType} onChange={(e) => setRoundType(e.target.value as RoundType)}>
          {ROUND_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          className="input"
          style={{ width: 200 }}
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
        <input
          className="input"
          style={{ width: 200 }}
          placeholder="Meeting link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={creating}>
          {creating ? "Adding..." : "Add round"}
        </button>
      </div>
    </div>
  );
}
