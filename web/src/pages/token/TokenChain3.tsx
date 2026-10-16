// TokenChain3.tsx — C51–C75: on-chain timing & pattern widgets.
// Self-contained: no sibling imports. Timestamps are unix seconds (UTC).
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Clock, Globe2, Grid3X3, Zap, MoonStar, Gauge, Scale, Flame, Repeat,
  TrendingUp, RefreshCw, Timer, Activity, BarChart3, Droplets, Layers,
  Weight, GitCompareArrows, Rocket, Leaf, ArrowUpDown, Sparkles, CalendarDays,
  Sun, Database,
} from "lucide-react";

/* ---------- shared types ---------- */
interface RpcTrade {
  signature: string;
  timestamp: number; // unix seconds
  side: "BUY" | "SELL" | "BURN" | "TRANSFER";
  tokenAmount: number;
  solAmount: number;
  wallet: string;
}

export interface Chain3Props {
  trades: RpcTrade[];
  solPrice?: number | null;
  liquidity?: number | null;
  change24h?: number | null;
  loading?: boolean;
}

/* ---------- shared helpers ---------- */
function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}
function Shell({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold text-white/70">
        <span className="text-white/50">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}
function Waiting({ text = "waiting for trades" }: { text?: string }) {
  return <div className="text-[11px] text-white/30">{text}</div>;
}
function Bar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div className={cn("h-full rounded-full", className ?? "bg-sky-400")} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}
function utcHour(ts: number): number {
  return new Date(ts * 1000).getUTCHours();
}
function sessionOf(h: number): "Asia" | "EU" | "US" {
  if (h < 8) return "Asia";
  if (h < 16) return "EU";
  return "US";
}

/* C51 */ export function BestBuyTime({ trades, solPrice, loading }: Chain3Props) {
  const data = useMemo(() => {
    const vol = new Array(24).fill(0);
    for (const t of trades) if (t.side === "BUY") vol[utcHour(t.timestamp)] += t.solAmount * (solPrice ?? 0);
    const ranked = vol.map((v, h) => ({ h, v })).sort((a, b) => b.v - a.v);
    return { ranked, top: ranked[0] };
  }, [trades, solPrice]);
  if (loading) return <Shell icon={<Clock size={13} />} title="Best Buy Time"><Waiting /></Shell>;
  if (!data.top || data.top.v <= 0) return <Shell icon={<Clock size={13} />} title="Best Buy Time"><Waiting /></Shell>;
  return (
    <Shell icon={<Clock size={13} />} title="Best Buy Time">
      <div className="text-lg font-bold text-white">{String(data.top.h).padStart(2, "0")}:00 <span className="text-xs font-medium text-white/50">UTC</span></div>
      <div className="mt-1 space-y-0.5">
        {data.ranked.slice(0, 3).map((r, i) => (
          <div key={r.h} className="flex justify-between text-[11px] text-white/60">
            <span>#{i + 1} {String(r.h).padStart(2, "0")}:00 UTC</span>
            <span className="text-white/80">{fmtUsd(r.v)}</span>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* C52 */ export function SessionMap({ trades, solPrice, loading }: Chain3Props) {
  const rows = useMemo(() => {
    const v: Record<"Asia" | "EU" | "US", number> = { Asia: 0, EU: 0, US: 0 };
    for (const t of trades) v[sessionOf(utcHour(t.timestamp))] += t.solAmount * (solPrice ?? 0);
    const tot = v.Asia + v.EU + v.US;
    return (["Asia", "EU", "US"] as const).map((s) => ({ s, v: v[s], pct: tot > 0 ? (v[s] / tot) * 100 : 0 }));
  }, [trades, solPrice]);
  return (
    <Shell icon={<Globe2 size={13} />} title="Session Map">
      {loading || trades.length === 0 ? <Waiting /> : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.s}>
              <div className="flex justify-between text-[11px] text-white/60 mb-0.5">
                <span>{r.s} {r.s === "Asia" ? "(0–8)" : r.s === "EU" ? "(8–16)" : "(16–24)"}</span>
                <span className="text-white/80">{r.pct.toFixed(0)}%</span>
              </div>
              <Bar pct={r.pct} className={r.s === "Asia" ? "bg-amber-400" : r.s === "EU" ? "bg-sky-400" : "bg-violet-400"} />
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

/* C53 */ export function TradeHeatmap({ trades, loading }: Chain3Props) {
  const cells = useMemo(() => {
    const c = new Array(24).fill(0);
    for (const t of trades) c[utcHour(t.timestamp)] += 1;
    const max = Math.max(1, ...c);
    return { c, max };
  }, [trades]);
  return (
    <Shell icon={<Grid3X3 size={13} />} title="Trade Heatmap">
      {loading || trades.length === 0 ? <Waiting /> : (
        <div className="grid grid-cols-12 gap-1">
          {cells.c.map((n, h) => (
            <div key={h} title={`${String(h).padStart(2, "0")}:00 — ${n} trades`}
              className={cn("aspect-square rounded-sm", n === 0 ? "bg-white/5" : "bg-emerald-500")}
              style={{ opacity: n === 0 ? 1 : 0.25 + 0.75 * (n / cells.max) }} />
          ))}
        </div>
      )}
    </Shell>
  );
}

/* C54 */ export function RushHours({ trades, loading }: Chain3Props) {
  const top = useMemo(() => {
    const c = new Array(24).fill(0);
    for (const t of trades) c[utcHour(t.timestamp)] += 1;
    return c.map((n, h) => ({ h, n })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 3);
  }, [trades]);
  return (
    <Shell icon={<Zap size={13} />} title="Rush Hours">
      {loading ? <Waiting /> : top.length === 0 ? <Waiting /> : (
        <div className="space-y-0.5">
          {top.map((r, i) => (
            <div key={r.h} className="flex justify-between text-[11px] text-white/60">
              <span className="text-white/85 font-medium">#{i + 1} {String(r.h).padStart(2, "0")}:00 UTC</span>
              <span>{r.n} trades</span>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

/* C55 */ export function QuietHours({ trades, loading }: Chain3Props) {
  const quiet = useMemo(() => {
    const c = new Array(24).fill(0);
    for (const t of trades) c[utcHour(t.timestamp)] += 1;
    const withTrades = c.map((n, h) => ({ h, n })).filter((x) => x.n > 0);
    return withTrades.sort((a, b) => a.n - b.n).slice(0, 3);
  }, [trades]);
  return (
    <Shell icon={<MoonStar size={13} />} title="Quiet Hours">
      {loading ? <Waiting /> : quiet.length === 0 ? <Waiting /> : (
        <div className="space-y-0.5">
          {quiet.map((r) => (
            <div key={r.h} className="flex justify-between text-[11px] text-white/60">
              <span>{String(r.h).padStart(2, "0")}:00 UTC</span>
              <span>{r.n} trade{r.n > 1 ? "s" : ""}</span>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

/* C56 */ export function VolatilityMeter({ trades, loading }: Chain3Props) {
  const vol = useMemo(() => {
    if (trades.length < 2) return null;
    const xs = trades.map((t) => t.solAmount);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    if (mean <= 0) return null;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    return Math.min(100, (sd / mean) * 100);
  }, [trades]);
  return (
    <Shell icon={<Gauge size={13} />} title="Volatility Meter">
      {loading || vol === null ? <Waiting /> : (
        <div>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-white/60">Trade-size volatility</span>
            <span className="text-white font-semibold">{vol.toFixed(0)}/100</span>
          </div>
          <Bar pct={vol} className={vol > 66 ? "bg-red-400" : vol > 33 ? "bg-amber-400" : "bg-emerald-400"} />
        </div>
      )}
    </Shell>
  );
}

/* C57 */ export function MomentumOsc({ trades, solPrice, loading }: Chain3Props) {
  const m = useMemo(() => {
    let buy = 0, sell = 0;
    for (const t of trades) {
      if (t.side === "BUY") buy += t.solAmount;
      else if (t.side === "SELL") sell += t.solAmount;
    }
    const tot = buy + sell;
    return tot > 0 ? ((buy - sell) / tot) * 100 : null;
  }, [trades, solPrice]);
  return (
    <Shell icon={<Scale size={13} />} title="Momentum Osc">
      {loading || m === null ? <Waiting /> : (
        <div>
          <div className="text-sm font-bold text-white mb-1.5">{m >= 0 ? "+" : ""}{m.toFixed(0)}</div>
          <div className="relative h-1.5 rounded-full bg-white/10">
            <div className="absolute inset-y-0 left-1/2 w-px bg-white/30" />
            <div className={cn("absolute inset-y-0 rounded-full", m >= 0 ? "bg-emerald-400" : "bg-red-400")}
              style={m >= 0 ? { left: "50%", width: `${m / 2}%` } : { right: "50%", width: `${-m / 2}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-white/40 mt-1"><span>-100 sell</span><span>+100 buy</span></div>
        </div>
      )}
    </Shell>
  );
}

/* C58 */ export function FearGreed({ trades, solPrice, loading }: Chain3Props) {
  const score = useMemo(() => {
    if (trades.length < 2) return null;
    let buy = 0, sell = 0;
    for (const t of trades) {
      if (t.side === "BUY") buy += t.solAmount;
      else if (t.side === "SELL") sell += t.solAmount;
    }
    const tot = buy + sell;
    const mom = tot > 0 ? ((buy - sell) / tot) * 100 : 0;
    const xs = trades.map((t) => t.solAmount);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = mean > 0 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length) : 0;
    const vola = mean > 0 ? Math.min(100, (sd / mean) * 100) : 0;
    return Math.round(Math.max(0, Math.min(100, 50 + mom * 0.35 - vola * 0.15)));
  }, [trades, solPrice]);
  const label = score === null ? "" : score < 30 ? "Fear" : score > 70 ? "Greed" : "Neutral";
  return (
    <Shell icon={<Flame size={13} />} title="Fear & Greed">
      {loading || score === null ? <Waiting /> : (
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-white">{score}</span>
            <span className={cn("text-[11px] font-semibold", label === "Greed" ? "text-emerald-400" : label === "Fear" ? "text-red-400" : "text-amber-300")}>{label}</span>
          </div>
          <div className="mt-1.5"><Bar pct={score} className="bg-gradient-to-r from-red-400 via-amber-300 to-emerald-400" /></div>
        </div>
      )}
    </Shell>
  );
}

/* C59 */ export function ChopIndex({ trades, loading }: Chain3Props) {
  const chop = useMemo(() => {
    if (trades.length < 2) return null;
    const s = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    let alt = 0;
    for (let i = 1; i < s.length; i++) if (s[i].side !== s[i - 1].side) alt++;
    return (alt / (s.length - 1)) * 100;
  }, [trades]);
  return (
    <Shell icon={<Repeat size={13} />} title="Chop Index">
      {loading || chop === null ? <Waiting /> : (
        <div>
          <div className="text-lg font-bold text-white">{chop.toFixed(0)}%</div>
          <div className="text-[11px] text-white/50">of trade pairs alternate sides</div>
          <div className="mt-1"><Bar pct={chop} className={chop > 60 ? "bg-amber-400" : "bg-sky-400"} /></div>
        </div>
      )}
    </Shell>
  );
}

/* C60 */ export function TrendStrength({ trades, loading }: Chain3Props) {
  const pct = useMemo(() => {
    if (trades.length === 0) return null;
    const s = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    let best = 1, cur = 1;
    for (let i = 1; i < s.length; i++) {
      cur = s[i].side === s[i - 1].side ? cur + 1 : 1;
      best = Math.max(best, cur);
    }
    return (best / s.length) * 100;
  }, [trades]);
  return (
    <Shell icon={<TrendingUp size={13} />} title="Trend Strength">
      {loading || pct === null ? <Waiting /> : (
        <div>
          <div className="text-lg font-bold text-white">{pct.toFixed(0)}%</div>
          <div className="text-[11px] text-white/50">longest same-side streak vs total</div>
          <div className="mt-1"><Bar pct={pct} className="bg-emerald-400" /></div>
        </div>
      )}
    </Shell>
  );
}

/* C61 */ export function ReversalWatch({ trades, loading }: Chain3Props) {
  const note = useMemo(() => {
    if (trades.length < 4) return null;
    const s = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    const last = s[s.length - 1];
    let streak = 1;
    for (let i = s.length - 2; i >= 0 && s[i].side === s[s.length - 2].side; i--) streak++;
    // streak is length of the same-side run immediately before the last trade
    const prevSide = s[s.length - 2].side;
    if (streak >= 3 && last.side !== prevSide) {
      return `🔄 Reversal: ${streak}-${prevSide.toLowerCase()} streak broken by ${last.side}`;
    }
    return "No reversal";
  }, [trades]);
  return (
    <Shell icon={<RefreshCw size={13} />} title="Reversal Watch">
      {loading ? <Waiting /> : note === null ? <Waiting /> : (
        <div className={cn("text-[11px]", note === "No reversal" ? "text-white/40" : "text-amber-300 font-medium")}>{note}</div>
      )}
    </Shell>
  );
}

/* C62 */ export function TimeSinceTrade({ trades, loading }: Chain3Props) {
  const last = useMemo(() => (trades.length ? Math.max(...trades.map((t) => t.timestamp)) : null), [trades]);
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <Shell icon={<Timer size={13} />} title="Time Since Trade">
      {loading || last === null ? <Waiting /> : (
        <div className="text-sm text-white">
          <span className="font-bold">{Math.max(0, Math.floor(Date.now() / 1000) - last)}s</span>
          <span className="text-white/50 text-[11px]"> since last trade</span>
        </div>
      )}
    </Shell>
  );
}

/* C63 */ export function TradeClock({ trades, loading }: Chain3Props) {
  const { count, rate } = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const n = trades.filter((t) => now - t.timestamp <= 3600).length;
    return { count: n, rate: n / 60 };
  }, [trades]);
  return (
    <Shell icon={<Activity size={13} />} title="Trade Clock">
      {loading ? <Waiting /> : (
        <div>
          <div className="text-lg font-bold text-white">{count} <span className="text-[11px] font-medium text-white/50">trades / last 60 min</span></div>
          <div className="text-[11px] text-white/50">{rate.toFixed(2)} trades per minute</div>
        </div>
      )}
    </Shell>
  );
}

/* C64 */ export function VolumeProfile({ trades, solPrice, loading }: Chain3Props) {
  const buckets = useMemo(() => {
    const b = [
      { label: "< $25", v: 0 },
      { label: "$25–250", v: 0 },
      { label: "$250–2500", v: 0 },
      { label: "$2500+", v: 0 },
    ];
    for (const t of trades) {
      const usd = t.solAmount * (solPrice ?? 0);
      const i = usd < 25 ? 0 : usd < 250 ? 1 : usd < 2500 ? 2 : 3;
      b[i].v += usd;
    }
    const max = Math.max(1, ...b.map((x) => x.v));
    return { b, max };
  }, [trades, solPrice]);
  return (
    <Shell icon={<BarChart3 size={13} />} title="Volume Profile">
      {loading || trades.length === 0 ? <Waiting /> : (
        <div className="space-y-1.5">
          {buckets.b.map((r) => (
            <div key={r.label}>
              <div className="flex justify-between text-[11px] text-white/60 mb-0.5">
                <span>{r.label}</span>
                <span className="text-white/80">{fmtUsd(r.v)}</span>
              </div>
              <Bar pct={(r.v / buckets.max) * 100} className="bg-violet-400" />
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

/* C65 */ export function SlippageEst({ trades, solPrice, liquidity, loading }: Chain3Props) {
  const slip = useMemo(() => {
    if (!liquidity || liquidity <= 0) return undefined;
    const buys = trades.filter((t) => t.side === "BUY");
    if (buys.length === 0) return null;
    const avg = buys.reduce((a, t) => a + t.solAmount * (solPrice ?? 0), 0) / buys.length;
    return (avg / liquidity) * 100;
  }, [trades, solPrice, liquidity]);
  return (
    <Shell icon={<Droplets size={13} />} title="Slippage Est">
      {loading ? <Waiting /> : slip === undefined ? <div className="text-[11px] text-white/30">— (no liquidity data)</div>
      : slip === null ? <Waiting /> : (
        <div className="text-lg font-bold text-white">{slip.toFixed(3)}%</div>
      )}
    </Shell>
  );
}

/* C66 */ export function LiquidityDepth({ liquidity, loading }: Chain3Props) {
  return (
    <Shell icon={<Layers size={13} />} title="Liquidity Depth">
      {loading ? <Waiting /> : liquidity != null && liquidity > 0 ? (
        <div className="text-lg font-bold text-white">{fmtUsd(liquidity)}</div>
      ) : (
        <div className="text-[11px] text-white/30">liquidity unknown</div>
      )}
    </Shell>
  );
}

/* C67 */ export function ImpactMeter({ trades, solPrice, liquidity, loading }: Chain3Props) {
  const impact = useMemo(() => {
    if (!liquidity || liquidity <= 0 || trades.length === 0) return undefined;
    const max = Math.max(...trades.map((t) => t.solAmount * (solPrice ?? 0)));
    return (max / liquidity) * 100;
  }, [trades, solPrice, liquidity]);
  return (
    <Shell icon={<Weight size={13} />} title="Impact Meter">
      {loading ? <Waiting /> : impact === undefined ? <div className="text-[11px] text-white/30">— (no liquidity data)</div> : (
        <div>
          <div className={cn("text-lg font-bold", impact > 1 ? "text-red-400" : "text-white")}>
            {impact.toFixed(2)}%
          </div>
          <div className="text-[11px] text-white/50">largest trade vs liquidity{impact > 1 ? " — high impact!" : ""}</div>
        </div>
      )}
    </Shell>
  );
}

/* C68 */ export function SpreadTracker({ trades, solPrice, loading }: Chain3Props) {
  const r = useMemo(() => {
    const buys = trades.filter((t) => t.side === "BUY");
    const sells = trades.filter((t) => t.side === "SELL");
    if (buys.length === 0 || sells.length === 0) return null;
    const avgB = buys.reduce((a, t) => a + t.solAmount * (solPrice ?? 0), 0) / buys.length;
    const avgS = sells.reduce((a, t) => a + t.solAmount * (solPrice ?? 0), 0) / sells.length;
    if (avgS <= 0) return null;
    return { ratio: avgB / avgS, avgB, avgS };
  }, [trades, solPrice]);
  return (
    <Shell icon={<GitCompareArrows size={13} />} title="Spread Tracker">
      {loading || r === null ? <Waiting /> : (
        <div>
          <div className="text-sm font-bold text-white">buy {fmtUsd(r.avgB)} <span className="text-white/40 font-medium">vs</span> sell {fmtUsd(r.avgS)}</div>
          <div className="mt-1.5"><Bar pct={Math.min(100, (r.ratio / 2) * 100)} className="bg-sky-400" /></div>
          <div className="text-[10px] text-white/40 mt-0.5">ratio {r.ratio.toFixed(2)}× (buy/sell)</div>
        </div>
      )}
    </Shell>
  );
}

/* C69 */ export function Momentum5m({ trades, solPrice, loading }: Chain3Props) {
  const label = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const buyVol = (a: number, b: number) => trades
      .filter((t) => t.side === "BUY" && t.timestamp > now - a && t.timestamp <= now - b)
      .reduce((s, t) => s + t.solAmount, 0);
    const cur = buyVol(300, 0), prev = buyVol(600, 300);
    if (cur <= 0 && prev <= 0) return null;
    if (cur > prev * 1.25) return "↗ accelerating";
    if (cur < prev * 0.75) return "↘ cooling";
    return "—";
  }, [trades, solPrice]);
  return (
    <Shell icon={<Rocket size={13} />} title="Momentum 5m">
      {loading || label === null ? <Waiting /> : (
        <div className={cn("text-sm font-semibold", label.includes("↗") ? "text-emerald-400" : label.includes("↘") ? "text-red-400" : "text-white/60")}>
          {label}
        </div>
      )}
    </Shell>
  );
}

/* C70 */ export function CalmScore({ trades, loading }: Chain3Props) {
  const score = useMemo(() => {
    if (trades.length < 2) return null;
    const xs = trades.map((t) => t.solAmount);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    if (mean <= 0) return null;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    return Math.max(0, 100 - Math.min(100, (sd / mean) * 100));
  }, [trades]);
  const label = score === null ? "" : score >= 66 ? "serene" : score >= 33 ? "choppy" : "violent";
  return (
    <Shell icon={<Leaf size={13} />} title="Calm Score">
      {loading || score === null ? <Waiting /> : (
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-white">{score.toFixed(0)}</span>
            <span className={cn("text-[11px] font-semibold", label === "serene" ? "text-emerald-400" : label === "choppy" ? "text-amber-300" : "text-red-400")}>{label}</span>
          </div>
          <div className="mt-1.5"><Bar pct={score} className="bg-teal-400" /></div>
        </div>
      )}
    </Shell>
  );
}

/* C71 */ export function TickDirection({ trades, solPrice, loading }: Chain3Props) {
  const ticks = useMemo(() => {
    const s = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    return s.slice(-3).reverse().map((t) => ({
      side: t.side,
      usd: t.solAmount * (solPrice ?? 0),
    }));
  }, [trades, solPrice]);
  return (
    <Shell icon={<ArrowUpDown size={13} />} title="Tick Direction">
      {loading || ticks.length === 0 ? <Waiting /> : (
        <div className="flex gap-2">
          {ticks.map((t, i) => (
            <div key={i} className="flex-1 rounded-lg bg-white/5 p-1.5 text-center">
              <div className={cn("text-base", t.side === "BUY" ? "text-emerald-400" : t.side === "SELL" ? "text-red-400" : "text-white/40")}>
                {t.side === "BUY" ? "▲" : t.side === "SELL" ? "▼" : "•"}
              </div>
              <div className="text-[10px] text-white/50">{fmtUsd(t.usd)}</div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

/* C72 */ export function PatternNote({ trades, solPrice, loading }: Chain3Props) {
  const note = useMemo(() => {
    if (trades.length === 0) return null;
    const now = Math.floor(Date.now() / 1000);
    const whales = trades.filter((t) => t.side === "BUY" && t.solAmount * (solPrice ?? 0) > 500 && now - t.timestamp <= 1200).length;
    let buy = 0, sell = 0;
    for (const t of trades) {
      if (t.side === "BUY") buy += t.solAmount;
      else if (t.side === "SELL") sell += t.solAmount;
    }
    const tot = buy + sell;
    const mom = tot > 0 ? Math.round(((buy - sell) / tot) * 100) : 0;
    const parts: string[] = [];
    if (whales > 0) parts.push(`Whales accumulating: ${whales} buy${whales > 1 ? "s" : ""} >$500 in 20m`);
    parts.push(`momentum ${mom >= 0 ? "+" : ""}${mom}`);
    const s = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    let cur = 1;
    for (let i = s.length - 1; i > 0 && s[i].side === s[i - 1].side; i--) cur++;
    if (cur >= 3) parts.push(`on a ${cur}-${s[s.length - 1].side.toLowerCase()} streak`);
    return parts.join(", ") + ".";
  }, [trades, solPrice]);
  return (
    <Shell icon={<Sparkles size={13} />} title="Pattern Note">
      {loading || note === null ? <Waiting /> : (
        <div className="text-[11px] text-white/70 leading-relaxed">{note}</div>
      )}
    </Shell>
  );
}

/* C73 */ export function WeekendCheck({ trades, solPrice, loading }: Chain3Props) {
  const data = useMemo(() => {
    if (trades.length === 0) return null;
    const ts = trades.map((t) => t.timestamp);
    const spanH = (Math.max(...ts) - Math.min(...ts)) / 3600;
    if (spanH < 36) return { short: true as const };
    let wd = 0, we = 0;
    for (const t of trades) {
      const d = new Date(t.timestamp * 1000).getUTCDay();
      if (d === 0 || d === 6) we += t.solAmount * (solPrice ?? 0);
      else wd += t.solAmount * (solPrice ?? 0);
    }
    return { short: false as const, wd, we };
  }, [trades, solPrice]);
  return (
    <Shell icon={<CalendarDays size={13} />} title="Weekend Check">
      {loading || data === null ? <Waiting /> : data.short ? (
        <div className="text-[11px] text-white/30">needs 7d of data</div>
      ) : (
        <div className="space-y-1.5">
          {[
            { label: "Weekday", v: data.wd, cls: "bg-sky-400" },
            { label: "Weekend", v: data.we, cls: "bg-violet-400" },
          ].map((r) => {
            const tot = data.wd + data.we;
            const pct = tot > 0 ? (r.v / tot) * 100 : 0;
            return (
              <div key={r.label}>
                <div className="flex justify-between text-[11px] text-white/60 mb-0.5">
                  <span>{r.label}</span>
                  <span className="text-white/80">{fmtUsd(r.v)} · {pct.toFixed(0)}%</span>
                </div>
                <Bar pct={pct} className={r.cls} />
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

/* C74 */ export function SessionLabel({ trades, solPrice, loading }: Chain3Props) {
  const data = useMemo(() => {
    const h = new Date().getUTCHours();
    const sess = sessionOf(h);
    const label = sess === "Asia" ? "🌏 Asia" : sess === "EU" ? "🌍 EU" : "🌎 US";
    let sessVol = 0, tot = 0;
    for (const t of trades) {
      const v = t.solAmount * (solPrice ?? 0);
      tot += v;
      if (sessionOf(utcHour(t.timestamp)) === sess) sessVol += v;
    }
    return { label, share: tot > 0 ? (sessVol / tot) * 100 : null };
  }, [trades, solPrice]);
  return (
    <Shell icon={<Sun size={13} />} title="Session Label">
      {loading ? <Waiting /> : (
        <div>
          <div className="text-sm font-semibold text-white">{data.label}</div>
          <div className="text-[11px] text-white/50">
            {data.share === null ? "waiting for trades" : `${data.share.toFixed(0)}% of feed volume in this session`}
          </div>
        </div>
      )}
    </Shell>
  );
}

/* C75 */ export function DataWindow({ trades, loading }: Chain3Props) {
  const text = useMemo(() => {
    if (trades.length === 0) return null;
    const ts = trades.map((t) => t.timestamp);
    const spanMin = Math.max(0, (Math.max(...ts) - Math.min(...ts)) / 60);
    const h = Math.floor(spanMin / 60);
    const m = Math.round(spanMin % 60);
    return `Analyzing ${trades.length} trades over ${h}h ${m}m of chain history`;
  }, [trades]);
  return (
    <Shell icon={<Database size={13} />} title="Data Window">
      {loading || text === null ? <Waiting /> : (
        <div className="text-[11px] text-white/70">{text}</div>
      )}
    </Shell>
  );
}

/* Aggregate export for convenience */
export const chain3Widgets = {
  BestBuyTime, SessionMap, TradeHeatmap, RushHours, QuietHours, VolatilityMeter,
  MomentumOsc, FearGreed, ChopIndex, TrendStrength, ReversalWatch, TimeSinceTrade,
  TradeClock, VolumeProfile, SlippageEst, LiquidityDepth, ImpactMeter, SpreadTracker,
  Momentum5m, CalmScore, TickDirection, PatternNote, WeekendCheck, SessionLabel, DataWindow,
};
