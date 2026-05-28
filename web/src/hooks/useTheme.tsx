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

export type { ThemePreset } from "./themePresets";

// Combined export — base + auto-generated extras. Custom user themes get appended at runtime
// by the provider below so they show up in pickers without a rebuild.
export const THEME_PRESETS: ThemePreset[] = [...BASE_PRESETS, ...THEME_PRESETS_EXTRA];

const CUSTOM_KEY = "og-custom-themes";

interface ThemeContextType {
  currentTheme: string;
  customWallpaper: string | null;
  themeGradient: string | null;
  customThemes: ThemePreset[];
  allThemes: ThemePreset[];
  setTheme: (themeId: string) => void;
  setCustomWallpaper: (url: string | null) => void;
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

  // Keep applyThemeVars aware of custom themes
  useEffect(() => {
    registerCustomThemes(customThemes);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(customThemes));
  }, [customThemes]);

  // Load from profile on login
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("theme_preset, custom_wallpaper_url").eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data?.theme_preset) {
          setCurrentTheme(data.theme_preset);
          localStorage.setItem("sol-theme", data.theme_preset);
        }
        if (data?.custom_wallpaper_url) {
          setCustomWallpaperState(data.custom_wallpaper_url);
          localStorage.setItem("sol-wallpaper", data.custom_wallpaper_url);
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
    // If the deleted theme was active, fall back to default
    if (currentTheme === themeId) {
      setTheme("og-hacker");
    }
  }, [currentTheme, setTheme]);

  const allThemes = useMemo(() => [...THEME_PRESETS, ...customThemes], [customThemes]);

  return (
    <ThemeContext.Provider value={{
      currentTheme, customWallpaper, themeGradient,
      customThemes, allThemes,
      setTheme, setCustomWallpaper, uploadWallpaper,
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
