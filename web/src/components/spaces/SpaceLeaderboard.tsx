/**
 * SpaceLeaderboard — Speaker leaderboard showing top contributors across all spaces.
 * Tracks total speaking time, spaces hosted, and engagement.
 */
import React, { useState, useEffect } from "react";
import { Trophy, Crown, Mic, Clock, Star, ChevronUp, Users, Flame } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl: string | null;
  spacesHosted: number;
  spacesSpoken: number;
  totalDurationMin: number;
}

interface SpaceLeaderboardProps {
  compact?: boolean;
}

const MEDALS = ["🥇", "🥈", "🥉"];

const SpaceLeaderboard: React.FC<SpaceLeaderboardProps> = ({ compact }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(!compact);

  useEffect(() => {
    const fetch = async () => {
      // Aggregate from spaces table — count spaces per host
      const { data: spaces } = await supabase.from("spaces")
        .select("host_id, host_username, host_avatar, duration_seconds")
        .not("ended_at", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);

      if (!spaces) { setLoading(false); return; }

      const map = new Map<string, LeaderboardEntry>();
      for (const s of spaces) {
        const existing = map.get(s.host_id) || {
          userId: s.host_id,
          username: s.host_username || "Unknown",
          avatarUrl: s.host_avatar || null,
          spacesHosted: 0,
          spacesSpoken: 0,
          totalDurationMin: 0,
        };
        existing.spacesHosted++;
        existing.spacesSpoken++;
        existing.totalDurationMin += Math.round((s.duration_seconds || 0) / 60);
        map.set(s.host_id, existing);
      }

      const sorted = Array.from(map.values()).sort((a, b) => b.spacesHosted - a.spacesHosted);
      setEntries(sorted.slice(0, 10));
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <div className="space-y-2">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full px-1">
        <div className="flex items-center gap-2">
          <Trophy className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-[11px] font-bold text-white/50">Speaker Leaderboard</span>
        </div>
        <ChevronUp className={cn("h-3 w-3 text-white/20 transition-transform", !expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="space-y-1">
          {loading && <p className="text-[10px] text-white/15 text-center py-3">Loading...</p>}
          {!loading && entries.length === 0 && (
            <p className="text-[10px] text-white/15 text-center py-3">No spaces completed yet</p>
          )}
          {entries.map((e, i) => (
            <div key={e.userId}
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-xl border transition-all",
                i === 0 ? "border-amber-500/15 bg-amber-500/[0.03]" :
                i === 1 ? "border-white/[0.08] bg-white/[0.02]" :
                i === 2 ? "border-white/[0.06] bg-white/[0.015]" :
                "border-white/[0.04] bg-white/[0.01]"
              )}>
              {/* Rank */}
              <div className="w-6 text-center shrink-0">
                {i < 3 ? (
                  <span className="text-base">{MEDALS[i]}</span>
                ) : (
                  <span className="text-[11px] font-bold text-white/20">#{i + 1}</span>
                )}
              </div>

              {/* Avatar */}
              <div className={cn(
                "w-8 h-8 rounded-full border flex items-center justify-center overflow-hidden shrink-0",
                i === 0 ? "border-amber-500/30" : "border-white/[0.08]"
              )}>
                {e.avatarUrl ? (
                  <img src={e.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] font-bold text-white/30">{e.username?.[0]?.toUpperCase() || "?"}</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-[11px] font-bold truncate", i === 0 ? "text-amber-400" : "text-white/70")}>
                    {e.username}
                  </span>
                  {i === 0 && <Crown className="h-3 w-3 text-amber-400 shrink-0" />}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-white/20 flex items-center gap-0.5">
                    <Mic className="h-2 w-2" /> {e.spacesHosted} spaces
                  </span>
                  <span className="text-[9px] text-white/20 flex items-center gap-0.5">
                    <Clock className="h-2 w-2" /> {e.totalDurationMin}m
                  </span>
                </div>
              </div>

              {/* Score bar */}
              <div className="w-12 shrink-0">
                <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className={cn(
                    "h-full rounded-full",
                    i === 0 ? "bg-amber-400" : i < 3 ? "bg-white/20" : "bg-white/10"
                  )} style={{ width: `${Math.min(100, (e.spacesHosted / (entries[0]?.spacesHosted || 1)) * 100)}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SpaceLeaderboard;
