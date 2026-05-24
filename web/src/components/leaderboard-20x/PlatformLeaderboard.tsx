/**
 * PlatformLeaderboard — Global platform leaderboard.
 * Ranks users by XP, scans, spaces hosted, accuracy, and overall activity.
 * Weekly/monthly/all-time views.
 */
import { useState, useMemo } from "react";
import { Trophy, Crown, Star, Flame, Medal, Target, Zap, Shield, ChevronDown, ChevronUp, Search, Mic, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LeaderboardUser {
  userId: string;
  username: string;
  avatarUrl?: string;
  xp: number;
  level: number;
  title: string;
  scansPerformed: number;
  spacesHosted: number;
  callAccuracy: number;
  daysActive: number;
  streak: number;
  badges: string[];
}

interface Props {
  users: LeaderboardUser[];
}

const RANK_CONFIG: Record<number, { bg: string; border: string; text: string }> = {
  1: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400" },
  2: { bg: "bg-gray-300/10", border: "border-gray-300/20", text: "text-gray-300" },
  3: { bg: "bg-amber-700/10", border: "border-amber-700/20", text: "text-amber-600" },
};

export const PlatformLeaderboard: React.FC<Props> = ({ users }) => {
  const [timeframe, setTimeframe] = useState<"week" | "month" | "all">("all");
  const [sortBy, setSortBy] = useState<"xp" | "scans" | "spaces" | "accuracy">("xp");
  const [expanded, setExpanded] = useState(true);

  const sorted = useMemo(() => {
    const arr = [...users];
    switch (sortBy) {
      case "xp": arr.sort((a, b) => b.xp - a.xp); break;
      case "scans": arr.sort((a, b) => b.scansPerformed - a.scansPerformed); break;
      case "spaces": arr.sort((a, b) => b.spacesHosted - a.spacesHosted); break;
      case "accuracy": arr.sort((a, b) => b.callAccuracy - a.callAccuracy); break;
    }
    return arr;
  }, [users, sortBy]);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
        <Trophy className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-bold text-white">OG Leaderboard</p>
          <p className="text-[10px] text-white/25">{users.length} OGs ranked</p>
        </div>
        {/* Timeframe selector */}
        <div className="flex gap-1">
          {(["week", "month", "all"] as const).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn("px-2 py-0.5 rounded text-[9px]",
                timeframe === tf ? "bg-primary/10 text-primary" : "text-white/20"
              )}
            >
              {tf === "week" ? "Week" : tf === "month" ? "Month" : "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Sort options */}
      <div className="flex gap-1 px-3 py-2 border-b border-white/[0.04]">
        {([
          { id: "xp" as const, label: "XP", icon: <Star className="h-2.5 w-2.5" /> },
          { id: "scans" as const, label: "Scans", icon: <Search className="h-2.5 w-2.5" /> },
          { id: "spaces" as const, label: "Spaces", icon: <Mic className="h-2.5 w-2.5" /> },
          { id: "accuracy" as const, label: "Accuracy", icon: <Target className="h-2.5 w-2.5" /> },
        ]).map(s => (
          <button
            key={s.id}
            onClick={() => setSortBy(s.id)}
            className={cn("flex items-center gap-1 px-2 py-1 rounded text-[9px] transition-all",
              sortBy === s.id ? "bg-primary/10 text-primary" : "text-white/20 hover:text-white/40"
            )}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* Top 3 podium */}
      {sorted.length >= 3 && (
        <div className="grid grid-cols-3 gap-2 p-3 border-b border-white/[0.06]">
          {[sorted[1], sorted[0], sorted[2]].map((user, i) => {
            const rank = i === 0 ? 2 : i === 1 ? 1 : 3;
            const conf = RANK_CONFIG[rank];
            return (
              <div key={user.userId} className={cn("rounded-lg border p-2 text-center",
                conf.bg, conf.border,
                rank === 1 && "row-span-1 -mt-2"
              )}>
                <span className="text-xl">{rank === 1 ? "👑" : rank === 2 ? "🥈" : "🥉"}</span>
                <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center mx-auto mt-1 text-[10px] font-bold text-white/30">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <p className={cn("text-[10px] font-bold mt-1", conf.text)}>{user.username}</p>
                <p className="text-[8px] text-white/20">{user.xp.toLocaleString()} XP</p>
                <p className="text-[7px] text-white/10">Lv.{user.level} {user.title}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Full list */}
      <div className="max-h-[300px] overflow-y-auto divide-y divide-white/[0.03]">
        {sorted.length === 0 ? (
          <div className="p-8 text-center">
            <Trophy className="h-8 w-8 text-white/[0.06] mx-auto mb-2" />
            <p className="text-xs text-white/20">No users ranked yet</p>
          </div>
        ) : (
          sorted.slice(3).map((user, i) => (
            <div key={user.userId} className="flex items-center gap-2.5 px-3 py-2">
              <span className="text-[10px] text-white/20 w-5 text-center">#{i + 4}</span>
              <div className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center text-[8px] font-bold text-white/20">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-white">{user.username}</span>
                  <span className="text-[8px] text-white/15">Lv.{user.level}</span>
                  {user.streak > 5 && <span className="text-[8px] text-amber-400">🔥{user.streak}</span>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-primary">{user.xp.toLocaleString()} XP</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PlatformLeaderboard;
