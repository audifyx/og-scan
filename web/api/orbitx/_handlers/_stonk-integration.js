/**
 * StonkFun integration — Solana launchpad with stock-paired tokens.
 * Built on Raydium LaunchLab. Pairs: SPYx, NVDAx, SOL, USDC.
 */

const STONK_API = "https://api.stonk.fun";
// Raydium LaunchLab program
const LAUNCHLAB_PROGRAM = "LanMV9sAd7wArD4vJFMvNuQNK1iXySce1s5pEF3M";

export const STONK_QUOTES = {
  spyx: { mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", name: "S&P 500 (SPYx)" },
  nvdax: { mint: null, name: "Nvidia (NVDAx)" }, // Resolved at runtime
  sol: { mint: "So11111111111111111111111111111111111111112", name: "Solana" },
  usdc: { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", name: "USDC" },
};

export async function launchViaStonk({ name, symbol, uri, quote = "sol", devBuy = 0 }, signer) {
  const quoteMint = STONK_QUOTES[quote]?.mint;
  if (!quoteMint) throw new Error(`Unknown StonkFun quote: ${quote}`);

  // StonkFun uses Raydium LaunchLab — build via their API or direct CPI
  // For now, route through the launchpad aggregator
  const res = await fetch(`${STONK_API}/launch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      symbol,
      uri,
      quoteMint,
      devBuy,
      creator: signer.publicKey,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`StonkFun launch failed: ${res.status}`);
  return res.json();
}

export async function getStonkToken(mint) {
  const res = await fetch(`${STONK_API}/tokens/${mint}`, {
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return res.json().catch(() => null);
}
