// OrbitX Launchpad — home board. Classic pump.fun (2023) layout:
// hero + start button up top, tabbed coin board as the main event,
// live feed + tools underneath. Every number on this page is real:
//   registry (orbitx_tokens) → launches / lanes / flags / logos
//   DexScreener             → mcap, liquidity, volume, 24h deltas, sparklines
//   Solana mainnet RPC      → slot, TPS, RPC latency
//   CoinGecko (60s cache)   → SOL/USD
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Rocket, ShieldCheck, Zap, HandCoins, Flame, Loader2, Radar,
  TrendingUp, Droplets, ArrowRight, Wand2, UserCircle2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ORBITX_FEE_USD, fmtUsd, isLaunchFeePromoActive, launchFeePromoDaysLeft } from "@/lib/orbitx/fee";
import { CREATOR_FEE_BPS } from "@/lib/platformFee";
import { listTokens, type FeedKind, type OrbitxToken } from "@/lib/orbitx/registry";
import { TokenCard } from "./_shared";
import {
  useAllLaunches, launchStats, useMarketMap, totalLpUsd,
  fmtCompactUsd, type MarketRow,
} from "./lpx";

/* ── vanity math (same model as the create-page grinder) ── */
function vanityEstimate(prefix: string, ratePerSec = 8000) {
  const n = prefix.trim().length;
  const expected = Math.pow(58, n) / 2;
  return { n, expected, seconds: expected / ratePerSec };
}
function humanTime(sec: number) {
  if (!Number.isFinite(sec)) return "∞";
  if (sec < 1) return "<1s";
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${(sec / 3600).toFixed(1)}h`;
  return `${(sec / 86400).toFixed(1)}d`;
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
        Unique name, ticker and CA enforced by the anti-vamp registry. OBX vanity address.
        {" "}{(CREATOR_FEE_BPS / 100).toFixed(2)}% of every trade back to you — claimable in-app.
      </p>
      <div className="mt-6">
        <Link to="/orbitxlaunch/create" className="pf-btn px-8 py-3 text-sm">
          <Rocket className="h-4 w-4" /> start a new coin
        </Link>
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
    { icon: ShieldCheck, label: "Vamps flagged", value: loaded ? String(stats.flagged) : "—", tone: "red" },
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

type FeedSort = "fresh" | "trending" | "volume" | "gainers";

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
  const [sort, setSort] = useState<FeedSort>("fresh");
  const rows = useMemo(() => {
    const list = [...tokens];
    const mOf = (t: OrbitxToken) => market?.[t.mint_address];
    switch (sort) {
      case "trending":
        return list.sort((a, b) => ((mOf(b)?.vol24 ?? 0) / Math.max(1, mOf(b)?.mcap ?? 1)) - ((mOf(a)?.vol24 ?? 0) / Math.max(1, mOf(a)?.mcap ?? 1)));
      case "volume":
        return list.sort((a, b) => (mOf(b)?.vol24 ?? 0) - (mOf(a)?.vol24 ?? 0));
      case "gainers":
        return list.sort((a, b) => (mOf(b)?.ch24 ?? -Infinity) - (mOf(a)?.ch24 ?? -Infinity));
      default:
        return list;
    }
  }, [tokens, market, sort]);

  const TABS: { id: FeedSort; label: string }[] = [
    { id: "fresh", label: "Fresh" }, { id: "trending", label: "Trending" },
    { id: "volume", label: "Volume" }, { id: "gainers", label: "Gainers" },
  ];

  return (
    <div className="pf-card p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Radar className="h-3.5 w-3.5 text-[hsl(var(--pf-green-dark))]" />
        <h3 className="text-xs font-black uppercase tracking-wide">Live feed</h3>
      </div>
      <div className="mb-2 flex gap-0.5 rounded-full border border-[hsl(var(--pf-border))] p-0.5">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setSort(t.id)}
            className={`flex-1 rounded-full px-2 py-1 pf-mono text-[9px] font-bold uppercase tracking-wide transition ${
              sort === t.id ? "bg-[hsl(var(--pf-ink))] text-white" : "text-[hsl(var(--pf-muted))] hover:text-[hsl(var(--pf-ink))]"
            }`}>
            {t.label}
          </button>
        ))}
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
          {rows.slice(0, 8).map((t, i) => <FeedRow key={t.id} t={t} m={market?.[t.mint_address]} rank={i + 1} />)}
        </div>
      )}
    </div>
  );
}

/* ═══════════════ tool cards: vanity CA + anti-vamp + claim + quick actions ═══════════════ */

function VanityWidget() {
  const [prefix, setPrefix] = useState("OBX");
  const est = useMemo(() => vanityEstimate(prefix), [prefix]);
  return (
    <div className="pf-card p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Wand2 className="h-3.5 w-3.5 text-[hsl(var(--pf-green-dark))]" />
        <h3 className="text-xs font-black uppercase tracking-wide">Vanity CA generator</h3>
      </div>
      <div className="flex gap-2">
        <input
          value={prefix}
          maxLength={6}
          onChange={(e) => setPrefix(e.target.value.replace(/[^1-9A-HJ-NP-Za-km-z]/g, ""))}
          className="w-full rounded-full border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] px-3 py-2 pf-mono text-sm outline-none transition focus:border-[hsl(var(--pf-green))]"
          placeholder="OBX"
        />
        <Link to="/orbitxlaunch/create/custom" className="pf-btn pf-btn--sm shrink-0">Grind it</Link>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-[hsl(var(--pf-border))] p-1.5">
          <div className="text-[8px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">chars</div>
          <div className="pf-mono text-sm font-bold">{est.n || "—"}</div>
        </div>
        <div className="rounded-lg border border-[hsl(var(--pf-border))] p-1.5">
          <div className="text-[8px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">est. tries</div>
          <div className="pf-mono text-sm font-bold">{est.n ? (est.expected >= 1e6 ? est.expected.toExponential(1) : Math.round(est.expected).toLocaleString()) : "—"}</div>
        </div>
        <div className="rounded-lg border border-[hsl(var(--pf-border))] p-1.5">
          <div className={`pf-mono text-sm font-bold ${est.n > 4 ? "text-[hsl(var(--pf-red))]" : "text-[hsl(var(--pf-green-dark))]"}`}>{est.n ? humanTime(est.seconds) : "—"}</div>
          <div className="text-[8px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">est. time</div>
        </div>
      </div>
    </div>
  );
}

function AntiVampPanel({ stats, loaded }: { stats: ReturnType<typeof launchStats>; loaded: boolean }) {
  return (
    <div className="pf-card p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-[hsl(28_80%_32%)]" />
        <h3 className="text-xs font-black uppercase tracking-wide">Anti-vamp protection</h3>
      </div>
      <p className="text-xs leading-relaxed text-[hsl(var(--pf-muted))]">
        Every launch is checked against pump.fun, DexScreener and the OrbitX registry.
        Exact clones are blocked; look-alikes launch flagged with fees routed to OBX buybacks.
        Originals earn 100% of creator fees.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg border border-[hsl(var(--pf-border))] p-2">
          <div className="text-[8px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">protected</div>
          <div className="text-lg font-black text-[hsl(var(--pf-green-dark))]">{loaded ? stats.total - stats.flagged : "—"}</div>
        </div>
        <div className="rounded-lg border border-[hsl(var(--pf-border))] p-2">
          <div className="text-[8px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">flagged</div>
          <div className="text-lg font-black text-[hsl(var(--pf-red))]">{loaded ? stats.flagged : "—"}</div>
        </div>
      </div>
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

/* ═══════════════ ALL LAUNCHES board — the main pump.fun-style grid ═══════════════ */

function Board({ kind, market }: { kind: FeedKind; market: Record<string, MarketRow> | undefined }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["orbitx-tokens", kind],
    queryFn: () => listTokens(kind),
    refetchInterval: 30_000,
  });
  if (isLoading)
    return <div className="flex items-center justify-center gap-2 py-16 text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-5 w-5 animate-spin" /> loading launches…</div>;
  if (error)
    return <div className="py-16 text-center text-sm text-[hsl(var(--pf-red))]">Feed unavailable — retry in a moment</div>;
  if (!data || data.length === 0)
    return (
      <div className="pf-card flex flex-col items-center justify-center gap-3 py-14 text-center">
        <Rocket className="h-8 w-8 text-[hsl(var(--pf-green))]" />
        <div className="text-lg font-black">No launches yet</div>
        <div className="max-w-sm text-sm text-[hsl(var(--pf-muted))]">Every launch gets an <span className="pf-mono">obx</span> vanity CA and passes the anti-vamp check. Be first.</div>
        <Link to="/orbitxlaunch/create" className="pf-btn">
          <Rocket className="h-4 w-4" /> Launch the first token
        </Link>
      </div>
    );
  return (
    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.map((t) => <TokenCard key={t.id} t={t} mc={market?.[t.mint_address]?.mcap ?? null} />)}
    </div>
  );
}

/* ═══════════════════════ PAGE ═══════════════════════ */

export default function LaunchpadHome() {
  const [tab, setTab] = useState<FeedKind>("new");
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

      {/* ── main board (left) + live feed / tools (right) ── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div id="launches" className="scroll-mt-24">
          <Tabs value={tab} onValueChange={(v) => setTab(v as FeedKind)}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-black uppercase tracking-wide">
                Launches <span className="pf-mono text-[hsl(var(--pf-muted))]">({stats.total})</span>
              </h2>
              <TabsList>
                <TabsTrigger value="new"><Flame className="mr-1.5 h-3.5 w-3.5" /> Fresh</TabsTrigger>
                <TabsTrigger value="graduated"><Droplets className="mr-1.5 h-3.5 w-3.5" /> Graduated</TabsTrigger>
                <TabsTrigger value="all"><TrendingUp className="mr-1.5 h-3.5 w-3.5" /> All</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="new"><Board kind="new" market={marketQ.data} /></TabsContent>
            <TabsContent value="graduated"><Board kind="graduated" market={marketQ.data} /></TabsContent>
            <TabsContent value="all"><Board kind="all" market={marketQ.data} /></TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <LiveFeed tokens={tokens} market={marketQ.data} loading={allQ.isLoading} />
          <VanityWidget />
          <AntiVampPanel stats={stats} loaded={allQ.isSuccess} />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
