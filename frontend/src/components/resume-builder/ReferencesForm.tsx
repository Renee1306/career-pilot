import type { ReferenceEntry } from "../../lib/api";

function newEntry(): ReferenceEntry {
  return { id: crypto.randomUUID(), name: "", relationship: "", contact: "", description: "" };
}

export default function ReferencesForm({
  entries,
  onChange,
}: {
  entries: ReferenceEntry[];
  onChange: (entries: ReferenceEntry[]) => void;
}) {
  const update = (id: string, patch: Partial<ReferenceEntry>) =>
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
        <div key={entry.id} className="subcard">
          <div className="form-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <span className="section-title" style={{ margin: 0 }}>
              Reference {index + 1}
            </span>
            <div className="form-row" style={{ gap: 4 }}>
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
          </div>
          <div className="form-row">
            <div className="field" style={{ flex: 1 }}>
              <label>Name</label>
              <input className="input" value={entry.name} onChange={(e) => update(entry.id, { name: e.target.value })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Relationship</label>
              <input
                className="input"
                value={entry.relationship}
                onChange={(e) => update(entry.id, { relationship: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label>Contact</label>
            <input
              className="input"
              value={entry.contact}
              onChange={(e) => update(entry.id, { contact: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Note</label>
            <textarea
              className="input"
              rows={2}
              value={entry.description}
              onChange={(e) => update(entry.id, { description: e.target.value })}
            />
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...entries, newEntry()])}>
        + Add reference
      </button>
    </div>
  );
}
