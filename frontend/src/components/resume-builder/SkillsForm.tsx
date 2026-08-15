import type { SkillGroup, SkillsSection } from "../../lib/api";

/** Skills are edited one category at a time - a label plus its comma-separated skills - because
 *  that is exactly how a group renders on the resume (one bullet per category). Leaving the
 *  category blank gives a plain, unlabelled list, which is what an uncategorised resume gets. */
export default function SkillsForm({
  skills,
  onChange,
}: {
  skills: SkillsSection;
  onChange: (skills: SkillsSection) => void;
}) {
  const groups = skills.groups;
  const setGroups = (next: SkillGroup[]) => onChange({ groups: next });

  const update = (id: string, patch: Partial<SkillGroup>) =>
    setGroups(groups.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= groups.length) return;
    const next = [...groups];
    [next[index], next[target]] = [next[target], next[index]];
    setGroups(next);
  };

  return (
    <div>
      {groups.length === 0 && (
        <p className="muted" style={{ fontSize: 12.5, margin: "0 0 10px" }}>
          Group your skills by category — "Programming Languages", "Cloud", "Design Tools" — so
          they read as a few tidy lines instead of one long list.
        </p>
      )}

      {groups.map((group, index) => (
        <div key={group.id} className="subcard" style={{ marginBottom: 10 }}>
          <div className="form-row" style={{ gap: 6, alignItems: "center" }}>
            <input
              className="input"
              style={{ flex: 1 }}
              value={group.category}
              placeholder="Category (optional)"
              onChange={(e) => update(group.id, { category: e.target.value })}
            />
            <button
              type="button"
              className="builder-reorder-btn"
              disabled={index === 0}
              title="Move up"
              onClick={() => move(index, -1)}
            >
              ▲
            </button>
            <button
              type="button"
              className="builder-reorder-btn"
              disabled={index === groups.length - 1}
              title="Move down"
              onClick={() => move(index, 1)}
            >
              ▼
            </button>
            <button
              type="button"
              className="link-button"
              style={{ color: "var(--color-danger)" }}
              onClick={() => setGroups(groups.filter((g) => g.id !== group.id))}
            >
              Remove
            </button>
          </div>
          <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
            <textarea
              className="input"
              rows={2}
              value={group.items.join(", ")}
              placeholder="Python, SQL, React"
              onChange={(e) =>
                update(group.id, { items: e.target.value.split(",").map((s) => s.trim()) })
              }
            />
            <span className="muted" style={{ fontSize: 11 }}>
              Separate skills with commas
            </span>
          </div>
        </div>
      ))}

      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() =>
          setGroups([...groups, { id: crypto.randomUUID(), category: "", items: [] }])
        }
      >
        + Add category
      </button>
    </div>
  );
}
