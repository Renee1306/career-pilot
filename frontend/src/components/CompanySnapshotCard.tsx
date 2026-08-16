import { useState } from "react";
import { generateCompanySnapshot, type ApplicationOut } from "../lib/api";

export default function CompanySnapshotCard({
  application,
  onUpdated,
}: {
  application: ApplicationOut;
  onUpdated: (app: ApplicationOut) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await generateCompanySnapshot(application.id);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate company snapshot");
    } finally {
      setLoading(false);
    }
  };

  const snapshot = application.company_snapshot;

  // Renders bare (no wrapping .card) - ApplicationDetail hosts this inside a tabbed card
  // alongside InterviewQuestionsCard, so wrapping here would nest a card inside a card.
  return (
    <div>
      <div style={{ marginBottom: snapshot ? 14 : 0 }}>
        <div className="form-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleGenerate} disabled={loading}>
            {loading ? "Generating..." : snapshot ? "Regenerate" : "Generate"}
          </button>
        </div>
        <p className="muted" style={{ fontSize: 11.5, marginTop: 4, textAlign: "right" }}>
          Usually takes about 10 seconds.
        </p>
      </div>

      {error && (
        <p className="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}

      {!snapshot && !loading && (
        <p className="muted">
          Get a quick AI-generated orientation to {application.company || "this company"} before you prep —
          what they do, their scale, and their culture.
        </p>
      )}

      {snapshot && (
        <div>
          {snapshot.what_they_do && (
            <>
              <div className="section-title">What They Do</div>
              <p style={{ marginTop: 0 }}>{snapshot.what_they_do}</p>
              {(snapshot.products_services?.length ?? 0) > 0 && (
                <ul style={{ marginTop: 0, paddingLeft: 20, marginBottom: 14 }}>
                  {snapshot.products_services!.map((item, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {snapshot.industry && (
            <>
              <div className="section-title">Industry</div>
              <p style={{ marginTop: 0, marginBottom: 14 }}>{snapshot.industry}</p>
            </>
          )}

          {(snapshot.scale_regions ||
            snapshot.scale_employees ||
            snapshot.scale_customer_base ||
            snapshot.scale_market_position) && (
            <>
              <div className="section-title">Scale</div>
              <ul style={{ marginTop: 0, paddingLeft: 20, marginBottom: 14 }}>
                {snapshot.scale_regions && <li style={{ marginBottom: 4 }}>Regions: {snapshot.scale_regions}</li>}
                {snapshot.scale_employees && (
                  <li style={{ marginBottom: 4 }}>Employees: {snapshot.scale_employees}</li>
                )}
                {snapshot.scale_customer_base && (
                  <li style={{ marginBottom: 4 }}>Customers: {snapshot.scale_customer_base}</li>
                )}
                {snapshot.scale_market_position && (
                  <li style={{ marginBottom: 4 }}>Market position: {snapshot.scale_market_position}</li>
                )}
              </ul>
            </>
          )}

          {((snapshot.core_business_areas?.length ?? 0) > 0 || (snapshot.core_products?.length ?? 0) > 0) && (
            <>
              <div className="section-title">Core Business / Products</div>
              {(snapshot.core_business_areas?.length ?? 0) > 0 && (
                <div
                  className="pill-list"
                  style={{ marginBottom: (snapshot.core_products?.length ?? 0) > 0 ? 8 : 14 }}
                >
                  {snapshot.core_business_areas!.map((area, i) => (
                    <span key={i} className="badge badge-muted">
                      {area}
                    </span>
                  ))}
                </div>
              )}
              {(snapshot.core_products?.length ?? 0) > 0 && (
                <ul style={{ marginTop: 0, paddingLeft: 20, marginBottom: 14 }}>
                  {snapshot.core_products!.map((item, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <div className="section-title">Culture</div>
          <p style={{ marginTop: 0 }}>{snapshot.culture}</p>

          <div className="section-title">Core Values</div>
          <div className="pill-list">
            {snapshot.core_values.map((value, i) => (
              <span key={i} className="badge badge-primary">
                {value}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
