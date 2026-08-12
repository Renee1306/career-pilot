import type { ResumeContent } from "../../../lib/api";
import { ContactLine, SectionBlocks } from "./blocks";

export default function ClassicTemplate({
  content,
  photoUrl,
}: {
  content: ResumeContent;
  photoUrl: string | null;
}) {
  const { basic_info } = content;
  const shapeRadius =
    basic_info.photo.shape === "circle" ? "50%" : basic_info.photo.shape === "rounded" ? "16%" : "4px";

  return (
    <div className="resume-template resume-template-classic">
      <header className="resume-header">
        {photoUrl && (
          <img
            src={photoUrl}
            alt=""
            className="resume-photo"
            style={{
              width: basic_info.photo.size,
              height: basic_info.photo.size,
              borderRadius: shapeRadius,
              border: basic_info.photo.border ? "2px solid var(--resume-accent)" : "none",
            }}
          />
        )}
        <div>
          <h1>{basic_info.full_name || "Your Name"}</h1>
          <ContactLine basicInfo={basic_info} />
        </div>
      </header>
      <SectionBlocks content={content} />
    </div>
  );
}
