// OrbitX Launchpad — MISSION CONTROL home. V3 HUD redesign.
// Every number on this page is real:
//   registry (orbitx_tokens) → launches / lanes / flags / logos
//   DexScreener             → mcap, liquidity, volume, 24h deltas, sparklines
//   Solana mainnet RPC      → slot, TPS, RPC latency
//   CoinGecko (60s cache)   → SOL/USD
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Rocket, ShieldCheck, Zap, HandCoins, Flame, Loader2, Activity, Radar,
  TrendingUp, Droplets, BarChart3, ArrowRight, Wand2, UserCircle2, Satellite,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ORBITX_FEE_USD, fmtUsd } from "@/lib/orbitx/fee";
import { CREATOR_FEE_BPS } from "@/lib/platformFee";
import { listTokens, type FeedKind, type OrbitxToken } from "@/lib/orbitx/registry";
import { TokenCard } from "./_shared";
import {
  Panel, Spark, Delta, KV,
  useAllLaunches, launchStats, useMarketMap, totalLpUsd,
  useChainTelemetry, useSolUsd, fmtCompactUsd, fmtInt,
  type MarketRow,
} from "./lpx";

const shortCa = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

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

/* ═══════════════ MISSION CONTROL (left column) ═══════════════ */

function MissionControl({
  stats, lpUsd, loaded,
}: { stats: ReturnType<typeof launchStats>; lpUsd: number | null; loaded: boolean }) {
  const tiles = [
    { icon: Rocket, label: "Total launches", value: loaded ? String(stats.total) : "—", sub: `+${stats.last24h} last 24h`, tone: "lime" as const },
    { icon: Droplets, label: "Graduated", value: loaded ? String(stats.graduated) : "—", sub: "live LP pools", tone: "cyan" as const },
    { icon: BarChart3, label: "Live LP value", value: fmtCompactUsd(lpUsd), sub: "across all launches", tone: "gold" as const },
    { icon: ShieldCheck, label: "Vamps flagged", value: loaded ? String(stats.flagged) : "—", sub: "clones caught by registry", tone: "blood" as const },
  ];
  const toneCls: Record<string, string> = {
    lime: "text-[hsl(var(--og-lime))]", cyan: "text-[hsl(var(--og-cyan))]",
    gold: "text-[hsl(var(--og-gold))]", blood: "text-[hsl(var(--og-blood))]",
  };
  return (
    <Panel title="Mission control" icon={<Satellite className="h-3.5 w-3.5" />} bodyClassName="space-y-2 p-3">
      {tiles.map((t) => (
        <div key={t.label} className="flex items-center gap-3 rounded-lg border border-white/8 bg-black/35 p-2.5">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/40 ${toneCls[t.tone]}`}>
            <t.icon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{t.label}</div>
            <div className={`font-display text-xl font-black leading-tight ${toneCls[t.tone]}`}>{t.value}</div>
            <div className="font-mono text-[9px] text-muted-foreground">{t.sub}</div>
          </div>
        </div>
      ))}
      <Link to="/orbitxlaunch/claim" className="lpx-btn lpx-btn--gold w-full">
        <HandCoins className="h-3.5 w-3.5" /> Claim creator fees · {(CREATOR_FEE_BPS / 100).toFixed(2)}% of every trade
      </Link>
    </Panel>
  );
}

function NetworkStatus({ registryUp }: { registryUp: boolean }) {
  const tel = useChainTelemetry();
  const sol = useSolUsd();
  const ok = tel.data?.ok ?? false;
  return (
    <Panel title="Network status" icon={<Activity className="h-3.5 w-3.5" />} bodyClassName="p-3">
      <KV k="Solana mainnet" v={ok ? "LIVE" : "DEGRADED"} tone={ok ? "lime" : "dim"} />
      <KV k="Slot height" v={fmtInt(tel.data?.slot)} />
      <KV k="Network TPS" v={fmtInt(tel.data?.tps)} />
      <KV k="RPC latency" v={tel.data?.latencyMs != null ? `${tel.data.latencyMs}ms` : "—"} />
      <KV k="SOL / USD" v={sol.data ? `$${sol.data.price.toFixed(2)}` : "—"} tone="gold" />
      <KV k="Anti-vamp engine" v={registryUp ? "ACTIVE" : "OFFLINE"} tone={registryUp ? "lime" : "dim"} />
    </Panel>
  );
}

/* ═══════════════ HERO + widgets (center column) ═══════════════ */

function Hero() {
  return (
    <div className="lpx-panel lpx-panel--hot relative overflow-hidden">
      <div className="lpx-sweep" />
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
      <div className="lpx-beam pointer-events-none absolute inset-x-8 bottom-0 h-28" />
      <div className="relative px-6 pb-8 pt-7 text-center">
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
          {["100% on-chain", "Anti-vamp protected", "Built for creators"].map((b) => (
            <span key={b} className="rounded-md border border-[hsl(var(--og-lime))]/30 bg-[hsl(var(--og-lime))]/[0.07] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--og-lime))]">
              ◈ {b}
            </span>
          ))}
        </div>
        <h1 className="font-display text-3xl font-black leading-tight tracking-tight sm:text-[2.6rem]">
          LAUNCH A<br />
          <span className="lpx-glow text-[hsl(var(--og-lime))]">SOLANA TOKEN</span><br />
          <span className="text-xl font-bold tracking-[0.08em] sm:text-2xl">THAT CAN'T BE CLONED</span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          Unique name, ticker and CA enforced by the anti-vamp registry. OBX vanity address. {(CREATOR_FEE_BPS / 100).toFixed(2)}% of every trade back to you — claimable in-app.
        </p>
        <div className="relative mx-auto mt-6 w-fit">
          <Link to="/orbitxlaunch/create" className="lp-cta inline-flex flex-col items-center rounded-xl px-10 py-3.5">
            <span className="flex items-center gap-2 font-display text-base font-black uppercase tracking-[0.14em]">
              <Rocket className="h-5 w-5" /> Deploy token
            </span>
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] opacity-80">Launch your legacy</span>
          </Link>
        </div>
        <div className="mt-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {fmtUsd(ORBITX_FEE_USD)} flat fee · pump + custom lanes · Solana mainnet
        </div>
      </div>
    </div>
  );
}

function VanityWidget() {
  const [prefix, setPrefix] = useState("OBX");
  const est = useMemo(() => vanityEstimate(prefix), [prefix]);
  return (
    <Panel title="Vanity CA generator" icon={<Wand2 className="h-3.5 w-3.5" />} bodyClassName="p-3">
      <div className="flex gap-2">
        <input
          value={prefix}
          maxLength={6}
          onChange={(e) => setPrefix(e.target.value.replace(/[^1-9A-HJ-NP-Za-km-z]/g, ""))}
          className="w-full rounded-lg border border-[hsl(var(--og-lime))]/25 bg-black/50 px-3 py-2 font-mono text-sm text-[hsl(var(--og-lime))] outline-none transition focus:border-[hsl(var(--og-lime))]/60"
          placeholder="OBX"
        />
        <Link to="/orbitxlaunch/create/custom" className="lpx-btn shrink-0">Grind it</Link>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-white/8 bg-black/35 p-1.5">
          <div className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">chars</div>
          <div className="font-mono text-sm font-bold text-[hsl(var(--og-cyan))]">{est.n || "—"}</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-black/35 p-1.5">
          <div className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">est. tries</div>
          <div className="font-mono text-sm font-bold text-[hsl(var(--og-gold))]">{est.n ? (est.expected >= 1e6 ? est.expected.toExponential(1) : Math.round(est.expected).toLocaleString()) : "—"}</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-black/35 p-1.5">
          <div className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">est. time</div>
          <div className={`font-mono text-sm font-bold ${est.n > 4 ? "text-[hsl(var(--og-blood))]" : "text-[hsl(var(--og-lime))]"}`}>{est.n ? humanTime(est.seconds) : "—"}</div>
        </div>
      </div>
      <p className="mt-2 font-mono text-[9px] leading-relaxed text-muted-foreground">
        // custom lane grinds a PREFIX in your browser (key never leaves your device) · pump lane auto-grinds an address ending in <span className="text-[hsl(var(--og-gold))]">obx</span> server-side
      </p>
    </Panel>
  );
}

function AntiVampPanel({ stats, loaded }: { stats: ReturnType<typeof launchStats>; loaded: boolean }) {
  return (
    <Panel title="Anti-vamp protection" icon={<ShieldCheck className="h-3.5 w-3.5" />} tone="gold" bodyClassName="p-3">
      <div className="flex items-center gap-3">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--og-gold))]/45 bg-[hsl(var(--og-gold))]/10">
          <ShieldCheck className="h-7 w-7 text-[hsl(var(--og-gold))]" />
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-black bg-[hsl(var(--og-lime))] font-mono text-[8px] font-black text-black">✓</span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Every launch is checked against pump.fun, DexScreener and the OrbitX registry.
          Exact clones are <span className="font-bold text-[hsl(var(--og-blood))]">blocked</span>; look-alikes launch
          flagged with fees routed to OBX buybacks. Originals earn <span className="font-bold text-[hsl(var(--og-gold))]">100%</span> of creator fees.
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg border border-white/8 bg-black/35 p-2">
          <div className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">unique identities protected</div>
          <div className="font-display text-lg font-black text-[hsl(var(--og-lime))]">{loaded ? stats.total - stats.flagged : "—"}</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-black/35 p-2">
          <div className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">clones flagged</div>
          <div className="font-display text-lg font-black text-[hsl(var(--og-blood))]">{loaded ? stats.flagged : "—"}</div>
        </div>
      </div>
    </Panel>
  );
}

function LaunchPreview() {
  const flags = [
    { k: "Mint authority", v: "REVOKED" },
    { k: "Freeze authority", v: "REVOKED" },
    { k: "Metadata", v: "ON-CHAIN" },
    { k: "LP", v: "OPTIONAL" },
    { k: "Anti-vamp", v: "ENFORCED" },
  ];
  return (
    <Panel title="Default deploy config" icon={<Zap className="h-3.5 w-3.5" />} right={
      <Link to="/orbitxlaunch/create/custom" className="font-mono text-[9px] uppercase tracking-widest text-[hsl(var(--og-cyan))] hover:underline">advanced settings →</Link>
    } bodyClassName="p-3">
      <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">
        <KV k="Supply" v="1,000,000,000" />
        <KV k="Decimals" v="9" />
        <KV k="Chain" v="Solana" />
        <KV k="Launch fee" v={fmtUsd(ORBITX_FEE_USD)} tone="gold" />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {flags.map((f) => (
          <span key={f.k} className="rounded border border-[hsl(var(--og-lime))]/25 bg-[hsl(var(--og-lime))]/[0.06] px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-[hsl(var(--og-lime))]">
            {f.k}: {f.v}
          </span>
        ))}
      </div>
    </Panel>
  );
}

/* ═══════════════ LIVE LAUNCH FEED (right column) ═══════════════ */

type FeedSort = "fresh" | "trending" | "volume" | "gainers";

function FeedRow({ t, m, rank }: { t: OrbitxToken; m: MarketRow | undefined; rank: number }) {
  return (
    <Link to={`/orbitxlaunch/token/${t.mint_address}`} className="lpx-row flex items-center gap-2.5 rounded-lg p-2">
      <span className="lpx-rank">{String(rank).padStart(2, "0")}</span>
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40">
        {t.logo_url
          ? <img src={t.logo_url} alt={t.ticker} className="h-full w-full object-cover" loading="lazy" />
          : <div className="flex h-full w-full items-center justify-center font-display text-[10px] font-bold text-muted-foreground">{t.ticker.slice(0, 2)}</div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-display text-xs font-bold">{t.ticker}</span>
          <Delta v={m?.ch24} />
        </div>
        <div className="flex items-center gap-2 font-mono text-[9px] text-muted-foreground">
          <span>MC <span className="text-foreground">{fmtCompactUsd(m?.mcap)}</span></span>
          <span>LIQ <span className="text-foreground">{fmtCompactUsd(m?.liq)}</span></span>
          <span>VOL <span className="text-foreground">{fmtCompactUsd(m?.vol24)}</span></span>
        </div>
      </div>
      <Spark m={m} width={56} height={20} />
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
        return list; // registry already newest-first
    }
  }, [tokens, market, sort]);

  const TABS: { id: FeedSort; label: string }[] = [
    { id: "fresh", label: "Fresh" }, { id: "trending", label: "Trending" },
    { id: "volume", label: "Volume" }, { id: "gainers", label: "Gainers" },
  ];

  return (
    <Panel title="Live launch feed" icon={<Radar className="h-3.5 w-3.5" />} right={<span className="lpx-led" />} bodyClassName="p-2">
      <div className="mb-2 flex gap-0.5 rounded-lg border border-white/8 bg-black/40 p-0.5">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setSort(t.id)}
            className={`flex-1 rounded-md px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest transition ${
              sort === t.id ? "bg-[hsl(var(--og-lime))]/15 text-[hsl(var(--og-lime))]" : "text-muted-foreground hover:text-foreground"
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 font-mono text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> syncing registry…
        </div>
      ) : rows.length === 0 ? (
        <div className="px-3 py-12 text-center">
          <Rocket className="mx-auto mb-2 h-6 w-6 text-[hsl(var(--og-lime))]" />
          <div className="font-mono text-xs text-muted-foreground">// feed is empty — the first launch takes slot 01</div>
          <Link to="/orbitxlaunch/create" className="lpx-btn mt-3">Claim slot 01 <ArrowRight className="h-3 w-3" /></Link>
        </div>
      ) : (
        <div className="space-y-0.5">
          {rows.slice(0, 8).map((t, i) => <FeedRow key={t.id} t={t} m={market?.[t.mint_address]} rank={i + 1} />)}
        </div>
      )}
      <a href="#launches" className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-[hsl(var(--og-lime))]/20 bg-[hsl(var(--og-lime))]/[0.04] py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--og-lime))] transition hover:bg-[hsl(var(--og-lime))]/10">
        View all launches <ArrowRight className="h-3 w-3" />
      </a>
    </Panel>
  );
}

/* ═══════════════ bottom row: terminal / monitor / actions ═══════════════ */

function TerminalOutput({ tokens }: { tokens: OrbitxToken[] }) {
  const tel = useChainTelemetry();
  const lines = useMemo(() => {
    const ts = (iso: string) => new Date(iso).toTimeString().slice(0, 8);
    const out = tokens.slice(0, 6).map((t) =>
      `[${ts(t.created_at)}] [✓] ${t.ticker} deployed — ${t.launch_type} lane — CA ${shortCa(t.mint_address)}${t.is_vamp ? " [FLAGGED]" : ""}`,
    );
    return out.reverse();
  }, [tokens]);
  return (
    <Panel title="Terminal output" icon={<span className="font-mono text-[10px]">{">"}_</span>} bodyClassName="p-3">
      <div className="lpx-term min-h-[120px]">
        <div className="gold">orbitx@launchpad:~$ tail -f /var/log/launches</div>
        {lines.length === 0
          ? <div className="dim">// no launches logged yet — deploy the first token</div>
          : lines.map((l, i) => <div key={i}>{l}</div>)}
        <div className="dim">
          [{new Date().toTimeString().slice(0, 8)}] telemetry: slot {fmtInt(tel.data?.slot)} · {fmtInt(tel.data?.tps)} tps · rpc {tel.data?.latencyMs ?? "—"}ms
        </div>
        <span className="lpx-caret" />
      </div>
    </Panel>
  );
}

function SystemMonitor() {
  const tel = useChainTelemetry();
  const sol = useSolUsd();
  const tpsPct = Math.min(100, ((tel.data?.tps ?? 0) / 5000) * 100);
  const rpcPct = tel.data?.latencyMs != null ? Math.max(6, 100 - Math.min(100, tel.data.latencyMs / 10)) : 0;
  return (
    <Panel title="System monitor" icon={<Activity className="h-3.5 w-3.5" />} bodyClassName="p-3">
      <div className="flex items-center gap-4">
        <div className="lpx-orbit relative h-24 w-24 shrink-0">
          <span className="ring ring--spin"><span className="sat" /></span>
          <span className="ring ring--spin-rev" style={{ inset: "14px" }}><span className="sat" style={{ background: "hsl(44 96% 56%)", boxShadow: "0 0 10px hsl(44 96% 56%)" }} /></span>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="lpx-glow font-display text-[10px] font-black tracking-widest text-[hsl(var(--og-lime))]">ORBITX</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div>
            <div className="mb-1 flex justify-between font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              <span>Network TPS</span><span className="text-[hsl(var(--og-lime))]">{fmtInt(tel.data?.tps)}</span>
            </div>
            <div className="lpx-gauge"><div style={{ width: `${tpsPct}%` }} /></div>
          </div>
          <div>
            <div className="mb-1 flex justify-between font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              <span>RPC health</span><span className="text-[hsl(var(--og-lime))]">{tel.data?.latencyMs != null ? `${tel.data.latencyMs}ms` : "—"}</span>
            </div>
            <div className="lpx-gauge"><div style={{ width: `${rpcPct}%` }} /></div>
          </div>
          <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            <span>Slot <span className="text-foreground">{fmtInt(tel.data?.slot)}</span></span>
            <span>SOL <span className="text-[hsl(var(--og-gold))]">{sol.data ? `$${sol.data.price.toFixed(2)}` : "—"}</span></span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function QuickActions() {
  const items = [
    { to: "/orbitxlaunch/profile", icon: UserCircle2, label: "View my tokens" },
    { to: "/orbitxlaunch/claim", icon: HandCoins, label: "Claim fees" },
    { to: "/orbitxlaunch/rescue", icon: Radar, label: "Claim scanner" },
    { to: "/orbitxlaunch/rescue", icon: Flame, label: "Burn console" },
  ];
  return (
    <Panel title="Quick actions" icon={<Zap className="h-3.5 w-3.5" />} bodyClassName="space-y-1.5 p-3">
      {items.map((a) => (
        <Link key={a.label} to={a.to} className="lpx-row flex items-center gap-2 rounded-lg border !border-white/8 bg-black/35 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-foreground">
          <a.icon className="h-3.5 w-3.5 text-[hsl(var(--og-lime))]" /> {a.label}
          <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground" />
        </Link>
      ))}
    </Panel>
  );
}

/* ═══════════════ ALL LAUNCHES board ═══════════════ */

function Board({ kind, market }: { kind: FeedKind; market: Record<string, MarketRow> | undefined }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["orbitx-tokens", kind],
    queryFn: () => listTokens(kind),
    refetchInterval: 30_000,
  });
  if (isLoading)
    return <div className="flex items-center justify-center gap-2 py-16 font-mono text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> loading launches…</div>;
  if (error)
    return <div className="py-16 text-center font-mono text-sm text-[hsl(var(--og-blood))]">{"// feed unavailable — retry in a moment"}</div>;
  if (!data || data.length === 0)
    return (
      <div className="lpx-panel flex flex-col items-center justify-center gap-3 py-14 text-center">
        <Rocket className="h-8 w-8 text-[hsl(var(--og-lime))]" />
        <div className="font-display text-lg font-bold">No launches yet</div>
        <div className="max-w-sm text-sm text-muted-foreground">Every launch gets an <span className="font-mono text-[hsl(var(--og-gold))]">obx</span> vanity CA and passes the anti-vamp check. Be first.</div>
        <Link to="/orbitxlaunch/create" className="lp-cta inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider">
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
    <div className="space-y-4">
      {/* ── main HUD grid ── */}
      <div className="grid gap-4 lg:grid-cols-[260px_1fr_300px]">
        <div className="space-y-4">
          <MissionControl stats={stats} lpUsd={lpUsd} loaded={allQ.isSuccess} />
          <NetworkStatus registryUp={allQ.isSuccess} />
        </div>
        <div className="space-y-4">
          <Hero />
          <div className="grid gap-4 md:grid-cols-2">
            <VanityWidget />
            <AntiVampPanel stats={stats} loaded={allQ.isSuccess} />
          </div>
          <LaunchPreview />
        </div>
        <div className="space-y-4">
          <LiveFeed tokens={tokens} market={marketQ.data} loading={allQ.isLoading} />
          <QuickActions />
        </div>
      </div>

      {/* ── telemetry row ── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <TerminalOutput tokens={tokens} />
        <SystemMonitor />
      </div>

      {/* ── all launches board ── */}
      <div id="launches" className="scroll-mt-24">
        <Tabs value={tab} onValueChange={(v) => setTab(v as FeedKind)}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-1 rounded-full bg-[hsl(var(--og-lime))] shadow-[0_0_8px_hsl(var(--og-lime)/0.8)]" />
              <span className="font-mono text-[10px] text-[hsl(var(--og-lime))]">{"//"}</span>
              <h2 className="font-display text-sm font-bold uppercase tracking-[0.18em]">Launch archive</h2>
              <span className="lp-count font-mono text-[10px]">{stats.total}</span>
            </div>
            <TabsList className="bg-black/40">
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
    </div>
  );
}
