const TEMPLATES = [
  { id: "classic", label: "Classic" },
  { id: "sidebar", label: "Sidebar" },
  { id: "compact", label: "Compact" },
  { id: "timeline", label: "Timeline" },
  { id: "banner", label: "Banner" },
];

export default function TemplatePickerModal({
  activeTemplateId,
  onSelect,
  onClose,
}: {
  activeTemplateId: string;
  onSelect: (templateId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-panel-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <strong>Choose a template</strong>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="template-grid">
          {TEMPLATES.map((t) => (
            <div
              key={t.id}
              className={"template-thumb" + (activeTemplateId === t.id ? " active" : "")}
              onClick={() => {
                onSelect(t.id);
                onClose();
              }}
            >
              <div className={`template-thumb-preview template-thumb-preview-${t.id}`} />
              <div className="template-thumb-label">{t.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
