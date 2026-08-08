import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BG_KEY,
  WALLPAPER_KEY,
  readBgMode,
  type BgMode,
} from "@/components/BackgroundFX";

type AtmosphereContextValue = {
  mode: BgMode;
  wallpaper: string | null;
  setMode: (mode: BgMode) => void;
  setWallpaper: (dataUrl: string | null) => void;
  themeOpen: boolean;
  openTheme: () => void;
  closeTheme: () => void;
};

const AtmosphereContext = createContext<AtmosphereContextValue | null>(null);
const EVENT = "ox-atmosphere";

function readWallpaper(): string | null {
  try {
    return localStorage.getItem(WALLPAPER_KEY) || localStorage.getItem("sol-wallpaper") || null;
  } catch {
    return null;
  }
}

function persistMode(mode: BgMode) {
  try {
    localStorage.setItem(BG_KEY, mode);
  } catch {
    /* noop */
  }
}

function persistWallpaper(dataUrl: string | null) {
  try {
    if (dataUrl) {
      localStorage.setItem(WALLPAPER_KEY, dataUrl);
      localStorage.setItem("sol-wallpaper", dataUrl);
    } else {
      localStorage.removeItem(WALLPAPER_KEY);
      // keep sol-wallpaper if it was a cloud URL (http) — only clear when clearing hub custom
      const sol = localStorage.getItem("sol-wallpaper");
      if (sol && sol.startsWith("data:")) localStorage.removeItem("sol-wallpaper");
    }
  } catch {
    /* noop */
  }
}

function broadcast() {
  try {
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* noop */
  }
}

export function OrbitAtmosphereProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<BgMode>(() => readBgMode());
  const [wallpaper, setWallpaperState] = useState<string | null>(() => readWallpaper());
  const [themeOpen, setThemeOpen] = useState(false);

  const sync = useCallback(() => {
    setModeState(readBgMode());
    setWallpaperState(readWallpaper());
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === BG_KEY || e.key === WALLPAPER_KEY || e.key === "sol-wallpaper") sync();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT, sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT, sync);
    };
  }, [sync]);

  // One-time migrate: if ThemeProvider has a wallpaper but Hub key is empty, seed it.
  useEffect(() => {
    try {
      if (!localStorage.getItem(WALLPAPER_KEY)) {
        const sol = localStorage.getItem("sol-wallpaper");
        if (sol) {
          localStorage.setItem(WALLPAPER_KEY, sol);
          if (!localStorage.getItem(BG_KEY)) localStorage.setItem(BG_KEY, "custom");
          sync();
        }
      }
    } catch {
      /* noop */
    }
  }, [sync]);

  const setMode = useCallback((next: BgMode) => {
    setModeState(next);
    persistMode(next);
    broadcast();
  }, []);

  const setWallpaper = useCallback(
    (dataUrl: string | null) => {
      setWallpaperState(dataUrl);
      persistWallpaper(dataUrl);
      if (dataUrl) {
        setModeState("custom");
        persistMode("custom");
      } else if (mode === "custom") {
        setModeState("nebula");
        persistMode("nebula");
      }
      broadcast();
    },
    [mode],
  );

  const value = useMemo(
    () => ({
      mode,
      wallpaper,
      setMode,
      setWallpaper,
      themeOpen,
      openTheme: () => setThemeOpen(true),
      closeTheme: () => setThemeOpen(false),
    }),
    [mode, wallpaper, setMode, setWallpaper, themeOpen],
  );

  return <AtmosphereContext.Provider value={value}>{children}</AtmosphereContext.Provider>;
}

export function useOrbitAtmosphere() {
  const ctx = useContext(AtmosphereContext);
  if (!ctx) throw new Error("useOrbitAtmosphere must be used within OrbitAtmosphereProvider");
  return ctx;
}

/** Safe for ogdex / optional trees — returns null outside provider. */
export function useOrbitAtmosphereOptional() {
  return useContext(AtmosphereContext);
}
