// OrbitX Launchpad — home board. Modern 2026 design with real data everywhere:
// hero up top, filterable/sortable board, live feed, analytics. Works for
// pump.fun and custom SPL launches, real market data from DexScreener.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Rocket, Zap, HandCoins, Flame, Loader2, ArrowRight, 
  TrendingUp, Droplets, Sparkles, BadgeCheck, Search, Filter,
  ShieldCheck, ShieldAlert, Eye, Users, Activity, Coins,
} from "lucide-react";
import { ORBITX_FEE_USD, isLaunchFeePromoActive, launchFeePromoDaysLeft } from "@/lib/orbitx/fee";
import { type OrbitxToken } from "@/lib/orbitx/registry";
import { jupGetTokens, fmtPct } from "@/lib/og";
import { TokenCard } from "./_shared";
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

type BoardCategory = "new" | "graduated" | "trending" | "volume" | "gainers";

export default function LaunchpadHome() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<BoardCategory>("new");
  const [hideVamps, setHideVamps] = useState(false);

  const { data: launches, isLoading } = useQuery({
    queryKey: ["orbitx-home-launches"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/orbitx_tokens?order=created_at.desc&limit=200`, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_KEY ?? "" },
      });
      return (await res.json()) as OrbitxToken[];
    },
    staleTime: 15_000,
  });

  const mints = useMemo(() => launches?.map((t) => t.mint_address) ?? [], [launches]);
  const { data: markets } = useMarketMap(mints);

  const stats = useMemo(() => launchStats(launches), [launches]);

  const filtered = useMemo(() => {
    let items = launches ?? [];
    if (hideVamps) items = items.filter((t) => !t.is_vamp);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((t) => t.name.toLowerCase().includes(q) || t.ticker.toLowerCase().includes(q));
    }
    if (category === "graduated") items = items.filter((t) => !!t.lp_pool_address || (markets?.[t.mint_address]?.liq ?? 0) > 0);
    else if (category === "trending") items = items.sort((a, b) => {
      const aVol = markets?.[a.mint_address]?.vol24 ?? 0;
      const aMc = markets?.[a.mint_address]?.mcap ?? 1;
      const bVol = markets?.[b.mint_address]?.vol24 ?? 0;
      const bMc = markets?.[b.mint_address]?.mcap ?? 1;
      return (bVol / bMc) - (aVol / aMc);
    });
    else if (category === "volume") items = items.sort((a, b) => (markets?.[b.mint_address]?.vol24 ?? 0) - (markets?.[a.mint_address]?.vol24 ?? 0));
    else if (category === "gainers") items = items.sort((a, b) => (markets?.[b.mint_address]?.ch24 ?? 0) - (markets?.[a.mint_address]?.ch24 ?? 0));
    return items;
  }, [launches, markets, search, category, hideVamps]);

  const promoActive = isLaunchFeePromoActive();
  const promoDaysLeft = launchFeePromoDaysLeft();

  return (
    <div className="space-y-6">
      {/* ─── Hero ──────────────────────────────────────────────── */}
      <div className="pf-card p-8 md:p-12">
        <div className="max-w-2xl">
          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-[hsl(var(--pf-ink))] mb-3">
            Launch your token
          </h1>
          <p className="text-lg md:text-xl text-[hsl(var(--pf-muted))] mb-6 leading-relaxed">
            Build on Solana with anti-vamp protection, zero-clone guarantee, and creator-first design.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/orbitxlaunch/create" className="pf-btn">
              <Rocket className="h-4 w-4" /> Start launch
            </Link>
            <a href="https://docs.orbitx.world" target="_blank" rel="noreferrer" className="pf-btn-ghost">
              Learn more →
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-6 text-sm">
            <div>
              <div className="pf-mono text-xs text-[hsl(var(--pf-muted))] uppercase tracking-wider mb-1">100% on-chain</div>
              <div className="text-lg font-black text-[hsl(var(--pf-green-dark))]">Decentralized launch</div>
            </div>
            <div>
              <div className="pf-mono text-xs text-[hsl(var(--pf-muted))] uppercase tracking-wider mb-1">Anti-vamp</div>
              <div className="text-lg font-black text-[hsl(var(--pf-green-dark))]">Zero clones</div>
            </div>
            <div>
              <div className="pf-mono text-xs text-[hsl(var(--pf-muted))] uppercase tracking-wider mb-1">Creator owned</div>
              <div className="text-lg font-black text-[hsl(var(--pf-green-dark))]">You keep control</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Featured token ──────────────────────────────────────────────── */}
      <FeaturedOfficialToken />

      {/* ─── Stats grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Launches" value={stats.total} icon={<Rocket className="h-4 w-4" />} />
        <StatTile label="Graduated" value={stats.graduated} icon={<Droplets className="h-4 w-4" />} />
        <StatTile label="Total liquidity" value={fmtCompactUsd(totalLpUsd(markets))} icon={<Coins className="h-4 w-4" />} />
        <StatTile label="Last 24h" value={stats.last24h} icon={<Activity className="h-4 w-4" />} />
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
          {(["new", "graduated", "trending", "volume", "gainers"] as BoardCategory[]).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-4 py-2.5 rounded-full font-bold text-xs uppercase tracking-wide whitespace-nowrap transition ${
                category === c
                  ? "bg-[hsl(var(--pf-ink))] text-white"
                  : "border border-[hsl(var(--pf-border))] text-[hsl(var(--pf-muted))] hover:border-[hsl(var(--pf-ink))]"
              }`}
            >
              {c === "new" && <Sparkles className="inline h-3.5 w-3.5 mr-1.5" />}
              {c === "graduated" && <Droplets className="inline h-3.5 w-3.5 mr-1.5" />}
              {c === "trending" && <TrendingUp className="inline h-3.5 w-3.5 mr-1.5" />}
              {c === "volume" && <Activity className="inline h-3.5 w-3.5 mr-1.5" />}
              {c === "gainers" && <Flame className="inline h-3.5 w-3.5 mr-1.5" />}
              {c}
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
            <TokenCard key={t.mint_address} token={t} market={markets?.[t.mint_address] ?? null} />
          ))}
        </div>
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
