/**
 * PlatformLeaderboard — OG leaderboard powered by the `profiles` table.
 * Ranks users by XP, Streak, or Spaces hosted. Weekly / Monthly / All-time.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  Trophy, Crown, Star, Flame, Medal, Zap, Shield, Search,
  Mic, Loader2, RefreshCw, TrendingUp, ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface LeaderUser {
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_xp: number;
  xp: number;
  current_level: number | null;
  daily_streak: number;
  longest_streak: number;
  is_pioneer: boolean | null;
  verified: boolean | null;
  is_online: boolean | null;
  last_seen_at: string | null;
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

const RANK_CONFIG: Record<number, { bg: string; border: string; text: string; icon: string }> = {
  1: { bg: "bg-amber-400/10",  border: "border-amber-400/25",  text: "text-amber-300",  icon: "👑" },
  2: { bg: "bg-gray-400/10",   border: "border-gray-400/20",   text: "text-gray-300",   icon: "🥈" },
  3: { bg: "bg-amber-700/10",  border: "border-amber-700/20",  text: "text-amber-600",  icon: "🥉" },
};

function xpToLevel(xp: number): { level: number; title: string } {
  const thresholds = [
    { xp: 0,     level: 1,  title: "Rookie" },
    { xp: 100,   level: 2,  title: "Trader" },
    { xp: 300,   level: 3,  title: "Scout" },
    { xp: 750,   level: 4,  title: "Analyst" },
    { xp: 1500,  level: 5,  title: "Caller" },
    { xp: 3000,  level: 6,  title: "OG Caller" },
    { xp: 6000,  level: 7,  title: "Alpha Vet" },
    { xp: 12000, level: 8,  title: "Whale" },
    { xp: 25000, level: 9,  title: "Legend" },
    { xp: 50000, level: 10, title: "OG GOAT" },
  ];
  let current = thresholds[0];
  for (const t of thresholds) {
    if (xp >= t.xp) current = t;
    else break;
  }
  return { level: current.level, title: current.title };
}

type SortBy = "xp" | "streak";
type Timeframe = "week" | "month" | "all";

function sortUsers(arr: LeaderUser[], by: SortBy) {
  const copy = [...arr];
  if (by === "xp")     return copy.sort((a, b) => (b.total_xp || b.xp || 0) - (a.total_xp || a.xp || 0));
  if (by === "streak") return copy.sort((a, b) => (b.daily_streak || 0) - (a.daily_streak || 0));
  return copy;
}

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */

export const PlatformLeaderboard: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers]         = useState<LeaderUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const [sortBy, setSortBy]       = useState<SortBy>("xp");
  const [searchQ, setSearchQ]     = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      let query = supabase
        .from("profiles")
        .select("user_id, username, avatar_url, total_xp, xp, current_level, daily_streak, longest_streak, is_pioneer, verified, is_online, last_seen_at")
        .not("username", "is", null)
        .order(sortBy === "xp" ? "total_xp" : "daily_streak", { ascending: false, nullsFirst: false })
        .limit(100);

      // For week/month, apply a recency filter on last_seen_at as a proxy
      if (timeframe === "week") {
        const since = new Date(Date.now() - 7 * 86400_000).toISOString();
        query = query.gte("last_seen_at", since);
      } else if (timeframe === "month") {
        const since = new Date(Date.now() - 30 * 86400_000).toISOString();
        query = query.gte("last_seen_at", since);
      }

      const { data, error } = await query;
      if (error) throw error;

      const enriched: LeaderUser[] = (data || []).map((u: any) => ({
        user_id:       u.user_id,
        username:      u.username || "anon",
        avatar_url:    u.avatar_url,
        total_xp:      u.total_xp ?? u.xp ?? 0,
        xp:            u.xp ?? 0,
        current_level: u.current_level,
        daily_streak:  u.daily_streak ?? 0,
        longest_streak: u.longest_streak ?? 0,
        is_pioneer:    u.is_pioneer,
        verified:      u.verified,
        is_online:     u.is_online,
        last_seen_at:  u.last_seen_at,
      }));

      setUsers(sortUsers(enriched, sortBy));
    } catch (e) {
      console.error("[PlatformLeaderboard]", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeframe, sortBy]);

  useEffect(() => { fetchLeaders(); }, [fetchLeaders]);

  const filtered = searchQ.trim()
    ? users.filter(u => u.username?.toLowerCase().includes(searchQ.toLowerCase()))
    : users;

  const myRank = user ? users.findIndex(u => u.user_id === user.id) + 1 : 0;

  return (
    <div className="rounded-[1.75rem] border border-white/[0.08] bg-[#07101e] overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
          <Trophy className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-[13px] font-black uppercase tracking-widest text-white">OG Leaderboard</h3>
          <p className="text-[10px] text-white/35">
            {loading ? "Loading…" : `${users.length} OGs ranked${myRank > 0 ? ` · You're #${myRank}` : ""}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchLeaders(true)}
          className="p-1.5 rounded-lg text-white/20 hover:text-primary transition"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
        </button>
      </div>

      {/* ── Timeframe + Sort ── */}
      <div className="flex flex-col gap-2 px-4 pb-3">
        <div className="flex gap-1.5">
          {(["week", "month", "all"] as Timeframe[]).map(tf => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={cn(
                "flex-1 py-1.5 rounded-xl text-[10px] font-bold transition border",
                timeframe === tf
                  ? "bg-primary/15 text-primary border-primary/25"
                  : "text-white/25 border-transparent hover:text-white/45",
              )}
            >
              {tf === "week" ? "This Week" : tf === "month" ? "This Month" : "All Time"}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {([
            { key: "xp" as SortBy, label: "XP", Icon: Star },
            { key: "streak" as SortBy, label: "Streak", Icon: Flame },
          ]).map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortBy(key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-bold transition",
                sortBy === key ? "text-primary" : "text-white/20 hover:text-white/40",
              )}
            >
              <Icon className="h-2.5 w-2.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Search ── */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-white/20" />
          <Input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search OG…"
            className="pl-8 h-8 text-[11px] bg-white/[0.03] border-white/[0.06] rounded-xl focus:border-primary/40"
          />
        </div>
      </div>

      {/* ── Podium (top 3) ── */}
      {!loading && !searchQ && filtered.length >= 3 && (
        <div className="grid grid-cols-3 gap-2 px-4 pb-3">
          {[filtered[1], filtered[0], filtered[2]].map((u, i) => {
            const rank = i === 0 ? 2 : i === 1 ? 1 : 3;
            const conf = RANK_CONFIG[rank];
            const lvl = xpToLevel(u.total_xp);
            const effectiveXp = u.total_xp || u.xp || 0;
            return (
              <div key={u.user_id} className={cn(
                "rounded-2xl border p-3 text-center",
                conf.bg, conf.border,
                rank === 1 && "-mt-2",
              )}>
                <div className="text-xl mb-1">{conf.icon}</div>
                {u.avatar_url
                  ? <img src={u.avatar_url} className="w-8 h-8 rounded-full mx-auto object-cover" alt="" />
                  : <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center mx-auto text-[10px] font-black text-white/40">
                      {u.username?.[0]?.toUpperCase()}
                    </div>
                }
                <p className={cn("text-[11px] font-black mt-1.5 truncate", conf.text)}>{u.username}</p>
                <p className="text-[9px] text-white/30 font-bold">{effectiveXp.toLocaleString()} XP</p>
                <p className="text-[8px] text-white/15">Lv.{lvl.level} {lvl.title}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── List ── */}
      <div className="max-h-[350px] overflow-y-auto divide-y divide-white/[0.04]"
           style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-white/20" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Trophy className="h-10 w-10 text-white/[0.05] mx-auto mb-3" />
            <p className="text-sm text-white/20 font-bold">No OGs ranked yet</p>
            <p className="text-[11px] text-white/10 mt-1">Earn XP to appear on the board</p>
          </div>
        ) : (
          (searchQ ? filtered : filtered.slice(filtered.length >= 3 ? 3 : 0)).map((u, i) => {
            const rank = searchQ ? i + 1 : i + (filtered.length >= 3 ? 4 : 1);
            const lvl = xpToLevel(u.total_xp || u.xp || 0);
            const effectiveXp = u.total_xp || u.xp || 0;
            const isMe = user?.id === u.user_id;
            const online = u.is_online && u.last_seen_at
              ? new Date(u.last_seen_at).getTime() > Date.now() - 3 * 60_000
              : false;
            return (
              <div key={u.user_id} className={cn(
                "flex items-center gap-2.5 px-4 py-2.5 transition hover:bg-white/[0.015]",
                isMe && "bg-primary/[0.04]",
              )}>
                <span className="text-[11px] font-bold text-white/20 w-6 text-center shrink-0">#{rank}</span>
                <div className="relative shrink-0">
                  {u.avatar_url
                    ? <img src={u.avatar_url} className="w-7 h-7 rounded-full object-cover" alt="" />
                    : <div className="w-7 h-7 rounded-full bg-white/[0.07] flex items-center justify-center text-[9px] font-black text-white/25">
                        {u.username?.[0]?.toUpperCase()}
                      </div>
                  }
                  {online && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-og-lime border border-[#07101e]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-[12px] font-black truncate", isMe ? "text-primary" : "text-white")}>
                      {u.username}
                    </span>
                    {isMe && <Badge className="bg-primary/10 text-primary border-primary/20 text-[7px] h-3.5 px-1">YOU</Badge>}
                    {u.verified && <span className="text-[9px]">✓</span>}
                    {u.is_pioneer && <span className="text-[9px] text-amber-400">⭐</span>}
                    {(u.daily_streak || 0) > 5 && (
                      <span className="text-[9px] text-amber-400">🔥{u.daily_streak}</span>
                    )}
                  </div>
                  <p className="text-[9px] text-white/20">Lv.{lvl.level} {lvl.title}</p>
                </div>
                <div className="text-right shrink-0">
                  {sortBy === "xp" ? (
                    <p className="text-[12px] font-black text-primary">
                      {effectiveXp.toLocaleString()}
                      <span className="text-[8px] font-normal text-white/30 ml-0.5">XP</span>
                    </p>
                  ) : (
                    <p className="text-[12px] font-black text-amber-400">
                      {u.daily_streak || 0}
                      <span className="text-[8px] font-normal text-white/30 ml-0.5">🔥</span>
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PlatformLeaderboard;
