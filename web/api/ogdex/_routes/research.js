/**
 * /research — Full intelligence report for any Solana token CA.
 * Sources: Birdeye, Helius, DexScreener, pump.fun, Reddit, Nitter (X/Twitter)
 */
import { send, cache } from "../_lib.js";

const BIRDEYE_KEY = process.env.BIRDEYE_API_KEY || process.env.REACT_APP_BIRDEYE_API_KEY || "";
const HELIUS_KEY  = process.env.HELIUS_API_KEY  || process.env.REACT_APP_HELIUS_KEY  || "";

// ── helpers ──────────────────────────────────────────────────────────────────

async function birdeyeGet(path) {
  try {
    const r = await fetch(`https://public-api.birdeye.so${path}`, {
      headers: { "X-API-KEY": BIRDEYE_KEY, Accept: "application/json", "x-chain": "solana" },
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.data ?? d ?? null;
  } catch { return null; }
}

async function heliusPost(body) {
  try {
    const r = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, ...body }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.result ?? null;
  } catch { return null; }
}

// Birdeye token overview
async function tokenOverview(mint) {
  return birdeyeGet(`/defi/token_overview?address=${mint}`);
}

// Birdeye top 100 traders (24h, sorted by PnL)
async function topTraders(mint) {
  const d = await birdeyeGet(`/defi/token/top_traders?address=${mint}&time_frame=24h&sort_type=PnL&sort_by=PnL&limit=100&offset=0`);
  return d?.items || [];
}

// Helius - top token holders
async function tokenHolders(mint) {
  const r = await heliusPost({ method: "getTokenAccounts", params: [{ mint, limit: 100, options: { showZeroBalance: false } }] });
  return r?.token_accounts || [];
}

// DexScreener pair data
async function dexPairs(mint) {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const d = await r.json();
    const sol = (d?.pairs || []).filter(p => p.chainId === "solana").sort((a,b) => (b.liquidity?.usd||0) - (a.liquidity?.usd||0));
    return sol[0] || null;
  } catch { return null; }
}

// pump.fun coin data
async function pumpCoin(mint) {
  try {
    const r = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// Reddit search
async function redditSearch(query) {
  try {
    const q = encodeURIComponent(query);
    const r = await fetch(`https://www.reddit.com/search.json?q=${q}&sort=new&limit=50&type=link`, {
      headers: { Accept: "application/json", "User-Agent": "OGScan-Research/1.0" },
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d?.data?.children || []).map(c => ({
      id: c.data.id,
      title: c.data.title,
      author: c.data.author,
      subreddit: c.data.subreddit,
      score: c.data.score,
      comments: c.data.num_comments,
      url: `https://reddit.com${c.data.permalink}`,
      text: c.data.selftext?.slice(0, 400) || "",
      time: c.data.created_utc * 1000,
    }));
  } catch { return []; }
}

// Twitter/X via Nitter RSS
function parseNitterRSS(xml, base) {
  const items = [];
  const itemRx = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRx.exec(xml)) !== null && items.length < 60) {
    const it = m[1];
    const cdata = (rx) => (rx.exec(it) || [])[1] || "";
    const plain = (rx) => (rx.exec(it) || [])[1] || "";
    const link = plain(/<link>([\s\S]*?)<\/link>/);
    const desc = cdata(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/);
    const author = cdata(/<dc:creator><!\[CDATA\[([\s\S]*?)\]\]><\/dc:creator>/);
    const pubDate = plain(/<pubDate>([\s\S]*?)<\/pubDate>/);
    if (!link) continue;
    const cleanText = desc.replace(/<[^>]+>/g, "").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#39;/g,"'").replace(/&quot;/g,'"').trim().slice(0, 600);
    const twitterUrl = link.replace(base, "https://twitter.com");
    const [, username] = twitterUrl.match(/twitter\.com\/([^/]+)\/status/) || [];
    items.push({
      text: cleanText,
      user: username || author,
      displayName: author,
      url: twitterUrl,
      time: pubDate ? new Date(pubDate).getTime() : Date.now(),
    });
  }
  return items;
}

async function twitterSearch(query) {
  const NITTER = [
    "https://nitter.poast.org",
    "https://nitter.privacydev.net",
    "https://nitter.1d4.us",
    "https://nitter.cz",
  ];
  const q = encodeURIComponent(`${query} solana`);
  for (const base of NITTER) {
    try {
      const r = await fetch(`${base}/search/rss?q=${q}&f=tweets`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; OGScan/1.0)", Accept: "application/rss+xml,application/xml" },
        signal: AbortSignal.timeout(7000),
      });
      if (!r.ok) continue;
      const xml = await r.text();
      const posts = parseNitterRSS(xml, base);
      if (posts.length > 0) return posts;
    } catch { continue; }
  }
  return [];
}

// Clone / copycat detection via DexScreener
async function findClones(mint, symbol, name) {
  try {
    const q = encodeURIComponent(symbol || name || "");
    if (!q) return [];
    const r = await fetch(`https://api.dexscreener.com/latest/dex/search/?q=${q}`, { headers: { Accept: "application/json" } });
    if (!r.ok) return [];
    const d = await r.json();
    return (d?.pairs || [])
      .filter(p => p.chainId === "solana" && p.baseToken?.address !== mint)
      .sort((a,b) => (b.volume?.h24||0) - (a.volume?.h24||0))
      .slice(0, 20)
      .map(p => ({
        mint: p.baseToken.address,
        name: p.baseToken.name,
        symbol: p.baseToken.symbol,
        mcap: p.marketCap || 0,
        volume24h: p.volume?.h24 || 0,
        liquidity: p.liquidity?.usd || 0,
        launchTime: p.pairCreatedAt || 0,
        dexUrl: p.url || `https://dexscreener.com/solana/${p.baseToken.address}`,
        price: Number(p.priceUsd || 0),
      }));
  } catch { return []; }
}

// ── main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return send(res, 204, {});
  }

  const { mint } = req.query || {};
  if (!mint) return send(res, 400, { ok: false, error: "mint parameter required" });
  const ca = mint.trim();

  cache(res, 30, 120);

  // Phase 1: Fetch token identity in parallel
  const [overview, pair, pump] = await Promise.allSettled([
    tokenOverview(ca),
    dexPairs(ca),
    pumpCoin(ca),
  ]);

  const meta  = overview.status === "fulfilled" ? (overview.value || {}) : {};
  const pairData = pair.status === "fulfilled" ? (pair.value || {}) : {};
  const pumpMeta = pump.status === "fulfilled" ? (pump.value || null) : null;

  const symbol = meta?.symbol || pairData?.baseToken?.symbol || "";
  const name   = meta?.name   || pairData?.baseToken?.name   || "";

  // Phase 2: Fetch social + on-chain in parallel (now we know name/symbol)
  const [traders, holders, twitter, reddit, clones] = await Promise.allSettled([
    topTraders(ca),
    tokenHolders(ca),
    twitterSearch(symbol || name),
    redditSearch(`${name} ${symbol} solana crypto`),
    findClones(ca, symbol, name),
  ]);

  // ── Process holders ────────────────────────────────────────────────────────
  const rawHolders = holders.status === "fulfilled" ? (holders.value || []) : [];
  const totalAmt   = rawHolders.reduce((s, h) => s + Number(h.amount || 0), 0);
  const topHolders = rawHolders
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 50)
    .map((h, i) => ({
      rank: i + 1,
      address: h.owner || h.address || "",
      amount: Number(h.amount || 0),
      percent: totalAmt > 0 ? ((Number(h.amount) / totalAmt) * 100).toFixed(2) : "0",
    }));

  // ── Process top traders ────────────────────────────────────────────────────
  const rawTraders  = traders.status === "fulfilled" ? (traders.value || []) : [];
  const traderList  = rawTraders.map((t, i) => ({
    rank: i + 1,
    wallet:  t.address || t.wallet || "",
    pnl:     Number(t.pnl   || 0),
    volume:  Number(t.volume || 0),
    trades:  Number(t.numTrades || t.trades || 0),
    winRate: t.winRate ?? null,
    tags:    t.tags || [],
    netBuy:  Number(t.netBuy  || 0),
    netSell: Number(t.netSell || 0),
  }));

  // ── Process X/Twitter mentions (group by user) ─────────────────────────────
  const rawTwitter = twitter.status === "fulfilled" ? (twitter.value || []) : [];
  const byUser = {};
  for (const post of rawTwitter) {
    const u = post.user || "unknown";
    if (!byUser[u]) byUser[u] = { user: u, count: 0, posts: [] };
    byUser[u].count++;
    byUser[u].posts.push(post);
  }
  const twitterMentioners = Object.values(byUser).sort((a,b) => b.count - a.count);

  const redditPosts = reddit.status === "fulfilled" ? (reddit.value || []) : [];
  const cloneList   = clones.status === "fulfilled" ? (clones.value || []) : [];

  return send(res, 200, {
    ok: true,
    ca,
    meta: {
      name,
      symbol,
      image: meta?.logoURI || meta?.logo || pumpMeta?.image_uri || "",
      price: Number(meta?.price || pairData?.priceUsd || 0),
      priceChange24h: Number(meta?.priceChange24hPercent || pairData?.priceChange?.h24 || 0),
      mcap: Number(meta?.marketCap || meta?.mc || pairData?.marketCap || 0),
      volume24h: Number(meta?.v24hUSD || pairData?.volume?.h24 || 0),
      liquidity: Number(meta?.liquidity || pairData?.liquidity?.usd || 0),
      totalHolders: Number(meta?.holder || 0),
      fdv: Number(meta?.fdv || pairData?.fdv || 0),
      description: pumpMeta?.description || "",
      links: {
        website:  meta?.extensions?.website  || pumpMeta?.website  || (pairData?.info?.websites?.[0]?.url) || "",
        twitter:  meta?.extensions?.twitter  || pumpMeta?.twitter  || "",
        telegram: meta?.extensions?.telegram || pumpMeta?.telegram || "",
        dex:      pairData?.url || `https://dexscreener.com/solana/${ca}`,
        birdeye:  `https://birdeye.so/token/${ca}?chain=solana`,
        solscan:  `https://solscan.io/token/${ca}`,
      },
    },
    launch: {
      deployer:    pumpMeta?.creator || null,
      platform:    pumpMeta ? "pump.fun" : (pairData?.dexId || "raydium"),
      launchTime:  pumpMeta?.created_timestamp ? pumpMeta.created_timestamp * 1 : (pairData?.pairCreatedAt || 0),
      graduated:   pumpMeta?.complete || false,
      king:        pumpMeta?.king_of_the_hill_timestamp ? new Date(pumpMeta.king_of_the_hill_timestamp * 1000).toISOString() : null,
      replies:     pumpMeta?.reply_count || 0,
      description: pumpMeta?.description || "",
    },
    social: {
      twitter: {
        posts:    rawTwitter.slice(0, 50),
        byUser:   twitterMentioners.slice(0, 40),
        total:    rawTwitter.length,
      },
      reddit: {
        posts: redditPosts.slice(0, 30),
        total: redditPosts.length,
      },
    },
    clones: cloneList,
    onchain: {
      holders:    topHolders,
      topTraders: traderList.slice(0, 100),
    },
  });
}
