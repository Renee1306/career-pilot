import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { ResumeContent, ResumeStyle } from "../../lib/api";
import BannerTemplate from "./templates/BannerTemplate";
import ClassicTemplate from "./templates/ClassicTemplate";
import CompactTemplate from "./templates/CompactTemplate";
import SidebarTemplate from "./templates/SidebarTemplate";
import TimelineTemplate from "./templates/TimelineTemplate";

const PAGE_WIDTH = 794;

export default function ResumePreview({
  templateId,
  content,
  style,
  photoUrl,
}: {
  templateId: string;
  content: ResumeContent;
  style: ResumeStyle;
  photoUrl: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pageHeight, setPageHeight] = useState(1123);

  // Shrinks the (fixed-width, true-to-print) page visually to fit whatever space the
  // pane has via transform:scale, rather than constraining its actual layout box -
  // scale is purely visual, so content that's taller than one page still grows the box
  // instead of being clipped (offsetHeight/scrollHeight are unaffected by transform).
  useLayoutEffect(() => {
    const container = containerRef.current;
    const page = pageRef.current;
    if (!container || !page) return;

    const measure = () => {
      setScale(Math.min(1, container.clientWidth / PAGE_WIDTH));
      setPageHeight(page.offsetHeight);
    };

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    resizeObserver.observe(page);
    return () => resizeObserver.disconnect();
  }, [templateId, content, style, photoUrl]);

  const cssVars = {
    "--resume-accent": style.accent_color,
    "--resume-font-family": style.font_family,
    "--resume-line-height": style.line_height,
    "--resume-name-size": `${style.name_font_size}px`,
    "--resume-heading-size": `${style.heading_font_size}px`,
    "--resume-body-size": `${style.body_font_size}px`,
    "--resume-padding-top": `${style.margin_top}px`,
    "--resume-padding-right": `${style.margin_right}px`,
    "--resume-padding-bottom": `${style.margin_bottom}px`,
    "--resume-padding-left": `${style.margin_left}px`,
  } as CSSProperties;

  return (
    <div ref={containerRef} className="resume-page-container" style={{ height: pageHeight * scale }}>
      <div
        id="resume-print-root"
        ref={pageRef}
        className="resume-page"
        style={{ ...cssVars, transform: `scale(${scale})` }}
      >
        {templateId === "sidebar" && <SidebarTemplate content={content} photoUrl={photoUrl} />}
        {templateId === "compact" && <CompactTemplate content={content} photoUrl={photoUrl} />}
        {templateId === "timeline" && <TimelineTemplate content={content} photoUrl={photoUrl} />}
        {templateId === "banner" && <BannerTemplate content={content} photoUrl={photoUrl} />}
        {(templateId === "classic" || !["sidebar", "compact", "timeline", "banner"].includes(templateId)) && (
          <ClassicTemplate content={content} photoUrl={photoUrl} />
        )}
      </div>
    </div>
  );
}
