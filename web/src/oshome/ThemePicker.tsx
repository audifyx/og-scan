import { useState } from "react";
import { Check, RotateCcw, Trash2, Plus } from "lucide-react";
import { useDeviceTheme } from "../themes/DeviceThemeProvider";
import { ACCENTS, BACKGROUND_THEMES, DEVICE_THEMES } from "../themes/themes";
import {
  deleteCustomPreset,
  listPresets,
  saveCurrentAsPreset,
  type ThemePreset,
} from "../themes/crossPlatform";
import "./oshome.css";

/**
 * ThemePicker — device themes + backgrounds + accents + cross-platform presets.
 * Lives inside the OS home settings panel; uses only --dt-* vars.
 */
export default function ThemePicker() {
  const { deviceTheme, background, accent, setDeviceTheme, setBackground, setAccent, resetAll, applyPreset } =
    useDeviceTheme();
  const [presets, setPresets] = useState<ThemePreset[]>(() => listPresets());
  const [presetName, setPresetName] = useState("");

  const refreshPresets = () => setPresets(listPresets());

  const onSavePreset = () => {
    const saved = saveCurrentAsPreset(presetName);
    if (saved) {
      setPresetName("");
      refreshPresets();
    }
  };

  const onDeletePreset = (id: string) => {
    if (deleteCustomPreset(id)) refreshPresets();
  };

  return (
    <div>
      <div className="osh-picker-sec">Theme presets · one tap, platform-wide</div>
      <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--dt-muted)" }}>
        A preset applies a background + accent combo (and device, for saved ones) across the
        entire platform at once.
      </p>
      <div className="osh-picker-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
        {presets.map((p) => (
          <button
            key={p.id}
            className="osh-picker-card"
            onClick={() => applyPreset(p)}
            title={`Background: ${p.background} · Accent: ${p.accent}${p.device ? ` · Device: ${p.device}` : ""}`}
          >
            <span className="osh-picker-meta" style={{ textAlign: "left" }}>
              <b>{p.name}</b>
              <span>{p.builtin ? "Built-in preset" : "Your preset"}</span>
            </span>
            {!p.builtin && (
              <span
                role="button"
                tabIndex={0}
                aria-label={`Delete preset ${p.name}`}
                className="osh-x-btn"
                style={{ position: "absolute", top: 4, right: 4 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePreset(p.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    onDeletePreset(p.id);
                  }
                }}
              >
                <Trash2 style={{ width: 12, height: 12 }} />
              </span>
            )}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, margin: "10px 0 0" }}>
        <input
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          placeholder="Save current look as preset…"
          aria-label="Preset name"
          style={{
            flex: 1,
            background: "var(--dt-surface)",
            border: "1px solid var(--dt-line)",
            color: "var(--dt-fg)",
            padding: "8px 10px",
          }}
        />
        <button className="osh-picker-reset" style={{ margin: 0, whiteSpace: "nowrap" }} onClick={onSavePreset}>
          <Plus style={{ width: 13, height: 13, display: "inline", verticalAlign: -2 }} /> Save
        </button>
      </div>

      <div className="osh-picker-sec">Device theme · {deviceTheme.name}</div>
      <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--dt-muted)" }}>
        {deviceTheme.blurb} One choice re-skins the entire platform.
      </p>
      <div className="osh-picker-grid">
        {DEVICE_THEMES.map((t) => (
          <button
            key={t.id}
            className="osh-picker-card"
            data-active={deviceTheme.id === t.id || undefined}
            onClick={() => setDeviceTheme(t.id)}
            title={t.blurb}
          >
            <span
              className="osh-picker-prev"
              style={{
                background: `linear-gradient(135deg, ${t.preview.from}, ${t.preview.to})`,
                color: "#fff",
                textShadow: "0 2px 8px rgba(0,0,0,.6)",
              }}
            >
              {t.preview.glyph}
              {deviceTheme.id === t.id && (
                <Check style={{ position: "absolute", width: 18, height: 18 }} />
              )}
            </span>
            <span className="osh-picker-meta">
              <b>{t.name}</b>
              <span>{t.tagline}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="osh-picker-sec">Background · {background.name}</div>
      <div className="osh-picker-grid">
        {BACKGROUND_THEMES.map((b) => (
          <button
            key={b.id}
            className="osh-picker-card"
            data-active={background.id === b.id || undefined}
            onClick={() => setBackground(b.id)}
            title={b.blurb}
          >
            <span className="osh-picker-prev" style={{ background: b.css }} />
            <span className="osh-picker-meta">
              <b>{b.name}</b>
              <span>{b.blurb}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="osh-picker-sec">Accent · {accent.name}</div>
      <div className="osh-picker-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}>
        {ACCENTS.map((a) => (
          <button
            key={a.id}
            className="osh-picker-card"
            data-active={accent.id === a.id || undefined}
            onClick={() => setAccent(a.id)}
            title={a.name}
          >
            <span className="osh-accent-dot" style={{ background: a.value, position: "relative", display: "block" }}>
              {accent.id === a.id && (
                <Check
                  style={{
                    position: "absolute", inset: 0, margin: "auto",
                    width: 20, height: 20, color: a.onAccent,
                  }}
                />
              )}
            </span>
            <span className="osh-picker-meta">
              <b>{a.name}</b>
            </span>
          </button>
        ))}
      </div>

      <button className="osh-picker-reset" onClick={resetAll}>
        <RotateCcw style={{ width: 13, height: 13, display: "inline", verticalAlign: -2 }} /> Reset to OrbitX defaults
      </button>
    </div>
  );
}
