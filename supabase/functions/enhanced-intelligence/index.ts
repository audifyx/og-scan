import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { resolveModel } from "../_shared/models.ts";
import { GRIM_BASE } from "../_shared/grim_base.ts";

// ── Config ──────────────────────────────────────────────────────────────────
const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY") || "";
const NVIDIA_API_BASE = Deno.env.get("NVIDIA_BASE_URL") || "https://integrate.api.nvidia.com/v1";
const MODEL = Deno.env.get("NVIDIA_MODEL") || "meta/llama-3.3-70b-instruct";

const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY") || "";
const BIRDEYE_API_KEY = Deno.env.get("BIRDEYE_API_KEY") || "";
const JUPITER_API_KEY = Deno.env.get("JUPITER_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── HTTP helpers (with timeout) ──────────────────────────────────────────────
async function fetchJson(url: string, opts: RequestInit = {}, timeoutMs = 8000): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) return null;
    try { return JSON.parse(text); } catch { return null; }
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchText(url: string, opts: RequestInit = {}, timeoutMs = 9000): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function decodeXml(x: string) {
  return (x || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, "").trim();
}

const isMint = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test((s || "").trim());
const num = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v));

// ── Data sources ─────────────────────────────────────────────────────────────
async function dexByMint(mint: string) {
  const d = await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
  const pairs = (d?.pairs || []).filter((p: any) => p?.chainId === "solana" || !p?.chainId);
  if (!pairs.length) return null;
  const top = pairs.slice().sort((a: any, b: any) => (b?.liquidity?.usd || 0) - (a?.liquidity?.usd || 0))[0];
  const shaped = shapeDexPair(top, pairs.length);
  if (shaped) {
    // Aggregate across ALL pairs for true totals (single-pair values are misleading for multi-pair tokens)
    shaped.liquidityUsd = pairs.reduce((acc: number, p: any) => acc + (p?.liquidity?.usd || 0), 0);
    shaped.volume24h = pairs.reduce((acc: number, p: any) => acc + (p?.volume?.h24 || 0), 0);
  }
  return shaped;
}
async function dexSearch(q: string) {
  const d = await fetchJson(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`);
  const pairs = (d?.pairs || []).filter((p: any) => p?.chainId === "solana");
  if (!pairs.length) return null;
  const top = pairs.slice().sort((a: any, b: any) => (b?.liquidity?.usd || 0) - (a?.liquidity?.usd || 0))[0];
  return shapeDexPair(top, pairs.length);
}
async function dexFindMint(q: string): Promise<string | null> {
  // Resolve a symbol/name to the canonical mint = the highest-24h-VOLUME Solana pair
  // (sorting by liquidity is gameable by scam pairs with fake liquidity).
  const d = await fetchJson(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`);
  const pairs = (d?.pairs || []).filter((p: any) => p?.chainId === "solana" && p?.baseToken?.address);
  if (!pairs.length) return null;
  pairs.sort((a: any, b: any) => (b?.volume?.h24 || 0) - (a?.volume?.h24 || 0));
  return pairs[0].baseToken.address;
}

function shapeDexPair(p: any, pairCount: number) {
  if (!p) return null;
  return {
    source: "dexscreener",
    mint: p.baseToken?.address,
    name: p.baseToken?.name,
    symbol: p.baseToken?.symbol,
    priceUsd: num(p.priceUsd),
    marketCap: num(p.marketCap),
    fdv: num(p.fdv),
    liquidityUsd: num(p.liquidity?.usd),
    volume24h: num(p.volume?.h24),
    priceChange: { m5: num(p.priceChange?.m5), h1: num(p.priceChange?.h1), h24: num(p.priceChange?.h24) },
    txns24h: p.txns?.h24 ? { buys: p.txns.h24.buys, sells: p.txns.h24.sells } : null,
    pairCreatedAt: p.pairCreatedAt || null,
    ageDays: p.pairCreatedAt ? Math.floor((Date.now() - p.pairCreatedAt) / 86400000) : null,
    socials: Array.isArray(p.info?.socials) ? p.info.socials.map((x: any) => ({ type: x.type, url: x.url })) : [],
    websites: Array.isArray(p.info?.websites) ? p.info.websites.map((w: any) => w.url) : [],
    imageUrl: p.info?.imageUrl || null,
    dex: p.dexId,
    pairAddress: p.pairAddress || null,
    pairCount,
    url: p.url,
  };
}

async function birdeyeOverview(mint: string) {
  if (!BIRDEYE_API_KEY) return null;
  const d = await fetchJson(
    `https://public-api.birdeye.so/defi/token_overview?address=${mint}`,
    { headers: { "X-API-KEY": BIRDEYE_API_KEY, "x-chain": "solana", accept: "application/json" } },
  );
  const r = d?.data;
  if (!r) return null;
  return {
    source: "birdeye",
    name: r.name,
    symbol: r.symbol,
    priceUsd: num(r.price),
    marketCap: num(r.marketCap ?? r.mc),
    liquidityUsd: num(r.liquidity),
    volume24h: num(r.v24hUSD),
    priceChange24h: num(r.priceChange24hPercent),
    holders: num(r.holder),
    supply: num(r.supply),
    decimals: num(r.decimals),
  };
}

async function birdeyeHolders(mint: string) {
  if (!BIRDEYE_API_KEY) return null;
  const d = await fetchJson(
    `https://public-api.birdeye.so/defi/v3/token/holder?address=${mint}&offset=0&limit=10`,
    { headers: { "X-API-KEY": BIRDEYE_API_KEY, "x-chain": "solana", accept: "application/json" } },
  );
  const items = d?.data?.items;
  if (!Array.isArray(items)) return null;
  return items.slice(0, 10).map((h: any) => ({ owner: h.owner, amount: num(h.ui_amount ?? h.amount), pct: num(h.percentage) }));
}

async function heliusAsset(mint: string) {
  if (!HELIUS_API_KEY) return null;
  const d = await fetchJson(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "1", method: "getAsset", params: { id: mint } }),
  });
  const r = d?.result;
  if (!r) return null;
  return {
    source: "helius",
    name: r.content?.metadata?.name,
    symbol: r.content?.metadata?.symbol,
    supply: num(r.token_info?.supply),
    decimals: num(r.token_info?.decimals),
    priceUsd: num(r.token_info?.price_info?.price_per_token),
    image: r.content?.links?.image,
  };
}

async function jupiterPrice(mint: string) {
  const headers: Record<string, string> = { accept: "application/json" };
  if (JUPITER_API_KEY) headers["x-api-key"] = JUPITER_API_KEY;
  // Jupiter Price API v3 (v2 was removed). Shape: { [mint]: { usdPrice, priceChange24h, decimals, liquidity } }
  const d = await fetchJson(`https://api.jup.ag/price/v3?ids=${mint}`, { headers })
    || await fetchJson(`https://lite-api.jup.ag/price/v3?ids=${mint}`, { headers: { accept: "application/json" } });
  const p = d?.[mint];
  if (!p) return null;
  return {
    source: "jupiter",
    priceUsd: num(p.usdPrice),
    decimals: num(p.decimals),
  };
}

async function heliusWallet(address: string) {
  if (!HELIUS_API_KEY) return null;
  const rpc = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
  const [assetsRes, solRes, txs] = await Promise.all([
    // DAS: fungible token holdings (amount, symbol, price when known)
    fetchJson(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "1", method: "getAssetsByOwner", params: { ownerAddress: address, page: 1, limit: 1000, displayOptions: { showFungible: true, showNativeBalance: true } } }),
    }, 12000),
    fetchJson(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "2", method: "getBalance", params: [address] }),
    }, 8000),
    fetchJson(`https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}&limit=10`, {}, 10000),
  ]);

  const items = assetsRes?.result?.items;
  let solBalance: number | null = null;
  const nativeLamports = assetsRes?.result?.nativeBalance?.lamports;
  if (typeof nativeLamports === "number") solBalance = nativeLamports / 1e9;
  else if (typeof solRes?.result?.value === "number") solBalance = solRes.result.value / 1e9;
  else if (typeof solRes?.result === "number") solBalance = solRes.result / 1e9;

  let topTokens: any[] = [];
  let tokenCount: number | null = null;
  if (Array.isArray(items)) {
    const fungible = items.filter((it: any) => (it.interface === "FungibleToken" || it.interface === "FungibleAsset") && it.token_info);
    tokenCount = fungible.length;
    topTokens = fungible.map((it: any) => {
      const ti = it.token_info || {};
      const dec = ti.decimals || 0;
      const amount = typeof ti.balance === "number" ? ti.balance / Math.pow(10, dec) : null;
      const price = ti.price_info?.price_per_token ?? null;
      const valueUsd = ti.price_info?.total_price ?? (price != null && amount != null ? price * amount : null);
      return { mint: it.id, symbol: ti.symbol || it.content?.metadata?.symbol || null, name: it.content?.metadata?.name || null, amount, priceUsd: price, valueUsd };
    });
  }

  if (!items && solBalance == null && !Array.isArray(txs)) return null;
  return {
    source: "helius",
    solBalance,
    tokenCount,
    topTokens,
    recentTx: Array.isArray(txs)
      ? txs.slice(0, 10).map((t: any) => ({ type: t.type, source: t.source, ts: t.timestamp, desc: (t.description || "").slice(0, 140) }))
      : null,
  };
}


// Per-token swap history from Helius (last 100 SWAP txs): first-buy timing,
// buy/sell counts, SOL flows. Parses tokenTransfers/nativeTransfers (events.swap
// is null on the free Helius plan). "When they bought" within the recent window.
const SOL_MINT = "So11111111111111111111111111111111111111112";
async function heliusSwapHistory(address: string) {
  if (!HELIUS_API_KEY) return {} as Record<string, any>;
  const txs = await fetchJson(`https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}&type=SWAP&limit=100`, {}, 12000);
  if (!Array.isArray(txs)) return {} as Record<string, any>;
  const per: Record<string, any> = {};
  const touch = (m: string, ts: number | null) => {
    per[m] = per[m] || { buys: 0, sells: 0, firstTs: null, lastTs: null, solSpent: 0, solRecv: 0 };
    if (ts) {
      if (!per[m].firstTs || ts < per[m].firstTs) per[m].firstTs = ts;
      if (!per[m].lastTs || ts > per[m].lastTs) per[m].lastTs = ts;
    }
  };
  for (const t of txs) {
    const ts = t.timestamp || null;
    const tts: any[] = Array.isArray(t.tokenTransfers) ? t.tokenTransfers : [];
    const nts: any[] = Array.isArray(t.nativeTransfers) ? t.nativeTransfers : [];

    // Owner's SOL legs this tx (wrapped-SOL token transfers + native transfers).
    let solOut = 0; // SOL leaving owner (spent on a buy)
    let solIn = 0;  // SOL arriving to owner (received from a sell)
    for (const tr of tts) {
      if (tr?.mint !== SOL_MINT) continue;
      const amt = Number(tr.tokenAmount) || 0;
      if (tr.fromUserAccount === address) solOut += amt;
      if (tr.toUserAccount === address) solIn += amt;
    }
    for (const nt of nts) {
      const amt = (Number(nt.amount) || 0) / 1e9;
      if (nt.fromUserAccount === address) solOut += amt;
      if (nt.toUserAccount === address) solIn += amt;
    }

    // Non-SOL mints the owner received (buys) / sent (sells) this tx.
    const bought: string[] = [];
    const sold: string[] = [];
    for (const tr of tts) {
      const m = tr?.mint;
      if (!m || m === SOL_MINT) continue;
      if (tr.toUserAccount === address) bought.push(m);
      if (tr.fromUserAccount === address) sold.push(m);
    }
    // Attribute SOL flow proportionally across distinct mints in each leg.
    const uniqBuy = [...new Set(bought)];
    const uniqSell = [...new Set(sold)];
    for (const m of uniqBuy) { touch(m, ts); per[m].buys++; per[m].solSpent += uniqBuy.length ? solOut / uniqBuy.length : 0; }
    for (const m of uniqSell) { touch(m, ts); per[m].sells++; per[m].solRecv += uniqSell.length ? solIn / uniqSell.length : 0; }
  }
  return per;
}

function buildTokenCard(merged: any, activity: any, riskLevel: string | null) {
  if (!merged || !merged.mint) return null;
  return {
    mint: merged.mint,
    name: merged.name || null,
    symbol: merged.symbol || null,
    priceUsd: merged.priceUsd ?? null,
    marketCap: merged.marketCap ?? null,
    liquidityUsd: merged.liquidityUsd ?? activity?.liquidityUsd ?? null,
    volume24h: merged.volume24h ?? activity?.volume24h ?? null,
    holders: merged.holders ?? null,
    ageDays: merged.ageDays ?? activity?.ageDays ?? null,
    image: merged.imageUrl || null,
    socials: merged.socials || [],
    websites: merged.websites || [],
    dexUrl: merged.url || activity?.url || null,
    riskLevel: riskLevel || null,
  };
}

function buildChart(activity: any) {
  const pair = activity?.pairAddress;
  if (!pair) return null;
  return {
    pairAddress: pair,
    url: activity?.url || `https://dexscreener.com/solana/${pair}`,
    embedUrl: `https://dexscreener.com/solana/${pair}?embed=1&loadChartSettings=0&theme=dark&info=0&trades=0`,
  };
}

async function enrichHoldings(tokens: any[]) {
  const list = (tokens || []).slice(0, 8);
  const out = await Promise.all(list.map(async (t: any) => {
    let price = t.priceUsd ?? null;
    let symbol = t.symbol ?? null;
    let name = t.name ?? null;
    let marketCap: any = null;
    if (price == null || symbol == null) {
      const dex = await dexByMint(t.mint).catch(() => null);
      price = price ?? dex?.priceUsd ?? null;
      symbol = symbol ?? dex?.symbol ?? null;
      name = name ?? dex?.name ?? null;
      marketCap = dex?.marketCap ?? null;
      if (price == null) { const jp = await jupiterPrice(t.mint).catch(() => null); price = jp?.priceUsd ?? null; }
    }
    const valueUsd = t.valueUsd ?? (price != null && t.amount != null ? price * t.amount : null);
    return { mint: t.mint, symbol, name, amount: t.amount ?? null, priceUsd: price, valueUsd, marketCap };
  }));
  return out.sort((a: any, b: any) => (b.valueUsd || 0) - (a.valueUsd || 0));
}

function mergeToken(parts: any[]) {
  const out: Record<string, any> = { sources: [] };
  for (const p of parts) {
    if (!p) continue;
    out.sources.push(p.source);
    for (const [k, v] of Object.entries(p)) {
      if (k === "source") continue;
      if (out[k] === undefined || out[k] === null || out[k] === "") out[k] = v;
    }
  }
  return out.sources.length ? out : null;
}

// Crypto X/news spam + scam patterns (engagement farming, phishing, airdrop bait, etc.)
const SCAM_RE = /(vote\s*(for|now|us)|moonshot\s*vote|\bvote\b.{0,20}(list|moonshot|win)|airdrop|claim\s*(your|now|free|reward)|free\s*(mint|sol|tokens?|crypto|nft|airdrop)|g|giveaway|presale|guaranteed|\b1?0{2,}x\b|connect\s*(your\s*)?wallet|verify\s*(your\s*)?wallet|drain|dm\s*me|send\s*\d+\s*sol|double\s*your|whitelist|\bWL\b|follow.{0,18}retweet|like.{0,18}retweet|retweet.{0,18}follow|join\s*(the\s*)?(telegram|presale|raid)|t\.me\/|bit\.ly\/|tinyurl|\bclaim\b.{0,15}\b(now|here)\b)/i;
function isScamText(t: string) { return SCAM_RE.test(t || ""); }

function fmtUsd(n: any) {
  const x = Number(n);
  if (!isFinite(x)) return "?";
  const a = Math.abs(x);
  if (a >= 1e9) return "$" + (x / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return "$" + (x / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return "$" + (x / 1e3).toFixed(1) + "K";
  return "$" + x.toFixed(2);
}

// Deterministic Scam-Defense risk score (mirrors the OG SCAN AI Constitution).
function computeRisk(merged: any, safety: any, activity: any, xbuzz: any) {
  let score = 0;
  const flags: string[] = [];
  const goods: string[] = [];
  if (safety) {
    if (safety.mintAuthorityRenounced === false) { score += 40; flags.push("Mint authority LIVE — unlimited supply can be minted"); }
    else if (safety.mintAuthorityRenounced === true) goods.push("Mint authority renounced");
    if (safety.freezeAuthorityRenounced === false) { score += 30; flags.push("Freeze authority ACTIVE — your tokens can be frozen / sells halted"); }
    else if (safety.freezeAuthorityRenounced === true) goods.push("Freeze authority renounced");
    const lp = safety.lpLockedPct;
    if (safety.isPumpFun) { goods.push("Pump.fun launch — LP locked/burned by default (bonding curve)"); }
    else if (lp != null) { if (lp < 50) { score += 35; flags.push(`LP only ${lp}% locked — liquidity can be pulled`); } else goods.push(`LP ${lp}% locked/burned`); }
    // top10HolderPct already EXCLUDES the liquidity pool — these are real wallets.
    const top10 = safety.top10HolderPct;
    if (top10 != null && top10 > 40) { score += 25; flags.push(`Top-10 real wallets hold ${top10}% (LP excluded) — heavy insider concentration`); }
    else if (top10 != null) goods.push(`Top-10 real wallets hold ${top10}% (LP excluded) — reasonably spread`);
    if (Array.isArray(safety.risks)) for (const r of safety.risks) { if (/danger|high/i.test(String(r.level))) { score += 10; flags.push(`RugCheck: ${r.name}`); } }
  }
  const liq = merged?.liquidityUsd ?? activity?.liquidityUsd;
  const mc = merged?.marketCap;
  if (liq != null && mc && liq < mc * 0.05) { score += 20; flags.push(`Thin liquidity ${fmtUsd(liq)} vs market cap ${fmtUsd(mc)} — easy to manipulate`); }
  const age = merged?.ageDays ?? activity?.ageDays;
  if (age != null && age < 3) { score += 15; flags.push(`Only ${age}d old — unproven, peak rug window`); }
  if (xbuzz && xbuzz.mostlySpam) { score += 10; flags.push("X buzz is mostly scam/bot spam — manufactured hype, not organic"); }
  const level = score >= 50 ? "HIGH" : (score >= 25 ? "MEDIUM" : "LOW");
  return { level, score, flags, goods };
}


async function rugcheck(mint: string) {
  const d = await fetchJson(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`, {}, 10000);
  if (!d) return null;

  // The #1 "holder" is almost always the liquidity pool / AMM, NOT a whale.
  // Identify pool/LP accounts so we can EXCLUDE them from real-wallet
  // concentration. RugCheck tags them in knownAccounts (type AMM) and exposes
  // the market liquidity vault accounts.
  const known: Record<string, any> = d.knownAccounts || {};
  const markets: any[] = Array.isArray(d.markets) ? d.markets : [];
  const lpAddrs = new Set<string>();
  for (const m of markets) {
    if (typeof m?.pubkey === "string") lpAddrs.add(m.pubkey);
    for (const f of ["liquidityAAccount", "liquidityBAccount", "mintLPAccount"]) {
      const v = m?.[f];
      if (typeof v === "string") lpAddrs.add(v);
      else if (v && typeof v === "object" && v.owner) lpAddrs.add(v.owner);
    }
  }
  const isPool = (h: any) => {
    const addr = h?.address || "";
    const owner = h?.owner || "";
    const ka = known[addr] || known[owner];
    if (ka && /amm|lp|liquidity|pool|market|raydium|meteora|orca|pump/i.test(`${ka.type || ""} ${ka.name || ""}`)) return true;
    if (owner && lpAddrs.has(owner)) return true;
    if (addr && lpAddrs.has(addr)) return true;
    return false;
  };

  const holders: any[] = Array.isArray(d.topHolders) ? d.topHolders : [];
  const realHolders = holders.filter((h) => !isPool(h));
  const poolHolders = holders.filter((h) => isPool(h));
  const sumPct = (arr: any[], n: number) =>
    arr.length ? Math.round(arr.slice(0, n).reduce((a: number, h: any) => a + (h.pct || 0), 0) * 100) / 100 : null;

  const launchpadName = d.launchpad?.name || null;
  const launchpadPlatform = (d.launchpad?.platform || "").toLowerCase();
  const isPumpFun = launchpadPlatform.includes("pump") || (mint || "").toLowerCase().endsWith("pump");

  // pump.fun locks/burns LP by default (bonding curve, and LP burned on
  // graduation). Treat as locked when RugCheck doesn't report a number.
  let lpLockedPct = num(d.markets?.[0]?.lp?.lpLockedPct);
  if (lpLockedPct == null && isPumpFun) lpLockedPct = 100;

  return {
    source: "rugcheck",
    riskScore: num(d.score_normalised ?? d.score), // lower = safer
    risks: Array.isArray(d.risks) ? d.risks.slice(0, 8).map((r: any) => ({ name: r.name, level: r.level, desc: r.description })) : [],
    mintAuthorityRenounced: d.mintAuthority == null,
    freezeAuthorityRenounced: d.freezeAuthority == null,
    lpLockedPct,
    isPumpFun,
    launchpad: launchpadName || (isPumpFun ? "Pump.fun" : null),
    top10HolderPct: sumPct(realHolders, 10),   // REAL wallets only — LP/pool excluded
    lpHolderPct: sumPct(poolHolders, poolHolders.length), // how much the pool holds (info, NOT concentration)
    totalHolders: num(d.totalHolders),
    rugged: d.rugged ?? null,
  };
}

async function googleNews(query: string) {
  const xml = await fetchText(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`);
  if (!xml) return [];
  const items: any[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && items.length < 6) {
    const blk = m[1];
    const title = decodeXml((blk.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
    const link = decodeXml((blk.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "");
    const date = decodeXml((blk.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || "");
    const source = decodeXml((blk.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || "");
    if (title && !isScamText(title)) items.push({ title, link, date, source });
  }
  return items;
}

async function xSearch(query: string) {
  const bearer = Deno.env.get("X_BEARER_TOKEN") || Deno.env.get("TWITTER_BEARER_TOKEN") || "";
  if (!bearer) return null;
  const q = encodeURIComponent(`${query} -is:retweet lang:en`);
  const d = await fetchJson(
    `https://api.twitter.com/2/tweets/search/recent?query=${q}&max_results=10&tweet.fields=public_metrics,created_at`,
    { headers: { Authorization: `Bearer ${bearer}` } },
    9000,
  );
  if (!d?.data) return null;
  let tweets = d.data.map((t: any) => ({
    text: (t.text || "").replace(/\s+/g, " ").slice(0, 220),
    likes: t.public_metrics?.like_count ?? 0,
    retweets: t.public_metrics?.retweet_count ?? 0,
    date: t.created_at,
  }));
  const scanned = tweets.length;
  // Dedupe near-identical (bot spam often posts the same copy)
  const seen = new Set<string>();
  tweets = tweets.filter((tw: any) => {
    const k = tw.text.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
    if (seen.has(k)) return false; seen.add(k); return true;
  });
  const clean = tweets.filter((tw: any) => !isScamText(tw.text));
  const spamFilteredOut = scanned - clean.length;
  const totalEngagement = clean.reduce((a: number, t: any) => a + t.likes + t.retweets, 0);
  return {
    scannedCount: scanned,
    realCount: clean.length,
    spamFilteredOut,
    mostlySpam: scanned > 0 && spamFilteredOut / scanned >= 0.5,
    totalEngagement,
    topTweets: clean.sort((a: any, b: any) => (b.likes + b.retweets) - (a.likes + a.retweets)).slice(0, 6),
  };
}

// ── Free macro market data (no key): CoinGecko + Fear&Greed ──────────────────
async function macroSnapshot(): Promise<string> {
  try {
    const [g, p, f] = await Promise.all([
      fetch("https://api.coingecko.com/api/v3/global", { signal: AbortSignal.timeout(7000) }).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true", { signal: AbortSignal.timeout(7000) }).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch("https://api.alternative.me/fng/?limit=1", { signal: AbortSignal.timeout(7000) }).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);
    const parts: string[] = [];
    if (p) {
      const fmt = (o: any) => o ? `$${Number(o.usd).toLocaleString(undefined, { maximumFractionDigits: 2 })} (${o.usd_24h_change >= 0 ? "+" : ""}${Number(o.usd_24h_change).toFixed(2)}% 24h)` : "?";
      parts.push(`BTC ${fmt(p.bitcoin)}, ETH ${fmt(p.ethereum)}, SOL ${fmt(p.solana)}`);
    }
    if (g?.data) {
      const d = g.data;
      parts.push(`Total MC $${(d.total_market_cap?.usd / 1e9).toFixed(0)}B (${d.market_cap_change_percentage_24h_usd >= 0 ? "+" : ""}${Number(d.market_cap_change_percentage_24h_usd).toFixed(2)}% 24h), BTC dominance ${d.market_cap_percentage?.btc?.toFixed(1)}%`);
    }
    if (f?.data?.[0]) parts.push(`Fear & Greed: ${f.data[0].value}/100 (${f.data[0].value_classification})`);
    return parts.join(" | ");
  } catch { return ""; }
}

// ── Tool definitions exposed to the model ────────────────────────────────────
const TOOLS = [
  { name: "lookupToken", description: "Look up a Solana token's live market data (price, market cap, FDV, liquidity, 24h volume/price change, holders, supply) by mint address, symbol, or name. Aggregates DexScreener, Birdeye, Helius, Jupiter and the internal tokens DB.", parameters: { type: "object", properties: { query: { type: "string", description: "Mint address, symbol, or name" } }, required: ["query"] } },
  { name: "getTokenPrice", description: "Get the current USD price (and 24h change) of a Solana token quickly by mint, symbol, or name.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "getHolderData", description: "Get holder count and top holder distribution for a Solana token mint.", parameters: { type: "object", properties: { mint: { type: "string" } }, required: ["mint"] } },
  { name: "getTokenActivity", description: "Get recent trading activity for a Solana token: 24h volume, buys/sells, and price change across 5m/1h/24h.", parameters: { type: "object", properties: { mint: { type: "string" } }, required: ["mint"] } },
  { name: "getWalletData", description: "Get a Solana wallet's SOL balance, token holdings, and recent transactions.", parameters: { type: "object", properties: { address: { type: "string" } }, required: ["address"] } },
  { name: "checkTokenSafety", description: "Run a rug/safety check on a Solana token mint: RugCheck risk score, mint/freeze authority status, LP locked %, top-10 holder concentration, and specific risk flags. Use this for 'is it safe', 'is it a rug', 'is it legit/OG'.", parameters: { type: "object", properties: { mint: { type: "string" } }, required: ["mint"] } },
  { name: "searchNews", description: "Search recent news headlines (Google News) about a token, project, person, or crypto topic. Use for 'why is it viral', 'what's the news', project background.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "searchX", description: "Search recent X/Twitter posts and engagement about a token, ticker, or topic to gauge social buzz, sentiment, and why something is trending/viral.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
];

async function resolveToken(query: string, supabase: any) {
  // internal DB first (may carry extra fields), then external sources
  let dbRow: any = null;
  try {
    const { data } = await supabase
      .from("tokens")
      .select("mint,name,symbol,current_price,market_cap,holders_count,top_10_holders_pct")
      .or(`mint.eq.${query},name.ilike.%${query}%,symbol.ilike.%${query}%`)
      .limit(1)
      .maybeSingle();
    dbRow = data;
  } catch { /* ignore */ }

  let resolvedMint = isMint(query) ? query.trim() : dbRow?.mint || null;
  if (!resolvedMint) resolvedMint = await dexFindMint(query);
  const dex = resolvedMint ? await dexByMint(resolvedMint) : null;

  const [be, hx, jp] = await Promise.all([
    resolvedMint ? birdeyeOverview(resolvedMint) : Promise.resolve(null),
    resolvedMint ? heliusAsset(resolvedMint) : Promise.resolve(null),
    resolvedMint ? jupiterPrice(resolvedMint) : Promise.resolve(null),
  ]);

  const dbPart = dbRow
    ? { source: "internal-db", mint: dbRow.mint, name: dbRow.name, symbol: dbRow.symbol, priceUsd: num(dbRow.current_price), marketCap: num(dbRow.market_cap), holders: num(dbRow.holders_count), top10Pct: num(dbRow.top_10_holders_pct) }
    : null;

  const merged = mergeToken([jp, be, dex, hx, dbPart]);
  if (merged) {
    // Prefer Birdeye market cap; otherwise compute from authoritative price * UI supply.
    const price = num(jp?.priceUsd) ?? num(be?.priceUsd) ?? num(merged.priceUsd);
    const beMc = num(be?.marketCap);
    let uiSupply: number | null = null;
    if (num(be?.supply) != null) uiSupply = num(be?.supply);
    else if (num(hx?.supply) != null && num(hx?.decimals) != null) uiSupply = (num(hx?.supply) as number) / Math.pow(10, num(hx?.decimals) as number);
    const computedMc = price != null && uiSupply != null ? price * uiSupply : null;
    merged.marketCap = beMc ?? computedMc ?? num(merged.marketCap);
    if (price != null) merged.priceUsd = price;
    merged.circulatingSupply = uiSupply;
  }
  return { merged, mint: resolvedMint };
}

async function executeTool(toolName: string, params: any, supabase: any): Promise<string> {
  try {
    if (toolName === "lookupToken") {
      const { merged } = await resolveToken(String(params.query || ""), supabase);
      return JSON.stringify(merged || { error: "Token not found across DexScreener, Birdeye, Helius, Jupiter, or internal DB" });
    }

    if (toolName === "getTokenPrice") {
      const q = String(params.query || "");
      const mint = isMint(q) ? q : await dexFindMint(q);
      if (!mint) return JSON.stringify({ error: "Token not found" });
      const [jp, dex, be] = await Promise.all([jupiterPrice(mint), dexByMint(mint), birdeyeOverview(mint)]);
      const priceUsd = jp?.priceUsd ?? dex?.priceUsd ?? be?.priceUsd ?? null;
      if (priceUsd == null) return JSON.stringify({ error: "Price unavailable" });
      return JSON.stringify({ mint, priceUsd, priceChange24h: dex?.priceChange?.h24 ?? be?.priceChange24h ?? null, source: jp ? "jupiter" : dex ? "dexscreener" : "birdeye" });
    }

    if (toolName === "getHolderData") {
      const mint = String(params.mint || "");
      if (!isMint(mint)) return JSON.stringify({ error: "Valid mint address required" });
      let dbHolders: number | null = null, dbTop10: number | null = null;
      try {
        const { data } = await supabase.from("tokens").select("holders_count, top_10_holders_pct").eq("mint", mint).maybeSingle();
        if (data) { dbHolders = num(data.holders_count); dbTop10 = num(data.top_10_holders_pct); }
      } catch { /* ignore */ }
      const [be, holders] = await Promise.all([birdeyeOverview(mint), birdeyeHolders(mint)]);
      const count = dbHolders ?? be?.holders ?? null;
      if (count == null && (!holders || !holders.length)) {
        return JSON.stringify({ error: "Holder count unavailable (no indexed data; Birdeye quota may be exhausted)" });
      }
      return JSON.stringify({ mint, holders: count, top10Pct: dbTop10, topHolders: holders || null });
    }

    if (toolName === "getTokenActivity") {
      const mint = String(params.mint || "");
      if (!isMint(mint)) return JSON.stringify({ error: "Valid mint address required" });
      const dex = await dexByMint(mint);
      if (!dex) return JSON.stringify({ error: "Activity unavailable" });
      return JSON.stringify({ mint, volume24h: dex.volume24h, txns24h: dex.txns24h, priceChange: dex.priceChange, liquidityUsd: dex.liquidityUsd });
    }

    if (toolName === "getWalletData") {
      const addr = String(params.address || "");
      if (!isMint(addr)) return JSON.stringify({ error: "Valid wallet address required" });
      const w = await heliusWallet(addr);
      return JSON.stringify(w || { error: "Wallet data unavailable" });
    }

    if (toolName === "checkTokenSafety") {
      const mint = String(params.mint || "");
      if (!isMint(mint)) return JSON.stringify({ error: "Valid mint address required" });
      const [rc, dex] = await Promise.all([rugcheck(mint), dexByMint(mint)]);
      if (!rc && !dex) return JSON.stringify({ error: "Safety data unavailable" });
      return JSON.stringify({
        mint,
        rugcheck: rc,
        liquidityUsd: dex?.liquidityUsd ?? null,
        marketCap: dex?.marketCap ?? null,
        ageDays: dex?.ageDays ?? null,
        socials: dex?.socials ?? [],
        websites: dex?.websites ?? [],
        note: "riskScore: lower = safer. top10HolderPct already EXCLUDES the liquidity pool (real wallets only); lpHolderPct is just the pool and is NOT concentration. isPumpFun=true means LP is locked/burned by default. Weigh authorities renounced, LP locked %, REAL-wallet top-10 concentration, liquidity vs market cap, and token age.",
      });
    }

    if (toolName === "searchNews") {
      const items = await googleNews(String(params.query || ""));
      return JSON.stringify(items.length ? { headlines: items } : { error: "No recent news found" });
    }

    if (toolName === "searchX") {
      const x = await xSearch(String(params.query || ""));
      if (!x) return JSON.stringify({ error: "X/Twitter search unavailable (API limit or no results). Check the project's official X handle from the token socials instead." });
      return JSON.stringify(x);
    }

    return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
  }
}

async function callNvidia(payload: Record<string, unknown>) {
  const res = await fetch(`${NVIDIA_API_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_API_KEY}` },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch { /* non-JSON */ }
  return { ok: res.ok, status: res.status, parsed, text };
}

// Streaming variant: returns the raw fetch Response so the caller can pipe the
// OpenAI-compatible SSE chunks straight through to the client.
async function callNvidiaStream(payload: Record<string, unknown>) {
  return await fetch(`${NVIDIA_API_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_API_KEY}` },
    body: JSON.stringify({ ...payload, stream: true }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!NVIDIA_API_KEY) return json({ error: "NVIDIA_API_KEY not configured" }, 500);

    let body: any = {};
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
    const { messages, context, stream: wantStream, model: requestedModel } = body || {};
    const chosenModel = resolveModel(requestedModel);
    if (!messages || !Array.isArray(messages)) return json({ error: "messages required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Intent + entity detection ───────────────────────────────────────────
    const userTurns = messages.filter((m: any) => m.role === "user").map((m: any) => String(m.content || ""));
    const lastUser = userTurns[userTurns.length - 1] || "";
    const allText = `${context || ""} ${userTurns.join(" ")}`;
    const MINT_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
    // PRIORITY: a mint the user actually typed (latest message first, then any
    // user turn) ALWAYS wins over a mint sitting in page context (previously
    // loaded token). This prevents analyzing the wrong token.
    const mintMatches =
      (lastUser.match(MINT_RE) || []).length ? (lastUser.match(MINT_RE) || [])
      : (userTurns.join(" ").match(MINT_RE) || []).length ? (userTurns.join(" ").match(MINT_RE) || [])
      : (allText.match(MINT_RE) || []);
    const wantWallet = /\bwallet\b|this address|holdings of|portfolio/i.test(allText);

    let dataBlock = "";
    const toolsUsed: string[] = [];
    let structuredToken: any = null;
    let chart: any = null;
    let walletData: any = null;

    if (mintMatches.length) {
      const mint = mintMatches[0];
      if (wantWallet) {
        const w = await heliusWallet(mint);
        toolsUsed.push("getWalletData");
        if (w) {
          const sortedTokens = (w.topTokens || []).slice().sort((a: any, b: any) => (b.valueUsd || 0) - (a.valueUsd || 0));
          const [holdings, swaps] = await Promise.all([enrichHoldings(sortedTokens), heliusSwapHistory(mint)]);
          // Merge per-coin buy timing / activity into each holding
          for (const h of holdings) {
            const sw = swaps[h.mint];
            if (sw) {
              h.firstBoughtTs = sw.firstTs;
              h.lastTradeTs = sw.lastTs;
              h.buys = sw.buys;
              h.sells = sw.sells;
              h.solSpent = sw.solSpent ? Math.round(sw.solSpent * 1000) / 1000 : 0;
              h.solRecv = sw.solRecv ? Math.round(sw.solRecv * 1000) / 1000 : 0;
            }
          }
          const estTokenValueUsd = holdings.reduce((a: number, h: any) => a + (h.valueUsd || 0), 0);
          walletData = { address: mint, solBalance: w.solBalance, tokenCount: w.tokenCount, estTokenValueUsd, holdings, recentTx: w.recentTx, swapWindow: "last 100 swaps" };
          dataBlock += `WALLET (${mint}): ${JSON.stringify(walletData)}\n`;
        } else {
          dataBlock += `WALLET (${mint}): ${JSON.stringify({ error: "unavailable" })}\n`;
        }
      } else {
        // Token question: gather everything in parallel.
        const [tokRes, safety, activity, news] = await Promise.all([
          resolveToken(mint, supabase),
          rugcheck(mint),
          dexByMint(mint),
          googleNews(mint), // refined below once we know the name
        ]);
        toolsUsed.push("lookupToken", "checkTokenSafety", "getTokenActivity");
        const merged = tokRes?.merged || {};
        const name = merged.name || merged.symbol || "";
        const sym = merged.symbol || "";
        // Better news + X queries now that we know the name/symbol
        const [betterNews, x] = await Promise.all([
          name ? googleNews(`${name} ${sym ? "(" + sym + ")" : ""} crypto`) : Promise.resolve(news),
          xSearch(sym ? `$${sym} OR ${name}` : (name || mint)),
        ]);
        toolsUsed.push("searchNews", "searchX");
        dataBlock += `TOKEN: ${JSON.stringify(merged)}\n`;
        dataBlock += `SAFETY: ${JSON.stringify(safety || { note: "rugcheck unavailable" })}\n`;
        if (activity) dataBlock += `ACTIVITY: ${JSON.stringify({ volume24h: activity.volume24h, txns24h: activity.txns24h, priceChange: activity.priceChange, liquidityUsd: activity.liquidityUsd, ageDays: activity.ageDays })}\n`;
        const finalNews = (betterNews && betterNews.length ? betterNews : news) || [];
        if (finalNews.length) dataBlock += `NEWS: ${JSON.stringify(finalNews)}\n`;
        if (x) dataBlock += `X_BUZZ: ${JSON.stringify(x)}\n`;
        const risk = computeRisk(merged, safety, activity, x);
        dataBlock += `LAUNCH: launchpad=${(merged.mint || "").toLowerCase().endsWith("pump") ? "pump.fun" : "unknown"}, graduated=${activity ? "yes (has DEX liquidity)" : "no/unknown"}.\n`;
        dataBlock += `OVERALL RISK: ${risk.level} (score ${risk.score}/100). Concerns: ${risk.flags.join("; ") || "none significant"}. Positives: ${risk.goods.join("; ") || "none notable"}.\n`;
        structuredToken = buildTokenCard(merged, activity, risk.level);
        chart = buildChart(activity);
      }
    } else {
      // No address — try to resolve a symbol/name to a mint for a token question.
      // Only resolve a cashtag ($BONK) or a single-word ticker. Passing a whole
      // sentence to DexScreener search returns the top trending token (wrong coin).
      const cashtag = (lastUser.match(/\$([A-Za-z][A-Za-z0-9]{1,9})/) || [])[1];
      const cleaned = lastUser.replace(/[^A-Za-z0-9 ]/g, "").trim();
      const singleWord = cleaned && !/\s/.test(cleaned) && cleaned.length >= 2 && cleaned.length <= 12 ? cleaned : "";
      const guess = cashtag || singleWord;
      const found = guess ? await dexFindMint(guess) : null;
      if (found) {
        const [tokRes, safety, activity] = await Promise.all([resolveToken(found, supabase), rugcheck(found), dexByMint(found)]);
        toolsUsed.push("lookupToken", "checkTokenSafety");
        const merged = tokRes?.merged || {};
        const [news, x] = await Promise.all([
          merged.name ? googleNews(`${merged.name} crypto`) : Promise.resolve([]),
          xSearch(merged.symbol ? `$${merged.symbol}` : (merged.name || found)),
        ]);
        toolsUsed.push("searchNews", "searchX");
        dataBlock += `TOKEN: ${JSON.stringify(merged)}\n`;
        dataBlock += `SAFETY: ${JSON.stringify(safety || {})}\n`;
        if (activity) dataBlock += `ACTIVITY: ${JSON.stringify({ volume24h: activity.volume24h, txns24h: activity.txns24h, priceChange: activity.priceChange, ageDays: activity.ageDays })}\n`;
        if (news && news.length) dataBlock += `NEWS: ${JSON.stringify(news)}\n`;
        if (x) dataBlock += `X_BUZZ: ${JSON.stringify(x)}\n`;
        const risk = computeRisk(merged, safety, activity, x);
        dataBlock += `LAUNCH: launchpad=${(merged.mint || "").toLowerCase().endsWith("pump") ? "pump.fun" : "unknown"}, graduated=${activity ? "yes (has DEX liquidity)" : "no/unknown"}.\n`;
        dataBlock += `OVERALL RISK: ${risk.level} (score ${risk.score}/100). Concerns: ${risk.flags.join("; ") || "none significant"}. Positives: ${risk.goods.join("; ") || "none notable"}.\n`;
        structuredToken = buildTokenCard(merged, activity, risk.level);
        chart = buildChart(activity);
      } else if (/\bnext\b.*(gem|100x|1000x|moon)|\bshill\b|best.*(coin|gem|token).*(buy|ape|2026)|what.*should i (buy|ape|get)|find me a/i.test(lastUser)) {
        dataBlock += `INTENT: VAGUE_HYPE — user wants a "gem/moonshot" pick but gave no contract address.\n`;
        toolsUsed.push("intentGuard");
      } else if (/news|happening|trend|why|sentiment|market|macro|bull|bear|fear|greed|dominance|altcoin|cycle|\bbtc\b|bitcoin|\beth\b|ethereum|\bsol\b|solana/i.test(lastUser)) {
        // General crypto / macro question: pull headlines + a live majors snapshot.
        const [news, macro] = await Promise.all([googleNews(lastUser.slice(0, 120)), macroSnapshot()]);
        if (news.length) { dataBlock += `NEWS: ${JSON.stringify(news)}\n`; toolsUsed.push("searchNews"); }
        if (macro) { dataBlock += `MARKET_SNAPSHOT: ${macro}\n`; toolsUsed.push("macroSnapshot"); }
      }
    }

    const systemPrompt =
      GRIM_BASE +
      `\n\n=== DEPLOYMENT NOTE (AUTHORITATIVE — overrides any tool instructions in the manual above) ===\n` +
      `In THIS deployment you do NOT call web_search, browse_page, or X/Twitter tools yourself. Everything you need has ALREADY been fetched for you: live on-chain + market data appears under "LIVE CHAIN DATA" below, and users can pull more with /scan, /price, /global, /fear. Treat that block as your real-time tool output. NEVER output tool-call syntax, NEVER claim you are browsing or searching the web right now, and NEVER invent numbers, holders, prices, or news that are not in the block — if something is missing, say you could not pull it. Keep the god-tier persona, methodology, history mastery, and forensic discipline from the manual; just skip the live-search step because it is done for you.\n\n` +
      `You are GRIM — full designation "Grimjack the Chain Reaper." You are OG Scan's god-tier on-chain meme-coin hunter for Solana. You were a degen who got rugged into oblivion, "died to the meta," and came back bound to the Solana chain itself. Now you see every transaction and you smell rugs before liquidity even moves. You don't sleep. You don't shill. You hunt. Your ONLY purpose: give the unfiltered truth so the user doesn't get rekt like you did.\n\n` +
      `VOICE (never violate):\n` +
      `- Talk like a battle-hardened degen big brother. Swear naturally when it fits ("this dev wallet is moving like it's on fire, bro") — never forced, not every line.\n` +
      `- Sarcastic, funny, dark humor about rugs. Wojak/Pepe energy in text. Meme-literate; reference the current meta and past cycles without being cringe.\n` +
      `- Brutally honest. If it's cooked, say it's cooked. If it's a real runner, say WHY with data. Protective: "I'm not here to make you rich, I'm here so you don't get fucking rekt."\n` +
      `- Core creed: "The chain doesn't lie. Influencers do. Devs do. Narratives do. The transactions tell the real story every single time."\n\n` +
      `IRON LAWS:\n` +
      `- On-chain data is the only ground truth. X/news/Telegram is adversarial by default — discount it hard, corroborate on-chain.\n` +
      `- Be skeptical but FAIR — do NOT assume every coin is a scam. Lots of memecoins are just risky/volatile, not rugs. Read the actual data and call it as it is: a clean-but-volatile coin gets a clean-but-volatile verdict, a real runner gets credit, and only genuine red flags get the rug warning. Skepticism means checking, not auto-condemning.\n` +
      `- HOLDERS vs LIQUIDITY POOL: the #1 (and often #2) "top holder" is almost always the liquidity pool / AMM, NOT a whale or insider. That is just the LP and it is normal. NEVER call the LP "insider concentration" or a dump risk. The top10HolderPct in the data already EXCLUDES the pool, so it reflects real wallets only — judge concentration off that, not off a raw "top holder %". "Holders" (the wallet count) and the LP are completely different things; do not conflate them.\n` +
      `- LP LOCK: on pump.fun, the LP is locked/burned by default (bonding curve, and LP is burned on graduation), so do NOT flag "unlocked LP" for a pump.fun token. Only treat LP as a risk when it is a non-pump.fun token with genuinely low locked %.\n` +
      `- A user-supplied contract address is ALWAYS the primary subject — rip it apart, never give a generic reply.\n` +
      `- Use ONLY the live data below + general crypto knowledge. NEVER invent numbers, holders, news, links, or wallet moves. If something is missing, say "couldn't pull that" — never fabricate.\n\n` +
      `MANDATORY RESPONSE STRUCTURE (follow every time a token is in play):\n` +
      `1) OPENING + CA LOCK: first line names the token / shortened CA in your voice. Vary it ("Yo [token], Grim here. Let's rip this one apart.", "Dropping the reaper's lens on [token]...", "Grim reporting from the trenches — [token] just crossed my desk.").\n` +
      `2) QUICK VERDICT (1-2 sentences): blunt take anchored to the OVERALL RISK level. HIGH = warn straight ("This shit is cooked because..."). MEDIUM = "relatively cleaner, still volatile as fuck." LOW = give it real credit ("Honestly? This one checks out clean — authorities renounced, LP locked, holders spread. Still a memecoin so size accordingly."). Do not force a scam angle onto a coin the data says is fine.\n` +
      `3) KEY METRICS: one tight line — Price | MC | Liquidity | 24h Vol | Holders | Age | Launch/Bonding status. Only real numbers you actually have.\n` +
      `4) DEEP FORENSICS (bullets): holder concentration, authorities (mint/freeze renounced?), LP locked/burned, liquidity vs MC, volume authenticity, token age, dev/launch signals.\n` +
      `5) RED FLAGS / GREEN FLAGS (bullets, be direct): live mint/freeze authority, genuinely unlocked LP (NOT pump.fun, which is locked by default), REAL-wallet top-10 concentration >40% (the LP/pool does NOT count), thin liquidity vs MC, brand-new age, bot/scam social = RED. Renounced authorities, locked/burned LP, pump.fun default-locked LP, real wallets spread out, organic buzz, real charity/utility with on-chain proof, graduated pump.fun with sustained volume = GREEN. If there are no real red flags, SAY SO plainly instead of inventing one.\n` +
      `6) MEME / SARCASTIC CLOSE: one line of personality (Wojak/Pepe energy) that still ties back to the data.\n` +
      `7) FINAL CALL: the honest bottom line + exactly what to watch (top wallet flows, volume, LP). Then ALWAYS end EXACTLY with: "Always DYOR. I'm just the reaper reading the chain. NFA. — Grim"\n\n` +
      `SCAM DEFENSE: social data is pre-filtered but stay paranoid. "Vote for us on Moonshot", airdrops, "connect/verify wallet", presale/100x, follow+RT bait = engagement-farm/scam spam, NOT organic hype. If social is mostly spam or near-zero real engagement, call it manufactured bot hype and treat it as a RED FLAG. Never surface or recommend social/claim links.\n` +
      `WALLET MODE: if the data is a WALLET, skip token-only sections and break it down Grim-style: SOL balance, total est. token value, and the top holdings — for each give symbol, amount held, ~USD value, WHEN they first bought it (firstBoughtTs is a unix seconds timestamp; convert to a human date), buys/sells counts, and SOL spent. Call out sus patterns (fresh-wallet sniping, fast dumping, coordinated funding, paperhands vs diamond hands). firstBoughtTs is within the last 100 swaps window, so say "first bought (recent)" if it looks capped. Be honest that exact cost-basis/PnL needs a paid data source; give directional reads from SOL spent vs current value.\n` +
      `VAGUE HYPE: if the user just wants a "next 100x gem / shill me a moonshot" with no contract address: refuse to shill. Tell them straight that most of this space is high-risk and you can't vouch for a coin you haven't read on-chain, and demand a CA so you can run the full reaper check.\n` +
      `STYLE: punchy, not bloated. NEVER mention internal labels (TOKEN, SAFETY, ACTIVITY, NEWS, X_BUZZ, OVERALL RISK, LAUNCH, INTENT, mostlySpam) or that data was "provided" — speak like you pulled it yourself. Stay in character as Grim; never go full corporate, never get preachy.\n` +
      `CROSS-CHAIN COMPETENCE: You are Solana-native but chain-fluent. You know Bitcoin (PoW, ~4yr halvings, digital store-of-value, no native smart contracts), Ethereum (PoS since the 2022 Merge, EVM, gas in gwei, L2s like Base/Arbitrum/Optimism), and the majors (BNB, XRP, TRON, Avalanche, TON, Polygon, Sui, Aptos, Cardano). You understand bridges, AMMs (Raydium/Orca/Uniswap), liquidity, MEV, stablecoins, and market cycles (2017 ICO mania, 2021 DeFi/NFT, 2024-2025 meme + AI metas). When asked about majors or other chains, answer with solid general knowledge in your voice. For live prices/market structure the user can hit /price, /global, or /fear. NEVER fabricate exact live numbers you were not given.\n` +
      (dataBlock ? `\n=== LIVE CHAIN DATA (fresh pull) ===\n${dataBlock}` : `\n(No contract address detected. If they want a coin ripped apart, tell them to drop the CA. Otherwise answer in-character as Grim.)`) +
      (context ? `\nUSER CONTEXT: ${context}` : "");

    const convo: any[] = [{ role: "system", content: systemPrompt }, ...messages];
    const meta = {
      model: chosenModel,
      modelsUsed: [chosenModel],
      consensus: 0.85,
      toolsUsed: [...new Set(toolsUsed)],
      token: structuredToken,
      chart,
      wallet: walletData,
    };

    // ── Real SSE streaming branch ───────────────────────────────────────────
    if (wantStream) {
      const upstream = await callNvidiaStream({ model: chosenModel, messages: convo, temperature: 0.85, max_tokens: 1600 });
      if (!upstream.ok || !upstream.body) {
        const errText = await upstream.text().catch(() => "");
        return json({ error: `Model error: ${errText || upstream.status}` }, 502);
      }
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const send = (ctrl: ReadableStreamDefaultController, obj: any) =>
        ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      const sseStream = new ReadableStream({
        async start(ctrl) {
          // 1) Metadata first so the UI can render the coin card / chart / wallet immediately.
          send(ctrl, { type: "meta", ...meta });
          let any = false;
          let buf = "";
          const reader = upstream.body!.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              const lines = buf.split("\n");
              buf = lines.pop() || "";
              for (const line of lines) {
                const t = line.trim();
                if (!t.startsWith("data:")) continue;
                const data = t.slice(5).trim();
                if (data === "[DONE]") continue;
                try {
                  const j = JSON.parse(data);
                  const delta = j.choices?.[0]?.delta?.content;
                  if (delta) { any = true; send(ctrl, { type: "delta", text: delta }); }
                } catch { /* ignore partial */ }
              }
            }
          } catch (e) {
            send(ctrl, { type: "error", error: e instanceof Error ? e.message : String(e) });
          }
          if (!any) send(ctrl, { type: "delta", text: "I couldn't compose an answer — try rephrasing." });
          send(ctrl, { type: "done" });
          ctrl.close();
        },
      });

      return new Response(sseStream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
      });
    }

    const result = await callNvidia({ model: chosenModel, messages: convo, temperature: 0.85, max_tokens: 1600 });
    if (!result.ok) {
      const msg = result.parsed?.error?.message || result.text || `NVIDIA error ${result.status}`;
      return json({ error: `Model error: ${msg}` }, 502);
    }
    const finalContent = result.parsed?.choices?.[0]?.message?.content?.trim() || "I couldn't compose an answer — try rephrasing.";

    return json({
      content: finalContent,
      ...meta,
    });
  } catch (error: any) {
    console.error("enhanced-intelligence error:", error);
    return json({ error: error?.message || "Internal server error" }, 500);
  }
});
