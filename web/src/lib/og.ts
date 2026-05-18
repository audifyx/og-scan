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
export const OGSCAN_DEXSCREENER_URL = `https://dexscreener.com/solana/${OGSCAN_TOKEN_MINT}`;
export const OGSCAN_PUMPFUN_URL = `https://pump.fun/coin/${OGSCAN_TOKEN_MINT}`;

export const JUPITER_BASE = "https://lite-api.jup.ag";
export const BIRDEYE_BASE = "https://public-api.birdeye.so";
export const HELIUS_BASE = `https://api.helius.xyz/v0`;
export const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
// Default scan target is now the official live OG Scan token.
export const DEFAULT_OG_MINT = OGSCAN_TOKEN_MINT;

export const STORAGE_OG_MINT = "og_scanner.mint";

export type TokenCreationSource = "chain" | "pool" | "unknown";

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
  creationSource?: TokenCreationSource;
  ctLikes?: number;
  smartCtLikes?: number;
  allTimeHighUsd?: number;
  allTimeHighAt?: string;
  migrationCreatedAt?: string;
  dexPaidAmount?: number;
  dexBoostAmount?: number;
  dexBoostTotalAmount?: number;
  dexBoostActive?: number;
  dexUrl?: string;
  pairAddress?: string;
  pairDexId?: string;
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

export type DexBoostInfo = {
  chainId?: string;
  tokenAddress?: string;
  url?: string;
  amount?: number;
  totalAmount?: number;
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

function isoToMs(rawCreatedAt: string | undefined): number {
  if (!rawCreatedAt) return Number.POSITIVE_INFINITY;
  const createdAtMs: number = new Date(rawCreatedAt).getTime();
  return Number.isFinite(createdAtMs) ? createdAtMs : Number.POSITIVE_INFINITY;
}

function tokenPoolCreatedAtMs(token: JupTokenInfo): number {
  return isoToMs(token.firstPool?.createdAt);
}

function tokenCreatedAtMs(token: JupTokenInfo): number {
  return isoToMs(token.onChainCreatedAt);
}

export function tokenOgCreatedAtMs(token: JupTokenInfo): number {
  return tokenCreatedAtMs(token);
}

export function tokenOgCreatedAtIso(token: JupTokenInfo): string | undefined {
  return Number.isFinite(tokenCreatedAtMs(token)) ? token.onChainCreatedAt : undefined;
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

function mergeTokenCandidate(existing: JupTokenInfo, next: JupTokenInfo): JupTokenInfo {
  const existingPoolCreatedAt: number = tokenPoolCreatedAtMs(existing);
  const nextPoolCreatedAt: number = tokenPoolCreatedAtMs(next);
  const oldestPoolCreatedAt: number = Math.min(existingPoolCreatedAt, nextPoolCreatedAt);
  const oldestPoolCreatedAtIso: string | undefined = createdAtIsoFromMs(oldestPoolCreatedAt);
  const existingMintCreatedAt: number = tokenCreatedAtMs(existing);
  const nextMintCreatedAt: number = tokenCreatedAtMs(next);
  const oldestMintCreatedAt: number = Math.min(existingMintCreatedAt, nextMintCreatedAt);
  const oldestMintCreatedAtIso: string | undefined = createdAtIsoFromMs(oldestMintCreatedAt);

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
    liquidity: existing.liquidity ?? next.liquidity,
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
    creationSource: oldestMintCreatedAtIso ? "chain" : existing.creationSource ?? next.creationSource,
    ctLikes: existing.ctLikes ?? next.ctLikes,
    smartCtLikes: existing.smartCtLikes ?? next.smartCtLikes,
    allTimeHighUsd: existing.allTimeHighUsd ?? next.allTimeHighUsd,
    allTimeHighAt: existing.allTimeHighAt ?? next.allTimeHighAt,
    migrationCreatedAt: existing.migrationCreatedAt ?? next.migrationCreatedAt,
    dexPaidAmount: existing.dexPaidAmount ?? next.dexPaidAmount,
    dexBoostAmount: existing.dexBoostAmount ?? next.dexBoostAmount,
    dexBoostTotalAmount: existing.dexBoostTotalAmount ?? next.dexBoostTotalAmount,
    dexBoostActive: existing.dexBoostActive ?? next.dexBoostActive,
    dexUrl: existing.dexUrl ?? next.dexUrl,
    pairAddress: existing.pairAddress ?? next.pairAddress,
    pairDexId: existing.pairDexId ?? next.pairDexId,
  };
}

async function dexSearchPairs(query: string): Promise<DexSearchPair[]> {
  const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
  const response = await jget<DexSearchResponse>(url);
  return (response.pairs ?? []).filter((pair) => pair.chainId === "solana" && Boolean(pair.baseToken?.address));
}

async function dexSearchAllPairs(query: string): Promise<DexSearchPair[]> {
  const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
  const response = await jget<DexSearchResponse>(url);
  return (response.pairs ?? []).filter((pair) => Boolean(pair.chainId) && Boolean(pair.baseToken?.address));
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

  return {
    id: mint,
    chainId: pair.chainId ?? "solana",
    name: pair.baseToken?.name ?? "Solana token",
    symbol: pair.baseToken?.symbol ?? "TOKEN",
    icon: pair.info?.imageUrl,
    decimals: 0,
    usdPrice: price != null && Number.isFinite(price) ? price : undefined,
    mcap: pair.marketCap,
    fdv: pair.fdv,
    liquidity: pair.liquidity?.usd,
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
const birdeyeOverviewCache = new Map<string, Promise<Record<string, unknown> | null>>();

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

function bestPairByMint(pairs: DexSearchPair[]): Map<string, DexSearchPair> {
  const byMint = new Map<string, DexSearchPair>();
  for (const pair of pairs) {
    const mint: string | undefined = pair.baseToken?.address;
    if (pair.chainId !== "solana" || !mint) continue;
    const currentScore: number = (pair.liquidity?.usd ?? 0) + (pair.volume?.h24 ?? 0) * 0.4;
    const previous: DexSearchPair | undefined = byMint.get(mint);
    const previousScore: number = (previous?.liquidity?.usd ?? 0) + (previous?.volume?.h24 ?? 0) * 0.4;
    if (!previous || currentScore >= previousScore) byMint.set(mint, pair);
  }
  return byMint;
}

export async function dexPairsForMints(mints: string[]): Promise<DexSearchPair[]> {
  const cleanMints: string[] = Array.from(new Set(mints.filter(Boolean))).slice(0, 60);
  if (cleanMints.length === 0) return [];

  const chunks: string[][] = [];
  for (let index = 0; index < cleanMints.length; index += 30) chunks.push(cleanMints.slice(index, index + 30));

  const responses = await Promise.allSettled(
    chunks.map((chunk) => jget<DexSearchPair[]>(`https://api.dexscreener.com/tokens/v1/solana/${chunk.join(",")}`))
  );

  return responses.flatMap((response) => (response.status === "fulfilled" ? response.value : []));
}

export async function dexBoostsByMint(): Promise<Map<string, DexBoostInfo>> {
  const cached = dexBoostCache.get("solana");
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
        if (boost.chainId !== "solana" || !boost.tokenAddress) continue;
        const previous: DexBoostInfo | undefined = byMint.get(boost.tokenAddress);
        const previousPaid: number = previous?.totalAmount ?? previous?.amount ?? 0;
        const nextPaid: number = boost.totalAmount ?? boost.amount ?? 0;
        if (!previous || nextPaid >= previousPaid) byMint.set(boost.tokenAddress, boost);
      }
    }

    return byMint;
  })();

  dexBoostCache.set("solana", task);
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
        "x-chain": "solana",
      });
      return response.data ?? null;
    } catch {
      return null;
    }
  })();

  birdeyeOverviewCache.set(mint, task);
  return task;
}

function athFromOverview(overview: Record<string, unknown> | null): { price?: number; at?: string } {
  return {
    price: pickFirstNumber(overview, [
      "ath",
      "athPrice",
      "priceAth",
      "priceATH",
      "allTimeHigh",
      "allTimeHighPrice",
      "highestPrice",
      "priceHighest",
      "maxPrice",
    ]),
    at: pickFirstIso(overview, [
      "athTime",
      "athAt",
      "athDate",
      "priceAthTime",
      "priceATHTime",
      "allTimeHighAt",
      "allTimeHighTime",
      "highestPriceTime",
    ]),
  };
}

async function athFromOhlcv(mint: string, fromIso: string | undefined): Promise<{ price?: number; at?: string }> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const fromMs: number = fromIso ? new Date(fromIso).getTime() : Date.now() - 365 * 86_400_000;
    const from = Number.isFinite(fromMs) ? Math.max(0, Math.floor(fromMs / 1000)) : now - 365 * 86_400;
    const candles = await birdeyeOhlcv(mint, "1D", from, now);
    const best = candles.reduce<{ price: number; unixTime: number } | null>((current, candle) => {
      const high: number = candle.h;
      if (!Number.isFinite(high)) return current;
      if (!current || high > current.price) return { price: high, unixTime: candle.unixTime };
      return current;
    }, null);
    return best ? { price: best.price, at: new Date(best.unixTime * 1000).toISOString() } : {};
  } catch {
    return {};
  }
}

export async function enrichTokensWithMarketIntel(
  tokens: JupTokenInfo[],
  options: { includeAth?: boolean; maxAth?: number } = {},
): Promise<JupTokenInfo[]> {
  if (tokens.length === 0) return [];

  const mints: string[] = tokens
    .filter((token) => (token.chainId ?? "solana") === "solana")
    .map((token) => token.id)
    .filter(Boolean);
  const [pairsResult, boostsResult] = await Promise.allSettled([dexPairsForMints(mints), dexBoostsByMint()]);
  const pairByMint: Map<string, DexSearchPair> = pairsResult.status === "fulfilled" ? bestPairByMint(pairsResult.value) : new Map<string, DexSearchPair>();
  const boostByMint: Map<string, DexBoostInfo> = boostsResult.status === "fulfilled" ? boostsResult.value : new Map<string, DexBoostInfo>();
  const maxAth: number = options.includeAth ? options.maxAth ?? tokens.length : 0;
  const athMints = new Set<string>(tokens.slice(0, maxAth).map((token) => token.id));

  return mapWithConcurrency(tokens, 4, async (token) => {
    const isSolanaToken: boolean = (token.chainId ?? "solana") === "solana";
    const pair: DexSearchPair | undefined = isSolanaToken ? pairByMint.get(token.id) : undefined;
    const boost: DexBoostInfo | undefined = boostByMint.get(token.id);
    const migrationCreatedAt: string | undefined = pair?.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : token.migrationCreatedAt ?? token.firstPool?.createdAt;
    const overview: Record<string, unknown> | null = isSolanaToken && athMints.has(token.id) ? await birdeyeTokenOverview(token.id) : null;
    const overviewAth = athFromOverview(overview);
    const ath = overviewAth.price != null
      ? overviewAth
      : isSolanaToken && athMints.has(token.id)
        ? await athFromOhlcv(token.id, token.onChainCreatedAt ?? token.firstPool?.createdAt ?? migrationCreatedAt)
        : overviewAth;

    return {
      ...token,
      icon: token.icon ?? pair?.info?.imageUrl,
      usdPrice: token.usdPrice ?? (pair?.priceUsd ? Number(pair.priceUsd) : undefined),
      mcap: token.mcap ?? pair?.marketCap,
      fdv: token.fdv ?? pair?.fdv,
      liquidity: token.liquidity ?? pair?.liquidity?.usd,
      firstPool: token.firstPool?.createdAt ? token.firstPool : migrationCreatedAt ? { createdAt: migrationCreatedAt } : token.firstPool,
      allTimeHighUsd: token.allTimeHighUsd ?? ath.price,
      allTimeHighAt: token.allTimeHighAt ?? ath.at,
      migrationCreatedAt,
      dexPaidAmount: token.dexPaidAmount ?? boost?.totalAmount ?? boost?.amount,
      dexBoostAmount: token.dexBoostAmount ?? boost?.amount,
      dexBoostTotalAmount: token.dexBoostTotalAmount ?? boost?.totalAmount,
      dexBoostActive: token.dexBoostActive ?? pair?.boosts?.active,
      dexUrl: token.dexUrl ?? pair?.url ?? boost?.url,
      pairAddress: token.pairAddress ?? pair?.pairAddress,
      pairDexId: token.pairDexId ?? pair?.dexId,
    };
  });
}

export function tokenMigrationDateIso(token: JupTokenInfo): string | undefined {
  return token.migrationCreatedAt ?? token.firstPool?.createdAt;
}

export function tokenDexPaidLabel(token: Pick<JupTokenInfo, "dexPaidAmount" | "dexBoostAmount" | "dexBoostTotalAmount" | "dexBoostActive">): string {
  const paid: number | undefined = token.dexPaidAmount ?? token.dexBoostTotalAmount ?? token.dexBoostAmount;
  if (paid != null && Number.isFinite(paid) && paid > 0) return `${fmtNum(paid)} paid`;
  if ((token.dexBoostActive ?? 0) > 0) return `${fmtNum(token.dexBoostActive)} boost`;
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
      "x-chain": "solana",
    },
  });
  if (!res.ok) return undefined;
  const json = (await res.json()) as BirdeyeCreationResponse;
  return unixSecondsToIso(json.data?.creationTime) ?? unixSecondsToIso(json.data?.mintTime);
}

async function heliusMintCreatedAt(mint: string): Promise<string | undefined> {
  const limit = 1000;
  let before: string | undefined;
  let oldestBlockTime: number | undefined;

  for (let page = 0; page < 25; page += 1) {
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
    try {
      const birdeyeCreatedAt = await birdeyeMintCreatedAt(mint);
      if (birdeyeCreatedAt) return birdeyeCreatedAt;
    } catch {
      /* fall back to RPC scan */
    }

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
  return mapWithConcurrency(tokens, 4, async (token) => {
    const chainId: string = token.chainId ?? "solana";
    if (chainId !== "solana") {
      return { ...token, creationSource: token.firstPool?.createdAt ? "pool" : "unknown" };
    }
    if (Number.isFinite(tokenCreatedAtMs(token))) return { ...token, chainId, creationSource: "chain" };

    try {
      const onChainCreatedAt = await mintCreatedAt(token.id);
      return {
        ...token,
        chainId,
        onChainCreatedAt,
        creationSource: onChainCreatedAt ? "chain" : token.firstPool?.createdAt ? "pool" : "unknown",
      };
    } catch {
      return { ...token, chainId, creationSource: token.firstPool?.createdAt ? "pool" : "unknown" };
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
  };
  reasoning_summary: string;
  layers: {
    origin_identity: string;
    control_status: string;
    lifecycle_status: string;
  };
};

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
  deployerTrustScore: number;
  cloneConfidenceScore: number;
  liquidityAuthenticityScore: number;
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
  relationship: "TRUE OG" | "early clone" | "migration" | "CTO" | "revival" | "fake revival" | "community fork" | "exploit copy";
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
  return `${token.chainId ?? "solana"}:${token.id}`;
}

function mergeMultiChainTokenCandidates(tokens: JupTokenInfo[]): JupTokenInfo[] {
  const byKey = new Map<string, JupTokenInfo>();
  for (const token of tokens) {
    const chainId: string = token.chainId ?? "solana";
    const existing: JupTokenInfo | undefined = byKey.get(`${chainId}:${token.id}`);
    byKey.set(`${chainId}:${token.id}`, existing ? mergeTokenCandidate(existing, { ...token, chainId }) : { ...token, chainId });
  }
  return Array.from(byKey.values());
}

function earliestCandidateEventMs(token: JupTokenInfo): number {
  const chainCreatedAt: number = tokenCreatedAtMs(token);
  const poolCreatedAt: number = tokenPoolCreatedAtMs(token);
  return Math.min(chainCreatedAt, poolCreatedAt);
}

function isoFromCandidateEvent(token: JupTokenInfo): string | undefined {
  return createdAtIsoFromMs(earliestCandidateEventMs(token));
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
  const liq: number = token.liquidity ?? 0;
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

function classifyRelationship(token: JupTokenInfo, scores: TokenForensicScores, isOg: boolean): TokenLineageNode["relationship"] {
  if (isOg) return "TRUE OG";
  if (scores.migrationProbability >= 60) return "migration";
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
    firstOnChainProof,
    firstLiquidity,
  } = input;

  let primary_label: TokenPrimaryLabel = "UNKNOWN";
  if (originScore >= 75 && ctoScore >= 60 && sameContractContinued) {
    primary_label = "TRUE OG CTO";
  } else if (originScore >= 75) {
    primary_label = "TRUE OG";
  } else if (migrationScore >= 70) {
    primary_label = "MIGRATED OG";
  } else if (isOg && originScore >= 68 && revivalScore >= 65) {
    primary_label = "OG WITH REVIVAL ACTIVITY";
  } else if (ctoScore >= 60) {
    primary_label = "CTO";
  } else if (revivalScore >= 65 && migrationScore < 70) {
    primary_label = "REVIVAL";
  } else if (migrationScore >= 60) {
    primary_label = "MIGRATION";
  } else if (cloneScore >= 70) {
    primary_label = "CLONE";
  } else if (cloneScore >= 50) {
    primary_label = "COPYCAT";
  } else if (migrationScore >= 55) {
    primary_label = "MIGRATION CANDIDATE";
  }

  const secondary: string[] = [];
  if (isOg) secondary.push("Original Contract", "Earliest Verified Origin");
  if (!isOg && cloneScore >= 50) secondary.push("Later Copy", "No Origin Priority");
  if (!isOg && revivalScore >= 65) secondary.push("New Contract", "Recreated Narrative");
  if (sameContractContinued) secondary.push("Same CA Continued");
  if (ctoScore >= 60) secondary.push("Community Takeover");
  if (deployerInactive >= 60) secondary.push("Dev Abandoned");
  if (communityControlShift >= 60) secondary.push("Community Support Shift");
  if (migrationScore >= 70) secondary.push("Provable Migration", "Ecosystem Moved");
  if (migrationScore >= 55 && migrationScore < 70) secondary.push("Weak Migration Proof");
  if (revivalScore >= 65 && isOg) secondary.push("Revival Activity Around OG");
  if (riskScore >= 65) secondary.push("High Risk");
  if (artificialTrendProbability >= 60) secondary.push("Artificial Trend Risk");

  const origin_identity: string = isOg
    ? "Original Contract"
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
  const lifecycle_status: string = migrationScore >= 70
    ? "Migrated Ecosystem"
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
  const reasoning_summary: string = `${primary_label}: ${isOg ? "earliest verified contract in this narrative cluster" : "not the earliest verified contract in this narrative cluster"}. ${proofBits.join(" · ") || "historical proof still incomplete"}. Origin ${originScore}%, CTO ${ctoScore}%, migration ${migrationScore}%, revival ${revivalScore}%, clone ${cloneScore}%.`;

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
  const trueOgProbability: number = clampScore(
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
  const cloneConfidenceScore: number = clampScore((100 - chainOriginScore) * 0.42 + (100 - firstTransactionScore) * 0.22 + (100 - antiCloneConfidence) * 0.2 + metadataStability * 0.16);
  const cloneProbability: number = clampScore(context.isOg ? Math.max(0, 100 - trueOgProbability) * 0.18 : cloneConfidenceScore * 0.88 + (100 - trueOgProbability) * 0.12);
  const migrationProbability: number = clampScore(
    Number.isFinite(liquidityCreatedAtMs) && Number.isFinite(chainCreatedAtMs) && liquidityCreatedAtMs - chainCreatedAtMs > 30 * 86_400_000
      ? 68 + Math.min(24, (liquidityCreatedAtMs - chainCreatedAtMs) / 86_400_000 / 12)
      : token.migrationCreatedAt
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
  const originScore: number = clampScore(
    chainOriginScore * 0.35 +
      firstTransactionScore * 0.25 +
      earliestLiquidityScore * 0.20 +
      firstHolderDistribution * 0.10 +
      metadataStability * 0.05 +
      socialOriginAlignment * 0.05,
  );
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
  const officialSocialConfirmation: number = context.isOg ? 0 : clampScore((token.isVerified ? 45 : 0) + (token.dexUrl ? 20 : 0) + Math.min(20, (token.ctLikes ?? 0) / 3));
  const holderMovementDetected: number = context.isOg ? 0 : clampScore(firstHolderDistribution * 0.45 + Math.min(55, (token.holderCount ?? 0) / 60));
  const liquidityMovementDetected: number = context.isOg ? 0 : clampScore(earliestLiquidityScore * 0.35 + liquiditySurvivalScore * 0.35 + (token.migrationCreatedAt ? 30 : 0));
  const metadataContinuity: number = metadataStability;
  const deployerOrTeamContinuity: number = clampScore(deployerTrustScore * 0.55 + (token.isVerified ? 18 : 0));
  const migrationScore: number = clampScore(
    oldCaToNewCaProof * 0.35 +
      officialSocialConfirmation * 0.20 +
      holderMovementDetected * 0.15 +
      liquidityMovementDetected * 0.15 +
      metadataContinuity * 0.10 +
      deployerOrTeamContinuity * 0.05,
  );
  const riskScore: number = clampScore(
    cloneScore * 0.26 +
      manipulatedRelaunchProbability * 0.20 +
      artificialTrendProbability * 0.18 +
      (100 - deployerTrustScore) * 0.18 +
      (100 - liquidityAuthenticityScore) * 0.10 +
      ((token.audit?.topHoldersPercentage ?? 0) > 45 ? 8 : 0),
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
    deployerTrustScore,
    cloneConfidenceScore,
    liquidityAuthenticityScore,
    classification,
    label: classification.primary_label,
    reasons: [] as string[],
    warnings: [] as string[],
    evidence: {
      chainId: token.chainId ?? "solana",
      normalizedTicker: normalizeTickerSymbol(token.symbol),
      narrativeFingerprintId: context.narrativeId,
      firstOnChainProof: tokenOgCreatedAtIso(token),
      firstLiquidity: token.firstPool?.createdAt,
      earliestKnownEvent: createdAtIsoFromMs(earliestKnownEventMs),
      creationSource: token.creationSource ?? "unknown",
      chronologicalRank: context.chronologicalRank,
      candidateCount: context.candidateCount,
      liquidityDelayHours,
    },
  };

  const reasons: string[] = [];
  const warnings: string[] = [];
  if (context.isOg) reasons.push("Earliest provable candidate in the narrative cluster.");
  if (classification.primary_label === "TRUE OG CTO") reasons.push("Original CA is still used while control/support appears community-led after deployer inactivity.");
  if (classification.primary_label === "MIGRATED OG") reasons.push("Newer contract has migration-style continuity signals connected to the older narrative.");
  if (classification.primary_label === "REVIVAL") reasons.push("Later contract appears to restart an older narrative without being the original CA.");
  if (Number.isFinite(chainCreatedAtMs)) reasons.push(`On-chain mint proof: ${shortDate(token.onChainCreatedAt)}.`);
  if (Number.isFinite(liquidityCreatedAtMs)) reasons.push(`First liquidity seen: ${shortDate(token.firstPool?.createdAt)}.`);
  if (metadataStability >= 80) reasons.push("Ticker/name metadata remains aligned with the searched narrative.");
  if (liquidityDelayHours != null && liquidityDelayHours > 720) warnings.push("Liquidity appeared long after mint creation; possible migration, revival, CTO rebuild, or delayed launch.");
  if (cloneScore >= 65 && !context.isOg) warnings.push("Newer than the origin cluster with high narrative overlap.");
  if ((token.audit?.topHoldersPercentage ?? 0) > 45) warnings.push("Holder concentration is elevated.");
  if (!token.audit?.mintAuthorityDisabled || !token.audit?.freezeAuthorityDisabled) warnings.push("Mint/freeze authority is not fully disabled in registry data.");
  if (artificialTrendProbability >= 60) warnings.push("Boost/trend pattern may be artificial and is not used to decide OG status.");

  return { ...baseScore, reasons, warnings };
}

function buildTimeline(candidates: JupTokenInfo[]): ForensicTimelineEvent[] {
  const events: ForensicTimelineEvent[] = [];
  for (const token of candidates) {
    const chainId: string = token.chainId ?? "solana";
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
    copycats: [],
    candidates: [],
    clusterAliases: [],
    timeline: [],
    familyTree: [],
    tokenScores: {},
    summary: { candidateCount: 0, chainCount: 0, cloneCount: 0, migrationCount: 0, highRiskCount: 0 },
  };
  if (!clean || !normalizedQuery) return emptyReport;

  const [jupiterResult, dexResult] = await Promise.allSettled([jupSearchToken(clean), dexSearchAllPairs(clean)]);
  const jupiterTokens: JupTokenInfo[] = jupiterResult.status === "fulfilled"
    ? jupiterResult.value.map((token: JupTokenInfo): JupTokenInfo => ({ ...token, chainId: token.chainId ?? "solana" }))
    : [];
  const dexTokens: JupTokenInfo[] = dexResult.status === "fulfilled"
    ? dexResult.value.map(dexPairToToken).filter((token): token is JupTokenInfo => Boolean(token))
    : [];

  const merged: JupTokenInfo[] = mergeMultiChainTokenCandidates([...jupiterTokens, ...dexTokens]);
  const similar = merged
    .map((token: JupTokenInfo) => ({ token, similarity: tokenNarrativeSimilarity(token, normalizedQuery) }))
    .filter((item) => item.similarity >= 0.58 || normalizeTickerSymbol(item.token.symbol).includes(normalizedQuery))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 64)
    .map((item) => item.token);
  const exactMatches: JupTokenInfo[] = similar.filter((token) => normalizeTickerSymbol(token.symbol) === normalizedQuery);
  const pool: JupTokenInfo[] = exactMatches.length > 0 ? exactMatches : similar.length > 0 ? similar : merged.slice(0, 32);
  const chainDatedPool: JupTokenInfo[] = await withOnChainCreationDates(pool);
  const enriched: JupTokenInfo[] = await enrichTokensWithMarketIntel(chainDatedPool, { includeAth: true, maxAth: 14 });

  const candidates: JupTokenInfo[] = enriched
    .filter((token) => Number.isFinite(tokenCreatedAtMs(token)) || Number.isFinite(tokenPoolCreatedAtMs(token)))
    .sort((a, b) => earliestCandidateEventMs(a) - earliestCandidateEventMs(b))
    .slice(0, 40);

  const chainCandidates: JupTokenInfo[] = candidates.filter((token) => Number.isFinite(tokenCreatedAtMs(token)));
  const chainSorted: JupTokenInfo[] = [...chainCandidates].sort(compareByOnChainAgeOnly);
  const eventSorted: JupTokenInfo[] = [...candidates].sort((a, b) => earliestCandidateEventMs(a) - earliestCandidateEventMs(b));
  const og: JupTokenInfo | null = chainSorted[0] ?? eventSorted[0] ?? null;
  const earliestChainMs: number = chainSorted.length ? tokenCreatedAtMs(chainSorted[0]) : Number.POSITIVE_INFINITY;
  const liquidityEvents: number[] = candidates.map(tokenPoolCreatedAtMs).filter((value) => Number.isFinite(value));
  const earliestLiquidityMs: number = liquidityEvents.length ? Math.min(...liquidityEvents) : Number.POSITIVE_INFINITY;
  const eventEvents: number[] = candidates.map(earliestCandidateEventMs).filter((value) => Number.isFinite(value));
  const earliestEventMs: number = eventEvents.length ? Math.min(...eventEvents) : Number.POSITIVE_INFINITY;

  const chronologicalRankByKey = new Map<string, number>();
  eventSorted.forEach((token: JupTokenInfo, index: number) => chronologicalRankByKey.set(tokenKey(token), index + 1));

  const tokenScores: Record<string, TokenForensicScores> = {};
  for (const token of candidates) {
    tokenScores[tokenKey(token)] = buildForensicScores(token, {
      normalizedQuery,
      narrativeId,
      earliestChainMs,
      earliestLiquidityMs,
      earliestEventMs,
      chronologicalRank: chronologicalRankByKey.get(tokenKey(token)) ?? candidates.length,
      candidateCount: candidates.length,
      isOg: Boolean(og && tokenKey(token) === tokenKey(og)),
    });
  }

  const copycats: JupTokenInfo[] = candidates.filter((token) => !og || tokenKey(token) !== tokenKey(og));
  const familyTree: TokenLineageNode[] = candidates.map((token) => {
    const scores: TokenForensicScores = tokenScores[tokenKey(token)];
    return {
      token,
      relationship: classifyRelationship(token, scores, Boolean(og && tokenKey(token) === tokenKey(og))),
      score: scores.trueOgProbability,
      createdAt: tokenOgCreatedAtIso(token),
      liquidityAt: token.firstPool?.createdAt,
    };
  });
  const clusterAliases: string[] = Array.from(
    new Set(candidates.flatMap((token) => [token.symbol, token.name]).filter(Boolean).map((value) => value.trim()).slice(0, 18)),
  );
  const chains: Set<string> = new Set(candidates.map((token) => token.chainId ?? "solana"));
  const scoreValues: TokenForensicScores[] = Object.values(tokenScores);

  return {
    query: clean,
    normalizedQuery,
    narrativeFingerprintId: narrativeId,
    generatedAt: new Date().toISOString(),
    og,
    copycats,
    candidates,
    clusterAliases,
    timeline: buildTimeline(candidates),
    familyTree,
    tokenScores,
    summary: {
      candidateCount: candidates.length,
      chainCount: chains.size,
      earliestProof: og ? tokenOgCreatedAtIso(og) ?? isoFromCandidateEvent(og) : undefined,
      earliestLiquidity: createdAtIsoFromMs(earliestLiquidityMs),
        cloneCount: scoreValues.filter((score) => score.classification.primary_label === "CLONE" || score.classification.primary_label === "COPYCAT" || score.cloneScore >= 70).length,
      migrationCount: scoreValues.filter((score) => score.classification.primary_label === "MIGRATED OG" || score.classification.primary_label === "MIGRATION" || score.classification.primary_label === "MIGRATION CANDIDATE").length,
      highRiskCount: scoreValues.filter((score) => score.riskScore >= 65 || score.walletBehaviorScore < 35).length,
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
  tokenTransfers?: { mint: string; tokenAmount: number; fromUserAccount?: string; toUserAccount?: string }[];
};

export async function heliusTxs(address: string, limit = 25): Promise<HeliusTx[]> {
  const url = `${HELIUS_BASE}/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`;
  return jget<HeliusTx[]>(url);
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
    "x-chain": "solana",
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
