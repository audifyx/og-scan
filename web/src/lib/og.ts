// $OG SCANNER — API constants & helpers
// All keys here are user-provided free tier API keys, intentionally inlined.

export const JUPITER_API_KEY = "***REMOVED_JUPITER_KEY***";
export const BIRDEYE_API_KEY = "d0b0455f927647d6806ca6d5730746e5";
export const HELIUS_API_KEY = "***REMOVED_HELIUS_KEY***";
export const ALCHEMY_API_KEY = "***REMOVED_ALCHEMY_KEY***";
export const QUICKNODE_WSS = "wss://floral-few-frog.solana-mainnet.quiknode.pro/***REMOVED_QUICKNODE_TOKEN***/";

export const OGSCAN_SITE_URL = "https://ogscan.fun";
export const OGSCAN_X_URL = "https://x.com/ogscanfun";
export const OGSCAN_TECH_POST_URL = "https://x.com/i/status/2052413018563084370";
export const OGSCAN_BRAND_IMAGE = "/og-brand.jpg";

export const OGSCAN_DEV_WALLET = "CicbPxARTDrwQ4XcxWsn6SYeG4FMJHirS633cZUJeQDh";
export const OGSCAN_TOKEN_MINT = "EfnZmcFKMXofKA5V5ujvjqtSorvuQD2MzJPz3dxXpump";
export const SOLANA_CHAIN_ID = "solana";
export const FARTCOIN_CANONICAL_MINT = "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump";
export const DEXSCREENER_WEB_BASE = "https://dexscreener.com";
export const OGSCAN_DEXSCREENER_URL = `${DEXSCREENER_WEB_BASE}/${SOLANA_CHAIN_ID}/${OGSCAN_TOKEN_MINT}`;
export const OGSCAN_PUMPFUN_URL = `https://pump.fun/coin/${OGSCAN_TOKEN_MINT}`;

export const JUPITER_BASE = "https://lite-api.jup.ag";
export const BIRDEYE_BASE = "https://public-api.birdeye.so";
export const HELIUS_BASE = `https://api.helius.xyz/v0`;
export const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkYgGPhbNHnc1j7Na";
const STABLE_QUOTE_MINTS = new Set<string>([USDC_MINT, USDT_MINT]);
const STABLE_QUOTE_SYMBOLS = new Set<string>(["USDC", "USDT", "USDH", "USDS", "PYUSD"]);
// Default scan target is now the official live OG Scan token.
export const DEFAULT_OG_MINT = OGSCAN_TOKEN_MINT;
export const MIN_OGSCAN_LIQUIDITY_USD = 1_000;

// ── Canonical OG mints ──────────────────────────────────────────────────────
// These are the definitive TRUE OG mints for well-known Solana tickers.
// Keyed by the normalised ticker (no $, lowercase, leet-mapped) so any variant
// of the search string resolves to the same authoritative mint.
//
// Only add entries here when the mint address is publicly verified and
// indisputably the first/official token for that ticker.
const BONK_MINT   = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const WIF_MINT    = "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm";   // dogwifhat
const POPCAT_MINT = "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr";
// TRUMP / OFFICIAL TRUMP (Pump.fun launch Jan 2025)
const TRUMP_MINT  = "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN";

const CANONICAL_SOLANA_ORIGINS: Record<string, string> = {
  // fartcoin
  fartcoin:      FARTCOIN_CANONICAL_MINT,
  fart:          FARTCOIN_CANONICAL_MINT,
  // bonk
  bonk:          BONK_MINT,
  // wif / dogwifhat
  wif:           WIF_MINT,
  dogwifhat:     WIF_MINT,
  dogwifhatcoin: WIF_MINT,
  // popcat
  popcat:        POPCAT_MINT,
  // trump / official trump
  trump:         TRUMP_MINT,
  officialtrump: TRUMP_MINT,
};

const KNOWN_LP_PULLED_OR_SCAM_MINTS = new Set<string>([
  "5sNU6g1qVji5dEBnb6SWSX2Gu2rtDvvk7khKyujj6cuU",
]);

export const STORAGE_OG_MINT = "og_scanner.mint";

export type TokenCreationSource = "chain" | "pool" | "unknown";

export type TokenAuthorityIntel = {
  mintAuthority: string | null;
  freezeAuthority: string | null;
  mintAuthorityDisabled: boolean;
  freezeAuthorityDisabled: boolean;
  source: "helius" | "registry" | "unknown";
};

export type TokenTopHolder = {
  owner: string;
  tokenAccount: string;
  uiAmount: number;
  percent: number;
  label: string;
};

export type TokenCreatorFundingIntel = {
  creatorWallet: string | null;
  fundingWallet: string | null;
  creationSignature?: string;
  createdAt?: string;
  confidence: "high" | "medium" | "low";
  source: "helius" | "pump.fun" | "inferred" | "unknown";
};

export type TokenPumpFunIntel = {
  isPumpFun: boolean;
  creator?: string;
  bondingCurve?: string;
  associatedBondingCurve?: string;
  launchAt?: string;
  migrationAt?: string;
  migrationDurationHours?: number;
  complete?: boolean;
  sourceUrl?: string;
};

export type TokenDexPoolIntel = {
  dexId?: string;
  pairAddress?: string;
  url?: string;
  quoteSymbol?: string;
  quoteAddress?: string;
  liquidityUsd?: number;
  effectiveLiquidityUsd?: number;
  quoteLiquidityUsd?: number;
  marketCap?: number;
  fdv?: number;
  volume24h?: number;
  buys24h?: number;
  sells24h?: number;
  createdAt?: string;
  boostsActive?: number;
};

export type JupTokenInfo = {
  id: string;
  chainId?: string;
  name: string;
  symbol: string;
  icon?: string;
  decimals: number;
  usdPrice?: number;
  mcap?: number;
  fdv?: number;
  liquidity?: number;
  holderCount?: number;
  organicScore?: number;
  organicScoreLabel?: string;
  isVerified?: boolean;
  stats24h?: {
    priceChange?: number;
    buyVolume?: number;
    sellVolume?: number;
    numTraders?: number;
    numBuys?: number;
    numSells?: number;
  };
  stats1h?: { priceChange?: number };
  stats5m?: { priceChange?: number };
  audit?: { mintAuthorityDisabled?: boolean; freezeAuthorityDisabled?: boolean; topHoldersPercentage?: number };
  firstPool?: { createdAt?: string };
  onChainCreatedAt?: string;
  firstMintAt?: string;
  firstMintAuthorityWallet?: string | null;
  firstMintSource?: "helius" | "birdeye" | "pump.fun" | "dex" | "unknown";
  creationSource?: TokenCreationSource;
  ctLikes?: number;
  smartCtLikes?: number;
  allTimeHighUsd?: number;
  allTimeHighAt?: string;
  allTimeHighSource?: string;
  allTimeLowUsd?: number;
  allTimeLowAt?: string;
  allTimeLowSource?: string;
  allTimeHighMarketCap?: number;
  allTimeHighMarketCapAt?: string;
  allTimeLowMarketCap?: number;
  allTimeLowMarketCapAt?: string;
  migrationCreatedAt?: string;
  dexPaidAmount?: number;
  dexBoostAmount?: number;
  dexBoostTotalAmount?: number;
  dexBoostActive?: number;
  dexPaidOrderCount?: number;
  dexApprovedOrderCount?: number;
  dexProfilePaid?: boolean;
  dexCommunityTakeoverPaid?: boolean;
  dexAdsPaid?: boolean;
  dexFirstPaidAt?: string;
  dexLastPaidAt?: string;
  dexUrl?: string;
  pairAddress?: string;
  pairDexId?: string;
  reportedLiquidity?: number;
  effectiveLiquidityUsd?: number;
  quoteLiquidityUsd?: number;
  lpPulled?: boolean;
  lpPullReason?: string;
  heliusAuthorities?: TokenAuthorityIntel;
  topHolders?: TokenTopHolder[];
  topHoldersPercent?: number;
  whaleCount?: number;
  creatorFunding?: TokenCreatorFundingIntel;
  pumpFun?: TokenPumpFunIntel;
  allPools?: TokenDexPoolIntel[];
  poolCount?: number;
};

export type DexSearchPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  liquidity?: { usd?: number; base?: number; quote?: number };
  volume?: { m5?: number; h1?: number; h6?: number; h24?: number };
  txns?: {
    m5?: { buys?: number; sells?: number };
    h1?: { buys?: number; sells?: number };
    h6?: { buys?: number; sells?: number };
    h24?: { buys?: number; sells?: number };
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string };
  boosts?: { active?: number };
};

type DexSearchResponse = { pairs?: DexSearchPair[] | null };

export type DexScreenerChartTarget = {
  id: string;
  chainId?: string;
  dexUrl?: string;
  pairAddress?: string;
};

export function dexScreenerChartUrl(target: DexScreenerChartTarget): string {
  if (target.dexUrl?.includes("dexscreener.com")) return target.dexUrl;
  const chainId: string = (target.chainId ?? SOLANA_CHAIN_ID).toLowerCase();
  const address: string = target.pairAddress ?? target.id;
  return `${DEXSCREENER_WEB_BASE}/${encodeURIComponent(chainId)}/${encodeURIComponent(address)}`;
}

export function dexScreenerEmbedUrl(chartUrl: string): string {
  try {
    const url = new URL(chartUrl);
    url.searchParams.set("embed", "1");
    url.searchParams.set("theme", "dark");
    url.searchParams.set("trades", "0");
    url.searchParams.set("info", "0");
    return url.toString();
  } catch {
    const separator: string = chartUrl.includes("?") ? "&" : "?";
    return `${chartUrl}${separator}embed=1&theme=dark&trades=0&info=0`;
  }
}

export type DexBoostInfo = {
  chainId?: string;
  tokenAddress?: string;
  url?: string;
  amount?: number;
  totalAmount?: number;
};

export type DexPaidOrder = {
  type?: "tokenProfile" | "communityTakeover" | "tokenAd" | "trendingBarAd" | string;
  status?: "processing" | "cancelled" | "on-hold" | "approved" | "rejected" | string;
  paymentTimestamp?: number;
};

export type DexPaidOrderSummary = {
  orders: DexPaidOrder[];
  totalOrders: number;
  approvedOrders: number;
  profilePaid: boolean;
  communityTakeoverPaid: boolean;
  adsPaid: boolean;
  firstPaidAt?: string;
  lastPaidAt?: string;
};

type BirdeyeOverviewResponse = {
  success?: boolean;
  data?: Record<string, unknown> | null;
};

const DEFAULT_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
};

async function jget<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers: { ...DEFAULT_HEADERS, ...(headers ?? {}) } });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function jupSearchToken(query: string): Promise<JupTokenInfo[]> {
  if (!query.trim()) return [];
  const url = `${JUPITER_BASE}/tokens/v2/search?query=${encodeURIComponent(query)}`;
  return jget<JupTokenInfo[]>(url);
}

export async function jupGetTokens(mints: string[]): Promise<JupTokenInfo[]> {
  if (mints.length === 0) return [];
  const url = `${JUPITER_BASE}/tokens/v2/search?query=${encodeURIComponent(mints.join(","))}`;
  return jget<JupTokenInfo[]>(url);
}

export type JupInterval = "5m" | "1h" | "6h" | "24h";

export async function jupTrending(interval: JupInterval = "24h", limit = 10): Promise<JupTokenInfo[]> {
  const url = `${JUPITER_BASE}/tokens/v2/toptrending/${interval}?limit=${limit}`;
  return jget<JupTokenInfo[]>(url);
}

export async function jupTopTraded(interval: JupInterval = "24h", limit = 10): Promise<JupTokenInfo[]> {
  const url = `${JUPITER_BASE}/tokens/v2/toptraded/${interval}?limit=${limit}`;
  return jget<JupTokenInfo[]>(url);
}

export async function jupTopOrganic(interval: JupInterval = "24h", limit = 10): Promise<JupTokenInfo[]> {
  const url = `${JUPITER_BASE}/tokens/v2/toporganicscore/${interval}?limit=${limit}`;
  return jget<JupTokenInfo[]>(url);
}

const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF\u2060]/g;
const LEET_TABLE: Record<string, string> = {
  "0": "o",
  "1": "i",
  "2": "z",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "9": "g",
};

export function normalizeNarrativeText(value: string | undefined): string {
  const raw: string = value ?? "";
  return raw
    .normalize("NFKD")
    .replace(ZERO_WIDTH_RE, "")
    .toLowerCase()
    .replace(/[０-９]/g, (char: string): string => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[ａ-ｚ]/g, (char: string): string => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[0-9]/g, (char: string): string => LEET_TABLE[char] ?? char)
    .replace(/[^\p{Letter}\p{Number}]+/gu, "")
    .replace(/(.)\1{2,}/g, "$1");
}

function normalizeTickerSymbol(value: string | undefined): string {
  return normalizeNarrativeText((value ?? "").replace(/^\$+/, ""));
}

function isSolanaChainId(chainId: string | undefined): boolean {
  return (chainId ?? SOLANA_CHAIN_ID).toLowerCase() === SOLANA_CHAIN_ID;
}

function canonicalSolanaOriginMintForQuery(query: string): string | undefined {
  const clean: string = query.replace(/^\$/, "").trim();
  if (clean === FARTCOIN_CANONICAL_MINT) return FARTCOIN_CANONICAL_MINT;
  return CANONICAL_SOLANA_ORIGINS[normalizeTickerSymbol(clean)];
}

function isCanonicalSolanaOriginForQuery(token: Pick<JupTokenInfo, "id" | "chainId">, query: string): boolean {
  const canonicalMint: string | undefined = canonicalSolanaOriginMintForQuery(query);
  return Boolean(canonicalMint && token.id === canonicalMint && isSolanaChainId(token.chainId));
}

function isExactNameMatch(token: JupTokenInfo, searchName: string): boolean {
  const target = normalizeNarrativeText(searchName.replace(/^\$/, ""));
  const normalizedName = normalizeNarrativeText(token.name);
  const normalizedSymbol = normalizeNarrativeText(token.symbol);
  return normalizedName === target || normalizedSymbol === target;
}

function isScamOrDeadPool(token: JupTokenInfo): boolean {
  if (!token.id) return true;
  // LP-pulled check comes first — definitive indicator of a rug/scam
  if (hasPulledOrDeadLiquidity(token)) return true;
  const liq = tokenEffectiveLiquidityUsd(token);
  // Require at least $500 real liquidity (lowered from $5k so old OG tokens
  // with thin but real pools aren't wrongly excluded)
  if (liq <= 0) return true;
  if (liq < 500) return true;
  // Holder count check — real tokens have at least a handful of holders.
  // Skip the check when data is absent (holderCount === undefined) so we
  // don't accidentally discard tokens the API didn't enrich yet.
  const holders = token.holderCount;
  if (holders != null && holders < 5) return true;
  // Active mint/freeze authority is a genuine scam signal
  if (token.audit?.mintAuthorityDisabled === false) return true;
  if (token.audit?.freezeAuthorityDisabled === false) return true;
  // NOTE: We deliberately do NOT filter on 24h volume.
  // Many legitimate OG tokens have low daily volume but are still the true
  // first-ever mint.  Volume should be used as a secondary signal, not as a
  // hard gate for OG status.
  return false;
}

export function findOriginalOgToken(searchName: string, candidates: JupTokenInfo[]): JupTokenInfo | null {
  const canonicalMint: string | undefined = canonicalSolanaOriginMintForQuery(searchName);

  // Canonical mints are ALWAYS returned as the OG — we never let scam-checks
  // or liquidity gates override a hardcoded authoritative mint.  For example,
  // the real Fartcoin (9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump, launched
  // 2024) must win over any 2025 pump.fun token that happens to be liquid.
  if (canonicalMint) {
    const canonical = candidates.find((token) => token.id === canonicalMint);
    if (canonical) return canonical; // canonical always wins — no scam gate
  }

  // Otherwise find the true OG by on-chain age among exact-name matches.
  const cleanCandidates = candidates
    .filter((token) => isExactNameMatch(token, searchName))
    .filter((token) => !isScamOrDeadPool(token));

  const byMint = new Map<string, JupTokenInfo>();
  for (const token of cleanCandidates) {
    const existing = byMint.get(token.id);
    if (!existing) {
      byMint.set(token.id, token);
      continue;
    }
    if (tokenEffectiveLiquidityUsd(token) > tokenEffectiveLiquidityUsd(existing)) {
      byMint.set(token.id, token);
    }
  }

  const validTokens = Array.from(byMint.values());
  validTokens.sort((a, b) => {
    // Safe tokens rank above unsafe ones
    const aUnsafe = hasUnsafeTokenAuthority(a);
    const bUnsafe = hasUnsafeTokenAuthority(b);
    if (aUnsafe !== bUnsafe) return aUnsafe ? 1 : -1;

    // Primary sort: on-chain mint date (oldest = true OG)
    const aMint = tokenCreatedAtMs(a);
    const bMint = tokenCreatedAtMs(b);
    if (Number.isFinite(aMint) && Number.isFinite(bMint) && aMint !== bMint) return aMint - bMint;
    if (Number.isFinite(aMint) && !Number.isFinite(bMint)) return -1;
    if (!Number.isFinite(aMint) && Number.isFinite(bMint)) return 1;

    // Secondary sort: first pool date (oldest pool = first to trade)
    const aPool = tokenPoolCreatedAtMs(a);
    const bPool = tokenPoolCreatedAtMs(b);
    if (Number.isFinite(aPool) && Number.isFinite(bPool) && aPool !== bPool) return aPool - bPool;
    if (Number.isFinite(aPool)) return -1;
    if (Number.isFinite(bPool)) return 1;

    // Tiebreak: liquidity depth (deeper pool = more credible)
    return tokenEffectiveLiquidityUsd(b) - tokenEffectiveLiquidityUsd(a);
  });

  return validTokens[0] ?? null;
}

function isoToMs(rawCreatedAt: string | undefined): number {
  if (!rawCreatedAt) return Number.POSITIVE_INFINITY;
  const createdAtMs: number = new Date(rawCreatedAt).getTime();
  return Number.isFinite(createdAtMs) ? createdAtMs : Number.POSITIVE_INFINITY;
}

function tokenPoolCreatedAtMs(token: JupTokenInfo): number {
  const poolDates: number[] = [
    token.firstPool?.createdAt,
    ...(token.allPools?.map((pool) => pool.createdAt) ?? []),
  ]
    .map(isoToMs)
    .filter((value: number): boolean => Number.isFinite(value));
  return poolDates.length > 0 ? Math.min(...poolDates) : Number.POSITIVE_INFINITY;
}

function tokenCreatedAtMs(token: JupTokenInfo): number {
  return isoToMs(token.firstMintAt ?? token.onChainCreatedAt);
}

export function tokenOgCreatedAtMs(token: JupTokenInfo): number {
  return tokenCreatedAtMs(token);
}

export function tokenOgCreatedAtIso(token: JupTokenInfo): string | undefined {
  return Number.isFinite(tokenCreatedAtMs(token)) ? token.firstMintAt ?? token.onChainCreatedAt : undefined;
}

function createdAtIsoFromMs(createdAtMs: number): string | undefined {
  return Number.isFinite(createdAtMs) ? new Date(createdAtMs).toISOString() : undefined;
}

function mergeStats(
  primary: JupTokenInfo["stats24h"] | undefined,
  fallback: JupTokenInfo["stats24h"] | undefined,
): JupTokenInfo["stats24h"] | undefined {
  if (!primary && !fallback) return undefined;
  return {
    priceChange: primary?.priceChange ?? fallback?.priceChange,
    buyVolume: primary?.buyVolume ?? fallback?.buyVolume,
    sellVolume: primary?.sellVolume ?? fallback?.sellVolume,
    numTraders: primary?.numTraders ?? fallback?.numTraders,
    numBuys: primary?.numBuys ?? fallback?.numBuys,
    numSells: primary?.numSells ?? fallback?.numSells,
  };
}

function bestLiquidityUsd(...values: Array<number | undefined>): number | undefined {
  const finiteValues: number[] = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (finiteValues.length === 0) return undefined;
  return Math.max(...finiteValues);
}

function smallestLiquidityUsd(...values: Array<number | undefined>): number | undefined {
  const finiteValues: number[] = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (finiteValues.length === 0) return undefined;
  return Math.min(...finiteValues);
}

export function tokenEffectiveLiquidityUsd(token: Pick<JupTokenInfo, "liquidity" | "effectiveLiquidityUsd">): number {
  return token.effectiveLiquidityUsd ?? token.liquidity ?? 0;
}

function reliableHolderCount(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return value;
}

function whaleWalletCountFromHolderIntel(holderIntel: TokenHolderBundleIntel | undefined): number | undefined {
  if (!holderIntel) return undefined;
  return holderIntel.topHolders.filter((holder) => holder.percent >= 5).length;
}

function tokenReportedLiquidityUsd(token: Pick<JupTokenInfo, "liquidity" | "reportedLiquidity">): number {
  return token.reportedLiquidity ?? token.liquidity ?? 0;
}

export function hasPulledOrDeadLiquidity(token: Pick<JupTokenInfo, "liquidity" | "effectiveLiquidityUsd" | "reportedLiquidity" | "quoteLiquidityUsd" | "lpPulled" | "mcap" | "fdv"> & { id?: string }): boolean {
  if (token.id && KNOWN_LP_PULLED_OR_SCAM_MINTS.has(token.id)) return true;
  const effectiveLiquidity: number = tokenEffectiveLiquidityUsd(token);
  const reportedLiquidity: number = tokenReportedLiquidityUsd(token);
  const quoteLiquidity: number | undefined = token.quoteLiquidityUsd;
  const marketCap: number = token.mcap ?? token.fdv ?? 0;

  // Definitive: explicitly flagged as LP pulled and liquidity is gone
  if (token.lpPulled === true && effectiveLiquidity < MIN_OGSCAN_LIQUIDITY_USD) return true;

  // Definitive: quote-side liquidity is tiny despite high reported liquidity
  // (classic rug: reported liq includes a worthless base token)
  if (quoteLiquidity != null && quoteLiquidity < 500 && reportedLiquidity >= 10_000) return true;

  // Strong signal: reported liquidity is large but effective is almost zero —
  // the LP backing has been removed.
  if (effectiveLiquidity < MIN_OGSCAN_LIQUIDITY_USD && reportedLiquidity >= 50_000) return true;

  // REMOVED the "effectiveLiquidity < 1000 && marketCap >= 100_000" rule.
  // This rule incorrectly disqualifies legitimate older OG tokens that have a
  // very high market cap but a naturally thin pool — e.g. historical mints
  // that were never heavily traded.  A large MC with thin LP does NOT mean the
  // LP was pulled; it can simply mean the token is old and illiquid.

  return false;
}

export function hasMinimumOgScanLiquidity(token: Pick<JupTokenInfo, "liquidity" | "effectiveLiquidityUsd" | "reportedLiquidity" | "quoteLiquidityUsd" | "lpPulled" | "mcap" | "fdv">): boolean {
  return tokenEffectiveLiquidityUsd(token) >= MIN_OGSCAN_LIQUIDITY_USD && !hasPulledOrDeadLiquidity(token);
}

export function hasUnsafeTokenAuthority(token: Pick<JupTokenInfo, "audit">): boolean {
  const mintAuthorityStillOn: boolean = token.audit?.mintAuthorityDisabled === false;
  const freezeAuthorityStillOn: boolean = token.audit?.freezeAuthorityDisabled === false;
  return mintAuthorityStillOn || freezeAuthorityStillOn;
}

export function isTrustedOgScanCandidate(token: Pick<JupTokenInfo, "liquidity" | "effectiveLiquidityUsd" | "reportedLiquidity" | "quoteLiquidityUsd" | "lpPulled" | "mcap" | "fdv" | "audit">): boolean {
  return hasMinimumOgScanLiquidity(token) && !hasUnsafeTokenAuthority(token);
}

function mergeTokenCandidate(existing: JupTokenInfo, next: JupTokenInfo): JupTokenInfo {
  const existingPoolCreatedAt: number = tokenPoolCreatedAtMs(existing);
  const nextPoolCreatedAt: number = tokenPoolCreatedAtMs(next);
  const oldestPoolCreatedAt: number = Math.min(existingPoolCreatedAt, nextPoolCreatedAt);
  const oldestPoolCreatedAtIso: string | undefined = createdAtIsoFromMs(oldestPoolCreatedAt);
  const existingMintCreatedAt: number = tokenCreatedAtMs(existing);
  const nextMintCreatedAt: number = tokenCreatedAtMs(next);
  const oldestMintCreatedAt: number = Math.min(existingMintCreatedAt, nextMintCreatedAt);
  const oldestMintCreatedAtIso: string | undefined = createdAtIsoFromMs(oldestMintCreatedAt);

  const quoteLiquidity: number | undefined = smallestLiquidityUsd(existing.quoteLiquidityUsd, next.quoteLiquidityUsd);
  const hasQuoteBackedEvidence: boolean = quoteLiquidity != null || existing.lpPulled === true || next.lpPulled === true;
  const effectiveLiquidity: number | undefined = hasQuoteBackedEvidence
    ? smallestLiquidityUsd(existing.effectiveLiquidityUsd ?? existing.liquidity, next.effectiveLiquidityUsd ?? next.liquidity)
    : bestLiquidityUsd(existing.effectiveLiquidityUsd ?? existing.liquidity, next.effectiveLiquidityUsd ?? next.liquidity);
  const reportedLiquidity: number | undefined = bestLiquidityUsd(existing.reportedLiquidity ?? existing.liquidity, next.reportedLiquidity ?? next.liquidity);
  const liquidityMergeProbe: Pick<JupTokenInfo, "liquidity" | "effectiveLiquidityUsd" | "reportedLiquidity" | "quoteLiquidityUsd" | "lpPulled" | "mcap" | "fdv"> = {
    liquidity: effectiveLiquidity,
    effectiveLiquidityUsd: effectiveLiquidity,
    reportedLiquidity,
    quoteLiquidityUsd: quoteLiquidity,
    mcap: existing.mcap ?? next.mcap,
    fdv: existing.fdv ?? next.fdv,
  };
  const lpPulled: boolean = hasPulledOrDeadLiquidity(liquidityMergeProbe);

  return {
    ...existing,
    id: existing.id,
    chainId: existing.chainId ?? next.chainId,
    name: existing.name || next.name,
    symbol: existing.symbol || next.symbol,
    icon: existing.icon ?? next.icon,
    decimals: existing.decimals || next.decimals,
    usdPrice: existing.usdPrice ?? next.usdPrice,
    mcap: existing.mcap ?? next.mcap,
    fdv: existing.fdv ?? next.fdv,
    liquidity: effectiveLiquidity,
    reportedLiquidity,
    effectiveLiquidityUsd: effectiveLiquidity,
    quoteLiquidityUsd: quoteLiquidity,
    lpPulled,
    lpPullReason: lpPulled ? existing.lpPullReason ?? next.lpPullReason ?? "LP appears pulled or dead: reported MC/LP is not backed by enough quote-side liquidity." : undefined,
    holderCount: existing.holderCount ?? next.holderCount,
    organicScore: existing.organicScore ?? next.organicScore,
    organicScoreLabel: existing.organicScoreLabel ?? next.organicScoreLabel,
    isVerified: existing.isVerified ?? next.isVerified,
    stats24h: mergeStats(existing.stats24h, next.stats24h),
    stats1h: existing.stats1h ?? next.stats1h,
    stats5m: existing.stats5m ?? next.stats5m,
    audit: existing.audit ?? next.audit,
    firstPool: oldestPoolCreatedAtIso ? { createdAt: oldestPoolCreatedAtIso } : existing.firstPool ?? next.firstPool,
    onChainCreatedAt: oldestMintCreatedAtIso ?? existing.onChainCreatedAt ?? next.onChainCreatedAt,
    firstMintAt: oldestMintCreatedAtIso ?? existing.firstMintAt ?? next.firstMintAt,
    firstMintAuthorityWallet: existing.firstMintAuthorityWallet ?? next.firstMintAuthorityWallet,
    firstMintSource: oldestMintCreatedAtIso ? existing.firstMintSource ?? next.firstMintSource ?? "helius" : existing.firstMintSource ?? next.firstMintSource,
    creationSource: oldestMintCreatedAtIso ? "chain" : existing.creationSource ?? next.creationSource,
    ctLikes: existing.ctLikes ?? next.ctLikes,
    smartCtLikes: existing.smartCtLikes ?? next.smartCtLikes,
    allTimeHighUsd: existing.allTimeHighUsd ?? next.allTimeHighUsd,
    allTimeHighAt: existing.allTimeHighAt ?? next.allTimeHighAt,
    allTimeHighSource: existing.allTimeHighSource ?? next.allTimeHighSource,
    allTimeLowUsd: existing.allTimeLowUsd ?? next.allTimeLowUsd,
    allTimeLowAt: existing.allTimeLowAt ?? next.allTimeLowAt,
    allTimeLowSource: existing.allTimeLowSource ?? next.allTimeLowSource,
    allTimeHighMarketCap: existing.allTimeHighMarketCap ?? next.allTimeHighMarketCap,
    allTimeHighMarketCapAt: existing.allTimeHighMarketCapAt ?? next.allTimeHighMarketCapAt,
    allTimeLowMarketCap: existing.allTimeLowMarketCap ?? next.allTimeLowMarketCap,
    allTimeLowMarketCapAt: existing.allTimeLowMarketCapAt ?? next.allTimeLowMarketCapAt,
    migrationCreatedAt: existing.migrationCreatedAt ?? next.migrationCreatedAt,
    dexPaidAmount: existing.dexPaidAmount ?? next.dexPaidAmount,
    dexBoostAmount: existing.dexBoostAmount ?? next.dexBoostAmount,
    dexBoostTotalAmount: existing.dexBoostTotalAmount ?? next.dexBoostTotalAmount,
    dexBoostActive: existing.dexBoostActive ?? next.dexBoostActive,
    dexPaidOrderCount: existing.dexPaidOrderCount ?? next.dexPaidOrderCount,
    dexApprovedOrderCount: existing.dexApprovedOrderCount ?? next.dexApprovedOrderCount,
    dexProfilePaid: existing.dexProfilePaid ?? next.dexProfilePaid,
    dexCommunityTakeoverPaid: existing.dexCommunityTakeoverPaid ?? next.dexCommunityTakeoverPaid,
    dexAdsPaid: existing.dexAdsPaid ?? next.dexAdsPaid,
    dexFirstPaidAt: existing.dexFirstPaidAt ?? next.dexFirstPaidAt,
    dexLastPaidAt: existing.dexLastPaidAt ?? next.dexLastPaidAt,
    dexUrl: existing.dexUrl ?? next.dexUrl,
    pairAddress: existing.pairAddress ?? next.pairAddress,
    pairDexId: existing.pairDexId ?? next.pairDexId,
    heliusAuthorities: existing.heliusAuthorities ?? next.heliusAuthorities,
    topHolders: existing.topHolders ?? next.topHolders,
    topHoldersPercent: existing.topHoldersPercent ?? next.topHoldersPercent,
    whaleCount: existing.whaleCount ?? next.whaleCount,
    creatorFunding: existing.creatorFunding ?? next.creatorFunding,
    pumpFun: existing.pumpFun ?? next.pumpFun,
    allPools: existing.allPools ?? next.allPools,
    poolCount: existing.poolCount ?? next.poolCount,
  };
}

async function dexSearchPairs(query: string): Promise<DexSearchPair[]> {
  const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
  const response = await jget<DexSearchResponse>(url);
  return (response.pairs ?? []).filter((pair) => isSolanaChainId(pair.chainId) && Boolean(pair.baseToken?.address));
}

async function dexSearchAllPairs(query: string): Promise<DexSearchPair[]> {
  const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
  const response = await jget<DexSearchResponse>(url);
  return (response.pairs ?? []).filter((pair) => isSolanaChainId(pair.chainId) && Boolean(pair.baseToken?.address));
}

function dexPairToToken(pair: DexSearchPair): JupTokenInfo | null {
  const mint: string | undefined = pair.baseToken?.address;
  if (!mint) return null;

  const price: number | undefined = pair.priceUsd ? Number(pair.priceUsd) : undefined;
  const buys24h: number = pair.txns?.h24?.buys ?? 0;
  const sells24h: number = pair.txns?.h24?.sells ?? 0;
  const totalTxns24h: number = buys24h + sells24h;
  const buyRatio: number = totalTxns24h > 0 ? buys24h / totalTxns24h : 0.5;
  const volume24h: number | undefined = pair.volume?.h24;
  const createdAt: string | undefined = pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : undefined;
  const reportedLiquidity: number | undefined = pair.liquidity?.usd;
  const quoteLiquidityUsd: number | undefined = pairQuoteLiquidityUsd(pair);
  const effectiveLiquidityUsd: number | undefined = pairEffectiveLiquidityUsd(pair);
  const lpPulled: boolean = isPairLpPulled(pair);

  return {
    id: mint,
    chainId: SOLANA_CHAIN_ID,
    name: pair.baseToken?.name ?? "Solana token",
    symbol: pair.baseToken?.symbol ?? "TOKEN",
    icon: pair.info?.imageUrl,
    decimals: 0,
    usdPrice: price != null && Number.isFinite(price) ? price : undefined,
    mcap: pair.marketCap,
    fdv: pair.fdv,
    liquidity: effectiveLiquidityUsd,
    reportedLiquidity,
    effectiveLiquidityUsd,
    quoteLiquidityUsd,
    lpPulled,
    lpPullReason: lpPulled ? `LP appears pulled/dead: ${fmtUsd(reportedLiquidity)} reported liquidity but only ${fmtUsd(quoteLiquidityUsd)} quote-side depth.` : undefined,
    stats24h: {
      priceChange: pair.priceChange?.h24,
      buyVolume: volume24h != null ? volume24h * buyRatio : undefined,
      sellVolume: volume24h != null ? volume24h * (1 - buyRatio) : undefined,
      numTraders: totalTxns24h || undefined,
      numBuys: buys24h || undefined,
      numSells: sells24h || undefined,
    },
    stats1h: { priceChange: pair.priceChange?.h1 },
    stats5m: { priceChange: pair.priceChange?.m5 },
    firstPool: createdAt ? { createdAt } : undefined,
    migrationCreatedAt: createdAt,
    dexBoostActive: pair.boosts?.active,
    dexUrl: pair.url,
    pairAddress: pair.pairAddress,
    pairDexId: pair.dexId,
  };
}

function mergeTokenCandidates(tokens: JupTokenInfo[]): JupTokenInfo[] {
  const byMint = new Map<string, JupTokenInfo>();
  for (const token of tokens) {
    const existing = byMint.get(token.id);
    byMint.set(token.id, existing ? mergeTokenCandidate(existing, token) : token);
  }
  return Array.from(byMint.values());
}

const dexBoostCache = new Map<string, Promise<Map<string, DexBoostInfo>>>();
const dexOrdersCache = new Map<string, Promise<DexPaidOrderSummary>>();
const birdeyeOverviewCache = new Map<string, Promise<Record<string, unknown> | null>>();
const geckoOhlcvCache = new Map<string, Promise<GeckoOhlcvCandle[]>>();
const heliusAuthorityCache = new Map<string, Promise<TokenAuthorityIntel | null>>();
const creatorFundingCache = new Map<string, Promise<TokenCreatorFundingIntel>>();
const pumpFunIntelCache = new Map<string, Promise<TokenPumpFunIntel | null>>();

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed: number = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function finiteIso(value: unknown): string | undefined {
  if (typeof value === "string") {
    const parsedMs: number = new Date(value).getTime();
    if (Number.isFinite(parsedMs)) return new Date(parsedMs).toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const ms: number = value > 10_000_000_000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  return undefined;
}

function pickFirstNumber(record: Record<string, unknown> | null, keys: string[]): number | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value: number | undefined = finiteNumber(record[key]);
    if (value != null) return value;
  }
  return undefined;
}

function pickFirstIso(record: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value: string | undefined = finiteIso(record[key]);
    if (value) return value;
  }
  return undefined;
}

function pairQuoteLiquidityUsd(pair: DexSearchPair): number | undefined {
  const quoteAmount: number | undefined = pair.liquidity?.quote;
  if (quoteAmount == null || !Number.isFinite(quoteAmount)) return undefined;

  const quoteMint: string | undefined = pair.quoteToken?.address;
  const quoteSymbol: string = (pair.quoteToken?.symbol ?? "").toUpperCase();
  if ((quoteMint && STABLE_QUOTE_MINTS.has(quoteMint)) || STABLE_QUOTE_SYMBOLS.has(quoteSymbol)) return quoteAmount;
  return undefined;
}

function pairEffectiveLiquidityUsd(pair: DexSearchPair): number | undefined {
  const reported: number | undefined = pair.liquidity?.usd;
  const quoteLiquidity: number | undefined = pairQuoteLiquidityUsd(pair);
  if (quoteLiquidity != null) {
    const quoteBackedLiquidity: number = quoteLiquidity * 2;
    return reported != null && Number.isFinite(reported) ? Math.min(reported, quoteBackedLiquidity) : quoteBackedLiquidity;
  }
  return reported;
}

function isPairLpPulled(pair: DexSearchPair): boolean {
  const reported: number = pair.liquidity?.usd ?? 0;
  const effective: number = pairEffectiveLiquidityUsd(pair) ?? 0;
  const quoteLiquidity: number | undefined = pairQuoteLiquidityUsd(pair);
  const marketCap: number = pair.marketCap ?? pair.fdv ?? 0;
  if (quoteLiquidity != null && quoteLiquidity < 500 && reported >= 10_000) return true;
  if (effective < MIN_OGSCAN_LIQUIDITY_USD && marketCap >= 100_000) return true;
  return false;
}

function bestPairByMint(pairs: DexSearchPair[]): Map<string, DexSearchPair> {
  const byMint = new Map<string, DexSearchPair>();
  for (const pair of pairs) {
    const mint: string | undefined = pair.baseToken?.address;
    if (!isSolanaChainId(pair.chainId) || !mint) continue;
    const currentScore: number = (pairEffectiveLiquidityUsd(pair) ?? 0) + (pair.volume?.h24 ?? 0) * 0.4;
    const previous: DexSearchPair | undefined = byMint.get(mint);
    const previousScore: number = previous ? (pairEffectiveLiquidityUsd(previous) ?? 0) + (previous.volume?.h24 ?? 0) * 0.4 : 0;
    if (!previous || currentScore >= previousScore) byMint.set(mint, pair);
  }
  return byMint;
}

function oldestCrediblePairByMint(pairs: DexSearchPair[]): Map<string, DexSearchPair> {
  const byMint = new Map<string, DexSearchPair>();
  for (const pair of pairs) {
    const mint: string | undefined = pair.baseToken?.address;
    const pairCreatedAt: number | undefined = pair.pairCreatedAt;
    if (!isSolanaChainId(pair.chainId) || !mint || pairCreatedAt == null || !Number.isFinite(pairCreatedAt)) continue;
    if (isPairLpPulled(pair)) continue;

    const previous: DexSearchPair | undefined = byMint.get(mint);
    const previousCreatedAt: number = previous?.pairCreatedAt ?? Number.POSITIVE_INFINITY;
    if (!previous || pairCreatedAt < previousCreatedAt) byMint.set(mint, pair);
  }
  return byMint;
}

export async function dexPairsForMints(mints: string[]): Promise<DexSearchPair[]> {
  const cleanMints: string[] = Array.from(new Set(mints.filter(Boolean))).slice(0, 60);
  if (cleanMints.length === 0) return [];

  const chunks: string[][] = [];
  for (let index = 0; index < cleanMints.length; index += 30) chunks.push(cleanMints.slice(index, index + 30));

  const responses = await Promise.allSettled(
    chunks.map((chunk) => jget<DexSearchPair[]>(`https://api.dexscreener.com/tokens/v1/${SOLANA_CHAIN_ID}/${chunk.join(",")}`))
  );

  return responses.flatMap((response) => (response.status === "fulfilled" ? response.value : []));
}

function dexPoolIntelFromPair(pair: DexSearchPair): TokenDexPoolIntel {
  return {
    dexId: pair.dexId,
    pairAddress: pair.pairAddress,
    url: pair.url,
    quoteSymbol: pair.quoteToken?.symbol,
    quoteAddress: pair.quoteToken?.address,
    liquidityUsd: pair.liquidity?.usd,
    effectiveLiquidityUsd: pairEffectiveLiquidityUsd(pair),
    quoteLiquidityUsd: pairQuoteLiquidityUsd(pair),
    marketCap: pair.marketCap,
    fdv: pair.fdv,
    volume24h: pair.volume?.h24,
    buys24h: pair.txns?.h24?.buys,
    sells24h: pair.txns?.h24?.sells,
    createdAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : undefined,
    boostsActive: pair.boosts?.active,
  };
}

function dexPoolsByMint(pairs: DexSearchPair[]): Map<string, TokenDexPoolIntel[]> {
  const byMint = new Map<string, TokenDexPoolIntel[]>();
  for (const pair of pairs) {
    const mint: string | undefined = pair.baseToken?.address;
    if (!mint || !isSolanaChainId(pair.chainId)) continue;
    const current = byMint.get(mint) ?? [];
    current.push(dexPoolIntelFromPair(pair));
    byMint.set(mint, current);
  }
  for (const [mint, pools] of byMint) {
    byMint.set(
      mint,
      pools.sort((a, b) => (b.effectiveLiquidityUsd ?? b.liquidityUsd ?? 0) - (a.effectiveLiquidityUsd ?? a.liquidityUsd ?? 0)),
    );
  }
  return byMint;
}

export async function dexBoostsByMint(): Promise<Map<string, DexBoostInfo>> {
  const cached = dexBoostCache.get(SOLANA_CHAIN_ID);
  if (cached) return cached;

  const task = (async (): Promise<Map<string, DexBoostInfo>> => {
    const endpoints: string[] = [
      "https://api.dexscreener.com/token-boosts/latest/v1",
      "https://api.dexscreener.com/token-boosts/top/v1",
    ];
    const responses = await Promise.allSettled(endpoints.map((endpoint) => jget<DexBoostInfo[]>(endpoint)));
    const byMint = new Map<string, DexBoostInfo>();

    for (const response of responses) {
      if (response.status !== "fulfilled") continue;
      for (const boost of response.value) {
        if (!isSolanaChainId(boost.chainId) || !boost.tokenAddress) continue;
        const previous: DexBoostInfo | undefined = byMint.get(boost.tokenAddress);
        const previousPaid: number = previous?.totalAmount ?? previous?.amount ?? 0;
        const nextPaid: number = boost.totalAmount ?? boost.amount ?? 0;
        if (!previous || nextPaid >= previousPaid) byMint.set(boost.tokenAddress, boost);
      }
    }

    return byMint;
  })();

  dexBoostCache.set(SOLANA_CHAIN_ID, task);
  return task;
}

function summarizeDexPaidOrders(orders: DexPaidOrder[]): DexPaidOrderSummary {
  const approved = orders.filter((order) => order.status === "approved" || order.status === "processing" || order.status === "on-hold");
  const paidTimes: string[] = approved
    .map((order) => finiteIso(order.paymentTimestamp))
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  return {
    orders,
    totalOrders: orders.length,
    approvedOrders: approved.length,
    profilePaid: approved.some((order) => order.type === "tokenProfile"),
    communityTakeoverPaid: approved.some((order) => order.type === "communityTakeover"),
    adsPaid: approved.some((order) => order.type === "tokenAd" || order.type === "trendingBarAd"),
    firstPaidAt: paidTimes[0],
    lastPaidAt: paidTimes[paidTimes.length - 1],
  };
}

export async function dexPaidOrdersForToken(chainId: string, tokenAddress: string): Promise<DexPaidOrderSummary> {
  const cleanChainId: string = chainId || SOLANA_CHAIN_ID;
  const cacheKey = `${cleanChainId}:${tokenAddress}`;
  const cached = dexOrdersCache.get(cacheKey);
  if (cached) return cached;

  const task = (async (): Promise<DexPaidOrderSummary> => {
    try {
      const url = `https://api.dexscreener.com/orders/v1/${encodeURIComponent(cleanChainId)}/${encodeURIComponent(tokenAddress)}`;
      const orders = await jget<DexPaidOrder[]>(url);
      return summarizeDexPaidOrders(Array.isArray(orders) ? orders : []);
    } catch {
      return summarizeDexPaidOrders([]);
    }
  })();

  dexOrdersCache.set(cacheKey, task);
  return task;
}

async function birdeyeTokenOverview(mint: string): Promise<Record<string, unknown> | null> {
  const cached = birdeyeOverviewCache.get(mint);
  if (cached) return cached;

  const task = (async (): Promise<Record<string, unknown> | null> => {
    try {
      const url = `${BIRDEYE_BASE}/defi/token_overview?address=${encodeURIComponent(mint)}`;
      const response = await jget<BirdeyeOverviewResponse>(url, {
        "X-API-KEY": BIRDEYE_API_KEY,
        "x-chain": SOLANA_CHAIN_ID,
      });
      return response.data ?? null;
    } catch {
      return null;
    }
  })();

  birdeyeOverviewCache.set(mint, task);
  return task;
}

function birdeyeMarketPatch(overview: Record<string, unknown> | null): Pick<JupTokenInfo, "usdPrice" | "liquidity" | "effectiveLiquidityUsd" | "holderCount" | "mcap" | "fdv"> {
  return {
    usdPrice: pickFirstNumber(overview, ["price", "priceUsd", "value", "currentPrice"]),
    liquidity: pickFirstNumber(overview, ["liquidity", "liquidityUsd", "liquidityUSD", "liquidity_usd"]),
    effectiveLiquidityUsd: pickFirstNumber(overview, ["liquidity", "liquidityUsd", "liquidityUSD", "liquidity_usd"]),
    holderCount: pickFirstNumber(overview, ["holder", "holders", "holderCount", "numberHolders", "uniqueWallets"]),
    mcap: pickFirstNumber(overview, ["mc", "marketCap", "market_cap", "marketcap"]),
    fdv: pickFirstNumber(overview, ["fdv", "fullyDilutedValuation", "fully_diluted_valuation"]),
  };
}

type PriceExtreme = { price?: number; at?: string; source?: string };

type GeckoOhlcvCandle = { unixTime: number; o: number; h: number; l: number; c: number; v: number };

type GeckoOhlcvResponse = {
  data?: {
    attributes?: {
      ohlcv_list?: unknown[];
    };
  };
};

type PriceExtremes = { ath: PriceExtreme; atl: PriceExtreme };

function athFromOverview(overview: Record<string, unknown> | null): PriceExtreme {
  const price: number | undefined = pickFirstNumber(overview, [
      "ath",
      "athPrice",
      "priceAth",
      "priceATH",
      "allTimeHigh",
      "allTimeHighPrice",
      "highestPrice",
      "priceHighest",
      "maxPrice",
    ]);
  return {
    price,
    source: price != null ? "Birdeye overview" : undefined,
    at: pickFirstIso(overview, [
      "athTime",
      "athAt",
      "athDate",
      "priceAthTime",
      "priceATHTime",
      "allTimeHighAt",
      "allTimeHighTime",
      "highestPriceTime",
      "maxPriceTime",
    ]),
  };
}

function atlFromOverview(overview: Record<string, unknown> | null): PriceExtreme {
  const price: number | undefined = pickFirstNumber(overview, [
      "atl",
      "atlPrice",
      "priceAtl",
      "priceATL",
      "allTimeLow",
      "allTimeLowPrice",
      "lowestPrice",
      "priceLowest",
      "minPrice",
    ]);
  return {
    price,
    source: price != null ? "Birdeye overview" : undefined,
    at: pickFirstIso(overview, [
      "atlTime",
      "atlAt",
      "atlDate",
      "priceAtlTime",
      "priceATLTime",
      "allTimeLowAt",
      "allTimeLowTime",
      "lowestPriceTime",
      "minPriceTime",
    ]),
  };
}

async function priceExtremesFromOhlcv(mint: string, fromIso: string | undefined): Promise<PriceExtremes> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const fromMs: number = fromIso ? new Date(fromIso).getTime() : Date.now() - 365 * 86_400_000;
    const from = Number.isFinite(fromMs) ? Math.max(0, Math.floor(fromMs / 1000)) : now - 365 * 86_400;
    const candles = await birdeyeOhlcv(mint, "1D", from, now);
    const extremes = candles.reduce<{ high: { price: number; unixTime: number } | null; low: { price: number; unixTime: number } | null }>(
      (current, candle) => {
        const high: number = candle.h;
        const low: number = candle.l;
        if (Number.isFinite(high) && (!current.high || high > current.high.price)) current.high = { price: high, unixTime: candle.unixTime };
        if (Number.isFinite(low) && low > 0 && (!current.low || low < current.low.price)) current.low = { price: low, unixTime: candle.unixTime };
        return current;
      },
      { high: null, low: null },
    );
    return {
      ath: extremes.high ? { price: extremes.high.price, at: new Date(extremes.high.unixTime * 1000).toISOString(), source: "Birdeye OHLCV" } : {},
      atl: extremes.low ? { price: extremes.low.price, at: new Date(extremes.low.unixTime * 1000).toISOString(), source: "Birdeye OHLCV" } : {},
    };
  } catch {
    return { ath: {}, atl: {} };
  }
}

function parseGeckoCandle(raw: unknown): GeckoOhlcvCandle | null {
  if (!Array.isArray(raw) || raw.length < 6) return null;
  const [timestampRaw, openRaw, highRaw, lowRaw, closeRaw, volumeRaw] = raw;
  const unixTime: number | undefined = finiteNumber(timestampRaw);
  const o: number | undefined = finiteNumber(openRaw);
  const h: number | undefined = finiteNumber(highRaw);
  const l: number | undefined = finiteNumber(lowRaw);
  const c: number | undefined = finiteNumber(closeRaw);
  const v: number | undefined = finiteNumber(volumeRaw);
  if (unixTime == null || o == null || h == null || l == null || c == null || v == null) return null;
  const seconds: number = unixTime > 10_000_000_000 ? Math.floor(unixTime / 1000) : unixTime;
  return { unixTime: seconds, o, h, l, c, v };
}

async function geckoPoolDailyOhlcv(poolAddress: string, tokenAddress: string, maxPages = 4): Promise<GeckoOhlcvCandle[]> {
  const cacheKey = `${poolAddress}:${tokenAddress}:${maxPages}`;
  const cached = geckoOhlcvCache.get(cacheKey);
  if (cached) return cached;

  const task = (async (): Promise<GeckoOhlcvCandle[]> => {
    const byTimestamp = new Map<number, GeckoOhlcvCandle>();
    let beforeTimestamp: number | undefined;

    for (let page = 0; page < maxPages; page += 1) {
      const params = new URLSearchParams({ aggregate: "1", limit: "1000", currency: "usd", token: tokenAddress });
      if (beforeTimestamp != null) params.set("before_timestamp", String(beforeTimestamp));
      const url = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${encodeURIComponent(poolAddress)}/ohlcv/day?${params.toString()}`;
      const json = await jget<GeckoOhlcvResponse>(url);
      const pageCandles: GeckoOhlcvCandle[] = (json.data?.attributes?.ohlcv_list ?? [])
        .map(parseGeckoCandle)
        .filter((candle): candle is GeckoOhlcvCandle => Boolean(candle));

      if (pageCandles.length === 0) break;
      for (const candle of pageCandles) byTimestamp.set(candle.unixTime, candle);
      const oldest: number = Math.min(...pageCandles.map((candle) => candle.unixTime));
      if (!Number.isFinite(oldest) || oldest <= 0 || beforeTimestamp === oldest - 1) break;
      beforeTimestamp = oldest - 1;
    }

    return Array.from(byTimestamp.values());
  })().catch(() => []);

  geckoOhlcvCache.set(cacheKey, task);
  return task;
}

function mergePriceExtremes(extremes: PriceExtremes[]): PriceExtremes {
  const athCandidates: PriceExtreme[] = extremes.map((item) => item.ath).filter((item) => item.price != null && Number.isFinite(item.price));
  const atlCandidates: PriceExtreme[] = extremes.map((item) => item.atl).filter((item) => item.price != null && Number.isFinite(item.price) && item.price > 0);
  return {
    ath: athCandidates.sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0] ?? {},
    atl: atlCandidates.sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY))[0] ?? {},
  };
}

async function priceExtremesFromGeckoPools(mint: string, poolAddresses: string[]): Promise<PriceExtremes> {
  const uniquePools: string[] = Array.from(new Set(poolAddresses.filter(Boolean))).slice(0, 2);
  if (uniquePools.length === 0) return { ath: {}, atl: {} };

  const results = await Promise.allSettled(
    uniquePools.map(async (poolAddress): Promise<PriceExtremes> => {
      const candles: GeckoOhlcvCandle[] = await geckoPoolDailyOhlcv(poolAddress, mint);
      const extremes = candles.reduce<{ high: GeckoOhlcvCandle | null; low: GeckoOhlcvCandle | null }>(
        (current, candle) => {
          if (Number.isFinite(candle.h) && (!current.high || candle.h > current.high.h)) current.high = candle;
          if (Number.isFinite(candle.l) && candle.l > 0 && (!current.low || candle.l < current.low.l)) current.low = candle;
          return current;
        },
        { high: null, low: null },
      );
      return {
        ath: extremes.high ? { price: extremes.high.h, at: new Date(extremes.high.unixTime * 1000).toISOString(), source: "GeckoTerminal OHLCV" } : {},
        atl: extremes.low ? { price: extremes.low.l, at: new Date(extremes.low.unixTime * 1000).toISOString(), source: "GeckoTerminal OHLCV" } : {},
      };
    }),
  );

  return mergePriceExtremes(results.map((result) => (result.status === "fulfilled" ? result.value : { ath: {}, atl: {} })));
}

function estimateMarketCapAtPrice(price: number | undefined, currentPrice: number | undefined, currentMarketCap: number | undefined): number | undefined {
  if (price == null || currentPrice == null || currentMarketCap == null) return undefined;
  if (!Number.isFinite(price) || !Number.isFinite(currentPrice) || !Number.isFinite(currentMarketCap) || currentPrice <= 0 || currentMarketCap <= 0) return undefined;
  return (currentMarketCap / currentPrice) * price;
}

type TokenEnrichmentOptions = {
  includeAth?: boolean;
  maxAth?: number;
  maxDexHistory?: number;
  includeOnChainIntel?: boolean;
  maxOnChain?: number;
  maxBirdeye?: number;
};

export async function enrichTokensWithMarketIntel(
  tokens: JupTokenInfo[],
  options: TokenEnrichmentOptions = {},
): Promise<JupTokenInfo[]> {
  if (tokens.length === 0) return [];

  const mints: string[] = tokens
    .filter((token) => isSolanaChainId(token.chainId))
    .map((token) => token.id)
    .filter(Boolean);
  const [pairsResult, boostsResult] = await Promise.allSettled([dexPairsForMints(mints), dexBoostsByMint()]);
  const allPairs: DexSearchPair[] = pairsResult.status === "fulfilled" ? pairsResult.value : [];
  const pairByMint: Map<string, DexSearchPair> = bestPairByMint(allPairs);
  const oldestPairByMint: Map<string, DexSearchPair> = oldestCrediblePairByMint(allPairs);
  const poolsByMint: Map<string, TokenDexPoolIntel[]> = dexPoolsByMint(allPairs);
  const boostByMint: Map<string, DexBoostInfo> = boostsResult.status === "fulfilled" ? boostsResult.value : new Map<string, DexBoostInfo>();
  const maxAth: number = options.includeAth ? options.maxAth ?? tokens.length : 0;
  const maxDexHistory: number = options.includeAth ? options.maxDexHistory ?? Math.min(maxAth, 4) : 0;
  const maxBirdeye: number = Math.max(maxAth, options.maxBirdeye ?? Math.min(tokens.length, 24));
  const maxOnChain: number = options.includeOnChainIntel ? options.maxOnChain ?? Math.min(tokens.length, 24) : 0;
  const athMints = new Set<string>(tokens.slice(0, maxAth).map((token) => token.id));
  const dexHistoryMints = new Set<string>(tokens.slice(0, maxDexHistory).map((token) => token.id));
  const birdeyeMints = new Set<string>(tokens.slice(0, maxBirdeye).map((token) => token.id));
  const onChainMints = new Set<string>(tokens.slice(0, maxOnChain).map((token) => token.id));

  return mapWithConcurrency(tokens, 8, async (token) => {
    const isSolanaToken: boolean = isSolanaChainId(token.chainId);
    const pair: DexSearchPair | undefined = isSolanaToken ? pairByMint.get(token.id) : undefined;
    const oldestPair: DexSearchPair | undefined = isSolanaToken ? oldestPairByMint.get(token.id) : undefined;
    const pools: TokenDexPoolIntel[] = isSolanaToken ? poolsByMint.get(token.id) ?? [] : [];
    const boost: DexBoostInfo | undefined = boostByMint.get(token.id);
    const migrationCreatedAt: string | undefined = pair?.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : token.migrationCreatedAt ?? token.firstPool?.createdAt;
    const oldestPoolMs: number = Math.min(tokenPoolCreatedAtMs(token), oldestPair?.pairCreatedAt ?? Number.POSITIVE_INFINITY);
    const oldestPoolCreatedAt: string | undefined = createdAtIsoFromMs(oldestPoolMs);
    const orders: DexPaidOrderSummary | undefined = isSolanaToken ? await dexPaidOrdersForToken(SOLANA_CHAIN_ID, token.id) : undefined;
    const overview: Record<string, unknown> | null = isSolanaToken && birdeyeMints.has(token.id) ? await birdeyeTokenOverview(token.id) : null;
    const marketPatch = birdeyeMarketPatch(overview);
    const overviewAth: PriceExtreme = athFromOverview(overview);
    const overviewAtl: PriceExtreme = atlFromOverview(overview);
    const geckoPoolAddresses: string[] = [pair?.pairAddress, ...pools.map((pool) => pool.pairAddress)].filter((value): value is string => Boolean(value));
    const shouldLoadExtremesFromDexHistory: boolean = isSolanaToken && dexHistoryMints.has(token.id) && geckoPoolAddresses.length > 0 && (overviewAth.price == null || overviewAtl.price == null);
    const dexHistoryExtremes: PriceExtremes = shouldLoadExtremesFromDexHistory
      ? await priceExtremesFromGeckoPools(token.id, geckoPoolAddresses)
      : { ath: {}, atl: {} };
    const shouldLoadExtremesFromCandles: boolean = isSolanaToken && athMints.has(token.id) && ((overviewAth.price ?? dexHistoryExtremes.ath.price) == null || (overviewAtl.price ?? dexHistoryExtremes.atl.price) == null);
    const ohlcvExtremes: PriceExtremes = shouldLoadExtremesFromCandles
      ? await priceExtremesFromOhlcv(token.id, token.onChainCreatedAt ?? token.firstPool?.createdAt ?? migrationCreatedAt)
      : { ath: {}, atl: {} };
    const ath: PriceExtreme = overviewAth.price != null ? overviewAth : dexHistoryExtremes.ath.price != null ? dexHistoryExtremes.ath : ohlcvExtremes.ath;
    const atl: PriceExtreme = overviewAtl.price != null ? overviewAtl : dexHistoryExtremes.atl.price != null ? dexHistoryExtremes.atl : ohlcvExtremes.atl;
    const resolvedCurrentPrice: number | undefined = token.usdPrice ?? marketPatch.usdPrice ?? (pair?.priceUsd ? Number(pair.priceUsd) : undefined);
    const resolvedMarketCap: number | undefined = token.mcap ?? marketPatch.mcap ?? pair?.marketCap ?? token.fdv ?? marketPatch.fdv ?? pair?.fdv;
    const [authorityResult, holderResult, creatorFundingResult, pumpFunResult] = await Promise.allSettled([
      isSolanaToken && onChainMints.has(token.id) ? heliusTokenAuthorityIntel(token.id) : Promise.resolve(null),
      isSolanaToken && onChainMints.has(token.id) ? tokenHolderBundleIntel(token) : Promise.resolve(undefined),
      isSolanaToken && onChainMints.has(token.id) ? tokenCreatorFundingIntel(token.id) : Promise.resolve(undefined),
      isSolanaToken ? pumpFunTokenIntel(token.id, token.onChainCreatedAt, migrationCreatedAt) : Promise.resolve(null),
    ]);
    const authority: TokenAuthorityIntel | null = authorityResult.status === "fulfilled" ? authorityResult.value : null;
    const holderIntel: TokenHolderBundleIntel | undefined = holderResult.status === "fulfilled" ? holderResult.value : undefined;
    const creatorFunding: TokenCreatorFundingIntel | undefined = creatorFundingResult.status === "fulfilled" ? creatorFundingResult.value : undefined;
    const pumpFun: TokenPumpFunIntel | null = pumpFunResult.status === "fulfilled" ? pumpFunResult.value : null;
    const forcedLpBlocked: boolean = KNOWN_LP_PULLED_OR_SCAM_MINTS.has(token.id);
    const pairLpPulled: boolean = pair ? isPairLpPulled(pair) : false;
    const pairEffectiveLiquidity: number | undefined = pair ? pairEffectiveLiquidityUsd(pair) : undefined;
    const pairReportedLiquidity: number | undefined = pair?.liquidity?.usd;
    const lpPulled: boolean = forcedLpBlocked || pairLpPulled || hasPulledOrDeadLiquidity({ ...token, id: token.id, effectiveLiquidityUsd: pairEffectiveLiquidity ?? token.effectiveLiquidityUsd, reportedLiquidity: pairReportedLiquidity ?? token.reportedLiquidity });
    const authorityAudit = authority
      ? {
          ...token.audit,
          mintAuthorityDisabled: authority.mintAuthorityDisabled,
          freezeAuthorityDisabled: authority.freezeAuthorityDisabled,
          topHoldersPercentage: holderIntel?.top10Percent ?? token.audit?.topHoldersPercentage,
        }
      : holderIntel
        ? { ...token.audit, topHoldersPercentage: holderIntel.top10Percent }
        : token.audit;
    const resolvedHolderCount: number | undefined = reliableHolderCount(token.holderCount) ?? reliableHolderCount(marketPatch.holderCount);
    const resolvedWhaleCount: number | undefined = whaleWalletCountFromHolderIntel(holderIntel) ?? token.whaleCount;

    return {
      ...token,
      icon: token.icon ?? pair?.info?.imageUrl,
      usdPrice: resolvedCurrentPrice,
      mcap: token.mcap ?? marketPatch.mcap ?? pair?.marketCap,
      fdv: token.fdv ?? marketPatch.fdv ?? pair?.fdv,
      liquidity: pair ? pairEffectiveLiquidity ?? marketPatch.effectiveLiquidityUsd ?? token.effectiveLiquidityUsd ?? token.liquidity : marketPatch.effectiveLiquidityUsd ?? token.effectiveLiquidityUsd ?? token.liquidity,
      reportedLiquidity: bestLiquidityUsd(token.reportedLiquidity ?? token.liquidity, pairReportedLiquidity, marketPatch.liquidity),
      effectiveLiquidityUsd: pair ? pairEffectiveLiquidity ?? marketPatch.effectiveLiquidityUsd ?? token.effectiveLiquidityUsd ?? token.liquidity : marketPatch.effectiveLiquidityUsd ?? token.effectiveLiquidityUsd ?? token.liquidity,
      quoteLiquidityUsd: pairQuoteLiquidityUsd(pair ?? ({} as DexSearchPair)) ?? token.quoteLiquidityUsd,
      lpPulled,
      lpPullReason: forcedLpBlocked
        ? "Known LP-pulled/scam mint: blocked from TRUE OG selection even if it is first on-chain."
        : pairLpPulled
          ? `LP appears pulled/dead: ${fmtUsd(pairReportedLiquidity)} reported liquidity but only ${fmtUsd(pairQuoteLiquidityUsd(pair))} quote-side depth.`
          : token.lpPullReason,
      holderCount: resolvedHolderCount,
      audit: authorityAudit,
      firstPool: oldestPoolCreatedAt ? { createdAt: oldestPoolCreatedAt } : migrationCreatedAt ? { createdAt: migrationCreatedAt } : token.firstPool,
      firstMintAt: token.firstMintAt ?? token.onChainCreatedAt ?? pumpFun?.launchAt,
      firstMintAuthorityWallet: token.firstMintAuthorityWallet ?? creatorFunding?.creatorWallet ?? pumpFun?.creator ?? null,
      firstMintSource: token.firstMintSource ?? (token.onChainCreatedAt ? "helius" : pumpFun?.launchAt ? "pump.fun" : "unknown"),
      allTimeHighUsd: token.allTimeHighUsd ?? ath.price,
      allTimeHighAt: token.allTimeHighAt ?? ath.at,
      allTimeHighSource: token.allTimeHighSource ?? ath.source,
      allTimeLowUsd: token.allTimeLowUsd ?? atl.price,
      allTimeLowAt: token.allTimeLowAt ?? atl.at,
      allTimeLowSource: token.allTimeLowSource ?? atl.source,
      allTimeHighMarketCap: token.allTimeHighMarketCap ?? estimateMarketCapAtPrice(ath.price, resolvedCurrentPrice, resolvedMarketCap),
      allTimeHighMarketCapAt: token.allTimeHighMarketCapAt ?? ath.at,
      allTimeLowMarketCap: token.allTimeLowMarketCap ?? estimateMarketCapAtPrice(atl.price, resolvedCurrentPrice, resolvedMarketCap),
      allTimeLowMarketCapAt: token.allTimeLowMarketCapAt ?? atl.at,
      migrationCreatedAt: pumpFun?.migrationAt ?? migrationCreatedAt,
      dexPaidAmount: token.dexPaidAmount ?? boost?.totalAmount ?? boost?.amount,
      dexBoostAmount: token.dexBoostAmount ?? boost?.amount,
      dexBoostTotalAmount: token.dexBoostTotalAmount ?? boost?.totalAmount,
      dexBoostActive: token.dexBoostActive ?? pair?.boosts?.active,
      dexPaidOrderCount: token.dexPaidOrderCount ?? orders?.totalOrders,
      dexApprovedOrderCount: token.dexApprovedOrderCount ?? orders?.approvedOrders,
      dexProfilePaid: token.dexProfilePaid ?? orders?.profilePaid,
      dexCommunityTakeoverPaid: token.dexCommunityTakeoverPaid ?? orders?.communityTakeoverPaid,
      dexAdsPaid: token.dexAdsPaid ?? orders?.adsPaid,
      dexFirstPaidAt: token.dexFirstPaidAt ?? orders?.firstPaidAt,
      dexLastPaidAt: token.dexLastPaidAt ?? orders?.lastPaidAt,
      dexUrl: token.dexUrl ?? pair?.url ?? boost?.url,
      pairAddress: token.pairAddress ?? pair?.pairAddress,
      pairDexId: token.pairDexId ?? pair?.dexId,
      heliusAuthorities: authority ?? token.heliusAuthorities,
      topHolders: holderIntel?.topHolders ?? token.topHolders,
      topHoldersPercent: holderIntel?.top10Percent ?? token.topHoldersPercent,
      whaleCount: resolvedWhaleCount,
      creatorFunding: creatorFunding ?? token.creatorFunding,
      pumpFun: pumpFun ?? token.pumpFun,
      allPools: pools.length > 0 ? pools : token.allPools,
      poolCount: pools.length || token.poolCount,
    };
  });
}

export function tokenMigrationDateIso(token: JupTokenInfo): string | undefined {
  return token.migrationCreatedAt ?? token.firstPool?.createdAt;
}

export function tokenDexPaidLabel(
  token: Pick<JupTokenInfo, "dexPaidAmount" | "dexBoostAmount" | "dexBoostTotalAmount" | "dexBoostActive" | "dexApprovedOrderCount" | "dexProfilePaid" | "dexCommunityTakeoverPaid" | "dexAdsPaid">,
): string {
  const paid: number | undefined = token.dexPaidAmount ?? token.dexBoostTotalAmount ?? token.dexBoostAmount;
  if (paid != null && Number.isFinite(paid) && paid > 0) return `${fmtNum(paid)} boosts paid`;
  if ((token.dexBoostActive ?? 0) > 0) return `${fmtNum(token.dexBoostActive)} active boost`;
  if ((token.dexApprovedOrderCount ?? 0) > 0) return `${fmtNum(token.dexApprovedOrderCount)} DEX order`;
  if (token.dexCommunityTakeoverPaid) return "CTO paid";
  if (token.dexProfilePaid) return "profile paid";
  if (token.dexAdsPaid) return "ads paid";
  return "—";
}

export function shortDate(iso: string | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : "—";
}

type BirdeyeCreationResponse = {
  data?: {
    creationTime?: number | null;
    mintTime?: number | null;
  };
  success?: boolean;
};

type RpcSignatureInfo = { signature: string; blockTime?: number | null };
type RpcSignatureResponse = { result?: RpcSignatureInfo[]; error?: { message?: string } };

type RpcParsedMintAccount = {
  data?: {
    parsed?: {
      info?: {
        mintAuthority?: string | null;
        freezeAuthority?: string | null;
        decimals?: number;
        supply?: string;
      };
      type?: string;
    };
  };
};

type RpcAccountInfoResponse = { result?: { value?: RpcParsedMintAccount | null } };

const mintCreationCache = new Map<string, Promise<string | undefined>>();

function unixSecondsToIso(value: number | null | undefined): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return new Date(value * 1000).toISOString();
}

async function birdeyeMintCreatedAt(mint: string): Promise<string | undefined> {
  const url = `${BIRDEYE_BASE}/defi/token_creation_info?address=${encodeURIComponent(mint)}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": BIRDEYE_API_KEY,
      "x-chain": SOLANA_CHAIN_ID,
    },
  });
  if (!res.ok) return undefined;
  const json = (await res.json()) as BirdeyeCreationResponse;
  return unixSecondsToIso(json.data?.creationTime) ?? unixSecondsToIso(json.data?.mintTime);
}

async function heliusTokenAuthorityIntel(mint: string): Promise<TokenAuthorityIntel | null> {
  const cached = heliusAuthorityCache.get(mint);
  if (cached) return cached;

  const task = (async (): Promise<TokenAuthorityIntel | null> => {
    try {
      const res = await fetch(HELIUS_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "og-mint-authorities",
          method: "getAccountInfo",
          params: [mint, { encoding: "jsonParsed", commitment: "confirmed" }],
        }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as RpcAccountInfoResponse;
      const info = json.result?.value?.data?.parsed?.info;
      if (!info) return null;
      const mintAuthority: string | null = info.mintAuthority ?? null;
      const freezeAuthority: string | null = info.freezeAuthority ?? null;
      return {
        mintAuthority,
        freezeAuthority,
        mintAuthorityDisabled: mintAuthority == null,
        freezeAuthorityDisabled: freezeAuthority == null,
        source: "helius",
      };
    } catch {
      return null;
    }
  })();

  heliusAuthorityCache.set(mint, task);
  return task;
}

// Helius DAS getAsset — returns the mint's on-chain creation time directly,
// much faster than walking thousands of tx signatures.
type HeliusAssetResponse = {
  result?: {
    id?: string;
    created_at?: number | null;
    compression?: { created_at?: number | null };
  };
  error?: { message?: string };
};

async function heliusAssetMintCreatedAt(mint: string): Promise<string | undefined> {
  try {
    const res = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "og-get-asset",
        method: "getAsset",
        params: { id: mint },
      }),
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as HeliusAssetResponse;
    const r = json.result;
    if (!r) return undefined;
    const raw = r.created_at ?? r.compression?.created_at;
    return unixSecondsToIso(typeof raw === "number" ? raw : undefined);
  } catch {
    return undefined;
  }
}

async function heliusMintCreatedAt(mint: string): Promise<string | undefined> {
  // First try the fast DAS getAsset path — avoids walking thousands of sigs.
  try {
    const dasDate = await heliusAssetMintCreatedAt(mint);
    if (dasDate) return dasDate;
  } catch {
    /* fall through to signature scan */
  }

  // Fall back: walk getSignaturesForAddress.  Cap at 8 pages (8 000 sigs)
  // instead of 25 000 — popular tokens have hundreds of thousands of txs
  // and we'll never reach the creation sig that way anyway.  Birdeye already
  // ran first and we only land here as a last resort.
  const limit = 1000;
  let before: string | undefined;
  let oldestBlockTime: number | undefined;

  for (let page = 0; page < 8; page += 1) {
    const params = before ? [mint, { limit, before }] : [mint, { limit }];
    const res = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `og-mint-created-${page}`,
        method: "getSignaturesForAddress",
        params,
      }),
    });
    if (!res.ok) return undefined;

    const json = (await res.json()) as RpcSignatureResponse;
    const signatures: RpcSignatureInfo[] = json.result ?? [];
    if (signatures.length === 0) break;

    for (const signature of signatures) {
      if (typeof signature.blockTime === "number") {
        oldestBlockTime = Math.min(oldestBlockTime ?? signature.blockTime, signature.blockTime);
      }
    }

    const lastSignature: string | undefined = signatures[signatures.length - 1]?.signature;
    if (signatures.length < limit || !lastSignature) break;
    before = lastSignature;
  }

  return unixSecondsToIso(oldestBlockTime);
}

async function mintCreatedAt(mint: string): Promise<string | undefined> {
  const cached = mintCreationCache.get(mint);
  if (cached) return cached;

  const task = (async (): Promise<string | undefined> => {
    // Run Birdeye + Helius DAS in parallel — both are fast single-request calls.
    // Take the *earliest* valid result so we never accidentally use a recycled
    // or inaccurate later date.
    const [birdeyeResult, dasResult] = await Promise.allSettled([
      birdeyeMintCreatedAt(mint),
      heliusAssetMintCreatedAt(mint),
    ]);

    const dates: string[] = [
      birdeyeResult.status === "fulfilled" ? birdeyeResult.value : undefined,
      dasResult.status === "fulfilled" ? dasResult.value : undefined,
    ].filter((d): d is string => Boolean(d) && new Date(d!).getTime() > 0 && new Date(d!).getTime() <= Date.now());

    if (dates.length > 0) {
      // Return the earliest (oldest) confirmed date
      return dates.reduce((a, b) => (new Date(a).getTime() < new Date(b).getTime() ? a : b));
    }

    // Last resort: walk tx signatures
    return heliusMintCreatedAt(mint);
  })();

  mintCreationCache.set(mint, task);
  return task;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index]);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function withOnChainCreationDates(tokens: JupTokenInfo[]): Promise<JupTokenInfo[]> {
  return mapWithConcurrency(tokens, 8, async (token) => {
    const chainId: string = token.chainId ?? SOLANA_CHAIN_ID;
    if (!isSolanaChainId(chainId)) {
      return { ...token, firstMintAt: token.firstMintAt ?? token.onChainCreatedAt, firstMintAuthorityWallet: token.firstMintAuthorityWallet ?? null, firstMintSource: token.firstMintSource ?? "unknown", creationSource: token.firstPool?.createdAt ? "pool" : "unknown" };
    }
    if (Number.isFinite(tokenCreatedAtMs(token))) {
      const creatorFunding = token.creatorFunding ?? await tokenCreatorFundingIntel(token.id);
      return {
        ...token,
        chainId,
        firstMintAt: token.firstMintAt ?? token.onChainCreatedAt,
        firstMintAuthorityWallet: token.firstMintAuthorityWallet ?? creatorFunding.creatorWallet,
        firstMintSource: token.firstMintSource ?? "helius",
        creatorFunding,
        creationSource: "chain",
      };
    }

    try {
      const onChainCreatedAt = await mintCreatedAt(token.id);
      const creatorFunding = await tokenCreatorFundingIntel(token.id);
      return {
        ...token,
        chainId,
        onChainCreatedAt,
        firstMintAt: token.firstMintAt ?? onChainCreatedAt,
        firstMintAuthorityWallet: token.firstMintAuthorityWallet ?? creatorFunding.creatorWallet,
        firstMintSource: token.firstMintSource ?? (onChainCreatedAt ? "helius" : "unknown"),
        creatorFunding,
        creationSource: onChainCreatedAt ? "chain" : token.firstPool?.createdAt ? "pool" : "unknown",
      };
    } catch {
      return { ...token, chainId, firstMintAt: token.firstMintAt ?? token.onChainCreatedAt, firstMintAuthorityWallet: token.firstMintAuthorityWallet ?? token.creatorFunding?.creatorWallet ?? null, firstMintSource: token.firstMintSource ?? "unknown", creationSource: token.firstPool?.createdAt ? "pool" : "unknown" };
    }
  });
}

function compareByOnChainAgeOnly(a: JupTokenInfo, b: JupTokenInfo): number {
  const aCreatedAt: number = tokenCreatedAtMs(a);
  const bCreatedAt: number = tokenCreatedAtMs(b);

  if (Number.isFinite(aCreatedAt) && Number.isFinite(bCreatedAt)) return aCreatedAt - bCreatedAt;
  if (Number.isFinite(aCreatedAt)) return -1;
  if (Number.isFinite(bCreatedAt)) return 1;
  return normalizeTickerSymbol(a.symbol).localeCompare(normalizeTickerSymbol(b.symbol));
}

export type TokenPrimaryLabel =
  | "TRUE OG CTO"
  | "TRUE OG"
  | "MIGRATED OG"
  | "OG WITH REVIVAL ACTIVITY"
  | "REVIVED OFFICIAL"
  | "LEGACY OG"
  | "CONTESTED"
  | "LATER OFFICIAL"
  | "CTO"
  | "MIGRATION"
  | "MIGRATION CANDIDATE"
  | "REVIVAL"
  | "CLONE"
  | "COPYCAT"
  | "UNKNOWN";

export type ForensicLabel =
  | TokenPrimaryLabel
  | "AUTHENTIC"
  | "LIKELY CLONE"
  | "CLONE FARM"
  | "HIGH RISK"
  | "FAKE COMMUNITY TAKEOVER";

export type TokenLayeredClassification = {
  primary_label: TokenPrimaryLabel;
  secondary_labels: string[];
  confidence_scores: {
    origin_score: number;
    cto_score: number;
    migration_score: number;
    revival_score: number;
    clone_score: number;
    risk_score: number;
    true_og_probability: number;
    clone_probability: number;
    cto_probability: number;
    migration_probability: number;
    dominance_score: number;
    dominance_rank: number;
  };
  reasoning_summary: string;
  layers: {
    origin_identity: string;
    control_status: string;
    lifecycle_status: string;
  };
};

export type DominanceTier = "TRUE OG" | "REVIVED OFFICIAL" | "LEGACY OG" | "COPYCAT / CLONE" | "CONTESTED";

export type TokenForensicScores = {
  chainOriginScore: number;
  earliestLiquidityScore: number;
  firstTransactionScore: number;
  firstHolderDistribution: number;
  deployerAuthenticity: number;
  metadataStability: number;
  socialOriginAlignment: number;
  organicGrowthPattern: number;
  antiCloneConfidence: number;
  walletBehaviorScore: number;
  liquiditySurvivalScore: number;
  narrativeContinuityScore: number;
  originScore: number;
  ctoScore: number;
  migrationScore: number;
  revivalScore: number;
  cloneScore: number;
  riskScore: number;
  trueOgProbability: number;
  cloneProbability: number;
  manipulatedRelaunchProbability: number;
  ctoProbability: number;
  migrationProbability: number;
  artificialTrendProbability: number;
  officialVerificationScore: number;
  deployerTrustScore: number;
  cloneConfidenceScore: number;
  liquidityAuthenticityScore: number;
  dominanceScore: number;
  dominanceRank: number;
  dominanceTier: DominanceTier;
  marketCapRankScore: number;
  liquidityDepthPoolAgeScore: number;
  holderDistributionScore: number;
  socialNarrativeAdoptionScore: number;
  onChainActivityScore: number;
  creatorTeamStrengthScore: number;
  earliestMintBonusScore: number;
  isPrimaryToken: boolean;
  isFirstMintToken: boolean;
  primaryStatusNote: string;
  classification: TokenLayeredClassification;
  label: ForensicLabel;
  reasons: string[];
  warnings: string[];
  evidence: {
    chainId: string;
    normalizedTicker: string;
    narrativeFingerprintId: string;
    firstOnChainProof?: string;
    firstLiquidity?: string;
    earliestKnownEvent?: string;
    creationSource: TokenCreationSource;
    chronologicalRank: number;
    candidateCount: number;
    liquidityDelayHours?: number;
    firstMintAuthorityWallet?: string | null;
  };
};

export type ForensicTimelineEvent = {
  at: string;
  type: "mint" | "liquidity" | "trade" | "metadata" | "social" | "migration" | "candidate";
  tokenId: string;
  chainId: string;
  label: string;
  detail: string;
};

export type TokenLineageNode = {
  token: JupTokenInfo;
  relationship: "TRUE OG" | "early clone" | "migration" | "CTO" | "later official" | "revival" | "fake revival" | "community fork" | "exploit copy";
  score: number;
  createdAt?: string;
  liquidityAt?: string;
};

export type ForensicOgReport = {
  query: string;
  normalizedQuery: string;
  narrativeFingerprintId: string;
  generatedAt: string;
  og: JupTokenInfo | null;
  primaryToken: JupTokenInfo | null;
  firstMintToken: JupTokenInfo | null;
  contestedTokens: JupTokenInfo[];
  copycats: JupTokenInfo[];
  candidates: JupTokenInfo[];
  clusterAliases: string[];
  timeline: ForensicTimelineEvent[];
  familyTree: TokenLineageNode[];
  tokenScores: Record<string, TokenForensicScores>;
  summary: {
    candidateCount: number;
    chainCount: number;
    earliestProof?: string;
    earliestLiquidity?: string;
    cloneCount: number;
    migrationCount: number;
    highRiskCount: number;
    primaryStatus?: DominanceTier;
    primaryDominanceScore?: number;
    firstMintAuthorityWallet?: string | null;
  };
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function simpleHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function narrativeFingerprintId(value: string): string {
  const normalized: string = normalizeNarrativeText(value);
  return `OGN-${simpleHash(normalized || value).toUpperCase()}`;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const previous: number[] = Array.from({ length: b.length + 1 }, (_, index: number) => index);
  const current: number[] = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost: number = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }
  return previous[b.length];
}

function stringSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const maxLength: number = Math.max(a.length, b.length);
  return maxLength === 0 ? 1 : 1 - levenshteinDistance(a, b) / maxLength;
}

function tokenNarrativeSimilarity(token: JupTokenInfo, normalizedQuery: string): number {
  const symbol: string = normalizeTickerSymbol(token.symbol);
  const name: string = normalizeNarrativeText(token.name);
  if (!normalizedQuery) return 0;
  if (symbol === normalizedQuery) return 1;
  if (name === normalizedQuery) return 0.96;
  if (symbol.includes(normalizedQuery) || normalizedQuery.includes(symbol)) return 0.88;
  if (name.includes(normalizedQuery) || normalizedQuery.includes(name)) return 0.78;
  return Math.max(stringSimilarity(symbol, normalizedQuery), stringSimilarity(name, normalizedQuery) * 0.92);
}

function tokenKey(token: JupTokenInfo): string {
  return `${token.chainId ?? SOLANA_CHAIN_ID}:${token.id}`;
}

function mergeMultiChainTokenCandidates(tokens: JupTokenInfo[]): JupTokenInfo[] {
  const byKey = new Map<string, JupTokenInfo>();
  for (const token of tokens) {
    if (!isSolanaChainId(token.chainId)) continue;
    const chainId: string = SOLANA_CHAIN_ID;
    const existing: JupTokenInfo | undefined = byKey.get(`${chainId}:${token.id}`);
    byKey.set(`${chainId}:${token.id}`, existing ? mergeTokenCandidate(existing, { ...token, chainId }) : { ...token, chainId });
  }
  return Array.from(byKey.values());
}

function earliestCandidateEventMs(token: JupTokenInfo): number {
  const chainCreatedAt: number = tokenCreatedAtMs(token);
  const poolCreatedAt: number = tokenPoolCreatedAtMs(token);

  if (Number.isFinite(chainCreatedAt) && Number.isFinite(poolCreatedAt)) {
    const poolBeforeMintMs: number = chainCreatedAt - poolCreatedAt;
    const poolPredatesMintByMoreThanGrace: boolean = poolBeforeMintMs > 6 * 3_600_000;
    return poolPredatesMintByMoreThanGrace ? chainCreatedAt : Math.min(chainCreatedAt, poolCreatedAt);
  }

  if (Number.isFinite(chainCreatedAt)) return chainCreatedAt;
  if (Number.isFinite(poolCreatedAt)) return poolCreatedAt;
  return Number.POSITIVE_INFINITY;
}

function isoFromCandidateEvent(token: JupTokenInfo): string | undefined {
  return createdAtIsoFromMs(earliestCandidateEventMs(token));
}

function compareByOriginProofAndSafety(a: JupTokenInfo, b: JupTokenInfo): number {
  const aUnsafe: boolean = hasUnsafeTokenAuthority(a);
  const bUnsafe: boolean = hasUnsafeTokenAuthority(b);
  if (aUnsafe !== bUnsafe) return aUnsafe ? 1 : -1;

  const aOriginMs: number = earliestCandidateEventMs(a);
  const bOriginMs: number = earliestCandidateEventMs(b);
  if (Number.isFinite(aOriginMs) && Number.isFinite(bOriginMs) && aOriginMs !== bOriginMs) return aOriginMs - bOriginMs;
  if (Number.isFinite(aOriginMs)) return -1;
  if (Number.isFinite(bOriginMs)) return 1;

  const aVerified: boolean = a.isVerified === true;
  const bVerified: boolean = b.isVerified === true;
  if (aVerified !== bVerified) return aVerified ? -1 : 1;

  return normalizeTickerSymbol(a.symbol).localeCompare(normalizeTickerSymbol(b.symbol));
}

function scoreByEarliest(candidateMs: number, earliestMs: number, fallback = 25): number {
  if (!Number.isFinite(candidateMs) || !Number.isFinite(earliestMs)) return fallback;
  const delayDays: number = Math.max(0, (candidateMs - earliestMs) / 86_400_000);
  if (delayDays <= 0.02) return 100;
  if (delayDays <= 1) return 92;
  if (delayDays <= 7) return 78;
  if (delayDays <= 30) return 58;
  if (delayDays <= 180) return 35;
  return 16;
}

function scoreHolderDistribution(token: JupTokenInfo): number {
  const top: number | undefined = token.audit?.topHoldersPercentage;
  if (top == null) return 52;
  if (top <= 15) return 94;
  if (top <= 30) return 78;
  if (top <= 45) return 55;
  if (top <= 65) return 30;
  return 12;
}

function scoreLiquiditySurvival(token: JupTokenInfo): number {
  const poolMs: number = tokenPoolCreatedAtMs(token);
  const ageDays: number = Number.isFinite(poolMs) ? Math.max(0, (Date.now() - poolMs) / 86_400_000) : 0;
  const liq: number = tokenEffectiveLiquidityUsd(token);
  if (hasPulledOrDeadLiquidity(token)) return 4;
  if (ageDays > 180 && liq > 10_000) return 92;
  if (ageDays > 30 && liq > 2_500) return 76;
  if (ageDays > 7 && liq > 1_000) return 58;
  if (liq > 25_000) return 46;
  return 28;
}

function scoreOrganicGrowth(token: JupTokenInfo): number {
  const organic: number | undefined = token.organicScore;
  if (organic != null) return clampScore(organic * 10);
  const buys: number = token.stats24h?.numBuys ?? 0;
  const sells: number = token.stats24h?.numSells ?? 0;
  const total: number = buys + sells;
  if (total === 0) return 45;
  const balance: number = 1 - Math.abs(buys - sells) / total;
  return clampScore(40 + balance * 45 + Math.min(15, Math.log10(total + 1) * 7));
}

function scoreDeployerAuthenticity(token: JupTokenInfo): number {
  let score = 48;
  if (token.audit?.mintAuthorityDisabled) score += 18;
  if (token.audit?.freezeAuthorityDisabled) score += 14;
  if (token.isVerified) score += 8;
  if ((token.audit?.topHoldersPercentage ?? 0) > 55) score -= 18;
  return clampScore(score);
}

function scoreMetadataStability(token: JupTokenInfo, normalizedQuery: string): number {
  const similarity: number = tokenNarrativeSimilarity(token, normalizedQuery);
  let score: number = 35 + similarity * 55;
  if (token.icon) score += 6;
  if (token.name && token.symbol) score += 4;
  return clampScore(score);
}

function scoreSocialAlignment(token: JupTokenInfo, normalizedQuery: string): number {
  const similarity: number = tokenNarrativeSimilarity(token, normalizedQuery);
  let score: number = 34 + similarity * 42;
  if (token.isVerified) score += 8;
  if (token.dexUrl) score += 5;
  if (token.ctLikes || token.smartCtLikes) score += 6;
  return clampScore(score);
}

type DominanceProfile = {
  token: JupTokenInfo;
  key: string;
  dominanceScore: number;
  marketCapRankScore: number;
  liquidityDepthPoolAgeScore: number;
  holderDistributionScore: number;
  socialNarrativeAdoptionScore: number;
  onChainActivityScore: number;
  creatorTeamStrengthScore: number;
  earliestMintBonusScore: number;
};

function tokenMarketCapUsd(token: JupTokenInfo): number {
  return token.mcap ?? token.fdv ?? 0;
}

function relativeLogScore(value: number | undefined, maxValue: number): number {
  const safeValue: number = Math.max(0, value ?? 0);
  const safeMax: number = Math.max(0, maxValue);
  if (safeMax <= 0) return 35;
  return clampScore((Math.log10(safeValue + 1) / Math.log10(safeMax + 1)) * 100);
}

function poolAgeScore(token: JupTokenInfo): number {
  const poolMs: number = tokenPoolCreatedAtMs(token);
  if (!Number.isFinite(poolMs)) return 35;
  const ageDays: number = Math.max(0, (Date.now() - poolMs) / 86_400_000);
  if (ageDays >= 365) return 100;
  if (ageDays >= 180) return 88;
  if (ageDays >= 90) return 72;
  if (ageDays >= 30) return 55;
  if (ageDays >= 7) return 38;
  return 20;
}

function activityVolumeUsd(token: JupTokenInfo): number {
  return (token.stats24h?.buyVolume ?? 0) + (token.stats24h?.sellVolume ?? 0);
}

function creatorStrengthScore(token: JupTokenInfo, deployerTrustScore: number): number {
  let score: number = deployerTrustScore * 0.72;
  if (token.creatorFunding?.confidence === "high") score += 12;
  else if (token.creatorFunding?.confidence === "medium") score += 7;
  if (token.pumpFun?.creator) score += 6;
  if (token.isVerified) score += 5;
  return clampScore(score);
}

function buildDominanceProfiles(tokens: JupTokenInfo[], normalizedQuery: string, earliestChainMs: number): DominanceProfile[] {
  const maxMarketCap: number = Math.max(0, ...tokens.map(tokenMarketCapUsd));
  const maxLiquidity: number = Math.max(0, ...tokens.map(tokenEffectiveLiquidityUsd));
  const maxHolders: number = Math.max(0, ...tokens.map((token) => token.holderCount ?? 0));
  const maxActivity: number = Math.max(0, ...tokens.map((token) => activityVolumeUsd(token) + (token.stats24h?.numTraders ?? 0) * 50));

  return tokens.map((token): DominanceProfile => {
    const deployerTrustScore: number = clampScore(scoreDeployerAuthenticity(token) * 0.62 + scoreHolderDistribution(token) * 0.38);
    const marketCapRankScore: number = relativeLogScore(tokenMarketCapUsd(token), maxMarketCap);
    const liquidityDepthPoolAgeScore: number = clampScore(relativeLogScore(tokenEffectiveLiquidityUsd(token), maxLiquidity) * 0.68 + poolAgeScore(token) * 0.32);
    const holderDistributionScore: number = clampScore(relativeLogScore(token.holderCount, maxHolders) * 0.62 + scoreHolderDistribution(token) * 0.38);
    const socialNarrativeAdoptionScore: number = clampScore(scoreSocialAlignment(token, normalizedQuery) * 0.48 + scoreOrganicGrowth(token) * 0.28 + (token.isVerified ? 10 : 0) + Math.min(14, ((token.ctLikes ?? 0) + (token.smartCtLikes ?? 0) * 2) / 8));
    const onChainActivityScore: number = relativeLogScore(activityVolumeUsd(token) + (token.stats24h?.numTraders ?? 0) * 50, maxActivity);
    const creatorTeamStrengthScore: number = creatorStrengthScore(token, deployerTrustScore);
    const earliestMintBonusScore: number = scoreByEarliest(tokenCreatedAtMs(token), earliestChainMs, 45);
    const dominanceScore: number = clampScore(
      marketCapRankScore * 0.25 +
        liquidityDepthPoolAgeScore * 0.20 +
        holderDistributionScore * 0.15 +
        socialNarrativeAdoptionScore * 0.15 +
        onChainActivityScore * 0.10 +
        creatorTeamStrengthScore * 0.08 +
        earliestMintBonusScore * 0.07 -
        (hasPulledOrDeadLiquidity(token) ? 55 : 0) -
        (hasUnsafeTokenAuthority(token) ? 18 : 0),
    );

    return {
      token,
      key: tokenKey(token),
      dominanceScore,
      marketCapRankScore,
      liquidityDepthPoolAgeScore,
      holderDistributionScore,
      socialNarrativeAdoptionScore,
      onChainActivityScore,
      creatorTeamStrengthScore,
      earliestMintBonusScore,
    };
  });
}

function classifyRelationship(token: JupTokenInfo, scores: TokenForensicScores, isOg: boolean): TokenLineageNode["relationship"] {
  if (scores.classification.primary_label === "REVIVED OFFICIAL" || scores.classification.primary_label === "CONTESTED") return "later official";
  if (scores.classification.primary_label === "LEGACY OG") return "TRUE OG";
  if (isOg) return "TRUE OG";
  if (scores.classification.primary_label === "LATER OFFICIAL") return "later official";
  if (scores.migrationProbability >= 70 && scores.migrationScore >= 65) return "migration";
  if (scores.ctoProbability >= 60) return "CTO";
  if (scores.cloneConfidenceScore >= 78 && scores.manipulatedRelaunchProbability >= 58) return "fake revival";
  if (scores.cloneConfidenceScore >= 70) return "early clone";
  if (scores.trueOgProbability >= 58) return "community fork";
  return token.isVerified ? "revival" : "exploit copy";
}

type LayeredClassificationInput = {
  token: JupTokenInfo;
  isOg: boolean;
  sameContractContinued: boolean;
  originScore: number;
  ctoScore: number;
  migrationScore: number;
  revivalScore: number;
  cloneScore: number;
  riskScore: number;
  trueOgProbability: number;
  cloneProbability: number;
  ctoProbability: number;
  migrationProbability: number;
  deployerInactive: number;
  communityControlShift: number;
  deployerTrustScore: number;
  artificialTrendProbability: number;
  officialVerificationScore: number;
  isLaterOfficial: boolean;
  dominanceScore: number;
  dominanceRank: number;
  dominanceTier: DominanceTier;
  isPrimaryToken: boolean;
  isFirstMintToken: boolean;
  firstOnChainProof?: string;
  firstLiquidity?: string;
};

function uniqueLabels(labels: string[]): string[] {
  return Array.from(new Set(labels.filter((label) => label.trim().length > 0)));
}

function buildLayeredClassification(input: LayeredClassificationInput): TokenLayeredClassification {
  const {
    token,
    isOg,
    sameContractContinued,
    originScore,
    ctoScore,
    migrationScore,
    revivalScore,
    cloneScore,
    riskScore,
    trueOgProbability,
    cloneProbability,
    ctoProbability,
    migrationProbability,
    deployerInactive,
    communityControlShift,
    deployerTrustScore,
    artificialTrendProbability,
    officialVerificationScore,
    isLaterOfficial,
    dominanceScore,
    dominanceRank,
    dominanceTier,
    isPrimaryToken,
    isFirstMintToken,
    firstOnChainProof,
    firstLiquidity,
  } = input;

  let primary_label: TokenPrimaryLabel = "UNKNOWN";
  if (dominanceTier === "CONTESTED" && isPrimaryToken) {
    primary_label = "CONTESTED";
  } else if (isFirstMintToken && !isPrimaryToken) {
    primary_label = "LEGACY OG";
  } else if (isPrimaryToken && !isFirstMintToken && isLaterOfficial) {
    primary_label = "REVIVED OFFICIAL";
  } else if (isPrimaryToken && !isFirstMintToken && (cloneScore >= 82 || riskScore >= 72)) {
    primary_label = "CLONE";
  } else if (isPrimaryToken && !isFirstMintToken) {
    primary_label = "REVIVAL";
  } else if (isOg && originScore >= 75 && ctoScore >= 60 && sameContractContinued) {
    primary_label = "TRUE OG CTO";
  } else if (isOg && originScore >= 68) {
    primary_label = "TRUE OG";
  } else if (!isOg && migrationScore >= 72 && migrationProbability >= 70) {
    primary_label = "MIGRATED OG";
  } else if (!isOg && isLaterOfficial) {
    primary_label = "LATER OFFICIAL";
  } else if (isOg && originScore >= 68 && revivalScore >= 65) {
    primary_label = "OG WITH REVIVAL ACTIVITY";
  } else if (!isOg && cloneScore >= 70) {
    primary_label = "CLONE";
  } else if (!isOg && revivalScore >= 65 && migrationScore < 70) {
    primary_label = "REVIVAL";
  } else if (!isOg && ctoScore >= 60) {
    primary_label = "CTO";
  } else if (!isOg && migrationScore >= 60) {
    primary_label = "MIGRATION";
  } else if (!isOg && cloneScore >= 50) {
    primary_label = "COPYCAT";
  } else if (!isOg && migrationScore >= 55) {
    primary_label = "MIGRATION CANDIDATE";
  }

  const secondary: string[] = [];
  if (isPrimaryToken) secondary.push("Primary Token", `Dominance Rank #${dominanceRank}`);
  if (isFirstMintToken) secondary.push("First Mint", "Earliest Verified Origin");
  if (isOg) secondary.push("Original Contract");
  if (primary_label === "LEGACY OG") secondary.push("Surpassed By Dominance", "Still First On-Chain");
  if (primary_label === "REVIVED OFFICIAL") secondary.push("Later Dominant Token", "Not First Mint");
  if (dominanceTier === "CONTESTED") secondary.push("Contested Dominance");
  if (isLaterOfficial) secondary.push("Official/Verified Later Launch", "Not Original Mint");
  if (!isOg && cloneScore >= 50 && !isLaterOfficial) secondary.push("Later Copy", "No Origin Priority");
  if (!isOg && revivalScore >= 65) secondary.push("New Contract", "Recreated Narrative");
  if (sameContractContinued) secondary.push("Same CA Continued");
  if (ctoScore >= 60) secondary.push("Community Takeover");
  if (deployerInactive >= 60) secondary.push("Dev Abandoned");
  if (communityControlShift >= 60) secondary.push("Community Support Shift");
  if (officialVerificationScore >= 62 && !isOg) secondary.push("Official Status Context");
  if (migrationScore >= 72 && migrationProbability >= 70) secondary.push("Provable Migration", "Ecosystem Moved");
  if (migrationScore >= 55 && migrationScore < 72) secondary.push("Weak Migration Proof");
  if (revivalScore >= 65 && isOg) secondary.push("Revival Activity Around OG");
  if (riskScore >= 65) secondary.push("High Risk");
  if (artificialTrendProbability >= 60) secondary.push("Artificial Trend Risk");

  const origin_identity: string = isFirstMintToken && !isPrimaryToken
    ? "Legacy First Mint"
    : isPrimaryToken && !isFirstMintToken
      ? "Dominant Later Token"
      : isOg
        ? "Original Contract"
        : isLaterOfficial
      ? "Later Official/Verified Token"
      : revivalScore >= 65
        ? "New Contract for Older Narrative"
        : cloneScore >= 50
          ? "Later Copy"
          : "Unverified Origin";
  const control_status: string = ctoScore >= 60
    ? "Community / CTO Controlled"
    : deployerTrustScore >= 65
      ? "Original/Trusted Control Likely"
      : "Control Unknown or Weak";
  const lifecycle_status: string = dominanceTier === "CONTESTED"
    ? "Contested Primary Battle"
    : primary_label === "REVIVED OFFICIAL"
      ? "Revived / Upgraded Primary"
      : primary_label === "LEGACY OG"
        ? "Legacy Original Surpassed"
        : migrationScore >= 72 && migrationProbability >= 70
    ? "Migrated Ecosystem"
    : isLaterOfficial
      ? "Official/Verified Later Launch"
      : revivalScore >= 65
        ? "Revival Activity"
        : cloneScore >= 70
          ? "Clone Lifecycle"
          : isOg
            ? "Original Live Contract"
            : "Unresolved Lifecycle";

  const proofBits: string[] = [];
  if (firstOnChainProof) proofBits.push(`mint proof ${shortDate(firstOnChainProof)}`);
  if (firstLiquidity) proofBits.push(`first LP ${shortDate(firstLiquidity)}`);
  const statusSummary: string = primary_label === "REVIVED OFFICIAL"
    ? "later mint but now the dominant/primary version by market, liquidity, holder, social, and activity signals"
    : primary_label === "LEGACY OG"
      ? "earliest credible Solana mint, but currently surpassed by a stronger primary token"
      : primary_label === "CONTESTED"
        ? "multiple versions have similar dominance, so primary status is contested"
        : isOg
          ? "earliest credible Solana origin in this narrative cluster"
          : isLaterOfficial
            ? "official/verified context detected, but it is not the first credible Solana origin"
            : "not the earliest credible Solana origin in this narrative cluster";
  const reasoning_summary: string = `${primary_label}: ${statusSummary}. ${proofBits.join(" · ") || "historical proof still incomplete"}. Dominance ${dominanceScore}% (#${dominanceRank}), origin ${originScore}%, official ${officialVerificationScore}%, CTO ${ctoScore}%, migration ${migrationScore}%, revival ${revivalScore}%, clone ${cloneScore}%.`;

  return {
    primary_label,
    secondary_labels: uniqueLabels(secondary).slice(0, 8),
    confidence_scores: {
      origin_score: originScore,
      cto_score: ctoScore,
      migration_score: migrationScore,
      revival_score: revivalScore,
      clone_score: cloneScore,
      risk_score: riskScore,
      true_og_probability: trueOgProbability,
      clone_probability: cloneProbability,
      cto_probability: ctoProbability,
      migration_probability: migrationProbability,
      dominance_score: dominanceScore,
      dominance_rank: dominanceRank,
    },
    reasoning_summary,
    layers: { origin_identity, control_status, lifecycle_status },
  };
}

function buildForensicScores(
  token: JupTokenInfo,
  context: {
    normalizedQuery: string;
    narrativeId: string;
    earliestChainMs: number;
    earliestLiquidityMs: number;
    earliestEventMs: number;
    chronologicalRank: number;
    candidateCount: number;
    isOg: boolean;
    trustedOriginOverride?: boolean;
    dominanceProfile: DominanceProfile;
    dominanceRank: number;
    dominanceTier: DominanceTier;
    isPrimaryToken: boolean;
    isFirstMintToken: boolean;
  },
): TokenForensicScores {
  const chainCreatedAtMs: number = tokenCreatedAtMs(token);
  const liquidityCreatedAtMs: number = tokenPoolCreatedAtMs(token);
  const earliestKnownEventMs: number = earliestCandidateEventMs(token);
  const chainOriginScore: number = scoreByEarliest(chainCreatedAtMs, context.earliestChainMs, Number.isFinite(liquidityCreatedAtMs) ? 42 : 18);
  const earliestLiquidityScore: number = scoreByEarliest(liquidityCreatedAtMs, context.earliestLiquidityMs, 32);
  const firstTransactionScore: number = scoreByEarliest(earliestKnownEventMs, context.earliestEventMs, 35);
  const firstHolderDistribution: number = scoreHolderDistribution(token);
  const deployerAuthenticity: number = scoreDeployerAuthenticity(token);
  const metadataStability: number = scoreMetadataStability(token, context.normalizedQuery);
  const socialOriginAlignment: number = scoreSocialAlignment(token, context.normalizedQuery);
  const organicGrowthPattern: number = scoreOrganicGrowth(token);
  const antiCloneConfidence: number = context.chronologicalRank === 1 ? 94 : clampScore(95 - context.chronologicalRank * 12 - (100 - metadataStability) * 0.3);
  const walletBehaviorScore: number = clampScore(deployerAuthenticity * 0.72 + firstHolderDistribution * 0.28);
  const liquiditySurvivalScore: number = scoreLiquiditySurvival(token);
  const narrativeContinuityScore: number = clampScore((metadataStability + socialOriginAlignment + firstTransactionScore) / 3);
  const rawTrueOgProbability: number = clampScore(
    chainOriginScore * 0.18 +
      earliestLiquidityScore * 0.15 +
      firstTransactionScore * 0.10 +
      firstHolderDistribution * 0.08 +
      deployerAuthenticity * 0.12 +
      metadataStability * 0.07 +
      socialOriginAlignment * 0.08 +
      organicGrowthPattern * 0.08 +
      antiCloneConfidence * 0.06 +
      walletBehaviorScore * 0.04 +
      liquiditySurvivalScore * 0.02 +
      narrativeContinuityScore * 0.02,
  );
  const trueOgProbability: number = context.trustedOriginOverride ? Math.max(rawTrueOgProbability, 94) : rawTrueOgProbability;
  const cloneConfidenceScore: number = clampScore((100 - chainOriginScore) * 0.42 + (100 - firstTransactionScore) * 0.22 + (100 - antiCloneConfidence) * 0.2 + metadataStability * 0.16);
  const cloneProbability: number = clampScore(context.isOg ? Math.max(0, 100 - trueOgProbability) * 0.18 : cloneConfidenceScore * 0.88 + (100 - trueOgProbability) * 0.12);
  const hasExplicitMigrationSignal: boolean = Boolean(token.migrationCreatedAt && token.migrationCreatedAt !== token.firstPool?.createdAt);
  const migrationProbability: number = clampScore(
    Number.isFinite(liquidityCreatedAtMs) && Number.isFinite(chainCreatedAtMs) && liquidityCreatedAtMs - chainCreatedAtMs > 30 * 86_400_000
      ? 68 + Math.min(24, (liquidityCreatedAtMs - chainCreatedAtMs) / 86_400_000 / 12)
      : hasExplicitMigrationSignal
        ? 45
        : 16,
  );
  const manipulatedRelaunchProbability: number = clampScore((cloneConfidenceScore * 0.55) + (migrationProbability * 0.25) + ((100 - organicGrowthPattern) * 0.2));
  const artificialTrendProbability: number = clampScore(((token.dexPaidAmount ?? token.dexBoostTotalAmount ?? 0) > 0 ? 42 : 10) + (100 - organicGrowthPattern) * 0.42 + ((token.stats24h?.numTraders ?? 0) > 800 ? 12 : 0));
  const liquidityAuthenticityScore: number = clampScore(earliestLiquidityScore * 0.35 + liquiditySurvivalScore * 0.4 + (migrationProbability > 65 ? 10 : 25));
  const deployerTrustScore: number = clampScore(deployerAuthenticity * 0.62 + walletBehaviorScore * 0.38);
  const liquidityDelayHours: number | undefined = Number.isFinite(chainCreatedAtMs) && Number.isFinite(liquidityCreatedAtMs)
    ? Math.max(0, (liquidityCreatedAtMs - chainCreatedAtMs) / 3_600_000)
    : undefined;
  const socialActivityScore: number = clampScore(Math.min(35, ((token.ctLikes ?? 0) + (token.smartCtLikes ?? 0) * 2) / 2) + (token.dexUrl ? 16 : 0) + (token.isVerified ? 12 : 0) + Math.min(25, (token.stats24h?.numTraders ?? 0) / 20));
  const deployerInactive: number = clampScore((100 - deployerAuthenticity) * 0.5 + (!token.isVerified ? 18 : 0) + (token.audit?.mintAuthorityDisabled ? 10 : 0) + (token.audit?.freezeAuthorityDisabled ? 8 : 0));
  const communityControlShift: number = clampScore(socialActivityScore * 0.45 + liquiditySurvivalScore * 0.28 + organicGrowthPattern * 0.17 + (context.isOg && deployerInactive >= 55 ? 10 : 0));
  const sameContractContinued: boolean = context.isOg;
  const sameContractContinuedScore: number = sameContractContinued ? 100 : 0;
  const newSocialsAfterAbandonment: number = clampScore(deployerInactive * 0.4 + socialActivityScore * 0.6);
  const liquidityRebuiltByCommunity: number = clampScore((liquidityDelayHours != null && liquidityDelayHours > 720 ? 58 : 16) + Math.min(34, (token.liquidity ?? 0) / 750));
  const holderBaseReactivated: number = clampScore(Math.min(72, (token.holderCount ?? 0) / 18) + Math.min(28, (token.stats24h?.numTraders ?? 0) / 12));
  const rawOriginScore: number = clampScore(
    chainOriginScore * 0.35 +
      firstTransactionScore * 0.25 +
      earliestLiquidityScore * 0.20 +
      firstHolderDistribution * 0.10 +
      metadataStability * 0.05 +
      socialOriginAlignment * 0.05,
  );
  const originScore: number = context.trustedOriginOverride ? Math.max(rawOriginScore, 94) : rawOriginScore;
  const ctoScore: number = clampScore(
    deployerInactive * 0.25 +
      communityControlShift * 0.25 +
      sameContractContinuedScore * 0.20 +
      newSocialsAfterAbandonment * 0.15 +
      liquidityRebuiltByCommunity * 0.10 +
      holderBaseReactivated * 0.05,
  );
  const ctoProbability: number = ctoScore;
  const newerThanClusterOrigin: number = context.isOg ? 0 : clampScore(100 - chainOriginScore);
  const metadataSimilarityToOlderToken: number = metadataStability;
  const logoSimilarityToOlderToken: number = token.icon ? clampScore(metadataStability * 0.88 + 8) : clampScore(metadataStability * 0.62);
  const socialSimilarityToOlderToken: number = socialOriginAlignment;
  const deployerCloneHistory: number = clampScore(100 - deployerTrustScore);
  const launchTimingNearHypeWave: number = clampScore(artificialTrendProbability * 0.7 + (context.chronologicalRank > 3 ? 18 : 0));
  const cloneScore: number = clampScore(
    newerThanClusterOrigin * 0.30 +
      metadataSimilarityToOlderToken * 0.20 +
      logoSimilarityToOlderToken * 0.15 +
      socialSimilarityToOlderToken * 0.15 +
      deployerCloneHistory * 0.10 +
      launchTimingNearHypeWave * 0.10,
  );
  const newContractForOldNarrative: number = context.isOg ? 0 : clampScore((100 - chainOriginScore) * 0.72 + metadataStability * 0.28);
  const oldSocialOrNameReused: number = clampScore((metadataStability + socialOriginAlignment) / 2);
  const largeGapAfterOriginalDeath: number = Number.isFinite(chainCreatedAtMs) && Number.isFinite(context.earliestChainMs)
    ? clampScore(Math.min(100, Math.max(0, (chainCreatedAtMs - context.earliestChainMs) / 86_400_000 / 3)))
    : 0;
  const communityRestartWithoutSameCa: number = context.isOg ? 0 : clampScore(communityControlShift * 0.65 + socialActivityScore * 0.35);
  const noDirectMigrationProof: number = clampScore(100 - migrationProbability);
  const revivalScore: number = clampScore(
    newContractForOldNarrative * 0.35 +
      oldSocialOrNameReused * 0.20 +
      largeGapAfterOriginalDeath * 0.15 +
      communityRestartWithoutSameCa * 0.20 +
      noDirectMigrationProof * 0.10,
  );
  const oldCaToNewCaProof: number = context.isOg ? 0 : migrationProbability;
  const officialVerificationScore: number = context.isOg ? 0 : clampScore((token.isVerified ? 58 : 0) + (token.dexProfilePaid ? 18 : 0) + (token.dexUrl ? 8 : 0) + Math.min(8, (token.holderCount ?? 0) / 5_000) + Math.min(8, (token.liquidity ?? 0) / 1_000_000));
  const officialSocialConfirmation: number = officialVerificationScore;
  const holderMovementDetected: number = context.isOg ? 0 : clampScore(firstHolderDistribution * 0.45 + Math.min(55, (token.holderCount ?? 0) / 60));
  const liquidityMovementDetected: number = context.isOg ? 0 : clampScore(earliestLiquidityScore * 0.35 + liquiditySurvivalScore * 0.35 + (token.migrationCreatedAt ? 30 : 0));
  const metadataContinuity: number = metadataStability;
  const deployerOrTeamContinuity: number = clampScore(deployerTrustScore * 0.55 + (token.isVerified ? 18 : 0));
  const migrationScore: number = clampScore(
    oldCaToNewCaProof * 0.42 +
      officialSocialConfirmation * 0.10 +
      holderMovementDetected * 0.12 +
      liquidityMovementDetected * 0.14 +
      metadataContinuity * 0.10 +
      deployerOrTeamContinuity * 0.05 +
      (hasExplicitMigrationSignal ? 7 : 0),
  );
  const isLaterOfficial: boolean = !context.isOg && officialVerificationScore >= 62 && context.chronologicalRank > 1;
  const dominanceScore: number = context.dominanceProfile.dominanceScore;
  const dominanceRank: number = context.dominanceRank;
  const dominanceTier: DominanceTier = context.dominanceTier;
  const isPrimaryToken: boolean = context.isPrimaryToken;
  const isFirstMintToken: boolean = context.isFirstMintToken;
  const primaryStatusNote: string = dominanceTier === "REVIVED OFFICIAL"
    ? `Later mint (${shortDate(tokenOgCreatedAtIso(token))}) but now the dominant/primary version.`
    : dominanceTier === "LEGACY OG"
      ? "First on-chain mint, but a later version now has stronger dominance."
      : dominanceTier === "CONTESTED"
        ? "Multiple versions are close in dominance; verify before treating one as primary."
        : "Earliest mint is also the dominant primary token.";
  const riskScore: number = clampScore(
    cloneScore * 0.24 +
      manipulatedRelaunchProbability * 0.18 +
      artificialTrendProbability * 0.16 +
      (100 - deployerTrustScore) * 0.16 +
      (100 - liquidityAuthenticityScore) * 0.12 +
      (hasPulledOrDeadLiquidity(token) ? 28 : 0) +
      ((token.whaleCount ?? 0) >= 3 ? 8 : 0) +
      ((token.audit?.topHoldersPercentage ?? token.topHoldersPercent ?? 0) > 45 ? 10 : 0),
  );
  const classification: TokenLayeredClassification = buildLayeredClassification({
    token,
    isOg: context.isOg,
    sameContractContinued,
    originScore,
    ctoScore,
    migrationScore,
    revivalScore,
    cloneScore,
    riskScore,
    trueOgProbability,
    cloneProbability,
    ctoProbability,
    migrationProbability,
    deployerInactive,
    communityControlShift,
    deployerTrustScore,
    artificialTrendProbability,
    officialVerificationScore,
    isLaterOfficial,
    dominanceScore,
    dominanceRank,
    dominanceTier,
    isPrimaryToken,
    isFirstMintToken,
    firstOnChainProof: tokenOgCreatedAtIso(token),
    firstLiquidity: token.firstPool?.createdAt,
  });

  const baseScore = {
    chainOriginScore,
    earliestLiquidityScore,
    firstTransactionScore,
    firstHolderDistribution,
    deployerAuthenticity,
    metadataStability,
    socialOriginAlignment,
    organicGrowthPattern,
    antiCloneConfidence,
    walletBehaviorScore,
    liquiditySurvivalScore,
    narrativeContinuityScore,
    originScore,
    ctoScore,
    migrationScore,
    revivalScore,
    cloneScore,
    riskScore,
    trueOgProbability,
    cloneProbability,
    manipulatedRelaunchProbability,
    ctoProbability,
    migrationProbability,
    artificialTrendProbability,
    officialVerificationScore,
    deployerTrustScore,
    cloneConfidenceScore,
    liquidityAuthenticityScore,
    dominanceScore,
    dominanceRank,
    dominanceTier,
    marketCapRankScore: context.dominanceProfile.marketCapRankScore,
    liquidityDepthPoolAgeScore: context.dominanceProfile.liquidityDepthPoolAgeScore,
    holderDistributionScore: context.dominanceProfile.holderDistributionScore,
    socialNarrativeAdoptionScore: context.dominanceProfile.socialNarrativeAdoptionScore,
    onChainActivityScore: context.dominanceProfile.onChainActivityScore,
    creatorTeamStrengthScore: context.dominanceProfile.creatorTeamStrengthScore,
    earliestMintBonusScore: context.dominanceProfile.earliestMintBonusScore,
    isPrimaryToken,
    isFirstMintToken,
    primaryStatusNote,
    classification,
    label: classification.primary_label,
    reasons: [] as string[],
    warnings: [] as string[],
    evidence: {
      chainId: token.chainId ?? SOLANA_CHAIN_ID,
      normalizedTicker: normalizeTickerSymbol(token.symbol),
      narrativeFingerprintId: context.narrativeId,
      firstOnChainProof: tokenOgCreatedAtIso(token),
      firstLiquidity: token.firstPool?.createdAt,
      earliestKnownEvent: createdAtIsoFromMs(earliestKnownEventMs),
      creationSource: token.creationSource ?? "unknown",
      chronologicalRank: context.chronologicalRank,
      candidateCount: context.candidateCount,
      liquidityDelayHours,
      firstMintAuthorityWallet: token.firstMintAuthorityWallet ?? token.creatorFunding?.creatorWallet ?? null,
    },
  };

  const reasons: string[] = [];
  const warnings: string[] = [];
  if (isPrimaryToken) reasons.push(`Dominance score ${dominanceScore}% ranks #${dominanceRank} inside this ticker cluster.`);
  if (isFirstMintToken) reasons.push("Earliest provable candidate in the narrative cluster.");
  if (classification.primary_label === "REVIVED OFFICIAL") reasons.push("Later token is now primary by dominance engine, but first mint proof remains preserved separately.");
  if (classification.primary_label === "LEGACY OG") reasons.push("This is the first mint, but another token now dominates the market/community layer.");
  if (classification.primary_label === "TRUE OG CTO") reasons.push("Original CA is still used while control/support appears community-led after deployer inactivity.");
  if (classification.primary_label === "MIGRATED OG") reasons.push("Newer contract has migration-style continuity signals connected to the older narrative.");
  if (classification.primary_label === "LATER OFFICIAL") reasons.push("Official/verified status is detected, but OG status still belongs to the first credible Solana mint in the narrative.");
  if (classification.primary_label === "REVIVAL") reasons.push("Later contract appears to restart an older narrative without being the original CA.");
  if (Number.isFinite(chainCreatedAtMs)) reasons.push(`On-chain mint proof: ${shortDate(token.onChainCreatedAt)}.`);
  if (Number.isFinite(liquidityCreatedAtMs)) reasons.push(`First liquidity seen: ${shortDate(token.firstPool?.createdAt)}.`);
  if (metadataStability >= 80) reasons.push("Ticker/name metadata remains aligned with the searched narrative.");
  if (liquidityDelayHours != null && liquidityDelayHours > 720) warnings.push("Liquidity appeared long after mint creation; possible migration, revival, CTO rebuild, or delayed launch.");
  if (classification.primary_label === "LATER OFFICIAL" || classification.primary_label === "REVIVED OFFICIAL") warnings.push("Official/primary does not erase first-mint history; compare against the Legacy OG before trading.");
  if (cloneScore >= 65 && !context.isOg && classification.primary_label !== "LATER OFFICIAL") warnings.push("Newer than the origin cluster with high narrative overlap.");
  if ((token.audit?.topHoldersPercentage ?? token.topHoldersPercent ?? 0) > 45) warnings.push("Holder concentration is elevated.");
  if (hasPulledOrDeadLiquidity(token)) warnings.push(token.lpPullReason ?? "LP appears pulled/dead and cannot qualify as TRUE OG.");
  if ((token.whaleCount ?? 0) >= 3) warnings.push(`${token.whaleCount} whale / bundle-sized holders detected in largest-account sample.`);
  if (!token.audit?.mintAuthorityDisabled || !token.audit?.freezeAuthorityDisabled) warnings.push("Mint/freeze authority is not fully disabled in Helius/registry data.");
  if (artificialTrendProbability >= 60) warnings.push("Boost/trend pattern may be artificial and is not used to decide OG status.");

  return { ...baseScore, reasons, warnings };
}

function buildTimeline(candidates: JupTokenInfo[]): ForensicTimelineEvent[] {
  const events: ForensicTimelineEvent[] = [];
  for (const token of candidates) {
    const chainId: string = token.chainId ?? SOLANA_CHAIN_ID;
    if (token.onChainCreatedAt) {
      events.push({
        at: token.onChainCreatedAt,
        type: "mint",
        tokenId: token.id,
        chainId,
        label: `${token.symbol} mint`,
        detail: `${shortAddr(token.id, 5)} first on-chain proof`,
      });
    }
    if (token.firstPool?.createdAt) {
      events.push({
        at: token.firstPool.createdAt,
        type: "liquidity",
        tokenId: token.id,
        chainId,
        label: `${token.symbol} liquidity`,
        detail: `${shortAddr(token.id, 5)} first pool / DEX route`,
      });
    }
    if (token.migrationCreatedAt && token.migrationCreatedAt !== token.firstPool?.createdAt) {
      events.push({
        at: token.migrationCreatedAt,
        type: "migration",
        tokenId: token.id,
        chainId,
        label: `${token.symbol} migration`,
        detail: "Later migration-like liquidity event detected",
      });
    }
  }
  return events
    .filter((event) => Number.isFinite(new Date(event.at).getTime()))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .slice(0, 48);
}

// Build OG attribution by narrative cluster. Market cap, holders, volume, trending,
// bonding, and virality never decide the winner; they only affect risk/context labels.
export async function forensicOgAttribution(ticker: string): Promise<ForensicOgReport> {
  const clean: string = ticker.replace(/^\$/, "").trim();
  const normalizedQuery: string = normalizeNarrativeText(clean);
  const narrativeId: string = narrativeFingerprintId(clean);
  const emptyReport: ForensicOgReport = {
    query: clean,
    normalizedQuery,
    narrativeFingerprintId: narrativeId,
    generatedAt: new Date().toISOString(),
    og: null,
    primaryToken: null,
    firstMintToken: null,
    contestedTokens: [],
    copycats: [],
    candidates: [],
    clusterAliases: [],
    timeline: [],
    familyTree: [],
    tokenScores: {},
    summary: { candidateCount: 0, chainCount: 0, cloneCount: 0, migrationCount: 0, highRiskCount: 0 },
  };
  if (!clean || !normalizedQuery) return emptyReport;

  const canonicalMint: string | undefined = canonicalSolanaOriginMintForQuery(clean);
  const [jupiterResult, dexResult, canonicalJupiterResult, canonicalDexResult] = await Promise.allSettled([
    jupSearchToken(clean),
    dexSearchAllPairs(clean),
    canonicalMint ? jupGetTokens([canonicalMint]) : Promise.resolve([] as JupTokenInfo[]),
    canonicalMint ? dexPairsForMints([canonicalMint]) : Promise.resolve([] as DexSearchPair[]),
  ]);
  const jupiterTokens: JupTokenInfo[] = jupiterResult.status === "fulfilled"
    ? jupiterResult.value
        .filter((token: JupTokenInfo): boolean => isSolanaChainId(token.chainId))
        .map((token: JupTokenInfo): JupTokenInfo => ({ ...token, chainId: SOLANA_CHAIN_ID }))
    : [];
  const canonicalJupiterTokens: JupTokenInfo[] = canonicalJupiterResult.status === "fulfilled"
    ? canonicalJupiterResult.value
        .filter((token: JupTokenInfo): boolean => token.id === canonicalMint && isSolanaChainId(token.chainId))
        .map((token: JupTokenInfo): JupTokenInfo => ({ ...token, chainId: SOLANA_CHAIN_ID }))
    : [];
  const dexTokens: JupTokenInfo[] = dexResult.status === "fulfilled"
    ? dexResult.value.map(dexPairToToken).filter((token): token is JupTokenInfo => Boolean(token))
    : [];
  const canonicalDexTokens: JupTokenInfo[] = canonicalDexResult.status === "fulfilled"
    ? canonicalDexResult.value.map(dexPairToToken).filter((token): token is JupTokenInfo => Boolean(token))
    : [];

  const merged: JupTokenInfo[] = mergeMultiChainTokenCandidates([...jupiterTokens, ...dexTokens, ...canonicalJupiterTokens, ...canonicalDexTokens]);
  const similar = merged
    .filter((token: JupTokenInfo): boolean => isSolanaChainId(token.chainId))
    .map((token: JupTokenInfo) => ({ token, similarity: tokenNarrativeSimilarity(token, normalizedQuery) }))
    .filter((item) => item.similarity >= 0.58 || normalizeTickerSymbol(item.token.symbol).includes(normalizedQuery) || isCanonicalSolanaOriginForQuery(item.token, clean))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 64)
    .map((item) => item.token);
  const exactMatches: JupTokenInfo[] = similar.filter((token) => normalizeTickerSymbol(token.symbol) === normalizedQuery);
  const rawPool: JupTokenInfo[] = exactMatches.length > 0 ? exactMatches : similar.length > 0 ? similar : merged.slice(0, 32);
  // Sort the pool so canonical and exact-ticker matches come first — this
  // ensures the on-chain date concurrency budget hits the most important tokens
  // first and the canonical is never lost when pool is large.
  const pool: JupTokenInfo[] = [...rawPool].sort((a, b) => {
    const aCanon = isCanonicalSolanaOriginForQuery(a, clean) ? 0 : 1;
    const bCanon = isCanonicalSolanaOriginForQuery(b, clean) ? 0 : 1;
    if (aCanon !== bCanon) return aCanon - bCanon;
    const aExact = normalizeTickerSymbol(a.symbol) === normalizedQuery ? 0 : 1;
    const bExact = normalizeTickerSymbol(b.symbol) === normalizedQuery ? 0 : 1;
    return aExact - bExact;
  });
  const chainDatedPool: JupTokenInfo[] = await withOnChainCreationDates(pool);
  const enriched: JupTokenInfo[] = await enrichTokensWithMarketIntel(chainDatedPool, { includeAth: false, includeOnChainIntel: true, maxOnChain: 8, maxBirdeye: 16 });

  // ── Safety filtering ────────────────────────────────────────────────────
  // A token must have real liquidity to be shown.  LP-rug/scam tokens are
  // rejected unless they are the pinned canonical mint (in which case we keep
  // them for informational display but mark them clearly).
  const liquidCandidates: JupTokenInfo[] = enriched.filter((token) => {
    // Canonical mint always passes the liquidity gate — we never hide it
    if (isCanonicalSolanaOriginForQuery(token, clean)) return true;
    return hasMinimumOgScanLiquidity(token);
  });

  const originPool: JupTokenInfo[] = liquidCandidates.filter((token) => {
    // Canonical mint always passes the authority gate
    if (isCanonicalSolanaOriginForQuery(token, clean)) return true;
    // Skip tokens with LP pulled (scam/rug) unless canonical
    if (hasPulledOrDeadLiquidity(token)) return false;
    // Skip tokens with active mint/freeze authority (rug risk)
    if (hasUnsafeTokenAuthority(token)) return false;
    return true;
  });

  const candidates: JupTokenInfo[] = originPool
    .filter((token) => isCanonicalSolanaOriginForQuery(token, clean) || Number.isFinite(tokenCreatedAtMs(token)) || Number.isFinite(tokenPoolCreatedAtMs(token)))
    .sort(compareByOriginProofAndSafety)
    .slice(0, 40);

  const canonicalCandidate: JupTokenInfo | undefined = candidates.find((token) => isCanonicalSolanaOriginForQuery(token, clean));
  const chainCandidates: JupTokenInfo[] = candidates.filter((token) => Number.isFinite(tokenCreatedAtMs(token)));
  const chainSorted: JupTokenInfo[] = [...chainCandidates].sort(compareByOnChainAgeOnly);
  const eventSortedBase: JupTokenInfo[] = [...candidates].sort(compareByOriginProofAndSafety);
  const eventSorted: JupTokenInfo[] = canonicalCandidate
    ? [canonicalCandidate, ...eventSortedBase.filter((token) => tokenKey(token) !== tokenKey(canonicalCandidate))]
    : eventSortedBase;
  const exactMatchOg: JupTokenInfo | null = findOriginalOgToken(clean, candidates);
  const firstMintToken: JupTokenInfo | null = exactMatchOg ?? canonicalCandidate ?? eventSorted[0] ?? chainSorted[0] ?? null;
  const canonicalChainMs: number = canonicalCandidate ? tokenCreatedAtMs(canonicalCandidate) : Number.POSITIVE_INFINITY;
  const canonicalLiquidityMs: number = canonicalCandidate ? tokenPoolCreatedAtMs(canonicalCandidate) : Number.POSITIVE_INFINITY;
  const canonicalEventMs: number = canonicalCandidate ? earliestCandidateEventMs(canonicalCandidate) : Number.POSITIVE_INFINITY;
  const earliestChainMs: number = canonicalCandidate && Number.isFinite(canonicalChainMs)
    ? canonicalChainMs
    : chainSorted.length ? tokenCreatedAtMs(chainSorted[0]) : earliestCandidateEventMs(firstMintToken ?? candidates[0] ?? ({} as JupTokenInfo));
  const liquidityEvents: number[] = candidates.map(tokenPoolCreatedAtMs).filter((value) => Number.isFinite(value));
  const earliestLiquidityMs: number = canonicalCandidate && Number.isFinite(canonicalLiquidityMs)
    ? canonicalLiquidityMs
    : liquidityEvents.length ? Math.min(...liquidityEvents) : Number.POSITIVE_INFINITY;
  const eventEvents: number[] = candidates.map(earliestCandidateEventMs).filter((value) => Number.isFinite(value));
  const earliestEventMs: number = canonicalCandidate && Number.isFinite(canonicalEventMs)
    ? canonicalEventMs
    : eventEvents.length ? Math.min(...eventEvents) : Number.POSITIVE_INFINITY;

  const chronologicalRankByKey = new Map<string, number>();
  eventSorted.forEach((token: JupTokenInfo, index: number) => chronologicalRankByKey.set(tokenKey(token), index + 1));

  const dominanceProfiles: DominanceProfile[] = buildDominanceProfiles(candidates, normalizedQuery, earliestChainMs).sort((a, b) => b.dominanceScore - a.dominanceScore);
  const dominanceRankByKey = new Map<string, number>();
  dominanceProfiles.forEach((profile, index) => dominanceRankByKey.set(profile.key, index + 1));
  const dominanceProfileByKey = new Map<string, DominanceProfile>(dominanceProfiles.map((profile) => [profile.key, profile]));
  const firstMintKey: string | undefined = firstMintToken ? tokenKey(firstMintToken) : undefined;
  const firstMintProfile: DominanceProfile | undefined = firstMintKey ? dominanceProfileByKey.get(firstMintKey) : undefined;
  const dominanceWinner: DominanceProfile | undefined = dominanceProfiles[0];
  const contestedProfiles: DominanceProfile[] = dominanceWinner
    ? dominanceProfiles.filter((profile) => profile.dominanceScore >= 50 && dominanceWinner.dominanceScore - profile.dominanceScore <= 7)
    : [];
  const isContestedCluster: boolean = contestedProfiles.length > 1;
  const hasClearLaterDominance: boolean = Boolean(
    dominanceWinner &&
      firstMintProfile &&
      dominanceWinner.key !== firstMintProfile.key &&
      dominanceWinner.dominanceScore >= 65 &&
      dominanceWinner.dominanceScore - firstMintProfile.dominanceScore >= 10 &&
      !isContestedCluster,
  );
  const primaryProfile: DominanceProfile | undefined = isContestedCluster
    ? dominanceWinner
    : hasClearLaterDominance
      ? dominanceWinner
      : firstMintProfile ?? dominanceWinner;
  const primaryToken: JupTokenInfo | null = primaryProfile?.token ?? firstMintToken;
  const primaryKey: string | undefined = primaryToken ? tokenKey(primaryToken) : undefined;
  const clusterDominanceTier: DominanceTier = isContestedCluster
    ? "CONTESTED"
    : hasClearLaterDominance
      ? "REVIVED OFFICIAL"
      : primaryKey && firstMintKey && primaryKey === firstMintKey
        ? "TRUE OG"
        : "COPYCAT / CLONE";

  const tokenScores: Record<string, TokenForensicScores> = {};
  for (const token of candidates) {
    const key: string = tokenKey(token);
    const dominanceProfile: DominanceProfile = dominanceProfileByKey.get(key) ?? {
      token,
      key,
      dominanceScore: 0,
      marketCapRankScore: 0,
      liquidityDepthPoolAgeScore: 0,
      holderDistributionScore: 0,
      socialNarrativeAdoptionScore: 0,
      onChainActivityScore: 0,
      creatorTeamStrengthScore: 0,
      earliestMintBonusScore: 0,
    };
    const isFirstMintToken: boolean = Boolean(firstMintKey && key === firstMintKey);
    const isPrimaryToken: boolean = Boolean(primaryKey && key === primaryKey);
    const tokenDominanceTier: DominanceTier = isContestedCluster && isPrimaryToken
      ? "CONTESTED"
      : isFirstMintToken && !isPrimaryToken
        ? "LEGACY OG"
        : isPrimaryToken && !isFirstMintToken
          ? "REVIVED OFFICIAL"
          : isPrimaryToken
            ? "TRUE OG"
            : "COPYCAT / CLONE";
    tokenScores[key] = buildForensicScores(token, {
      normalizedQuery,
      narrativeId,
      earliestChainMs,
      earliestLiquidityMs,
      earliestEventMs,
      chronologicalRank: chronologicalRankByKey.get(key) ?? candidates.length,
      candidateCount: candidates.length,
      isOg: isFirstMintToken,
      trustedOriginOverride: isCanonicalSolanaOriginForQuery(token, clean),
      dominanceProfile,
      dominanceRank: dominanceRankByKey.get(key) ?? candidates.length,
      dominanceTier: tokenDominanceTier,
      isPrimaryToken,
      isFirstMintToken,
    });
  }

  const og: JupTokenInfo | null = firstMintToken;
  const ogKey: string | undefined = og ? tokenKey(og) : undefined;
  const copycats: JupTokenInfo[] = candidates.filter((token) => !ogKey || tokenKey(token) !== ogKey);
  const familyTree: TokenLineageNode[] = candidates.map((token) => {
    const scores: TokenForensicScores = tokenScores[tokenKey(token)];
    return {
      token,
      relationship: classifyRelationship(token, scores, Boolean(ogKey && tokenKey(token) === ogKey)),
      score: scores.dominanceScore,
      createdAt: tokenOgCreatedAtIso(token),
      liquidityAt: token.firstPool?.createdAt,
    };
  });
  const clusterAliases: string[] = Array.from(
    new Set(candidates.flatMap((token) => [token.symbol, token.name]).filter(Boolean).map((value) => value.trim()).slice(0, 18)),
  );
  const chains: Set<string> = new Set(candidates.map((token) => token.chainId ?? SOLANA_CHAIN_ID));
  const scoreValues: TokenForensicScores[] = Object.values(tokenScores);

  return {
    query: clean,
    normalizedQuery,
    narrativeFingerprintId: narrativeId,
    generatedAt: new Date().toISOString(),
    og,
    primaryToken,
    firstMintToken,
    contestedTokens: contestedProfiles.map((profile) => profile.token),
    copycats,
    candidates,
    clusterAliases,
    timeline: buildTimeline(candidates),
    familyTree,
    tokenScores,
    summary: {
      candidateCount: candidates.length,
      chainCount: chains.size,
      earliestProof: firstMintToken ? tokenOgCreatedAtIso(firstMintToken) ?? isoFromCandidateEvent(firstMintToken) : undefined,
      earliestLiquidity: createdAtIsoFromMs(earliestLiquidityMs),
      cloneCount: scoreValues.filter((score) => (score.classification.primary_label === "CLONE" || score.classification.primary_label === "COPYCAT" || score.cloneScore >= 70) && score.classification.primary_label !== "LATER OFFICIAL" && score.classification.primary_label !== "REVIVED OFFICIAL" && score.classification.primary_label !== "LEGACY OG").length,
      migrationCount: scoreValues.filter((score) => score.classification.primary_label === "MIGRATED OG" || score.classification.primary_label === "MIGRATION" || score.classification.primary_label === "MIGRATION CANDIDATE").length,
      highRiskCount: scoreValues.filter((score) => score.riskScore >= 65 || score.walletBehaviorScore < 35).length,
      primaryStatus: clusterDominanceTier,
      primaryDominanceScore: primaryProfile?.dominanceScore,
      firstMintAuthorityWallet: firstMintToken?.firstMintAuthorityWallet ?? firstMintToken?.creatorFunding?.creatorWallet ?? null,
    },
  };
}

// Backward-compatible helper for screens/tests expecting OG + copycats only.
export async function jupOgCopycats(ticker: string): Promise<{ og: JupTokenInfo | null; copycats: JupTokenInfo[] }> {
  const report: ForensicOgReport = await forensicOgAttribution(ticker);
  return { og: report.og, copycats: report.copycats };
}

export type JupPriceMap = Record<string, { usdPrice: number; priceChange24h?: number }>;
export async function jupPrice(mints: string[]): Promise<JupPriceMap> {
  if (mints.length === 0) return {};
  const url = `${JUPITER_BASE}/price/v3?ids=${mints.join(",")}`;
  return jget<JupPriceMap>(url);
}

export type JupQuote = {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: { swapInfo: { label: string; ammKey: string; inputMint: string; outputMint: string }; percent: number }[];
};

export async function jupQuote(input: string, output: string, amount: string, slippageBps = 100): Promise<JupQuote> {
  const url = `${JUPITER_BASE}/swap/v1/quote?inputMint=${input}&outputMint=${output}&amount=${amount}&slippageBps=${slippageBps}&restrictIntermediateTokens=true`;
  return jget<JupQuote>(url);
}

export type HeliusTx = {
  signature: string;
  timestamp: number;
  type: string;
  source?: string;
  description?: string;
  fee?: number;
  feePayer?: string;
  nativeTransfers?: { fromUserAccount?: string; toUserAccount?: string; amount?: number }[];
  tokenTransfers?: { mint: string; tokenAmount: number; fromUserAccount?: string; toUserAccount?: string }[];
};

export type TokenDevLaunchIntel = {
  wallet: string | null;
  confidence: "high" | "medium" | "low";
  launchType: "CTO / community support" | "dev launch" | "unknown";
  recentTokenMints: number;
  bondedCoinCount: number;
  dexPaidCoinCount: number;
  activeBoostedCoinCount: number;
  ctoOrderCount: number;
  sampleMints: string[];
  lastSeenAt?: string;
  notes: string[];
  farmingRiskScore?: number;
  rugRiskScore?: number;
  devRiskLabel?: "low" | "watch" | "high" | "severe";
  ruggedCoinCount?: number;
  suspiciousCoinCount?: number;
  lowLiquidityCoinCount?: number;
  averageLiquidity?: number;
  riskNotes?: string[];
};

export type TokenHolderBundleIntel = {
  status: "Likely bundled" | "Bundle watch" | "No bundle signal";
  score: number;
  confidence: "high" | "medium" | "low";
  bundleCount: number;
  topHolderPercent: number;
  top10Percent: number;
  topHolders: TokenTopHolder[];
  suspectedBundlers: TokenTopHolder[];
  evidence: string[];
  trackingNotes: string[];
};

export async function heliusTxs(address: string, limit = 25): Promise<HeliusTx[]> {
  const url = `${HELIUS_BASE}/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`;
  return jget<HeliusTx[]>(url);
}

function inferFundingWalletFromTx(tx: HeliusTx | undefined, creatorWallet: string | null): string | null {
  if (!tx || !creatorWallet) return null;
  const incoming = (tx.nativeTransfers ?? []).find((transfer) => transfer.toUserAccount === creatorWallet && transfer.fromUserAccount && (transfer.amount ?? 0) > 0);
  return incoming?.fromUserAccount ?? null;
}

export async function tokenCreatorFundingIntel(mint: string): Promise<TokenCreatorFundingIntel> {
  const cached = creatorFundingCache.get(mint);
  if (cached) return cached;

  const task = (async (): Promise<TokenCreatorFundingIntel> => {
    try {
      const txs = await heliusTxs(mint, 20);
      const ordered = [...txs].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
      const creationTx = ordered.find((tx) => /create|initialize|mint|pool|liquidity|pump|bond/i.test(`${tx.type} ${tx.description ?? ""}`)) ?? ordered[0];
      const creatorWallet: string | null = creationTx?.feePayer ?? null;
      return {
        creatorWallet,
        fundingWallet: inferFundingWalletFromTx(creationTx, creatorWallet),
        creationSignature: creationTx?.signature,
        createdAt: creationTx?.timestamp ? new Date(creationTx.timestamp * 1000).toISOString() : undefined,
        confidence: creationTx?.feePayer ? (/create|initialize|mint|pump|bond/i.test(`${creationTx.type} ${creationTx.description ?? ""}`) ? "high" : "medium") : "low",
        source: creationTx?.feePayer ? "helius" : "unknown",
      };
    } catch {
      return { creatorWallet: null, fundingWallet: null, confidence: "low", source: "unknown" };
    }
  })();

  creatorFundingCache.set(mint, task);
  return task;
}

type PumpFunCoinResponse = Record<string, unknown>;

async function pumpFunTokenIntel(mint: string, launchAt?: string, migrationAt?: string): Promise<TokenPumpFunIntel | null> {
  const cached = pumpFunIntelCache.get(mint);
  if (cached) return cached;

  const task = (async (): Promise<TokenPumpFunIntel | null> => {
    const endpoints = [
      `https://frontend-api-v3.pump.fun/coins/${encodeURIComponent(mint)}`,
      `https://frontend-api.pump.fun/coins/${encodeURIComponent(mint)}`,
    ];
    let data: PumpFunCoinResponse | null = null;
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint);
        if (!response.ok) continue;
        const json = (await response.json()) as PumpFunCoinResponse;
        if (json && Object.keys(json).length > 0) {
          data = json;
          break;
        }
      } catch {
        /* try next Pump.fun endpoint */
      }
    }

    const creator = typeof data?.creator === "string" ? data.creator : typeof data?.user === "string" ? data.user : undefined;
    const bondingCurve = typeof data?.bonding_curve === "string" ? data.bonding_curve : typeof data?.bondingCurve === "string" ? data.bondingCurve : undefined;
    const associatedBondingCurve = typeof data?.associated_bonding_curve === "string" ? data.associated_bonding_curve : typeof data?.associatedBondingCurve === "string" ? data.associatedBondingCurve : undefined;
    const createdTimestamp = finiteIso(data?.created_timestamp) ?? finiteIso(data?.createdAt) ?? finiteIso(data?.created_at) ?? launchAt;
    const migratedTimestamp = finiteIso(data?.migrated_timestamp) ?? finiteIso(data?.migration_timestamp) ?? finiteIso(data?.raydium_pool) ?? migrationAt;
    const isPumpFun: boolean = Boolean(data) || mint.toLowerCase().endsWith("pump") || Boolean(bondingCurve || associatedBondingCurve);
    if (!isPumpFun) return null;

    const launchMs: number = createdTimestamp ? new Date(createdTimestamp).getTime() : Number.NaN;
    const migrationMs: number = migratedTimestamp ? new Date(migratedTimestamp).getTime() : Number.NaN;
    const migrationDurationHours: number | undefined = Number.isFinite(launchMs) && Number.isFinite(migrationMs) && migrationMs >= launchMs
      ? Math.round(((migrationMs - launchMs) / 3_600_000) * 10) / 10
      : undefined;

    return {
      isPumpFun,
      creator,
      bondingCurve,
      associatedBondingCurve,
      launchAt: createdTimestamp,
      migrationAt: migratedTimestamp,
      migrationDurationHours,
      complete: typeof data?.complete === "boolean" ? data.complete : Boolean(migratedTimestamp),
      sourceUrl: `https://pump.fun/coin/${mint}`,
    };
  })();

  pumpFunIntelCache.set(mint, task);
  return task;
}

const devLaunchIntelCache = new Map<string, Promise<TokenDevLaunchIntel>>();

function inferCreatorWalletFromTxs(txs: HeliusTx[]): { wallet: string | null; confidence: TokenDevLaunchIntel["confidence"] } {
  const ordered = [...txs].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  const creationLike = ordered.find((tx) => /create|initialize|mint|pool|liquidity|pump|bond/i.test(`${tx.type} ${tx.description ?? ""}`));
  const chosen = creationLike ?? ordered[0] ?? txs[0];
  if (!chosen?.feePayer) return { wallet: null, confidence: "low" };
  return {
    wallet: chosen.feePayer,
    confidence: creationLike ? "high" : txs.length >= 4 ? "medium" : "low",
  };
}

function txLastSeenIso(txs: HeliusTx[]): string | undefined {
  const latest = txs.reduce<number | null>((current, tx) => {
    if (!Number.isFinite(tx.timestamp)) return current;
    return Math.max(current ?? tx.timestamp, tx.timestamp);
  }, null);
  return latest ? new Date(latest * 1000).toISOString() : undefined;
}

function tokenMintsFromWalletTxs(txs: HeliusTx[], targetMint: string): string[] {
  const ignored = new Set<string>([SOL_MINT, USDC_MINT]);
  const mints = new Set<string>([targetMint]);
  for (const tx of txs) {
    for (const transfer of tx.tokenTransfers ?? []) {
      if (!transfer.mint || ignored.has(transfer.mint)) continue;
      if ((transfer.tokenAmount ?? 0) <= 0) continue;
      mints.add(transfer.mint);
    }
  }
  return Array.from(mints).slice(0, 24);
}

export async function tokenDevLaunchIntel(token: JupTokenInfo): Promise<TokenDevLaunchIntel> {
  const chainId = token.chainId ?? SOLANA_CHAIN_ID;
  const cacheKey = `${chainId}:${token.id}`;
  const cached = devLaunchIntelCache.get(cacheKey);
  if (cached) return cached;

  const task = (async (): Promise<TokenDevLaunchIntel> => {
    if (!isSolanaChainId(chainId)) {
      return {
        wallet: null,
        confidence: "low",
        launchType: token.dexCommunityTakeoverPaid ? "CTO / community support" : "unknown",
        recentTokenMints: 0,
        bondedCoinCount: 0,
        dexPaidCoinCount: token.dexApprovedOrderCount ? 1 : 0,
        activeBoostedCoinCount: (token.dexBoostActive ?? 0) > 0 ? 1 : 0,
        ctoOrderCount: token.dexCommunityTakeoverPaid ? 1 : 0,
        sampleMints: [],
        notes: ["Dev wallet inference currently runs on Solana public transaction history."],
        farmingRiskScore: 0,
        rugRiskScore: 0,
        devRiskLabel: "low",
        ruggedCoinCount: 0,
        suspiciousCoinCount: 0,
        lowLiquidityCoinCount: 0,
        averageLiquidity: 0,
        riskNotes: ["No Solana dev-wallet farming graph was available for this chain."],
      };
    }

    const tokenOrders = await dexPaidOrdersForToken(chainId, token.id);
    let seedTxs: HeliusTx[] = [];
    try {
      seedTxs = await heliusTxs(token.id, 12);
    } catch {
      seedTxs = [];
    }

    const creator = inferCreatorWalletFromTxs(seedTxs);
    const launchType: TokenDevLaunchIntel["launchType"] = tokenOrders.communityTakeoverPaid || token.dexCommunityTakeoverPaid
      ? "CTO / community support"
      : creator.wallet
        ? "dev launch"
        : "unknown";

    if (!creator.wallet) {
      return {
        wallet: null,
        confidence: "low",
        launchType,
        recentTokenMints: 1,
        bondedCoinCount: token.pairAddress || token.firstPool?.createdAt ? 1 : 0,
        dexPaidCoinCount: tokenOrders.approvedOrders > 0 || (token.dexBoostTotalAmount ?? token.dexBoostAmount ?? 0) > 0 ? 1 : 0,
        activeBoostedCoinCount: (token.dexBoostActive ?? 0) > 0 ? 1 : 0,
        ctoOrderCount: tokenOrders.communityTakeoverPaid ? 1 : 0,
        sampleMints: [token.id],
        notes: ["Creator wallet could not be confidently inferred from early token transactions."],
        farmingRiskScore: 18,
        rugRiskScore: 12,
        devRiskLabel: "low",
        ruggedCoinCount: 0,
        suspiciousCoinCount: 0,
        lowLiquidityCoinCount: token.liquidity != null && token.liquidity < 1_000 ? 1 : 0,
        averageLiquidity: token.liquidity ?? 0,
        riskNotes: ["Creator wallet could not be confidently inferred, so farming/rug history is limited."],
      };
    }

    let devTxs: HeliusTx[] = [];
    try {
      devTxs = await heliusTxs(creator.wallet, 80);
    } catch {
      devTxs = [];
    }

    const sampleMints = tokenMintsFromWalletTxs(devTxs, token.id);
    const [pairsResult, boostsResult, orderResults] = await Promise.allSettled([
      dexPairsForMints(sampleMints),
      dexBoostsByMint(),
      Promise.all(sampleMints.slice(0, 12).map((mint) => dexPaidOrdersForToken(chainId, mint))),
    ]);

    const pairs = pairsResult.status === "fulfilled" ? pairsResult.value : [];
    const boostByMint = boostsResult.status === "fulfilled" ? boostsResult.value : new Map<string, DexBoostInfo>();
    const orderSummaries = orderResults.status === "fulfilled" ? orderResults.value : [];
    const bondedMints = new Set<string>();
    const activeBoostedMints = new Set<string>();
    const liquidityByMint = new Map<string, number>();
    const volumeByMint = new Map<string, number>();

    for (const pair of pairs) {
      const mint = pair.baseToken?.address;
      if (!mint) continue;
      const liquidity: number = pair.liquidity?.usd ?? 0;
      const volume24h: number = pair.volume?.h24 ?? 0;
      if (pair.pairAddress || pair.pairCreatedAt || liquidity > 0) bondedMints.add(mint);
      if ((pair.boosts?.active ?? 0) > 0) activeBoostedMints.add(mint);
      liquidityByMint.set(mint, Math.max(liquidityByMint.get(mint) ?? 0, liquidity));
      volumeByMint.set(mint, Math.max(volumeByMint.get(mint) ?? 0, volume24h));
    }
    for (const mint of sampleMints) {
      const boost = boostByMint.get(mint);
      if ((boost?.amount ?? boost?.totalAmount ?? 0) > 0) activeBoostedMints.add(mint);
    }

    const dexPaidCoinCount = orderSummaries.filter((summary) => summary.approvedOrders > 0).length + sampleMints.filter((mint) => {
      const boost = boostByMint.get(mint);
      return (boost?.totalAmount ?? boost?.amount ?? 0) > 0;
    }).length;
    const ctoOrderCount = orderSummaries.filter((summary) => summary.communityTakeoverPaid).length;
    const lowLiquidityCoinCount: number = sampleMints.filter((mint: string): boolean => (liquidityByMint.get(mint) ?? 0) > 0 && (liquidityByMint.get(mint) ?? 0) < 1_500).length;
    const deadBondedCoinCount: number = sampleMints.filter((mint: string): boolean => bondedMints.has(mint) && (liquidityByMint.get(mint) ?? 0) < 400 && (volumeByMint.get(mint) ?? 0) < 1_000).length;
    const suspiciousCoinCount: number = sampleMints.filter((mint: string, index: number): boolean => {
      const liquidity: number = liquidityByMint.get(mint) ?? 0;
      const volume: number = volumeByMint.get(mint) ?? 0;
      const order = orderSummaries[index];
      return (liquidity > 0 && liquidity < 1_500) || volume > Math.max(10_000, liquidity * 8) || (order?.approvedOrders ?? 0) > 0;
    }).length;
    const liquidityValues: number[] = sampleMints.map((mint: string): number => liquidityByMint.get(mint) ?? 0).filter((value: number): boolean => value > 0);
    const averageLiquidity: number = liquidityValues.length ? liquidityValues.reduce((sum: number, value: number): number => sum + value, 0) / liquidityValues.length : 0;
    const farmingRiskScore: number = clampScore(sampleMints.length * 4 + Math.max(0, sampleMints.length - bondedMints.size) * 3 + dexPaidCoinCount * 5 + lowLiquidityCoinCount * 7);
    const rugRiskScore: number = clampScore(deadBondedCoinCount * 18 + lowLiquidityCoinCount * 10 + suspiciousCoinCount * 5 + (averageLiquidity > 0 && averageLiquidity < 2_000 ? 16 : 0));
    const combinedDevRisk: number = clampScore(farmingRiskScore * 0.55 + rugRiskScore * 0.45);
    const devRiskLabel: TokenDevLaunchIntel["devRiskLabel"] = combinedDevRisk >= 78 ? "severe" : combinedDevRisk >= 58 ? "high" : combinedDevRisk >= 34 ? "watch" : "low";
    const riskNotes: string[] = [];
    if (sampleMints.length >= 10) riskNotes.push(`${sampleMints.length} recent token mints linked to inferred creator wallet`);
    if (deadBondedCoinCount > 0) riskNotes.push(`${deadBondedCoinCount} bonded coins look dead/thin-liquidity`);
    if (lowLiquidityCoinCount > 0) riskNotes.push(`${lowLiquidityCoinCount} linked coins have low liquidity`);
    if (dexPaidCoinCount > 2) riskNotes.push(`${Math.min(sampleMints.length, dexPaidCoinCount)} linked coins used DEX paid/boost orders`);
    if (riskNotes.length === 0) riskNotes.push("No strong public farming/rug pattern in sampled wallet activity.");
    const notes: string[] = [
      "Dev history is inferred from early fee-payer and recent wallet token activity.",
      "Bonded means a public DexScreener pair/liquidity route was found for that mint.",
    ];
    if (launchType === "CTO / community support") notes.unshift("DexScreener community-takeover order or CTO classification signal detected.");

    return {
      wallet: creator.wallet,
      confidence: creator.confidence,
      launchType,
      recentTokenMints: sampleMints.length,
      bondedCoinCount: bondedMints.size,
      dexPaidCoinCount: Math.min(sampleMints.length, dexPaidCoinCount),
      activeBoostedCoinCount: activeBoostedMints.size,
      ctoOrderCount,
      sampleMints,
      lastSeenAt: txLastSeenIso(devTxs),
      notes,
      farmingRiskScore,
      rugRiskScore,
      devRiskLabel,
      ruggedCoinCount: deadBondedCoinCount,
      suspiciousCoinCount,
      lowLiquidityCoinCount,
      averageLiquidity,
      riskNotes,
    };
  })();

  devLaunchIntelCache.set(cacheKey, task);
  return task;
}

export type BirdeyeOhlcv = {
  data: { items: { unixTime: number; o: number; h: number; l: number; c: number; v: number }[] };
};
export async function birdeyeOhlcv(mint: string, type = "15m", timeFrom?: number, timeTo?: number): Promise<BirdeyeOhlcv["data"]["items"]> {
  const now = Math.floor(Date.now() / 1000);
  const from = timeFrom ?? now - 60 * 60 * 24; // default 24h
  const to = timeTo ?? now;
  const url = `${BIRDEYE_BASE}/defi/ohlcv?address=${mint}&type=${type}&time_from=${from}&time_to=${to}`;
  const r = await jget<BirdeyeOhlcv>(url, {
    "X-API-KEY": BIRDEYE_API_KEY,
    "x-chain": SOLANA_CHAIN_ID,
  });
  return r?.data?.items ?? [];
}

// Helius RPC — largest token accounts (whales)
export type LargestAccount = { address: string; amount: string; decimals: number; uiAmount: number };
export async function heliusLargestAccounts(mint: string): Promise<LargestAccount[]> {
  const body = {
    jsonrpc: "2.0",
    id: "og-whales",
    method: "getTokenLargestAccounts",
    params: [mint, { commitment: "confirmed" }],
  };
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const j = (await res.json()) as {
    result?: { value?: { address: string; amount: string; decimals: number; uiAmount: number }[] };
  };
  return j.result?.value ?? [];
}

export async function heliusTokenSupply(mint: string): Promise<{ amount: string; decimals: number; uiAmount: number } | null> {
  const body = { jsonrpc: "2.0", id: "og-supply", method: "getTokenSupply", params: [mint] };
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { result?: { value?: { amount: string; decimals: number; uiAmount: number } } };
  return j.result?.value ?? null;
}

type ParsedTokenAccountOwner = {
  owner?: string;
  tokenAmount?: { uiAmount?: number | null; decimals?: number; amount?: string };
};

type RpcParsedAccountValue = {
  data?: { parsed?: { info?: ParsedTokenAccountOwner } };
};

async function heliusTokenAccountOwners(tokenAccounts: string[]): Promise<Map<string, string>> {
  const cleanAccounts: string[] = Array.from(new Set(tokenAccounts.filter(Boolean))).slice(0, 100);
  const owners = new Map<string, string>();
  if (cleanAccounts.length === 0) return owners;

  const body = {
    jsonrpc: "2.0",
    id: "og-token-account-owners",
    method: "getMultipleAccounts",
    params: [cleanAccounts, { encoding: "jsonParsed", commitment: "confirmed" }],
  };
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return owners;
  const json = (await res.json()) as { result?: { value?: (RpcParsedAccountValue | null)[] } };
  const values = json.result?.value ?? [];
  cleanAccounts.forEach((account: string, index: number): void => {
    const owner: string | undefined = values[index]?.data?.parsed?.info?.owner;
    if (owner) owners.set(account, owner);
  });
  return owners;
}

const holderBundleIntelCache = new Map<string, Promise<TokenHolderBundleIntel>>();

export async function tokenHolderBundleIntel(token: JupTokenInfo): Promise<TokenHolderBundleIntel> {
  const chainId: string = token.chainId ?? SOLANA_CHAIN_ID;
  const cacheKey = `${chainId}:${token.id}`;
  const cached = holderBundleIntelCache.get(cacheKey);
  if (cached) return cached;

  const task = (async (): Promise<TokenHolderBundleIntel> => {
    if (!isSolanaChainId(chainId)) {
      return {
        status: "No bundle signal",
        score: 0,
        confidence: "low",
        bundleCount: 0,
        topHolderPercent: 0,
        top10Percent: 0,
        topHolders: [],
        suspectedBundlers: [],
        evidence: ["Bundle owner tracking currently uses Solana token-account data."],
        trackingNotes: ["No Solana holder owner graph was available for this chain."],
      };
    }

    const [largestResult, supplyResult] = await Promise.allSettled([
      heliusLargestAccounts(token.id),
      heliusTokenSupply(token.id),
    ]);
    const largest: LargestAccount[] = largestResult.status === "fulfilled" ? largestResult.value.slice(0, 20) : [];
    const supply = supplyResult.status === "fulfilled" ? supplyResult.value : null;
    const supplyUi: number = supply?.uiAmount && Number.isFinite(supply.uiAmount) ? supply.uiAmount : largest.reduce((sum: number, account: LargestAccount): number => sum + (account.uiAmount ?? 0), 0);
    const ownerByAccount: Map<string, string> = await heliusTokenAccountOwners(largest.map((account: LargestAccount): string => account.address));

    const holders = largest.map((account: LargestAccount, index: number) => {
      const uiAmount: number = account.uiAmount ?? 0;
      const percent: number = supplyUi > 0 ? (uiAmount / supplyUi) * 100 : 0;
      return {
        owner: ownerByAccount.get(account.address) ?? account.address,
        tokenAccount: account.address,
        uiAmount,
        percent,
        label: index === 0 ? "largest holder" : percent >= 5 ? "major holder cluster" : percent >= 1.5 ? "bundle-sized wallet" : "tracked holder",
      };
    });

    const topHolderPercent: number = holders[0]?.percent ?? token.audit?.topHoldersPercentage ?? 0;
    const top10Percent: number = holders.slice(0, 10).reduce((sum: number, holder): number => sum + holder.percent, 0);
    const suspectedBundlers = holders.filter((holder) => holder.percent >= 1.5).slice(0, 8);
    const bundleCount: number = suspectedBundlers.length;
    const evidence: string[] = [];
    let score = 6;

    if (topHolderPercent >= 20) {
      score += 30;
      evidence.push(`largest holder controls ${topHolderPercent.toFixed(1)}%`);
    } else if (topHolderPercent >= 10) {
      score += 16;
      evidence.push(`largest holder controls ${topHolderPercent.toFixed(1)}%`);
    }
    if (top10Percent >= 55) {
      score += 30;
      evidence.push(`top 10 holders control ${top10Percent.toFixed(1)}%`);
    } else if (top10Percent >= 35) {
      score += 16;
      evidence.push(`top 10 holders control ${top10Percent.toFixed(1)}%`);
    }
    if (bundleCount >= 8) {
      score += 18;
      evidence.push(`${bundleCount} bundle-sized wallets found`);
    } else if (bundleCount >= 4) {
      score += 10;
      evidence.push(`${bundleCount} bundle-sized wallets found`);
    }
    if ((token.audit?.topHoldersPercentage ?? 0) >= 45) {
      score += 16;
      evidence.push(`registry top-holder concentration ${token.audit?.topHoldersPercentage?.toFixed(1)}%`);
    }
    if (evidence.length === 0) evidence.push("no major holder concentration signal in largest-account sample");

    const safeScore: number = clampScore(score);
    const status: TokenHolderBundleIntel["status"] = safeScore >= 65 ? "Likely bundled" : safeScore >= 35 ? "Bundle watch" : "No bundle signal";
    const confidence: TokenHolderBundleIntel["confidence"] = largest.length >= 10 && ownerByAccount.size >= 5 ? "high" : largest.length >= 5 ? "medium" : "low";

    return {
      status,
      score: safeScore,
      confidence,
      bundleCount,
      topHolderPercent,
      top10Percent,
      topHolders: holders.slice(0, 20),
      suspectedBundlers,
      evidence: evidence.slice(0, 5),
      trackingNotes: [
        "Bundler identity is inferred from largest token-account owners, not private exchange custody labels.",
        "Use suspected wallet rows as a tracking shortlist for concentration, linked-wallet, and sell-pressure monitoring.",
      ],
    };
  })();

  holderBundleIntelCache.set(cacheKey, task);
  return task;
}

export async function heliusSlot(): Promise<number | null> {
  const body = { jsonrpc: "2.0", id: "og-slot", method: "getSlot" };
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { result?: number };
  return j.result ?? null;
}

export function fmtUsd(n: number | undefined | null): string {
  if (n == null || !isFinite(n)) return "—";
  if (n === 0) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  if (abs >= 1) return `$${n.toFixed(4)}`;
  if (abs >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toExponential(3)}`;
}

export function fmtNum(n: number | undefined | null): string {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function fmtHolderCount(n: number | undefined | null): string {
  if (n == null || !isFinite(n)) return "—";
  return fmtNum(n);
}

export function fmtWhaleCount(n: number | undefined | null): string {
  if (n == null || !isFinite(n)) return "—";
  return fmtNum(n);
}

export function fmtPct(n: number | undefined | null): string {
  if (n == null || !isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function shortAddr(addr: string | undefined, n = 4): string {
  if (!addr) return "—";
  return `${addr.slice(0, n)}…${addr.slice(-n)}`;
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export async function copyTextToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through to textarea fallback */
  }

  try {
    const textarea: HTMLTextAreaElement = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied: boolean = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}
