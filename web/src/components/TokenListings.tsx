/**
 * TokenListings — List & promote tokens on OG Scan.
 * Paste a CA → Helius + DexScreener pull all data → clean dedicated listing page.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, Loader2, ExternalLink, TrendingUp, TrendingDown, Minus,
  Users, Droplets, DollarSign, Shield, Copy, Check, ArrowUpRight,
  Star, Crown, Wallet, BarChart3, Globe, X as XIcon, ChevronDown,
  ChevronUp, Flame, AlertTriangle, Sparkles, Clock, Eye, RefreshCw,
  Image as ImageIcon, Megaphone, Activity, Lock, Unlock, Info, Database, Zap, Share2, Link as LinkIcon,
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
      decimals: dasAsset?.token_info?.decimals ?? dexPair?.baseToken?.decimals,
      boosts: dexPair?.boosts?.active,
      // On-chain truth
      mintAuthority: dasAsset?.authorities?.find((a: any) => a.scopes?.includes("full"))?.address
        || dasAsset?.mint_extensions?.mint_close_authority?.close_authority || null,
      freezeAuthority: dasAsset?.authorities?.find((a: any) => a.scopes?.includes("freeze"))?.address || null,
      isMintable: dasAsset?.mutable ?? null,
      creator: dasAsset?.creators?.[0]?.address || dasAsset?.authorities?.[0]?.address || null,
      fundingWallet: dasAsset?.creators?.[1]?.address || null,
      // DexScreener data
      quoteToken: dexPair?.quoteToken?.symbol || null,
      pairCreatedAt: dexPair?.pairCreatedAt || null,
      poolCount: allPairs.length,
      fdv: dexPair?.fdv ?? 0,
      priceChange5m: dexPair?.priceChange?.m5 ?? null,
      priceChange1h: dexPair?.priceChange?.h1 ?? null,
      priceChange6h: dexPair?.priceChange?.h6 ?? null,
      txns5m: dexPair?.txns?.m5 || null,
      txns1h: dexPair?.txns?.h1 || null,
      volume5m: dexPair?.volume?.m5 ?? null,
      volume1h: dexPair?.volume?.h1 ?? null,
      buyVol24h: dexPair?.volume?.h24 ? (dexPair.txns?.h24?.buys && dexPair.txns?.h24?.sells
        ? dexPair.volume.h24 * (dexPair.txns.h24.buys / (dexPair.txns.h24.buys + dexPair.txns.h24.sells))
        : dexPair.volume.h24 / 2) : 0,
      sellVol24h: dexPair?.volume?.h24 ? (dexPair.txns?.h24?.buys && dexPair.txns?.h24?.sells
        ? dexPair.volume.h24 * (dexPair.txns.h24.sells / (dexPair.txns.h24.buys + dexPair.txns.h24.sells))
        : dexPair.volume.h24 / 2) : 0,
      reportedLp: dexPair?.liquidity?.usd ?? 0,
      athMc: dexPair?.profile?.athMc ?? null,
      atlMc: dexPair?.profile?.atlMc ?? null,
      athPrice: dexPair?.profile?.athPrice ?? null,
      atlPrice: dexPair?.profile?.atlPrice ?? null,
      // Boost data
      boostStatus: dexPair?.boosts ? `${dexPair.boosts.active ?? 0} BOOSTS PAID` : null,
      totalBoosts: dexPair?.boosts?.active ?? 0,
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

/* ── Dashboard section card ── */
const DashSection: React.FC<{
  title: string; icon: React.ReactNode; accent?: string;
  badge?: string; badgeColor?: string;
  children: React.ReactNode; className?: string;
}> = ({ title, icon, accent, badge, badgeColor, children, className }) => (
  <div className={cn("rounded-xl border border-white/[0.06] bg-[#0a0e1a] overflow-hidden", className)}>
    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.05]">
      <span className={accent || "text-white/30"}>{icon}</span>
      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/50">{title}</span>
      {badge && (
        <span className={cn("ml-auto text-[8px] font-black uppercase px-1.5 py-0.5 rounded", badgeColor || "bg-white/5 text-white/30")}>{badge}</span>
      )}
    </div>
    <div className="px-3 py-2.5">{children}</div>
  </div>
);

/* ── Data row inside a section ── */
const DRow: React.FC<{ label: string; value: React.ReactNode; valueColor?: string }> = ({ label, value, valueColor }) => (
  <div className="flex items-center justify-between py-[5px] border-b border-white/[0.03] last:border-b-0">
    <span className="text-[9px] font-bold uppercase tracking-wider text-white/25">{label}</span>
    <span className={cn("text-[10px] font-bold text-right", valueColor || "text-white/60")}>{value}</span>
  </div>
);

const ListingDetail: React.FC<{
  listing: TokenListing;
  onBack: () => void;
}> = ({ listing, onBack }) => {
  const [linkCopied, setLinkCopied] = useState(false);
  const shareUrl = `${window.location.origin}/listings/${listing.mint_address}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${listing.name} ($${listing.symbol}) on OG Scan`,
          text: `Check out ${listing.name} ($${listing.symbol}) — ${listing.analysis_verdict ?? "listed"} on OG Scan`,
          url: shareUrl,
        });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  };

  const m = listing.metadata || {};
  const change = listing.price_change_24h ?? 0;
  const isUp = change > 0;
  const isDown = change < 0;
  const totalTxns = (listing.buys_24h ?? 0) + (listing.sells_24h ?? 0);
  const buyPct = totalTxns > 0 ? ((listing.buys_24h ?? 0) / totalTxns) * 100 : 50;
  const buyVol = (m.buyVol24h as number) || (listing.volume_24h ? (listing.volume_24h * buyPct / 100) : 0);
  const sellVol = (m.sellVol24h as number) || (listing.volume_24h ? (listing.volume_24h * (100 - buyPct) / 100) : 0);
  const mintAuth = (m.mintAuthority as string) || null;
  const freezeAuth = (m.freezeAuthority as string) || null;
  const creator = (m.creator as string) || listing.dev_wallet || null;
  const decimals = (m.decimals as number) ?? null;
  const dexId = (m.dexId as string) || "";
  const quoteToken = (m.quoteToken as string) || "SOL";
  const poolCount = (m.poolCount as number) || 1;
  const totalBoosts = (m.totalBoosts as number) || 0;
  const pairAddr = (m.pairAddress as string) || "";
  const pairCreatedAt = (m.pairCreatedAt as string) || null;
  const fdv = (m.fdv as number) || listing.market_cap || 0;
  const ch5m = (m.priceChange5m as number) ?? null;
  const ch1h = (m.priceChange1h as number) ?? null;
  const txns5m = (m.txns5m as any) || null;
  const txns1h = (m.txns1h as any) || null;

  return (
    <div className="space-y-3">
      {/* Back + Share bar */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[11px] font-bold text-white/40 hover:text-white/70 transition-colors shrink-0">
          <ChevronDown className="h-3.5 w-3.5 rotate-90" /> Back
        </button>
        <div className="flex items-center gap-2">
          <button onClick={copyLink}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[11px] font-bold transition-all",
              linkCopied
                ? "border-og-lime/40 bg-og-lime/15 text-og-lime"
                : "border-white/15 bg-white/[0.06] text-white/60 hover:text-white hover:border-white/30",
            )}>
            {linkCopied ? <Check className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
            {linkCopied ? "Copied!" : "Copy Link"}
          </button>
          <button onClick={shareNative}
            className="flex items-center gap-1.5 rounded-xl border border-og-cyan/30 bg-og-cyan/10 px-3.5 py-2 text-[11px] font-bold text-og-cyan hover:bg-og-cyan/20 hover:border-og-cyan/50 transition-all">
            <Share2 className="h-3.5 w-3.5" /> Share
          </button>
        </div>
      </div>

      {/* ═══ TOP ROW: Token header + banner + price stats ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto] gap-3">
        {/* Left: Token identity + banner */}
        <div className="relative rounded-xl border border-white/[0.06] bg-[#0a0e1a] overflow-hidden">
          {/* Banner */}
          <div className="h-28 sm:h-36 relative">
            {listing.banner_url ? (
              <img src={listing.banner_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/10 to-purple-900/20" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
          </div>
          {/* Overlay content */}
          <div className="absolute inset-0 flex items-center px-4 gap-4">
            <div className={cn(
              "shrink-0 h-16 w-16 rounded-xl overflow-hidden border-2 shadow-lg bg-black",
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
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-white">${listing.symbol || "???"}</h2>
                {listing.is_promoted && (
                  <span className="rounded px-1.5 py-0.5 text-[7px] font-black uppercase bg-og-gold/15 text-og-gold">PROMOTED</span>
                )}
                {listing.analysis_verdict && (
                  <span className={cn("rounded px-1.5 py-0.5 text-[7px] font-black uppercase",
                    listing.analysis_verdict === "bullish" ? "bg-emerald-500/15 text-emerald-400" :
                    listing.analysis_verdict === "bearish" ? "bg-red-500/15 text-red-400" :
                    "bg-white/10 text-white/30",
                  )}>{listing.analysis_verdict.toUpperCase()}</span>
                )}
              </div>
              <p className="text-xs text-white/40 mt-0.5">{listing.name} · {shortAddr(listing.mint_address)}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <CopyBtn text={listing.mint_address} label="COPY CA" />
                <a href={`https://dexscreener.com/solana/${listing.mint_address}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[9px] font-bold text-white/30 hover:text-white/60 transition border border-white/10 rounded px-1.5 py-0.5">
                  <BarChart3 className="h-3 w-3" /> CHART
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Price stats grid */}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-2 lg:w-[280px]">
          {[
            { label: "PRICE", value: formatUsd(listing.price_usd), sub: change !== 0 ? `${isUp ? "↗" : "↘"} ${change > 0 ? "+" : ""}${change.toFixed(2)}%` : undefined, subColor: isUp ? "text-emerald-400" : "text-red-400" },
            { label: "MARKET CAP", value: formatUsd(listing.market_cap) },
            { label: "FDV", value: formatUsd(fdv) },
            { label: "LIQUIDITY", value: formatUsd(listing.liquidity_usd) },
            { label: "VOLUME 24H", value: formatUsd(listing.volume_24h) },
            { label: "HOLDERS", value: formatNum(listing.holder_count) },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-white/[0.06] bg-[#0a0e1a] px-3 py-2.5">
              <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-white/20">{s.label}</p>
              <p className="text-sm font-black text-white/80 mt-0.5">{s.value}</p>
              {s.sub && <p className={cn("text-[9px] font-bold mt-0.5", s.subColor)}>{s.sub}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ MAIN GRID: 4 columns on desktop, 2 on mobile ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

        {/* ── 1. TRADE ACTIVITY ── */}
        <DashSection title="Trade Activity" icon={<Activity className="h-3.5 w-3.5" />} accent="text-og-cyan">
          <div className="grid grid-cols-2 gap-x-3">
            <div>
              <p className="text-[7px] uppercase tracking-wider text-white/20">Buys 24H</p>
              <p className="text-lg font-black text-og-lime">{formatNum(listing.buys_24h)}</p>
            </div>
            <div>
              <p className="text-[7px] uppercase tracking-wider text-white/20">Sells 24H</p>
              <p className="text-lg font-black text-red-400">{formatNum(listing.sells_24h)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-3 mt-2">
            <div>
              <p className="text-[7px] uppercase tracking-wider text-white/20">Buy Vol</p>
              <p className="text-sm font-black text-og-lime">{formatUsd(buyVol)}</p>
            </div>
            <div>
              <p className="text-[7px] uppercase tracking-wider text-white/20">Sell Vol</p>
              <p className="text-sm font-black text-red-400">{formatUsd(sellVol)}</p>
            </div>
          </div>
          {/* Buy pressure bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[8px] font-bold mb-1">
              <span className="text-white/20">BUY PRESSURE</span>
              <span className={buyPct > 50 ? "text-og-lime" : "text-red-400"}>{buyPct.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden flex">
              <div className="h-full bg-og-lime/70 rounded-l-full" style={{ width: `${buyPct}%` }} />
              <div className="h-full bg-red-500/70 rounded-r-full" style={{ width: `${100 - buyPct}%` }} />
            </div>
          </div>
          {/* Time-based changes */}
          <div className="flex items-center gap-2 mt-3 border-t border-white/[0.04] pt-2">
            {ch5m != null && (
              <div className="text-center flex-1">
                <p className="text-[7px] text-white/15">5 MIN</p>
                <p className={cn("text-[9px] font-bold", ch5m >= 0 ? "text-og-lime" : "text-red-400")}>{ch5m > 0 ? "↗" : "↘"} {Math.abs(ch5m).toFixed(2)}%</p>
              </div>
            )}
            {ch1h != null && (
              <div className="text-center flex-1">
                <p className="text-[7px] text-white/15">1 HOUR</p>
                <p className={cn("text-[9px] font-bold", ch1h >= 0 ? "text-og-lime" : "text-red-400")}>{ch1h > 0 ? "↗" : "↘"} {Math.abs(ch1h).toFixed(2)}%</p>
              </div>
            )}
            <div className="text-center flex-1">
              <p className="text-[7px] text-white/15">24 HOUR</p>
              <p className={cn("text-[9px] font-bold", change >= 0 ? "text-og-lime" : "text-red-400")}>{change > 0 ? "↗" : "↘"} {Math.abs(change).toFixed(2)}%</p>
            </div>
          </div>
          {/* Market data sub-section */}
          <div className="mt-2 border-t border-white/[0.04] pt-2 space-y-0">
            <div className="flex items-center gap-1 mb-1">
              <BarChart3 className="h-3 w-3 text-white/15" />
              <span className="text-[8px] font-black uppercase tracking-wider text-white/25">Market Data</span>
            </div>
            <DRow label="Price" value={formatUsd(listing.price_usd)} />
            <DRow label="Volume 24H" value={formatUsd(listing.volume_24h)} />
            <DRow label="Market Cap" value={formatUsd(listing.market_cap)} />
            <DRow label="FDV" value={formatUsd(fdv)} />
            <DRow label="Liquidity" value={formatUsd(listing.liquidity_usd)} />
            <DRow label="Reported LP" value={formatUsd((m.reportedLp as number) || listing.liquidity_usd)} />
          </div>
        </DashSection>

        {/* ── 2. DEV / LAUNCH INTEL ── */}
        <DashSection title="Dev / Launch Intel" icon={<Eye className="h-3.5 w-3.5" />} accent="text-purple-400"
          badge={listing.dev_wallet ? "DEV LAUNCH" : undefined} badgeColor="bg-purple-500/15 text-purple-400">
          <DRow label="Creator" value={creator ? shortAddr(creator) : "—"} valueColor="text-purple-300/70" />
          {listing.dev_wallet && listing.dev_wallet !== creator && (
            <DRow label="Dev Wallet" value={shortAddr(listing.dev_wallet)} valueColor="text-purple-300/70" />
          )}
          {listing.dev_holding_pct != null && listing.dev_holding_pct > 0 && (
            <DRow label="Dev Holding" value={`${listing.dev_holding_pct.toFixed(1)}%`}
              valueColor={listing.dev_holding_pct > 10 ? "text-red-400" : listing.dev_holding_pct > 5 ? "text-amber-400" : "text-emerald-400"} />
          )}
          {listing.top10_holder_pct != null && listing.top10_holder_pct > 0 && (
            <DRow label="Top 10 Holders" value={`${listing.top10_holder_pct.toFixed(1)}%`}
              valueColor={listing.top10_holder_pct > 50 ? "text-red-400" : "text-white/60"} />
          )}
          <DRow label="Holders" value={formatNum(listing.holder_count)} />
          {/* Analysis summary */}
          {listing.analysis_summary && (
            <div className="mt-2 border-t border-white/[0.04] pt-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Shield className="h-3 w-3 text-white/20" />
                <span className="text-[8px] font-black uppercase tracking-wider text-white/25">AI Analysis</span>
                {listing.analysis_verdict && (
                  <span className={cn("text-[7px] font-black px-1 py-0.5 rounded uppercase",
                    listing.analysis_verdict === "bullish" ? "bg-emerald-500/15 text-emerald-400" :
                    listing.analysis_verdict === "bearish" ? "bg-red-500/15 text-red-400" :
                    "bg-white/10 text-white/30",
                  )}>{listing.analysis_verdict}</span>
                )}
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-hide">
                {listing.analysis_summary.split("\n").map((line, i) => (
                  <p key={i} className="text-[9px] text-white/40 leading-relaxed">{line}</p>
                ))}
              </div>
            </div>
          )}
        </DashSection>

        {/* ── 3. ON-CHAIN TRUTH ── */}
        <DashSection title="On-Chain Truth" icon={<Shield className="h-3.5 w-3.5" />} accent="text-og-cyan"
          badge="HELIUS" badgeColor="bg-og-cyan/10 text-og-cyan">
          <DRow label="Mint Authority ⓘ" value={mintAuth ? "ENABLED" : "DISABLED"}
            valueColor={mintAuth ? "text-red-400" : "text-emerald-400"} />
          <DRow label="Freeze Authority ⓘ" value={freezeAuth ? "ENABLED" : "DISABLED"}
            valueColor={freezeAuth ? "text-red-400" : "text-emerald-400"} />
          {creator && <DRow label="Creator" value={shortAddr(creator)} valueColor="text-purple-300/70" />}
          <DRow label="Holders" value={formatNum(listing.holder_count)} />
          {listing.dev_holding_pct != null && listing.dev_holding_pct > 0 && (
            <DRow label="Dev Holding %" value={`${listing.dev_holding_pct.toFixed(1)}%`}
              valueColor={listing.dev_holding_pct > 10 ? "text-red-400" : "text-white/60"} />
          )}
          {listing.top10_holder_pct != null && listing.top10_holder_pct > 0 && (
            <DRow label="Top 10" value={`${listing.top10_holder_pct.toFixed(1)}%`} />
          )}
          {/* Safety sub-section */}
          <div className="mt-2 border-t border-white/[0.04] pt-2">
            <div className="flex items-center gap-1 mb-1">
              <Lock className="h-3 w-3 text-white/15" />
              <span className="text-[8px] font-black uppercase tracking-wider text-white/25">Safety Audit</span>
            </div>
            <DRow label="Mint Authority" value={
              mintAuth ? <span className="flex items-center gap-1"><Unlock className="h-2.5 w-2.5" /> Enabled</span>
                : <span className="flex items-center gap-1"><Lock className="h-2.5 w-2.5" /> Disabled</span>
            } valueColor={mintAuth ? "text-red-400" : "text-emerald-400"} />
            <DRow label="Freeze Authority" value={
              freezeAuth ? <span className="flex items-center gap-1"><Unlock className="h-2.5 w-2.5" /> Enabled</span>
                : <span className="flex items-center gap-1"><Lock className="h-2.5 w-2.5" /> Disabled</span>
            } valueColor={freezeAuth ? "text-red-400" : "text-emerald-400"} />
            <DRow label="Verified" value={listing.website ? "✓ LINKED" : "✗ UNVERIFIED"}
              valueColor={listing.website ? "text-emerald-400" : "text-red-400"} />
          </div>
        </DashSection>

        {/* ── 4. TOKEN METADATA + DEX INFO ── */}
        <DashSection title="Token Metadata" icon={<Database className="h-3.5 w-3.5" />} accent="text-amber-400">
          <DRow label="Chain" value="SOLANA" />
          <DRow label="Contract" value={shortAddr(listing.mint_address)} valueColor="text-purple-300/70" />
          {pairAddr && <DRow label="Pair" value={shortAddr(pairAddr)} valueColor="text-purple-300/70" />}
          {decimals != null && <DRow label="Decimals" value={String(decimals)} />}
          <DRow label="DEX" value={dexId.toUpperCase() || "—"} />
          <DRow label="Pools" value={String(poolCount)} />
          {pairCreatedAt && <DRow label="Migration" value={new Date(pairCreatedAt).toISOString().split("T")[0]} />}
          <DRow label="Quote Token" value={`${quoteToken} · ${dexId.toUpperCase() || "DEX"}`} />

          {/* Dex Paid & Boosts sub-section */}
          <div className="mt-2 border-t border-white/[0.04] pt-2">
            <div className="flex items-center gap-1 mb-1">
              <Zap className="h-3 w-3 text-amber-400/40" />
              <span className="text-[8px] font-black uppercase tracking-wider text-white/25">Dex Paid & Boosts</span>
            </div>
            <DRow label="Status" value={totalBoosts > 0 ? `${totalBoosts} BOOSTS PAID` : "—"}
              valueColor={totalBoosts > 0 ? "text-emerald-400" : "text-white/30"} />
            <DRow label="Active Boosts" value={String(totalBoosts)} />
          </div>

          {/* Links */}
          <div className="mt-2 border-t border-white/[0.04] pt-2 flex flex-wrap gap-1.5">
            {listing.website && (
              <a href={listing.website} target="_blank" rel="noopener noreferrer"
                className="rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[8px] font-bold text-white/30 hover:text-white/60 transition">WEBSITE</a>
            )}
            {listing.twitter && (
              <a href={listing.twitter} target="_blank" rel="noopener noreferrer"
                className="rounded border border-sky-500/20 bg-sky-500/5 px-2 py-1 text-[8px] font-bold text-sky-400/50 hover:text-sky-400 transition">TWITTER</a>
            )}
            {listing.telegram && (
              <a href={listing.telegram} target="_blank" rel="noopener noreferrer"
                className="rounded border border-blue-500/20 bg-blue-500/5 px-2 py-1 text-[8px] font-bold text-blue-400/50 hover:text-blue-400 transition">TELEGRAM</a>
            )}
            {listing.discord && (
              <a href={listing.discord} target="_blank" rel="noopener noreferrer"
                className="rounded border border-indigo-500/20 bg-indigo-500/5 px-2 py-1 text-[8px] font-bold text-indigo-400/50 hover:text-indigo-400 transition">DISCORD</a>
            )}
            <a href={`https://dexscreener.com/solana/${listing.mint_address}`} target="_blank" rel="noopener noreferrer"
              className="rounded border border-og-cyan/20 bg-og-cyan/5 px-2 py-1 text-[8px] font-bold text-og-cyan/50 hover:text-og-cyan transition">DEXSCREENER</a>
          </div>
        </DashSection>
      </div>

      {/* Description (if exists) */}
      {listing.description && (
        <div className="rounded-xl border border-white/[0.06] bg-[#0a0e1a] px-3 py-2.5">
          <p className="text-[8px] font-black uppercase tracking-wider text-white/25 mb-1">ABOUT</p>
          <p className="text-[10px] text-white/40 leading-relaxed">{listing.description}</p>
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

export const TokenListings: React.FC<{ initialMint?: string }> = ({ initialMint }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState<TokenListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showListPanel, setShowListPanel] = useState(false);
  const [selectedListing, setSelectedListing] = useState<TokenListing | null>(null);
  const [filter, setFilter] = useState<"all" | "promoted" | "bullish" | "bearish" | "newest">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const initialMintHandled = useRef(false);

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

  /* Deep-link: auto-open a listing by mint address from URL */
  useEffect(() => {
    if (!initialMint || initialMintHandled.current || loading) return;
    initialMintHandled.current = true;
    // Try to find in already-loaded listings
    const found = listings.find(l => l.mint_address.toLowerCase() === initialMint.toLowerCase());
    if (found) { setSelectedListing(found); return; }
    // Otherwise fetch it directly from Supabase
    (async () => {
      try {
        const { data } = await supabase
          .from("token_listings")
          .select("*")
          .eq("mint_address", initialMint)
          .maybeSingle();
        if (data) setSelectedListing(data as TokenListing);
      } catch { /* ignore */ }
    })();
  }, [initialMint, listings, loading]);

  /* Update browser URL when selecting / deselecting a listing */
  const selectListing = useCallback((listing: TokenListing | null) => {
    setSelectedListing(listing);
    if (listing) {
      navigate(`/listings/${listing.mint_address}`, { replace: true });
    } else {
      navigate("/listings", { replace: true });
    }
  }, [navigate]);

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
    return <ListingDetail listing={selectedListing} onBack={() => selectListing(null)} />;
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
            <ListingCard key={listing.id} listing={listing} onSelect={selectListing} />
          ))}
        </div>
      )}
    </div>
  );
};

export default TokenListings;
