import { useState } from "react";

type Tab = "explanation" | "typical_day" | "resume_match";

export default function JobUnderstanding() {
  const [tab, setTab] = useState<Tab>("explanation");

  return (
    <div>
      <h1>Understand a Job</h1>
      <p>Upload a resume and job description to get started.</p>

      <nav>
        <button onClick={() => setTab("explanation")} disabled={tab === "explanation"}>
          Job Explanation
        </button>
        <button onClick={() => setTab("typical_day")} disabled={tab === "typical_day"}>
          Typical Day
        </button>
        <button onClick={() => setTab("resume_match")} disabled={tab === "resume_match"}>
          Resume Match
        </button>
      </nav>

      {tab === "explanation" && <p>Job explanation will appear here.</p>}
      {tab === "typical_day" && <p>A typical day for this role will appear here.</p>}
      {tab === "resume_match" && <p>Resume match suggestions will appear here.</p>}
    </div>
  );
}
