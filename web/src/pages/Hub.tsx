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
import {
  HOME_GRID_KEYS,
  PLATFORM_APPS,
  PLATFORM_BY_KEY,
  PLATFORM_SECTIONS,
  type PlatformApp,
} from "@/lib/orbitxPlatforms";
import "./hub-deck.css";

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
  { id: "apps", label: "Stations" },
  { id: "activity", label: "Pulse" },
  { id: "account", label: "Identity" },
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

  const utcClock = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

  const navTitle = (() => {
    if (top.id === "app") return PLATFORM_BY_KEY[top.appKey]?.name || searchableApps.find((a) => a.key === top.appKey)?.name || "Station";
    if (top.id === "section") return PLATFORM_SECTIONS.find((s) => s.id === top.sectionId)?.title || "Stations";
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
    <div>
      {apps.map((app) => (
        <button key={app.key} type="button" className="ox-row" onClick={() => push({ id: "app", appKey: app.key })}>
          {renderMark(app, "ox-station__mark")}
          <span className="ox-row__meta">
            <span className="ox-row__title">{app.name}</span>
            <span className="ox-row__cap">{app.caption}</span>
          </span>
          <span className="ox-row__chev" aria-hidden>
            →
          </span>
        </button>
      ))}
    </div>
  );

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

  const rootApps = (
    <>
      <div className="ox-deck__intro">
        <h1>Stations</h1>
        <p className="ox-deck__sub">Open a constellation, then launch a surface.</p>
      </div>
      {PLATFORM_SECTIONS.map((section) => (
        <button
          key={section.id}
          type="button"
          className="ox-row"
          onClick={() => push({ id: "section", sectionId: section.id })}
        >
          <span className="ox-row__meta">
            <span className="ox-row__title">{section.title}</span>
            <span className="ox-row__cap">{section.subtitle}</span>
          </span>
          <span className="ox-row__value">{section.keys.length}</span>
          <span className="ox-row__chev">→</span>
        </button>
      ))}
      {showAdminApps && (
        <button type="button" className="ox-row" onClick={() => push({ id: "section", sectionId: "admin" })}>
          <span className="ox-row__meta">
            <span className="ox-row__title">Owner Admin</span>
            <span className="ox-row__cap">{OWNER_EMAIL}</span>
          </span>
          <span className="ox-row__chev">→</span>
        </button>
      )}
    </>
  );

  const rootActivity = (
    <>
      <div className="ox-deck__intro">
        <h1>Pulse</h1>
        <p className="ox-deck__sub">Markets and community moving under the same sky.</p>
      </div>
      {trending.map((t) => (
        <button
          key={t.mint}
          type="button"
          className="ox-card"
          onClick={() => window.location.assign(`/ORBITX_DEX?mint=${encodeURIComponent(t.mint)}`)}
        >
          <div className="ox-pulse__k">Trending</div>
          <div className="ox-pulse__v">${t.symbol}</div>
          <div className="ox-pulse__m" style={{ color: changeColor(t.change24h) }}>
            {(t.change24h ?? 0) >= 0 ? "+" : ""}
            {(t.change24h ?? 0).toFixed(1)}% · 24h
          </div>
        </button>
      ))}
      {latestPosts.map((p) => (
        <div key={p.id} className="ox-card">
          <div className="ox-pulse__k">@{p.username || "orbit"}</div>
          <div className="ox-pulse__m" style={{ color: "var(--deck-ink)" }}>
            {p.content.slice(0, 160)}
            {p.content.length > 160 ? "…" : ""}
          </div>
        </div>
      ))}
      {!trending.length && !latestPosts.length && <div className="ox-empty">Listening for pulse…</div>}
      <button type="button" className="ox-btn ox-btn--ghost" style={{ width: "100%" }} onClick={() => window.location.assign("/orbitx-social")}>
        Open Social
      </button>
    </>
  );

  const rootAccount = (
    <>
      <div className="ox-deck__intro">
        <h1>Identity</h1>
        <p className="ox-deck__sub">Wallet, profile, and MCP connectors.</p>
      </div>
      <div className="ox-wallet">
        <WalletConnectButton />
      </div>
      {(profile?.username || user?.email) && (
        <div className="ox-row" style={{ cursor: "default", marginBottom: 10 }}>
          <span className="ox-row__meta">
            <span className="ox-row__title">{profile?.username ? `@${profile.username}` : "Signed in"}</span>
            <span className="ox-row__cap">{user?.email || "Wallet session"}</span>
          </span>
        </div>
      )}
      <Link to="/profile" className="ox-row">
        <span className="ox-row__meta">
          <span className="ox-row__title">Profile</span>
          <span className="ox-row__cap">{profile?.username ? `@${profile.username}` : "View profile"}</span>
        </span>
        <span className="ox-row__chev">→</span>
      </Link>
      <Link to="/settings" className="ox-row">
        <span className="ox-row__meta">
          <span className="ox-row__title">Settings</span>
          <span className="ox-row__cap">Preferences & color themes</span>
        </span>
        <span className="ox-row__chev">→</span>
      </Link>
      <Link to="/agent" className="ox-row">
        <span className="ox-row__meta">
          <span className="ox-row__title">Agent MCP</span>
          <span className="ox-row__cap">Connect Claude / ChatGPT / Grok</span>
        </span>
        <span className="ox-row__chev">→</span>
      </Link>
      <Link to="/x" className="ox-row">
        <span className="ox-row__meta">
          <span className="ox-row__title">X MCP</span>
          <span className="ox-row__cap">Post & agent on X</span>
        </span>
        <span className="ox-row__chev">→</span>
      </Link>
      <button type="button" className="ox-row" onClick={() => push({ id: "wallpaper" })}>
        <span className="ox-row__meta">
          <span className="ox-row__title">Atmosphere</span>
          <span className="ox-row__cap">Theme other OrbitX surfaces</span>
        </span>
        <span className="ox-row__chev">→</span>
      </button>
      <button type="button" className="ox-row" onClick={() => push({ id: "widgets" })}>
        <span className="ox-row__meta">
          <span className="ox-row__title">Widgets</span>
          <span className="ox-row__cap">Pin market and community tiles</span>
        </span>
        <span className="ox-row__chev">→</span>
      </button>
      <button type="button" className="ox-btn ox-btn--danger" onClick={logout}>
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
        <div className="ox-deck__intro">
          <h1>{section?.title || "Stations"}</h1>
          <p className="ox-deck__sub">{section?.subtitle}</p>
        </div>
        {appRows(apps)}
      </>
    );
  } else if (top.id === "app") {
    const app = PLATFORM_BY_KEY[top.appKey] || searchableApps.find((a) => a.key === top.appKey);
    body = app ? (
      <div className="ox-detail">
        {renderMark(app, "ox-detail__icon")}
        <h2 className="ox-detail__name">{app.name}</h2>
        <p className="ox-detail__cap">{app.caption}</p>
        <div className="ox-btn-row">
          <button type="button" className="ox-btn ox-btn--primary" onClick={() => openAppHref(app)}>
            {app.external ? "Open ↗" : "Enter"}
          </button>
          <button type="button" className="ox-btn ox-btn--ghost" onClick={pop}>
            Stay
          </button>
        </div>
      </div>
    ) : (
      <div className="ox-empty">Station not found</div>
    );
  } else if (top.id === "widgets") {
    body = (
      <>
        <div className="ox-deck__intro">
          <h1>Widgets</h1>
          <p className="ox-deck__sub">Pin market and community widgets.</p>
        </div>
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
          className="ox-btn ox-btn--primary"
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
        <div className="ox-deck__intro">
          <h1>Atmosphere</h1>
          <p className="ox-deck__sub">This deck keeps its 3D space. Theme still applies across DEX, Launchpad, NFT, Agent, and X.</p>
        </div>
        <button type="button" className="ox-btn ox-btn--primary" style={{ width: "100%" }} onClick={openTheme}>
          Customize platform theme
        </button>
      </>
    );
  }

  return (
    <div className="ox-deck ios-hub">
      <style>{aiWidgetCSS}</style>
      <div className="ox-deck__space" aria-hidden>
        <HubSpaceBackground />
      </div>
      <div className="ox-deck__veil" aria-hidden />

      <div className="ox-deck__stage">
        <header className="ox-deck__chrome">
          {canBack ? (
            <button type="button" className="ox-deck__back" onClick={pop}>
              ← {navTitle}
            </button>
          ) : (
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
          )}
          <div className="ox-deck__actions">
            {!canBack && <span className="ox-deck__title">{navTitle}</span>}
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
        <div className="ox-deck__body">{body}</div>
      </div>

      <nav className="ox-deck__rail" aria-label="OrbitX command rail">
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
          <div className="ox-sheet__card" onClick={(e) => e.stopPropagation()}>
            <div className="ox-sheet__search">
              <input
                className="ox-sheet__input"
                autoFocus
                value={spotQ}
                onChange={(e) => setSpotQ(e.target.value)}
                placeholder="Search stations…"
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
                  className="ox-row"
                  onClick={() => {
                    setSpotOpen(false);
                    setTab("apps");
                    setStacks((prev) => ({ ...prev, apps: [{ id: "root" }, { id: "app", appKey: a.key }] }));
                  }}
                >
                  {renderMark(a, "ox-station__mark")}
                  <span className="ox-row__meta">
                    <span className="ox-row__title">{a.name}</span>
                    <span className="ox-row__cap">{a.caption}</span>
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}

      {launching && (
        <div className="ox-launch">
          <div className="ox-launch__card">
            {renderMark(launching, "ox-detail__icon")}
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
