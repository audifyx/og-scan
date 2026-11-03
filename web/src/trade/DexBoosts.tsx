/* DexBoosts — boosted tokens section.
 * Reads ACTIVE rows from Supabase `dex_boosts` (fetchActiveBoosts in
 * dexFeed). If the table doesn't exist yet (migration not applied) or
 * the query fails, the fetch resolves to [] and this renders the
 * empty state — never crashes. Each boost mint is resolved to live
 * DexScreener pair data for symbol / image / price when available;
 * a boost whose mint has no live pair still renders with its
 * shortened mint address.
 */
import { useEffect, useMemo, useState } from "react";
import type { DexBoost } from "./dexFeed";
import { fetchActiveBoosts, fetchTokenPairs } from "./dexFeed";
import type { MarketCoin } from "./tradeApi";
import { fmtUsd, shortAddr } from "./tradeFmt";
import TokenAvatar from "./TokenAvatar";

export type DexBoostsProps = {
  /** Pre-fetched boosts. When omitted the component fetches itself. */
  boosts?: DexBoost[];
  loading?: boolean;
  onSelectMint?: (mint: string) => void;
};

const TIER_LABEL: Record<string, string> = {
  standard: "Standard",
  premium: "Premium",
  turbo: "Turbo",
};

const TIER_STYLE: Record<string, React.CSSProperties> = {
  standard: { color: "var(--txth-silver, #c9d1d9)", borderColor: "var(--txth-silver-line, rgba(201,209,217,.16))" },
  premium: { color: "var(--txth-gold, #e8b84a)", borderColor: "var(--txth-line-strong, rgba(232,184,74,.42))" },
  turbo: { color: "#050505", background: "var(--txth-gold, #e8b84a)", borderColor: "var(--txth-gold, #e8b84a)" },
};

function expiryLabel(boost: DexBoost): string {
  if (!boost.ends_at) return "No expiry";
  const ms = new Date(boost.ends_at).getTime();
  if (!Number.isFinite(ms)) return "No expiry";
  const remaining = ms - Date.now();
  if (remaining <= 0) return "Expired";
  const mins = Math.floor(remaining / 60000);
  if (mins < 60) return `Ends in ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `Ends in ${hours}h`;
  return `Ends in ${Math.floor(hours / 24)}d`;
}

export default function DexBoosts({ boosts, loading, onSelectMint }: DexBoostsProps) {
  const [selfBoosts, setSelfBoosts] = useState<DexBoost[]>([]);
  const [selfLoading, setSelfLoading] = useState(boosts === undefined);
  const [meta, setMeta] = useState<Record<string, MarketCoin>>({});

  useEffect(() => {
    if (boosts !== undefined) return;
    let live = true;
    setSelfLoading(true);
    fetchActiveBoosts()
      .then((rows) => {
        if (live) setSelfBoosts(rows);
      })
      .catch(() => {
        if (live) setSelfBoosts([]);
      })
      .finally(() => {
        if (live) setSelfLoading(false);
      });
    return () => {
      live = false;
    };
  }, [boosts]);

  const list = boosts !== undefined ? boosts : selfBoosts;
  const isLoading = boosts !== undefined ? !!loading : selfLoading;

  const mints = useMemo(() => list.map((b) => b.mint), [list]);
  useEffect(() => {
    if (!mints.length) return;
    let live = true;
    fetchTokenPairs(mints)
      .then((r) => {
        if (!live) return;
        const next: Record<string, MarketCoin> = {};
        for (const c of r.coins) next[c.mint] = c;
        setMeta(next);
      })
      .catch(() => {
        /* leave meta empty — rows still render with the mint */
      });
    return () => {
      live = false;
    };
  }, [mints]);

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
        Boosted
      </div>

      {isLoading && (
        <div style={{ fontSize: 12, color: "var(--txth-muted, rgba(244,244,242,.55))", padding: "12px 0" }}>
          Loading boosted tokens…
        </div>
      )}

      {!isLoading && list.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--txth-muted, rgba(244,244,242,.55))", padding: "12px 0" }}>
          No boosted tokens right now.
        </div>
      )}

      {!isLoading &&
        list.map((b) => {
          const coin = meta[b.mint];
          const tierStyle = TIER_STYLE[b.tier] || TIER_STYLE.standard;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onSelectMint?.(b.mint)}
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
              <TokenAvatar image={coin?.image} symbol={coin?.symbol} mint={b.mint} size={32} />
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
                  {coin?.symbol || shortAddr(b.mint)}
                </span>
                <span style={{ display: "block", fontSize: 11, color: "var(--txth-muted, rgba(244,244,242,.55))" }}>
                  {coin ? fmtUsd(coin.price) : shortAddr(b.mint)}
                </span>
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  border: "1px solid",
                  borderRadius: 99,
                  padding: "3px 8px",
                  whiteSpace: "nowrap",
                  ...tierStyle,
                }}
              >
                {TIER_LABEL[b.tier] || b.tier}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--txth-muted, rgba(244,244,242,.55))",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {expiryLabel(b)}
              </span>
            </button>
          );
        })}
    </div>
  );
}
