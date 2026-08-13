import { useRef, useState } from "react";
import { deleteResumePhoto, uploadResumePhoto, type PhotoStyle } from "../../lib/api";

export default function PhotoUpload({
  documentId,
  photoUrl,
  photo,
  onPhotoUrlChange,
  onPhotoStyleChange,
}: {
  documentId: string;
  photoUrl: string | null;
  photo: PhotoStyle;
  onPhotoUrlChange: (url: string | null) => void;
  onPhotoStyleChange: (photo: PhotoStyle) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const doc = await uploadResumePhoto(documentId, file);
      onPhotoUrlChange(doc.photo_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError(null);
    try {
      const doc = await deleteResumePhoto(documentId);
      onPhotoUrlChange(doc.photo_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  };

  const shapeRadius = photo.shape === "circle" ? "50%" : photo.shape === "rounded" ? "16%" : "4px";

  return (
    <div className="field">
      <label>Photo</label>
      <div className="form-row" style={{ alignItems: "center", flexWrap: "nowrap" }}>
        <div
          style={{
            width: photo.size,
            height: photo.size,
            minWidth: photo.size,
            borderRadius: shapeRadius,
            overflow: "hidden",
            background: "var(--color-bg)",
            border: photo.border ? "2px solid var(--color-primary)" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {photoUrl ? (
            <img src={photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span className="muted" style={{ fontSize: 11 }}>
              No photo
            </span>
          )}
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <div className="form-row">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              {busy ? "Working..." : photoUrl ? "Replace" : "Upload"}
            </button>
            {photoUrl && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleRemove} disabled={busy}>
                Remove
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      </div>
      {error && (
        <p className="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}

      <div className="form-row" style={{ marginTop: 12 }}>
        <label style={{ fontSize: 12, width: 50 }}>Size</label>
        <input
          type="range"
          min={56}
          max={160}
          value={photo.size}
          onChange={(e) => onPhotoStyleChange({ ...photo, size: Number(e.target.value) })}
        />
      </div>
      <div className="form-row" style={{ marginTop: 8 }}>
        <label style={{ fontSize: 12, width: 50 }}>Shape</label>
        {(["circle", "square", "rounded"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={"btn btn-sm " + (photo.shape === s ? "btn-primary" : "btn-ghost")}
            onClick={() => onPhotoStyleChange({ ...photo, shape: s })}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="form-row" style={{ marginTop: 8, alignItems: "center" }}>
        <label style={{ fontSize: 12, width: 50 }}>Border</label>
        <input
          type="checkbox"
          checked={photo.border}
          onChange={(e) => onPhotoStyleChange({ ...photo, border: e.target.checked })}
        />
      </div>
    </div>
  );
}
