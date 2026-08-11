import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  createApplication,
  getGmailConnectUrl,
  getGmailStatus,
  syncGmail,
  updateApplication,
  type DetectedUpdate,
  type GmailSyncStatus,
} from "../lib/api";

export default function GmailSync({ onApplicationsChanged }: { onApplicationsChanged: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<GmailSyncStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [detected, setDetected] = useState<DetectedUpdate[] | null>(null);
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const loadStatus = () => {
    getGmailStatus()
      .then(setStatus)
      .catch(() => setError("Failed to load Gmail status"));
  };

  useEffect(loadStatus, []);

  useEffect(() => {
    if (searchParams.get("gmail_connected")) {
      loadStatus();
      setSearchParams({}, { replace: true });
    } else if (searchParams.get("gmail_error")) {
      setError(`Gmail connection failed: ${searchParams.get("gmail_error")}`);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleConnect = async () => {
    setError(null);
    setConnecting(true);
    try {
      const url = await getGmailConnectUrl();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start Gmail connection");
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    setError(null);
    setSyncing(true);
    try {
      const result = await syncGmail();
      setDetected(result.detected);
      setResolved(new Set());
      loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleAccept = async (update: DetectedUpdate) => {
    try {
      if (update.suggested_action === "update_status" && update.matching_application_id && update.detected_status) {
        await updateApplication(update.matching_application_id, { status: update.detected_status });
      } else if (update.suggested_action === "create_application") {
        await createApplication({ status: update.detected_status ?? "applied" });
      }
      setResolved((prev) => new Set(prev).add(update.gmail_message_id));
      onApplicationsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply update");
    }
  };

  const handleDismiss = (update: DetectedUpdate) => {
    setResolved((prev) => new Set(prev).add(update.gmail_message_id));
  };

  return (
    <div className="card">
      <h2>Gmail Sync</h2>
      {error && <p className="alert">{error}</p>}

      {!status ? (
        <p className="muted">Loading...</p>
      ) : status.connected ? (
        <div>
          <p className="muted">
            Connected as {status.google_email}
            {status.last_synced_at && ` — last synced ${new Date(status.last_synced_at).toLocaleString()}`}
          </p>
          <button type="button" className="btn btn-primary" onClick={handleSync} disabled={syncing}>
            {syncing ? "Scanning inbox..." : "Sync now"}
          </button>
        </div>
      ) : (
        <div>
          <p className="muted">Connect Gmail to auto-detect application updates from your inbox.</p>
          <button type="button" className="btn btn-primary" onClick={handleConnect} disabled={connecting}>
            {connecting ? "Redirecting..." : "Connect Gmail"}
          </button>
        </div>
      )}

      {detected && (
        <div style={{ marginTop: 16 }}>
          <div className="section-title">
            Detected {detected.length} update{detected.length === 1 ? "" : "s"}
          </div>
          {detected.length === 0 && <p className="muted">No application-related emails found.</p>}
          <div className="stack">
            {detected
              .filter((u) => !resolved.has(u.gmail_message_id))
              .map((update) => (
                <div key={update.gmail_message_id} className="subcard">
                  <p style={{ fontWeight: 700 }}>{update.subject}</p>
                  <p className="muted">{update.snippet}</p>
                  <p>
                    {update.company && <span className="badge badge-primary">{update.company}</span>}{" "}
                    {update.detected_status && <span className="badge badge-muted">{update.detected_status}</span>}
                  </p>
                  <p className="evidence">{update.reasoning}</p>
                  <div className="form-row">
                    {update.suggested_action !== "ignore" && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => handleAccept(update)}>
                        {update.suggested_action === "create_application" ? "Track this application" : "Update status"}
                      </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDismiss(update)}>
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
