// ============================================================
// Crypto price oracle (CoinGecko, free, no key required).
// Resolves "Will <ASSET> be >= / <= $TARGET by <time>?" markets.
// ============================================================

export interface CryptoResolutionConfig {
  asset: string;        // CoinGecko id, e.g. 'solana', 'bitcoin', 'ethereum'
  comparator: 'gte' | 'lte';
  target: number;       // USD price threshold
  yes_index?: number;   // outcome index that wins when the condition is TRUE  (default 0)
  no_index?: number;    // outcome index that wins when the condition is FALSE (default 1)
}

export interface OracleResult {
  decided: boolean;          // false => not yet resolvable, try again later
  winningOutcomeIndex?: number;
  note: string;              // human-readable explanation, stored on the bet
}

const ID_ALIASES: Record<string, string> = {
  sol: 'solana', btc: 'bitcoin', eth: 'ethereum', bnb: 'binancecoin',
  doge: 'dogecoin', ada: 'cardano', xrp: 'ripple', sui: 'sui', jup: 'jupiter-exchange-solana',
};

export async function priceUsd(asset: string): Promise<number | null> {
  const id = ID_ALIASES[asset.toLowerCase()] || asset.toLowerCase();
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`,
      { cache: 'no-store' } as any,
    );
    const j = await r.json();
    const p = Number(j?.[id]?.usd);
    return p > 0 ? p : null;
  } catch {
    return null;
  }
}

export async function resolveCryptoPrice(cfg: CryptoResolutionConfig): Promise<OracleResult> {
  if (!cfg?.asset || !cfg?.comparator || typeof cfg?.target !== 'number') {
    return { decided: false, note: 'Invalid crypto_price config' };
  }
  const price = await priceUsd(cfg.asset);
  if (price == null) return { decided: false, note: 'Price feed unavailable, will retry' };

  const yes = cfg.yes_index ?? 0;
  const no = cfg.no_index ?? 1;
  const condTrue = cfg.comparator === 'gte' ? price >= cfg.target : price <= cfg.target;
  const winner = condTrue ? yes : no;
  const sym = cfg.comparator === 'gte' ? '>=' : '<=';
  return {
    decided: true,
    winningOutcomeIndex: winner,
    note: `${cfg.asset.toUpperCase()} = $${price} (${sym} $${cfg.target} -> ${condTrue ? 'YES' : 'NO'}) via CoinGecko @ ${new Date().toISOString()}`,
  };
}
