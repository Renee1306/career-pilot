import type { AwardEntry } from "../../lib/api";

function newEntry(): AwardEntry {
  return { id: crypto.randomUUID(), title: "", awarder: "", date: "", website: "", description: "" };
}

export default function AwardsForm({
  entries,
  onChange,
}: {
  entries: AwardEntry[];
  onChange: (entries: AwardEntry[]) => void;
}) {
  const update = (id: string, patch: Partial<AwardEntry>) =>
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
              Award {index + 1}
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
              <label>Title</label>
              <input
                className="input"
                value={entry.title}
                onChange={(e) => update(entry.id, { title: e.target.value })}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Awarder</label>
              <input
                className="input"
                value={entry.awarder}
                onChange={(e) => update(entry.id, { awarder: e.target.value })}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="field" style={{ flex: 1 }}>
              <label>Date</label>
              <input className="input" value={entry.date} onChange={(e) => update(entry.id, { date: e.target.value })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Website</label>
              <input
                className="input"
                value={entry.website ?? ""}
                onChange={(e) => update(entry.id, { website: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              className="input"
              rows={3}
              value={entry.description}
              onChange={(e) => update(entry.id, { description: e.target.value })}
            />
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...entries, newEntry()])}>
        + Add award
      </button>
    </div>
  );
}
