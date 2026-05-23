import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, TrendingUp, Target, BarChart3, Crown, Medal, Award } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { safeAvatarUrl } from "@/lib/utils";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

type SortKey = "pnl" | "winrate" | "trades";

const rankIcons = [Crown, Medal, Award];
const rankColors = [
  "text-secondary",   // gold
  "text-muted-foreground",  // silver
  "text-accent",       // bronze
];

const Leaderboard = () => {
  const [sortBy, setSortBy] = useState<SortKey>("pnl");

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

  const sorted = traders
    ? [...traders].sort((a, b) => {
        if (sortBy === "pnl") return (b.total_pnl ?? 0) - (a.total_pnl ?? 0);
        if (sortBy === "winrate") return (b.win_rate ?? 0) - (a.win_rate ?? 0);
        return (b.trades_count ?? 0) - (a.trades_count ?? 0);
      })
    : [];

  const formatPnL = (v: number | null) => {
    if (!v) return "$0";
    const abs = Math.abs(v);
    const str = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(1)}M` : abs >= 1_000 ? `$${(abs / 1_000).toFixed(1)}K` : `$${abs.toFixed(0)}`;
    return v >= 0 ? `+${str}` : `-${str}`;
  };

  return (
    <AppLayout>
      <PageHeader title="Leaderboard" description="Top traders ranked by performance" />

      <div className="p-4 lg:p-6 space-y-4">
        {/* Sort tabs */}
        <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <TabsList className="bg-white/[0.04] border border-white/[0.07]">
            <TabsTrigger value="pnl" className="gap-1.5 text-xs font-mono">
              <TrendingUp className="h-3.5 w-3.5" /> PNL
            </TabsTrigger>
            <TabsTrigger value="winrate" className="gap-1.5 text-xs font-mono">
              <Target className="h-3.5 w-3.5" /> WIN RATE
            </TabsTrigger>
            <TabsTrigger value="trades" className="gap-1.5 text-xs font-mono">
              <BarChart3 className="h-3.5 w-3.5" /> VOLUME
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Top 3 podium */}
        {!isLoading && sorted.length >= 3 && (
          <div className="grid grid-cols-3 gap-3">
            {[1, 0, 2].map((idx) => {
              const t = sorted[idx];
              const RankIcon = rankIcons[idx];
              const isFirst = idx === 0;
              return (
                <Card
                  key={t.user_id}
                  className={`relative overflow-hidden border-white/[0.07] ${
                    isFirst ? "bg-gradient-to-b from-secondary/10 to-card row-span-1 -mt-2" : "bg-card"
                  }`}
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
                <Card key={t.user_id} className="bg-card border-border/40 hover:border-primary/30 transition-colors">
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
                      </p>
                    </div>
                    <p className={`font-bold font-mono text-sm ${(t.total_pnl ?? 0) >= 0 ? "text-green-400" : "text-destructive"}`}>
                      {formatPnL(t.total_pnl)}
                    </p>
                  </CardContent>
                </Card>
              ))}
        </div>

        {!isLoading && sorted.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-mono text-sm">No traders on the board yet</p>
            <p className="text-xs mt-1">Start trading to claim your rank</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Leaderboard;
