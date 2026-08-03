export type MarketCoin = {
  mint: string;
  symbol: string;
  name: string;
  image?: string;
  price: number;
  mcap: number;
  change24h: number;
  change1h?: number;
  volume24h: number;
  liquidity: number;
  pairAddress?: string;
  holders?: number;
};

function poolId(row: any): string | undefined {
  const raw = row?.firstPool?.id || row?.poolAddress || row?.pairAddress || "";
  if (!raw) return undefined;
  const s = String(raw);
  return s.includes("_") ? s.split("_").pop() : s;
}

export function mapCoinRow(row: any): MarketCoin | null {
  const mint = String(row?.mint || row?.contract_address || "").trim();
  if (!mint) return null;
  return {
    mint,
    symbol: row.symbol || "???",
    name: row.name || row.symbol || "",
    image: row.icon || row.image_url || undefined,
    price: Number(row.priceUsd ?? row.price_usd) || 0,
    mcap: Number(row.mcap ?? row.fdv ?? row.market_cap) || 0,
    change24h: Number(row.change24h ?? row.change1h ?? row.change5m) || 0,
    change1h: row.change1h != null ? Number(row.change1h) : undefined,
    volume24h: Number(row.volume) || 0,
    liquidity: Number(row.liquidity) || 0,
    pairAddress: poolId(row),
    holders: row.holderCount != null ? Number(row.holderCount) : undefined,
  };
}

export async function fetchScreener(type: string, limit = 200): Promise<MarketCoin[]> {
  try {
    if (type === "listed") {
      const r = await fetch("/api/ogdex/listings");
      const d = await r.json();
      return (Array.isArray(d?.rows) ? d.rows : []).map(mapCoinRow).filter(Boolean) as MarketCoin[];
    }
    const r = await fetch(
      `/api/ogdex/screener?type=${encodeURIComponent(type)}&interval=1h&limit=${limit}&chain=solana`,
    );
    const d = await r.json();
    return (Array.isArray(d?.rows) ? d.rows : []).map(mapCoinRow).filter(Boolean) as MarketCoin[];
  } catch {
    return [];
  }
}

export async function searchCoins(q: string): Promise<MarketCoin[]> {
  try {
    const r = await fetch(`/api/ogdex/search?q=${encodeURIComponent(q)}`);
    const d = await r.json();
    return (Array.isArray(d?.rows) ? d.rows : []).map(mapCoinRow).filter(Boolean) as MarketCoin[];
  } catch {
    return [];
  }
}

export async function fetchTokenDetail(mint: string) {
  const [tokenRes, safetyRes, tradersRes, chartRes] = await Promise.all([
    fetch(`/api/ogdex/token?mint=${encodeURIComponent(mint)}`).then((r) => r.json()).catch(() => null),
    fetch(`/api/ogdex/safety?mint=${encodeURIComponent(mint)}`).then((r) => r.json()).catch(() => null),
    fetch(`/api/ogdex/traders?mint=${encodeURIComponent(mint)}`).then((r) => r.json()).catch(() => null),
    fetch(`/api/ogdex/chart?mint=${encodeURIComponent(mint)}&interval=1h&limit=1`).then((r) => r.json()).catch(() => null),
  ]);
  return { tokenRes, safetyRes, tradersRes, chartRes };
}

export type LeaderEntry = {
  rank: number;
  address: string;
  name?: string | null;
  twitter?: string | null;
  avatar?: string | null;
  realizedPnlUsd: number;
  winRate: number | null;
  closedTrades: number;
  openPositions: number;
  totalSwaps?: number;
};

export async function fetchLeaderboard(): Promise<LeaderEntry[]> {
  try {
    const r = await fetch("/api/ogdex/leaderboard");
    const d = await r.json();
    if (!d?.ok || !Array.isArray(d.entries)) return [];
    return d.entries.map((e: any, i: number) => ({
      rank: e.rank || i + 1,
      address: e.address,
      name: e.name,
      twitter: e.twitter,
      avatar: e.avatar,
      realizedPnlUsd: Number(e.realizedPnlUsd) || 0,
      winRate: e.winRate != null ? Number(e.winRate) : null,
      closedTrades: Number(e.closedTrades) || 0,
      openPositions: Number(e.openPositions) || 0,
      totalSwaps: Number(e.totalSwaps) || 0,
    }));
  } catch {
    return [];
  }
}
