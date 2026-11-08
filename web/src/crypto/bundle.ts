/**
 * OrbitX bundle detection — client types + fetch helper.
 *
 * Pure clustering lives in `web/shared/bundle-analysis.js` (single source of
 * truth shared with the server route `web/api/_bundle.js`). This module adds
 * the TypeScript types, the client fetch helper, and the adapters that map a
 * BundleAnalysis onto the props of BundleVisual / DevWalletDNA.
 *
 * The heavy RPC work NEVER runs here — call `fetchBundleAnalysis(mint)` and
 * the server route does it. If the server answers `state: "unknown"` /
 * `"partial"`, show that state; never render a bundled % the server did not
 * compute.
 */
import {
  BUNDLE_WINDOW_MS,
  BUNDLE_RISK_STEPS,
  DEV_LINKED_STEPS,
  FUNDING_CHAIN_MAX_HOPS,
  WHALE_ALERT_MIN_USD,
  TAPE_MAX_TRADES,
  KNOWN_CEX_HOT_WALLETS,
  clusterByFundingSource,
  clusterByBuyWindow,
  mergeClusters,
  bundleRiskFor,
  summarizeBundleAnalysis,
  fundingEndpointKind,
  parseSolFundingHop,
  classifyDevOutcome,
  computeLiveRisk,
  convictionLabel,
  walletAgeLabel,
  slippageForSize,
  simulateDevSell,
  entryExitFor1Pct,
  detectWashTrading,
  detectChartPatterns,
  volatilityFromCandles,
  bundleDecayTrend,
  dangerScoreForOutcome,
  usdToDropPricePct,
} from "../../shared/bundle-analysis.js";

export {
  BUNDLE_WINDOW_MS,
  BUNDLE_RISK_STEPS,
  DEV_LINKED_STEPS,
  FUNDING_CHAIN_MAX_HOPS,
  WHALE_ALERT_MIN_USD,
  TAPE_MAX_TRADES,
  KNOWN_CEX_HOT_WALLETS,
  clusterByFundingSource,
  clusterByBuyWindow,
  mergeClusters,
  bundleRiskFor,
  summarizeBundleAnalysis,
  fundingEndpointKind,
  parseSolFundingHop,
  classifyDevOutcome,
  computeLiveRisk,
  convictionLabel,
  walletAgeLabel,
  slippageForSize,
  simulateDevSell,
  entryExitFor1Pct,
  detectWashTrading,
  detectChartPatterns,
  volatilityFromCandles,
  bundleDecayTrend,
  dangerScoreForOutcome,
  usdToDropPricePct,
};

export type BundleRisk = "none" | "low" | "medium" | "high" | "unknown";
export type BundleState = "complete" | "partial" | "unknown";
export type BundleClusterKind = "funding" | "window" | "funding+window";

export interface HolderTrace {
  address: string;
  tokenAccount: string | null;
  supplyPct: number | null;
  firstBuyAtMs: number | null;
  fundingSource: string | null;
  fundingChain: string[];
  traced: boolean;
  traceNote: string | null;
  devLinked: boolean;
  viaAmm: boolean;
}

export interface BundleClusterMember {
  address: string;
  supplyPct: number | null;
  firstBuyAtMs: number | null;
  fundingSource: string | null;
  devLinked: boolean;
}

export interface BundleCluster {
  id: string;
  kind: BundleClusterKind;
  fundingSource: string | null;
  fundingChain: string[];
  members: BundleClusterMember[];
  supplyPct: number;
  timeSpanSeconds: number | null;
  windowStartMs: number | null;
  windowEndMs: number | null;
  devLinked: boolean;
  sourceBehindOtherLaunches: boolean | null;
  sourceOtherLaunches: number | null;
  evidence: string;
}

export interface DevLinkedWallet {
  address: string;
  supplyPct: number | null;
  fundingSource: string | null;
  via: "creator" | "funded-by-creator";
}

/** Typed result of a bundle scan. Percentages are null when unknowable. */
export interface BundleAnalysis {
  mint: string;
  state: BundleState;
  reason: string | null;
  analyzedAt: string;
  holdersTotal: number;
  holdersAnalyzed: number;
  holdersTraced: number;
  holdersUntraced: number;
  untracedAddresses: string[];
  topHoldersSupplyPct: number | null;
  bundledSupplyPct: number | null;
  clusters: BundleCluster[];
  clusterCount: number;
  devLinkedPct: number | null;
  devLinkedWallets: DevLinkedWallet[];
  creator: string | null;
  mintAuthority: string | null;
  creatorKnown: boolean;
  risk: BundleRisk;
  fundingSources: string[];
  /** Per-holder traces (observed first buys + funding). Optional so older
   *  fixtures / callers that build a BundleAnalysis literal without a scan
   *  still typecheck; the server always populates it. */
  traces?: HolderTrace[];
}

/**
 * Fetch a bundle analysis from the server route. Server-side only RPC —
 * the client never touches Solana RPC directly for this.
 * Throws on network/HTTP failure; a successful response with
 * `state: "unknown"` is NOT an error — render the unknown state.
 */
export async function fetchBundleAnalysis(mint: string): Promise<BundleAnalysis> {
  const res = await fetch(`/api/ogdex/bundle?mint=${encodeURIComponent(mint)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Bundle scan failed (HTTP ${res.status})`);
  }
  const body = (await res.json()) as unknown;
  if (!body || typeof body !== "object" || (body as { ok?: unknown }).ok !== true) {
    throw new Error("Bundle scan returned an unexpected response");
  }
  return (body as { analysis: BundleAnalysis }).analysis;
}

// ── Team A (scanner v2): funding chain / dev history / same-dev / tape ───────
// All of these hit the same /api/ogdex/bundle route with ?action= — no new
// serverless function (Vercel Hobby 12-function cap). Every payload carries
// an explicit state ("complete" | "partial" | "unknown") + reason; a null
// field means "could not be observed", never "zero / clean".

/** One observed funding hop: `from` was funded by `to` in tx `sig`. */
export interface FundingHop {
  from: string;
  to: string;
  /** Transaction signature evidencing the hop. */
  sig: string;
  amountSol: number;
  /** Block time of the funding tx, ms epoch, null when unreadable. */
  at: number | null;
  /** True when the hop tx is the wallet's oldest observed transaction. */
  reachedGenesis: boolean;
}

export type FundingChainTerminalKind = "program" | "genesis" | "max-hops";

/** Multi-hop funding chain for one wallet (server walk, max 3 hops). */
export interface FundingChain {
  wallet: string;
  /** [wallet, hop-1 funder, hop-2 funder, ...] — every hop observed on-chain. */
  chain: string[];
  hops: FundingHop[];
  /** Where the walk stopped, null when it ended without a terminal. */
  terminal: { kind: FundingChainTerminalKind; label: string; program?: string } | null;
  state: "complete" | "partial" | "unknown";
  reason: string | null;
}

export type DevOutcome = "alive" | "dead" | "rugged" | "unknown";

/** One prior token launched from a source wallet, with its outcome. */
export interface DevHistoryToken {
  mint: string;
  name: string | null;
  /** "rugged" only on observed LP removal; otherwise "alive" / "dead" / "unknown". */
  outcome: DevOutcome;
  launchedAt: number | null;
  /** Human-readable evidence for the outcome, e.g. "LP removed — pair liquidity is $0". */
  evidence: string;
}

/** Dev history for one source wallet. */
export interface DevHistory {
  wallet: string;
  tokens: DevHistoryToken[];
  state: "complete" | "partial" | "unknown";
  reason: string | null;
  sources: { helius: boolean; pump: boolean };
}

/** Same-dev detector result. */
export interface SameDevResult {
  /** True when a dev wallet traces to a source behind a prior rugged token. */
  flagged: boolean;
  /** Source wallet behind the rugged prior, null when not flagged. */
  sourceWallet: string | null;
  /** The rugged priors (never includes the scanned mint itself). */
  priorTokens: Array<DevHistoryToken & { sourceWallet: string; viaWallet: string }>;
  state: "complete" | "partial" | "unknown";
  reason: string | null;
}

/** One observed swap on the token's deepest-liquidity pair. */
export interface TradeTapeEntry {
  /** Block time of the swap, ms epoch, null when unreadable. */
  time: number | null;
  priceUsd: number;
  sizeUsd: number;
  side: "buy" | "sell";
  /** Trader wallet (the tx fee payer). */
  wallet: string;
}

/** A tape trade at/above WHALE_ALERT_MIN_USD ($5,000). */
export interface WhaleAlert {
  wallet: string;
  amountUsd: number;
  side: "buy" | "sell";
  time: number | null;
}

/** Live risk score — recomputed from current intel, never frozen. */
export interface RiskLive {
  /** 0–100, higher = safer (same direction as the OG score). Null when there is no evidence at all. */
  score: number | null;
  updatedAt: string;
  /** Signed deductions from 100, each with a human label. Empty when clean/unknown. */
  factors: { label: string; points: number }[];
}

async function fetchBundleAction<T>(query: string, action: string): Promise<T> {
  const res = await fetch(`/api/ogdex/bundle?${query}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Bundle ${action} failed (HTTP ${res.status})`);
  }
  const body = (await res.json()) as unknown;
  if (!body || typeof body !== "object" || (body as { ok?: unknown }).ok !== true) {
    throw new Error(`Bundle ${action} returned an unexpected response`);
  }
  return body as T;
}

/** Walk a wallet's funding chain server-side (max 3 hops, 180s server cache). */
export async function fetchFundingChain(wallet: string): Promise<FundingChain> {
  return fetchBundleAction<FundingChain>(
    `action=chain&wallet=${encodeURIComponent(wallet)}`,
    "chain",
  );
}

/** Tokens a source wallet launched, with an outcome each. */
export async function fetchDevHistory(wallet: string): Promise<DevHistory> {
  return fetchBundleAction<DevHistory>(
    `action=dev-history&wallet=${encodeURIComponent(wallet)}`,
    "dev-history",
  );
}

/** Same-dev check for a mint: does its dev trace to a rugged prior? */
export async function fetchSameDev(mint: string): Promise<SameDevResult> {
  return fetchBundleAction<SameDevResult>(
    `action=same-dev&mint=${encodeURIComponent(mint)}`,
    "same-dev",
  );
}

/** Live trade tape + whale alerts for a mint. */
export async function fetchTradeTape(mint: string): Promise<{
  mint: string;
  pairAddress: string | null;
  priceUsd: number | null;
  tape: TradeTapeEntry[] | null;
  whaleAlerts: WhaleAlert[] | null;
  state: "complete" | "partial" | "unknown";
  reason: string | null;
}> {
  return fetchBundleAction(
    `action=tape&mint=${encodeURIComponent(mint)}`,
    "tape",
  );
}

/** Live risk score recomputed server-side from current intel. */
export async function fetchRiskLive(mint: string): Promise<RiskLive> {
  const body = await fetchBundleAction<{ riskLive: RiskLive }>(
    `action=risk-live&mint=${encodeURIComponent(mint)}`,
    "risk-live",
  );
  return body.riskLive;
}

// ── Team A wave 3 (B6): deep intel — one server call, each field null-safe ───

export interface ExitLiquiditySim {
  receivedUsd: number;
  slippagePct: number;
}

/** Exit liquidity (B6). Sell sims are REAL Jupiter lite quotes; drop
 *  thresholds come from real LP depth (CPAMM model). Any sim the server
 *  could not quote is null with `reason` — never a modelled guess. */
export interface ExitLiquidity {
  sell1Sol: ExitLiquiditySim | null;
  sell5Sol: ExitLiquiditySim | null;
  sell10PctSupply: ExitLiquiditySim | null;
  drop10PctUsd: number | null;
  drop25PctUsd: number | null;
  drop50PctUsd: number | null;
  model: string;
  reason: string | null;
}

export interface RugCheck {
  score: number | null;
  warnings: string[];
  reportUrl: string;
  source: "rugcheck";
  reason: string | null;
}

export interface Token2022Extension {
  name: string;
  risk: "low" | "medium" | "high";
  detail: string;
}

export interface Token2022Extensions {
  isToken2022: boolean | null;
  extensions: Token2022Extension[];
  reason: string | null;
}

export interface Volatility {
  volatilityPct24h: number | null;
  volatilityPct7d: number | null;
  source: string;
}

export interface ChartPattern {
  type: string;
  detectedAt: number | null;
  confidence: "high" | "medium" | "low";
  detail: string;
}

export interface LpDrain {
  lpUsdNow: number | null;
  lpUsd1hAgo: number | null;
  lpUsd24hAgo: number | null;
  dropPct: number | null;
  removed: boolean | null;
  lastCheckedAt: string;
  reason: string | null;
}

export interface DeepIntel {
  mint: string;
  exitLiquidity: ExitLiquidity | null;
  rugCheck: RugCheck | null;
  token2022Extensions: Token2022Extensions | null;
  volatility: Volatility | null;
  chartPatterns: ChartPattern[];
  lpDrain: LpDrain | null;
  checkedAt: string;
}

/** One call for all B6 server-computed intel (exitLiquidity, rugCheck,
 *  token2022, volatility, chartPatterns, lpDrain). */
export async function fetchDeepIntel(mint: string): Promise<DeepIntel> {
  const body = await fetchBundleAction<{ deepIntel: DeepIntel }>(
    `action=deep-intel&mint=${encodeURIComponent(mint)}`,
    "deep-intel",
  );
  return body.deepIntel;
}

export interface WalletAge {
  wallet: string;
  /** Oldest *sampled* signature block time, ms epoch. Null when the wallet
   *  has no observed transactions or the history was unreadable. */
  firstSeenAt: number | null;
  ageDays: number | null;
  label: "fresh" | "aged" | "unknown";
}

/** Wallet ages for up to 10 wallets (server walks oldest signatures). */
export async function fetchWalletAges(wallets: string[]): Promise<WalletAge[]> {
  const body = await fetchBundleAction<{ wallets: WalletAge[] }>(
    `action=wallet-ages&wallets=${encodeURIComponent(wallets.join(","))}`,
    "wallet-ages",
  );
  return body.wallets;
}

export interface HolderOverlapEntry {
  wallet: string;
  /** Null when this wallet's token accounts were unreadable. */
  otherHoldings: Array<{ mint: string; symbol: string | null; pctOfWallet: number | null }> | null;
}

/** Holder overlap for up to 5 wallets (server reads SPL token accounts). */
export async function fetchHolderOverlap(mint: string, wallets: string[]): Promise<HolderOverlapEntry[] | null> {
  const body = await fetchBundleAction<{ wallets: HolderOverlapEntry[]; reason?: string | null }>(
    `action=holder-overlap&mint=${encodeURIComponent(mint)}&wallets=${encodeURIComponent(wallets.join(","))}`,
    "holder-overlap",
  );
  return body.wallets;
}

export interface BundleDecay {
  snapshots: Array<{ at: number; bundledPct: number }>;
  trend: "growing" | "unwinding" | "flat" | "unknown";
}

/** Bundle decay: snapshots recorded by each fresh bundle scan on this
 *  server instance. < 2 snapshots → trend "unknown". */
export async function fetchBundleDecay(mint: string): Promise<BundleDecay> {
  const body = await fetchBundleAction<BundleDecay>(
    `action=bundle-decay&mint=${encodeURIComponent(mint)}`,
    "bundle-decay",
  );
  return { snapshots: body.snapshots ?? [], trend: body.trend ?? "unknown" };
}

/** Shape BundleVisual already accepts — map a live analysis onto it. */
export interface BundleVisualData {
  bundles: {
    id: string;
    wallets: { address: string; buyAmount: number; buyTime: string; pctOfSupply: number }[];
    totalPctOfSupply: number;
    timeSpanSeconds: number;
    detectedAt: string;
    riskLevel: "low" | "medium" | "high" | "critical";
    fundingSource: string | null;
  }[];
  totalBundlePct: number;
}

export function bundleToVisualData(analysis: BundleAnalysis | null | undefined): BundleVisualData {
  if (!analysis || analysis.bundledSupplyPct == null) {
    return { bundles: [], totalBundlePct: 0 };
  }
  const riskLevel = (c: BundleCluster): BundleVisualData["bundles"][number]["riskLevel"] => {
    if (c.devLinked || c.sourceBehindOtherLaunches) return "critical";
    if (c.supplyPct >= 15) return "high";
    if (c.supplyPct >= 5) return "medium";
    return "low";
  };
  return {
    totalBundlePct: analysis.bundledSupplyPct,
    bundles: analysis.clusters.map((c) => ({
      id: c.id,
      wallets: c.members.map((m) => ({
        address: m.address,
        buyAmount: 0,
        buyTime: m.firstBuyAtMs ? new Date(m.firstBuyAtMs).toISOString() : "",
        pctOfSupply: m.supplyPct ?? 0,
      })),
      totalPctOfSupply: c.supplyPct,
      timeSpanSeconds: c.timeSpanSeconds ?? 0,
      detectedAt: analysis.analyzedAt,
      riskLevel: riskLevel(c),
      fundingSource: c.fundingSource,
    })),
  };
}

/** Dev-link slice DevWalletDNA renders when a bundle scan has run. */
export interface BundleDevLink {
  devLinkedPct: number | null;
  devLinkedWallets: DevLinkedWallet[];
  creator: string | null;
  mintAuthority: string | null;
  creatorKnown: boolean;
  state: BundleState;
  reason: string | null;
}

export function analysisToDevLink(analysis: BundleAnalysis | null | undefined): BundleDevLink | null {
  if (!analysis) return null;
  return {
    devLinkedPct: analysis.devLinkedPct,
    devLinkedWallets: analysis.devLinkedWallets,
    creator: analysis.creator,
    mintAuthority: analysis.mintAuthority,
    creatorKnown: analysis.creatorKnown,
    state: analysis.state,
    reason: analysis.reason,
  };
}
