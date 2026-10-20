/**
 * Pump.fun integration for OrbitX Launchpad.
 * Launches tokens via pump.fun program with vanity mints,
 * supports SOL and USDC pairs, claim fees, and PnL tracking.
 */

const PUMP_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const PUMPSWAP_PROGRAM_ID = "pAMMBay6oceH9fJKBRHGP5d4bD4sWpmnGxutwvhC2Tp";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// PumpDev API (for metadata upload and simplified launches)
const PUMPDEV_API = "https://pumpdev.io/api";

async function fetchJson(url, opts = {}) {
  const apiKey = process.env.PUMPDEV_API_KEY || process.env.PUMPDEV_LIGHTNING_SOL || "";
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-API-Key": apiKey } : {}),
      ...(opts.headers || {}),
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Upload token metadata to IPFS via PumpDev.
 */
export async function uploadMetadata({ name, symbol, description, imageUrl, twitter, telegram, website }) {
  const metadata = {
    name,
    symbol,
    description: description || "",
    image: imageUrl || "",
    attributes: [],
    properties: {
      category: "image",
      creators: [{ address: "OrbitXLaunchpad", share: 100 }],
    },
  };
  if (twitter) metadata.twitter = twitter;
  if (telegram) metadata.telegram = telegram;
  if (website) metadata.website = website;

  // Use PumpDev IPFS upload
  const result = await fetchJson(`${PUMPDEV_API}/ipfs`, {
    method: "POST",
    body: JSON.stringify(metadata),
  });
  return result.uri || result.ipfs_uri;
}

/**
 * Get a vanity mint keypair from the grinder pool.
 * Returns the best available (ending in 'bx' or similar).
 */
export async function getVanityMint() {
  // Check for pre-ground vanity keys
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = "/home/hatch/workspace/orbitx-launchpad";
  try {
    const files = fs.readdirSync(dir).filter((f) => f.startsWith("vanity-") && f.endsWith(".json"));
    if (files.length > 0) {
      const file = files[0];
      const keypair = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      // Move to used
      fs.renameSync(path.join(dir, file), path.join(dir, `used-${file}`));
      return { keypair, vanity: file.replace("vanity-", "").replace(".json", "") };
    }
  } catch {}
  return null;
}

/**
 * Launch a token on pump.fun via the desk wallet.
 * Supports SOL and USDC pairs.
 */
export async function launchViaPump({
  name,
  symbol,
  uri,
  mintKeypair, // Optional vanity keypair (array of numbers)
  quoteMint = null, // null = SOL, USDC_MINT = USDC
  devBuySol = 0,
  slippageBps = 500,
}, signer) {
  // This builds the pump.fun create instruction.
  // The actual signing happens via the desk wallet backend.
  //
  // For now, we use PumpDev's API which handles the transaction building.
  // The desk wallet signs the returned transaction.

  const body = {
    publicKey: signer.publicKey,
    name,
    symbol,
    uri,
    buyAmountSol: devBuySol,
    slippage: slippageBps / 100,
  };

  // Custom mint keypair for vanity
  if (mintKeypair) {
    body.mintSecretKey = Buffer.from(mintKeypair).toString("base58");
  }

  // USDC pair support
  if (quoteMint) {
    body.quoteMint = quoteMint;
  }

  const result = await fetchJson(`${PUMPDEV_API}/create`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    mint: result.mint,
    signature: result.signature,
    transactions: result.transactions,
    metadataUri: uri,
  };
}

/**
 * Claim creator fees from pump.fun.
 */
export async function claimPumpFees(mint, walletAddress) {
  const result = await fetchJson(`${PUMPDEV_API}/claim`, {
    method: "POST",
    body: JSON.stringify({ mint, publicKey: walletAddress }),
  });
  return result;
}

/**
 * Get PnL data for a wallet on pump.fun tokens.
 */
export async function getPumpPnl(walletAddress) {
  // Pump.fun PnL API
  const res = await fetch(`https://pump.fun/api/pnl/${walletAddress}`, {
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return res.json().catch(() => null);
}

/**
 * Get token data from pump.fun.
 */
export async function getPumpToken(mint) {
  const res = await fetch(`https://frontend-api.pump.fun/coins/${mint}`, {
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return res.json().catch(() => null);
}

export const PUMP_CONFIG = {
  programId: PUMP_PROGRAM_ID,
  pumpswapProgramId: PUMPSWAP_PROGRAM_ID,
  usdcMint: USDC_MINT,
  api: PUMPDEV_API,
};

/**
 * Trade via PumpDev Lightning API — one-call buy/sell.
 * Server-side signing via desk wallet.
 */
export async function tradeViaLightning({ mint, side, amountSol, amountTokens, slippageBps = 500, walletAddress, chain = "solana" }) {
  if (!mint) throw new Error("mint required");
  if (side === "buy" && !amountSol) throw new Error("amountSol required for buy");
  if (side === "sell" && !amountTokens) throw new Error("amountTokens required for sell");

  // Lightning API keys — separate for Solana and Robinhood Chain
  const isRh = chain === "robinhood" || chain === "rh";
  const apiKey = isRh
    ? (process.env.PUMPDEV_LIGHTNING_RH || "")
    : (process.env.PUMPDEV_LIGHTNING_SOL || process.env.PUMPDEV_API_KEY || "");
  const apiUrl = isRh ? "https://rhc.pumpdev.io/api" : PUMPDEV_API;

  if (!apiKey) {
    throw new Error(`Lightning API key not configured for ${isRh ? "Robinhood" : "Solana"}.`);
  }

  const body = {
    action: side,  // "buy" or "sell"
    mint,
    amount: side === "buy" ? amountSol : amountTokens,
    slippageBps,
    wallet: walletAddress,
    apiKey,
  };

  const res = await fetch(`${apiUrl}/trade-lightning`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Lightning trade failed: ${res.status} ${err.slice(0, 200)}`);
  }

  const data = await res.json().catch(() => ({}));
  return {
    signature: data.signature || data.txSignature || null,
    mint,
    side,
    amount: side === "buy" ? amountSol : amountTokens,
  };
}
