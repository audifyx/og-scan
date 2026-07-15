// Orbitx Launchpad — Home: live feeds of launched tokens (New / Graduated / All).
// Real data from the anti-vamp registry; honest empty states until launches exist.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Rocket, Flame, Droplets, Layers, Loader2, ShieldCheck, TrendingUp, Zap } from "lucide-react";
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
      {/* Hero */}
      <div className="og-glass-frame relative mb-6 overflow-hidden p-6 sm:p-9">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-30" />
        <div className="relative max-w-2xl">
          <div className="glass-pill text-[hsl(var(--og-lime))]">
            <ShieldCheck className="h-3.5 w-3.5" /> ANTI-VAMP · UNIQUE CA / NAME / TICKER
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-[2.7rem]">
            Launch a Solana token<br />that <span className="gradient-text">can't be cloned</span>.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Two lanes, one platform: <span className="text-[hsl(var(--og-cyan))]">Pump-style</span> bonding-curve launches, or a fully <span className="text-[hsl(var(--og-gold))]">Custom</span> SPL mint. Both get an <span className="font-mono text-[hsl(var(--og-gold))]">obx</span> vanity address and anti-vamp protection.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link to="/orbitxlaunch/create" className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--og-gold))]/50 bg-[hsl(var(--og-gold))]/15 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-[hsl(var(--og-gold))] transition hover:bg-[hsl(var(--og-gold))]/25">
              <Rocket className="h-4 w-4" /> Choose a launch
            </Link>
            <Link to="/orbitxlaunch/create/pump" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-foreground transition hover:bg-white/10">
              <Zap className="h-4 w-4 text-[hsl(var(--og-cyan))]" /> Quick pump launch
            </Link>
          </div>
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
