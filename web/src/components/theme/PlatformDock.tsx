import { Link, useLocation } from "react-router-dom";
import "./platform-shell.css";

const LINKS: { to: string; label: string; ico: string; match?: (p: string) => boolean }[] = [
  { to: "/app", label: "Hub", ico: "⌂", match: (p) => p === "/app" || p.startsWith("/hub") },
  { to: "/ORBITX_DEX", label: "DEX", ico: "◈", match: (p) => p.startsWith("/ORBITX_DEX") },
  { to: "/orbitxlaunch", label: "Launch", ico: "🚀", match: (p) => p.startsWith("/orbitxlaunch") },
  { to: "/nft", label: "NFT", ico: "🖼", match: (p) => p.startsWith("/nft") },
  { to: "/orbitx-social", label: "Social", ico: "◉", match: (p) => p.startsWith("/orbitx-social") || p.startsWith("/social") },
  { to: "/agent", label: "Agent", ico: "✦", match: (p) => p.startsWith("/agent") },
  { to: "/x", label: "X", ico: "✕", match: (p) => p === "/x" || p.startsWith("/x/") },
];

/* Surfaces with in-app tabs use PlatformLinks; dock only for desk routes. */
const SHOW_ON = [
  "/intel",
  "/trade",
  "/predictions",
  "/bagwork",
];

function visibleOn(pathname: string) {
  return SHOW_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** iOS-style bottom dock linking major OrbitX platforms (mobile + compact desktop). */
export function PlatformDock() {
  const { pathname } = useLocation();
  if (!visibleOn(pathname)) return null;

  return (
    <nav className="ox-platform-dock" aria-label="OrbitX platforms">
      {LINKS.map((l) => {
        const on = l.match ? l.match(pathname) : pathname === l.to || pathname.startsWith(`${l.to}/`);
        const external = l.to.startsWith("/ORBITX_DEX");
        if (external) {
          return (
            <a key={l.to} href={l.to} className={`ox-platform-dock__item${on ? " is-on" : ""}`}>
              <span className="ox-platform-dock__ico" aria-hidden>
                {l.ico}
              </span>
              <span>{l.label}</span>
            </a>
          );
        }
        return (
          <Link key={l.to} to={l.to} className={`ox-platform-dock__item${on ? " is-on" : ""}`}>
            <span className="ox-platform-dock__ico" aria-hidden>
              {l.ico}
            </span>
            <span>{l.label}</span>
          </Link>
        );
      })}
    </nav>
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
