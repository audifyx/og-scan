/**
 * OrbitX City title-screen theme.
 * Midnight / champagne / ice — not arcade lime.
 */

export type TitleDistrictId = "nyc" | "miami" | "la" | "boston";

export interface TitleDistrictTheme {
  id: TitleDistrictId;
  shortName: string;
  sky: string;
  fog: string;
  key: string;
  fill: string;
  window: string;
  rim: string;
  uiAccent: string;
}

export const ARCADE_LIME = ["#00ff9f", "#39ff14", "#17ff4d"] as const;

export const TITLE_THEMES: Record<TitleDistrictId, TitleDistrictTheme> = {
  nyc: {
    id: "nyc",
    shortName: "NYC",
    sky: "#101c32",
    fog: "#1a2a44",
    key: "#ffe4b0",
    fill: "#9ec0ea",
    window: "#ffe9b8",
    rim: "#c5a26f",
    uiAccent: "#c5a26f",
  },
  miami: {
    id: "miami",
    shortName: "Miami",
    sky: "#0c2432",
    fog: "#163848",
    key: "#8ee8dc",
    fill: "#6ab8dc",
    window: "#a8f0e4",
    rim: "#5ec4b6",
    uiAccent: "#5ec4b6",
  },
  la: {
    id: "la",
    shortName: "LA",
    sky: "#1a1428",
    fog: "#241c34",
    key: "#e8b8ff",
    fill: "#f0b888",
    window: "#e8c4ff",
    rim: "#b388ff",
    uiAccent: "#b388ff",
  },
  boston: {
    id: "boston",
    shortName: "Boston",
    sky: "#102038",
    fog: "#1a2c48",
    key: "#a8c8ff",
    fill: "#b0d0f0",
    window: "#b4d4ff",
    rim: "#5b8def",
    uiAccent: "#5b8def",
  },
};

export type TitleNavId = "play" | "multiplayer" | "settings" | "quick";

export const TITLE_NAV: {
  id: TitleNavId;
  label: string;
  hint: string;
  primary?: boolean;
}[] = [
  { id: "play", label: "Play", hint: "Choose operative", primary: true },
  { id: "multiplayer", label: "Multiplayer", hint: "Lobbies & rooms" },
  { id: "settings", label: "Settings", hint: "Audio · quality · touch" },
  { id: "quick", label: "Quick Play", hint: "Skip setup · demo" },
];

export function isTitleDistrictId(value: string): value is TitleDistrictId {
  return value === "nyc" || value === "miami" || value === "la" || value === "boston";
}

export function resolveTitleTheme(cityId: string | undefined): TitleDistrictTheme {
  if (cityId && isTitleDistrictId(cityId)) return TITLE_THEMES[cityId];
  return TITLE_THEMES.nyc;
}

export function normalizeHex(hex: string): string {
  return hex.trim().toLowerCase();
}

export function isArcadeLime(hex: string): boolean {
  return (ARCADE_LIME as readonly string[]).includes(normalizeHex(hex));
}

export function titleThemeUsesArcadeLime(theme: TitleDistrictTheme): boolean {
  return [theme.sky, theme.fog, theme.key, theme.fill, theme.window, theme.rim, theme.uiAccent].some(
    isArcadeLime,
  );
}

export function titleCssVars(theme: TitleDistrictTheme): Record<string, string> {
  return {
    "--title-accent": theme.uiAccent,
    "--title-key": theme.key,
    "--title-fill": theme.fill,
    "--title-rim": theme.rim,
    "--title-sky": theme.sky,
    "--menu-accent": theme.uiAccent,
  };
}
