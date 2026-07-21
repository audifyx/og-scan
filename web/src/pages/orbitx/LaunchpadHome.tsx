// OrbitX Launchpad — home board. Modern 2026 design with real data everywhere:
// hero up top, filterable/sortable board, live feed, analytics. Works for
// pump.fun and custom SPL launches, real market data from DexScreener.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Rocket, Zap, HandCoins, Flame, Loader2, ArrowRight, 
  TrendingUp, Droplets, Sparkles, BadgeCheck, Search, Filter,
  ShieldCheck, ShieldAlert, Eye, Users, Activity, Coins, Gem, Star,
} from "lucide-react";
import { ORBITX_FEE_USD, isLaunchFeePromoActive, launchFeePromoDaysLeft } from "@/lib/orbitx/fee";
import { type OrbitxToken, listTokens } from "@/lib/orbitx/registry";
import { jupGetTokens, fmtPct } from "@/lib/og";
import { TokenCard, GRADUATION_MC_USD } from "./_shared";
import { useWatchlist } from "./watchlist";
import {
  useAllLaunches, launchStats, useMarketMap, totalLpUsd,
  fmtCompactUsd, type MarketRow,
} from "./lpx";

const OFFICIAL_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";

function FeaturedOfficialToken() {
  const { data } = useQuery({
    queryKey: ["home-featured-official"],
    queryFn: () => jupGetTokens([OFFICIAL_MINT]),
    staleTime: 20_000,
  });
  const tok = data?.[0];
  return (
    <Link to={`/orbitxlaunch/token/${OFFICIAL_MINT}`} className="pf-card block p-4 hover:border-[hsl(var(--pf-green))] transition">
      <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-[hsl(var(--pf-muted))]">
        <BadgeCheck className="h-4 w-4 text-[hsl(28_80%_32%)]" /> Featured
      </div>
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-bg))]">
          {tok?.icon ? <img src={tok.icon} alt={tok.symbol} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xs font-black text-[hsl(var(--pf-muted))]">OBX</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-black text-[hsl(var(--pf-ink))]">{tok?.name ?? "OrbitX"}</div>
          <div className="pf-mono text-xs text-[hsl(var(--pf-muted))]">
            {fmtCompactUsd(tok?.mcap ?? tok?.fdv)} MC
            {tok?.stats24h?.priceChange != null && <span className={tok.stats24h.priceChange >= 0 ? "text-[hsl(var(--pf-green-dark))]" : "text-[hsl(var(--pf-red))]"}> · {fmtPct(tok.stats24h.priceChange)}</span>}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-[hsl(var(--pf-muted))]" />
      </div>
    </Link>
  );
}

type BoardCategory = "new" | "trending" | "graduating" | "volume" | "gainers" | "gems" | "graduated" | "watchlist";

export default function LaunchpadHome() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<BoardCategory>("new");
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
  const originals = useMemo(() => (Array.isArray(launches) ? launches.filter((t) => !t?.is_vamp).length : 0), [launches]);
  const trending = useMemo(() => {
    const arr = Array.isArray(launches) ? launches.filter((t) => !!t && !t.is_vamp) : [];
    return arr
      .filter((t) => (markets?.[t.mint_address]?.vol24 ?? 0) > 0)
      .sort((a, b) => ((markets?.[b.mint_address]?.vol24 ?? 0) / (markets?.[b.mint_address]?.mcap ?? 1)) - ((markets?.[a.mint_address]?.vol24 ?? 0) / (markets?.[a.mint_address]?.mcap ?? 1)))
      .slice(0, 3);
  }, [launches, markets]);
  const graduating = useMemo(() => {
    const arr = Array.isArray(launches) ? launches.filter((t) => !!t) : [];
    return arr
      .filter((t) => {
        const m = markets?.[t.mint_address];
        const grad = !!t.lp_pool_address || !!t.graduated_at || (m?.mcap ?? 0) >= GRADUATION_MC_USD;
        return !grad && (m?.mcap ?? 0) > 0;
      })
      .sort((a, b) => (markets?.[b.mint_address]?.mcap ?? 0) - (markets?.[a.mint_address]?.mcap ?? 0))
      .slice(0, 3);
  }, [launches, markets]);

  const filtered = useMemo(() => {
    let items = Array.isArray(launches) ? launches.filter(t => !!t) : [];
    if (!items.length) return [];
    
    if (hideVamps) items = items.filter((t) => !t?.is_vamp);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((t) => {
        if (!t) return false;
        const name = t.name || "";
        const ticker = t.ticker || "";
        return name.toLowerCase().includes(q) || ticker.toLowerCase().includes(q);
      });
    }
    
    if (category === "watchlist") {
      items = items.filter((t) => t && watchSet.has(t.mint_address));
    }

    if (category === "graduated") {
      items = items.filter((t) => {
        if (!t) return false;
        return !!t.lp_pool_address || !!t.graduated_at || (markets?.[t.mint_address]?.mcap ?? 0) >= GRADUATION_MC_USD || (markets?.[t.mint_address]?.liq ?? 0) > 0;
      });
    } else if (category === "trending") {
      items = items.sort((a, b) => {
        if (!a || !b) return 0;
        const aVol = markets?.[a.mint_address]?.vol24 ?? 0;
        const aMc = markets?.[a.mint_address]?.mcap ?? 1;
        const bVol = markets?.[b.mint_address]?.vol24 ?? 0;
        const bMc = markets?.[b.mint_address]?.mcap ?? 1;
        return (bVol / bMc) - (aVol / aMc);
      });
    } else if (category === "volume") {
      items = items.sort((a, b) => {
        if (!a || !b) return 0;
        return (markets?.[b.mint_address]?.vol24 ?? 0) - (markets?.[a.mint_address]?.vol24 ?? 0);
      });
    } else if (category === "gainers") {
      items = items.sort((a, b) => {
        if (!a || !b) return 0;
        return (markets?.[b.mint_address]?.ch24 ?? 0) - (markets?.[a.mint_address]?.ch24 ?? 0);
      });

    } else if (category === "graduating") {
      items = items
        .filter((t) => {
          if (!t) return false;
          const m = markets?.[t.mint_address];
          const grad = !!t.lp_pool_address || !!t.graduated_at || (m?.mcap ?? 0) >= GRADUATION_MC_USD;
          return !grad && (m?.mcap ?? 0) > 0;
        })
        .sort((a, b) => (markets?.[b.mint_address]?.mcap ?? 0) - (markets?.[a.mint_address]?.mcap ?? 0));
    } else if (category === "gems") {
      items = items
        .filter((t) => {
          if (!t) return false;
          const mc = markets?.[t.mint_address]?.mcap ?? 0;
          return !t.is_vamp && mc > 1000 && mc < 20000;
        })
        .sort((a, b) => (markets?.[b.mint_address]?.vol24 ?? 0) - (markets?.[a.mint_address]?.vol24 ?? 0));
    }
    
    return items;
  }, [launches, markets, search, category, hideVamps, watchSet]);

  const promoActive = isLaunchFeePromoActive();
  const promoDaysLeft = launchFeePromoDaysLeft();

  return (
    <div className="space-y-6">
      {/* ─── Hero ──────────────────────────────────────────────── */}
      {/* ─── Hero ─── */}
      <div className="obx-hero p-6 sm:p-10 md:p-14">
        <div className="grid items-center gap-6 md:grid-cols-[1.1fr_0.9fr] md:gap-8">
          <div className="order-2 max-w-2xl md:order-1">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg-2))] px-3 py-1 pf-mono text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--pf-green))]">
              <Sparkles className="h-3.5 w-3.5" /> Next-gen Solana launchpad
            </div>
            <h1 className="obx-gradient-text mb-4 text-3xl font-black leading-[1.06] tracking-tight sm:text-4xl md:text-5xl">
              The safest place to launch and trade Solana memes
            </h1>
            <p className="mb-7 max-w-xl text-base leading-relaxed sm:text-lg" style={{ color: "#ffffff" }}>
              Launch original tokens. Discover hidden gems. Trade with confidence. Protected by OrbitX anti-vamp technology.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/orbitxlaunch/create" className="pf-btn"><Rocket className="h-4 w-4" /> Start a launch</Link>
            </div>
            <div className="mt-8 grid max-w-md grid-cols-3 gap-3">
              <div className="rounded-xl border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg-2))] p-3">
                <div className="pf-mono text-[9px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">100% on-chain</div>
                <div className="mt-1 text-sm font-black text-[hsl(var(--pf-green))]">Decentralized</div>
              </div>
              <div className="rounded-xl border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg-2))] p-3">
                <div className="pf-mono text-[9px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">Anti-vamp</div>
                <div className="mt-1 text-sm font-black text-[hsl(var(--pf-green))]">Zero clones</div>
              </div>
              <div className="rounded-xl border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg-2))] p-3">
                <div className="pf-mono text-[9px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">Creator owned</div>
                <div className="mt-1 text-sm font-black text-[hsl(var(--pf-green))]">Full control</div>
              </div>
            </div>
          </div>
          <div className="relative order-1 flex items-center justify-center md:order-2">
            <div className="obx-glow-ring left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 sm:h-72 sm:w-72" />
            <img src="/orbitx-globe.png" alt="OrbitX world" draggable={false} style={{ mixBlendMode: "screen" }} className="obx-globe relative w-44 max-w-xs select-none sm:w-64 md:w-full" />
          </div>
        </div>
      </div>

      {/* ─── Featured token ─── */}
      <FeaturedOfficialToken />

      {/* ─── Trending now ─── */}
      {trending.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[hsl(var(--pf-green))]" />
            <h2 className="text-sm font-black uppercase tracking-wide text-[hsl(var(--pf-ink))]">Trending now</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {trending.map((t) => <TokenCard key={t.mint_address} t={t} mc={markets?.[t.mint_address]?.mcap ?? null} market={markets?.[t.mint_address] ?? null} />)}
          </div>
        </section>
      )}

      {/* ─── Stats grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Tokens launched" value={stats.total} icon={<Rocket className="h-4 w-4" />} />
        <StatTile label="Graduated" value={stats.graduated} icon={<Droplets className="h-4 w-4" />} />
        <StatTile label="24h volume" value={fmtCompactUsd(vol24Total)} icon={<Activity className="h-4 w-4" />} />
        <StatTile label="Total liquidity" value={fmtCompactUsd(totalLpUsd(markets))} icon={<Coins className="h-4 w-4" />} />
        <StatTile label="Originals protected" value={originals} icon={<ShieldCheck className="h-4 w-4" />} />
        <StatTile label="24h trades" value={trades24.toLocaleString()} icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      {/* ─── Board controls ──────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="pf-card p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--pf-muted))]" />
              <input
                placeholder="Search by name or ticker…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[hsl(var(--pf-bg))] border border-[hsl(var(--pf-border))] rounded-lg pl-10 pr-4 py-2.5 text-sm text-[hsl(var(--pf-ink))] placeholder:text-[hsl(var(--pf-muted))] focus:border-[hsl(var(--pf-green))] outline-none"
              />
            </div>
            <button
              onClick={() => setHideVamps(!hideVamps)}
              className={`px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wide transition ${hideVamps ? "bg-[hsl(var(--pf-green))] text-white" : "border border-[hsl(var(--pf-border))] text-[hsl(var(--pf-muted))] hover:border-[hsl(var(--pf-ink))]"}`}
            >
              <ShieldCheck className="inline h-4 w-4 mr-1.5" />
              {hideVamps ? "Verified only" : "Show all"}
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {([
            { id: "new", label: "New" },
            { id: "trending", label: "Trending" },
            { id: "graduating", label: "Graduating" },
            { id: "volume", label: "Top volume" },
            { id: "gainers", label: "Gainers" },
            { id: "gems", label: "Hidden gems" },
            { id: "graduated", label: "Graduated" },
            { id: "watchlist", label: "Watchlist" },
          ] as { id: BoardCategory; label: string }[]).map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-4 py-2.5 rounded-full font-bold text-xs uppercase tracking-wide whitespace-nowrap transition ${
                category === c.id
                  ? "bg-[hsl(var(--pf-green))] text-black shadow-lg shadow-[hsl(var(--pf-green))]/30"
                  : "border border-[hsl(var(--pf-border))] text-[hsl(var(--pf-muted))] hover:border-[hsl(var(--pf-ink))]"
              }`}
            >
              {c.id === "new" && <Sparkles className="inline h-3.5 w-3.5 mr-1.5" />}
              {c.id === "trending" && <TrendingUp className="inline h-3.5 w-3.5 mr-1.5" />}
              {c.id === "graduating" && <Rocket className="inline h-3.5 w-3.5 mr-1.5" />}
              {c.id === "volume" && <Activity className="inline h-3.5 w-3.5 mr-1.5" />}
              {c.id === "gainers" && <Flame className="inline h-3.5 w-3.5 mr-1.5" />}
              {c.id === "gems" && <Gem className="inline h-3.5 w-3.5 mr-1.5" />}
              {c.id === "graduated" && <Droplets className="inline h-3.5 w-3.5 mr-1.5" />}
              {c.id === "watchlist" && <Star className="inline h-3.5 w-3.5 mr-1.5" />}
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Board grid ──────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-[hsl(var(--pf-muted))]">
          <Loader2 className="h-4 w-4 animate-spin" /> loading launches…
        </div>
      ) : !filtered.length ? (
        <div className="pf-card text-center py-16">
          <Eye className="h-12 w-12 text-[hsl(var(--pf-muted))] mx-auto mb-4 opacity-50" />
          <div className="text-lg font-bold text-[hsl(var(--pf-muted))]">No launches found</div>
          <p className="text-sm text-[hsl(var(--pf-muted))] mt-2">Try adjusting your filters or be the first to launch here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(filtered || []).slice(0, 50).map((t) => (
            <TokenCard key={t.mint_address} t={t} mc={markets?.[t.mint_address]?.mcap ?? null} market={markets?.[t.mint_address] ?? null} />
          ))}
        </div>
      )}

      {graduating.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Rocket className="h-4 w-4 text-[hsl(var(--pf-gold))]" />
            <h2 className="text-sm font-black uppercase tracking-wide text-[hsl(var(--pf-ink))]">Graduating soon</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {graduating.map((t) => <TokenCard key={t.mint_address} t={t} mc={markets?.[t.mint_address]?.mcap ?? null} market={markets?.[t.mint_address] ?? null} />)}
          </div>
        </section>
      )}

      {promoActive && (
        <div className="pf-card border-[hsl(var(--pf-green))] bg-[hsl(var(--pf-green))]/5 p-4">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-[hsl(var(--pf-green))]" />
            <div>
              <div className="font-bold text-[hsl(var(--pf-green))]">Launch promo active</div>
              <p className="text-xs text-[hsl(var(--pf-muted))] mt-0.5">{promoDaysLeft} day{promoDaysLeft === 1 ? "" : "s"} left — ${ORBITX_FEE_USD} to launch on any lane (custom SPL or pump.fun)</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="pf-card p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="pf-mono text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">{label}</span>
        <div className="text-[hsl(var(--pf-muted))]">{icon}</div>
      </div>
      <div className="text-2xl font-black text-[hsl(var(--pf-ink))]">{value}</div>
    </div>
  );
}
