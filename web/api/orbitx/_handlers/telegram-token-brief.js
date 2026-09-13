/**
 * External metadata for Telegram project briefs — DexScreener, pump.fun, Reddit, Nitter.
 * Never self-HTTP /api/ogdex/* from the Telegram webhook (same-isolate hang).
 */
const DEX = "https://api.dexscreener.com/latest/dex/tokens/";
const PUMP = "https://frontend-api-v3.pump.fun/coins/";
const HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
};

async function jsonGet(url, { timeoutMs = 5000, headers = HEADERS } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function textGet(url, { timeoutMs = 5000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { ...HEADERS, Accept: "application/rss+xml,application/xml,text/xml" },
      signal: ctrl.signal,
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function dexPair(mint, raw) {
  const list = Array.isArray(raw?.pairs) ? raw.pairs : [];
  const sol = list.filter((p) => String(p?.chainId || "") === "solana");
  const base = sol.filter((p) => String(p?.baseToken?.address || "") === mint);
  const pool = base.length ? base : sol;
  return [...pool].sort((a, b) => (Number(b?.liquidity?.usd) || 0) - (Number(a?.liquidity?.usd) || 0))[0] || null;
}

function dexLinks(pair) {
  const info = pair?.info && typeof pair.info === "object" ? pair.info : {};
  const links = { website: "", twitter: "", telegram: "" };
  for (const s of info.socials || []) {
    const k = String(s.type || s.platform || "").toLowerCase();
    if (k.includes("twitter") || k === "x") links.twitter = s.url || "";
    else if (k.includes("telegram")) links.telegram = s.url || "";
  }
  const site = (info.websites || [])[0];
  if (site?.url) links.website = site.url;
  return links;
}

async function redditSearch(query) {
  const q = encodeURIComponent(String(query || "").trim());
  if (!q) return [];
  const d = await jsonGet(`https://www.reddit.com/search.json?q=${q}&sort=new&limit=12&type=link`, { timeoutMs: 4500 });
  const children = d?.data?.children;
  if (!Array.isArray(children)) return [];
  return children.slice(0, 8).map((c) => ({
    title: String(c?.data?.title || "").slice(0, 140),
    subreddit: c?.data?.subreddit || "",
    score: Number(c?.data?.score) || 0,
  }));
}

function parseNitter(xml, base) {
  const items = [];
  const itemRx = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRx.exec(xml)) !== null && items.length < 12) {
    const it = m[1];
    const link = (it.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "";
    const desc = (it.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || [])[1] || "";
    if (!link) continue;
    const clean = desc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
    const twitterUrl = link.replace(base, "https://twitter.com");
    const user = (twitterUrl.match(/twitter\.com\/([^/]+)\/status/) || [])[1] || "";
    items.push({ user, text: clean, url: twitterUrl });
  }
  return items;
}

async function twitterSearch(query) {
  const q = encodeURIComponent(`${String(query || "").trim()} solana`);
  if (!q || q === "solana") return [];
  const hosts = ["https://nitter.poast.org", "https://nitter.privacydev.net"];
  for (const base of hosts) {
    const xml = await textGet(`${base}/search/rss?q=${q}&f=tweets`, { timeoutMs: 4000 });
    const posts = parseNitter(xml, base);
    if (posts.length) return posts;
  }
  return [];
}

export async function fetchTokenProjectResearch(mint, snapshot = null) {
  const ca = String(mint || "").trim();
  if (!ca) return { ok: false, ca: "", meta: {}, launch: {}, social: {} };
  const token = snapshot?.token && typeof snapshot.token === "object" ? snapshot.token : {};
  const snapLinks = snapshot?.meta?.socials && typeof snapshot.meta.socials === "object" ? snapshot.meta.socials : {};

  const [dexRaw, pumpRaw] = await Promise.all([
    jsonGet(`${DEX}${encodeURIComponent(ca)}`, { timeoutMs: 4500 }),
    jsonGet(`${PUMP}${encodeURIComponent(ca)}`, { timeoutMs: 4500 }),
  ]);
  const pair = dexPair(ca, dexRaw);
  const pump = pumpRaw && typeof pumpRaw === "object" ? pumpRaw : null;
  const links = { ...dexLinks(pair), ...snapLinks };
  if (pump?.website && !links.website) links.website = pump.website;
  if (pump?.twitter && !links.twitter) links.twitter = pump.twitter;
  if (pump?.telegram && !links.telegram) links.telegram = pump.telegram;

  const name = String(pump?.name || pair?.baseToken?.name || token.name || "").trim();
  const symbol = String(pump?.symbol || pair?.baseToken?.symbol || token.symbol || "").trim();
  const query = [name, symbol].filter(Boolean).join(" ").trim() || ca.slice(0, 8);
  const [reddit, twitter] = await Promise.all([
    redditSearch(`${name} ${symbol} solana`.trim()),
    twitterSearch(symbol || name),
  ]);

  const byUser = {};
  for (const post of twitter) {
    const u = post.user || "unknown";
    if (!byUser[u]) byUser[u] = { user: u, count: 0 };
    byUser[u].count += 1;
  }

  return {
    ok: true,
    ca,
    meta: {
      name,
      symbol,
      description: String(pump?.description || token.description || "").trim(),
      mcap: Number(pair?.marketCap || token.mcap || 0) || 0,
      volume24h: Number(pair?.volume?.h24 || token.volume || 0) || 0,
      priceChange24h: Number(pair?.priceChange?.h24 ?? token.change24h ?? 0),
      links,
    },
    launch: {
      deployer: pump?.creator || null,
      platform: pump ? "pump.fun" : pair?.dexId || "",
      description: String(pump?.description || "").trim(),
    },
    social: {
      twitter: {
        posts: twitter.slice(0, 8),
        byUser: Object.values(byUser).sort((a, b) => b.count - a.count).slice(0, 8),
        total: twitter.length,
      },
      reddit: { posts: reddit, total: reddit.length },
    },
  };
}
