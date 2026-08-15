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

// Elements a page break must never land inside - each is one visual unit (a job entry, a single
// bullet line) that would look sliced in half if split across the page boundary. Deliberately
// does NOT include whole sections: an earlier version pulled the break back to the start of a
// section whenever the section didn't fully fit, which routinely stranded a short section (e.g.
// "Languages") almost alone on a fresh page while leaving a large blank gap at the bottom of the
// page before it - the page should fill up as normal and only pull back the minimum needed to
// avoid a mid-entry or mid-bullet cut.
const UNBREAKABLE_SELECTOR = ".resume-entry, .resume-entry-compact, .resume-bullet-list > li";
// A section heading landing as the very last thing on a page, with its content pushed to the
// next one, reads just as badly as a mid-entry cut - so a heading additionally needs this much
// clearance beneath it before a break is allowed to land there.
const HEADING_KEEP_WITH_NEXT = 32;

function renderTemplate(templateId: string, content: ResumeContent, photoUrl: string | null) {
  if (templateId === "sidebar") return <SidebarTemplate content={content} photoUrl={photoUrl} />;
  if (templateId === "compact") return <CompactTemplate content={content} photoUrl={photoUrl} />;
  if (templateId === "timeline") return <TimelineTemplate content={content} photoUrl={photoUrl} />;
  if (templateId === "banner") return <BannerTemplate content={content} photoUrl={photoUrl} />;
  return <ClassicTemplate content={content} photoUrl={photoUrl} />;
}

/** Y offsets (relative to the top of the resume) where each page ends.
 *
 *  Fills each page up to a full PAGE_HEIGHT - the normal, space-efficient case - and only pulls
 *  the break back when that lands inside an unbreakable unit or strands a heading, to the start
 *  of whichever one it hit. Falls back to a hard cut at the page height only when a single
 *  element is itself taller than a full page, since there is no boundary left to retreat to.
 *
 *  Page 2 onward budgets PAGE_HEIGHT - marginTop rather than the full PAGE_HEIGHT: each of those
 *  pages gets a marginTop-tall spacer rendered above its slice (see the render loop below) so
 *  every page opens with the same top margin as page 1, and the break math has to leave room
 *  for that spacer or it would push the page's content past PAGE_HEIGHT.
 */
function computeBreaks(root: HTMLElement, marginTop: number): number[] {
  const rootTop = root.getBoundingClientRect().top;
  const totalHeight = root.scrollHeight;

  const forbidden: Array<[number, number]> = [];
  root.querySelectorAll(UNBREAKABLE_SELECTOR).forEach((el) => {
    const rect = el.getBoundingClientRect();
    forbidden.push([rect.top - rootTop, rect.bottom - rootTop]);
  });
  root.querySelectorAll("h2").forEach((el) => {
    const rect = el.getBoundingClientRect();
    forbidden.push([rect.top - rootTop, rect.bottom - rootTop + HEADING_KEEP_WITH_NEXT]);
  });

  const resolveBreak = (target: number, floor: number): number => {
    let y = target;
    for (let guard = 0; guard < forbidden.length + 1; guard++) {
      const hit = forbidden.find(([start, end]) => y > start && y < end);
      if (!hit) return y;
      y = hit[0];
    }
    // Nothing but forbidden zones between floor and target (e.g. one oversized entry) - fall
    // back to a hard break rather than looping forever.
    return y > floor ? y : target;
  };

  const breaks: number[] = [];
  let cursor = 0;
  let budget = PAGE_HEIGHT;
  while (totalHeight - cursor > budget) {
    const y = resolveBreak(cursor + budget, cursor);
    breaks.push(y);
    cursor = y;
    budget = PAGE_HEIGHT - marginTop;
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
  // Mirrors the three state values above so `measure` can compare against the latest without
  // taking a dependency on them - see the note below on why that comparison has to happen.
  const lastMeasured = useRef({ scale: 1, contentHeight: 0, breaks: [] as number[] });

  // Measures the full, unpaginated content off-screen and works out where each page should
  // end. Print reuses this same pagination (see print.css), rendering the on-screen sheet
  // stack unscaled instead of re-flowing the resume through the browser's own page breaks,
  // so the export always matches what the preview showed. Scale is purely visual (transform),
  // so it never feeds back into these measurements.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const measureEl = measureRef.current;
    if (!container || !measureEl) return;

    const arraysEqual = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

    const measure = () => {
      const s = Math.min(1, container.clientWidth / PAGE_WIDTH);
      const ch = measureEl.scrollHeight;
      const b = computeBreaks(measureEl, style.margin_top);
      const prev = lastMeasured.current;

      // computeBreaks reads layout (getBoundingClientRect) on every call, and this function runs
      // inside a ResizeObserver callback - setting state unconditionally here means every firing
      // writes a fresh `height` onto `container` (a new array reference always fails a naive
      // equality check even when its values are identical), which is itself an observed resize.
      // That write-inside-the-callback pattern is the textbook way to make a ResizeObserver never
      // stop notifying itself, and it did: this page rendered blank with a "Maximum update depth
      // exceeded" crash. Only touching state when a value has genuinely changed is what lets the
      // loop actually terminate once the layout settles.
      if (s === prev.scale && ch === prev.contentHeight && arraysEqual(b, prev.breaks)) return;

      lastMeasured.current = { scale: s, contentHeight: ch, breaks: b };
      setScale(s);
      setContentHeight(ch);
      setBreaks(b);
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
      } else if (hint.merge_bullet_index !== null) {
        // A merge hint's original_text is both source lines newline-joined, in
        // (bullet_index, merge_bullet_index) order - register it under each line's own
        // position/text so either bullet lights up and opens the same popover.
        const [firstText, secondText] = hint.original_text.split("\n");
        replacements.set(`${scope}|${hint.bullet_index}|${firstText}`, hint);
        replacements.set(`${scope}|${hint.merge_bullet_index}|${secondText}`, hint);
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
    "--resume-text-align": style.text_align,
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
              {/* Page 1's top margin comes from the template's own padding, baked into the
                  content below. Later pages are a slice of that same continuous flow, so
                  without this spacer they'd open flush with whatever text landed at the
                  break - this reproduces page 1's margin on every page after it. */}
              {i > 0 && <div style={{ height: style.margin_top }} />}
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
