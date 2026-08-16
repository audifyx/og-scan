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
import { HubSpaceBackground } from "@/components/hub/HubSpaceBackground";
import { Ios27Island } from "@/components/hub/Ios27Island";
import {
  HOME_GRID_KEYS,
  PLATFORM_APPS,
  PLATFORM_BY_KEY,
  PLATFORM_SECTIONS,
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
  { id: "home", label: "Deck" },
  { id: "apps", label: "Apps" },
  { id: "activity", label: "Pulse" },
  { id: "account", label: "Settings" },
];

const GATE_KEYS = ["city", "dex", "agent", "shop"] as const;

const GATE_COPY: Record<(typeof GATE_KEYS)[number], { kicker: string; line: string }> = {
  city: { kicker: "01 · World", line: "Walk the living 3D city" },
  dex: { kicker: "02 · Markets", line: "Scanner, tape, and execution" },
  agent: { kicker: "03 · Mesh", line: "Claude, ChatGPT, and Grok" },
  shop: { kicker: "04 · Access", line: "Credits and $ORBITX burn" },
};

const TAB_GLYPH: Record<TabId, ReactNode> = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 4v2.2M12 17.8V20M4 12h2.2M17.8 12H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  apps: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4l7 4v8l-7 4-7-4V8l7-4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 16l5-6 4 3 7-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
  if (n == null) return "var(--deck-ink)";
  return n >= 0 ? "var(--deck-ok)" : "var(--deck-bad)";
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
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="ios-search">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M16 16.4 21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
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

  const switchTab = (id: TabId) => {
    setIslandOpen(false);
    setTab(id);
  };

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

  const utcClock = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

  const navTitle = (() => {
    if (top.id === "app") return PLATFORM_BY_KEY[top.appKey]?.name || searchableApps.find((a) => a.key === top.appKey)?.name || "App";
    if (top.id === "section") return PLATFORM_SECTIONS.find((s) => s.id === top.sectionId)?.title || "Apps";
    if (top.id === "widgets") return "Widgets";
    if (top.id === "wallpaper") return "Atmosphere";
    return TABS.find((t) => t.id === tab)?.label || "OrbitX";
  })();

  const renderMark = (app: AppItem, className: string) => (
    <div className={className} style={{ background: app.iconBg }}>
      {app.glyph}
    </div>
  );

  const appRows = (apps: AppItem[]) => (
    <div className="ios-group">
      {apps.map((app) => (
        <button key={app.key} type="button" className="ios-cell" onClick={() => push({ id: "app", appKey: app.key })}>
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
    <div className="ox-deck__hero">
      <div className="ox-deck__intro">
        <h1>{greet}.</h1>
        <p>Command deck over deep space. Four gates in front of you — City, DEX, Agent, Shop. Search any station with ⌘K.</p>
      </div>
      <aside className="ox-deck__ticker" aria-label="Live telemetry">
        <button type="button" className="ox-tel" onClick={copyCA}>
          <span className="ox-tel__k">$ORBITX</span>
          <span className="ox-tel__v" style={{ color: changeColor(orbitxChange) }}>
            {fmtPrice(orbitxPrice, 6)}
          </span>
          <span className="ox-tel__m">{caCopied ? "Contract copied" : "Tap to copy contract"}</span>
        </button>
        <div className="ox-tel">
          <span className="ox-tel__k">SOL</span>
          <span className="ox-tel__v" style={{ color: changeColor(solChange) }}>
            {solPrice != null ? `$${solPrice >= 1000 ? solPrice.toFixed(0) : solPrice.toFixed(2)}` : "—"}
          </span>
          <span className="ox-tel__m">
            {solChange != null ? `${solChange >= 0 ? "+" : ""}${solChange.toFixed(1)}% 24h` : "Live feed"}
          </span>
        </div>
        <div className="ox-tel">
          <span className="ox-tel__k">Fear & Greed</span>
          <span className="ox-tel__v">{fng ? fng.v : "—"}</span>
          <span className="ox-tel__m">{fng?.label || "Market mood"}</span>
        </div>
      </aside>
      <div className="ox-deck__gates">
        {GATE_KEYS.map((key) => {
          const app = PLATFORM_BY_KEY[key];
          if (!app) return null;
          const copy = GATE_COPY[key];
          return (
            <button key={app.key} type="button" className="ox-gate" onClick={() => push({ id: "app", appKey: app.key })}>
              {renderMark(app, "ox-gate__orb")}
              <span className="ox-gate__copy">
                <span className="ox-gate__kicker">{copy.kicker}</span>
                <span className="ox-gate__name">{app.name}</span>
              </span>
              <span className="ox-gate__go">Enter</span>
              <span className="ox-gate__cap">{copy.line}</span>
            </button>
          );
        })}
      </div>
      <section className="ox-deck__section">
        <h2>All stations</h2>
        <p>Every OrbitX surface, one orbit.</p>
        <div className="ox-stations">
          {HOME_GRID_KEYS.filter((k) => !(GATE_KEYS as readonly string[]).includes(k)).map((k) => {
            const app = PLATFORM_BY_KEY[k];
            if (!app) return null;
            return (
              <button key={app.key} type="button" className="ox-station" onClick={() => push({ id: "app", appKey: app.key })}>
                {renderMark(app, "ox-station__mark")}
                <span>
                  <span className="ox-station__name">{app.name}</span>
                  <span className="ox-station__cap">{app.caption}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );

  const rootApps = (() => {
    const q = appsQ.trim().toLowerCase();
    const sections = [
      ...PLATFORM_SECTIONS,
      ...(showAdminApps
        ? [{ id: "admin", title: "Owner Admin", subtitle: OWNER_EMAIL, keys: OWNER_ADMIN_APPS.map((a) => a.key) }]
        : []),
    ].filter((section) => matchQ(`${section.title} ${section.subtitle}`, q));
    const az = groupAppsByLetter(
      searchableApps.filter((a) => matchQ(`${a.name} ${a.caption}`, q)),
    );
    return (
      <div className="ios-pane ios-pane--wide">
        <h1 className="ios-large">Apps</h1>
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
        <h1 className="ios-large">Settings</h1>
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

        {(show("agent mcp claude chatgpt grok") || show("x mcp twitter") || show("shop credits burn")) && (
          <>
            <div className="ios-group__head">Connectors</div>
            <div className="ios-group">
              {show("agent mcp claude chatgpt grok") && (
                <Link to="/agent" className="ios-cell">
                  <Badge bg="linear-gradient(180deg,#2dd4bf,#0f766e)">
                    <svg viewBox="0 0 24 24" fill="none"><rect x="5" y="6" width="14" height="12" rx="3" stroke="currentColor" strokeWidth="1.8" /><path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  </Badge>
                  <span className="ios-cell__meta">
                    <span className="ios-cell__title">Agent MCP</span>
                  </span>
                  <span className="ios-cell__value">Claude · GPT</span>
                  <IosChevron />
                </Link>
              )}
              {show("x mcp twitter") && (
                <Link to="/x" className="ios-cell">
                  <Badge bg="linear-gradient(180deg,#52525b,#18181b)">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  </Badge>
                  <span className="ios-cell__meta">
                    <span className="ios-cell__title">X MCP</span>
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
            <p className="ios-group__foot">The command deck keeps its 3D space. Atmosphere themes DEX, Launchpad, NFT, Agent, and X.</p>
          </>
        )}

        {(show("profile") || show("preferences settings")) && (
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
      top.sectionId === "admin"
        ? { id: "admin", title: "Owner Admin", subtitle: OWNER_EMAIL, keys: OWNER_ADMIN_APPS.map((a) => a.key) }
        : PLATFORM_SECTIONS.find((s) => s.id === top.sectionId);
    const apps =
      top.sectionId === "admin"
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
              {app.external ? "Open" : "Open"}
            </button>
            <button type="button" className="ios-open ios-open--ghost" onClick={pop}>
              Cancel
            </button>
          </div>
        </div>
        <div className="ios-group" style={{ marginTop: 28 }}>
          <div className="ios-cell ios-cell--bare" style={{ cursor: "default" }}>
            <span className="ios-cell__meta">
              <span className="ios-cell__title">Category</span>
            </span>
            <span className="ios-cell__value">
              {PLATFORM_SECTIONS.find((s) => s.keys.includes(app.key))?.title || "OrbitX"}
            </span>
          </div>
          <div className="ios-cell ios-cell--bare" style={{ cursor: "default" }}>
            <span className="ios-cell__meta">
              <span className="ios-cell__title">Destination</span>
            </span>
            <span className="ios-cell__value">{app.href}</span>
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
        <p className="ios-group__foot">This command deck keeps its 3D space background.</p>
      </div>
    );
  }

  const iosMode = tab !== "home" || top.id !== "root";

  return (
    <div className={`ox-deck ios-hub${iosMode ? " ox-deck--ios" : ""}`}>
      <style>{aiWidgetCSS}</style>
      <div className="ox-deck__space" aria-hidden>
        <HubSpaceBackground />
      </div>
      <div className="ox-deck__veil" aria-hidden />

      <Ios27Island
        now={now}
        apps={islandQuickAccess(PLATFORM_APPS, showAdminApps ? OWNER_ADMIN_APPS : [])}
        open={islandOpen}
        onToggle={() => setIslandOpen((v) => !v)}
        onClose={() => setIslandOpen(false)}
        onLaunch={(app) => {
          setIslandOpen(false);
          openAppHref(app);
        }}
      />

      <div className="ox-deck__stage">
        {iosMode && canBack ? (
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
        ) : iosMode ? null : (
          <header className="ox-deck__chrome">
            <div className="ox-deck__brand">
              <span className="ox-deck__mark" aria-hidden>
                ◈
              </span>
              <span className="ox-deck__word">
                <strong>OrbitX</strong>
                <span className="ox-deck__live">
                  <i />
                  Live · {utcClock}
                </span>
              </span>
            </div>
            <div className="ox-deck__actions">
              <span className="ox-deck__title">{navTitle}</span>
              <button type="button" className="ox-deck__iconbtn" onClick={openTheme} aria-label="Theme">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
              <button type="button" className="ox-deck__iconbtn" onClick={() => setSpotOpen(true)} aria-label="Search">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
                  <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M16 16.5 21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </header>
        )}
        <div className="ox-deck__body">{body}</div>
      </div>

      <nav className="ox-deck__rail" aria-label="OrbitX command rail">
        {TABS.slice(0, 2).map((t) => (
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
        <button type="button" className="ox-homebtn" aria-label="Home" onClick={goHome}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 11.4 12 5l8 6.4V20a1 1 0 0 1-1 1h-5.2v-6.2H10.2V21H5a1 1 0 0 1-1-1v-8.6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        </button>
        {TABS.slice(2).map((t) => (
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
          <div className="ox-sheet__card" onClick={(e) => e.stopPropagation()}>
            <div className="ox-sheet__search">
              <input
                className="ox-sheet__input"
                autoFocus
                value={spotQ}
                onChange={(e) => setSpotQ(e.target.value)}
                placeholder="Search apps…"
              />
              <button type="button" className="ox-btn ox-btn--ghost" onClick={() => setSpotOpen(false)}>
                Close
              </button>
            </div>
            {searchableApps
              .filter((a) => {
                const q = spotQ.trim().toLowerCase();
                return !q || a.name.toLowerCase().includes(q) || a.caption.toLowerCase().includes(q);
              })
              .map((a) => (
                <button
                  key={a.key}
                  type="button"
                  className="ios-cell"
                  onClick={() => {
                    setSpotOpen(false);
                    setTab("apps");
                    setStacks((prev) => ({ ...prev, apps: [{ id: "root" }, { id: "app", appKey: a.key }] }));
                  }}
                >
                  {renderMark(a, "ios-appico")}
                  <span className="ios-cell__meta">
                    <span className="ios-cell__title">{a.name}</span>
                    <span className="ios-cell__sub">{a.caption}</span>
                  </span>
                </button>
              ))}
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
