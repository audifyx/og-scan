import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import {
  hitTestWheel,
  sliceMidDeg,
  slicePath,
  splitWheelApps,
  type WheelHit,
} from "@/lib/appWheel";
import { matchPlatformPath, visiblePlatformMenu, type PlatformApp } from "@/lib/orbitxPlatforms";
import "./platform-shell.css";

const HUB_LINK: PlatformApp = {
  key: "hub",
  name: "Hub",
  caption: "Home",
  href: "/app",
  tone: "#14F195",
  iconBg: "#14F195",
  glyph: (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M8 22 24 10l16 12v16a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V22Z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
    </svg>
  ),
};

function useMenuApps(): PlatformApp[] {
  const { isOwnerIdentity } = useAdmin();
  return useMemo(() => [HUB_LINK, ...visiblePlatformMenu(Boolean(isOwnerIdentity))], [isOwnerIdentity]);
}

/* Hide on marketing / auth / embeds — show FAB everywhere else in the app. */
const HIDE_ON_EXACT = new Set([
  "/",
  "/splash",
  "/beta",
  "/waitlist",
  "/app",
  "/hub",
  "/auth",
  "/auth/email",
  "/setup",
  "/terms",
  "/privacy",
  "/vamp",
  "/whitepaper",
  "/roadmap",
  "/AI",
  "/ai",
  "/cc-callback",
  "/x-callback",
]);
const HIDE_ON_PREFIX = [
  "/auth/",
  "/embed",
  "/r/",
  "/share/",
  "/supercomputer/sign",
  "/supercomputer/link-auth",
  "/supercomputer/x-link-auth",
  "/supercomputer/x-mcp-auth",
  "/on-chain",
  "/education",
  "/orbitxagents",
  "/Orbitxagents",
  "/life",
];

const POS_KEY = "orbitx.platformFab.pos.v2";
const FAB_SIZE = 58;

type Pos = { x: number; y: number };

function defaultPos(): Pos {
  if (typeof window === "undefined") return { x: 16, y: 96 };
  return {
    x: Math.max(12, window.innerWidth - FAB_SIZE - 14),
    y: Math.max(72, Math.min(120, window.innerHeight * 0.14)),
  };
}

function readPos(): Pos {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return defaultPos();
    const p = JSON.parse(raw) as Pos;
    if (typeof p?.x !== "number" || typeof p?.y !== "number") return defaultPos();
    return clampPos(p);
  } catch {
    return defaultPos();
  }
}

function clampPos(p: Pos): Pos {
  if (typeof window === "undefined") return p;
  const maxX = Math.max(8, window.innerWidth - FAB_SIZE - 8);
  const maxY = Math.max(8, window.innerHeight - FAB_SIZE - 8);
  return {
    x: Math.min(maxX, Math.max(8, p.x)),
    y: Math.min(maxY, Math.max(8, p.y)),
  };
}

function visibleOn(pathname: string) {
  const p = pathname || "/";
  if (HIDE_ON_EXACT.has(p)) return false;
  if (HIDE_ON_PREFIX.some((pre) => p === pre || p.startsWith(pre))) return false;
  return true;
}

function SolanaMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 18" fill="none" aria-hidden>
      <path d="M5.2 13.7h13.1L15.7 17H2.6l2.6-3.3Z" fill="currentColor" />
      <path d="M5.2 7.35h13.1L15.7 10.65H2.6l2.6-3.3Z" fill="currentColor" />
      <path d="M8.3 1h13.1L18.8 4.3H5.7L8.3 1Z" fill="currentColor" />
    </svg>
  );
}

function isExternalApp(app: PlatformApp) {
  return Boolean(app.external || app.href.startsWith("/ORBITX_DEX") || app.href.startsWith("http"));
}

function WheelIcons({
  apps,
  ring,
  radiusPct,
  focus,
  pathname,
  onPick,
}: {
  apps: PlatformApp[];
  ring: "inner" | "outer";
  radiusPct: number;
  focus: WheelHit;
  pathname: string;
  onPick: (app: PlatformApp) => void;
}) {
  return (
    <>
      {apps.map((app, i) => {
        const mid = sliceMidDeg(apps.length, i);
        const rad = ((mid - 90) * Math.PI) / 180;
        const left = 50 + radiusPct * Math.cos(rad);
        const top = 50 + radiusPct * Math.sin(rad);
        const on = matchPlatformPath(app.href, pathname);
        const selected = focus.ring === ring && focus.index === i;
        return (
          <button
            key={app.key}
            type="button"
            className={`ox-wheel__ico${selected ? " is-on" : ""}${on ? " is-here" : ""} ox-wheel__ico--${ring}`}
            style={{ left: `${left}%`, top: `${top}%`, background: app.tone }}
            aria-label={app.name}
            onClick={(e) => {
              e.stopPropagation();
              onPick(app);
            }}
          >
            {app.glyph}
          </button>
        );
      })}
    </>
  );
}

/** Draggable Solana orb — opens a GTA-style apps weapon wheel. */
export function PlatformDock() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const menuApps = useMenuApps();
  const { inner, outer } = useMemo(() => splitWheelApps(menuApps), [menuApps]);
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<WheelHit>({ ring: "hub", index: -1 });
  const [pos, setPos] = useState<Pos>(() => (typeof window === "undefined" ? { x: 16, y: 120 } : readPos()));
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const discRef = useRef<HTMLDivElement>(null);

  const focusedApp = useMemo(() => {
    if (focus.ring === "inner") return inner[focus.index] || null;
    if (focus.ring === "outer") return outer[focus.index] || null;
    return null;
  }, [focus, inner, outer]);

  useEffect(() => {
    setPos(readPos());
  }, []);

  useEffect(() => {
    const onResize = () => setPos((p) => clampPos(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const goToApp = useCallback(
    (app: PlatformApp) => {
      setOpen(false);
      if (isExternalApp(app)) {
        if (app.external) window.open(app.href, "_blank", "noopener");
        else window.location.assign(app.href);
        return;
      }
      navigate(app.href);
    },
    [navigate],
  );

  const aimAt = useCallback(
    (clientX: number, clientY: number) => {
      const el = discRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const hit = hitTestWheel(
        clientX - (rect.left + rect.width / 2),
        clientY - (rect.top + rect.height / 2),
        rect.width / 2,
        inner.length,
        outer.length,
      );
      setFocus(hit);
    },
    [inner.length, outer.length],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button != null && e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origX: pos.x,
        origY: pos.y,
        moved: false,
      };
    },
    [pos.x, pos.y],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && dx * dx + dy * dy > 36) d.moved = true;
    if (!d.moved) return;
    setPos(clampPos({ x: d.origX + dx, y: d.origY + dy }));
  }, []);

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    drag.current = null;
    if (d.moved) {
      setPos((p) => {
        const next = clampPos(p);
        try {
          localStorage.setItem(POS_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
      return;
    }
    setOpen((o) => !o);
    setFocus({ ring: "hub", index: -1 });
  }, []);

  if (!visibleOn(pathname)) return null;

  const current = menuApps.find((a) => matchPlatformPath(a.href, pathname));

  return (
    <>
      {open && (
        <div
          className="ox-wheel-root"
          role="dialog"
          aria-modal="true"
          aria-label="OrbitX apps wheel"
          onClick={() => setOpen(false)}
          onPointerMove={(e) => aimAt(e.clientX, e.clientY)}
        >
          <div
            ref={discRef}
            className="ox-wheel"
            onClick={(e) => e.stopPropagation()}
            onPointerUp={(e) => {
              e.stopPropagation();
              if (e.button != null && e.button !== 0) return;
              if ((e.target as HTMLElement).closest("button")) return;
              if (focus.ring === "inner" && inner[focus.index]) goToApp(inner[focus.index]);
              else if (focus.ring === "outer" && outer[focus.index]) goToApp(outer[focus.index]);
            }}
          >
            <div className="ox-wheel__halo" aria-hidden />
            <div className="ox-wheel__glass">
              <svg className="ox-wheel__slices" viewBox="0 0 400 400" aria-hidden>
                {outer.map((app, i) => {
                  const selected = focus.ring === "outer" && focus.index === i;
                  return (
                    <path
                      key={`o-${app.key}`}
                      d={slicePath(outer.length, i, 200, 200, 136, 194)}
                      fill={app.tone}
                      fillOpacity={selected ? 0.92 : 0.34}
                      className={selected ? "is-on" : undefined}
                    />
                  );
                })}
                {inner.map((app, i) => {
                  const selected = focus.ring === "inner" && focus.index === i;
                  return (
                    <path
                      key={`i-${app.key}`}
                      d={slicePath(inner.length, i, 200, 200, 70, 128)}
                      fill={app.tone}
                      fillOpacity={selected ? 0.95 : 0.4}
                      className={selected ? "is-on" : undefined}
                    />
                  );
                })}
              </svg>
              <WheelIcons apps={inner} ring="inner" radiusPct={24.5} focus={focus} pathname={pathname} onPick={goToApp} />
              <WheelIcons apps={outer} ring="outer" radiusPct={41.2} focus={focus} pathname={pathname} onPick={goToApp} />
              <button type="button" className="ox-wheel__hub" onClick={() => setOpen(false)} aria-label="Close apps wheel">
                <SolanaMark className="ox-wheel__sol" />
                <strong>{focusedApp?.name || current?.name || "Solana"}</strong>
                <span>{focusedApp?.caption || "OrbitX apps"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div ref={rootRef} className={`ox-platform-fab${open ? " is-open" : ""}`} style={{ left: pos.x, top: pos.y }}>
        <button
          type="button"
          className="ox-platform-fab__btn"
          aria-label={open ? "Close OrbitX apps" : "Open OrbitX apps wheel"}
          aria-expanded={open}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="ox-platform-fab__glass" aria-hidden />
          {open ? <span className="ox-platform-fab__x">✕</span> : <SolanaMark className="ox-platform-fab__sol" />}
        </button>
      </div>
    </>
  );
}

/** Compact header chip row for desktop shells. */
export function PlatformLinks({ className = "" }: { className?: string }) {
  const { pathname } = useLocation();
  const menuApps = useMenuApps();
  return (
    <div className={`ox-platform-links ${className}`.trim()} aria-label="OrbitX apps">
      {menuApps.map((app) => {
        const on = matchPlatformPath(app.href, pathname);
        const external = isExternalApp(app);
        if (external) {
          return (
            <a key={app.key} href={app.href} className={`ox-platform-links__a${on ? " is-on" : ""}`}>
              {app.name}
            </a>
          );
        }
        return (
          <Link key={app.key} to={app.href} className={`ox-platform-links__a${on ? " is-on" : ""}`}>
            {app.name}
          </Link>
        );
      })}
    </div>
  );
}
