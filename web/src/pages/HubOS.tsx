/**
 * /app — OrbitX OS desktop page.
 *
 * Same live data the old Hub showed (platform catalog, prices, trending,
 * social posts, widgets, auth), rendered as a PC desktop by <Desktop />.
 * /hub keeps the old Hub as a fallback.
 */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { readWidgets, writeWidgets, type WidgetConfig } from "@/components/AIWidgetPanel";
import { loadWidgetsFromCloud, saveWidgetsToCloud } from "@/lib/widgetSync";
import { ADMIN_APPS } from "@/lib/adminApps";
import { useAdmin } from "@/hooks/useAdmin";
import { OGSCAN_TOKEN_MINT } from "@/lib/og";
import { useOrbitAtmosphere } from "@/hooks/useOrbitAtmosphere";
import {
  PLATFORM_BY_KEY,
  visibleHomeGridKeys,
  visiblePlatformApps,
  type PlatformApp,
} from "@/lib/orbitxPlatforms";
import Desktop, { type TrendingRow } from "@/os/Desktop";

const ORBITX_CA = OGSCAN_TOKEN_MINT;
const GATE_KEYS = ["city", "dex", "agent", "shop"] as const;

export default function HubOS() {
  const { signOut, profile, user } = useAuth();
  const { isOwnerIdentity } = useAdmin();
  const { openTheme } = useOrbitAtmosphere();
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [solChange, setSolChange] = useState<number | null>(null);
  const [orbitxPrice, setOrbitxPrice] = useState<number | null>(null);
  const [orbitxChange, setOrbitxChange] = useState<number | null>(null);
  const [trending, setTrending] = useState<TrendingRow[]>([]);
  const [latestPosts, setLatestPosts] = useState<{ id: string; username: string | null; content: string }[]>([]);
  const [pulseTab, setPulseTab] = useState<"trending" | "runners" | "new">("trending");
  const [fng, setFng] = useState<{ v: number; label: string } | null>(null);
  const [customWidgets, setCustomWidgets] = useState<WidgetConfig[]>(readWidgets);

  const showOwnerSurfaces = Boolean(isOwnerIdentity);
  const catalogApps = useMemo(() => visiblePlatformApps(showOwnerSurfaces), [showOwnerSurfaces]);
  const homeGridKeys = useMemo(() => visibleHomeGridKeys(showOwnerSurfaces), [showOwnerSurfaces]);

  const searchableApps = useMemo(() => {
    // Bagwork is hidden from every menu (route stays live at /bagwork).
    const base = [...catalogApps].filter((a) => a.key !== "bagwork");
    if (isOwnerIdentity) {
      base.push({
        key: "__coming_soon",
        name: "Coming Soon",
        caption: "Shelved routes",
        href: "/coming-soon",
        tone: "#F0C75E",
        iconBg: "linear-gradient(135deg, #F0C75E, #B8860B)",
        glyph: <span style={{ fontSize: 18 }}>🧪</span>,
      });
      base.push({
        key: "__admin",
        name: "Admin",
        caption: "Admin dashboard",
        href: "/ox-desk-m4k9q",
        tone: "#60A5FA",
        iconBg: "linear-gradient(135deg, #60A5FA, #1D4ED8)",
        glyph: <span style={{ fontSize: 18 }}>🛡️</span>,
      });
    }
    return base;
  }, [catalogApps, isOwnerIdentity]);

  // Gates respect catalog visibility: admin-only apps (City) never pin for
  // public users, even though PLATFORM_BY_KEY still holds their entry.
  const gates = useMemo(
    () =>
      GATE_KEYS.map((k) => PLATFORM_BY_KEY[k])
        .filter(Boolean)
        .filter((a) => catalogApps.some((c) => c.key === a.key)) as PlatformApp[],
    [catalogApps],
  );

  const desktopApps = useMemo(() => {
    const byKey = new Map(searchableApps.map((a) => [a.key, a]));
    const ordered: PlatformApp[] = [];
    for (const k of GATE_KEYS) {
      const a = byKey.get(k);
      if (a) ordered.push(a);
    }
    for (const k of homeGridKeys) {
      if ((GATE_KEYS as readonly string[]).includes(k)) continue;
      const a = byKey.get(k);
      if (a) ordered.push(a);
    }
    return ordered;
  }, [searchableApps, homeGridKeys]);

  // Owner admin apps live in the Apps window, not on the desktop.
  const allApps = useMemo(() => {
    if (!isOwnerIdentity) return searchableApps;
    const adminApps: PlatformApp[] = ADMIN_APPS.map((a) => ({
      key: `admin-${a.key}`,
      name: a.label,
      caption: a.caption,
      href: a.to,
      external: a.to.startsWith("http") || a.to.startsWith("/ORBITX_DEX"),
      tone: a.tone,
      iconBg: a.iconBg,
      glyph: <span style={{ fontSize: 18 }}>{a.emoji || "🛡"}</span>,
    }));
    return [...searchableApps, ...adminApps];
  }, [searchableApps, isOwnerIdentity]);

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
    const mapRow = (row: any): TrendingRow | null => {
      const mint = String(row?.mint || "").trim();
      if (!mint) return null;
      return {
        mint,
        symbol: row.symbol || "???",
        name: row.name || row.symbol || "",
        image: row.icon || row.image_url || undefined,
        price: Number(row.priceUsd ?? row.price_usd) || 0,
        mcap: Number(row.mcap ?? row.fdv ?? row.market_cap) || 0,
        change24h: Number(row.change24h ?? row.change1h ?? row.change5m) || 0,
      };
    };
    const fetchTrending = () =>
      fetch(`/api/ogdex/screener?type=${pulseTab}&interval=1h&limit=30&chain=solana`)
        .then((r) => r.json())
        .then((d) => {
          if (on && Array.isArray(d?.rows))
            setTrending(d.rows.map(mapRow).filter(Boolean).slice(0, 15) as TrendingRow[]);
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
  }, [pulseTab]);

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

  const logout = async () => {
    try {
      await signOut();
    } finally {
      window.location.assign("/auth");
    }
  };

  const userName = profile?.username ? `@${profile.username}` : "OrbitX ID";
  const userSub = user?.email || "Wallet, MCP, media & purchases";
  const userInitial = (profile?.username || user?.email || "O").slice(0, 1).toUpperCase();

  return (
    <Desktop
      apps={allApps}
      desktopApps={desktopApps}
      gates={gates}
      userId={user?.id ?? null}
      userName={userName}
      userSub={userSub}
      userInitial={userInitial}
      onSignOut={logout}
      solPrice={solPrice}
      solChange={solChange}
      orbitxPrice={orbitxPrice}
      orbitxChange={orbitxChange}
      fng={fng}
      trending={trending}
      pulseTab={pulseTab}
      onPulseTab={setPulseTab}
      latestPosts={latestPosts}
      widgets={customWidgets}
      onWidgetsChange={setCustomWidgets}
      onOpenTheme={openTheme}
    />
  );
}
