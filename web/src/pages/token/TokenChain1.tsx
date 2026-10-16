import type { ReactNode } from "react";
import {
  Waves, Scale, ArrowRightLeft, ChartColumn, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownRight, Gauge, MoveUpRight, MoveDownRight, Coins,
  Calculator, Crown, Fish, Flame, Repeat, History, ChartNoAxesColumn,
  Radio, Sigma, Percent, Clock, Database, CircleDot,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RpcTrade } from "./rpcFeed";

/* ---------- shared ---------- */

export interface Chain1Props {
  trades: RpcTrade[];
  solPrice?: number | null;
  loading?: boolean;
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function fmtUsd(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtSol(n: number): string {
  return `${n.toFixed(2)} SOL`;
}

function shortAddr(a: string): string {
  if (!a || a.length < 10) return a || "—";
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

/* USD per trade when a solPrice is provided, else null (fall back to SOL display). */
const usdOf = (solPrice?: number | null) => (t: RpcTrade): number | null =>
  solPrice ? t.solAmount * solPrice : null;

/* Only BUY/SELL count for volume-style stats; BURN/TRANSFER ignored. */
const tradeSides = (trades: RpcTrade[]): RpcTrade[] =>
  trades.filter((t) => t.side === "BUY" || t.side === "SELL");

const EMPTY = (
  <p className="text-xs text-white/35">Waiting for on-chain data…</p>
);

function Shell({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-white/50" />
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

function SideBadge({ side }: { side: RpcTrade["side"] }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-bold",
        side === "BUY" && "bg-emerald-500/15 text-emerald-300",
        side === "SELL" && "bg-red-500/15 text-red-300",
        side === "BURN" && "bg-orange-500/15 text-orange-300",
        side === "TRANSFER" && "bg-white/10 text-white/50"
      )}
    >
      {side}
    </span>
  );
}

function amt(t: RpcTrade, usd: (t: RpcTrade) => number | null): string {
  const u = usd(t);
  return u != null ? fmtUsd(u) : fmtSol(t.solAmount);
}

/* C1 */
export function C1_WhaleFeed({ trades, solPrice }: Chain1Props) {
  const usd = usdOf(solPrice);
  const whales = trades
    .filter((t) => {
      const u = usd(t);
      return u != null ? u >= 1000 : t.solAmount >= 6;
    })
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);
  return (
    <Shell icon={Waves} title="Whale Feed">
      {whales.length === 0 ? (
        EMPTY
      ) : (
        <ul className="space-y-1.5">
          {whales.map((t) => (
            <li
              key={t.signature}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-1.5">
                <SideBadge side={t.side} />
                <span className="font-semibold text-white/90">{amt(t, usd)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/40">
                <span className="font-mono">{shortAddr(t.wallet)}</span>
                <span>{timeAgo(t.timestamp)} ago</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

/* C2 */
export function C2_SellPressure({ trades, solPrice }: Chain1Props) {
  const usd = usdOf(solPrice);
  const ts = tradeSides(trades);
  const val = (t: RpcTrade) => usd(t) ?? t.solAmount;
  const buyV = ts.filter((t) => t.side === "BUY").reduce((s, t) => s + val(t), 0);
  const sellV = ts.filter((t) => t.side === "SELL").reduce((s, t) => s + val(t), 0);
  const total = buyV + sellV;
  const buyPct = total > 0 ? (buyV / total) * 100 : 0;
  const fmt = solPrice ? fmtUsd : fmtSol;
  return (
    <Shell icon={Scale} title="Sell Pressure">
      {total === 0 ? (
        EMPTY
      ) : (
        <div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/5">
            <div className="bg-emerald-500" style={{ width: `${buyPct}%` }} />
            <div className="flex-1 bg-red-500/80" />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-emerald-300">
              BUY {buyPct.toFixed(1)}% · {fmt(buyV)}
            </span>
            <span className="text-red-300">
              SELL {(100 - buyPct).toFixed(1)}% · {fmt(sellV)}
            </span>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* C3 */
export function C3_NetFlow({ trades, solPrice }: Chain1Props) {
  const usd = usdOf(solPrice);
  const ts = tradeSides(trades);
  if (ts.length === 0) {
    return (
      <Shell icon={ArrowRightLeft} title="Net Flow">
        {EMPTY}
      </Shell>
    );
  }
  const val = (t: RpcTrade) => usd(t) ?? t.solAmount;
  const buyV = ts.filter((t) => t.side === "BUY").reduce((s, t) => s + val(t), 0);
  const sellV = ts.filter((t) => t.side === "SELL").reduce((s, t) => s + val(t), 0);
  const net = buyV - sellV;
  const label = solPrice ? fmtUsd(Math.abs(net)) : fmtSol(Math.abs(net));
  return (
    <Shell icon={ArrowRightLeft} title="Net Flow">
      <p
        className={cn(
          "text-2xl font-bold tabular-nums",
          net >= 0 ? "text-emerald-300" : "text-red-300"
        )}
      >
        {net >= 0 ? "+" : "−"}
        {label}
      </p>
      <p className="mt-1 text-[11px] text-white/40">buys minus sells</p>
    </Shell>
  );
}

/* C4 */
export function C4_TradeSizeDist({ trades, solPrice }: Chain1Props) {
  if (!solPrice) {
    return (
      <Shell icon={ChartColumn} title="Trade Size Dist">
        {EMPTY}
      </Shell>
    );
  }
  const usd = usdOf(solPrice);
  const ts = tradeSides(trades);
  const buckets = [
    { label: "<$25", min: 0, max: 25 },
    { label: "$25–250", min: 25, max: 250 },
    { label: "$250–2.5K", min: 250, max: 2500 },
    { label: "$2.5K+", min: 2500, max: Infinity },
  ].map((b) => ({
    ...b,
    count: ts.filter((t) => {
      const u = usd(t) ?? 0;
      return u >= b.min && u < b.max;
    }).length,
  }));
  const max = Math.max(...buckets.map((b) => b.count), 0);
  return (
    <Shell icon={ChartColumn} title="Trade Size Dist">
      {max === 0 ? (
        EMPTY
      ) : (
        <div className="flex h-28 items-end gap-2">
          {buckets.map((b) => (
            <div key={b.label} className="flex h-full flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-[11px] font-semibold text-white/80 tabular-nums">
                {b.count}
              </span>
              <div
                className="w-full rounded-t bg-sky-500/70"
                style={{ height: `${(b.count / max) * 70}%` }}
              />
              <span className="mt-1 text-[10px] text-white/40">{b.label}</span>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

/* C5 */
export function C5_AvgBuySize({ trades, solPrice }: Chain1Props) {
  const usd = usdOf(solPrice);
  const buys = tradeSides(trades).filter((t) => t.side === "BUY");
  if (buys.length === 0) {
    return (
      <Shell icon={TrendingUp} title="Avg Buy Size">
        {EMPTY}
      </Shell>
    );
  }
  const val = (t: RpcTrade) => usd(t) ?? t.solAmount;
  const avg = buys.reduce((s, t) => s + val(t), 0) / buys.length;
  return (
    <Shell icon={TrendingUp} title="Avg Buy Size">
      <p className="text-2xl font-bold text-emerald-300 tabular-nums">
        {solPrice ? fmtUsd(avg) : fmtSol(avg)}
      </p>
      <p className="mt-1 text-[11px] text-white/40">mean of {buys.length} buys</p>
    </Shell>
  );
}

/* C6 */
export function C6_AvgSellSize({ trades, solPrice }: Chain1Props) {
  const usd = usdOf(solPrice);
  const sells = tradeSides(trades).filter((t) => t.side === "SELL");
  if (sells.length === 0) {
    return (
      <Shell icon={TrendingDown} title="Avg Sell Size">
        {EMPTY}
      </Shell>
    );
  }
  const val = (t: RpcTrade) => usd(t) ?? t.solAmount;
  const avg = sells.reduce((s, t) => s + val(t), 0) / sells.length;
  return (
    <Shell icon={TrendingDown} title="Avg Sell Size">
      <p className="text-2xl font-bold text-red-300 tabular-nums">
        {solPrice ? fmtUsd(avg) : fmtSol(avg)}
      </p>
      <p className="mt-1 text-[11px] text-white/40">mean of {sells.length} sells</p>
    </Shell>
  );
}

/* C7 */
export function C7_LargestBuy({ trades, solPrice }: Chain1Props) {
  const usd = usdOf(solPrice);
  const buys = tradeSides(trades).filter((t) => t.side === "BUY");
  if (buys.length === 0) {
    return (
      <Shell icon={ArrowUpRight} title="Largest Buy">
        {EMPTY}
      </Shell>
    );
  }
  const top = buys.reduce((a, b) => (b.solAmount > a.solAmount ? b : a));
  return (
    <Shell icon={ArrowUpRight} title="Largest Buy">
      <p className="text-2xl font-bold text-emerald-300 tabular-nums">{amt(top, usd)}</p>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-white/40">
        <span className="font-mono">{shortAddr(top.wallet)}</span>
        <span>·</span>
        <span>{timeAgo(top.timestamp)} ago</span>
      </div>
    </Shell>
  );
}

/* C8 */
export function C8_LargestSell({ trades, solPrice }: Chain1Props) {
  const usd = usdOf(solPrice);
  const sells = tradeSides(trades).filter((t) => t.side === "SELL");
  if (sells.length === 0) {
    return (
      <Shell icon={ArrowDownRight} title="Largest Sell">
        {EMPTY}
      </Shell>
    );
  }
  const top = sells.reduce((a, b) => (b.solAmount > a.solAmount ? b : a));
  return (
    <Shell icon={ArrowDownRight} title="Largest Sell">
      <p className="text-2xl font-bold text-red-300 tabular-nums">{amt(top, usd)}</p>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-white/40">
        <span className="font-mono">{shortAddr(top.wallet)}</span>
        <span>·</span>
        <span>{timeAgo(top.timestamp)} ago</span>
      </div>
    </Shell>
  );
}

/* C9 */
export function C9_TradeVelocity({ trades }: Chain1Props) {
  /* counts every on-chain event in the feed (BUY/SELL/BURN/TRANSFER) */
  if (trades.length === 0) {
    return (
      <Shell icon={Gauge} title="Trade Velocity">
        {EMPTY}
      </Shell>
    );
  }
  const cutoff = Date.now() / 1000 - 600;
  const recent = trades.filter((t) => t.timestamp >= cutoff).length;
  return (
    <Shell icon={Gauge} title="Trade Velocity">
      <p className="text-2xl font-bold text-white/90 tabular-nums">
        {(recent / 10).toFixed(1)}
        <span className="text-sm font-medium text-white/40">/min</span>
      </p>
      <p className="mt-1 text-[11px] text-white/40">
        {recent} trades in last 10 min
      </p>
    </Shell>
  );
}

/* C10 */
export function C10_BuyCount({ trades }: Chain1Props) {
  const n = tradeSides(trades).filter((t) => t.side === "BUY").length;
  return (
    <Shell icon={MoveUpRight} title="Buy Count">
      {trades.length === 0 ? (
        EMPTY
      ) : (
        <div>
          <p className="text-2xl font-bold text-emerald-300 tabular-nums">{n}</p>
          <p className="mt-1 text-[11px] text-white/40">buy trades in feed</p>
        </div>
      )}
    </Shell>
  );
}

/* C11 */
export function C11_SellCount({ trades }: Chain1Props) {
  const n = tradeSides(trades).filter((t) => t.side === "SELL").length;
  return (
    <Shell icon={MoveDownRight} title="Sell Count">
      {trades.length === 0 ? (
        EMPTY
      ) : (
        <div>
          <p className="text-2xl font-bold text-red-300 tabular-nums">{n}</p>
          <p className="mt-1 text-[11px] text-white/40">sell trades in feed</p>
        </div>
      )}
    </Shell>
  );
}

/* C12 */
export function C12_TotalVolume({ trades, solPrice }: Chain1Props) {
  const usd = usdOf(solPrice);
  const ts = tradeSides(trades);
  if (ts.length === 0) {
    return (
      <Shell icon={Coins} title="Total Volume">
        {EMPTY}
      </Shell>
    );
  }
  const val = (t: RpcTrade) => usd(t) ?? t.solAmount;
  const total = ts.reduce((s, t) => s + val(t), 0);
  return (
    <Shell icon={Coins} title="Total Volume">
      <p className="text-2xl font-bold text-white/90 tabular-nums">
        {solPrice ? fmtUsd(total) : fmtSol(total)}
      </p>
      <p className="mt-1 text-[11px] text-white/40">buys + sells</p>
    </Shell>
  );
}

/* C13 */
export function C13_MedianBuy({ trades, solPrice }: Chain1Props) {
  const usd = usdOf(solPrice);
  const buys = tradeSides(trades).filter((t) => t.side === "BUY");
  if (buys.length === 0) {
    return (
      <Shell icon={Calculator} title="Median Buy">
        {EMPTY}
      </Shell>
    );
  }
  const vals = buys
    .map((t) => usd(t) ?? t.solAmount)
    .sort((a, b) => a - b);
  const mid = Math.floor(vals.length / 2);
  const median =
    vals.length % 2 === 1 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
  return (
    <Shell icon={Calculator} title="Median Buy">
      <p className="text-2xl font-bold text-white/90 tabular-nums">
        {solPrice ? fmtUsd(median) : fmtSol(median)}
      </p>
      <p className="mt-1 text-[11px] text-white/40">median of {buys.length} buys</p>
    </Shell>
  );
}

/* C14 */
export function C14_WhaleCount({ trades, solPrice }: Chain1Props) {
  const usd = usdOf(solPrice);
  const ts = tradeSides(trades);
  if (ts.length === 0) {
    return (
      <Shell icon={Crown} title="Whale Count">
        {EMPTY}
      </Shell>
    );
  }
  const n = ts.filter((t) => {
    const u = usd(t);
    return u != null ? u >= 1000 : t.solAmount >= 6;
  }).length;
  return (
    <Shell icon={Crown} title="Whale Count">
      <p className="text-2xl font-bold text-amber-300 tabular-nums">{n}</p>
      <p className="mt-1 text-[11px] text-white/40">
        trades {solPrice ? "≥ $1K" : "≥ 6 SOL"}
      </p>
    </Shell>
  );
}

/* C15 */
export function C15_ShrimpCount({ trades, solPrice }: Chain1Props) {
  if (!solPrice) {
    return (
      <Shell icon={Fish} title="Shrimp Count">
        {EMPTY}
      </Shell>
    );
  }
  const usd = usdOf(solPrice);
  const ts = tradeSides(trades);
  if (ts.length === 0) {
    return (
      <Shell icon={Fish} title="Shrimp Count">
        {EMPTY}
      </Shell>
    );
  }
  const n = ts.filter((t) => (usd(t) ?? Infinity) < 50).length;
  return (
    <Shell icon={Fish} title="Shrimp Count">
      <p className="text-2xl font-bold text-sky-300 tabular-nums">{n}</p>
      <p className="mt-1 text-[11px] text-white/40">trades under $50</p>
    </Shell>
  );
}

/* C16 */
export function C16_RecentBigBuy({ trades, solPrice }: Chain1Props) {
  if (!solPrice) {
    return (
      <Shell icon={Flame} title="Recent Big Buy">
        {EMPTY}
      </Shell>
    );
  }
  const usd = usdOf(solPrice);
  const big = [...trades]
    .sort((a, b) => b.timestamp - a.timestamp)
    .find((t) => {
      const u = usd(t);
      return u != null && u >= 500;
    });
  return (
    <Shell icon={Flame} title="Recent Big Buy">
      {!big ? (
        EMPTY
      ) : (
        <div>
          <div className="flex items-center gap-2">
            <SideBadge side={big.side} />
            <p className="text-xl font-bold text-white/90 tabular-nums">
              {amt(big, usd)}
            </p>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-white/40">
            <span>{timeAgo(big.timestamp)} ago</span>
            <span>·</span>
            <span className="font-mono">{shortAddr(big.wallet)}</span>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* C17 */
export function C17_BuyStreak({ trades }: Chain1Props) {
  if (trades.length === 0) {
    return (
      <Shell icon={Repeat} title="Buy Streak">
        {EMPTY}
      </Shell>
    );
  }
  const sorted = [...trades].sort((a, b) => b.timestamp - a.timestamp);
  let streak = 0;
  for (const t of sorted) {
    if (t.side === "BUY") streak++;
    else break;
  }
  return (
    <Shell icon={Repeat} title="Buy Streak">
      <p className="text-2xl font-bold text-emerald-300 tabular-nums">{streak}</p>
      <p className="mt-1 text-[11px] text-white/40">
        consecutive buys from latest trade
      </p>
    </Shell>
  );
}

/* C18 */
export function C18_SellStreak({ trades }: Chain1Props) {
  if (trades.length === 0) {
    return (
      <Shell icon={History} title="Sell Streak">
        {EMPTY}
      </Shell>
    );
  }
  const sorted = [...trades].sort((a, b) => b.timestamp - a.timestamp);
  let streak = 0;
  for (const t of sorted) {
    if (t.side === "SELL") streak++;
    else break;
  }
  return (
    <Shell icon={History} title="Sell Streak">
      <p className="text-2xl font-bold text-red-300 tabular-nums">{streak}</p>
      <p className="mt-1 text-[11px] text-white/40">
        consecutive sells from latest trade
      </p>
    </Shell>
  );
}

/* C19 */
export function C19_VolumeBars({ trades }: Chain1Props) {
  const last12 = [...trades]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-12);
  const max = Math.max(...last12.map((t) => t.solAmount), 0);
  return (
    <Shell icon={ChartNoAxesColumn} title="Volume Bars">
      {last12.length === 0 ? (
        EMPTY
      ) : (
        <div className="flex h-20 items-end gap-1">
          {last12.map((t) => (
            <div
              key={t.signature}
              title={`${t.side} ${fmtSol(t.solAmount)} · ${timeAgo(t.timestamp)} ago`}
              className={cn(
                "flex-1 rounded-sm",
                t.side === "BUY" && "bg-emerald-500/80",
                t.side === "SELL" && "bg-red-500/80",
                (t.side === "BURN" || t.side === "TRANSFER") && "bg-white/15"
              )}
              style={{
                height: max > 0 ? `${Math.max(8, (t.solAmount / max) * 100)}%` : "8%",
              }}
            />
          ))}
        </div>
      )}
    </Shell>
  );
}

/* C20 */
export function C20_TradeTicker({ trades }: Chain1Props) {
  if (trades.length === 0) {
    return (
      <Shell icon={Radio} title="Trade Ticker">
        {EMPTY}
      </Shell>
    );
  }
  const latest = trades.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
  const color =
    latest.side === "BUY"
      ? "text-emerald-300"
      : latest.side === "SELL"
        ? "text-red-300"
        : "text-white/70";
  return (
    <Shell icon={Radio} title="Trade Ticker">
      <p className={cn("text-sm font-bold", color)}>
        {latest.side} {fmtSol(latest.solAmount)}{" "}
        <span className="font-medium text-white/40">
          → {timeAgo(latest.timestamp)} ago
        </span>
      </p>
    </Shell>
  );
}

/* C21 */
export function C21_AvgTradeSize({ trades, solPrice }: Chain1Props) {
  const usd = usdOf(solPrice);
  const ts = tradeSides(trades);
  if (ts.length === 0) {
    return (
      <Shell icon={Sigma} title="Avg Trade Size">
        {EMPTY}
      </Shell>
    );
  }
  const val = (t: RpcTrade) => usd(t) ?? t.solAmount;
  const avg = ts.reduce((s, t) => s + val(t), 0) / ts.length;
  return (
    <Shell icon={Sigma} title="Avg Trade Size">
      <p className="text-2xl font-bold text-white/90 tabular-nums">
        {solPrice ? fmtUsd(avg) : fmtSol(avg)}
      </p>
      <p className="mt-1 text-[11px] text-white/40">mean of {ts.length} trades</p>
    </Shell>
  );
}

/* C22 */
export function C22_WhaleShare({ trades, solPrice }: Chain1Props) {
  const usd = usdOf(solPrice);
  const ts = tradeSides(trades);
  if (ts.length === 0) {
    return (
      <Shell icon={Percent} title="Whale Share">
        {EMPTY}
      </Shell>
    );
  }
  const val = (t: RpcTrade) => usd(t) ?? t.solAmount;
  const isWhale = (t: RpcTrade) => {
    const u = usd(t);
    return u != null ? u >= 1000 : t.solAmount >= 6;
  };
  const whaleV = ts.filter(isWhale).reduce((s, t) => s + val(t), 0);
  const totalV = ts.reduce((s, t) => s + val(t), 0);
  const pct = totalV > 0 ? (whaleV / totalV) * 100 : 0;
  return (
    <Shell icon={Percent} title="Whale Share">
      <p className="text-2xl font-bold text-amber-300 tabular-nums">
        {pct.toFixed(1)}%
      </p>
      <p className="mt-1 text-[11px] text-white/40">of volume from whales</p>
    </Shell>
  );
}

/* C23 */
export function C23_FirstTrade({ trades, solPrice }: Chain1Props) {
  if (trades.length === 0) {
    return (
      <Shell icon={Clock} title="First Trade">
        {EMPTY}
      </Shell>
    );
  }
  const usd = usdOf(solPrice);
  const oldest = trades.reduce((a, b) => (b.timestamp < a.timestamp ? b : a));
  return (
    <Shell icon={Clock} title="First Trade">
      <div className="flex items-center gap-2">
        <SideBadge side={oldest.side} />
        <p className="text-xl font-bold text-white/90 tabular-nums">
          {amt(oldest, usd)}
        </p>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-white/40">
        <span>oldest in feed · {timeAgo(oldest.timestamp)} old</span>
        <span>·</span>
        <span className="font-mono">{shortAddr(oldest.wallet)}</span>
      </div>
    </Shell>
  );
}

/* C24 */
export function C24_FeedDepth({ trades }: Chain1Props) {
  if (trades.length === 0) {
    return (
      <Shell icon={Database} title="Feed Depth">
        {EMPTY}
      </Shell>
    );
  }
  const newest = trades.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
  const oldest = trades.reduce((a, b) => (b.timestamp < a.timestamp ? b : a));
  return (
    <Shell icon={Database} title="Feed Depth">
      <p className="text-sm text-white/70">
        Tracking <span className="font-bold text-white/90 tabular-nums">{trades.length}</span>{" "}
        trades · newest {timeAgo(newest.timestamp)} ago · oldest {timeAgo(oldest.timestamp)} ago
      </p>
    </Shell>
  );
}

/* C25 */
export function C25_SideDot({ trades }: Chain1Props) {
  if (trades.length === 0) {
    return (
      <Shell icon={CircleDot} title="Side Dot">
        {EMPTY}
      </Shell>
    );
  }
  const last = trades.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
  const color =
    last.side === "BUY"
      ? "bg-emerald-400"
      : last.side === "SELL"
        ? "bg-red-400"
        : "bg-white/30";
  const label =
    last.side === "BUY"
      ? "text-emerald-300"
      : last.side === "SELL"
        ? "text-red-300"
        : "text-white/50";
  return (
    <Shell icon={CircleDot} title="Side Dot">
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span
            className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", color)}
          />
          <span className={cn("relative inline-flex h-3 w-3 rounded-full", color)} />
        </span>
        <p className={cn("text-sm font-bold", label)}>
          Last trade: {last.side}
          <span className="ml-1 font-medium text-white/40">
            {timeAgo(last.timestamp)} ago
          </span>
        </p>
      </div>
    </Shell>
  );
}
