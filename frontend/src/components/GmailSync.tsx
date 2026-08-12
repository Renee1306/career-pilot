import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import IconPopover from "./IconPopover";
import { getGmailConnectUrl, getGmailStatus, syncGmail, type GmailSyncStatus } from "../lib/api";

function IconMail() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  );
}

export default function GmailSync({ onApplicationsChanged }: { onApplicationsChanged: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<GmailSyncStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<{ jobRelated: number; scanned: number } | null>(null);

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

  // Sync writes happen server-side now (new/matched applications and their timeline entries are
  // created directly in sync_gmail) - the frontend just triggers the sync and reports the summary.
  const handleSync = async () => {
    setError(null);
    setSyncing(true);
    try {
      const result = await syncGmail();
      const jobRelated = result.detected.length;
      setLastResult({ jobRelated, scanned: result.scanned });
      if (jobRelated > 0) onApplicationsChanged();
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} — some updates may still have been applied; check the board below.`
          : "Sync failed"
      );
    } finally {
      // Always refresh, including on failure. sync_gmail writes each application/timeline entry as
      // it goes, so a request that dies in flight (long sync, dropped connection) still leaves real
      // changes in the DB - the old code only refreshed on success, which is why a failed sync
      // looked like it did nothing until the user manually reloaded the page.
      loadStatus();
      onApplicationsChanged();
      setSyncing(false);
    }
  };

  return (
    <IconPopover icon={<IconMail />} title="Gmail sync" dot={status?.connected ? "success" : null}>
      {() => (
        <div>
          <div className="section-title">Gmail Sync</div>
          {error && <p className="alert" style={{ marginBottom: 10 }}>{error}</p>}

          {!status ? (
            <p className="muted">Loading...</p>
          ) : status.connected ? (
            <div>
              <p className="muted" style={{ fontSize: 13 }}>
                Connected as {status.google_email}
                {status.last_synced_at && ` — last synced ${new Date(status.last_synced_at).toLocaleString()}`}
              </p>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleSync} disabled={syncing}>
                {syncing ? "Scanning inbox..." : "Sync now"}
              </button>
              {lastResult && (
                <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                  Scanned {lastResult.scanned} new email{lastResult.scanned === 1 ? "" : "s"} —{" "}
                  {lastResult.jobRelated} job-related update{lastResult.jobRelated === 1 ? "" : "s"} applied to
                  your applications.
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="muted" style={{ fontSize: 13 }}>
                Connect Gmail to auto-detect application updates from your inbox.
              </p>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleConnect} disabled={connecting}>
                {connecting ? "Redirecting..." : "Connect Gmail"}
              </button>
            </div>
          )}
        </div>
      )}
    </IconPopover>
  );
}
