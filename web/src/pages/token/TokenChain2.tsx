/**
 * TokenChain2.tsx — C26..C50: on-chain HOLDER & SUPPLY widgets.
 * All wallet behavior is scoped to the current N-trade RPC feed window,
 * never presented as full-chain history. Never invents numbers:
 * missing data renders an honest "awaiting feed" state.
 */
import {
  Users, UserPlus, UserMinus, Repeat, Gem, TrendingDown, Trophy, Flame,
  Percent, PieChart, Coins, Flag, Hash, History, Zap, Timer, HeartHandshake,
  Repeat2, TriangleAlert, Hourglass, Fish, Info, ArrowDownToLine, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface RpcTrade {
  signature: string;
  timestamp: number; // unix seconds
  side: "BUY" | "SELL" | "BURN" | "TRANSFER";
  tokenAmount: number;
  solAmount: number;
  wallet: string;
}

export interface Chain2Props {
  trades: RpcTrade[];
  burns?: RpcTrade[];
  solPrice?: number | null;
  burned?: number | null;
  loading?: boolean;
}

type Props = Pick<Chain2Props, "trades" | "burns" | "solPrice" | "burned" | "loading">;

const INITIAL_SUPPLY = 1_000_000_000;

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function shortAddr(w: string): string {
  if (!w) return "—";
  return w.length <= 10 ? w : `${w.slice(0, 4)}…${w.slice(-4)}`;
}

function timeAgo(ts: number): string {
  if (!ts) return "—";
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtTokens(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function usdOf(t: RpcTrade, solPrice?: number | null): number | null {
  return solPrice != null ? t.solAmount * solPrice : null;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function fmtDuration(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "—";
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m`;
  return `${Math.floor(sec)}s`;
}

/* Behavior maps, all scoped to the feed window */
function walletSides(trades: RpcTrade[]) {
  const buys = new Map<string, RpcTrade[]>();
  const sells = new Map<string, RpcTrade[]>();
  for (const t of trades) {
    if (t.side === "BUY") {
      const a = buys.get(t.wallet) ?? [];
      a.push(t);
      buys.set(t.wallet, a);
    } else if (t.side === "SELL") {
      const a = sells.get(t.wallet) ?? [];
      a.push(t);
      sells.set(t.wallet, a);
    }
  }
  return { buys, sells };
}

function Shell({
  icon,
  title,
  subtitle,
  children,
  waiting,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  waiting?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-amber-300/90">{icon}</span>
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-white/90">{title}</div>
          {subtitle && <div className="truncate text-[10px] text-white/40">{subtitle}</div>}
        </div>
      </div>
      {waiting ? (
        <div className="py-2 text-center text-xs text-white/35">Awaiting feed…</div>
      ) : (
        children
      )}
    </div>
  );
}

function Empty({ trades, loading }: { trades: RpcTrade[]; loading?: boolean }) {
  return trades.length === 0 || loading;
}

/* ------------------------------------------------------------------ */
/* C26–C50                                                            */
/* ------------------------------------------------------------------ */

/* C26 */
export function C26UniqueWallets({ trades, loading }: Props) {
  const n = new Set(trades.map((t) => t.wallet)).size;
  return (
    <Shell icon={<Users size={14} />} title="Unique Wallets" subtitle="feed window" waiting={Empty({ trades, loading })}>
      <div className="text-2xl font-bold text-white">{n.toLocaleString()}</div>
      <div className="text-[10px] text-white/40">distinct wallets seen</div>
    </Shell>
  );
}

/* C27 */
export function C27UniqueBuyers({ trades, loading }: Props) {
  const n = new Set(trades.filter((t) => t.side === "BUY").map((t) => t.wallet)).size;
  return (
    <Shell icon={<UserPlus size={14} />} title="Unique Buyers" subtitle="feed window" waiting={Empty({ trades, loading })}>
      <div className="text-2xl font-bold text-emerald-300">{n.toLocaleString()}</div>
      <div className="text-[10px] text-white/40">wallets that bought</div>
    </Shell>
  );
}

/* C28 */
export function C28UniqueSellers({ trades, loading }: Props) {
  const n = new Set(trades.filter((t) => t.side === "SELL").map((t) => t.wallet)).size;
  return (
    <Shell icon={<UserMinus size={14} />} title="Unique Sellers" subtitle="feed window" waiting={Empty({ trades, loading })}>
      <div className="text-2xl font-bold text-rose-300">{n.toLocaleString()}</div>
      <div className="text-[10px] text-white/40">wallets that sold</div>
    </Shell>
  );
}

/* C29 */
export function C29RepeatBuyers({ trades, loading }: Props) {
  const { buys } = walletSides(trades);
  const repeats = [...buys.entries()].filter(([, a]) => a.length >= 2);
  const top = repeats
    .map(([w, a]) => ({ w, n: a.length }))
    .sort((x, y) => y.n - x.n)
    .slice(0, 3);
  return (
    <Shell icon={<Repeat size={14} />} title="Repeat Buyers" subtitle="2+ buys in window" waiting={Empty({ trades, loading })}>
      <div className="text-2xl font-bold text-white">{repeats.length.toLocaleString()}</div>
      <div className="mt-1 space-y-0.5">
        {top.map((t) => (
          <div key={t.w} className="flex items-center justify-between text-[10px]">
            <span className="font-mono text-white/60">{shortAddr(t.w)}</span>
            <span className="text-emerald-300/80">{t.n} buys</span>
          </div>
        ))}
        {repeats.length === 0 && <div className="text-[10px] text-white/35">none yet</div>}
      </div>
    </Shell>
  );
}

/* C30 */
export function C30DiamondWallets({ trades, loading }: Props) {
  const { buys, sells } = walletSides(trades);
  const diamonds = [...buys.keys()].filter((w) => !sells.has(w)).length;
  return (
    <Shell icon={<Gem size={14} />} title="Diamond Wallets" subtitle="bought, never sold (window)" waiting={Empty({ trades, loading })}>
      <div className="flex items-baseline gap-1.5">
        <div className="text-2xl font-bold text-white">{diamonds.toLocaleString()}</div>
        <span className="text-lg">💎</span>
      </div>
      <div className="text-[10px] text-white/40">buyers with zero sells</div>
    </Shell>
  );
}

/* C31 */
export function C31PaperHands({ trades, loading }: Props) {
  const { buys, sells } = walletSides(trades);
  const papers = [...buys.keys()].filter((w) => {
    const b = buys.get(w)!;
    const s = sells.get(w);
    if (!s || s.length === 0) return false;
    const firstBuy = Math.min(...b.map((t) => t.timestamp));
    return s.some((t) => t.timestamp >= firstBuy);
  }).length;
  return (
    <Shell icon={<TrendingDown size={14} />} title="Paper Hands" subtitle="bought then sold (window)" waiting={Empty({ trades, loading })}>
      <div className="text-2xl font-bold text-rose-300">{papers.toLocaleString()}</div>
      <div className="text-[10px] text-white/40">buyers who later sold</div>
    </Shell>
  );
}

/* C32 */
export function C32TopTraders({ trades, solPrice, loading }: Props) {
  const vol = new Map<string, number>();
  for (const t of trades) {
    const u = usdOf(t, solPrice);
    if (u == null) continue;
    vol.set(t.wallet, (vol.get(t.wallet) ?? 0) + u);
  }
  const top = [...vol.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return (
    <Shell icon={<Trophy size={14} />} title="Top Traders" subtitle="by USD volume (window)" waiting={Empty({ trades, loading }) || solPrice == null}>
      <div className="space-y-1">
        {top.map(([w, v], i) => (
          <div key={w} className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className={cn("font-bold", i === 0 ? "text-amber-300" : "text-white/40")}>{i + 1}</span>
              <span className="font-mono text-white/60">{shortAddr(w)}</span>
            </span>
            <span className="font-semibold text-white/85">{fmtUsd(v)}</span>
          </div>
        ))}
        {top.length === 0 && <div className="text-[10px] text-white/35">no priced trades</div>}
      </div>
    </Shell>
  );
}

/* C33 */
export function C33BurnedTotal({ burned, loading }: Props) {
  return (
    <Shell icon={<Flame size={14} />} title="Total Burned" subtitle="supply destroyed" waiting={burned == null || loading}>
      <div className="flex items-center gap-1.5">
        <Flame size={18} className="text-orange-400" />
        <div className="text-2xl font-bold text-orange-300">{fmtTokens(burned)} ORBITX</div>
      </div>
      <div className="text-[10px] text-white/40">gone forever</div>
    </Shell>
  );
}

/* C34 */
export function C34BurnedPercent({ burned, loading }: Props) {
  const f = burned != null ? burned / INITIAL_SUPPLY : null;
  return (
    <Shell icon={<Percent size={14} />} title="Burned of Supply" subtitle="1B initial" waiting={f == null || loading}>
      <div className="text-2xl font-bold text-white">{f != null ? pct(f) : "—"}</div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-300" style={{ width: `${Math.min(100, (f ?? 0) * 100)}%` }} />
      </div>
    </Shell>
  );
}

/* C35 */
export function C35CirculatingPie({ burned, loading }: Props) {
  const f = burned != null ? Math.min(1, burned / INITIAL_SUPPLY) : null;
  return (
    <Shell icon={<PieChart size={14} />} title="Supply Mix" subtitle="burned vs circulating" waiting={f == null || loading}>
      <div className="flex items-center gap-3">
        <div
          className="h-14 w-14 shrink-0 rounded-full"
          style={{ background: `conic-gradient(#f59e0b ${(f ?? 0) * 360}deg, rgba(255,255,255,0.12) 0deg)` }}
        />
        <div className="space-y-1 text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-white/55">Burned {f != null ? pct(f) : "—"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-white/20" />
            <span className="text-white/55">Circulating {f != null ? pct(1 - f) : "—"}</span>
          </div>
        </div>
      </div>
    </Shell>
  );
}

/* C36 */
export function C36SupplyRemaining({ burned, loading }: Props) {
  const rem = burned != null ? INITIAL_SUPPLY - burned : null;
  return (
    <Shell icon={<Coins size={14} />} title="Supply Remaining" subtitle="1B − burned" waiting={rem == null || loading}>
      <div className="text-2xl font-bold text-white">{fmtTokens(rem)}</div>
      <div className="text-[10px] text-white/40">ORBITX in circulation</div>
    </Shell>
  );
}

/* C37 */
export function C37BurnMilestone({ burned, loading }: Props) {
  const next = burned != null ? Math.ceil((burned + 1) / 1e6) * 1e6 : null;
  const done = burned != null ? burned - Math.floor(burned / 1e6) * 1e6 : null;
  const p = done != null ? done / 1e6 : 0;
  return (
    <Shell icon={<Flag size={14} />} title="Next Burn Milestone" subtitle="to next whole million" waiting={next == null || loading}>
      <div className="text-lg font-bold text-white">
        {done != null ? fmtTokens(done) : "—"} <span className="text-white/40 text-xs">/ 1.00M →</span> {fmtTokens(next)}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400" style={{ width: `${Math.min(100, p * 100)}%` }} />
      </div>
      <div className="mt-1 text-[10px] text-white/40">{done != null ? `${fmtTokens(1e6 - done)} to go` : ""}</div>
    </Shell>
  );
}

/* C38 */
export function C38BurnCount({ burns, loading }: Props) {
  const n = burns?.length ?? 0;
  return (
    <Shell icon={<Hash size={14} />} title="Burn Transactions" subtitle="in feed" waiting={(!burns && !loading) || loading}>
      <div className="text-2xl font-bold text-white">{n.toLocaleString()}</div>
      <div className="text-[10px] text-white/40">burn txs seen</div>
    </Shell>
  );
}

/* C39 */
export function C39LargestBurn({ burns, loading }: Props) {
  const top = burns && burns.length > 0 ? burns.reduce((a, b) => (b.tokenAmount > a.tokenAmount ? b : a)) : null;
  return (
    <Shell icon={<Flame size={14} />} title="Largest Burn" subtitle="in feed" waiting={!top || loading}>
      <div className="text-2xl font-bold text-orange-300">{top ? fmtTokens(top.tokenAmount) : "—"}</div>
      <div className="text-[10px] text-white/40">{top ? timeAgo(top.timestamp) : ""}</div>
    </Shell>
  );
}

/* C40 */
export function C40RecentBurn({ burns, loading }: Props) {
  const latest = burns && burns.length > 0 ? burns.reduce((a, b) => (b.timestamp > a.timestamp ? b : a)) : null;
  return (
    <Shell icon={<History size={14} />} title="Latest Burn" subtitle="in feed" waiting={!latest || loading}>
      <div className="text-xl font-bold text-orange-300">{latest ? fmtTokens(latest.tokenAmount) : "—"}</div>
      <div className="mt-1 flex items-center justify-between text-[10px]">
        <span className="text-white/40">{latest ? timeAgo(latest.timestamp) : ""}</span>
        {latest && (
          <a
            href={`https://solscan.io/tx/${latest.signature}`}
            target="_blank"
            rel="noreferrer"
            className="text-amber-300/80 underline hover:text-amber-200"
          >
            Solscan ↗
          </a>
        )}
      </div>
    </Shell>
  );
}

/* C41 */
export function C41BurnVelocity({ burns, loading }: Props) {
  const now = Math.floor(Date.now() / 1000);
  const recent = (burns ?? []).filter((b) => b.timestamp >= now - 3600);
  const pace = recent.length * 24;
  return (
    <Shell icon={<Zap size={14} />} title="Burn Velocity" subtitle="feed-window estimate" waiting={(!burns && !loading) || loading}>
      <div className="text-2xl font-bold text-white">{pace.toFixed(1)}<span className="text-sm text-white/40">/day pace</span></div>
      <div className="text-[10px] text-white/40">{recent.length} burns in last 60 min</div>
    </Shell>
  );
}

/* C42 */
export function C42DeflationClock({ burns, loading }: Props) {
  const now = Math.floor(Date.now() / 1000);
  const recent = (burns ?? []).filter((b) => b.timestamp >= now - 3600);
  const tokensPerHour = recent.reduce((s, b) => s + b.tokenAmount, 0);
  const has = burns != null && recent.length > 0 && tokensPerHour > 0;
  const hours = has ? 1e6 / tokensPerHour : null;
  return (
    <Shell icon={<Timer size={14} />} title="Deflation Clock" subtitle="est. time to next 1M burned" waiting={(!burns && !loading) || loading}>
      {has && hours != null ? (
        <>
          <div className="text-2xl font-bold text-white">~{hours < 48 ? `${hours.toFixed(1)}h` : `${(hours / 24).toFixed(1)}d`}</div>
          <div className="text-[10px] text-white/40">est. from 60-min burn pace</div>
        </>
      ) : (
        <div className="py-1 text-xs text-white/40">No recent burns — no pace to project</div>
      )}
    </Shell>
  );
}

/* C43 */
export function C43RetentionRate({ trades, loading }: Props) {
  const { buys } = walletSides(trades);
  const buyers = buys.size;
  const repeat = [...buys.values()].filter((a) => a.length >= 2).length;
  const r = buyers > 0 ? repeat / buyers : null;
  return (
    <Shell icon={<HeartHandshake size={14} />} title="Retention Rate" subtitle="repeat buyers / buyers (window)" waiting={Empty({ trades, loading }) || r == null}>
      <div className="text-2xl font-bold text-emerald-300">{r != null ? pct(r) : "—"}</div>
      <div className="text-[10px] text-white/40">{repeat} of {buyers} buyers came back</div>
    </Shell>
  );
}

/* C44 */
export function C44FlipRate({ trades, loading }: Props) {
  const { buys, sells } = walletSides(trades);
  const buyers = buys.size;
  const papers = [...buys.keys()].filter((w) => {
    const b = buys.get(w)!;
    const s = sells.get(w);
    if (!s || s.length === 0) return false;
    const firstBuy = Math.min(...b.map((t) => t.timestamp));
    return s.some((t) => t.timestamp >= firstBuy);
  }).length;
  const r = buyers > 0 ? papers / buyers : null;
  return (
    <Shell icon={<Repeat2 size={14} />} title="Flip Rate" subtitle="paper hands / buyers (window)" waiting={Empty({ trades, loading }) || r == null}>
      <div className="text-2xl font-bold text-rose-300">{r != null ? pct(r) : "—"}</div>
      <div className="text-[10px] text-white/40">{papers} of {buyers} buyers flipped</div>
    </Shell>
  );
}

/* C45 */
export function C45ConcentrationRisk({ trades, solPrice, loading }: Props) {
  const vol = new Map<string, number>();
  for (const t of trades) {
    const u = usdOf(t, solPrice);
    if (u == null) continue;
    vol.set(t.wallet, (vol.get(t.wallet) ?? 0) + u);
  }
  const vols = [...vol.values()].sort((a, b) => b - a);
  const total = vols.reduce((s, v) => s + v, 0);
  const share = total > 0 ? vols.slice(0, 3).reduce((s, v) => s + v, 0) / total : null;
  const risky = share != null && share > 0.5;
  return (
    <Shell icon={<TriangleAlert size={14} />} title="Concentration Risk" subtitle="top-3 volume share (window)" waiting={Empty({ trades, loading }) || share == null || solPrice == null}>
      <div className={cn("text-2xl font-bold", risky ? "text-red-300" : "text-white")}>
        {share != null ? pct(share) : "—"}
      </div>
      <div className={cn("text-[10px]", risky ? "text-red-300/70" : "text-white/40")}>
        {risky ? "⚠ high — top 3 dominate flow" : "top 3 wallets by USD volume"}
      </div>
    </Shell>
  );
}

/* C46 */
export function C46AvgHoldTime({ trades, loading }: Props) {
  const { buys, sells } = walletSides(trades);
  const holds: number[] = [];
  for (const [w, b] of buys) {
    const s = sells.get(w);
    if (!s || s.length === 0) continue;
    const firstBuy = Math.min(...b.map((t) => t.timestamp));
    const firstSell = Math.min(...s.filter((t) => t.timestamp >= firstBuy).map((t) => t.timestamp));
    if (isFinite(firstSell)) holds.push(firstSell - firstBuy);
  }
  const avg = holds.length > 0 ? holds.reduce((s, x) => s + x, 0) / holds.length : null;
  return (
    <Shell icon={<Hourglass size={14} />} title="Avg Hold Time" subtitle="flipped wallets, buy→sell (window)" waiting={Empty({ trades, loading })}>
      <div className="text-2xl font-bold text-white">{avg != null ? fmtDuration(avg) : "—"}</div>
      <div className="text-[10px] text-white/40">{holds.length} flipped wallets</div>
    </Shell>
  );
}

/* C47 */
export function C47WhaleWallets({ trades, solPrice, loading }: Props) {
  let n: number | null = null;
  if (solPrice != null) {
    n = new Set(trades.filter((t) => t.solAmount * solPrice >= 1000).map((t) => t.wallet)).size;
  }
  return (
    <Shell icon={<Fish size={14} />} title="Whale Wallets" subtitle="any trade ≥$1,000 (window)" waiting={Empty({ trades, loading }) || n == null}>
      <div className="text-2xl font-bold text-sky-300">{n != null ? n.toLocaleString() : "—"}</div>
      <div className="text-[10px] text-white/40">{solPrice == null ? "needs SOL price" : "wallets with $1k+ trades"}</div>
    </Shell>
  );
}

/* C48 */
export function C48WindowNote() {
  return (
    <Shell icon={<Info size={14} />} title="About These Stats">
      <div className="text-[11px] leading-relaxed text-white/55">
        Behavioral stats reflect the current N-trade feed window, not full chain history. They reset as the feed window moves.
      </div>
    </Shell>
  );
}

/* C49 */
export function C49HolderChurn({ trades, loading }: Props) {
  const b = new Set(trades.filter((t) => t.side === "BUY").map((t) => t.wallet)).size;
  const s = new Set(trades.filter((t) => t.side === "SELL").map((t) => t.wallet)).size;
  const r = b + s > 0 ? s / (b + s) : null;
  return (
    <Shell icon={<ArrowDownToLine size={14} />} title="Holder Churn" subtitle="sellers / (buyers + sellers)" waiting={Empty({ trades, loading }) || r == null}>
      <div className="text-2xl font-bold text-white">{r != null ? pct(r) : "—"}</div>
      <div className="text-[10px] text-white/40">{s} sellers vs {b} buyers</div>
    </Shell>
  );
}

/* C50 */
export function C50LoyaltyScore({ trades, loading }: Props) {
  const { buys, sells } = walletSides(trades);
  const buyers = buys.size;
  const diamonds = [...buys.keys()].filter((w) => !sells.has(w)).length;
  const repeat = [...buys.values()].filter((a) => a.length >= 2).length;
  const papers = [...buys.keys()].filter((w) => {
    const b = buys.get(w)!;
    const s = sells.get(w);
    if (!s || s.length === 0) return false;
    const firstBuy = Math.min(...b.map((t) => t.timestamp));
    return s.some((t) => t.timestamp >= firstBuy);
  }).length;
  const score =
    buyers > 0
      ? Math.round(40 * (diamonds / buyers) + 30 * (repeat / buyers) + 30 * (1 - papers / buyers))
      : null;
  return (
    <Shell icon={<Sparkles size={14} />} title="Loyalty Score" subtitle="diamond+repeat+retention (window)" waiting={Empty({ trades, loading }) || score == null}>
      <div className="flex items-center gap-3">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(#34d399 ${(score ?? 0) * 3.6}deg, rgba(255,255,255,0.12) 0deg)` }}
        >
          <span className="text-sm font-bold text-white">{score ?? "—"}</span>
        </div>
        <div className="text-[10px] leading-relaxed text-white/45">
          40% diamond ratio · 30% repeat ratio · 30% (100 − flip)
        </div>
      </div>
    </Shell>
  );
}

/* Convenience: ordered list of all 25 */
export const CHAIN2_WIDGETS = [
  C26UniqueWallets, C27UniqueBuyers, C28UniqueSellers, C29RepeatBuyers,
  C30DiamondWallets, C31PaperHands, C32TopTraders, C33BurnedTotal,
  C34BurnedPercent, C35CirculatingPie, C36SupplyRemaining, C37BurnMilestone,
  C38BurnCount, C39LargestBurn, C40RecentBurn, C41BurnVelocity,
  C42DeflationClock, C43RetentionRate, C44FlipRate, C45ConcentrationRisk,
  C46AvgHoldTime, C47WhaleWallets, C48WindowNote, C49HolderChurn,
  C50LoyaltyScore,
];
