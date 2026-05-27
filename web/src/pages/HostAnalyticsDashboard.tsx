/**
 * HostAnalyticsDashboard — Full analytics dashboard for space hosts.
 * Shows historical performance, audience growth, engagement trends, top spaces,
 * listener retention, revenue (if token-gated), and actionable insights.
 */
import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart3, TrendingUp, Users, Clock, MessageSquare, Mic, Zap, Star,
  ChevronDown, ChevronUp, Calendar, ArrowUp, ArrowDown, Minus, Eye,
  Heart, Share2, Award, Target, Flame, Radio, Download, Filter
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface SpaceRecord {
  id: string;
  title: string;
  created_at: string;
  ended_at: string | null;
  peak_listeners: number;
  duration_seconds: number | null;
  category: string | null;
  speaker_count: number;
  is_live: boolean;
}

interface AnalyticsData {
  totalSpaces: number;
  totalListenersAllTime: number;
  totalMinutesBroadcast: number;
  avgListenersPerSpace: number;
  avgDurationMinutes: number;
  bestSpace: SpaceRecord | null;
  recentSpaces: SpaceRecord[];
  growthRate: number; // % change vs previous period
  topCategory: string | null;
  streakDays: number;
}

type Period = "7d" | "30d" | "90d" | "all";

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
const StatCard = ({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  color = "text-violet-400",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  trend?: number;
  color?: string;
}) => (
  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 hover:border-white/[0.12] transition-colors">
    <div className="flex items-start justify-between mb-3">
      <div className={cn("p-2 rounded-xl bg-white/[0.05]", color)}>
        <Icon className="h-4 w-4" />
      </div>
      {trend !== undefined && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
          trend > 0 ? "text-emerald-400 bg-emerald-400/10" :
            trend < 0 ? "text-red-400 bg-red-400/10" :
              "text-white/30 bg-white/5"
        )}>
          {trend > 0 ? <ArrowUp className="h-3 w-3" /> : trend < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <p className="text-2xl font-black text-white tracking-tight">{value}</p>
    <p className="text-xs text-white/40 font-medium mt-0.5 uppercase tracking-wide">{label}</p>
    {sub && <p className="text-xs text-white/25 mt-1">{sub}</p>}
  </div>
);

const SpaceRow = ({ space, rank }: { space: SpaceRecord; rank?: number }) => {
  const duration = space.duration_seconds ? Math.round(space.duration_seconds / 60) : null;
  const date = new Date(space.created_at).toLocaleDateString("en-AU", { month: "short", day: "numeric" });

  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/[0.04] last:border-0 group hover:bg-white/[0.02] rounded-xl px-2 -mx-2 transition-colors">
      {rank && (
        <div className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0",
          rank === 1 ? "bg-amber-500/20 text-amber-400" :
            rank === 2 ? "bg-slate-400/20 text-slate-400" :
              rank === 3 ? "bg-orange-700/20 text-orange-600" :
                "bg-white/5 text-white/30"
        )}>
          {rank}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{space.title}</p>
        <p className="text-xs text-white/30">{date} {space.category ? `· ${space.category}` : ""}</p>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <p className="text-sm font-bold text-white">{space.peak_listeners}</p>
          <p className="text-[10px] text-white/25">peak</p>
        </div>
        {duration && (
          <div className="text-right">
            <p className="text-sm font-bold text-white/60">{duration}m</p>
            <p className="text-[10px] text-white/25">duration</p>
          </div>
        )}
      </div>
    </div>
  );
};

const BarGraphSimple = ({ data, label }: { data: number[]; label: string[] }) => {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((val, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
          <div
            className="w-full rounded-t-md bg-violet-500/30 group-hover:bg-violet-500/60 transition-colors relative"
            style={{ height: `${(val / max) * 88}px`, minHeight: val > 0 ? "4px" : "0" }}
          >
            {val > 0 && (
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                {val}
              </div>
            )}
          </div>
          <span className="text-[9px] text-white/20 truncate w-full text-center">{label[i]}</span>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
const HostAnalyticsDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("30d");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const periodLabel: Record<Period, string> = {
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
    "all": "All time",
  };

  useEffect(() => {
    if (!user) return;
    loadAnalytics();
  }, [user, period]);

  const loadAnalytics = async () => {
    if (!user) return;
    setLoading(true);

    const now = new Date();
    let since: Date | null = null;
    if (period === "7d") since = new Date(now.getTime() - 7 * 86400000);
    else if (period === "30d") since = new Date(now.getTime() - 30 * 86400000);
    else if (period === "90d") since = new Date(now.getTime() - 90 * 86400000);

    let query = supabase
      .from("spaces")
      .select("id, title, created_at, ended_at, peak_listeners, duration_seconds, category, speaker_count, status")
      .eq("host_id", user.id)
      .eq("is_live", false)
      .order("created_at", { ascending: false });

    if (since) query = query.gte("created_at", since.toISOString());

    const { data: spaces } = await query;
    const list: SpaceRecord[] = (spaces || []) as SpaceRecord[];

    // Previous period for growth calc
    let prevQuery = supabase
      .from("spaces")
      .select("id, peak_listeners")
      .eq("host_id", user.id)
      .eq("is_live", false);

    if (since) {
      const prevStart = new Date(since.getTime() - (now.getTime() - since.getTime()));
      prevQuery = prevQuery.gte("created_at", prevStart.toISOString()).lt("created_at", since.toISOString());
    }
    const { data: prevSpaces } = await prevQuery;
    const prevList = prevSpaces || [];

    const totalListeners = list.reduce((s, sp) => s + (sp.peak_listeners || 0), 0);
    const totalMinutes = list.reduce((s, sp) => s + Math.round((sp.duration_seconds || 0) / 60), 0);
    const avgListeners = list.length > 0 ? Math.round(totalListeners / list.length) : 0;
    const avgDuration = list.length > 0 ? Math.round(totalMinutes / list.length) : 0;
    const bestSpace = list.length > 0 ? [...list].sort((a, b) => (b.peak_listeners || 0) - (a.peak_listeners || 0))[0] : null;

    const prevTotal = prevList.reduce((s: number, sp: any) => s + (sp.peak_listeners || 0), 0);
    const growthRate = prevTotal > 0 ? Math.round(((totalListeners - prevTotal) / prevTotal) * 100) : 0;

    const catCounts: Record<string, number> = {};
    list.forEach(sp => { if (sp.category) catCounts[sp.category] = (catCounts[sp.category] || 0) + 1; });
    const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Streak (consecutive days with at least one space)
    const daySet = new Set(list.map(sp => new Date(sp.created_at).toDateString()));
    let streak = 0;
    const d = new Date();
    while (daySet.has(d.toDateString())) {
      streak++;
      d.setDate(d.getDate() - 1);
    }

    setAnalytics({
      totalSpaces: list.length,
      totalListenersAllTime: totalListeners,
      totalMinutesBroadcast: totalMinutes,
      avgListenersPerSpace: avgListeners,
      avgDurationMinutes: avgDuration,
      bestSpace,
      recentSpaces: list,
      growthRate,
      topCategory,
      streakDays: streak,
    });
    setLoading(false);
  };

  // Build bar chart data — last 7 or 12 data points
  const chartData = useMemo(() => {
    if (!analytics) return { vals: [], labels: [] };
    const spaces = analytics.recentSpaces;
    const buckets: Record<string, number> = {};
    const fmt = (d: Date) => {
      if (period === "7d") return d.toLocaleDateString("en-AU", { weekday: "short" });
      if (period === "30d") return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
      return d.toLocaleDateString("en-AU", { month: "short" });
    };
    spaces.forEach(sp => {
      const key = fmt(new Date(sp.created_at));
      buckets[key] = (buckets[key] || 0) + (sp.peak_listeners || 0);
    });
    const entries = Object.entries(buckets).slice(0, period === "90d" ? 9 : period === "7d" ? 7 : 10);
    return { vals: entries.map(e => e[1]), labels: entries.map(e => e[0]) };
  }, [analytics, period]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <p className="text-white/40">Sign in to view analytics</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-4 py-4 sticky top-0 bg-[#0a0a0f]/95 backdrop-blur-xl z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors">
              <ChevronDown className="h-4 w-4 rotate-90 text-white/60" />
            </button>
            <div>
              <h1 className="text-lg font-black">Host Analytics</h1>
              <p className="text-xs text-white/30">Your broadcast performance</p>
            </div>
          </div>
          {/* Period selector */}
          <div className="flex items-center gap-1 bg-white/[0.05] rounded-xl p-1">
            {(["7d", "30d", "90d", "all"] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  period === p ? "bg-violet-600 text-white" : "text-white/40 hover:text-white/70"
                )}
              >
                {p === "all" ? "All" : p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 h-28 animate-pulse" />
            ))}
          </div>
        ) : !analytics || analytics.totalSpaces === 0 ? (
          <div className="text-center py-20">
            <Radio className="h-12 w-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/30 font-semibold">No spaces hosted {period !== "all" ? `in the ${periodLabel[period].toLowerCase()}` : "yet"}</p>
            <button
              onClick={() => navigate("/spaces")}
              className="mt-4 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-bold transition-colors"
            >
              Host your first Space
            </button>
          </div>
        ) : (
          <>
            {/* Stat grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Radio} label="Spaces hosted" value={analytics.totalSpaces} trend={analytics.growthRate} color="text-violet-400" />
              <StatCard icon={Users} label="Total listeners" value={analytics.totalListenersAllTime.toLocaleString()} trend={analytics.growthRate} color="text-sky-400" />
              <StatCard icon={Clock} label="Minutes broadcast" value={analytics.totalMinutesBroadcast >= 60 ? `${Math.round(analytics.totalMinutesBroadcast / 60)}h ${analytics.totalMinutesBroadcast % 60}m` : `${analytics.totalMinutesBroadcast}m`} color="text-emerald-400" />
              <StatCard icon={TrendingUp} label="Avg listeners" value={analytics.avgListenersPerSpace} sub={`per space`} color="text-amber-400" />
              <StatCard icon={Mic} label="Avg duration" value={`${analytics.avgDurationMinutes}m`} sub="per space" color="text-pink-400" />
              <StatCard icon={Star} label="Best space" value={analytics.bestSpace?.peak_listeners ?? 0} sub={analytics.bestSpace?.title ? analytics.bestSpace.title.slice(0, 20) + (analytics.bestSpace.title.length > 20 ? "…" : "") : "—"} color="text-amber-400" />
              <StatCard icon={Flame} label="Streak" value={`${analytics.streakDays}d`} sub="consecutive days" color="text-orange-400" />
              <StatCard icon={Target} label="Top category" value={analytics.topCategory ?? "Mixed"} color="text-indigo-400" />
            </div>

            {/* Bar chart */}
            {chartData.vals.length > 1 && (
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-bold text-sm text-white">Listeners over time</h2>
                    <p className="text-xs text-white/30 mt-0.5">{periodLabel[period]}</p>
                  </div>
                  <BarChart3 className="h-4 w-4 text-white/20" />
                </div>
                <BarGraphSimple data={chartData.vals} label={chartData.labels} />
              </div>
            )}

            {/* Growth callout */}
            {analytics.growthRate !== 0 && (
              <div className={cn(
                "rounded-2xl border p-4 flex items-center gap-3",
                analytics.growthRate > 0
                  ? "border-emerald-500/20 bg-emerald-500/[0.05]"
                  : "border-red-500/20 bg-red-500/[0.05]"
              )}>
                {analytics.growthRate > 0
                  ? <TrendingUp className="h-5 w-5 text-emerald-400 shrink-0" />
                  : <ArrowDown className="h-5 w-5 text-red-400 shrink-0" />}
                <div>
                  <p className="text-sm font-bold text-white">
                    {analytics.growthRate > 0 ? "📈 Growing!" : "📉 Declined"} {Math.abs(analytics.growthRate)}% vs previous period
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {analytics.growthRate > 0
                      ? "Your audience is expanding. Keep it up!"
                      : "Try spacing out your sessions or promoting before going live."}
                  </p>
                </div>
              </div>
            )}

            {/* Top spaces */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-sm text-white">Top Spaces</h2>
                  <p className="text-xs text-white/30 mt-0.5">By peak listeners</p>
                </div>
                <Award className="h-4 w-4 text-amber-400/50" />
              </div>
              {[...analytics.recentSpaces]
                .sort((a, b) => (b.peak_listeners || 0) - (a.peak_listeners || 0))
                .slice(0, showAll ? undefined : 5)
                .map((sp, i) => <SpaceRow key={sp.id} space={sp} rank={i + 1} />)}
              {analytics.recentSpaces.length > 5 && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="mt-3 w-full text-xs text-white/30 hover:text-white/60 flex items-center justify-center gap-1 transition-colors"
                >
                  {showAll ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show all {analytics.recentSpaces.length} spaces</>}
                </button>
              )}
            </div>

            {/* Recent spaces */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-sm text-white">Recent Spaces</h2>
                <Calendar className="h-4 w-4 text-white/20" />
              </div>
              {analytics.recentSpaces.slice(0, 8).map(sp => <SpaceRow key={sp.id} space={sp} />)}
            </div>

            {/* Tips */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
              <h2 className="font-bold text-sm text-white mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" /> Insights
              </h2>
              <div className="space-y-2.5">
                {analytics.avgListenersPerSpace < 10 && (
                  <p className="text-xs text-white/50">💡 Share your space link before going live to boost early listeners.</p>
                )}
                {analytics.avgDurationMinutes > 0 && analytics.avgDurationMinutes < 20 && (
                  <p className="text-xs text-white/50">⏱ Spaces over 25 minutes tend to attract more return listeners.</p>
                )}
                {analytics.topCategory && (
                  <p className="text-xs text-white/50">🏷 Your top category is <span className="text-white/70 font-semibold">{analytics.topCategory}</span> — double down on it.</p>
                )}
                {analytics.streakDays >= 3 && (
                  <p className="text-xs text-white/50">🔥 {analytics.streakDays}-day streak! Consistency builds loyal audiences.</p>
                )}
                {analytics.growthRate > 20 && (
                  <p className="text-xs text-white/50">🚀 You're growing fast — consider scheduling your next space in advance so fans can RSVP.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HostAnalyticsDashboard;
