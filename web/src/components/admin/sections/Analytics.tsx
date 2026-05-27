/* ══════════════════════════════════════════════════════════════
   Admin · Analytics Dashboard
   Features: user growth, engagement metrics, credit economics,
   content stats, active users, retention proxy, export
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format, subDays, subHours, eachDayOfInterval, startOfDay } from "date-fns";
import {
  BarChart3, Loader2, RefreshCw, Download, Users, TrendingUp,
  Coins, MessageSquare, Activity, Globe2, Zap, Target,
  ArrowUpRight, ArrowDownRight, Clock,
} from "lucide-react";

export const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [communities, setCommunities] = useState<any[]>([]);
  const [lobbies, setLobbies] = useState<any[]>([]);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);

  const fetch = async () => {
    setLoading(true);
    const since = subDays(new Date(), parseInt(range)).toISOString();
    const [pR, postsR, txR, actR, comR, lobR, spR, subR] = await Promise.all([
      supabase.from("profiles").select("user_id, created_at").order("created_at", { ascending: true }),
      supabase.from("community_posts").select("id, created_at").gte("created_at", since),
      supabase.from("credit_transactions").select("id, cost, created_at").gte("created_at", since),
      supabase.from("user_activity").select("id, user_id, created_at").gte("created_at", since),
      supabase.from("communities").select("id, created_at, member_count"),
      supabase.from("trading_lobbies").select("id, created_at, is_active"),
      supabase.from("spaces").select("id, created_at, status"),
      supabase.from("pump_v5_submissions").select("id, status, created_at").gte("created_at", since),
    ]);
    setProfiles(pR.data || []);
    setPosts(postsR.data || []);
    setTransactions(txR.data || []);
    setActivities(actR.data || []);
    setCommunities(comR.data || []);
    setLobbies(lobR.data || []);
    setSpaces(spR.data || []);
    setSubmissions(subR.data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [range]);

  // Compute analytics
  const days = parseInt(range);
  const now = new Date();
  const since = subDays(now, days);
  const dayInterval = eachDayOfInterval({ start: since, end: now });

  const newUsers = profiles.filter((p) => new Date(p.created_at) >= since).length;
  const prevPeriodStart = subDays(since, days);
  const prevNewUsers = profiles.filter((p) => { const d = new Date(p.created_at); return d >= prevPeriodStart && d < since; }).length;
  const userGrowth = prevNewUsers > 0 ? Math.round(((newUsers - prevNewUsers) / prevNewUsers) * 100) : 100;

  const totalCreditsUsed = transactions.reduce((s, t) => s + (t.cost || 0), 0);
  const uniqueActiveUsers = new Set(activities.map((a) => a.user_id)).size;
  const dau24h = new Set(activities.filter((a) => new Date(a.created_at) >= subHours(now, 24)).map((a) => a.user_id)).size;
  const totalMembers = communities.reduce((s, c) => s + (c.member_count || 0), 0);

  // Daily user signups
  const dailySignups = useMemo(() => {
    const map = new Map<string, number>();
    dayInterval.forEach((d) => map.set(format(d, "yyyy-MM-dd"), 0));
    profiles.forEach((p) => {
      const d = format(startOfDay(new Date(p.created_at)), "yyyy-MM-dd");
      if (map.has(d)) map.set(d, (map.get(d) || 0) + 1);
    });
    return [...map.entries()].map(([date, count]) => ({ date, count }));
  }, [profiles, dayInterval]);

  // Daily posts
  const dailyPosts = useMemo(() => {
    const map = new Map<string, number>();
    dayInterval.forEach((d) => map.set(format(d, "yyyy-MM-dd"), 0));
    posts.forEach((p) => {
      const d = format(startOfDay(new Date(p.created_at)), "yyyy-MM-dd");
      if (map.has(d)) map.set(d, (map.get(d) || 0) + 1);
    });
    return [...map.entries()].map(([date, count]) => ({ date, count }));
  }, [posts, dayInterval]);

  const exportAnalytics = () => {
    const rows = ["metric,value"];
    rows.push(`total_users,${profiles.length}`);
    rows.push(`new_users_${days}d,${newUsers}`);
    rows.push(`user_growth_%,${userGrowth}`);
    rows.push(`dau_24h,${dau24h}`);
    rows.push(`active_users_${days}d,${uniqueActiveUsers}`);
    rows.push(`credits_used_${days}d,${totalCreditsUsed}`);
    rows.push(`posts_${days}d,${posts.length}`);
    rows.push(`communities,${communities.length}`);
    rows.push(`total_community_members,${totalMembers}`);
    rows.push(`lobbies_active,${lobbies.filter((l) => l.is_active).length}`);
    rows.push(`spaces_total,${spaces.length}`);
    rows.push(`submissions_${days}d,${submissions.length}`);
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "analytics_export.csv"; a.click();
    toast.success("Exported");
  };

  const BarViz = ({ data, color, label }: { data: { date: string; count: number }[]; color: string; label: string }) => {
    const maxVal = Math.max(...data.map((d) => d.count), 1);
    return (
      <Card className="og-glass-card">
        <CardHeader className="pb-2"><CardTitle className="text-sm">{label}</CardTitle><CardDescription>{days}-day trend</CardDescription></CardHeader>
        <CardContent>
          <div className="flex items-end gap-[2px] h-[100px]">
            {data.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                <div className="absolute bottom-full mb-1 hidden group-hover:block bg-black/90 border border-white/10 rounded px-2 py-1 text-[10px] whitespace-nowrap z-10">
                  {d.date}: {d.count}
                </div>
                <div className={`w-full rounded-t ${color}`} style={{ height: `${Math.max(2, (d.count / maxVal) * 100)}%`, minHeight: "2px" }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{data.length > 0 ? data[0].date.slice(5) : ""}</span>
            <span>{data.length > 0 ? data[data.length - 1].date.slice(5) : ""}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  const MetricCard = ({ icon: Icon, label, value, sub, color, trend }: {
    icon: any; label: string; value: string | number; sub?: string; color: string; trend?: { value: number; up: boolean };
  }) => (
    <Card className="og-glass-card">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${color}`}><Icon className="h-5 w-5" /></div>
        <div className="flex-1 min-w-0">
          <p className="text-xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground/70">{sub}</p>}
        </div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${trend.up ? "text-green-400" : "text-red-400"}`}>
            {trend.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trend.value}%
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#22d3ee]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3"><BarChart3 className="h-6 w-6 text-[#22d3ee]" /> Analytics</h2>
          <p className="text-sm text-muted-foreground">Platform insights & growth metrics</p>
        </div>
        <div className="flex gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportAnalytics} variant="outline" size="sm" className="gap-2"><Download className="h-3.5 w-3.5" /> Export</Button>
          <Button onClick={fetch} variant="outline" size="sm"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Users} label="Total Users" value={profiles.length.toLocaleString()} sub={`+${newUsers} this period`} color="bg-[#22d3ee]/20 text-[#22d3ee]" trend={{ value: userGrowth, up: userGrowth >= 0 }} />
        <MetricCard icon={Activity} label="DAU (24h)" value={dau24h} sub={`${uniqueActiveUsers} in ${days}d`} color="bg-green-500/20 text-green-400" />
        <MetricCard icon={Coins} label="Credits Used" value={totalCreditsUsed.toLocaleString()} sub={`${transactions.length} transactions`} color="bg-purple-500/20 text-purple-400" />
        <MetricCard icon={MessageSquare} label={`Posts (${days}d)`} value={posts.length} color="bg-pink-500/20 text-pink-400" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard icon={Globe2} label="Communities" value={communities.length} sub={`${totalMembers} members`} color="bg-emerald-500/20 text-emerald-400" />
        <MetricCard icon={Target} label="Active Lobbies" value={lobbies.filter((l) => l.is_active).length} sub={`${lobbies.length} total`} color="bg-blue-500/20 text-blue-400" />
        <MetricCard icon={Zap} label={`Submissions (${days}d)`} value={submissions.length} sub={`${submissions.filter((s) => s.status === "pending").length} pending`} color="bg-yellow-500/20 text-yellow-400" />
        <MetricCard icon={Clock} label="Live Spaces" value={spaces.filter((s) => s.status === "live").length} sub={`${spaces.length} total`} color="bg-red-500/20 text-red-400" />
        <MetricCard icon={TrendingUp} label="Retention (proxy)" value={profiles.length > 0 ? `${Math.round((uniqueActiveUsers / profiles.length) * 100)}%` : "—"} sub="Active / Total" color="bg-orange-500/20 text-orange-400" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <BarViz data={dailySignups} color="bg-[#22d3ee]" label="Daily User Signups" />
        <BarViz data={dailyPosts} color="bg-pink-500" label="Daily Posts" />
      </div>

      {/* Submission breakdown */}
      <Card className="og-glass-card">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Submission Breakdown ({days}d)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {["pending", "approved", "live", "rejected"].map((status) => {
              const count = submissions.filter((s) => s.status === status).length;
              const pct = submissions.length > 0 ? Math.round((count / submissions.length) * 100) : 0;
              return (
                <div key={status} className="text-center">
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground capitalize">{status}</p>
                  <div className="w-full h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden">
                    <div className={`h-full rounded-full ${status === "pending" ? "bg-yellow-500" : status === "approved" || status === "live" ? "bg-green-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top active users */}
      <Card className="og-glass-card">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Most Active Users ({days}d)</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {(() => {
              const counts = new Map<string, number>();
              activities.forEach((a) => counts.set(a.user_id, (counts.get(a.user_id) || 0) + 1));
              const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
              return (
                <div className="space-y-2">
                  {sorted.map(([uid, count], i) => (
                    <div key={uid} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02]">
                      <span className={`text-xs font-bold w-6 text-center ${i < 3 ? "text-yellow-400" : "text-muted-foreground"}`}>#{i + 1}</span>
                      <code className="text-xs flex-1">{uid}</code>
                      <Badge variant="outline" className="text-xs">{count} actions</Badge>
                    </div>
                  ))}
                  {sorted.length === 0 && <p className="text-center py-4 text-muted-foreground text-sm">No activity data</p>}
                </div>
              );
            })()}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
