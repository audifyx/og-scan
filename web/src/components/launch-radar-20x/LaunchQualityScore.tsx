/**
 * LaunchQualityScore — Auto-grade new launches A-F
 * Based on: website, Twitter, LP locked, dev holding %, renounced authority, unique ticker.
 */
import { useMemo } from "react";
import { Shield, Globe, Twitter, Lock, Users, Fingerprint, Tag, CheckCircle, XCircle, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LaunchData {
  hasWebsite: boolean;
  hasTwitter: boolean;
  hasTelegram: boolean;
  lpLocked: boolean;
  lpAmount: number;
  devHoldingPct: number;
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  uniqueTicker: boolean;
  holderCount: number;
  age: number; // hours since launch
}

interface Props {
  data: LaunchData;
  compact?: boolean;
}

interface GradeCheck {
  label: string;
  passed: boolean;
  points: number;
  icon: React.ReactNode;
}

const gradeConfig: Record<string, { color: string; bg: string; label: string }> = {
  "A+": { color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/25", label: "Excellent" },
  "A":  { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "Very Good" },
  "B":  { color: "text-lime-400",    bg: "bg-lime-500/10 border-lime-500/20",       label: "Good" },
  "C":  { color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20",     label: "Average" },
  "D":  { color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20",   label: "Below Average" },
  "F":  { color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",         label: "Poor" },
};

function computeGrade(data: LaunchData): { grade: string; score: number; checks: GradeCheck[] } {
  const checks: GradeCheck[] = [
    { label: "Website", passed: data.hasWebsite, points: 12, icon: <Globe className="h-3 w-3" /> },
    { label: "Twitter/X", passed: data.hasTwitter, points: 12, icon: <Twitter className="h-3 w-3" /> },
    { label: "Telegram", passed: data.hasTelegram, points: 6, icon: <Users className="h-3 w-3" /> },
    { label: "LP Locked", passed: data.lpLocked, points: 15, icon: <Lock className="h-3 w-3" /> },
    { label: "LP > $10k", passed: data.lpAmount >= 10000, points: 10, icon: <Shield className="h-3 w-3" /> },
    { label: "LP > $50k", passed: data.lpAmount >= 50000, points: 8, icon: <Shield className="h-3 w-3" /> },
    { label: "Dev < 10%", passed: data.devHoldingPct < 10, points: 10, icon: <Fingerprint className="h-3 w-3" /> },
    { label: "Dev < 5%", passed: data.devHoldingPct < 5, points: 7, icon: <Fingerprint className="h-3 w-3" /> },
    { label: "Mint Revoked", passed: data.mintAuthorityRevoked, points: 10, icon: <Lock className="h-3 w-3" /> },
    { label: "Freeze Revoked", passed: data.freezeAuthorityRevoked, points: 5, icon: <Lock className="h-3 w-3" /> },
    { label: "Unique Ticker", passed: data.uniqueTicker, points: 5, icon: <Tag className="h-3 w-3" /> },
  ];

  const score = checks.reduce((s, c) => s + (c.passed ? c.points : 0), 0);
  const maxScore = checks.reduce((s, c) => s + c.points, 0);
  const pct = (score / maxScore) * 100;

  const grade = pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 65 ? "B" : pct >= 50 ? "C" : pct >= 30 ? "D" : "F";
  return { grade, score: pct, checks };
}

export const LaunchQualityScore: React.FC<Props> = ({ data, compact = false }) => {
  const { grade, score, checks } = useMemo(() => computeGrade(data), [data]);
  const config = gradeConfig[grade] || gradeConfig["C"];

  if (compact) {
    return (
      <Badge className={cn("text-[9px] gap-1 font-bold", config.bg, config.color)}>
        {grade}
      </Badge>
    );
  }

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3">
      <div className="flex items-center gap-2.5 mb-2">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border text-sm font-black", config.bg, config.color)}>
          {grade}
        </div>
        <div>
          <p className="text-xs font-bold text-white">Quality Score</p>
          <p className="text-[10px] text-white/25">{config.label} · {Math.round(score)}% checks passed</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {checks.map(c => (
          <div
            key={c.label}
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border",
              c.passed
                ? "bg-emerald-500/5 border-emerald-500/15 text-emerald-400"
                : "bg-white/[0.01] border-white/[0.04] text-white/20"
            )}
          >
            {c.passed ? <CheckCircle className="h-2 w-2" /> : <Minus className="h-2 w-2" />}
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LaunchQualityScore;
