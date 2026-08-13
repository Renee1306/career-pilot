import { getEffectiveSectionOrder, type ResumeContent } from "../../../lib/api";
import { ContactLine, renderSectionBlock } from "./blocks";

const RAIL_KEYS = new Set(["skills", "languages", "certificates"]);

export default function BannerTemplate({
  content,
  photoUrl,
}: {
  content: ResumeContent;
  photoUrl: string | null;
}) {
  const { basic_info } = content;
  const shapeRadius =
    basic_info.photo.shape === "circle" ? "50%" : basic_info.photo.shape === "rounded" ? "16%" : "4px";
  const order = getEffectiveSectionOrder(content).filter((key) => content.enabled_sections[key] ?? true);
  const railOrder = order.filter((key) => RAIL_KEYS.has(key));
  const mainOrder = order.filter((key) => !RAIL_KEYS.has(key));

  return (
    <div className="resume-template resume-template-banner">
      <header className="resume-banner-header">
        {photoUrl && (
          <img
            src={photoUrl}
            alt=""
            className="resume-photo"
            style={{
              width: basic_info.photo.size,
              height: basic_info.photo.size,
              borderRadius: shapeRadius,
              border: basic_info.photo.border ? "2px solid #fff" : "none",
            }}
          />
        )}
        <div>
          <h1>{basic_info.full_name || "Your Name"}</h1>
          <ContactLine basicInfo={basic_info} />
        </div>
      </header>
      <div className="resume-banner-body">
        <main className="resume-main">{mainOrder.map((key) => renderSectionBlock(key, content))}</main>
        <aside className="resume-rail">{railOrder.map((key) => renderSectionBlock(key, content))}</aside>
      </div>
    </div>
  );
}
