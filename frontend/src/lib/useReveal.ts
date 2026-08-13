import { useEffect, useRef } from "react";

/** Time after which anything still unrevealed is shown regardless of the observer. */
const FAILSAFE_MS = 1200;

/** Scroll-reveal, written as a progressive enhancement rather than a requirement.
 *
 *  `.reveal` on its own is fully visible (see components.css) - the hidden start state
 *  lives on `.reveal-ready`, which this hook adds itself, before paint. So if the script
 *  never runs, IntersectionObserver is missing, or the observer simply never fires
 *  (a backgrounded or non-compositing tab will do exactly that), the page still renders
 *  its content instead of a screen of invisible boxes. A failsafe timer reveals anything
 *  the observer has not gotten to, for the same reason.
 *
 *  Elements are unobserved after their first reveal, so scrolling back up never
 *  re-animates them. */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));
    const revealAll = () => targets.forEach((el) => el.classList.add("reveal-in"));

    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      revealAll();
      return;
    }

    targets.forEach((el) => el.classList.add("reveal-ready"));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("reveal-in");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach((el) => observer.observe(el));
    const failsafe = window.setTimeout(revealAll, FAILSAFE_MS);

    return () => {
      window.clearTimeout(failsafe);
      observer.disconnect();
    };
  }, []);

  return containerRef;
}
