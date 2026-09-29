import { useEffect, useRef, useState } from "react";
import { Dices, Upload, X } from "lucide-react";
import { useDeviceTheme } from "../themes/DeviceThemeProvider";
import { rollRandomTheme, getSurpriseOnLogin, setSurpriseOnLogin } from "../themes/randomizer";
import {
  getTimeAuto, setTimeAutoLS, describeSchedule, getTimeSlot, slotLabel,
} from "../themes/timeThemes";
import { startMicPulse, startDemoPulse, stopPulse, isPulsing } from "../themes/audioPulse";
import { getCrtFx, setCrtFxEnabled, setCrtScanline, setCrtPhosphor, setCrtPixel } from "../themes/crtFx";
import { getAnimatedWallpaper, setAnimatedWallpaper, ANIMATED_WALLPAPERS } from "../themes/wallpapers";
import { getIconPackId, applyIconPack, ICON_PACKS } from "../themes/iconPacks";
import {
  saveCustomPalette, getCustomPalettes, deleteCustomPalette, paletteShareUrl,
  autoOnAccent, type CustomPalette,
} from "../themes/paletteBuilder";
import { getBootLogo, setBootLogoFile, clearBootLogo } from "../themes/bootLogo";
import { getSoundPack, setSoundPack, playNotify } from "../themes/sounds";
import { isGuestMode, setGuestMode, isStreamerMode, setStreamerMode } from "../themes/modes";
import {
  getScreensaverScene, setScreensaverScene, getScreensaverTimeout, setScreensaverTimeout,
  type ScreensaverScene,
} from "../themes/screensaver";
import { getEnabledWidgets, setEnabledWidgets, WIDGET_META, type WidgetId } from "../themes/widgets";
import { unlockAchievement } from "../themes/achievements";
import "./oshome.css";

/**
 * ThemeStudio — phase-2 settings sections, mounted under ThemePicker
 * in the OS home settings panel. Each section has an anchor id so the
 * command palette can deep-link (onOpenSettings("studio-crt")).
 */

function Sec({ id, title, focus, children }: { id: string; title: string; focus?: string | null; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus === id) {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focus, id]);
  return (
    <div id={id} ref={ref} data-focus={focus === id || undefined} className="osh-studio-sec">
      <div className="osh-picker-sec">{title}</div>
      {children}
    </div>
  );
}

function Toggle({ on, onFlip, label }: { on: boolean; onFlip: () => void; label: string }) {
  return (
    <button className="osh-toggle" data-on={on || undefined} onClick={onFlip} role="switch" aria-checked={on}>
      <span className="osh-toggle-knob" />
      <span style={{ fontSize: 13 }}>{label}</span>
    </button>
  );
}

function Slider({ value, min, max, step, onChange, label, format }: {
  value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; label: string; format: (v: number) => string;
}) {
  return (
    <label className="osh-slider-row">
      <span style={{ fontSize: 12.5 }}>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="osh-slider"
      />
      <b style={{ fontSize: 12, minWidth: 44, textAlign: "right" }}>{format(value)}</b>
    </label>
  );
}

export default function ThemeStudio({
  focusSection,
  onOpenFolders,
  onOpenVault,
}: {
  focusSection?: string | null;
  onOpenFolders: () => void;
  onOpenVault: () => void;
}) {
  const { setDeviceTheme, setBackground, setAccent, deviceTheme } = useDeviceTheme();
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);

  // palette builder state
  const [palName, setPalName] = useState("");
  const [palColor, setPalColor] = useState("#17ff4d");
  const [palettes, setPalettes] = useState<CustomPalette[]>(() => getCustomPalettes());
  const [shared, setShared] = useState<string | null>(null);

  // boot logo
  const [bootLogo, setBootLogo] = useState<string | null>(() => getBootLogo());
  const [bootBusy, setBootBusy] = useState(false);
  useEffect(() => {
    const fn = () => setBootLogo(getBootLogo());
    window.addEventListener("orbitx:bootlogo", fn);
    return () => window.removeEventListener("orbitx:bootlogo", fn);
  }, []);

  const crt = getCrtFx();
  const aw = getAnimatedWallpaper();
  const iconPack = getIconPackId();
  const ssScene = getScreensaverScene();
  const ssTimeout = getScreensaverTimeout();
  const widgets = getEnabledWidgets();

  const dice = () => {
    const roll = rollRandomTheme();
    setDeviceTheme(roll.device);
    setBackground(roll.bg);
    setAccent(roll.accent);
  };

  const flipTimeAuto = () => {
    setTimeAutoLS(!getTimeAuto());
    window.dispatchEvent(new CustomEvent("orbitx:timeauto"));
    refresh();
  };

  const savePalette = () => {
    const def = saveCustomPalette(palName || "Custom", palColor, autoOnAccent(palColor));
    setPalettes(getCustomPalettes());
    setAccent(def.id);
    unlockAchievement("theme-smith");
    setPalName("");
  };

  const sharePalette = async (p: CustomPalette) => {
    const url = paletteShareUrl(p);
    try {
      await navigator.clipboard.writeText(url);
      setShared("Link copied — anyone opening it can import your palette.");
    } catch {
      setShared(url);
    }
    window.setTimeout(() => setShared((s) => (s && s.startsWith("http") ? s : null)), 6000);
  };

  return (
    <div>
      {/* 21 — randomizer */}
      <Sec id="studio-random" title="🎲 Surprise me" focus={focusSection}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="osh-pill-btn" onClick={dice}>
            <Dices style={{ width: 15, height: 15 }} /> Roll the dice
          </button>
          <span style={{ fontSize: 12.5, color: "var(--dt-muted)" }}>Random device + background + accent.</span>
        </div>
        <Toggle
          on={getSurpriseOnLogin()}
          onFlip={() => { setSurpriseOnLogin(!getSurpriseOnLogin()); refresh(); }}
          label="New random device theme every login"
        />
      </Sec>

      {/* 22 — time-based themes */}
      <Sec id="studio-time" title="🌓 Time-based themes" focus={focusSection}>
        <Toggle on={getTimeAuto()} onFlip={flipTimeAuto} label="Auto-switch with the time of day" />
        <div className="osh-schedule">
          {describeSchedule().map((s) => (
            <div key={s.slot} className="osh-schedule-row" data-now={getTimeSlot() === s.slot || undefined}>
              <span>{slotLabel(s.slot)}</span>
              <b>{s.themeName}</b>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11.5, color: "var(--dt-muted)", margin: "6px 0 0" }}>
          Picking a theme manually pauses auto-switch for 30 minutes.
        </p>
      </Sec>

      {/* 23 — music visualizer */}
      <Sec id="studio-pulse" title="🎵 Music visualizer" focus={focusSection}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!isPulsing() ? (
            <>
              <button className="osh-pill-btn" onClick={() => { startDemoPulse(); refresh(); }}>▶ Demo beat</button>
              <button
                className="osh-pill-btn"
                onClick={async () => {
                  try { await startMicPulse(); } catch { /* permission denied */ }
                  refresh();
                }}
              >
                🎙 Use microphone
              </button>
            </>
          ) : (
            <button className="osh-pill-btn" onClick={() => { stopPulse(); refresh(); }}>⏹ Stop pulse</button>
          )}
        </div>
        <p style={{ fontSize: 11.5, color: "var(--dt-muted)", margin: "6px 0 0" }}>
          The wallpaper breathes with the beat while pulsing is on.
        </p>
      </Sec>

      {/* 24 + 25 — CRT filter + intensity sliders */}
      <Sec id="studio-crt" title="📺 CRT filter" focus={focusSection}>
        <Toggle on={crt.enabled} onFlip={() => { setCrtFxEnabled(!crt.enabled); refresh(); }} label="CRT filter over any theme" />
        {crt.enabled && (
          <>
            <Slider value={crt.scanline} min={0} max={1} step={0.01} onChange={(v) => { setCrtScanline(v); refresh(); }} label="Scanlines" format={(v) => `${Math.round(v * 100)}%`} />
            <Slider value={crt.phosphor} min={0} max={1} step={0.01} onChange={(v) => { setCrtPhosphor(v); refresh(); }} label="Phosphor glow" format={(v) => `${Math.round(v * 100)}%`} />
            <Slider value={crt.pixel} min={0} max={12} step={1} onChange={(v) => { setCrtPixel(v); refresh(); }} label="Pixelation" format={(v) => (v === 0 ? "off" : `${v}px`)} />
          </>
        )}
      </Sec>

      {/* 9 — animated wallpapers */}
      <Sec id="studio-wallpaper" title="🌌 Animated wallpaper" focus={focusSection}>
        <div className="osh-chip-row">
          {ANIMATED_WALLPAPERS.map((w) => (
            <button
              key={w.id}
              className="osh-chip"
              data-active={aw === w.id || undefined}
              title={w.blurb}
              onClick={() => { setAnimatedWallpaper(w.id); refresh(); }}
            >
              {w.name}
            </button>
          ))}
        </div>
      </Sec>

      {/* 10 — icon packs */}
      <Sec id="studio-icons" title="🧩 Icon pack" focus={focusSection}>
        <div className="osh-chip-row">
          {ICON_PACKS.map((p) => (
            <button
              key={p.id}
              className="osh-chip"
              data-active={iconPack === p.id || undefined}
              title={p.blurb}
              onClick={() => { applyIconPack(p.id); refresh(); }}
            >
              {p.glyph} {p.name}
            </button>
          ))}
        </div>
      </Sec>

      {/* 7 — palette builder */}
      <Sec id="studio-palette" title="🎨 Palette builder" focus={focusSection}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            className="osh-vault-search"
            style={{ flex: "1 1 140px" }}
            placeholder="Palette name…"
            value={palName}
            maxLength={28}
            onChange={(e) => setPalName(e.target.value)}
          />
          <input
            type="color"
            value={palColor}
            onChange={(e) => setPalColor(e.target.value)}
            className="osh-color-input"
            aria-label="Accent color"
          />
          <button className="osh-pill-btn" onClick={savePalette}>Save palette</button>
        </div>
        {palettes.length > 0 && (
          <div className="osh-vault-list" style={{ marginTop: 8 }}>
            {palettes.map((p) => (
              <div key={p.id} className="osh-vault-row">
                <span className="osh-accent-dot" style={{ background: p.value, width: 18, height: 18 }} />
                <span style={{ fontSize: 13, flex: 1 }}>{p.name}</span>
                <button className="osh-link" onClick={() => setAccent(p.id)}>Apply</button>
                <button className="osh-link" onClick={() => sharePalette(p)}>Share</button>
                <button
                  className="osh-x-btn"
                  aria-label={`Delete ${p.name}`}
                  onClick={() => { deleteCustomPalette(p.id); setPalettes(getCustomPalettes()); }}
                >
                  <X style={{ width: 13, height: 13 }} />
                </button>
              </div>
            ))}
          </div>
        )}
        {shared && <p style={{ fontSize: 12, color: "var(--dt-accent)", wordBreak: "break-all" }}>{shared}</p>}
      </Sec>

      {/* 26 — boot logos */}
      <Sec id="studio-boot" title="🚀 Boot logo" focus={focusSection}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {bootLogo && (
            <img src={bootLogo} alt="Custom boot logo" style={{ height: 44, borderRadius: 8 }} />
          )}
          <label className="osh-pill-btn" style={{ cursor: "pointer" }}>
            <Upload style={{ width: 14, height: 14 }} /> {bootBusy ? "Saving…" : "Upload logo"}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setBootBusy(true);
                try { await setBootLogoFile(f); } catch { /* invalid file */ }
                setBootBusy(false);
                e.target.value = "";
              }}
            />
          </label>
          {bootLogo && (
            <button className="osh-link" onClick={clearBootLogo}>Restore default</button>
          )}
        </div>
      </Sec>

      {/* 27 — sounds */}
      <Sec id="studio-sound" title="🔔 Notification sounds" focus={focusSection}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Toggle
            on={getSoundPack() === "theme"}
            onFlip={() => { setSoundPack(getSoundPack() === "theme" ? "muted" : "theme"); refresh(); }}
            label={`Theme-native sounds (${deviceTheme.name})`}
          />
          <button className="osh-pill-btn" onClick={() => playNotify(deviceTheme.id)}>Test sound</button>
        </div>
      </Sec>

      {/* 35 + 36 — guest / streamer */}
      <Sec id="studio-modes" title="🕶 Guest & streamer" focus={focusSection}>
        <Toggle on={isGuestMode()} onFlip={() => { setGuestMode(!isGuestMode()); refresh(); }} label="Guest mode — demo without an account" />
        <Toggle on={isStreamerMode()} onFlip={() => { setStreamerMode(!isStreamerMode()); refresh(); }} label="Streamer mode — hide balances" />
      </Sec>

      {/* 32 — widgets */}
      <Sec id="studio-widgets" title="📊 Home widgets" focus={focusSection}>
        {(Object.keys(WIDGET_META) as WidgetId[]).map((id) => (
          <Toggle
            key={id}
            on={widgets.includes(id)}
            onFlip={() => {
              const next = widgets.includes(id) ? widgets.filter((w) => w !== id) : [...widgets, id];
              setEnabledWidgets(next);
              refresh();
            }}
            label={`${WIDGET_META[id].name} — ${WIDGET_META[id].blurb}`}
          />
        ))}
      </Sec>

      {/* 30 + 31 — screensaver */}
      <Sec id="studio-screensaver" title="💤 Screensaver" focus={focusSection}>
        <div className="osh-chip-row">
          {(
            [
              ["orbiting", "Orbiting tokens"],
              ["flyover", "City flyover"],
              ["off", "Off"],
            ] as [ScreensaverScene, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              className="osh-chip"
              data-active={ssScene === v || undefined}
              onClick={() => { setScreensaverScene(v); refresh(); }}
            >
              {label}
            </button>
          ))}
        </div>
        <Slider
          value={ssTimeout} min={1} max={30} step={1}
          onChange={(v) => { setScreensaverTimeout(v); refresh(); }}
          label="Idle timeout" format={(v) => `${v} min`}
        />
      </Sec>

      {/* 33 + 34 — folders & vault */}
      <Sec id="studio-folders" title="📂 Folders & vault" focus={focusSection}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="osh-pill-btn" onClick={onOpenFolders}>Manage folders</button>
          <button className="osh-pill-btn" onClick={onOpenVault}>🔒 Open vault</button>
        </div>
      </Sec>
    </div>
  );
}
