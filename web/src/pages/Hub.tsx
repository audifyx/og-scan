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
import {
  HOME_DOCK,
  HOME_GRID_KEYS,
  PLATFORM_APPS,
  PLATFORM_BY_KEY,
  PLATFORM_SECTIONS,
  type PlatformApp,
} from "@/lib/orbitxPlatforms";
import "./hub-ios.css";

const ORBITX_CA = OGSCAN_TOKEN_MINT;

type AppItem = PlatformApp;

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

const TABS: { id: TabId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "apps", label: "Apps" },
  { id: "activity", label: "Activity" },
  { id: "account", label: "Me" },
];

const TAB_GLYPH: Record<TabId, ReactNode> = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  apps: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 16l5-6 4 3 7-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity=".4" />
    </svg>
  ),
  account: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 19c1.4-3.2 3.8-5 7-5s5.6 1.8 7 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
};

function IosStatusBar({ now }: { now: Date }) {
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <div className="ios26-status" aria-hidden>
      <span className="ios26-status__time">{time}</span>
      <span className="ios26-status__island" />
      <span className="ios26-status__sys">
        <svg viewBox="0 0 18 12" className="ios26-status__sig">
          <rect x="0" y="8" width="3" height="4" rx="0.6" fill="currentColor" opacity=".35" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="0.6" fill="currentColor" opacity=".55" />
          <rect x="10" y="3" width="3" height="9" rx="0.6" fill="currentColor" opacity=".8" />
          <rect x="15" y="0" width="3" height="12" rx="0.6" fill="currentColor" />
        </svg>
        <svg viewBox="0 0 16 12" className="ios26-status__wifi">
          <path d="M1 4.2C4.2 1.4 11.8 1.4 15 4.2M3.4 6.6c2.2-1.8 6.9-1.8 9.1 0M6.2 9c1.1-.9 2.5-.9 3.6 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
        <span className="ios26-status__batt">
          <span className="ios26-status__batt-body">
            <span className="ios26-status__batt-fill" />
          </span>
          <span className="ios26-status__batt-nip" />
        </span>
      </span>
    </div>
  );
}

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
  home,
}: {
  title: string;
  canBack: boolean;
  onBack: () => void;
  trail?: ReactNode;
  home?: boolean;
}) {
  return (
    <header className={`ios-nav${home && !canBack ? " ios-nav--home" : ""}`}>
      {canBack ? (
        <button type="button" className="ios-nav__back" onClick={onBack}>
          <span className="ios-nav__back-ico" aria-hidden>
            ‹
          </span>
          Back
        </button>
      ) : home ? (
        <div className="ios26-brand">
          <span className="ios26-brand__mark" aria-hidden>
            ◈
          </span>
          <span className="ios26-brand__name">OrbitX</span>
        </div>
      ) : (
        <span />
      )}
      {!home || canBack ? <h1 className="ios-nav__title">{title}</h1> : <span />}
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
    () => (showAdminApps ? [...PLATFORM_APPS, ...OWNER_ADMIN_APPS] : PLATFORM_APPS),
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
    if (top.id === "app") return PLATFORM_BY_KEY[top.appKey]?.name || searchableApps.find((a) => a.key === top.appKey)?.name || "App";
    if (top.id === "section") return PLATFORM_SECTIONS.find((s) => s.id === top.sectionId)?.title || "Apps";
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
      <div className="ios26-hello">
        <p className="ios26-hello__greet">{greet}</p>
        <p className="ios26-hello__sub">Tap an app · ⌘K to search</p>
      </div>

      <div className="ios26-widgets">
        <button type="button" className="ios26-widget" onClick={copyCA}>
          <span className="ios26-widget__k">$ORBITX</span>
          <span
            className="ios26-widget__v"
            style={{ color: (orbitxChange ?? 0) >= 0 ? "var(--ios-ok)" : "var(--ios-danger)" }}
          >
            {orbitxPrice != null ? (orbitxPrice < 0.01 ? orbitxPrice.toExponential(2) : orbitxPrice.toFixed(6)) : "—"}
          </span>
          <span className="ios26-widget__m">{caCopied ? "Copied CA" : "Tap to copy CA"}</span>
        </button>
        <div className="ios26-widget">
          <span className="ios26-widget__k">SOL</span>
          <span
            className="ios26-widget__v"
            style={{ color: (solChange ?? 0) >= 0 ? "var(--ios-ok)" : "var(--ios-danger)" }}
          >
            {solPrice != null ? `$${solPrice >= 1000 ? solPrice.toFixed(0) : solPrice.toFixed(2)}` : "—"}
          </span>
          <span className="ios26-widget__m">
            {solChange != null ? `${solChange >= 0 ? "+" : ""}${solChange.toFixed(1)}% 24h` : "Live"}
          </span>
        </div>
        <div className="ios26-widget">
          <span className="ios26-widget__k">Fear & Greed</span>
          <span className="ios26-widget__v">{fng ? fng.v : "—"}</span>
          <span className="ios26-widget__m">{fng?.label || "Market mood"}</span>
        </div>
      </div>

      <div className="ios-app-grid">
        {HOME_GRID_KEYS.map((k) => {
          const app = PLATFORM_BY_KEY[k];
          if (!app) return null;
          return (
            <button key={app.key} type="button" className="ios-app" onClick={() => push({ id: "app", appKey: app.key })}>
              {renderAppIcon(app)}
              <span className="ios-app__name">{app.name}</span>
            </button>
          );
        })}
      </div>

      <div className="ios26-dock" aria-label="Home dock">
        {HOME_DOCK.map((app) => (
          <button
            key={app.key}
            type="button"
            className="ios-app ios-app--dock"
            aria-label={app.name}
            onClick={() => push({ id: "app", appKey: app.key })}
          >
            {renderAppIcon(app)}
          </button>
        ))}
      </div>
    </>
  );

  const rootApps = (
    <>
      <h2 className="ios-large-title">Apps</h2>
      <p className="ios-subhead">Open a category, then launch an app.</p>
      <div className="ios-group">
        {PLATFORM_SECTIONS.map((section) => (
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
        <Link to="/shop" className="ios-row">
          <span className="ios-row__meta">
            <span className="ios-row__title">Shop</span>
            <span className="ios-row__cap">Credits + burn access</span>
          </span>
          <span className="ios-row__chev">›</span>
        </Link>
        <Link to="/os" className="ios-row">
          <span className="ios-row__meta">
            <span className="ios-row__title">OrbitX OS</span>
            <span className="ios-row__cap">Desktop launcher</span>
          </span>
          <span className="ios-row__chev">›</span>
        </Link>
        <Link to="/Orbitxcity" className="ios-row">
          <span className="ios-row__meta">
            <span className="ios-row__title">City</span>
            <span className="ios-row__cap">3D OrbitX city</span>
          </span>
          <span className="ios-row__chev">›</span>
        </Link>
        <Link to="/play" className="ios-row">
          <span className="ios-row__meta">
            <span className="ios-row__title">Play</span>
            <span className="ios-row__cap">Games & missions</span>
          </span>
          <span className="ios-row__chev">›</span>
        </Link>
        <Link to="/intel" className="ios-row">
          <span className="ios-row__meta">
            <span className="ios-row__title">Intel</span>
            <span className="ios-row__cap">Crypto intelligence</span>
          </span>
          <span className="ios-row__chev">›</span>
        </Link>
        <Link to="/predictions" className="ios-row">
          <span className="ios-row__meta">
            <span className="ios-row__title">Predictions</span>
            <span className="ios-row__cap">Trade YES / NO</span>
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
        <Link to="/hq" className="ios-row">
          <span className="ios-row__meta">
            <span className="ios-row__title">HQ</span>
            <span className="ios-row__cap">Social headquarters</span>
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
        : PLATFORM_SECTIONS.find((s) => s.id === top.sectionId);
    const apps =
      top.sectionId === "admin"
        ? OWNER_ADMIN_APPS
        : (section?.keys || []).map((k) => PLATFORM_BY_KEY[k]).filter(Boolean);
    body = (
      <>
        <h2 className="ios-large-title">{section?.title || "Apps"}</h2>
        <p className="ios-subhead">{section?.subtitle}</p>
        {appRows(apps)}
      </>
    );
  } else if (top.id === "app") {
    const app = PLATFORM_BY_KEY[top.appKey] || searchableApps.find((a) => a.key === top.appKey);
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

  const homeRoot = tab === "home" && top.id === "root";

  return (
    <div className={`ios-hub${homeRoot ? " ios-hub--home" : ""}`}>
      <style>{aiWidgetCSS}</style>
      <div className="ios-hub__wallpaper" aria-hidden />
      <div className="ios-hub__atmosphere" aria-hidden />

      <div className="ios-hub__stage">
        <IosStatusBar now={now} />
        <div className="ios-stack">
          <div key={`${tab}-${stack.length}-${top.id}`} className={`ios-stack__pane${navDir === "pop" ? " is-back" : ""}`}>
            <NavBar
              title={canBack ? navTitle : "OrbitX"}
              canBack={canBack}
              onBack={pop}
              home={homeRoot}
              trail={
                <>
                  <button type="button" className="ios-nav__btn ios-nav__btn--glass" onClick={openTheme} aria-label="Theme">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
                      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button type="button" className="ios-nav__btn ios-nav__btn--glass" onClick={() => setSpotOpen(true)} aria-label="Search">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
                      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M16 16.5 21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                </>
              }
            />
            <div className={`ios-body${homeRoot ? " ios-body--home" : ""}`}>{body}</div>
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
              {TAB_GLYPH[t.id]}
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
