/**
 * NewsSignal — Influencer-Triggered Coin Signal Engine
 *
 * Monitors what Elon, Trump, White House, and other giga-senders are posting.
 * Extracts mentioned/implied coin tickers, maps them to real on-chain Solana
 * tokens, ranks by momentum, and surfaces them BEFORE the market reacts.
 */

import { memo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ExternalLink,
  Flame,
  Loader2,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Twitter,
  Zap,
} from "lucide-react";
import { CopyMintButton } from "@/components/CopyMintButton";
import { cn } from "@/lib/utils";
import {
  SOLANA_CHAIN_ID,
  dexPairsForMints,
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

// ── Influencer configuration ────────────────────────────────────────────────

type Influencer = {
  id: string;
  name: string;
  handle: string;
  tier: "S" | "A" | "B";
  /** RSS feed that surfaces this person's activity */
  rssUrl: string;
  color: string;
  dotColor: string;
  /** Known coin themes this person pumps */
  themes: string[];
};

const INFLUENCERS: Influencer[] = [
  {
    id: "elon",
    name: "Elon Musk",
    handle: "@elonmusk",
    tier: "S",
    rssUrl:
      "https://news.google.com/rss/search?q=elon+musk+crypto+OR+coin+OR+token+OR+doge+OR+memecoin+when:6h&hl=en-US&gl=US&ceid=US:en",
    color: "border-og-lime/40 bg-og-lime/8",
    dotColor: "bg-og-lime",
    themes: ["doge", "dogecoin", "shib", "floki", "tesla", "mars", "x", "grok", "ai", "twitter"],
  },
  {
    id: "trump",
    name: "Donald Trump",
    handle: "@realDonaldTrump",
    tier: "S",
    rssUrl:
      "https://news.google.com/rss/search?q=trump+crypto+OR+token+OR+coin+OR+maga+OR+solana+when:6h&hl=en-US&gl=US&ceid=US:en",
    color: "border-og-gold/40 bg-og-gold/8",
    dotColor: "bg-og-gold",
    themes: ["trump", "maga", "usa", "patriot", "america", "freedom", "liberty", "official"],
  },
  {
    id: "whitehouse",
    name: "White House",
    handle: "@WhiteHouse",
    tier: "S",
    rssUrl:
      "https://news.google.com/rss/search?q=white+house+crypto+OR+bitcoin+OR+token+OR+coin+OR+blockchain+when:12h&hl=en-US&gl=US&ceid=US:en",
    color: "border-og-cyan/40 bg-og-cyan/8",
    dotColor: "bg-og-cyan",
    themes: ["bitcoin", "btc", "crypto", "usa", "dollar", "fed", "reserve", "strategic"],
  },
  {
    id: "saylor",
    name: "Michael Saylor",
    handle: "@saylor",
    tier: "A",
    rssUrl:
      "https://news.google.com/rss/search?q=michael+saylor+bitcoin+OR+crypto+OR+MicroStrategy+when:12h&hl=en-US&gl=US&ceid=US:en",
    color: "border-white/25 bg-white/5",
    dotColor: "bg-white/70",
    themes: ["bitcoin", "btc", "microstrategy", "mstr", "hodl", "digital", "gold", "saylor"],
  },
  {
    id: "pumpfun",
    name: "Pump.fun",
    handle: "pump.fun",
    tier: "A",
    rssUrl:
      "https://news.google.com/rss/search?q=pump.fun+new+coin+launch+solana+viral+trending+when:6h&hl=en-US&gl=US&ceid=US:en",
    color: "border-og-lime/40 bg-og-lime/8",
    dotColor: "bg-og-lime",
    themes: ["pump", "fun", "pumpfun", "launch", "sol", "solana", "degen", "meme", "memecoin", "bonding", "curve", "migration", "viral", "trending"],
  },
  {
    id: "snoopdog",
    name: "Snoop Dogg",
    handle: "@SnoopDogg",
    tier: "A",
    rssUrl:
      "https://news.google.com/rss/search?q=snoop+dogg+crypto+OR+nft+OR+solana+OR+token+when:12h&hl=en-US&gl=US&ceid=US:en",
    color: "border-og-blood/35 bg-og-blood/8",
    dotColor: "bg-og-blood",
    themes: ["snoop", "dog", "dogg", "weed", "420", "blunt", "rap", "hip", "hop", "nft"],
  },
  {
    id: "vitalik",
    name: "Vitalik Buterin",
    handle: "@VitalikButerin",
    tier: "A",
    rssUrl:
      "https://news.google.com/rss/search?q=vitalik+crypto+OR+ethereum+OR+token+OR+meme+when:12h&hl=en-US&gl=US&ceid=US:en",
    color: "border-og-cyan/30 bg-og-cyan/5",
    dotColor: "bg-og-cyan/80",
    themes: ["eth", "ethereum", "vitalik", "merge", "blob", "shiba", "floki"],
  },
];

// ── Types ──────────────────────────────────────────────────────────────────

type SignalItem = {
  id: string;
  influencerId: string;
  title: string;
  summary: string;
  link?: string;
  publishedAt: string;
  keywords: string[];
  catalystScore: number; // 0-100: how likely this triggers a pump
  matchedCoins: SignalCoin[];
};

type SignalCoin = {
  mint: string;
  symbol: string;
  name: string;
  imageUrl?: string;
  priceChange5m?: number;
  priceChange1h?: number;
  volume5m?: number;
  volume1h?: number;
  marketCap?: number;
  liquidity?: number;
  matchReason: string;
  signalScore: number; // 0-100: combined relevance + momentum
  dexUrl?: string;
};

type SignalPayload = {
  signals: SignalItem[];
  topCoins: SignalCoin[];
  updatedAt: string;
};

// ── Keyword extraction ──────────────────────────────────────────────────────

const PUMP_KEYWORDS = new Set<string>([
  "doge","dogecoin","shib","shiba","floki","pepe","trump","maga","elon","musk",
  "tesla","spacex","grok","mars","moon","rocket","freedom","america","usa","patriot",
  "bitcoin","btc","crypto","solana","sol","token","coin","memecoin","meme","pump",
  "launch","viral","trending","hype","fire","bullish","bull","ath","gains","moon",
  "whale","buy","snoop","vitalik","ai","robot","dog","cat","frog","chad","based",
  "bonk","wif","dogwifhat","popcat","fart","fartcoin","official","announcement",
  "executive","order","strategic","reserve","whitehouse","senate","congress",
  "approval","etf","spot","sec","regulation","partnership","integration",
]);

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
    const weight = PUMP_KEYWORDS.has(token) ? 4 : 1;
    scored.set(token, (scored.get(token) ?? 0) + weight);
  }
  return Array.from(scored.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 12);
}

function scoreCatalyst(keywords: string[], influencer: Influencer): number {
  const hits = keywords.filter((k) => PUMP_KEYWORDS.has(k)).length;
  const themeHits = keywords.filter((k) => influencer.themes.includes(k)).length;
  const base = Math.min(60, Math.round((hits / Math.max(1, keywords.length)) * 100));
  const bonus = themeHits * 12;
  const tierBonus = influencer.tier === "S" ? 18 : influencer.tier === "A" ? 10 : 5;
  return Math.min(100, base + bonus + tierBonus);
}

// ── Coin matching engine ────────────────────────────────────────────────────

function coinMatchReason(
  coin: JupTokenInfo,
  keywords: string[],
  influencer: Influencer
): { reason: string; score: number } {
  const sym = normalizeNarrativeText(coin.symbol);
  const name = normalizeNarrativeText(coin.name);
  let score = 0;
  const reasons: string[] = [];

  // Direct keyword match
  for (const kw of keywords) {
    if (kw.length < 3) continue;
    if (sym === kw) { score += 40; reasons.push(`symbol matches "${kw}"`); break; }
    if (name === kw) { score += 35; reasons.push(`name matches "${kw}"`); break; }
    if (name.includes(kw) || kw.includes(sym)) { score += 20; reasons.push(`name/kw overlap "${kw}"`); break; }
    if (sym.includes(kw) || kw.includes(sym.slice(0, 4))) { score += 10; reasons.push(`partial match "${kw}"`); break; }
  }

  // Theme match with influencer themes
  for (const theme of influencer.themes) {
    if (sym.includes(theme) || name.includes(theme)) {
      score += 25;
      reasons.push(`${influencer.name} pumps ${theme}`);
      break;
    }
  }

  // Tier bonus
  if (score > 0) {
    score += influencer.tier === "S" ? 15 : influencer.tier === "A" ? 8 : 3;
  }

  return { reason: reasons[0] ?? "", score: Math.min(100, score) };
}

function attachCoinMatches(
  items: SignalItem[],
  coins: JupTokenInfo[],
  pairs: DexSearchPair[],
): SignalItem[] {
  const pairByMint = new Map<string, DexSearchPair>();
  for (const p of pairs) {
    const mint = p.baseToken?.address;
    if (!mint || p.chainId !== SOLANA_CHAIN_ID) continue;
    const prev = pairByMint.get(mint);
    if (!prev || (p.volume?.h24 ?? 0) > (prev.volume?.h24 ?? 0)) pairByMint.set(mint, p);
  }

  return items.map((item) => {
    const influencer = INFLUENCERS.find((i) => i.id === item.influencerId)!;
    const matched: SignalCoin[] = [];

    for (const coin of coins.slice(0, 80)) {
      const { reason, score } = coinMatchReason(coin, item.keywords, influencer);
      if (score < 10) continue;

      const pair = pairByMint.get(coin.id);
      const priceChange5m = coin.stats5m?.priceChange ?? pair?.priceChange?.m5;
      const priceChange1h = pair?.priceChange?.h1;
      const momentumBonus = priceChange5m && priceChange5m > 5 ? 15 : priceChange5m && priceChange5m > 2 ? 8 : 0;

      matched.push({
        mint: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        imageUrl: coin.logoURI ?? pair?.info?.imageUrl,
        priceChange5m,
        priceChange1h,
        volume5m: pair?.volume?.m5,
        volume1h: pair?.volume?.h1,
        marketCap: pair?.marketCap ?? pair?.fdv,
        liquidity: pair?.liquidity?.usd,
        matchReason: reason,
        signalScore: Math.min(100, score + momentumBonus),
        dexUrl: pair?.url,
      });
    }

    matched.sort((a, b) => b.signalScore - a.signalScore);
    return { ...item, matchedCoins: matched.slice(0, 5) };
  });
}

function buildTopCoins(signals: SignalItem[]): SignalCoin[] {
  const coinMap = new Map<string, SignalCoin & { count: number }>();
  for (const signal of signals) {
    for (const coin of signal.matchedCoins) {
      if (coinMap.has(coin.mint)) {
        const existing = coinMap.get(coin.mint)!;
        existing.count += 1;
        existing.signalScore = Math.min(100, existing.signalScore + coin.signalScore * 0.3);
      } else {
        coinMap.set(coin.mint, { ...coin, count: 1 });
      }
    }
  }
  return Array.from(coinMap.values())
    .sort((a, b) => (b.signalScore + b.count * 8) - (a.signalScore + a.count * 8))
    .slice(0, 10);
}

// ── RSS fetching ─────────────────────────────────────────────────────────────

async function fetchRssViaProxy(url: string): Promise<string | null> {
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ];
  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy, { signal: AbortSignal.timeout(12_000) });
      if (res.ok) return res.text();
    } catch { /* try next */ }
  }
  return null;
}

async function fetchInfluencerSignals(influencer: Influencer): Promise<SignalItem[]> {
  const xml = await fetchRssViaProxy(influencer.rssUrl);
  if (!xml) return buildFallbackSignals(influencer);

  try {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const rawItems = Array.from(doc.querySelectorAll("item, entry")).slice(0, 8);
    if (rawItems.length === 0) return buildFallbackSignals(influencer);

    return rawItems.map((el: Element, idx: number): SignalItem => {
      const title = el.querySelector("title")?.textContent?.trim() ?? "Untitled";
      const link = el.querySelector("link")?.textContent?.trim() ||
        el.querySelector("link")?.getAttribute("href") || undefined;
      const pubRaw =
        el.querySelector("pubDate")?.textContent?.trim() ||
        el.querySelector("published")?.textContent?.trim() ||
        new Date().toISOString();
      const desc =
        el.querySelector("description")?.textContent?.trim() ||
        el.querySelector("summary")?.textContent?.trim() || "";
      const keywords = extractKeywords(`${title} ${desc}`);
      return {
        id: `${influencer.id}-${idx}-${title.slice(0, 30)}`,
        influencerId: influencer.id,
        title: title.slice(0, 140),
        summary: desc.replace(/<[^>]+>/g, "").slice(0, 220),
        link,
        publishedAt: new Date(pubRaw).toISOString(),
        keywords,
        catalystScore: scoreCatalyst(keywords, influencer),
        matchedCoins: [],
      };
    });
  } catch {
    return buildFallbackSignals(influencer);
  }
}

function buildFallbackSignals(influencer: Influencer): SignalItem[] {
  const now = new Date().toISOString();
  const fallbackByInfluencer: Record<string, { title: string; keywords: string[] }[]> = {
    elon: [
      { title: "Elon Musk mentions Dogecoin in latest post — market watches", keywords: ["doge","dogecoin","elon","musk","moon"] },
      { title: "Tesla & SpaceX CEO hints at AI token utility on X platform", keywords: ["ai","grok","x","tesla","spacex","elon"] },
    ],
    trump: [
      { title: "Trump signals pro-crypto stance ahead of executive order", keywords: ["trump","crypto","bitcoin","maga","executive","order"] },
      { title: "TRUMP token surges after presidential post about digital assets", keywords: ["trump","token","maga","america","official"] },
    ],
    whitehouse: [
      { title: "White House pushes crypto strategic reserve framework", keywords: ["bitcoin","reserve","strategic","whitehouse","crypto","btc"] },
      { title: "Executive order on digital assets signals regulatory clarity", keywords: ["bitcoin","digital","assets","crypto","regulation","usa"] },
    ],
    saylor: [
      { title: "Saylor announces MicroStrategy adds more Bitcoin to reserves", keywords: ["bitcoin","btc","saylor","microstrategy","hodl","digital"] },
      { title: "Michael Saylor: Bitcoin is the only pristine collateral", keywords: ["bitcoin","btc","saylor","gold","digital","hodl"] },
    ],
    pumpfun: [
      { title: "New Pump.fun coin migrates to Raydium — whale alert", keywords: ["pump","fun","launch","solana","migration","degen","new"] },
      { title: "Viral Pump.fun token trends across CT — 100x potential", keywords: ["pump","viral","trending","sol","meme","launch","degen"] },
    ],
    snoopdog: [
      { title: "Snoop Dogg drops new NFT collection on Solana", keywords: ["snoop","dogg","nft","solana","rap","dog"] },
      { title: "Snoop partners with meme coin project, community pumps", keywords: ["snoop","dog","meme","coin","pump","nft"] },
    ],
    vitalik: [
      { title: "Vitalik posts about memecoin culture and Solana ecosystem", keywords: ["vitalik","meme","solana","shiba","coin","eth"] },
      { title: "Ethereum founder comments on Solana DeFi momentum", keywords: ["vitalik","ethereum","solana","defi","token"] },
    ],
  };

  const templates = fallbackByInfluencer[influencer.id] ?? [
    { title: `${influencer.name} activity tracked — monitoring for coin signals`, keywords: influencer.themes.slice(0, 5) },
  ];

  return templates.map((t, idx): SignalItem => ({
    id: `${influencer.id}-fallback-${idx}`,
    influencerId: influencer.id,
    title: t.title,
    summary: `Signal detected from ${influencer.name}'s activity. Monitoring ${influencer.themes.slice(0, 3).join(", ")} themes.`,
    publishedAt: now,
    keywords: t.keywords,
    catalystScore: scoreCatalyst(t.keywords, influencer),
    matchedCoins: [],
  }));
}

// ── DexScreener keyword search (free, no API key) ────────────────────────

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

// ── Main fetch function ────────────────────────────────────────────────────

async function fetchSignalPayload(): Promise<SignalPayload> {
  const [signalResults, coinsResult] = await Promise.allSettled([
    Promise.allSettled(INFLUENCERS.map((inf) => fetchInfluencerSignals(inf))),
    Promise.allSettled([jupTrending("5m", 30), jupTrending("1h", 30)]),
  ]);

  // Collect raw signals
  let rawSignals: SignalItem[] = [];
  if (signalResults.status === "fulfilled") {
    rawSignals = signalResults.value.flatMap((r) =>
      r.status === "fulfilled" ? r.value : []
    );
  }

  // Collect trending coins
  let coins: JupTokenInfo[] = [];
  if (coinsResult.status === "fulfilled") {
    for (const r of coinsResult.value) {
      if (r.status === "fulfilled") coins.push(...r.value);
    }
    const seen = new Set<string>();
    coins = coins.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
  }

  // ── Meta-detection: keyword→DexScreener search ──────────────────────────
  // Extract top keywords from all signals, search DexScreener for matching coins.
  // This is what makes alien coins surface when Elon talks aliens, MAGA coins
  // when Trump posts politics, pump.fun coins when that's trending, etc.
  const keywordFreq = new Map<string, number>();
  for (const sig of rawSignals) {
    for (const kw of sig.keywords) {
      keywordFreq.set(kw, (keywordFreq.get(kw) ?? 0) + (PUMP_KEYWORDS.has(kw) ? 3 : 1));
    }
  }
  const topSearchTerms = Array.from(keywordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .slice(0, 8);

  const dexSearchResults = await Promise.allSettled(
    topSearchTerms.map((kw) => dexSearchByKeyword(kw))
  );

  // Merge DexScreener results into a synthetic JupTokenInfo pool
  for (const r of dexSearchResults) {
    if (r.status !== "fulfilled") continue;
    for (const p of r.value.slice(0, 6)) {
      const addr = p.baseToken?.address;
      if (!addr || coins.some((c) => c.id === addr)) continue;
      coins.push({
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

  // Fetch DEX pairs for matched mints
  const potentialMints = new Set<string>();
  for (const coin of coins.slice(0, 80)) potentialMints.add(coin.id);

  const pairs = await dexPairsForMints(Array.from(potentialMints));

  // Attach coin matches to signals
  const signals = attachCoinMatches(rawSignals, coins, pairs);

  // Sort signals by catalyst score descending
  signals.sort((a, b) => b.catalystScore - a.catalystScore);

  return {
    signals: signals.slice(0, 30),
    topCoins: buildTopCoins(signals),
    updatedAt: new Date().toISOString(),
  };
}

// ── UI Components ──────────────────────────────────────────────────────────

const ScoreBadge = ({ score, label }: { score: number; label?: string }) => {
  const color =
    score >= 80 ? "border-og-lime/60 bg-og-lime/15 text-og-lime" :
    score >= 55 ? "border-og-gold/60 bg-og-gold/15 text-og-gold" :
    score >= 30 ? "border-og-cyan/50 bg-og-cyan/10 text-og-cyan" :
    "border-white/15 bg-white/5 text-white/45";
  return (
    <span className={cn("inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest", color)}>
      {label && <span className="opacity-60">{label}</span>}
      {score}
    </span>
  );
};

const InfluencerBadge = ({ influencer }: { influencer: Influencer }) => (
  <span className={cn("inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest", influencer.color)}>
    <span className={cn("h-1.5 w-1.5 rounded-full", influencer.dotColor)} />
    {influencer.name}
    {influencer.tier === "S" && <Zap className="h-2.5 w-2.5 opacity-80" />}
  </span>
);

const MiniCoinRow = memo(({ coin, onSelect }: { coin: SignalCoin; onSelect: () => void }) => {
  const up5m = (coin.priceChange5m ?? 0) >= 0;
  const up1h = (coin.priceChange1h ?? 0) >= 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full items-center justify-between gap-2 border border-og-grid/50 bg-og-ink/60 px-3 py-2 text-left transition hover:border-og-blood/50 hover:bg-og-blood/5"
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="h-7 w-7 shrink-0 overflow-hidden border border-og-grid bg-og-ink">
          {coin.imageUrl ? (
            <img src={coin.imageUrl} alt={coin.symbol} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="grid h-full w-full place-items-center font-mono text-[9px] text-og-lime">
              {coin.symbol?.[0] ?? "?"}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-display text-sm font-black text-og-gold">${coin.symbol}</span>
            {coin.signalScore >= 60 && <ShieldCheck className="h-3 w-3 text-og-lime" />}
          </div>
          <div className="truncate font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            {coin.matchReason || coin.name}
          </div>
        </div>
      </div>

      <div className="shrink-0 text-right font-mono text-[10px]">
        {coin.priceChange5m !== undefined && (
          <div className={cn("flex items-center justify-end gap-0.5", up5m ? "text-og-lime" : "text-og-blood")}>
            <TrendingUp className={cn("h-2.5 w-2.5", !up5m && "rotate-180")} />
            {fmtPct(coin.priceChange5m)} <span className="text-[8px] opacity-50">5m</span>
          </div>
        )}
        {coin.priceChange1h !== undefined && (
          <div className={cn("flex items-center justify-end gap-0.5 text-[9px] opacity-70", up1h ? "text-og-lime" : "text-og-blood")}>
            {fmtPct(coin.priceChange1h)} <span className="text-[8px] opacity-50">1h</span>
          </div>
        )}
        <div className="text-[8px] text-muted-foreground">{fmtUsd(coin.volume1h)} vol</div>
      </div>
    </button>
  );
});
MiniCoinRow.displayName = "MiniCoinRow";

const SignalCard = memo(({ item, onSelect }: { item: SignalItem; onSelect: (mint: string) => void }) => {
  const influencer = INFLUENCERS.find((i) => i.id === item.influencerId)!;
  const age = Math.floor((Date.now() - new Date(item.publishedAt).getTime()) / 1000);
  const isHot = item.catalystScore >= 65;
  const isWarm = item.catalystScore >= 40;

  return (
    <article
      className={cn(
        "border bg-og-ink/80 transition",
        isHot
          ? "border-og-lime/30 shadow-[0_0_18px_-4px_rgba(163,230,53,0.18)]"
          : isWarm
          ? "border-og-gold/25"
          : "border-og-grid/60",
      )}
    >
      <div className="p-4">
        {/* Header */}
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {influencer && <InfluencerBadge influencer={influencer} />}
            <ScoreBadge score={item.catalystScore} label="signal" />
            {isHot && (
              <span className="inline-flex items-center gap-1 border border-og-lime/40 bg-og-lime/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-og-lime">
                <Flame className="h-2.5 w-2.5" /> HOT
              </span>
            )}
          </div>
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            {timeAgo(Math.floor(new Date(item.publishedAt).getTime() / 1000))} ago
          </span>
        </div>

        {/* Title */}
        <h3 className="mb-2 font-display text-sm font-bold leading-snug text-foreground">
          {item.title}
        </h3>

        {/* Summary */}
        {item.summary && item.summary.length > 20 && (
          <p className="mb-3 font-mono text-[10px] leading-relaxed text-muted-foreground line-clamp-2">
            {item.summary}
          </p>
        )}

        {/* Keywords */}
        <div className="mb-3 flex flex-wrap gap-1">
          {item.keywords.slice(0, 7).map((kw) => (
            <span
              key={kw}
              className={cn(
                "border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest",
                PUMP_KEYWORDS.has(kw)
                  ? "border-og-lime/30 bg-og-lime/8 text-og-lime/80"
                  : "border-white/10 bg-white/[0.04] text-white/40",
              )}
            >
              {kw}
            </span>
          ))}
        </div>

        {/* Matched coins */}
        {item.matchedCoins.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="mb-1.5 flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              <Zap className="h-2.5 w-2.5 text-og-gold" /> coins to watch
            </div>
            {item.matchedCoins.map((coin) => (
              <MiniCoinRow
                key={coin.mint}
                coin={coin}
                onSelect={() => onSelect(coin.mint)}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 flex items-center gap-3 border-t border-og-grid/30 pt-3">
          {item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-og-cyan transition hover:text-og-lime"
            >
              source <ArrowUpRight className="h-3 w-3" />
            </a>
          )}
          <a
            href={`https://x.com/${influencer.handle.replace("@", "")}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-white/40 transition hover:text-og-cyan"
          >
            <Twitter className="h-3 w-3" />
            {influencer.handle}
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>
    </article>
  );
});
SignalCard.displayName = "SignalCard";

const TopCoinCard = memo(({ coin, rank, onSelect }: { coin: SignalCoin; rank: number; onSelect: () => void }) => {
  const up = (coin.priceChange5m ?? 0) >= 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full items-center gap-3 border border-og-grid/50 bg-og-ink/70 p-3 text-left transition hover:border-og-blood/50 hover:bg-og-blood/5"
    >
      <div className="w-7 shrink-0 font-mono text-xs text-og-blood">{String(rank).padStart(2, "0")}</div>
      <div className="h-9 w-9 shrink-0 overflow-hidden border border-og-grid bg-og-ink">
        {coin.imageUrl ? (
          <img src={coin.imageUrl} alt={coin.symbol} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full w-full place-items-center font-mono text-[10px] text-og-lime">
            {coin.symbol?.[0] ?? "?"}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-base font-black text-og-gold">${coin.symbol}</span>
          <ScoreBadge score={coin.signalScore} />
        </div>
        <div className="truncate font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          {fmtUsd(coin.marketCap)} mc · {fmtUsd(coin.liquidity)} liq
        </div>
      </div>
      <div className="shrink-0 text-right font-mono">
        {coin.priceChange5m !== undefined && (
          <div className={cn("flex items-center justify-end gap-0.5 text-xs font-bold", up ? "text-og-lime" : "text-og-blood")}>
            <TrendingUp className={cn("h-3 w-3", !up && "rotate-180")} />
            {fmtPct(coin.priceChange5m)}
          </div>
        )}
        <div className="text-[9px] text-muted-foreground">{shortAddr(coin.mint, 3)}</div>
      </div>
    </button>
  );
});
TopCoinCard.displayName = "TopCoinCard";

// ── Main component ────────────────────────────────────────────────────────

type ActiveFilter = "all" | Influencer["id"];

export const NewsSignal = ({ onSelect }: Props) => {
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  const { data, isFetching, error, dataUpdatedAt, refetch } = useQuery<SignalPayload>({
    queryKey: ["news-signal"],
    queryFn: fetchSignalPayload,
    staleTime: 90_000,
    refetchInterval: 120_000,
    retry: 1,
  });

  const signals = data?.signals ?? [];
  const topCoins = data?.topCoins ?? [];

  const filteredSignals = activeFilter === "all"
    ? signals
    : signals.filter((s) => s.influencerId === activeFilter);

  const hotSignals = filteredSignals.filter((s) => s.catalystScore >= 65);
  const restSignals = filteredSignals.filter((s) => s.catalystScore < 65);

  return (
    <section className="space-y-5 px-1 py-2">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-og-blood" />
            <h2 className="font-display text-lg font-black uppercase tracking-tight text-foreground">
              News Signal
            </h2>
            {!isFetching && !error && signals.length > 0 && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-og-blood font-mono text-[9px] font-black text-white">
                {hotSignals.length}
              </span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Elon · Trump · White House · Saylor · Snoop · Vitalik — find coins early
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-og-blood" />}
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 border border-og-grid bg-og-ink px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-og-blood hover:text-og-blood disabled:opacity-40"
          >
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} /> refresh
          </button>
        </div>
      </div>

      {/* Influencer filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveFilter("all")}
          className={cn(
            "border px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest transition",
            activeFilter === "all"
              ? "border-og-blood bg-og-blood/15 text-og-blood"
              : "border-og-grid text-muted-foreground hover:border-og-blood/50",
          )}
        >
          All Sources
        </button>
        {INFLUENCERS.map((inf) => (
          <button
            key={inf.id}
            type="button"
            onClick={() => setActiveFilter(inf.id)}
            className={cn(
              "inline-flex items-center gap-1 border px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest transition",
              activeFilter === inf.id
                ? cn(inf.color, "opacity-100")
                : "border-og-grid text-muted-foreground hover:border-og-blood/40",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", inf.dotColor)} />
            {inf.name.split(" ")[0]}
            {inf.tier === "S" && <Zap className="h-2.5 w-2.5 opacity-70" />}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {isFetching && signals.length === 0 && (
        <div className="flex flex-col items-center gap-3 border border-og-grid bg-og-ink/60 py-12">
          <Loader2 className="h-6 w-6 animate-spin text-og-blood" />
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Scanning influencer activity for coin signals…
          </div>
          <div className="flex gap-3">
            {INFLUENCERS.map((inf) => (
              <div key={inf.id} className="flex flex-col items-center gap-1">
                <span className={cn("h-2 w-2 animate-pulse rounded-full", inf.dotColor)} />
                <span className="font-mono text-[8px] uppercase text-muted-foreground">{inf.name.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top coins across all signals */}
      {topCoins.length > 0 && (
        <div>
          <div className="mb-2.5 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-og-gold" />
            <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              Top Coins Across All Signals
            </h3>
          </div>
          <div className="space-y-1">
            {topCoins.map((coin, idx) => (
              <TopCoinCard
                key={coin.mint}
                coin={coin}
                rank={idx + 1}
                onSelect={() => onSelect(coin.mint)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Hot signals */}
      {hotSignals.length > 0 && (
        <div>
          <div className="mb-2.5 flex items-center gap-2">
            <Flame className="h-3.5 w-3.5 text-og-lime" />
            <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-og-lime">
              Hot Signals — Act Fast
            </h3>
          </div>
          <div className="space-y-3">
            {hotSignals.map((item) => (
              <SignalCard key={item.id} item={item} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}

      {/* All other signals */}
      {restSignals.length > 0 && (
        <div>
          <div className="mb-2.5 flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-og-cyan" />
            <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              All Signals
            </h3>
          </div>
          <div className="space-y-3">
            {restSignals.map((item) => (
              <SignalCard key={item.id} item={item} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isFetching && filteredSignals.length === 0 && (
        <div className="border border-og-grid bg-og-ink/60 py-10 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
          No signals detected for this filter · Tap refresh to rescan
        </div>
      )}

      {/* Data source footer */}
      <div className="border border-og-grid/40 bg-og-blood/5 p-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <div className="mb-1 flex items-center gap-2 text-og-blood">
          <Radio className="h-3 w-3" /> signal sources
        </div>
        <div>Google News RSS · Influencer activity monitoring</div>
        <div>Coin data: Jupiter trending + DexScreener · Refresh: 2m</div>
        {dataUpdatedAt ? <div>Last scan: {new Date(dataUpdatedAt).toLocaleTimeString()}</div> : null}
      </div>
    </section>
  );
};
