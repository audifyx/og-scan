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
  change24h?: number;
  mcap?: number;
  txns24h?: number;
  image?: string;
};

export type AntiVampResult = {
  ok?: boolean;
  blocked?: boolean;
  hardMatch?: boolean | { name: string; ticker: string; source: string; chainId?: string; reason?: string } | null;
  warning?: "verification_degraded" | string;
  sourceHealth?: Record<string, boolean>;
  flagged?: boolean;
  maxSim?: number;
  matches?: Array<{ source: string; name: string; ticker: string; sim: number }>;
  note?: string;
  message?: string;
  error?: string;
};

/** Normalize OG DEX /api/ogdex/token nested response into flat TokenPayload. */
export function normalizeTokenPayload(raw: unknown, mintHint?: string): TokenPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const nested =
    root.token && typeof root.token === "object" ? (root.token as Record<string, unknown>) : root;
  const meta = (root.meta && typeof root.meta === "object" ? root.meta : {}) as Record<string, unknown>;
  const intel = (root.intel && typeof root.intel === "object" ? root.intel : {}) as Record<string, unknown>;
  const holdersRaw = nested.holders ?? intel.holders;
  const holders = Array.isArray(holdersRaw)
    ? (holdersRaw as TokenPayload["holders"])
    : undefined;
  const price = Number(nested.priceUsd ?? nested.price ?? meta.priceUsd ?? meta.price ?? NaN);
  const liq = Number(nested.liquidityUsd ?? nested.liquidity ?? meta.liquidity ?? NaN);
  const mcap = Number(nested.marketCap ?? nested.mcap ?? meta.mcap ?? NaN);
  const vol = Number(nested.volume24h ?? nested.volume ?? meta.volume24h ?? NaN);
  return {
    ok: true,
    mint: String(nested.mint ?? root.mint ?? mintHint ?? ""),
    symbol: String(nested.symbol ?? meta.symbol ?? ""),
    name: String(nested.name ?? meta.name ?? ""),
    image: String(nested.image ?? nested.icon ?? meta.image ?? meta.icon ?? "") || undefined,
    price: Number.isFinite(price) ? price : undefined,
    priceUsd: Number.isFinite(price) ? price : undefined,
    liquidity: Number.isFinite(liq) ? liq : undefined,
    liquidityUsd: Number.isFinite(liq) ? liq : undefined,
    volume24h: Number.isFinite(vol) ? vol : undefined,
    mcap: Number.isFinite(mcap) ? mcap : undefined,
    marketCap: Number.isFinite(mcap) ? mcap : undefined,
    holders,
  };
}

/** Accept rows|tokens|data|items from screener variants. */
export function normalizeScreenerRows(raw: unknown): ScreenerRow[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const list = o.rows ?? o.tokens ?? o.data ?? o.items;
  if (!Array.isArray(list)) return [];
  return list.map((row) => {
    const r = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
    const ch = Number(r.priceChange24h ?? r.change24h ?? r.chg24h ?? NaN);
    return {
      mint: (r.mint ?? r.address ?? r.id) as string | undefined,
      address: (r.address ?? r.mint) as string | undefined,
      symbol: r.symbol as string | undefined,
      name: r.name as string | undefined,
      priceUsd: Number(r.priceUsd ?? r.price ?? NaN) || undefined,
      volume24h: Number(r.volume24h ?? r.volume ?? NaN) || undefined,
      liquidity: Number(r.liquidity ?? r.liquidityUsd ?? NaN) || undefined,
      priceChange24h: Number.isFinite(ch) ? ch : undefined,
      change24h: Number.isFinite(ch) ? ch : undefined,
      mcap: Number(r.mcap ?? r.marketCap ?? NaN) || undefined,
      txns24h: Number(r.txns24h ?? r.txns ?? NaN) || undefined,
      image: (r.image ?? r.icon) as string | undefined,
    };
  });
}

export async function fetchSafety(mint: string): Promise<SafetyPayload> {
  return getJson(`/api/ogdex/safety?mint=${encodeURIComponent(mint)}`);
}

export async function fetchForensics(mint: string, first = false): Promise<ForensicsPayload> {
  const q = first ? "1" : "0";
  return getJson(`/api/ogdex/forensics?mint=${encodeURIComponent(mint)}&first=${q}`);
}

export async function fetchToken(mint: string): Promise<TokenPayload> {
  const raw = await getJson<unknown>(`/api/ogdex/token?mint=${encodeURIComponent(mint)}`);
  return normalizeTokenPayload(raw, mint) || { ok: false, mint };
}

export async function fetchResearch(mint: string): Promise<Record<string, unknown>> {
  return getJson(`/api/ogdex/research?mint=${encodeURIComponent(mint)}`);
}

export async function fetchScreener(limit = 40): Promise<{
  ok?: boolean;
  tokens?: ScreenerRow[];
  rows?: ScreenerRow[];
  data?: ScreenerRow[];
}> {
  const raw = await getJson<Record<string, unknown>>(`/api/ogdex/screener?limit=${limit}`);
  const tokens = normalizeScreenerRows(raw);
  return { ok: true, ...raw, tokens, rows: tokens, data: tokens };
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
    if (agg && (agg as { ok?: boolean }).ok !== false) {
      const token = normalizeTokenPayload(agg.token ?? agg, mint);
      const safety = (agg.safety as SafetyPayload) || null;
      const forensics = (agg.forensics as ForensicsPayload) || null;
      return { ok: true, mint, safety, forensics, token, source: "orbitx-crypto-scan" as const };
    }
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
