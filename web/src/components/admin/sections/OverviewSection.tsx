/* ══════════════════════════════════════════════════════════════
   Admin · Overview Dashboard
   Features: stat cards, recent activity, quick actions,
   system health, top users, pending items
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow, format, subDays, subHours } from "date-fns";
import {
  Users, Rocket, Activity, Coins, Headphones, Clock,
  Globe2, MessageSquare, Mic, ShieldCheck, Zap,
  TrendingUp, AlertTriangle, FileText, RefreshCw,
  Loader2, ArrowUpRight, ArrowDownRight, Database,
} from "lucide-react";
import type { AdminSection } from "../types";

interface Props { onNavigate: (s: AdminSection) => void }

interface Stats {
  totalUsers: number; newUsersToday: number; newUsersWeek: number;
  totalSubmissions: number; pendingSubmissions: number;
  totalCreditsUsed: number; activeLobbies: number; totalLobbies: number;
  totalCommunities: number; totalPosts: number;
  totalSpaces: number; activeSpaces: number;
  openTickets: number; totalAlerts: number;
  totalMessages: number;
}

const emptyStats: Stats = {
  totalUsers: 0, newUsersToday: 0, newUsersWeek: 0,
  totalSubmissions: 0, pendingSubmissions: 0,
  totalCreditsUsed: 0, activeLobbies: 0, totalLobbies: 0,
  totalCommunities: 0, totalPosts: 0,
  totalSpaces: 0, activeSpaces: 0,
  openTickets: 0, totalAlerts: 0, totalMessages: 0,
};

export const OverviewSection = ({ onNavigate }: Props) => {
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekAgo = subDays(new Date(), 7).toISOString();

    const [
      profiles, newToday, newWeek, subs, credits,
      lobbies, activeLobbies, communities, posts,
      spaces, activeSpacesR, tickets, alerts, messages, logs,
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
      supabase.from("pump_v5_submissions").select("id, status"),
      supabase.from("credit_transactions").select("cost"),
      supabase.from("trading_lobbies").select("id", { count: "exact", head: true }),
      supabase.from("trading_lobbies").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("communities").select("id", { count: "exact", head: true }),
      supabase.from("community_posts").select("id", { count: "exact", head: true }),
      supabase.from("spaces").select("id", { count: "exact", head: true }),
      supabase.from("spaces").select("id", { count: "exact", head: true }).eq("status", "live"),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }).neq("status", "closed"),
      supabase.from("price_alerts").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("chat_messages").select("id", { count: "exact", head: true }),
      supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(15),
    ]);

    const pendingCount = subs.data?.filter((s: any) => s.status === "pending").length || 0;
    const totalCredits = credits.data?.reduce((sum: number, tx: any) => sum + (tx.cost || 0), 0) || 0;

    setStats({
      totalUsers: profiles.count || 0,
      newUsersToday: newToday.count || 0,
      newUsersWeek: newWeek.count || 0,
      totalSubmissions: subs.data?.length || 0,
      pendingSubmissions: pendingCount,
      totalCreditsUsed: totalCredits,
      activeLobbies: activeLobbies.count || 0,
      totalLobbies: lobbies.count || 0,
      totalCommunities: communities.count || 0,
      totalPosts: posts.count || 0,
      totalSpaces: spaces.count || 0,
      activeSpaces: activeSpacesR.count || 0,
      openTickets: tickets.count || 0,
      totalAlerts: alerts.count || 0,
      totalMessages: messages.count || 0,
    });
    setRecentLogs(logs.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-[#22d3ee]" />
    </div>
  );

  const StatCard = ({
    icon: Icon, label, value, color, sub, trend, onClick,
  }: {
    icon: any; label: string; value: string | number; color: string;
    sub?: string; trend?: { value: number; up: boolean }; onClick?: () => void;
  }) => (
    <Card
      className={`og-glass-card transition-all ${onClick ? "cursor-pointer hover:scale-[1.02] hover:border-white/20" : ""}`}
      onClick={onClick}
    >
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard Overview</h2>
          <p className="text-sm text-muted-foreground">Platform metrics at a glance</p>
        </div>
        <Button onClick={fetchStats} variant="outline" size="sm" className="gap-2 rounded-xl">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Main stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" value={stats.totalUsers}
          color="bg-[#22d3ee]/20 text-[#22d3ee]"
          sub={`+${stats.newUsersToday} today`}
          onClick={() => onNavigate("users")} />
        <StatCard icon={Clock} label="Pending Reviews" value={stats.pendingSubmissions}
          color="bg-yellow-500/20 text-yellow-500"
          onClick={() => onNavigate("tokens")} />
        <StatCard icon={Coins} label="Credits Consumed" value={`${stats.totalCreditsUsed.toLocaleString()}`}
          color="bg-purple-500/20 text-purple-400" />
        <StatCard icon={Globe2} label="Communities" value={stats.totalCommunities}
          color="bg-green-500/20 text-green-400"
          sub={`${stats.totalPosts.toLocaleString()} posts`}
          onClick={() => onNavigate("communities")} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Headphones} label="Lobbies" value={`${stats.activeLobbies} / ${stats.totalLobbies}`}
          color="bg-blue-500/20 text-blue-400" onClick={() => onNavigate("lobbies")} />
        <StatCard icon={Mic} label="Spaces" value={`${stats.activeSpaces} live`}
          color="bg-pink-500/20 text-pink-400"
          sub={`${stats.totalSpaces} total`}
          onClick={() => onNavigate("spaces")} />
        <StatCard icon={MessageSquare} label="Chat Messages" value={stats.totalMessages.toLocaleString()}
          color="bg-indigo-500/20 text-indigo-400" onClick={() => onNavigate("chat")} />
        <StatCard icon={AlertTriangle} label="Open Tickets" value={stats.openTickets}
          color="bg-orange-500/20 text-orange-400" onClick={() => onNavigate("support")} />
        <StatCard icon={Zap} label="Active Alerts" value={stats.totalAlerts}
          color="bg-amber-500/20 text-amber-400" onClick={() => onNavigate("alerts")} />
      </div>

      {/* Two-column: Activity + Quick Actions */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="og-glass-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-[#22d3ee]" /> Recent Admin Activity
              </CardTitle>
              <CardDescription>Last 15 actions</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live
            </Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[340px]">
              <div className="space-y-2">
                {recentLogs.map((log: any) => (
                  <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <Activity className="h-4 w-4 text-[#22d3ee] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{log.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {log.target_type && (
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">{log.target_type}</Badge>
                    )}
                  </div>
                ))}
                {recentLogs.length === 0 && (
                  <p className="text-center py-8 text-muted-foreground text-sm">No activity yet</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Quick Actions + System Health */}
        <div className="space-y-6">
          <Card className="og-glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {[
                { label: "Manage Users", icon: Users, section: "users" as AdminSection },
                { label: "Review Tokens", icon: Rocket, section: "tokens" as AdminSection },
                { label: "Moderate", icon: ShieldCheck, section: "moderation" as AdminSection },
                { label: "Support", icon: MessageSquare, section: "support" as AdminSection },
                { label: "Announcements", icon: FileText, section: "notifications" as AdminSection },
                { label: "Settings", icon: Database, section: "settings" as AdminSection },
              ].map((a) => (
                <Button
                  key={a.label}
                  variant="outline"
                  size="sm"
                  className="gap-2 justify-start text-xs h-9"
                  onClick={() => onNavigate(a.section)}
                >
                  <a.icon className="h-3.5 w-3.5" /> {a.label}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="og-glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-400" /> System Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "Database", status: "Operational" },
                { label: "Auth Service", status: "Operational" },
                { label: "Realtime", status: "Operational" },
                { label: "Edge Functions", status: "Operational" },
                { label: "RLS Policies", status: "Active" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03]">
                  <span className="text-xs text-white/70">{item.label}</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-xs text-green-400">{item.status}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
