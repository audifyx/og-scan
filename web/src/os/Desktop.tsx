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
import {
  OS_ACCENTS,
  OS_WALLPAPERS,
  clearIconPositions,
  loadIconPositions,
  loadOsFolders,
  loadOsSettings,
  saveIconPositions,
  saveOsFolders,
  saveOsSettings,
  type IconPos,
  type OsSettings,
} from "./osStore";
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

export default function Desktop(props: DesktopProps) {
  const { apps, desktopApps, gates } = props;
  const [ws, dispatch] = useReducer(osWindowsReducer, EMPTY_OS_WINDOWS);
  const [startOpen, setStartOpen] = useState(false);
  const [startQ, setStartQ] = useState("");
  const [appsQ, setAppsQ] = useState("");
  const [settingsNav, setSettingsNav] = useState<"system" | "personalization" | "account" | "wallet" | "about">("system");
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

  const appByKey = useMemo(() => {
    const m = new Map<string, PlatformApp>();
    for (const a of apps) m.set(a.key, a);
    return m;
  }, [apps]);

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
    dispatch({ type: "open", window: { id: kind, kind, title, x: r.x, y: r.y, w: r.w, h: r.h } });
    if (r.narrow) dispatch({ type: "toggle-maximize", id: kind });
    setActiveWin(kind);
    setStartOpen(false);
  };

  const openApp = (app: PlatformApp) => {
    if (app.external) {
      window.open(app.href, "_blank", "noopener");
      return;
    }
    const id = `app:${app.key}`;
    const r = centerRect();
    dispatch({ type: "open", window: { id, kind: "app", appKey: app.key, title: app.name, x: r.x, y: r.y, w: r.w, h: r.h } });
    if (r.narrow) dispatch({ type: "toggle-maximize", id });
    setActiveWin(id);
    setStartOpen(false);
  };

  const closeWin = (id: string) => {
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
    if (d?.type !== "icon") return;
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
    if (!q) return apps;
    return apps.filter((a) => `${a.name} ${a.caption}`.toLowerCase().includes(q));
  }, [apps, startQ]);

  const appsWinList = useMemo(() => {
    const q = appsQ.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter((a) => `${a.name} ${a.caption}`.toLowerCase().includes(q));
  }, [apps, appsQ]);

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
    // App window: same-origin route inside a frame.
    const app = w.appKey ? appByKey.get(w.appKey) : undefined;
    if (!app) return <p className="oxos-hint">App not found.</p>;
    return <iframe className="oxos-frame" title={app.name} src={app.href} />;
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
                    onClick={() => set({ accent: a.hex })}
                  />
                ))}
              </div>
              <button type="button" className="oxos-btn oxos-btn--ghost" onClick={props.onOpenTheme}>
                Open Atmosphere theme
              </button>
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
  const visibleDesktopApps = desktopApps.filter((a) => !foldered.has(a.key));
  const unplaced = visibleDesktopApps.filter((a) => !iconPos[a.key]);
  const placed = visibleDesktopApps.filter((a) => iconPos[a.key]);
  const unplacedFolders = folders.filter((f) => !iconPos[`folder:${f.id}`]);
  const placedFolders = folders.filter((f) => iconPos[`folder:${f.id}`]);

  return (
    <div
      ref={rootRef}
      className={`oxos${settings.reduceMotion ? " oxos--reduced" : ""}`}
      style={{ "--os-accent": settings.accent } as React.CSSProperties}
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

      {/* Folder panel — iOS-style folder view */}
      {openFolderId &&
        (() => {
          const folder = folders.find((f) => f.id === openFolderId);
          if (!folder) return null;
          const members = folder.appKeys.map((k) => appByKey.get(k)).filter(Boolean) as PlatformApp[];
          return (
            <div className="oxos-folderpanel">
              <div className="oxos-folderpanel__backdrop" onClick={() => setOpenFolderId(null)} />
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

      {/* Windows */}
      {ws.windows.map((w) => {
        const isActive = activeWin === w.id;
        const app = w.appKey ? appByKey.get(w.appKey) : undefined;
        return (
          <section
            key={w.id}
            className={`oxos-window${isActive ? " is-active" : ""}${w.maximized ? " is-max" : ""}`}
            style={
              w.maximized
                ? { zIndex: w.z }
                : { left: w.x, top: w.y, width: w.w, height: w.h, zIndex: w.z }
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
        <span className="oxos-taskbar__sep" />
        {gates.map((a) => (
          <button key={a.key} type="button" className="oxos-taskbar__btn" title={a.name} onClick={() => openApp(a)}>
            {<AppMark app={a} className="oxos-taskbar__mark" />}
          </button>
        ))}
        <span className="oxos-taskbar__sep" />
        {ws.windows.map((w) => (
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
          <span className="oxos-tray__clock">
            {clock} · {dateStr}
          </span>
        </span>
      </footer>
    </div>
  );
}
