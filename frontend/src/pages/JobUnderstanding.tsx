import { useEffect, useState } from "react";
import JobExplanationTab from "../components/JobExplanationTab";
import TypicalDayTab from "../components/TypicalDayTab";
import { useChatScope } from "../context/ChatContext";
import {
  createJobDescription,
  generateFullAnalysis,
  type JobDescriptionOut,
  type JobExplanation,
  type TypicalDay,
} from "../lib/api";

type Tab = "explanation" | "typical_day";

export default function JobUnderstanding() {
  const { setScope } = useChatScope();
  const [tab, setTab] = useState<Tab>("explanation");

  const [jdText, setJdText] = useState("");
  const [jobDescription, setJobDescription] = useState<JobDescriptionOut | null>(null);
  const [jdError, setJdError] = useState<string | null>(null);

  const [explanation, setExplanation] = useState<JobExplanation | null>(null);
  const [translations, setTranslations] = useState<Record<string, JobExplanation>>({});
  const [typicalDay, setTypicalDay] = useState<TypicalDay | null>(null);
  const [typicalDayTranslations, setTypicalDayTranslations] = useState<Record<string, TypicalDay>>({});

  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setScope({ jobId: jobDescription?.id });
  }, [jobDescription, setScope]);

  const handleGenerate = async () => {
    if (!jdText.trim()) return;
    setJdError(null);
    setGenerating(true);
    try {
      const job = await createJobDescription({ raw_text: jdText });
      setJobDescription(job);
      setExplanation(null);
      setTranslations({});
      setTypicalDay(null);
      setTypicalDayTranslations({});

      const analysis = await generateFullAnalysis(job.id);
      setExplanation(analysis.explanation);
      setTranslations(analysis.translations);
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
            <textarea
              className="input jd-textarea"
              placeholder="Paste the job description here"
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
            />
            <div style={{ marginTop: 12, flexShrink: 0 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={!jdText.trim() || generating}
              >
                {generating ? "Generating..." : "Generate"}
              </button>
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
                      translations={translations}
                      onUpdated={(newExplanation, newTranslations) => {
                        setExplanation(newExplanation);
                        setTranslations(newTranslations);
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
