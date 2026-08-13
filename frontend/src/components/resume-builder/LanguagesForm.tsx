import type { Fluency, LanguageEntry } from "../../lib/api";

const FLUENCY_OPTIONS: { value: Fluency; label: string }[] = [
  { value: "basic", label: "Basic" },
  { value: "conversational", label: "Conversational" },
  { value: "fluent", label: "Fluent" },
  { value: "native", label: "Native" },
];

function newEntry(): LanguageEntry {
  return { id: crypto.randomUUID(), language: "", fluency: "conversational" };
}

export default function LanguagesForm({
  entries,
  onChange,
}: {
  entries: LanguageEntry[];
  onChange: (entries: LanguageEntry[]) => void;
}) {
  const update = (id: string, patch: Partial<LanguageEntry>) =>
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
            <label>Language</label>
            <input
              className="input"
              value={entry.language}
              onChange={(e) => update(entry.id, { language: e.target.value })}
            />
          </div>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>Fluency</label>
            <select
              className="input"
              value={entry.fluency}
              onChange={(e) => update(entry.id, { fluency: e.target.value as Fluency })}
            >
              {FLUENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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
        + Add language
      </button>
    </div>
  );
}
