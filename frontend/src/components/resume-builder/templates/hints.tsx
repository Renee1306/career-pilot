import { createContext, useContext, type ReactNode } from "react";
import type { HintTarget, ResumeHint } from "../../../lib/api";

/** Lets the template blocks mark up hinted text without every template having to thread hint
 *  props down by hand. The blocks are shared by five templates and nested several levels deep,
 *  so a context is the only place this can live without touching each of them. */
export interface HintLayer {
  /** The pending rewrite for one existing line.
   *
   *  Matched on position AND exact text, both of which must still agree. Text alone is not
   *  enough - a resume that repeats a line (or two jobs described in the same words) would
   *  light up every copy for a hint that only replaces one of them. Position alone is not
   *  enough either: the user can keep editing while hints are pending, and a rewrite must
   *  never land on a line that has since been changed under it. When either has moved on,
   *  the hint simply stops rendering rather than guessing. */
  replaceHint: (
    target: HintTarget,
    entryId: string | null,
    index: number | null,
    text: string
  ) => ResumeHint | undefined;
  /** Brand-new lines proposed for this entry - rendered as ghosts until accepted. */
  appendHints: (target: HintTarget, entryId: string | null) => ResumeHint[];
  onHintClick: (hint: ResumeHint, anchor: HTMLElement) => void;
  activeHintId: string | null;
}

const INERT: HintLayer = {
  replaceHint: () => undefined,
  appendHints: () => [],
  onHintClick: () => {},
  activeHintId: null,
};

const HintContext = createContext<HintLayer>(INERT);

export const HintProvider = HintContext.Provider;

export function useHintLayer() {
  return useContext(HintContext);
}

/** Wraps one line of resume text, highlighting it when a rewrite is pending for it.
 *  `text` is what the hint is matched against; `children` is what actually renders (the two
 *  differ wherever the template strips a leading bullet marker for display). */
export function Hintable({
  target,
  entryId = null,
  index = null,
  text,
  children,
}: {
  target: HintTarget;
  entryId?: string | null;
  index?: number | null;
  text: string;
  children?: ReactNode;
}) {
  const { replaceHint, onHintClick, activeHintId } = useHintLayer();
  const hint = replaceHint(target, entryId, index, text);
  const body = children ?? text;
  if (!hint) return <>{body}</>;
  return (
    <mark
      className={`resume-hint${activeHintId === hint.id ? " resume-hint-active" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onHintClick(hint, e.currentTarget);
      }}
    >
      {body}
    </mark>
  );
}

/** The proposed-but-not-yet-accepted lines for an entry, shown in place so the candidate sees
 *  exactly what the resume would read like. Hidden entirely when printing (see print.css) -
 *  nothing unaccepted may reach the exported PDF. */
export function AppendedHints({
  target,
  entryId = null,
  as = "li",
}: {
  target: HintTarget;
  entryId?: string | null;
  as?: "li" | "p";
}) {
  const { appendHints, onHintClick, activeHintId } = useHintLayer();
  const hints = appendHints(target, entryId);
  if (hints.length === 0) return null;

  const Tag = as;
  return (
    <>
      {hints.map((hint) => (
        <Tag key={hint.id} className="resume-hint-ghost-row">
          <mark
            className={`resume-hint resume-hint-ghost${activeHintId === hint.id ? " resume-hint-active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onHintClick(hint, e.currentTarget);
            }}
          >
            {hint.suggested_text}
          </mark>
        </Tag>
      ))}
    </>
  );
}
