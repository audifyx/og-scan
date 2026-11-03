/* DexTrending — trending tokens ranked by 24h volume + txns + price
 * move, from real DexScreener data (see dexFeed.fetchTrendingCoins).
 * Self-fetches when no `coins` prop is passed; the coordinator may
 * also pass coins in directly. Never fakes data: a failed fetch shows
 * "feed unreachable".
 */
import { useEffect, useState } from "react";
import type { MarketCoin } from "./tradeApi";
import { fetchTrendingCoins, rankTrending } from "./dexFeed";
import { fmtNum, fmtPct, fmtUsd } from "./tradeFmt";
import TokenAvatar from "./TokenAvatar";

export type DexTrendingProps = {
  /** Pre-fetched coins. When omitted the component fetches itself. */
  coins?: MarketCoin[];
  loading?: boolean;
  error?: string | null;
  limit?: number;
  onSelect?: (coin: MarketCoin) => void;
};

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid var(--txth-silver-line, rgba(201,209,217,.16))",
  color: "var(--txth-ink, #f4f4f2)",
  padding: "9px 4px",
  textAlign: "left",
  cursor: "pointer",
};

const cell: React.CSSProperties = {
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

export default function DexTrending({ coins, loading, error, limit = 20, onSelect }: DexTrendingProps) {
  const [selfCoins, setSelfCoins] = useState<MarketCoin[]>([]);
  const [selfLoading, setSelfLoading] = useState(coins === undefined);
  const [selfError, setSelfError] = useState<string | null>(null);

  useEffect(() => {
    if (coins !== undefined) return;
    let live = true;
    setSelfLoading(true);
    fetchTrendingCoins(limit)
      .then((r) => {
        if (!live) return;
        setSelfCoins(r.coins);
        setSelfError(r.error);
      })
      .catch(() => {
        if (live) setSelfError("Feed unreachable — DexScreener did not respond.");
      })
      .finally(() => {
        if (live) setSelfLoading(false);
      });
    return () => {
      live = false;
    };
  }, [coins, limit]);

  const list = coins !== undefined ? rankTrending(coins).slice(0, limit) : selfCoins;
  const isLoading = coins !== undefined ? !!loading : selfLoading;
  const err = coins !== undefined ? error ?? null : selfError;

  return (
    <div
      style={{
        background: "var(--txth-surface, #101010)",
        border: "1px solid var(--txth-line, rgba(232,184,74,.18))",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div
        style={{
          fontFamily: "var(--txth-hand, cursive)",
          fontSize: 22,
          fontWeight: 600,
          color: "var(--txth-gold, #e8b84a)",
          marginBottom: 6,
        }}
      >
        Trending
      </div>

      {isLoading && (
        <div style={{ fontSize: 12, color: "var(--txth-muted, rgba(244,244,242,.55))", padding: "12px 0" }}>
          Loading live trending tokens…
        </div>
      )}

      {!isLoading && err && (
        <div style={{ fontSize: 12, color: "var(--txth-down, #ff5c6c)", padding: "12px 0" }}>
          {err}
        </div>
      )}

      {!isLoading && !err && list.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--txth-muted, rgba(244,244,242,.55))", padding: "12px 0" }}>
          No trending tokens right now.
        </div>
      )}

      {!isLoading &&
        !err &&
        list.map((c, i) => {
          const up = c.change24h >= 0;
          return (
            <button key={c.mint} type="button" style={row} onClick={() => onSelect?.(c)}>
              <span
                style={{
                  width: 20,
                  fontSize: 12,
                  fontWeight: 800,
                  color: i < 3 ? "var(--txth-gold, #e8b84a)" : "var(--txth-muted, rgba(244,244,242,.55))",
                  textAlign: "center",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              <TokenAvatar image={c.image} symbol={c.symbol} mint={c.mint} size={32} />
              <span style={{ minWidth: 0, flex: "1 1 auto" }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 800,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.symbol || `${c.mint.slice(0, 4)}…${c.mint.slice(-4)}`}
                </span>
                <span style={{ display: "block", fontSize: 11, color: "var(--txth-muted, rgba(244,244,242,.55))" }}>
                  Vol {fmtUsd(c.volume24h)}
                  {c.txns24h != null ? ` · ${fmtNum(c.txns24h)} txns` : ""}
                </span>
              </span>
              <span style={{ textAlign: "right", flexShrink: 0 }}>
                <span style={{ ...cell, display: "block", fontWeight: 700 }}>{fmtUsd(c.price)}</span>
                <span
                  style={{
                    ...cell,
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    color: up ? "var(--txth-up, #2fd673)" : "var(--txth-down, #ff5c6c)",
                  }}
                >
                  {fmtPct(c.change24h)}
                </span>
              </span>
            </button>
          );
        })}
    </div>
  );
}
