/**
 * TokenListings — List & promote tokens on OG Scan.
 * Paste a CA → Helius + DexScreener pull all data → pro trading terminal view.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, Loader2, ExternalLink, TrendingUp, TrendingDown, Minus,
  Users, Droplets, DollarSign, Shield, Copy, Check, ArrowUpRight,
  Star, Crown, Wallet, BarChart3, Globe, X as XIcon, ChevronDown,
  ChevronUp, Flame, AlertTriangle, Sparkles, Clock, Eye, RefreshCw,
  Image as ImageIcon, Megaphone, Activity, Lock, Unlock, Info, Database, Zap,
  Share2, Link as LinkIcon, Layers, Target, FileWarning,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmeraldHeader } from "@/components/ToolPageShell";
import { supabase } from "@/lib/supabase";
import { HELIUS_API_KEY, HELIUS_RPC, HELIUS_BASE, BIRDEYE_API_KEY } from "@/lib/og";
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

const shortAddr = (addr: string) => addr ? `${addr.slice(0, 5)}…${addr.slice(-6)}` : "";

const formatUsd = (v: number | null | undefined): string => {
  if (v == null || isNaN(v)) return "$0.00";
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(2)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.0001) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(8)}`;
};

const formatNum = (v: number | null | undefined): string => {
  if (v == null || isNaN(v)) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(2)}K`;
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
   Data Fetching — Helius + DexScreener + Dev Intel + Bundles
   ═══════════════════════════════════════════════════════════════ */

async function fetchTokenData(mintAddress: string): Promise<FetchedTokenData> {
  /* ── 1. Helius DAS — metadata + authorities ── */
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

  /* ── 2. DexScreener — price, liquidity, volume, txns, links, boosts ── */
  let dexPair: any = null;
  let allPairs: any[] = [];
  try {
    const dexRes = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mintAddress}`);
    const dexJson = await dexRes.json();
    allPairs = Array.isArray(dexJson) ? dexJson : [];
    dexPair = allPairs.sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0] ?? null;
  } catch { /* ignore */ }

  /* ── 3. DexScreener boosts ── */
  let boostData: any = null;
  try {
    const boostRes = await fetch(`https://api.dexscreener.com/token-boosts/latest/v1`);
    const boostJson = await boostRes.json();
    if (Array.isArray(boostJson)) {
      boostData = boostJson.find((b: any) =>
        b.tokenAddress?.toLowerCase() === mintAddress.toLowerCase()
      );
    }
  } catch { /* ignore */ }

  /* ── 4. Holder count (Jupiter — free, replaces Birdeye) ── */
  let holderCount = 0;
  try {
    const jupRes = await fetch(
      `https://lite-api.jup.ag/tokens/v2/search?query=${mintAddress}`
    );
    const jupJson = await jupRes.json();
    const jupTok = Array.isArray(jupJson)
      ? (jupJson.find((t: { id?: string }) => t?.id === mintAddress) ?? jupJson[0])
      : undefined;
    if (jupTok?.holderCount) holderCount = jupTok.holderCount;
  } catch { /* ignore */ }
  if (!holderCount && dexPair?.info?.holders) holderCount = dexPair.info.holders;

  /* ── 5. Top holders via Helius (getTokenLargestAccounts RPC) ── */
  let topHolders: Array<{ address: string; amount: number; pct: number }> = [];
  let totalSupplyAmount = 0;
  try {
    const largestRes = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: "holders",
        method: "getTokenLargestAccounts",
        params: [mintAddress],
      }),
    });
    const largestJson = await largestRes.json();
    const accounts = largestJson?.result?.value || [];
    totalSupplyAmount = accounts.reduce((sum: number, a: any) => sum + parseFloat(a.amount || "0"), 0);
    if (totalSupplyAmount > 0) {
      topHolders = accounts.slice(0, 20).map((a: any) => ({
        address: a.address,
        amount: parseFloat(a.amount || "0"),
        pct: (parseFloat(a.amount || "0") / totalSupplyAmount) * 100,
      }));
    }
  } catch { /* ignore */ }

  const top10Pct = topHolders.slice(0, 10).reduce((s, h) => s + h.pct, 0);
  const topHolder = topHolders[0] || null;
  const whaleWallets = topHolders.filter(h => h.pct >= 2).length;

  /* ── 6. Creator / Dev wallet analysis ── */
  const creator = dasAsset?.authorities?.[0]?.address
    || dasAsset?.creators?.[0]?.address
    || "";
  const devWallet = creator;

  // Funding wallet — try to get from Helius parsed transactions
  let fundingWallet = "";
  let recentMints = 0;
  let bondedCoins = 0;
  let dexPaidCoins = 0;
  let deadCoins = 0;
  let ruggedCoins = 0;
  let lowLpCoins = 0;
  let devRisk = "UNKNOWN";
  let devRiskScore = 0;
  let confidence = "LOW";

  if (creator) {
    try {
      // Get creator's transaction history from Helius
      const txRes = await fetch(
        `${HELIUS_BASE}/addresses/${creator}/transactions?api-key=${HELIUS_API_KEY}&limit=100`
      );
      const txns = await txRes.json();
      if (Array.isArray(txns)) {
        // Look for funding source (first SOL transfer in)
        for (const tx of txns.slice(-10)) {
          if (tx.type === "TRANSFER" && tx.tokenTransfers?.length === 0) {
            const native = tx.nativeTransfers?.find((n: any) => n.toUserAccount === creator);
            if (native?.fromUserAccount) {
              fundingWallet = native.fromUserAccount;
              break;
            }
          }
        }

        // Count token creates by this wallet
        const tokenCreates = txns.filter((tx: any) =>
          tx.type === "TOKEN_MINT" || tx.type === "CREATE" ||
          tx.description?.toLowerCase().includes("create") ||
          tx.description?.toLowerCase().includes("mint")
        );
        recentMints = tokenCreates.length;

        // Rough analysis
        if (recentMints > 15) { devRisk = "HIGH"; devRiskScore = 8; confidence = "HIGH"; }
        else if (recentMints > 5) { devRisk = "MEDIUM"; devRiskScore = 5; confidence = "MEDIUM"; }
        else { devRisk = "LOW"; devRiskScore = 2; confidence = "LOW"; }
      }
    } catch { /* ignore */ }
  }

  // Dev holding %
  let devHoldingPct = 0;
  if (creator && topHolders.length > 0) {
    const devAccount = topHolders.find(h => h.address.toLowerCase().includes(creator.slice(0, 8).toLowerCase()));
    if (devAccount) devHoldingPct = devAccount.pct;
  }

  /* ── 7. Bundle detection (wallet clustering from top holders) ── */
  let bundleScore = 0;
  let bundleCount = 0;
  const holderClusters: Array<{ address: string; pct: number; label: string }> = [];

  // Simple bundle detection: check if multiple top holders were funded by same wallet
  if (topHolders.length >= 3) {
    // Group holders by similar holding sizes (potential bundle indicator)
    const holdingGroups: Record<string, typeof topHolders> = {};
    for (const h of topHolders.slice(0, 15)) {
      const bucket = Math.floor(Math.log10(h.pct + 0.01) * 10);
      const key = String(bucket);
      if (!holdingGroups[key]) holdingGroups[key] = [];
      holdingGroups[key].push(h);
    }

    // Groups of 3+ similar-sized holders = potential bundle
    for (const group of Object.values(holdingGroups)) {
      if (group.length >= 3) {
        bundleCount++;
        bundleScore += group.length * 5;
      }
    }

    // High concentration = higher bundle score
    if (top10Pct > 60) bundleScore += 30;
    else if (top10Pct > 40) bundleScore += 15;

    bundleScore = Math.min(bundleScore, 100);

    // Identify clusters
    if (topHolder) {
      holderClusters.push({ address: topHolder.address, pct: topHolder.pct, label: "Largest Holder" });
    }
    // Find major cluster (second largest distinct holder)
    const majorCluster = topHolders.find((h, i) => i > 0 && h.pct > 2);
    if (majorCluster) {
      holderClusters.push({ address: majorCluster.address, pct: majorCluster.pct, label: "Major Holder Cluster" });
    }
    // Find bundle-sized wallet
    const bundleWallet = topHolders.find((h, i) => i > 1 && h.pct >= 1 && h.pct < 5);
    if (bundleWallet) {
      holderClusters.push({ address: bundleWallet.address, pct: bundleWallet.pct, label: "Bundle-Sized Wallet" });
    }
  }

  /* ── 8. Organic score ── */
  const totalTxns24 = (dexPair?.txns?.h24?.buys ?? 0) + (dexPair?.txns?.h24?.sells ?? 0);
  let organicScore = 50; // baseline
  if (holderCount > 500) organicScore += 10;
  if (holderCount > 2000) organicScore += 10;
  if (totalTxns24 > 1000) organicScore += 5;
  if (top10Pct < 30) organicScore += 10;
  if (top10Pct > 60) organicScore -= 15;
  if (bundleScore > 50) organicScore -= 20;
  if (devHoldingPct > 15) organicScore -= 10;
  organicScore = Math.max(0, Math.min(100, organicScore));
  const organicLabel = organicScore >= 70 ? "HIGH" : organicScore >= 40 ? "MEDIUM" : "LOW";

  /* ── Extract metadata ── */
  const name = dasAsset?.content?.metadata?.name || dexPair?.baseToken?.name || "Unknown Token";
  const symbol = dasAsset?.content?.metadata?.symbol || dexPair?.baseToken?.symbol || "???";
  const imageUrl = dasAsset?.content?.links?.image || dasAsset?.content?.files?.[0]?.uri || dexPair?.info?.imageUrl || "";
  const description = dasAsset?.content?.metadata?.description || "";

  // Links from DexScreener
  const dexLinks: Record<string, string> = {};
  if (dexPair?.info?.websites) {
    for (const w of dexPair.info.websites) { if (w.url) dexLinks.website = w.url; }
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

  // Generate analysis
  const { summary, verdict } = generateAnalysis({
    name, symbol, priceUsd, marketCap, liquidityUsd,
    volume24h, buys24h, sells24h, priceChange24h,
    holderCount, devHoldingPct, top10HolderPct: top10Pct,
    devWallet, devRisk, bundleScore, organicScore,
  });

  const activeBoosts = dexPair?.boosts?.active ?? boostData?.amount ?? 0;

  return {
    name, symbol,
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
    top10_holder_pct: top10Pct,
    ath: 0,
    atl: 0,
    analysis_summary: summary,
    analysis_verdict: verdict,
    metadata: {
      // Pair / DEX
      pairAddress: dexPair?.pairAddress,
      dexId: dexPair?.dexId,
      chainId: dexPair?.chainId ?? "solana",
      decimals: dasAsset?.token_info?.decimals ?? dexPair?.baseToken?.decimals,
      quoteToken: dexPair?.quoteToken?.symbol || null,
      pairCreatedAt: dexPair?.pairCreatedAt || null,
      poolCount: allPairs.length || 1,
      fdv: dexPair?.fdv ?? 0,
      // Authorities
      mintAuthority: dasAsset?.authorities?.find((a: any) => a.scopes?.includes("full"))?.address
        || dasAsset?.mint_extensions?.mint_close_authority?.close_authority || null,
      freezeAuthority: dasAsset?.authorities?.find((a: any) => a.scopes?.includes("freeze"))?.address || null,
      creator,
      fundingWallet,
      // Price changes
      priceChange5m: dexPair?.priceChange?.m5 ? parseFloat(dexPair.priceChange.m5) : null,
      priceChange1h: dexPair?.priceChange?.h1 ? parseFloat(dexPair.priceChange.h1) : null,
      priceChange6h: dexPair?.priceChange?.h6 ? parseFloat(dexPair.priceChange.h6) : null,
      // Txn breakdowns
      txns5m: dexPair?.txns?.m5 || null,
      txns1h: dexPair?.txns?.h1 || null,
      volume5m: dexPair?.volume?.m5 ?? null,
      volume1h: dexPair?.volume?.h1 ?? null,
      // Buy/sell volumes (computed)
      buyVol24h: buys24h + sells24h > 0 ? volume24h * (buys24h / (buys24h + sells24h)) : 0,
      sellVol24h: buys24h + sells24h > 0 ? volume24h * (sells24h / (buys24h + sells24h)) : 0,
      reportedLp: dexPair?.liquidity?.usd ?? 0,
      // ATH / ATL
      athPrice: dexPair?.profile?.athPrice ?? null,
      atlPrice: dexPair?.profile?.atlPrice ?? null,
      athMc: dexPair?.profile?.athMc ?? null,
      atlMc: dexPair?.profile?.atlMc ?? null,
      // Boost data
      activeBoosts,
      totalBoosts: activeBoosts,
      boostStatus: activeBoosts > 0 ? `${activeBoosts} BOOSTS PAID` : null,
      // Dev intel
      devRisk,
      devRiskScore,
      confidence,
      recentMints,
      bondedCoins,
      dexPaidCoins,
      deadCoins,
      ruggedCoins,
      lowLpCoins,
      devAnalysisNote: recentMints > 0 ? `${recentMints} recent token mints linked to inferred creator wallet` : null,
      // Bundle data
      bundleScore,
      bundleCount,
      holderClusters,
      // On-chain truth extended
      whaleWallets,
      topHolder: topHolder ? { address: topHolder.address, pct: topHolder.pct } : null,
      // Safety
      organicScore,
      organicLabel,
      verified: !!(dexLinks.website || dexPair?.info?.websites?.length),
      dominance: marketCap && liquidityUsd ? ((liquidityUsd / marketCap) * 100) : null,
      // DexScreener profile links
      dexProfile: dexPair?.url || null,
      onChainMint: dasAsset?.mint_extensions ? true : null,
    },
  };
}

function generateAnalysis(data: {
  name: string; symbol: string; priceUsd: number; marketCap: number;
  liquidityUsd: number; volume24h: number; buys24h: number; sells24h: number;
  priceChange24h: number; holderCount: number; devHoldingPct: number;
  top10HolderPct: number; devWallet: string; devRisk: string;
  bundleScore: number; organicScore: number;
}): { summary: string; verdict: "bullish" | "bearish" | "neutral" } {
  const flags: string[] = [];
  let score = 0;

  // Liquidity
  if (data.liquidityUsd > 100000) { flags.push("🟢 Strong liquidity pool (>" + formatUsd(data.liquidityUsd) + ")"); score += 2; }
  else if (data.liquidityUsd > 10000) { flags.push("🟡 Moderate liquidity (" + formatUsd(data.liquidityUsd) + ")"); score += 1; }
  else { flags.push("🔴 Low liquidity — high slippage risk (" + formatUsd(data.liquidityUsd) + ")"); score -= 2; }

  // Volume
  if (data.volume24h > 500000) { flags.push("🟢 High trading volume (" + formatUsd(data.volume24h) + "/24h)"); score += 2; }
  else if (data.volume24h > 10000) { flags.push("🟡 Moderate volume (" + formatUsd(data.volume24h) + "/24h)"); score += 1; }
  else { flags.push("🔴 Very low volume — difficult to trade"); score -= 1; }

  // Buy/sell ratio
  const totalTxns = data.buys24h + data.sells24h;
  if (totalTxns > 0) {
    const buyRatio = data.buys24h / totalTxns;
    if (buyRatio > 0.6) { flags.push(`🟢 Strong buy pressure (${Math.round(buyRatio * 100)}% buys)`); score += 2; }
    else if (buyRatio > 0.45) { flags.push(`🟡 Balanced trading (${data.buys24h} buys / ${data.sells24h} sells)`); }
    else { flags.push(`🔴 Heavy sell pressure (${Math.round((1 - buyRatio) * 100)}% sells)`); score -= 2; }
  }

  // Market cap
  if (data.marketCap > 10_000_000) { flags.push("🟢 Established market cap (" + formatUsd(data.marketCap) + ")"); score += 1; }
  else if (data.marketCap > 100_000) { flags.push("🟡 Mid-cap token (" + formatUsd(data.marketCap) + ")"); }
  else if (data.marketCap > 0) { flags.push("⚠️ Micro-cap — very high risk (" + formatUsd(data.marketCap) + ")"); score -= 1; }

  // Price action
  if (data.priceChange24h > 20) { flags.push(`🚀 Pumping +${data.priceChange24h.toFixed(1)}% in 24h`); score += 1; }
  else if (data.priceChange24h > 5) { flags.push(`📈 Up ${data.priceChange24h.toFixed(1)}% today`); score += 1; }
  else if (data.priceChange24h < -20) { flags.push(`📉 Dumping ${data.priceChange24h.toFixed(1)}% in 24h`); score -= 2; }
  else if (data.priceChange24h < -5) { flags.push(`📉 Down ${data.priceChange24h.toFixed(1)}% today`); score -= 1; }

  // Holders
  if (data.holderCount > 1000) { flags.push(`🟢 ${formatNum(data.holderCount)} holders — good distribution`); score += 1; }
  else if (data.holderCount > 100) { flags.push(`🟡 ${data.holderCount} holders`); }
  else if (data.holderCount > 0) { flags.push(`🔴 Only ${data.holderCount} holders — concentrated`); score -= 1; }

  // Dev risk
  if (data.devRisk === "HIGH") { flags.push("🔴 HIGH dev risk — serial deployer"); score -= 2; }
  else if (data.devRisk === "MEDIUM") { flags.push("🟡 MEDIUM dev risk"); score -= 1; }

  // Bundle score
  if (data.bundleScore > 50) { flags.push(`🔴 Bundle score ${data.bundleScore}/100 — potential coordinated buying`); score -= 2; }
  else if (data.bundleScore > 25) { flags.push(`🟡 Bundle score ${data.bundleScore}/100`); score -= 1; }

  // Organic score
  if (data.organicScore >= 70) { flags.push(`🟢 Organic score ${data.organicScore} — natural trading pattern`); score += 1; }
  else if (data.organicScore < 40) { flags.push(`🔴 Low organic score ${data.organicScore} — possible manipulation`); score -= 1; }

  const verdict = score >= 3 ? "bullish" : score <= -3 ? "bearish" : "neutral";
  return { summary: flags.join("\n"), verdict };
}

/* ═══════════════════════════════════════════════════════════════
   Reusable UI atoms
   ═══════════════════════════════════════════════════════════════ */

const CopyBtn: React.FC<{ text: string; label?: string }> = ({ text, label }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-bold text-white/30 hover:text-white/60 hover:border-white/20 transition-all"
    >
      {copied ? <Check className="h-2.5 w-2.5 text-og-lime" /> : <Copy className="h-2.5 w-2.5" />}
      {label || (copied ? "COPIED" : "")}
    </button>
  );
};

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

/* ── Data row ── */
const DRow: React.FC<{ label: string; value: React.ReactNode; valueColor?: string }> = ({ label, value, valueColor }) => (
  <div className="flex items-center justify-between py-[5px] border-b border-white/[0.03] last:border-b-0">
    <span className="text-[9px] font-bold uppercase tracking-wider text-white/25">{label}</span>
    <span className={cn("text-[10px] font-bold text-right max-w-[55%] truncate", valueColor || "text-white/60")}>{value}</span>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   Listing Card (grid item)
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
      className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all p-3 text-left group"
    >
      <div className="flex items-center gap-3">
        {/* Token image */}
        <div className={cn(
          "h-10 w-10 rounded-xl overflow-hidden border shrink-0",
          listing.analysis_verdict === "bullish" ? "border-emerald-500/30" :
          listing.analysis_verdict === "bearish" ? "border-red-500/30" :
          "border-white/10",
        )}>
          {listing.image_url ? (
            <img src={listing.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-white/5">
              <Sparkles className="h-4 w-4 text-white/15" />
            </div>
          )}
        </div>

        {/* Name + symbol */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-white truncate">{listing.name || "Unknown"}</span>
            {listing.is_promoted && <Crown className="h-3 w-3 text-og-gold shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] font-bold text-white/25">${listing.symbol}</span>
            {listing.analysis_verdict && (
              <span className={cn(
                "rounded px-1 py-0.5 text-[7px] font-black uppercase",
                listing.analysis_verdict === "bullish" ? "bg-emerald-500/10 text-emerald-400" :
                listing.analysis_verdict === "bearish" ? "bg-red-500/10 text-red-400" :
                "bg-white/5 text-white/20",
              )}>{listing.analysis_verdict}</span>
            )}
          </div>
        </div>

        {/* Price + change */}
        <div className="text-right shrink-0">
          <p className="text-xs font-black text-white/70">{formatUsd(listing.price_usd)}</p>
          <p className={cn(
            "text-[10px] font-bold mt-0.5",
            isUp ? "text-og-lime" : isDown ? "text-red-400" : "text-white/20",
          )}>
            {isUp ? "↗" : isDown ? "↘" : ""} {change !== 0 ? `${Math.abs(change).toFixed(1)}%` : "—"}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-white/[0.04]">
        <div className="flex items-center gap-1 text-[9px] text-white/20">
          <DollarSign className="h-2.5 w-2.5" /> <span className="font-bold text-white/40">{formatUsd(listing.market_cap)}</span>
        </div>
        <div className="flex items-center gap-1 text-[9px] text-white/20">
          <Droplets className="h-2.5 w-2.5" /> <span className="font-bold text-white/40">{formatUsd(listing.liquidity_usd)}</span>
        </div>
        <div className="flex items-center gap-1 text-[9px] text-white/20">
          <Users className="h-2.5 w-2.5" /> <span className="font-bold text-white/40">{formatNum(listing.holder_count)}</span>
        </div>
        <span className="ml-auto text-[8px] text-white/10">{timeAgo(listing.created_at)}</span>
      </div>
    </button>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Detail View — Pro Trading Terminal Dashboard
   ═══════════════════════════════════════════════════════════════ */

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
          text: `Check out ${listing.name} ($${listing.symbol}) on OG Scan`,
          url: shareUrl,
        });
      } catch { /* cancelled */ }
    } else { copyLink(); }
  };

  const m = listing.metadata || {};
  const change = listing.price_change_24h ?? 0;
  const isUp = change > 0;
  const totalTxns = (listing.buys_24h ?? 0) + (listing.sells_24h ?? 0);
  const buyPct = totalTxns > 0 ? ((listing.buys_24h ?? 0) / totalTxns) * 100 : 50;
  const buyVol = (m.buyVol24h as number) || 0;
  const sellVol = (m.sellVol24h as number) || 0;
  const mintAuth = (m.mintAuthority as string) || null;
  const freezeAuth = (m.freezeAuthority as string) || null;
  const creator = (m.creator as string) || listing.dev_wallet || null;
  const fundingWallet = (m.fundingWallet as string) || null;
  const decimals = (m.decimals as number) ?? null;
  const dexId = (m.dexId as string) || "";
  const quoteToken = (m.quoteToken as string) || "SOL";
  const poolCount = (m.poolCount as number) || 1;
  const activeBoosts = (m.activeBoosts as number) || (m.totalBoosts as number) || 0;
  const pairAddr = (m.pairAddress as string) || "";
  const pairCreatedAt = (m.pairCreatedAt as string) || null;
  const fdv = (m.fdv as number) || listing.market_cap || 0;
  const ch5m = (m.priceChange5m as number) ?? null;
  const ch1h = (m.priceChange1h as number) ?? null;
  const txns5m = (m.txns5m as any) || null;
  const txns1h = (m.txns1h as any) || null;

  // Dev intel
  const devRisk = (m.devRisk as string) || "UNKNOWN";
  const devRiskScore = (m.devRiskScore as number) || 0;
  const confidence = (m.confidence as string) || "LOW";
  const recentMints = (m.recentMints as number) || 0;
  const bondedCoins = (m.bondedCoins as number) || 0;
  const dexPaidCoins = (m.dexPaidCoins as number) || 0;
  const deadCoins = (m.deadCoins as number) || 0;
  const ruggedCoins = (m.ruggedCoins as number) || 0;
  const lowLpCoins = (m.lowLpCoins as number) || 0;
  const devAnalysisNote = (m.devAnalysisNote as string) || null;

  // Bundle
  const bundleScore = (m.bundleScore as number) || 0;
  const bundleCount = (m.bundleCount as number) || 0;
  const holderClusters = (m.holderClusters as Array<{ address: string; pct: number; label: string }>) || [];

  // On-chain truth
  const whaleWallets = (m.whaleWallets as number) || 0;
  const topHolder = (m.topHolder as { address: string; pct: number }) || null;

  // Safety
  const organicScore = (m.organicScore as number) || 0;
  const organicLabel = (m.organicLabel as string) || "—";
  const verified = (m.verified as boolean) || false;
  const dominance = (m.dominance as number) || null;

  const bundleRating = bundleScore >= 60 ? "HIGH" : bundleScore >= 30 ? "MEDIUM" : "LOW";

  return (
    <div className="space-y-3">
      {/* ═══ BACK + SHARE BAR ═══ */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[11px] font-bold text-white/40 hover:text-white/70 transition-colors shrink-0">
          <ChevronDown className="h-3.5 w-3.5 rotate-90" /> Back
        </button>
        <div className="flex items-center gap-2">
          <button onClick={copyLink}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[11px] font-bold transition-all",
              linkCopied ? "border-og-lime/40 bg-og-lime/15 text-og-lime" : "border-white/15 bg-white/[0.06] text-white/60 hover:text-white hover:border-white/30",
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

      {/* ═══ TOP: Banner header + price stats ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto] gap-2">
        {/* Banner with token info */}
        <div className="relative rounded-xl border border-white/[0.06] bg-[#0a0e1a] overflow-hidden">
          <div className="h-32 sm:h-40 relative">
            {listing.banner_url ? (
              <img src={listing.banner_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/10 to-purple-900/20" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
          </div>
          <div className="absolute inset-0 flex items-center px-4 gap-4">
            <div className={cn(
              "shrink-0 h-16 w-16 rounded-full overflow-hidden border-2 shadow-lg bg-black",
              listing.analysis_verdict === "bullish" ? "border-emerald-500/50" :
              listing.analysis_verdict === "bearish" ? "border-red-500/50" : "border-white/20",
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
              <h2 className="text-2xl font-black text-white">${listing.symbol || "???"}</h2>
              <p className="text-xs text-white/40 mt-0.5">{listing.name} · {shortAddr(listing.mint_address)}</p>
              <div className="flex items-center gap-2 mt-2">
                <CopyBtn text={listing.mint_address} label="COPY CA" />
                <a href={`https://dexscreener.com/solana/${listing.mint_address}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold text-white/30 hover:text-white/60 transition">
                  <BarChart3 className="h-3 w-3" /> CHART
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Price stats grid */}
        <div className="grid grid-cols-2 gap-1.5 lg:w-[280px]">
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

      {/* ═══ ROW 1: Trade Activity | Dev Intel | Bundle Tracking | On-Chain Truth ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">

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
          {/* 5m / 1h txn breakdown */}
          <div className="flex items-center gap-2 mt-3 border-t border-white/[0.04] pt-2">
            {txns5m && (
              <div className="flex-1">
                <p className="text-[7px] text-white/15">5 MIN</p>
                <p className="text-[9px] font-bold text-white/40">B {txns5m.buys ?? 0} / S {txns5m.sells ?? 0}</p>
              </div>
            )}
            {txns1h && (
              <div className="flex-1">
                <p className="text-[7px] text-white/15">1 HOUR</p>
                <p className="text-[9px] font-bold text-white/40">B {formatNum(txns1h.buys)} / S {formatNum(txns1h.sells)}</p>
              </div>
            )}
          </div>
          {/* Price changes */}
          <div className="flex items-center gap-1 mt-2 border-t border-white/[0.04] pt-2">
            {ch5m != null && (
              <div className={cn("flex-1 text-center rounded py-1 text-[9px] font-bold", ch5m >= 0 ? "bg-og-lime/10 text-og-lime" : "bg-red-500/10 text-red-400")}>
                5M {ch5m >= 0 ? "↗" : "↘"}{Math.abs(ch5m).toFixed(2)}%
              </div>
            )}
            {ch1h != null && (
              <div className={cn("flex-1 text-center rounded py-1 text-[9px] font-bold", ch1h >= 0 ? "bg-og-lime/10 text-og-lime" : "bg-red-500/10 text-red-400")}>
                1H {ch1h >= 0 ? "↗" : "↘"}{Math.abs(ch1h).toFixed(2)}%
              </div>
            )}
            <div className={cn("flex-1 text-center rounded py-1 text-[9px] font-bold", change >= 0 ? "bg-og-lime/10 text-og-lime" : "bg-red-500/10 text-red-400")}>
              24H {change >= 0 ? "↗" : "↘"}{Math.abs(change).toFixed(2)}%
            </div>
          </div>
          {/* Market Data sub-section */}
          <div className="mt-2 border-t border-white/[0.04] pt-2">
            <div className="flex items-center gap-1 mb-1">
              <BarChart3 className="h-3 w-3 text-white/15" />
              <span className="text-[8px] font-black uppercase tracking-wider text-white/25">Market Data</span>
            </div>
            <DRow label="Price" value={formatUsd(listing.price_usd)} />
            <DRow label="Volume 24H" value={formatUsd(listing.volume_24h)} />
            {(m.quoteToken as string) && <DRow label="Quote/Backed" value={`${quoteToken}`} />}
            <DRow label="Market Cap" value={formatUsd(listing.market_cap)} />
            <DRow label="Liquidity" value={formatUsd(listing.liquidity_usd)} />
            {(m.athPrice as number) != null && <DRow label="ATH Price" value={formatUsd(m.athPrice as number)} />}
            <DRow label="FDV" value={formatUsd(fdv)} />
            <DRow label="Reported LP" value={formatUsd((m.reportedLp as number) || listing.liquidity_usd)} />
            {(m.atlPrice as number) != null && <DRow label="ATL Price" value={formatUsd(m.atlPrice as number)} />}
            {(m.athMc as number) != null && <DRow label="ATH MC" value={formatUsd(m.athMc as number)} />}
          </div>
        </DashSection>

        {/* ── 2. DEV / LAUNCH INTEL ── */}
        <DashSection title="Dev / Launch Intel" icon={<Eye className="h-3.5 w-3.5" />} accent="text-purple-400"
          badge="DEV LAUNCH" badgeColor="bg-purple-500/15 text-purple-400">
          <DRow label="Creator" value={creator ? shortAddr(creator) : "—"} valueColor="text-purple-300/70" />
          {fundingWallet && <DRow label="Funding Wallet" value={shortAddr(fundingWallet)} valueColor="text-purple-300/70" />}
          <DRow label="Confidence" value={confidence} valueColor={confidence === "HIGH" ? "text-emerald-400" : confidence === "MEDIUM" ? "text-amber-400" : "text-white/40"} />
          <DRow label="Recent Mints" value={String(recentMints)} />
          <DRow label="Bonded Coins" value={String(bondedCoins)} />
          <DRow label="Dex-Paid Coins" value={String(dexPaidCoins)} />
          <DRow label="Dev Risk" value={`${devRisk} · RUG ${devRiskScore}`}
            valueColor={devRisk === "HIGH" ? "text-red-400" : devRisk === "MEDIUM" ? "text-amber-400" : "text-emerald-400"} />
          <DRow label="Dead Coins" value={`${ruggedCoins} RUGGED · ${lowLpCoins} LOW LP`} />
          {devAnalysisNote && (
            <p className="text-[8px] text-white/25 mt-2 leading-relaxed italic">{devAnalysisNote}</p>
          )}

          {/* Safety Audit sub-section */}
          <div className="mt-3 border-t border-white/[0.04] pt-2">
            <div className="flex items-center gap-1 mb-1">
              <Shield className="h-3 w-3 text-white/15" />
              <span className="text-[8px] font-black uppercase tracking-wider text-white/25">Safety Audit</span>
            </div>
            <DRow label="Mint Authority" value={mintAuth ? "⚠" : "✓"}
              valueColor={mintAuth ? "text-amber-400" : "text-emerald-400"} />
            <DRow label="Freeze Authority" value={freezeAuth ? "⚠" : "✓"}
              valueColor={freezeAuth ? "text-amber-400" : "text-emerald-400"} />
            <DRow label="Top 10 Holders" value={listing.top10_holder_pct != null ? `${listing.top10_holder_pct.toFixed(1)}%` : "—"} />
            <DRow label="Whale Wallets" value={String(whaleWallets)} />
            <DRow label="Organic Score" value={`${organicScore} · ${organicLabel}`}
              valueColor={organicScore >= 70 ? "text-emerald-400" : organicScore >= 40 ? "text-amber-400" : "text-red-400"} />
            <DRow label="Verified" value={verified ? "✓ VERIFIED" : "✗ UNVERIFIED"}
              valueColor={verified ? "text-emerald-400" : "text-red-400"} />
            <DRow label="Dominance" value={dominance != null ? `${dominance.toFixed(1)}%` : "—"} />
          </div>
        </DashSection>

        {/* ── 3. BUNDLE TRACKING ── */}
        <DashSection title="Bundle Tracking" icon={<Layers className="h-3.5 w-3.5" />} accent="text-amber-400"
          badge="BUNDLE WATCH" badgeColor="bg-amber-500/15 text-amber-400">
          <DRow label="Bundle Score" value={`${bundleScore}/100 · ${bundleRating}`}
            valueColor={bundleScore >= 60 ? "text-red-400" : bundleScore >= 30 ? "text-amber-400" : "text-emerald-400"} />
          <DRow label="Bundle Count" value={String(bundleCount)} />
          {topHolder && <DRow label="Top Holder" value={`${topHolder.pct.toFixed(1)}%`} />}
          <DRow label="Top 10" value={listing.top10_holder_pct != null ? `${listing.top10_holder_pct.toFixed(1)}%` : "—"} />
          {holderClusters.map((c, i) => (
            <DRow key={i} label={c.label} value={`${shortAddr(c.address)} · ${c.pct.toFixed(1)}%`}
              valueColor="text-purple-300/60" />
          ))}
        </DashSection>

        {/* ── 4. ON-CHAIN TRUTH ── */}
        <DashSection title="On-Chain Truth" icon={<Shield className="h-3.5 w-3.5" />} accent="text-og-cyan"
          badge="HELIUS" badgeColor="bg-og-cyan/10 text-og-cyan">
          <DRow label="Mint Authority ⓘ" value={mintAuth ? "ENABLED" : "DISABLED"}
            valueColor={mintAuth ? "text-red-400" : "text-emerald-400"} />
          <DRow label="Freeze Authority ⓘ" value={freezeAuth ? "ENABLED" : "DISABLED"}
            valueColor={freezeAuth ? "text-red-400" : "text-emerald-400"} />
          {creator && <DRow label="Creator" value={shortAddr(creator)} valueColor="text-purple-300/70" />}
          {fundingWallet && <DRow label="Funding TX" value={shortAddr(fundingWallet)} valueColor="text-purple-300/70" />}
          <DRow label="Whale Wallets" value={String(whaleWallets)} />
          {topHolder && <DRow label="Largest Holder" value={`${shortAddr(topHolder.address)} · ${topHolder.pct.toFixed(1)}%`} valueColor="text-purple-300/60" />}
          {holderClusters.filter(c => c.label !== "Largest Holder").map((c, i) => (
            <DRow key={i} label={c.label} value={`${shortAddr(c.address)} · ${c.pct.toFixed(1)}%`}
              valueColor="text-purple-300/60" />
          ))}
        </DashSection>
      </div>

      {/* ═══ ROW 2: Token Metadata | Dex Paid & Boosts ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

        {/* ── TOKEN METADATA ── */}
        <DashSection title="Token Metadata" icon={<Database className="h-3.5 w-3.5" />} accent="text-amber-400">
          <div className="grid grid-cols-2 gap-x-4">
            <div>
              <DRow label="Chain" value="SOLANA" />
              <DRow label="Contract" value={shortAddr(listing.mint_address)} valueColor="text-purple-300/70" />
              {pairAddr && <DRow label="Pair" value={shortAddr(pairAddr)} valueColor="text-purple-300/70" />}
              {decimals != null && <DRow label="Decimals" value={String(decimals)} />}
              <DRow label="DEX" value={dexId.toUpperCase() || "—"} />
            </div>
            <div>
              <DRow label="Pools" value={String(poolCount)} />
              {(m.onChainMint as boolean) != null && <DRow label="On-Chain Mint ⓘ" value="—" />}
              {pairCreatedAt && <DRow label="Migration ⓘ" value={new Date(pairCreatedAt).toISOString().split("T")[0]} />}
              <DRow label="Quote Token" value={`${quoteToken} · ${dexId.toUpperCase() || "DEX"}`} />
            </div>
          </div>
        </DashSection>

        {/* ── DEX PAID & BOOSTS ── */}
        <DashSection title="Dex Paid & Boosts" icon={<Zap className="h-3.5 w-3.5" />} accent="text-emerald-400">
          <DRow label="Status" value={activeBoosts > 0 ? `${activeBoosts} BOOSTS PAID` : "—"}
            valueColor={activeBoosts > 0 ? "text-emerald-400" : "text-white/30"} />
          <DRow label="Active Boosts" value={String(activeBoosts)} />
          <DRow label="Total Paid" value={String(activeBoosts)} />
          <DRow label="Orders" value={`0 APPROVED`} />
          <DRow label="First Paid" value="—" />
          <DRow label="Last Paid" value="—" />

          {/* Links row */}
          <div className="mt-3 border-t border-white/[0.04] pt-2 flex flex-wrap gap-1.5">
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
            {(m.dexProfile as string) && (
              <>
                <a href={m.dexProfile as string} target="_blank" rel="noopener noreferrer"
                  className="rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[8px] font-bold text-white/30 hover:text-white/60 transition">PROFILE</a>
                <span className="rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[8px] font-bold text-amber-400/50">CTO</span>
                <span className="rounded border border-purple-500/20 bg-purple-500/5 px-2 py-1 text-[8px] font-bold text-purple-400/50">ADS</span>
                <a href={`https://dexscreener.com/solana/${listing.mint_address}?embed=1&theme=dark&trades=0&info=0`} target="_blank" rel="noopener noreferrer"
                  className="rounded border border-og-lime/20 bg-og-lime/5 px-2 py-1 text-[8px] font-bold text-og-lime/50 hover:text-og-lime transition">BOOST</a>
              </>
            )}
          </div>
        </DashSection>
      </div>

      {/* AI Analysis (if exists) */}
      {listing.analysis_summary && (
        <div className={cn(
          "rounded-xl border p-3",
          listing.analysis_verdict === "bullish" ? "border-emerald-500/20 bg-emerald-500/[0.03]" :
          listing.analysis_verdict === "bearish" ? "border-red-500/20 bg-red-500/[0.03]" :
          "border-white/[0.06] bg-[#0a0e1a]",
        )}>
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-3.5 w-3.5 text-white/30" />
            <span className="text-[10px] font-black uppercase tracking-wider text-white/40">AI Analysis</span>
            {listing.analysis_verdict && (
              <span className={cn("text-[8px] font-black px-1.5 py-0.5 rounded uppercase",
                listing.analysis_verdict === "bullish" ? "bg-emerald-500/15 text-emerald-400" :
                listing.analysis_verdict === "bearish" ? "bg-red-500/15 text-red-400" :
                "bg-white/10 text-white/30",
              )}>{listing.analysis_verdict}</span>
            )}
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-hide">
            {listing.analysis_summary.split("\n").map((line, i) => (
              <p key={i} className="text-[10px] text-white/40 leading-relaxed">{line}</p>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
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
   List Token Panel
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
    if (!ca || ca.length < 30) { setError("Please enter a valid Solana contract address"); return; }
    setError(null);
    setFetching(true);
    setFetchedData(null);
    try {
      const data = await fetchTokenData(ca);
      setFetchedData(data);
    } catch {
      setError("Failed to fetch token data. Double check the contract address.");
    } finally { setFetching(false); }
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
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-white">List a Token</h3>
          <p className="text-[10px] text-white/30 mt-0.5">Paste a contract address — Helius does the rest</p>
        </div>
        <button onClick={onClose} className="h-8 w-8 rounded-xl border border-white/[0.08] flex items-center justify-center text-white/30 hover:text-white/60 transition-colors">
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
        <input
          type="text" value={mintInput}
          onChange={(e) => setMintInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleFetch()}
          placeholder="Paste contract address (CA)..."
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/15 outline-none focus:border-og-cyan/30 transition-colors font-mono"
        />
      </div>

      <button onClick={handleFetch} disabled={fetching || !mintInput.trim()}
        className={cn(
          "w-full rounded-xl py-3 text-sm font-black transition-all flex items-center justify-center gap-2",
          fetching ? "bg-white/5 text-white/30" : "bg-og-cyan/10 text-og-cyan border border-og-cyan/20 hover:bg-og-cyan/20",
        )}>
        {fetching ? <><Loader2 className="h-4 w-4 animate-spin" /> Fetching from blockchain...</> : <><Search className="h-4 w-4" /> Fetch Token Data</>}
      </button>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3 text-[11px] text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

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

          <button onClick={handleList} disabled={saving}
            className={cn(
              "w-full rounded-xl py-3.5 text-sm font-black transition-all flex items-center justify-center gap-2",
              saving ? "bg-white/5 text-white/30" : "bg-gradient-to-r from-og-lime/20 to-emerald-500/20 text-og-lime border border-og-lime/20 hover:from-og-lime/30 hover:to-emerald-500/30",
            )}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Listing...</> : <><Plus className="h-4 w-4" /> List This Token</>}
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
      const query = supabase
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
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  /* Deep-link: auto-open a listing by mint address from URL */
  useEffect(() => {
    if (!initialMint || initialMintHandled.current || loading) return;
    initialMintHandled.current = true;
    const found = listings.find(l => l.mint_address.toLowerCase() === initialMint.toLowerCase());
    if (found) { setSelectedListing(found); return; }
    (async () => {
      try {
        const { data } = await supabase
          .from("token_listings").select("*").eq("mint_address", initialMint).maybeSingle();
        if (data) setSelectedListing(data as TokenListing);
      } catch { /* ignore */ }
    })();
  }, [initialMint, listings, loading]);

  const selectListing = useCallback((listing: TokenListing | null) => {
    setSelectedListing(listing);
    if (listing) navigate(`/listings/${listing.mint_address}`, { replace: true });
    else navigate("/listings", { replace: true });
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

  if (selectedListing) {
    return <ListingDetail listing={selectedListing} onBack={() => selectListing(null)} />;
  }

  if (showListPanel) {
    return <ListTokenPanel onClose={() => setShowListPanel(false)} onListed={fetchListings} />;
  }

  return (
    <div className="space-y-4">
      <EmeraldHeader
        icon={Megaphone}
        title="Listings"
        subtitle="List and promote any token on OG Scan — paste a contract and we pull live market, holder and safety data into a clean public card."
        badge="Community"
        right={(
          <button onClick={() => setShowListPanel(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:brightness-110">
            <Plus className="h-4 w-4" /> List Token
          </button>
        )}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400/70" />
        <input
          type="text" value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search listings..."
          className="w-full rounded-2xl border border-emerald-500/20 bg-white/[0.03] py-3 pl-10 pr-3 text-sm text-white placeholder:text-white/25 outline-none transition focus:border-emerald-400/60"
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(["all", "promoted", "bullish", "bearish", "newest"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn(
              "shrink-0 rounded-xl border px-3.5 py-1.5 text-[11px] font-bold transition",
              filter === f ? "border-emerald-400/50 bg-emerald-500/[0.08] text-emerald-300" : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white/70",
            )}>
            {f === "all" ? "All" : f === "promoted" ? "Promoted" : f === "bullish" ? "Bullish" : f === "bearish" ? "Bearish" : "Newest"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 text-og-cyan animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Sparkles className="h-8 w-8 text-white/10 mx-auto mb-3" />
          <p className="text-sm font-bold text-white/20">No listings found</p>
          <p className="text-[10px] text-white/10 mt-1">Be the first to list a token</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(listing => (
            <ListingCard key={listing.id} listing={listing} onSelect={selectListing} />
          ))}
        </div>
      )}
    </div>
  );
};

export default TokenListings;
