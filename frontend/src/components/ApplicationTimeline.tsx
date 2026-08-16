import { useState } from "react";
import ConfirmDialog from "./ConfirmDialog";
import {
  createTimelineEntry,
  deleteTimelineEntry,
  updateTimelineEntry,
  type ApplicationOut,
  type TimelineEntryOut,
  type TimelineEntryType,
} from "../lib/api";

const TYPE_LABELS: Record<TimelineEntryType, string> = {
  applied: "Applied",
  rejected: "Rejected",
  interview: "Interview",
  case_study: "Case Study",
  note: "Note",
};

interface EntryFormData {
  occurred_at?: string;
  content: string;
  details: Record<string, unknown>;
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EntryForm({
  entryType,
  initial,
  onCancel,
  onSubmit,
  submitting,
}: {
  entryType: TimelineEntryType;
  initial?: TimelineEntryOut;
  onCancel: () => void;
  onSubmit: (data: EntryFormData) => void;
  submitting: boolean;
}) {
  const [occurredAt, setOccurredAt] = useState(
    toLocalInputValue(initial?.occurred_at ?? new Date().toISOString())
  );
  const [content, setContent] = useState(initial?.content ?? "");
  const [meetingLink, setMeetingLink] = useState(initial?.details.meeting_link ?? "");
  const [deadline, setDeadline] = useState(
    initial?.details.deadline ? toLocalInputValue(initial.details.deadline) : ""
  );

  const handleSubmit = () => {
    const details: Record<string, unknown> = {};
    if (entryType === "interview" && meetingLink.trim()) details.meeting_link = meetingLink.trim();
    if (entryType === "case_study" && deadline) details.deadline = new Date(deadline).toISOString();
    onSubmit({
      occurred_at: occurredAt ? new Date(occurredAt).toISOString() : undefined,
      content,
      details,
    });
  };

  const contentLabel =
    entryType === "applied"
      ? 'Note (e.g. "via LinkedIn")'
      : entryType === "rejected"
        ? "Note (optional)"
        : "Notes";

  return (
    <div className="subcard">
      <div className="field">
        <label>{entryType === "case_study" ? "Logged date" : "Date & time"}</label>
        <input
          type="datetime-local"
          className="input"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
        />
      </div>
      {entryType === "interview" && (
        <div className="field">
          <label>Meeting link</label>
          <input
            className="input"
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
            placeholder="https://..."
          />
        </div>
      )}
      {entryType === "case_study" && (
        <div className="field">
          <label>Deadline</label>
          <input type="datetime-local" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
      )}
      <div className="field">
        <label>{contentLabel}</label>
        <textarea
          className="input"
          rows={entryType === "case_study" ? 4 : 2}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      <div className="form-row">
        <button type="button" className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Saving..." : "Save"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ApplicationTimeline({
  applicationId,
  entries,
  onChanged,
}: {
  applicationId: string;
  entries: TimelineEntryOut[];
  onChanged: (app: ApplicationOut) => void;
}) {
  const [addingType, setAddingType] = useState<TimelineEntryType | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleAdd = async (entryType: TimelineEntryType, data: EntryFormData) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await createTimelineEntry(applicationId, { entry_type: entryType, ...data });
      onChanged(updated);
      setAddingType(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add entry");
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = async (entryId: string, data: EntryFormData) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateTimelineEntry(applicationId, entryId, data);
      onChanged(updated);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update entry");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await deleteTimelineEntry(applicationId, pendingDeleteId);
      onChanged(updated);
      setPendingDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete entry");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {error && (
        <p className="alert" style={{ marginBottom: 10 }}>
          {error}
        </p>
      )}

      {entries.length === 0 && !addingType && <p className="muted">No timeline entries yet.</p>}

      <ul className="stack" style={{ listStyle: "none", padding: 0, marginBottom: 14 }}>
        {entries.map((entry) =>
          editingId === entry.id ? (
            <li key={entry.id}>
              <EntryForm
                entryType={entry.entry_type}
                initial={entry}
                submitting={busy}
                onCancel={() => setEditingId(null)}
                onSubmit={(data) => handleEdit(entry.id, data)}
              />
            </li>
          ) : (
            <li key={entry.id} className="subcard">
              <div className="form-row" style={{ justifyContent: "space-between" }}>
                <span className="badge badge-primary">{TYPE_LABELS[entry.entry_type]}</span>
                <span className="muted" style={{ fontSize: 12 }}>
                  {new Date(entry.occurred_at).toLocaleString()}
                  {entry.source === "gmail" && " · via Gmail"}
                </span>
              </div>
              {entry.content && <p style={{ margin: "6px 0" }}>{entry.content}</p>}
              {entry.details.meeting_link && (
                <a href={entry.details.meeting_link} target="_blank" rel="noreferrer" className="link-button">
                  Join meeting
                </a>
              )}
              {entry.details.deadline && (
                <p className="muted" style={{ fontSize: 12 }}>
                  Due: {new Date(entry.details.deadline).toLocaleString()}
                </p>
              )}
              {entry.details.attachments && entry.details.attachments.length > 0 && (
                <div className="stack" style={{ gap: 4, marginTop: 6 }}>
                  {entry.details.attachments.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer" className="link-button">
                      📎 {a.filename}
                    </a>
                  ))}
                </div>
              )}
              <div className="form-row" style={{ marginTop: 8, gap: 8 }}>
                <button type="button" className="link-button" onClick={() => setEditingId(entry.id)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="link-button"
                  style={{ color: "var(--color-danger)" }}
                  onClick={() => setPendingDeleteId(entry.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          )
        )}
      </ul>

      {addingType ? (
        <EntryForm
          entryType={addingType}
          submitting={busy}
          onCancel={() => setAddingType(null)}
          onSubmit={(data) => handleAdd(addingType, data)}
        />
      ) : (
        <div className="form-row" style={{ flexWrap: "wrap", gap: 8 }}>
          {(Object.keys(TYPE_LABELS) as TimelineEntryType[]).map((t) => (
            <button key={t} type="button" className="btn btn-ghost btn-sm" onClick={() => setAddingType(t)}>
              + {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      {pendingDeleteId && (
        <ConfirmDialog
          title="Delete this timeline entry?"
          message="This entry will be permanently removed from the timeline."
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  );
}
