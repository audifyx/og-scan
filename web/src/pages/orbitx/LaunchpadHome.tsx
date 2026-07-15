// Orbitx Launchpad — Home: live feeds of launched tokens (New / Graduated / All).
// Real data from the anti-vamp registry; honest empty states until launches exist.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Rocket, Flame, Droplets, Layers, Loader2, ShieldCheck, TrendingUp } from "lucide-react";
import { listTokens, type FeedKind } from "@/lib/orbitx/registry";
import { TokenCard } from "./_shared";

function Stat({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 ${tone}`}><Icon className="h-4 w-4" /></div>
      <div>
        <div className="text-lg font-black leading-none text-foreground">{value}</div>
        <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function Feed({ kind }: { kind: FeedKind }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["orbitx-tokens", kind],
    queryFn: () => listTokens(kind),
    refetchInterval: 30_000,
  });

  if (isLoading)
    return <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading launches…</div>;
  if (error)
    return <div className="py-20 text-center text-sm text-[hsl(var(--og-blood))]">Couldn't load the feed. Try again in a moment.</div>;
  if (!data || data.length === 0)
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--og-gold))]/10"><Rocket className="h-7 w-7 text-[hsl(var(--og-gold))]" /></div>
        <div>
          <div className="text-lg font-bold text-foreground">No launches yet</div>
          <div className="mt-1 max-w-sm text-sm text-muted-foreground">
            The board fills as tokens launch through Orbitx. Every launch gets a unique CA under <span className="font-mono text-[hsl(var(--og-gold))]">obx</span> and passes the anti-vamp check. Be the first.
          </div>
        </div>
        <Link to="/orbitxlaunch/create" className="inline-flex items-center gap-1.5 rounded-xl bg-[hsl(var(--og-gold))] px-5 py-2.5 text-sm font-bold text-black hover:bg-[hsl(var(--og-gold))]/90">
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
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[hsl(var(--og-gold))]/10 via-black/20 to-transparent p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[hsl(var(--og-gold))]/10 blur-3xl" />
        <div className="relative max-w-xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--og-lime))]/30 bg-[hsl(var(--og-lime))]/10 px-3 py-1 text-[11px] font-bold text-[hsl(var(--og-lime))]">
            <ShieldCheck className="h-3.5 w-3.5" /> Anti-vamp · unique CA / name / ticker
          </div>
          <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
            Launch a Solana token that <span className="text-[hsl(var(--og-gold))]">can't be cloned</span>.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Custom SPL mint, own liquidity pool, vanity <span className="font-mono text-[hsl(var(--og-gold))]">obx</span> contract address, and a flat $2 launch fee. Copycats get blocked — or their fees get routed to buybacks.
          </p>
          <Link to="/orbitxlaunch/create" className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[hsl(var(--og-gold))] px-5 py-2.5 text-sm font-bold text-black hover:bg-[hsl(var(--og-gold))]/90">
            <Rocket className="h-4 w-4" /> Launch a token
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat icon={Layers} label="Total launches" value={all.isLoading ? "…" : String(total)} tone="text-[hsl(var(--og-cyan))]" />
        <Stat icon={Droplets} label="Graduated (live LP)" value={all.isLoading ? "…" : String(graduated)} tone="text-[hsl(var(--og-lime))]" />
        <Stat icon={ShieldCheck} label="Vamps blocked" value="DB-enforced" tone="text-[hsl(var(--og-gold))]" />
      </div>

      {/* Feeds */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as FeedKind)}>
        <TabsList className="mb-4 bg-black/30">
          <TabsTrigger value="new"><Flame className="mr-1.5 h-4 w-4" /> Fresh pairs</TabsTrigger>
          <TabsTrigger value="graduated"><Droplets className="mr-1.5 h-4 w-4" /> Graduated</TabsTrigger>
          <TabsTrigger value="all"><TrendingUp className="mr-1.5 h-4 w-4" /> All</TabsTrigger>
        </TabsList>
        <TabsContent value="new"><Feed kind="new" /></TabsContent>
        <TabsContent value="graduated"><Feed kind="graduated" /></TabsContent>
        <TabsContent value="all"><Feed kind="all" /></TabsContent>
      </Tabs>
    </div>
  );
}
