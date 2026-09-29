import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  type AccentId,
  type BgThemeId,
  type DeviceThemeId,
  type ThemeSelection,
} from "./theme-registry";

interface ThemeContextValue {
  theme: ThemeSelection;
  setDevice: (d: DeviceThemeId) => void;
  setBg: (b: BgThemeId) => void;
  setAccent: (a: AccentId) => void;
  setTheme: (t: Partial<ThemeSelection>) => void;
  resetTheme: () => void;
  /** increments every time the device theme changes — drives boot animation */
  bootKey: number;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStored(): ThemeSelection {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    const parsed = JSON.parse(raw) as Partial<ThemeSelection>;
    return {
      device: parsed.device ?? DEFAULT_THEME.device,
      bg: parsed.bg ?? DEFAULT_THEME.bg,
      accent: parsed.accent ?? DEFAULT_THEME.accent,
    };
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyOsTheme(t: ThemeSelection) {
  const root = document.documentElement;
  root.setAttribute("data-os-device", t.device);
  root.setAttribute("data-os-bg", t.bg);
  root.setAttribute("data-os-accent", t.accent);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(t));
  } catch {
    /* storage unavailable — theme still applies for this session */
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lazy init reads the saved theme during first render — matches the
  // pre-paint script in index.html, so there is no flash.
  const [theme, setThemeState] = useState<ThemeSelection>(() => readStored());
  const [bootKey, setBootKey] = useState(0);

  useEffect(() => {
    applyOsTheme(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback((patch: Partial<ThemeSelection>) => {
    setThemeState((prev) => {
      const next = { ...prev, ...patch };
      applyOsTheme(next);
      if (patch.device && patch.device !== prev.device) {
        setBootKey((k) => k + 1);
      }
      return next;
    });
  }, []);

  const setDevice = useCallback((d: DeviceThemeId) => setTheme({ device: d }), [setTheme]);
  const setBg = useCallback((b: BgThemeId) => setTheme({ bg: b }), [setTheme]);
  const setAccent = useCallback((a: AccentId) => setTheme({ accent: a }), [setTheme]);
  const resetTheme = useCallback(() => {
    setThemeState(DEFAULT_THEME);
    applyOsTheme(DEFAULT_THEME);
  }, []);

  const value = useMemo(
    () => ({ theme, setDevice, setBg, setAccent, setTheme, resetTheme, bootKey }),
    [theme, setDevice, setBg, setAccent, setTheme, resetTheme, bootKey],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

/** Safe hook for components that may render outside the provider. */
export function useThemeOptional(): ThemeContextValue | null {
  return useContext(ThemeContext);
}
