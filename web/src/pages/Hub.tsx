import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { AIWidgetPanel, MobileWidgetGrid, aiWidgetCSS, readWidgets, type WidgetConfig } from "@/components/AIWidgetPanel";
import { MobileNav } from "@/components/MobileNavV2";

const BRAND = "OrbitX";
const OS_NAME = "OrbitX";
const VERSION = "v2.0";
const DOCK_KEY = "og_dock_order";

const wgTimeAgo = (iso: string) => {
  const sec = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
};

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
  koltracker: (
    <svg viewBox="0 0 48 48" fill="none">
      <path d="M24 8c-5 0-9 4-9 9v6l-3 6h24l-3-6v-6c0-5-4-9-9-9z" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 34a4 4 0 008 0" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="35" cy="12" r="5" fill="currentColor" />
    </svg>
  ),
};

const ALL_APPS: App[] = [
  { key: "dex", name: "OrbitX DEX", caption: "Scanner & Trade", href: "/ORBITX_DEX", tone: "#2F80FF", iconBg: "linear-gradient(135deg, #1A6CFF, #0037A3)", glyph: Glyph.dex },
  { key: "social", name: "Social", caption: "Spaces & Chat", href: "/orbitx-social", tone: "#9945FF", iconBg: "linear-gradient(135deg, #8A2BE2, #4B0082)", glyph: Glyph.social },
  { key: "predict", name: "Predictions", caption: "Provably fair", href: "https://solno.fun", external: true, tone: "#FFC53D", iconBg: "linear-gradient(135deg, #FFB020, #D47900)", glyph: Glyph.predict },
  { key: "scanner", name: "Scanner", caption: "Forensic scan", href: "/orbitx-scanner", tone: "#14E0C8", iconBg: "linear-gradient(135deg, #00C6B8, #00766E)", glyph: Glyph.scanner },
  { key: "gaming", name: "Gaming", caption: "Climb & Win", href: "https://degen-tower.vercel.app", external: true, tone: "#FF5BBD", iconBg: "linear-gradient(135deg, #FF3EAA, #B20067)", glyph: Glyph.gaming },
  { key: "ai", name: "AI Assistant", caption: "Help & Support", href: "/ai-chat", tone: "#14a0ff", iconBg: "linear-gradient(135deg, #14a0ff, #0077b6)", glyph: Glyph.ai },
  { key: "koltracker", name: "KOL Tracker", caption: "Wallet Alerts", href: "/app/kol-tracker", tone: "#22C55E", iconBg: "linear-gradient(135deg, #16A34A, #065F46)", glyph: Glyph.koltracker },
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
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [spotQ, setSpotQ] = useState("");
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [solChange, setSolChange] = useState<number | null>(null);
  const [trending, setTrending] = useState<{ mint: string; symbol: string; priceUsd: number | null; change24h: number | null }[]>([]);
  const [latestPosts, setLatestPosts] = useState<{ id: string; username: string | null; content: string; created_at: string }[]>([]);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [dockX, setDockX] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [customWidgets, setCustomWidgets] = useState<WidgetConfig[]>(readWidgets);
  const starCanvasRef = useRef<HTMLCanvasElement>(null);
  const desktopRef = useRef<HTMLDivElement>(null);
  const now = useClock();
  const { signOut, profile } = useAuth();
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

  const getApps = () => {
    const ordered = dockOrder.map((key) => ALL_APPS.find((a) => a.key === key)).filter(Boolean) as App[];
    const missing = ALL_APPS.filter((a) => !dockOrder.includes(a.key));
    return [...ordered, ...missing];
  };

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

  /* Cmd/Ctrl+K spotlight */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSpotlightOpen((v) => !v); setSpotQ(""); }
      if (e.key === "Escape") { setSpotlightOpen(false); setPanelOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Live SOL price in the menu bar */
  useEffect(() => {
    let on = true;
    const fetchPrice = () =>
      fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true")
        .then((r) => r.json())
        .then((j) => {
          if (!on || !j?.solana?.usd) return;
          setSolPrice(Number(j.solana.usd));
          if (j.solana.usd_24h_change != null) setSolChange(Number(j.solana.usd_24h_change));
        })
        .catch(() => {});
    fetchPrice();
    const iv = setInterval(fetchPrice, 60_000);
    return () => { on = false; clearInterval(iv); };
  }, []);

  /* Widgets: trending tokens + latest community posts (best-effort) */
  useEffect(() => {
    let on = true;
    const fetchTrending = () =>
      fetch("/api/ogdex/screener?type=trending&interval=24h&limit=6")
        .then((r) => r.json())
        .then((d) => { if (on && d?.rows) setTrending(d.rows.filter((x: any) => x.symbol).slice(0, 5)); })
        .catch(() => {});
    const fetchPosts = () =>
      supabase.from("social_messages")
        .select("id,username,content,created_at")
        .eq("channel", "social-general").order("created_at", { ascending: false }).limit(3)
        .then(({ data }) => { if (on && data) setLatestPosts(data as any); });
    fetchTrending();
    fetchPosts();
    const iv = setInterval(() => { fetchTrending(); fetchPosts(); }, 60_000);
    return () => { on = false; clearInterval(iv); };
  }, []);

  /* Animated starfield (skipped for reduced-motion users) */
  useEffect(() => {
    const canvas = starCanvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const stars = Array.from({ length: 110 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 1.3 + 0.25,
      s: Math.random() * 0.14 + 0.03,
      tw: Math.random() * Math.PI * 2,
    }));
    let shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
    const onResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize);
    const tick = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const st of stars) {
        st.y += st.s;
        if (st.y > h) { st.y = -2; st.x = Math.random() * w; }
        const a = 0.35 + 0.3 * Math.sin(t / 900 + st.tw);
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fill();
      }
      if (!shoot && Math.random() < 0.0035) {
        shoot = { x: Math.random() * w * 0.7 + w * 0.15, y: Math.random() * h * 0.3, vx: 7 + Math.random() * 5, vy: 3 + Math.random() * 2, life: 1 };
      }
      if (shoot) {
        shoot.x += shoot.vx; shoot.y += shoot.vy; shoot.life -= 0.02;
        ctx.strokeStyle = `rgba(180,215,255,${Math.max(0, shoot.life) * 0.8})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(shoot.x, shoot.y);
        ctx.lineTo(shoot.x - shoot.vx * 5, shoot.y - shoot.vy * 5);
        ctx.stroke();
        if (shoot.life <= 0 || shoot.x > w + 80) shoot = null;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);

  /* Mouse parallax on the wallpaper */
  useEffect(() => {
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = desktopRef.current;
        if (!el) return;
        const nx = (e.clientX / window.innerWidth - 0.5) * 2;
        const ny = (e.clientY / window.innerHeight - 0.5) * 2;
        el.style.setProperty("--par-x", `${nx * -9}px`);
        el.style.setProperty("--par-y", `${ny * -6}px`);
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);

  /* Wallpaper picker (shared by dock + context menu) */
  const pickWallpaper = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event: any) => {
        localStorage.setItem("hub-wallpaper", event.target.result);
        window.location.reload();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, []);

  const openApp = useCallback((app: App | typeof CENTER_TABS[0]) => {
    if (launching) return;
    setLaunching(app as App);
    window.setTimeout(() => {
      if ("action" in app) {
        if (app.action === "logout") logout();
        else if (app.action === "wallpaper") {
          pickWallpaper();
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
  }, [launching, logout, pickWallpaper]);

  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const apps = getApps();
  const mid = Math.ceil(apps.length / 2);
  const leftApps = apps.slice(0, mid);
  const rightApps = apps.slice(mid);

  return (
    <div className="mac-os">
      <style>{css + aiWidgetCSS}</style>

      {/* ── DESKTOP ── */}
      <div
        ref={desktopRef}
        className={`desktop ${booted ? "desktop-ready" : ""}`}
        onClick={() => setCtxMenu(null)}
        onContextMenu={(e) => {
          if ((e.target as HTMLElement).closest(".mac-dock-container, .menu-bar")) return;
          e.preventDefault();
          setCtxMenu({ x: Math.min(e.clientX, window.innerWidth - 230), y: Math.min(e.clientY, window.innerHeight - 220) });
        }}
      >
        <div className="wallpaper" aria-hidden style={{ backgroundImage: `url('${localStorage.getItem('hub-wallpaper') || ''}')`, transform: "translate(var(--par-x, 0), var(--par-y, 0)) scale(1.03)" }}>
          <div className="wp-image" />
          <div className="wp-overlay" />
        </div>
        <div className="aurora" aria-hidden>
          <div className="aurora-blob aurora-a" />
          <div className="aurora-blob aurora-b" />
          <div className="aurora-blob aurora-c" />
        </div>
        <canvas ref={starCanvasRef} className="starfield" aria-hidden />

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
            {solPrice != null && (
              <span className="mb-sol" title="Solana price (live, 24h change)">
                <span className="mb-sol-dot" /> SOL ${solPrice >= 1000 ? solPrice.toFixed(0) : solPrice.toFixed(2)}
                {solChange != null && (
                  <b style={{ color: solChange >= 0 ? "#34d399" : "#fb7185", marginLeft: 2 }}>
                    {solChange >= 0 ? "+" : ""}{solChange.toFixed(1)}%
                  </b>
                )}
              </span>
            )}
            <button className="mb-search" title="Search apps (⌘K)" onClick={() => { setSpotlightOpen(true); setSpotQ(""); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            </button>
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
          <div className="hub-greeting">
            <p className="hub-greet-line">
              {(() => { const h = now.getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; })()}
              {profile?.username ? `, ${profile.username}` : ""}
            </p>
            <p className="hub-greet-sub">Press <kbd>⌘K</kbd> to search · right-click for options</p>
          </div>

          <MobileWidgetGrid
            solPrice={solPrice}
            solChange={solChange}
            trending={trending}
            widgets={customWidgets}
            setWidgets={setCustomWidgets}
            onOpenPanel={() => setPanelOpen(true)}
          />

          <div className="desktop-flex">
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

            {/* ── Desktop widgets ── */}
            <aside className="widgets-col">
              <div className="wg wg-clock">
                <div className="wg-clock-time">{time}</div>
                <div className="wg-clock-date">{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
              </div>

              <div className="wg">
                <div className="wg-head">
                  <span className="wg-title">◎ Solana</span>
                  <span className="wg-live"><i />LIVE</span>
                </div>
                <div className="wg-sol-price">{solPrice != null ? `$${solPrice >= 1000 ? solPrice.toFixed(0) : solPrice.toFixed(2)}` : "—"}</div>
                {solChange != null && (
                  <div className="wg-sol-change" style={{ color: solChange >= 0 ? "#34d399" : "#fb7185" }}>
                    {solChange >= 0 ? "▲" : "▼"} {Math.abs(solChange).toFixed(2)}% today
                  </div>
                )}
              </div>

              <div className="wg">
                <div className="wg-head">
                  <span className="wg-title">🔥 Trending</span>
                  <a className="wg-link" href="/ORBITX_DEX">Open DEX</a>
                </div>
                {trending.length === 0 ? (
                  <div className="wg-empty">Loading market…</div>
                ) : trending.map((t, i) => {
                  const up = (t.change24h ?? 0) >= 0;
                  const mag = Math.min(100, Math.abs(t.change24h ?? 0));
                  return (
                    <a key={t.mint} className="wg-row" href="/ORBITX_DEX">
                      <span className="wg-rank">{i + 1}</span>
                      <span className="wg-sym">${t.symbol}</span>
                      <span className="wg-bar"><i style={{ width: `${Math.max(8, mag)}%`, background: up ? "#34d399" : "#fb7185" }} /></span>
                      <span className="wg-chg" style={{ color: up ? "#34d399" : "#fb7185" }}>{up ? "+" : ""}{(t.change24h ?? 0).toFixed(0)}%</span>
                    </a>
                  );
                })}
              </div>

              <div className="wg">
                <div className="wg-head">
                  <span className="wg-title">💬 Community</span>
                  <a className="wg-link" href="/social">Open</a>
                </div>
                {latestPosts.length === 0 ? (
                  <div className="wg-empty">No posts yet — say gm</div>
                ) : latestPosts.map((post) => (
                  <a key={post.id} className="wg-post" href="/social">
                    <span className="wg-post-user">@{post.username || "anon"}</span>
                    <span className="wg-post-text">{post.content.length > 64 ? post.content.slice(0, 64) + "…" : post.content}</span>
                    <span className="wg-post-time">{wgTimeAgo(post.created_at)}</span>
                  </a>
                ))}
              </div>
            </aside>
          </div>
        </main>

        {/* macOS Dock — desktop only, hidden on mobile via CSS */}
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

      {panelOpen && (
        <AIWidgetPanel
          onClose={() => setPanelOpen(false)}
          widgets={customWidgets}
          setWidgets={setCustomWidgets}
        />
      )}

      {/* ── CONTEXT MENU ── */}
      {ctxMenu && (
        <div className="ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { setCtxMenu(null); setSpotlightOpen(true); setSpotQ(""); }}>🔍 Search apps <span>⌘K</span></button>
          <button onClick={() => { setCtxMenu(null); pickWallpaper(); }}>🖼️ Change wallpaper</button>
          <button onClick={() => { setCtxMenu(null); localStorage.removeItem("hub-wallpaper"); window.location.reload(); }}>✨ Reset wallpaper</button>
          <div className="ctx-sep" />
          <button onClick={() => { setCtxMenu(null); setPanelOpen(true); }}>✦ Widget Studio</button>
          <button onClick={() => { setCtxMenu(null); localStorage.removeItem(DOCK_KEY); window.location.reload(); }}>♻️ Reset icon layout</button>
          <button onClick={() => { setCtxMenu(null); window.location.reload(); }}>🔄 Refresh</button>
        </div>
      )}

      {/* ── SPOTLIGHT (⌘K) ── */}
      {spotlightOpen && !launching && (
        <div className="spotlight-overlay" onClick={() => setSpotlightOpen(false)}>
          <div className="spotlight" onClick={(e) => e.stopPropagation()}>
            <div className="spotlight-input-row">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
              <input
                autoFocus
                value={spotQ}
                onChange={(e) => setSpotQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const q = spotQ.trim().toLowerCase();
                    const hit = ALL_APPS.find((a) => !q || a.name.toLowerCase().includes(q) || a.caption.toLowerCase().includes(q));
                    if (hit) { setSpotlightOpen(false); openApp(hit); }
                  }
                }}
                placeholder="Search apps…"
              />
              <span className="spotlight-esc">esc</span>
            </div>
            <div className="spotlight-results">
              {ALL_APPS.filter((a) => {
                const q = spotQ.trim().toLowerCase();
                return !q || a.name.toLowerCase().includes(q) || a.caption.toLowerCase().includes(q);
              }).map((a) => (
                <button key={a.key} className="spotlight-item" onClick={() => { setSpotlightOpen(false); openApp(a); }}>
                  <span className="spotlight-item-icon" style={{ background: a.iconBg }}>{a.glyph}</span>
                  <span className="spotlight-item-name">{a.name}</span>
                  <span className="spotlight-item-cap">{a.caption}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
      <MobileNav onOpenPanel={() => setPanelOpen(true)} />
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
/* ── Hub upgrades: greeting, SOL chip, spotlight ── */
.hub-greeting{text-align:center;margin:14px 0 4px;animation:fadeSlide .5s ease both}
.hub-greet-line{font-size:22px;font-weight:800;color:#fff;letter-spacing:-.02em;text-shadow:0 2px 16px rgba(0,0,0,.6)}
.hub-greet-sub{margin-top:4px;font-size:11px;font-weight:600;color:rgba(255,255,255,.42)}
.hub-greet-sub kbd{padding:2px 6px;border-radius:6px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);font-size:10px}
@keyframes fadeSlide{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.mb-sol{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:99px;border:1px solid rgba(52,211,153,.25);background:rgba(52,211,153,.09);color:#6ee7b7;font-size:11px;font-weight:800;letter-spacing:.02em}
.mb-sol-dot{width:5px;height:5px;border-radius:99px;background:#34d399;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.mb-search{display:grid;place-items:center;width:24px;height:24px;border:0;border-radius:7px;background:transparent;color:rgba(255,255,255,.65);cursor:pointer;transition:background .15s}
.mb-search:hover{background:rgba(255,255,255,.12)}
.spotlight-overlay{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.45);backdrop-filter:blur(8px);display:flex;justify-content:center;padding-top:18vh;animation:fadeSlide .18s ease both}
.spotlight{width:min(560px,92vw);height:fit-content;border-radius:18px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(180deg,rgba(28,30,36,.96),rgba(16,17,21,.97));box-shadow:0 32px 90px rgba(0,0,0,.75),inset 0 1px 0 rgba(255,255,255,.08);overflow:hidden}
.spotlight-input-row{display:flex;align-items:center;gap:11px;padding:15px 17px;color:rgba(255,255,255,.5);border-bottom:1px solid rgba(255,255,255,.07)}
.spotlight-input-row input{flex:1;border:0;outline:0;background:transparent;color:#fff;font-size:17px;font-weight:600}
.spotlight-input-row input::placeholder{color:rgba(255,255,255,.3)}
.spotlight-esc{font-size:10px;font-weight:700;padding:3px 7px;border-radius:6px;border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.4)}
.spotlight-results{max-height:320px;overflow-y:auto;padding:7px}
.spotlight-item{display:flex;align-items:center;gap:12px;width:100%;padding:9px 11px;border:0;border-radius:12px;background:transparent;cursor:pointer;transition:background .12s;text-align:left}
.spotlight-item:hover{background:rgba(47,128,255,.14)}
.spotlight-item-icon{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;color:#fff;flex-shrink:0}
.spotlight-item-icon svg{width:20px;height:20px}
.spotlight-item-name{font-size:14px;font-weight:800;color:#fff}
.spotlight-item-cap{margin-left:auto;font-size:11px;font-weight:600;color:rgba(255,255,255,.35)}

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

@media (max-width: 767px) {
  .mac-dock-container { display: none !important; }
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


/* ═══ 20x DESKTOP UPGRADE ═══ */

/* Aurora atmosphere */
.aurora{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1}
.aurora-blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:.5;will-change:transform}
.aurora-a{width:52vw;height:52vw;left:-12vw;top:-18vw;background:radial-gradient(circle,rgba(47,128,255,.32),transparent 65%);animation:auraA 26s ease-in-out infinite}
.aurora-b{width:46vw;height:46vw;right:-10vw;top:8vh;background:radial-gradient(circle,rgba(153,69,255,.28),transparent 65%);animation:auraB 32s ease-in-out infinite}
.aurora-c{width:40vw;height:40vw;left:28vw;bottom:-16vw;background:radial-gradient(circle,rgba(20,224,200,.16),transparent 65%);animation:auraA 38s ease-in-out infinite reverse}
@keyframes auraA{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(6vw,4vh) scale(1.15)}}
@keyframes auraB{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-5vw,6vh) scale(1.12)}}
@media (prefers-reduced-motion: reduce){.aurora-blob{animation:none}}

/* Starfield canvas sits above aurora, below UI */
.starfield{position:absolute;inset:0;z-index:2;pointer-events:none}

/* Layout: icons + widgets side by side */
.desktop-flex{display:flex;gap:26px;align-items:flex-start;justify-content:center;width:100%;max-width:1180px;margin:0 auto;padding:0 18px}
.widgets-col{display:none;flex-direction:column;gap:14px;width:290px;flex-shrink:0;animation:fadeSlide .6s .15s ease both}
@media(min-width:1024px){.widgets-col{display:flex}}

/* Widget cards */
.wg{border-radius:20px;border:1px solid rgba(255,255,255,.12);background:linear-gradient(160deg,rgba(30,34,44,.62),rgba(12,14,18,.72));backdrop-filter:blur(22px) saturate(150%);box-shadow:0 18px 50px -22px rgba(0,0,0,.75),inset 0 1px 0 rgba(255,255,255,.08);padding:15px 16px;transition:transform .2s ease,border-color .2s ease}
.wg:hover{transform:translateY(-2px);border-color:rgba(47,128,255,.32)}
.wg-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}
.wg-title{font-size:12px;font-weight:800;letter-spacing:.04em;color:rgba(255,255,255,.85)}
.wg-link{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#5aa2ff;text-decoration:none}
.wg-link:hover{color:#8ec1ff}
.wg-live{display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:900;letter-spacing:.12em;color:#34d399}
.wg-live i{width:5px;height:5px;border-radius:99px;background:#34d399;animation:pulse 2s infinite}
.wg-empty{font-size:11px;color:rgba(255,255,255,.35);padding:8px 0}

/* Clock widget */
.wg-clock{text-align:center;padding:18px 16px}
.wg-clock-time{font-size:34px;font-weight:900;letter-spacing:-.03em;color:#fff;text-shadow:0 2px 24px rgba(47,128,255,.35);font-variant-numeric:tabular-nums}
.wg-clock-date{margin-top:2px;font-size:12px;font-weight:600;color:rgba(255,255,255,.5)}

/* SOL widget */
.wg-sol-price{font-size:30px;font-weight:900;letter-spacing:-.02em;color:#fff;font-variant-numeric:tabular-nums}
.wg-sol-change{margin-top:2px;font-size:12px;font-weight:800}

/* Trending rows */
.wg-row{display:flex;align-items:center;gap:8px;padding:6px 0;text-decoration:none;border-radius:8px}
.wg-row:hover .wg-sym{color:#8ec1ff}
.wg-rank{width:14px;font-size:10px;font-weight:900;color:rgba(255,255,255,.3);text-align:center}
.wg-sym{width:74px;font-size:12px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .15s}
.wg-bar{flex:1;height:5px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden}
.wg-bar i{display:block;height:100%;border-radius:99px;transition:width .6s ease}
.wg-chg{width:46px;text-align:right;font-size:11px;font-weight:900;font-variant-numeric:tabular-nums}

/* Community posts */
.wg-post{display:block;padding:7px 0;border-top:1px solid rgba(255,255,255,.05);text-decoration:none}
.wg-post:first-of-type{border-top:0}
.wg-post-user{font-size:11px;font-weight:900;color:#5aa2ff;margin-right:6px}
.wg-post-text{font-size:11.5px;color:rgba(255,255,255,.7);line-height:1.45}
.wg-post-time{display:block;margin-top:2px;font-size:9px;font-weight:700;color:rgba(255,255,255,.28);text-transform:uppercase;letter-spacing:.08em}

/* Icon hover: 3D lift + tone glow */
.desktop-icon-wrapper .mac-icon{transition:transform .22s cubic-bezier(.34,1.56,.64,1),box-shadow .25s ease}
.desktop-icon-wrapper:hover .mac-icon{transform:translateY(-7px) scale(1.09) rotateX(6deg);box-shadow:0 22px 44px -14px rgba(0,0,0,.8),0 0 34px -6px rgba(47,128,255,.4)}
.desktop-icon-wrapper:active .mac-icon{transform:translateY(-2px) scale(1.02)}

/* Dock magnification (pure CSS neighbor scaling) */
.dock-center-item{transition:transform .2s cubic-bezier(.34,1.56,.64,1)}
.dock-center-item:hover{transform:translateY(-12px) scale(1.35);z-index:2}
.dock-center-item:hover + .dock-center-item{transform:translateY(-5px) scale(1.14)}
.dock-center-item:has(+ .dock-center-item:hover){transform:translateY(-5px) scale(1.14)}

/* Context menu */
.ctx-menu{position:fixed;z-index:95;min-width:210px;padding:6px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(180deg,rgba(34,37,45,.97),rgba(18,20,25,.97));backdrop-filter:blur(24px);box-shadow:0 24px 60px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.08);animation:fadeSlide .14s ease both}
.ctx-menu button{display:flex;align-items:center;justify-content:flex-start;gap:8px;width:100%;padding:8px 11px;border:0;border-radius:9px;background:transparent;color:rgba(255,255,255,.85);font-size:12.5px;font-weight:700;cursor:pointer;text-align:left}
.ctx-menu button:hover{background:rgba(47,128,255,.22);color:#fff}
.ctx-menu button span{margin-left:auto;font-size:10px;color:rgba(255,255,255,.35)}
.ctx-sep{height:1px;margin:5px 8px;background:rgba(255,255,255,.09)}
`;
