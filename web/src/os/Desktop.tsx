/**
 * OrbitX OS — the /app desktop shell (Windows 11-style, centered).
 *
 * Everything the old Hub showed, redesigned as a PC: draggable desktop
 * icons, a centered floating taskbar, a Start menu with search, real
 * windows (drag / resize / minimize / maximize / close), and a native
 * Settings app. Platform apps open inside windows (same-origin routes in
 * an iframe, external sites in a new tab); Settings, Apps, Pulse and
 * Widgets are native desktop windows.
 */
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { PlatformApp } from "@/lib/orbitxPlatforms";
import { HubSpaceBackground } from "@/components/hub/HubSpaceBackground";
import { AIWidgetPanel, MobileWidgetGrid, aiWidgetCSS, type WidgetConfig } from "@/components/AIWidgetPanel";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import {
  EMPTY_OS_WINDOWS,
  osWindowsReducer,
  type OsWindowKind,
} from "./osWindows";
import { CalendarApp, MiniCal, ShortcutsBody, TasksApp, daysUntil, isoDay, quoteOfDay } from "./osWave4";
import {
  OS_ACCENTS,
  OS_WALLPAPERS,
  clearIconPositions,
  hashPin,
  loadDnd,
  loadDeskWidgets,
  loadInstalledApps,
  loadActivePackId,
  loadLockState,
  loadOsAlerts,
  loadOsNotifications,
  loadSyncMeta,
  loadThemePacks,
  loadIconPositions,
  loadOsFolders,
  loadOsSettings,
  saveDnd,
  saveDeskWidgets,
  saveInstalledApps,
  saveActivePackId,
  saveLockState,
  saveOsAlerts,
  saveOsNotifications,
  saveSyncMeta,
  saveThemePacks,
  saveIconPositions,
  saveOsFolders,
  saveOsSettings,
  loadOsNotes,
  saveOsNotes,
  loadOsFiles,
  saveOsFiles,
  loadOsBookmarks,
  saveOsBookmarks,
  loadOsHistory,
  saveOsHistory,
  loadBrowserTabs,
  saveBrowserTabs,
  loadOsDesktops,
  saveOsDesktops,
  loadOsLayouts,
  saveOsLayouts,
  loadOsTasks,
  saveOsTasks,
  loadOsCalEvents,
  saveOsCalEvents,
  loadOsClosed,
  saveOsClosed,
  type DeskWidget,
  type InstalledApp,
  type IconPos,
  type LockState,
  type OsNote,
  type OsFileItem,
  type OsTask,
  type OsCalEvent,
  type OsClosedWindow,
  type OsBookmark,
  type OsDesktop,
  type OsLayoutSnapshot,
  type OsNotification,
  type OsPriceAlert,
  type OsSettings,
  type ThemePack,
} from "./osStore";
import {
  EXTERNAL_APPS,
  fetchDevMarketListings,
  fetchOrbitxPulse,
  fetchTokenPrice,
  hostOf,
  isBlockedFrame,
  normalizeUrl,
  searchTokens,
  youtubeEmbedId,
  type DevMarketListing,
  type OrbitxPulseStats,
  type TokenSearchRow,
} from "./osApps";
import {
  deleteGalleryTheme,
  fetchGalleryThemes,
  publishGalleryTheme,
  type GalleryTheme,
} from "./osThemes";
import {
  flushOsLayoutToCloud,
  loadOsLayoutFromCloud,
  markOsLayoutSynced,
  saveOsLayoutToCloud,
  type OsCloudLayout,
} from "./osSync";
import {
  addToFolder,
  createFolder,
  folderedKeys,
  removeFromFolder,
  renameFolder,
  ungroupFolder,
  type OsFolder,
} from "./osFolders";
import { AppMark } from "./AppMark";
import "./os.css";

export interface TrendingRow {
  mint: string;
  symbol: string;
  name: string;
  image?: string;
  price: number;
  mcap: number;
  change24h: number;
}

export interface DesktopProps {
  apps: PlatformApp[];
  desktopApps: PlatformApp[];
  gates: PlatformApp[];
  userId?: string | null;
  userName: string;
  userSub: string;
  userInitial: string;
  onSignOut: () => void;
  solPrice: number | null;
  solChange: number | null;
  orbitxPrice: number | null;
  orbitxChange: number | null;
  fng: { v: number; label: string } | null;
  trending: TrendingRow[];
  pulseTab: "trending" | "runners" | "new";
  onPulseTab: (t: "trending" | "runners" | "new") => void;
  latestPosts: { id: string; username: string | null; content: string }[];
  widgets: WidgetConfig[];
  onWidgetsChange: (w: WidgetConfig[]) => void;
  onOpenTheme: () => void;
}

type Drag =
  | { type: "icon"; key: string; startX: number; startY: number; moved: boolean }
  | { type: "win"; id: string; startX: number; startY: number; origX: number; origY: number }
  | { type: "resize"; id: string; startX: number; startY: number; origW: number; origH: number }
  | { type: "widget"; id: string; startX: number; startY: number; origX: number; origY: number }
  | null;

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function fmtUsd(n: number | null, digits = 2): string {
  if (n == null) return "—";
  return `$${n < 0.01 && n > 0 ? n.toFixed(6) : n.toFixed(digits)}`;
}

/**
 * Official X timeline embed (platform.twitter.com/widgets.js).
 * Full x.com can never load in an iframe — X sends X-Frame-Options: DENY
 * and frame-ancestors 'none' — so this is the real embed path: read any
 * public profile's timeline inside the OS. Posting, DMs and login stay in
 * the full app, one tap away in a new tab.
 */
function XEmbed({ handle }: { handle: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    const w = window as unknown as { twttr?: { widgets: { load: (el?: HTMLElement) => void } } };
    if (w.twttr?.widgets) {
      w.twttr.widgets.load(ref.current ?? undefined);
    } else if (
      // Load widgets.js once; on load it scans the document and converts the
      // anchor below into a timeline. If it never loads (offline), the anchor
      // itself remains as a link that opens in a new tab.
      !document.querySelector('script[src="https://platform.twitter.com/widgets.js"]')
    ) {
      const s = document.createElement("script");
      s.src = "https://platform.twitter.com/widgets.js";
      s.async = true;
      document.head.appendChild(s);
    }
    // widgets.js gives no error callback, so detect failure plainly: if no
    // timeline iframe appears, say so instead of leaving a blank box. The
    // observer clears a false positive the moment a late iframe lands.
    const t = window.setTimeout(() => {
      if (ref.current && !ref.current.querySelector("iframe")) setFailed(true);
    }, 8000);
    const obs = new MutationObserver(() => {
      if (ref.current?.querySelector("iframe")) setFailed(false);
    });
    if (ref.current) obs.observe(ref.current, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(t);
      obs.disconnect();
    };
  }, [handle]);

  return (
    <div ref={ref} className="oxos-xembed">
      <a
        key={handle}
        className="twitter-timeline"
        data-theme="dark"
        data-chrome="noheader noborders transparent"
        data-height="600"
        href={`https://twitter.com/${handle}`}
        target="_blank"
        rel="noopener"
      >
        Tweets by @{handle}
      </a>
      {failed && (
        <p className="oxos-xembed__fail">
          Couldn't load @{handle}'s timeline — the account may not exist, be protected, or X's widget
          script was blocked (ad-blockers and Brave shields block it). Try another handle, or open the
          full app.
        </p>
      )}
    </div>
  );
}

const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";

/**
 * ORBITX Pulse — live $ORBITX stats from the DexScreener public feed
 * (same feed the DEX uses), refreshed every 30s. Shows an honest
 * "feed unreachable" state instead of stale numbers.
 */
function OrbitxPulse() {
  const [stats, setStats] = useState<OrbitxPulseStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number>(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const s = await fetchOrbitxPulse(ORBITX_MINT);
      if (!alive) return;
      if (s) {
        setStats(s);
        setFailed(false);
        setUpdatedAt(Date.now());
      } else if (!stats) {
        setFailed(true);
      }
    };
    void load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (failed) {
    return (
      <div className="oxos-feed">
        <h3>ORBITX Pulse</h3>
        <p className="oxos-hint">Live feed unreachable right now — check your connection and reopen.</p>
        <button type="button" className="oxos-btn" onClick={() => window.location.assign("/ORBITX_DEX")}>
          Open DEX
        </button>
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="oxos-feed">
        <h3>ORBITX Pulse</h3>
        <p className="oxos-hint">Loading live stats…</p>
      </div>
    );
  }
  const chg = stats.change24h;
  return (
    <div className="oxos-feed">
      <h3>ORBITX Pulse</h3>
      <div className="oxos-feed__price">{stats.priceUsd != null ? fmtUsd(stats.priceUsd, 6) : "—"}</div>
      <div className={`oxos-feed__chg${chg != null && chg < 0 ? " is-down" : ""}`}>
        {chg != null ? `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}% / 24h` : "—"}
      </div>
      <div className="oxos-feed__grid">
        <span>Volume 24h</span>
        <b>{stats.volume24h != null ? `$${stats.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}</b>
        <span>Liquidity</span>
        <b>{stats.liquidityUsd != null ? `$${stats.liquidityUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}</b>
        <span>Market cap</span>
        <b>{stats.marketCap != null ? `$${stats.marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}</b>
      </div>
      <p className="oxos-hint">
        Auto-refreshes every 30s
        {updatedAt ? ` · updated ${new Date(updatedAt).toLocaleTimeString()}` : ""}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="oxos-btn" onClick={() => window.location.assign("/ORBITX_DEX")}>
          Open DEX
        </button>
        {stats.pairUrl && (
          <button type="button" className="oxos-btn oxos-btn--ghost" onClick={() => window.open(stats.pairUrl as string, "_blank", "noopener")}>
            DexScreener ↗
          </button>
        )}
      </div>
    </div>
  );
}

/** Notes — list + editor. State lives in Desktop (persistence + sync). */
function NotesApp({ notes, onChange }: { notes: OsNote[]; onChange: (n: OsNote[]) => void }) {
  const [q, setQ] = useState("");
  const [folderFilter, setFolderFilter] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = notes.find((n) => n.id === activeId) ?? null;
  const folders = [...new Set(notes.map((n) => n.folder).filter((f): f is string => !!f))].sort();
  const filtered = notes.filter(
    (n) =>
      (!folderFilter || n.folder === folderFilter) &&
      (!q.trim() || `${n.title} ${n.body}`.toLowerCase().includes(q.trim().toLowerCase())),
  );
  const sorted = [...filtered].sort((a, b) => b.updatedAt - a.updatedAt);
  const create = () => {
    const n: OsNote = { id: `note-${Date.now().toString(36)}`, title: "", body: "", updatedAt: Date.now() };
    onChange([n, ...notes]);
    setActiveId(n.id);
  };
  return (
    <div className="oxos-notes">
      <div className="oxos-notes__list">
        <input className="oxos-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes…" />
        <div className="oxos-notes__folders">
          <button type="button" className={`oxos-notes__folder${folderFilter === "" ? " is-on" : ""}`} onClick={() => setFolderFilter("")}>
            All
          </button>
          {folders.map((f) => (
            <button key={f} type="button" className={`oxos-notes__folder${folderFilter === f ? " is-on" : ""}`} onClick={() => setFolderFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        <button type="button" className="oxos-btn" onClick={create}>
          + New note
        </button>
        {sorted.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`oxos-notes__item${n.id === activeId ? " is-on" : ""}`}
            onClick={() => setActiveId(n.id)}
          >
            <span>{n.title || "Untitled"}</span>
            <span>{n.folder ? `[${n.folder}] ` : ""}{n.body.slice(0, 60)}</span>
          </button>
        ))}
        {!sorted.length && <p className="oxos-hint">No notes yet — write the first one.</p>}
      </div>
      <div className="oxos-notes__edit">
        {active ? (
          <>
            <input
              className="oxos-input"
              value={active.title}
              onChange={(e) =>
                onChange(notes.map((n) => (n.id === active.id ? { ...n, title: e.target.value, updatedAt: Date.now() } : n)))
              }
              placeholder="Title"
            />
            <input
              className="oxos-input"
              value={active.folder ?? ""}
              onChange={(e) =>
                onChange(notes.map((n) => (n.id === active.id ? { ...n, folder: e.target.value || undefined, updatedAt: Date.now() } : n)))
              }
              placeholder="Folder (optional)"
            />
            <textarea
              className="oxos-input oxos-notes__body"
              value={active.body}
              onChange={(e) =>
                onChange(notes.map((n) => (n.id === active.id ? { ...n, body: e.target.value, updatedAt: Date.now() } : n)))
              }
              placeholder="Write…"
            />
            <button
              type="button"
              className="oxos-btn oxos-btn--ghost"
              onClick={() => {
                onChange(notes.filter((n) => n.id !== active.id));
                setActiveId(null);
              }}
            >
              Delete note
            </button>
          </>
        ) : (
          <p className="oxos-hint">Pick a note, or make a new one. Notes sync with your account.</p>
        )}
      </div>
    </div>
  );
}

/**
 * Files shelf — small text files + tiny uploads, device-local. Uploads are
 * capped (4MB total) because they live in localStorage; the cap is shown,
 * not silently enforced by dropping files.
 */
const FILES_CAP = 4 * 1024 * 1024;
function FilesApp({ files, onChange }: { files: OsFileItem[]; onChange: (f: OsFileItem[]) => void }) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const total = files.reduce((s, f) => s + f.size, 0);
  const addText = () => {
    if (!name.trim()) return;
    const content = text;
    if (total + content.length > FILES_CAP) {
      setMsg("Files shelf is full (4MB cap) — delete something first.");
      return;
    }
    onChange([
      { id: `file-${Date.now().toString(36)}`, name: name.trim(), kind: "text", content, size: content.length, at: Date.now() },
      ...files,
    ]);
    setName("");
    setText("");
    setMsg("");
  };
  const upload = (file: File) => {
    if (total + file.size > FILES_CAP) {
      setMsg("That file would exceed the 4MB shelf cap.");
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      onChange([
        { id: `file-${Date.now().toString(36)}`, name: file.name, kind: "file", content: String(r.result ?? ""), size: file.size, at: Date.now() },
        ...files,
      ]);
      setMsg("");
    };
    r.readAsDataURL(file);
  };
  const download = (f: OsFileItem) => {
    const a = document.createElement("a");
    if (f.kind === "file" && f.content.startsWith("data:")) {
      a.href = f.content;
    } else {
      a.href = URL.createObjectURL(new Blob([f.content], { type: "text/plain" }));
    }
    a.download = f.name;
    a.click();
  };
  return (
    <div className="oxos-files">
      <p className="oxos-hint">
        Device-local shelf for small files · {(total / 1024).toFixed(0)}KB / 4096KB used
      </p>
      <div className="oxos-files__form">
        <input className="oxos-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="File name (e.g. ideas.txt)" />
        <textarea className="oxos-input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Text content (optional — or upload a file below)" />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="oxos-btn" onClick={addText} disabled={!name.trim()}>
            Save text file
          </button>
          <label className="oxos-btn oxos-btn--ghost" style={{ cursor: "pointer" }}>
            Upload file
            <input
              type="file"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {msg && <p className="oxos-hint">{msg}</p>}
      </div>
      <div className="oxos-files__list">
        {files.map((f) => (
          <div key={f.id} className="oxos-row">
            <span className="oxos-row__meta">
              <span className="oxos-row__title">{f.name}</span>
              <span className="oxos-row__sub">
                {f.kind === "text" ? "text" : "upload"} · {(f.size / 1024).toFixed(1)}KB · {new Date(f.at).toLocaleDateString()}
              </span>
            </span>
            <button type="button" className="oxos-btn oxos-btn--ghost" onClick={() => download(f)}>
              Download
            </button>
            <button type="button" className="oxos-btn oxos-btn--ghost" onClick={() => onChange(files.filter((x) => x.id !== f.id))}>
              Delete
            </button>
          </div>
        ))}
        {!files.length && <p className="oxos-hint">Shelf is empty.</p>}
      </div>
    </div>
  );
}

export default function Desktop(props: DesktopProps) {
  const { apps, desktopApps, gates } = props;
  const [ws, dispatch] = useReducer(osWindowsReducer, EMPTY_OS_WINDOWS);
  const [startOpen, setStartOpen] = useState(false);
  const [startQ, setStartQ] = useState("");
  const [appsQ, setAppsQ] = useState("");
  const [settingsNav, setSettingsNav] = useState<"system" | "personalization" | "account" | "wallet" | "lock" | "about">("system");
  const [iconPos, setIconPos] = useState<Record<string, IconPos>>(loadIconPositions);
  const [folders, setFolders] = useState<OsFolder[]>(loadOsFolders);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [settings, setSettings] = useState<OsSettings>(loadOsSettings);
  const [activeWin, setActiveWin] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const iconEls = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    saveOsFolders(folders);
  }, [folders]);
  const dragRef = useRef<Drag>(null);
  const now = useClock();

  useEffect(() => {
    saveOsSettings(settings);
  }, [settings]);

  /* Wallpaper slideshow (#12): rotate hourly while enabled. */
  useEffect(() => {
    if (!settings.wallpaperShuffle) return;
    const id = setInterval(() => {
      setSettings((s) => {
        const idx = OS_WALLPAPERS.findIndex((w) => w.id === s.wallpaper);
        return { ...s, wallpaper: OS_WALLPAPERS[(idx + 1) % OS_WALLPAPERS.length].id };
      });
    }, 3600000);
    return () => clearInterval(id);
  }, [settings.wallpaperShuffle]);

  /* --- OS wave 2 state --- */
  const [installed, setInstalled] = useState<InstalledApp[]>(loadInstalledApps);
  const [deskWidgets, setDeskWidgets] = useState<DeskWidget[]>(loadDeskWidgets);
  const [packs, setPacks] = useState<ThemePack[]>(loadThemePacks);
  const [activePackId, setActivePackId] = useState<string>(loadActivePackId);
  const [dnd, setDnd] = useState<boolean>(loadDnd);
  const [lockState, setLockState] = useState<LockState>(loadLockState);
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("orbitxos:unlocked:v1") === "1";
    } catch {
      return false;
    }
  });
  const [notifications, setNotifications] = useState<OsNotification[]>(loadOsNotifications);
  const [alerts, setAlerts] = useState<OsPriceAlert[]>(loadOsAlerts);
  const [toasts, setToasts] = useState<string[]>([]);
  const [controlOpen, setControlOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQ, setCmdQ] = useState("");
  const [cmdTokens, setCmdTokens] = useState<TokenSearchRow[]>([]);
  const [snapPreview, setSnapPreview] = useState<"left" | "right" | "max" | null>(null);
  const [dim, setDim] = useState(0);
  const [browserTabs, setBrowserTabs] = useState<{ id: string; url: string; title: string; private?: boolean }[]>(() => loadBrowserTabs() ?? [
    { id: "tab-1", url: "https://dexscreener.com", title: "DexScreener" },
  ]);
  const [browserActiveId, setBrowserActiveId] = useState("tab-1");
  const [xHandle, setXHandle] = useState("orbitx_wrld");
  const [xHandleInput, setXHandleInput] = useState("orbitx_wrld");
  const [spotTokens, setSpotTokens] = useState<TokenSearchRow[]>([]);
  const [storeQ, setStoreQ] = useState("");
  const [storeListings, setStoreListings] = useState<DevMarketListing[]>([]);
  const [storeFailed, setStoreFailed] = useState(false);
  const [themeName, setThemeName] = useState("");
  const [themeWallpaper, setThemeWallpaper] = useState("space");
  const [themeAccent, setThemeAccent] = useState("#e8b84a");
  const [themeRadius, setThemeRadius] = useState(18);
  const [themeImport, setThemeImport] = useState("");
  const [alertQ, setAlertQ] = useState("");
  const [alertRows, setAlertRows] = useState<TokenSearchRow[]>([]);
  const [alertPicked, setAlertPicked] = useState<TokenSearchRow | null>(null);
  const [alertTarget, setAlertTarget] = useState("");
  const [alertDir, setAlertDir] = useState<"above" | "below">("above");
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");
  const [browserReload, setBrowserReload] = useState<Record<string, number>>({});
  const browserFrameRefs = useRef(new Map<string, HTMLIFrameElement>());
  const [syncStatus, setSyncStatus] = useState<"off" | "synced" | "saving" | "error">("off");
  const [syncHydrated, setSyncHydrated] = useState(false);

  /* --- OS wave 3 state --- */
  const [notes, setNotes] = useState<OsNote[]>(loadOsNotes);
  const [files, setFiles] = useState<OsFileItem[]>(loadOsFiles);
  const [bookmarks, setBookmarks] = useState<OsBookmark[]>(loadOsBookmarks);
  const [history, setHistory] = useState<string[]>(loadOsHistory);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [desktops, setDesktops] = useState<OsDesktop[]>(loadOsDesktops);
  const [activeDesktopId, setActiveDesktopId] = useState<string>("main");
  const [deskOpen, setDeskOpen] = useState(false);
  const [layouts, setLayouts] = useState<OsLayoutSnapshot[]>(loadOsLayouts);
  const [tasks, setTasks] = useState<OsTask[]>(loadOsTasks);
  const [calEvents, setCalEvents] = useState<OsCalEvent[]>(loadOsCalEvents);
  const [closed, setClosed] = useState<OsClosedWindow[]>(loadOsClosed);
  const [calPanelOpen, setCalPanelOpen] = useState(false);
  const [layoutName, setLayoutName] = useState("");
  const [galleryThemes, setGalleryThemes] = useState<GalleryTheme[]>([]);
  const [galleryMsg, setGalleryMsg] = useState("");
  const [discordServerId, setDiscordServerId] = useState("");
  const [discordServerInput, setDiscordServerInput] = useState("");
  const [viewportW, setViewportW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1280));
  const [phoneSwitcherOpen, setPhoneSwitcherOpen] = useState(false);
  const [phoneFolderId, setPhoneFolderId] = useState<string | null>(null);

  const locked = lockState.enabled && lockState.pinHash !== "" && !unlocked;
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => { saveInstalledApps(installed); }, [installed]);
  useEffect(() => { saveDeskWidgets(deskWidgets); }, [deskWidgets]);
  useEffect(() => { saveOsTasks(tasks); }, [tasks]);
  useEffect(() => { saveOsCalEvents(calEvents); }, [calEvents]);
  useEffect(() => { saveOsClosed(closed); }, [closed]);
  useEffect(() => { saveThemePacks(packs); }, [packs]);
  useEffect(() => { saveActivePackId(activePackId); }, [activePackId]);
  useEffect(() => { saveDnd(dnd); }, [dnd]);
  useEffect(() => { saveLockState(lockState); }, [lockState]);
  useEffect(() => { saveOsNotifications(notifications); }, [notifications]);
  useEffect(() => { saveOsAlerts(alerts); }, [alerts]);
  useEffect(() => { saveOsNotes(notes); }, [notes]);
  useEffect(() => { saveOsFiles(files); }, [files]);
  useEffect(() => { saveOsBookmarks(bookmarks); }, [bookmarks]);
  useEffect(() => { saveOsHistory(history); }, [history]);
  useEffect(() => { saveBrowserTabs(browserTabs); }, [browserTabs]);
  useEffect(() => { saveOsDesktops(desktops); }, [desktops]);
  useEffect(() => { saveOsLayouts(layouts); }, [layouts]);
  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isPhone = viewportW < 768;
  const activeDesktop = desktops.find((d) => d.id === activeDesktopId) ?? desktops[0];
  const visibleWindows = ws.windows.filter((w) => w.pinned || !w.desktopId || w.desktopId === activeDesktop?.id);

  const pushNotification = (title: string, body: string, kind: OsNotification["kind"]) => {
    const n: OsNotification = {
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      body,
      kind,
      at: Date.now(),
      read: false,
    };
    setNotifications((prev) => [n, ...prev].slice(0, 100));
    if (!dnd) {
      setToasts((prev) => [...prev, n.id]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t !== n.id)), 6000);
    }
  };

  /* Price-alert poller: checks armed alerts every 30s, notifies once on cross. */
  useEffect(() => {
    const check = async () => {
      const armed = alerts.filter((a) => !a.triggered);
      if (!armed.length) return;
      const next = [...alerts];
      let changed = false;
      for (const a of armed) {
        const price = await fetchTokenPrice(a.mint);
        if (price == null) continue;
        const crossed = a.direction === "above" ? price >= a.target : price <= a.target;
        if (crossed) {
          const idx = next.findIndex((x) => x.id === a.id);
          if (idx >= 0) next[idx] = { ...next[idx], triggered: true };
          pushNotification(
            `${a.symbol} alert hit`,
            `${a.symbol} crossed $${a.target} (now $${price < 0.01 ? price.toFixed(6) : price.toFixed(4)})`,
            "alert",
          );
          changed = true;
        }
      }
      if (changed) setAlerts(next);
    };
    void check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts]);

  /* Spotlight token search (debounced). */
  useEffect(() => {
    const q = startQ.trim();
    if (q.length < 2) {
      setSpotTokens([]);
      return;
    }
    const t = setTimeout(async () => setSpotTokens(await searchTokens(q)), 300);
    return () => clearTimeout(t);
  }, [startQ]);

  /* Command bar "token <query>" search (debounced). */
  useEffect(() => {
    const raw = cmdQ.trim();
    if (!raw.toLowerCase().startsWith("token ")) {
      setCmdTokens([]);
      return;
    }
    const q = raw.slice(6).trim();
    if (q.length < 2) {
      setCmdTokens([]);
      return;
    }
    const t = setTimeout(async () => setCmdTokens(await searchTokens(q)), 300);
    return () => clearTimeout(t);
  }, [cmdQ]);

  /* DevMarket listings for the App Store (public feed, fails soft). */
  useEffect(() => {
    let alive = true;
    (async () => {
      const items = await fetchDevMarketListings();
      if (!alive) return;
      if (!items.length) setStoreFailed(true);
      setStoreListings(items);
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* --- Account layout sync --- */
  const currentLayout = (): OsCloudLayout => ({
    icons: iconPos,
    folders,
    settings,
    installed,
    deskWidgets,
    packs,
    dnd,
    alerts,
    activePackId,
    notes,
    bookmarks,
  });

  useEffect(() => {
    if (!props.userId) {
      setSyncStatus("off");
      setSyncHydrated(true);
      return;
    }
    let alive = true;
    (async () => {
      const row = await loadOsLayoutFromCloud();
      if (!alive) return;
      if (row) {
        const meta = loadSyncMeta();
        if (row.updatedAt > meta.lastSyncAt) {
          const l = row.layout;
          if (l.icons) setIconPos(l.icons);
          if (Array.isArray(l.folders)) setFolders(l.folders);
          if (l.settings) setSettings((s) => ({ ...s, ...l.settings }));
          if (Array.isArray(l.installed)) setInstalled(l.installed);
          if (Array.isArray(l.deskWidgets)) setDeskWidgets(l.deskWidgets);
          if (Array.isArray(l.packs) && l.packs.length) setPacks(l.packs);
          if (typeof l.dnd === "boolean") setDnd(l.dnd);
          if (Array.isArray(l.alerts)) setAlerts(l.alerts);
          if (typeof l.activePackId === "string" && l.activePackId) setActivePackId(l.activePackId);
          if (Array.isArray(l.notes)) setNotes(l.notes);
          if (Array.isArray(l.bookmarks)) setBookmarks(l.bookmarks);
          markOsLayoutSynced(l);
          saveSyncMeta({ lastSyncAt: row.updatedAt });
        }
      }
      setSyncStatus("synced");
      setSyncHydrated(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!syncHydrated || !props.userId) return;
    setSyncStatus("saving");
    saveOsLayoutToCloud(currentLayout());
    const t = setTimeout(() => setSyncStatus("synced"), 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iconPos, folders, settings, installed, deskWidgets, packs, dnd, alerts, activePackId, notes, bookmarks, syncHydrated]);

  useEffect(() => {
    const onHide = () => {
      if (document.hidden) flushOsLayoutToCloud();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushOsLayoutToCloud);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushOsLayoutToCloud);
    };
  }, []);

  const installedAsApps: PlatformApp[] = useMemo(
    () =>
      installed.map((a) => ({
        key: a.key,
        name: a.name,
        caption: a.caption,
        href: a.href,
        external: true,
        tone: "#e8b84a",
        iconBg: a.iconBg,
        glyph: <span style={{ fontSize: 18 }}>{a.glyph}</span>,
      })),
    [installed],
  );

  const allApps = useMemo(() => [...apps, ...installedAsApps], [apps, installedAsApps]);

  const appByKey = useMemo(() => {
    const m = new Map<string, PlatformApp>();
    for (const a of allApps) m.set(a.key, a);
    return m;
  }, [allApps]);

  const centerRect = () => {
    const el = rootRef.current;
    const vw = el?.clientWidth ?? window.innerWidth;
    const vh = el?.clientHeight ?? window.innerHeight;
    const narrow = vw < 768;
    const w = narrow ? vw : Math.min(900, vw - 32);
    const h = narrow ? vh - 84 : Math.min(600, vh - 110);
    return { x: Math.max(0, Math.round((vw - w) / 2)), y: Math.max(8, Math.round((vh - 84 - h) / 2)), w, h, narrow };
  };

  const openBuiltin = (kind: OsWindowKind, title: string) => {
    const r = centerRect();
    dispatch({ type: "open", window: { id: kind, kind, title, x: r.x, y: r.y, w: r.w, h: r.h, desktopId: activeDesktopId } });
    if (r.narrow) dispatch({ type: "toggle-maximize", id: kind });
    setActiveWin(kind);
    setStartOpen(false);
  };

  const openBrowserTab = (url: string, title?: string) => {
    const tabTitle = title ?? hostOf(url) ?? "Browser";
    const existing = browserTabs.find((t) => t.url === url);
    if (existing) {
      setBrowserActiveId(existing.id);
    } else {
      const id = `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
      setBrowserTabs((prev) => [...prev, { id, url, title: tabTitle }]);
      setBrowserActiveId(id);
    }
    const r = centerRect();
    dispatch({ type: "open", window: { id: "browser", kind: "browser", title: "Browser", x: r.x, y: r.y, w: r.w, h: r.h, desktopId: activeDesktopId } });
    setActiveWin("browser");
    setStartOpen(false);
    setCmdOpen(false);
  };

  const openApp = (app: PlatformApp) => {
    // Installed store apps always open inside the OrbitX Browser, never a
    // bare new tab — the OS keeps you inside the OS.
    if (installed.some((i) => i.key === app.key)) {
      openBrowserTab(app.href, app.name);
      return;
    }
    if (app.external) {
      window.open(app.href, "_blank", "noopener");
      return;
    }
    const id = `app:${app.key}`;
    const r = centerRect();
    dispatch({ type: "open", window: { id, kind: "app", appKey: app.key, title: app.name, x: r.x, y: r.y, w: r.w, h: r.h, desktopId: activeDesktopId } });
    if (r.narrow) dispatch({ type: "toggle-maximize", id });
    setActiveWin(id);
    setStartOpen(false);
  };

  /** Open a native app at a specific URL (Spotlight token → DEX ?mint=…). */
  const openAppWithHref = (app: PlatformApp, href: string) => {
    const id = `app:${app.key}`;
    const r = centerRect();
    dispatch({ type: "open", window: { id, kind: "app", appKey: app.key, title: app.name, x: r.x, y: r.y, w: r.w, h: r.h, hrefOverride: href, desktopId: activeDesktopId } });
    if (r.narrow) dispatch({ type: "toggle-maximize", id });
    setActiveWin(id);
    setStartOpen(false);
    setCmdOpen(false);
  };

  /** Social in a small window pinned above everything else — the voice mini-player. */
  const openVoiceMiniPlayer = () => {
    const social = allApps.find((a) => a.key === "social" || a.name.toLowerCase().includes("social"));
    if (!social) return;
    const r = centerRect();
    const w = Math.min(400, r.w);
    const h = Math.min(560, r.h);
    dispatch({
      type: "open",
      window: {
        id: `app:${social.key}`,
        kind: "app",
        appKey: social.key,
        title: `${social.name} — Voice`,
        x: Math.max(8, r.x + r.w - w - 8),
        y: Math.max(8, r.y),
        w,
        h,
        pinned: true,
        desktopId: activeDesktopId,
      },
    });
    setActiveWin(`app:${social.key}`);
    setControlOpen(false);
  };

  const installApp = (a: InstalledApp) => {
    setInstalled((prev) => (prev.some((i) => i.key === a.key) ? prev : [...prev, a]));
    pushNotification("App installed", `${a.name} is now on your desktop.`, "system");
  };

  const uninstallApp = (key: string) => {
    setInstalled((prev) => prev.filter((i) => i.key !== key));
    setIconPos((prev) => {
      const next = { ...prev };
      delete next[key];
      saveIconPositions(next);
      return next;
    });
  };

  const prevPackIdRef = useRef<string | null>(null);
  const suppressPrevRef = useRef(false);
  const applyThemePack = (p: ThemePack) => {
    if (!suppressPrevRef.current) prevPackIdRef.current = activePackId;
    suppressPrevRef.current = false;
    setSettings((s) => ({ ...s, wallpaper: p.wallpaper, accent: p.accent, accentGrad: null }));
    setActivePackId(p.id);
    pushNotification("Theme applied", p.name, "system");
  };

  const undoTheme = () => {
    const prevId = prevPackIdRef.current;
    if (!prevId) return;
    const target = packs.find((x) => x.id === prevId) ?? galleryThemes.find((g) => g.pack.id === prevId)?.pack;
    if (!target) return;
    prevPackIdRef.current = null;
    suppressPrevRef.current = true;
    applyThemePack(target);
  };
  const surpriseTheme = () => {
    const pool = [...packs, ...galleryThemes.map((g) => g.pack)].filter((x) => x.id !== activePackId);
    if (!pool.length) return;
    applyThemePack(pool[Math.floor(Math.random() * pool.length)]);
  };
  const activePack = packs.find((p) => p.id === activePackId) ?? packs[0];

  const unlockAttempt = async () => {
    if ((await hashPin(pinInput)) === lockState.pinHash) {
      setUnlocked(true);
      try {
        sessionStorage.setItem("orbitxos:unlocked:v1", "1");
      } catch {
        /* ignore */
      }
      setPinInput("");
      setPinError("");
    } else {
      setPinError("Wrong PIN.");
    }
  };

  const closeWin = (id: string) => {
    // Recently closed (#17): remember the window for an hour so the
    // Desktops panel can reopen it. Desktop moves dispatch "close"
    // directly and skip this, so moves don't pollute the list.
    const w = ws.windows.find((x) => x.id === id);
    if (w) {
      setClosed((prev) =>
        [
          {
            id: `closed-${Date.now().toString(36)}`,
            kind: w.kind,
            appKey: w.appKey,
            title: w.title,
            hrefOverride: w.hrefOverride,
            closedAt: Date.now(),
          },
          ...prev,
        ].slice(0, 10),
      );
    }
    dispatch({ type: "close", id });
    setActiveWin((a) => (a === id ? null : a));
  };

  // Keyboard: ⌘K / Ctrl+K opens Start, Escape closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setStartOpen((v) => !v);
      } else if (e.key === "Escape") {
        setStartOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onRootMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const el = rootRef.current;
    if (!d || !el) return;
    const rect = el.getBoundingClientRect();
    if (d.type === "icon") {
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) + Math.abs(dy) > 6) {
        d.moved = true;
        const x = Math.min(92, Math.max(0, ((e.clientX - rect.left - 28) / rect.width) * 100));
        const y = Math.min(86, Math.max(0, ((e.clientY - rect.top - 28) / rect.height) * 100));
        setIconPos((prev) => ({ ...prev, [d.key]: { x, y } }));
      }
    } else if (d.type === "win") {
      dispatch({
        type: "move",
        id: d.id,
        x: Math.min(rect.width - 80, Math.max(-200, d.origX + (e.clientX - d.startX))),
        y: Math.min(rect.height - 110, Math.max(0, d.origY + (e.clientY - d.startY))),
      });
      // Snap preview: drag to a screen edge to tile, to the top to maximize.
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      if (px <= 14) setSnapPreview("left");
      else if (px >= rect.width - 14) setSnapPreview("right");
      else if (py <= 14) setSnapPreview("max");
      else setSnapPreview(null);
    } else if (d.type === "widget") {
      const x = Math.min(92, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.min(86, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
      setDeskWidgets((prev) => prev.map((w) => (w.id === d.id ? { ...w, x, y } : w)));
    } else if (d.type === "resize") {
      dispatch({
        type: "resize",
        id: d.id,
        w: d.origW + (e.clientX - d.startX),
        h: d.origH + (e.clientY - d.startY),
      });
    }
  };

  const findDropTarget = (x: number, y: number, draggedKey: string): string | null => {
    for (const [key, el] of iconEls.current) {
      if (key === draggedKey) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return key;
    }
    return null;
  };

  const onRootUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.type === "win") {
      // Drop on a snap edge tiles / maximizes the window.
      if (snapPreview) {
        const el = rootRef.current;
        const rect = el?.getBoundingClientRect();
        if (rect) {
          if (snapPreview === "max") {
            dispatch({ type: "toggle-maximize", id: d.id });
          } else {
            const half = Math.floor(rect.width / 2);
            dispatch({
              type: "snap",
              id: d.id,
              x: snapPreview === "left" ? 0 : half,
              y: 0,
              w: half,
              h: Math.floor(rect.height),
            });
          }
        }
        setSnapPreview(null);
      }
      return;
    }
    if (d.type === "widget") {
      setDeskWidgets((prev) => {
        saveDeskWidgets(prev);
        return prev;
      });
      return;
    }
    if (d.type === "resize") return;
    if (d.type !== "icon") return;
    if (!d.moved) {
      // Click: folders open their panel, apps open a window.
      if (d.key.startsWith("folder:")) {
        setOpenFolderId(d.key.slice("folder:".length));
      } else {
        const app = appByKey.get(d.key);
        if (app) openApp(app);
      }
      return;
    }
    if (d.key.startsWith("folder:")) {
      // Folder icons only move; they never merge into other folders.
      setIconPos((prev) => {
        saveIconPositions(prev);
        return prev;
      });
      return;
    }
    // iOS-style drop: app onto a folder adds it; app onto an app creates one.
    const target = findDropTarget(e.clientX, e.clientY, d.key);
    if (target) {
      if (target.startsWith("folder:")) {
        const fid = target.slice("folder:".length);
        setFolders((prev) => addToFolder(prev, fid, d.key));
        setIconPos((prev) => {
          const next = { ...prev };
          delete next[d.key];
          saveIconPositions(next);
          return next;
        });
        return;
      }
      if (appByKey.get(target)) {
        const id = `folder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        setFolders((prev) => createFolder(prev, id, target, d.key));
        setIconPos((prev) => {
          const next = { ...prev };
          delete next[d.key];
          delete next[target];
          saveIconPositions(next);
          return next;
        });
        setOpenFolderId(id);
        return;
      }
    }
    setIconPos((prev) => {
      saveIconPositions(prev);
      return prev;
    });
  };

  const startApps = useMemo(() => {
    const q = startQ.trim().toLowerCase();
    if (!q) return allApps;
    return allApps.filter((a) => `${a.name} ${a.caption}`.toLowerCase().includes(q));
  }, [allApps, startQ]);

  const appsWinList = useMemo(() => {
    const q = appsQ.trim().toLowerCase();
    if (!q) return allApps;
    return allApps.filter((a) => `${a.name} ${a.caption}`.toLowerCase().includes(q));
  }, [allApps, appsQ]);

  /* Command bar: typed actions + apps + "token <query>". */
  const cmdTokenMode = cmdQ.trim().toLowerCase().startsWith("token ");
  const cmdQTrim = cmdQ.trim();
  const cmdActions = [
    {
      id: "lock",
      label: "Lock screen",
      hint: "Lock this device",
      run: () => {
        if (!lockState.pinHash) {
          pushNotification("No PIN set", "Set a PIN in Settings → Lock first.", "system");
        } else {
          setUnlocked(false);
          try {
            sessionStorage.removeItem("orbitxos:unlocked:v1");
          } catch {
            /* ignore */
          }
        }
        setCmdOpen(false);
      },
    },
    { id: "control", label: "Open Control Center", hint: "Panel", run: () => { setCmdOpen(false); setControlOpen(true);  } },
    { id: "focus", label: "Toggle focus mode", hint: "Dim inactive windows", run: () => { setSettings((s) => ({ ...s, focusMode: !s.focusMode })); setCmdOpen(false); } },
    { id: "notif", label: "Open Notifications", hint: "Panel", run: () => { setCmdOpen(false); setNotifOpen(true); } },
    { id: "store", label: "Open App Store", hint: "Window", run: () => { setCmdOpen(false); openBuiltin("store", "App Store"); } },
    { id: "browser", label: "Open Browser", hint: "Window", run: () => { setCmdOpen(false); openBuiltin("browser", "Browser"); } },
    { id: "themes", label: "Open Theme Store", hint: "Window", run: () => { setCmdOpen(false); openBuiltin("themes", "Theme Store"); } },
    { id: "feed", label: "Open ORBITX Pulse", hint: "Window", run: () => { setCmdOpen(false); openBuiltin("feed", "ORBITX Pulse"); } },
    { id: "notes", label: "Open Notes", hint: "Window", run: () => { setCmdOpen(false); openBuiltin("notes", "Notes"); } },
    { id: "files", label: "Open Files", hint: "Window", run: () => { setCmdOpen(false); openBuiltin("files", "Files"); } },
    { id: "tasks", label: "Open Tasks", hint: "Window", run: () => { setCmdOpen(false); openBuiltin("tasks", "Tasks"); } },
    { id: "calendar", label: "Open Calendar", hint: "Window", run: () => { setCmdOpen(false); openBuiltin("calendar", "Calendar"); } },
    { id: "shortcuts", label: "Open Shortcuts", hint: "Window", run: () => { setCmdOpen(false); openBuiltin("shortcuts", "Shortcuts"); } },
    { id: "desktops", label: "Open Desktops", hint: "Panel", run: () => { setCmdOpen(false); setDeskOpen(true); } },
    { id: "voice", label: "Voice mini-player", hint: "Pinned Social window", run: () => { setCmdOpen(false); openVoiceMiniPlayer(); } },
    { id: "sync", label: "Sync layout now", hint: "Account", run: () => { saveOsLayoutToCloud(currentLayout()); flushOsLayoutToCloud(); setSyncStatus("synced"); setCmdOpen(false); } },
    { id: "reset", label: "Reset icon layout", hint: "Desktop", run: () => { clearIconPositions(); setIconPos({}); setCmdOpen(false); } },
    { id: "clear-notif", label: "Clear notifications", hint: "Notifications", run: () => { setNotifications([]); setCmdOpen(false); } },
  ];
  // Calculator (#73): a bare arithmetic query shows its result as the
  // first row; tapping it copies the answer. Input is regex-gated to
  // digits, operators, parens, and spaces only.
  const calcMatch = cmdQTrim.match(/^(?:calc\s+)?([0-9+\-*/().\s]+)$/);
  const calcResult = ((): number | null => {
    if (cmdTokenMode || !calcMatch) return null;
    const expr = calcMatch[1].trim();
    if (!/[0-9]/.test(expr)) return null;
    try {
      const v = Function(`"use strict"; return (${expr})`)();
      return typeof v === "number" && Number.isFinite(v) ? Math.round(v * 1e10) / 1e10 : null;
    } catch {
      return null;
    }
  })();
  const cmdFiltered = cmdTokenMode
    ? []
    : cmdQTrim
      ? cmdActions.filter((c) => c.label.toLowerCase().includes(cmdQTrim.toLowerCase()))
      : cmdActions;
  const cmdAppHits =
    cmdQTrim && !cmdTokenMode
      ? allApps.filter((a) => `${a.name} ${a.caption}`.toLowerCase().includes(cmdQTrim.toLowerCase())).slice(0, 5)
      : [];

  const clock = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString([], { month: "short", day: "numeric" });
  const greet = (() => {
    const h = now.getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  })();

  const iconButton = (app: PlatformApp, placed: boolean) => {
    const pos = iconPos[app.key];
    return (
      <button
        key={app.key}
        type="button"
        className="oxos-icon"
        ref={(el) => {
          if (el) iconEls.current.set(app.key, el);
          else iconEls.current.delete(app.key);
        }}
        style={placed && pos ? { left: `${pos.x}%`, top: `${pos.y}%` } : undefined}
        onPointerDown={(e) => {
          dragRef.current = { type: "icon", key: app.key, startX: e.clientX, startY: e.clientY, moved: false };
        }}
        onContextMenu={(e) => e.preventDefault()}
        title={`${app.name} — drag to move, click to open, drop onto another app to folder them`}
      >
        {<AppMark app={app} className="oxos-icon__mark" />}
        <span className="oxos-icon__label">{app.name}</span>
      </button>
    );
  };

  const folderButton = (f: OsFolder, placed: boolean) => {
    const pos = iconPos[`folder:${f.id}`];
    const members = f.appKeys.map((k) => appByKey.get(k)).filter(Boolean) as PlatformApp[];
    return (
      <button
        key={f.id}
        type="button"
        className="oxos-icon oxos-folder"
        ref={(el) => {
          if (el) iconEls.current.set(`folder:${f.id}`, el);
          else iconEls.current.delete(`folder:${f.id}`);
        }}
        style={placed && pos ? { left: `${pos.x}%`, top: `${pos.y}%` } : undefined}
        onPointerDown={(e) => {
          dragRef.current = { type: "icon", key: `folder:${f.id}`, startX: e.clientX, startY: e.clientY, moved: false };
        }}
        onContextMenu={(e) => e.preventDefault()}
        title={`${f.name} — drag to move, click to open, drop apps onto it to add them`}
      >
        <span className="oxos-folder__grid">
          {members.slice(0, 4).map((m) => (
            <span key={m.key} className="oxos-folder__mini" style={{ background: m.iconBg }}>
              {m.glyph}
            </span>
          ))}
        </span>
        <span className="oxos-icon__label">{f.name}</span>
      </button>
    );
  };

  const windowBody = (w: (typeof ws.windows)[number]) => {
    if (w.kind === "settings") return settingsBody();
    if (w.kind === "apps") {
      return (
        <div className="oxos-appswin">
          <input
            className="oxos-input"
            value={appsQ}
            onChange={(e) => setAppsQ(e.target.value)}
            placeholder="Search apps…"
          />
          <div className="oxos-appgrid">
            {appsWinList.map((a) => (
              <button key={a.key} type="button" className="oxos-appcell" onClick={() => openApp(a)}>
                {<AppMark app={a} className="oxos-appcell__mark" />}
                <span className="oxos-appcell__name">{a.name}</span>
                <span className="oxos-appcell__cap">{a.caption}</span>
              </button>
            ))}
            {!appsWinList.length && <p className="oxos-hint">No apps match that search.</p>}
          </div>
        </div>
      );
    }
    if (w.kind === "pulse") {
      return (
        <div className="oxos-pulse">
          <div className="oxos-seg" role="tablist" aria-label="Feed">
            {([["trending", "Trending"], ["runners", "Runners"], ["new", "New"]] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={props.pulseTab === id}
                className={`oxos-seg__btn${props.pulseTab === id ? " is-on" : ""}`}
                onClick={() => props.onPulseTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="oxos-pulse__list">
            {props.trending.map((t) => (
              <button
                key={t.mint}
                type="button"
                className="oxos-row"
                onClick={() => window.location.assign(`/ORBITX_DEX?mint=${encodeURIComponent(t.mint)}`)}
              >
                {t.image ? (
                  <img src={t.image} alt={t.symbol} className="oxos-coin" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <span className="oxos-coin oxos-coin--fallback">{t.symbol.slice(0, 1)}</span>
                )}
                <span className="oxos-row__meta">
                  <span className="oxos-row__title">{t.name || t.symbol}</span>
                  <span className="oxos-row__sub">
                    ${t.symbol}
                    {t.price > 0 ? ` · ${fmtUsd(t.price, 4)}` : ""}
                    {t.mcap > 0 ? ` · ${(t.mcap / 1e6).toFixed(1)}M` : ""}
                  </span>
                </span>
                <span className={`oxos-row__val${t.change24h >= 0 ? " is-up" : " is-down"}`}>
                  {t.change24h >= 0 ? "+" : ""}
                  {t.change24h.toFixed(1)}%
                </span>
              </button>
            ))}
            {!props.trending.length && <p className="oxos-hint">Listening for pulse…</p>}
          </div>
          {!!props.latestPosts.length && (
            <>
              <h3 className="oxos-h3">Social</h3>
              <div className="oxos-pulse__list">
                {props.latestPosts.map((p) => (
                  <div key={p.id} className="oxos-row oxos-row--static">
                    <span className="oxos-row__meta">
                      <span className="oxos-row__title">@{p.username || "orbit"}</span>
                      <span className="oxos-row__sub">{p.content.slice(0, 140)}{p.content.length > 140 ? "…" : ""}</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          <button type="button" className="oxos-btn oxos-btn--ghost" onClick={() => window.location.assign("/orbitx-social")}>
            Open Social
          </button>
        </div>
      );
    }
    if (w.kind === "widgets") {
      return (
        <div className="oxos-widgets">
          <MobileWidgetGrid
            solPrice={props.solPrice}
            solChange={props.solChange}
            trending={props.trending}
            widgets={props.widgets}
            setWidgets={props.onWidgetsChange}
            onOpenPanel={() => openBuiltin("widget-library", "Widget Library")}
          />
          <button type="button" className="oxos-btn oxos-btn--ghost" onClick={() => openBuiltin("widget-library", "Widget Library")}>
            Widget Library
          </button>
        </div>
      );
    }
    if (w.kind === "widget-library") {
      return (
        <AIWidgetPanel
          initialTab="lib"
          widgets={props.widgets}
          setWidgets={props.onWidgetsChange}
          onClose={() => closeWin(w.id)}
        />
      );
    }
    if (w.kind === "feed") {
      return <OrbitxPulse />;
    }
    if (w.kind === "notes") {
      return <NotesApp notes={notes} onChange={setNotes} />;
    }
    if (w.kind === "files") {
      return <FilesApp files={files} onChange={setFiles} />;
    }
    if (w.kind === "tasks") {
      return <TasksApp tasks={tasks} onChange={setTasks} />;
    }
    if (w.kind === "calendar") {
      return <CalendarApp events={calEvents} onChange={setCalEvents} />;
    }
    if (w.kind === "shortcuts") {
      return <ShortcutsBody />;
    }
    if (w.kind === "browser") {
      const activeTab = browserTabs.find((t) => t.id === browserActiveId) ?? browserTabs[0];
      const blocked = activeTab ? isBlockedFrame(activeTab.url) : false;
      const navigateActive = (raw: string) => {
        const clean = normalizeUrl(raw);
        if (!clean || !activeTab) return;
        setBrowserTabs((prev) =>
          prev.map((t) => (t.id === activeTab.id ? { ...t, url: clean, title: hostOf(clean) || "Browser" } : t)),
        );
        if (!activeTab.private) setHistory((prev) => [clean, ...prev.filter((u) => u !== clean)].slice(0, 100));
        // X profile URLs (x.com/<handle>) retarget the embedded timeline.
        const host = hostOf(clean);
        if (host === "x.com" || host === "twitter.com") {
          const seg = clean.split("?")[0].replace(/^https?:\/\/[^/]+\//, "").split("/")[0] ?? "";
          const reserved = new Set(["home", "explore", "notifications", "messages", "search", "settings", "i", "intent"]);
          if (/^[A-Za-z0-9_]{1,15}$/.test(seg) && !reserved.has(seg.toLowerCase())) {
            setXHandle(seg);
            setXHandleInput(seg);
          }
        }
      };
      const newTab = (url: string, title: string) => {
        const id = `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
        setBrowserTabs((prev) => [...prev, { id, url, title }]);
        setBrowserActiveId(id);
      };
      return (
        <div className="oxos-browser">
          <div className="oxos-browser__tabs">
            {browserTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`oxos-browser__tab${t.id === activeTab?.id ? " is-on" : ""}`}
                onClick={() => setBrowserActiveId(t.id)}
              >
                <span>{t.title}</span>
                {browserTabs.length > 1 && (
                  <span
                    className="oxos-browser__tabx"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBrowserTabs((prev) => {
                        const next = prev.filter((x) => x.id !== t.id);
                        if (t.id === browserActiveId && next.length) setBrowserActiveId(next[next.length - 1].id);
                        return next;
                      });
                    }}
                  >
                    ✕
                  </span>
                )}
              </button>
            ))}
            <button type="button" className="oxos-browser__tabadd" title="New tab" onClick={() => newTab("https://dexscreener.com", "DexScreener")}>
              +
            </button>
          </div>
          {activeTab && (
            <>
              <div className="oxos-browser__bar">
                <button
                  type="button"
                  className="oxos-browser__nav"
                  title="Back"
                  onClick={() => {
                    try {
                      browserFrameRefs.current.get(activeTab.id)?.contentWindow?.history.back();
                    } catch {
                      /* cross-origin: no-op */
                    }
                  }}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="oxos-browser__nav"
                  title="Forward"
                  onClick={() => {
                    try {
                      browserFrameRefs.current.get(activeTab.id)?.contentWindow?.history.forward();
                    } catch {
                      /* cross-origin: no-op */
                    }
                  }}
                >
                  →
                </button>
                <button
                  type="button"
                  className="oxos-browser__nav"
                  title="Reload"
                  onClick={() => setBrowserReload((prev) => ({ ...prev, [activeTab.id]: (prev[activeTab.id] ?? 0) + 1 }))}
                >
                  ↻
                </button>
                <input
                  key={activeTab.id}
                  className="oxos-input oxos-browser__addr"
                  defaultValue={activeTab.url}
                  aria-label="Address"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") navigateActive((e.target as HTMLInputElement).value);
                  }}
                />
                <button
                  type="button"
                  className="oxos-browser__nav"
                  title={bookmarks.some((b) => b.url === activeTab.url) ? "Remove bookmark" : "Bookmark this page"}
                  onClick={() => {
                    if (bookmarks.some((b) => b.url === activeTab.url)) {
                      setBookmarks((prev) => prev.filter((b) => b.url !== activeTab.url));
                    } else {
                      setBookmarks((prev) => [
                        { id: `bm-${Date.now().toString(36)}`, title: activeTab.title, url: activeTab.url },
                        ...prev,
                      ]);
                    }
                  }}
                >
                  {bookmarks.some((b) => b.url === activeTab.url) ? "★" : "☆"}
                </button>
                <button
                  type="button"
                  className={`oxos-btn oxos-btn--ghost${historyOpen ? " is-on" : ""}`}
                  onClick={() => setHistoryOpen((v) => !v)}
                >
                  History
                </button>
                <button
                  type="button"
                  className={`oxos-btn oxos-btn--ghost${activeTab.private ? " is-on" : ""}`}
                  title="Private tab: visits are not saved to history"
                  onClick={() =>
                    setBrowserTabs((prev) => prev.map((t) => (t.id === activeTab.id ? { ...t, private: !t.private } : t)))
                  }
                >
                  {activeTab.private ? "Private ●" : "Private ○"}
                </button>
                <button type="button" className="oxos-btn oxos-btn--ghost" onClick={() => window.open(activeTab.url, "_blank", "noopener")}>
                  ↗ Tab
                </button>
              </div>
              <div className="oxos-browser__quick">
                {EXTERNAL_APPS.slice(0, 8).map((a) => (
                  <button key={a.key} type="button" onClick={() => navigateActive(a.href)}>
                    {a.name}
                  </button>
                ))}
              </div>
              {bookmarks.length > 0 && (
                <div className="oxos-browser__quick oxos-browser__bookmarks">
                  <span>★</span>
                  {bookmarks.map((b) => (
                    <span key={b.id} className="oxos-browser__bm">
                      <button type="button" onClick={() => navigateActive(b.url)}>
                        {b.title}
                      </button>
                      <button type="button" title="Remove bookmark" onClick={() => setBookmarks((prev) => prev.filter((x) => x.id !== b.id))}>
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="oxos-browser__view">
                {historyOpen ? (
                  <div className="oxos-history">
                    <div className="oxos-history__head">
                      <h3>History</h3>
                      <button type="button" className="oxos-btn oxos-btn--ghost" onClick={() => setHistory([])}>
                        Clear
                      </button>
                    </div>
                    {history.map((u) => (
                      <button
                        key={u}
                        type="button"
                        className="oxos-row"
                        onClick={() => {
                          navigateActive(u);
                          setHistoryOpen(false);
                        }}
                      >
                        <span className="oxos-row__meta">
                          <span className="oxos-row__title">{hostOf(u) || u}</span>
                          <span className="oxos-row__sub">{u}</span>
                        </span>
                      </button>
                    ))}
                    {!history.length && <p className="oxos-hint">No history yet.</p>}
                  </div>
                ) : blocked ? (
                  (() => {
                    const h = hostOf(activeTab.url);
                    // YouTube videos have an official embed player — play them
                    // in the OS instead of the blocked card.
                    const yt = youtubeEmbedId(activeTab.url);
                    if (yt) {
                      return (
                        <div className="oxos-ytview">
                          <iframe
                            className="oxos-ytview__frame"
                            title="YouTube player"
                            src={`https://www.youtube.com/embed/${yt}`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                          <button type="button" className="oxos-btn oxos-btn--ghost" onClick={() => window.open(activeTab.url, "_blank", "noopener")}>
                            Open on YouTube ↗
                          </button>
                        </div>
                      );
                    }
                    // Discord's official server widget embeds; it needs the
                    // server's widget enabled and its server ID.
                    if (h === "discord.com") {
                      return (
                        <div className="oxos-xview">
                          <h3>Discord, embedded in OrbitX</h3>
                          <p>
                            Discord's full app can't load inside any app, but a server's official widget
                            can — paste the server ID (enable the widget in that server's settings first).
                          </p>
                          <div className="oxos-xview__row">
                            <input
                              className="oxos-input"
                              value={discordServerInput}
                              onChange={(e) => setDiscordServerInput(e.target.value)}
                              placeholder="Discord server ID"
                              aria-label="Discord server ID"
                            />
                            <button
                              type="button"
                              className="oxos-btn"
                              onClick={() => {
                                if (/^\d{10,}$/.test(discordServerInput.trim())) setDiscordServerId(discordServerInput.trim());
                              }}
                            >
                              Show widget
                            </button>
                            <button type="button" className="oxos-btn oxos-btn--ghost" onClick={() => window.open("https://discord.com", "_blank", "noopener")}>
                              Open Discord ↗
                            </button>
                          </div>
                          {discordServerId && (
                            <iframe
                              className="oxos-discordview__frame"
                              title="Discord server widget"
                              src={`https://discord.com/widget?id=${discordServerId}&theme=dark`}
                              allowTransparency
                              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                            />
                          )}
                        </div>
                      );
                    }
                    if (h !== "x.com" && h !== "twitter.com") {
                      return (
                        <div className="oxos-browser__blocked">
                          <h3>{hostOf(activeTab.url)} doesn't allow embedding</h3>
                          <p>
                            Some sites refuse to load inside any app. Open it in a full
                            browser tab instead — your OrbitX desktop stays open underneath.
                          </p>
                          <button type="button" className="oxos-btn" onClick={() => window.open(activeTab.url, "_blank", "noopener")}>
                            Open {hostOf(activeTab.url)} in a new tab
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div className="oxos-xview">
                        <h3>X, embedded in OrbitX</h3>
                        <p>
                          X blocks its full app from loading inside any app, so this is the official X
                          timeline embed — read any public profile right here. For posting, DMs and
                          your own feed, open the full app in a new tab.
                        </p>
                        <div className="oxos-xview__row">
                          <input
                            className="oxos-input"
                            value={xHandleInput}
                            onChange={(e) => setXHandleInput(e.target.value)}
                            placeholder="@handle"
                            aria-label="X handle"
                          />
                          <button
                            type="button"
                            className="oxos-btn"
                            onClick={() => {
                              const clean = xHandleInput.trim().replace(/^@/, "");
                              if (/^[A-Za-z0-9_]{1,15}$/.test(clean)) setXHandle(clean);
                            }}
                          >
                            Show
                          </button>
                          <button
                            type="button"
                            className="oxos-btn oxos-btn--ghost"
                            onClick={() => window.open(activeTab.url, "_blank", "noopener")}
                          >
                            Open full X ↗
                          </button>
                        </div>
                        <XEmbed handle={xHandle} />
                      </div>
                    );
                  })()
                ) : (
                  browserTabs.map((t) => (
                    <iframe
                      key={`${t.id}-${browserReload[t.id] ?? 0}`}
                      ref={(el) => {
                        if (el) browserFrameRefs.current.set(t.id, el);
                        else browserFrameRefs.current.delete(t.id);
                      }}
                      className="oxos-frame"
                      title={t.title}
                      src={t.url}
                      hidden={t.id !== activeTab.id}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      );
    }
    if (w.kind === "store") {
      const q = storeQ.trim().toLowerCase();
      const extFiltered = EXTERNAL_APPS.filter(
        (a) => !q || `${a.name} ${a.caption}`.toLowerCase().includes(q),
      );
      const dmFiltered = storeListings.filter(
        (l) => !q || `${l.name} ${l.tagline} ${l.tags.join(" ")}`.toLowerCase().includes(q),
      );
      const installedKeys = new Set(installed.map((i) => i.key));
      return (
        <div className="oxos-store">
          <p className="oxos-hint">
            Install apps onto your desktop. OrbitX apps open inside the OS; web apps open in the OrbitX Browser.
          </p>
          <input
            className="oxos-input"
            value={storeQ}
            onChange={(e) => setStoreQ(e.target.value)}
            placeholder="Search the store…"
          />
          <h3 className="oxos-h3">Web apps</h3>
          <div className="oxos-store__grid">
            {extFiltered.map((a) => {
              const isIn = installedKeys.has(a.key);
              return (
                <div key={a.key} className="oxos-store__card">
                  <span className="oxos-store__mark" style={{ background: a.iconBg }}>
                    {a.glyph}
                  </span>
                  <span className="oxos-store__meta">
                    <span>{a.name}</span>
                    <span>{a.caption}</span>
                  </span>
                  {isIn ? (
                    <button type="button" className="oxos-btn oxos-btn--ghost" onClick={() => uninstallApp(a.key)}>
                      Installed ✓ — Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="oxos-btn"
                      onClick={() =>
                        installApp({ key: a.key, name: a.name, caption: a.caption, href: a.href, iconBg: a.iconBg, glyph: a.glyph, source: "external" })
                      }
                    >
                      Install
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <h3 className="oxos-h3">From DevMarket — community apps &amp; sites</h3>
          {storeFailed && (
            <p className="oxos-hint">DevMarket feed is unreachable right now — the web apps above still work.</p>
          )}
          <div className="oxos-store__grid">
            {dmFiltered.map((l) => {
              const key = `dm-${l.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
              const isIn = installedKeys.has(key);
              return (
                <div key={key} className="oxos-store__card">
                  {l.icon ? (
                    <img className="oxos-store__mark" src={l.icon} alt="" />
                  ) : (
                    <span className="oxos-store__mark" style={{ background: "linear-gradient(145deg,#e8b84a,#8a5a00)" }}>
                      {l.name[0]}
                    </span>
                  )}
                  <span className="oxos-store__meta">
                    <span>{l.name}</span>
                    <span>{l.tagline || l.type}</span>
                  </span>
                  {isIn ? (
                    <button type="button" className="oxos-btn oxos-btn--ghost" onClick={() => uninstallApp(key)}>
                      Installed ✓ — Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="oxos-btn"
                      onClick={() =>
                        installApp({ key, name: l.name, caption: l.tagline || l.type, href: l.url, iconBg: "linear-gradient(145deg,#e8b84a,#8a5a00)", glyph: l.name[0], source: "devmarket" })
                      }
                    >
                      Install
                    </button>
                  )}
                </div>
              );
            })}
            {!dmFiltered.length && !storeFailed && <p className="oxos-hint">Loading community listings…</p>}
          </div>
          <h3 className="oxos-h3">OrbitX apps</h3>
          <div className="oxos-store__grid">
            {allApps
              .filter((a) => !installedKeys.has(a.key))
              .map((a) => (
                <div key={a.key} className="oxos-store__card">
                  {<AppMark app={a} className="oxos-store__mark" />}
                  <span className="oxos-store__meta">
                    <span>{a.name}</span>
                    <span>{a.caption}</span>
                  </span>
                  <button type="button" className="oxos-btn oxos-btn--ghost" onClick={() => openApp(a)}>
                    Open
                  </button>
                </div>
              ))}
          </div>
        </div>
      );
    }
    if (w.kind === "themes") {
      return (
        <div className="oxos-themes">
          <p className="oxos-hint">
            Themes change your wallpaper, accent, and icon shape. Make one, share it as JSON, or import a
            friend's.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="oxos-btn oxos-btn--ghost" disabled={!prevPackIdRef.current} onClick={undoTheme}>
              Undo last theme
            </button>
            <button type="button" className="oxos-btn oxos-btn--ghost" onClick={surpriseTheme}>
              Surprise me
            </button>
          </div>
          <h3 className="oxos-h3">Theme store</h3>
          <div className="oxos-store__grid">
            {packs.map((p) => (
              <div key={p.id} className={`oxos-store__card${p.id === activePackId ? " is-on" : ""}`}>
                <span
                  className="oxos-store__mark"
                  style={{ background: p.accent, borderRadius: p.radius, boxShadow: p.ring || undefined }}
                >
                  {p.name[0]}
                </span>
                <span className="oxos-store__meta">
                  <span>{p.name}</span>
                  <span>
                    by {p.author} · {p.wallpaper} · {p.accent}
                  </span>
                </span>
                <button type="button" className="oxos-btn" onClick={() => applyThemePack(p)}>
                  {p.id === activePackId ? "Active ✓" : "Apply"}
                </button>
              </div>
            ))}
          </div>
          <h3 className="oxos-h3">Create a theme</h3>
          <div className="oxos-themes__form">
            <input
              className="oxos-input"
              value={themeName}
              onChange={(e) => setThemeName(e.target.value)}
              placeholder="Theme name"
            />
            <div className="oxos-wallgrid">
              {OS_WALLPAPERS.map((wp) => (
                <button
                  key={wp.id}
                  type="button"
                  className={`oxos-wall oxos-wall--${wp.id}${themeWallpaper === wp.id ? " is-on" : ""}`}
                  onClick={() => setThemeWallpaper(wp.id)}
                >
                  {wp.label}
                </button>
              ))}
            </div>
            <div className="oxos-accentrow">
              {OS_ACCENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`oxos-accent${themeAccent === a.hex ? " is-on" : ""}`}
                  style={{ background: a.hex }}
                  title={a.label}
                  aria-label={a.label}
                  onClick={() => setThemeAccent(a.hex)}
                />
              ))}
            </div>
            <label className="oxos-field">
              Icon corner radius: {themeRadius}px
              <input
                type="range"
                min={6}
                max={120}
                value={themeRadius}
                onChange={(e) => setThemeRadius(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="oxos-btn"
              disabled={!themeName.trim()}
              onClick={() => {
                const p: ThemePack = {
                  id: `pack-${Date.now().toString(36)}`,
                  name: themeName.trim(),
                  wallpaper: themeWallpaper as ThemePack["wallpaper"],
                  accent: themeAccent,
                  radius: themeRadius,
                  ring: "",
                  author: "You",
                };
                setPacks((prev) => [...prev, p]);
                applyThemePack(p);
                setThemeName("");
              }}
            >
              Save &amp; apply
            </button>
          </div>
          <h3 className="oxos-h3">Share / import</h3>
          <div className="oxos-themes__form">
            <textarea
              className="oxos-input"
              rows={3}
              value={themeImport}
              onChange={(e) => setThemeImport(e.target.value)}
              placeholder="Paste a theme JSON here to import it"
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="oxos-btn oxos-btn--ghost"
                onClick={() => {
                  const p = packs.find((x) => x.id === activePackId);
                  if (p) setThemeImport(JSON.stringify(p, null, 2));
                }}
              >
                Copy active theme JSON
              </button>
              <button
                type="button"
                className="oxos-btn"
                onClick={() => {
                  try {
                    const raw = JSON.parse(themeImport);
                    if (raw && typeof raw.name === "string" && typeof raw.accent === "string") {
                      const p: ThemePack = {
                        id: `pack-${Date.now().toString(36)}`,
                        name: raw.name,
                        wallpaper: (["space", "midnight", "gold", "ocean"].includes(raw.wallpaper)
                          ? raw.wallpaper
                          : "space") as ThemePack["wallpaper"],
                        accent: raw.accent,
                        radius: typeof raw.radius === "number" ? raw.radius : 18,
                        ring: typeof raw.ring === "string" ? raw.ring : "",
                        author: "Imported",
                      };
                      setPacks((prev) => [...prev, p]);
                      applyThemePack(p);
                      setThemeImport("");
                    }
                  } catch {
                    /* invalid JSON — leave the text for editing */
                  }
                }}
              >
                Import
              </button>
            </div>
          </div>
          <h3 className="oxos-h3">Community gallery</h3>
          <p className="oxos-hint">
            Publish your own packs for anyone to install, or install someone else's. Publishing needs a
            signed-in account.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="oxos-btn oxos-btn--ghost"
              onClick={async () => {
                const list = await fetchGalleryThemes();
                setGalleryThemes(list);
                setGalleryMsg(list.length ? "" : "Gallery is empty or unreachable right now.");
              }}
            >
              Refresh gallery
            </button>
          </div>
          {galleryMsg && <p className="oxos-hint">{galleryMsg}</p>}
          <div className="oxos-store__grid">
            {galleryThemes.map((g) => {
              const mine = props.userId != null && g.owner === props.userId;
              const installedHere = packs.some((p) => p.name === g.pack.name && p.accent === g.pack.accent);
              return (
                <div key={g.id} className="oxos-store__card">
                  <span
                    className="oxos-store__mark"
                    style={{ background: g.pack.accent, borderRadius: g.pack.radius, boxShadow: g.pack.ring || undefined }}
                  >
                    {g.pack.name[0]}
                  </span>
                  <span className="oxos-store__meta">
                    <span>{g.pack.name}</span>
                    <span>
                      by {mine ? "you" : g.owner.slice(0, 8)} · {g.pack.wallpaper} · {g.pack.accent}
                    </span>
                  </span>
                  {installedHere ? (
                    <button type="button" className="oxos-btn oxos-btn--ghost" onClick={() => applyThemePack(g.pack)}>
                      Apply
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="oxos-btn"
                      onClick={() => {
                        const p: ThemePack = { ...g.pack, id: `pack-${Date.now().toString(36)}` };
                        setPacks((prev) => [...prev, p]);
                        applyThemePack(p);
                      }}
                    >
                      Install
                    </button>
                  )}
                  {mine && (
                    <button
                      type="button"
                      className="oxos-btn oxos-btn--ghost"
                      onClick={async () => {
                        if (await deleteGalleryTheme(g.id)) setGalleryThemes((prev) => prev.filter((x) => x.id !== g.id));
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <h3 className="oxos-h3">Publish a pack</h3>
          <div className="oxos-store__grid">
            {packs
              .filter((p) => p.author === "You")
              .map((p) => (
                <div key={p.id} className="oxos-store__card">
                  <span
                    className="oxos-store__mark"
                    style={{ background: p.accent, borderRadius: p.radius, boxShadow: p.ring || undefined }}
                  >
                    {p.name[0]}
                  </span>
                  <span className="oxos-store__meta">
                    <span>{p.name}</span>
                    <span>
                      {p.wallpaper} · {p.accent}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="oxos-btn"
                    disabled={!props.userId}
                    onClick={async () => {
                      if (!props.userId) return;
                      const r = await publishGalleryTheme(props.userId, p);
                      setGalleryMsg(r.ok ? `"${p.name}" is live in the gallery.` : `Publish failed: ${r.reason ?? "unknown"}`);
                      if (r.ok) setGalleryThemes(await fetchGalleryThemes());
                    }}
                  >
                    {props.userId ? "Publish" : "Sign in to publish"}
                  </button>
                </div>
              ))}
            {!packs.some((p) => p.author === "You") && (
              <p className="oxos-hint">Create a theme above first — your packs show up here for publishing.</p>
            )}
          </div>
        </div>
      );
    }
    // App window: same-origin route inside a frame.
    const app = w.appKey ? appByKey.get(w.appKey) : undefined;
    if (!app) return <p className="oxos-hint">App not found.</p>;
    return <iframe className="oxos-frame" title={app.name} src={w.hrefOverride ?? app.href} />;
  };

  const settingsBody = () => {
    const set = (patch: Partial<OsSettings>) => setSettings((s) => ({ ...s, ...patch }));
    return (
      <div className="oxos-settings">
        <nav className="oxos-settings__nav">
          {([
            ["system", "System"],
            ["personalization", "Personalization"],
            ["account", "Account"],
            ["wallet", "Wallet"],
            ["lock", "Lock"],
            ["about", "About"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`oxos-settings__navbtn${settingsNav === id ? " is-on" : ""}`}
              onClick={() => setSettingsNav(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="oxos-settings__pane">
          {settingsNav === "system" && (
            <>
              <h3 className="oxos-h3">System</h3>
              <label className="oxos-toggle">
                <span>Reduce motion</span>
                <input type="checkbox" checked={settings.reduceMotion} onChange={(e) => set({ reduceMotion: e.target.checked })} />
              </label>
              <label className="oxos-toggle">
                <span>Show market prices in taskbar</span>
                <input type="checkbox" checked={settings.showTrayPrices} onChange={(e) => set({ showTrayPrices: e.target.checked })} />
              </label>
              <button
                type="button"
                className="oxos-btn oxos-btn--ghost"
                onClick={() => {
                  clearIconPositions();
                  setIconPos({});
                }}
              >
                Reset desktop icon layout
              </button>
              <h3 className="oxos-h3">Account sync</h3>
              <p className="oxos-hint">
                {props.userId
                  ? syncStatus === "saving"
                    ? "Saving layout to your account…"
                    : "Layout syncs to your account — open OrbitX on another device and your desktop follows."
                  : "Sign in to sync your desktop layout across devices."}
              </p>
              {props.userId && (
                <button
                  type="button"
                  className="oxos-btn oxos-btn--ghost"
                  onClick={() => {
                    saveOsLayoutToCloud(currentLayout());
                    flushOsLayoutToCloud();
                    setSyncStatus("synced");
                  }}
                >
                  Sync now
                </button>
              )}
              <p className="oxos-hint">Windows, icons and taskbar stay centered. Drag any icon or window to move it — positions are saved on this device.</p>
            </>
          )}
          {settingsNav === "personalization" && (
            <>
              <h3 className="oxos-h3">Wallpaper</h3>
              <div className="oxos-wallgrid">
                {OS_WALLPAPERS.map((wp) => (
                  <button
                    key={wp.id}
                    type="button"
                    className={`oxos-wall oxos-wall--${wp.id}${settings.wallpaper === wp.id ? " is-on" : ""}`}
                    onClick={() => set({ wallpaper: wp.id })}
                  >
                    {wp.label}
                  </button>
                ))}
              </div>
              <h3 className="oxos-h3">Accent color</h3>
              <div className="oxos-accentrow">
                {OS_ACCENTS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`oxos-accent${settings.accent === a.hex ? " is-on" : ""}`}
                    style={{ background: a.hex }}
                    title={a.label}
                    aria-label={a.label}
                    onClick={() => set({ accent: a.hex, accentGrad: null })}
                  />
                ))}
              </div>
              <button type="button" className="oxos-btn oxos-btn--ghost" onClick={props.onOpenTheme}>
                Open Atmosphere theme
              </button>
              <button type="button" className="oxos-btn oxos-btn--ghost" onClick={() => openBuiltin("themes", "Theme Store")}>
                Open Theme Store
              </button>
              <h3 className="oxos-h3">Theme mode</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className={`oxos-btn oxos-btn--ghost${settings.themeMode !== "light" ? " is-on" : ""}`}
                  onClick={() => set({ themeMode: "dark" })}
                >
                  Dark
                </button>
                <button
                  type="button"
                  className={`oxos-btn oxos-btn--ghost${settings.themeMode === "light" ? " is-on" : ""}`}
                  onClick={() => set({ themeMode: "light" })}
                >
                  Light
                </button>
              </div>
              <h3 className="oxos-h3">Gradient accent</h3>
              <p className="oxos-hint">A two-color accent for buttons and the Start key. Picking a solid accent or a theme pack clears it.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(
                  [
                    ["Gold to Blue", "linear-gradient(135deg, #e8b84a, #60a5fa)"],
                    ["Teal to Violet", "linear-gradient(135deg, #2dd4bf, #c084fc)"],
                    ["Violet to Gold", "linear-gradient(135deg, #c084fc, #e8b84a)"],
                    ["Ocean to Gold", "linear-gradient(135deg, #2dd4bf, #e8b84a)"],
                  ] as const
                ).map(([label, g]) => (
                  <button
                    key={label}
                    type="button"
                    className={`oxos-btn oxos-btn--ghost${settings.accentGrad === g ? " is-on" : ""}`}
                    style={{ background: settings.accentGrad === g ? g : undefined }}
                    onClick={() => set({ accentGrad: g })}
                  >
                    {label}
                  </button>
                ))}
                <button type="button" className="oxos-btn oxos-btn--ghost" onClick={() => set({ accentGrad: null })}>
                  Clear gradient
                </button>
              </div>
              <label className="oxos-toggle">
                <span>Focus mode (dim inactive windows)</span>
                <input
                  type="checkbox"
                  checked={!!settings.focusMode}
                  onChange={(e) => set({ focusMode: e.target.checked })}
                />
              </label>
              <h3 className="oxos-h3">Window borders</h3>
              <div style={{ display: "flex", gap: 8 }}>
                {(
                  [
                    ["rounded", "Rounded"],
                    ["sharp", "Sharp"],
                    ["neon", "Neon glow"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`oxos-btn oxos-btn--ghost${(settings.windowBorder ?? "rounded") === id ? " is-on" : ""}`}
                    onClick={() => set({ windowBorder: id })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <h3 className="oxos-h3">Taskbar style</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className={`oxos-btn oxos-btn--ghost${(settings.taskbarStyle ?? "pill") === "pill" ? " is-on" : ""}`}
                  onClick={() => set({ taskbarStyle: "pill" })}
                >
                  Floating pill
                </button>
                <button
                  type="button"
                  className={`oxos-btn oxos-btn--ghost${settings.taskbarStyle === "bar" ? " is-on" : ""}`}
                  onClick={() => set({ taskbarStyle: "bar" })}
                >
                  Full-width bar
                </button>
              </div>
              <h3 className="oxos-h3">Desktop icons</h3>
              <label className="oxos-toggle">
                <span>Show icon labels</span>
                <input
                  type="checkbox"
                  checked={settings.showIconLabels !== false}
                  onChange={(e) => set({ showIconLabels: e.target.checked })}
                />
              </label>
              <p className="oxos-hint">Icon size: {settings.iconSize ?? 56}px</p>
              <input
                type="range"
                min={48}
                max={72}
                step={4}
                value={settings.iconSize ?? 56}
                onChange={(e) => set({ iconSize: Number(e.target.value) })}
              />
              <h3 className="oxos-h3">Font</h3>
              <div style={{ display: "flex", gap: 8 }}>
                {(
                  [
                    ["system", "System"],
                    ["serif", "Serif"],
                    ["mono", "Mono"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`oxos-btn oxos-btn--ghost${(settings.fontFamily ?? "system") === id ? " is-on" : ""}`}
                    onClick={() => set({ fontFamily: id })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <h3 className="oxos-h3">Interface scale</h3>
              <div style={{ display: "flex", gap: 8 }}>
                {(
                  [
                    ["s", "Small"],
                    ["m", "Medium"],
                    ["l", "Large"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`oxos-btn oxos-btn--ghost${(settings.uiScale ?? "m") === id ? " is-on" : ""}`}
                    onClick={() => set({ uiScale: id })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <h3 className="oxos-h3">Wallpaper</h3>
              <p className="oxos-hint">Blur: {settings.wallBlur ?? 0}px</p>
              <input
                type="range"
                min={0}
                max={12}
                step={1}
                value={settings.wallBlur ?? 0}
                onChange={(e) => set({ wallBlur: Number(e.target.value) })}
              />
              <p className="oxos-hint">Dim: {settings.scrimOpacity ?? 100}%</p>
              <input
                type="range"
                min={30}
                max={100}
                step={5}
                value={settings.scrimOpacity ?? 100}
                onChange={(e) => set({ scrimOpacity: Number(e.target.value) })}
              />
              <label className="oxos-toggle">
                <span>Rotate wallpaper hourly</span>
                <input
                  type="checkbox"
                  checked={!!settings.wallpaperShuffle}
                  onChange={(e) => set({ wallpaperShuffle: e.target.checked })}
                />
              </label>
              <button
                type="button"
                className="oxos-btn oxos-btn--ghost"
                onClick={() => {
                  const others = OS_WALLPAPERS.filter((w) => w.id !== settings.wallpaper);
                  set({ wallpaper: others[Math.floor(Math.random() * others.length)].id });
                }}
              >
                Shuffle wallpaper now
              </button>
              <h3 className="oxos-h3">Animation speed</h3>
              <p className="oxos-hint">{(settings.animSpeed ?? 1) === 0 ? "Off" : `${settings.animSpeed ?? 1}x`}</p>
              <input
                type="range"
                min={0}
                max={2}
                step={0.5}
                value={settings.animSpeed ?? 1}
                onChange={(e) => set({ animSpeed: Number(e.target.value) })}
              />
              <h3 className="oxos-h3">Desk widgets</h3>
              <div style={{ display: "flex", gap: 8 }}>
                {(
                  [
                    ["s", "Small"],
                    ["m", "Medium"],
                    ["l", "Large"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`oxos-btn oxos-btn--ghost${(settings.widgetSize ?? "m") === id ? " is-on" : ""}`}
                    onClick={() => set({ widgetSize: id })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="oxos-hint">Widget opacity: {settings.widgetOpacity ?? 100}%</p>
              <input
                type="range"
                min={40}
                max={100}
                step={5}
                value={settings.widgetOpacity ?? 100}
                onChange={(e) => set({ widgetOpacity: Number(e.target.value) })}
              />
            </>
          )}
          {settingsNav === "account" && (
            <>
              <div className="oxos-idcard">
                <span className="oxos-idcard__ava">{props.userInitial}</span>
                <span>
                  <span className="oxos-idcard__name">{props.userName}</span>
                  <span className="oxos-idcard__sub">{props.userSub}</span>
                </span>
              </div>
              <Link className="oxos-btn" to="/profile">Open Profile</Link>
              <Link className="oxos-btn oxos-btn--ghost" to="/settings">General preferences</Link>
              <button type="button" className="oxos-btn oxos-btn--danger" onClick={props.onSignOut}>
                Sign out
              </button>
            </>
          )}
          {settingsNav === "wallet" && (
            <>
              <h3 className="oxos-h3">Wallet</h3>
              <p className="oxos-hint">Connect Phantom to trade, burn MCP access, and sign on-chain. OrbitX never custodies your keys.</p>
              <WalletConnectButton />
            </>
          )}
          {settingsNav === "lock" && (
            <>
              <h3 className="oxos-h3">Device lock</h3>
              <p className="oxos-hint">
                A PIN lock for this device only. It never syncs, never leaves the device, and it is not your
                wallet PIN.
              </p>
              {lockState.pinHash ? (
                <>
                  <label className="oxos-toggle">
                    <span>Lock on start</span>
                    <input
                      type="checkbox"
                      checked={lockState.enabled}
                      onChange={(e) => setLockState((s) => ({ ...s, enabled: e.target.checked }))}
                    />
                  </label>
                  <button
                    type="button"
                    className="oxos-btn"
                    onClick={() => {
                      setUnlocked(false);
                      try {
                        sessionStorage.removeItem("orbitxos:unlocked:v1");
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    Lock now
                  </button>
                  <h3 className="oxos-h3">Change PIN</h3>
                </>
              ) : (
                <h3 className="oxos-h3">Set a PIN</h3>
              )}
              <input
                className="oxos-input"
                type="password"
                inputMode="numeric"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="PIN (4–8 digits)"
              />
              <input
                className="oxos-input"
                type="password"
                inputMode="numeric"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value)}
                placeholder="Confirm PIN"
              />
              {pinError && <p className="oxos-hint" style={{ color: "#f87171" }}>{pinError}</p>}
              <button
                type="button"
                className="oxos-btn"
                onClick={async () => {
                  if (pinInput.length < 4 || pinInput !== pinConfirm) {
                    setPinError("PINs must match and be at least 4 digits.");
                    return;
                  }
                  setLockState({ enabled: true, pinHash: await hashPin(pinInput) });
                  setUnlocked(true);
                  try {
                    sessionStorage.setItem("orbitxos:unlocked:v1", "1");
                  } catch {
                    /* ignore */
                  }
                  setPinInput("");
                  setPinConfirm("");
                  setPinError("");
                }}
              >
                {lockState.pinHash ? "Save new PIN" : "Set PIN & lock on start"}
              </button>
              {lockState.pinHash && (
                <button
                  type="button"
                  className="oxos-btn oxos-btn--danger"
                  onClick={() => {
                    setLockState({ enabled: false, pinHash: "" });
                    setUnlocked(true);
                  }}
                >
                  Remove lock
                </button>
              )}
            </>
          )}
          {settingsNav === "about" && (
            <>
              <h3 className="oxos-h3">OrbitX OS 1.0</h3>
              <p className="oxos-hint">The whole of OrbitX as a computer: City, DEX, Agent mesh, Shop, Social and Intel — one desktop, one wallet, centered.</p>
              <Link className="oxos-btn oxos-btn--ghost" to="/support">Support & tickets</Link>
            </>
          )}
        </div>
      </div>
    );
  };

  const foldered = useMemo(() => folderedKeys(folders), [folders]);
  const uiFont =
    settings.fontFamily === "serif"
      ? "Georgia, 'Times New Roman', serif"
      : settings.fontFamily === "mono"
        ? "ui-monospace, Menlo, monospace"
        : "inherit";
  const uiFontSize = settings.uiScale === "s" ? "15px" : settings.uiScale === "l" ? "18px" : undefined;
  const widgetW = settings.widgetSize === "s" ? "180px" : settings.widgetSize === "l" ? "280px" : "220px";
  const visibleDesktopApps = [...desktopApps, ...installedAsApps].filter((a) => !foldered.has(a.key));
  const unplaced = visibleDesktopApps.filter((a) => !iconPos[a.key]);
  const placed = visibleDesktopApps.filter((a) => iconPos[a.key]);
  const unplacedFolders = folders.filter((f) => !iconPos[`folder:${f.id}`]);
  const placedFolders = folders.filter((f) => iconPos[`folder:${f.id}`]);

  return (
    <div
      ref={rootRef}
      className={`oxos${settings.reduceMotion ? " oxos--reduced" : ""}${settings.themeMode === "light" ? " oxos--light" : ""}${settings.focusMode ? " oxos--focus" : ""}${settings.taskbarStyle === "bar" ? " oxos--taskbar-bar" : ""}${settings.windowBorder === "sharp" ? " oxos--sharp" : settings.windowBorder === "neon" ? " oxos--neon" : ""}${settings.showIconLabels === false ? " oxos--no-labels" : ""}${settings.uiScale === "s" ? " oxos--font-s" : settings.uiScale === "l" ? " oxos--font-l" : ""}`}
      style={
        {
          "--os-accent": settings.accent,
          "--os-icon-radius": `${activePack?.radius ?? 18}px`,
          "--os-icon-ring": activePack?.ring ?? "none",
          "--os-icon-size": `${settings.iconSize ?? 56}px`,
          "--os-font": uiFont,
          "--os-font-size": uiFontSize,
          "--os-wall-blur": `${settings.wallBlur ?? 0}px`,
          "--os-scrim-opacity": (settings.scrimOpacity ?? 100) / 100,
          "--os-anim": settings.animSpeed ?? 1,
          "--os-widget-w": widgetW,
          "--os-widget-opacity": (settings.widgetOpacity ?? 100) / 100,
          ...(settings.accentGrad ? { "--os-accent-grad": settings.accentGrad } : {}),
        } as React.CSSProperties
      }
      onPointerMove={onRootMove}
      onPointerUp={onRootUp}
    >
      <style>{aiWidgetCSS}</style>

      {/* Wallpaper */}
      {settings.wallpaper === "space" ? (
        <div className="oxos-wallpaper" aria-hidden>
          <HubSpaceBackground />
        </div>
      ) : (
        <div className={`oxos-wallpaper oxos-wallpaper--${settings.wallpaper}`} aria-hidden />
      )}
      <div className="oxos-scrim" aria-hidden />

      {/* Desktop icons: free-placed ones float, the rest sit in a centered grid */}
      <div className="oxos-icons" onPointerDown={() => setActiveWin(null)}>
        <div className="oxos-icon-grid">
          {unplaced.map((a) => iconButton(a, false))}
          {unplacedFolders.map((f) => folderButton(f, false))}
        </div>
        {placed.map((a) => iconButton(a, true))}
        {placedFolders.map((f) => folderButton(f, true))}
      </div>

      {/* Desk widgets — live, draggable, saved + synced with the account */}
      {deskWidgets.map((wdg) => (
        <section
          key={wdg.id}
          className="oxos-deskwd"
          style={{ left: `${wdg.x}%`, top: `${wdg.y}%` }}
        >
          <header
            className="oxos-deskwd__head"
            onPointerDown={(e) => {
              dragRef.current = { type: "widget", id: wdg.id, startX: e.clientX, startY: e.clientY, origX: wdg.x, origY: wdg.y };
            }}
          >
            <span>{wdg.type === "ticker" ? "Market" : wdg.type === "trending" ? "Trending" : wdg.type === "countdown" ? "Countdown" : wdg.type === "quote" ? "Quote" : "My alerts"}</span>
            <button
              type="button"
              title="Remove widget"
              onClick={() => setDeskWidgets((prev) => prev.filter((x) => x.id !== wdg.id))}
            >
              ✕
            </button>
          </header>
          <div className="oxos-deskwd__body">
            {wdg.type === "ticker" && (
              <>
                <div className="oxos-deskwd__row">
                  <span>SOL</span>
                  <span>{props.solPrice != null ? fmtUsd(props.solPrice) : "—"}</span>
                  {props.solChange != null && (
                    <span className={props.solChange >= 0 ? "up" : "down"}>
                      {props.solChange >= 0 ? "▲" : "▼"} {Math.abs(props.solChange).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="oxos-deskwd__row">
                  <span>$ORBITX</span>
                  <span>{props.orbitxPrice != null ? fmtUsd(props.orbitxPrice, 6) : "—"}</span>
                  {props.orbitxChange != null && (
                    <span className={props.orbitxChange >= 0 ? "up" : "down"}>
                      {props.orbitxChange >= 0 ? "▲" : "▼"} {Math.abs(props.orbitxChange).toFixed(1)}%
                    </span>
                  )}
                </div>
              </>
            )}
            {wdg.type === "trending" &&
              props.trending.slice(0, 5).map((t) => (
                <div key={t.mint} className="oxos-deskwd__row">
                  <span>{t.symbol}</span>
                  <span>{fmtUsd(t.price)}</span>
                  <span className={t.change24h >= 0 ? "up" : "down"}>
                    {t.change24h >= 0 ? "+" : ""}
                    {t.change24h.toFixed(1)}%
                  </span>
                </div>
              ))}
            {wdg.type === "alerts" &&
              (alerts.length === 0 ? (
                <p className="oxos-hint">No alerts yet — add one from Notifications.</p>
              ) : (
                alerts.slice(0, 5).map((a) => (
                  <div key={a.id} className="oxos-deskwd__row">
                    <span>
                      {a.symbol} {a.direction === "above" ? "↑" : "↓"} ${a.target}
                    </span>
                    <span>{a.triggered ? "Hit ✓" : "Armed"}</span>
                  </div>
                ))
              ))}
            {wdg.type === "countdown" && (
              <div className="oxos-deskwd__countdown">
                <input
                  className="oxos-input"
                  value={wdg.label ?? "Countdown"}
                  onChange={(e) => setDeskWidgets((prev) => prev.map((x) => (x.id === wdg.id ? { ...x, label: e.target.value } : x)))}
                  aria-label="Countdown label"
                />
                <input
                  className="oxos-input"
                  type="date"
                  value={wdg.targetDate ?? ""}
                  onChange={(e) => setDeskWidgets((prev) => prev.map((x) => (x.id === wdg.id ? { ...x, targetDate: e.target.value } : x)))}
                  aria-label="Countdown date"
                />
                {wdg.targetDate ? (
                  <div className="oxos-deskwd__bignum">
                    {(() => {
                      const d = daysUntil(wdg.targetDate as string);
                      return d > 0 ? `${d} days left` : d === 0 ? "Today!" : `${Math.abs(d)} days ago`;
                    })()}
                  </div>
                ) : (
                  <p className="oxos-hint">Pick a date.</p>
                )}
              </div>
            )}
            {wdg.type === "quote" && (
              <div className="oxos-deskwd__quote">
                <p>“{quoteOfDay()}”</p>
                <span className="oxos-hint">Quote of the day</span>
              </div>
            )}
          </div>
        </section>
      ))}

      {/* Folder panel — iOS-style folder view */}
      {openFolderId &&
        (() => {
          const folder = folders.find((f) => f.id === openFolderId);
          if (!folder) return null;
          const members = folder.appKeys.map((k) => appByKey.get(k)).filter(Boolean) as PlatformApp[];
          return (
            <div className="oxos-folderpanel">
              <div
                className="oxos-folderpanel__backdrop"
                // Close on pointerdown, NOT click: on touch, the tap that opens
                // the folder fires pointerup (panel mounts) and the browser then
                // retargets the compatibility mouse/click sequence to the element
                // now under the finger — the backdrop — so an onClick closer
                // instantly closes the panel it just opened ("opens and closes",
                // app stuck inside). Pointer events are never retargeted, so the
                // opening tap has no pointerdown on the backdrop to swallow.
                onPointerDown={() => setOpenFolderId(null)}
              />
              <div className="oxos-folderpanel__card">
                <div className="oxos-folderpanel__head">
                  <input
                    key={folder.id}
                    className="oxos-folderpanel__name"
                    defaultValue={folder.name}
                    aria-label="Folder name"
                    onBlur={(e) => setFolders((prev) => renameFolder(prev, folder.id, e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                  />
                  <button type="button" className="oxos-folderpanel__close" onClick={() => setOpenFolderId(null)}>
                    ✕
                  </button>
                </div>
                <div className="oxos-folderpanel__grid">
                  {members.map((m) => (
                    <div key={m.key} className="oxos-folderpanel__cell">
                      <button
                        type="button"
                        className="oxos-folderpanel__app"
                        onClick={() => {
                          setOpenFolderId(null);
                          openApp(m);
                        }}
                      >
                        {<AppMark app={m} className="oxos-folderpanel__mark" />}
                        <span>{m.name}</span>
                      </button>
                      <button
                        type="button"
                        className="oxos-folderpanel__remove"
                        title={`Remove ${m.name} from folder`}
                        onClick={() => setFolders((prev) => removeFromFolder(prev, folder.id, m.key))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div className="oxos-folderpanel__foot">
                  <button
                    type="button"
                    className="oxos-btn oxos-btn--ghost"
                    onClick={() => {
                      setFolders((prev) => ungroupFolder(prev, folder.id).folders);
                      setOpenFolderId(null);
                    }}
                  >
                    Ungroup
                  </button>
                  <button type="button" className="oxos-btn" onClick={() => setOpenFolderId(null)}>
                    Done
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Phone shell: iOS-style home screen on narrow viewports. The
          desktop icon grid + taskbar hide under 768px (see os.css) and this
          home grid, dock, folder sheets, switcher, and home indicator take
          over. Windows themselves are unchanged — maximizing one covers
          the home screen; the indicator minimizes everything back home. */}
      {isPhone && (
        <div className="oxos-phone">
          <div className="oxos-phone__status">
            <span>{clock}</span>
            <span>OrbitX</span>
            <span className="oxos-phone__statusbtns">
              <button type="button" title="App switcher" onClick={() => setPhoneSwitcherOpen(true)}>
                ▢▢
              </button>
              <button type="button" title="Control Center" onClick={() => setControlOpen(true)}>
                ◧
              </button>
              <button type="button" title="Notifications" onClick={() => setNotifOpen(true)}>
                🔔
              </button>
              <button type="button" title="Settings" onClick={() => openBuiltin("settings", "Settings")}>
                ⚙
              </button>
            </span>
          </div>
          <div className="oxos-phone__grid">
            {[...desktopApps, ...installedAsApps]
              .filter((a) => !foldered.has(a.key))
              .map((a) => (
                <button key={a.key} type="button" className="oxos-phone__icon" onClick={() => openApp(a)}>
                  {<AppMark app={a} className="oxos-phone__mark" />}
                  <span>{a.name}</span>
                </button>
              ))}
            {folders.map((f) => (
              <button key={f.id} type="button" className="oxos-phone__icon" onClick={() => setPhoneFolderId(f.id)}>
                <span className="oxos-phone__folder">
                  {f.appKeys.slice(0, 4).map((k) => {
                    const m = appByKey.get(k);
                    return m ? (
                      <span key={k} className="oxos-phone__foldermini" style={{ background: m.iconBg }}>
                        {m.glyph}
                      </span>
                    ) : null;
                  })}
                </span>
                <span>{f.name}</span>
              </button>
            ))}
          </div>
          <div className="oxos-phone__dock">
            {gates.slice(0, 3).map((a) => (
              <button key={a.key} type="button" className="oxos-phone__dockbtn" title={a.name} onClick={() => openApp(a)}>
                {<AppMark app={a} className="oxos-phone__mark" />}
              </button>
            ))}
            <button type="button" className="oxos-phone__dockbtn" title="Browser" onClick={() => openBuiltin("browser", "Browser")}>
              <span className="oxos-phone__mark oxos-phone__mark--browser">🌐</span>
            </button>
          </div>
        </div>
      )}
      {isPhone && phoneFolderId && (() => {
        const folder = folders.find((f) => f.id === phoneFolderId);
        if (!folder) return null;
        const members = folder.appKeys.map((k) => appByKey.get(k)).filter((a): a is PlatformApp => !!a);
        return (
          <div className="oxos-phone__sheet">
            <div className="oxos-phone__sheethead">
              <span>{folder.name}</span>
              <button type="button" onClick={() => setPhoneFolderId(null)}>
                ✕
              </button>
            </div>
            <div className="oxos-phone__grid">
              {members.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className="oxos-phone__icon"
                  onClick={() => {
                    openApp(m);
                    setPhoneFolderId(null);
                  }}
                >
                  {<AppMark app={m} className="oxos-phone__mark" />}
                  <span>{m.name}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}
      {isPhone && phoneSwitcherOpen && (
        <div className="oxos-phone__sheet">
          <div className="oxos-phone__sheethead">
            <span>Switcher</span>
            <button type="button" onClick={() => setPhoneSwitcherOpen(false)}>
              ✕
            </button>
          </div>
          <div className="oxos-phone__switcher">
            {ws.windows.map((w) => (
              <div key={w.id} className="oxos-phone__card">
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: "restore", id: w.id });
                    dispatch({ type: "focus", id: w.id });
                    setActiveWin(w.id);
                    setPhoneSwitcherOpen(false);
                  }}
                >
                  {w.title}
                </button>
                <button type="button" title="Close" onClick={() => closeWin(w.id)}>
                  ✕
                </button>
              </div>
            ))}
            {!ws.windows.length && <p className="oxos-hint">No open apps — tap an icon to launch one.</p>}
          </div>
        </div>
      )}
      {isPhone && (
        <button
          type="button"
          className="oxos-phone__home"
          title="Home"
          aria-label="Home"
          onClick={() => {
            for (const w of ws.windows) if (!w.minimized) dispatch({ type: "minimize", id: w.id });
            setActiveWin(null);
          }}
        />
      )}

      {/* Windows (current desktop + pinned) */}
      {visibleWindows.map((w) => {
        const isActive = activeWin === w.id;
        const app = w.appKey ? appByKey.get(w.appKey) : undefined;
        return (
          <section
            key={w.id}
            className={`oxos-window${isActive ? " is-active" : ""}${w.maximized ? " is-max" : ""}`}
            style={
              w.maximized
                ? { zIndex: w.pinned ? 60000 : w.z }
                : { left: w.x, top: w.y, width: w.w, height: w.h, zIndex: w.pinned ? 60000 : w.z }
            }
            hidden={w.minimized}
            onPointerDown={() => {
              dispatch({ type: "focus", id: w.id });
              setActiveWin(w.id);
            }}
          >
            <header
              className="oxos-window__bar"
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest("button")) return;
                dragRef.current = { type: "win", id: w.id, startX: e.clientX, startY: e.clientY, origX: w.x, origY: w.y };
              }}
            >
              {app && <AppMark app={app} className="oxos-window__mark" />}
              <span className="oxos-window__title">{w.title}</span>
              {app && !app.external && (
                <button
                  type="button"
                  className="oxos-window__ctl"
                  title="Open full screen"
                  onClick={() => window.location.assign(app.href)}
                >
                  ⤢
                </button>
              )}
              <button
                type="button"
                className={`oxos-window__ctl${w.pinned ? " is-on" : ""}`}
                title={w.pinned ? "Unpin from top" : "Pin on top"}
                onClick={() => dispatch({ type: "toggle-pin", id: w.id })}
              >
                📌
              </button>
              <button
                type="button"
                className="oxos-window__ctl"
                title="Minimize"
                onClick={() => dispatch({ type: "minimize", id: w.id })}
              >
                —
              </button>
              <button
                type="button"
                className="oxos-window__ctl"
                title="Maximize"
                onClick={() => dispatch({ type: "toggle-maximize", id: w.id })}
              >
                ▢
              </button>
              <button
                type="button"
                className="oxos-window__ctl oxos-window__ctl--close"
                title="Close"
                onClick={() => closeWin(w.id)}
              >
                ✕
              </button>
            </header>
            <div className="oxos-window__body">{windowBody(w)}</div>
            {!w.maximized && (
              <span
                className="oxos-window__resize"
                onPointerDown={(e) => {
                  dragRef.current = { type: "resize", id: w.id, startX: e.clientX, startY: e.clientY, origW: w.w, origH: w.h };
                }}
              />
            )}
          </section>
        );
      })}

      {/* Snap preview while dragging a window to an edge */}
      {snapPreview && <div className={`oxos-snap oxos-snap--${snapPreview}`} aria-hidden />}

      {/* Start menu */}
      {startOpen && (
        <div className="oxos-start">
          <div className="oxos-start__head">
            <span className="oxos-start__greet">
              {greet}, {props.userName}
            </span>
            {props.fng && (
              <span className="oxos-start__mood">
                Market mood: {props.fng.label} ({props.fng.v})
              </span>
            )}
            <input
              className="oxos-input"
              autoFocus
              value={startQ}
              onChange={(e) => setStartQ(e.target.value)}
              placeholder="Search apps, settings, tokens…"
            />
          </div>
          <div className="oxos-start__label">Pinned</div>
          <div className="oxos-start__pinned">
            {gates.map((a) => (
              <button key={a.key} type="button" className="oxos-start__pin" onClick={() => openApp(a)}>
                {<AppMark app={a} className="oxos-start__pinmark" />}
                <span>{a.name}</span>
              </button>
            ))}
          </div>
          <div className="oxos-start__label">All apps</div>
          <div className="oxos-start__list">
            {startApps.map((a) => (
              <button key={a.key} type="button" className="oxos-start__row" onClick={() => openApp(a)}>
                {<AppMark app={a} className="oxos-start__rowmark" />}
                <span className="oxos-start__rowmeta">
                  <span>{a.name}</span>
                  <span>{a.caption}</span>
                </span>
              </button>
            ))}
            {!startApps.length && <p className="oxos-hint">No apps match that search.</p>}
          </div>
          {startQ.trim() && (
            <>
              {spotTokens.length > 0 && (
                <>
                  <div className="oxos-start__label">Tokens</div>
                  <div className="oxos-start__list">
                    {spotTokens.map((t) => (
                      <button
                        key={t.mint}
                        type="button"
                        className="oxos-start__row"
                        onClick={() => {
                          const dex = allApps.find((a) => a.key === "dex");
                          if (dex) openAppWithHref(dex, `/ORBITX_DEX?mint=${t.mint}`);
                          else openBrowserTab(`https://dexscreener.com/solana/${t.mint}`, t.symbol);
                        }}
                      >
                        <span className="oxos-start__rowmeta">
                          <span>{t.symbol}</span>
                          <span>
                            {t.name}
                            {t.priceUsd != null
                              ? ` · $${t.priceUsd < 0.01 ? t.priceUsd.toFixed(6) : t.priceUsd.toFixed(4)}`
                              : ""}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="oxos-start__label">Settings &amp; actions</div>
              <div className="oxos-start__list">
                {(
                  [
                    ["system", "System settings"],
                    ["personalization", "Personalization"],
                    ["account", "Account"],
                    ["wallet", "Wallet"],
                    ["lock", "Device lock"],
                    ["about", "About OrbitX OS"],
                  ] as const
                )
                  .filter(([, label]) => label.toLowerCase().includes(startQ.trim().toLowerCase()))
                  .map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className="oxos-start__row"
                      onClick={() => {
                        setSettingsNav(id);
                        openBuiltin("settings", "Settings");
                      }}
                    >
                      <span className="oxos-start__rowmeta">
                        <span>{label}</span>
                        <span>Settings</span>
                      </span>
                    </button>
                  ))}
                {(
                  [
                    ["store", "App Store"],
                    ["browser", "Browser"],
                    ["themes", "Theme Store"],
                  ] as const
                )
                  .filter(([, label]) => label.toLowerCase().includes(startQ.trim().toLowerCase()))
                  .map(([kind, label]) => (
                    <button
                      key={kind}
                      type="button"
                      className="oxos-start__row"
                      onClick={() => openBuiltin(kind, label)}
                    >
                      <span className="oxos-start__rowmeta">
                        <span>{label}</span>
                        <span>Open</span>
                      </span>
                    </button>
                  ))}
                {"control center".includes(startQ.trim().toLowerCase()) && (
                  <button
                    type="button"
                    className="oxos-start__row"
                    onClick={() => {
                      setStartOpen(false);
                      setControlOpen(true);
                    }}
                  >
                    <span className="oxos-start__rowmeta">
                      <span>Control Center</span>
                      <span>Panel</span>
                    </span>
                  </button>
                )}
                {"notifications".includes(startQ.trim().toLowerCase()) && (
                  <button
                    type="button"
                    className="oxos-start__row"
                    onClick={() => {
                      setStartOpen(false);
                      setNotifOpen(true);
                    }}
                  >
                    <span className="oxos-start__rowmeta">
                      <span>Notifications</span>
                      <span>Panel</span>
                    </span>
                  </button>
                )}
              </div>
            </>
          )}
          <div className="oxos-start__label">System</div>
          <div className="oxos-start__list">
            <button type="button" className="oxos-start__row" onClick={() => openBuiltin("store", "App Store")}>
              <span className="oxos-start__rowmeta">
                <span>App Store</span>
                <span>Install apps</span>
              </span>
            </button>
            <button type="button" className="oxos-start__row" onClick={() => openBuiltin("browser", "Browser")}>
              <span className="oxos-start__rowmeta">
                <span>Browser</span>
                <span>Web apps</span>
              </span>
            </button>
            <button type="button" className="oxos-start__row" onClick={() => openBuiltin("themes", "Theme Store")}>
              <span className="oxos-start__rowmeta">
                <span>Theme Store</span>
                <span>Wallpapers + icons</span>
              </span>
            </button>
            <button type="button" className="oxos-start__row" onClick={() => openBuiltin("feed", "ORBITX Pulse")}>
              <span className="oxos-start__rowmeta">
                <span>ORBITX Pulse</span>
                <span>Live $ORBITX stats</span>
              </span>
            </button>
            <button type="button" className="oxos-start__row" onClick={() => openBuiltin("notes", "Notes")}>
              <span className="oxos-start__rowmeta">
                <span>Notes</span>
                <span>Synced with account</span>
              </span>
            </button>
            <button type="button" className="oxos-start__row" onClick={() => openBuiltin("files", "Files")}>
              <span className="oxos-start__rowmeta">
                <span>Files</span>
                <span>Device-local shelf</span>
              </span>
            </button>
            <button type="button" className="oxos-start__row" onClick={() => openBuiltin("tasks", "Tasks")}>
              <span className="oxos-start__rowmeta">
                <span>Tasks</span>
                <span>Todo lists, due dates</span>
              </span>
            </button>
            <button type="button" className="oxos-start__row" onClick={() => openBuiltin("calendar", "Calendar")}>
              <span className="oxos-start__rowmeta">
                <span>Calendar</span>
                <span>Events, device-local</span>
              </span>
            </button>
            <button type="button" className="oxos-start__row" onClick={() => openBuiltin("shortcuts", "Shortcuts")}>
              <span className="oxos-start__rowmeta">
                <span>Shortcuts</span>
                <span>What the OS actually does</span>
              </span>
            </button>
            <button
              type="button"
              className="oxos-start__row"
              onClick={() => {
                setStartOpen(false);
                setDeskOpen(true);
              }}
            >
              <span className="oxos-start__rowmeta">
                <span>Desktops</span>
                <span>Workspaces + layouts</span>
              </span>
            </button>
            <button
              type="button"
              className="oxos-start__row"
              onClick={() => {
                setStartOpen(false);
                setControlOpen(true);
              }}
            >
              <span className="oxos-start__rowmeta">
                <span>Control Center</span>
                <span>Panel</span>
              </span>
            </button>
            <button
              type="button"
              className="oxos-start__row"
              onClick={() => {
                setStartOpen(false);
                setNotifOpen(true);
              }}
            >
              <span className="oxos-start__rowmeta">
                <span>Notifications</span>
                <span>Alerts</span>
              </span>
            </button>
          </div>
          <div className="oxos-start__foot">
            <span className="oxos-start__user">
              <span className="oxos-start__ava">{props.userInitial}</span>
              {props.userName}
            </span>
            <button type="button" className="oxos-start__footbtn" onClick={() => openBuiltin("settings", "Settings")}>
              Settings
            </button>
            <button type="button" className="oxos-start__footbtn oxos-start__footbtn--danger" onClick={props.onSignOut}>
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Taskbar — centered floating pill */}
      <footer className="oxos-taskbar">
        <button type="button" className="oxos-taskbar__start" title="Start" onClick={() => setStartOpen((v) => !v)}>
          ◈
        </button>
        <button type="button" className="oxos-taskbar__btn" title="Search (⌘K)" onClick={() => setStartOpen(true)}>
          🔍
        </button>
        <button
          type="button"
          className="oxos-taskbar__btn"
          title="Command bar"
          onClick={() => {
            setCmdOpen((v) => !v);
            setStartOpen(false);
            setControlOpen(false);
            setNotifOpen(false);
          }}
        >
          ⌘
        </button>
        <button
          type="button"
          className="oxos-taskbar__btn"
          title="Control Center"
          onClick={() => {
            setControlOpen((v) => !v);
            setStartOpen(false);
            setNotifOpen(false);
            setCmdOpen(false);
          }}
        >
          ◧
        </button>
        <button
          type="button"
          className="oxos-taskbar__btn"
          title="Notifications"
          onClick={() => {
            setNotifOpen((v) => !v);
            setStartOpen(false);
            setControlOpen(false);
            setCmdOpen(false);
          }}
        >
          <span style={{ position: "relative" }}>
            🔔
            {unreadCount > 0 && (
              <span className="oxos-taskbar__badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </span>
        </button>
        <button
          type="button"
          className="oxos-taskbar__btn"
          title="App Store"
          onClick={() => {
            setStartOpen(false);
            setControlOpen(false);
            setNotifOpen(false);
            setCmdOpen(false);
            openBuiltin("store", "App Store");
          }}
        >
          ▦
        </button>
        <button
          type="button"
          className="oxos-taskbar__btn"
          title="Desktops"
          onClick={() => {
            setDeskOpen((v) => !v);
            setStartOpen(false);
            setControlOpen(false);
            setNotifOpen(false);
            setCmdOpen(false);
          }}
        >
          ❐
        </button>
        <span className="oxos-taskbar__sep" />
        {gates.map((a) => (
          <button key={a.key} type="button" className="oxos-taskbar__btn" title={a.name} onClick={() => openApp(a)}>
            {<AppMark app={a} className="oxos-taskbar__mark" />}
          </button>
        ))}
        <span className="oxos-taskbar__sep" />
        {visibleWindows.map((w) => (
          <button
            key={w.id}
            type="button"
            className={`oxos-taskbar__win${activeWin === w.id && !w.minimized ? " is-on" : ""}`}
            onClick={() => {
              if (w.minimized) {
                dispatch({ type: "restore", id: w.id });
                setActiveWin(w.id);
              } else if (activeWin === w.id) {
                dispatch({ type: "minimize", id: w.id });
              } else {
                dispatch({ type: "focus", id: w.id });
                setActiveWin(w.id);
              }
            }}
          >
            {w.title}
          </button>
        ))}
        <span className="oxos-taskbar__tray">
          {settings.showTrayPrices && (props.solPrice != null || props.orbitxPrice != null) && (
            <span className="oxos-tray__prices">
              {props.solPrice != null && <span>SOL {fmtUsd(props.solPrice)}</span>}
              {props.orbitxPrice != null && <span>$ORBITX {fmtUsd(props.orbitxPrice, 6)}</span>}
            </span>
          )}
          <button type="button" className="oxos-tray__clock" title="Calendar" onClick={() => setCalPanelOpen((v) => !v)}>
            {clock} · {dateStr}
          </button>
        </span>
      </footer>

      {/* Mini calendar (tray clock, #56) */}
      {calPanelOpen && (
        <div className="oxos-panel oxos-panel--right oxos-calpanel">
          <div className="oxos-panel__head">
            <span>Calendar</span>
            <button type="button" onClick={() => setCalPanelOpen(false)}>
              ✕
            </button>
          </div>
          <MiniCal />
          <button
            type="button"
            className="oxos-btn oxos-btn--ghost"
            onClick={() => {
              setCalPanelOpen(false);
              openBuiltin("calendar", "Calendar");
            }}
          >
            Open Calendar app
          </button>
        </div>
      )}

      {/* Control Center */}
      {controlOpen && (
        <div className="oxos-panel oxos-panel--right">
          <div className="oxos-panel__head">
            <span>Control Center</span>
            <button type="button" onClick={() => setControlOpen(false)}>
              ✕
            </button>
          </div>
          <h3 className="oxos-h3">Wallet</h3>
          <WalletConnectButton />
          <h3 className="oxos-h3">Appearance</h3>
          <div className="oxos-wallgrid">
            {OS_WALLPAPERS.map((wp) => (
              <button
                key={wp.id}
                type="button"
                className={`oxos-wall oxos-wall--${wp.id}${settings.wallpaper === wp.id ? " is-on" : ""}`}
                onClick={() => setSettings((s) => ({ ...s, wallpaper: wp.id }))}
              >
                {wp.label}
              </button>
            ))}
          </div>
          <div className="oxos-accentrow">
            {OS_ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`oxos-accent${settings.accent === a.hex ? " is-on" : ""}`}
                style={{ background: a.hex }}
                title={a.label}
                aria-label={a.label}
                onClick={() => setSettings((s) => ({ ...s, accent: a.hex }))}
              />
            ))}
          </div>
          <button type="button" className="oxos-btn oxos-btn--ghost" onClick={() => { setControlOpen(false); openBuiltin("themes", "Theme Store"); }}>
            Theme Store
          </button>
          <h3 className="oxos-h3">Toggles</h3>
          <label className="oxos-toggle">
            <span>Do not disturb</span>
            <input type="checkbox" checked={dnd} onChange={(e) => setDnd(e.target.checked)} />
          </label>
          <label className="oxos-toggle">
            <span>Show market prices in taskbar</span>
            <input
              type="checkbox"
              checked={settings.showTrayPrices}
              onChange={(e) => setSettings((s) => ({ ...s, showTrayPrices: e.target.checked }))}
            />
          </label>
          <label className="oxos-toggle">
            <span>Reduce motion</span>
            <input
              type="checkbox"
              checked={settings.reduceMotion}
              onChange={(e) => setSettings((s) => ({ ...s, reduceMotion: e.target.checked }))}
            />
          </label>
          <label className="oxos-toggle">
            <span>Focus mode</span>
            <input
              type="checkbox"
              checked={!!settings.focusMode}
              onChange={(e) => setSettings((s) => ({ ...s, focusMode: e.target.checked }))}
            />
          </label>
          <label className="oxos-toggle">
            <span>Light mode</span>
            <input
              type="checkbox"
              checked={settings.themeMode === "light"}
              onChange={(e) => setSettings((s) => ({ ...s, themeMode: e.target.checked ? "light" : "dark" }))}
            />
          </label>
          <h3 className="oxos-h3">Screen dim</h3>
          <input type="range" min={0} max={60} value={dim} onChange={(e) => setDim(Number(e.target.value))} />
          <h3 className="oxos-h3">Desk widgets</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(
              [
                ["ticker", "Market"],
                ["trending", "Trending"],
                ["alerts", "Alerts"],
                ["countdown", "Countdown"],
                ["quote", "Quote"],
              ] as const
            ).map(([t, label]) => (
              <button
                key={t}
                type="button"
                className="oxos-btn oxos-btn--ghost"
                onClick={() =>
                  setDeskWidgets((prev) => [
                    ...prev,
                    {
                      id: `wdg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
                      type: t,
                      x: 4 + prev.length * 2,
                      y: 12,
                      ...(t === "countdown"
                        ? { label: "Countdown", targetDate: isoDay(new Date(Date.now() + 7 * 86400000)) }
                        : {}),
                    },
                  ])
                }
              >
                + {label}
              </button>
            ))}
          </div>
          <h3 className="oxos-h3">Quick actions</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="oxos-btn" onClick={openVoiceMiniPlayer}>
              Voice mini-player
            </button>
            <button
              type="button"
              className="oxos-btn"
              onClick={() => {
                setControlOpen(false);
                openBuiltin("store", "App Store");
              }}
            >
              App Store
            </button>
            <button
              type="button"
              className="oxos-btn"
              onClick={() => {
                setControlOpen(false);
                openBuiltin("browser", "Browser");
              }}
            >
              Browser
            </button>
            <button
              type="button"
              className="oxos-btn oxos-btn--danger"
              disabled={!lockState.pinHash}
              onClick={() => {
                setUnlocked(false);
                try {
                  sessionStorage.removeItem("orbitxos:unlocked:v1");
                } catch {
                  /* ignore */
                }
                setControlOpen(false);
              }}
            >
              Lock
            </button>
          </div>
          <h3 className="oxos-h3">Sync</h3>
          <p className="oxos-hint">
            {props.userId
              ? syncStatus === "saving"
                ? "Saving…"
                : "Synced to your account"
              : "Sign in to sync across devices."}
          </p>
          {props.userId && (
            <button
              type="button"
              className="oxos-btn oxos-btn--ghost"
              onClick={() => {
                saveOsLayoutToCloud(currentLayout());
                flushOsLayoutToCloud();
                setSyncStatus("synced");
              }}
            >
              Sync now
            </button>
          )}
        </div>
      )}

      {/* Desktops + saved window layouts */}
      {deskOpen && (
        <div className="oxos-panel oxos-panel--right">
          <div className="oxos-panel__head">
            <span>Desktops</span>
            <button type="button" onClick={() => setDeskOpen(false)}>
              ✕
            </button>
          </div>
          <p className="oxos-hint">Each desktop holds its own windows. Pinned windows show everywhere.</p>
          <div className="oxos-desklist">
            {desktops.map((d) => {
              const wins = ws.windows.filter((w) => w.desktopId === d.id);
              return (
                <div key={d.id} className={`oxos-desk${d.id === activeDesktop?.id ? " is-on" : ""}`}>
                  <button type="button" className="oxos-desk__name" onClick={() => setActiveDesktopId(d.id)}>
                    {d.name}
                    {d.id === activeDesktop?.id ? " ✓" : ""}
                  </button>
                  <span className="oxos-desk__count">{wins.length} window{wins.length === 1 ? "" : "s"}</span>
                  <div className="oxos-desk__wins">
                    {wins.map((w) => (
                      <div key={w.id} className="oxos-desk__win">
                        <span>{w.title}</span>
                        {d.id !== activeDesktop?.id && (
                          <button
                            type="button"
                            onClick={() => {
                              dispatch({ type: "close", id: w.id });
                              const r = centerRect();
                              dispatch({
                                type: "open",
                                window: { id: w.id, kind: w.kind, appKey: w.appKey, title: w.title, x: r.x, y: r.y, w: r.w, h: r.h, hrefOverride: w.hrefOverride, pinned: w.pinned, desktopId: activeDesktop?.id },
                              });
                              setActiveWin(w.id);
                            }}
                          >
                            Move here
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {desktops.length < 4 && (
            <button
              type="button"
              className="oxos-btn oxos-btn--ghost"
              onClick={() => {
                const d: OsDesktop = { id: `desk-${Date.now().toString(36)}`, name: `Desktop ${desktops.length + 1}` };
                setDesktops((prev) => [...prev, d]);
                setActiveDesktopId(d.id);
              }}
            >
              + New desktop
            </button>
          )}
          <h3 className="oxos-h3">Recently closed</h3>
          <p className="oxos-hint">Windows closed in the last hour — reopen them here.</p>
          <div className="oxos-desklist">
            {closed
              .filter((c) => Date.now() - c.closedAt < 3600000)
              .map((c) => (
                <div key={c.id} className="oxos-desk">
                  <span className="oxos-desk__name">{c.title}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="oxos-btn oxos-btn--ghost"
                      onClick={() => {
                        if (c.kind === "app" && c.appKey) {
                          const a = appByKey.get(c.appKey);
                          if (a) {
                            if (c.hrefOverride) openAppWithHref(a, c.hrefOverride);
                            else openApp(a);
                          }
                        } else {
                          openBuiltin(c.kind as OsWindowKind, c.title);
                        }
                        setClosed((prev) => prev.filter((x) => x.id !== c.id));
                      }}
                    >
                      Reopen
                    </button>
                    <button
                      type="button"
                      className="oxos-btn oxos-btn--ghost"
                      onClick={() => setClosed((prev) => prev.filter((x) => x.id !== c.id))}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            {!closed.some((c) => Date.now() - c.closedAt < 3600000) && <p className="oxos-hint">Nothing closed recently.</p>}
          </div>
          {closed.length > 0 && (
            <button type="button" className="oxos-btn oxos-btn--ghost" onClick={() => setClosed([])}>
              Clear closed list
            </button>
          )}
          <h3 className="oxos-h3">Saved layouts</h3>
          <p className="oxos-hint">Snapshots of your open windows — restore them on any desktop.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="oxos-input"
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              placeholder="Layout name"
            />
            <button
              type="button"
              className="oxos-btn"
              disabled={!layoutName.trim() || !ws.windows.length}
              onClick={() => {
                setLayouts((prev) => [
                  {
                    id: `layout-${Date.now().toString(36)}`,
                    name: layoutName.trim(),
                    wins: ws.windows.filter((w) => !w.minimized).map((w) => ({ kind: w.kind, appKey: w.appKey, title: w.title, hrefOverride: w.hrefOverride })),
                  },
                  ...prev,
                ]);
                setLayoutName("");
              }}
            >
              Save current
            </button>
          </div>
          <div className="oxos-desklist">
            {layouts.map((l) => (
              <div key={l.id} className="oxos-desk">
                <span className="oxos-desk__name">{l.name}</span>
                <span className="oxos-desk__count">{l.wins.length} window{l.wins.length === 1 ? "" : "s"}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="oxos-btn oxos-btn--ghost"
                    onClick={() => {
                      for (const win of l.wins) {
                        if (win.kind === "app" && win.appKey) {
                          const a = appByKey.get(win.appKey);
                          if (a) {
                            if (win.hrefOverride) openAppWithHref(a, win.hrefOverride);
                            else openApp(a);
                          }
                        } else {
                          openBuiltin(win.kind as OsWindowKind, win.title);
                        }
                      }
                      setDeskOpen(false);
                    }}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    className="oxos-btn oxos-btn--ghost"
                    onClick={() => setLayouts((prev) => prev.filter((x) => x.id !== l.id))}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {!layouts.length && <p className="oxos-hint">No saved layouts yet.</p>}
          </div>
        </div>
      )}

      {/* Notification Center + price alerts */}
      {notifOpen && (
        <div className="oxos-panel oxos-panel--right">
          <div className="oxos-panel__head">
            <span>Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}</span>
            <button type="button" onClick={() => setNotifOpen(false)}>
              ✕
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="oxos-btn oxos-btn--ghost"
              onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
            >
              Mark all read
            </button>
            <button type="button" className="oxos-btn oxos-btn--ghost" onClick={() => setNotifications([])}>
              Clear
            </button>
          </div>
          <div className="oxos-notif__list">
            {notifications.length === 0 && (
              <p className="oxos-hint">Nothing yet. Price alerts and system notices land here.</p>
            )}
            {notifications.map((n) => (
              <div key={n.id} className={`oxos-notif${n.read ? " is-read" : ""}`}>
                <span className="oxos-notif__title">{n.title}</span>
                <span className="oxos-notif__body">{n.body}</span>
                <span className="oxos-notif__time">
                  {new Date(n.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
          <h3 className="oxos-h3">Price alerts</h3>
          <div className="oxos-alert__form">
            <input
              className="oxos-input"
              value={alertQ}
              placeholder="Search a token…"
              onChange={async (e) => {
                const v = e.target.value;
                setAlertQ(v);
                setAlertRows(v.trim().length >= 2 ? await searchTokens(v) : []);
              }}
            />
            {alertRows.map((r) => (
              <button
                key={r.mint}
                type="button"
                className="oxos-row"
                onClick={() => {
                  setAlertPicked(r);
                  setAlertRows([]);
                  setAlertQ(r.symbol);
                }}
              >
                <span className="oxos-row__meta">
                  <span className="oxos-row__title">{r.symbol}</span>
                  <span className="oxos-row__sub">
                    {r.name}
                    {r.priceUsd != null
                      ? ` · $${r.priceUsd < 0.01 ? r.priceUsd.toFixed(6) : r.priceUsd.toFixed(4)}`
                      : ""}
                  </span>
                </span>
              </button>
            ))}
            {alertPicked && (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    className="oxos-input"
                    value={alertDir}
                    onChange={(e) => setAlertDir(e.target.value as "above" | "below")}
                  >
                    <option value="above">Price goes above</option>
                    <option value="below">Price goes below</option>
                  </select>
                  <input
                    className="oxos-input"
                    type="number"
                    step="any"
                    value={alertTarget}
                    onChange={(e) => setAlertTarget(e.target.value)}
                    placeholder="Target $"
                  />
                </div>
                <button
                  type="button"
                  className="oxos-btn"
                  disabled={!alertTarget}
                  onClick={() => {
                    const target = Number(alertTarget);
                    if (!Number.isFinite(target)) return;
                    setAlerts((prev) => [
                      ...prev,
                      {
                        id: `al-${Date.now().toString(36)}`,
                        mint: alertPicked.mint,
                        symbol: alertPicked.symbol,
                        target,
                        direction: alertDir,
                        createdAt: Date.now(),
                        triggered: false,
                      },
                    ]);
                    pushNotification("Alert armed", `${alertPicked.symbol} ${alertDir} $${target}`, "alert");
                    setAlertPicked(null);
                    setAlertQ("");
                    setAlertTarget("");
                  }}
                >
                  Arm alert
                </button>
              </>
            )}
          </div>
          <div className="oxos-notif__list">
            {alerts.map((a) => (
              <div key={a.id} className="oxos-notif">
                <span className="oxos-notif__title">
                  {a.symbol} {a.direction === "above" ? "↑" : "↓"} ${a.target}
                </span>
                <span className="oxos-notif__body">{a.triggered ? "Triggered ✓" : "Armed — checking every 30s"}</span>
                <button
                  type="button"
                  className="oxos-btn oxos-btn--ghost"
                  onClick={() => setAlerts((prev) => prev.filter((x) => x.id !== a.id))}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Command bar */}
      {cmdOpen && (
        <div className="oxos-cmd">
          <input
            className="oxos-input"
            autoFocus
            value={cmdQ}
            onChange={(e) => setCmdQ(e.target.value)}
            placeholder="Type a command… try 'lock', 'store', or 'token bonk'"
          />
          <div className="oxos-cmd__list">
            {cmdTokenMode &&
              cmdTokens.map((t) => (
                <button
                  key={t.mint}
                  type="button"
                  className="oxos-start__row"
                  onClick={() => {
                    const dex = allApps.find((a) => a.key === "dex");
                    if (dex) openAppWithHref(dex, `/ORBITX_DEX?mint=${t.mint}`);
                    else openBrowserTab(`https://dexscreener.com/solana/${t.mint}`, t.symbol);
                  }}
                >
                  <span className="oxos-start__rowmeta">
                    <span>
                      {t.symbol} — open in DEX
                    </span>
                    <span>
                      {t.name}
                      {t.priceUsd != null
                        ? ` · $${t.priceUsd < 0.01 ? t.priceUsd.toFixed(6) : t.priceUsd.toFixed(4)}`
                        : ""}
                    </span>
                  </span>
                </button>
              ))}
            {cmdTokenMode && cmdQTrim.slice(6).trim().length >= 2 && cmdTokens.length === 0 && (
              <p className="oxos-hint">Searching tokens…</p>
            )}
            {!cmdTokenMode && calcResult != null && (
              <button
                type="button"
                className="oxos-start__row"
                onClick={() => {
                  try {
                    void navigator.clipboard?.writeText(String(calcResult));
                  } catch {
                    /* clipboard unavailable: result is still shown */
                  }
                  setCmdOpen(false);
                }}
              >
                <span className="oxos-start__rowmeta">
                  <span>
                    {cmdQTrim} = {calcResult}
                  </span>
                  <span>Calculator — tap to copy</span>
                </span>
              </button>
            )}
            {!cmdTokenMode &&
              cmdFiltered.map((c) => (
                <button key={c.id} type="button" className="oxos-start__row" onClick={c.run}>
                  <span className="oxos-start__rowmeta">
                    <span>{c.label}</span>
                    <span>{c.hint}</span>
                  </span>
                </button>
              ))}
            {!cmdTokenMode &&
              cmdAppHits.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  className="oxos-start__row"
                  onClick={() => {
                    setCmdOpen(false);
                    openApp(a);
                  }}
                >
                  {<AppMark app={a} className="oxos-start__rowmark" />}
                  <span className="oxos-start__rowmeta">
                    <span>{a.name}</span>
                    <span>{a.caption}</span>
                  </span>
                </button>
              ))}
            {!cmdTokenMode && !cmdFiltered.length && !cmdAppHits.length && (
              <p className="oxos-hint">No commands match that.</p>
            )}
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="oxos-toasts">
        {toasts.map((id) => {
          const n = notifications.find((x) => x.id === id);
          if (!n) return null;
          return (
            <button
              key={id}
              type="button"
              className="oxos-toast"
              onClick={() => {
                setToasts((prev) => prev.filter((t) => t !== id));
                setNotifOpen(true);
              }}
            >
              <span className="oxos-toast__title">{n.title}</span>
              <span className="oxos-toast__body">{n.body}</span>
            </button>
          );
        })}
      </div>

      {/* Screen dimmer (Control Center slider; never blocks clicks) */}
      {dim > 0 && <div className="oxos-dim" style={{ opacity: dim / 100 }} aria-hidden />}

      {/* Lock screen */}
      {locked && (
        <div className="oxos-lock">
          <div className="oxos-lock__card">
            <div className="oxos-lock__mark">◈</div>
            <h2>OrbitX OS</h2>
            <p>Enter your device PIN to unlock.</p>
            <input
              className="oxos-input"
              type="password"
              inputMode="numeric"
              autoFocus
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="PIN"
              onKeyDown={(e) => {
                if (e.key === "Enter") void unlockAttempt();
              }}
            />
            {pinError && <p className="oxos-hint" style={{ color: "#f87171" }}>{pinError}</p>}
            <button type="button" className="oxos-btn" onClick={() => void unlockAttempt()}>
              Unlock
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
