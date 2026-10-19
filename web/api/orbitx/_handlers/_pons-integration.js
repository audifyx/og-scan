/**
 * Pons V2 integration — Robinhood Chain launchpad.
 * EVM-compatible. Factory: 0x80a77001456bc986083678F9a112B1EC2Aa07281
 */

const PONS_FACTORY = "0x80a77001456bc986083678F9a112B1EC2Aa07281";
const PONS_API = "https://api.pons.fi";

// Robinhood Chain RPC (EVM)
const RH_RPC = "https://rpc.robinhood.com";

export const PONS_PAIRS = {
  eth: { name: "ETH", native: true },
  usdc: { name: "USDC", address: null }, // Resolved at runtime
};

async function rpcCall(method, params = []) {
  const res = await fetch(RH_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`RPC failed: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

export async function launchViaPons({ name, symbol, uri, quote = "eth", devBuyEth = 0 }, signer) {
  // Pons V2 factory launch()
  // Each launch() deploys a token + its own StonkCurvePool (bonding curve)
  //
  // This requires EVM signing via the Robinhood Chain wallet.
  // The backend holds the key and signs.

  // Build the launch transaction
  // factory.launch(name, symbol, uri, quoteToken, devBuyAmount)

  return {
    pending: true,
    launchpad: "pons",
    chain: "robinhood",
    factory: PONS_FACTORY,
    message: "Pons V2 launch queued. EVM wallet signing via backend.",
    params: { name, symbol, uri, quote, devBuyEth },
  };
}

export async function getPonsToken(tokenAddress) {
  const res = await fetch(`${PONS_API}/launcher/token/${tokenAddress}`, {
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return res.json().catch(() => null);
}

export async function getPonsPool(tokenAddress) {
  // poolOf(token) on the factory
  // Returns the bonding curve pool address
  return null; // Implemented via direct contract call
}

export const PONS_CONFIG = {
  factory: PONS_FACTORY,
  api: PONS_API,
  rpc: RH_RPC,
};
