/**
 * OrbitX tokenomics — shared constants.
 *
 * Single source of truth for the official ORBITX utility backbone.
 * Prices are whole ORBITX tokens; the integrator/owner can tune them here
 * and every surface updates.
 */

/** Official ORBITX mint (same as the MCP burn-access wiring). */
export const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
export const ORBITX_SYMBOL = "ORBITX";

/** Supercomputer MCP endpoint — JSON-RPC tools/call, CORS-open, no session needed. */
export const SUPERCOMPUTER_MCP_URL = "https://www.orbitx.world/api/mcp";

/** localStorage keys (never secrets — the authCode is a scoped spend credential). */
export const BILLING_AUTHCODE_KEY = "orbitx.billing.authCode";
export const BILLING_LEDGER_KEY = "orbitx.billing.ledger.v1";
export const PRO_UNLOCK_KEY = "orbitx.billing.proUnlock.v1";
export const API_METER_KEY = "orbitx.billing.apiMeter.v1";
export const AUCTIONS_KEY = "orbitx.billing.auctions.v1";
export const THEME_LISTINGS_KEY = "orbitx.billing.themeListings.v1";

/**
 * Official price list — one entry per use-case.
 * "burn" = tokens destroyed via the desk-signed burn.
 * "hold" = minimum balance requirement (no spend).
 */
export const ORBITX_PRICES = {
  /** #1  Burn to boost a launch to the top of the launchpad. */
  launchBoost: 500,
  /** #2  Burn to pin a post to the top of the social feed (24h). */
  pinPost: 250,
  /** #3  Burn to unlock pro terminal features (30 days). */
  proTerminal: 1000,
  /** #4  Hold to enter gated alpha channels / trader rooms. */
  alphaGateHold: 10_000,
  /** #5  Burn per AgentPlus AI task (compute). */
  agentPlusTask: 10,
  /** #6a Burn to mint a verified badge. */
  verifiedBadge: 2500,
  /** #6b Burn to claim a vanity handle. */
  vanityHandle: 1000,
  /** #7  Minimum tip in ORBITX. */
  minTip: 1,
  /** #8  Minimum bounty posting. */
  minBounty: 100,
  /** #9  Burn to enter a trading competition. */
  competitionEntry: 100,
  /** #11 Burn to cast a governance vote. */
  vote: 1,
  /** #12a Burn to reserve a token ticker. */
  tickerReserve: 5000,
  /** #12b Burn to claim a custom profile URL. */
  profileUrl: 1000,
  /** #14 Burn per 1k API calls past the free tier. */
  apiPer1kCalls: 50,
  /** #16 NFT mint fee in ORBITX (auto-burned). */
  nftMintFee: 25,
  /** #17 Listing fee to sell a theme on the marketplace (burned). */
  themeListingFee: 100,
  /** #17 Platform cut of theme sales, burned. */
  themePlatformCutBps: 1000,
  /** #19 Burn to feature a project on the Builds board. */
  buildsFeature: 300,
} as const;

export type OrbitxPriceKey = keyof typeof ORBITX_PRICES;

/** Fee-discount tiers by ORBITX held (#10). */
export const FEE_DISCOUNT_TIERS = [
  { minHold: 100_000, bps: 2500 }, // 25% off
  { minHold: 25_000, bps: 1500 }, // 15% off
  { minHold: 5_000, bps: 1000 }, // 10% off
  { minHold: 1_000, bps: 500 }, // 5% off
] as const;

export function feeDiscountBpsFor(balance: number | null | undefined): number {
  const b = Number(balance || 0);
  for (const tier of FEE_DISCOUNT_TIERS) {
    if (b >= tier.minHold) return tier.bps;
  }
  return 0;
}

/** Spend reasons — namespaced so the ledger/audits stay readable. */
export const spendReason = {
  launchBoost: (mint: string) => `launchpad:boost:${mint}`,
  pinPost: (postId: string) => `social:pin:${postId}`,
  proTerminal: () => `terminal:pro-unlock`,
  agentPlusTask: (taskId: string) => `agentplus:task:${taskId}`,
  verifiedBadge: () => `profile:verified-badge`,
  vanityHandle: (handle: string) => `profile:vanity-handle:${handle}`,
  tip: (recipient: string) => `social:tip:${recipient}`,
  bounty: (bountyId: string) => `bounty:post:${bountyId}`,
  competition: (compId: string) => `competition:entry:${compId}`,
  vote: (proposalId: string, option: string) => `governance:vote:${proposalId}:${option}`,
  tickerReserve: (ticker: string) => `ticker:reserve:${ticker}`,
  profileUrl: (slug: string) => `profile:url:${slug}`,
  apiOverage: (keyId: string, units1k: number) => `api:overage:${keyId}:${units1k}k`,
  nftMint: (collection: string) => `nft:mint-fee:${collection}`,
  themeListing: (themeId: string) => `theme-market:list:${themeId}`,
  themeBuy: (themeId: string) => `theme-market:buy:${themeId}`,
  themePlatformCut: (themeId: string) => `theme-market:platform-cut:${themeId}`,
  buildsFeature: (projectId: string) => `builds:feature:${projectId}`,
  auctionBid: (auctionId: string) => `auction:bid:${auctionId}`,
  cityPremium: (itemId: string) => `city-bank:${itemId}`,
  referralReward: (pool: string) => `referral:reward:${pool}`,
} as const;

export function formatOrbitx(n: number): string {
  return `${Number(n || 0).toLocaleString()} ${ORBITX_SYMBOL}`;
}
