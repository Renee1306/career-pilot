export default function ResumePreviewModal({
  url,
  label,
  onClose,
}: {
  url: string;
  label: string;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <strong>{label}</strong>
          <div className="form-row" style={{ gap: 8 }}>
            <a href={url} target="_blank" rel="noreferrer" className="link-button">
              Open in new tab
            </a>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <iframe src={url} title={label} className="modal-iframe" />
      </div>
    </div>
  );
}
