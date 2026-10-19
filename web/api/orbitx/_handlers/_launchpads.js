/**
 * Multi-launchpad integration for OrbitX Launchpad MCP.
 *
 * Launchpads:
 * - pump: pump.fun (Solana) — SOL/USDC pairs
 * - stonk: StonkFun (Solana) — stock-paired (SPYx, NVDAX, etc.)
 * - pons: Pons V2 (Robinhood Chain) — ETH pairs
 *
 * Chains:
 * - solana: Solana desk wallet
 * - robinhood: Robinhood Chain (EVM) wallet
 */

// ---------------------------------------------------------------------------
// Launchpad configs
// ---------------------------------------------------------------------------

export const LAUNCHPADS = {
  pump: {
    name: "pump.fun",
    chain: "solana",
    pairs: ["sol", "usdc"],
    programId: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
    url: "https://pump.fun",
  },
  stonk: {
    name: "StonkFun",
    chain: "solana",
    pairs: ["spyx", "nvdax", "sol", "usdc"], // Tokenized stocks + crypto
    // Built on Raydium LaunchLab
    url: "https://stonk.fun",
    quoteMints: {
      spyx: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", // S&P 500
      // NVDAX and others resolved at launch time
    },
  },
  pons: {
    name: "Pons V2",
    chain: "robinhood",
    pairs: ["eth", "usdc"],
    factory: "0x80a77001456bc986083678F9a112B1EC2Aa07281",
    url: "https://pons.fi",
  },
};

// ---------------------------------------------------------------------------
// Chain configs
// ---------------------------------------------------------------------------

export const CHAINS = {
  solana: {
    name: "Solana",
    native: "SOL",
    walletType: "solana",
    explorer: "https://solscan.io",
  },
  robinhood: {
    name: "Robinhood Chain",
    native: "ETH",
    walletType: "evm",
    chainId: 0, // Resolved at runtime
    explorer: "https://explorer.robinhood.com",
  },
};

/**
 * Get available launchpads for a chain.
 */
export function getLaunchpadsForChain(chain) {
  return Object.entries(LAUNCHPADS)
    .filter(([_, cfg]) => cfg.chain === chain)
    .map(([id, cfg]) => ({ id, ...cfg }));
}

/**
 * Get available pairs for a launchpad.
 */
export function getPairsForLaunchpad(launchpadId) {
  const lp = LAUNCHPADS[launchpadId];
  return lp ? lp.pairs : [];
}

/**
 * Route a launch to the correct handler based on launchpad.
 */
export async function routeLaunch(launchpadId, params, signer) {
  switch (launchpadId) {
    case "pump": {
      const { launchViaPump } = await import("./_pump-integration.js");
      return launchViaPump(params, signer);
    }
    case "stonk": {
      const { launchViaStonk } = await import("./_stonk-integration.js");
      return launchViaStonk(params, signer);
    }
    case "pons": {
      const { launchViaPons } = await import("./_pons-integration.js");
      return launchViaPons(params, signer);
    }
    default:
      throw new Error(`Unknown launchpad: ${launchpadId}`);
  }
}
