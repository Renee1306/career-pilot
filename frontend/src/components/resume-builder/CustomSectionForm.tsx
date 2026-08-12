export default function CustomSectionForm({
  content,
  onChange,
}: {
  content: string;
  onChange: (content: string) => void;
}) {
  return (
    <div className="field">
      <label>Content</label>
      <textarea
        className="input"
        rows={6}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write anything you'd like to include in this section..."
      />
    </div>
  );
}
