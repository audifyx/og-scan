import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  AIWidgetPanel,
  MobileWidgetGrid,
  aiWidgetCSS,
  readWidgets,
  writeWidgets,
  type WidgetConfig,
} from "@/components/AIWidgetPanel";
import { loadWidgetsFromCloud, saveWidgetsToCloud } from "@/lib/widgetSync";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { ADMIN_APPS } from "@/lib/adminApps";
import { OWNER_EMAIL, isOwnerIdentity } from "@/lib/ownerDesk";
import { OGSCAN_TOKEN_MINT } from "@/lib/og";
import { useOrbitAtmosphere } from "@/hooks/useOrbitAtmosphere";
import "./hub-ios.css";

const ORBITX_CA = OGSCAN_TOKEN_MINT;

type AppItem = {
  key: string;
  name: string;
  caption: string;
  href: string;
  external?: boolean;
  tone: string;
  iconBg: string;
  glyph: ReactNode;
};

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
    </svg>
  ),
  agent: (
    <svg viewBox="0 0 48 48" fill="none">
      <rect x="10" y="12" width="28" height="24" rx="6" stroke="currentColor" strokeWidth="3.5" />
      <path d="M18 22h12M18 28h8" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 48 48" fill="none">
      <path d="M14 14l20 20M34 14L14 34" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  ),
  koltracker: (
    <svg viewBox="0 0 48 48" fill="none">
      <path d="M24 8c-5 0-9 4-9 9v6l-3 6h24l-3-6v-6c0-5-4-9-9-9z" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 34a4 4 0 008 0" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  ),
  launchpad: (
    <svg viewBox="0 0 48 48" fill="none">
      <path d="M24 6c6 3 10 9 10 17 0 5-2 9-4 12l-6 7-6-7c-2-3-4-7-4-12 0-8 4-14 10-17z" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="20" r="4" stroke="currentColor" strokeWidth="3.5" />
    </svg>
  ),
};

const ALL_APPS: AppItem[] = [
  { key: "dex", name: "OrbitX DEX", caption: "Scanner & Trade", href: "/ORBITX_DEX", tone: "#2F80FF", iconBg: "linear-gradient(135deg, #1A6CFF, #0037A3)", glyph: Glyph.dex },
  { key: "trade", name: "Trade Terminal", caption: "Phantom buy & sell", href: "/trade", tone: "#AB9FF2", iconBg: "linear-gradient(135deg, #AB9FF2, #6B5FD4)", glyph: Glyph.dex },
  { key: "scanner", name: "Scanner", caption: "Forensic scan", href: "/orbitx-scanner", tone: "#14E0C8", iconBg: "linear-gradient(135deg, #00C6B8, #00766E)", glyph: Glyph.scanner },
  { key: "launchpad", name: "Launchpad", caption: "Launch a token", href: "/orbitxlaunch", tone: "#FFC53D", iconBg: "linear-gradient(135deg, #FFC53D, #B8860B)", glyph: Glyph.launchpad },
  { key: "vamp", name: "Anti-Vamp", caption: "Originality checks", href: "/vamp", tone: "#67E8F9", iconBg: "linear-gradient(135deg, #67E8F9, #0891B2)", glyph: <span style={{ fontSize: 20 }}>🛡</span> },
  { key: "koltracker", name: "KOL Tracker", caption: "Wallet alerts", href: "/app/kol-tracker", tone: "#22C55E", iconBg: "linear-gradient(135deg, #16A34A, #065F46)", glyph: Glyph.koltracker },
  { key: "pnltracker", name: "PNL Tracker", caption: "Profit & loss", href: "/app/pnl-tracker", tone: "#F97316", iconBg: "linear-gradient(135deg, #F97316, #B45309)", glyph: <span style={{ fontSize: 20 }}>📈</span> },
  { key: "ai", name: "AI Assistant", caption: "Help & support", href: "/ai-chat", tone: "#38BDF8", iconBg: "linear-gradient(135deg, #38BDF8, #0284C7)", glyph: Glyph.ai },
  { key: "agent", name: "Agent MCP", caption: "Claude · ChatGPT · Grok", href: "/agent", tone: "#5EEAD4", iconBg: "linear-gradient(135deg, #5EEAD4, #0D9488)", glyph: Glyph.agent },
  { key: "xmcp", name: "X MCP", caption: "Post & NVIDIA agent", href: "/x", tone: "#E7E9EA", iconBg: "linear-gradient(135deg, #3F3F46, #18181B)", glyph: Glyph.x },
  { key: "shop", name: "Credits shop", caption: "Buy via X MCP · usage", href: "/shop", tone: "#5EEAD4", iconBg: "linear-gradient(135deg, #2DD4BF, #0F766E)", glyph: <span style={{ fontSize: 20 }}>◈</span> },
  { key: "social", name: "Social", caption: "Feed & spaces", href: "/orbitx-social", tone: "#A78BFA", iconBg: "linear-gradient(135deg, #8B5CF6, #5B21B6)", glyph: Glyph.social },
  { key: "gaming", name: "Gaming", caption: "Climb & win", href: "https://degen-tower.vercel.app", external: true, tone: "#FF5BBD", iconBg: "linear-gradient(135deg, #FF3EAA, #B20067)", glyph: Glyph.gaming },
  { key: "predict", name: "Predictions", caption: "Trade YES/NO", href: "/predictions", tone: "#FFC53D", iconBg: "linear-gradient(135deg, #FFB020, #D47900)", glyph: Glyph.predict },
  { key: "nft", name: "NFT Market", caption: "Mint & trade", href: "/nft", tone: "#00FFA3", iconBg: "linear-gradient(135deg, #00FFA3, #00C776)", glyph: <span style={{ fontSize: 20 }}>🖼</span> },
  { key: "bagwork", name: "Bagwork", caption: "Earn USDC", href: "/bagwork", tone: "#F0C75E", iconBg: "linear-gradient(135deg, #F0C75E, #B8860B)", glyph: <span style={{ fontSize: 20 }}>💼</span> },
];

const APP_BY_KEY = Object.fromEntries(ALL_APPS.map((a) => [a.key, a])) as Record<string, AppItem>;

type HubSection = { id: string; title: string; subtitle: string; keys: string[] };

const APP_SECTIONS: HubSection[] = [
  { id: "trade", title: "Trade & Launch", subtitle: "DEX, scanner, and fair launch", keys: ["dex", "trade", "scanner", "launchpad", "vamp"] },
  { id: "intel", title: "Intelligence", subtitle: "Track wallets, PnL, and AI", keys: ["koltracker", "pnltracker", "ai"] },
  { id: "mcp", title: "AI Connectors", subtitle: "Agent + X MCP for chat AIs", keys: ["agent", "xmcp", "shop"] },
  { id: "social", title: "Social", subtitle: "Feed, spaces, and community", keys: ["social"] },
  { id: "play", title: "Play & Earn", subtitle: "Games, markets, NFTs, tasks", keys: ["gaming", "predict", "nft", "bagwork"] },
];

const QUICK_KEYS = ["scanner", "dex", "trade", "agent", "xmcp", "social"];

const OWNER_ADMIN_APPS: AppItem[] = ADMIN_APPS.map((a) => ({
  key: `admin-${a.key}`,
  name: a.label,
  caption: a.caption,
  href: a.to,
  external: a.to.startsWith("http") || a.to.startsWith("/ORBITX_DEX"),
  tone: a.tone,
  iconBg: a.iconBg,
  glyph: <span style={{ fontSize: 18 }}>{a.emoji || "🛡"}</span>,
}));

type TabId = "home" | "apps" | "activity" | "account";

type Frame =
  | { id: "root" }
  | { id: "section"; sectionId: string }
  | { id: "app"; appKey: string }
  | { id: "widgets" }
  | { id: "wallpaper" };

const TABS: { id: TabId; label: string; ico: string }[] = [
  { id: "home", label: "Home", ico: "⌂" },
  { id: "apps", label: "Apps", ico: "▦" },
  { id: "activity", label: "Activity", ico: "◎" },
  { id: "account", label: "Account", ico: "☺" },
];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function NavBar({
  title,
  canBack,
  onBack,
  trail,
}: {
  title: string;
  canBack: boolean;
  onBack: () => void;
  trail?: ReactNode;
}) {
  return (
    <header className="ios-nav">
      {canBack ? (
        <button type="button" className="ios-nav__back" onClick={onBack}>
          <span className="ios-nav__back-ico" aria-hidden>
            ‹
          </span>
          Back
        </button>
      ) : (
        <span />
      )}
      <h1 className="ios-nav__title">{title}</h1>
      <div className="ios-nav__trail">{trail}</div>
    </header>
  );
}

export default function Hub() {
  const now = useClock();
  const { signOut, profile, user } = useAuth();
  const [tab, setTab] = useState<TabId>("home");
  const [stacks, setStacks] = useState<Record<TabId, Frame[]>>({
    home: [{ id: "root" }],
    apps: [{ id: "root" }],
    activity: [{ id: "root" }],
    account: [{ id: "root" }],
  });
  const [navDir, setNavDir] = useState<"push" | "pop">("push");
  const [spotOpen, setSpotOpen] = useState(false);
  const [spotQ, setSpotQ] = useState("");
  const [launching, setLaunching] = useState<AppItem | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [solChange, setSolChange] = useState<number | null>(null);
  const [orbitxPrice, setOrbitxPrice] = useState<number | null>(null);
  const [orbitxChange, setOrbitxChange] = useState<number | null>(null);
  const [caCopied, setCaCopied] = useState(false);
  const [trending, setTrending] = useState<{ mint: string; symbol: string; priceUsd: number | null; change24h: number | null }[]>([]);
  const [latestPosts, setLatestPosts] = useState<{ id: string; username: string | null; content: string; created_at: string }[]>([]);
  const [fng, setFng] = useState<{ v: number; label: string } | null>(null);
  const [customWidgets, setCustomWidgets] = useState<WidgetConfig[]>(readWidgets);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<"chat" | "my" | "lib">("chat");
  const { openTheme, themeOpen, closeTheme } = useOrbitAtmosphere();

  const showAdminApps = useMemo(() => isOwnerIdentity({ email: user?.email }), [user?.email]);
  const searchableApps = useMemo(
    () => (showAdminApps ? [...ALL_APPS, ...OWNER_ADMIN_APPS] : ALL_APPS),
    [showAdminApps],
  );

  const stack = stacks[tab];
  const top = stack[stack.length - 1] || { id: "root" as const };
  const canBack = stack.length > 1;

  const push = useCallback(
    (frame: Frame) => {
      setNavDir("push");
      setStacks((prev) => ({ ...prev, [tab]: [...prev[tab], frame] }));
    },
    [tab],
  );

  const pop = useCallback(() => {
    setNavDir("pop");
    setStacks((prev) => {
      const cur = prev[tab];
      if (cur.length <= 1) return prev;
      return { ...prev, [tab]: cur.slice(0, -1) };
    });
  }, [tab]);

  const switchTab = (id: TabId) => {
    setNavDir("push");
    setTab(id);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const cloud = await loadWidgetsFromCloud();
      if (!alive) return;
      if (cloud && cloud.length > 0) {
        setCustomWidgets(cloud);
        writeWidgets(cloud);
      } else {
        const local = readWidgets();
        if (local.length > 0) await saveWidgetsToCloud(local);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSpotOpen((v) => !v);
        setSpotQ("");
      }
      if (e.key === "Escape") {
        if (spotOpen) {
          setSpotOpen(false);
          return;
        }
        if (panelOpen) {
          setPanelOpen(false);
          return;
        }
        if (themeOpen) {
          closeTheme();
          return;
        }
        if (canBack) pop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canBack, pop, spotOpen, panelOpen, themeOpen, closeTheme]);

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
    return () => {
      on = false;
      clearInterval(iv);
    };
  }, []);

  useEffect(() => {
    let on = true;
    const fetchOrbitx = () =>
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${ORBITX_CA}`)
        .then((r) => r.json())
        .then((j) => {
          if (!on) return;
          const pair = j?.pairs?.[0];
          if (!pair) return;
          setOrbitxPrice(Number(pair.priceUsd) || null);
          setOrbitxChange(pair.priceChange?.h24 != null ? Number(pair.priceChange.h24) : null);
        })
        .catch(() => {});
    fetchOrbitx();
    const iv = setInterval(fetchOrbitx, 30_000);
    return () => {
      on = false;
      clearInterval(iv);
    };
  }, []);

  useEffect(() => {
    let on = true;
    const fetchTrending = () =>
      fetch("/api/ogdex/screener?type=trending&interval=24h&limit=6")
        .then((r) => r.json())
        .then((d) => {
          if (on && d?.rows) setTrending(d.rows.filter((x: { symbol?: string }) => x.symbol).slice(0, 5));
        })
        .catch(() => {});
    const fetchPosts = () =>
      supabase
        .from("social_messages")
        .select("id,username,content,created_at")
        .eq("channel", "social-general")
        .order("created_at", { ascending: false })
        .limit(5)
        .then(({ data }) => {
          if (on && data) setLatestPosts(data as typeof latestPosts);
        });
    fetchTrending();
    fetchPosts();
    const iv = setInterval(() => {
      fetchTrending();
      fetchPosts();
    }, 60_000);
    return () => {
      on = false;
      clearInterval(iv);
    };
  }, []);

  useEffect(() => {
    let on = true;
    fetch("https://api.alternative.me/fng/")
      .then((r) => r.json())
      .then((d) => {
        if (on && d?.data?.[0]) setFng({ v: Number(d.data[0].value), label: d.data[0].value_classification });
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, []);

  const copyCA = () => {
    navigator.clipboard.writeText(ORBITX_CA).catch(() => {});
    setCaCopied(true);
    setTimeout(() => setCaCopied(false), 1600);
  };

  const openAppHref = useCallback((app: AppItem) => {
    setLaunching(app);
    window.setTimeout(() => {
      if (app.external) {
        window.open(app.href, "_blank", "noopener");
        setLaunching(null);
      } else {
        window.location.assign(app.href);
      }
    }, 420);
  }, []);

  const logout = async () => {
    try {
      await signOut();
    } finally {
      window.location.assign("/auth");
    }
  };

  const greet = (() => {
    const h = now.getHours();
    const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    return profile?.username ? `${part}, ${profile.username}` : part;
  })();

  const navTitle = (() => {
    if (top.id === "app") return APP_BY_KEY[top.appKey]?.name || searchableApps.find((a) => a.key === top.appKey)?.name || "App";
    if (top.id === "section") return APP_SECTIONS.find((s) => s.id === top.sectionId)?.title || "Apps";
    if (top.id === "widgets") return "Widgets";
    if (top.id === "wallpaper") return "Wallpaper";
    return TABS.find((t) => t.id === tab)?.label || "OrbitX";
  })();

  const renderAppIcon = (app: AppItem, size: "grid" | "row" | "detail" = "grid") => (
    <div
      className={size === "detail" ? "ios-detail__icon" : size === "row" ? "ios-row__icon" : "ios-app__icon"}
      style={{ background: app.iconBg }}
    >
      {app.glyph}
    </div>
  );

  const appRows = (apps: AppItem[]) => (
    <div className="ios-group">
      {apps.map((app) => (
        <button key={app.key} type="button" className="ios-row" onClick={() => push({ id: "app", appKey: app.key })}>
          {renderAppIcon(app, "row")}
          <span className="ios-row__meta">
            <span className="ios-row__title">{app.name}</span>
            <span className="ios-row__cap">{app.caption}</span>
          </span>
          <span className="ios-row__chev" aria-hidden>
            ›
          </span>
        </button>
      ))}
    </div>
  );

  const rootHome = (
    <>
      <h2 className="ios-large-title">{greet}</h2>
      <p className="ios-subhead">OrbitX hub · tap an app · ⌘K to search</p>
      <div className="ios-chips">
        <button type="button" className="ios-chip" onClick={copyCA}>
          $ORBITX{" "}
          <b style={{ color: (orbitxChange ?? 0) >= 0 ? "var(--ios-ok)" : "var(--ios-danger)" }}>
            {orbitxPrice != null ? (orbitxPrice < 0.01 ? orbitxPrice.toExponential(2) : orbitxPrice.toFixed(6)) : "—"}
          </b>
          <span>{caCopied ? "Copied" : "CA"}</span>
        </button>
        <span className="ios-chip">
          SOL{" "}
          <b style={{ color: (solChange ?? 0) >= 0 ? "var(--ios-ok)" : "var(--ios-danger)" }}>
            {solPrice != null ? `$${solPrice >= 1000 ? solPrice.toFixed(0) : solPrice.toFixed(2)}` : "—"}
          </b>
        </span>
        {fng && (
          <span className="ios-chip">
            F&G <b>{fng.v}</b>
          </span>
        )}
      </div>

      <p className="ios-group__label">Favorites</p>
      <div className="ios-app-grid">
        {QUICK_KEYS.map((k) => {
          const app = APP_BY_KEY[k];
          if (!app) return null;
          return (
            <button key={app.key} type="button" className="ios-app" onClick={() => push({ id: "app", appKey: app.key })}>
              {renderAppIcon(app)}
              <span className="ios-app__name">{app.name}</span>
            </button>
          );
        })}
      </div>

      <p className="ios-group__label">Shortcuts</p>
      <div className="ios-group">
        <button type="button" className="ios-row" onClick={() => switchTab("apps")}>
          <span className="ios-row__meta">
            <span className="ios-row__title">Browse all apps</span>
            <span className="ios-row__cap">Trade, social, MCP, play</span>
          </span>
          <span className="ios-row__chev">›</span>
        </button>
        <button type="button" className="ios-row" onClick={() => push({ id: "widgets" })}>
          <span className="ios-row__meta">
            <span className="ios-row__title">Widgets</span>
            <span className="ios-row__cap">{customWidgets.length} on Home</span>
          </span>
          <span className="ios-row__chev">›</span>
        </button>
        <button type="button" className="ios-row" onClick={() => setSpotOpen(true)}>
          <span className="ios-row__meta">
            <span className="ios-row__title">Search</span>
            <span className="ios-row__cap">Find any tool</span>
          </span>
          <span className="ios-row__chev">›</span>
        </button>
      </div>
    </>
  );

  const rootApps = (
    <>
      <h2 className="ios-large-title">Apps</h2>
      <p className="ios-subhead">Open a category, then launch an app.</p>
      <div className="ios-group">
        {APP_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className="ios-row"
            onClick={() => push({ id: "section", sectionId: section.id })}
          >
            <span className="ios-row__meta">
              <span className="ios-row__title">{section.title}</span>
              <span className="ios-row__cap">{section.subtitle}</span>
            </span>
            <span className="ios-row__value">{section.keys.length}</span>
            <span className="ios-row__chev">›</span>
          </button>
        ))}
        {showAdminApps && (
          <button type="button" className="ios-row" onClick={() => push({ id: "section", sectionId: "admin" })}>
            <span className="ios-row__meta">
              <span className="ios-row__title">Owner Admin</span>
              <span className="ios-row__cap">{OWNER_EMAIL}</span>
            </span>
            <span className="ios-row__chev">›</span>
          </button>
        )}
      </div>
    </>
  );

  const rootActivity = (
    <>
      <h2 className="ios-large-title">Activity</h2>
      <p className="ios-subhead">Markets and community pulse.</p>
      {trending.map((t) => (
        <button
          key={t.mint}
          type="button"
          className="ios-card"
          style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
          onClick={() => window.location.assign(`/ORBITX_DEX?mint=${encodeURIComponent(t.mint)}`)}
        >
          <div className="ios-card__k">Trending</div>
          <div className="ios-card__v">${t.symbol}</div>
          <div className="ios-card__meta" style={{ color: (t.change24h ?? 0) >= 0 ? "var(--ios-ok)" : "var(--ios-danger)" }}>
            {(t.change24h ?? 0) >= 0 ? "+" : ""}
            {(t.change24h ?? 0).toFixed(1)}% · 24h
          </div>
        </button>
      ))}
      {latestPosts.map((p) => (
        <div key={p.id} className="ios-card">
          <div className="ios-card__k">@{p.username || "orbit"}</div>
          <div className="ios-card__meta" style={{ color: "var(--ios-text)", marginTop: 6 }}>
            {p.content.slice(0, 160)}
            {p.content.length > 160 ? "…" : ""}
          </div>
        </div>
      ))}
      {!trending.length && !latestPosts.length && <div className="ios-empty">Loading activity…</div>}
      <button type="button" className="ios-btn ios-btn--ghost" style={{ width: "100%" }} onClick={() => window.location.assign("/orbitx-social")}>
        Open Social
      </button>
    </>
  );

  const rootAccount = (
    <>
      <h2 className="ios-large-title">Account</h2>
      <p className="ios-subhead">Wallet, profile, and MCP connectors.</p>
      <div className="ios-wallet-wrap">
        <WalletConnectButton />
      </div>
      {(profile?.username || user?.email) && (
        <div className="ios-group" style={{ marginBottom: "0.85rem" }}>
          <div className="ios-row" style={{ cursor: "default" }}>
            <span className="ios-row__meta">
              <span className="ios-row__title">{profile?.username ? `@${profile.username}` : "Signed in"}</span>
              <span className="ios-row__cap">{user?.email || "Wallet session"}</span>
            </span>
          </div>
        </div>
      )}
      <div className="ios-group">
        <Link to="/profile" className="ios-row">
          <span className="ios-row__meta">
            <span className="ios-row__title">Profile</span>
            <span className="ios-row__cap">{profile?.username ? `@${profile.username}` : "View profile"}</span>
          </span>
          <span className="ios-row__chev">›</span>
        </Link>
        <Link to="/settings" className="ios-row">
          <span className="ios-row__meta">
            <span className="ios-row__title">Settings</span>
            <span className="ios-row__cap">Preferences & color themes</span>
          </span>
          <span className="ios-row__chev">›</span>
        </Link>
        <a href="/ORBITX_DEX" className="ios-row">
          <span className="ios-row__meta">
            <span className="ios-row__title">OrbitX DEX</span>
            <span className="ios-row__cap">Terminal & scanner</span>
          </span>
          <span className="ios-row__chev">›</span>
        </a>
        <Link to="/orbitxlaunch" className="ios-row">
          <span className="ios-row__meta">
            <span className="ios-row__title">Launchpad</span>
            <span className="ios-row__cap">Create & trade coins</span>
          </span>
          <span className="ios-row__chev">›</span>
        </Link>
        <Link to="/nft" className="ios-row">
          <span className="ios-row__meta">
            <span className="ios-row__title">NFT Market</span>
            <span className="ios-row__cap">Mint & trade</span>
          </span>
          <span className="ios-row__chev">›</span>
        </Link>
        <Link to="/agent" className="ios-row">
          <span className="ios-row__meta">
            <span className="ios-row__title">Agent MCP</span>
            <span className="ios-row__cap">Connect Claude / ChatGPT / Grok</span>
          </span>
          <span className="ios-row__chev">›</span>
        </Link>
        <Link to="/x" className="ios-row">
          <span className="ios-row__meta">
            <span className="ios-row__title">X MCP</span>
            <span className="ios-row__cap">Post & agent on X</span>
          </span>
          <span className="ios-row__chev">›</span>
        </Link>
        <Link to="/orbitx-social" className="ios-row">
          <span className="ios-row__meta">
            <span className="ios-row__title">Social</span>
            <span className="ios-row__cap">Feed & spaces</span>
          </span>
          <span className="ios-row__chev">›</span>
        </Link>
      </div>
      <div className="ios-group">
        <button type="button" className="ios-row" onClick={() => push({ id: "wallpaper" })}>
          <span className="ios-row__meta">
            <span className="ios-row__title">Wallpaper</span>
            <span className="ios-row__cap">Background & atmosphere</span>
          </span>
          <span className="ios-row__chev">›</span>
        </button>
        <button type="button" className="ios-row" onClick={() => push({ id: "widgets" })}>
          <span className="ios-row__meta">
            <span className="ios-row__title">Widgets</span>
            <span className="ios-row__cap">Customize home widgets</span>
          </span>
          <span className="ios-row__chev">›</span>
        </button>
      </div>
      <button type="button" className="ios-btn ios-btn--danger" style={{ width: "100%" }} onClick={logout}>
        Log Out
      </button>
    </>
  );

  let body: ReactNode = null;
  if (top.id === "root") {
    body = tab === "home" ? rootHome : tab === "apps" ? rootApps : tab === "activity" ? rootActivity : rootAccount;
  } else if (top.id === "section") {
    const section =
      top.sectionId === "admin"
        ? { id: "admin", title: "Owner Admin", subtitle: OWNER_EMAIL, keys: OWNER_ADMIN_APPS.map((a) => a.key) }
        : APP_SECTIONS.find((s) => s.id === top.sectionId);
    const apps =
      top.sectionId === "admin"
        ? OWNER_ADMIN_APPS
        : (section?.keys || []).map((k) => APP_BY_KEY[k]).filter(Boolean);
    body = (
      <>
        <h2 className="ios-large-title">{section?.title || "Apps"}</h2>
        <p className="ios-subhead">{section?.subtitle}</p>
        {appRows(apps)}
      </>
    );
  } else if (top.id === "app") {
    const app = APP_BY_KEY[top.appKey] || searchableApps.find((a) => a.key === top.appKey);
    body = app ? (
      <div className="ios-detail">
        {renderAppIcon(app, "detail")}
        <h2 className="ios-detail__name">{app.name}</h2>
        <p className="ios-detail__cap">{app.caption}</p>
        <div className="ios-btn-row">
          <button type="button" className="ios-btn ios-btn--primary" onClick={() => openAppHref(app)}>
            {app.external ? "Open ↗" : "Open"}
          </button>
          <button type="button" className="ios-btn ios-btn--ghost" onClick={pop}>
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <div className="ios-empty">App not found</div>
    );
  } else if (top.id === "widgets") {
    body = (
      <>
        <h2 className="ios-large-title">Widgets</h2>
        <p className="ios-subhead">Pin market and community widgets.</p>
        <MobileWidgetGrid
          solPrice={solPrice}
          solChange={solChange}
          trending={trending}
          widgets={customWidgets}
          setWidgets={setCustomWidgets}
          onOpenPanel={() => {
            setPanelTab("chat");
            setPanelOpen(true);
          }}
        />
        <button
          type="button"
          className="ios-btn ios-btn--primary"
          style={{ width: "100%", marginTop: 12 }}
          onClick={() => {
            setPanelTab("lib");
            setPanelOpen(true);
          }}
        >
          Widget library
        </button>
      </>
    );
  } else if (top.id === "wallpaper") {
    body = (
      <>
        <h2 className="ios-large-title">Wallpaper</h2>
        <p className="ios-subhead">Applies across Hub, DEX, Launchpad, NFT, Agent, X, and more.</p>
        <button type="button" className="ios-btn ios-btn--primary" style={{ width: "100%" }} onClick={openTheme}>
          Customize platform theme
        </button>
      </>
    );
  }

  return (
    <div className="ios-hub">
      <style>{aiWidgetCSS}</style>
      <div className="ios-hub__atmosphere" aria-hidden />

      <div className="ios-hub__stage">
        <div className="ios-stack">
          <div key={`${tab}-${stack.length}-${top.id}`} className={`ios-stack__pane${navDir === "pop" ? " is-back" : ""}`}>
            <NavBar
              title={canBack ? navTitle : "OrbitX"}
              canBack={canBack}
              onBack={pop}
              trail={
                <>
                  <button type="button" className="ios-nav__btn" onClick={openTheme} aria-label="Theme">
                    🎨
                  </button>
                  <button type="button" className="ios-nav__btn" onClick={() => setSpotOpen(true)} aria-label="Search">
                    ⌕
                  </button>
                </>
              }
            />
            <div className="ios-body">{body}</div>
          </div>
        </div>
      </div>

      <nav className="ios-tabbar" aria-label="OrbitX tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`ios-tab${tab === t.id ? " is-on" : ""}`}
            onClick={() => switchTab(t.id)}
          >
            <span className="ios-tab__ico" aria-hidden>
              {t.ico}
            </span>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="ios-home-ind" aria-hidden />

      {spotOpen && (
        <div className="ios-sheet" onClick={() => setSpotOpen(false)}>
          <div className="ios-sheet__card" onClick={(e) => e.stopPropagation()}>
            <div className="ios-sheet__search">
              <input
                className="ios-sheet__input"
                autoFocus
                value={spotQ}
                onChange={(e) => setSpotQ(e.target.value)}
                placeholder="Search apps…"
              />
              <button type="button" className="ios-nav__btn" onClick={() => setSpotOpen(false)}>
                Cancel
              </button>
            </div>
            <div className="ios-sheet__results">
              {searchableApps
                .filter((a) => {
                  const q = spotQ.trim().toLowerCase();
                  return !q || a.name.toLowerCase().includes(q) || a.caption.toLowerCase().includes(q);
                })
                .map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    className="ios-row"
                    onClick={() => {
                      setSpotOpen(false);
                      setTab("apps");
                      setStacks((prev) => ({ ...prev, apps: [{ id: "root" }, { id: "app", appKey: a.key }] }));
                      setNavDir("push");
                    }}
                  >
                    {renderAppIcon(a, "row")}
                    <span className="ios-row__meta">
                      <span className="ios-row__title">{a.name}</span>
                      <span className="ios-row__cap">{a.caption}</span>
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {launching && (
        <div className="ios-launch">
          <div className="ios-launch__card">
            <div className="ios-detail__icon" style={{ background: launching.iconBg }}>
              {launching.glyph}
            </div>
            <div style={{ fontWeight: 700 }}>{launching.name}</div>
          </div>
        </div>
      )}

      {panelOpen && (
        <AIWidgetPanel
          key={panelTab}
          initialTab={panelTab}
          onClose={() => setPanelOpen(false)}
          widgets={customWidgets}
          setWidgets={setCustomWidgets}
        />
      )}
    </div>
  );
}
