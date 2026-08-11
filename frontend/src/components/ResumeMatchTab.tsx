import { useEffect, useState } from "react";
import { generateResumeMatch, listResumes, type ResumeMatch, type ResumeOut } from "../lib/api";

export default function ResumeMatchTab({
  jobId,
  match,
  onUpdated,
}: {
  jobId: string;
  match: ResumeMatch | null;
  onUpdated: (match: ResumeMatch) => void;
}) {
  const [resumes, setResumes] = useState<ResumeOut[]>([]);
  const [resumeId, setResumeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listResumes()
      .then((list) => {
        setResumes(list);
        if (list.length > 0) setResumeId(list[0].id);
      })
      .catch(() => setError("Failed to load resumes"));
  }, []);

  const handleGenerate = async () => {
    if (!resumeId) return;
    setError(null);
    setLoading(true);
    try {
      const analysis = await generateResumeMatch(jobId, resumeId);
      onUpdated(analysis.match_suggestions!);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate resume match");
    } finally {
      setLoading(false);
    }
  };

  if (resumes.length === 0) {
    return <p>Upload a resume above first.</p>;
  }

  return (
    <div>
      <select value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
        {resumes.map((resume) => (
          <option key={resume.id} value={resume.id}>
            {resume.label ?? resume.id}
          </option>
        ))}
      </select>
      <button type="button" onClick={handleGenerate} disabled={loading || !resumeId}>
        {loading ? "Generating..." : match ? "Regenerate" : "Generate match"}
      </button>

      {error && <p role="alert">{error}</p>}

      {match && (
        <div>
          <p>Match score: {match.match_score}/100</p>

          <h3>Matched skills</h3>
          <ul>
            {match.matched_skills.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h3>Missing skills</h3>
          <ul>
            {match.missing_skills.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h3>Suggestions</h3>
          <ul>
            {match.suggestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
