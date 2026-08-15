import { useEffect, useState } from "react";
import JobExplanationTab from "../components/JobExplanationTab";
import TypicalDayTab from "../components/TypicalDayTab";
import {
  createJobDescription,
  generateFullAnalysis,
  getAnalysis,
  jobOptionLabel,
  listJobDescriptions,
  type JobDescriptionOut,
  type JobExplanation,
  type TypicalDay,
} from "../lib/api";

type Tab = "explanation" | "typical_day";

export default function JobUnderstanding() {
  const [tab, setTab] = useState<Tab>("explanation");

  const [savedJobs, setSavedJobs] = useState<JobDescriptionOut[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [loadingSaved, setLoadingSaved] = useState(false);

  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [jdText, setJdText] = useState("");
  const [jobDescription, setJobDescription] = useState<JobDescriptionOut | null>(null);
  const [jdError, setJdError] = useState<string | null>(null);

  const [explanation, setExplanation] = useState<JobExplanation | null>(null);
  const [explanationTranslations, setExplanationTranslations] = useState<Record<string, JobExplanation>>({});
  const [typicalDay, setTypicalDay] = useState<TypicalDay | null>(null);
  const [typicalDayTranslations, setTypicalDayTranslations] = useState<Record<string, TypicalDay>>({});

  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    listJobDescriptions()
      .then(setSavedJobs)
      .catch(() => {});
  }, []);

  // Company/position are only ever saved at creation time - there's no endpoint to patch them
  // onto an already-saved job description - so once the loaded text matches a saved entry
  // exactly, editing these fields wouldn't do anything. Locking them is more honest than letting
  // the user type into a field that silently doesn't save.
  const isExistingJob = jobDescription !== null && jobDescription.raw_text === jdText;

  const handlePickSaved = async (jobId: string) => {
    const picked = savedJobs.find((j) => j.id === jobId);
    if (!picked) return;

    setSelectedJobId(jobId);
    setJdText(picked.raw_text);
    setCompany(picked.company ?? "");
    setPosition(picked.title ?? "");
    setJobDescription(picked);
    setJdError(null);

    // Show whatever was generated for this job before, without spending a fresh generation on
    // a job the user has already analyzed - Generate/Regenerate is still right there if they want
    // a fresh pass.
    setLoadingSaved(true);
    try {
      const analysis = await getAnalysis(picked.id);
      setExplanation(analysis?.explanation ?? null);
      setExplanationTranslations(analysis?.explanation_translations ?? {});
      setTypicalDay(analysis?.typical_day ?? null);
      setTypicalDayTranslations(analysis?.typical_day_translations ?? {});
    } catch {
      setExplanation(null);
      setExplanationTranslations({});
      setTypicalDay(null);
      setTypicalDayTranslations({});
    } finally {
      setLoadingSaved(false);
    }
  };

  const handleGenerate = async () => {
    if (!jdText.trim()) return;
    setJdError(null);
    setGenerating(true);
    try {
      // Reuse the already-saved row when the text hasn't changed since it was picked/created,
      // rather than saving a duplicate job description for text already on file.
      const reusing = jobDescription !== null && jobDescription.raw_text === jdText;
      const job = reusing
        ? jobDescription!
        : await createJobDescription({
            raw_text: jdText,
            company: company.trim() || undefined,
            title: position.trim() || undefined,
          });

      if (!reusing) {
        setJobDescription(job);
        setSelectedJobId(job.id);
        setSavedJobs((prev) => [job, ...prev]);
        setExplanation(null);
        setExplanationTranslations({});
        setTypicalDay(null);
        setTypicalDayTranslations({});
      }

      const analysis = await generateFullAnalysis(job.id);
      setExplanation(analysis.explanation);
      setExplanationTranslations(analysis.explanation_translations);
      setTypicalDay(analysis.typical_day);
      setTypicalDayTranslations(analysis.typical_day_translations);
    } catch (err) {
      setJdError(err instanceof Error ? err.message : "Failed to generate analysis");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="page-fill">
      <div className="page-header">
        <div>
          <h1>Job Analysis</h1>
          <p className="muted">Paste a job description to understand the role.</p>
        </div>
      </div>

      <div className="split-layout">
        <div className="split-layout-left">
          <div className="card">
            <h2>Job Description</h2>

            {savedJobs.length > 0 && (
              <div className="field">
                <label htmlFor="ju-saved-jd">Use a previous job description</label>
                <select
                  id="ju-saved-jd"
                  className="input"
                  value={selectedJobId}
                  onChange={(e) => handlePickSaved(e.target.value)}
                  disabled={generating || loadingSaved}
                >
                  <option value="">Choose one...</option>
                  {savedJobs.map((saved) => (
                    <option key={saved.id} value={saved.id}>
                      {jobOptionLabel(saved)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-row" style={{ gap: 10 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="ju-company">Company</label>
                <input
                  id="ju-company"
                  className="input"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  disabled={isExistingJob}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="ju-position">Position</label>
                <input
                  id="ju-position"
                  className="input"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="e.g. Software Engineer"
                  disabled={isExistingJob}
                />
              </div>
            </div>
            {isExistingJob && (company || position) && (
              <p className="muted" style={{ fontSize: 11.5, marginTop: -6, marginBottom: 10 }}>
                Set when this job description was first saved - edit the text below to save it as a
                new entry instead.
              </p>
            )}

            <label htmlFor="ju-jd-text" className="muted" style={{ fontSize: 12.5, display: "block", marginBottom: 4 }}>
              {savedJobs.length > 0 ? "Or paste a new job description" : "Job description"}
            </label>
            <textarea
              id="ju-jd-text"
              className="input jd-textarea"
              placeholder="Paste the job description here"
              value={jdText}
              onChange={(e) => {
                setJdText(e.target.value);
                setSelectedJobId("");
              }}
            />
            <div style={{ marginTop: 12, flexShrink: 0 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={!jdText.trim() || generating || loadingSaved}
              >
                {generating ? "Generating..." : isExistingJob ? "Regenerate" : "Generate"}
              </button>
              <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                Usually takes about 20 seconds - it runs both tabs at once.
              </p>
            </div>
            {jdError && <p className="alert" style={{ marginTop: 10 }}>{jdError}</p>}
          </div>
        </div>

        <div className="split-layout-right">
          <div className="card analysis-card">
            <div className="tabs">
              <button
                className={"tab-button" + (tab === "explanation" ? " active" : "")}
                onClick={() => setTab("explanation")}
              >
                Job Explanation
              </button>
              <button
                className={"tab-button" + (tab === "typical_day" ? " active" : "")}
                onClick={() => setTab("typical_day")}
              >
                Typical Day
              </button>
            </div>

            <div className="analysis-scroll">
              {jobDescription ? (
                <>
                  {tab === "explanation" && (
                    <JobExplanationTab
                      jobId={jobDescription.id}
                      explanation={explanation}
                      translations={explanationTranslations}
                      onUpdated={(newExplanation, newTranslations) => {
                        setExplanation(newExplanation);
                        setExplanationTranslations(newTranslations);
                      }}
                    />
                  )}
                  {tab === "typical_day" && (
                    <TypicalDayTab
                      jobId={jobDescription.id}
                      typicalDay={typicalDay}
                      translations={typicalDayTranslations}
                      onUpdated={(newTypicalDay, newTranslations) => {
                        setTypicalDay(newTypicalDay);
                        setTypicalDayTranslations(newTranslations);
                      }}
                    />
                  )}
                </>
              ) : (
                <p className="muted">Paste a job description and click Generate to see this here.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
