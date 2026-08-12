import { useEffect, useRef, useState, type ReactNode } from "react";

export default function IconPopover({
  icon,
  title,
  dot,
  variant = "panel",
  children,
}: {
  icon: ReactNode;
  title: string;
  dot?: "success" | "primary" | null;
  /** "panel" is the wide form-shaped popover; "menu" is the compact action-list variant. */
  variant?: "panel" | "menu";
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="icon-popover" ref={ref}>
      <button
        type="button"
        className={"icon-btn" + (open ? " active" : "")}
        title={title}
        aria-label={title}
        onClick={() => setOpen((o) => !o)}
      >
        {icon}
        {dot && <span className={"icon-btn-dot icon-btn-dot-" + dot} />}
      </button>
      {open && (
        <div className={"icon-popover-panel" + (variant === "menu" ? " icon-popover-menu" : "")}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
