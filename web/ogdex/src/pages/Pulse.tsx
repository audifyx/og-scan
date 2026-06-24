import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fmtUsd, compact, fmtPct, short } from "../lib/api";
import { imgProxy } from "../lib/img";
import {
  Activity, Waves, Users, TrendingUp, Gauge, Sparkles, AlertTriangle,
  Rocket, BadgeCheck, RefreshCw, Loader2, Zap,
} from "lucide-react";

interface Signal {
  mint: string; symbol?: string; name?: string; icon?: string | null; chain?: string;
  type: string; label: string; tone: string; strength?: number; metric?: string;
  priceUsd?: number | null; mcap?: number | null; liq?: number | null;
  vol1h?: number | null; ch5m?: number; ch1h?: number; ch24h?: number | null;
  ageH?: number | null; bondingPct?: number; pool?: string;
}

const TYPE_META: Record<string, { label: string; Icon: any }> = {
  graduating:     { label: "Graduating", Icon: Rocket },
  graduated:      { label: "Graduated", Icon: BadgeCheck },
  volume_surge:   { label: "Volume Surge", Icon: Waves },
  buyer_surge:    { label: "Buyer Surge", Icon: Users },
  momentum:       { label: "Momentum", Icon: TrendingUp },
  velocity_spike: { label: "Velocity", Icon: Gauge },
  fresh_runner:   { label: "Fresh", Icon: Sparkles },
  selloff:        { label: "Sell-Off", Icon: AlertTriangle },
};

const TONE: Record<string, { text: string; bg: string; ring: string; bar: string }> = {
  lime:   { text: "text-accent",      bg: "bg-accent/12",      ring: "border-accent/30",      bar: "bg-accent" },
  cyan:   { text: "text-cyan-300",    bg: "bg-cyan-400/12",    ring: "border-cyan-400/30",    bar: "bg-cyan-400" },
  violet: { text: "text-accent2",     bg: "bg-accent2/12",     ring: "border-accent2/30",     bar: "bg-accent2" },
  gold:   { text: "text-yellow-300",  bg: "bg-yellow-400/12",  ring: "border-yellow-400/30",  bar: "bg-yellow-400" },
  red:    { text: "text-down",        bg: "bg-down/12",        ring: "border-down/30",        bar: "bg-down" },
};

function pctColor(v?: number | null) {
  if (v == null) return "text-muted";
  return v >= 0 ? "text-up" : "text-down";
}

function SignalCard({ s }: { s: Signal }) {
  const meta = TYPE_META[s.type] || { label: s.label, Icon: Zap };
  const tone = TONE[s.tone] || TONE.lime;
  const Icon = meta.Icon;
  const logo = imgProxy(s.icon, 80);
  const inner = (
    <div className={`card relative overflow-hidden p-3 transition-all hover:scale-[1.01] ${tone.ring}`}>
      {/* strength bar */}
      <div className="absolute left-0 top-0 h-full w-1">
        <div className={`h-full ${tone.bar} opacity-70`} style={{ height: "100%", width: "100%" }} />
      </div>
      <div className="flex items-center gap-3 pl-1.5">
        {logo
          ? <img src={logo} loading="lazy" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-full border border-line object-cover bg-panel2" />
          : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-panel2 text-xs font-bold text-muted">{(s.symbol || "?").slice(0, 2)}</div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate font-bold text-white">{s.symbol || short(s.mint)}</span>
            <span className={`pill inline-flex shrink-0 items-center gap-1 whitespace-nowrap ${tone.bg} ${tone.text} text-[10px] !px-1.5 !py-0.5`}>
              <Icon className="h-3 w-3" /> {meta.label}
            </span>
          </div>
          <div className="truncate text-[11px] text-muted">{s.metric || s.name}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold text-white">{s.mcap ? fmtUsd(s.mcap) : (s.priceUsd ? fmtUsd(s.priceUsd) : "—")}</div>
          <div className="text-[10px] text-muted">
            {s.type === "graduating" && s.bondingPct != null
              ? <span className="text-accent font-semibold">{s.bondingPct}% bonded</span>
              : <>{s.liq ? `$${compact(s.liq)} liq` : ""}{s.ch24h != null ? <span className={`ml-1 ${pctColor(s.ch24h)}`}>{fmtPct(s.ch24h)}</span> : null}</>}
          </div>
        </div>
      </div>
      {/* bonding progress for graduating */}
      {s.type === "graduating" && s.bondingPct != null && (
        <div className="mt-2 ml-1.5 h-1.5 overflow-hidden rounded-full bg-panel2">
          <div className="h-full bg-gradient-to-r from-accent to-accent2" style={{ width: `${s.bondingPct}%` }} />
        </div>
      )}
    </div>
  );
  return (s.chain === "solana" || !s.chain)
    ? <Link to={`/token/${s.mint}`}>{inner}</Link>
    : <a href={`https://dexscreener.com/search?q=${s.mint}`} target="_blank" rel="noreferrer">{inner}</a>;
}

export default function Pulse() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [updated, setUpdated] = useState<string>("");
  const timer = useRef<number | null>(null);

  const load = async () => {
    try {
      const r = await fetch("/api/ogdex/signals");
      const d = await r.json();
      setSignals(d.signals || []);
      setCounts(d.counts || {});
      setUpdated(new Date().toLocaleTimeString());
    } catch { /* keep prior */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    timer.current = window.setInterval(load, 30000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  const shown = useMemo(
    () => (filter === "all" ? signals : signals.filter((s) => s.type === filter)),
    [signals, filter],
  );

  const chips = [
    { id: "all", label: "All", n: signals.length },
    { id: "graduating", label: "Graduating", n: counts.graduating || 0 },
    { id: "graduated", label: "Graduated", n: counts.graduated || 0 },
    { id: "volume_surge", label: "Volume", n: counts.volume_surge || 0 },
    { id: "buyer_surge", label: "Buyers", n: counts.buyer_surge || 0 },
    { id: "momentum", label: "Momentum", n: counts.momentum || 0 },
    { id: "velocity_spike", label: "Velocity", n: counts.velocity_spike || 0 },
    { id: "fresh_runner", label: "Fresh", n: counts.fresh_runner || 0 },
    { id: "selloff", label: "Sell-Off", n: counts.selloff || 0 },
  ].filter((c) => c.id === "all" || c.n > 0);

  return (
    <div>
      {/* Hero */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-white/10 ring-brand">
        <div className="relative flex items-center gap-3 bg-gradient-to-r from-accent2/15 via-panel to-accent/10 px-4 py-4 sm:px-6">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-accent">
            <Activity className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold tracking-tight sm:text-2xl">
              <span className="text-brand-gradient">Pulse</span> — live on-chain signals
            </h1>
            <p className="text-[11px] text-muted sm:text-sm">
              Real-time anomaly detection: volume &amp; trade-velocity spikes, buyer surges, momentum, fresh runners and pump.fun graduations. The signals a plain screener can't show you.
            </p>
          </div>
          <button onClick={load} className="btn hidden shrink-0 items-center gap-1.5 bg-white/5 border border-white/10 text-muted hover:text-white sm:inline-flex">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {chips.map((c) => (
          <button key={c.id} onClick={() => setFilter(c.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              filter === c.id ? "border-accent/50 bg-accent/10 text-accent" : "border-white/10 bg-white/[0.03] text-muted hover:text-white"
            }`}>
            {c.label} {c.n > 0 && <span className="ml-1 opacity-60">{c.n}</span>}
          </button>
        ))}
        <span className="ml-auto hidden shrink-0 items-center gap-1.5 text-[10px] text-muted sm:inline-flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> live · {updated || "…"}
        </span>
      </div>

      {/* Feed */}
      {loading && signals.length === 0 ? (
        <div className="grid place-items-center py-24 text-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : shown.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No active signals right now. The market's quiet — check back in a moment.</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((s, i) => <SignalCard key={s.mint + s.type + i} s={s} />)}
        </div>
      )}
    </div>
  );
}
