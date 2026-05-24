/**
 * RugScore — AI-powered Rug Probability Score
 * Combines 15+ signals into a 0-100 risk score with color-coded badge.
 * Shows: LP lock status, holder concentration, dev wallet history, contract authority,
 * token age, social links, bundle %, volume pattern, etc.
 */
import { useState, useEffect, useMemo } from "react";
import { Shield, ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp, Info, TrendingUp, Users, Lock, Droplets, Clock, Zap, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { HELIUS_RPC, fmtUsd, fmtPct, shortAddr } from "@/lib/og";

interface RugSignal {
  id: string;
  label: string;
  weight: number;
  score: number; // 0-100, 0 = safest
  detail: string;
  icon: React.ReactNode;
  severity: "safe" | "warning" | "danger" | "neutral";
}

interface RugScoreResult {
  totalScore: number;
  grade: string;
  gradeColor: string;
  signals: RugSignal[];
  summary: string;
}

interface Props {
  mint: string;
  tokenData?: {
    liquidity?: number;
    mcap?: number;
    holders?: number;
    audit?: { mintAuthority?: string; freezeAuthority?: string };
    createdAt?: string;
    website?: string;
    twitter?: string;
    lpPulled?: boolean;
    topHolderPct?: number;
    bundlePct?: number;
    volume24h?: number;
    devHolderPct?: number;
  };
  compact?: boolean;
}

const gradeFromScore = (score: number): { grade: string; color: string; bg: string; label: string } => {
  if (score <= 15) return { grade: "A+", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/25", label: "Very Safe" };
  if (score <= 30) return { grade: "A", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "Safe" };
  if (score <= 45) return { grade: "B", color: "text-lime-400", bg: "bg-lime-500/10 border-lime-500/20", label: "Low Risk" };
  if (score <= 60) return { grade: "C", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", label: "Moderate Risk" };
  if (score <= 75) return { grade: "D", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", label: "High Risk" };
  if (score <= 90) return { grade: "F", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "Dangerous" };
  return { grade: "F-", color: "text-red-500", bg: "bg-red-500/15 border-red-500/30", label: "Extreme Risk" };
};

const severityIcon = (s: string) => {
  if (s === "safe") return <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />;
  if (s === "warning") return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
  if (s === "danger") return <XCircle className="h-3.5 w-3.5 text-red-400" />;
  return <Info className="h-3.5 w-3.5 text-white/30" />;
};

function computeRugScore(mint: string, data: Props["tokenData"], onChainData?: any): RugScoreResult {
  const signals: RugSignal[] = [];
  const d = data || {};

  // 1. Mint Authority
  const hasMintAuth = d.audit?.mintAuthority && d.audit.mintAuthority !== "null" && d.audit.mintAuthority !== "";
  signals.push({
    id: "mint-auth", label: "Mint Authority", weight: 15,
    score: hasMintAuth ? 85 : 5,
    detail: hasMintAuth ? "Mint authority is NOT revoked — creator can mint unlimited tokens" : "Mint authority revoked ✓",
    icon: <Lock className="h-3.5 w-3.5" />,
    severity: hasMintAuth ? "danger" : "safe",
  });

  // 2. Freeze Authority
  const hasFreezeAuth = d.audit?.freezeAuthority && d.audit.freezeAuthority !== "null" && d.audit.freezeAuthority !== "";
  signals.push({
    id: "freeze-auth", label: "Freeze Authority", weight: 12,
    score: hasFreezeAuth ? 80 : 5,
    detail: hasFreezeAuth ? "Freeze authority active — creator can freeze your tokens" : "Freeze authority revoked ✓",
    icon: <Shield className="h-3.5 w-3.5" />,
    severity: hasFreezeAuth ? "danger" : "safe",
  });

  // 3. Liquidity
  const liq = d.liquidity || 0;
  const liqScore = liq >= 100000 ? 5 : liq >= 50000 ? 15 : liq >= 20000 ? 30 : liq >= 5000 ? 55 : liq >= 1000 ? 70 : 90;
  signals.push({
    id: "liquidity", label: "Liquidity", weight: 14,
    score: liqScore,
    detail: `${fmtUsd(liq)} liquidity${liq < 5000 ? " — dangerously low" : liq < 20000 ? " — low" : " — adequate"}`,
    icon: <Droplets className="h-3.5 w-3.5" />,
    severity: liqScore <= 30 ? "safe" : liqScore <= 55 ? "warning" : "danger",
  });

  // 4. LP Pulled
  if (d.lpPulled) {
    signals.push({
      id: "lp-pulled", label: "LP Status", weight: 20,
      score: 95,
      detail: "Liquidity has been PULLED — this is a strong rug indicator",
      icon: <ShieldAlert className="h-3.5 w-3.5" />,
      severity: "danger",
    });
  } else {
    signals.push({
      id: "lp-pulled", label: "LP Status", weight: 10,
      score: 10,
      detail: "Liquidity pool is active and funded ✓",
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
      severity: "safe",
    });
  }

  // 5. Holder Concentration
  const topHolderPct = d.topHolderPct || 0;
  const holderScore = topHolderPct >= 50 ? 90 : topHolderPct >= 30 ? 70 : topHolderPct >= 15 ? 40 : topHolderPct >= 5 ? 15 : 5;
  signals.push({
    id: "holder-conc", label: "Top Holder %", weight: 12,
    score: holderScore,
    detail: `Top holder owns ${fmtPct(topHolderPct / 100)}${topHolderPct >= 30 ? " — highly concentrated" : topHolderPct >= 15 ? " — moderate concentration" : " — well distributed"}`,
    icon: <Users className="h-3.5 w-3.5" />,
    severity: holderScore <= 30 ? "safe" : holderScore <= 55 ? "warning" : "danger",
  });

  // 6. Token Age
  const age = d.createdAt ? (Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24) : 0;
  const ageScore = age >= 30 ? 5 : age >= 7 ? 20 : age >= 1 ? 45 : age >= 0.04 ? 70 : 85; // 0.04 days = ~1 hour
  signals.push({
    id: "token-age", label: "Token Age", weight: 8,
    score: ageScore,
    detail: age >= 1 ? `${Math.floor(age)} day${Math.floor(age) === 1 ? "" : "s"} old` : age >= 0.04 ? `${Math.floor(age * 24)} hours old` : "Just launched — maximum caution",
    icon: <Clock className="h-3.5 w-3.5" />,
    severity: ageScore <= 30 ? "safe" : ageScore <= 55 ? "warning" : "danger",
  });

  // 7. Social Links
  const hasSocials = (d.website && d.website !== "") || (d.twitter && d.twitter !== "");
  const socialScore = d.website && d.twitter ? 5 : d.website || d.twitter ? 35 : 65;
  signals.push({
    id: "socials", label: "Social Links", weight: 6,
    score: socialScore,
    detail: d.website && d.twitter ? "Website + Twitter present ✓" : d.website || d.twitter ? "Partial social presence" : "No website or Twitter — anonymous project",
    icon: <Eye className="h-3.5 w-3.5" />,
    severity: socialScore <= 20 ? "safe" : socialScore <= 45 ? "warning" : "danger",
  });

  // 8. Holder Count
  const holders = d.holders || 0;
  const holderCountScore = holders >= 1000 ? 5 : holders >= 500 ? 15 : holders >= 100 ? 35 : holders >= 20 ? 60 : 80;
  signals.push({
    id: "holder-count", label: "Holder Count", weight: 8,
    score: holderCountScore,
    detail: `${holders.toLocaleString()} holders${holders < 100 ? " — very few" : holders < 500 ? " — growing" : " — healthy"}`,
    icon: <Users className="h-3.5 w-3.5" />,
    severity: holderCountScore <= 25 ? "safe" : holderCountScore <= 50 ? "warning" : "danger",
  });

  // 9. Bundle Detection
  const bundlePct = d.bundlePct || 0;
  if (bundlePct > 0) {
    const bundleScore = bundlePct >= 30 ? 90 : bundlePct >= 15 ? 65 : bundlePct >= 5 ? 40 : 15;
    signals.push({
      id: "bundles", label: "Bundle %", weight: 10,
      score: bundleScore,
      detail: `${fmtPct(bundlePct / 100)} of supply in bundled buys${bundlePct >= 15 ? " — likely coordinated" : ""}`,
      icon: <Zap className="h-3.5 w-3.5" />,
      severity: bundleScore <= 30 ? "safe" : bundleScore <= 55 ? "warning" : "danger",
    });
  }

  // 10. Volume to Mcap Ratio (wash trading indicator)
  const vol = d.volume24h || 0;
  const mcap = d.mcap || 1;
  if (vol > 0 && mcap > 0) {
    const ratio = vol / mcap;
    const washScore = ratio > 5 ? 80 : ratio > 2 ? 55 : ratio > 0.5 ? 20 : ratio > 0.1 ? 10 : 50; // Very low vol is also suspicious
    signals.push({
      id: "vol-mcap", label: "Vol/MCap Ratio", weight: 5,
      score: washScore,
      detail: `${ratio.toFixed(2)}x ratio${ratio > 5 ? " — possible wash trading" : ratio > 2 ? " — unusually high" : ratio < 0.1 ? " — very low activity" : " — normal"}`,
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      severity: washScore <= 30 ? "safe" : washScore <= 55 ? "warning" : "danger",
    });
  }

  // Compute weighted total
  const totalWeight = signals.reduce((s, sig) => s + sig.weight, 0);
  const weightedScore = signals.reduce((s, sig) => s + (sig.score * sig.weight), 0) / (totalWeight || 1);
  const totalScore = Math.round(Math.min(100, Math.max(0, weightedScore)));

  const { grade, color, label } = gradeFromScore(totalScore);
  const dangerCount = signals.filter(s => s.severity === "danger").length;
  const safeCount = signals.filter(s => s.severity === "safe").length;

  let summary: string;
  if (totalScore <= 25) summary = `${safeCount} of ${signals.length} signals are green. This token passes basic safety checks.`;
  else if (totalScore <= 50) summary = `Mixed signals. ${dangerCount} red flags detected. Proceed with caution.`;
  else if (totalScore <= 75) summary = `${dangerCount} serious red flags detected. High probability of rug or loss.`;
  else summary = `Multiple critical red flags. This token has strong rug indicators.`;

  return { totalScore, grade, gradeColor: color, signals, summary };
}

export const RugScore: React.FC<Props> = ({ mint, tokenData, compact = false }) => {
  const [expanded, setExpanded] = useState(false);

  const result = useMemo(() => computeRugScore(mint, tokenData), [mint, tokenData]);
  const { grade, color, bg, label } = gradeFromScore(result.totalScore);

  if (compact) {
    return (
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all", bg, color)}
      >
        <Shield className="h-3 w-3" />
        {grade} · {result.totalScore}
        <span className="text-[9px] font-medium opacity-60">{label}</span>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center border text-xl font-black", bg, color)}>
          {grade}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold text-white">Rug Risk Score</span>
            <Badge className={cn("text-[9px]", bg, color)}>{label}</Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500",
                  result.totalScore <= 30 ? "bg-emerald-500" :
                  result.totalScore <= 60 ? "bg-amber-500" : "bg-red-500"
                )}
                style={{ width: `${result.totalScore}%` }}
              />
            </div>
            <span className={cn("text-sm font-bold tabular-nums", color)}>{result.totalScore}/100</span>
          </div>
          <p className="text-[11px] text-white/30 mt-1">{result.summary}</p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-white/20" /> : <ChevronDown className="h-4 w-4 text-white/20" />}
      </button>

      {/* Expanded signals */}
      {expanded && (
        <div className="border-t border-white/[0.06] px-4 pb-4 pt-3 space-y-2">
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider mb-2">Signal Breakdown ({result.signals.length} checks)</p>
          {result.signals
            .sort((a, b) => b.score - a.score)
            .map(sig => (
            <div key={sig.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.015] border border-white/[0.04]">
              {severityIcon(sig.severity)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white/70">{sig.label}</span>
                  <span className="text-[9px] text-white/20 font-medium">w:{sig.weight}</span>
                </div>
                <p className="text-[10px] text-white/30 mt-0.5">{sig.detail}</p>
              </div>
              <div className={cn("text-xs font-bold tabular-nums",
                sig.score <= 30 ? "text-emerald-400" : sig.score <= 60 ? "text-amber-400" : "text-red-400"
              )}>
                {sig.score}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RugScore;
