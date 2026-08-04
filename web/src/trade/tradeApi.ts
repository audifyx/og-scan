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
  const holders = (
    (Array.isArray(traders?.holders) && traders.holders.length ? traders.holders : null) ||
    (Array.isArray(intel.holders) && intel.holders.length ? intel.holders : null) ||
    (Array.isArray(token?.holders) && token.holders.length ? token.holders : []) ||
    []
  ).map(normalizeHolderRow).filter(Boolean);
  const traderList = (
    (Array.isArray(traders?.traders) && traders.traders.length ? traders.traders : null) ||
    (Array.isArray(intel.traders) && intel.traders.length ? intel.traders : []) ||
    []
  ).map(normalizeTraderRow);
  // Merge tapes from all sources (CDN may briefly cache empty GT responses).
  const tradeTape = mergeTradeTapes([
    intel.trades,
    traders?.trades,
    token?.token?.recentTrades,
    token?.recentTrades,
  ]);

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
      trades: tradeTape,
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

/** Merge + dedupe trade tapes from intel / traders / recentTrades. */
function mergeTradeTapes(sources: Array<any[] | null | undefined>): any[] {
  const out: any[] = [];
  const seen = new Set<string>();
  for (const src of sources) {
    if (!Array.isArray(src) || !src.length) continue;
    for (const raw of src) {
      const t = normalizeTradeRow(raw);
      if (!t || (t.usd == null && t.tokenAmount == null && !t.txHash && !t.owner)) continue;
      const key =
        (t.txHash && String(t.txHash)) ||
        `${t.owner || ""}|${t.time || ""}|${t.side || ""}|${t.usd ?? ""}|${t.tokenAmount ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
  }
  out.sort((a, b) => (Number(b.time) || 0) - (Number(a.time) || 0));
  return out;
}

/** Map API holder keys → UI-stable fields (amount/value/bought/sold). */
function normalizeHolderRow(raw: any) {
  if (!raw || typeof raw !== "object") return null;
  const owner = raw.owner || raw.address || raw.wallet || raw.tokenAccount;
  if (!owner) return null;
  const uiAmount = numOrNull(raw.uiAmount ?? raw.amount ?? raw.balance ?? raw.holdingAmount ?? raw.tokens) ?? 0;
  const usdValue = numOrNull(raw.usdValue ?? raw.holdingUsd ?? raw.usd ?? raw.value);
  const buyVol = numOrNull(raw.buyVol ?? raw.boughtUsd ?? raw.bought ?? raw.buyUsd);
  const sellVol = numOrNull(raw.sellVol ?? raw.soldUsd ?? raw.sold ?? raw.sellUsd);
  const netPnl = numOrNull(raw.netPnl ?? raw.pnl ?? raw.pnlUsd);
  return {
    ...raw,
    owner,
    uiAmount,
    amount: uiAmount,
    pct: numOrNull(raw.pct ?? raw.percentage ?? raw.percent ?? raw.holdingPct),
    usdValue,
    holdingUsd: usdValue,
    buyVol,
    sellVol,
    boughtUsd: buyVol,
    bought: buyVol,
    soldUsd: sellVol,
    sold: sellVol,
    realizedPnl: numOrNull(raw.realizedPnl ?? raw.realized),
    unrealizedPnl: numOrNull(raw.unrealizedPnl ?? raw.unrealized),
    netPnl,
    pnl: netPnl,
    label: raw.label || null,
  };
}

/** Map API trader keys → UI-stable fields (bought/sold/holding/pnl aliases). */
function normalizeTraderRow(raw: any) {
  if (!raw || typeof raw !== "object") return raw;
  const buyVol = numOrNull(raw.buyVol ?? raw.boughtUsd ?? raw.bought ?? raw.buyUsd);
  const sellVol = numOrNull(raw.sellVol ?? raw.soldUsd ?? raw.sold ?? raw.sellUsd);
  const holdingAmount = numOrNull(raw.holdingAmount ?? raw.holding ?? raw.uiAmount ?? raw.tokens);
  const holdingUsd = numOrNull(raw.holdingUsd ?? raw.usdValue ?? raw.holdUsd);
  const netPnl = numOrNull(raw.netPnl ?? raw.pnl ?? raw.pnlUsd);
  return {
    ...raw,
    owner: raw.owner || raw.address || raw.wallet || raw.trader,
    buyVol,
    sellVol,
    boughtUsd: buyVol,
    bought: buyVol,
    soldUsd: sellVol,
    sold: sellVol,
    volume: numOrNull(raw.volume) ?? ((buyVol ?? 0) + (sellVol ?? 0) || null),
    holdingAmount,
    holding: holdingAmount,
    holdingUsd,
    holdingPct: numOrNull(raw.holdingPct ?? raw.pct),
    realizedPnl: numOrNull(raw.realizedPnl ?? raw.realized),
    unrealizedPnl: numOrNull(raw.unrealizedPnl ?? raw.unrealized),
    netPnl,
    pnl: netPnl,
    buys: numOrNull(raw.buys ?? raw.buyCount),
    sells: numOrNull(raw.sells ?? raw.sellCount),
  };
}

/** Map API trade tape keys → UI-stable fields (volumeUsd/tokenAmount aliases). */
function normalizeTradeRow(raw: any) {
  if (!raw || typeof raw !== "object") return raw;
  const side = String(raw.side || raw.kind || raw.type || "").toLowerCase();
  const usd = numOrNull(raw.volumeUsd ?? raw.usd ?? raw.value ?? raw.amountUsd ?? raw.volume_in_usd);
  const amount = numOrNull(raw.tokenAmount ?? raw.amount ?? raw.token_amount ?? raw.qty);
  let time = raw.time ?? raw.ts ?? raw.timestamp ?? raw.block_timestamp ?? null;
  if (typeof time === "string") {
    const ms = new Date(time).getTime();
    time = Number.isFinite(ms) ? ms : null;
  } else if (typeof time === "number" && time > 0 && time < 1e12) {
    time = time * 1000;
  }
  const owner = raw.owner || raw.wallet || raw.trader || raw.tx_from_address || null;
  return {
    ...raw,
    side: side === "sell" || side === "buy" ? side : side || "trade",
    kind: side === "sell" || side === "buy" ? side : raw.kind,
    usd,
    volumeUsd: usd,
    amountUsd: usd,
    amount,
    tokenAmount: amount,
    priceUsd: numOrNull(raw.priceUsd ?? raw.price),
    owner,
    wallet: owner,
    txHash: raw.txHash || raw.tx_hash || raw.signature || null,
    time,
  };
}

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** True when a string looks like a Solana mint/address (never use as token title). */
export function looksLikeMint(s: string | null | undefined): boolean {
  return !!s && MINT_RE.test(String(s).trim());
}

/** Pick logo from common API aliases (image / icon / logoURI / …). */
export function pickTokenImage(raw: any): string | null {
  if (!raw || typeof raw !== "object") return null;
  const v =
    raw.image ??
    raw.icon ??
    raw.logoURI ??
    raw.logoUri ??
    raw.logo ??
    raw.imageUrl ??
    raw.image_url ??
    raw.info?.imageUrl;
  const s = v != null ? String(v).trim() : "";
  if (!s || s === "missing.png") return null;
  return s;
}

/** Display symbol — never a raw mint / CA. */
export function pickTokenSymbol(raw: any): string | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw.symbol != null ? String(raw.symbol).trim() : "";
  if (!s || looksLikeMint(s)) return null;
  return s;
}

export function pickTokenName(raw: any): string | null {
  if (!raw || typeof raw !== "object") return null;
  const n = raw.name != null ? String(raw.name).trim() : "";
  if (!n || looksLikeMint(n)) return null;
  return n;
}

function holdingNeedsMeta(h: any): boolean {
  return !pickTokenSymbol(h) || !pickTokenName(h) || !pickTokenImage(h);
}

/** Client-side DexScreener meta backfill when wallet API omits name/icon. */
async function dexMetaClient(mints: string[]): Promise<Record<string, { name: string | null; symbol: string | null; image: string | null; usdPrice?: number; mcap?: number | null }>> {
  const out: Record<string, any> = {};
  if (!mints.length) return out;
  const chunks: string[][] = [];
  for (let i = 0; i < mints.length; i += 30) chunks.push(mints.slice(i, i + 30));
  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const r = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${chunk.join(",")}`);
        if (!r.ok) return;
        const pairs = await r.json();
        for (const p of pairs || []) {
          const mint = p?.baseToken?.address;
          if (!mint || out[mint]) continue;
          out[mint] = {
            name: p.baseToken?.name || null,
            symbol: p.baseToken?.symbol || null,
            image: p.info?.imageUrl || null,
            usdPrice: Number(p.priceUsd) || 0,
            mcap: Number(p.marketCap || p.fdv) || null,
          };
        }
      } catch {
        /* ignore */
      }
    }),
  );
  return out;
}

/** Same-origin fallback for stubborn mints DexScreener missed. */
async function tokenMetaClient(mints: string[]): Promise<Record<string, { name: string | null; symbol: string | null; image: string | null }>> {
  const out: Record<string, any> = {};
  await Promise.all(
    mints.slice(0, 24).map(async (mint) => {
      try {
        const d = await j(`/api/ogdex/token?mint=${encodeURIComponent(mint)}`);
        const t = d?.token || d?.meta || d;
        if (!t) return;
        out[mint] = {
          name: pickTokenName(t) || pickTokenName(d?.meta) || null,
          symbol: pickTokenSymbol(t) || pickTokenSymbol(d?.meta) || null,
          image: pickTokenImage(t) || pickTokenImage(d?.meta) || null,
        };
      } catch {
        /* ignore */
      }
    }),
  );
  return out;
}

function patchRowMeta(row: any, md: any) {
  if (!row || !md) return row;
  const symbol = pickTokenSymbol(row) || pickTokenSymbol(md);
  const name = pickTokenName(row) || pickTokenName(md);
  const image = pickTokenImage(row) || pickTokenImage(md);
  row.symbol = symbol;
  row.name = name;
  row.image = image;
  if (md.mcap != null && row.mcap == null) row.mcap = md.mcap;
  if (!(Number(row.usdValue) > 0) && Number(md.usdPrice) > 0 && Number(row.uiAmount) > 0) {
    row.priceUsd = Number(md.usdPrice);
    row.usdValue = Number(row.uiAmount) * Number(md.usdPrice);
    row.unpriced = false;
  }
  return row;
}

/**
 * Ensure every holding / perToken row has name·symbol·image when publicly
 * available. Runs after /wallet so Jupiter-priced bags aren't titled with CA.
 */
export async function enrichWalletMeta(w: any): Promise<any> {
  if (!w?.ok) return w;
  const holdings = Array.isArray(w.holdings) ? w.holdings : [];
  const pnlRows = extractWalletPnlTokens(w);
  const need = [
    ...new Set([
      ...holdings.filter(holdingNeedsMeta).map((h: any) => String(h.mint || "")),
      ...pnlRows.filter(holdingNeedsMeta).map((h: any) => String(h.mint || "")),
    ]),
  ].filter((m) => m && looksLikeMint(m));

  if (!need.length) {
    // Still normalize field aliases on present rows.
    for (const h of holdings) {
      h.symbol = pickTokenSymbol(h);
      h.name = pickTokenName(h);
      h.image = pickTokenImage(h);
    }
    for (const t of pnlRows) {
      t.symbol = pickTokenSymbol(t);
      t.name = pickTokenName(t);
      t.image = pickTokenImage(t);
    }
    return w;
  }

  const dex = await dexMetaClient(need.slice(0, 120));
  for (const h of holdings) if (dex[h.mint]) patchRowMeta(h, dex[h.mint]);
  for (const t of pnlRows) if (dex[t.mint]) patchRowMeta(t, dex[t.mint]);

  const still = need.filter((m) => {
    const h = holdings.find((x: any) => x.mint === m) || pnlRows.find((x: any) => x.mint === m);
    return h && holdingNeedsMeta(h);
  });
  if (still.length) {
    const tok = await tokenMetaClient(still);
    for (const h of holdings) if (tok[h.mint]) patchRowMeta(h, tok[h.mint]);
    for (const t of pnlRows) if (tok[t.mint]) patchRowMeta(t, tok[t.mint]);
  }

  for (const h of holdings) {
    h.symbol = pickTokenSymbol(h);
    h.name = pickTokenName(h);
    h.image = pickTokenImage(h);
  }
  for (const t of pnlRows) {
    t.symbol = pickTokenSymbol(t);
    t.name = pickTokenName(t);
    t.image = pickTokenImage(t);
  }
  if (Array.isArray(w.trades)) {
    for (const tr of w.trades) {
      const md = dex[tr.mint] || {};
      tr.symbol = pickTokenSymbol(tr) || pickTokenSymbol(md);
      tr.name = pickTokenName(tr) || pickTokenName(md);
      tr.image = pickTokenImage(tr) || pickTokenImage(md);
    }
  }
  return w;
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
    symbol: pickTokenSymbol(raw),
    name: pickTokenName(raw),
    image: pickTokenImage(raw),
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
  const symbol = pickTokenSymbol(holding) || pickTokenSymbol(p) || null;
  const name = pickTokenName(holding) || pickTokenName(p) || null;
  const image = pickTokenImage(holding) || pickTokenImage(p) || null;
  return {
    ...holding,
    symbol,
    name,
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
  const w = await j(`/api/ogdex/wallet?address=${encodeURIComponent(address)}`);
  try {
    return await enrichWalletMeta(w);
  } catch {
    return w;
  }
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
