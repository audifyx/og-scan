import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";
import {
  THEME_PRESETS as BASE_PRESETS,
  applyThemeVars,
  setCustomThemes as registerCustomThemes,
  type ThemePreset,
} from "./themePresets";
import { THEME_PRESETS_EXTRA } from "./themePresetsExtra";
import { type AnimatedWallpaperPreset, ANIMATED_WALLPAPERS } from "@/data/animatedWallpapers";

export type { ThemePreset } from "./themePresets";

export const THEME_PRESETS: ThemePreset[] = [...BASE_PRESETS, ...THEME_PRESETS_EXTRA];

const CUSTOM_KEY = "og-custom-themes";
const ANIMATED_WALLPAPER_KEY = "og-animated-wallpaper";
const TAB_WALLPAPERS_KEY = "og-tab-wallpapers";

interface ThemeContextType {
  currentTheme: string;
  customWallpaper: string | null;
  themeGradient: string | null;
  customThemes: ThemePreset[];
  allThemes: ThemePreset[];
  animatedWallpaper: string | null;
  tabWallpapers: Record<string, string | null>;
  setTheme: (themeId: string) => void;
  setCustomWallpaper: (url: string | null) => void;
  setAnimatedWallpaper: (id: string | null) => void;
  setTabWallpaper: (tabId: string, url: string | null) => void;
  uploadWallpaper: (file: File) => Promise<string | null>;
  saveCustomTheme: (theme: ThemePreset) => void;
  deleteCustomTheme: (themeId: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function loadCustomThemes(): ThemePreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => t && typeof t.id === "string" && t.vars);
  } catch {
    return [];
  }
}

function loadAnimatedWallpaper(): string | null {
  return localStorage.getItem(ANIMATED_WALLPAPER_KEY);
}

function loadTabWallpapers(): Record<string, string | null> {
  try {
    const raw = localStorage.getItem(TAB_WALLPAPERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem("sol-theme") || "og-hacker";
  });
  const [customWallpaper, setCustomWallpaperState] = useState<string | null>(() => {
    return localStorage.getItem("sol-wallpaper") || null;
  });
  const [themeGradient, setThemeGradient] = useState<string | null>(() => {
    return localStorage.getItem("og-theme-gradient") || null;
  });
  const [customThemes, setCustomThemesState] = useState<ThemePreset[]>(() => {
    const loaded = loadCustomThemes();
    registerCustomThemes(loaded);
    return loaded;
  });
  const [animatedWallpaper, setAnimatedWallpaperState] = useState<string | null>(() => {
    return loadAnimatedWallpaper();
  });
  const [tabWallpapers, setTabWallpapersState] = useState<Record<string, string | null>>(() => {
    return loadTabWallpapers();
  });

  // Keep applyThemeVars aware of custom themes
  useEffect(() => {
    registerCustomThemes(customThemes);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(customThemes));
  }, [customThemes]);

  // Load from profile on login
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("theme_preset, custom_wallpaper_url, animated_wallpaper_url").eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data?.theme_preset) {
          setCurrentTheme(data.theme_preset);
          localStorage.setItem("sol-theme", data.theme_preset);
        }
        if (data?.custom_wallpaper_url) {
          setCustomWallpaperState(data.custom_wallpaper_url);
          localStorage.setItem("sol-wallpaper", data.custom_wallpaper_url);
        }
        if (data?.animated_wallpaper_url) {
          setAnimatedWallpaperState(data.animated_wallpaper_url);
          localStorage.setItem(ANIMATED_WALLPAPER_KEY, data.animated_wallpaper_url);
        }
      });
  }, [user]);

  // Apply on change
  useEffect(() => {
    applyThemeVars(currentTheme);
  }, [currentTheme]);

  const setTheme = useCallback((themeId: string) => {
    setCurrentTheme(themeId);
    localStorage.setItem("sol-theme", themeId);
    applyThemeVars(themeId);
    const allNow = [...THEME_PRESETS, ...customThemes];
    const _preset = allNow.find(t => t.id === themeId);
    setThemeGradient(_preset?.gradient ?? null);
    if (user) {
      supabase.from("profiles").update({ theme_preset: themeId } as any).eq("user_id", user.id).then(() => {});
    }
  }, [user, customThemes]);

  const setCustomWallpaper = useCallback((url: string | null) => {
    setCustomWallpaperState(url);
    if (url) localStorage.setItem("sol-wallpaper", url);
    else localStorage.removeItem("sol-wallpaper");
    if (user) {
      supabase.from("profiles").update({ custom_wallpaper_url: url } as any).eq("user_id", user.id).then(() => {});
    }
  }, [user]);

  const setAnimatedWallpaper = useCallback((id: string | null) => {
    setAnimatedWallpaperState(id);
    if (id) localStorage.setItem(ANIMATED_WALLPAPER_KEY, id);
    else localStorage.removeItem(ANIMATED_WALLPAPER_KEY);
    if (user) {
      supabase.from("profiles").update({ animated_wallpaper_url: id } as any).eq("user_id", user.id).then(() => {});
    }
  }, [user]);

  const setTabWallpaper = useCallback((tabId: string, url: string | null) => {
    setTabWallpapersState((prev) => {
      const next = { ...prev, [tabId]: url };
      localStorage.setItem(TAB_WALLPAPERS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const uploadWallpaper = useCallback(async (file: File): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/wallpaper-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("wallpapers").upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("wallpapers").getPublicUrl(path);
    const url = data.publicUrl;
    setCustomWallpaper(url);
    return url;
  }, [user, setCustomWallpaper]);

  const saveCustomTheme = useCallback((theme: ThemePreset) => {
    setCustomThemesState((prev) => {
      const filtered = prev.filter((t) => t.id !== theme.id);
      return [...filtered, theme];
    });
  }, []);

  const deleteCustomTheme = useCallback((themeId: string) => {
    setCustomThemesState((prev) => prev.filter((t) => t.id !== themeId));
    if (currentTheme === themeId) {
      setTheme("og-hacker");
    }
  }, [currentTheme, setTheme]);

  const allThemes = useMemo(() => [...THEME_PRESETS, ...customThemes], [customThemes]);

  return (
    <ThemeContext.Provider value={{
      currentTheme, customWallpaper, themeGradient,
      customThemes, allThemes,
      animatedWallpaper, tabWallpapers,
      setTheme, setCustomWallpaper, setAnimatedWallpaper, setTabWallpaper,
      uploadWallpaper,
      saveCustomTheme, deleteCustomTheme,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
};
