/**
 * CalloutLeaderboard — Rank callers by accuracy, hit rate, and profit.
 * Verified callers get badges. Most accurate callers featured at top.
 */
import { useState, useMemo } from "react";
import { Trophy, Target, TrendingUp, Medal, Crown, Star, ChevronDown, ChevronUp, Flame, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CallerStats {
  userId: string;
  username: string;
  totalCalls: number;
  hitCalls: number;
  missedCalls: number;
  hitRate: number;
  avgMultiplier: number;
  bestCall: { symbol: string; multiplier: number } | null;
  streak: number;
  isVerified: boolean;
  rank: number;
}

interface Props {
  callers?: CallerStats[];
}

const RANK_BADGES: Record<number, { emoji: string; color: string }> = {
  1: { emoji: "🥇", color: "text-amber-400" },
  2: { emoji: "🥈", color: "text-gray-300" },
  3: { emoji: "🥉", color: "text-amber-600" },
};

export const CalloutLeaderboard: React.FC<Props> = ({ callers = [] }) => {
  const [expanded, setExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<"hitRate" | "total" | "streak">("hitRate");

  const sorted = useMemo(() => {
    const arr = [...callers];
    if (sortBy === "hitRate") arr.sort((a, b) => b.hitRate - a.hitRate);
    else if (sortBy === "total") arr.sort((a, b) => b.totalCalls - a.totalCalls);
    else arr.sort((a, b) => b.streak - a.streak);
    return arr.map((c, i) => ({ ...c, rank: i + 1 }));
  }, [callers, sortBy]);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.015] transition-colors text-left"
      >
        <Trophy className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Caller Leaderboard</p>
          <p className="text-[10px] text-white/25">{callers.length} callers ranked</p>
        </div>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-white/15" /> : <ChevronDown className="h-3.5 w-3.5 text-white/15" />}
      </button>

      {expanded && (
        <>
          <div className="flex gap-1 px-3 pb-2">
            {(["hitRate", "total", "streak"] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={cn("px-2 py-0.5 rounded text-[9px]",
                  sortBy === s ? "bg-primary/10 text-primary" : "text-white/20"
                )}
              >
                {s === "hitRate" ? "Hit Rate" : s === "total" ? "Total Calls" : "Streak"}
              </button>
            ))}
          </div>

          <div className="max-h-[300px] overflow-y-auto divide-y divide-white/[0.03]">
            {sorted.length === 0 ? (
              <div className="p-6 text-center">
                <Trophy className="h-6 w-6 text-white/[0.06] mx-auto mb-1" />
                <p className="text-[10px] text-white/20">No callers yet</p>
              </div>
            ) : (
              sorted.slice(0, 20).map(caller => (
                <div key={caller.userId} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="w-6 text-center">
                    {RANK_BADGES[caller.rank] ? (
                      <span className="text-base">{RANK_BADGES[caller.rank].emoji}</span>
                    ) : (
                      <span className="text-[10px] text-white/20">#{caller.rank}</span>
                    )}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-[9px] font-bold text-white/20">
                    {caller.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-bold text-white">{caller.username}</span>
                      {caller.isVerified && <Shield className="h-2.5 w-2.5 text-primary" />}
                      {caller.streak > 5 && <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[7px]">🔥{caller.streak}</Badge>}
                    </div>
                    <span className="text-[9px] text-white/20">{caller.totalCalls} calls</span>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-xs font-black",
                      caller.hitRate >= 70 ? "text-emerald-400" : caller.hitRate >= 50 ? "text-amber-400" : "text-red-400"
                    )}>
                      {caller.hitRate.toFixed(0)}%
                    </p>
                    <p className="text-[8px] text-white/15">{caller.hitCalls}W / {caller.missedCalls}L</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CalloutLeaderboard;
