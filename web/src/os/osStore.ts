/**
 * OrbitX OS — persisted desktop state (localStorage only, no chain).
 * Icon positions are percentages of the desktop area so a layout survives
 * window resizes; settings hold wallpaper / accent / motion preferences.
 */

export type OsWallpaperId = "space" | "midnight" | "gold" | "ocean";

export interface OsSettings {
  wallpaper: OsWallpaperId;
  accent: string;
  reduceMotion: boolean;
  showTrayPrices: boolean;
}

export const OS_ACCENTS: { id: string; label: string; hex: string }[] = [
  { id: "gold", label: "Orbit Gold", hex: "#e8b84a" },
  { id: "blue", label: "Signal Blue", hex: "#60a5fa" },
  { id: "teal", label: "Circuit Teal", hex: "#2dd4bf" },
  { id: "violet", label: "Nebula Violet", hex: "#c084fc" },
];

export const OS_WALLPAPERS: { id: OsWallpaperId; label: string }[] = [
  { id: "space", label: "Deep Space" },
  { id: "midnight", label: "Midnight" },
  { id: "gold", label: "Gold Hour" },
  { id: "ocean", label: "Ocean" },
];

export const DEFAULT_OS_SETTINGS: OsSettings = {
  wallpaper: "space",
  accent: "#e8b84a",
  reduceMotion: false,
  showTrayPrices: true,
};

const SETTINGS_KEY = "orbitxos:settings:v1";
const ICONS_KEY = "orbitxos:icons:v1";
const FOLDERS_KEY = "orbitxos:folders:v1";

export type IconPos = { x: number; y: number }; // percentages 0..100

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function loadOsSettings(): OsSettings {
  const saved = readJson<Partial<OsSettings>>(SETTINGS_KEY);
  return { ...DEFAULT_OS_SETTINGS, ...saved };
}

export function saveOsSettings(s: OsSettings) {
  writeJson(SETTINGS_KEY, s);
}

export function loadIconPositions(): Record<string, IconPos> {
  const saved = readJson<Record<string, IconPos>>(ICONS_KEY);
  if (!saved) return {};
  const out: Record<string, IconPos> = {};
  for (const [k, v] of Object.entries(saved)) {
    if (v && typeof v.x === "number" && typeof v.y === "number") {
      out[k] = { x: Math.min(92, Math.max(0, v.x)), y: Math.min(88, Math.max(0, v.y)) };
    }
  }
  return out;
}

export function saveIconPositions(pos: Record<string, IconPos>) {
  writeJson(ICONS_KEY, pos);
}

export function clearIconPositions() {
  try {
    localStorage.removeItem(ICONS_KEY);
  } catch {
    /* ignore */
  }
}

export interface StoredFolder {
  id: string;
  name: string;
  appKeys: string[];
}

export function loadOsFolders(): StoredFolder[] {
  const saved = readJson<StoredFolder[]>(FOLDERS_KEY);
  if (!Array.isArray(saved)) return [];
  return saved.filter(
    (f) =>
      f &&
      typeof f.id === "string" &&
      typeof f.name === "string" &&
      Array.isArray(f.appKeys) &&
      f.appKeys.length > 0,
  );
}

export function saveOsFolders(folders: StoredFolder[]) {
  writeJson(FOLDERS_KEY, folders);
}
