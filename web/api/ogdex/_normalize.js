// Normalize a Jupiter v2 token object to the OG DEX row shape.
// Enriched: keeps all interval windows, audit, firstPool, tags and derived changes.
export const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const pct = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

function statBlock(s = {}) {
  const buy = num(s.buyVolume), sell = num(s.sellVolume);
  return {
    priceChange: pct(s.priceChange),
    holderChange: pct(s.holderChange),
    liquidityChange: pct(s.liquidityChange),
    volumeChange: pct(s.volumeChange),
    buyVolume: buy, sellVolume: sell,
    volume: (buy || 0) + (sell || 0),
    buyOrganicVolume: num(s.buyOrganicVolume),
    sellOrganicVolume: num(s.sellOrganicVolume),
    numBuys: num(s.numBuys), numSells: num(s.numSells),
    numTraders: num(s.numTraders), numNetBuyers: num(s.numNetBuyers),
    numOrganicBuyers: num(s.numOrganicBuyers),
  };
}

export function normToken(t, interval = "24h") {
  if (!t) return null;
  const s = t[`stats${interval}`] || t.stats24h || {};
  const buy = num(s.buyVolume), sell = num(s.sellVolume);
  const vol = (buy || 0) + (sell || 0);
  const created = t.createdAt || t.firstPool?.createdAt || null;
  const ageDays = created ? Math.max(0, Math.round((Date.now() - new Date(created).getTime()) / 864e5)) : null;
  const audit = t.audit || {};
  return {
    mint: t.id || t.mint,
    name: t.name,
    symbol: t.symbol,
    icon: t.icon || t.image || null,
    priceUsd: num(t.usdPrice ?? t.priceUsd),
    mcap: num(t.mcap),
    fdv: num(t.fdv),
    liquidity: num(t.liquidity),
    holderCount: num(t.holderCount),
    volume: vol,
    buyVolume: buy,
    sellVolume: sell,
    numBuys: num(s.numBuys),
    numSells: num(s.numSells),
    numTraders: num(s.numTraders),
    numOrganicBuyers: num(s.numOrganicBuyers),
    netBuyers: num(s.numNetBuyers),
    change5m: pct(t.stats5m?.priceChange),
    change1h: pct(t.stats1h?.priceChange),
    change6h: pct(t.stats6h?.priceChange),
    change24h: pct(t.stats24h?.priceChange),
    holderChange24h: pct(t.stats24h?.holderChange),
    liquidityChange24h: pct(t.stats24h?.liquidityChange),
    volumeChange24h: pct(t.stats24h?.volumeChange),
    organicScore: num(t.organicScore),
    organicScoreLabel: t.organicScoreLabel || null,
    isVerified: !!t.isVerified || !!t.isVerifiedJup,
    dev: t.dev || null,
    tokenProgram: t.tokenProgram || null,
    circSupply: num(t.circSupply),
    totalSupply: num(t.totalSupply),
    decimals: num(t.decimals),
    tags: Array.isArray(t.tags) ? t.tags : [],
    createdAt: created,
    ageDays,
    firstPool: t.firstPool ? { id: t.firstPool.id, createdAt: t.firstPool.createdAt } : null,
    audit: {
      mintAuthorityDisabled: !!audit.mintAuthorityDisabled,
      freezeAuthorityDisabled: !!audit.freezeAuthorityDisabled,
      topHoldersPercentage: num(audit.topHoldersPercentage),
      devBalancePercentage: num(audit.devBalancePercentage),
      devMints: num(audit.devMints),
    },
    // full interval windows for deep analytics
    stats: {
      "5m": statBlock(t.stats5m), "1h": statBlock(t.stats1h),
      "6h": statBlock(t.stats6h), "24h": statBlock(t.stats24h),
    },
  };
}
