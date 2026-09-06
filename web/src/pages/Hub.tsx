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
import { useAdmin } from "@/hooks/useAdmin";
import { OGSCAN_TOKEN_MINT } from "@/lib/og";
import { useOrbitAtmosphere } from "@/hooks/useOrbitAtmosphere";
import { HubSpaceBackground } from "@/components/hub/HubSpaceBackground";
import { Ios27Island } from "@/components/hub/Ios27Island";
import {
  PLATFORM_BY_KEY,
  springboardDockApps,
  springboardHomeGrid,
  visiblePlatformApps,
  visiblePlatformSections,
  type PlatformApp,
} from "@/lib/orbitxPlatforms";
import { groupAppsByLetter, islandQuickAccess } from "@/lib/hubIos";
import "./hub-deck.css";
import "./hub-ios-ui.css";

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
  { id: "apps", label: "Library" },
  { id: "activity", label: "Pulse" },
  { id: "account", label: "You" },
];

const TAB_GLYPH: Record<TabId, ReactNode> = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 11.2 12 4.6l8 6.6V20a1 1 0 0 1-1 1h-5.1v-6.4H9.1V21H5a1 1 0 0 1-1-1v-8.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  ),
  apps: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="4" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
      <rect x="4" y="13" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="13" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 13h3l2.2-5 3.1 10 2.4-6.4L16.4 13H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  account: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 19c1.4-3.2 3.8-5 7-5s5.6 1.8 7 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
};

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function fmtPrice(n: number | null, digits = 2): string {
  if (n == null) return "—";
  if (n < 0.01) return n.toExponential(2);
  return n.toFixed(digits);
}

function changeColor(n: number | null): string {
  if (n == null) return "var(--ios-label)";
  return n >= 0 ? "var(--ios-green)" : "var(--ios-red)";
}

function fngColor(v: number | null): string {
  if (v == null) return "var(--ios-label)";
  if (v >= 60) return "var(--ios-green)";
  if (v <= 40) return "var(--ios-red)";
  return "var(--ios-orange)";
}

function IosChevron() {
  return (
    <svg className="ios-chev" viewBox="0 0 8 14" fill="none" aria-hidden>
      <path d="M1 1.2 6.6 7 1 12.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IosSearch({
  value,
  onChange,
  placeholder,
  onFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onFocus?: () => void;
}) {
  return (
    <label className="ios-search">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M16 16.4 21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={onFocus}
      />
    </label>
  );
}

function Badge({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <span className="ios-cell__badge" style={{ background: bg }}>
      {children}
    </span>
  );
}

export default function Hub() {
  const now = useClock();
  const { signOut, profile, user } = useAuth();
  const { isAdmin, isOwnerIdentity } = useAdmin();
  const [tab, setTab] = useState<TabId>("home");
  const [stacks, setStacks] = useState<Record<TabId, Frame[]>>({
    home: [{ id: "root" }],
    apps: [{ id: "root" }],
    activity: [{ id: "root" }],
    account: [{ id: "root" }],
  });
  const [spotOpen, setSpotOpen] = useState(false);
  const [spotQ, setSpotQ] = useState("");
  const [islandOpen, setIslandOpen] = useState(false);
  const [appsQ, setAppsQ] = useState("");
  const [settingsQ, setSettingsQ] = useState("");
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

  const showAdminApps = Boolean(isAdmin);
  const showOwnerSurfaces = Boolean(isOwnerIdentity);
  const catalogApps = useMemo(() => visiblePlatformApps(showOwnerSurfaces), [showOwnerSurfaces]);
  const platformSections = useMemo(() => visiblePlatformSections(showOwnerSurfaces), [showOwnerSurfaces]);
  const searchableApps = useMemo(
    () => (showAdminApps ? [...catalogApps, ...OWNER_ADMIN_APPS] : catalogApps),
    [catalogApps, showAdminApps],
  );
  const springDock = useMemo(() => springboardDockApps(catalogApps), [catalogApps]);
  const springGrid = useMemo(() => springboardHomeGrid(catalogApps), [catalogApps]);

  const stack = stacks[tab];
  const top = stack[stack.length - 1] || { id: "root" as const };
  const canBack = stack.length > 1;
  const onSpringHome = tab === "home" && top.id === "root";

  const push = useCallback(
    (frame: Frame) => {
      setStacks((prev) => ({ ...prev, [tab]: [...prev[tab], frame] }));
    },
    [tab],
  );

  const pop = useCallback(() => {
    setStacks((prev) => {
      const cur = prev[tab];
      if (cur.length <= 1) return prev;
      return { ...prev, [tab]: cur.slice(0, -1) };
    });
  }, [tab]);

  const goHome = useCallback(() => {
    setIslandOpen(false);
    setSpotOpen(false);
    setPanelOpen(false);
    setTab("home");
    setStacks({
      home: [{ id: "root" }],
      apps: [{ id: "root" }],
      activity: [{ id: "root" }],
      account: [{ id: "root" }],
    });
  }, []);

  const switchTab = (id: TabId) => {
    setIslandOpen(false);
    if (id === "home" && tab === "home") {
      goHome();
      return;
    }
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
        if (islandOpen) {
          setIslandOpen(false);
          return;
        }
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
  }, [canBack, pop, spotOpen, panelOpen, themeOpen, closeTheme, islandOpen]);

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
    }, 280);
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

  const lockTime = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const lockDate = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  const navTitle = (() => {
    if (top.id === "app") return PLATFORM_BY_KEY[top.appKey]?.name || searchableApps.find((a) => a.key === top.appKey)?.name || "App";
    if (top.id === "section") return platformSections.find((s) => s.id === top.sectionId)?.title || "Library";
    if (top.id === "widgets") return "Widgets";
    if (top.id === "wallpaper") return "Atmosphere";
    return TABS.find((t) => t.id === tab)?.label || "OrbitX";
  })();

  const renderMark = (app: AppItem, className: string) => (
    <div className={className} style={{ background: app.iconBg }}>
      {app.glyph}
    </div>
  );

  const appIcon = (app: AppItem, extraClass = "") => (
    <button key={app.key} type="button" className={`ios-icon ${extraClass}`.trim()} onClick={() => openAppHref(app)}>
      {renderMark(app, "ios-icon__mark")}
      <span className="ios-icon__name">{app.name}</span>
    </button>
  );

  const appRows = (apps: AppItem[]) => (
    <div className="ios-group">
      {apps.map((app) => (
        <button key={app.key} type="button" className="ios-cell" onClick={() => openAppHref(app)}>
          {renderMark(app, "ios-appico")}
          <span className="ios-cell__meta">
            <span className="ios-cell__title">{app.name}</span>
            <span className="ios-cell__sub">{app.caption}</span>
          </span>
          <IosChevron />
        </button>
      ))}
    </div>
  );

  const matchQ = (text: string, q: string) => !q || text.toLowerCase().includes(q);

  const rootHome = (
    <div className="ios-spring">
      <p className="ios-locktime">{lockTime}</p>
      <p className="ios-lockdate">{lockDate}</p>
      <p className="ios-greet">{greet}</p>
      <button
        type="button"
        className="ios-search ios-search--tap"
        onClick={() => {
          setSpotQ("");
          setSpotOpen(true);
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16 16.4 21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span>Search OrbitX</span>
      </button>
      <div className="ios-widgets">
        <button type="button" className="ios-widget" onClick={copyCA}>
          <span className="ios-widget__k">$ORBITX</span>
          <span className="ios-widget__v" style={{ color: changeColor(orbitxChange) }}>
            {fmtPrice(orbitxPrice, 6)}
          </span>
          <span className="ios-widget__m">
            {caCopied
              ? "Contract copied"
              : orbitxChange != null
                ? `${orbitxChange >= 0 ? "+" : ""}${orbitxChange.toFixed(1)}% 24h`
                : "Tap to copy"}
          </span>
        </button>
        <div className="ios-widget">
          <span className="ios-widget__k">SOL</span>
          <span className="ios-widget__v" style={{ color: changeColor(solChange) }}>
            {solPrice != null ? `$${solPrice >= 1000 ? solPrice.toFixed(0) : solPrice.toFixed(2)}` : "—"}
          </span>
          <span className="ios-widget__m">
            {solChange != null ? `${solChange >= 0 ? "+" : ""}${solChange.toFixed(1)}% 24h` : "Live"}
          </span>
        </div>
        <div className="ios-widget">
          <span className="ios-widget__k">Fear & Greed</span>
          <span className="ios-widget__v" style={{ color: fngColor(fng?.v ?? null) }}>
            {fng ? fng.v : "—"}
          </span>
          <span className="ios-widget__m">{fng?.label || "Market mood"}</span>
        </div>
      </div>
      <div className="ios-spring__grid">
        {springGrid.map((app) => appIcon(app))}
      </div>
      {!springGrid.length && <div className="ios-hint">No apps match that search.</div>}
    </div>
  );

  const rootApps = (() => {
    const q = appsQ.trim().toLowerCase();
    const sections = [
      ...platformSections,
      ...(showAdminApps
        ? [{ id: "admin", title: "Owner Admin", subtitle: "Private ops", keys: OWNER_ADMIN_APPS.map((a) => a.key) }]
        : []),
    ].filter((section) => matchQ(`${section.title} ${section.subtitle}`, q));
    const az = groupAppsByLetter(
      searchableApps.filter((a) => matchQ(`${a.name} ${a.caption}`, q)),
    );
    return (
      <div className="ios-pane ios-pane--wide">
        <h1 className="ios-large">Library</h1>
        <IosSearch value={appsQ} onChange={setAppsQ} placeholder="Search" />
        <div className="ios-lib">
          {sections.map((section) => {
            const apps =
              section.id === "admin"
                ? OWNER_ADMIN_APPS
                : section.keys.map((k) => PLATFORM_BY_KEY[k]).filter(Boolean);
            return (
              <button
                key={section.id}
                type="button"
                className="ios-folder"
                onClick={() => push({ id: "section", sectionId: section.id })}
              >
                <div className="ios-folder__glass">
                  {Array.from({ length: 4 }, (_, i) => {
                    const app = apps[i];
                    return app ? (
                      <div key={app.key} className="ios-folder__ico" style={{ background: app.iconBg }}>
                        {app.glyph}
                      </div>
                    ) : (
                      <div key={`empty-${section.id}-${i}`} className="ios-folder__ico" style={{ background: "rgba(255,255,255,0.06)" }} />
                    );
                  })}
                </div>
                <span className="ios-folder__name">{section.title}</span>
                <span className="ios-folder__n">{apps.length}</span>
              </button>
            );
          })}
        </div>
        {az.map((bucket) => (
          <div key={bucket.letter}>
            <div className="ios-az__letter">{bucket.letter}</div>
            {appRows(bucket.apps)}
          </div>
        ))}
        {!sections.length && !az.length && <div className="ios-hint">No apps match that search.</div>}
      </div>
    );
  })();

  const rootActivity = (
    <div className="ios-pane">
      <h1 className="ios-large">Pulse</h1>
      {!!trending.length && (
        <>
          <div className="ios-group__head">Trending</div>
          <div className="ios-group">
            {trending.map((t) => (
              <button
                key={t.mint}
                type="button"
                className="ios-cell ios-cell--bare"
                onClick={() => window.location.assign(`/ORBITX_DEX?mint=${encodeURIComponent(t.mint)}`)}
              >
                <span className="ios-cell__meta">
                  <span className="ios-cell__title">${t.symbol}</span>
                  <span className="ios-cell__sub">24h</span>
                </span>
                <span className="ios-cell__value" style={{ color: changeColor(t.change24h) }}>
                  {(t.change24h ?? 0) >= 0 ? "+" : ""}
                  {(t.change24h ?? 0).toFixed(1)}%
                </span>
                <IosChevron />
              </button>
            ))}
          </div>
        </>
      )}
      {!!latestPosts.length && (
        <>
          <div className="ios-group__head">Social</div>
          <div className="ios-group">
            {latestPosts.map((p) => (
              <div key={p.id} className="ios-cell ios-cell--bare" style={{ cursor: "default" }}>
                <span className="ios-cell__meta">
                  <span className="ios-cell__title">@{p.username || "orbit"}</span>
                  <span className="ios-cell__sub">
                    {p.content.slice(0, 140)}
                    {p.content.length > 140 ? "…" : ""}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {!trending.length && !latestPosts.length && <div className="ios-hint">Listening for pulse…</div>}
      <div className="ios-group">
        <button type="button" className="ios-cell ios-cell--bare" onClick={() => window.location.assign("/orbitx-social")}>
          <span className="ios-cell__meta">
            <span className="ios-cell__title">Open Social</span>
          </span>
          <IosChevron />
        </button>
      </div>
    </div>
  );

  const rootAccount = (() => {
    const q = settingsQ.trim().toLowerCase();
    const show = (label: string) => matchQ(label, q);
    const initial = (profile?.username || user?.email || "O").slice(0, 1).toUpperCase();
    return (
      <div className="ios-pane">
        <h1 className="ios-large">You</h1>
        <IosSearch value={settingsQ} onChange={setSettingsQ} placeholder="Search" />

        {show("profile identity wallet") && (
          <div className="ios-group">
            <Link to="/profile" className="ios-id">
              <span className="ios-id__ava">{initial}</span>
              <span>
                <span className="ios-id__name">{profile?.username ? `@${profile.username}` : "OrbitX ID"}</span>
                <span className="ios-id__sub">{user?.email || "Wallet, MCP, media & purchases"}</span>
              </span>
              <IosChevron />
            </Link>
          </div>
        )}

        {show("wallet connect") && (
          <>
            <div className="ios-group__head">Wallet</div>
            <div className="ios-group">
              <div className="ios-wallet">
                <WalletConnectButton />
              </div>
            </div>
            <p className="ios-group__foot">Connect Phantom to trade, burn MCP access, and sign on-chain.</p>
          </>
        )}

        {(show("agent mcp claude chatgpt grok") || (showOwnerSurfaces && show("x mcp twitter")) || show("shop credits burn")) && (
          <>
            <div className="ios-group__head">Connectors</div>
            <div className="ios-group">
              {show("agent mcp claude chatgpt grok") && (
                <Link to="/supercomputer?tab=workspace" className="ios-cell">
                  <Badge bg="linear-gradient(180deg,#2dd4bf,#0f766e)">
                    <svg viewBox="0 0 24 24" fill="none"><rect x="5" y="6" width="14" height="12" rx="3" stroke="currentColor" strokeWidth="1.8" /><path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  </Badge>
                  <span className="ios-cell__meta">
                    <span className="ios-cell__title">Super Computer</span>
                  </span>
                  <span className="ios-cell__value">Claude · GPT</span>
                  <IosChevron />
                </Link>
              )}
              {showOwnerSurfaces && show("x mcp twitter") && (
                <Link to="/supercomputer?tab=channels" className="ios-cell">
                  <Badge bg="linear-gradient(180deg,#52525b,#18181b)">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  </Badge>
                  <span className="ios-cell__meta">
                    <span className="ios-cell__title">Channels</span>
                  </span>
                  <span className="ios-cell__value">Post</span>
                  <IosChevron />
                </Link>
              )}
              {show("shop credits burn") && (
                <Link to="/shop" className="ios-cell">
                  <Badge bg="linear-gradient(180deg,#5eead4,#115e59)">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M7 9h10l-1 10H8L7 9z" stroke="currentColor" strokeWidth="1.8" /><path d="M9 9V7a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  </Badge>
                  <span className="ios-cell__meta">
                    <span className="ios-cell__title">Shop</span>
                  </span>
                  <span className="ios-cell__value">Credits</span>
                  <IosChevron />
                </Link>
              )}
            </div>
          </>
        )}

        {(show("atmosphere theme wallpaper") || show("widgets")) && (
          <>
            <div className="ios-group__head">Appearance</div>
            <div className="ios-group">
              {show("atmosphere theme wallpaper") && (
                <button type="button" className="ios-cell" onClick={() => push({ id: "wallpaper" })}>
                  <Badge bg="linear-gradient(180deg,#c084fc,#6d28d9)">
                    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  </Badge>
                  <span className="ios-cell__meta">
                    <span className="ios-cell__title">Atmosphere</span>
                  </span>
                  <span className="ios-cell__value">Theme</span>
                  <IosChevron />
                </button>
              )}
              {show("widgets") && (
                <button type="button" className="ios-cell" onClick={() => push({ id: "widgets" })}>
                  <Badge bg="linear-gradient(180deg,#fb923c,#c2410c)">
                    <svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" /><rect x="13" y="4" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" /><rect x="4" y="13" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" /><rect x="13" y="13" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" /></svg>
                  </Badge>
                  <span className="ios-cell__meta">
                    <span className="ios-cell__title">Widgets</span>
                  </span>
                  <IosChevron />
                </button>
              )}
            </div>
            <p className="ios-group__foot">Home keeps the space wallpaper. Atmosphere themes DEX, Launchpad, NFT, Agent, and X.</p>
          </>
        )}

        {(show("profile") || show("preferences settings") || show("support help ticket")) && (
          <div className="ios-group">
            {show("profile") && (
              <Link to="/profile" className="ios-cell">
                <Badge bg="linear-gradient(180deg,#60a5fa,#1d4ed8)">
                  <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" /><path d="M5 19c1.4-3 3.8-4.8 7-4.8S17.6 16 19 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                </Badge>
                <span className="ios-cell__meta">
                  <span className="ios-cell__title">Profile</span>
                </span>
                <IosChevron />
              </Link>
            )}
            {show("support help ticket") && (
              <Link to="/support" className="ios-cell">
                <Badge bg="linear-gradient(180deg,#c4b5fd,#6d28d9)">
                  <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="10" r="4.2" stroke="currentColor" strokeWidth="1.8" /><path d="M8 10v4c0 1.6 1.2 3 2.8 3H12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M16 10v3c0 2.2-1.8 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                </Badge>
                <span className="ios-cell__meta">
                  <span className="ios-cell__title">Support</span>
                </span>
                <span className="ios-cell__value">Tickets</span>
                <IosChevron />
              </Link>
            )}
            {show("preferences settings") && (
              <Link to="/settings" className="ios-cell">
                <Badge bg="linear-gradient(180deg,#94a3b8,#334155)">
                  <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" /><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                </Badge>
                <span className="ios-cell__meta">
                  <span className="ios-cell__title">General</span>
                </span>
                <span className="ios-cell__value">Preferences</span>
                <IosChevron />
              </Link>
            )}
          </div>
        )}

        {show("log out sign out") && (
          <div className="ios-group">
            <button type="button" className="ios-cell ios-cell--bare ios-cell--danger" onClick={logout}>
              <span className="ios-cell__title">Log Out</span>
            </button>
          </div>
        )}
      </div>
    );
  })();

  let body: ReactNode = null;
  if (top.id === "root") {
    body = tab === "home" ? rootHome : tab === "apps" ? rootApps : tab === "activity" ? rootActivity : rootAccount;
  } else if (top.id === "section") {
    const section =
      top.sectionId === "admin" && showAdminApps
        ? { id: "admin", title: "Owner Admin", subtitle: "Private ops", keys: OWNER_ADMIN_APPS.map((a) => a.key) }
        : top.sectionId === "admin"
          ? null
          : platformSections.find((s) => s.id === top.sectionId);
    const apps =
      top.sectionId === "admin" && showAdminApps
        ? OWNER_ADMIN_APPS
        : (section?.keys || []).map((k) => PLATFORM_BY_KEY[k]).filter(Boolean);
    body = (
      <div className="ios-pane">
        <p className="ios-group__foot" style={{ margin: "0 4px 12px" }}>{section?.subtitle}</p>
        {appRows(apps)}
      </div>
    );
  } else if (top.id === "app") {
    const app = PLATFORM_BY_KEY[top.appKey] || searchableApps.find((a) => a.key === top.appKey);
    body = app ? (
      <div className="ios-pane">
        <div className="ios-apppage">
          {renderMark(app, "ios-appico ios-appico--lg")}
          <h2>{app.name}</h2>
          <p>{app.caption}</p>
          <div className="ox-btn-row">
            <button type="button" className="ios-open" onClick={() => openAppHref(app)}>
              Open
            </button>
            <button type="button" className="ios-open ios-open--ghost" onClick={pop}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    ) : (
      <div className="ios-hint">App not found</div>
    );
  } else if (top.id === "widgets") {
    body = (
      <div className="ios-pane">
        <p className="ios-group__foot" style={{ margin: "0 4px 14px" }}>Pin market and community widgets.</p>
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
        <div className="ios-group" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="ios-cell ios-cell--bare"
            onClick={() => {
              setPanelTab("lib");
              setPanelOpen(true);
            }}
          >
            <span className="ios-cell__meta">
              <span className="ios-cell__title">Widget Library</span>
            </span>
            <IosChevron />
          </button>
        </div>
      </div>
    );
  } else if (top.id === "wallpaper") {
    body = (
      <div className="ios-pane">
        <div className="ios-group">
          <button type="button" className="ios-cell ios-cell--bare" onClick={openTheme}>
            <span className="ios-cell__meta">
              <span className="ios-cell__title">Customize Theme</span>
              <span className="ios-cell__sub">Applies across DEX, Launchpad, NFT, Agent, and X</span>
            </span>
            <IosChevron />
          </button>
        </div>
        <p className="ios-group__foot">Home keeps its space wallpaper.</p>
      </div>
    );
  }

  const spotHits = searchableApps.filter((a) => {
    const q = spotQ.trim().toLowerCase();
    return !q || a.name.toLowerCase().includes(q) || a.caption.toLowerCase().includes(q);
  });

  return (
    <div className={`ox-deck ios-hub ox-deck--ios${onSpringHome ? " ox-deck--spring" : ""}`}>
      <style>{aiWidgetCSS}</style>
      <div className="ox-deck__space" aria-hidden>
        <HubSpaceBackground />
      </div>
      <div className="ox-deck__veil" aria-hidden />

      <Ios27Island
        now={now}
        apps={islandQuickAccess(catalogApps, showAdminApps ? OWNER_ADMIN_APPS : [])}
        open={islandOpen}
        onToggle={() => setIslandOpen((v) => !v)}
        onClose={() => setIslandOpen(false)}
        onLaunch={(app) => {
          setIslandOpen(false);
          openAppHref(app);
        }}
      />

      <div className="ox-deck__stage">
        {canBack ? (
          <header className="ios-nav">
            <button type="button" className="ios-nav__back" onClick={pop}>
              <svg viewBox="0 0 12 20" fill="none" aria-hidden>
                <path d="M10 2 2 10l8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>
            <h1 className="ios-nav__title">{navTitle}</h1>
            <div className="ios-nav__trail" />
          </header>
        ) : null}
        <div className="ox-deck__body">{body}</div>
      </div>

      {onSpringHome && (
        <div className="ios-phone-dock" aria-label="Favorites">
          {springDock.map((app) => appIcon(app))}
        </div>
      )}

      <nav className="ox-deck__rail" aria-label="OrbitX tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`ox-railbtn${tab === t.id ? " is-on" : ""}`}
            onClick={() => switchTab(t.id)}
          >
            {TAB_GLYPH[t.id]}
            {t.label}
          </button>
        ))}
      </nav>

      {spotOpen && (
        <div className="ox-sheet" onClick={() => setSpotOpen(false)}>
          <div className="ox-sheet__card ios-spot" onClick={(e) => e.stopPropagation()}>
            <IosSearch
              value={spotQ}
              onChange={setSpotQ}
              placeholder="Search apps"
            />
            {spotHits.map((a) => (
              <button
                key={a.key}
                type="button"
                className="ios-cell"
                onClick={() => {
                  setSpotOpen(false);
                  openAppHref(a);
                }}
              >
                {renderMark(a, "ios-appico")}
                <span className="ios-cell__meta">
                  <span className="ios-cell__title">{a.name}</span>
                  <span className="ios-cell__sub">{a.caption}</span>
                </span>
              </button>
            ))}
            {!spotHits.length && <div className="ios-hint">No apps match that search.</div>}
          </div>
        </div>
      )}

      {launching && (
        <div className="ox-launch">
          <div className="ox-launch__card">
            {renderMark(launching, "ios-appico ios-appico--lg")}
            <div>{launching.name}</div>
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
