// OrbitX Launchpad — live coin board (pump.fun-style).
// Three columns on desktop: currently live / about to graduate / graduated.
// No marketing hero — search, create, filters, dense coin tiles.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Rocket, Zap, Flame, Loader2, TrendingUp, Droplets, Sparkles,
  Search, ShieldCheck, Eye, Activity, Gem, Star, Plus,
} from "lucide-react";
import { ORBITX_FEE_USD, isLaunchFeePromoActive, launchFeePromoDaysLeft } from "@/lib/orbitx/fee";
import { type OrbitxToken, listTokens } from "@/lib/orbitx/registry";
import { TokenCard, GRADUATION_MC_USD } from "./_shared";
import { useWatchlist } from "./watchlist";
import { launchStats, useMarketMap, fmtCompactUsd, type MarketRow } from "./lpx";

type BoardCategory = "board" | "new" | "trending" | "graduating" | "volume" | "gainers" | "gems" | "graduated" | "watchlist";

function isGraduated(t: OrbitxToken, markets?: Record<string, MarketRow> | null) {
  const m = markets?.[t.mint_address];
  return !!t.lp_pool_address || !!t.graduated_at || (m?.mcap ?? 0) >= GRADUATION_MC_USD;
}

function BoardColumn({
  title,
  icon,
  tone,
  items,
  markets,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  tone: "live" | "graduating" | "graduated";
  items: OrbitxToken[];
  markets?: Record<string, MarketRow> | null;
  empty: string;
}) {
  const toneCls =
    tone === "live" ? "ox-board-col--live"
    : tone === "graduating" ? "ox-board-col--graduating"
    : "ox-board-col--graduated";

  return (
    <section className={`ox-board-col ${toneCls}`}>
      <header className="ox-board-col-head">
        <span className="ox-board-col-icon">{icon}</span>
        <h2>{title}</h2>
        <span className="ox-board-col-count">{items.length}</span>
      </header>
      <div className="ox-board-col-body">
        {!items.length ? (
          <div className="px-2 py-10 text-center text-xs text-white/40">{empty}</div>
        ) : (
          items.map((t) => (
            <TokenCard key={t.mint_address} t={t} mc={markets?.[t.mint_address]?.mcap ?? null} market={markets?.[t.mint_address] ?? null} />
          ))
        )}
      </div>
    </section>
  );
}

export default function LaunchpadHome() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<BoardCategory>("board");
  const [hideVamps, setHideVamps] = useState(false);
  const { list: watchIds } = useWatchlist();
  const watchSet = useMemo(() => new Set(watchIds), [watchIds]);

  const { data: launches, isLoading } = useQuery({
    queryKey: ["orbitx-home-launches"],
    queryFn: () => listTokens("all", 200),
    staleTime: 15_000,
  });

  const mints = useMemo(() => (Array.isArray(launches) ? launches.map((t) => t.mint_address) : []), [launches]);
  const { data: markets } = useMarketMap(mints);

  const stats = useMemo(() => launchStats(launches), [launches]);
  const vol24Total = useMemo(() => (markets ? Object.values(markets).reduce((a, m) => a + (m.vol24 ?? 0), 0) : 0), [markets]);
  const trades24 = useMemo(() => (markets ? Object.values(markets).reduce((a, m) => a + ((m.buys24 ?? 0) + (m.sells24 ?? 0)), 0) : 0), [markets]);

  const base = useMemo(() => {
    let items = Array.isArray(launches) ? launches.filter((t) => !!t) : [];
    if (hideVamps) items = items.filter((t) => !t?.is_vamp);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((t) => {
        if (!t) return false;
        return (t.name || "").toLowerCase().includes(q) || (t.ticker || "").toLowerCase().includes(q) || (t.mint_address || "").toLowerCase().includes(q);
      });
    }
    return items;
  }, [launches, hideVamps, search]);

  const liveCol = useMemo(() => {
    return [...base]
      .filter((t) => !isGraduated(t, markets))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 40);
  }, [base, markets]);

  const graduatingCol = useMemo(() => {
    // Pump-style: closest to graduation (overlaps "currently live")
    const near = [...base]
      .filter((t) => !isGraduated(t, markets) && (markets?.[t.mint_address]?.mcap ?? 0) > 0)
      .sort((a, b) => (markets?.[b.mint_address]?.mcap ?? 0) - (markets?.[a.mint_address]?.mcap ?? 0));
    return near.slice(0, 40);
  }, [base, markets]);

  const graduatedCol = useMemo(() => {
    return [...base]
      .filter((t) => isGraduated(t, markets))
      .sort((a, b) => {
        const aT = a.graduated_at ? new Date(a.graduated_at).getTime() : new Date(a.created_at).getTime();
        const bT = b.graduated_at ? new Date(b.graduated_at).getTime() : new Date(b.created_at).getTime();
        return bT - aT;
      })
      .slice(0, 40);
  }, [base, markets]);

  const filtered = useMemo(() => {
    let items = [...base];
    if (category === "board" || category === "new") {
      return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    if (category === "watchlist") {
      return items.filter((t) => t && watchSet.has(t.mint_address));
    }
    if (category === "graduated") {
      return items.filter((t) => isGraduated(t, markets));
    }
    if (category === "trending") {
      return items.sort((a, b) => {
        const aVol = markets?.[a.mint_address]?.vol24 ?? 0;
        const aMc = markets?.[a.mint_address]?.mcap ?? 1;
        const bVol = markets?.[b.mint_address]?.vol24 ?? 0;
        const bMc = markets?.[b.mint_address]?.mcap ?? 1;
        return (bVol / bMc) - (aVol / aMc);
      });
    }
    if (category === "volume") {
      return items.sort((a, b) => (markets?.[b.mint_address]?.vol24 ?? 0) - (markets?.[a.mint_address]?.vol24 ?? 0));
    }
    if (category === "gainers") {
      return items.sort((a, b) => (markets?.[b.mint_address]?.ch24 ?? 0) - (markets?.[a.mint_address]?.ch24 ?? 0));
    }
    if (category === "graduating") {
      return items
        .filter((t) => {
          const m = markets?.[t.mint_address];
          return !isGraduated(t, markets) && (m?.mcap ?? 0) > 0;
        })
        .sort((a, b) => (markets?.[b.mint_address]?.mcap ?? 0) - (markets?.[a.mint_address]?.mcap ?? 0));
    }
    if (category === "gems") {
      return items
        .filter((t) => {
          const mc = markets?.[t.mint_address]?.mcap ?? 0;
          return !t.is_vamp && mc > 1000 && mc < 20000;
        })
        .sort((a, b) => (markets?.[b.mint_address]?.vol24 ?? 0) - (markets?.[a.mint_address]?.vol24 ?? 0));
    }
    return items;
  }, [base, markets, category, watchSet]);

  const promoActive = isLaunchFeePromoActive();
  const promoDaysLeft = launchFeePromoDaysLeft();
  const showTriBoard = category === "board" && !search.trim();

  return (
    <div className="ox-launchboard space-y-4">
      <div className="ox-tab-hero mb-1">
        <div className="ox-tab-hero-glow" style={{ background: "radial-gradient(520px 180px at 10% 0%, #9945FF44, transparent 70%)" }} />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="pf-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[#9945FF]">Solana · live board</div>
            <h1 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">Discover &amp; trade new coins</h1>
          </div>
          <Link to="/orbitxlaunch/create" className="ox-create-cta hidden sm:inline-flex">
            <Plus className="h-3.5 w-3.5" strokeWidth={3} /> Create coin
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            placeholder="Search name, ticker, or mint…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-[14px] border border-white/10 bg-[hsl(255_32%_8%)] py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#14F195]/60"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setHideVamps((v) => !v)}
            className={`ox-nav-pill inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wide ${
              hideVamps
                ? "ox-nav-pill--on"
                : "border border-white/10 text-white/55 hover:border-white/25 hover:text-white"
            }`}
            title="Hide vamp / clone tokens"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {hideVamps ? "OG only" : "All"}
          </button>
          <Link to="/orbitxlaunch/create" className="ox-create-cta flex-1 justify-center sm:hidden">
            <Plus className="h-4 w-4" strokeWidth={3} /> Create
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 pf-mono text-[11px] text-white/50">
        <span className="inline-flex items-center gap-1.5 font-bold text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#14F195]" />
          Live board
        </span>
        <span>{stats.total} coins</span>
        <span className="text-[#F0B429]">{stats.graduated} graduated</span>
        <span>vol {fmtCompactUsd(vol24Total)}</span>
        <span>{trades24.toLocaleString()} tx / 24h</span>
        {promoActive && (
          <span className="ml-auto inline-flex items-center gap-1 font-bold text-[#14F195]">
            <Zap className="h-3 w-3" /> Promo · {promoDaysLeft}d · ${ORBITX_FEE_USD} launch
          </span>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {([
          { id: "board", label: "Board", icon: Rocket },
          { id: "new", label: "New", icon: Sparkles },
          { id: "trending", label: "Trending", icon: TrendingUp },
          { id: "graduating", label: "Graduating", icon: Flame },
          { id: "volume", label: "Volume", icon: Activity },
          { id: "gainers", label: "Gainers", icon: TrendingUp },
          { id: "gems", label: "Gems", icon: Gem },
          { id: "graduated", label: "Graduated", icon: Droplets },
          { id: "watchlist", label: "Watchlist", icon: Star },
        ] as { id: BoardCategory; label: string; icon: typeof Rocket }[]).map((c) => {
          const Icon = c.icon;
          const on = category === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`ox-nav-pill inline-flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
                on
                  ? "ox-nav-pill--on"
                  : "border border-white/10 text-white/50 hover:border-white/25 hover:text-white"
              }`}
            >
              <Icon className="h-3 w-3" />
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Board body */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-[hsl(var(--pf-muted))]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading coins…
        </div>
      ) : showTriBoard ? (
        <div className="ox-tri-board grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-2 xl:gap-3">
          <BoardColumn
            title="Currently live"
            tone="live"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            items={liveCol}
            markets={markets}
            empty="No live coins yet — create one."
          />
          <BoardColumn
            title="About to graduate"
            tone="graduating"
            icon={<Flame className="h-3.5 w-3.5" />}
            items={graduatingCol}
            markets={markets}
            empty="Nothing near graduation."
          />
          <BoardColumn
            title="Graduated"
            tone="graduated"
            icon={<Droplets className="h-3.5 w-3.5" />}
            items={graduatedCol}
            markets={markets}
            empty="No graduates yet."
          />
        </div>
      ) : !filtered.length ? (
        <div className="rounded-2xl border border-[hsl(var(--pf-border))] py-16 text-center">
          <Eye className="mx-auto mb-3 h-10 w-10 text-[hsl(var(--pf-muted))] opacity-40" />
          <div className="text-base font-bold text-[hsl(var(--pf-muted))]">No coins found</div>
          <p className="mt-1 text-sm text-[hsl(var(--pf-muted))]">Adjust filters or create the first one.</p>
          <Link to="/orbitxlaunch/create" className="pf-btn mt-5 inline-flex">
            <Plus className="h-4 w-4" /> Create coin
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {filtered.slice(0, 60).map((t) => (
            <TokenCard key={t.mint_address} t={t} mc={markets?.[t.mint_address]?.mcap ?? null} market={markets?.[t.mint_address] ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}
