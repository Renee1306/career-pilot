import type { CertificateEntry } from "../../lib/api";

function newEntry(): CertificateEntry {
  return { id: crypto.randomUUID(), name: "", date: "" };
}

export default function CertificatesForm({
  entries,
  onChange,
}: {
  entries: CertificateEntry[];
  onChange: (entries: CertificateEntry[]) => void;
}) {
  const update = (id: string, patch: Partial<CertificateEntry>) =>
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const remove = (id: string) => onChange(entries.filter((e) => e.id !== id));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= entries.length) return;
    const next = [...entries];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div>
      {entries.map((entry, index) => (
        <div key={entry.id} className="form-row" style={{ marginBottom: 10, alignItems: "flex-end" }}>
          <div className="field" style={{ flex: 2, marginBottom: 0 }}>
            <label>Name</label>
            <input
              className="input"
              value={entry.name}
              onChange={(e) => update(entry.id, { name: e.target.value })}
            />
          </div>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>Date</label>
            <input
              className="input"
              value={entry.date}
              onChange={(e) => update(entry.id, { date: e.target.value })}
            />
          </div>
          <button
            type="button"
            className="builder-reorder-btn"
            disabled={index === 0}
            onClick={() => move(index, -1)}
            title="Move up"
          >
            ▲
          </button>
          <button
            type="button"
            className="builder-reorder-btn"
            disabled={index === entries.length - 1}
            onClick={() => move(index, 1)}
            title="Move down"
          >
            ▼
          </button>
          <button type="button" className="link-button" onClick={() => remove(entry.id)}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...entries, newEntry()])}>
        + Add certificate
      </button>
    </div>
  );
}
