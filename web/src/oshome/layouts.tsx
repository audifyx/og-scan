import { useEffect, useMemo, useRef, useState } from "react";
import {
  BatteryMedium,
  ChevronRight,
  LayoutGrid,
  Search,
  Settings as SettingsIcon,
  Wifi,
} from "lucide-react";
import { APP_CATALOG, APP_CATEGORIES, type AppCategory, type OsHomeApp } from "./appsCatalog";
import { OS_LAYOUT_KEY } from "../themes/themes";

/* ------------------------------------------------------------------ */
/* ordering (persisted drag layout)                                    */
/* ------------------------------------------------------------------ */

export function loadOrder(): string[] {
  try {
    const raw = localStorage.getItem(OS_LAYOUT_KEY);
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function useOrderedApps(): [OsHomeApp[], (ids: string[]) => void] {
  const [order, setOrder] = useState<string[]>(loadOrder);
  const apps = useMemo(() => {
    const map = new Map(APP_CATALOG.map((a) => [a.id, a]));
    const seen = new Set<string>();
    const out: OsHomeApp[] = [];
    for (const id of order) {
      const a = map.get(id);
      if (a && !seen.has(id)) {
        out.push(a);
        seen.add(id);
      }
    }
    for (const a of APP_CATALOG) if (!seen.has(a.id)) out.push(a);
    return out;
  }, [order]);
  const setOrderPersist = (ids: string[]) => {
    setOrder(ids);
    try {
      localStorage.setItem(OS_LAYOUT_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  };
  return [apps, setOrderPersist];
}

export function useIsMobile(): boolean {
  const [m, setM] = useState(() => window.matchMedia("(max-width: 720px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const fn = () => setM(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return m;
}

/* ------------------------------------------------------------------ */
/* shared bits                                                         */
/* ------------------------------------------------------------------ */

export interface LayoutProps {
  apps: OsHomeApp[];
  onLaunch: (a: OsHomeApp) => void;
  onOpenLauncher: () => void;
  onOpenSettings: () => void;
  onReorder: (ids: string[]) => void;
  isMobile: boolean;
}

export function Clock({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const date = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  if (compact)
    return (
      <span style={{ fontFamily: "var(--dt-font-display)", fontWeight: 700, fontSize: 13 }}>
        {time}
      </span>
    );
  return (
    <div className="osh-clock">
      <div className="osh-clock-time">{time}</div>
      <div className="osh-clock-date">{date}</div>
    </div>
  );
}

export function AppTile({ app, onLaunch }: { app: OsHomeApp; onLaunch: (a: OsHomeApp) => void }) {
  const Icon = app.icon;
  return (
    <button className="osh-icon" onClick={() => onLaunch(app)} title={app.blurb} aria-label={app.name}>
      {app.badge && <span className="osh-badge">{app.badge}</span>}
      <span className="osh-icon-tile">
        <Icon className="osh-icon-glyph" style={{ color: app.accent }} />
      </span>
      <span className="osh-icon-label">{app.name}</span>
    </button>
  );
}

/** Pointer-based drag reorder (mouse: immediate · touch: long-press). */
export function SortableGrid({
  apps,
  orderIds,
  onLaunch,
  onReorder,
  editing,
  setEditing,
  className = "osh-grid",
  style,
}: {
  apps: OsHomeApp[];
  /** full persisted order — reorders apply here so filtered views can't lose apps */
  orderIds: string[];
  onLaunch: (a: OsHomeApp) => void;
  onReorder: (ids: string[]) => void;
  editing: boolean;
  setEditing: (v: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const st = useRef<{
    id: string;
    sx: number;
    sy: number;
    active: boolean;
    timer?: number;
  } | null>(null);
  const suppressClick = useRef(false);

  const begin = (id: string) => {
    if (st.current) st.current.active = true;
    setDragId(id);
  };

  const down = (id: string) => (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const cur = { id, sx: e.clientX, sy: e.clientY, active: false, timer: undefined as number | undefined };
    st.current = cur;
    if (e.pointerType !== "mouse") {
      cur.timer = window.setTimeout(() => {
        setEditing(true);
        begin(id);
      }, 450);
    }
  };
  const move = (e: React.PointerEvent) => {
    const cur = st.current;
    if (!cur || cur.active) return;
    if (Math.hypot(e.clientX - cur.sx, e.clientY - cur.sy) > 9) {
      if (cur.timer) window.clearTimeout(cur.timer);
      if (e.pointerType === "mouse" || editing) begin(cur.id);
    }
  };
  const up = () => {
    const cur = st.current;
    st.current = null;
    if (cur?.timer) window.clearTimeout(cur.timer);
    if (cur?.active) suppressClick.current = true;
    setDragId(null);
    setOverId(null);
  };
  const enter = (targetId: string) => () => {
    const cur = st.current;
    if (!cur?.active || cur.id === targetId) return;
    setOverId(targetId);
    const ids = orderIds.slice();
    const from = ids.indexOf(cur.id);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    onReorder(ids);
  };
  const clickCap = (app: OsHomeApp) => (e: React.MouseEvent) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (editing) return; // tap-while-editing does nothing
    onLaunch(app);
  };

  return (
    <div
      className={className}
      data-editing={editing || undefined}
      style={{ ...style, touchAction: dragId ? "none" : undefined }}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {apps.map((app) => {
        const Icon = app.icon;
        return (
          <div
            key={app.id}
            style={{ display: "flex", justifyContent: "center" }}
            onPointerDown={down(app.id)}
            onPointerEnter={enter(app.id)}
          >
            <button
              className="osh-icon"
              data-dragging={dragId === app.id || undefined}
              data-drop-target={overId === app.id || undefined}
              onClickCapture={clickCap(app)}
              title={app.blurb}
              aria-label={app.name}
            >
              {app.badge && <span className="osh-badge">{app.badge}</span>}
              <span className="osh-icon-tile">
                <Icon className="osh-icon-glyph" style={{ color: app.accent }} />
              </span>
              <span className="osh-icon-label">{app.name}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function Launcher({
  open,
  onClose,
  onLaunch,
}: {
  open: boolean;
  onClose: () => void;
  onLaunch: (a: OsHomeApp) => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
    }
  }, [open ]);
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return APP_CATALOG;
    return APP_CATALOG.filter((a) =>
      `${a.name} ${a.blurb} ${a.category}`.toLowerCase().includes(needle)
    );
  }, [q]);
  useEffect(() => setActive(0), [q ]);
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);
  if (!open) return null;
  const go = (a: OsHomeApp) => {
    onClose();
    onLaunch(a);
  };
  return (
    <div className="osh-launcher" onClick={onClose} role="dialog" aria-label="App launcher">
      <div className="osh-launcher-panel" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="osh-launcher-input"
          placeholder="Search apps, tools, worlds…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[active]) go(results[active]);
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            }
          }}
        />
        <div className="osh-launcher-results">
          {results.map((a, i) => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                className="osh-launcher-hit"
                data-active={i === active || undefined}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(a)}
              >
                <span className="osh-icon-tile">
                  <Icon className="osh-icon-glyph" style={{ color: a.accent }} />
                </span>
                <span>
                  <b style={{ fontSize: 13 }}>{a.name}</b>
                  <small>{a.blurb}</small>
                </span>
              </button>
            );
          })}
          {results.length === 0 && (
            <div className="osh-launcher-empty">No apps match “{q}”.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CategoryBar({
  cat,
  setCat,
}: {
  cat: AppCategory | "all";
  setCat: (c: AppCategory | "all") => void;
}) {
  return (
    <div className="osh-catbar">
      <button data-active={cat === "all" || undefined} onClick={() => setCat("all")}>
        All
      </button>
      {APP_CATEGORIES.map((c) => (
        <button key={c.id} data-active={cat === c.id || undefined} onClick={() => setCat(c.id)}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

function useCategoryFilter(apps: OsHomeApp[]) {
  const [cat, setCat] = useState<AppCategory | "all">("all");
  const filtered = useMemo(
    () => (cat === "all" ? apps : apps.filter((a) => a.category === cat)),
    [apps, cat]
  );
  return { cat, setCat, filtered };
}

function Dock({
  apps,
  onLaunch,
  onOpenLauncher,
  onOpenSettings,
}: Pick<LayoutProps, "apps" | "onLaunch" | "onOpenLauncher" | "onOpenSettings">) {
  const pinned = apps.slice(0, 5);
  return (
    <div className="osh-dock">
      <button className="osh-dock-item" onClick={onOpenLauncher} title="App launcher" aria-label="App launcher">
        <LayoutGrid style={{ width: 22, height: 22 }} />
      </button>
      <span className="osh-dock-sep" />
      {pinned.map((a) => {
        const Icon = a.icon;
        return (
          <button key={a.id} className="osh-dock-item" onClick={() => onLaunch(a)} title={a.name} aria-label={a.name}>
            <Icon style={{ width: 24, height: 24, color: a.accent }} />
          </button>
        );
      })}
      <span className="osh-dock-sep" />
      <button className="osh-dock-item" onClick={onOpenSettings} title="Themes & settings" aria-label="Themes and settings">
        <SettingsIcon style={{ width: 22, height: 22 }} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* grid (iOS / Android)                                                */
/* ------------------------------------------------------------------ */

export function GridLayout(p: LayoutProps) {
  const { cat, setCat, filtered } = useCategoryFilter(p.apps);
  const [editing, setEditing] = useState(false);
  return (
    <>
      <div className="osh-topbar" style={{ background: "transparent", border: "none", justifyContent: "center" }}>
        <Clock compact />
        <span className="osh-hint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Wifi style={{ width: 13, height: 13 }} />
          <BatteryMedium style={{ width: 16, height: 16 }} />
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "center", padding: "6px 0 2px" }}>
        <button className="osh-search-trigger" onClick={p.onOpenLauncher}>
          <Search style={{ width: 15, height: 15 }} /> Search apps <kbd>⌘K</kbd>
        </button>
      </div>
      <CategoryBar cat={cat} setCat={setCat} />
      <SortableGrid
        apps={filtered}
        orderIds={p.apps.map((a) => a.id)}
        onLaunch={p.onLaunch}
        onReorder={p.onReorder}
        editing={editing}
        setEditing={setEditing}
      />
      {editing && (
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 8 }}>
          <button className="osh-picker-reset" onClick={() => setEditing(false)}>Done</button>
        </div>
      )}
      <Dock apps={p.apps} onLaunch={p.onLaunch} onOpenLauncher={p.onOpenLauncher} onOpenSettings={p.onOpenSettings} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* taskbar (Windows / Linux)                                           */
/* ------------------------------------------------------------------ */

export function TaskbarLayout(p: LayoutProps & { flavor: "windows" | "linux" }) {
  const { cat, setCat, filtered } = useCategoryFilter(p.apps);
  const [editing, setEditing] = useState(false);
  const linux = p.flavor === "linux";
  return (
    <>
      {linux && (
        <div className="osh-taskbar" style={{ borderBottom: "1px solid var(--dt-line)", borderTop: "none" }}>
          <button className="osh-start-btn" onClick={p.onOpenLauncher}>● Activities</button>
          <span className="spacer" style={{ flex: 1 }} />
          <Clock compact />
          <span className="spacer" style={{ flex: 1 }} />
          <span className="osh-tray"><Wifi style={{ width: 14, height: 14 }} /></span>
        </div>
      )}
      <div style={{ padding: "10px 0 2px" }}>
        <CategoryBar cat={cat} setCat={setCat} />
      </div>
      <SortableGrid
        apps={filtered}
        orderIds={p.apps.map((a) => a.id)}
        onLaunch={p.onLaunch}
        onReorder={p.onReorder}
        editing={editing}
        setEditing={setEditing}
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))" }}
      />
      {editing && (
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 8 }}>
          <button className="osh-picker-reset" onClick={() => setEditing(false)}>Done</button>
        </div>
      )}
      <div className="osh-taskbar">
        {!linux ? (
          <button className="osh-start-btn" onClick={p.onOpenLauncher}>
            <LayoutGrid style={{ width: 16, height: 16 }} /> Start
          </button>
        ) : (
          <button className="osh-start-btn" onClick={p.onOpenLauncher} title="App launcher">
            <LayoutGrid style={{ width: 16, height: 16 }} />
          </button>
        )}
        {p.apps.slice(0, 6).map((a) => {
          const Icon = a.icon;
          return (
            <button key={a.id} className="osh-taskbar-item" data-active={undefined} onClick={() => p.onLaunch(a)} title={a.name}>
              <Icon style={{ width: 17, height: 17, color: a.accent }} />
              {!p.isMobile && <span>{a.name}</span>}
            </button>
          );
        })}
        <span className="spacer" style={{ flex: 1 }} />
        <button className="osh-taskbar-item" onClick={p.onOpenSettings} title="Themes & settings">
          <SettingsIcon style={{ width: 16, height: 16 }} />
        </button>
        <span className="osh-tray"><Clock compact /></span>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* menubar (macOS)                                                     */
/* ------------------------------------------------------------------ */

export function MenubarLayout(p: LayoutProps) {
  const { cat, setCat, filtered } = useCategoryFilter(p.apps);
  const [editing, setEditing] = useState(false);
  return (
    <>
      <div className="osh-topbar osh-menubar">
        <span className="osh-brandmark"><span className="dot" /> OrbitX</span>
        <button className="osh-menu-item" onClick={p.onOpenLauncher}><b>Apps</b></button>
        <button className="osh-menu-item" onClick={p.onOpenSettings}>Themes</button>
        <span className="spacer" />
        <span className="osh-tray"><Wifi style={{ width: 13, height: 13 }} /><Clock compact /></span>
      </div>
      <div style={{ padding: "10px 0 2px" }}>
        <CategoryBar cat={cat} setCat={setCat} />
      </div>
      <SortableGrid apps={filtered} orderIds={p.apps.map((a) => a.id)} onLaunch={p.onLaunch} onReorder={p.onReorder} editing={editing} setEditing={setEditing} />
      {editing && (
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 8 }}>
          <button className="osh-picker-reset" onClick={() => setEditing(false)}>Done</button>
        </div>
      )}
      <Dock apps={p.apps} onLaunch={p.onLaunch} onOpenLauncher={p.onOpenLauncher} onOpenSettings={p.onOpenSettings} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* XMB (PS4)                                                           */
/* ------------------------------------------------------------------ */

const XMB_CATS: { id: AppCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  ...APP_CATEGORIES,
];

export function XmbLayout(p: LayoutProps) {
  const [cat, setCat] = useState<AppCategory | "all">("trade");
  const railRef = useRef<HTMLDivElement>(null);
  const apps = useMemo(
    () => (cat === "all" ? p.apps : p.apps.filter((a) => a.category === cat)),
    [p.apps, cat]
  );
  useEffect(() => {
    const el = railRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [cat]);
  return (
    <div className="osh-xmb">
      <div style={{ padding: "0 clamp(14px,6vw,90px)" }}>
        <Clock />
      </div>
      <div className="osh-xmb-rail" ref={railRef}>
        {XMB_CATS.map((c) => {
          const sample = c.id === "all" ? p.apps[0] : p.apps.find((a) => a.category === c.id) ?? p.apps[0];
          const Icon = sample.icon;
          return (
            <button
              key={c.id}
              className="osh-xmb-cat osh-icon"
              data-active={cat === c.id || undefined}
              onClick={() => setCat(c.id)}
              aria-label={c.label}
            >
              <span className="osh-icon-tile" style={{ width: 76, height: 76 }}>
                <Icon className="osh-icon-glyph" style={{ color: sample.accent, width: 34, height: 34 }} />
              </span>
              <span className="osh-icon-label" style={{ fontSize: 13 }}>{c.label}</span>
            </button>
          );
        })}
      </div>
      <div className="osh-xmb-apps">
        {apps.map((a) => {
          const Icon = a.icon;
          return (
            <button key={a.id} className="osh-xmb-item" onClick={() => p.onLaunch(a)}>
              <span className="osh-icon-tile">
                <Icon className="osh-icon-glyph" style={{ color: a.accent }} />
              </span>
              <span>
                <b style={{ fontSize: 15 }}>{a.name}</b>
                <small>{a.blurb}</small>
              </span>
              <ChevronRight style={{ marginLeft: "auto", width: 18, height: 18, color: "var(--dt-faint)" }} />
            </button>
          );
        })}
        {apps.length === 0 && <div className="osh-empty">Nothing here yet.</div>}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 10, paddingBottom: 18 }}>
        <button className="osh-search-trigger" onClick={p.onOpenLauncher}>
          <Search style={{ width: 15, height: 15 }} /> Search <kbd>⌘K</kbd>
        </button>
        <button className="osh-search-trigger" onClick={p.onOpenSettings} style={{ minWidth: 0 }}>
          <SettingsIcon style={{ width: 15, height: 15 }} /> Themes
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* blades (Xbox 360)                                                   */
/* ------------------------------------------------------------------ */

export function BladesLayout(p: LayoutProps) {
  const [cat, setCat] = useState<AppCategory | "all">("all");
  const apps = useMemo(
    () => (cat === "all" ? p.apps : p.apps.filter((a) => a.category === cat)),
    [p.apps, cat]
  );
  return (
    <>
      <div className="osh-topbar">
        <span className="osh-brandmark"><span className="dot" /> ORBITX 360</span>
        <span className="spacer" />
        <Clock compact />
      </div>
      <div className="osh-blades">
        <div className="osh-blade-col">
          {XMB_CATS.map((c) => (
            <button key={c.id} className="osh-blade" data-active={cat === c.id || undefined} onClick={() => setCat(c.id)}>
              {c.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button className="osh-blade" onClick={p.onOpenLauncher}><Search style={{ width: 14, height: 14, display: "inline", verticalAlign: -2 }} /> Search</button>
          <button className="osh-blade" onClick={p.onOpenSettings}><SettingsIcon style={{ width: 14, height: 14, display: "inline", verticalAlign: -2 }} /> Themes</button>
        </div>
        <div className="osh-blade-panel">
          {apps.map((a) => (
            <AppTile key={a.id} app={a} onLaunch={p.onLaunch} />
          ))}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* channels (Wii)                                                      */
/* ------------------------------------------------------------------ */

export function ChannelsLayout(p: LayoutProps) {
  const { cat, setCat, filtered } = useCategoryFilter(p.apps);
  return (
    <div className="osh-channels-wrap">
      <div className="osh-wii-topbar">
        <span className="osh-brandmark">OrbitX Channels</span>
        <Clock compact />
      </div>
      <div style={{ padding: "8px 0 0" }}>
        <CategoryBar cat={cat} setCat={setCat} />
      </div>
      <div className="osh-channels">
        {filtered.map((a) => {
          const Icon = a.icon;
          return (
            <button key={a.id} className="osh-channel osh-icon" onClick={() => p.onLaunch(a)} title={a.blurb}>
              {a.badge && <span className="osh-badge">{a.badge}</span>}
              <Icon className="osh-icon-glyph" style={{ color: a.accent }} />
              <span className="osh-icon-label">{a.name}</span>
            </button>
          );
        })}
      </div>
      <div className="osh-wii-bottombar">
        <button className="osh-wii-roundbtn osh-dock-item" onClick={p.onOpenLauncher} title="Search" aria-label="Search">
          <Search style={{ width: 24, height: 24 }} />
        </button>
        <span className="osh-hint">pick a channel!</span>
        <button className="osh-wii-roundbtn osh-dock-item" onClick={p.onOpenSettings} title="Themes" aria-label="Themes">
          <SettingsIcon style={{ width: 24, height: 24 }} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* dual screen (3DS)                                                    */
/* ------------------------------------------------------------------ */

export function DualLayout(p: LayoutProps) {
  const [selId, setSelId] = useState<string>(p.apps[0]?.id ?? "");
  const sel = p.apps.find((a) => a.id === selId) ?? p.apps[0];
  const SelIcon = sel?.icon ?? LayoutGrid;
  return (
    <div className="osh-dual">
      <div className="osh-screen osh-screen-top">
        {sel && (
          <div className="osh-dual-showcase">
            <span className="osh-icon-tile">
              <SelIcon className="osh-icon-glyph" style={{ color: sel.accent }} />
            </span>
            <div style={{ minWidth: 0 }}>
              <h2>{sel.name}</h2>
              <p>{sel.blurb} · {APP_CATEGORIES.find((c) => c.id === sel.category)?.label}</p>
              <button className="osh-dual-launch" onClick={() => p.onLaunch(sel)}>LAUNCH ▸</button>
            </div>
          </div>
        )}
      </div>
      <div className="osh-screen osh-screen-bottom">
        <div className="osh-dual-grid">
          {p.apps.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                className="osh-icon"
                data-selected={a.id === selId || undefined}
                onClick={() => setSelId(a.id)}
                onDoubleClick={() => p.onLaunch(a)}
                title={`${a.blurb} — tap to preview, double-tap to launch`}
                aria-label={a.name}
              >
                <span className="osh-icon-tile">
                  <Icon className="osh-icon-glyph" style={{ color: a.accent }} />
                </span>
                <span className="osh-icon-label">{a.name}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10 }}>
          <span className="osh-hint">TAP = PREVIEW · DOUBLE-TAP = LAUNCH</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="osh-x-btn" onClick={p.onOpenLauncher} title="Search" aria-label="Search"><Search style={{ width: 15, height: 15 }} /></button>
            <button className="osh-x-btn" onClick={p.onOpenSettings} title="Themes" aria-label="Themes"><SettingsIcon style={{ width: 15, height: 15 }} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* pixel list (Game Boy)                                                */
/* ------------------------------------------------------------------ */

export function PixelLayout(p: LayoutProps) {
  return (
    <>
      <div className="osh-pixel-head">
        <span style={{ fontSize: 10 }}>DOT MATRIX</span>
        <Clock compact />
        <span className="osh-battery"><i /> 87%</span>
      </div>
      <div className="osh-pixel-wrap">
        {p.apps.map((a) => {
          const Icon = a.icon;
          return (
            <button key={a.id} className="osh-pixel-row" onClick={() => p.onLaunch(a)}>
              <span className="osh-icon-tile">
                <Icon className="osh-icon-glyph" style={{ color: "currentColor" }} />
              </span>
              <span>
                <b style={{ fontSize: 11 }}>{a.name.toUpperCase()}</b>
                <small>{a.blurb.toUpperCase()}</small>
              </span>
              <ChevronRight style={{ marginLeft: "auto", width: 14, height: 14 }} />
            </button>
          );
        })}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: "14px 0" }}>
          <button className="osh-pixel-row" style={{ width: "auto" }} onClick={p.onOpenLauncher}>SEARCH</button>
          <button className="osh-pixel-row" style={{ width: "auto" }} onClick={p.onOpenSettings}>THEMES</button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* terminal (CRT)                                                      */
/* ------------------------------------------------------------------ */

export function TerminalLayout(p: LayoutProps) {
  return (
    <div className="osh-terminal">
      <div style={{ marginBottom: 14, color: "var(--dt-accent-2)" }}>
        ORBITX-OS v3.0 — PHOSPHOR EDITION<br />
        {p.apps.length} PROGRAMS LOADED. TYPE A NUMBER, CLICK TO EXECUTE.
      </div>
      {p.apps.map((a, i) => (
        <button key={a.id} className="osh-term-line" onClick={() => p.onLaunch(a)}>
          <span className="idx">[{String(i + 1).padStart(2, "0")}]</span>
          <span className="osh-term-prompt">❯</span>
          <span className="cmd">launch {a.id}</span>
          <span className="blurb">— {a.name} · {a.blurb}</span>
        </button>
      ))}
      <div style={{ marginTop: 16, display: "flex", gap: 14, alignItems: "center" }}>
        <button className="osh-term-line" style={{ width: "auto", border: "1px solid var(--dt-line-strong)", padding: "8px 16px" }} onClick={p.onOpenLauncher}>
          <span className="osh-term-prompt">❯</span> search
        </button>
        <button className="osh-term-line" style={{ width: "auto", border: "1px solid var(--dt-line-strong)", padding: "8px 16px" }} onClick={p.onOpenSettings}>
          <span className="osh-term-prompt">❯</span> themes
        </button>
        <span className="osh-cursor" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* orbit (OrbitX native)                                               */
/* ------------------------------------------------------------------ */

export function OrbitLayout(p: LayoutProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const minDim = Math.min(size.w, size.h);
  const r1 = minDim * 0.30;
  const r2 = minDim * 0.44;
  const inner = p.apps.slice(0, 14);
  const outer = p.apps.slice(14);
  const node = (a: OsHomeApp, angle: number, r: number) => {
    const Icon = a.icon;
    return (
      <div
        key={a.id}
        className="osh-orbit-node"
        style={{ transform: `rotate(${angle}deg) translateX(${r}px)` }}
      >
        <button className="osh-orbit-node-inner" onClick={() => p.onLaunch(a)} title={`${a.name} — ${a.blurb}`} aria-label={a.name}>
          <span className="osh-icon-tile">
            <Icon className="osh-icon-glyph" style={{ color: a.accent }} />
          </span>
          <span className="osh-icon-label">{a.name}</span>
        </button>
      </div>
    );
  };
  return (
    <div className="osh-orbit-stage" ref={stageRef}>
      <div className="osh-orbit-ring" style={{ width: r1 * 2, height: r1 * 2, left: `calc(50% - ${r1}px)`, top: `calc(50% - ${r1}px)` }}>
        {inner.map((a, i) => node(a, (360 / inner.length) * i, r1))}
      </div>
      <div className="osh-orbit-ring ring-2" style={{ width: r2 * 2, height: r2 * 2, left: `calc(50% - ${r2}px)`, top: `calc(50% - ${r2}px)` }}>
        {outer.map((a, i) => node(a, (360 / outer.length) * i, r2))}
      </div>
      <div className="osh-orbit-core">
        <Clock />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button className="osh-x-btn" onClick={p.onOpenLauncher} title="Search apps" aria-label="Search apps">
            <Search style={{ width: 15, height: 15 }} />
          </button>
          <button className="osh-x-btn" onClick={p.onOpenSettings} title="Themes & settings" aria-label="Themes and settings">
            <SettingsIcon style={{ width: 15, height: 15 }} />
          </button>
        </div>
        <span className="osh-hint" style={{ marginTop: 8 }}>{p.apps.length} APPS IN ORBIT</span>
      </div>
      <div style={{ position: "absolute", left: 18, bottom: 14, zIndex: 4 }} className="osh-hint">
        ◉ ORBITX OS · hover to freeze the rings
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* layout switch                                                       */
/* ------------------------------------------------------------------ */

export function LayoutSwitch(p: LayoutProps & { layout: string; themeId: string }) {
  switch (p.layout) {
    case "xmb":
      return <XmbLayout {...p} />;
    case "blades":
      return <BladesLayout {...p} />;
    case "channels":
      return <ChannelsLayout {...p} />;
    case "dual":
      return <DualLayout {...p} />;
    case "pixel":
      return <PixelLayout {...p} />;
    case "taskbar":
      return <TaskbarLayout {...p} flavor={p.themeId === "linux" ? "linux" : "windows"} />;
    case "menubar":
      return <MenubarLayout {...p} />;
    case "terminal":
      return <TerminalLayout {...p} />;
    case "grid":
      return <GridLayout {...p} />;
    case "orbit":
    default:
      return p.isMobile ? <GridLayout {...p} /> : <OrbitLayout {...p} />;
  }
}
