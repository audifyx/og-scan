import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fmtUsd, compact, fmtPct, short } from "../lib/api";
import { imgProxy } from "../lib/img";
import {
  Activity, Waves, Users, TrendingUp, Gauge, Sparkles, AlertTriangle,
  Rocket, BadgeCheck, RefreshCw, Loader2, Zap, Flame, BarChart3,
} from "lucide-react";
import { CommandHero, StatDeck, LiveRefresh, SegTabs, ViewToggle, DeckLoader } from "../components/DexAdvanced";

interface Signal {
  mint: string; symbol?: string; name?: string; icon?: string | null; chain?: string;
  type: string; label: string; tone: string; strength?: number; metric?: string;
  priceUsd?: number | null; mcap?: number | null; liq?: number | null;
  vol1h?: number | null; ch5m?: number; ch1h?: number; ch24h?: number | null;
  ageH?: number | null; bondingPct?: number; pool?: string;
}

const TYPE_META: Record<string, { label: string; Icon: typeof Zap }> = {
  graduating: { label: "Graduating", Icon: Rocket },
  graduated: { label: "Graduated", Icon: BadgeCheck },
  volume_surge: { label: "Volume Surge", Icon: Waves },
  buyer_surge: { label: "Buyer Surge", Icon: Users },
  momentum: { label: "Momentum", Icon: TrendingUp },
  velocity_spike: { label: "Velocity", Icon: Gauge },
  fresh_runner: { label: "Fresh", Icon: Sparkles },
  selloff: { label: "Sell-Off", Icon: AlertTriangle },
};

const TONE: Record<string, { text: string; bg: string; ring: string; bar: string }> = {
  lime: { text: "text-accent", bg: "bg-accent/12", ring: "border-accent/30", bar: "bg-accent" },
  cyan: { text: "text-cyan-300", bg: "bg-cyan-400/12", ring: "border-cyan-400/30", bar: "bg-cyan-400" },
  violet: { text: "text-accent2", bg: "bg-accent2/12", ring: "border-accent2/30", bar: "bg-accent2" },
  gold: { text: "text-yellow-300", bg: "bg-yellow-400/12", ring: "border-yellow-400/30", bar: "bg-yellow-400" },
  red: { text: "text-down", bg: "bg-down/12", ring: "border-down/30", bar: "bg-down" },
};

function pctColor(v?: number | null) {
  if (v == null) return "text-muted";
  return v >= 0 ? "text-up" : "text-down";
}

function SignalCard({ s, list }: { s: Signal; list?: boolean }) {
  const meta = TYPE_META[s.type] || { label: s.label, Icon: Zap };
  const tone = TONE[s.tone] || TONE.lime;
  const Icon = meta.Icon;
  const logo = imgProxy(s.icon, 80);
  const strength = s.strength ?? 50;
  const inner = (
    <div className={`card relative overflow-hidden transition-all hover:scale-[1.005] ${tone.ring} ${list ? "p-3" : "p-3"}`}>
      <div className="absolute left-0 top-0 bottom-0 w-1 opacity-80" style={{ background: tone.bar, height: `${Math.min(100, strength)}%` }} />
      <div className={`flex items-center gap-3 pl-2 ${list ? "flex-row" : ""}`}>
        {logo
          ? <img src={logo} loading="lazy" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-full border border-line object-cover bg-panel2" />
          : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-panel2 text-xs font-bold text-muted">{(s.symbol || "?").slice(0, 2)}</div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="truncate font-bold text-white">{s.symbol || short(s.mint)}</span>
            <span className={`pill inline-flex shrink-0 items-center gap-1 whitespace-nowrap ${tone.bg} ${tone.text} text-[10px] !px-1.5 !py-0.5`}>
              <Icon className="h-3 w-3" /> {meta.label}
            </span>
            {strength > 0 && <span className="text-[9px] text-faint term">STR {strength}</span>}
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
      {s.type === "graduating" && s.bondingPct != null && (
        <div className="mt-2 ml-2 h-1.5 overflow-hidden rounded-full bg-panel2">
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
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [sort, setSort] = useState<"strength" | "mcap" | "change">("strength");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [updated, setUpdated] = useState<string>("");
  const timer = useRef<number | null>(null);

  const load = async (attempt = 0) => {
    if (attempt === 0) setRefreshing(true);
    try {
      const r = await fetch("/api/ogdex/signals");
      const d = await r.json().catch(() => ({} as any));
      const sig = d.signals || [];
      const errored = !r.ok || d.ok === false;
      if (sig.length || (!errored && attempt >= 2)) {
        setSignals(sig);
        setCounts(d.counts || {});
        setUpdated(new Date().toLocaleTimeString());
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (attempt < 3) { window.setTimeout(() => load(attempt + 1), 900 * (attempt + 1)); return; }
      setLoading(false);
      setRefreshing(false);
    } catch {
      if (attempt < 3) { window.setTimeout(() => load(attempt + 1), 900 * (attempt + 1)); return; }
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    timer.current = window.setInterval(() => load(), 30000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? signals : signals.filter((s) => s.type === filter)),
    [signals, filter],
  );

  const shown = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      if (sort === "strength") return (b.strength ?? 0) - (a.strength ?? 0);
      if (sort === "mcap") return (b.mcap ?? 0) - (a.mcap ?? 0);
      return (b.ch24h ?? -999) - (a.ch24h ?? -999);
    });
    return arr;
  }, [filtered, sort]);

  const mood = useMemo(() => {
    const bull = signals.filter((s) => ["momentum", "volume_surge", "buyer_surge", "fresh_runner", "graduating"].includes(s.type)).length;
    const bear = signals.filter((s) => s.type === "selloff").length;
    const total = bull + bear || 1;
    return { bull, bear, pct: Math.round((bull / total) * 100) };
  }, [signals]);

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
      <CommandHero
        kicker="Live anomaly detection"
        title="Pulse"
        sub="Volume spikes, buyer surges, momentum, fresh runners, graduations, and sell-offs — refreshed every 30s."
        icon={Activity}
        actions={<LiveRefresh onClick={() => load()} loading={refreshing} />}
      />

      <StatDeck items={[
        { label: "SIGNALS", value: signals.length, sub: "active now", tone: "blue" },
        { label: "MOOD", value: `${mood.pct}%`, sub: "bullish bias", tone: mood.pct >= 55 ? "up" : mood.pct <= 45 ? "down" : "plain" },
        { label: "GRADUATING", value: counts.graduating || 0, sub: "near migration", tone: "gold" },
        { label: "SURGES", value: (counts.volume_surge || 0) + (counts.buyer_surge || 0), sub: "vol + buyers", tone: "up" },
        { label: "SELLOFFS", value: counts.selloff || 0, sub: "distribution", tone: "down" },
        { label: "UPDATED", value: updated || "—", sub: "local time", tone: "plain" },
      ]} />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex gap-1 overflow-x-auto pb-1 flex-1 min-w-0" style={{ scrollbarWidth: "none" }}>
          {chips.map((c) => (
            <button key={c.id} onClick={() => setFilter(c.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                filter === c.id ? "border-accent/50 bg-accent/10 text-accent" : "border-white/10 bg-white/[0.03] text-muted hover:text-white"
              }`}>
              {c.label} {c.n > 0 && <span className="ml-1 opacity-60">{c.n}</span>}
            </button>
          ))}
        </div>
        <SegTabs tabs={[
          { id: "strength" as const, label: "Strength" },
          { id: "mcap" as const, label: "MCap" },
          { id: "change" as const, label: "24h %" },
        ]} value={sort} onChange={setSort} />
        <ViewToggle mode={view} onChange={setView} />
        <span className="pill bg-up/10 text-up text-[10px] term inline-flex items-center gap-1 shrink-0">
          <Flame className="w-3 h-3 animate-pulse" /> LIVE
        </span>
      </div>

      {loading && signals.length === 0 ? (
        <DeckLoader label="Scanning on-chain anomalies…" />
      ) : shown.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No active signals — market is quiet. Auto-refreshing.</div>
      ) : (
        <div className={view === "grid" ? "grid gap-2 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-2"}>
          {shown.map((s, i) => <SignalCard key={s.mint + s.type + i} s={s} list={view === "list"} />)}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
        <Link to="/tools?tab=sniper" className="text-accent hover:underline inline-flex items-center gap-1"><BarChart3 className="h-3 w-3" /> Token sniper</Link>
        <Link to="/scanner" className="text-accent hover:underline">OG scanner</Link>
        <Link to="/kol" className="text-accent hover:underline">KOL feed</Link>
      </div>
    </div>
  );
}
