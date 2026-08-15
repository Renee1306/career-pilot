import type { BasicInfo, PhotoStyle } from "../../lib/api";
import PhotoUpload from "./PhotoUpload";

export default function BasicInfoForm({
  documentId,
  basicInfo,
  photoUrl,
  onChange,
  onPhotoUrlChange,
}: {
  documentId: string;
  basicInfo: BasicInfo;
  photoUrl: string | null;
  onChange: (info: BasicInfo) => void;
  onPhotoUrlChange: (url: string | null) => void;
}) {
  const set = <K extends keyof BasicInfo>(key: K, value: BasicInfo[K]) => onChange({ ...basicInfo, [key]: value });

  return (
    <div>
      <PhotoUpload
        documentId={documentId}
        photoUrl={photoUrl}
        photo={basicInfo.photo}
        onPhotoUrlChange={onPhotoUrlChange}
        onPhotoStyleChange={(photo: PhotoStyle) => set("photo", photo)}
      />
      <div className="field">
        <label>Full name</label>
        <input className="input" value={basicInfo.full_name} onChange={(e) => set("full_name", e.target.value)} />
      </div>
      <div className="field">
        <label>Location</label>
        <input
          className="input"
          value={basicInfo.location ?? ""}
          onChange={(e) => set("location", e.target.value)}
        />
      </div>
      <div className="field">
        <label>Email</label>
        <input className="input" value={basicInfo.email ?? ""} onChange={(e) => set("email", e.target.value)} />
      </div>
      <div className="field">
        <label>Phone</label>
        <input className="input" value={basicInfo.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
      </div>
    </div>
  );
}
