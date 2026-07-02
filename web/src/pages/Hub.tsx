import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";

const BRAND = "OrbitX";
const OS_NAME = "OrbitX";
const VERSION = "v2.0";
const DOCK_KEY = "og_dock_order";

type App = {
  key: string;
  name: string;
  caption: string;
  href: string;
  external?: boolean;
  tone: string;
  iconBg: string;
  glyph: JSX.Element;
};

const OrbitLogo = ({ size = 48, className = "" }: { size?: number; className?: string }) => (
  <img src="/icon-192x192.png" width={size} height={size} alt="OrbitX" className={className} style={{ objectFit: "contain" }} />
);

const Glyph = {
  dex: (
    <svg viewBox="0 0 48 48" fill="none">
      <path d="M8 34l9-11 7 6 11-15" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 40h32" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity=".4" />
      <circle cx="35" cy="14" r="3.5" fill="currentColor" />
    </svg>
  ),
  social: (
    <svg viewBox="0 0 48 48" fill="none">
      <circle cx="18" cy="18" r="6" stroke="currentColor" strokeWidth="3.5" />
      <circle cx="32" cy="22" r="5" stroke="currentColor" strokeWidth="3.5" opacity=".6" />
      <path d="M8 40c0-6 5-10 10-10s10 4 10 10" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M30 40c0-5 3-8 6-8s6 3 6 8" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity=".6" />
    </svg>
  ),
  predict: (
    <svg viewBox="0 0 48 48" fill="none">
      <rect x="10" y="10" width="28" height="28" rx="8" stroke="currentColor" strokeWidth="3.5" />
      <circle cx="18" cy="18" r="3" fill="currentColor" />
      <circle cx="30" cy="30" r="3" fill="currentColor" />
      <circle cx="30" cy="18" r="3" fill="currentColor" />
      <circle cx="18" cy="30" r="3.5" fill="currentColor" />
      <circle cx="24" cy="24" r="3" fill="currentColor" />
    </svg>
  ),
  scanner: (
    <svg viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="3.5" opacity=".3" />
      <circle cx="24" cy="24" r="7" stroke="currentColor" strokeWidth="3.5" opacity=".8" />
      <path d="M24 24L36 12" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="24" cy="24" r="3" fill="currentColor" />
    </svg>
  ),
  ai: (
    <svg viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="3" opacity=".5" />
      <circle cx="24" cy="24" r="8" stroke="currentColor" strokeWidth="3" opacity=".75" />
      <path d="M24 16v-4M24 36v-4M16 24h-4M32 24h-4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="24" r="2.5" fill="currentColor" />
    </svg>
  ),
  gaming: (
    <svg viewBox="0 0 48 48" fill="none">
      <path d="M18 40V16l6-6 6 6v24" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M12 40h24" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M24 10v6M21 22h6M21 30h6" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="18" r="7" stroke="currentColor" strokeWidth="3" />
      <path d="M10 40c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.49.49 0 0 0-.48-.41h-3.84a.49.49 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.05.3-.07.62-.07.94 0 .32.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.07.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
};

const ALL_APPS: App[] = [
  { key: "dex", name: "OrbitX DEX", caption: "Scanner & Trade", href: "/ORBITX_DEX", tone: "#2F80FF", iconBg: "linear-gradient(135deg, #1A6CFF, #0037A3)", glyph: Glyph.dex },
  { key: "kol", name: "KOL Tracker", caption: "Track & Alert", href: "/orbitx-kol-tracker", tone: "#FF6B35", iconBg: "linear-gradient(135deg, #FF6B35, #D94315)", glyph: <div style={{fontSize:"20px"}}>👁️</div> },
  { key: "social", name: "Social", caption: "Spaces & Chat", href: "/orbitx-social", tone: "#9945FF", iconBg: "linear-gradient(135deg, #8A2BE2, #4B0082)", glyph: Glyph.social },
  { key: "predict", name: "Predictions", caption: "Provably fair", href: "https://solno.fun", external: true, tone: "#FFC53D", iconBg: "linear-gradient(135deg, #FFB020, #D47900)", glyph: Glyph.predict },
  { key: "scanner", name: "Scanner", caption: "Forensic scan", href: "/orbitx-scanner", tone: "#14E0C8", iconBg: "linear-gradient(135deg, #00C6B8, #00766E)", glyph: Glyph.scanner },
  { key: "gaming", name: "Gaming", caption: "Climb & Win", href: "https://degen-tower.vercel.app", external: true, tone: "#FF5BBD", iconBg: "linear-gradient(135deg, #FF3EAA, #B20067)", glyph: Glyph.gaming },
  { key: "ai", name: "AI Assistant", caption: "Help & Support", href: "/ai-chat", tone: "#14a0ff", iconBg: "linear-gradient(135deg, #14a0ff, #0077b6)", glyph: Glyph.ai },
];

const CENTER_TABS: { key: string; name: string; href?: string; action: "profile" | "settings" | "logout" | "wallpaper"; tone: string; glyph: JSX.Element }[] = [
  { key: "profile", name: "Profile", href: "/profile", action: "profile", tone: "#2F80FF", glyph: Glyph.profile },
  { key: "wallpaper", name: "Wallpaper", action: "wallpaper", tone: "#FFC53D", glyph: <div style={{fontSize:"18px"}}>🎨</div> },
  { key: "settings", name: "Settings", href: "/settings", action: "settings", tone: "#9945FF", glyph: Glyph.settings },
  { key: "logout", name: "Log Out", action: "logout", tone: "#FF5B6B", glyph: Glyph.logout },
];

export default function Hub() {
  const [booted, setBooted] = useState(false);
  const [launching, setLaunching] = useState<App | null>(null);
  const now = useClock();
  const { signOut } = useAuth();
  const logout = async () => { try { await signOut(); } finally { window.location.assign("/auth"); } };

  const [dockOrder, setDockOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(DOCK_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return Array.from(new Set(parsed));
      }
    } catch {}
    return ALL_APPS.map((a) => a.key);
  });

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(DOCK_KEY, JSON.stringify(Array.from(new Set(dockOrder))));
  }, [dockOrder]);

  const getApps = () => dockOrder.map((key) => ALL_APPS.find((a) => a.key === key)!).filter(Boolean);

  const onDragStart = (e: React.DragEvent, key: string) => {
    setDragId(key);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", key);
  };

  const onDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(key);
  };

  const onDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    setDragOverId(null);
    setDragId(null);
    if (!dragId || dragId === targetKey) return;
    setDockOrder((prev) => {
      const next = prev.filter((k) => k !== dragId);
      const to = next.indexOf(targetKey);
      if (to < 0) return prev;
      next.splice(to, 0, dragId);
      return next;
    });
  };

  const onDragEnd = () => {
    setDragId(null);
    setDragOverId(null);
  };

  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 150);
    return () => clearTimeout(t);
  }, []);

  const openApp = useCallback((app: App | typeof CENTER_TABS[0]) => {
    if (launching) return;
    setLaunching(app as App);
    window.setTimeout(() => {
      if ("action" in app) {
        if (app.action === "logout") logout();
        else if (app.action === "wallpaper") {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = async (e: any) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (event: any) => {
                localStorage.setItem('hub-wallpaper', event.target.result);
                window.location.reload();
              };
              reader.readAsDataURL(file);
            }
            setLaunching(null);
          };
          input.click();
          setLaunching(null);
        }
        else window.location.assign(app.href || "/settings");
      } else {
        if (app.external) {
          window.open(app.href, "_blank", "noopener");
          setLaunching(null);
        } else {
          window.location.assign(app.href);
        }
      }
    }, 700);
  }, [launching, logout]);

  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const apps = getApps();
  const mid = Math.ceil(apps.length / 2);
  const leftApps = apps.slice(0, mid);
  const rightApps = apps.slice(mid);

  return (
    <div className="mac-os">
      <style>{css}</style>

      {/* ── DESKTOP ── */}
      <div className={`desktop ${booted ? "desktop-ready" : ""}`}>
        <div className="wallpaper" aria-hidden style={{ backgroundImage: `url('${localStorage.getItem('hub-wallpaper') || ''}')` }}>
          <div className="wp-image" />
          <div className="wp-overlay" />
        </div>

        {/* macOS Menu Bar */}
        <header className="menu-bar">
          <div className="mb-left">
            <button className="mb-apple-icon">
              <OrbitLogo size={16} className="opacity-90" />
            </button>
            <nav className="mb-menus">
              <span className="mb-app-name">{OS_NAME}</span>
              <span>File</span>
              <span>Edit</span>
              <span>View</span>
              <span>Window</span>
              <span>Help</span>
            </nav>
          </div>
          <div className="mb-right">
            <span className="mb-version">{VERSION}</span>
            <div className="mb-status-icons">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="16" height="10" rx="2" ry="2"/><line x1="22" y1="11" x2="22" y2="13"/></svg>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
            </div>
            <span className="mb-clock">{date} {time}</span>
          </div>
        </header>

        {/* Desktop Body / App Grid */}
        <main className="desktop-body">
          <div className="app-grid">
            {apps.map((app, i) => (
              <button
                key={app.key}
                className="desktop-icon-wrapper"
                style={{ animationDelay: `${i * 60}ms` }}
                onClick={() => openApp(app)}
                disabled={!!launching}
                onDoubleClick={() => openApp(app)}
              >
                <div className="mac-icon" style={{ background: app.iconBg }}>
                  <div className="mac-icon-gloss" />
                  <div className="mac-icon-glyph">{app.glyph}</div>
                </div>
                <span className="desktop-icon-label">{app.name}</span>
              </button>
            ))}
          </div>
        </main>

        {/* macOS Dock */}
        <footer className="mac-dock-container">
          <div className="mac-dock">
            <div className="dock-center">
              {CENTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  className="dock-center-item"
                  style={{ "--tone": tab.tone } as React.CSSProperties}
                  title={tab.name}
                  onClick={() => openApp(tab)}
                >
                  <div className="mac-icon dock-icon" style={{ background: `linear-gradient(135deg, ${tab.tone}44, ${tab.tone}22)` }}>
                    <div className="mac-icon-gloss" />
                    <div className="mac-icon-glyph">{tab.glyph}</div>
                  </div>
                  <span className="dock-tooltip">{tab.name}</span>
                </button>
              ))}
            </div>
          </div>
        </footer>
      </div>

      {/* ── MAC OS WINDOW LAUNCH ANIMATION ── */}
      {launching && (
        <div className="launch-window-overlay">
          <div className="launch-window" style={{ '--launch-color': launching.tone } as React.CSSProperties}>
            <div className="window-titlebar">
              <div className="window-controls">
                <span className="wc close" />
                <span className="wc minimize" />
                <span className="wc maximize" />
              </div>
              <span className="window-title">{launching.name}</span>
            </div>
            <div className="window-content">
              <div className="mac-icon launch-bounce" style={{ background: launching.iconBg }}>
                <div className="mac-icon-gloss" />
                <div className="mac-icon-glyph">{launching.glyph}</div>
              </div>
              <div className="spinner-ring" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DockItem({ app, launching, onOpen, onDragStart, onDragOver, onDrop, onDragEnd, isDragging, isOver }: {
  app: App; launching: App | null; onOpen: () => void;
  onDragStart: (e: React.DragEvent, key: string) => void; onDragOver: (e: React.DragEvent, key: string) => void;
  onDrop: (e: React.DragEvent, key: string) => void; onDragEnd: () => void;
  isDragging: boolean; isOver: boolean;
}) {
  return (
    <div className={`dock-item-wrapper ${isDragging ? "dragging" : ""} ${isOver ? "drag-over" : ""}`}>
      <button
        className="dock-item"
        onClick={onOpen}
        disabled={!!launching}
        draggable
        onDragStart={(e) => onDragStart(e, app.key)}
        onDragOver={(e) => onDragOver(e, app.key)}
        onDrop={(e) => onDrop(e, app.key)}
        onDragEnd={onDragEnd}
      >
        <div className="mac-icon dock-icon" style={{ background: app.iconBg }}>
          <div className="mac-icon-gloss" />
          <div className="mac-icon-glyph">{app.glyph}</div>
        </div>
        <span className="dock-tooltip">{app.name}</span>
      </button>
      <div className="dock-active-dot" />
    </div>
  );
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const css = `
.mac-os {
  position: relative; min-height: 100vh; background: #000; color: #fff; overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
}
.mac-os button { font-family: inherit; border: 0; background: none; color: inherit; cursor: pointer; outline: none; }
.mac-os a { color: inherit; text-decoration: none; }

.desktop {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  opacity: 0; transform: scale(1.02); filter: blur(10px);
  transition: opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1), transform 1.2s cubic-bezier(0.16, 1, 0.3, 1), filter 1.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.desktop.desktop-ready { opacity: 1; transform: none; filter: blur(0); }

.wallpaper { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
.wp-image {
  position: absolute; inset: 0;
  background: url(/bg/bg-nebula.jpg) center/cover no-repeat;
  filter: saturate(1.2) brightness(0.9);
  animation: bg-pan 60s ease-in-out infinite alternate;
}
.wp-overlay { position: absolute; inset: 0; background: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.45) 100%); }
@keyframes bg-pan { 0% { transform: scale(1.05) translate(0%, 0%); } 100% { transform: scale(1.1) translate(-2%, -2%); } }

.menu-bar {
  position: relative; z-index: 50; display: flex; align-items: center; justify-content: space-between;
  height: 28px; padding: 0 16px; background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%);
  box-shadow: 0 1px 0 rgba(0,0,0,0.1); font-size: 13px; font-weight: 500; letter-spacing: -0.01em; color: #fff;
}
.mb-left { display: flex; align-items: center; height: 100%; }
.mb-apple-icon {
  display: flex; align-items: center; justify-content: center; height: 100%; padding: 0 12px;
  transition: background 0.1s; border-radius: 4px; margin-left: -8px;
}
.mb-apple-icon:hover { background: rgba(255, 255, 255, 0.2); }
.mb-menus { display: flex; align-items: center; height: 100%; margin-left: 8px; }
.mb-menus span {
  display: flex; align-items: center; height: 100%; padding: 0 12px;
  border-radius: 4px; cursor: default; transition: background 0.1s;
}
.mb-menus span:hover { background: rgba(255, 255, 255, 0.2); }
.mb-app-name { font-weight: 700 !important; }

.mb-right { display: flex; align-items: center; gap: 16px; height: 100%; }
.mb-version { opacity: 0.6; font-size: 12px; }
.mb-status-icons { display: flex; align-items: center; gap: 12px; opacity: 0.9; }
.mb-clock { padding: 0 8px; border-radius: 4px; display: flex; align-items: center; height: 100%; cursor: default; }
.mb-clock:hover { background: rgba(255, 255, 255, 0.2); }

@media (max-width: 768px) {
  .mb-menus span:not(.mb-app-name) { display: none; }
  .mb-status-icons { display: none; }
}

.desktop-body {
  position: relative; z-index: 10; flex: 1; padding: 32px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.app-grid {
  display: flex; flex-direction: row; flex-wrap: wrap; gap: 28px;
  align-items: flex-end; justify-content: center; max-width: 900px;
}
.desktop-icon-wrapper {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  opacity: 0; transform: translateY(20px);
  animation: fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-play-state: paused;
}
.desktop-ready .desktop-icon-wrapper { animation-play-state: running; }
.desktop-icon-label {
  font-size: 12px; font-weight: 500;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  padding: 2px 6px; border-radius: 4px; transition: background 0.1s;
}
.desktop-icon-wrapper:hover .desktop-icon-label { background: rgba(47, 128, 255, 0.8); }
@keyframes fade-in-up { to { opacity: 1; transform: none; } }

.mac-icon {
  position: relative; width: 64px; height: 64px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.2);
  overflow: hidden; color: #fff;
}
.mac-icon-gloss {
  position: absolute; top: 0; left: 0; right: 0; height: 50%;
  background: linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 100%);
  pointer-events: none;
}
.mac-icon-glyph {
  position: relative; z-index: 2; width: 32px; height: 32px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
}

.mac-dock-container {
  position: absolute; bottom: 16px; left: 0; right: 0; z-index: 40;
  display: flex; justify-content: center; pointer-events: none;
}
.mac-dock {
  pointer-events: auto; display: flex; align-items: center; gap: 6px;
  padding: 8px; border-radius: 24px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(32px) saturate(180%); -webkit-backdrop-filter: blur(32px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.4);
}
.dock-section { display: flex; gap: 6px; align-items: center; }
.dock-divider { width: 1px; height: 28px; background: rgba(255,255,255,0.15); border-radius: 1px; flex-shrink:0; }
.dock-center { display: flex; gap: 4px; align-items: center; padding: 0 4px; }

.dock-item-wrapper {
  position: relative; display: flex; flex-direction: column; align-items: center;
  cursor: grab; transition: transform 0.15s ease, opacity 0.15s ease;
}
.dock-item-wrapper:active { cursor: grabbing; }
.dock-item-wrapper.dragging { opacity: 0.35; transform: scale(0.9); }
.dock-item-wrapper.drag-over .dock-item { border-color: rgba(47,128,255,0.6); box-shadow: 0 0 0 3px rgba(47,128,255,0.35); }

.dock-item {
  position: relative; transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1); transform-origin: bottom;
}
.dock-item:hover { transform: scale(1.25) translateY(-4px); z-index: 10; }
.dock-icon { width: 48px; height: 48px; border-radius: 12px; transition: filter 0.2s; }
.dock-item:active .dock-icon { filter: brightness(0.7); }
.dock-active-dot {
  width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,0.8);
  margin-top: 3px; opacity: 0;
}
.dock-item-wrapper:nth-child(even) .dock-active-dot { opacity: 1; }

.dock-center-item {
  position: relative; height: 40px; min-width: 40px; padding: 0 8px;
  border-radius: 14px; display: inline-flex; align-items: center; gap: 6px;
  color: #cfd6e2; border: 1px solid rgba(255,255,255,0.12);
  background: linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
  transition: all 0.2s; cursor: pointer;
}
.dock-center-item:hover {
  color: #fff; border-color: var(--tone, #2F80FF);
  box-shadow: 0 8px 22px -10px var(--tone, #2F80FF); transform: translateY(-3px);
}
.dock-center-item .dock-icon { width: 20px; height: 20px; border-radius: 6px; }
.dock-center-item .mac-icon-glyph { width: 12px; height: 12px; }
.dock-center-item .mac-icon-gloss { display: none; }
.dock-center-tip {
  font-size: 11px; font-weight: 700; letter-spacing: 0.01em;
  white-space: nowrap; color: inherit; display: none;
}
@media (min-width: 720px) { .dock-center-tip { display: inline; } }

.dock-tooltip {
  position: absolute; bottom: calc(100% + 14px); left: 50%; transform: translateX(-50%) translateY(8px);
  background: rgba(20, 20, 20, 0.75); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  color: #fff; padding: 5px 10px; border-radius: 8px; font-size: 12px; font-weight: 500;
  white-space: nowrap; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  opacity: 0; pointer-events: none; transition: opacity 0.2s, transform 0.2s;
}
.dock-item:hover .dock-tooltip, .dock-center-item:hover .dock-tooltip { opacity: 1; transform: translateX(-50%) translateY(0); }
.dock-tooltip::after {
  content: ""; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
  border-width: 5px; border-style: solid; border-color: rgba(20,20,20,0.75) transparent transparent transparent;
}

@media (max-width: 600px) {
  .mac-dock-container { display: none; }
}

.launch-window-overlay {
  position: absolute; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  animation: fade-in 0.3s ease forwards;
}
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

.launch-window {
  width: min(800px, 90vw); height: min(500px, 80vh);
  background: rgba(30, 30, 30, 0.9); backdrop-filter: blur(40px) saturate(200%); -webkit-backdrop-filter: blur(40px) saturate(200%);
  border-radius: 12px; border: 1px solid rgba(255,255,255,0.15);
  box-shadow: 0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.5);
  display: flex; flex-direction: column; overflow: hidden;
  animation: window-scale-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; transform-origin: center bottom;
}
@keyframes window-scale-up { from { opacity: 0; transform: scale(0.6) translateY(100px); } to { opacity: 1; transform: scale(1) translateY(0); } }

.window-titlebar {
  height: 38px; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%);
  border-bottom: 1px solid rgba(0,0,0,0.4); position: relative;
}
.window-controls {
  position: absolute; left: 16px; top: 0; bottom: 0;
  display: flex; align-items: center; gap: 8px;
}
.wc { width: 12px; height: 12px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1); }
.wc.close { background: #FF5F56; }
.wc.minimize { background: #FFBD2E; }
.wc.maximize { background: #27C93F; }
.window-title { font-size: 13px; font-weight: 600; color: #fff; text-shadow: 0 1px 1px rgba(0,0,0,0.5); }

.window-content { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 32px; }
.launch-bounce { width: 96px; height: 96px; border-radius: 22px; animation: bounce-soft 2s ease-in-out infinite; }
.launch-bounce .mac-icon-glyph { width: 48px; height: 48px; }
@keyframes bounce-soft { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

.spinner-ring {
  width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.1);
  border-top-color: var(--launch-color, #2F80FF); border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
`;
