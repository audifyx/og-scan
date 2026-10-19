/**
 * Pump.fun Custom Pairs — full quote asset registry.
 * 93 assets: SOL, USDC, tokenized stocks, pre-IPO, wBTC, wETH, metals, + pump coins.
 */

export const PUMP_QUOTE_ASSETS = {
  // Native
  sol: { mint: "So11111111111111111111111111111111111111112", name: "Solana", type: "native" },
  usdc: { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", name: "USDC", type: "stable" },

  // Tokenized US stocks (xStocks)
  nvda: { mint: null, name: "Nvidia", type: "stock", ticker: "NVDA" },
  tsla: { mint: null, name: "Tesla", type: "stock", ticker: "TSLA" },
  ba: { mint: null, name: "Boeing", type: "stock", ticker: "BA" },
  baba: { mint: null, name: "Alibaba", type: "stock", ticker: "BABA" },
  dell: { mint: null, name: "Dell", type: "stock", ticker: "DELL" },

  // Pre-IPO (PreStocks)
  openai: { mint: null, name: "OpenAI (pre-IPO)", type: "preipo" },
  anthropic: { mint: null, name: "Anthropic (pre-IPO)", type: "preipo" },
  anduril: { mint: null, name: "Anduril (pre-IPO)", type: "preipo" },
  neuralink: { mint: null, name: "Neuralink (pre-IPO)", type: "preipo" },
  figure: { mint: null, name: "Figure AI (pre-IPO)", type: "preipo" },
  kalshi: { mint: null, name: "Kalshi (pre-IPO)", type: "preipo" },
  polymarket: { mint: null, name: "Polymarket (pre-IPO)", type: "preipo" },
  oura: { mint: null, name: "Oura (pre-IPO)", type: "preipo" },

  // Crypto
  wbtc: { mint: null, name: "Wrapped BTC", type: "crypto" },
  weth: { mint: null, name: "Wrapped ETH", type: "crypto" },

  // Metals
  gold: { mint: null, name: "Gold", type: "metal" },
  silver: { mint: null, name: "Silver", type: "metal" },
};

/**
 * Launch styles available on pump.fun
 */
export const PUMP_LAUNCH_STYLES = {
  standard: {
    name: "Standard",
    description: "Bonding curve, SOL or USDC pair. Graduates to PumpSwap at $58k.",
  },
  custom_pair: {
    name: "Custom Pair",
    description: "Pair against any of 93 assets: stocks, pre-IPO, crypto, metals, or another pump coin.",
  },
  jito_bundle: {
    name: "Jito Bundle",
    description: "Atomic launch + multi-wallet buys in one block. Anti-sniper.",
  },
  memecoin_quote: {
    name: "Memecoin Quote",
    description: "Pair your new coin against an existing pump.fun coin. One level deep.",
  },
};

/**
 * Get quote mint address for a pair key.
 * Returns null if needs runtime resolution.
 */
export function getQuoteMint(pairKey) {
  const asset = PUMP_QUOTE_ASSETS[pairKey.toLowerCase()];
  return asset?.mint || null;
}

/**
 * List all available pairs grouped by type.
 */
export function listPumpPairs() {
  const grouped = {};
  for (const [key, asset] of Object.entries(PUMP_QUOTE_ASSETS)) {
    if (!grouped[asset.type]) grouped[asset.type] = [];
    grouped[asset.type].push({ key, ...asset });
  }
  return grouped;
}
