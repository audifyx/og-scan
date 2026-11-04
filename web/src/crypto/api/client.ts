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
  firstBuyer?: {
    traced?: boolean;
    wallet?: string | null;
    isDev?: boolean;
    solSpent?: number | null;
    tokenAmount?: number | null;
    time?: number | null;
    note?: string;
  } | null;
  dexPaid?: {
    paid?: boolean;
    services?: Array<{ type?: string; status?: string; at?: number | null }>;
  } | null;
  isPumpFun?: boolean | null;
  bondingComplete?: boolean | null;
  concentration?: {
    top10Pct?: number | null;
    whales?: number | null;
    totalHolders?: number | null;
    pools?: Array<{ owner?: string; pct?: number | null; poolProgram?: string | null }>;
  };
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

/** One DexScreener pair, normalized. Volume/txn windows come from the public
 *  DexScreener API — the OG DEX token route only maps the 24h window. */
export type DexPair = {
  dexId?: string;
  pairAddress?: string;
  url?: string;
  priceUsd?: number;
  marketCap?: number;
  fdv?: number;
  liquidityUsd?: number;
  volumeM5?: number;
  volumeH1?: number;
  volumeH6?: number;
  volumeH24?: number;
  txnsM5Buys?: number;
  txnsM5Sells?: number;
  txnsH1Buys?: number;
  txnsH1Sells?: number;
  txnsH6Buys?: number;
  txnsH6Sells?: number;
  txnsH24Buys?: number;
  txnsH24Sells?: number;
  changeM5?: number;
  changeH1?: number;
  changeH6?: number;
  changeH24?: number;
  pairCreatedAt?: number | null;
  quoteSymbol?: string;
  websites?: string[];
  socials?: Array<{ type: string; url: string }>;
};

export type TokenSocials = {
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
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
  fdv?: number;
  holderCount?: number | null;
  createdAt?: string | null;
  ageDays?: number | null;
  change5m?: number;
  change1h?: number;
  change6h?: number;
  change24h?: number;
  firstPool?: { id?: string } | null;
  pairDexId?: string | null;
  athPrice?: number | null;
  athMcap?: number | null;
  pairs?: DexPair[];
  socials?: TokenSocials;
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
  hardMatch?: boolean | { name: string; ticker: string; source: string } | null;
  flagged?: boolean;
  maxSim?: number;
  matches?: Array<{ source: string; name: string; ticker: string; sim: number }>;
  note?: string;
  message?: string;
  error?: string;
};

/** Normalize one raw DexScreener pair object into a DexPair. */
export function normalizeDexPair(raw: unknown): DexPair | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const n = (v: unknown): number | undefined => {
    const x = Number(v);
    return Number.isFinite(x) ? x : undefined;
  };
  const vol = (p.volume && typeof p.volume === "object" ? p.volume : {}) as Record<string, unknown>;
  const tx = (p.txns && typeof p.txns === "object" ? p.txns : {}) as Record<string, Record<string, unknown>>;
  const ch = (p.priceChange && typeof p.priceChange === "object" ? p.priceChange : {}) as Record<string, unknown>;
  const liq = (p.liquidity && typeof p.liquidity === "object" ? p.liquidity : {}) as Record<string, unknown>;
  const info = (p.info && typeof p.info === "object" ? p.info : {}) as Record<string, unknown>;
  const websites = Array.isArray(info.websites)
    ? (info.websites as Array<Record<string, unknown>>).map((w) => String(w.url || "")).filter(Boolean)
    : [];
  const socials = Array.isArray(info.socials)
    ? (info.socials as Array<Record<string, unknown>>)
        .map((s) => ({ type: String(s.type || ""), url: String(s.url || "") }))
        .filter((s) => s.type && s.url)
    : [];
  return {
    dexId: (p.dexId as string) || undefined,
    pairAddress: (p.pairAddress as string) || undefined,
    url: (p.url as string) || undefined,
    priceUsd: n(p.priceUsd),
    marketCap: n(p.marketCap),
    fdv: n(p.fdv),
    liquidityUsd: n(liq.usd),
    volumeM5: n(vol.m5),
    volumeH1: n(vol.h1),
    volumeH6: n(vol.h6),
    volumeH24: n(vol.h24),
    txnsM5Buys: n(tx.m5?.buys),
    txnsM5Sells: n(tx.m5?.sells),
    txnsH1Buys: n(tx.h1?.buys),
    txnsH1Sells: n(tx.h1?.sells),
    txnsH6Buys: n(tx.h6?.buys),
    txnsH6Sells: n(tx.h6?.sells),
    txnsH24Buys: n(tx.h24?.buys),
    txnsH24Sells: n(tx.h24?.sells),
    changeM5: n(ch.m5),
    changeH1: n(ch.h1),
    changeH6: n(ch.h6),
    changeH24: n(ch.h24),
    pairCreatedAt: typeof p.pairCreatedAt === "number" ? p.pairCreatedAt : null,
    quoteSymbol: ((p.quoteToken as Record<string, unknown> | undefined)?.symbol as string) || undefined,
    websites: websites.length ? websites : undefined,
    socials: socials.length ? socials : undefined,
  };
}

/** Normalize a raw DexScreener `/latest/dex/tokens` response: Solana pairs for
 *  this mint only (base token must be the mint), deepest liquidity first. */
export function normalizeDexPairs(raw: unknown, mint: string): DexPair[] {
  if (!raw || typeof raw !== "object") return [];
  const list = (raw as Record<string, unknown>).pairs;
  if (!Array.isArray(list)) return [];
  const mintLower = mint.toLowerCase();
  return list
    .filter((p) => {
      const r = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
      const base = (r.baseToken && typeof r.baseToken === "object" ? r.baseToken : {}) as Record<string, unknown>;
      return String(r.chainId || "").toLowerCase() === "solana" && String(base.address || "").toLowerCase() === mintLower;
    })
    .map((p) => normalizeDexPair(p))
    .filter((p): p is DexPair => p != null)
    .sort((a, b) => (b.liquidityUsd || 0) - (a.liquidityUsd || 0));
}

/** Direct DexScreener public API (no key, CORS-enabled — same pattern as
 *  PairTracker). Fail-soft: callers catch; a failure just means the 5m/1h
 *  volume + txn windows stay unknown. */
export async function fetchDexPairs(mint: string): Promise<DexPair[]> {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`dexscreener → ${res.status}`);
  const raw = await res.json();
  return normalizeDexPairs(raw, mint);
}

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
  const fdv = Number(nested.fdv ?? meta.fdv ?? NaN);
  const holderCount = Number(nested.holderCount ?? meta.holderCount ?? NaN);
  const ageDays = Number(nested.ageDays ?? meta.ageDays ?? NaN);
  const ch5 = Number(nested.change5m ?? NaN);
  const ch1 = Number(nested.change1h ?? NaN);
  const ch6 = Number(nested.change6h ?? NaN);
  const ch24 = Number(nested.change24h ?? NaN);
  const athPrice = Number((root.athPrice as number | undefined) ?? (meta.athPrice as number | undefined) ?? NaN);
  const athMcap = Number((root.athMcap as number | undefined) ?? (meta.athMcap as number | undefined) ?? NaN);
  // Backend-mapped pairs (24h window only) → DexPair shape.
  const pairsRaw = Array.isArray(root.pairs) ? root.pairs : [];
  const pairs: DexPair[] = pairsRaw
    .map((row) => {
      const r = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
      const liqUsd = Number(r.liquidity ?? NaN);
      return {
        dexId: (r.dex as string) || undefined,
        pairAddress: (r.address as string) || undefined,
        priceUsd: Number.isFinite(Number(r.priceUsd)) ? Number(r.priceUsd) : undefined,
        liquidityUsd: Number.isFinite(liqUsd) ? liqUsd : undefined,
        volumeH24: Number.isFinite(Number(r.volume24h)) ? Number(r.volume24h) : undefined,
        changeH24: Number.isFinite(Number(r.change24h)) ? Number(r.change24h) : undefined,
        txnsH24Buys: Number.isFinite(Number(r.txnsBuys)) ? Number(r.txnsBuys) : undefined,
        txnsH24Sells: Number.isFinite(Number(r.txnsSells)) ? Number(r.txnsSells) : undefined,
      } as DexPair;
    })
    .filter((p) => p.dexId || p.pairAddress);
  const metaSocials = (meta.socials && typeof meta.socials === "object" ? meta.socials : {}) as Record<string, unknown>;
  const socials: TokenSocials = {
    website: typeof metaSocials.website === "string" ? metaSocials.website : undefined,
    twitter: typeof metaSocials.twitter === "string" ? metaSocials.twitter : undefined,
    telegram: typeof metaSocials.telegram === "string" ? metaSocials.telegram : undefined,
    discord: typeof metaSocials.discord === "string" ? metaSocials.discord : undefined,
  };
  const hasSocials = Object.values(socials).some((v) => !!v);
  const firstPool =
    nested.firstPool && typeof nested.firstPool === "object"
      ? { id: String((nested.firstPool as Record<string, unknown>).id || "") || undefined }
      : null;
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
    fdv: Number.isFinite(fdv) ? fdv : undefined,
    holderCount: Number.isFinite(holderCount) ? holderCount : null,
    createdAt: (nested.createdAt as string | undefined) ?? (meta.createdAt as string | undefined) ?? null,
    ageDays: Number.isFinite(ageDays) ? ageDays : null,
    change5m: Number.isFinite(ch5) ? ch5 : undefined,
    change1h: Number.isFinite(ch1) ? ch1 : undefined,
    change6h: Number.isFinite(ch6) ? ch6 : undefined,
    change24h: Number.isFinite(ch24) ? ch24 : undefined,
    firstPool,
    pairDexId: (meta.pairDexId as string | undefined) ?? null,
    athPrice: Number.isFinite(athPrice) ? athPrice : null,
    athMcap: Number.isFinite(athMcap) ? athMcap : null,
    pairs: pairs.length ? pairs : undefined,
    socials: hasSocials ? socials : undefined,
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

/** Clone / copycat token from /api/ogdex/research (DexScreener search by
 *  symbol/name, same chain, different mint). */
export type CloneToken = {
  mint?: string;
  name?: string;
  symbol?: string;
  mcap?: number;
  volume24h?: number;
  liquidity?: number;
  launchTime?: number | null;
  dexUrl?: string;
  price?: number;
};

export type ResearchPayload = {
  ok?: boolean;
  clones?: CloneToken[];
  links?: {
    website?: string;
    twitter?: string;
    telegram?: string;
    dex?: string;
    birdeye?: string;
    solscan?: string;
  };
  launch?: {
    deployer?: string | null;
    platform?: string;
    launchTime?: number | null;
    graduated?: boolean | null;
  };
  description?: string;
};

/** Normalize the /api/ogdex/research response into the scanner's clone +
 *  links + launch shape. Returns null when the payload is unusable. */
export function normalizeResearch(raw: unknown): ResearchPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const meta = (r.meta && typeof r.meta === "object" ? r.meta : {}) as Record<string, unknown>;
  const links = (meta.links && typeof meta.links === "object" ? meta.links : {}) as Record<string, unknown>;
  const launch = (r.launch && typeof r.launch === "object" ? r.launch : {}) as Record<string, unknown>;
  const clonesRaw = Array.isArray(r.clones) ? r.clones : [];
  const clones: CloneToken[] = clonesRaw
    .map((c) => {
      const x = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
      const n = (v: unknown): number | undefined => {
        const vNum = Number(v);
        return Number.isFinite(vNum) ? vNum : undefined;
      };
      return {
        mint: (x.mint as string) || undefined,
        name: (x.name as string) || undefined,
        symbol: (x.symbol as string) || undefined,
        mcap: n(x.mcap),
        volume24h: n(x.volume24h),
        liquidity: n(x.liquidity),
        launchTime: typeof x.launchTime === "number" ? x.launchTime : null,
        dexUrl: (x.dexUrl as string) || undefined,
        price: n(x.price),
      };
    })
    .filter((c) => c.mint);
  const pick = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
  return {
    ok: r.ok !== false,
    clones,
    links: {
      website: pick(links.website),
      twitter: pick(links.twitter),
      telegram: pick(links.telegram),
      dex: pick(links.dex),
      birdeye: pick(links.birdeye),
      solscan: pick(links.solscan),
    },
    launch: {
      deployer: typeof launch.deployer === "string" ? launch.deployer : null,
      platform: pick(launch.platform),
      launchTime: typeof launch.launchTime === "number" ? launch.launchTime : null,
      graduated: typeof launch.graduated === "boolean" ? launch.graduated : null,
    },
    description: pick(meta.description),
  };
}

export async function fetchResearchTyped(mint: string): Promise<ResearchPayload | null> {
  const raw = await fetchResearch(mint);
  return normalizeResearch(raw);
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
