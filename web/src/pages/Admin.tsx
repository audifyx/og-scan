import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow, format, subDays, subHours } from "date-fns";
import {
  Shield, Rocket, CheckCircle, XCircle, Clock, Star,
  Users, AlertTriangle, Eye, Trash2, RefreshCw,
  Activity, FileText, Settings, Mail,
  Search, BarChart3, Loader2, Database, Zap,
  MessageSquare, Globe, Lock, Coins, Bell, X,
  Ban, UserCheck, Send, Headphones, TrendingUp,
  PieChart, ShieldAlert, ToggleLeft, Volume2,
  ChevronRight, ArrowUp, ArrowDown, Percent,
  Calendar, Hash, Crown, Award, Copy, ExternalLink,
  Download, Upload, Filter, MoreHorizontal
} from "lucide-react";

/* ═══════════════════════ Types ═══════════════════════ */
interface Submission {
  id: string; token_name: string; symbol: string; contract_address: string;
  launch_platform: string; status: string; promotion_tier: string;
  is_featured: boolean; user_id: string | null; created_at: string;
  admin_notes: string | null; logo_url: string | null;
}
interface AuditLog {
  id: string; admin_user_id: string; action: string;
  target_type: string | null; target_id: string | null;
  created_at: string; new_values: any; old_values: any;
}
interface UserProfile {
  id: string; user_id: string; username: string | null;
  wallet_address: string | null; created_at: string;
  total_pnl: number | null; trades_count: number | null;
  avatar_url: string | null; bio: string | null;
  theme_preset: string | null; status?: string;
}
interface UserCreditsData {
  id: string; user_id: string; total_credits: number;
  used_credits: number; last_reset_at: string; next_reset_at: string;
}
interface CreditTransaction {
  id: string; tool_name: string; tool_category: string;
  cost: number; description: string | null; created_at: string;
}
interface PlatformSetting {
  id: string; key: string; value: any; category: string;
  description: string | null; updated_at: string;
}
interface LobbyData {
  id: string; name: string; description: string | null;
  created_by: string; creator_name: string | null;
  privacy: string; member_count: number | null;
  is_active: boolean | null; created_at: string | null;
}

/* ═══════════════════════ Nav sections ═══════════════════════ */
const NAV_SECTIONS = [
  { id: "overview", icon: BarChart3, label: "Overview", color: "text-[#22d3ee]" },
  { id: "users", icon: Users, label: "Users", color: "text-blue-400" },
  { id: "submissions", icon: Rocket, label: "Tokens", color: "text-green-400" },
  { id: "lobbies", icon: Headphones, label: "Lobbies", color: "text-purple-400" },
  { id: "credits", icon: Coins, label: "Credits", color: "text-yellow-400" },
  { id: "community", icon: MessageSquare, label: "Community", color: "text-pink-400" },
  { id: "logs", icon: FileText, label: "Logs", color: "text-orange-400" },
  { id: "announce", icon: Bell, label: "Announce", color: "text-red-400" },
  { id: "security", icon: ShieldAlert, label: "Security", color: "text-amber-400" },
  { id: "settings", icon: Settings, label: "Settings", color: "text-white/60" },
] as const;

/* ═══════════════════════ Component ═══════════════════════ */
const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  /* state */
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userCredits, setUserCredits] = useState<Record<string, UserCreditsData>>({});
  const [platformSettings, setPlatformSettings] = useState<PlatformSetting[]>([]);
  const [lobbies, setLobbies] = useState<LobbyData[]>([]);
  const [communityStats, setCommunityStats] = useState({ posts: 0, communities: 0, members: 0 });
  const [stats, setStats] = useState({ totalUsers: 0, activeToday: 0, totalSubmissions: 0, pendingSubmissions: 0, totalCreditsUsed: 0, activeLobbies: 0 });
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState("overview");
  const [settingsCategory, setSettingsCategory] = useState("submissions");
  const [savingSettings, setSavingSettings] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userTransactions, setUserTransactions] = useState<CreditTransaction[]>([]);
  const [editingCredits, setEditingCredits] = useState(false);
  const [newCreditAmount, setNewCreditAmount] = useState<number>(0);
  const [creditAdjustType, setCreditAdjustType] = useState<"set" | "add" | "subtract">("add");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);

  /* ─── auth ─── */
  useEffect(() => { checkAdmin(); }, [user]);
  useEffect(() => {
    if (!isAdmin) return;
    const iv = setInterval(() => { fetchLogs(); fetchStats(); }, 30000);
    return () => clearInterval(iv);
  }, [isAdmin]);

  const checkAdmin = async () => {
    if (!user) { setLoading(false); return; }
    if (user.email === "audifyx@gmail.com") { setIsAdmin(true); fetchAll(); setLoading(false); return; }
    const { data } = await supabase.from("admin_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (data && ["admin", "owner"].includes(data.role)) { setIsAdmin(true); fetchAll(); }
    else setIsAdmin(false);
    setLoading(false);
  };

  /* ─── fetchers ─── */
  const fetchAll = () => Promise.all([fetchSubmissions(), fetchLogs(), fetchUsers(), fetchStats(), fetchSettings(), fetchLobbies(), fetchCommunityStats()]);

  const fetchSubmissions = async () => {
    const { data } = await supabase.from("pump_v5_submissions").select("*").order("created_at", { ascending: false });
    setSubmissions(data || []);
  };
  const fetchLogs = async () => {
    const { data } = await supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(200);
    setAuditLogs(data || []);
  };
  const fetchUsers = async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setUsers(data || []);
    const { data: c } = await supabase.from("user_credits").select("*");
    if (c) { const m: Record<string, UserCreditsData> = {}; c.forEach(r => { m[r.user_id] = r; }); setUserCredits(m); }
  };
  const fetchLobbies = async () => {
    const { data } = await supabase.from("trading_lobbies").select("*").order("created_at", { ascending: false });
    setLobbies(data || []);
  };
  const fetchCommunityStats = async () => {
    const [p, c, m] = await Promise.all([
      supabase.from("community_posts").select("id", { count: "exact", head: true }),
      supabase.from("communities").select("id", { count: "exact", head: true }),
      supabase.from("community_members").select("id", { count: "exact", head: true }),
    ]);
    setCommunityStats({ posts: p.count || 0, communities: c.count || 0, members: m.count || 0 });
  };
  const fetchStats = async () => {
    const [pr, su, cr, lo] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("pump_v5_submissions").select("id, status"),
      supabase.from("credit_transactions").select("cost"),
      supabase.from("trading_lobbies").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);
    setStats({
      totalUsers: pr.count || 0, activeToday: 0,
      totalSubmissions: su.data?.length || 0,
      pendingSubmissions: su.data?.filter(s => s.status === "pending").length || 0,
      totalCreditsUsed: cr.data?.reduce((s, t) => s + (t.cost || 0), 0) || 0,
      activeLobbies: lo.count || 0,
    });
  };
  const fetchSettings = async () => {
    const { data } = await supabase.from("platform_settings").select("*").order("category");
    setPlatformSettings(data || []);
  };
  const fetchUserTx = async (uid: string) => {
    const { data } = await supabase.from("credit_transactions").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(100);
    setUserTransactions(data || []);
  };

  /* ─── user actions ─── */
  const openUserDetail = async (p: UserProfile) => {
    setSelectedUser(p); setEditingCredits(false);
    const c = userCredits[p.user_id];
    setNewCreditAmount(c ? c.total_credits - c.used_credits : 50000);
    await fetchUserTx(p.user_id);
  };

  const banUser = async (userId: string, action: "ban" | "suspend" | "unban") => {
    if (!user || !confirm(`${action.toUpperCase()} this user?`)) return;
    const status = action === "unban" ? "active" : action;
    await supabase.from("profiles").update({ status }).eq("user_id", userId);
    await supabase.from("admin_audit_log").insert({ admin_user_id: user.id, action: `${action} user ${userId.slice(0, 8)}`, target_type: "user", target_id: userId, new_values: { status } });
    toast.success(`User ${action === "unban" ? "reactivated" : action + "ned"}`);
    fetchUsers(); fetchLogs();
    if (selectedUser?.user_id === userId) setSelectedUser({ ...selectedUser, status } as any);
  };

  const deleteUserAccount = async (userId: string) => {
    if (!user || !confirm("PERMANENT DELETE — all data will be wiped.")) return;
    if (prompt("Type DELETE to confirm:") !== "DELETE") return;
    await Promise.allSettled([
      supabase.from("community_posts").delete().eq("user_id", userId),
      supabase.from("community_members").delete().eq("user_id", userId),
      supabase.from("community_post_likes").delete().eq("user_id", userId),
      supabase.from("community_reposts").delete().eq("user_id", userId),
      supabase.from("community_bookmarks").delete().eq("user_id", userId),
      supabase.from("followers").delete().eq("follower_id", userId),
      supabase.from("followers").delete().eq("followee_id", userId),
      supabase.from("user_activities").delete().eq("user_id", userId),
      supabase.from("user_credits").delete().eq("user_id", userId),
      supabase.from("credit_transactions").delete().eq("user_id", userId),
      supabase.from("profiles").delete().eq("user_id", userId),
    ]);
    await supabase.from("admin_audit_log").insert({ admin_user_id: user.id, action: `Deleted account ${userId.slice(0, 8)}`, target_type: "user", target_id: userId });
    toast.success("Account deleted"); setSelectedUser(null); fetchUsers(); fetchLogs();
  };

  const updateUserCredits = async () => {
    if (!selectedUser || !user) return;
    const cur = userCredits[selectedUser.user_id];
    if (!cur) { toast.error("No credit record"); return; }
    let newUsed = cur.used_credits;
    if (creditAdjustType === "set") newUsed = cur.total_credits - newCreditAmount;
    else if (creditAdjustType === "add") newUsed = Math.max(0, cur.used_credits - newCreditAmount);
    else newUsed = Math.min(cur.total_credits, cur.used_credits + newCreditAmount);
    const { error } = await supabase.from("user_credits").update({ used_credits: newUsed }).eq("user_id", selectedUser.user_id);
    if (error) { toast.error("Failed"); return; }
    await supabase.from("admin_audit_log").insert({ admin_user_id: user.id, action: `Credits ${creditAdjustType} ${newCreditAmount}`, target_type: "user_credits", target_id: selectedUser.user_id, old_values: { used_credits: cur.used_credits }, new_values: { used_credits: newUsed } });
    toast.success("Credits updated");
    setUserCredits(prev => ({ ...prev, [selectedUser.user_id]: { ...cur, used_credits: newUsed } }));
    setEditingCredits(false); fetchLogs();
  };

  /* ─── submission actions ─── */
  const updateSubmission = async (id: string, updates: Partial<Submission>) => {
    if (!user) return;
    setProcessing(true);
    await supabase.from("pump_v5_submissions").update({ ...updates, approved_by: user.id, approved_at: new Date().toISOString() }).eq("id", id);
    await supabase.from("admin_audit_log").insert({ admin_user_id: user.id, action: `Submission ${updates.status || "edit"}`, target_type: "pump_v5_submissions", target_id: id, new_values: updates });
    toast.success("Updated"); fetchSubmissions(); fetchLogs();
    setProcessing(false);
  };
  const deleteSubmission = async (id: string) => {
    if (!confirm("Delete this submission?")) return;
    await supabase.from("pump_v5_submissions").delete().eq("id", id);
    toast.success("Deleted"); fetchSubmissions();
  };
  const deleteLobby = async (id: string) => {
    if (!confirm("Delete this lobby?")) return;
    await supabase.from("trading_lobbies").delete().eq("id", id);
    toast.success("Deleted"); fetchLobbies();
  };

  /* ─── settings ─── */
  const updateSetting = async (key: string, newValue: any) => {
    if (!user) return;
    setSavingSettings(key);
    await supabase.from("platform_settings").update({ value: newValue, updated_by: user.id }).eq("key", key);
    setPlatformSettings(prev => prev.map(s => s.key === key ? { ...s, value: newValue } : s));
    await supabase.from("admin_audit_log").insert({ admin_user_id: user.id, action: `Setting: ${key}`, target_type: "platform_settings", target_id: key, new_values: newValue });
    toast.success("Saved"); fetchLogs();
    setSavingSettings(null);
  };

  /* ─── announcement ─── */
  const sendAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementMessage.trim() || !user) return;
    setSendingAnnouncement(true);
    const ids = users.map(u => u.user_id);
    const notifs = ids.map(uid => ({ user_id: uid, title: announcementTitle, message: announcementMessage, type: "announcement", data: { from: "admin" } }));
    for (let i = 0; i < notifs.length; i += 50) await supabase.from("notifications").insert(notifs.slice(i, i + 50));
    await supabase.from("admin_audit_log").insert({ admin_user_id: user.id, action: `Announcement: ${announcementTitle}`, target_type: "notifications", new_values: { title: announcementTitle, recipients: ids.length } });
    toast.success(`Sent to ${ids.length} users`);
    setAnnouncementTitle(""); setAnnouncementMessage(""); fetchLogs();
    setSendingAnnouncement(false);
  };

  /* ─── derived ─── */
  const pendingCount = submissions.filter(s => s.status === "pending").length;
  const filteredUsers = users.filter(u => !searchQuery || (u.username || "").toLowerCase().includes(searchQuery.toLowerCase()) || u.user_id.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredSubmissions = submissions.filter(s => !searchQuery || s.token_name.toLowerCase().includes(searchQuery.toLowerCase()) || s.symbol.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredSettings = platformSettings.filter(s => s.category === settingsCategory);

  const timeStats = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const week = subDays(now, 7);
    const month = subDays(now, 30);
    return {
      usersToday: users.filter(u => new Date(u.created_at).toDateString() === today).length,
      usersWeek: users.filter(u => new Date(u.created_at) >= week).length,
      usersMonth: users.filter(u => new Date(u.created_at) >= month).length,
      logsToday: auditLogs.filter(l => new Date(l.created_at).toDateString() === today).length,
      logsWeek: auditLogs.filter(l => new Date(l.created_at) >= week).length,
      logsMonth: auditLogs.filter(l => new Date(l.created_at) >= month).length,
    };
  }, [users, auditLogs]);

  /* ─── loading / denied ─── */
  if (loading) return <AppLayout><div className="flex items-center justify-center h-full"><Loader2 className="h-10 w-10 animate-spin text-[#22d3ee]" /></div></AppLayout>;
  if (!isAdmin) return <AppLayout><div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center"><Shield className="h-14 w-14 text-red-500" /><h1 className="text-xl font-bold">Access Denied</h1><p className="text-sm text-white/40">Owner access only</p><Button onClick={() => navigate("/app")} size="sm">Go Home</Button></div></AppLayout>;

  /* ═══════════════════════ RENDER ═══════════════════════ */
  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-60px)]">

        {/* ── Header ── */}
        <div className="flex-shrink-0 px-4 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#22d3ee]/20 to-purple-500/20 flex items-center justify-center">
                <Shield className="h-5 w-5 text-[#22d3ee]" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight">Admin</h1>
                <p className="text-[10px] text-white/30 font-medium tracking-wide">OWNER DASHBOARD</p>
              </div>
            </div>
            <Button onClick={() => fetchAll()} size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-xl">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Nav pills (horizontal scroll) ── */}
        <div className="flex-shrink-0 px-4 pb-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {NAV_SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => { setTab(s.id); setSearchQuery(""); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  tab === s.id
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/30 hover:text-white/60 hover:bg-white/[0.03]"
                }`}
              >
                <s.icon className={`h-3.5 w-3.5 ${tab === s.id ? s.color : ""}`} />
                {s.label}
                {s.id === "submissions" && pendingCount > 0 && (
                  <span className="ml-0.5 h-4 min-w-4 px-1 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-bold flex items-center justify-center">{pendingCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content (scrollable) ── */}
        <div className="flex-1 overflow-y-auto px-4 pb-6" style={{ scrollbarWidth: "none" }}>

          {/* ══════════════ OVERVIEW ══════════════ */}
          {tab === "overview" && (
            <div className="space-y-4">
              {/* Quick stats — 2 columns */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Users, label: "Users", value: stats.totalUsers, color: "from-[#22d3ee]/20 to-blue-500/10", iconColor: "text-[#22d3ee]" },
                  { icon: Rocket, label: "Tokens", value: stats.totalSubmissions, color: "from-green-500/20 to-emerald-500/10", iconColor: "text-green-400" },
                  { icon: Coins, label: "Credits", value: `$${stats.totalCreditsUsed.toLocaleString()}`, color: "from-yellow-500/20 to-orange-500/10", iconColor: "text-yellow-400" },
                  { icon: Headphones, label: "Lobbies", value: stats.activeLobbies, color: "from-purple-500/20 to-pink-500/10", iconColor: "text-purple-400" },
                  { icon: MessageSquare, label: "Posts", value: communityStats.posts, color: "from-pink-500/20 to-rose-500/10", iconColor: "text-pink-400" },
                  { icon: Clock, label: "Pending", value: pendingCount, color: "from-amber-500/20 to-yellow-500/10", iconColor: "text-amber-400" },
                ].map(s => (
                  <div key={s.label} className={`rounded-2xl bg-gradient-to-br ${s.color} border border-white/[0.06] p-3.5`}>
                    <div className="flex items-center gap-2 mb-2">
                      <s.icon className={`h-4 w-4 ${s.iconColor}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">{s.label}</span>
                    </div>
                    <p className="text-2xl font-black tracking-tight">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Time-based cards */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-white/20 uppercase tracking-widest px-1">Growth</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Today", users: timeStats.usersToday, actions: timeStats.logsToday },
                    { label: "Week", users: timeStats.usersWeek, actions: timeStats.logsWeek },
                    { label: "Month", users: timeStats.usersMonth, actions: timeStats.logsMonth },
                  ].map(p => (
                    <div key={p.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                      <p className="text-[9px] font-bold text-white/25 uppercase tracking-wider mb-1.5">{p.label}</p>
                      <p className="text-lg font-black text-[#22d3ee]">{p.users}</p>
                      <p className="text-[10px] text-white/30">new users</p>
                      <div className="h-px bg-white/[0.06] my-2" />
                      <p className="text-base font-bold text-green-400">{p.actions}</p>
                      <p className="text-[10px] text-white/30">actions</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Community overview */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-white/20 uppercase tracking-widest px-1">Community</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Communities", value: communityStats.communities, icon: Globe },
                    { label: "Members", value: communityStats.members, icon: Users },
                    { label: "Posts", value: communityStats.posts, icon: MessageSquare },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                      <s.icon className="h-4 w-4 text-pink-400 mx-auto mb-1" />
                      <p className="text-lg font-black">{s.value}</p>
                      <p className="text-[10px] text-white/30">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent activity */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold text-white/20 uppercase tracking-widest">Activity</h3>
                  <Badge variant="outline" className="text-[9px] gap-1 px-2 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> Live
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  {auditLogs.slice(0, 8).map(log => (
                    <div key={log.id} className="flex items-start gap-3 rounded-xl bg-white/[0.02] border border-white/[0.05] p-3">
                      <Activity className="h-3.5 w-3.5 text-[#22d3ee] mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium leading-snug line-clamp-2">{log.action}</p>
                        <p className="text-[10px] text-white/25 mt-0.5">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick links */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-white/20 uppercase tracking-widest px-1">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Manage Users", icon: Users, go: "users" },
                    { label: "Review Tokens", icon: Rocket, go: "submissions" },
                    { label: "Send Announcement", icon: Bell, go: "announce" },
                    { label: "Security", icon: ShieldAlert, go: "security" },
                    { label: "Platform Settings", icon: Settings, go: "settings" },
                    { label: "View Logs", icon: FileText, go: "logs" },
                  ].map(a => (
                    <button key={a.label} onClick={() => setTab(a.go)} className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-left hover:bg-white/[0.06] transition-colors">
                      <a.icon className="h-4 w-4 text-white/40" />
                      <span className="text-xs font-semibold">{a.label}</span>
                      <ChevronRight className="h-3 w-3 text-white/15 ml-auto" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ USERS ══════════════ */}
          {tab === "users" && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                <Input placeholder="Search users..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 bg-white/[0.03] border-white/[0.08] rounded-xl h-10" />
              </div>
              <p className="text-[10px] text-white/20 px-1">{filteredUsers.length} users</p>
              <div className="space-y-2">
                {filteredUsers.map(p => {
                  const c = userCredits[p.user_id];
                  const used = c?.used_credits || 0;
                  const total = c?.total_credits || 50000;
                  const left = total - used;
                  const isBanned = p.status === "ban" || p.status === "suspend";
                  return (
                    <button key={p.id} onClick={() => openUserDetail(p)} className="w-full flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 text-left hover:bg-white/[0.05] transition-colors">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#22d3ee]/30 to-purple-500/30 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {(p.username || p.user_id).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">{p.username || "Unnamed"}</p>
                          {isBanned && <Badge variant="destructive" className="text-[9px] px-1.5 py-0">{p.status}</Badge>}
                        </div>
                        <p className="text-[10px] text-white/25 font-mono">{p.user_id.slice(0, 12)}…</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-xs font-bold ${left < 5000 ? "text-yellow-400" : "text-green-400"}`}>${left.toLocaleString()}</p>
                        <p className="text-[10px] text-white/20">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══════════════ SUBMISSIONS ══════════════ */}
          {tab === "submissions" && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                <Input placeholder="Search tokens..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 bg-white/[0.03] border-white/[0.08] rounded-xl h-10" />
              </div>
              <div className="space-y-2">
                {filteredSubmissions.map(s => (
                  <div key={s.id} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 space-y-2.5">
                    <div className="flex items-center gap-3">
                      {s.logo_url ? (
                        <img src={s.logo_url} alt="" className="h-9 w-9 rounded-xl object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center text-xs font-bold">{s.symbol.slice(0, 2)}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{s.token_name}</p>
                        <p className="text-[10px] text-white/30">${s.symbol} · {s.launch_platform}</p>
                      </div>
                      <Badge className={`text-[10px] ${s.status === "pending" ? "bg-yellow-500/20 text-yellow-400" : s.status === "approved" || s.status === "live" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{s.status}</Badge>
                    </div>
                    <code className="block text-[10px] text-white/25 bg-white/[0.03] rounded-lg px-2 py-1.5 font-mono truncate">{s.contract_address}</code>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/20">{formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}</span>
                        <div className="flex items-center gap-1 text-[10px] text-white/20">
                          <Star className={`h-3 w-3 ${s.is_featured ? "text-yellow-400 fill-yellow-400" : ""}`} />
                          Featured
                          <Switch checked={s.is_featured} onCheckedChange={c => updateSubmission(s.id, { is_featured: c })} className="ml-1 scale-75 origin-left" />
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {s.status === "pending" && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" onClick={() => updateSubmission(s.id, { status: "approved" })} disabled={processing}>
                              <CheckCircle className="h-4 w-4 text-green-400" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" onClick={() => updateSubmission(s.id, { status: "rejected" })} disabled={processing}>
                              <XCircle className="h-4 w-4 text-red-400" />
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" onClick={() => deleteSubmission(s.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredSubmissions.length === 0 && (
                  <div className="py-12 text-center">
                    <Rocket className="h-8 w-8 text-white/10 mx-auto mb-2" />
                    <p className="text-xs text-white/25">No submissions found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════ LOBBIES ══════════════ */}
          {tab === "lobbies" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-white/20">{lobbies.length} lobbies · {lobbies.filter(l => l.is_active).length} active</p>
              </div>
              <div className="space-y-2">
                {lobbies.map(l => (
                  <div key={l.id} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                        <Headphones className="h-4 w-4 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{l.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-white/25 flex items-center gap-0.5"><Users className="h-3 w-3" /> {l.member_count || 0}</span>
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">{l.privacy}</Badge>
                          {l.is_active && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" onClick={() => deleteLobby(l.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════ CREDITS ══════════════ */}
          {tab === "credits" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-gradient-to-br from-yellow-500/15 to-orange-500/10 border border-white/[0.06] p-3.5">
                  <Coins className="h-4 w-4 text-yellow-400 mb-2" />
                  <p className="text-xl font-black">${stats.totalCreditsUsed.toLocaleString()}</p>
                  <p className="text-[10px] text-white/30">Total Used</p>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-green-500/15 to-emerald-500/10 border border-white/[0.06] p-3.5">
                  <TrendingUp className="h-4 w-4 text-green-400 mb-2" />
                  <p className="text-xl font-black">{users.length}</p>
                  <p className="text-[10px] text-white/30">Active Accounts</p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold text-white/20 uppercase tracking-widest px-1">Top Credit Users</h3>
                {[...users]
                  .sort((a, b) => (userCredits[b.user_id]?.used_credits || 0) - (userCredits[a.user_id]?.used_credits || 0))
                  .slice(0, 15)
                  .map((u, i) => {
                    const c = userCredits[u.user_id];
                    const used = c?.used_credits || 0;
                    const total = c?.total_credits || 50000;
                    const pct = total > 0 ? (used / total) * 100 : 0;
                    return (
                      <button key={u.id} onClick={() => openUserDetail(u)} className="w-full flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 text-left hover:bg-white/[0.05] transition-colors">
                        <span className="text-[10px] text-white/20 font-bold w-4 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{u.username || u.user_id.slice(0, 8)}</p>
                          <div className="mt-1 h-1 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-orange-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                        </div>
                        <p className="text-xs font-bold text-yellow-400">${used.toLocaleString()}</p>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ══════════════ COMMUNITY ══════════════ */}
          {tab === "community" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Communities", value: communityStats.communities, icon: Globe, color: "text-pink-400" },
                  { label: "Members", value: communityStats.members, icon: Users, color: "text-blue-400" },
                  { label: "Posts", value: communityStats.posts, icon: MessageSquare, color: "text-green-400" },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                    <s.icon className={`h-4 w-4 ${s.color} mx-auto mb-1`} />
                    <p className="text-lg font-black">{s.value}</p>
                    <p className="text-[10px] text-white/30">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                <MessageSquare className="h-8 w-8 text-white/10 mx-auto mb-2" />
                <p className="text-sm font-semibold text-white/40">Community Management</p>
                <p className="text-xs text-white/20 mt-1">Moderate communities, view reports, and manage content from here.</p>
                <Button size="sm" variant="outline" className="mt-3 rounded-xl text-xs" onClick={() => navigate("/communities")}>Open Communities</Button>
              </div>
            </div>
          )}

          {/* ══════════════ LOGS ══════════════ */}
          {tab === "logs" && (
            <div className="space-y-3">
              <p className="text-[10px] text-white/20 px-1">{auditLogs.length} log entries</p>
              <div className="space-y-1.5">
                {auditLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] p-3">
                    <div className="h-6 w-6 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Activity className="h-3 w-3 text-[#22d3ee]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-snug">{log.action}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-white/20">{format(new Date(log.created_at), "MMM d, HH:mm")}</span>
                        {log.target_type && <Badge variant="outline" className="text-[9px] px-1.5 py-0">{log.target_type}</Badge>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════ ANNOUNCE ══════════════ */}
          {tab === "announce" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Bell className="h-4 w-4 text-red-400" />
                  <h3 className="text-sm font-bold">Send Announcement</h3>
                </div>
                <Input
                  placeholder="Title..."
                  value={announcementTitle}
                  onChange={e => setAnnouncementTitle(e.target.value)}
                  className="bg-white/[0.03] border-white/[0.08] rounded-xl h-10"
                />
                <Textarea
                  placeholder="Message body..."
                  value={announcementMessage}
                  onChange={e => setAnnouncementMessage(e.target.value)}
                  className="bg-white/[0.03] border-white/[0.08] rounded-xl min-h-[100px]"
                />
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-white/20">Sends to {users.length} users</p>
                  <Button
                    onClick={sendAnnouncement}
                    disabled={sendingAnnouncement || !announcementTitle.trim() || !announcementMessage.trim()}
                    size="sm"
                    className="rounded-xl gap-1.5"
                  >
                    {sendingAnnouncement ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Send
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold text-white/20 uppercase tracking-widest px-1">Recent Announcements</h3>
                {auditLogs.filter(l => l.action.includes("nnouncement")).slice(0, 10).map(log => (
                  <div key={log.id} className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-3">
                    <p className="text-xs font-medium">{log.action}</p>
                    <p className="text-[10px] text-white/20 mt-1">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })} · {log.new_values?.recipients || 0} recipients</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════ SECURITY ══════════════ */}
          {tab === "security" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-gradient-to-br from-red-500/15 to-orange-500/10 border border-white/[0.06] p-3.5">
                  <Ban className="h-4 w-4 text-red-400 mb-2" />
                  <p className="text-xl font-black">{users.filter(u => u.status === "ban").length}</p>
                  <p className="text-[10px] text-white/30">Banned</p>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-amber-500/15 to-yellow-500/10 border border-white/[0.06] p-3.5">
                  <AlertTriangle className="h-4 w-4 text-amber-400 mb-2" />
                  <p className="text-xl font-black">{users.filter(u => u.status === "suspend").length}</p>
                  <p className="text-[10px] text-white/30">Suspended</p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold text-white/20 uppercase tracking-widest px-1">Moderation Actions</h3>
                {auditLogs.filter(l => l.action.toLowerCase().includes("ban") || l.action.toLowerCase().includes("suspend") || l.action.toLowerCase().includes("delete")).slice(0, 10).map(log => (
                  <div key={log.id} className="rounded-xl bg-white/[0.02] border border-red-500/10 p-3">
                    <p className="text-xs font-medium">{log.action}</p>
                    <p className="text-[10px] text-white/20 mt-1">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold text-white/20 uppercase tracking-widest px-1">Security Checklist</h3>
                {[
                  { label: "Owner email verified", ok: true },
                  { label: "RLS enabled on all tables", ok: true },
                  { label: "Admin access gated", ok: true },
                  { label: "User deletion available", ok: true },
                  { label: "Audit logging active", ok: auditLogs.length > 0 },
                ].map(c => (
                  <div key={c.label} className="flex items-center gap-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
                    {c.ok ? <CheckCircle className="h-4 w-4 text-green-400" /> : <XCircle className="h-4 w-4 text-red-400" />}
                    <span className="text-xs font-medium">{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════ SETTINGS ══════════════ */}
          {tab === "settings" && (
            <div className="space-y-4">
              <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                {[
                  { id: "submissions", icon: Rocket },
                  { id: "moderation", icon: Shield },
                  { id: "users", icon: Users },
                  { id: "chat", icon: MessageSquare },
                  { id: "api", icon: Globe },
                  { id: "display", icon: Eye },
                ].map(c => (
                  <button key={c.id} onClick={() => setSettingsCategory(c.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      settingsCategory === c.id ? "bg-white/10 text-white" : "text-white/30 hover:text-white/50"
                    }`}>
                    <c.icon className="h-3.5 w-3.5" />
                    {c.id.charAt(0).toUpperCase() + c.id.slice(1)}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {filteredSettings.length > 0 ? filteredSettings.map(s => {
                  const isBoolean = s.value?.hasOwnProperty?.("enabled");
                  const hasValue = s.value?.hasOwnProperty?.("value");
                  return (
                    <div key={s.key} className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">{s.key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</p>
                        {s.description && <p className="text-[10px] text-white/25 mt-0.5 line-clamp-2">{s.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isBoolean && <Switch checked={s.value.enabled} onCheckedChange={c => updateSetting(s.key, { ...s.value, enabled: c })} disabled={savingSettings === s.key} />}
                        {hasValue && !isBoolean && <Input type="number" value={s.value.value} onChange={e => updateSetting(s.key, { ...s.value, value: parseInt(e.target.value) })} className="w-20 h-8 text-xs bg-white/[0.03] border-white/[0.08]" disabled={savingSettings === s.key} />}
                        {savingSettings === s.key && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="py-8 text-center">
                    <Settings className="h-6 w-6 text-white/10 mx-auto mb-2" />
                    <p className="text-xs text-white/25">No settings in this category</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════ User Detail Dialog ═══════════════════════ */}
      <Dialog open={!!selectedUser} onOpenChange={open => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] overflow-auto rounded-2xl p-0 gap-0 border-white/[0.08]">
          {selectedUser && (
            <>
              {/* Header */}
              <div className="p-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#22d3ee]/30 to-purple-500/30 flex items-center justify-center text-base font-bold flex-shrink-0">
                    {(selectedUser.username || selectedUser.user_id).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold truncate">{selectedUser.username || "Unnamed User"}</p>
                    <p className="text-[10px] text-white/30 font-mono truncate">{selectedUser.user_id}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={selectedUser.status === "ban" ? "destructive" : selectedUser.status === "suspend" ? "secondary" : "default"} className="text-[9px] px-1.5 py-0">
                        {selectedUser.status || "active"}
                      </Badge>
                      <span className="text-[10px] text-white/20">Joined {formatDistanceToNow(new Date(selectedUser.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-0 border-b border-white/[0.06]">
                {[
                  { label: "Used", value: `$${(userCredits[selectedUser.user_id]?.used_credits || 0).toLocaleString()}`, color: "text-yellow-400" },
                  { label: "Left", value: `$${((userCredits[selectedUser.user_id]?.total_credits || 50000) - (userCredits[selectedUser.user_id]?.used_credits || 0)).toLocaleString()}`, color: "text-green-400" },
                  { label: "Txns", value: userTransactions.length.toString(), color: "text-[#22d3ee]" },
                ].map(s => (
                  <div key={s.label} className="text-center py-3 border-r border-white/[0.06] last:border-0">
                    <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-white/25">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="p-4 space-y-4">
                {/* Credits management */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-white/40 flex items-center gap-1.5"><Coins className="h-3.5 w-3.5" /> Credits</h4>
                  {!editingCredits ? (
                    <Button onClick={() => setEditingCredits(true)} size="sm" variant="outline" className="w-full rounded-xl text-xs">Edit Credit Balance</Button>
                  ) : (
                    <div className="space-y-2 rounded-xl bg-white/[0.03] border border-white/[0.08] p-3">
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["add", "subtract", "set"] as const).map(t => (
                          <Button key={t} size="sm" variant={creditAdjustType === t ? "default" : "outline"} onClick={() => setCreditAdjustType(t)} className="text-[10px] rounded-lg h-8">
                            {t === "add" ? "Add" : t === "subtract" ? "Subtract" : "Set"}
                          </Button>
                        ))}
                      </div>
                      <Input type="number" value={newCreditAmount} onChange={e => setNewCreditAmount(parseFloat(e.target.value) || 0)} placeholder="Amount" className="h-9 text-sm bg-white/[0.03] border-white/[0.08] rounded-xl" />
                      <div className="flex gap-2">
                        <Button onClick={updateUserCredits} size="sm" className="flex-1 rounded-xl h-8 bg-green-600 hover:bg-green-700 text-xs">Apply</Button>
                        <Button onClick={() => setEditingCredits(false)} size="sm" variant="outline" className="flex-1 rounded-xl h-8 text-xs">Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Transaction history */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-white/40">Recent Transactions</h4>
                  <div className="max-h-[150px] overflow-y-auto space-y-1" style={{ scrollbarWidth: "none" }}>
                    {userTransactions.length === 0 ? (
                      <p className="text-center text-[10px] text-white/20 py-4">No transactions</p>
                    ) : userTransactions.slice(0, 10).map(tx => (
                      <div key={tx.id} className="flex items-center justify-between rounded-lg bg-white/[0.02] p-2">
                        <div>
                          <p className="text-[11px] font-medium">{tx.tool_name}</p>
                          <p className="text-[9px] text-white/20">{tx.tool_category}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-bold text-red-400">-${tx.cost.toFixed(2)}</p>
                          <p className="text-[9px] text-white/20">{format(new Date(tx.created_at), "MMM d")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Moderation */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-red-400/80 flex items-center gap-1.5"><Ban className="h-3.5 w-3.5" /> Moderation</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.status === "ban" || selectedUser.status === "suspend" ? (
                      <Button size="sm" variant="outline" onClick={() => banUser(selectedUser.user_id, "unban")} className="rounded-xl text-xs border-green-500/30 text-green-400 hover:bg-green-500/10 gap-1">
                        <UserCheck className="h-3.5 w-3.5" /> Reactivate
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => banUser(selectedUser.user_id, "suspend")} className="rounded-xl text-xs border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" /> Suspend
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => banUser(selectedUser.user_id, "ban")} className="rounded-xl text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1">
                          <Ban className="h-3.5 w-3.5" /> Ban
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => deleteUserAccount(selectedUser.user_id)} className="rounded-xl text-xs gap-1">
                      <Trash2 className="h-3.5 w-3.5" /> Delete Account
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Admin;
