import type { MarketCoin } from "./tradeApi";
import type { TokenScore } from "./tokenScore";
import { fmtNum, fmtPct, fmtUsd, timeAgo } from "./tradeFmt";
import TokenAvatar from "./TokenAvatar";

/**
 * TokenCard — pure presentational token card for the DEX home page.
 * No fetching inside: the image comes automatically from `coin.image`
 * (DexScreener listing data) via TokenAvatar, which falls back to a
 * neutral initials tile in theme colors when the image is missing or
 * fails to load — never a stock photo, never a broken img.
 * The score badge (when `score` is passed) shows the honest tokenScore;
 * partial-data scores are labelled as such with the missing inputs
 * in the title tooltip.
 */
export type TokenCardProps = {
  coin: MarketCoin;
  score?: TokenScore;
  onSelect?: (mint: string) => void;
};

function ageOf(createdAt?: string | null): string | null {
  if (!createdAt) return null;
  const ms = new Date(createdAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return timeAgo(ms);
}

export default function TokenCard({ coin, score, onSelect }: TokenCardProps) {
  const up = coin.change24h >= 0;
  const age = ageOf(coin.createdAt);
  const chainLabel = [coin.chain, coin.dexId].filter(Boolean).join(" · ");
  const scoreTone =
    !score ? "" : score.label === "Strong" ? "tkc__score--strong"
    : score.label === "Fair" ? "tkc__score--fair"
    : score.label === "Weak" ? "tkc__score--weak"
    : "tkc__score--low";

  const stats: Array<{ label: string; value: string }> = [
    { label: "Liquidity", value: fmtUsd(coin.liquidity) },
    { label: "24h Vol", value: fmtUsd(coin.volume24h) },
    { label: "Market Cap", value: fmtUsd(coin.mcap) },
    { label: "Age", value: age ?? "—" },
  ];

  return (
    <button
      type="button"
      onClick={() => onSelect?.(coin.mint)}
      className="tkc"
      aria-label={`${coin.symbol} — ${coin.name || coin.symbol}, ${fmtUsd(coin.price)}`}
    >
      {/* header: avatar + identity + score */}
      <span className="tkc__head">
        <TokenAvatar image={coin.image} symbol={coin.symbol} mint={coin.mint} size={44} className="tkc__logo" />
        <span className="tkc__id">
          <span className="tkc__sym">{coin.symbol}</span>
          {coin.name && coin.name !== coin.symbol ? (
            <span className="tkc__name">{coin.name}</span>
          ) : null}
        </span>
        {score ? (
          <span
            className={`tkc__score ${scoreTone}`}
            title={
              score.partial
                ? `Score ${score.score}/100 (${score.label}) — partial data, missing: ${score.missing.join(", ")}`
                : `Score ${score.score}/100 (${score.label}) — all inputs known`
            }
          >
            <svg className="tkc__score-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10z" />
              <path d="m9 11.5 2 2 4-4.5" />
            </svg>
            <span className="tkc__score-num">{score.score}</span>
            <span className="tkc__score-label">{score.label}</span>
            {score.partial ? <span className="tkc__score-partial">partial data</span> : null}
          </span>
        ) : null}
      </span>

      {/* price + 24h change */}
      <span className="tkc__price-row">
        <span className="tkc__price">{fmtUsd(coin.price)}</span>
        <span className={`tkc__chg ${up ? "tkc__chg--up" : "tkc__chg--down"}`}>
          {up ? "▲" : "▼"} {fmtPct(coin.change24h)}
        </span>
      </span>

      {/* stat grid */}
      <span className="tkc__grid">
        {stats.map((s) => (
          <span key={s.label} className="tkc__stat">
            <span className="tkc__stat-label">{s.label}</span>
            <span className="tkc__stat-value">{s.value}</span>
          </span>
        ))}
      </span>

      {/* footer: chain/DEX badge + holders/txns when known */}
      <span className="tkc__foot">
        {chainLabel ? <span className="tkc__badge">{chainLabel}</span> : <span />}
        <span className="tkc__foot-meta">
          {coin.holders != null ? `${fmtNum(coin.holders)} holders` : ""}
          {coin.holders != null && coin.txns24h != null ? " · " : ""}
          {coin.txns24h != null ? `${fmtNum(coin.txns24h)} txns 24h` : ""}
        </span>
      </span>
    </button>
  );
}
