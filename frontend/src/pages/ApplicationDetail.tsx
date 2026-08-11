import { useParams } from "react-router-dom";

export default function ApplicationDetail() {
  const { applicationId } = useParams();

  return (
    <div>
      <h1>Application {applicationId}</h1>
      <section>
        <h2>Timeline</h2>
        <p>Application timeline will appear here.</p>
      </section>
      <section>
        <h2>Job Description</h2>
        <p>Job description and position details will appear here.</p>
      </section>
      <section>
        <h2>Interview Prep</h2>
        <button>Generate interview questions</button>
        <p>Generated Q&amp;A per round will appear here.</p>
      </section>
    </div>
  );
}
