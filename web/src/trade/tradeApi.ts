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

/** Total holder count only — never array length of a top-holders sample. */
function pickHolderCount(row: any): number | undefined {
  if (!row || typeof row !== "object") return undefined;
  const candidates = [row.holderCount, row.numHolders, row.holder_count, row.totalHolders];
  // `holders` is sometimes the total (number) and sometimes a top-N array — only accept a number.
  if (typeof row.holders === "number") candidates.push(row.holders);
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
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
    holders: pickHolderCount(row),
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

/** Same data sources as OGDex TokenDetail — resilient parallel fetch */
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

  // Normalize nested holders/traders/trades from whichever payload has them.
  // `holders` here is the top-N sample list; total count is `holderCount`.
  const intel = token?.intel || {};
  const holders =
    (Array.isArray(traders?.holders) && traders.holders.length ? traders.holders : null) ||
    (Array.isArray(intel.holders) && intel.holders.length ? intel.holders : null) ||
    (Array.isArray(token?.holders) && token.holders.length ? token.holders : []) ||
    [];
  const traderList =
    (Array.isArray(traders?.traders) && traders.traders.length ? traders.traders : null) ||
    (Array.isArray(intel.traders) && intel.traders.length ? intel.traders : []) ||
    [];
  const tradeTape =
    (Array.isArray(intel.trades) && intel.trades.length ? intel.trades : null) ||
    (Array.isArray(token?.token?.recentTrades) && token.token.recentTrades.length
      ? token.token.recentTrades
      : null) ||
    (Array.isArray(token?.recentTrades) ? token.recentTrades : []) ||
    [];

  const sampleLen = holders.length;
  const rawIntel = Number(traders?.holderCount ?? intel?.holderCount ?? token?.meta?.holderCount ?? token?.token?.holderCount);
  const holderCount =
    Number.isFinite(rawIntel) && rawIntel > 0 && !(sampleLen > 0 && rawIntel === sampleLen && rawIntel <= 100)
      ? rawIntel
      : Number(token?.meta?.holderCount ?? token?.token?.holderCount ?? intel?.safety?.totalHolders) || undefined;

  return {
    token,
    safety,
    traders: {
      ...(traders || {}),
      holders,
      traders: traderList,
      holderCount: holderCount ?? traders?.holderCount ?? null,
      topHoldersCount: sampleLen,
      ok: traders?.ok ?? true,
    },
    chart,
    forensics,
    ath,
    xray,
    research,
    tradeTape,
    holderCount: holderCount ?? null,
  };
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

export type WalletTrade = {
  txHash?: string | null;
  side?: "buy" | "sell" | string;
  mint?: string;
  tokenAmount?: number;
  solAmount?: number;
  time?: number;
  usd?: number | null;
  name?: string | null;
  symbol?: string | null;
  image?: string | null;
};

export type WalletPnlToken = {
  mint: string;
  symbol?: string | null;
  name?: string | null;
  image?: string | null;
  realizedUsd?: number | null;
  unrealizedUsd?: number | null;
  unrealizedPct?: number | null;
  totalUsd?: number | null;
  closedTrades?: number;
  wins?: number;
  losses?: number;
  winRate?: number | null;
  open?: boolean;
  holding?: boolean;
  holdingAmount?: number;
  holdingUsd?: number;
  /** Mark-to-market position value (held bag / "pot"). */
  potUsd?: number | null;
  tokens?: number;
  pctSupply?: number | null;
  avgCostUsd?: number | null;
  costUsd?: number | null;
  boughtUsd?: number | null;
  boughtSol?: number | null;
  curPriceUsd?: number | null;
  curValueUsd?: number | null;
  noTradeHistory?: boolean;
  sells?: number;
  buys?: number;
};

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Wallet API returns PnL rows under `pnl.perToken` (current). Older shapes used
 * `pnl.tokens` / top-level `tokens` / `pnl.positions` — check all so the desk
 * never blanks cost / unrealized when the payload is present.
 */
export function extractWalletPnlTokens(w: any): any[] {
  if (!w || typeof w !== "object") return [];
  if (Array.isArray(w?.pnl?.perToken) && w.pnl.perToken.length) return w.pnl.perToken;
  if (Array.isArray(w?.pnl?.tokens) && w.pnl.tokens.length) return w.pnl.tokens;
  if (Array.isArray(w?.tokens) && w.tokens.length) return w.tokens;
  if (Array.isArray(w?.pnl?.positions) && w.pnl.positions.length) return w.pnl.positions;
  if (Array.isArray(w?.pnl?.perToken)) return w.pnl.perToken;
  if (Array.isArray(w?.pnl?.tokens)) return w.pnl.tokens;
  if (Array.isArray(w?.tokens)) return w.tokens;
  if (Array.isArray(w?.pnl?.positions)) return w.pnl.positions;
  return [];
}

/** Find + normalize a single mint row from a /wallet response. */
export function findWalletPnlToken(w: any, mint: string): WalletPnlToken | null {
  const m = String(mint || "").trim();
  if (!m) return null;
  const raw = extractWalletPnlTokens(w).find((t) => String(t?.mint || "") === m);
  return raw ? normalizePnlToken(raw) : null;
}

/**
 * Normalize wallet / PnL token rows across API aliases so the UI never blanks
 * on cost vs costUsd, uPnl vs unrealizedUsd, pot vs holdingUsd, etc.
 */
export function normalizePnlToken(raw: any): WalletPnlToken | null {
  if (!raw || typeof raw !== "object") return null;
  const mint = String(raw.mint || "").trim();
  if (!mint) return null;

  const holdingAmount = numOrNull(raw.holdingAmount ?? raw.tokens ?? raw.uiAmount) ?? 0;
  const holdingFlag = raw.holding === true || holdingAmount > 1e-12;
  const holdingUsd =
    numOrNull(raw.holdingUsd ?? raw.usdValue ?? raw.curValueUsd ?? raw.potUsd) ??
    (holdingFlag ? 0 : null);
  const avgCostUsd = numOrNull(raw.avgCostUsd ?? raw.avgCost);
  let costUsd = numOrNull(raw.costUsd ?? raw.cost ?? raw.costBasisUsd);
  if (costUsd == null && avgCostUsd != null && holdingAmount > 0) {
    costUsd = avgCostUsd * holdingAmount;
  }
  const boughtUsd = numOrNull(raw.boughtUsd ?? raw.buyUsd ?? raw.totalBoughtUsd);
  const sells = numOrNull(raw.sells) ?? 0;
  if (costUsd == null && holdingFlag && sells === 0 && boughtUsd != null && boughtUsd > 0) {
    costUsd = boughtUsd;
  }

  const potUsd =
    numOrNull(raw.potUsd ?? raw.positionUsd ?? raw.curValueUsd ?? raw.holdingUsd) ??
    (holdingFlag && holdingUsd != null && holdingUsd > 0 ? holdingUsd : null);

  let unrealizedUsd = numOrNull(
    raw.unrealizedUsd ?? raw.unrealizedPnlUsd ?? raw.uPnl ?? raw.unrealized,
  );
  let unrealizedPct = numOrNull(raw.unrealizedPct ?? raw.unrealizedPnlPct ?? raw.uPnlPct);
  if (unrealizedUsd == null && potUsd != null && costUsd != null) {
    unrealizedUsd = potUsd - costUsd;
  }
  if (unrealizedPct == null && unrealizedUsd != null && costUsd != null && costUsd > 0) {
    unrealizedPct = (unrealizedUsd / costUsd) * 100;
  }

  const realizedUsd = numOrNull(raw.realizedUsd ?? raw.realizedPnlUsd ?? raw.realized);
  const totalUsdRaw = numOrNull(raw.totalUsd ?? raw.netUsd);
  const curValueUsd = numOrNull(raw.curValueUsd) ?? potUsd;
  const totalUsd =
    totalUsdRaw ??
    (realizedUsd != null || unrealizedUsd != null
      ? (realizedUsd || 0) + (unrealizedUsd || 0)
      : null);

  return {
    mint,
    symbol: raw.symbol ?? null,
    name: raw.name ?? null,
    image: raw.image ?? null,
    realizedUsd,
    unrealizedUsd,
    unrealizedPct,
    totalUsd,
    closedTrades: numOrNull(raw.closedTrades) ?? undefined,
    wins: numOrNull(raw.wins) ?? undefined,
    losses: numOrNull(raw.losses) ?? undefined,
    winRate: numOrNull(raw.winRate),
    open: !!raw.open,
    holding: holdingFlag,
    holdingAmount,
    holdingUsd: holdingUsd ?? undefined,
    potUsd,
    tokens: numOrNull(raw.tokens) ?? holdingAmount,
    pctSupply: numOrNull(raw.pctSupply),
    avgCostUsd:
      avgCostUsd ??
      (costUsd != null && holdingAmount > 0 ? costUsd / holdingAmount : null),
    costUsd,
    boughtUsd,
    boughtSol: numOrNull(raw.boughtSol),
    curPriceUsd: numOrNull(raw.curPriceUsd ?? raw.priceUsd),
    curValueUsd,
    noTradeHistory: !!raw.noTradeHistory,
    sells,
    buys: numOrNull(raw.buys) ?? undefined,
  };
}

/** Merge holdings + perToken so Mine/Track rows can show cost / pot / uPnL. */
export function mergeHoldingPnl(holding: any, pnlByMint: Map<string, WalletPnlToken>) {
  const mint = String(holding?.mint || "");
  const p = pnlByMint.get(mint);
  const uiAmount = numOrNull(holding?.uiAmount) ?? 0;
  const usdValue = numOrNull(holding?.usdValue) ?? 0;
  const costUsd =
    p?.costUsd ??
    (p?.avgCostUsd != null && uiAmount > 0 ? p.avgCostUsd * uiAmount : null);
  const potUsd = usdValue > 0 ? usdValue : p?.potUsd ?? null;
  let unrealizedUsd = p?.unrealizedUsd ?? null;
  let unrealizedPct = p?.unrealizedPct ?? null;
  if (unrealizedUsd == null && potUsd != null && costUsd != null) {
    unrealizedUsd = potUsd - costUsd;
  }
  if (unrealizedPct == null && unrealizedUsd != null && costUsd != null && costUsd > 0) {
    unrealizedPct = (unrealizedUsd / costUsd) * 100;
  }
  const symbol =
    (holding?.symbol && String(holding.symbol).trim()) ||
    (p?.symbol && String(p.symbol).trim()) ||
    null;
  const name =
    (holding?.name && String(holding.name).trim()) ||
    (p?.name && String(p.name).trim()) ||
    null;
  const image = holding?.image || p?.image || null;
  return {
    ...holding,
    symbol: symbol || holding?.symbol || null,
    name: name || holding?.name || null,
    image,
    costUsd,
    potUsd,
    boughtUsd: p?.boughtUsd ?? null,
    unrealizedUsd,
    unrealizedPct,
    realizedUsd: p?.realizedUsd ?? null,
    holdingAmount: uiAmount,
    holdingUsd: usdValue,
  };
}

export async function fetchWallet(address: string) {
  return j(`/api/ogdex/wallet?address=${encodeURIComponent(address)}`);
}

export async function fetchSwaps(address: string, limit = 80) {
  return j(`/api/ogdex/swaps?address=${encodeURIComponent(address)}&limit=${limit}`);
}

export async function fetchTopTraders(mint: string) {
  return j(`/api/ogdex/traders?mint=${encodeURIComponent(mint)}`);
}

/** Top holders (+ traders) for a mint via ogdex traders route */
export async function fetchTopHolders(mint: string) {
  return fetchTopTraders(mint);
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
