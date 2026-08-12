export default function SkillsForm({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const text = items.join("\n");
  const pills = items.filter((s) => s.trim());

  return (
    <div className="field">
      <label>Skills (one per line)</label>
      <textarea
        className="input"
        rows={5}
        value={text}
        onChange={(e) => onChange(e.target.value.split("\n"))}
        placeholder={"Python\nReact\nSQL"}
      />
      {pills.length > 0 && (
        <div className="pill-list" style={{ marginTop: 10 }}>
          {pills.map((skill, i) => (
            <span key={i} className="badge badge-primary">
              {skill}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
