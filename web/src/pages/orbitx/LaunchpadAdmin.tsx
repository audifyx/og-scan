// OrbitX Launchpad — owner admin dashboard (/orbitxlaunch/admin).
// Token management (list / feature / hide) + live analytics: launches over
// time, pump vs custom, creators, graduation, and real on-chain fee revenue.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  LayoutDashboard, Coins, Rocket, Users, TrendingUp, Wallet, Star, EyeOff, Eye, Search,
  Loader2, ExternalLink, ShieldCheck, RefreshCw, Award, Flame,
} from "lucide-react";
import { adminListTokens, adminSetFeatured, adminSetHidden } from "@/lib/orbitx/admin";
import { computeLaunchStats, fetchFeeWallets } from "@/lib/orbitx/adminAnalytics";
import type { OrbitxToken } from "@/lib/orbitx/registry";
import { useSolUsd } from "./lpx";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const fmtInt = (n: number) => n.toLocaleString();
const fmtSol = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3 });
const fmtUsd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

type Tab = "overview" | "tokens";
type Filter = "all" | "pump" | "custom" | "graduated" | "featured" | "hidden";

function StatCard({ label, value, sub, icon: Icon, tone = "gold" }: {
  label: string; value: React.ReactNode; sub?: string; icon: React.ElementType; tone?: string;
}) {
  return (
    <div className="glass-card rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 text-[hsl(var(--og-${tone}))]`} />
      </div>
      <div className="font-mono text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

const chartAxis = { stroke: "rgba(255,255,255,0.4)", fontSize: 10 };
const tooltipStyle = { background: "#0a0f1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 };

export default function LaunchpadAdmin() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [busyMint, setBusyMint] = useState<string>("");

  const solUsd = useSolUsd().data ?? 0;

  const tokensQ = useQuery({ queryKey: ["admin-tokens"], queryFn: adminListTokens, refetchInterval: 60_000 });
  const feesQ = useQuery({ queryKey: ["admin-fee-wallets"], queryFn: fetchFeeWallets, refetchInterval: 60_000 });

  const tokens = tokensQ.data ?? [];
  const stats = useMemo(() => computeLaunchStats(tokens), [tokens]);

  const filtered = useMemo(() => {
    let list = tokens;
    if (filter === "pump") list = list.filter((t) => t.launch_type === "pump");
    else if (filter === "custom") list = list.filter((t) => t.launch_type === "custom");
    else if (filter === "graduated") list = list.filter((t) => t.lp_pool_address || t.graduated_at);
    else if (filter === "featured") list = list.filter((t) => t.is_featured);
    else if (filter === "hidden") list = list.filter((t) => t.is_hidden);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((t) =>
      t.name.toLowerCase().includes(q) || t.ticker.toLowerCase().includes(q) ||
      t.mint_address.toLowerCase().includes(q) || t.creator_wallet.toLowerCase().includes(q));
    return list;
  }, [tokens, filter, search]);

  const toggle = async (t: OrbitxToken, kind: "feature" | "hide") => {
    setBusyMint(t.mint_address + kind);
    try {
      if (kind === "feature") await adminSetFeatured(t.mint_address, !t.is_featured);
      else await adminSetHidden(t.mint_address, !t.is_hidden);
      toast.success(`${t.ticker} ${kind === "feature" ? (t.is_featured ? "unfeatured" : "featured") : (t.is_hidden ? "shown" : "hidden")}`);
      await qc.invalidateQueries({ queryKey: ["admin-tokens"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyMint("");
    }
  };

  const totalRoutedSol = feesQ.data?.[0]?.balanceSol ?? 0;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="glass-card relative overflow-hidden rounded-2xl border border-white/10 p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[hsl(var(--og-cyan))]/10 blur-3xl" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--og-cyan))]/40 bg-[hsl(var(--og-cyan))]/10 px-3 py-1 text-xs font-bold text-[hsl(var(--og-cyan))]">
                <ShieldCheck className="h-3.5 w-3.5" /> Owner
              </span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Launchpad Admin</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage tokens and track platform performance in real time.</p>
          </div>
          <button onClick={() => { qc.invalidateQueries({ queryKey: ["admin-tokens"] }); qc.invalidateQueries({ queryKey: ["admin-fee-wallets"] }); }}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-white/15 px-3 py-2 text-sm text-foreground hover:bg-white/5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["overview", "tokens"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold capitalize transition ${
              tab === t ? "border-[hsl(var(--og-gold))]/50 bg-[hsl(var(--og-gold))]/10 text-[hsl(var(--og-gold))]" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>
            {t === "overview" ? <LayoutDashboard className="h-4 w-4" /> : <Coins className="h-4 w-4" />} {t}
          </button>
        ))}
      </div>

      {tokensQ.isError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {(tokensQ.error as Error)?.message || "Failed to load admin data"} — sign in with your owner email.
        </div>
      )}

      {tab === "overview" && (
        <div className="space-y-6">
          {/* Fee revenue */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(feesQ.data ?? []).map((w) => (
              <div key={w.wallet} className="glass-card rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">{w.label}</span>
                  <a href={`https://solscan.io/account/${w.wallet}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground">
                    {short(w.wallet)} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Balance</div>
                    <div className="font-mono text-2xl font-bold text-[hsl(var(--og-gold))]">{fmtSol(w.balanceSol)} SOL</div>
                    <div className="text-[11px] text-muted-foreground">{fmtUsd(w.balanceSol * solUsd)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Inflow 30d</div>
                    <div className="font-mono text-lg font-bold text-[hsl(var(--og-lime))]">{fmtSol(w.inflow30Sol)} SOL</div>
                    <div className="text-[11px] text-muted-foreground">{fmtUsd(w.inflow30Sol * solUsd)}</div>
                  </div>
                </div>
              </div>
            ))}
            {feesQ.isLoading && <div className="col-span-full py-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total launches" value={fmtInt(stats.total)} sub={`${stats.today} today · ${stats.last7} this week`} icon={Rocket} tone="cyan" />
            <StatCard label="Last 30 days" value={fmtInt(stats.last30)} sub={`${stats.pump} pump · ${stats.custom} custom`} icon={TrendingUp} tone="lime" />
            <StatCard label="Graduated" value={fmtInt(stats.graduated)} sub={`${(stats.graduationRate * 100).toFixed(1)}% graduation rate`} icon={Award} tone="gold" />
            <StatCard label="Unique creators" value={fmtInt(stats.uniqueCreators)} sub={`${stats.newCreators7} new this week`} icon={Users} tone="cyan" />
          </div>

          {/* Launches per day */}
          <div className="glass-card rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Flame className="h-4 w-4 text-[hsl(var(--og-gold))]" /> Launches per day (30d)</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats.perDay} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" {...chartAxis} interval={4} />
                <YAxis {...chartAxis} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="pump" stackId="a" name="Pump" fill="hsl(180 70% 45%)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="custom" stackId="a" name="Custom" fill="hsl(45 90% 55%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Active creators per day */}
          <div className="glass-card rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-[hsl(var(--og-cyan))]" /> Active creators per day (30d)</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={stats.activeCreatorsPerDay} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" {...chartAxis} interval={4} />
                <YAxis {...chartAxis} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="creators" name="Creators" stroke="hsl(180 70% 55%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Top creators */}
          <div className="glass-card rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Award className="h-4 w-4 text-[hsl(var(--og-gold))]" /> Top creators</div>
            <div className="space-y-1">
              {stats.topCreators.map((c, i) => (
                <div key={c.wallet} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-white/5">
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
                    <a href={`https://solscan.io/account/${c.wallet}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-foreground hover:text-[hsl(var(--og-cyan))]">{short(c.wallet)}</a>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground">{c.graduated} grad</span>
                    <span className="font-mono font-bold text-[hsl(var(--og-gold))]">{c.count} launches</span>
                  </div>
                </div>
              ))}
              {stats.topCreators.length === 0 && <div className="py-4 text-center text-sm text-muted-foreground">No launches yet</div>}
            </div>
          </div>
        </div>
      )}

      {tab === "tokens" && (
        <div className="glass-card rounded-xl border border-white/10 bg-black/30 p-4">
          {/* controls */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ticker, mint, creator…"
                className="w-full rounded-lg border border-white/10 bg-black/50 py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-[hsl(var(--og-gold))]" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["all", "pump", "custom", "graduated", "featured", "hidden"] as Filter[]).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-semibold capitalize ${filter === f ? "border-[hsl(var(--og-gold))]/50 bg-[hsl(var(--og-gold))]/10 text-[hsl(var(--og-gold))]" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {tokensQ.isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading tokens…</div>
          ) : (
            <div className="overflow-x-auto">
              <div className="mb-2 text-xs text-muted-foreground">{filtered.length} of {tokens.length} tokens</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                    <th className="py-2 pr-3">Token</th>
                    <th className="px-3">Type</th>
                    <th className="px-3">Status</th>
                    <th className="px-3">Creator</th>
                    <th className="px-3">Created</th>
                    <th className="px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const grad = !!t.lp_pool_address || !!t.graduated_at;
                    return (
                      <tr key={t.mint_address} className={`border-b border-white/5 ${t.is_hidden ? "opacity-50" : ""}`}>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2.5">
                            {t.logo_url ? <img src={t.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" /> : <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5"><Coins className="h-4 w-4 text-muted-foreground" /></div>}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                <span className="truncate max-w-[160px]">{t.name}</span>
                                <span className="text-muted-foreground">${t.ticker}</span>
                                {t.is_featured && <Star className="h-3.5 w-3.5 fill-[hsl(var(--og-gold))] text-[hsl(var(--og-gold))]" />}
                              </div>
                              <a href={`https://solscan.io/token/${t.mint_address}`} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-muted-foreground hover:text-foreground">{short(t.mint_address)}</a>
                            </div>
                          </div>
                        </td>
                        <td className="px-3">
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${t.launch_type === "pump" ? "border-[hsl(var(--og-cyan))]/40 text-[hsl(var(--og-cyan))]" : "border-[hsl(var(--og-gold))]/40 text-[hsl(var(--og-gold))]"}`}>{t.launch_type}</span>
                        </td>
                        <td className="px-3 text-xs">{grad ? <span className="text-[hsl(var(--og-lime))]">Graduated</span> : <span className="text-muted-foreground">Bonding</span>}</td>
                        <td className="px-3"><a href={`https://solscan.io/account/${t.creator_wallet}`} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-muted-foreground hover:text-foreground">{short(t.creator_wallet)}</a></td>
                        <td className="px-3 text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                        <td className="px-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => toggle(t, "feature")} disabled={busyMint === t.mint_address + "feature"}
                              title={t.is_featured ? "Unfeature" : "Feature"}
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold ${t.is_featured ? "border-[hsl(var(--og-gold))]/50 bg-[hsl(var(--og-gold))]/10 text-[hsl(var(--og-gold))]" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>
                              {busyMint === t.mint_address + "feature" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3" />} {t.is_featured ? "Featured" : "Feature"}
                            </button>
                            <button onClick={() => toggle(t, "hide")} disabled={busyMint === t.mint_address + "hide"}
                              title={t.is_hidden ? "Unhide" : "Hide"}
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold ${t.is_hidden ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>
                              {busyMint === t.mint_address + "hide" ? <Loader2 className="h-3 w-3 animate-spin" /> : t.is_hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />} {t.is_hidden ? "Hidden" : "Hide"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">No tokens match.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
