import { useEffect, useRef, useState } from "react";
import { LANGUAGES } from "../lib/languages";

export default function LanguageSelect({
  value,
  onChange,
  translatedLanguages,
}: {
  value: string;
  onChange: (language: string) => void;
  translatedLanguages: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const options = ["Original", ...LANGUAGES];
  const filtered = options.filter((opt) => opt.toLowerCase().includes(query.toLowerCase()));

  const handleSelect = (opt: string) => {
    onChange(opt === "Original" ? "" : opt);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="lang-select" ref={containerRef}>
      <input
        className="input"
        style={{ width: 220 }}
        placeholder="Search language..."
        value={open ? query : value || "Original"}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => setQuery(e.target.value)}
      />
      {open && (
        <div className="lang-select-dropdown">
          {filtered.length === 0 && <div className="lang-select-empty">No matches</div>}
          {filtered.map((opt) => {
            const isTranslated = opt !== "Original" && translatedLanguages.includes(opt);
            const isSelected = (opt === "Original" && !value) || opt === value;
            return (
              <button
                type="button"
                key={opt}
                className={"lang-select-option" + (isSelected ? " active" : "")}
                onClick={() => handleSelect(opt)}
              >
                <span>{opt}</span>
                {isTranslated && <span className="lang-select-check">Saved</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
