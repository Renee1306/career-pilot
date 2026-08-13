import type { EducationEntry } from "../../lib/api";

function newEntry(): EducationEntry {
  return {
    id: crypto.randomUUID(),
    school: "",
    major: "",
    degree: "",
    start_date: "",
    end_date: "",
    description: "",
  };
}

export default function EducationForm({
  entries,
  onChange,
}: {
  entries: EducationEntry[];
  onChange: (entries: EducationEntry[]) => void;
}) {
  const update = (id: string, patch: Partial<EducationEntry>) =>
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
              Education {index + 1}
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
          <div className="field">
            <label>School</label>
            <input
              className="input"
              value={entry.school}
              onChange={(e) => update(entry.id, { school: e.target.value })}
            />
          </div>
          <div className="form-row">
            <div className="field" style={{ flex: 1 }}>
              <label>Major / Profession</label>
              <input
                className="input"
                value={entry.major}
                onChange={(e) => update(entry.id, { major: e.target.value })}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Grade / Degree</label>
              <input
                className="input"
                value={entry.degree}
                onChange={(e) => update(entry.id, { degree: e.target.value })}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="field" style={{ flex: 1 }}>
              <label>Start date</label>
              <input
                className="input"
                value={entry.start_date}
                onChange={(e) => update(entry.id, { start_date: e.target.value })}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>End date</label>
              <input
                className="input"
                value={entry.end_date}
                onChange={(e) => update(entry.id, { end_date: e.target.value })}
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
        + Add education
      </button>
    </div>
  );
}
