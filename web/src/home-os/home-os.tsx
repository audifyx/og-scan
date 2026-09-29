import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAllLaunches, useMarketMap, launchStats, fmtCompactUsd } from "@/pages/orbitx/lpx";
import type { OrbitxToken } from "@/lib/orbitx/registry";
import {
  APP_CATEGORIES,
  ORDER_STORAGE_KEY,
  OS_APPS,
  type DeviceThemeId,
  type OsApp,
} from "./theme-registry";
import { useTheme } from "./os-theme-provider";
import { ThemeGallery } from "./theme-gallery";
import { OsWipe } from "./os-boot";

function loadOrder(): string[] {
  try {
    const raw = window.localStorage.getItem(ORDER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function AppIcon({ app }: { app: OsApp }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-7"
      aria-hidden
    >
      <path d={app.icon} />
    </svg>
  );
}

/** Live stats + token-of-the-day from the app's real launchpad loaders. */
function useHomeStats() {
  const { data: launches } = useAllLaunches();
  const tokens = useMemo(() => (Array.isArray(launches) ? launches : []), [launches]);
  const mints = useMemo(() => tokens.map((t) => t.mint_address), [tokens]);
  const { data: markets } = useMarketMap(mints);
  const stats = useMemo(() => launchStats(tokens), [tokens]);
  const vol24 = useMemo(
    () => (markets ? Object.values(markets).reduce((a, m) => a + (m.vol24 ?? 0), 0) : 0),
    [markets],
  );
  const tokenOfDay = useMemo<OrbitxToken | null>(() => {
    if (!markets || tokens.length === 0) return null;
    let best: OrbitxToken | null = null;
    let bestVol = 0;
    for (const t of tokens) {
      const v = markets[t.mint_address]?.vol24 ?? 0;
      if (v > bestVol) {
        bestVol = v;
        best = t;
      }
    }
    return best;
  }, [tokens, markets]);
  return { stats, vol24, tokenOfDay };
}

export function HomeOS() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { stats, vol24, tokenOfDay } = useHomeStats();
  const [order, setOrder] = useState<string[]>(() => loadOrder());
  const [query, setQuery] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [wipe, setWipe] = useState<DeviceThemeId | null>(null);
  const dragStart = useRef<{ id: string; x: number; y: number } | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const pendingNav = useRef<string | null>(null);

  const ordered = useMemo(() => {
    const byId = new Map(OS_APPS.map((a) => [a.id, a]));
    const seen = new Set<string>();
    const out: OsApp[] = [];
    for (const id of order) {
      const app = byId.get(id);
      if (app && !seen.has(id)) {
        out.push(app);
        seen.add(id);
      }
    }
    for (const app of OS_APPS) {
      if (!seen.has(app.id)) out.push(app);
    }
    return out;
  }, [order]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q),
    );
  }, [ordered, query]);

  const resetDrag = useCallback(() => {
    if (armTimer.current) {
      clearTimeout(armTimer.current);
      armTimer.current = null;
    }
    dragStart.current = null;
    setDragId(null);
    setDragOverId(null);
  }, []);

  const persist = useCallback((ids: string[]) => {
    setOrder(ids);
    try {
      window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  }, []);

  /* Springboard drag: long-press (450ms) arms the tile, then drag freely.
     Plain scroll/swipe is never hijacked. */
  const onTilePointerDown = (e: React.PointerEvent, id: string) => {
    dragStart.current = { id, x: e.clientX, y: e.clientY };
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => {
      if (dragStart.current?.id === id) {
        setDragId(id);
        try {
          navigator.vibrate?.(12);
        } catch {
          /* noop */
        }
      }
    }, 450);
  };
  const onTilePointerMove = (e: React.PointerEvent) => {
    const start = dragStart.current;
    if (!start || dragId) return;
    // moved before the long-press fired — this is a scroll, disarm
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > 10 && armTimer.current) {
      clearTimeout(armTimer.current);
      armTimer.current = null;
    }
  };
  const onGridPointerMove = (e: React.PointerEvent) => {
    if (!dragId) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-app-id]");
    const overId = el?.getAttribute("data-app-id");
    setDragOverId(overId && overId !== dragId ? overId : null);
  };
  const onTilePointerUp = (e: React.PointerEvent, id: string) => {
    const wasDragging = dragId === id;
    const target = dragOverId;
    if (armTimer.current) {
      clearTimeout(armTimer.current);
      armTimer.current = null;
    }
    dragStart.current = null;
    setDragId(null);
    setDragOverId(null);
    if (!wasDragging) {
      // plain tap — themed wipe transition, then navigate
      const app = ordered.find((a) => a.id === id);
      if (app) {
        suppressClick.current = true;
        pendingNav.current = app.route;
        setWipe(theme.device);
        window.setTimeout(() => {
          const href = pendingNav.current;
          pendingNav.current = null;
          setWipe(null);
          if (href) navigate(href);
        }, 300);
      }
      return;
    }
    e.preventDefault();
    suppressClick.current = true;
    if (!target) return;
    const ids = ordered.map((a) => a.id);
    const from = ids.indexOf(id);
    const to = ids.indexOf(target);
    if (from < 0 || to < 0 || from === to) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    persist(ids);
  };

  const onTileClick = (e: React.MouseEvent) => {
    // swallow the synthetic click after drag or during wipe transitions
    if (suppressClick.current || pendingNav.current) {
      e.preventDefault();
      suppressClick.current = false;
    }
  };

  const searching = query.trim().length > 0;
  const handle = profile?.username ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-24 pt-6 lg:space-y-8">
      {/* OS header: greeting + search + theme */}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/40">
            OrbitX OS
          </p>
          <h1 className="font-display text-2xl tracking-tight text-white sm:text-3xl">
            {handle ? `Welcome back, @${handle}` : "Welcome to OrbitX"}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setGalleryOpen(true)}
          className="pad-panel flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03] active:scale-95"
          aria-label="Change theme"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" className="size-4">
            <circle cx="12" cy="12" r="9" />
            <circle cx="9" cy="10" r="1.2" fill="currentColor" />
            <circle cx="14.5" cy="9" r="1.2" fill="currentColor" />
            <circle cx="10" cy="14.5" r="1.2" fill="currentColor" />
            <circle cx="15" cy="14" r="1.2" fill="currentColor" />
          </svg>
          <span className="hidden sm:inline">Theme</span>
        </button>
      </div>

      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search apps…"
          className="pad-panel w-full rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          aria-label="Search apps"
        />
      </div>

      {/* Live widget row — real launchpad data */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <WidgetStat label="Live now" value={String(stats.total - stats.graduated)} accent />
        <WidgetStat label="Graduated" value={String(stats.graduated)} />
        <WidgetStat label="Vol 24h" value={fmtCompactUsd(vol24)} />
        <WidgetStat label="New 24h" value={String(stats.last24h)} />
      </div>
      {tokenOfDay ? (
        <Link
          to={`/orbitxlaunch/token/${tokenOfDay.mint_address}`}
          className="pad-panel flex items-center gap-3 rounded-2xl px-4 py-3 transition-transform hover:scale-[1.01]"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-gold)]">
            Token of the day
          </span>
          <span className="truncate text-sm font-semibold text-white">
            {tokenOfDay.name} <span className="text-white/50">${tokenOfDay.ticker}</span>
          </span>
          <span className="ml-auto shrink-0 text-xs text-white/50">Open →</span>
        </Link>
      ) : null}

      {/* App grid */}
      {searching ? (
        <AppGrid
          apps={filtered}
          dragId={dragId}
          onPointerDown={onTilePointerDown}
          onPointerMove={onTilePointerMove}
          onGridPointerMove={onGridPointerMove}
          onPointerUp={onTilePointerUp}
          onPointerCancel={resetDrag}
          onTileClick={onTileClick}
          flat
        />
      ) : (
        APP_CATEGORIES.map((cat) => {
          const apps = filtered.filter((a) => a.category === cat);
          if (apps.length === 0) return null;
          return (
            <section key={cat} aria-label={cat}>
              <h2 className="mb-2.5 px-1 font-mono text-[11px] uppercase tracking-[0.24em] text-white/40">
                {cat}
              </h2>
              <AppGrid
                apps={apps}
                dragId={dragId}
                onPointerDown={onTilePointerDown}
                onPointerMove={onTilePointerMove}
                onGridPointerMove={onGridPointerMove}
                onPointerUp={onTilePointerUp}
                onPointerCancel={resetDrag}
                onTileClick={onTileClick}
              />
            </section>
          );
        })
      )}

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-white/40">No apps match “{query}”.</p>
      ) : null}

      {galleryOpen ? <ThemeGallery onClose={() => setGalleryOpen(false)} /> : null}
      {wipe ? <OsWipe device={wipe} /> : null}
      <span className="hidden" data-os-theme-active={theme.device} />
    </div>
  );
}

function WidgetStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="pad-panel rounded-2xl px-4 py-3.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">{label}</p>
      <p className={`font-display mt-1 text-2xl ${accent ? "text-[var(--color-gold)]" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

interface GridProps {
  apps: OsApp[];
  dragId: string | null;
  flat?: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onGridPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent, id: string) => void;
  onPointerCancel: () => void;
  onTileClick: (e: React.MouseEvent) => void;
}

function AppGrid({ apps, dragId, flat, onPointerDown, onPointerMove, onGridPointerMove, onPointerUp, onPointerCancel, onTileClick }: GridProps) {
  return (
    <div
      className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8"
      onPointerMove={onGridPointerMove}
    >
      {apps.map((app) => (
        <Link
          key={app.id}
          to={app.route}
          data-app-id={app.id}
          data-dragging={dragId === app.id}
          onPointerDown={(e) => onPointerDown(e, app.id)}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => onPointerUp(e, app.id)}
          onPointerCancel={onPointerCancel}
          onClick={onTileClick}
          className="group flex select-none flex-col items-center gap-1.5 outline-none"
          style={dragId === app.id ? { touchAction: "none" } : undefined}
          aria-label={`${app.name} — ${app.description}`}
          title={flat ? app.description : undefined}
          draggable={false}
        >
          <span className="os-app-tile relative flex aspect-square w-full max-w-[76px] items-center justify-center border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.02] text-[var(--color-gold)] shadow-[0_8px_24px_rgb(0_0_0/35%)] transition-transform group-hover:scale-105 group-active:scale-95">
            <AppIcon app={app} />
            {app.badge ? (
              <span className="absolute -right-1 -top-1 rounded-full bg-[var(--color-gold)] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-black">
                {app.badge}
              </span>
            ) : null}
          </span>
          <span className="w-full truncate text-center text-[11px] font-medium text-white/75 group-hover:text-white">
            {app.name}
          </span>
        </Link>
      ))}
    </div>
  );
}
