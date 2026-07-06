import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Trophy, TrendingUp, Target, Crown, Medal, Award, UserCircle, Users,
  Flame, Zap, Star, Shield, ChevronUp, ChevronDown, Gift, Wallet, BarChart3,
  Bell, Rocket, MessageSquare,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isUserOnline } from "@/lib/presence";
import { safeAvatarUrl } from "@/lib/utils";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════
   Types & Constants
   ═══════════════════════════════════════════════════════════════ */

type MainTab = "rankings" | "callers" | "invites";
type SortKey = "xp" | "pnl" | "trades" | "volume" | "streak" | "reputation";

interface TraderRow {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  badge: string | null;
  xp: number | null;
  total_xp: number | null;
  current_level: number | null;
  reputation_score: number | null;
  daily_streak: number | null;
  longest_streak: number | null;
  holder_streak: number | null;
  trades_count: number | null;
  total_pnl: number | null;
  pnl_pct: number | null;
  win_rate: number | null;
  volume_usd: number | null;
  followers_count: number | null;
  is_pioneer: boolean | null;
  verified: boolean | null;
  is_online: boolean | null;
  last_seen_at: string | null;
  wallet_address: string | null;
}

/** Shared presence rule: is_online flag + fresh heartbeat (see lib/presence) */
const isActuallyOnline = (row: TraderRow): boolean =>
  isUserOnline({ is_online: row.is_online, last_seen_at: row.last_seen_at });

interface InviteLeaderRow {
  inviter_id: string;
  invited: number;
  xp_earned: number;
  username?: string;
  avatar_url?: string;
}



const SORT_OPTIONS: { key: SortKey; label: string; icon: typeof Trophy }[] = [
  { key: "xp", label: "XP", icon: Zap },
  { key: "pnl", label: "PnL", icon: TrendingUp },
  { key: "trades", label: "Trades", icon: Target },
  { key: "volume", label: "Volume", icon: BarChart3 },
  { key: "streak", label: "Streak", icon: Flame },
  { key: "reputation", label: "Rep", icon: Shield },
];

const RANK_ICONS = [Crown, Medal, Award];
const RANK_COLORS = ["text-[#eab308]", "text-slate-400", "text-amber-600"];
const RANK_BORDERS = ["border-[#eab308]/30 shadow-[0_0_20px_rgba(234,179,8,0.08)]", "border-slate-400/20", "border-amber-600/20"];
const RANK_BG = ["bg-[#eab308]/5", "bg-slate-400/5", "bg-amber-600/5"];

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

const fmtPnL = (v: number | null) => {
  if (!v) return "$0";
  const abs = Math.abs(v);
  const s = abs >= 1e6 ? `$${(abs / 1e6).toFixed(1)}M` : abs >= 1e3 ? `$${(abs / 1e3).toFixed(1)}K` : `$${abs.toFixed(0)}`;
  return (v < 0 ? "-" : "+") + s;
};

const fmtVol = (v: number | null) => {
  if (!v) return "$0";
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
};

const xpForLevel = (level: number) => level * level * 100;
const xpProgress = (xp: number, level: number) => {
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return Math.min(100, ((xp - base) / (next - base)) * 100);
};

const getSortValue = (t: TraderRow, key: SortKey): number => {
  switch (key) {
    case "xp": return t.total_xp ?? t.xp ?? 0;
    case "pnl": return t.total_pnl ?? 0;
    case "trades": return t.trades_count ?? 0;
    case "volume": return t.volume_usd ?? 0;
    case "streak": return t.daily_streak ?? 0;
    case "reputation": return t.reputation_score ?? 0;
  }
};

const getStatLabel = (key: SortKey): string => {
  switch (key) {
    case "xp": return "XP";
    case "pnl": return "PnL";
    case "trades": return "Trades";
    case "volume": return "Volume";
    case "streak": return "Streak";
    case "reputation": return "Rep";
  }
};

const getStatDisplay = (t: TraderRow, key: SortKey): string => {
  switch (key) {
    case "xp": return (t.total_xp ?? t.xp ?? 0).toLocaleString();
    case "pnl": return fmtPnL(t.total_pnl);
    case "trades": return (t.trades_count ?? 0).toLocaleString();
    case "volume": return fmtVol(t.volume_usd);
    case "streak": return `${t.daily_streak ?? 0}🔥`;
    case "reputation": return (t.reputation_score ?? 0).toLocaleString();
  }
};

const shortWallet = (addr: string | null) => addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : "";

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */

const Leaderboard = () => {
  const [sortBy, setSortBy] = useState<SortKey>("xp");
  const [mainTab, setMainTab] = useState<MainTab>("rankings");
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: traders, isLoading } = useQuery<TraderRow[]>({
    queryKey: ["leaderboard-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, badge, xp, total_xp, current_level, reputation_score, daily_streak, longest_streak, holder_streak, trades_count, total_pnl, pnl_pct, win_rate, volume_usd, followers_count, is_pioneer, verified, is_online, last_seen_at, wallet_address")
        .order("total_xp", { ascending: false, nullsFirst: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as TraderRow[];
    },
    staleTime: 30_000,
  });

  const { data: inviteRows, isLoading: invitesLoading } = useQuery<InviteLeaderRow[]>({
    queryKey: ["invite-leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_leaderboard")
        .select("inviter_id, invited, xp_earned:credits_earned")
        .order("invited", { ascending: false })
        .limit(50);
      if (error) throw error;
      if (!data || data.length === 0) return [];
      const ids = data.map(r => r.inviter_id);
      const { data: profs } = await supabase.from("profiles").select("user_id, username, avatar_url").in("user_id", ids);
      const profMap = new Map((profs || []).map(p => [p.user_id, p]));
      return data.map(r => ({
        ...r,
        username: profMap.get(r.inviter_id)?.username || undefined,
        avatar_url: profMap.get(r.inviter_id)?.avatar_url || undefined,
      }));
    },
    staleTime: 30_000,
    enabled: mainTab === "invites",
  });



  const goToProfile = (userId: string) => {
    if (userId === user?.id) navigate("/profile");
    else navigate(`/profile/${userId}`);
  };

  const sorted = [...(traders || [])].sort((a, b) => getSortValue(b, sortBy) - getSortValue(a, sortBy));

  // Global stats
  const totalXP = sorted.reduce((s, t) => s + (t.total_xp ?? t.xp ?? 0), 0);
  const totalTrades = sorted.reduce((s, t) => s + (t.trades_count ?? 0), 0);
  const totalVolume = sorted.reduce((s, t) => s + (t.volume_usd ?? 0), 0);
  const walletsConnected = sorted.filter(t => t.wallet_address).length;
  const activeCount = sorted.filter(t => (t.daily_streak ?? 0) > 0).length;
  const memberCount = sorted.length;

  return (
    <AppLayout>
      <PageHeader title="OG Leaderboard" description="The most active and successful OGs" backTo="/trading-hub" />

      <div className="p-4 lg:p-6 space-y-6">
        <div className="space-y-3 rounded-3xl border border-white/[0.07] bg-white/[0.03] p-3 sm:p-4">
          <Tabs value={mainTab} onValueChange={v => setMainTab(v as MainTab)}>
            <TabsList className="grid h-auto w-full grid-cols-3 bg-white/[0.04] p-1">
              <TabsTrigger value="rankings" className="flex min-w-0 items-center justify-center gap-1.5 px-3 py-2 text-xs">
                <Trophy className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Rankings</span>
              </TabsTrigger>
              <TabsTrigger value="callers" className="flex min-w-0 items-center justify-center gap-1.5 px-3 py-2 text-xs">
                <Bell className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Top Callers</span>
              </TabsTrigger>
              <TabsTrigger value="invites" className="flex min-w-0 items-center justify-center gap-1.5 px-3 py-2 text-xs">
                <Gift className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Invites</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {mainTab === "rankings" && (
            <Tabs value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
                {SORT_OPTIONS.map(o => (
                  <TabsTrigger
                    key={o.key}
                    value={o.key}
                    className="flex min-w-fit items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs data-[state=active]:border-white/[0.14] data-[state=active]:bg-white/[0.10]"
                  >
                    <o.icon className="h-3.5 w-3.5 shrink-0" /> {o.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </div>

        {/* ═══ TOP CALLERS LEADERBOARD ═══ */}
        {mainTab === "callers" && (() => {
          // Reuse the same profiles data — sort by trades_count desc
          const callers = [...(traders || [])].sort((a, b) => (b.trades_count ?? 0) - (a.trades_count ?? 0));
          const totalTrades2 = callers.reduce((s, t) => s + (t.trades_count ?? 0), 0);
          const totalVol2 = callers.reduce((s, t) => s + (t.volume_usd ?? 0), 0);
          return (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Traders", value: String(callers.length), icon: Users, color: "text-violet-400" },
                  { label: "Total Trades", value: totalTrades2.toLocaleString(), icon: Bell, color: "text-og-lime" },
                  { label: "Total Volume", value: fmtVol(totalVol2), icon: BarChart3, color: "text-og-cyan" },
                ].map((s, i) => (
                  <div key={i} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <s.icon className={cn("h-4 w-4", s.color)} />
                      <span className="text-[9px] font-black text-white/25 uppercase tracking-widest">{s.label}</span>
                    </div>
                    <p className={cn("text-2xl font-black font-mono", s.color)}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Rankings table */}
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
                <div className="hidden md:grid grid-cols-[3rem_1fr_5rem_6rem_6rem_5rem] gap-2 px-4 py-3 border-b border-white/[0.07] text-[9px] font-black text-white/25 uppercase tracking-widest">
                  <span>#</span><span>Trader</span><span>Trades</span><span>Volume</span><span>PnL</span><span>Win%</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
                  ) : callers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-6">
                      <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
                        <Target className="h-7 w-7 text-white/20" />
                      </div>
                      <p className="text-sm font-bold text-white/50 mb-1">No trading data yet</p>
                      <p className="text-xs text-white/25 text-center">Connect your wallet and start trading to appear here</p>
                    </div>
                  ) : callers.map((t, i) => {
                    const isMe = t.user_id === user?.id;
                    const RIcon = i < 3 ? RANK_ICONS[i] : null;
                    return (
                      <div key={t.user_id}
                        className={cn("flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-all cursor-pointer", isMe && "bg-violet-500/[0.03] border-l-2 border-violet-500")}
                        onClick={() => goToProfile(t.user_id)}>
                        <div className="w-8 text-center shrink-0">
                          {RIcon ? <RIcon className={cn("h-5 w-5 mx-auto", RANK_COLORS[i])} /> : <span className="text-sm font-mono font-bold text-white/30">{i + 1}</span>}
                        </div>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="relative">
                            <Avatar className="h-9 w-9 border border-border">
                              <AvatarImage src={safeAvatarUrl(t.avatar_url)} />
                              <AvatarFallback className="bg-muted text-xs font-mono">{(t.username ?? "?")[0]?.toUpperCase()}</AvatarFallback>
                            </Avatar>
                            {isActuallyOnline(t) && <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={cn("font-semibold text-sm truncate", isMe && "text-violet-400")}>{t.display_name || t.username || "Anon"}</p>
                              {t.is_pioneer && <Star className="h-3 w-3 text-[#eab308] shrink-0" />}
                              {t.verified && <Shield className="h-3 w-3 text-blue-400 shrink-0" />}
                            </div>
                            {t.badge && <Badge variant="outline" className="text-[8px] border-primary/20 text-[#22d3ee] mt-0.5">{t.badge}</Badge>}
                          </div>
                        </div>
                        <div className="hidden md:contents">
                          <div className="w-14 text-center"><span className="text-sm font-black text-violet-300">{(t.trades_count ?? 0).toLocaleString()}</span></div>
                          <div className="w-16 text-right"><span className="text-xs font-mono text-og-cyan">{fmtVol(t.volume_usd)}</span></div>
                          <div className="w-16 text-right"><span className={cn("text-xs font-mono font-bold", (t.total_pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400")}>{fmtPnL(t.total_pnl)}</span></div>
                          <div className="w-12 text-right"><span className="text-xs font-mono text-white/50">{t.win_rate ?? 0}%</span></div>
                        </div>
                        <div className="md:hidden flex flex-col items-end gap-0.5">
                          <span className="text-sm font-black text-violet-300">{(t.trades_count ?? 0).toLocaleString()} trades</span>
                          <span className={cn("text-[10px] font-mono", (t.total_pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400")}>{fmtPnL(t.total_pnl)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          );
        })()}

        {/* ═══ INVITE LEADERBOARD ═══ */}
        {mainTab === "invites" && (
          <>
            {/* Invite stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Total Inviters", value: String(inviteRows?.length || 0), icon: Users, color: "text-og-cyan" },
                { label: "Total Invites", value: (inviteRows || []).reduce((s, r) => s + r.invited, 0).toLocaleString(), icon: Gift, color: "text-og-lime" },
                { label: "XP Awarded", value: (inviteRows || []).reduce((s, r) => s + r.xp_earned, 0).toLocaleString(), icon: Zap, color: "text-amber-400" },
              ].map((s, i) => (
                <div key={i} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <s.icon className={cn("h-4 w-4", s.color)} />
                    <span className="text-[9px] font-black text-white/25 uppercase tracking-widest">{s.label}</span>
                  </div>
                  <p className={cn("text-2xl font-black font-mono", s.color)}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* How it works card */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-bold text-white">How Invite XP Works</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03]">
                  <span className="text-white/50">Per signup</span>
                  <span className="font-bold text-amber-400">+100 XP</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03]">
                  <span className="text-white/50">Every 5 invites</span>
                  <span className="font-bold text-amber-400">+50 XP bonus</span>
                </div>
              </div>
              <p className="text-[10px] text-white/25 mt-2">Go to Settings → Invite to copy your unique link</p>
            </div>

            {/* Invite rankings table */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
              <div className="hidden md:grid grid-cols-[3rem_1fr_6rem_6rem] gap-2 px-4 py-3 border-b border-white/[0.07] text-[9px] font-black text-white/25 uppercase tracking-widest">
                <span>#</span><span>Inviter</span><span>Invited</span><span>XP Earned</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {invitesLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
                ) : !inviteRows || inviteRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 px-6">
                    <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
                      <Gift className="h-7 w-7 text-white/20" />
                    </div>
                    <p className="text-sm font-bold text-white/50 mb-1">No invites yet</p>
                    <p className="text-xs text-white/25 text-center">Be the first! Share your invite link from Settings → Invite</p>
                  </div>
                ) : inviteRows.map((row, i) => {
                  const isMe = row.inviter_id === user?.id;
                  const RIcon = i < 3 ? RANK_ICONS[i] : null;
                  return (
                    <div key={row.inviter_id}
                      className={cn("flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-all cursor-pointer", isMe && "bg-og-cyan/[0.03] border-l-2 border-og-cyan")}
                      onClick={() => goToProfile(row.inviter_id)}>
                      <div className="w-8 text-center shrink-0">
                        {RIcon ? <RIcon className={cn("h-5 w-5 mx-auto", RANK_COLORS[i])} /> : <span className="text-sm font-mono font-bold text-white/30">{i + 1}</span>}
                      </div>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-9 w-9 border border-border">
                          <AvatarImage src={safeAvatarUrl(row.avatar_url || null)} />
                          <AvatarFallback className="bg-muted text-xs font-mono">{(row.username ?? "?")[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <p className={cn("font-semibold text-sm truncate", isMe && "text-og-cyan")}>{row.username || "Anon"}</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-sm font-black text-white">{row.invited}</p>
                          <p className="text-[8px] text-white/20 md:hidden">invited</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-amber-400">{row.xp_earned.toLocaleString()}</p>
                          <p className="text-[8px] text-white/20 md:hidden">XP</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ═══ RANKINGS LEADERBOARD ═══ */}
        {mainTab === "rankings" && (
          <>
            {/* Global Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "OGs Ranked", value: String(memberCount), icon: Users, color: "text-og-cyan" },
                { label: "Total XP", value: totalXP.toLocaleString(), icon: Zap, color: "text-og-lime" },
                { label: "Wallets Linked", value: String(walletsConnected), icon: Wallet, color: "text-purple-400" },
                { label: "Total Volume", value: fmtVol(totalVolume), icon: BarChart3, color: "text-og-gold" },
              ].map((s, i) => (
                <div key={i} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <s.icon className={cn("h-4 w-4", s.color)} />
                    <span className="text-[9px] font-black text-white/25 uppercase tracking-widest">{s.label}</span>
                  </div>
                  <p className={cn("text-2xl font-black font-mono", s.color)}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Top 3 Podium */}
            {!isLoading && sorted.length >= 3 && (
              <div className="grid grid-cols-3 gap-3 lg:gap-4">
                {sorted.slice(0, 3).map((t, idx) => {
                  const RankIcon = RANK_ICONS[idx];
                  const xp = t.total_xp ?? t.xp ?? 0;
                  const level = t.current_level ?? Math.floor(Math.sqrt(xp / 100));
                  const mainVal = getStatDisplay(t, sortBy);
                  return (
                    <Card key={t.user_id}
                      className={cn("og-glass-card hover:border-primary/40 transition-all cursor-pointer hover:-translate-y-1 active:scale-95", RANK_BORDERS[idx], idx === 0 && "ring-1 ring-[#eab308]/20")}
                      onClick={() => goToProfile(t.user_id)}>
                      <CardContent className="flex flex-col items-center text-center p-5 pt-6 relative">
                        <div className={cn("absolute top-2 right-2 h-8 w-8 rounded-full flex items-center justify-center", RANK_BG[idx])}>
                          <RankIcon className={cn("h-4 w-4", RANK_COLORS[idx])} />
                        </div>

                        <div className="relative mb-3">
                          <Avatar className={cn("h-16 w-16 border-2", idx === 0 ? "border-[#eab308]/40" : "border-border")}>
                            <AvatarImage src={safeAvatarUrl(t.avatar_url)} />
                            <AvatarFallback className="bg-muted text-sm font-mono">{(t.username ?? "?")[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          {isActuallyOnline(t) && <div className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-background" />}
                        </div>

                        <p className="font-bold text-sm truncate max-w-full">{t.display_name || t.username || "Anon"}</p>

                        <div className="flex items-center gap-1 mt-1 flex-wrap justify-center">
                          {t.badge && <Badge variant="outline" className="text-[9px] border-primary/30 text-[#22d3ee]">{t.badge}</Badge>}
                          {t.is_pioneer && <Badge variant="outline" className="text-[9px] border-[#eab308]/30 text-[#eab308]">🌟 Pioneer</Badge>}
                          {t.verified && <Badge variant="outline" className="text-[9px] border-blue-400/30 text-blue-400">✓ Verified</Badge>}
                          {t.wallet_address && <Badge variant="outline" className="text-[8px] border-purple-400/30 text-purple-400 font-mono">{shortWallet(t.wallet_address)}</Badge>}
                        </div>

                        {/* Level & XP */}
                        <div className="mt-3 w-full">
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-white/40 font-bold">LVL {level}</span>
                            <span className="text-og-cyan font-mono font-bold">{xp.toLocaleString()} XP</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-og-cyan to-og-lime transition-all" style={{ width: `${xpProgress(xp, level)}%` }} />
                          </div>
                        </div>

                        {/* Key stats */}
                        <div className="mt-3 grid grid-cols-2 gap-2 w-full text-center">
                          <div>
                            <p className={cn("text-sm font-bold font-mono", (t.total_pnl ?? 0) >= 0 ? "text-green-400" : "text-destructive")}>{fmtPnL(t.total_pnl)}</p>
                            <p className="text-[8px] text-white/20 font-bold uppercase">PnL</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold font-mono text-orange-400">{t.trades_count ?? 0}</p>
                            <p className="text-[8px] text-white/20 font-bold uppercase">Trades</p>
                          </div>
                        </div>

                        {(t.volume_usd ?? 0) > 0 && (
                          <p className="text-[10px] text-white/30 mt-2 font-mono">Vol: {fmtVol(t.volume_usd)}</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Full Rankings Table */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
              <div className="hidden md:grid grid-cols-[3rem_1fr_5rem_6rem_6rem_5rem_5rem_5rem] gap-2 px-4 py-3 border-b border-white/[0.07] text-[9px] font-black text-white/25 uppercase tracking-widest">
                <span>#</span><span>Player</span><span>Level</span><span>XP</span><span>PnL</span><span>Trades</span><span>Volume</span><span>Win%</span>
              </div>

              <div className="divide-y divide-white/[0.04]">
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
                ) : sorted.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 px-6">
                    <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
                      <Trophy className="h-7 w-7 text-white/20" />
                    </div>
                    <p className="text-sm font-bold text-white/50 mb-1">No OGs on the board yet</p>
                    <p className="text-xs text-white/25 text-center">Connect your wallet and start trading to claim your rank</p>
                  </div>
                ) : sorted.map((t, i) => {
                  const xp = t.total_xp ?? t.xp ?? 0;
                  const level = t.current_level ?? Math.floor(Math.sqrt(xp / 100));
                  const isMe = t.user_id === user?.id;

                  return (
                    <div key={t.user_id}
                      className={cn("flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-all cursor-pointer group", isMe && "bg-og-cyan/[0.03] border-l-2 border-og-cyan")}
                      onClick={() => goToProfile(t.user_id)}>
                      {/* Rank */}
                      <div className="w-8 text-center shrink-0">
                        {i < 3 ? (
                          (() => { const R = RANK_ICONS[i]; return <R className={cn("h-5 w-5 mx-auto", RANK_COLORS[i])} />; })()
                        ) : (
                          <span className="text-sm font-mono font-bold text-white/30">{i + 1}</span>
                        )}
                      </div>

                      {/* Avatar + Name */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="relative">
                          <Avatar className="h-10 w-10 border border-border">
                            <AvatarImage src={safeAvatarUrl(t.avatar_url)} />
                            <AvatarFallback className="bg-muted text-xs font-mono">{(t.username ?? "?")[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          {isActuallyOnline(t) && <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={cn("font-semibold text-sm truncate", isMe && "text-og-cyan")}>{t.display_name || t.username || "Anon"}</p>
                            {t.is_pioneer && <Star className="h-3 w-3 text-[#eab308] shrink-0" />}
                            {t.verified && <Shield className="h-3 w-3 text-blue-400 shrink-0" />}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {t.badge && <Badge variant="outline" className="text-[8px] border-primary/20 text-[#22d3ee] mt-0.5">{t.badge}</Badge>}
                            {t.wallet_address && <span className="text-[8px] text-purple-400/60 font-mono mt-0.5">{shortWallet(t.wallet_address)}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Stats (desktop) */}
                      <div className="hidden md:contents">
                        <div className="w-12 text-center">
                          <span className="text-xs font-bold text-white/60">{level}</span>
                        </div>
                        <div className="w-16 text-right">
                          <span className="text-xs font-mono font-bold text-og-cyan">{xp.toLocaleString()}</span>
                        </div>
                        <div className="w-16 text-right">
                          <span className={cn("text-xs font-mono font-bold", (t.total_pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400")}>{fmtPnL(t.total_pnl)}</span>
                        </div>
                        <div className="w-14 text-right">
                          <span className="text-xs font-mono text-white/50">{t.trades_count ?? 0}</span>
                        </div>
                        <div className="w-14 text-right">
                          <span className="text-xs font-mono text-white/40">{fmtVol(t.volume_usd)}</span>
                        </div>
                        <div className="w-12 text-right">
                          <span className="text-xs font-mono text-white/50">{t.win_rate ?? 0}%</span>
                        </div>
                      </div>

                      {/* Stats (mobile) — show the current sort key prominently */}
                      <div className="md:hidden flex flex-col items-end gap-0.5">
                        <span className={cn("text-xs font-mono font-bold",
                          sortBy === "pnl" ? ((t.total_pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400") :
                          sortBy === "xp" ? "text-og-cyan" :
                          sortBy === "volume" ? "text-purple-400" :
                          "text-white"
                        )}>
                          {getStatDisplay(t, sortBy)} {sortBy === "xp" ? "XP" : ""}
                        </span>
                        {sortBy !== "pnl" && (t.total_pnl ?? 0) !== 0 && (
                          <span className={cn("text-[10px] font-mono", (t.total_pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400")}>{fmtPnL(t.total_pnl)}</span>
                        )}
                        {sortBy !== "trades" && (t.trades_count ?? 0) > 0 && (
                          <span className="text-[10px] text-white/30">{t.trades_count} trades</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Leaderboard;
