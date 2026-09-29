import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import "./css/index.css";
import {
  ACCENTS,
  BACKGROUND_THEMES,
  BG_THEME_KEY,
  ACCENT_KEY,
  DEFAULT_ACCENT,
  DEFAULT_BG_THEME,
  DEFAULT_DEVICE_THEME,
  DEVICE_THEME_KEY,
  DEVICE_THEMES,
  getAccent,
  getBackground,
  getDeviceTheme,
  type AccentDef,
  type BackgroundThemeDef,
  type DeviceThemeDef,
} from "./themes";
import { rollRandomTheme, shouldSurpriseThisSession } from "./randomizer";
import {
  SLOT_THEMES,
  getTimeAuto,
  getTimeSlot,
  manualPauseActive,
  markManualThemeChange,
} from "./timeThemes";
/* Phase-2 boot wiring: re-apply every persisted FX setting on mount so a
   reload restores CRT, modes, icon pack, custom palettes, and the animated
   wallpaper exactly as the user left them. All additive — no phase-1 state
   is touched. */
import { applyCrtFx } from "./crtFx";
import { applyModes } from "./modes";
import { applyIconPack } from "./iconPacks";
import { restoreCustomPalettes } from "./paletteBuilder";
import { applyAnimatedWallpaper } from "./wallpapers";
/* Phase 2: cross-platform theme core — presets + portable snapshots. */
import type { ThemePreset } from "./crossPlatform";

interface DeviceThemeContextValue {
  deviceTheme: DeviceThemeDef;
  background: BackgroundThemeDef;
  accent: AccentDef;
  setDeviceTheme: (id: string) => void;
  setBackground: (id: string) => void;
  setAccent: (id: string) => void;
  resetAll: () => void;
  /** Apply a named preset (background + accent, optional device pin). */
  applyPreset: (preset: ThemePreset) => void;
}

function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Safe fallback so useDeviceTheme never throws — provider overrides these. */
const fallbackValue: DeviceThemeContextValue = {
  deviceTheme: DEVICE_THEMES[0],
  background: BACKGROUND_THEMES[0],
  accent: ACCENTS[0],
  setDeviceTheme: () => {},
  setBackground: () => {},
  setAccent: () => {},
  resetAll: () => {},
  applyPreset: () => {},
};

const DeviceThemeContext = createContext<DeviceThemeContextValue>(fallbackValue);

/**
 * Applies the three data attributes the whole engine keys off:
 *   <html data-device-theme="xbox360" data-bg-theme="nebula" data-accent="lime">
 * Every theme's CSS lives under web/src/themes/css/ and is scoped to those
 * selectors, so ONE theme choice re-skins every route/app platform-wide.
 */
function applyAttrs(device: string, bg: string, accent: string) {
  const el = document.documentElement;
  el.dataset.deviceTheme = device;
  el.dataset.bgTheme = bg;
  el.dataset.accent = accent;
}

export function DeviceThemeProvider({ children }: { children: ReactNode }) {
  const [deviceId, setDeviceId] = useState<string>(
    () => readLS(DEVICE_THEME_KEY) || DEFAULT_DEVICE_THEME
  );
  const [bgId, setBgId] = useState<string>(() => readLS(BG_THEME_KEY) || DEFAULT_BG_THEME);
  const [accentId, setAccentId] = useState<string>(() => readLS(ACCENT_KEY) || DEFAULT_ACCENT);

  // Tracks the device id for the time-auto interval without re-arming it.
  const deviceIdRef = useRef(deviceId);
  useEffect(() => {
    deviceIdRef.current = deviceId;
  }, [deviceId]);
  // True while the provider itself is applying an automatic switch, so
  // auto changes don't count as "manual" (which would pause time-auto).
  const autoApplying = useRef(false);

  // Paint attributes ASAP on mount (before first paint flash where possible).
  useEffect(() => {
    applyAttrs(deviceId, bgId, accentId);
  }, [deviceId, bgId, accentId]);

  const setDeviceTheme = useCallback((id: string) => {
    if (!DEVICE_THEMES.some((t) => t.id === id)) return;
    // Manual picks pause time-based auto-switching for 30 min (timeThemes).
    if (!autoApplying.current) markManualThemeChange();
    // Kill transitions for one frame so the re-skin is instant, not smeary.
    document.documentElement.classList.add("dt-no-transition");
    setDeviceId(id);
    try {
      localStorage.setItem(DEVICE_THEME_KEY, id);
    } catch { /* storage may be unavailable */ }
    requestAnimationFrame(() =>
      requestAnimationFrame(() => document.documentElement.classList.remove("dt-no-transition"))
    );
  }, []);

  const setBackground = useCallback((id: string) => {
    if (!BACKGROUND_THEMES.some((t) => t.id === id)) return;
    setBgId(id);
    try {
      localStorage.setItem(BG_THEME_KEY, id);
    } catch { /* storage may be unavailable */ }
  }, []);

  const setAccent = useCallback((id: string) => {
    if (!ACCENTS.some((t) => t.id === id)) return;
    setAccentId(id);
    try {
      localStorage.setItem(ACCENT_KEY, id);
    } catch { /* storage may be unavailable */ }
  }, []);

  const resetAll = useCallback(() => {
    setDeviceTheme(DEFAULT_DEVICE_THEME);
    setBackground(DEFAULT_BG_THEME);
    setAccent(DEFAULT_ACCENT);
  }, [setDeviceTheme, setBackground, setAccent]);

  /* ---- Phase 2: surprise-on-login dice (randomizer.ts, idea 21) ---- */
  const bootPick = useRef({ device: deviceId, bg: bgId, accent: accentId });
  const surprised = useRef(false);
  useEffect(() => {
    if (!shouldSurpriseThisSession()) return;
    surprised.current = true;
    const roll = rollRandomTheme(bootPick.current);
    autoApplying.current = true;
    setDeviceTheme(roll.device);
    setBackground(roll.bg);
    setAccent(roll.accent);
    autoApplying.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Phase 2: re-apply persisted FX settings on boot (additive) ---- */
  useEffect(() => {
    try {
      restoreCustomPalettes();
      applyCrtFx();
      applyModes();
      applyIconPack();
      applyAnimatedWallpaper();
    } catch {
      /* a broken persisted setting must never break boot */
    }
  }, []);

  /* ---- Phase 2: time-based auto-switch (timeThemes.ts, idea 22) ---- */
  // Bumped by the "orbitx:timeauto" event so toggling the setting in the
  // command palette / ThemeStudio arms or disarms the interval live.
  const [timeAutoRev, setTimeAutoRev] = useState(0);
  useEffect(() => {
    const fn = () => setTimeAutoRev((r) => r + 1);
    window.addEventListener("orbitx:timeauto", fn);
    return () => window.removeEventListener("orbitx:timeauto", fn);
  }, []);
  useEffect(() => {
    if (!getTimeAuto()) return;
    const tick = () => {
      if (manualPauseActive()) return;
      const id = SLOT_THEMES[getTimeSlot()];
      if (id && id !== deviceIdRef.current) {
        autoApplying.current = true;
        setDeviceTheme(id);
        autoApplying.current = false;
      }
    };
    // Don't immediately override a surprise-on-login roll; the minute
    // tick will still take over at the next slot change.
    if (!surprised.current) tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeAutoRev]);

  /* ---- Phase 2: cross-platform presets (background + accent, platform-wide) ---- */
  const applyPreset = useCallback(
    (preset: ThemePreset) => {
      autoApplying.current = true;
      try {
        if (preset.device) setDeviceTheme(preset.device);
        setBackground(preset.background);
        setAccent(preset.accent);
      } finally {
        autoApplying.current = false;
      }
    },
    [setDeviceTheme, setBackground, setAccent]
  );

  /* Stay in sync when a snapshot is applied outside React (partner embeds,
     webviews, or another tab). */
  useEffect(() => {
    const fn = (e: Event) => {
      const snap = (e as CustomEvent).detail as
        | { device?: string; background?: string; accent?: string }
        | undefined;
      if (!snap) return;
      autoApplying.current = true;
      try {
        if (snap.device) setDeviceTheme(snap.device);
        if (snap.background) setBackground(snap.background);
        if (snap.accent) setAccent(snap.accent);
      } finally {
        autoApplying.current = false;
      }
    };
    window.addEventListener("orbitx:theme-applied", fn);
    return () => window.removeEventListener("orbitx:theme-applied", fn);
  }, [setDeviceTheme, setBackground, setAccent]);

  const value = useMemo<DeviceThemeContextValue>(
    () => ({
      deviceTheme: getDeviceTheme(deviceId),
      background: getBackground(bgId),
      accent: getAccent(accentId),
      setDeviceTheme,
      setBackground,
      setAccent,
      resetAll,
      applyPreset,
    }),
    [deviceId, bgId, accentId, setDeviceTheme, setBackground, setAccent, resetAll, applyPreset]
  );

  return <DeviceThemeContext.Provider value={value}>{children}</DeviceThemeContext.Provider>;
}

/** Current device/background/accent theme + setters. Never throws (falls back to OrbitX native). */
export function useDeviceTheme(): DeviceThemeContextValue {
  return useContext(DeviceThemeContext);
}
