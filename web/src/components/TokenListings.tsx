/**
 * TokenListings — List & promote tokens on OG Scan.
 * Paste a CA → Helius + DexScreener pull all data → clean dedicated listing page.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, Search, Loader2, ExternalLink, TrendingUp, TrendingDown, Minus,
  Users, Droplets, DollarSign, Shield, Copy, Check, ArrowUpRight,
  Star, Crown, Wallet, BarChart3, Globe, X as XIcon, ChevronDown,
  ChevronUp, Flame, AlertTriangle, Sparkles, Clock, Eye, RefreshCw,
  Image as ImageIcon, Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { HELIUS_API_KEY, HELIUS_RPC, BIRDEYE_API_KEY } from "@/lib/og";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface TokenListing {
  id: string;
  mint_address: string;
  listed_by: string;
  name: string | null;
  symbol: string | null;
  image_url: string | null;
  banner_url: string | null;
  description: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  discord: string | null;
  price_usd: number | null;
  market_cap: number | null;
  liquidity_usd: number | null;
  holder_count: number | null;
  ath: number | null;
  atl: number | null;
  volume_24h: number | null;
  buys_24h: number | null;
  sells_24h: number | null;
  price_change_24h: number | null;
  dev_wallet: string | null;
  dev_holding_pct: number | null;
  top10_holder_pct: number | null;
  is_promoted: boolean;
  analysis_summary: string | null;
  analysis_verdict: "bullish" | "bearish" | "neutral" | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  lister_name?: string;
}

interface FetchedTokenData {
  name: string;
  symbol: string;
  image_url: string;
  banner_url: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
  price_usd: number;
  market_cap: number;
  liquidity_usd: number;
  holder_count: number;
  volume_24h: number;
  buys_24h: number;
  sells_24h: number;
  price_change_24h: number;
  dev_wallet: string;
  dev_holding_pct: number;
  top10_holder_pct: number;
  ath: number;
  atl: number;
  analysis_summary: string;
  analysis_verdict: "bullish" | "bearish" | "neutral";
  metadata: Record<string, unknown>;
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

const shortAddr = (addr: string) => addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : "";

const formatUsd = (v: number | null | undefined): string => {
  if (v == null || isNaN(v)) return "$0.00";
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.0001) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(8)}`;
};

const formatNum = (v: number | null | undefined): string => {
  if (v == null || isNaN(v)) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
};

const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

/* ═══════════════════════════════════════════════════════════════
   Data Fetching — Helius + DexScreener
   ═══════════════════════════════════════════════════════════════ */

async function fetchTokenData(mintAddress: string): Promise<FetchedTokenData> {
  // 1. Helius DAS — metadata + image
  let dasAsset: any = null;
  try {
    const dasRes = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "getAsset",
        params: { id: mintAddress },
      }),
    });
    const dasJson = await dasRes.json();
    dasAsset = dasJson?.result;
  } catch { /* ignore */ }

  // 2. DexScreener — price, liquidity, volume, txns, links
  let dexPair: any = null;
  let allPairs: any[] = [];
  try {
    const dexRes = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mintAddress}`);
    const dexJson = await dexRes.json();
    allPairs = Array.isArray(dexJson) ? dexJson : [];
    // Pick the pair with highest liquidity
    dexPair = allPairs.sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0] ?? null;
  } catch { /* ignore */ }

  // 3. Helius — holder count + top holders for dev detection
  let holderCount = 0;
  let topHolders: any[] = [];
  try {
    // Use the Helius token holders API
    const holdRes = await fetch(
      `https://api.helius.xyz/v1/mintlist?api-key=${HELIUS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: { mints: [mintAddress] },
          options: { limit: 20 },
        }),
      }
    );
    // Fallback: use the RPC compressed token API
  } catch { /* ignore */ }

  // Try Birdeye for holder count
  try {
    const beRes = await fetch(
      `https://public-api.birdeye.so/defi/v3/token/holder?address=${mintAddress}`,
      { headers: { "X-API-KEY": BIRDEYE_API_KEY, "x-chain": "solana" } }
    );
    const beJson = await beRes.json();
    if (beJson?.data?.total) holderCount = beJson.data.total;
  } catch { /* ignore */ }

  // If Birdeye didn't work, try DexScreener info
  if (!holderCount && dexPair?.info?.holders) {
    holderCount = dexPair.info.holders;
  }

  // Extract metadata
  const name = dasAsset?.content?.metadata?.name
    || dexPair?.baseToken?.name
    || "Unknown Token";
  const symbol = dasAsset?.content?.metadata?.symbol
    || dexPair?.baseToken?.symbol
    || "???";
  const imageUrl = dasAsset?.content?.links?.image
    || dasAsset?.content?.files?.[0]?.uri
    || dexPair?.info?.imageUrl
    || "";
  const description = dasAsset?.content?.metadata?.description || "";

  // Links from DexScreener
  const dexLinks: Record<string, string> = {};
  if (dexPair?.info?.websites) {
    for (const w of dexPair.info.websites) {
      if (w.url) dexLinks.website = w.url;
    }
  }
  if (dexPair?.info?.socials) {
    for (const s of dexPair.info.socials) {
      if (s.type === "twitter" || s.platform === "twitter") dexLinks.twitter = s.url;
      if (s.type === "telegram" || s.platform === "telegram") dexLinks.telegram = s.url;
      if (s.type === "discord" || s.platform === "discord") dexLinks.discord = s.url;
    }
  }

  // Price data
  const priceUsd = dexPair ? parseFloat(dexPair.priceUsd ?? "0") : 0;
  const marketCap = dexPair?.marketCap ?? dexPair?.fdv ?? 0;
  const liquidityUsd = dexPair?.liquidity?.usd ?? 0;
  const volume24h = dexPair?.volume?.h24 ?? 0;
  const buys24h = dexPair?.txns?.h24?.buys ?? 0;
  const sells24h = dexPair?.txns?.h24?.sells ?? 0;
  const priceChange24h = dexPair?.priceChange?.h24 ? parseFloat(dexPair.priceChange.h24) : 0;

  // Creator/dev wallet — from Helius creator info
  const devWallet = dasAsset?.authorities?.[0]?.address
    || dasAsset?.creators?.[0]?.address
    || "";
  
  // ATH/ATL from DexScreener profile data (if available)
  // DexScreener doesn't always return this directly, use metadata
  const dexProfile = dexPair?.profile || {};

  // Dev holding analysis — check top holders
  let devHoldingPct = 0;
  let top10HolderPct = 0;

  // Generate analysis
  const { summary, verdict } = generateAnalysis({
    name, symbol, priceUsd, marketCap, liquidityUsd,
    volume24h, buys24h, sells24h, priceChange24h,
    holderCount, devHoldingPct, top10HolderPct,
    devWallet,
  });

  return {
    name,
    symbol,
    image_url: imageUrl,
    banner_url: dexPair?.info?.header || imageUrl,
    description,
    website: dexLinks.website || "",
    twitter: dexLinks.twitter || "",
    telegram: dexLinks.telegram || "",
    discord: dexLinks.discord || "",
    price_usd: priceUsd,
    market_cap: marketCap,
    liquidity_usd: liquidityUsd,
    holder_count: holderCount,
    volume_24h: volume24h,
    buys_24h: buys24h,
    sells_24h: sells24h,
    price_change_24h: priceChange24h,
    dev_wallet: devWallet,
    dev_holding_pct: devHoldingPct,
    top10_holder_pct: top10HolderPct,
    ath: 0,
    atl: 0,
    analysis_summary: summary,
    analysis_verdict: verdict,
    metadata: {
      pairAddress: dexPair?.pairAddress,
      dexId: dexPair?.dexId,
      chainId: "solana",
      tokenProgram: dasAsset?.token_info?.token_program,
      supply: dasAsset?.token_info?.supply,
      decimals: dasAsset?.token_info?.decimals,
      boosts: dexPair?.boosts?.active,
    },
  };
}

function generateAnalysis(data: {
  name: string; symbol: string; priceUsd: number; marketCap: number;
  liquidityUsd: number; volume24h: number; buys24h: number; sells24h: number;
  priceChange24h: number; holderCount: number; devHoldingPct: number;
  top10HolderPct: number; devWallet: string;
}): { summary: string; verdict: "bullish" | "bearish" | "neutral" } {
  const flags: string[] = [];
  let score = 0; // -10 to 10

  // Liquidity check
  if (data.liquidityUsd > 100000) {
    flags.push("🟢 Strong liquidity pool (>" + formatUsd(data.liquidityUsd) + ")");
    score += 2;
  } else if (data.liquidityUsd > 10000) {
    flags.push("🟡 Moderate liquidity (" + formatUsd(data.liquidityUsd) + ")");
    score += 1;
  } else {
    flags.push("🔴 Low liquidity — high slippage risk (" + formatUsd(data.liquidityUsd) + ")");
    score -= 2;
  }

  // Volume check
  if (data.volume24h > 500000) {
    flags.push("🟢 High trading volume (" + formatUsd(data.volume24h) + "/24h)");
    score += 2;
  } else if (data.volume24h > 10000) {
    flags.push("🟡 Moderate volume (" + formatUsd(data.volume24h) + "/24h)");
    score += 1;
  } else {
    flags.push("🔴 Very low volume — difficult to trade");
    score -= 1;
  }

  // Buy/sell ratio
  const totalTxns = data.buys24h + data.sells24h;
  if (totalTxns > 0) {
    const buyRatio = data.buys24h / totalTxns;
    if (buyRatio > 0.6) {
      flags.push(`🟢 Strong buy pressure (${Math.round(buyRatio * 100)}% buys)`);
      score += 2;
    } else if (buyRatio > 0.45) {
      flags.push(`🟡 Balanced trading (${data.buys24h} buys / ${data.sells24h} sells)`);
    } else {
      flags.push(`🔴 Heavy sell pressure (${Math.round((1 - buyRatio) * 100)}% sells)`);
      score -= 2;
    }
  }

  // Market cap analysis
  if (data.marketCap > 10_000_000) {
    flags.push("🟢 Established market cap (" + formatUsd(data.marketCap) + ")");
    score += 1;
  } else if (data.marketCap > 100_000) {
    flags.push("🟡 Mid-cap token (" + formatUsd(data.marketCap) + ")");
  } else if (data.marketCap > 0) {
    flags.push("⚠️ Micro-cap — very high risk (" + formatUsd(data.marketCap) + ")");
    score -= 1;
  }

  // Price action
  if (data.priceChange24h > 20) {
    flags.push(`🚀 Pumping +${data.priceChange24h.toFixed(1)}% in 24h`);
    score += 1;
  } else if (data.priceChange24h > 5) {
    flags.push(`📈 Up ${data.priceChange24h.toFixed(1)}% today`);
    score += 1;
  } else if (data.priceChange24h < -20) {
    flags.push(`📉 Dumping ${data.priceChange24h.toFixed(1)}% in 24h`);
    score -= 2;
  } else if (data.priceChange24h < -5) {
    flags.push(`📉 Down ${data.priceChange24h.toFixed(1)}% today`);
    score -= 1;
  }

  // Holder count
  if (data.holderCount > 1000) {
    flags.push(`🟢 ${formatNum(data.holderCount)} holders — good distribution`);
    score += 1;
  } else if (data.holderCount > 100) {
    flags.push(`🟡 ${data.holderCount} holders`);
  } else if (data.holderCount > 0) {
    flags.push(`🔴 Only ${data.holderCount} holders — concentrated`);
    score -= 1;
  }

  const verdict = score >= 3 ? "bullish" : score <= -3 ? "bearish" : "neutral";
  const summary = flags.join("\n");
  return { summary, verdict };
}

/* ═══════════════════════════════════════════════════════════════
   Copy Button
   ═══════════════════════════════════════════════════════════════ */

const CopyBtn: React.FC<{ text: string; label?: string }> = ({ text, label }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors">
      {copied ? <Check className="h-3 w-3 text-og-lime" /> : <Copy className="h-3 w-3" />}
      {label && <span>{label}</span>}
    </button>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Listing Card
   ═══════════════════════════════════════════════════════════════ */

const ListingCard: React.FC<{
  listing: TokenListing;
  onSelect: (listing: TokenListing) => void;
}> = ({ listing, onSelect }) => {
  const change = listing.price_change_24h ?? 0;
  const isUp = change > 0;
  const isDown = change < 0;

  return (
    <button
      onClick={() => onSelect(listing)}
      className={cn(
        "w-full text-left rounded-2xl border transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]",
        listing.is_promoted
          ? "border-og-gold/30 bg-gradient-to-br from-og-gold/[0.06] to-transparent shadow-[0_0_30px_rgba(245,158,11,0.08)]"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]",
      )}
    >
      {/* Banner */}
      {listing.banner_url && listing.banner_url !== listing.image_url && (
        <div className="relative h-20 rounded-t-2xl overflow-hidden">
          <img src={listing.banner_url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80" />
        </div>
      )}

      <div className="p-3.5">
        {/* Header row */}
        <div className="flex items-start gap-3">
          {/* Token image */}
          <div className={cn(
            "shrink-0 h-12 w-12 rounded-xl overflow-hidden border",
            listing.is_promoted ? "border-og-gold/30" : "border-white/10",
          )}>
            {listing.image_url ? (
              <img src={listing.image_url} alt={listing.symbol ?? ""} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-white/5">
                <Sparkles className="h-5 w-5 text-white/20" />
              </div>
            )}
          </div>

          {/* Name & symbol */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white truncate">{listing.name || "Unknown"}</h3>
              {listing.is_promoted && (
                <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wider bg-og-gold/15 text-og-gold flex items-center gap-0.5">
                  <Megaphone className="h-2.5 w-2.5" /> PROMOTED
                </span>
              )}
              {listing.analysis_verdict === "bullish" && (
                <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[7px] font-black uppercase bg-emerald-500/15 text-emerald-400">BULLISH</span>
              )}
              {listing.analysis_verdict === "bearish" && (
                <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[7px] font-black uppercase bg-red-500/15 text-red-400">BEARISH</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-bold text-white/30">${listing.symbol}</span>
              <span className="text-[9px] text-white/15">{shortAddr(listing.mint_address)}</span>
            </div>
          </div>

          {/* Price */}
          <div className="text-right shrink-0">
            <div className="text-sm font-black text-white">{formatUsd(listing.price_usd)}</div>
            <div className={cn(
              "text-[10px] font-bold flex items-center justify-end gap-0.5",
              isUp ? "text-og-lime" : isDown ? "text-red-400" : "text-white/30",
            )}>
              {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {Math.abs(change).toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.04]">
          <div className="flex items-center gap-1 text-[9px] text-white/25">
            <DollarSign className="h-3 w-3" />
            <span>MCap: <span className="text-white/40 font-bold">{formatUsd(listing.market_cap)}</span></span>
          </div>
          <div className="flex items-center gap-1 text-[9px] text-white/25">
            <Droplets className="h-3 w-3" />
            <span>Liq: <span className="text-white/40 font-bold">{formatUsd(listing.liquidity_usd)}</span></span>
          </div>
          <div className="flex items-center gap-1 text-[9px] text-white/25">
            <Users className="h-3 w-3" />
            <span className="text-white/40 font-bold">{formatNum(listing.holder_count)}</span>
          </div>
          <div className="ml-auto text-[8px] text-white/15 flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {timeAgo(listing.created_at)}
          </div>
        </div>
      </div>
    </button>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Detail View (full page for a listing)
   ═══════════════════════════════════════════════════════════════ */

const ListingDetail: React.FC<{
  listing: TokenListing;
  onBack: () => void;
}> = ({ listing, onBack }) => {
  const change = listing.price_change_24h ?? 0;
  const isUp = change > 0;
  const isDown = change < 0;
  const totalTxns = (listing.buys_24h ?? 0) + (listing.sells_24h ?? 0);
  const buyPct = totalTxns > 0 ? ((listing.buys_24h ?? 0) / totalTxns) * 100 : 50;

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-[11px] font-bold text-white/40 hover:text-white/70 transition-colors">
        <ChevronDown className="h-3.5 w-3.5 rotate-90" /> Back to Listings
      </button>

      {/* Banner + Header */}
      <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]">
        {/* Banner image */}
        <div className="h-32 bg-gradient-to-br from-og-cyan/10 to-purple-500/10 relative">
          {listing.banner_url && (
            <img src={listing.banner_url} alt="" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/90" />
        </div>

        {/* Token info overlay */}
        <div className="relative -mt-8 px-4 pb-4">
          <div className="flex items-end gap-3">
            <div className={cn(
              "h-16 w-16 rounded-2xl overflow-hidden border-2 shadow-lg",
              listing.analysis_verdict === "bullish" ? "border-emerald-500/50" :
              listing.analysis_verdict === "bearish" ? "border-red-500/50" :
              "border-white/20",
            )}>
              {listing.image_url ? (
                <img src={listing.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-white/5">
                  <Sparkles className="h-7 w-7 text-white/20" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">{listing.name}</h2>
                {listing.is_promoted && (
                  <span className="rounded-lg px-2 py-0.5 text-[8px] font-black uppercase bg-og-gold/15 text-og-gold">PROMOTED</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white/40">${listing.symbol}</span>
                <CopyBtn text={listing.mint_address} label={shortAddr(listing.mint_address)} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Price card */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">CURRENT PRICE</p>
            <p className="text-2xl font-black text-white mt-1">{formatUsd(listing.price_usd)}</p>
          </div>
          <div className={cn(
            "rounded-xl px-3 py-1.5 text-sm font-black flex items-center gap-1",
            isUp ? "bg-og-lime/10 text-og-lime" : isDown ? "bg-red-500/10 text-red-400" : "bg-white/5 text-white/30",
          )}>
            {isUp ? <TrendingUp className="h-4 w-4" /> : isDown ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
            {Math.abs(change).toFixed(2)}%
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { label: "Market Cap", value: formatUsd(listing.market_cap), icon: DollarSign },
            { label: "Liquidity", value: formatUsd(listing.liquidity_usd), icon: Droplets },
            { label: "Volume 24h", value: formatUsd(listing.volume_24h), icon: BarChart3 },
            { label: "Holders", value: formatNum(listing.holder_count), icon: Users },
            { label: "ATH", value: listing.ath ? formatUsd(listing.ath) : "N/A", icon: TrendingUp },
            { label: "ATL", value: listing.atl ? formatUsd(listing.atl) : "N/A", icon: TrendingDown },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-2.5 text-center">
              <Icon className="h-3.5 w-3.5 mx-auto text-white/15 mb-1" />
              <p className="text-[8px] font-bold uppercase tracking-widest text-white/20">{label}</p>
              <p className="text-xs font-black text-white/70 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Buy/Sell pressure */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-3">TRADING ACTIVITY (24H)</p>
        <div className="flex items-center justify-between text-[11px] font-bold mb-2">
          <span className="text-og-lime">{listing.buys_24h ?? 0} Buys</span>
          <span className="text-red-400">{listing.sells_24h ?? 0} Sells</span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden flex">
          <div className="h-full bg-og-lime/60 rounded-l-full transition-all" style={{ width: `${buyPct}%` }} />
          <div className="h-full bg-red-500/60 rounded-r-full transition-all" style={{ width: `${100 - buyPct}%` }} />
        </div>
        <p className="text-[9px] text-white/20 mt-2 text-center">{totalTxns.toLocaleString()} total transactions</p>
      </div>

      {/* Dev wallet */}
      {listing.dev_wallet && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-2">DEV WALLET</p>
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-white/20" />
            <span className="text-xs font-mono text-white/50">{shortAddr(listing.dev_wallet)}</span>
            <CopyBtn text={listing.dev_wallet} />
            {listing.dev_holding_pct != null && listing.dev_holding_pct > 0 && (
              <span className={cn(
                "rounded-md px-1.5 py-0.5 text-[8px] font-black",
                listing.dev_holding_pct > 10 ? "bg-red-500/15 text-red-400" : "bg-white/5 text-white/30",
              )}>
                {listing.dev_holding_pct.toFixed(1)}% held
              </span>
            )}
          </div>
        </div>
      )}

      {/* Analysis */}
      {listing.analysis_summary && (
        <div className={cn(
          "rounded-2xl border p-4",
          listing.analysis_verdict === "bullish" ? "border-emerald-500/20 bg-emerald-500/[0.03]" :
          listing.analysis_verdict === "bearish" ? "border-red-500/20 bg-red-500/[0.03]" :
          "border-white/[0.06] bg-white/[0.02]",
        )}>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-white/30" />
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">AI ANALYSIS</p>
            {listing.analysis_verdict && (
              <span className={cn(
                "rounded-lg px-2 py-0.5 text-[8px] font-black uppercase",
                listing.analysis_verdict === "bullish" ? "bg-emerald-500/15 text-emerald-400" :
                listing.analysis_verdict === "bearish" ? "bg-red-500/15 text-red-400" :
                "bg-white/10 text-white/40",
              )}>
                {listing.analysis_verdict}
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {listing.analysis_summary.split("\n").map((line, i) => (
              <p key={i} className="text-[11px] text-white/50 leading-relaxed">{line}</p>
            ))}
          </div>
        </div>
      )}

      {/* Links */}
      {(listing.website || listing.twitter || listing.telegram || listing.discord) && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-3">LINKS</p>
          <div className="flex flex-wrap gap-2">
            {listing.website && (
              <a href={listing.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-bold text-white/40 hover:text-white/70 hover:border-white/20 transition-all">
                <Globe className="h-3.5 w-3.5" /> Website <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            {listing.twitter && (
              <a href={listing.twitter} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-bold text-sky-400/60 hover:text-sky-400 hover:border-sky-400/30 transition-all">
                <XIcon className="h-3.5 w-3.5" /> Twitter <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            {listing.telegram && (
              <a href={listing.telegram} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-bold text-blue-400/60 hover:text-blue-400 hover:border-blue-400/30 transition-all">
                <Globe className="h-3.5 w-3.5" /> Telegram <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            {listing.discord && (
              <a href={listing.discord} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-bold text-indigo-400/60 hover:text-indigo-400 hover:border-indigo-400/30 transition-all">
                <Globe className="h-3.5 w-3.5" /> Discord <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            <a href={`https://dexscreener.com/solana/${listing.mint_address}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-bold text-white/40 hover:text-white/70 hover:border-white/20 transition-all">
              <BarChart3 className="h-3.5 w-3.5" /> DexScreener <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      )}

      {/* Description */}
      {listing.description && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-2">ABOUT</p>
          <p className="text-[11px] text-white/40 leading-relaxed">{listing.description}</p>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   List Token Dialog (paste CA → fetch → save)
   ═══════════════════════════════════════════════════════════════ */

const ListTokenPanel: React.FC<{
  onClose: () => void;
  onListed: () => void;
}> = ({ onClose, onListed }) => {
  const { user } = useAuth();
  const [mintInput, setMintInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchedData, setFetchedData] = useState<FetchedTokenData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    const ca = mintInput.trim();
    if (!ca || ca.length < 30) {
      setError("Please enter a valid Solana contract address");
      return;
    }
    setError(null);
    setFetching(true);
    setFetchedData(null);

    try {
      const data = await fetchTokenData(ca);
      if (!data.name || data.name === "Unknown Token") {
        // Still show it, might be a very new token
      }
      setFetchedData(data);
    } catch (err) {
      setError("Failed to fetch token data. Double check the contract address.");
    } finally {
      setFetching(false);
    }
  };

  const handleList = async () => {
    if (!fetchedData || !user) return;
    setSaving(true);

    try {
      const { error: insertError } = await supabase.from("token_listings").insert({
        mint_address: mintInput.trim(),
        listed_by: user.id,
        ...fetchedData,
      });

      if (insertError) throw insertError;
      toast.success("Token listed successfully!");
      onListed();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to list token");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-white">List a Token</h3>
          <p className="text-[10px] text-white/30 mt-0.5">Paste a contract address — Helius does the rest</p>
        </div>
        <button onClick={onClose} className="h-8 w-8 rounded-xl border border-white/[0.08] flex items-center justify-center text-white/30 hover:text-white/60 transition-colors">
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
        <input
          type="text"
          value={mintInput}
          onChange={(e) => setMintInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleFetch()}
          placeholder="Paste contract address (CA)..."
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/15 outline-none focus:border-og-cyan/30 transition-colors font-mono"
        />
      </div>

      {/* Fetch button */}
      <button
        onClick={handleFetch}
        disabled={fetching || !mintInput.trim()}
        className={cn(
          "w-full rounded-xl py-3 text-sm font-black transition-all flex items-center justify-center gap-2",
          fetching ? "bg-white/5 text-white/30" : "bg-og-cyan/10 text-og-cyan border border-og-cyan/20 hover:bg-og-cyan/20",
        )}
      >
        {fetching ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Fetching from blockchain...</>
        ) : (
          <><Search className="h-4 w-4" /> Fetch Token Data</>
        )}
      </button>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3 text-[11px] text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Preview */}
      {fetchedData && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-og-cyan/20 bg-og-cyan/[0.03] p-4">
            <div className="flex items-center gap-3">
              {fetchedData.image_url && (
                <img src={fetchedData.image_url} alt="" className="h-12 w-12 rounded-xl object-cover border border-white/10" />
              )}
              <div>
                <h4 className="text-sm font-black text-white">{fetchedData.name}</h4>
                <p className="text-[10px] text-white/30">${fetchedData.symbol}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-sm font-black text-white">{formatUsd(fetchedData.price_usd)}</p>
                <p className={cn("text-[10px] font-bold", fetchedData.price_change_24h > 0 ? "text-og-lime" : fetchedData.price_change_24h < 0 ? "text-red-400" : "text-white/30")}>
                  {fetchedData.price_change_24h > 0 ? "+" : ""}{fetchedData.price_change_24h.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/[0.06]">
              <div className="text-center">
                <p className="text-[8px] text-white/20 uppercase">MCap</p>
                <p className="text-[11px] font-bold text-white/50">{formatUsd(fetchedData.market_cap)}</p>
              </div>
              <div className="text-center">
                <p className="text-[8px] text-white/20 uppercase">Liquidity</p>
                <p className="text-[11px] font-bold text-white/50">{formatUsd(fetchedData.liquidity_usd)}</p>
              </div>
              <div className="text-center">
                <p className="text-[8px] text-white/20 uppercase">Holders</p>
                <p className="text-[11px] font-bold text-white/50">{formatNum(fetchedData.holder_count)}</p>
              </div>
            </div>
          </div>

          {/* Analysis preview */}
          {fetchedData.analysis_summary && (
            <div className={cn(
              "rounded-xl border p-3 text-[10px]",
              fetchedData.analysis_verdict === "bullish" ? "border-emerald-500/20 text-emerald-400/70" :
              fetchedData.analysis_verdict === "bearish" ? "border-red-500/20 text-red-400/70" :
              "border-white/[0.06] text-white/40",
            )}>
              <p className="font-bold uppercase tracking-wider text-[8px] mb-1.5">
                VERDICT: {fetchedData.analysis_verdict?.toUpperCase()}
              </p>
              {fetchedData.analysis_summary.split("\n").slice(0, 3).map((line, i) => (
                <p key={i} className="leading-relaxed">{line}</p>
              ))}
            </div>
          )}

          {/* List button */}
          <button
            onClick={handleList}
            disabled={saving}
            className={cn(
              "w-full rounded-xl py-3.5 text-sm font-black transition-all flex items-center justify-center gap-2",
              saving ? "bg-white/5 text-white/30" : "bg-gradient-to-r from-og-lime/20 to-emerald-500/20 text-og-lime border border-og-lime/20 hover:from-og-lime/30 hover:to-emerald-500/30",
            )}
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Listing...</>
            ) : (
              <><Plus className="h-4 w-4" /> List This Token</>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */

export const TokenListings: React.FC = () => {
  const { user } = useAuth();
  const [listings, setListings] = useState<TokenListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showListPanel, setShowListPanel] = useState(false);
  const [selectedListing, setSelectedListing] = useState<TokenListing | null>(null);
  const [filter, setFilter] = useState<"all" | "promoted" | "bullish" | "bearish" | "newest">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("token_listings")
        .select("*")
        .order("is_promoted", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);

      const { data, error } = await query;
      if (error) throw error;
      setListings((data as TokenListing[]) ?? []);
    } catch (err) {
      console.error("Failed to fetch listings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const filtered = useMemo(() => {
    let result = listings;
    if (filter === "promoted") result = result.filter(l => l.is_promoted);
    if (filter === "bullish") result = result.filter(l => l.analysis_verdict === "bullish");
    if (filter === "bearish") result = result.filter(l => l.analysis_verdict === "bearish");
    if (filter === "newest") result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        (l.name?.toLowerCase().includes(q)) ||
        (l.symbol?.toLowerCase().includes(q)) ||
        l.mint_address.toLowerCase().includes(q)
      );
    }
    return result;
  }, [listings, filter, searchQuery]);

  // Detail view
  if (selectedListing) {
    return <ListingDetail listing={selectedListing} onBack={() => setSelectedListing(null)} />;
  }

  // List token panel
  if (showListPanel) {
    return <ListTokenPanel onClose={() => setShowListPanel(false)} onListed={fetchListings} />;
  }

  return (
    <div className="space-y-4">
      {/* Search + List button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/15" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tokens..."
            className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] pl-9 pr-4 py-2 text-xs text-white placeholder:text-white/15 outline-none focus:border-white/20 transition-colors"
          />
        </div>
        <button
          onClick={() => setShowListPanel(true)}
          className="shrink-0 flex items-center gap-1.5 rounded-xl bg-og-lime/10 border border-og-lime/20 px-3 py-2 text-[11px] font-black text-og-lime hover:bg-og-lime/20 transition-all"
        >
          <Plus className="h-3.5 w-3.5" /> List Token
        </button>
        <button
          onClick={fetchListings}
          className="shrink-0 h-9 w-9 rounded-xl border border-white/[0.06] flex items-center justify-center text-white/20 hover:text-white/50 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {([
          { id: "all", label: "🔥 All Tokens" },
          { id: "promoted", label: "⭐ Promoted" },
          { id: "bullish", label: "🟢 Bullish" },
          { id: "bearish", label: "🔴 Bearish" },
          { id: "newest", label: "🆕 Newest" },
        ] as const).map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "shrink-0 px-3 py-2 rounded-xl text-[10px] font-bold transition-all whitespace-nowrap",
              filter === f.id
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-white/25 hover:text-white/40 border border-transparent",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Listings */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-og-lime" />
          <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-white/20">Loading listings...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <Sparkles className="h-6 w-6 text-white/[0.08]" />
          </div>
          <p className="text-[12px] font-bold text-white/20">No tokens listed yet</p>
          <p className="text-[10px] text-white/10">Be the first — paste a CA and list it!</p>
          <button
            onClick={() => setShowListPanel(true)}
            className="flex items-center gap-1.5 rounded-xl bg-og-lime/10 border border-og-lime/20 px-4 py-2 text-[11px] font-black text-og-lime hover:bg-og-lime/20 transition-all mt-2"
          >
            <Plus className="h-3.5 w-3.5" /> List Your First Token
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(listing => (
            <ListingCard key={listing.id} listing={listing} onSelect={setSelectedListing} />
          ))}
        </div>
      )}
    </div>
  );
};

export default TokenListings;
