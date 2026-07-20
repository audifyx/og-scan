// OrbitX Launchpad — home board. Classic pump.fun (2023) layout:
// hero up top, a real sortable/filterable board as the main event,
// live feed + tools alongside. Every number here is real:
//   registry (orbitx_tokens) → launches / lanes / flags / logos
//   DexScreener             → mcap, liquidity, volume, 24h deltas
//   Solana mainnet RPC      → slot, TPS, RPC latency (header ticker)
//   CoinGecko (60s cache)   → SOL/USD
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Rocket, Zap, HandCoins, Flame, Loader2, Radar,
  TrendingUp, Droplets, ArrowRight, UserCircle2, Sparkles, BadgeCheck,
} from "lucide-react";
import { ORBITX_FEE_USD, fmtUsd, isLaunchFeePromoActive, launchFeePromoDaysLeft } from "@/lib/orbitx/fee";
import { type OrbitxToken } from "@/lib/orbitx/registry";
import { jupGetTokens, fmtPct } from "@/lib/og";
import { TokenCard } from "./_shared";
import {
  useAllLaunches, launchStats, useMarketMap, totalLpUsd,
  fmtCompactUsd, type MarketRow,
} from "./lpx";

const OFFICIAL_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";

/** Featured card for the official token — pulled live from Jupiter, same
 * source the token page itself falls back to, so no data is invented and
 * the link always resolves. */
function FeaturedOfficialToken() {
  const { data } = useQuery({
    queryKey: ["home-featured-official"],
    queryFn: () => jupGetTokens([OFFICIAL_MINT]),
    staleTime: 20_000,
  });
  const tok = data?.[0];
  return (
    <Link to={`/orbitxlaunch/token/${OFFICIAL_MINT}`} className="pf-card block p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-[hsl(var(--pf-muted))]">
        <BadgeCheck className="h-3.5 w-3.5 text-[hsl(28_80%_32%)]" /> Featured
      </div>
      <div className="flex items-center gap-2.5">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-bg))]">
          {tok?.icon ? <img src={tok.icon} alt={tok.symbol} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[10px] font-black text-[hsl(var(--pf-muted))]">OBX</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black text-[hsl(var(--pf-ink))]">{tok?.name ?? "OrbitX"}</div>
          <div className="pf-mono text-[10px] text-[hsl(var(--pf-muted))]">
            {fmtCompactUsd(tok?.mcap ?? tok?.fdv)} MC
            {tok?.stats24h?.priceChange != null && <span className={tok.stats24h.priceChange >= 0 ? "text-[hsl(var(--pf-green-dark))]" : "text-[hsl(var(--pf-red))]"}> · {fmtPct(tok.stats24h.priceChange)}</span>}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-[hsl(var(--pf-muted))]" />
      </div>
    </Link>
  );
}

/* ═══════════════ HERO ═══════════════ */

function Hero() {
  return (
    <div className="pf-card p-6 text-center sm:p-8">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        {["100% on-chain", "Anti-vamp protected", "Built for creators"].map((b) => (
          <span key={b} className="pf-pill pf-pill--green">{b}</span>
        ))}
        {isLaunchFeePromoActive() && (
          <span className="pf-pill pf-pill--gold">★ Free launches — {launchFeePromoDaysLeft()} days left</span>
        )}
      </div>
      <h1 className="text-3xl font-black leading-tight tracking-tight text-[hsl(var(--pf-ink))] sm:text-4xl">
        launch a solana coin<br />that can't be cloned
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-[hsl(var(--pf-muted))]">
        Unique name, ticker and CA — enforced by the anti-vamp registry. Auto-ground vanity CA.
        Your buy/sell fee comes straight back to your wallet, claimable in-app.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link to="/orbitxlaunch/create" className="pf-btn px-8 py-3 text-sm">
          <Rocket className="h-4 w-4" /> start a new coin
        </Link>
        <a href="#board" className="pf-btn pf-btn--ghost px-6 py-3 text-sm">
          <TrendingUp className="h-4 w-4" /> browse launches
        </a>
      </div>
      <div className="mt-3 pf-mono text-[11px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">
        {isLaunchFeePromoActive() ? <>free for {launchFeePromoDaysLeft()} days</> : <>{fmtUsd(ORBITX_FEE_USD)} flat fee</>} · pump + custom lanes · Solana mainnet
      </div>
    </div>
  );
}

/* ═══════════════ compact stat strip ═══════════════ */

function StatStrip({ stats, lpUsd, loaded }: { stats: ReturnType<typeof launchStats>; lpUsd: number | null; loaded: boolean }) {
  const tiles = [
    { icon: Rocket, label: "Launches", value: loaded ? String(stats.total) : "—", tone: "green" },
    { icon: Droplets, label: "Graduated", value: loaded ? String(stats.graduated) : "—", tone: "blue" },
    { icon: TrendingUp, label: "Live LP", value: fmtCompactUsd(lpUsd), tone: "gold" },
    { icon: Sparkles, label: "Last 24h", value: loaded ? String(stats.last24h) : "—", tone: "green" },
  ];
  const colorCls: Record<string, string> = {
    green: "text-[hsl(var(--pf-green-dark))]", blue: "text-[hsl(var(--pf-blue))]",
    gold: "text-[hsl(28_80%_32%)]", red: "text-[hsl(var(--pf-red))]",
  };
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="pf-card flex items-center gap-2.5 p-2.5">
          <t.icon className={`h-4 w-4 shrink-0 ${colorCls[t.tone]}`} />
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--pf-muted))]">{t.label}</div>
            <div className={`text-base font-black leading-tight ${colorCls[t.tone]}`}>{t.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════ live feed (recent launches list) ═══════════════ */

function FeedRow({ t, m, rank }: { t: OrbitxToken; m: MarketRow | undefined; rank: number }) {
  const up = (m?.ch24 ?? 0) >= 0;
  return (
    <Link to={`/orbitxlaunch/token/${t.mint_address}`} className="flex items-center gap-2.5 rounded-lg p-2 transition hover:bg-[hsl(var(--pf-ink))]/[0.04]">
      <span className="pf-mono w-5 shrink-0 text-[10px] font-bold text-[hsl(var(--pf-muted))]">{String(rank).padStart(2, "0")}</span>
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border-2 border-[hsl(var(--pf-ink))]">
        {t.logo_url
          ? <img src={t.logo_url} alt={t.ticker} className="h-full w-full object-cover" loading="lazy" />
          : <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-[hsl(var(--pf-muted))]">{t.ticker.slice(0, 2)}</div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-black text-[hsl(var(--pf-ink))]">{t.ticker}</span>
          {m?.ch24 != null && (
            <span className={`pf-mono text-[10px] font-bold ${up ? "text-[hsl(var(--pf-green-dark))]" : "text-[hsl(var(--pf-red))]"}`}>
              {up ? "▲" : "▼"} {Math.abs(m.ch24).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 pf-mono text-[9px] text-[hsl(var(--pf-muted))]">
          <span>MC {fmtCompactUsd(m?.mcap)}</span>
          <span>VOL {fmtCompactUsd(m?.vol24)}</span>
        </div>
      </div>
    </Link>
  );
}

function LiveFeed({ tokens, market, loading }: {
  tokens: OrbitxToken[]; market: Record<string, MarketRow> | undefined; loading: boolean;
}) {
  const rows = useMemo(() => [...tokens].slice(0, 8), [tokens]);
  return (
    <div className="pf-card p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Radar className="h-3.5 w-3.5 text-[hsl(var(--pf-green-dark))]" />
        <h3 className="text-xs font-black uppercase tracking-wide">Newest launches</h3>
      </div>
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-xs text-[hsl(var(--pf-muted))]">
          <Loader2 className="h-4 w-4 animate-spin" /> syncing registry…
        </div>
      ) : rows.length === 0 ? (
        <div className="px-3 py-10 text-center">
          <Rocket className="mx-auto mb-2 h-6 w-6 text-[hsl(var(--pf-green))]" />
          <div className="text-xs text-[hsl(var(--pf-muted))]">Feed is empty — the first launch takes slot 01</div>
        </div>
      ) : (
        <div className="space-y-0.5">
          {rows.map((t, i) => <FeedRow key={t.id} t={t} m={market?.[t.mint_address]} rank={i + 1} />)}
        </div>
      )}
    </div>
  );
}

function QuickActions() {
  const items = [
    { to: "/orbitxlaunch/claim", icon: HandCoins, label: "Claim creator fees" },
    { to: "/orbitxlaunch/profile", icon: UserCircle2, label: "View my tokens" },
    { to: "/orbitxlaunch/rescue", icon: Flame, label: "Claim / burn console" },
  ];
  return (
    <div className="pf-card p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5 text-[hsl(var(--pf-green-dark))]" />
        <h3 className="text-xs font-black uppercase tracking-wide">Quick actions</h3>
      </div>
      <div className="space-y-1.5">
        {items.map((a) => (
          <Link key={a.label} to={a.to} className="flex items-center gap-2 rounded-lg border border-[hsl(var(--pf-border))] px-3 py-2 text-xs font-bold text-[hsl(var(--pf-ink))] transition hover:border-[hsl(var(--pf-green))]">
            <a.icon className="h-3.5 w-3.5 text-[hsl(var(--pf-green-dark))]" /> {a.label}
            <ArrowRight className="ml-auto h-3 w-3 text-[hsl(var(--pf-muted))]" />
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════ ALL LAUNCHES board — real category + sort tabs ═══════════════ */

type BoardCategory = "new" | "graduated" | "trending" | "volume" | "gainers";

const CATEGORIES: { id: BoardCategory; label: string; icon: typeof Flame }[] = [
  { id: "new", label: "Fresh", icon: Flame },
  { id: "graduated", label: "Graduated", icon: Droplets },
  { id: "trending", label: "Trending", icon: Radar },
  { id: "volume", label: "Volume", icon: TrendingUp },
  { id: "gainers", label: "Gainers", icon: Sparkles },
];

function Board({ category, tokens, market, loading }: {
  category: BoardCategory; tokens: OrbitxToken[]; market: Record<string, MarketRow> | undefined; loading: boolean;
}) {
  const rows = useMemo(() => {
    const mOf = (t: OrbitxToken) => market?.[t.mint_address];
    let list = tokens;
    if (category === "graduated") list = list.filter((t) => !!t.lp_pool_address);
    const sorted = [...list];
    switch (category) {
      case "trending":
        sorted.sort((a, b) => ((mOf(b)?.vol24 ?? 0) / Math.max(1, mOf(b)?.mcap ?? 1)) - ((mOf(a)?.vol24 ?? 0) / Math.max(1, mOf(a)?.mcap ?? 1)));
        break;
      case "volume":
        sorted.sort((a, b) => (mOf(b)?.vol24 ?? 0) - (mOf(a)?.vol24 ?? 0));
        break;
      case "gainers":
        sorted.sort((a, b) => (mOf(b)?.ch24 ?? -Infinity) - (mOf(a)?.ch24 ?? -Infinity));
        break;
      default:
        break; // "new" / "graduated" stay in registry (newest-first) order
    }
    return sorted;
  }, [tokens, market, category]);

  if (loading)
    return <div className="flex items-center justify-center gap-2 py-16 text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-5 w-5 animate-spin" /> loading launches…</div>;
  if (rows.length === 0)
    return (
      <div className="pf-card flex flex-col items-center justify-center gap-3 py-14 text-center">
        <Rocket className="h-8 w-8 text-[hsl(var(--pf-green))]" />
        <div className="text-lg font-black">No launches yet</div>
        <div className="max-w-sm text-sm text-[hsl(var(--pf-muted))]">Every launch gets an <span className="pf-mono">obx</span> vanity CA and passes the anti-vamp check. Be first.</div>
        <Link to="/orbitxlaunch/create" className="pf-btn"><Rocket className="h-4 w-4" /> Launch the first token</Link>
      </div>
    );
  return (
    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((t) => <TokenCard key={t.id} t={t} mc={market?.[t.mint_address]?.mcap ?? null} />)}
    </div>
  );
}

/* ═══════════════════════ PAGE ═══════════════════════ */

export default function LaunchpadHome() {
  const [category, setCategory] = useState<BoardCategory>("new");
  const allQ = useAllLaunches();
  const tokens = allQ.data ?? [];
  const stats = useMemo(() => launchStats(allQ.data), [allQ.data]);
  const mints = useMemo(() => tokens.map((t) => t.mint_address), [tokens]);
  const marketQ = useMarketMap(mints);
  const lpUsd = totalLpUsd(marketQ.data);

  return (
    <div className="space-y-5">
      <Hero />
      <StatStrip stats={stats} lpUsd={lpUsd} loaded={allQ.isSuccess} />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div id="board" className="scroll-mt-24">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-wide">
              Launches <span className="pf-mono text-[hsl(var(--pf-muted))]">({stats.total})</span>
            </h2>
            <div className="flex gap-0.5 overflow-x-auto rounded-full border border-[hsl(var(--pf-border))] p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {CATEGORIES.map((c) => (
                <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 pf-mono text-[10px] font-bold uppercase tracking-wide transition ${
                    category === c.id ? "bg-[hsl(var(--pf-ink))] text-white" : "text-[hsl(var(--pf-muted))] hover:text-[hsl(var(--pf-ink))]"
                  }`}>
                  <c.icon className="h-3 w-3" /> {c.label}
                </button>
              ))}
            </div>
          </div>
          <Board category={category} tokens={tokens} market={marketQ.data} loading={allQ.isLoading} />
        </div>

        <div className="space-y-4">
          <FeaturedOfficialToken />
          <LiveFeed tokens={tokens} market={marketQ.data} loading={allQ.isLoading} />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
