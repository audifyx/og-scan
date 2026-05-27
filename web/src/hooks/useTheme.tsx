import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";
import { THEME_PRESETS, applyThemeVars } from "./themePresets";
export type { ThemePreset } from "./themePresets";



interface ThemeContextType {
  currentTheme: string;
  customWallpaper: string | null;
  themeGradient: string | null;
  setTheme: (themeId: string) => void;
  setCustomWallpaper: (url: string | null) => void;
  uploadWallpaper: (file: File) => Promise<string | null>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

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
    const _preset = THEME_PRESETS.find(t => t.id === themeId);
    setThemeGradient(_preset?.gradient ?? null);
    if (user) {
      supabase.from("profiles").update({ theme_preset: themeId } as any).eq("user_id", user.id).then(() => {});
    }
  }, [user]);

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

  return (
    <ThemeContext.Provider value={{ currentTheme, customWallpaper, themeGradient, setTheme, setCustomWallpaper, uploadWallpaper }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
};
