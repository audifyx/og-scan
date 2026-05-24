/**
 * CrossReferenceCard — Unified token intelligence card.
 * Shows whale activity, bundle status, LP changes, social buzz, and risk score
 * all in one glance for any trending token.
 */
import { useState } from "react";
import { Crosshair, TrendingUp, Users, Droplets, Shield, MessageSquare, Zap, Clock, ExternalLink, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtUsd, fmtPct, shortAddr } from "@/lib/og";

interface WhaleActivity {
  count: number;
  netFlow: number; // positive = buying, negative = selling
  largestTx: number;
  lastActiveAt: string;
}

interface SocialBuzz {
  twitterMentions: number;
  sentimentScore: number; // -1 to 1
  trendingOnCt: boolean;
  topInfluencerMention: string | null;
}

interface CrossRefData {
  mint: string;
  symbol: string;
  name: string;
  logoURI?: string;
  price: number;
  priceChange1h: number;
  priceChange24h: number;
  mcap: number;
  volume24h: number;
  liquidity: number;
  lpChange24h: number; // percentage
  holders: number;
  holderChange24h: number;
  riskScore: number;
  bundlePct: number;
  whaleActivity: WhaleActivity;
  socialBuzz: SocialBuzz;
  isNew: boolean;
  age: string;
}

interface Props {
  data: CrossRefData;
  onSelect?: (mint: string) => void;
  compact?: boolean;
}

const SignalDot: React.FC<{ color: string; label: string; value: string }> = ({ color, label, value }) => (
  <div className="flex items-center gap-1.5">
    <div className={cn("w-1.5 h-1.5 rounded-full", color)} />
    <span className="text-[9px] text-white/30">{label}</span>
    <span className="text-[10px] font-bold text-white/60">{value}</span>
  </div>
);

export const CrossReferenceCard: React.FC<Props> = ({ data, onSelect, compact = false }) => {
  const [expanded, setExpanded] = useState(false);

  const overallSentiment = (() => {
    let score = 0;
    if (data.priceChange1h > 5) score += 2;
    else if (data.priceChange1h > 0) score += 1;
    else if (data.priceChange1h < -5) score -= 2;
    else if (data.priceChange1h < 0) score -= 1;

    if (data.whaleActivity.netFlow > 0) score += 2;
    else if (data.whaleActivity.netFlow < 0) score -= 1;

    if (data.lpChange24h > 0) score += 1;
    else if (data.lpChange24h < -10) score -= 2;

    if (data.riskScore > 70) score -= 2;
    if (data.bundlePct > 20) score -= 1;
    if (data.socialBuzz.trendingOnCt) score += 1;

    if (score >= 4) return { label: "Strong Buy Signal", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
    if (score >= 2) return { label: "Bullish", color: "text-emerald-400", bg: "bg-emerald-500/5 border-emerald-500/15" };
    if (score >= 0) return { label: "Neutral", color: "text-white/40", bg: "bg-white/[0.03] border-white/[0.06]" };
    if (score >= -2) return { label: "Bearish", color: "text-red-400", bg: "bg-red-500/5 border-red-500/15" };
    return { label: "Strong Sell Signal", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" };
  })();

  if (compact) {
    return (
      <button
        onClick={() => onSelect?.(data.mint)}
        className="w-full flex items-center gap-2 p-2 rounded-lg border border-white/[0.06] bg-white/[0.015] hover:border-white/[0.1] transition-all"
      >
        {data.logoURI && <img src={data.logoURI} className="w-6 h-6 rounded-full" alt="" />}
        <span className="text-xs font-bold text-white">{data.symbol}</span>
        <span className={cn("text-[10px] font-bold", data.priceChange24h >= 0 ? "text-emerald-400" : "text-red-400")}>
          {data.priceChange24h >= 0 ? "+" : ""}{data.priceChange24h.toFixed(1)}%
        </span>
        <Badge className={cn("text-[8px] ml-auto", overallSentiment.bg, overallSentiment.color)}>
          {overallSentiment.label}
        </Badge>
      </button>
    );
  }

  return (
    <div className={cn("rounded-xl border overflow-hidden transition-all", overallSentiment.bg)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left hover:bg-white/[0.015] transition-colors"
      >
        {/* Top row: Token info + sentiment */}
        <div className="flex items-center gap-3 mb-3">
          {data.logoURI ? (
            <img src={data.logoURI} className="w-10 h-10 rounded-xl" alt="" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-sm font-bold text-white/20">
              {data.symbol.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">{data.symbol}</span>
              {data.isNew && <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px]">NEW</Badge>}
              <Badge className={cn("text-[8px]", overallSentiment.bg, overallSentiment.color)}>
                {overallSentiment.label}
              </Badge>
            </div>
            <p className="text-[10px] text-white/25">{data.name} · {data.age}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-white">${data.price < 0.01 ? data.price.toExponential(2) : data.price.toFixed(4)}</p>
            <p className={cn("text-xs font-bold", data.priceChange24h >= 0 ? "text-emerald-400" : "text-red-400")}>
              {data.priceChange24h >= 0 ? "+" : ""}{data.priceChange24h.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Signal grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Whale Activity */}
          <div className="rounded-lg bg-black/20 p-2">
            <p className="text-[8px] text-white/20 uppercase tracking-wider mb-1">Whales</p>
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3 text-purple-400" />
              <span className="text-xs font-bold text-white">{data.whaleActivity.count}</span>
              <span className={cn("text-[9px] font-bold",
                data.whaleActivity.netFlow > 0 ? "text-emerald-400" : data.whaleActivity.netFlow < 0 ? "text-red-400" : "text-white/30"
              )}>
                {data.whaleActivity.netFlow > 0 ? "↑ Buying" : data.whaleActivity.netFlow < 0 ? "↓ Selling" : "Neutral"}
              </span>
            </div>
          </div>

          {/* Bundle Status */}
          <div className="rounded-lg bg-black/20 p-2">
            <p className="text-[8px] text-white/20 uppercase tracking-wider mb-1">Bundles</p>
            <div className="flex items-center gap-1">
              <Zap className={cn("h-3 w-3", data.bundlePct > 15 ? "text-red-400" : data.bundlePct > 5 ? "text-amber-400" : "text-emerald-400")} />
              <span className="text-xs font-bold text-white">{data.bundlePct.toFixed(1)}%</span>
              {data.bundlePct > 15 && <AlertTriangle className="h-2.5 w-2.5 text-red-400" />}
            </div>
          </div>

          {/* LP Change */}
          <div className="rounded-lg bg-black/20 p-2">
            <p className="text-[8px] text-white/20 uppercase tracking-wider mb-1">Liquidity</p>
            <div className="flex items-center gap-1">
              <Droplets className="h-3 w-3 text-blue-400" />
              <span className="text-xs font-bold text-white">{fmtUsd(data.liquidity)}</span>
              <span className={cn("text-[9px]",
                data.lpChange24h > 0 ? "text-emerald-400" : data.lpChange24h < 0 ? "text-red-400" : "text-white/20"
              )}>
                {data.lpChange24h > 0 ? "+" : ""}{data.lpChange24h.toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Risk Score */}
          <div className="rounded-lg bg-black/20 p-2">
            <p className="text-[8px] text-white/20 uppercase tracking-wider mb-1">Risk</p>
            <div className="flex items-center gap-1">
              <Shield className={cn("h-3 w-3",
                data.riskScore <= 30 ? "text-emerald-400" : data.riskScore <= 60 ? "text-amber-400" : "text-red-400"
              )} />
              <span className="text-xs font-bold text-white">{data.riskScore}/100</span>
              {data.riskScore <= 30 && <CheckCircle className="h-2.5 w-2.5 text-emerald-400" />}
            </div>
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-white/[0.06] px-4 pb-4 pt-3 space-y-2">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[9px] text-white/20">MCap</p>
              <p className="text-xs font-bold text-white">{fmtUsd(data.mcap)}</p>
            </div>
            <div>
              <p className="text-[9px] text-white/20">24h Vol</p>
              <p className="text-xs font-bold text-white">{fmtUsd(data.volume24h)}</p>
            </div>
            <div>
              <p className="text-[9px] text-white/20">Holders</p>
              <p className="text-xs font-bold text-white">
                {data.holders.toLocaleString()}
                <span className={cn("text-[9px] ml-1",
                  data.holderChange24h > 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {data.holderChange24h > 0 ? "+" : ""}{data.holderChange24h}
                </span>
              </p>
            </div>
          </div>

          {/* Social buzz */}
          {data.socialBuzz.twitterMentions > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-black/20">
              <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[10px] text-white/40">{data.socialBuzz.twitterMentions} Twitter mentions</span>
              {data.socialBuzz.trendingOnCt && (
                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[8px]">Trending on CT</Badge>
              )}
              {data.socialBuzz.topInfluencerMention && (
                <span className="text-[9px] text-white/25">Mentioned by {data.socialBuzz.topInfluencerMention}</span>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => onSelect?.(data.mint)}
              className="flex-1 text-center py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
            >
              Full Scan →
            </button>
            <a
              href={`https://dexscreener.com/solana/${data.mint}`}
              target="_blank"
              rel="noopener"
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] text-white/30 text-xs hover:text-white/50 transition-colors flex items-center gap-1"
            >
              Chart <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrossReferenceCard;
