// Orbitx Launchpad — Home. V3 terminal/cyberpunk redesign.
// Data layer unchanged: real launches from the anti-vamp registry
// (orbitx_tokens via listTokens). Live market caps are an additive,
// fail-soft enrichment via DexScreener (dexPairsForMints).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Rocket, Flame, Droplets, Loader2, ShieldCheck, TrendingUp, Zap, HandCoins } from "lucide-react";
import { ORBITX_FEE_USD, fmtUsd } from "@/lib/orbitx/fee";
import { CREATOR_FEE_BPS } from "@/lib/platformFee";
import { listTokens, type FeedKind } from "@/lib/orbitx/registry";
import { dexPairsForMints } from "@/lib/og";
import { TokenCard, StatTile } from "./_shared";

/** Fail-soft live market caps for the mints on screen. Purely presentational. */
function useMarketCaps(mints: string[]) {
  return useQuery({
    queryKey: ["lp-mc", mints.join(",")],
    enabled: mints.length > 0,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Record<string, number>> => {
      try {
        const pairs = await dexPairsForMints(mints);
        const out: Record<string, number> = {};
        for (const p of pairs) {
          const addr = p.baseToken?.address;
          const mc = p.marketCap ?? p.fdv;
          if (!addr || !mc || !Number.isFinite(mc)) continue;
          if (!(addr in out) || mc > out[addr]) out[addr] = mc;
        }
        return out;
      } catch {
        return {};
      }
    },
  });
}

function Feed({ kind }: { kind: FeedKind }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["orbitx-tokens", kind],
    queryFn: () => listTokens(kind),
    refetchInterval: 30_000,
  });
  const mc = useMarketCaps((data ?? []).map((t) => t.mint_address));

  if (isLoading)
    return <div className="flex items-center justify-center gap-2 py-20 font-mono text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> loading launches…</div>;
  if (error)
    return <div className="py-20 text-center font-mono text-sm text-[hsl(var(--og-blood))]">{"// feed unavailable — retry in a moment"}</div>;
  if (!data || data.length === 0)
    return (
      <div className="og-glass-card flex flex-col items-center justify-center gap-4 border-dashed py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[hsl(var(--og-gold))]/30 bg-[hsl(var(--og-gold))]/10"><Rocket className="h-7 w-7 text-[hsl(var(--og-gold))]" /></div>
        <div>
          <div className="font-display text-lg font-bold text-foreground">No launches yet</div>
          <div className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            The board fills as tokens launch through Orbitx. Every launch gets an <span className="font-mono text-[hsl(var(--og-gold))]">obx</span> vanity CA and passes the anti-vamp check. Be the first.
          </div>
        </div>
        <Link to="/orbitxlaunch/create" className="lp-cta inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-white">
          <Rocket className="h-4 w-4" /> Launch the first token
        </Link>
      </div>
    );

  return (
    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.map((t) => <TokenCard key={t.id} t={t} mc={mc.data?.[t.mint_address] ?? null} />)}
    </div>
  );
}

const BOARD_META: Record<FeedKind, { title: string; sub: string }> = {
  new: { title: "Fresh Pairs", sub: "Newest launches straight off the pad." },
  graduated: { title: "Graduated", sub: "Tokens that cleared the graduation threshold." },
  all: { title: "All Launches", sub: "Every token launched through Orbitx." },
};

export default function LaunchpadHome() {
  const [tab, setTab] = useState<FeedKind>("new");
  const all = useQuery({ queryKey: ["orbitx-tokens", "all"], queryFn: () => listTokens("all"), refetchInterval: 30_000 });
  const total = all.data?.length ?? 0;
  const graduated = all.data?.filter((t) => t.lp_pool_address).length ?? 0;
  const counts: Record<FeedKind, number> = { new: total, graduated, all: total };
  const meta = BOARD_META[tab];

  return (
    <div>
      {/* ── Hero launch section ── */}
      <div className="og-glass-frame relative mb-6 overflow-hidden p-6 sm:p-10">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-30" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-[hsl(var(--og-gold))]/14 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/4 h-56 w-56 rounded-full bg-[hsl(var(--og-cyan))]/10 blur-3xl" />
        <div className="relative max-w-2xl">
          <div className="flex flex-wrap gap-2">
            <div className="glass-pill text-[hsl(var(--og-lime))]">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--og-lime))] opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--og-lime))]" /></span>
              MAINNET LIVE
            </div>
            <div className="glass-pill text-[hsl(var(--og-gold))]">
              <ShieldCheck className="h-3.5 w-3.5" /> ANTI-VAMP • UNIQUE CA / NAME / TICKER
            </div>
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-[3rem]">
            Launch a Solana token<br /><span className="gradient-text">that can't be cloned.</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Custom SPL mint, own liquidity pool, vanity <span className="font-mono text-[hsl(var(--og-gold))]">OBX</span> contract address, and a flat {fmtUsd(ORBITX_FEE_USD)} launch fee. Copycats get blocked — or their fees get routed to buybacks. {(CREATOR_FEE_BPS / 100).toFixed(2)}% of every trade goes to you, claimable in-app.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <Link to="/orbitxlaunch/create" className="lp-cta inline-flex items-center gap-2 rounded-xl px-7 py-3.5 font-display text-sm font-bold uppercase tracking-wider text-white">
              <Rocket className="h-5 w-5" /> Launch a Token
            </Link>
            <Link to="/orbitxlaunch/claim" className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--og-lime))]/40 bg-[hsl(var(--og-lime))]/10 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-[hsl(var(--og-lime))] transition hover:bg-[hsl(var(--og-lime))]/20">
              <HandCoins className="h-4 w-4" /> Claim creator fees
            </Link>
            <Link to="/orbitxlaunch/create/pump" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-foreground transition hover:bg-white/10">
              <Zap className="h-4 w-4 text-[hsl(var(--og-cyan))]" /> Quick pump launch
            </Link>
          </div>
        </div>
      </div>

      {/* ── Statistics bar ── */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile icon={Rocket} label="Total launches" value={all.isLoading ? "…" : String(total)} accent="gold" />
        <StatTile icon={Droplets} label="Graduated · live LP" value={all.isLoading ? "…" : String(graduated)} accent="lime" />
        <StatTile icon={ShieldCheck} label="Vamps blocked" value="DB-enforced" accent="cyan" />
      </div>

      {/* ── Launch board ── */}
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="h-3 w-1 rounded-full bg-[hsl(var(--og-gold))] shadow-[0_0_8px_hsl(var(--og-gold)/0.8)]" />
            <h2 className="font-display text-lg font-bold uppercase tracking-[0.14em] text-foreground">{meta.title}</h2>
            <span className="lp-count font-mono text-[11px] font-bold">{all.isLoading ? "…" : counts[tab]}</span>
          </div>
          <p className="mt-1 pl-3.5 font-mono text-[11px] text-muted-foreground">{meta.sub}</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as FeedKind)}>
        <TabsList className="glass-nav mb-4 gap-1 rounded-lg p-1">
          <TabsTrigger value="new" className="font-mono text-xs uppercase tracking-wider data-[state=active]:bg-[hsl(var(--og-gold))]/15 data-[state=active]:text-[hsl(var(--og-gold))]"><Flame className="mr-1.5 h-4 w-4" /> Fresh Pairs</TabsTrigger>
          <TabsTrigger value="graduated" className="font-mono text-xs uppercase tracking-wider data-[state=active]:bg-[hsl(var(--og-lime))]/15 data-[state=active]:text-[hsl(var(--og-lime))]"><Droplets className="mr-1.5 h-4 w-4" /> Graduated</TabsTrigger>
          <TabsTrigger value="all" className="font-mono text-xs uppercase tracking-wider data-[state=active]:bg-[hsl(var(--og-cyan))]/15 data-[state=active]:text-[hsl(var(--og-cyan))]"><TrendingUp className="mr-1.5 h-4 w-4" /> All</TabsTrigger>
        </TabsList>
        <TabsContent value="new"><Feed kind="new" /></TabsContent>
        <TabsContent value="graduated"><Feed kind="graduated" /></TabsContent>
        <TabsContent value="all"><Feed kind="all" /></TabsContent>
      </Tabs>
    </div>
  );
}
