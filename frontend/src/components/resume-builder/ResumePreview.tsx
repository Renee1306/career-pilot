import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { ResumeContent, ResumeHint, ResumeStyle } from "../../lib/api";
import BannerTemplate from "./templates/BannerTemplate";
import ClassicTemplate from "./templates/ClassicTemplate";
import CompactTemplate from "./templates/CompactTemplate";
import SidebarTemplate from "./templates/SidebarTemplate";
import TimelineTemplate from "./templates/TimelineTemplate";
import { HintProvider, type HintLayer } from "./templates/hints";

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123; // A4 at 96dpi
const PAGE_GAP = 24;
const POPOVER_WIDTH = 320;
// Stable identity for "this entry has no pending additions" - a fresh [] on every lookup would
// make the memoised hint layer look changed on each render and re-render every template block.
const NO_HINTS: ResumeHint[] = [];

// Where a page is allowed to end, in order of preference. A whole section staying together is
// the nicest result, so it is tried first; only when a section is itself taller than a page do
// we fall back to splitting it between entries, and then between individual bullet lines.
const BREAK_TIERS = [".resume-section", ".resume-entry, .resume-entry-compact", ".resume-bullet-list > li"];

function renderTemplate(templateId: string, content: ResumeContent, photoUrl: string | null) {
  if (templateId === "sidebar") return <SidebarTemplate content={content} photoUrl={photoUrl} />;
  if (templateId === "compact") return <CompactTemplate content={content} photoUrl={photoUrl} />;
  if (templateId === "timeline") return <TimelineTemplate content={content} photoUrl={photoUrl} />;
  if (templateId === "banner") return <BannerTemplate content={content} photoUrl={photoUrl} />;
  return <ClassicTemplate content={content} photoUrl={photoUrl} />;
}

/** Y offsets (relative to the top of the resume) where each page ends.
 *
 *  Works down the tiers above: for each page take the LAST boundary that still fits, preferring
 *  whole sections, then whole entries, then whole lines. Only if no boundary at all falls inside
 *  the page - a single element taller than A4 - does it cut at the page height, which is the one
 *  case where slicing an element is unavoidable.
 */
function computeBreaks(root: HTMLElement): number[] {
  const rootTop = root.getBoundingClientRect().top;
  const totalHeight = root.scrollHeight;

  const tiers = BREAK_TIERS.map((selector) =>
    Array.from(root.querySelectorAll(selector), (el) => el.getBoundingClientRect().top - rootTop).sort(
      (a, b) => a - b
    )
  );

  const breaks: number[] = [];
  let cursor = 0;
  // `breaks.length` guard: every iteration must move the cursor forward, and there can never be
  // more pages than the content is tall, so this cannot spin even on a pathological layout.
  while (totalHeight - cursor > PAGE_HEIGHT && breaks.length < Math.ceil(totalHeight / PAGE_HEIGHT) + 1) {
    const limit = cursor + PAGE_HEIGHT;
    let next = 0;
    for (const tier of tiers) {
      const candidates = tier.filter((y) => y > cursor && y <= limit);
      if (candidates.length > 0) {
        next = candidates[candidates.length - 1];
        break;
      }
    }
    breaks.push(next > cursor ? next : limit);
    cursor = breaks[breaks.length - 1];
  }
  return breaks;
}

export default function ResumePreview({
  templateId,
  content,
  style,
  photoUrl,
  hints = [],
  onAcceptHint,
  onDismissHint,
}: {
  templateId: string;
  content: ResumeContent;
  style: ResumeStyle;
  photoUrl: string | null;
  hints?: ResumeHint[];
  onAcceptHint?: (hint: ResumeHint) => void;
  onDismissHint?: (hint: ResumeHint) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [breaks, setBreaks] = useState<number[]>([]);
  const [contentHeight, setContentHeight] = useState(0);
  const [active, setActive] = useState<{ hint: ResumeHint; anchor: HTMLElement } | null>(null);

  // Measures the full, unpaginated content off-screen (this same element doubles as the
  // print source - see print.css) and works out where each on-screen page should end.
  // Scale is purely visual (transform), so it never feeds back into these measurements.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const measureEl = measureRef.current;
    if (!container || !measureEl) return;

    const measure = () => {
      setScale(Math.min(1, container.clientWidth / PAGE_WIDTH));
      setContentHeight(measureEl.scrollHeight);
      setBreaks(computeBreaks(measureEl));
    };

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    resizeObserver.observe(measureEl);
    return () => resizeObserver.disconnect();
  }, [templateId, content, style, photoUrl, hints]);

  // A hint the user has already resolved (or edited out from under) stops existing, so the
  // popover pointing at it has to go too - otherwise it hangs over the page with stale text.
  useEffect(() => {
    if (active && !hints.some((h) => h.id === active.hint.id)) setActive(null);
  }, [hints, active]);

  const hintLayer = useMemo<HintLayer>(() => {
    const replacements = new Map<string, ResumeHint>();
    const additions = new Map<string, ResumeHint[]>();
    for (const hint of hints) {
      const scope = `${hint.target}|${hint.entry_id ?? ""}`;
      if (hint.mode === "append") {
        additions.set(scope, [...(additions.get(scope) ?? []), hint]);
      } else {
        replacements.set(`${scope}|${hint.bullet_index}|${hint.original_text}`, hint);
      }
    }
    return {
      replaceHint: (target, entryId, index, text) =>
        replacements.get(`${target}|${entryId ?? ""}|${index}|${text}`),
      appendHints: (target, entryId) => additions.get(`${target}|${entryId ?? ""}`) ?? NO_HINTS,
      onHintClick: (hint, anchor) => setActive({ hint, anchor }),
      activeHintId: active?.hint.id ?? null,
    };
  }, [hints, active]);

  const cssVars = {
    "--resume-accent": style.accent_color,
    "--resume-font-family": style.font_family,
    "--resume-line-height": style.line_height,
    "--resume-name-size": `${style.name_font_size}px`,
    "--resume-heading-size": `${style.heading_font_size}px`,
    "--resume-body-size": `${style.body_font_size}px`,
    "--resume-name-color": style.name_color,
    "--resume-heading-color": style.heading_color,
    "--resume-body-color": style.body_color,
    "--resume-padding-top": `${style.margin_top}px`,
    "--resume-padding-right": `${style.margin_right}px`,
    "--resume-padding-bottom": `${style.margin_bottom}px`,
    "--resume-padding-left": `${style.margin_left}px`,
  } as CSSProperties;

  const templateNode: ReactNode = renderTemplate(templateId, content, photoUrl);
  // Each page is the slice [start, end) of the continuous document. The slice height is what the
  // sheet clips to - NOT the full A4 height - because a break pulled back to a section boundary
  // leaves the rest of that page blank, and clipping to A4 anyway would render the next section
  // at the bottom of this page *and* again at the top of the next.
  const pageStarts = [0, ...breaks];
  const pageEnds = [...breaks, Math.max(contentHeight, PAGE_HEIGHT)];
  const stackHeight = pageStarts.length * PAGE_HEIGHT + (pageStarts.length - 1) * PAGE_GAP;

  return (
    <HintProvider value={hintLayer}>
      <div ref={containerRef} className="resume-page-container" style={{ height: stackHeight * scale }}>
        <div className="resume-page-stack" style={{ transform: `scale(${scale})` }}>
          {pageStarts.map((start, i) => (
            <div
              className="resume-page-sheet"
              key={start}
              style={{ marginBottom: i < pageStarts.length - 1 ? PAGE_GAP : 0 }}
            >
              <div className="resume-page-window" style={{ height: Math.max(0, pageEnds[i] - start) }}>
                <div className="resume-page" style={{ ...cssVars, marginTop: -start }}>
                  {templateNode}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div
          id="resume-print-root"
          ref={measureRef}
          className="resume-page"
          style={{ ...cssVars, ...HIDDEN_PRINT_SOURCE_STYLE }}
        >
          {templateNode}
        </div>
      </div>
      {active && (
        <HintPopover
          hint={active.hint}
          anchor={active.anchor}
          onAccept={() => onAcceptHint?.(active.hint)}
          onDismiss={() => onDismissHint?.(active.hint)}
          onClose={() => setActive(null)}
        />
      )}
    </HintProvider>
  );
}

/** The before/after/reason card for one hint, anchored to the highlighted text.
 *
 *  Rendered in a portal at viewport coordinates rather than inside the page: the sheets are
 *  visually shrunk by a `transform: scale`, and anything positioned inside that subtree would be
 *  shrunk (and clipped by the sheet's `overflow: hidden`) along with the resume itself. */
function HintPopover({
  hint,
  anchor,
  onAccept,
  onDismiss,
  onClose,
}: {
  hint: ResumeHint;
  anchor: HTMLElement;
  onAccept: () => void;
  onDismiss: () => void;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const target = anchor.getBoundingClientRect();
      const card = cardRef.current?.getBoundingClientRect();
      const width = card?.width ?? POPOVER_WIDTH;
      const height = card?.height ?? 0;
      // Prefer below the highlighted line, flip above when that would run off the bottom, and
      // keep the card fully on screen horizontally whichever side of the page it was opened from.
      const below = target.bottom + 8;
      const top = below + height > window.innerHeight - 8 ? Math.max(8, target.top - height - 8) : below;
      const left = Math.min(Math.max(8, target.left), window.innerWidth - width - 8);
      setPosition({ top, left });
    };

    place();
    // The anchor lives inside a scrolling pane, so the card has to follow it rather than sit
    // where it was first opened. `true` catches scrolls on any ancestor, not just the window.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchor, hint.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!cardRef.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={cardRef}
      className="hint-popover"
      style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? "visible" : "hidden" }}
      role="dialog"
      aria-label="Suggested change"
    >
      <div className="hint-popover-scope">
        {hint.entry_label}
        {hint.source === "gap" && <span className="badge">from your answers</span>}
      </div>

      {hint.mode === "replace" ? (
        <>
          <div className="hint-popover-label">Before</div>
          <div className="hint-popover-before">{hint.original_text}</div>
        </>
      ) : (
        <div className="hint-popover-label">New line</div>
      )}

      <div className="hint-popover-label">{hint.mode === "replace" ? "After" : ""}</div>
      <div className="hint-popover-after">{hint.suggested_text}</div>

      {hint.reason && <p className="hint-popover-reason">{hint.reason}</p>}

      <div className="form-row" style={{ gap: 8, marginTop: 10 }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={onAccept}>
          Accept
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>,
    document.body
  );
}

const HIDDEN_PRINT_SOURCE_STYLE: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  visibility: "hidden",
  pointerEvents: "none",
  minHeight: 0,
  boxShadow: "none",
};
