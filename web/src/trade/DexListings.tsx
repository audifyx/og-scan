/* DexListings — new token listings feed (latest DexScreener token
 * profiles, enriched with live pair data — see dexFeed.fetchNewListings).
 * Newest first, with age, chain, DEX, liquidity, and a NEW badge for
 * pairs under 1h old. Self-fetches when no `coins` prop is passed.
 * Never fakes data: a failed fetch shows "feed unreachable".
 */
import { useEffect, useState } from "react";
import type { MarketCoin } from "./tradeApi";
import { fetchNewListings, isNewPair } from "./dexFeed";
import { fmtNum, fmtUsd, shortAddr, timeAgo } from "./tradeFmt";
import TokenAvatar from "./TokenAvatar";

export type DexListingsProps = {
  /** Pre-fetched coins. When omitted the component fetches itself. */
  coins?: MarketCoin[];
  loading?: boolean;
  error?: string | null;
  limit?: number;
  onSelect?: (coin: MarketCoin) => void;
};

function ageLabel(coin: MarketCoin): string {
  if (!coin.createdAt) return "—";
  const ms = new Date(coin.createdAt).getTime();
  if (!Number.isFinite(ms)) return "—";
  return `${timeAgo(ms)} ago`;
}

export default function DexListings({ coins, loading, error, limit = 30, onSelect }: DexListingsProps) {
  const [selfCoins, setSelfCoins] = useState<MarketCoin[]>([]);
  const [selfLoading, setSelfLoading] = useState(coins === undefined);
  const [selfError, setSelfError] = useState<string | null>(null);

  useEffect(() => {
    if (coins !== undefined) return;
    let live = true;
    setSelfLoading(true);
    fetchNewListings(limit)
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

  const list = coins !== undefined ? coins.slice(0, limit) : selfCoins;
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
        New listings
      </div>

      {isLoading && (
        <div style={{ fontSize: 12, color: "var(--txth-muted, rgba(244,244,242,.55))", padding: "12px 0" }}>
          Loading new listings…
        </div>
      )}

      {!isLoading && err && (
        <div style={{ fontSize: 12, color: "var(--txth-down, #ff5c6c)", padding: "12px 0" }}>
          Feed unreachable — DexScreener did not respond.
        </div>
      )}

      {!isLoading && !err && list.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--txth-muted, rgba(244,244,242,.55))", padding: "12px 0" }}>
          No new listings right now.
        </div>
      )}

      {!isLoading &&
        !err &&
        list.map((c) => {
          const isNew = isNewPair(c);
          return (
            <button
              key={c.mint}
              type="button"
              onClick={() => onSelect?.(c)}
              style={{
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
              }}
            >
              <TokenAvatar image={c.image} symbol={c.symbol} mint={c.mint} size={32} />
              <span style={{ minWidth: 0, flex: "1 1 auto" }}>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 800,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.symbol || shortAddr(c.mint)}
                  </span>
                  {isNew && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: ".08em",
                        color: "#050505",
                        background: "var(--txth-gold, #e8b84a)",
                        borderRadius: 99,
                        padding: "2px 6px",
                        flexShrink: 0,
                      }}
                    >
                      NEW
                    </span>
                  )}
                </span>
                <span style={{ display: "block", fontSize: 11, color: "var(--txth-muted, rgba(244,244,242,.55))" }}>
                  {c.chain || "—"}
                  {c.dexId ? ` · ${c.dexId}` : ""}
                  {` · ${ageLabel(c)}`}
                </span>
              </span>
              <span style={{ textAlign: "right", flexShrink: 0 }}>
                <span style={{ display: "block", fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {c.liquidity > 0 ? fmtUsd(c.liquidity) : "—"}
                </span>
                <span style={{ display: "block", fontSize: 11, color: "var(--txth-muted, rgba(244,244,242,.55))" }}>
                  liq{c.txns24h != null ? ` · ${fmtNum(c.txns24h)} txns` : ""}
                </span>
              </span>
            </button>
          );
        })}
    </div>
  );
}
