import { Link } from "react-router-dom";

export default function Applications() {
  return (
    <div>
      <h1>Applications</h1>
      <p>Applied · Pending Interview · Offer · Rejected</p>
      <p>
        No applications yet. <Link to="/">Analyze a job</Link> to get started.
      </p>
    </div>
  );
}
