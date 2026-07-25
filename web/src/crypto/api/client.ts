/**
 * OrbitX Crypto Intelligence — thin clients over existing OG DEX + OrbitX APIs.
 */

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidMint(mint: string): boolean {
  return MINT_RE.test(mint);
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { Accept: "application/json", ...(init?.headers || {}) } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

export type SafetyPayload = {
  ok?: boolean;
  mint?: string;
  canBuy?: boolean;
  canSell?: boolean;
  roundTripLossPct?: number | null;
  buyImpactPct?: number | null;
  sellImpactPct?: number | null;
  verdict?: string;
  tone?: string;
  note?: string;
};

export type ForensicsPayload = {
  ok?: boolean;
  mint?: string;
  dev?: {
    wallet?: string;
    tokensCreated?: number | null;
    holding?: { pct?: number | null; uiAmount?: number | null } | null;
    rank?: number | null;
    sold?: boolean | null;
    serial?: boolean;
  } | null;
  firstBuyer?: unknown;
  concentration?: { top10Pct?: number | null; whales?: number | null; totalHolders?: number | null };
  safetyFlags?: {
    mintRenounced?: boolean | null;
    freezeRenounced?: boolean | null;
    lpLockedPct?: number | null;
    rugged?: boolean | null;
    riskScore?: number | null;
  };
  launchpad?: string | null;
  error?: string;
};

export type TokenPayload = {
  ok?: boolean;
  mint?: string;
  symbol?: string;
  name?: string;
  image?: string;
  price?: number;
  priceUsd?: number;
  liquidity?: number;
  liquidityUsd?: number;
  volume24h?: number;
  mcap?: number;
  marketCap?: number;
  holders?: Array<{ owner?: string; pct?: number; uiAmount?: number; rank?: number }>;
  [key: string]: unknown;
};

export type ScreenerRow = {
  mint?: string;
  address?: string;
  symbol?: string;
  name?: string;
  priceUsd?: number;
  volume24h?: number;
  liquidity?: number;
  priceChange24h?: number;
  txns24h?: number;
  image?: string;
};

export type AntiVampResult = {
  ok?: boolean;
  blocked?: boolean;
  hardMatch?: boolean | { name: string; ticker: string; source: string } | null;
  flagged?: boolean;
  maxSim?: number;
  matches?: Array<{ source: string; name: string; ticker: string; sim: number }>;
  note?: string;
  message?: string;
  error?: string;
};

export async function fetchSafety(mint: string): Promise<SafetyPayload> {
  return getJson(`/api/ogdex/safety?mint=${encodeURIComponent(mint)}`);
}

export async function fetchForensics(mint: string, first = false): Promise<ForensicsPayload> {
  const q = first ? "1" : "0";
  return getJson(`/api/ogdex/forensics?mint=${encodeURIComponent(mint)}&first=${q}`);
}

export async function fetchToken(mint: string): Promise<TokenPayload> {
  return getJson(`/api/ogdex/token?mint=${encodeURIComponent(mint)}`);
}

export async function fetchResearch(mint: string): Promise<Record<string, unknown>> {
  return getJson(`/api/ogdex/research?mint=${encodeURIComponent(mint)}`);
}

export async function fetchScreener(limit = 40): Promise<{ ok?: boolean; tokens?: ScreenerRow[]; data?: ScreenerRow[] }> {
  return getJson(`/api/ogdex/screener?limit=${limit}`);
}

export async function fetchSignals(): Promise<Record<string, unknown>> {
  return getJson(`/api/ogdex/signals`);
}

export async function fetchKols(): Promise<Record<string, unknown>> {
  return getJson(`/api/ogdex/kols`);
}

export async function fetchWallet(address: string): Promise<Record<string, unknown>> {
  return getJson(`/api/ogdex/wallet?address=${encodeURIComponent(address)}`);
}

export async function checkAntiVamp(name: string, ticker: string): Promise<AntiVampResult> {
  const res = await fetch("/api/orbitx/anti-vamp-check", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ name, ticker }),
  });
  if (!res.ok) throw new Error(`anti-vamp → ${res.status}`);
  return res.json();
}

/** One-shot scan via optional aggregator; falls back to parallel OG DEX calls. */
export async function scanTokenFull(mint: string) {
  if (!isValidMint(mint)) throw new Error("Invalid mint");
  try {
    const agg = await getJson<Record<string, unknown>>(`/api/orbitx/crypto-scan?mint=${encodeURIComponent(mint)}`);
    if (agg && (agg as { ok?: boolean }).ok !== false) return agg;
  } catch {
    /* fall through */
  }
  const [safety, forensics, token] = await Promise.all([
    fetchSafety(mint).catch(() => ({ ok: false } as SafetyPayload)),
    fetchForensics(mint, false).catch(() => ({ ok: false } as ForensicsPayload)),
    fetchToken(mint).catch(() => ({ ok: false } as TokenPayload)),
  ]);
  return { ok: true, mint, safety, forensics, token, source: "parallel" as const };
}
