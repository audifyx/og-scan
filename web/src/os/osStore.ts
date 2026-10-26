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
  /* --- OS wave 5: look & feel --- */
  themeMode: "dark" | "light";
  focusMode: boolean;
  windowBorder: "rounded" | "sharp" | "neon";
  taskbarStyle: "pill" | "bar";
  iconSize: number;
  showIconLabels: boolean;
  fontFamily: "system" | "serif" | "mono";
  uiScale: "s" | "m" | "l";
  wallBlur: number;
  scrimOpacity: number;
  wallpaperShuffle: boolean;
  animSpeed: number;
  accentGrad: string | null;
  widgetSize: "s" | "m" | "l";
  widgetOpacity: number;
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
  themeMode: "dark",
  focusMode: false,
  windowBorder: "rounded",
  taskbarStyle: "pill",
  iconSize: 56,
  showIconLabels: true,
  fontFamily: "system",
  uiScale: "m",
  wallBlur: 0,
  scrimOpacity: 100,
  wallpaperShuffle: false,
  animSpeed: 1,
  accentGrad: null,
  widgetSize: "m",
  widgetOpacity: 100,
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

/* ------------------------------------------------------------------ */
/* OS wave 2 — notifications, alerts, desk widgets, installed apps,   */
/* theme packs, lock screen, do-not-disturb, sync bookkeeping.        */
/* ------------------------------------------------------------------ */

export interface OsNotification {
  id: string;
  title: string;
  body: string;
  kind: "price" | "alert" | "social" | "system";
  at: number;
  read: boolean;
}

export interface OsPriceAlert {
  id: string;
  mint: string;
  symbol: string;
  target: number;
  direction: "above" | "below";
  createdAt: number;
  triggered: boolean;
}

export type DeskWidgetType = "ticker" | "trending" | "alerts" | "countdown" | "quote";

export interface DeskWidget {
  id: string;
  type: DeskWidgetType;
  x: number; // percentages
  y: number;
  /** Countdown widget (idea bank #1009). */
  label?: string;
  targetDate?: string; // YYYY-MM-DD
}

export interface InstalledApp {
  key: string;
  name: string;
  caption: string;
  href: string;
  iconBg: string;
  glyph: string;
  source: "external" | "devmarket";
}

export interface ThemePack {
  id: string;
  name: string;
  wallpaper: OsWallpaperId;
  accent: string;
  /** Icon tile corner radius (px) — the "icon pack" half of a theme. */
  radius: number;
  /** Icon tile ring/glow (css box-shadow value, "" for none). */
  ring: string;
  author: string;
}

export const DEFAULT_THEME_PACKS: ThemePack[] = [
  { id: "orbit-gold", name: "Orbit Gold", wallpaper: "space", accent: "#e8b84a", radius: 18, ring: "", author: "OrbitX" },
  { id: "neon-night", name: "Neon Night", wallpaper: "midnight", accent: "#c084fc", radius: 24, ring: "0 0 0 1px rgba(192,132,252,.45), 0 0 18px rgba(192,132,252,.25)", author: "OrbitX" },
  { id: "ocean-trader", name: "Ocean Trader", wallpaper: "ocean", accent: "#2dd4bf", radius: 999, ring: "", author: "OrbitX" },
];

const NOTIFICATIONS_KEY = "orbitxos:notifications:v1";
const ALERTS_KEY = "orbitxos:alerts:v1";
const DESK_WIDGETS_KEY = "orbitxos:desk-widgets:v1";
const INSTALLED_KEY = "orbitxos:installed:v1";
const PACKS_KEY = "orbitxos:packs:v1";
const LOCK_KEY = "orbitxos:lock:v1";
const DND_KEY = "orbitxos:dnd:v1";
const SYNC_META_KEY = "orbitxos:sync-meta:v1";
const ACTIVE_PACK_KEY = "orbitxos:active-pack:v1";

export function loadOsNotifications(): OsNotification[] {
  const saved = readJson<OsNotification[]>(NOTIFICATIONS_KEY);
  return Array.isArray(saved) ? saved.filter((n) => n && typeof n.id === "string") : [];
}
export function saveOsNotifications(n: OsNotification[]) {
  writeJson(NOTIFICATIONS_KEY, n.slice(0, 100));
}

export function loadOsAlerts(): OsPriceAlert[] {
  const saved = readJson<OsPriceAlert[]>(ALERTS_KEY);
  return Array.isArray(saved) ? saved.filter((a) => a && typeof a.mint === "string") : [];
}
export function saveOsAlerts(a: OsPriceAlert[]) {
  writeJson(ALERTS_KEY, a);
}

export function loadDeskWidgets(): DeskWidget[] {
  const saved = readJson<DeskWidget[]>(DESK_WIDGETS_KEY);
  if (!Array.isArray(saved)) return [];
  return saved.filter(
    (w) =>
      w &&
      (w.type === "ticker" ||
        w.type === "trending" ||
        w.type === "alerts" ||
        w.type === "countdown" ||
        w.type === "quote"),
  );
}
export function saveDeskWidgets(w: DeskWidget[]) {
  writeJson(DESK_WIDGETS_KEY, w);
}

/* --- OS wave 4: tasks, calendar events, recently closed windows --- */

export interface OsTask {
  id: string;
  title: string;
  done: boolean;
  priority: "low" | "normal" | "high";
  due?: string; // YYYY-MM-DD
  createdAt: number;
}

export interface OsCalEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
}

export interface OsClosedWindow {
  id: string;
  kind: string;
  appKey?: string;
  title: string;
  hrefOverride?: string;
  closedAt: number;
}

const TASKS_KEY = "orbitxos:tasks:v1";
const CAL_EVENTS_KEY = "orbitxos:events:v1";
const CLOSED_KEY = "orbitxos:closed:v1";

export function loadOsTasks(): OsTask[] {
  const saved = readJson<OsTask[]>(TASKS_KEY);
  return Array.isArray(saved) ? saved.filter((t) => t && typeof t.title === "string") : [];
}
export function saveOsTasks(t: OsTask[]) {
  writeJson(TASKS_KEY, t.slice(0, 500));
}
export function loadOsCalEvents(): OsCalEvent[] {
  const saved = readJson<OsCalEvent[]>(CAL_EVENTS_KEY);
  return Array.isArray(saved) ? saved.filter((e) => e && typeof e.date === "string" && typeof e.title === "string") : [];
}
export function saveOsCalEvents(e: OsCalEvent[]) {
  writeJson(CAL_EVENTS_KEY, e.slice(0, 1000));
}
export function loadOsClosed(): OsClosedWindow[] {
  const saved = readJson<OsClosedWindow[]>(CLOSED_KEY);
  return Array.isArray(saved) ? saved.filter((c) => c && typeof c.title === "string") : [];
}
export function saveOsClosed(c: OsClosedWindow[]) {
  writeJson(CLOSED_KEY, c.slice(0, 10));
}

export function loadInstalledApps(): InstalledApp[] {
  const saved = readJson<InstalledApp[]>(INSTALLED_KEY);
  return Array.isArray(saved) ? saved.filter((a) => a && typeof a.key === "string" && typeof a.href === "string") : [];
}
export function saveInstalledApps(a: InstalledApp[]) {
  writeJson(INSTALLED_KEY, a);
}

export function loadThemePacks(): ThemePack[] {
  const saved = readJson<ThemePack[]>(PACKS_KEY);
  return Array.isArray(saved) && saved.length ? saved : DEFAULT_THEME_PACKS;
}
export function saveThemePacks(p: ThemePack[]) {
  writeJson(PACKS_KEY, p);
}

export interface LockState {
  enabled: boolean;
  pinHash: string; // sha-256 hex of the PIN, device-local only
}
export function loadLockState(): LockState {
  const saved = readJson<LockState>(LOCK_KEY);
  return saved && typeof saved.pinHash === "string" ? saved : { enabled: false, pinHash: "" };
}
export function saveLockState(s: LockState) {
  writeJson(LOCK_KEY, s);
}

export function loadDnd(): boolean {
  return readJson<boolean>(DND_KEY) === true;
}
export function saveDnd(v: boolean) {
  writeJson(DND_KEY, v);
}

export function loadSyncMeta(): { lastSyncAt: number } {
  const saved = readJson<{ lastSyncAt: number }>(SYNC_META_KEY);
  return saved && typeof saved.lastSyncAt === "number" ? saved : { lastSyncAt: 0 };
}
export function saveSyncMeta(m: { lastSyncAt: number }) {
  writeJson(SYNC_META_KEY, m);
}

export function loadActivePackId(): string {
  const saved = readJson<string>(ACTIVE_PACK_KEY);
  return typeof saved === "string" && saved ? saved : "orbit-gold";
}
export function saveActivePackId(id: string) {
  writeJson(ACTIVE_PACK_KEY, id);
}

/** SHA-256 hex of a short PIN (WebCrypto; falls back to a plain hash). */
export async function hashPin(pin: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`orbitx-os-pin:${pin}`));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = 0;
    for (const c of pin) h = (h * 31 + c.charCodeAt(0)) | 0;
    return `fallback:${h}`;
  }
}

/* ------------------------------------------------------------------ */
/* OS wave 3 — notes, files shelf, bookmarks, history, browser tabs,  */
/* virtual desktops, saved window layouts. Notes + bookmarks sync    */
/* through the account layout; the rest stays device-local.           */
/* ------------------------------------------------------------------ */

export interface OsNote {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
  /** Optional folder label (idea bank #1101). Synced with the note (JSONB). */
  folder?: string;
}

export interface OsFileItem {
  id: string;
  name: string;
  /** "text" = typed note-file; "file" = uploaded small file (data URL). */
  kind: "text" | "file";
  content: string;
  size: number;
  at: number;
}

export interface OsBookmark {
  id: string;
  title: string;
  url: string;
}

export interface OsDesktop {
  id: string;
  name: string;
}

export interface OsLayoutSnapshot {
  id: string;
  name: string;
  wins: { kind: string; appKey?: string; title: string; hrefOverride?: string }[];
}

const NOTES_KEY = "orbitxos:notes:v1";
const FILES_KEY = "orbitxos:files:v1";
const BOOKMARKS_KEY = "orbitxos:bookmarks:v1";
const HISTORY_KEY = "orbitxos:history:v1";
const BROWSER_TABS_KEY = "orbitxos:browsertabs:v1";
const DESKTOPS_KEY = "orbitxos:desktops:v1";
const LAYOUTS_KEY = "orbitxos:layouts:v1";

export function loadOsNotes(): OsNote[] {
  const saved = readJson<OsNote[]>(NOTES_KEY);
  return Array.isArray(saved) ? saved.filter((n) => n && typeof n.id === "string") : [];
}
export function saveOsNotes(n: OsNote[]) {
  writeJson(NOTES_KEY, n.slice(0, 200));
}

export function loadOsFiles(): OsFileItem[] {
  const saved = readJson<OsFileItem[]>(FILES_KEY);
  return Array.isArray(saved) ? saved.filter((f) => f && typeof f.id === "string" && typeof f.content === "string") : [];
}
export function saveOsFiles(f: OsFileItem[]) {
  writeJson(FILES_KEY, f.slice(0, 100));
}

export function loadOsBookmarks(): OsBookmark[] {
  const saved = readJson<OsBookmark[]>(BOOKMARKS_KEY);
  return Array.isArray(saved) ? saved.filter((b) => b && typeof b.url === "string") : [];
}
export function saveOsBookmarks(b: OsBookmark[]) {
  writeJson(BOOKMARKS_KEY, b.slice(0, 200));
}

export function loadOsHistory(): string[] {
  const saved = readJson<string[]>(HISTORY_KEY);
  return Array.isArray(saved) ? saved.filter((u) => typeof u === "string") : [];
}
export function saveOsHistory(h: string[]) {
  writeJson(HISTORY_KEY, h.slice(0, 100));
}

export interface StoredBrowserTab {
  id: string;
  url: string;
  title: string;
  /** Private tab (idea bank #813): visits are not recorded in history. */
  private?: boolean;
}
export function loadBrowserTabs(): StoredBrowserTab[] | null {
  const saved = readJson<StoredBrowserTab[]>(BROWSER_TABS_KEY);
  if (!Array.isArray(saved) || !saved.length) return null;
  const ok = saved.filter((t) => t && typeof t.url === "string" && typeof t.title === "string");
  return ok.length ? ok : null;
}
export function saveBrowserTabs(t: StoredBrowserTab[]) {
  writeJson(BROWSER_TABS_KEY, t.slice(0, 20));
}

export function loadOsDesktops(): OsDesktop[] {
  const saved = readJson<OsDesktop[]>(DESKTOPS_KEY);
  if (!Array.isArray(saved) || !saved.length) return [{ id: "main", name: "Main" }];
  return saved.filter((d) => d && typeof d.id === "string" && typeof d.name === "string").slice(0, 4);
}
export function saveOsDesktops(d: OsDesktop[]) {
  writeJson(DESKTOPS_KEY, d.slice(0, 4));
}

export function loadOsLayouts(): OsLayoutSnapshot[] {
  const saved = readJson<OsLayoutSnapshot[]>(LAYOUTS_KEY);
  return Array.isArray(saved) ? saved.filter((l) => l && typeof l.id === "string" && Array.isArray(l.wins)) : [];
}
export function saveOsLayouts(l: OsLayoutSnapshot[]) {
  writeJson(LAYOUTS_KEY, l.slice(0, 20));
}
