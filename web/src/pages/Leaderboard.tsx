import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Trophy, TrendingUp, Target, Crown, Medal, Award, UserCircle, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { safeAvatarUrl } from "@/lib/utils";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

type SortKey = "pnl" | "winrate" | "trades";

const rankIcons = [Crown, Medal, Award];
const rankColors = [
  "text-[#eab308]",
  "text-slate-400",
  "text-amber-600",
];


const Leaderboard = () => {
  const [sortBy, setSortBy] = useState<SortKey>("pnl");
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: traders, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leaderboard")
        .select("*")
        .order("total_pnl", { ascending: false, nullsFirst: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Also fetch follower counts
  const { data: followCounts } = useQuery({
    queryKey: ["leaderboard-followers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("followers")
        .select("following_id");
      const counts: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        counts[row.following_id] = (counts[row.following_id] || 0) + 1;
      });
      return counts;
    },
  });

  const source = traders || [];
  const sorted = [...source].sort((a, b) => {
    if (sortBy === "pnl") return (b.total_pnl ?? 0) - (a.total_pnl ?? 0);
    if (sortBy === "winrate") return (b.win_rate ?? 0) - (a.win_rate ?? 0);
    return (b.trades_count ?? 0) - (a.trades_count ?? 0);
  });

  const formatPnL = (v: number | null) => {
    if (!v) return "$0";
    const abs = Math.abs(v);
    const str = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(1)}M` : abs >= 1_000 ? `$${(abs / 1_000).toFixed(1)}K` : `$${abs.toFixed(0)}`;
    return (v < 0 ? "-" : "+") + str;
  };

  const goToProfile = (trader: any) => {
    if (trader.user_id === user?.id) {
      navigate("/profile");
    } else {
      navigate(`/profile?uid=${trader.user_id}`);
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Leaderboard" description="Top traders ranked by performance">
        <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <TabsList className="bg-white/[0.04]">
            <TabsTrigger value="pnl" className="flex items-center gap-1.5 text-xs">
              <TrendingUp className="h-3.5 w-3.5" /> PnL
            </TabsTrigger>
            <TabsTrigger value="winrate" className="flex items-center gap-1.5 text-xs">
              <Target className="h-3.5 w-3.5" /> Win Rate
            </TabsTrigger>
            <TabsTrigger value="trades" className="flex items-center gap-1.5 text-xs">
              <Trophy className="h-3.5 w-3.5" /> Trades
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      <div className="p-4 lg:p-6 space-y-4">
        {/* Top 3 podium */}
        {!isLoading && sorted.length >= 3 && (
          <div className="grid grid-cols-3 gap-3">
            {sorted.slice(0, 3).map((t, idx) => {
              const RankIcon = rankIcons[idx];
              return (
                <Card
                  key={t.user_id}
                  className={`og-glass-card hover:border-primary/40 transition-all cursor-pointer hover:-translate-y-0.5 active:scale-95 ${idx === 0 ? "ring-1 ring-[#eab308]/30" : ""}`}
                  onClick={() => goToProfile(t)}
                >
                  <CardContent className="flex flex-col items-center text-center p-4 pt-5">
                    <RankIcon className={`h-5 w-5 mb-2 ${rankColors[idx]}`} />
                    <Avatar className="h-12 w-12 mb-2 border-2 border-border">
                      <AvatarImage src={safeAvatarUrl(t.avatar_url)} />
                      <AvatarFallback className="bg-muted text-xs font-mono">
                        {(t.username ?? "?")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <p className="font-semibold text-sm truncate max-w-full">{t.username ?? "Anon"}</p>
                    {t.badge && (
                      <Badge variant="outline" className="text-[10px] mt-1 border-primary/30 text-[#22d3ee]">
                        {t.badge}
                      </Badge>
                    )}
                    <p className={`text-lg font-bold font-mono mt-2 ${(t.total_pnl ?? 0) >= 0 ? "text-green-400" : "text-destructive"}`}>
                      {formatPnL(t.total_pnl)}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      {t.win_rate ?? 0}% WR · {t.trades_count ?? 0} trades
                    </p>
                    {(followCounts?.[t.user_id] ?? 0) > 0 && (
                      <p className="text-[10px] text-white/30 mt-1 flex items-center gap-1">
                        <Users className="h-2.5 w-2.5" />
                        {followCounts![t.user_id]} followers
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Full list */}
        <div className="space-y-2">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))
            : sorted.slice(3).map((t, i) => (
                <Card
                  key={t.user_id}
                  className="og-glass-card hover:border-primary/30 transition-all cursor-pointer active:scale-[0.99]"
                  onClick={() => goToProfile(t)}
                >
                  <CardContent className="flex items-center gap-3 p-3">
                    <span className="w-7 text-center text-sm font-mono text-muted-foreground font-bold">
                      {i + 4}
                    </span>
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarImage src={safeAvatarUrl(t.avatar_url)} />
                      <AvatarFallback className="bg-muted text-xs font-mono">
                        {(t.username ?? "?")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{t.username ?? "Anon"}</p>
                        {t.badge && (
                          <Badge variant="outline" className="text-[9px] border-primary/30 text-[#22d3ee]">
                            {t.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {t.win_rate ?? 0}% WR · {t.trades_count ?? 0} trades
                        {(followCounts?.[t.user_id] ?? 0) > 0 && ` · ${followCounts![t.user_id]} followers`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className={`font-bold font-mono text-sm ${(t.total_pnl ?? 0) >= 0 ? "text-green-400" : "text-destructive"}`}>
                        {formatPnL(t.total_pnl)}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-white/20 hover:text-white/60 shrink-0"
                        onClick={(e) => { e.stopPropagation(); goToProfile(t); }}
                      >
                        <UserCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>

        {!isLoading && sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
              <Trophy className="h-7 w-7 text-white/20" />
            </div>
            <p className="text-sm font-bold text-white/50 mb-1">No traders on the board yet</p>
            <p className="text-xs text-white/25 text-center">Start trading to claim your rank</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Leaderboard;
