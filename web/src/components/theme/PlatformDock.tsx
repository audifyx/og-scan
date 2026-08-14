import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import "./platform-shell.css";

const LINKS: { to: string; label: string; ico: string; match?: (p: string) => boolean }[] = [
  { to: "/app", label: "Hub", ico: "⌂", match: (p) => p === "/app" || p.startsWith("/hub") },
  { to: "/trade", label: "Trade", ico: "⇅", match: (p) => p === "/trade" || p.startsWith("/trade/") },
  { to: "/ORBITX_DEX", label: "DEX", ico: "◈", match: (p) => p.startsWith("/ORBITX_DEX") },
  { to: "/orbitxlaunch", label: "Launch", ico: "🚀", match: (p) => p.startsWith("/orbitxlaunch") },
  { to: "/intel", label: "Intel", ico: "◎", match: (p) => p === "/intel" || p.startsWith("/intel/") },
  { to: "/nft", label: "NFT", ico: "🖼", match: (p) => p.startsWith("/nft") },
  { to: "/orbitx-social", label: "Social", ico: "◉", match: (p) => p.startsWith("/orbitx-social") || p.startsWith("/social") },
  { to: "/AI", label: "AI", ico: "✧", match: (p) => p.toLowerCase() === "/ai" },
  { to: "/agent", label: "Agent", ico: "✦", match: (p) => p.startsWith("/agent") },
  { to: "/x", label: "X", ico: "✕", match: (p) => p === "/x" || p.startsWith("/x/") },
  { to: "/play", label: "Play", ico: "▶", match: (p) => p === "/play" || p.startsWith("/play/") },
  { to: "/Orbitxcity", label: "City", ico: "🏙", match: (p) => p.toLowerCase().startsWith("/orbitxcity") },
];

/* Hide on marketing / auth / embeds — show FAB everywhere else in the app. */
const HIDE_ON_EXACT = new Set([
  "/",
  "/splash",
  "/beta",
  "/waitlist",
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
  "/agent/sign",
  "/agent/link-auth",
  "/x/link-auth",
  "/x/mcp-auth",
];

const POS_KEY = "orbitx.platformFab.pos.v2";
const FAB_SIZE = 52;

type Pos = { x: number; y: number };

function defaultPos(): Pos {
  if (typeof window === "undefined") return { x: 16, y: 96 };
  /* Upper-right — never sits on the bottom trade / iOS tab bars */
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

function PlatformLinkItems({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {LINKS.map((l) => {
        const on = l.match ? l.match(pathname) : pathname === l.to || pathname.startsWith(`${l.to}/`);
        const external = l.to.startsWith("/ORBITX_DEX");
        const className = `ox-platform-fab__link${on ? " is-on" : ""}`;
        if (external) {
          return (
            <a key={l.to} href={l.to} className={className} onClick={onNavigate}>
              <span className="ox-platform-fab__ico" aria-hidden>
                {l.ico}
              </span>
              <span>{l.label}</span>
            </a>
          );
        }
        return (
          <Link key={l.to} to={l.to} className={className} onClick={onNavigate}>
            <span className="ox-platform-fab__ico" aria-hidden>
              {l.ico}
            </span>
            <span>{l.label}</span>
          </Link>
        );
      })}
    </>
  );
}

/** Draggable corner FAB — expands to OrbitX platform jumps (keeps page tab bars free). */
export function PlatformDock() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
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
    const onDown = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      const t = e.target as Node;
      if (!el.contains(t)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

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
  }, []);

  if (!visibleOn(pathname)) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const panelLeft = pos.x + FAB_SIZE + 8 > vw - 200;
  const panelUp = pos.y + 280 > vh;

  return (
    <div
      ref={rootRef}
      className={`ox-platform-fab${open ? " is-open" : ""}`}
      style={{ left: pos.x, top: pos.y }}
    >
      {open && (
        <nav
          className={`ox-platform-fab__panel${panelLeft ? " is-left" : ""}${panelUp ? " is-up" : ""}`}
          aria-label="OrbitX platforms"
        >
          <div className="ox-platform-fab__panel-title">OrbitX apps</div>
          <PlatformLinkItems pathname={pathname} onNavigate={() => setOpen(false)} />
          <p className="ox-platform-fab__hint">Drag the button to move</p>
        </nav>
      )}

      <button
        type="button"
        className="ox-platform-fab__btn"
        aria-label={open ? "Close OrbitX apps" : "Open OrbitX apps"}
        aria-expanded={open}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span aria-hidden>{open ? "✕" : "◈"}</span>
      </button>
    </div>
  );
}

/** Compact header chip row for desktop shells. */
export function PlatformLinks({ className = "" }: { className?: string }) {
  const { pathname } = useLocation();
  return (
    <div className={`ox-platform-links ${className}`.trim()} aria-label="OrbitX apps">
      {LINKS.map((l) => {
        const on = l.match ? l.match(pathname) : pathname === l.to || pathname.startsWith(`${l.to}/`);
        const external = l.to.startsWith("/ORBITX_DEX");
        if (external) {
          return (
            <a key={l.to} href={l.to} className={`ox-platform-links__a${on ? " is-on" : ""}`}>
              {l.label}
            </a>
          );
        }
        return (
          <Link key={l.to} to={l.to} className={`ox-platform-links__a${on ? " is-on" : ""}`}>
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
