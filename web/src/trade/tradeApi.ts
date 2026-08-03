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

async function j(url: string): Promise<any> {
  try {
    const r = await fetch(url);
    return await r.json();
  } catch {
    return null;
  }
}

export async function fetchScreener(type: string, limit = 200): Promise<MarketCoin[]> {
  try {
    if (type === "listed") {
      const d = await j("/api/ogdex/listings");
      return (Array.isArray(d?.rows) ? d.rows : []).map(mapCoinRow).filter(Boolean) as MarketCoin[];
    }
    const d = await j(
      `/api/ogdex/screener?type=${encodeURIComponent(type)}&interval=1h&limit=${limit}&chain=solana`,
    );
    return (Array.isArray(d?.rows) ? d.rows : []).map(mapCoinRow).filter(Boolean) as MarketCoin[];
  } catch {
    return [];
  }
}

export async function searchCoins(q: string): Promise<MarketCoin[]> {
  try {
    const d = await j(`/api/ogdex/search?q=${encodeURIComponent(q)}`);
    return (Array.isArray(d?.rows) ? d.rows : []).map(mapCoinRow).filter(Boolean) as MarketCoin[];
  } catch {
    return [];
  }
}

/** Same data sources as OGDex TokenDetail */
export async function fetchTokenBundle(mint: string) {
  const m = encodeURIComponent(mint);
  const [token, safety, traders, chart, forensics, ath, xray, research] = await Promise.all([
    j(`/api/ogdex/token?mint=${m}`),
    j(`/api/ogdex/safety?mint=${m}`),
    j(`/api/ogdex/traders?mint=${m}`),
    j(`/api/ogdex/chart?mint=${m}&interval=1h&limit=1`),
    j(`/api/ogdex/forensics?mint=${m}`),
    j(`/api/ogdex/ath?mint=${m}`),
    j(`/api/ogdex/xray?mint=${m}`),
    j(`/api/ogdex/research?mint=${m}`),
  ]);
  return { token, safety, traders, chart, forensics, ath, xray, research };
}

export async function fetchTokenOnly(mint: string) {
  return j(`/api/ogdex/token?mint=${encodeURIComponent(mint)}`);
}

export async function askCoinChat(mint: string, messages: { role: string; content: string }[], context: any) {
  try {
    const r = await fetch("/api/ogdex/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mint, messages, context }),
    });
    return await r.json();
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/** @deprecated use fetchTokenBundle */
export async function fetchTokenDetail(mint: string) {
  const b = await fetchTokenBundle(mint);
  return {
    tokenRes: b.token,
    safetyRes: b.safety,
    tradersRes: b.traders,
    chartRes: b.chart,
  };
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

export async function fetchWallet(address: string) {
  return j(`/api/ogdex/wallet?address=${encodeURIComponent(address)}`);
}

export async function fetchSwaps(address: string, limit = 40) {
  return j(`/api/ogdex/swaps?address=${encodeURIComponent(address)}&limit=${limit}`);
}

export async function fetchTopTraders(mint: string) {
  return j(`/api/ogdex/traders?mint=${encodeURIComponent(mint)}`);
}

/** Lightweight market movers for notifications / signals feed */
export async function fetchMarketSignals(): Promise<MarketCoin[]> {
  const [trending, fomo, runners] = await Promise.all([
    fetchScreener("trending", 30),
    fetchScreener("fomo", 20),
    fetchScreener("runners", 20),
  ]);
  const map = new Map<string, MarketCoin>();
  for (const c of [...fomo, ...runners, ...trending]) {
    if (!map.has(c.mint)) map.set(c.mint, c);
  }
  return [...map.values()]
    .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
    .slice(0, 40);
}

export async function fetchLeaderboard(): Promise<LeaderEntry[]> {
  try {
    const d = await j("/api/ogdex/leaderboard");
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
