import { getEffectiveSectionOrder, type ResumeContent } from "../../../lib/api";
import { renderSectionBlock } from "./blocks";

const SIDEBAR_KEYS = new Set(["skills", "certificates", "languages"]);

export default function SidebarTemplate({
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
  const sidebarOrder = order.filter((key) => SIDEBAR_KEYS.has(key));
  const mainOrder = order.filter((key) => !SIDEBAR_KEYS.has(key));

  return (
    <div className="resume-template resume-template-sidebar">
      <aside className="resume-sidebar">
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
        <h1>{basic_info.full_name || "Your Name"}</h1>
        <div className="resume-contact-line">
          {[basic_info.location, basic_info.email, basic_info.phone]
            .filter(Boolean)
            .map((line, i) => (
              <div key={i}>{line}</div>
            ))}
        </div>
        {sidebarOrder.map((key) => renderSectionBlock(key, content))}
      </aside>
      <main className="resume-main">{mainOrder.map((key) => renderSectionBlock(key, content))}</main>
    </div>
  );
}
