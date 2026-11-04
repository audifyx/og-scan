/**
 * OrbitX Terminal — Analytics panels for the trade desk.
 *
 * Two sections, both real data only:
 *  1. Market overview — computed from /api/ogdex/screener rows
 *     (trending feed) + /api/ogdex/signals. Auto-refreshes every 60s.
 *  2. Per-token analytics — computed from data the desk ALREADY loads
 *     (DexScreener pair, GeckoTerminal trade tape, traders-route
 *     holders, security/xray). No extra token fetch happens here.
 *
 * Every missing number renders as "unknown" — never 0, never invented.
 * Palette is the Terminal black/white/gold/silver via --term-* vars.
 * Icons are lucide SVG only, no emoji.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  computeTokenAnalytics,
  fetchMarketOverview,
  type LiveSignal,
  type MarketOverviewResult,
} from "./analyticsApi";
import { fmtNum, fmtPct, fmtUsd, shortAddr, timeAgo } from "./tradeFmt";

/** What the desk hands over — data it already loaded for the selected mint. */
export type DeskTokenSource = {
  mint: string;
  symbol: string;
  volume5m: number;
  volume24h: number;
  buys5m: number;
  sells5m: number;
  buyVol5m: number;
  sellVol5m: number;
  trades: Array<{ side: string; value?: number | null; time?: number | null; wallet?: string | null }>;
  holders: Array<{ owner?: string | null; pct?: number | null; usdValue?: number | null }>;
  holderCount: number | null;
  top10Pct: number | null;
  devPct: number | null;
};

const REFRESH_MS = 60_000;

function toneColor(tone: string): string {
  switch (tone) {
    case "lime":
      return "var(--term-up)";
    case "red":
      return "var(--term-down)";
    case "gold":
      return "var(--term-gold)";
    default:
      return "var(--term-silver)";
  }
}

function Panel({
  title,
  icon,
  children,
  right,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--term-line-soft)] bg-[var(--term-bg-2)] p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-[var(--term-gold)]">{icon}</span>
        <h3 className="text-xs font-bold text-[var(--term-ink)]">{title}</h3>
        <span className="ml-auto">{right}</span>
      </div>
      {children}
    </section>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[var(--term-line-soft)] bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] font-medium text-[var(--term-muted)]">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-bold text-[var(--term-ink)]">{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-[var(--term-faint)]">{sub}</p> : null}
    </div>
  );
}

function MoverRow({
  mint,
  symbol,
  change,
  mcap,
  onSelect,
}: {
  mint: string;
  symbol: string;
  change: number;
  mcap: number;
  onSelect: (mint: string) => void;
}) {
  const up = change >= 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(mint)}
      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.04]"
    >
      <span className="truncate text-xs font-semibold text-[var(--term-ink)]">{symbol}</span>
      <span className="shrink-0 font-mono text-[11px] text-[var(--term-muted)]">
        {mcap > 0 ? fmtUsd(mcap) : "?"}
      </span>
      <span
        className="shrink-0 font-mono text-xs font-bold"
        style={{ color: up ? "var(--term-up)" : "var(--term-down)" }}
      >
        {fmtPct(change)}
      </span>
    </button>
  );
}

export function TradeAnalytics({
  source,
  onSelectMint,
}: {
  source: DeskTokenSource | null;
  onSelectMint: (mint: string) => void;
}) {
  const [market, setMarket] = useState<MarketOverviewResult | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetchMarketOverview();
    if (res) setMarket(res);
    setLoading(false);
  }, []);

  useEffect(() => {
    let on = true;
    void refresh();
    const iv = window.setInterval(() => {
      if (on) void refresh();
    }, REFRESH_MS);
    return () => {
      on = false;
      window.clearInterval(iv);
    };
  }, [refresh]);

  const token = useMemo(
    () =>
      source
        ? computeTokenAnalytics({
            volume5m: source.volume5m,
            volume24h: source.volume24h,
            buys5m: source.buys5m,
            sells5m: source.sells5m,
            buyVol5m: source.buyVol5m,
            sellVol5m: source.sellVol5m,
            trades: source.trades,
            holders: source.holders,
            holderCount: source.holderCount,
            top10Pct: source.top10Pct,
            devPct: source.devPct,
          })
        : null,
    [source],
  );

  const overview = market?.overview;
  const signals: LiveSignal[] = market?.signals ?? [];
  const updatedAt = market?.updatedAt ?? null;

  return (
    <div className="space-y-3 p-3">
      {/* Header — handwriting wordmark + updated stamp + manual refresh */}
      <div className="flex items-center gap-2 px-1">
        <span className="font-[var(--term-hand)] text-2xl font-bold leading-none text-[var(--term-gold)]">
          Analytics
        </span>
        <span className="ml-auto text-[10px] text-[var(--term-muted)]">
          {loading
            ? "Loading…"
            : updatedAt
              ? `Updated ${new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : "No market data"}
        </span>
        <button
          type="button"
          onClick={() => void refresh()}
          title="Refresh analytics"
          className="rounded-full border border-[var(--term-line-soft)] p-1.5 text-[var(--term-muted)] hover:text-[var(--term-ink)]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Market overview ── */}
      <Panel title="Market overview" icon={<BarChart3 className="h-3.5 w-3.5" />}>
        {loading && !overview ? (
          <div className="flex items-center justify-center py-6 text-xs text-[var(--term-muted)]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading market data…
          </div>
        ) : !overview || !overview.hasData ? (
          <p className="py-4 text-center text-xs text-[var(--term-muted)]">
            No market data — the screener returned no rows. Check back shortly.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <StatTile label="24h volume" value={fmtUsd(overview.totalVolume24h)} sub={`${fmtNum(overview.tokenCount)} tokens tracked`} />
              <StatTile label="Total liquidity" value={fmtUsd(overview.totalLiquidity)} />
              <StatTile
                label="Gainers / Losers"
                value={`${overview.gainers} / ${overview.losers}`}
                sub={overview.flat > 0 ? `${overview.flat} flat (24h)` : "24h change"}
              />
              <StatTile
                label="New pairs (24h)"
                value={overview.newPairs24h != null ? String(overview.newPairs24h) : "unknown"}
                sub={`${fmtNum(overview.newPairsFeed)} in new-pairs feed`}
              />
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-[var(--term-up)]">
                  <TrendingUp className="h-3 w-3" /> Top gainers (24h)
                </p>
                {overview.topGainers.length === 0 ? (
                  <p className="px-2 py-1 text-[11px] text-[var(--term-muted)]">No gainers in this window.</p>
                ) : (
                  overview.topGainers.map((m) => (
                    <MoverRow key={m.mint} mint={m.mint} symbol={m.symbol} change={m.change24h} mcap={m.mcap} onSelect={onSelectMint} />
                  ))
                )}
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-[var(--term-down)]">
                  <TrendingDown className="h-3 w-3" /> Top losers (24h)
                </p>
                {overview.topLosers.length === 0 ? (
                  <p className="px-2 py-1 text-[11px] text-[var(--term-muted)]">No losers in this window.</p>
                ) : (
                  overview.topLosers.map((m) => (
                    <MoverRow key={m.mint} mint={m.mint} symbol={m.symbol} change={m.change24h} mcap={m.mcap} onSelect={onSelectMint} />
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </Panel>

      {/* ── Live signals ── */}
      <Panel
        title="Live signals"
        icon={<Zap className="h-3.5 w-3.5" />}
        right={
          market?.signalsAt ? (
            <span className="text-[10px] text-[var(--term-faint)]">
              {timeAgo(new Date(market.signalsAt).getTime())} ago
            </span>
          ) : undefined
        }
      >
        {signals.length === 0 ? (
          <p className="py-2 text-center text-xs text-[var(--term-muted)]">
            {loading ? "Loading signals…" : "No live signals right now."}
          </p>
        ) : (
          <div className="space-y-1">
            {signals.slice(0, 6).map((s) => (
              <button
                key={`${s.mint}:${s.type}`}
                type="button"
                onClick={() => onSelectMint(s.mint)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.04]"
              >
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ color: toneColor(s.tone), background: "rgba(255,255,255,0.05)" }}
                >
                  {s.label}
                </span>
                <span className="truncate text-xs font-semibold text-[var(--term-ink)]">{s.symbol}</span>
                <span className="ml-auto shrink-0 truncate text-[11px] text-[var(--term-muted)]">{s.metric || "—"}</span>
              </button>
            ))}
          </div>
        )}
      </Panel>

      {/* ── Per-token analytics ── */}
      <Panel
        title={source ? `Token analytics — ${source.symbol}` : "Token analytics"}
        icon={<Activity className="h-3.5 w-3.5" />}
      >
        {!source || !token ? (
          <p className="py-4 text-center text-xs text-[var(--term-muted)]">
            Select a token to see its volume, buys vs sells, holders and whale activity.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Volume windows */}
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Volume 5m" value={token.volume5m != null ? fmtUsd(token.volume5m) : "unknown"} />
              <StatTile label="Volume 1h" value="unknown" sub="not reported by desk sources" />
              <StatTile label="Volume 24h" value={token.volume24h != null ? fmtUsd(token.volume24h) : "unknown"} />
            </div>

            {/* Buys vs sells (5m) */}
            <div>
              <p className="mb-1 text-[10px] font-semibold text-[var(--term-muted)]">Buys vs sells — last 5m</p>
              {token.buys5m == null || token.sells5m == null ? (
                <p className="text-[11px] text-[var(--term-muted)]">unknown — no 5m trade counts reported.</p>
              ) : (
                <>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div style={{ width: `${(token.buyShare5m ?? 0) * 100}%`, background: "var(--term-up)" }} />
                    <div style={{ width: `${(1 - (token.buyShare5m ?? 0)) * 100}%`, background: "var(--term-down)" }} />
                  </div>
                  <div className="mt-1 flex justify-between font-mono text-[11px]">
                    <span style={{ color: "var(--term-up)" }}>
                      {token.buys5m} buys · {token.buyVol5m != null ? fmtUsd(token.buyVol5m) : "unknown"}
                    </span>
                    <span style={{ color: "var(--term-down)" }}>
                      {token.sells5m} sells · {token.sellVol5m != null ? fmtUsd(token.sellVol5m) : "unknown"}
                    </span>
                  </div>
                </>
              )}
              <p className="mt-1.5 text-[11px] text-[var(--term-muted)]">
                Recent tape ({token.tapeCount} trades):{" "}
                <span style={{ color: "var(--term-up)" }}>{token.tapeBuys} buys · {fmtUsd(token.tapeBuyUsd)}</span>
                {" / "}
                <span style={{ color: "var(--term-down)" }}>{token.tapeSells} sells · {fmtUsd(token.tapeSellUsd)}</span>
              </p>
            </div>

            {/* Whale activity */}
            <div>
              <p className="mb-1 text-[10px] font-semibold text-[var(--term-muted)]">
                Whale activity — {token.largeTrades} trade{token.largeTrades === 1 ? "" : "s"} ≥ $10k in the recent tape
              </p>
              {token.largestTrades.length === 0 ? (
                <p className="text-[11px] text-[var(--term-muted)]">No trades in the recent tape.</p>
              ) : (
                token.largestTrades.map((t, i) => (
                  <div key={`${t.wallet ?? ""}:${t.time ?? i}`} className="flex items-center justify-between gap-2 px-1 py-1 text-[11px]">
                    <span className="font-semibold" style={{ color: t.side === "buy" ? "var(--term-up)" : "var(--term-down)" }}>
                      {t.side === "buy" ? "Buy" : "Sell"}
                    </span>
                    <span className="font-mono text-[var(--term-ink)]">{fmtUsd(t.value)}</span>
                    <span className="ml-auto truncate font-mono text-[var(--term-muted)]">
                      {t.wallet ? shortAddr(t.wallet, 4) : "unknown wallet"}
                      {t.time ? ` · ${timeAgo(t.time)} ago` : ""}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Holders */}
            <div>
              <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-[var(--term-muted)]">
                <Users className="h-3 w-3" /> Holders
              </p>
              <div className="grid grid-cols-3 gap-2">
                <StatTile label="Total holders" value={token.holderCount != null ? fmtNum(token.holderCount) : "unknown"} />
                <StatTile label="Top 10 hold" value={token.top10Pct != null ? `${token.top10Pct.toFixed(1)}%` : "unknown"} />
                <StatTile label="Dev holds" value={token.devPct != null ? `${token.devPct.toFixed(1)}%` : "unknown"} />
              </div>
              {token.topHolders.length > 0 && (
                <div className="mt-2">
                  <p className="mb-1 text-[10px] text-[var(--term-faint)]">
                    Largest holders (sample)
                    {token.top5SharePct != null ? ` — top 5 hold ${token.top5SharePct.toFixed(1)}%` : ""}
                  </p>
                  {token.topHolders.map((h) => (
                    <div key={h.owner} className="flex items-center justify-between gap-2 px-1 py-1 text-[11px]">
                      <span className="truncate font-mono text-[var(--term-muted)]">{shortAddr(h.owner, 5)}</span>
                      <span className="font-mono text-[var(--term-ink)]">
                        {h.pct != null ? `${h.pct.toFixed(2)}%` : "unknown"}
                        {h.usdValue != null ? ` · ${fmtUsd(h.usdValue)}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
