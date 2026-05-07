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

export const JUPITER_BASE = "https://lite-api.jup.ag";
export const BIRDEYE_BASE = "https://public-api.birdeye.so";
export const HELIUS_BASE = `https://api.helius.xyz/v0`;
export const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
// Default token to scan when no $OG mint set yet — BONK is a recognizable meme.
export const DEFAULT_OG_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";

export const STORAGE_OG_MINT = "og_scanner.mint";

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
  ctLikes?: number;
  smartCtLikes?: number;
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

function tokenCreatedAtMs(token: JupTokenInfo): number {
  return token.firstPool?.createdAt ? new Date(token.firstPool.createdAt).getTime() : Number.POSITIVE_INFINITY;
}

function tokenTrustScore(token: JupTokenInfo, cleanTicker: string): number {
  const normalizedSymbol = normalizeTickerSymbol(token.symbol);
  const normalizedName = normalizeTickerSymbol(token.name);
  const normalizedTicker = normalizeTickerSymbol(cleanTicker);
  const liquidity = token.liquidity ?? 0;
  const holders = token.holderCount ?? 0;
  const organic = token.organicScore ?? 0;
  const volume24h = (token.stats24h?.buyVolume ?? 0) + (token.stats24h?.sellVolume ?? 0);
  const createdAt = tokenCreatedAtMs(token);
  const ageDays = Number.isFinite(createdAt) ? (Date.now() - createdAt) / 86_400_000 : 0;

  let score = 0;
  if (normalizedSymbol === normalizedTicker) score += 1_000;
  if (normalizedSymbol.includes(normalizedTicker)) score += 100;
  if (normalizedName.includes(normalizedTicker)) score += 25;
  if (token.isVerified) score += 750;
  score += Math.min(650, Math.log10(liquidity + 1) * 95);
  score += Math.min(350, Math.log10(Math.max(token.mcap ?? 0, token.fdv ?? 0) + 1) * 42);
  score += Math.min(300, Math.log10(holders + 1) * 58);
  score += Math.min(250, organic * 2.5);
  score += Math.min(180, Math.log10(volume24h + 1) * 36);
  score += Math.min(220, Math.max(0, ageDays) / 7);

  if (liquidity < 5_000) score -= 450;
  if (liquidity < 1_000) score -= 650;
  if (holders < 10) score -= 450;
  if ((token.audit?.topHoldersPercentage ?? 0) > 80) score -= 650;
  if (!token.audit?.mintAuthorityDisabled) score -= 300;
  if (!token.audit?.freezeAuthorityDisabled) score -= 300;
  if (token.id.toLowerCase().endsWith("pump") && liquidity < 25_000 && !token.isVerified) score -= 350;

  return score;
}

// Find OG copycats by ticker symbol. The OG is the trusted/high-liquidity original, not a dead clone.
export async function jupOgCopycats(ticker: string): Promise<{ og: JupTokenInfo | null; copycats: JupTokenInfo[] }> {
  const clean = ticker.replace(/^\$/, "").trim();
  if (!clean) return { og: null, copycats: [] };
  const all = await jupSearchToken(clean);
  const normalizedClean = normalizeTickerSymbol(clean);
  // Exact symbol matching must tolerate symbols like "$WIF" when the user types "wif".
  const matches = all.filter((t) => normalizeTickerSymbol(t.symbol) === normalizedClean);
  const pool = (matches.length > 0 ? matches : all).slice(0, 40);
  const sorted = [...pool].sort((a, b) => {
    const trustDelta = tokenTrustScore(b, clean) - tokenTrustScore(a, clean);
    if (Math.abs(trustDelta) > 75) return trustDelta;
    return tokenCreatedAtMs(a) - tokenCreatedAtMs(b);
  });
  const og = sorted[0] ?? null;
  const copycats = sorted.filter((t) => t.id !== og?.id).slice(0, 12);
  return { og, copycats };
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
export async function birdeyeOhlcv(mint: string, type = "15m"): Promise<BirdeyeOhlcv["data"]["items"]> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 60 * 60 * 24; // 24h
  const url = `${BIRDEYE_BASE}/defi/ohlcv?address=${mint}&type=${type}&time_from=${from}&time_to=${now}`;
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
