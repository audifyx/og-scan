// Orbitx Launchpad — Home: live feeds of launched tokens (New / Graduated / All).
// Real data from the anti-vamp registry; honest empty states until launches exist.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Rocket, Flame, Droplets, Loader2, ShieldCheck, TrendingUp, Zap, HandCoins, Coins, BadgeDollarSign } from "lucide-react";
import { ORBITX_FEE_USD, fmtUsd } from "@/lib/orbitx/fee";
import { CREATOR_FEE_BPS } from "@/lib/platformFee";
import { listTokens, type FeedKind } from "@/lib/orbitx/registry";
import { TokenCard, StatTile, SectionLabel } from "./_shared";

function Feed({ kind }: { kind: FeedKind }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["orbitx-tokens", kind],
    queryFn: () => listTokens(kind),
    refetchInterval: 30_000,
  });

  if (isLoading)
    return <div className="flex items-center justify-center gap-2 py-20 font-mono text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> loading launches…</div>;
  if (error)
    return <div className="py-20 text-center font-mono text-sm text-[hsl(var(--og-blood))]">// feed unavailable — retry in a moment</div>;
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
        <Link to="/orbitxlaunch/create" className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--og-gold))]/50 bg-[hsl(var(--og-gold))]/15 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-[hsl(var(--og-gold))] hover:bg-[hsl(var(--og-gold))]/25">
          <Rocket className="h-4 w-4" /> Launch the first token
        </Link>
      </div>
    );

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((t) => <TokenCard key={t.id} t={t} />)}
    </div>
  );
}

export default function LaunchpadHome() {
  const [tab, setTab] = useState<FeedKind>("new");
  const all = useQuery({ queryKey: ["orbitx-tokens", "all"], queryFn: () => listTokens("all"), refetchInterval: 30_000 });
  const total = all.data?.length ?? 0;
  const graduated = all.data?.filter((t) => t.lp_pool_address).length ?? 0;

  return (
    <div>
      {/* Hero — v2 */}
      <div className="og-glass-frame relative mb-6 overflow-hidden p-6 sm:p-9">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-30" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[hsl(var(--og-gold))]/12 blur-3xl" />
        <div className="relative max-w-2xl">
          <div className="flex flex-wrap gap-2">
            <div className="glass-pill text-[hsl(var(--og-lime))]">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--og-lime))] opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--og-lime))]" /></span>
              MAINNET LIVE
            </div>
            <div className="glass-pill text-[hsl(var(--og-gold))]">
              <ShieldCheck className="h-3.5 w-3.5" /> ANTI-VAMP
            </div>
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-[2.9rem]">
            Launch it. Trade it.<br /><span className="gradient-text">Get paid every trade.</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Two lanes — <span className="text-[hsl(var(--og-cyan))]">Pump</span> bonding curves or a fully <span className="text-[hsl(var(--og-gold))]">Custom</span> on-chain mint. Same flat fee, same {(CREATOR_FEE_BPS / 100).toFixed(2)}% creator cut of every buy and sell, claimable in-app with the wallet that launched.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link to="/orbitxlaunch/create" className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--og-gold))]/50 bg-[hsl(var(--og-gold))]/15 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-[hsl(var(--og-gold))] transition hover:bg-[hsl(var(--og-gold))]/25">
              <Rocket className="h-4 w-4" /> Launch a token
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

      {/* Fee parity band — pump.fun fee system, both lanes */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="og-glass-card relative overflow-hidden p-4">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--og-gold))]/60 to-transparent" />
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"><BadgeDollarSign className="h-3.5 w-3.5 text-[hsl(var(--og-gold))]" /> Launch fee</div>
          <div className="mt-1.5 font-display text-2xl font-bold text-[hsl(var(--og-gold))]">{fmtUsd(ORBITX_FEE_USD)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">flat, in SOL — identical on both lanes</div>
        </div>
        <div className="og-glass-card relative overflow-hidden p-4">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--og-lime))]/60 to-transparent" />
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"><Coins className="h-3.5 w-3.5 text-[hsl(var(--og-lime))]" /> Creator fee</div>
          <div className="mt-1.5 font-display text-2xl font-bold text-[hsl(var(--og-lime))]">{(CREATOR_FEE_BPS / 100).toFixed(2)}%</div>
          <div className="mt-0.5 text-xs text-muted-foreground">of every buy & sell — pump.fun's creator rate</div>
        </div>
        <div className="og-glass-card relative overflow-hidden p-4">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--og-cyan))]/60 to-transparent" />
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"><HandCoins className="h-3.5 w-3.5 text-[hsl(var(--og-cyan))]" /> Claims</div>
          <div className="mt-1.5 font-display text-2xl font-bold text-[hsl(var(--og-cyan))]">In-app</div>
          <div className="mt-0.5 text-xs text-muted-foreground">connect the launch wallet → claim. Both lanes.</div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Total launches" value={all.isLoading ? "…" : String(total)} accent="cyan" />
        <StatTile label="Graduated · live LP" value={all.isLoading ? "…" : String(graduated)} accent="lime" />
        <StatTile label="Vamps blocked" value="DB-enforced" accent="gold" />
      </div>

      {/* Feeds */}
      <SectionLabel accent="gold">Launch board</SectionLabel>
      <Tabs value={tab} onValueChange={(v) => setTab(v as FeedKind)}>
        <TabsList className="glass-nav mb-4 gap-1 rounded-lg p-1">
          <TabsTrigger value="new" className="font-mono text-xs uppercase tracking-wider data-[state=active]:bg-[hsl(var(--og-gold))]/15 data-[state=active]:text-[hsl(var(--og-gold))]"><Flame className="mr-1.5 h-4 w-4" /> Fresh</TabsTrigger>
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
