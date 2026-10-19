/**
 * Free data APIs for token data — DexScreener, CoinGecko, pump.fun.
 * Aggregates across sources for the richest free data.
 */

// ---------------------------------------------------------------------------
// DexScreener (free, no key)
// ---------------------------------------------------------------------------

export async function getDexScreenerToken(mint) {
  const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`, {
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!Array.isArray(data) || !data.length) return null;
  const p = data[0];
  return {
    source: "dexscreener",
    symbol: p.baseToken?.symbol,
    name: p.baseToken?.name,
    price_usd: p.priceUsd ? Number(p.priceUsd) : null,
    price_sol: p.priceNative ? Number(p.priceNative) : null,
    change_5m: p.priceChange?.m5,
    change_1h: p.priceChange?.h1,
    change_6h: p.priceChange?.h6,
    change_24h: p.priceChange?.h24,
    volume_24h: p.volume?.h24,
    liquidity_usd: p.liquidity?.usd,
    market_cap: p.marketCap || p.fdv,
    fdv: p.fdv,
    pair_address: p.pairAddress,
    dex: p.dexId,
    chain: p.chainId,
    buys_24h: p.txns?.h24?.buys,
    sells_24h: p.txns?.h24?.sells,
    url: p.url,
  };
}

// ---------------------------------------------------------------------------
// CoinGecko (free tier)
// ---------------------------------------------------------------------------

export async function getCoinGeckoToken(mint) {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/solana/contract/${mint}`,
    { signal: AbortSignal.timeout(15000) }
  ).catch(() => null);
  if (!res || !res.ok) return null;
  const d = await res.json().catch(() => null);
  if (!d) return null;
  return {
    source: "coingecko",
    symbol: d.symbol?.toUpperCase(),
    name: d.name,
    price_usd: d.market_data?.current_price?.usd,
    market_cap: d.market_data?.market_cap?.usd,
    volume_24h: d.market_data?.total_volume?.usd,
    change_24h: d.market_data?.price_change_percentage_24h,
    image: d.image?.large,
    description: d.description?.en?.slice(0, 500),
    links: {
      homepage: d.links?.homepage?.[0],
      twitter: d.links?.twitter_screen_name ? `https://x.com/${d.links.twitter_screen_name}` : null,
      telegram: d.links?.telegram_channel_identifier ? `https://t.me/${d.links.telegram_channel_identifier}` : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Pump.fun bonding curve
// ---------------------------------------------------------------------------

export async function getPumpCurve(mint) {
  const res = await fetch(`https://frontend-api.pump.fun/coins/${mint}`, {
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const d = await res.json().catch(() => null);
  if (!d) return null;
  return {
    source: "pump",
    complete: d.complete,
    graduation_pct: d.complete ? 100 : estimateGraduation(d),
    virtual_sol: d.virtual_sol_reserves,
    virtual_tokens: d.virtual_token_reserves,
    real_sol: d.real_sol_reserves,
    market_cap: d.market_cap,
    usd_market_cap: d.usd_market_cap,
    bonding_curve: d.bonding_curve,
    associated_bonding_curve: d.associated_bonding_curve,
    creator: d.creator,
    created_at: d.created_timestamp,
    raydium_pool: d.raydium_pool,
  };
}

function estimateGraduation(d) {
  // Pump.fun graduates at ~85 SOL in bonding curve
  const solInCurve = (d.virtual_sol_reserves || 0) / 1e9;
  return Math.min(100, (solInCurve / 85) * 100);
}

// ---------------------------------------------------------------------------
// Aggregated — best of all sources
// ---------------------------------------------------------------------------

export async function getFullTokenData(mint) {
  const [dex, gecko, pump] = await Promise.all([
    getDexScreenerToken(mint),
    getCoinGeckoToken(mint),
    getPumpCurve(mint),
  ]);

  return {
    mint,
    // Prefer DexScreener for price (fastest), CoinGecko for metadata
    symbol: dex?.symbol || gecko?.symbol,
    name: dex?.name || gecko?.name,
    image: gecko?.image,
    description: gecko?.description,
    price_usd: dex?.price_usd || gecko?.price_usd,
    market_cap: dex?.market_cap || gecko?.market_cap,
    volume_24h: dex?.volume_24h || gecko?.volume_24h,
    change_24h: dex?.change_24h ?? gecko?.change_24h,
    liquidity_usd: dex?.liquidity_usd,
    // Pump-specific
    bonding_curve: pump ? {
      complete: pump.complete,
      graduation_pct: pump.graduation_pct,
      graduated: pump.complete,
      raydium_pool: pump.raydium_pool,
    } : null,
    // Sources
    dex_screener_url: dex?.url || `https://dexscreener.com/solana/${mint}`,
    pump_url: `https://pump.fun/${mint}`,
    sources: {
      dexscreener: !!dex,
      coingecko: !!gecko,
      pump: !!pump,
    },
  };
}
