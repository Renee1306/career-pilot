import type { ResumeStyle } from "../../lib/api";

const FONT_OPTIONS = [
  { label: "Plus Jakarta Sans", value: "'Plus Jakarta Sans', sans-serif" },
  { label: "Inter", value: "'Inter', sans-serif" },
  { label: "Roboto", value: "'Roboto', sans-serif" },
  { label: "Lato", value: "'Lato', sans-serif" },
  { label: "IBM Plex Sans", value: "'IBM Plex Sans', sans-serif" },
  { label: "Source Sans 3", value: "'Source Sans 3', sans-serif" },
  { label: "Space Grotesk", value: "'Space Grotesk', sans-serif" },
  { label: "Merriweather (serif)", value: "'Merriweather', 'Times New Roman', serif" },
  { label: "Playfair Display (serif)", value: "'Playfair Display', 'Times New Roman', serif" },
  { label: "Georgia (serif)", value: "Georgia, 'Times New Roman', serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "JetBrains Mono", value: "'JetBrains Mono', 'Courier New', monospace" },
];

export default function StylePanel({
  style,
  onChange,
}: {
  style: ResumeStyle;
  onChange: (style: ResumeStyle) => void;
}) {
  const set = <K extends keyof ResumeStyle>(key: K, value: ResumeStyle[K]) => onChange({ ...style, [key]: value });

  const DEFAULT_STYLE: ResumeStyle = {
    accent_color: "#ff6b3d",
    margin_top: 40,
    margin_right: 40,
    margin_bottom: 40,
    margin_left: 40,
    font_family: "'Plus Jakarta Sans', sans-serif",
    name_font_size: 20,
    heading_font_size: 20,
    body_font_size: 13,
    line_height: 1.5,
  };
  const resetStyle = () => onChange({ ...DEFAULT_STYLE });
  const styleIsDefault = (Object.keys(DEFAULT_STYLE) as Array<keyof ResumeStyle>).every(
    (key) => style[key] === DEFAULT_STYLE[key]
  );

  const DEFAULT_SIZES = { name_font_size: 20, heading_font_size: 20, body_font_size: 13, line_height: 1.5 };
  const resetSizes = () => onChange({ ...style, ...DEFAULT_SIZES });
  const sizesAreDefault =
    style.name_font_size === DEFAULT_SIZES.name_font_size &&
    style.heading_font_size === DEFAULT_SIZES.heading_font_size &&
    style.body_font_size === DEFAULT_SIZES.body_font_size &&
    style.line_height === DEFAULT_SIZES.line_height;

  return (
    <div className="builder-style-panel">
      <div className="form-row" style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>
          Style
        </div>
        <button type="button" className="link-button" onClick={resetStyle} disabled={styleIsDefault}>
          Reset to default
        </button>
      </div>

      <div className="field">
        <label>Top margin ({style.margin_top}px)</label>
        <input
          type="range"
          min={0}
          max={100}
          value={style.margin_top}
          onChange={(e) => set("margin_top", Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label>Right margin ({style.margin_right}px)</label>
        <input
          type="range"
          min={0}
          max={100}
          value={style.margin_right}
          onChange={(e) => set("margin_right", Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label>Bottom margin ({style.margin_bottom}px)</label>
        <input
          type="range"
          min={0}
          max={100}
          value={style.margin_bottom}
          onChange={(e) => set("margin_bottom", Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label>Left margin ({style.margin_left}px)</label>
        <input
          type="range"
          min={0}
          max={100}
          value={style.margin_left}
          onChange={(e) => set("margin_left", Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label>Accent color</label>
        <input
          type="color"
          className="input"
          value={style.accent_color}
          onChange={(e) => set("accent_color", e.target.value)}
          style={{ padding: 4, height: 40 }}
        />
      </div>

      <div className="field">
        <label>Font family</label>
        <select className="input" value={style.font_family} onChange={(e) => set("font_family", e.target.value)}>
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row" style={{ justifyContent: "space-between", alignItems: "baseline", marginTop: 8 }}>
        <label style={{ margin: 0, fontWeight: 700 }}>Text size</label>
        <button type="button" className="link-button" onClick={resetSizes} disabled={sizesAreDefault}>
          Reset to default
        </button>
      </div>

      <div className="field">
        <label>Profile heading size ({style.name_font_size}px)</label>
        <input
          type="range"
          min={16}
          max={32}
          value={style.name_font_size}
          onChange={(e) => set("name_font_size", Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label>Content heading size ({style.heading_font_size}px)</label>
        <input
          type="range"
          min={16}
          max={32}
          value={style.heading_font_size}
          onChange={(e) => set("heading_font_size", Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label>Body size ({style.body_font_size}px)</label>
        <input
          type="range"
          min={10}
          max={18}
          value={style.body_font_size}
          onChange={(e) => set("body_font_size", Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label>Line height ({style.line_height.toFixed(1)})</label>
        <input
          type="range"
          min={1.1}
          max={2}
          step={0.1}
          value={style.line_height}
          onChange={(e) => set("line_height", Number(e.target.value))}
        />
      </div>
    </div>
  );
}
