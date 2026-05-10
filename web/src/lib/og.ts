// $OG SCANNER — API constants & helpers
// All keys here are user-provided free tier API keys, intentionally inlined.

export const JUPITER_API_KEY = "jup_6e0d123f3459784011eaf91d3c3dc7799964432b0a1b98b566617f8c85c722f4";
export const BIRDEYE_API_KEY = "d0b0455f927647d6806ca6d5730746e5";
export const HELIUS_API_KEY = "6fb9660c-e27c-4309-a027-251e32fb7b6e";
export const ALCHEMY_API_KEY = "PAq_PkRjwniLgnpJdLUtc";
export const QUICKNODE_WSS = "wss://floral-few-frog.solana-mainnet.quiknode.pro/12dfccc83b82aad957cffaa9e22d37033c6ef947/";

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

function normalizeTickerSymbol(value: string | undefined): string {
  return (value ?? "").replace(/^\$+/, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
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

  const mints: string[] = tokens.map((token) => token.id).filter(Boolean);
  const [pairsResult, boostsResult] = await Promise.allSettled([dexPairsForMints(mints), dexBoostsByMint()]);
  const pairByMint: Map<string, DexSearchPair> = pairsResult.status === "fulfilled" ? bestPairByMint(pairsResult.value) : new Map<string, DexSearchPair>();
  const boostByMint: Map<string, DexBoostInfo> = boostsResult.status === "fulfilled" ? boostsResult.value : new Map<string, DexBoostInfo>();
  const maxAth: number = options.includeAth ? options.maxAth ?? tokens.length : 0;
  const athMints = new Set<string>(tokens.slice(0, maxAth).map((token) => token.id));

  return mapWithConcurrency(tokens, 4, async (token) => {
    const pair: DexSearchPair | undefined = pairByMint.get(token.id);
    const boost: DexBoostInfo | undefined = boostByMint.get(token.id);
    const migrationCreatedAt: string | undefined = pair?.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : token.migrationCreatedAt ?? token.firstPool?.createdAt;
    const overview: Record<string, unknown> | null = athMints.has(token.id) ? await birdeyeTokenOverview(token.id) : null;
    const overviewAth = athFromOverview(overview);
    const ath = overviewAth.price != null ? overviewAth : athMints.has(token.id) ? await athFromOhlcv(token.id, token.onChainCreatedAt ?? token.firstPool?.createdAt ?? migrationCreatedAt) : overviewAth;

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
    if (Number.isFinite(tokenCreatedAtMs(token))) return { ...token, creationSource: "chain" };

    try {
      const onChainCreatedAt = await mintCreatedAt(token.id);
      return {
        ...token,
        onChainCreatedAt,
        creationSource: onChainCreatedAt ? "chain" : token.firstPool?.createdAt ? "pool" : "unknown",
      };
    } catch {
      return { ...token, creationSource: token.firstPool?.createdAt ? "pool" : "unknown" };
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

// Find OG copycats by ticker symbol. The OG is the oldest exact-symbol mint by
// on-chain creation date only. Price, liquidity, volume, market cap, verification,
// and migrated/new pool dates are never used to decide which token is the OG.
export async function jupOgCopycats(ticker: string): Promise<{ og: JupTokenInfo | null; copycats: JupTokenInfo[] }> {
  const clean = ticker.replace(/^\$/, "").trim();
  if (!clean) return { og: null, copycats: [] };

  const [jupiterResult, dexResult] = await Promise.allSettled([jupSearchToken(clean), dexSearchPairs(clean)]);
  const jupiterTokens: JupTokenInfo[] = jupiterResult.status === "fulfilled" ? jupiterResult.value : [];
  const dexTokens: JupTokenInfo[] = dexResult.status === "fulfilled"
    ? dexResult.value.map(dexPairToToken).filter((token): token is JupTokenInfo => Boolean(token))
    : [];

  const all = mergeTokenCandidates([...jupiterTokens, ...dexTokens]);
  const normalizedClean = normalizeTickerSymbol(clean);
  // Exact symbol matching must tolerate symbols like "$WIF" when the user types "wif".
  const exactSymbolMatches = all.filter((token) => normalizeTickerSymbol(token.symbol) === normalizedClean);
  const looseMatches = all.filter((token) => {
    const normalizedSymbol = normalizeTickerSymbol(token.symbol);
    const normalizedName = normalizeTickerSymbol(token.name);
    return normalizedSymbol.includes(normalizedClean) || normalizedName.includes(normalizedClean);
  });
  const pool = exactSymbolMatches.length > 0 ? exactSymbolMatches : looseMatches.length > 0 ? looseMatches : all;
  const chainDatedPool = await withOnChainCreationDates(pool);
  const tokensWithChainDates = chainDatedPool.filter((token) => Number.isFinite(tokenCreatedAtMs(token)));
  const og = [...tokensWithChainDates].sort(compareByOnChainAgeOnly)[0] ?? null;
  const copycats = chainDatedPool
    .filter((token) => token.id !== og?.id)
    .sort(compareByOnChainAgeOnly)
    .slice(0, 24);

  const enriched = await enrichTokensWithMarketIntel([...(og ? [og] : []), ...copycats], { includeAth: true, maxAth: 12 });
  const enrichedByMint = new Map<string, JupTokenInfo>(enriched.map((token) => [token.id, token]));

  return {
    og: og ? enrichedByMint.get(og.id) ?? og : null,
    copycats: copycats.map((token) => enrichedByMint.get(token.id) ?? token),
  };
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
