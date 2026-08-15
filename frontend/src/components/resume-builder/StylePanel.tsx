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
    name_color: "#211f26",
    heading_color: "#ff6b3d",
    body_color: "#211f26",
    text_align: "left",
  };
  const resetStyle = () => onChange({ ...DEFAULT_STYLE });
  const styleIsDefault = (Object.keys(DEFAULT_STYLE) as Array<keyof ResumeStyle>).every(
    (key) => style[key] === DEFAULT_STYLE[key]
  );

  const DEFAULT_TYPE = {
    name_font_size: 20,
    heading_font_size: 20,
    body_font_size: 13,
    line_height: 1.5,
    name_color: "#211f26",
    heading_color: "#ff6b3d",
    body_color: "#211f26",
  } as const;
  const resetType = () => onChange({ ...style, ...DEFAULT_TYPE });
  const typeIsDefault = (Object.keys(DEFAULT_TYPE) as Array<keyof typeof DEFAULT_TYPE>).every(
    (key) => style[key] === DEFAULT_TYPE[key]
  );

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

      <div className="field">
        <label>Text alignment</label>
        <div className="form-row" style={{ gap: 6 }}>
          {(["left", "center", "right", "justify"] as const).map((align) => (
            <button
              key={align}
              type="button"
              className={"btn btn-sm " + (style.text_align === align ? "btn-primary" : "btn-ghost")}
              onClick={() => set("text_align", align)}
            >
              {align[0].toUpperCase() + align.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="form-row" style={{ justifyContent: "space-between", alignItems: "baseline", marginTop: 8 }}>
        <label style={{ margin: 0, fontWeight: 700 }}>Text</label>
        <button type="button" className="link-button" onClick={resetType} disabled={typeIsDefault}>
          Reset to default
        </button>
      </div>

      {/* Size and colour sit on one row per text role, so it reads as "here is the profile
          heading, here is everything you can change about it" rather than as two disconnected
          lists that the user has to mentally pair up. */}
      <TextRoleField
        label="Profile heading"
        size={style.name_font_size}
        min={16}
        max={32}
        onSizeChange={(v) => set("name_font_size", v)}
        color={style.name_color}
        onColorChange={(v) => set("name_color", v)}
      />

      <TextRoleField
        label="Content heading"
        size={style.heading_font_size}
        min={16}
        max={32}
        onSizeChange={(v) => set("heading_font_size", v)}
        color={style.heading_color}
        onColorChange={(v) => set("heading_color", v)}
      />

      <TextRoleField
        label="Body"
        size={style.body_font_size}
        min={10}
        max={18}
        onSizeChange={(v) => set("body_font_size", v)}
        color={style.body_color}
        onColorChange={(v) => set("body_color", v)}
      />

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

function TextRoleField({
  label,
  size,
  min,
  max,
  onSizeChange,
  color,
  onColorChange,
}: {
  label: string;
  size: number;
  min: number;
  max: number;
  onSizeChange: (value: number) => void;
  color: string;
  onColorChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <label>
        {label} ({size}px)
      </label>
      <div className="form-row" style={{ gap: 8, alignItems: "center" }}>
        <input
          type="range"
          style={{ flex: 1, minWidth: 0 }}
          min={min}
          max={max}
          value={size}
          onChange={(e) => onSizeChange(Number(e.target.value))}
        />
        <input
          type="color"
          className="input"
          title={`${label} colour`}
          aria-label={`${label} colour`}
          value={color}
          onChange={(e) => onColorChange(e.target.value)}
          style={{ width: 40, height: 30, padding: 2, flexShrink: 0 }}
        />
      </div>
    </div>
  );
}
