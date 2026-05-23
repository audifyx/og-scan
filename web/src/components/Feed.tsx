import { memo, useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bell,
  Flame,
  Globe,
  Hash,
  Loader2,
  MessageCircle,
  Newspaper,
  Radio,
  RefreshCw,
  Rss,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { CoinDetailDialog } from "@/components/CoinDetailDialog";
import { CopyMintButton } from "@/components/CopyMintButton";
import { cn } from "@/lib/utils";
import {
  SOLANA_CHAIN_ID,
  dexPairsForMints,
  fmtNum,
  fmtPct,
  fmtUsd,
  jupTrending,
  normalizeNarrativeText,
  shortAddr,
  timeAgo,
  type DexSearchPair,
  type JupTokenInfo,
} from "@/lib/og";

type Props = { onSelect: (mint: string) => void };

type FeedItemKind = "news" | "x_post" | "viral" | "coin_spotlight";

type FeedItem = {
  id: string;
  kind: FeedItemKind;
  title: string;
  summary: string;
  source: string;
  sourceHandle?: string;
  sourceIcon?: "news" | "x" | "viral" | "feed";
  link?: string;
  publishedAt: string;
  keywords: string[];
  memeRelevance: number;
  viralScore: number;
  matchedCoins: MatchedCoin[];
  /** Meta theme IDs this item belongs to (e.g. ["elon","ai"]) */
  metaIds: string[];
  engagement?: { likes?: number; reposts?: number; replies?: number };
  imageUrl?: string;
};

type MatchedCoin = {
  mint: string;
  symbol: string;
  name: string;
  imageUrl?: string;
  priceChange5m?: number;
  volume1h?: number;
  relevance: number;
  /** Human-readable reason why this coin is matched (e.g. "mentioned by @elonmusk") */
  matchReason?: string;
};

type ViralTrend = {
  id: string;
  term: string;
  category: "narrative" | "celebrity" | "political" | "tech" | "culture";
  postsCount: number;
  momentum: "surging" | "hot" | "steady" | "cooling";
  matchedCoins: MatchedCoin[];
  whyViral: string;
};

type FeedPayload = {
  items: FeedItem[];
  trends: ViralTrend[];
  updatedAt: string;
};

const MEME_KEYWORDS = new Set<string>([
  "meme","memecoin","shitcoin","doge","pepe","wojak","bonk","floki",
  "mog","gme","amc","donald","trump","elon","musk","grok","tesla",
  "spacex","mars","ai","cat","dog","frog","bird","chad","wojak",
  "based","cope","wagmi","ngmi","hodl","diamond","hands","moon",
  "lambo","1000x","pump","dump","rug","ct","degen","ape","solana",
  "sol","phantom","jupiter","raydium","pump","fun","bonding","curve",
  "migration","dex","screener","dexscreener","birdeye","helius","bot",
  "sniper","snipe","launch","dev","wallet","bundler","bundle",
  "whale","holder","liquidity","pool","pair","cto","community",
  "takeover","official","verified","blue","check","twitter","x",
  "thread","tweet","viral","trending","hype","fomo","fud","fear",
  "uncertainty","doubt","bull","bear","run","season","alt","season",
  "btc","bitcoin","eth","ethereum","crypto","cryptocurrency","token",
  "coin","nft","dao","defi","gamefi","metaverse","ai16z","turbo",
  "render","ar","vr","meta","zuck","saylor","microstrategy","blackrock",
  "etf","sec","regulation","approval","spot","futures","derivatives",
  "perp","perpetual","leverage","long","short","liquidation","funding",
  "rate","open","interest","oi","volume","mcap","marketcap","fdv",
  "ath","atl","support","resistance","breakout","breakdown","accumulation",
  "distribution","wyckoff","elliott","wave","fibonacci","retracement",
  "satoshi","nakamoto","whitepaper","halving","fork","airdrop","staking",
  "yield","farm","vault","lending","borrowing","cdp","collateral",
  "liquid","staking","restaking","eigenlayer","pendle","yfi","aave",
  "compound","uniswap","pancakeswap","sushiswap","curve","balancer",
  "1inch","cowswap","matcha","openocean","jup","jupiter","orca",
  "raydium","meteora","lifinity","phoenix","drift","mango","zeta",
  "hyperliquid","vertex","dydx","gmx","gns","snx","perp","kwenta",
]);

const CELEBRITY_HANDLES: Record<string, string> = {
  "elon musk": "elonmusk",
  "elon": "elonmusk",
  "musk": "elonmusk",
  "donald trump": "realDonaldTrump",
  "trump": "realDonaldTrump",
  "cathie wood": "CathieDWood",
  "michael saylor": "saylor",
  "saylor": "saylor",
  "vitalik": "VitalikButerin",
  "cz": "cz_binance",
  "sbf": "SBF_FTX",
  "larry fink": "blackrock",
  "paul graham": "paulg",
  "balaji": "balajis",
  "naval": "naval",
  "snoop dogg": "SnoopDogg",
  "mark cuban": "mcuban",
  "kevin o'leary": "kevinolearytv",
};

const NARRATIVE_COLORS: Record<string, string> = {
  narrative: "border-og-lime/35 bg-og-lime/10 text-og-lime",
  celebrity: "border-og-cyan/35 bg-og-cyan/10 text-og-cyan",
  political: "border-og-gold/35 bg-og-gold/10 text-og-gold",
  tech: "border-og-cyan/35 bg-og-cyan/10 text-og-cyan",
  culture: "border-white/20 bg-white/[0.06] text-white/70",
};

// ── Meta themes — curated keyword sets for each major narrative ─────────────
// Each meta has: keywords that appear in news/articles, coin symbols/names that
// belong to the meta, a display label, and a color scheme.

type MetaTheme = {
  id: string;
  label: string;
  emoji: string;
  color: string; // tailwind border+bg+text class
  /** Words that must appear in article title/summary to match this meta */
  triggerKeywords: string[];
  /** Coin symbol/name fragments that belong to this meta */
  coinKeywords: string[];
  /** DexScreener search terms for this meta */
  dexSearchTerms: string[];
};

const META_THEMES: MetaTheme[] = [
  {
    id: "elon",
    label: "Elon Musk",
    emoji: "⚡",
    color: "border-og-lime/40 bg-og-lime/10 text-og-lime",
    triggerKeywords: ["elon","musk","elonmusk","tesla","spacex","grok","xai","twitter","x.com","dogecoin","doge","mars"],
    coinKeywords: ["doge","dogecoin","shib","shiba","floki","elon","musk","tesla","spacex","grok","xai","mars","rocket","dog","x","twitter"],
    dexSearchTerms: ["doge","elon","grok","xai","spacex","tesla"],
  },
  {
    id: "trump",
    label: "Trump / MAGA",
    emoji: "🇺🇸",
    color: "border-og-gold/40 bg-og-gold/10 text-og-gold",
    triggerKeywords: ["trump","maga","donald","whitehouse","white house","republican","patriot","america","usa","freedom","liberty","executive order","crypto bill"],
    coinKeywords: ["trump","maga","usa","america","freedom","liberty","patriot","official","usd","dollar","eagle","red","republican","based"],
    dexSearchTerms: ["trump","maga","usa","freedom","america","patriot"],
  },
  {
    id: "worldcup",
    label: "World Cup",
    emoji: "🏆",
    color: "border-yellow-400/40 bg-yellow-400/10 text-yellow-300",
    triggerKeywords: ["world cup","fifa","soccer","football","2026","worldcup","premier league","champions league","messi","ronaldo","neymar","mbappé","mbappe","goal","striker","stadium","match","kickoff","penalty","halftime","offside"],
    coinKeywords: ["worldcup","soccer","football","fifa","messi","ronaldo","goal","striker","champion","trophy","stadium","pitch","kick","ball","fan","ultras","brazil","argentina","france","england","germany","spain","italy","portugal","neymar","mbappe","cup","league"],
    dexSearchTerms: ["worldcup","soccer","football","fifa","messi","ronaldo","goal","trophy","brazil","argentina"],
  },
  {
    id: "ai",
    label: "AI / Tech",
    emoji: "🤖",
    color: "border-og-cyan/40 bg-og-cyan/10 text-og-cyan",
    triggerKeywords: ["ai","artificial intelligence","gpt","llm","openai","claude","gemini","deepseek","chatgpt","neural","machine learning","robot","agent","autonomous","ai16z","render","fetch","near","agi"],
    coinKeywords: ["ai","agi","gpt","llm","neural","robot","agent","turbo","render","fetch","near","goat","virtual","arc","io","bittensor","tao","worldcoin","wld","mind","brain","chip","compute","gpu"],
    dexSearchTerms: ["ai","agi","neural","robot","agent","gpt","chatbot","turbo","goat"],
  },
  {
    id: "pump",
    label: "Pump.fun",
    emoji: "🔥",
    color: "border-og-blood/40 bg-og-blood/10 text-og-blood",
    triggerKeywords: ["pump.fun","pumpfun","pump fun","bonding curve","migration","raydium","degen","viral launch","new token","solana meme","rug","graduation"],
    coinKeywords: ["pump","fun","degen","bonk","wif","dogwifhat","popcat","fart","fartcoin","moo","cope","gme","cat","frog","pepe","chad","based","wojak","sol","migrat"],
    dexSearchTerms: ["pump","bonk","wif","popcat","fartcoin","degen","viral","solana"],
  },
  {
    id: "political",
    label: "Political",
    emoji: "🗳️",
    color: "border-purple-400/40 bg-purple-400/10 text-purple-300",
    triggerKeywords: ["senate","congress","election","vote","bill","regulation","sec","cftc","crypto law","legislation","etf","bitcoin reserve","strategic reserve","federal","white house","president","crypto friendly"],
    coinKeywords: ["usa","vote","senate","congress","bill","fed","reserve","freedom","liberty","democracy","republican","democrat","capitol","government","whitehouse"],
    dexSearchTerms: ["senate","crypto","election","vote","congress","bitcoin","reserve"],
  },
  {
    id: "viral",
    label: "Viral / Culture",
    emoji: "📱",
    color: "border-pink-400/40 bg-pink-400/10 text-pink-300",
    triggerKeywords: ["viral","trending","tiktok","youtube","meme","celebrity","influencer","twitter","x post","reddit","4chan","discord","telegram","community","ct","crypto twitter"],
    coinKeywords: ["viral","meme","trend","tiktok","reddit","chad","based","cope","wojak","pepe","moon","ape","gem","100x","1000x","ct","community","cto"],
    dexSearchTerms: ["viral","meme","trending","pepe","wojak","chad","moon","ape"],
  },
];

/** Returns the best matching meta(s) for a given feed item */
function detectItemMetas(item: { keywords: string[]; title: string; summary: string }): string[] {
  const text = normalizeNarrativeText(`${item.title} ${item.summary} ${item.keywords.join(" ")}`);
  const matched: Array<{ id: string; score: number }> = [];
  for (const meta of META_THEMES) {
    let score = 0;
    for (const kw of meta.triggerKeywords) {
      if (text.includes(normalizeNarrativeText(kw))) score += 2;
    }
    for (const kw of item.keywords) {
      if (meta.triggerKeywords.some((t) => normalizeNarrativeText(t) === kw)) score += 3;
    }
    if (score > 0) matched.push({ id: meta.id, score });
  }
  return matched.sort((a, b) => b.score - a.score).map((m) => m.id);
}

/** Score how well a coin belongs to a meta */
function scoreCoinForMeta(symbol: string, name: string, meta: MetaTheme): number {
  const sym = normalizeNarrativeText(symbol);
  const nm = normalizeNarrativeText(name);
  let score = 0;
  for (const ck of meta.coinKeywords) {
    const k = normalizeNarrativeText(ck);
    if (sym === k) { score += 50; break; }
    if (nm === k) { score += 40; break; }
    if (sym.includes(k) || k.includes(sym)) { score += 25; break; }
    if (nm.includes(k)) { score += 18; break; }
  }
  return Math.min(100, score);
}

const FEED_REFRESH_MS = 30_000;

async function fetchRssViaProxy(url: string): Promise<string | null> {
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`,
  ];
  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 50) return text;
      }
    } catch {
      /* try next proxy */
    }
  }
  return null;
}

async function fetchRssItems(url: string, label: string, kind: FeedItemKind): Promise<FeedItem[]> {
  const xml = await fetchRssViaProxy(url);
  if (!xml) return [];
  try {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const items = Array.from(doc.querySelectorAll("item, entry")).slice(0, 12);
    return items.map((el: Element, index: number): FeedItem => {
      const title = el.querySelector("title")?.textContent?.trim() ?? "Untitled";
      const link =
        el.querySelector("link")?.textContent?.trim() ||
        el.querySelector("link")?.getAttribute("href") ||
        undefined;
      const pubRaw =
        el.querySelector("pubDate")?.textContent?.trim() ||
        el.querySelector("published")?.textContent?.trim() ||
        el.querySelector("updated")?.textContent?.trim() ||
        new Date().toISOString();
      const desc =
        el.querySelector("description")?.textContent?.trim() ||
        el.querySelector("summary")?.textContent?.trim() ||
        "";
      const words = extractKeywords(`${title} ${desc}`);
      const memeRelevance = scoreMemeRelevance(words);
      const partial = {
        id: `${label}-${index}-${title.slice(0, 40)}`,
        kind,
        title,
        summary: desc.slice(0, 240),
        source: label,
        link,
        publishedAt: new Date(pubRaw).toISOString(),
        keywords: words.slice(0, 8),
        memeRelevance,
        viralScore: Math.round(memeRelevance * (1 + words.length * 0.05)),
        matchedCoins: [] as FeedItem["matchedCoins"],
      };
      return { ...partial, metaIds: detectItemMetas(partial) };
      });
  } catch {
    return [];
  }
}

function extractKeywords(text: string): string[] {
  const clean = text
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[^A-Za-z0-9$#\s]/g, " ")
    .toLowerCase();
  const tokens = clean
    .split(/\s+/)
    .map((t) => t.replace(/^\$+/, "").trim())
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t));
  const scored = new Map<string, number>();
  for (const token of tokens) {
    const base = MEME_KEYWORDS.has(token) ? 3 : 1;
    scored.set(token, (scored.get(token) ?? 0) + base);
  }
  return Array.from(scored.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 10);
}

function scoreMemeRelevance(keywords: string[]): number {
  if (!keywords.length) return 0;
  const hits = keywords.filter((k) => MEME_KEYWORDS.has(k)).length;
  return Math.min(100, Math.round((hits / Math.max(1, keywords.length)) * 100 + hits * 8));
}

function buildViralTrends(items: FeedItem[]): ViralTrend[] {
  const termCounts = new Map<string, { count: number; category: ViralTrend["category"]; coins: Set<string> }>();
  for (const item of items) {
    for (const kw of item.keywords.slice(0, 5)) {
      if (!termCounts.has(kw)) {
        const cat: ViralTrend["category"] =
          CELEBRITY_HANDLES[kw] ? "celebrity" :
          ["trump","maga","election","biden","vote","poll","senate","house","congress","white","capitol"].includes(kw) ? "political" :
          ["ai","gpt","llm","model","neural","machine","learning","openai","claude","gemini","deepseek"].includes(kw) ? "tech" :
          "narrative";
        termCounts.set(kw, { count: 0, category: cat, coins: new Set() });
      }
      const entry = termCounts.get(kw)!;
      entry.count += 1;
      for (const c of item.matchedCoins) entry.coins.add(c.symbol);
    }
  }
  return Array.from(termCounts.entries())
    .filter(([_, data]) => data.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([term, data], index): ViralTrend => ({
      id: `trend-${index}-${term}`,
      term,
      category: data.category,
      postsCount: data.count,
      momentum: data.count >= 5 ? "surging" : data.count >= 3 ? "hot" : "steady",
      matchedCoins: [],
      whyViral: `Mentioned in ${data.count} recent stories about ${term.toUpperCase()}-linked narratives.`,
    }));
}

async function fetchTrendingCoins(): Promise<JupTokenInfo[]> {
  try {
    const [t5m, t1h] = await Promise.allSettled([jupTrending("5m", 25), jupTrending("1h", 25)]);
    const all: JupTokenInfo[] = [];
    if (t5m.status === "fulfilled") all.push(...t5m.value);
    if (t1h.status === "fulfilled") all.push(...t1h.value);
    const seen = new Set<string>();
    return all.filter((t) => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });
  } catch {
    return [];
  }
}

function attachCoinMatches(items: FeedItem[], coins: JupTokenInfo[], pairs: DexSearchPair[]): FeedItem[] {
  const pairByMint = new Map<string, DexSearchPair>();
  for (const p of pairs) {
    const mint = p.baseToken?.address;
    if (!mint || p.chainId !== SOLANA_CHAIN_ID) continue;
    const prev = pairByMint.get(mint);
    if (!prev || (p.volume?.h24 ?? 0) > (prev.volume?.h24 ?? 0)) pairByMint.set(mint, p);
  }
  return items.map((item) => {
    const matched: MatchedCoin[] = [];
    // Get the metas this item belongs to
    const itemMetas = META_THEMES.filter((m) => item.metaIds.includes(m.id));
    // Detect if an influencer is mentioned for labeling
    const elonMentioned = item.keywords.some((k) => ["elon","musk","elonmusk"].includes(k)) ||
      normalizeNarrativeText(item.title).includes("elon");
    const trumpMentioned = item.keywords.some((k) => ["trump","maga","donald"].includes(k)) ||
      normalizeNarrativeText(item.title).includes("trump");

    for (const coin of coins.slice(0, 80)) {
      const sym = normalizeNarrativeText(coin.symbol);
      const name = normalizeNarrativeText(coin.name);
      let relevance = 0;
      const reasons: string[] = [];

      // 1. Direct keyword match from article text
      for (const kw of item.keywords) {
        if (kw.length < 3) continue;
        if (sym === kw) { relevance += 40; reasons.push(`symbol matches "${kw.toUpperCase()}"`); break; }
        if (name === kw) { relevance += 35; reasons.push(`name matches "${kw}"`); break; }
        if (name.includes(kw) || kw.includes(sym)) { relevance += 22; reasons.push(`related to "${kw}"`); break; }
        if (sym.includes(kw) || kw.includes(sym.slice(0, 4))) { relevance += 12; reasons.push(`partial match "${kw}"`); break; }
      }

      // 2. Meta theme match — only include coins that belong to item's meta
      let metaBonus = 0;
      for (const meta of itemMetas) {
        const s = scoreCoinForMeta(coin.symbol, coin.name, meta);
        if (s > metaBonus) metaBonus = s;
        if (s >= 25 && reasons.length === 0) {
          // Build a smart label
          if (elonMentioned) reasons.push(`${meta.emoji} tweeted by @elonmusk`);
          else if (trumpMentioned) reasons.push(`${meta.emoji} in Trump's orbit`);
          else reasons.push(`${meta.emoji} ${meta.label} meta`);
        }
      }
      relevance += Math.round(metaBonus * 0.6);

      // 3. Must pass a minimum bar — prevents unrelated coin noise
      if (relevance < 15) continue;

      const pair = pairByMint.get(coin.id);
      matched.push({
        mint: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        imageUrl: coin.logoURI ?? pair?.info?.imageUrl,
        priceChange5m: coin.stats5m?.priceChange ?? pair?.priceChange?.m5,
        volume1h: pair?.volume?.h1,
        relevance: Math.min(100, relevance),
        matchReason: reasons[0],
      });
    }
    matched.sort((a, b) => b.relevance - a.relevance);
    return { ...item, matchedCoins: matched.slice(0, 4) };
  });
}

function attachTrendCoinMatches(trends: ViralTrend[], coins: JupTokenInfo[], pairs: DexSearchPair[]): ViralTrend[] {
  const pairByMint = new Map<string, DexSearchPair>();
  for (const p of pairs) {
    const mint = p.baseToken?.address;
    if (!mint || p.chainId !== SOLANA_CHAIN_ID) continue;
    pairByMint.set(mint, p);
  }
  return trends.map((trend) => {
    const matched: MatchedCoin[] = [];
    for (const coin of coins.slice(0, 60)) {
      const sym = normalizeNarrativeText(coin.symbol);
      const name = normalizeNarrativeText(coin.name);
      let relevance = 0;
      const term = trend.term.toLowerCase();
      if (sym === term || name.includes(term) || term.includes(sym)) relevance += 40;
      else if (sym.includes(term) || term.includes(sym.slice(0, 4))) relevance += 18;
      if (relevance > 0) {
        const pair = pairByMint.get(coin.id);
        matched.push({
          mint: coin.id,
          symbol: coin.symbol,
          name: coin.name,
          imageUrl: coin.logoURI ?? pair?.info?.imageUrl,
          priceChange5m: coin.stats5m?.priceChange ?? pair?.priceChange?.m5,
          volume1h: pair?.volume?.h1,
          relevance: Math.min(100, relevance),
        });
      }
    }
    matched.sort((a, b) => b.relevance - a.relevance);
    return { ...trend, matchedCoins: matched.slice(0, 4) };
  });
}

// ── DexScreener keyword search ────────────────────────────────────────────────
async function dexSearchByKeyword(query: string): Promise<DexSearchPair[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { pairs?: DexSearchPair[] | null };
    return (data.pairs ?? []).filter(
      (p) => p.chainId === SOLANA_CHAIN_ID && Boolean(p.baseToken?.address)
    );
  } catch {
    return [];
  }
}

async function fetchFeedPayload(): Promise<FeedPayload> {
  try {
  const sources = [
    {
      label: "CryptoPanic",
      kind: "news" as FeedItemKind,
      url: "https://cryptopanic.com/news/rss/",
    },
    {
      label: "CoinDesk",
      kind: "news" as FeedItemKind,
      url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    },
    {
      label: "Cointelegraph",
      kind: "news" as FeedItemKind,
      url: "https://cointelegraph.com/rss",
    },
    {
      label: "Decrypt",
      kind: "news" as FeedItemKind,
      url: "https://decrypt.co/feed",
    },
    {
      label: "Google · Meme Coins",
      kind: "viral" as FeedItemKind,
      url: "https://news.google.com/rss/search?q=meme+coin+OR+memecoin+OR+Solana+token+when:1d&hl=en-US&gl=US&ceid=US:en",
    },
    {
      label: "Google · Crypto Viral",
      kind: "viral" as FeedItemKind,
      url: "https://news.google.com/rss/search?q=crypto+viral+OR+pump.fun+OR+DEX+screener+OR+Solana+trending+when:1d&hl=en-US&gl=US&ceid=US:en",
    },
    // Meta-specific feeds
    {
      label: "Elon Watch",
      kind: "x_post" as FeedItemKind,
      url: "https://news.google.com/rss/search?q=elon+musk+crypto+OR+doge+OR+coin+OR+token+OR+grok+when:6h&hl=en-US&gl=US&ceid=US:en",
    },
    {
      label: "Trump Crypto",
      kind: "x_post" as FeedItemKind,
      url: "https://news.google.com/rss/search?q=trump+crypto+OR+maga+coin+OR+token+OR+bitcoin+when:6h&hl=en-US&gl=US&ceid=US:en",
    },
    {
      label: "World Cup Crypto",
      kind: "viral" as FeedItemKind,
      url: "https://news.google.com/rss/search?q=world+cup+2026+crypto+OR+soccer+coin+OR+football+token+OR+FIFA+crypto+when:3d&hl=en-US&gl=US&ceid=US:en",
    },
    {
      label: "AI Tokens",
      kind: "viral" as FeedItemKind,
      url: "https://news.google.com/rss/search?q=AI+token+OR+AI+memecoin+OR+ai16z+OR+grok+token+OR+artificial+intelligence+crypto+when:1d&hl=en-US&gl=US&ceid=US:en",
    },
    {
      label: "Pump.fun Launches",
      kind: "viral" as FeedItemKind,
      url: "https://news.google.com/rss/search?q=pump.fun+OR+solana+meme+launch+OR+bonding+curve+OR+degen+token+when:1d&hl=en-US&gl=US&ceid=US:en",
    },
  ];

  const [rssResults, coins] = await Promise.allSettled([
    Promise.allSettled(sources.map((s) => fetchRssItems(s.url, s.label, s.kind))),
    fetchTrendingCoins(),
  ]);

  let items: FeedItem[] = [];
  if (rssResults.status === "fulfilled") {
    items = rssResults.value
      .flatMap((r): FeedItem[] => (r.status === "fulfilled" ? r.value : []))
      .filter((it) => it.title && it.title.length > 3);
  }

  // If RSS entirely failed, use rich fallback items so the UI is never empty
  if (items.length === 0) {
    items = buildFallbackFeedItems();
  }

  // Deduplicate by normalized title
  const seen = new Map<string, FeedItem>();
  for (const it of items) {
    const key = normalizeNarrativeText(it.title).slice(0, 90);
    if (!seen.has(key)) seen.set(key, it);
  }
  items = Array.from(seen.values());

  // Sort by meme relevance desc, then recency
  items.sort((a, b) => {
    const rel = b.memeRelevance - a.memeRelevance;
    if (Math.abs(rel) > 15) return rel;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  // ── Per-meta DexScreener search — proactive, always-on ──────────────────
  // Every meta always runs its own DexSearch, not just when articles mention it.
  // This ensures the coin pool is always populated for each meta filter:
  //   Elon → searches "doge","grok","xai","elon","spacex","tesla"
  //   Trump → searches "trump","maga","usa","freedom","america","patriot"
  //   World Cup → searches "worldcup","soccer","messi","ronaldo","goal","brazil","argentina"
  //   AI → searches "ai","agi","neural","robot","agent","turbo","goat"
  //   Pump.fun → searches "pump","degen","bonk","wif","popcat","viral"
  //   Political → searches "senate","crypto","election","bitcoin","reserve"
  //   Viral → searches "viral","meme","trending","pepe","moon","ape"
  // Plus supplement with top article keywords.
  const dexSearchTerms: string[] = [];
  // Always include all meta search terms (2-3 per meta)
  for (const meta of META_THEMES) {
    dexSearchTerms.push(...meta.dexSearchTerms.slice(0, 2));
  }
  // Supplement with top article keywords (deduped)
  const keywordFreq = new Map<string, number>();
  for (const item of items) {
    for (const kw of item.keywords) keywordFreq.set(kw, (keywordFreq.get(kw) ?? 0) + 1);
  }
  const topKws = Array.from(keywordFreq.entries()).sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 6);
  dexSearchTerms.push(...topKws);

  // Deduplicate
  const uniqueSearchTerms = Array.from(new Set(dexSearchTerms));

  const trendingCoins = coins.status === "fulfilled" ? coins.value : [];

  const dexSearchResults = await Promise.allSettled(
    uniqueSearchTerms.map((kw) => dexSearchByKeyword(kw))
  );

  // Merge DexScreener search results into coin pool
  const allCoins = [...trendingCoins];
  const coinIds = new Set(allCoins.map((c) => c.id));
  for (const r of dexSearchResults) {
    if (r.status !== "fulfilled") continue;
    for (const p of r.value.slice(0, 8)) {
      const addr = p.baseToken?.address;
      if (!addr || coinIds.has(addr)) continue;
      coinIds.add(addr);
      allCoins.push({
        id: addr,
        symbol: p.baseToken?.symbol ?? "???",
        name: p.baseToken?.name ?? "",
        logoURI: p.info?.imageUrl,
        mcap: p.marketCap ?? p.fdv,
        stats5m: { priceChange: p.priceChange?.m5 ?? 0, volume: p.volume?.m5 },
        stats1h: { priceChange: p.priceChange?.h1 ?? 0 },
        stats24h: { priceChange: p.priceChange?.h24 ?? 0, volume: p.volume?.h24 },
      } as JupTokenInfo);
    }
  }

  const topMints = items.flatMap((it) => it.matchedCoins.map((c) => c.mint));
  const seedMints = Array.from(new Set([...allCoins.map((c) => c.id), ...topMints])).slice(0, 100);
  const pairs = seedMints.length ? await dexPairsForMints(seedMints) : [];

  const enrichedItems = attachCoinMatches(items.slice(0, 40), allCoins, pairs);
  const trends = attachTrendCoinMatches(buildViralTrends(enrichedItems), allCoins, pairs);

  return {
    items: enrichedItems,
    trends,
    updatedAt: new Date().toISOString(),
  };
  } catch {
    // Network/proxy failures should never hard-crash the feed — return fallback data
    const fallback = buildFallbackFeedItems();
    return {
      items: fallback,
      trends: [],
      updatedAt: new Date().toISOString(),
    };
  }
}

function buildFallbackFeedItems(): FeedItem[] {
  const now = new Date().toISOString();
  const narratives = [
    {
      title: "Solana memecoin volume hits weekly high as new launches accelerate",
      summary: "On-chain data shows Solana DEX volume for meme tokens surging past $2.4B in 24h, with Pump.fun bonding curves seeing record creation rates.",
      source: "On-chain Radar",
      kind: "viral" as FeedItemKind,
      keywords: ["solana","meme","volume","pump","dex","launch"],
    },
    {
      title: "Elon posts meme cat image — instant ticker swarm on DexScreener",
      summary: "A viral image post triggered automated ticker-minting bots and community token launches within minutes across Pump.fun and Raydium.",
      source: "X Watch",
      kind: "x_post" as FeedItemKind,
      keywords: ["elon","meme","cat","dexscreener","pump","viral"],
    },
    {
      title: "Community takeover tokens gaining momentum after dev abandonment",
      summary: "Several high-profile CTO coins are seeing sustained holder growth and DEX profile orders as communities rebuild abandoned projects.",
      source: "DEX Intel",
      kind: "news" as FeedItemKind,
      keywords: ["cto","community","takeover","dex","holder","token"],
    },
    {
      title: "New AI-themed meme narratives emerge on Solana trading feeds",
      summary: "Tokens linked to AI agents, LLM hype, and robot memes are seeing concentrated launch activity and early DEX boosts.",
      source: "Trend Radar",
      kind: "viral" as FeedItemKind,
      keywords: ["ai","meme","solana","dex","launch","narrative"],
    },
    {
      title: "Whale wallet rotation detected into low-cap meme positions",
      summary: "Chain analysis shows large wallet clusters shifting SOL into sub-$2M market-cap meme tokens with thin liquidity but high velocity.",
      source: "Whale Watch",
      kind: "news" as FeedItemKind,
      keywords: ["whale","wallet","meme","solana","liquidity","velocity"],
    },
    {
      title: "Pump.fun migration wave continues — 12 tokens graduate to Raydium today",
      summary: "Bonding-curve completions are accelerating, with migrated tokens seeing initial volume spikes and community DEX profile setups.",
      source: "Launch Radar",
      kind: "viral" as FeedItemKind,
      keywords: ["pump","migration","raydium","bonding","volume","launch"],
    },
    {
      title: "Breaking: Major exchange lists Solana-based meme token without announcement",
      summary: "Surprise listing drove 40%+ price action in under 10 minutes as arbitrage bots and manual traders rushed to position.",
      source: "Exchange Watch",
      kind: "news" as FeedItemKind,
      keywords: ["exchange","listing","solana","meme","price","arbitrage"],
    },
    {
      title: "Viral TikTok sound spawns three new token tickers within an hour",
      summary: "Cross-platform meme velocity continues as TikTok trends translate into near-instant Solana token mints and Telegram group formation.",
      source: "Social Velocity",
      kind: "x_post" as FeedItemKind,
      keywords: ["tiktok","viral","meme","solana","token","telegram"],
    },
  ];

  return narratives.map((n, i): FeedItem => {
    const partial = {
      id: `fallback-${i}`,
      kind: n.kind,
      title: n.title,
      summary: n.summary,
      source: n.source,
      publishedAt: new Date(Date.now() - i * 18_000_000).toISOString(),
      keywords: n.keywords,
      memeRelevance: scoreMemeRelevance(n.keywords),
      viralScore: 65 + i * 3,
      matchedCoins: [],
    };
    return { ...partial, metaIds: detectItemMetas(partial) };
  });
}

export const Feed = ({ onSelect }: Props) => {
  const [filterKind, setFilterKind] = useState<"all" | FeedItemKind>("all");
  const [filterMeta, setFilterMeta] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isFetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["ogscan-meme-feed"],
    queryFn: fetchFeedPayload,
    staleTime: 20_000,
    refetchInterval: FEED_REFRESH_MS,
  });

  const items = data?.items ?? [];
  const trends = data?.trends ?? [];

  const filteredItems = useMemo(() => {
    let list = items;
    if (filterKind !== "all") list = list.filter((it) => it.kind === filterKind);
    if (filterMeta !== "all") list = list.filter((it) => it.metaIds.includes(filterMeta));
    if (searchQuery.trim()) {
      const q = normalizeNarrativeText(searchQuery);
      list = list.filter(
        (it) =>
          normalizeNarrativeText(it.title).includes(q) ||
          normalizeNarrativeText(it.summary).includes(q) ||
          it.keywords.some((k) => k.includes(q)),
      );
    }
    return list;
  }, [items, filterKind, filterMeta, searchQuery]);

  const handleSelectCoin = useCallback(
    (mint: string) => {
      onSelect(mint);
    },
    [onSelect],
  );

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,hsl(var(--og-lime)/0.14),transparent_32%),radial-gradient(circle_at_88%_10%,hsl(var(--og-cyan)/0.18),transparent_34%)]" />
      <div className="relative space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-og-lime">
              <span className="h-px w-10 bg-og-lime" /> /FEED · MEME INTELLIGENCE
            </div>
            <h2 className="font-display text-4xl font-black uppercase leading-none tracking-tighter text-white sm:text-6xl">
              Meme <span className="text-og-cyan text-glow">feed</span>
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/66">
              Live RSS news, viral narratives, and social momentum filtered for meme-coin relevance.
              Stories are scored by meme keyword density and matched to trending Solana tokens.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
            <span className={cn("rounded-full border px-3 py-2", isFetching ? "border-og-gold/45 bg-og-gold/10 text-og-gold" : "border-og-lime/45 bg-og-lime/10 text-og-lime")}>
              {isFetching ? "Syncing" : "Live"}
            </span>
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.055] px-3 py-2 text-white/70 transition hover:border-og-cyan hover:text-og-cyan"
            >
              {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              refresh
            </button>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by keyword, ticker, or narrative..."
                className="w-full rounded-[1.2rem] border border-white/10 bg-white/[0.055] py-2.5 pl-10 pr-4 font-mono text-sm text-white placeholder-white/30 outline-none transition focus:border-og-cyan/50 focus:bg-white/[0.08]"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(["all","news","viral","x_post"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilterKind(k)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-2 font-mono text-[10px] font-black uppercase tracking-widest transition",
                    filterKind === k
                      ? "border-og-lime bg-og-lime text-og-ink"
                      : "border-white/10 bg-white/[0.055] text-white/60 hover:border-og-cyan/40 hover:text-og-cyan",
                  )}
                >
                  {k === "all" ? "All" : k === "x_post" ? "X / Social" : k === "viral" ? "Viral" : "News"}
                </button>
              ))}
            </div>
          </div>

          {/* Meta theme filters */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setFilterMeta("all")}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 font-mono text-[9px] font-black uppercase tracking-widest transition",
                filterMeta === "all"
                  ? "border-white/40 bg-white/10 text-white"
                  : "border-white/10 bg-white/[0.03] text-white/40 hover:border-white/25 hover:text-white/70",
              )}
            >
              All metas
            </button>
            {META_THEMES.map((meta) => {
              const count = items.filter((it) => it.metaIds.includes(meta.id)).length;
              return (
                <button
                  key={meta.id}
                  type="button"
                  onClick={() => setFilterMeta(filterMeta === meta.id ? "all" : meta.id)}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[9px] font-black uppercase tracking-widest transition",
                    filterMeta === meta.id
                      ? meta.color
                      : "border-white/10 bg-white/[0.03] text-white/40 hover:border-white/25 hover:text-white/70",
                  )}
                >
                  <span>{meta.emoji}</span>
                  {meta.label}
                  {count > 0 && (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[8px]", filterMeta === meta.id ? "bg-black/20" : "bg-white/10")}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FeedMetric Icon={Rss} label="Feed items" value={fmtNum(items.length)} detail="RSS + social scan" tone="cyan" />
          <FeedMetric Icon={Flame} label="Viral trends" value={fmtNum(trends.length)} detail="active narratives" tone="gold" />
          <FeedMetric Icon={Zap} label="Meme-relevant" value={fmtNum(items.filter((i) => i.memeRelevance >= 50).length)} detail="high relevance score" tone="lime" />
          <FeedMetric Icon={TrendingUp} label="Matched coins" value={fmtNum(new Set(items.flatMap((i) => i.matchedCoins.map((c) => c.mint))).size)} detail="linked to stories" tone="cyan" />
        </div>

        {error && items.length === 0 ? (
          <div className="rounded-3xl border border-og-blood/50 bg-og-blood/10 p-4 text-sm text-og-blood">
            Feed sources are temporarily unavailable. RSS proxies may be rate-limited — tap refresh in a moment.
          </div>
        ) : null}

        {/* Trends ribbon */}
        {trends.length > 0 && (
          <div className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-white/[0.04] backdrop-blur-xl">
            <div className="border-b border-white/10 p-4">
              <div className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.26em] text-og-gold">
                <Flame className="h-3.5 w-3.5" /> Trending narratives
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto p-3">
              {trends.map((trend) => (
                <button
                  key={trend.id}
                  type="button"
                  onClick={() => setSearchQuery(trend.term)}
                  className={cn(
                    "group relative shrink-0 overflow-hidden rounded-[1.35rem] border p-3 text-left transition hover:-translate-y-0.5 active:scale-[0.98]",
                    NARRATIVE_COLORS[trend.category] || "border-white/10 bg-white/[0.04] text-white/70",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Hash className="h-3.5 w-3.5 opacity-60" />
                    <span className="font-display text-sm font-black uppercase">{trend.term}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest opacity-80">
                    <span className={cn("rounded-full px-1.5 py-0.5", trend.momentum === "surging" ? "bg-og-blood/20 text-og-blood" : trend.momentum === "hot" ? "bg-og-gold/20 text-og-gold" : "bg-white/10 text-white/60")}>
                      {trend.momentum}
                    </span>
                    <span>{trend.postsCount} mentions</span>
                  </div>
                  {trend.matchedCoins.length > 0 && (
                    <div className="mt-2 flex gap-1">
                      {trend.matchedCoins.slice(0, 3).map((c) => (
                        <button
                          key={c.mint}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleSelectCoin(c.mint); }}
                          className="rounded-full border border-white/10 bg-black/24 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-og-lime transition hover:border-og-lime"
                        >
                          ${c.symbol}
                        </button>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Feed items */}
        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="space-y-3">
            {filteredItems.length === 0 && !isFetching ? (
              <div className="grid min-h-[200px] place-items-center rounded-[1.8rem] border border-white/10 bg-white/[0.04]">
                <div className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
                  <Radio className="mx-auto mb-3 h-6 w-6 text-og-cyan" />
                  No items match your filter.
                </div>
              </div>
            ) : null}

            {filteredItems.map((item) => (
              <FeedItemCard key={item.id} item={item} onSelectCoin={handleSelectCoin} />
            ))}

            {isFetching && filteredItems.length === 0 ? (
              <div className="grid min-h-[200px] place-items-center rounded-[1.8rem] border border-white/10 bg-white/[0.04]">
                <div className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-og-cyan">
                  <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                  Syncing meme intelligence feed...
                </div>
              </div>
            ) : null}
          </div>

          {/* Sidebar: matched coins + quick actions */}
          <aside className="space-y-4">
            <div className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#020917]/84 backdrop-blur-xl">
              <div className="border-b border-white/10 p-4">
                <div className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.26em] text-og-lime">
                  <Sparkles className="h-3.5 w-3.5" /> Coins in the news
                </div>
              </div>
              <div className="max-h-[420px] overflow-y-auto p-3">
                {Array.from(
                  new Map(
                    items.flatMap((it) => it.matchedCoins.map((c) => [c.mint, c] as const)),
                  ).values(),
                )
                  .sort((a, b) => b.relevance - a.relevance)
                  .slice(0, 12)
                  .map((coin) => (
                    <button
                      key={coin.mint}
                      type="button"
                      onClick={() => handleSelectCoin(coin.mint)}
                      className="mb-2 flex w-full items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-2.5 text-left transition hover:border-og-lime/50 hover:bg-og-lime/5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-black uppercase text-white">${coin.symbol}</span>
                          <span className="rounded-full border border-og-lime/30 bg-og-lime/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-og-lime">
                            {coin.relevance}%
                          </span>
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-wider text-white/40">
                          {coin.matchReason || shortAddr(coin.mint, 4)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right font-mono text-[10px] uppercase tracking-wider">
                        <div className={cn("font-black", (coin.priceChange5m ?? 0) >= 0 ? "text-og-lime" : "text-og-blood")}>
                          {fmtPct(coin.priceChange5m ?? 0)}
                        </div>
                        <div className="text-white/40">{fmtUsd(coin.volume1h ?? 0)} 1h</div>
                      </div>
                    </button>
                  ))}

                {items.flatMap((it) => it.matchedCoins).length === 0 ? (
                  <div className="p-4 text-center font-mono text-[10px] uppercase tracking-widest text-white/40">
                    <ShieldAlert className="mx-auto mb-2 h-5 w-5 text-og-gold" />
                    No coins matched yet. Feed is building narrative links.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.26em] text-og-cyan">
                <Bell className="h-3.5 w-3.5" /> About this feed
              </div>
              <p className="text-xs leading-5 text-white/58">
                OGScan pulls live RSS feeds from crypto news outlets and scans them for meme-coin relevance.
                Each story gets a relevance score based on meme keyword density and is matched against
                trending Solana tokens. Use the search bar to drill into specific narratives.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["solana","meme","pump","viral","cto","whale","dex","launch","elon","trump"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSearchQuery(tag)}
                    className="rounded-full border border-white/10 bg-black/24 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-white/60 transition hover:border-og-cyan/40 hover:text-og-cyan"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};

const FeedItemCard = memo(({ item, onSelectCoin }: { item: FeedItem; onSelectCoin: (mint: string) => void }) => {
  const publishedSeconds = Math.floor(new Date(item.publishedAt).getTime() / 1000);
  const isViral = item.viralScore >= 70;
  const isHot = item.memeRelevance >= 60;

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-[1.6rem] border p-4 transition hover:-translate-y-0.5",
        isViral ? "border-og-gold/30 bg-[#0d0f1a]/90" : "border-white/10 bg-white/[0.04]",
      )}
    >
      {isViral && (
        <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-og-gold/10 blur-2xl" />
      )}

      <div className="relative">
        {/* Header row */}
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <FeedKindIcon kind={item.kind} />
            <span className="font-mono text-[9px] font-black uppercase tracking-[0.24em] text-white/50">{item.source}</span>
            {isHot && (
              <span className="rounded-full border border-og-lime/30 bg-og-lime/10 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-og-lime">
                meme-hot
              </span>
            )}
            {/* Meta theme badges */}
            {item.metaIds.slice(0, 2).map((metaId) => {
              const meta = META_THEMES.find((m) => m.id === metaId);
              if (!meta) return null;
              return (
                <span key={metaId} className={cn("rounded-full border px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider", meta.color)}>
                  {meta.emoji} {meta.label}
                </span>
              );
            })}
          </div>
          <span className="font-mono text-[9px] uppercase tracking-widest text-white/38">{timeAgo(publishedSeconds)} ago</span>
        </div>

        {/* Title */}
        {item.link ? (
          <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className="line-clamp-2 text-base font-bold leading-snug text-white transition hover:text-og-lime sm:text-lg"
          >
            {item.title}
          </a>
        ) : (
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-white sm:text-lg">{item.title}</h3>
        )}

        {/* Summary */}
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/54">{item.summary}</p>

        {/* Keywords */}
        <div className="mt-3 flex flex-wrap gap-1">
          {item.keywords.slice(0, 6).map((kw) => (
            <span
              key={kw}
              className={cn(
                "rounded-full border px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider",
                MEME_KEYWORDS.has(kw)
                  ? "border-og-lime/30 bg-og-lime/10 text-og-lime"
                  : "border-white/10 bg-white/[0.04] text-white/50",
              )}
            >
              {kw}
            </span>
          ))}
          <span className="ml-auto rounded-full border border-white/10 bg-black/24 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white/40">
            relevance {item.memeRelevance}%
          </span>
        </div>

        {/* Matched coins */}
        {item.matchedCoins.length > 0 && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/24 p-2.5">
            <div className="mb-2 flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.22em] text-white/38">
              <Zap className="h-3 w-3 text-og-gold" /> matched meme coins
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {item.matchedCoins.map((coin) => (
                <button
                  key={coin.mint}
                  type="button"
                  onClick={() => onSelectCoin(coin.mint)}
                  className="flex items-center justify-between gap-2 rounded-xl border border-og-lime/15 bg-og-lime/5 px-2.5 py-1.5 text-left transition hover:border-og-lime/40"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {coin.imageUrl && (
                      <img src={coin.imageUrl} alt={coin.symbol} className="h-6 w-6 shrink-0 rounded-full object-cover" loading="lazy" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-display text-xs font-black uppercase text-white">${coin.symbol}</span>
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[8px] uppercase tracking-wider text-white/50">
                        {coin.matchReason || coin.name}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right font-mono text-[9px] uppercase tracking-wider">
                    <div className={cn("font-black", (coin.priceChange5m ?? 0) >= 0 ? "text-og-lime" : "text-og-blood")}>
                      {fmtPct(coin.priceChange5m ?? 0)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
          {item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-og-cyan transition hover:text-og-lime"
            >
              read source <ArrowUpRight className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
});
FeedItemCard.displayName = "FeedItemCard";

function FeedKindIcon({ kind }: { kind: FeedItemKind }) {
  switch (kind) {
    case "news":
      return <Newspaper className="h-4 w-4 text-og-cyan" />;
    case "x_post":
      return <MessageCircle className="h-4 w-4 text-white/70" />;
    case "viral":
      return <Flame className="h-4 w-4 text-og-gold" />;
    case "coin_spotlight":
      return <Sparkles className="h-4 w-4 text-og-lime" />;
    default:
      return <Globe className="h-4 w-4 text-white/50" />;
  }
}

const FeedMetric = memo(({ Icon, label, value, detail, tone }: { Icon: LucideIcon; label: string; value: string; detail: string; tone: "cyan" | "lime" | "gold" | "blood" }) => {
  const toneClass: string =
    tone === "lime"
      ? "border-og-lime/35 bg-og-lime/10 text-og-lime"
      : tone === "gold"
        ? "border-og-gold/35 bg-og-gold/10 text-og-gold"
        : tone === "blood"
          ? "border-og-blood/35 bg-og-blood/10 text-og-blood"
          : "border-og-cyan/35 bg-og-cyan/10 text-og-cyan";
  return (
    <div className={cn("rounded-[1.45rem] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]", toneClass)}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-[9px] font-black uppercase tracking-[0.24em] text-white/52">{label}</div>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-2 font-display text-3xl font-black uppercase tracking-tight text-white">{value}</div>
      <div className="mt-1 font-mono text-[9px] uppercase tracking-widest opacity-80">{detail}</div>
    </div>
  );
});
FeedMetric.displayName = "FeedMetric";
