import { listTokens, listFeatured, type OrbitxToken } from "@/lib/orbitx/registry";

export interface ScreenerRow {
  mint?: string;
  address?: string;
  symbol?: string;
  name?: string;
  priceUsd?: number | string;
  change24h?: number | string;
  volume24h?: number | string;
  liquidity?: number | string;
  imageUrl?: string;
  logo?: string;
}

export interface CityMarketSnapshot {
  trending: ScreenerRow[];
  launches: OrbitxToken[];
  featured: OrbitxToken[];
  fetchedAt: number;
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

/** Normalize heterogeneous screener payloads from /api/ogdex/screener. */
export function normalizeScreenerRows(payload: unknown): ScreenerRow[] {
  const root = payload as { rows?: unknown[]; data?: unknown[]; tokens?: unknown[] } | unknown[];
  const raw = Array.isArray(root)
    ? root
    : Array.isArray((root as { rows?: unknown[] })?.rows)
      ? (root as { rows: unknown[] }).rows
      : Array.isArray((root as { data?: unknown[] })?.data)
        ? (root as { data: unknown[] }).data
        : Array.isArray((root as { tokens?: unknown[] })?.tokens)
          ? (root as { tokens: unknown[] }).tokens
          : [];

  return raw.map((item) => {
    const r = item as Record<string, unknown>;
    return {
      mint: (r.mint ?? r.address ?? r.tokenAddress ?? r.baseMint) as string | undefined,
      address: (r.address ?? r.mint) as string | undefined,
      symbol: (r.symbol ?? r.ticker ?? r.baseSymbol) as string | undefined,
      name: (r.name ?? r.tokenName) as string | undefined,
      priceUsd: num(r.priceUsd ?? r.price ?? r.price_usd),
      change24h: num(r.change24h ?? r.priceChange24h ?? r.priceChange?.h24 ?? (r.priceChange as { h24?: number })?.h24),
      volume24h: num(r.volume24h ?? r.volume?.h24 ?? (r.volume as { h24?: number })?.h24),
      liquidity: num(r.liquidity ?? r.liquidityUsd ?? (r.liquidity as { usd?: number })?.usd),
      imageUrl: (r.imageUrl ?? r.logo ?? r.icon ?? r.image) as string | undefined,
      logo: (r.logo ?? r.imageUrl) as string | undefined,
    };
  });
}

export async function fetchScreener(limit = 12): Promise<ScreenerRow[]> {
  try {
    const res = await fetch(`/api/ogdex/screener?type=trending&interval=24h&limit=${limit}`);
    if (!res.ok) return [];
    const json = await res.json();
    return normalizeScreenerRows(json).slice(0, limit);
  } catch {
    return [];
  }
}

export async function fetchCityMarketSnapshot(): Promise<CityMarketSnapshot> {
  const [trending, launches, featured] = await Promise.all([
    fetchScreener(14),
    listTokens("new", 24).catch(() => [] as OrbitxToken[]),
    listFeatured(8).catch(() => [] as OrbitxToken[]),
  ]);
  return { trending, launches, featured, fetchedAt: Date.now() };
}

export function shortMint(mint?: string | null, n = 4): string {
  if (!mint) return "—";
  if (mint.length <= n * 2 + 1) return mint;
  return `${mint.slice(0, n)}…${mint.slice(-n)}`;
}

export function fmtUsd(v?: number | string | null): string {
  const n = typeof v === "string" ? Number(v) : v;
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (Math.abs(n) >= 1) return `$${n.toFixed(2)}`;
  if (Math.abs(n) >= 0.0001) return `$${n.toFixed(4)}`;
  return `$${n.toExponential(2)}`;
}

export function fmtPct(v?: number | string | null): string {
  const n = typeof v === "string" ? Number(v) : v;
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
