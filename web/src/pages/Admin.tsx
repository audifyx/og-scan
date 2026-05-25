import React from "react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";
import { formatDistanceToNow, format, subDays, subHours, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
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
  Download, Upload, Filter, MoreHorizontal,
  Wallet, Target, Radio, Mic, LineChart, Flame,
  Gift, Trophy, Wrench, Terminal, Key, Cpu,
  AlertCircle, UserX, UserPlus, Edit, ChevronDown,
  LayoutGrid, Gauge, Wifi, WifiOff, Timer, Heart,
  Bot, Crosshair, Sparkles, Megaphone, BookOpen,
  Inbox, Archive, CircleDot, Layers,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface Submission { id: string; token_name: string; symbol: string; contract_address: string; launch_platform: string; status: string; promotion_tier: string; is_featured: boolean; user_id: string | null; created_at: string; admin_notes: string | null; logo_url: string | null; }
interface AuditLog { id: string; admin_user_id: string; action: string; target_type: string | null; target_id: string | null; created_at: string; new_values: any; old_values: any; details?: string; }
interface UserProfile { id: string; user_id: string; username: string | null; wallet_address: string | null; created_at: string; total_pnl: number | null; trades_count: number | null; avatar_url: string | null; bio: string | null; theme_preset: string | null; status?: string; xp?: number; streak?: number; }
interface PlatformSetting { id: string; key: string; value: any; category: string; description: string | null; updated_at: string; }
interface LobbyData { id: string; name: string; description: string | null; created_by: string; creator_name: string | null; privacy: string; member_count: number | null; is_active: boolean | null; created_at: string | null; }
interface CommunityData { id: string; name: string; description: string | null; created_by: string; member_count: number; post_count: number; category: string | null; is_private: boolean; created_at: string; banner_url?: string | null; }
interface PostData { id: string; content: string; user_id: string; community_id: string; community_name?: string; username?: string; like_count: number; reply_count: number; repost_count: number; is_pinned: boolean; created_at: string; post_type?: string; image_url?: string | null; video_url?: string | null; }
interface NotificationData { id: string; user_id: string; type: string; title: string; body: string | null; read: boolean; created_at: string; }
interface SupportTicket { id: string; user_id: string; username?: string; subject: string; status: string; priority: string; created_at: string; updated_at: string; }
interface SpaceData { id: string; title: string; topic: string | null; host_id: string; host_name?: string; is_live: boolean; is_private: boolean; listener_count: number; speaker_count: number; created_at: string; }
interface CalloutData { id: string; user_id: string; username?: string; token_address: string; token_symbol?: string; entry_price: number | null; target_price: number | null; current_pnl: number | null; created_at: string; }
interface DmConversation { id: string; participant_ids: string[]; last_message_at: string; message_count: number; }

/* ═══════════════════════════════════════════════════════════════
   Nav Config
   ═══════════════════════════════════════════════════════════════ */

const NAV_SECTIONS = [
  { id: "overview",     icon: Gauge,          label: "Command Center", color: "text-[#22d3ee]" },
  { id: "users",        icon: Users,          label: "Users",          color: "text-blue-400" },
  { id: "content",      icon: FileText,       label: "Content",        color: "text-emerald-400" },
  { id: "submissions",  icon: Rocket,         label: "Tokens",         color: "text-green-400" },
  { id: "community",    icon: Globe,          label: "Communities",    color: "text-pink-400" },
  { id: "trading",      icon: Headphones,     label: "Trading",        color: "text-purple-400" },
  { id: "wallets",      icon: Wallet,         label: "Wallets",        color: "text-indigo-400" },
  { id: "notifications",icon: Bell,           label: "Notifications",  color: "text-red-400" },
  { id: "analytics",    icon: LineChart,       label: "Analytics",      color: "text-teal-400" },
  { id: "gamification", icon: Trophy,         label: "Gamification",   color: "text-amber-400" },
  { id: "settings",     icon: Settings,       label: "Settings",       color: "text-white/60" },
  { id: "security",     icon: ShieldAlert,    label: "Security",       color: "text-orange-400" },
  { id: "support",      icon: Inbox,          label: "Support",        color: "text-sky-400" },
  { id: "dms",          icon: MessageSquare,  label: "DM & Chat",      color: "text-violet-400" },
  { id: "data",          icon: BookOpen,        label: "Data",           color: "text-teal-400" },
  { id: "export",       icon: Download,       label: "Data Export",    color: "text-lime-400" },
  { id: "developer",    icon: Terminal,        label: "Developer",      color: "text-gray-400" },
] as const;

type TabId = typeof NAV_SECTIONS[number]["id"];

/* ═══════════════════════════════════════════════════════════════
   Utility Components
   ═══════════════════════════════════════════════════════════════ */

const StatCard = ({ label, value, icon: Icon, trend, color = "text-white", sub }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; trend?: number; color?: string; sub?: string }) => (
  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-white/[0.1] hover:bg-white/[0.04]">
    <div className="flex items-start justify-between">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
        <Icon className={cn("h-4 w-4", color)} />
      </div>
      {trend !== undefined && (
        <div className={cn("flex items-center gap-0.5 text-[11px] font-bold", trend >= 0 ? "text-emerald-400" : "text-red-400")}>
          {trend >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <div className="mt-3">
      <div className={cn("text-2xl font-black tracking-tight", color)}>{value}</div>
      <div className="text-[11px] text-white/35 font-medium">{label}</div>
      {sub && <div className="text-[10px] text-white/25 mt-0.5">{sub}</div>}
    </div>
  </div>
);

const SectionHeader = ({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between mb-4">
    <div>
      <h2 className="text-lg font-black text-white tracking-tight">{title}</h2>
      <p className="text-[11px] text-white/35">{description}</p>
    </div>
    {action}
  </div>
);

const EmptyState = ({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      <Icon className="h-7 w-7 text-white/20" />
    </div>
    <p className="text-sm font-bold text-white/40">{title}</p>
    <p className="text-[11px] text-white/25 mt-1">{desc}</p>
  </div>
);

const SearchBar = ({ value, onChange, placeholder = "Search..." }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <div className="relative">
    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
    <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="h-9 pl-9 bg-white/[0.03] border-white/[0.08] text-[13px]" />
  </div>
);

const ActionButton = ({ icon: Icon, label, onClick, variant = "default", loading = false, size = "sm" }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; variant?: "default" | "danger" | "success"; loading?: boolean; size?: "sm" | "xs" }) => {
  const cls = variant === "danger" ? "border-red-500/20 text-red-400 hover:bg-red-500/10" : variant === "success" ? "border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10" : "border-white/10 text-white/60 hover:bg-white/[0.06]";
  return (
    <button onClick={onClick} disabled={loading} className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition", cls, size === "xs" && "px-2 py-1 text-[10px]")}>
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
      {label}
    </button>
  );
};

const DataTable = ({ columns, rows, onRowClick }: { columns: { key: string; label: string; width?: string }[]; rows: Record<string, any>[]; onRowClick?: (row: any) => void }) => (
  <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
    <table className="w-full text-left">
      <thead>
        <tr className="border-b border-white/[0.06] bg-white/[0.02]">
          {columns.map(c => <th key={c.key} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/30" style={c.width ? { width: c.width } : {}}>{c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} onClick={() => onRowClick?.(row)} className={cn("border-b border-white/[0.04] transition", onRowClick && "cursor-pointer hover:bg-white/[0.03]")}>
            {columns.map(c => <td key={c.key} className="px-4 py-3 text-[12px] text-white/70">{row[c.key]}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Pill = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <button onClick={onClick} className={cn("shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all", active ? "bg-white/15 text-white" : "bg-white/[0.04] text-white/40 hover:bg-white/[0.07]")}>{label}</button>
);

/* ═══════════════════════════════════════════════════════════════
   Main Admin Component
   ═══════════════════════════════════════════════════════════════ */

const Admin = ({ inline = false }: { inline?: boolean }) => {
  const Wrap = inline ? ({ children }: { children: React.ReactNode }) => <>{children}</> : AppLayout;
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey(k => k + 1);

  /* ─── Global data ─── */
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [communities, setCommunities] = useState<CommunityData[]>([]);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [lobbies, setLobbies] = useState<LobbyData[]>([]);
  const [spaces, setSpaces] = useState<SpaceData[]>([]);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSetting[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [maintenanceOn, setMaintenanceOn] = useState(true);

  /* ─── Stats ─── */
  const [stats, setStats] = useState({
    totalUsers: 0, activeToday: 0, activeWeek: 0, activeMonth: 0,
    newToday: 0, newWeek: 0, newMonth: 0,
    totalPosts: 0, totalCommunities: 0, totalLobbies: 0,
    activeLobbies: 0, activeSpaces: 0,
    pendingSubmissions: 0, totalSubmissions: 0,
    openTickets: 0, totalCallouts: 0,
    totalTrackedWallets: 0, totalPriceAlerts: 0,
    totalDmConversations: 0,
  });

  /* ─── Admin check ─── */
  useEffect(() => {
    if (adminLoading) return;
    if (!user) { setLoading(false); return; }
    if (!isAdmin) { navigate("/app"); return; }
    setLoading(false);
  }, [user, isAdmin, adminLoading, navigate]);

  /* ─── Data fetching ─── */
  const fetchAll = useCallback(async () => {
    if (!user || !isAdmin) return;
    
    const now = new Date();
    const todayStart = startOfDay(now).toISOString();
    const weekStart = startOfWeek(now).toISOString();
    const monthStart = startOfMonth(now).toISOString();

    // Parallel fetch
    const [
      profilesRes, subsRes, logsRes, communitiesRes, postsRes,
      lobbiesRes, spacesRes, notifsRes, settingsRes, ticketsRes,
      maintenanceRes,
      calloutsCount, walletsCount, alertsCount, dmsCount,
      newTodayRes, newWeekRes, newMonthRes,
    ] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("pump_v5_submissions").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("communities").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("community_posts").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("trading_lobbies").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("spaces").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("platform_settings").select("*"),
      supabase.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("site_settings").select("value").eq("key", "maintenance_mode").single(),
      supabase.from("callouts").select("id", { count: "exact", head: true }),
      supabase.from("tracked_wallets").select("id", { count: "exact", head: true }),
      supabase.from("price_alerts").select("id", { count: "exact", head: true }),
      supabase.from("dm_conversations").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekStart),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
    ]);

    if (profilesRes.data) setProfiles(profilesRes.data);
    if (subsRes.data) setSubmissions(subsRes.data);
    if (logsRes.data) setAuditLogs(logsRes.data);
    if (communitiesRes.data) setCommunities(communitiesRes.data as any);
    if (postsRes.data) setPosts(postsRes.data as any);
    if (lobbiesRes.data) setLobbies(lobbiesRes.data as any);
    if (spacesRes.data) setSpaces(spacesRes.data as any);
    if (notifsRes.data) setNotifications(notifsRes.data as any);
    if (settingsRes.data) setPlatformSettings(settingsRes.data);
    if (ticketsRes.data) setSupportTickets(ticketsRes.data as any);
    if (maintenanceRes.data) setMaintenanceOn(maintenanceRes.data.value === true || maintenanceRes.data.value === "true");

    const totalUsers = profilesRes.data?.length ?? 0;
    const activeLobs = (lobbiesRes.data ?? []).filter((l: any) => l.is_active).length;
    const liveSpaces = (spacesRes.data ?? []).filter((s: any) => s.is_live).length;
    const pending = (subsRes.data ?? []).filter((s: any) => s.status === "pending").length;
    const openT = (ticketsRes.data ?? []).filter((t: any) => t.status === "open" || t.status === "pending").length;

    setStats({
      totalUsers,
      activeToday: 0, activeWeek: 0, activeMonth: 0,
      newToday: newTodayRes.count ?? 0,
      newWeek: newWeekRes.count ?? 0,
      newMonth: newMonthRes.count ?? 0,
      totalPosts: postsRes.data?.length ?? 0,
      totalCommunities: communitiesRes.data?.length ?? 0,
      totalLobbies: lobbiesRes.data?.length ?? 0,
      activeLobbies: activeLobs,
      activeSpaces: liveSpaces,
      pendingSubmissions: pending,
      totalSubmissions: subsRes.data?.length ?? 0,
      openTickets: openT,
      totalCallouts: calloutsCount.count ?? 0,
      totalTrackedWallets: walletsCount.count ?? 0,
      totalPriceAlerts: alertsCount.count ?? 0,
      totalDmConversations: dmsCount.count ?? 0,
    });
  }, [user, isAdmin]);

  useEffect(() => { fetchAll(); }, [fetchAll, refreshKey]);

  /* ─── Maintenance toggle ─── */
  const toggleMaintenance = async () => {
    const newVal = !maintenanceOn;
    const { error } = await supabase.from("site_settings").upsert({ key: "maintenance_mode", value: newVal }, { onConflict: "key" });
    if (error) { toast.error("Failed to toggle maintenance"); return; }
    setMaintenanceOn(newVal);
    toast.success(`Maintenance mode ${newVal ? "ON" : "OFF"}`);
    // Audit log
    await supabase.from("admin_audit_log").insert({ admin_user_id: user!.id, action: `maintenance_${newVal ? "on" : "off"}`, target_type: "site_settings", target_id: "maintenance_mode" });
  };

  /* ═══════════════════════════════════════════════════════════════
     LOADING & AUTH STATES
     ═══════════════════════════════════════════════════════════════ */

  if (loading || adminLoading) return <Wrap><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-white/30" /></div></Wrap>;
  if (!isAdmin) return <Wrap><div className="flex items-center justify-center min-h-[60vh] text-white/40"><Shield className="mr-2 h-5 w-5" /> Admin access required</div></Wrap>;

  /* ═══════════════════════════════════════════════════════════════
     SECTION 1: COMMAND CENTER
     ═══════════════════════════════════════════════════════════════ */

  const renderCommandCenter = () => (
    <div className="space-y-6">
      {/* Quick Actions Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-bold cursor-pointer transition", maintenanceOn ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400")} onClick={toggleMaintenance}>
          {maintenanceOn ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
          {maintenanceOn ? "Maintenance ON" : "Site LIVE"}
        </div>
        <ActionButton icon={RefreshCw} label="Refresh All" onClick={refresh} />
        <ActionButton icon={Download} label="Export Snapshot" onClick={() => { const blob = new Blob([JSON.stringify({ profiles: profiles.length, posts: posts.length, communities: communities.length, submissions: submissions.length, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `ogscan-snapshot-${format(new Date(), "yyyy-MM-dd")}.json`; a.click(); toast.success("Snapshot exported"); }} />
      </div>

      {/* KPI Cards Row 1 - Users */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Users</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Users" value={stats.totalUsers} icon={Users} color="text-blue-400" />
          <StatCard label="New Today" value={stats.newToday} icon={UserPlus} color="text-emerald-400" />
          <StatCard label="New This Week" value={stats.newWeek} icon={UserPlus} color="text-cyan-400" />
          <StatCard label="New This Month" value={stats.newMonth} icon={UserPlus} color="text-indigo-400" />
        </div>
      </div>

      {/* KPI Cards Row 2 - Content */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Content & Community</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Posts" value={stats.totalPosts} icon={FileText} color="text-pink-400" />
          <StatCard label="Communities" value={stats.totalCommunities} icon={Globe} color="text-violet-400" />
          <StatCard label="Active Lobbies" value={stats.activeLobbies} icon={Headphones} color="text-purple-400" sub={`${stats.totalLobbies} total`} />
          <StatCard label="Live Spaces" value={stats.activeSpaces} icon={Mic} color="text-rose-400" />
        </div>
      </div>

      {/* KPI Cards Row 3 - Platform */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Platform</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Pending Tokens" value={stats.pendingSubmissions} icon={Rocket} color="text-amber-400" sub={`${stats.totalSubmissions} total`} />
          <StatCard label="Open Tickets" value={stats.openTickets} icon={Inbox} color="text-sky-400" />
          <StatCard label="Tracked Wallets" value={stats.totalTrackedWallets} icon={Wallet} color="text-indigo-400" />
          <StatCard label="Price Alerts" value={stats.totalPriceAlerts} icon={Bell} color="text-red-400" />
        </div>
      </div>

      {/* KPI Cards Row 4 - More */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">More</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Callouts" value={stats.totalCallouts} icon={Target} color="text-orange-400" />
          <StatCard label="DM Conversations" value={stats.totalDmConversations} icon={MessageSquare} color="text-violet-400" />
          <StatCard label="Token Submissions" value={stats.totalSubmissions} icon={Coins} color="text-green-400" />
          <StatCard label="Audit Entries" value={auditLogs.length} icon={FileText} color="text-white/50" />
        </div>
      </div>

      {/* Live Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Recent Signups</p>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04] max-h-[300px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {profiles.slice(0, 15).map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] cursor-pointer" onClick={() => { setTab("users"); }}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-[11px] font-black text-blue-400">
                  {p.username?.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-white truncate">{p.username || "Anonymous"}</p>
                  <p className="text-[10px] text-white/30">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</p>
                </div>
                {p.wallet_address && <Badge variant="outline" className="text-[9px] border-white/10 text-white/30">{p.wallet_address.slice(0, 4)}…{p.wallet_address.slice(-4)}</Badge>}
              </div>
            ))}
            {profiles.length === 0 && <div className="p-8 text-center text-[12px] text-white/25">No users yet</div>}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Recent Audit Log</p>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04] max-h-[300px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {auditLogs.slice(0, 15).map(log => (
              <div key={log.id} className="px-4 py-3 hover:bg-white/[0.03]">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px] border-white/10 text-white/40">{log.action}</Badge>
                  <span className="text-[10px] text-white/25">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                </div>
                {log.target_type && <p className="text-[11px] text-white/40 mt-1">{log.target_type} → {log.target_id?.slice(0, 8)}…</p>}
              </div>
            ))}
            {auditLogs.length === 0 && <div className="p-8 text-center text-[12px] text-white/25">No audit events</div>}
          </div>
        </div>
      </div>

      {/* Quick Jump Grid */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Quick Jump</p>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {NAV_SECTIONS.filter(s => s.id !== "overview").map(s => (
            <button key={s.id} onClick={() => setTab(s.id)} className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-white/[0.12] hover:bg-white/[0.04]">
              <s.icon className={cn("h-4 w-4", s.color)} />
              <span className="text-[9px] font-bold text-white/40">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════
     SECTION 2: USER MANAGEMENT
     ═══════════════════════════════════════════════════════════════ */

  const UserManagement = () => {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "admin" | "recent" | "wallet">("all");
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [userDetailTab, setUserDetailTab] = useState<"overview" | "activity" | "credits" | "moderation">("overview");
    const [banReason, setBanReason] = useState("");
    const [adminNote, setAdminNote] = useState("");
    const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
    const [bulkMode, setBulkMode] = useState(false);
    const [creditAmount, setCreditAmount] = useState(0);
    const [creditAction, setCreditAction] = useState<"add" | "subtract" | "set">("add");
    const [userCredits, setUserCredits] = useState<any>(null);
    const [userCreditTxs, setUserCreditTxs] = useState<any[]>([]);
    const [userPosts, setUserPosts] = useState<PostData[]>([]);
    const [userCommunities, setUserCommunities] = useState<any[]>([]);
    const [processing, setProcessing] = useState(false);

    const filtered = useMemo(() => {
      let list = [...profiles];
      if (search) {
        const q = search.toLowerCase();
        list = list.filter(u => u.username?.toLowerCase().includes(q) || u.user_id?.toLowerCase().includes(q) || u.wallet_address?.toLowerCase().includes(q));
      }
      if (filter === "recent") list = list.slice(0, 50);
      if (filter === "wallet") list = list.filter(u => u.wallet_address);
      return list;
    }, [profiles, search, filter]);

    const loadUserDetail = async (u: UserProfile) => {
      setSelectedUser(u);
      setUserDetailTab("overview");
      // Load credits
      const { data: cred } = await supabase.from("user_credits").select("*").eq("user_id", u.user_id).single();
      setUserCredits(cred);
      // Load credit transactions
      const { data: txs } = await supabase.from("credit_transactions").select("*").eq("user_id", u.user_id).order("created_at", { ascending: false }).limit(50);
      setUserCreditTxs(txs ?? []);
      // Load posts
      const { data: up } = await supabase.from("community_posts").select("*").eq("user_id", u.user_id).order("created_at", { ascending: false }).limit(30);
      setUserPosts(up as any ?? []);
      // Load community memberships
      const { data: cm } = await supabase.from("community_members").select("community_id, role, joined_at").eq("user_id", u.user_id);
      setUserCommunities(cm ?? []);
    };

    const banUser = async (userId: string) => {
      setProcessing(true);
      // Update profile status
      await supabase.from("profiles").update({ status: "banned" }).eq("user_id", userId);
      await supabase.from("admin_audit_log").insert({ admin_user_id: user!.id, action: "ban_user", target_type: "user", target_id: userId, new_values: { reason: banReason } });
      toast.success("User banned");
      setBanReason("");
      refresh();
      setProcessing(false);
    };

    const unbanUser = async (userId: string) => {
      await supabase.from("profiles").update({ status: "active" }).eq("user_id", userId);
      await supabase.from("admin_audit_log").insert({ admin_user_id: user!.id, action: "unban_user", target_type: "user", target_id: userId });
      toast.success("User unbanned");
      refresh();
    };

    const deleteUser = async (userId: string) => {
      if (!confirm("Delete this user and all their data? This cannot be undone.")) return;
      setProcessing(true);
      await supabase.from("community_posts").delete().eq("user_id", userId);
      await supabase.from("community_post_replies").delete().eq("user_id", userId);
      await supabase.from("community_members").delete().eq("user_id", userId);
      await supabase.from("profiles").delete().eq("user_id", userId);
      await supabase.from("admin_audit_log").insert({ admin_user_id: user!.id, action: "delete_user", target_type: "user", target_id: userId });
      toast.success("User deleted");
      setSelectedUser(null);
      refresh();
      setProcessing(false);
    };

    const adjustCredits = async (userId: string) => {
      setProcessing(true);
      let newTotal = creditAmount;
      if (creditAction === "add") newTotal = (userCredits?.total_credits ?? 0) + creditAmount;
      else if (creditAction === "subtract") newTotal = Math.max(0, (userCredits?.total_credits ?? 0) - creditAmount);
      
      await supabase.from("user_credits").upsert({ user_id: userId, total_credits: newTotal }, { onConflict: "user_id" });
      await supabase.from("admin_audit_log").insert({ admin_user_id: user!.id, action: "adjust_credits", target_type: "user", target_id: userId, new_values: { action: creditAction, amount: creditAmount, newTotal } });
      toast.success(`Credits updated to ${newTotal}`);
      if (selectedUser) loadUserDetail(selectedUser);
      setProcessing(false);
    };

    const assignRole = async (userId: string, role: "admin" | "moderator") => {
      const { error } = await supabase.from("admin_roles").insert({ user_id: userId, role });
      if (error) { toast.error("Failed — may already have this role"); return; }
      await supabase.from("admin_audit_log").insert({ admin_user_id: user!.id, action: `assign_${role}`, target_type: "user", target_id: userId });
      toast.success(`${role} role assigned`);
    };

    const removeRole = async (userId: string) => {
      await supabase.from("admin_roles").delete().eq("user_id", userId);
      await supabase.from("admin_audit_log").insert({ admin_user_id: user!.id, action: "remove_roles", target_type: "user", target_id: userId });
      toast.success("Roles removed");
    };

    const bulkAction = async (action: "ban" | "delete" | "notify") => {
      if (bulkSelected.size === 0) return;
      if (!confirm(`${action} ${bulkSelected.size} users?`)) return;
      setProcessing(true);
      for (const uid of bulkSelected) {
        if (action === "ban") await supabase.from("profiles").update({ status: "banned" }).eq("user_id", uid);
        if (action === "delete") {
          await supabase.from("community_posts").delete().eq("user_id", uid);
          await supabase.from("profiles").delete().eq("user_id", uid);
        }
      }
      await supabase.from("admin_audit_log").insert({ admin_user_id: user!.id, action: `bulk_${action}`, target_type: "users", new_values: { count: bulkSelected.size } });
      toast.success(`${action} completed for ${bulkSelected.size} users`);
      setBulkSelected(new Set());
      setBulkMode(false);
      refresh();
      setProcessing(false);
    };

    const exportUsers = () => {
      const csv = ["username,user_id,wallet,joined,status,xp,posts"].concat(
        filtered.map(u => `${u.username ?? ""},${u.user_id},${u.wallet_address ?? ""},${u.created_at},${u.status ?? "active"},${u.xp ?? 0},${u.trades_count ?? 0}`)
      ).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `users-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
      toast.success("Users exported");
    };

    return (
      <div className="space-y-4">
        <SectionHeader title="User Management" description={`${stats.totalUsers} total users`} action={
          <div className="flex gap-2">
            <ActionButton icon={bulkMode ? X : LayoutGrid} label={bulkMode ? "Cancel" : "Bulk"} onClick={() => { setBulkMode(!bulkMode); setBulkSelected(new Set()); }} />
            <ActionButton icon={Download} label="Export CSV" onClick={exportUsers} />
            <ActionButton icon={RefreshCw} label="Refresh" onClick={refresh} />
          </div>
        } />

        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[200px]"><SearchBar value={search} onChange={setSearch} placeholder="Search username, ID, wallet..." /></div>
          <div className="flex gap-1.5">
            <Pill label="All" active={filter === "all"} onClick={() => setFilter("all")} />
            <Pill label="Recent 50" active={filter === "recent"} onClick={() => setFilter("recent")} />
            <Pill label="Has Wallet" active={filter === "wallet"} onClick={() => setFilter("wallet")} />
          </div>
        </div>

        {bulkMode && bulkSelected.size > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <span className="text-[12px] font-bold text-amber-400">{bulkSelected.size} selected</span>
            <ActionButton icon={Ban} label="Ban All" onClick={() => bulkAction("ban")} variant="danger" size="xs" />
            <ActionButton icon={Trash2} label="Delete All" onClick={() => bulkAction("delete")} variant="danger" size="xs" />
          </div>
        )}

        <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {filtered.map(u => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition cursor-pointer" onClick={() => !bulkMode && loadUserDetail(u)}>
              {bulkMode && (
                <input type="checkbox" checked={bulkSelected.has(u.user_id)} onChange={() => { const s = new Set(bulkSelected); s.has(u.user_id) ? s.delete(u.user_id) : s.add(u.user_id); setBulkSelected(s); }} className="h-4 w-4 rounded border-white/20 bg-white/5" onClick={e => e.stopPropagation()} />
              )}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-[12px] font-black text-white/70">
                {u.username?.charAt(0).toUpperCase() || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-white truncate">{u.username || "Anonymous"}</span>
                  {u.status === "banned" && <Badge className="bg-red-500/20 text-red-400 text-[9px] border-0">BANNED</Badge>}
                </div>
                <p className="text-[10px] text-white/30 truncate">{u.user_id.slice(0, 20)}… · Joined {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}</p>
              </div>
              {u.wallet_address && (
                <Badge variant="outline" className="text-[9px] border-white/10 text-white/30 hidden sm:flex">{u.wallet_address.slice(0, 4)}…{u.wallet_address.slice(-4)}</Badge>
              )}
              <ChevronRight className="h-3.5 w-3.5 text-white/20" />
            </div>
          ))}
          {filtered.length === 0 && <EmptyState icon={Users} title="No users found" desc="Try a different search" />}
        </div>

        {/* User Detail Dialog */}
        <Dialog open={!!selectedUser} onOpenChange={v => !v && setSelectedUser(null)}>
          <DialogContent className="max-w-2xl bg-[#0a1018] border-white/[0.08] max-h-[85vh] overflow-y-auto">
            {selectedUser && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-lg font-black text-white/70">
                      {selectedUser.username?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div>
                      <div className="text-white text-lg font-black">{selectedUser.username || "Anonymous"}</div>
                      <div className="text-[11px] text-white/30 font-mono">{selectedUser.user_id.slice(0, 24)}…</div>
                    </div>
                  </DialogTitle>
                </DialogHeader>

                {/* User Detail Tabs */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3">
                  {(["overview", "activity", "credits", "moderation"] as const).map(t => (
                    <Pill key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} active={userDetailTab === t} onClick={() => setUserDetailTab(t)} />
                  ))}
                </div>

                {userDetailTab === "overview" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                        <p className="text-[10px] text-white/30 mb-1">Username</p>
                        <p className="text-[13px] font-bold text-white">{selectedUser.username || "—"}</p>
                      </div>
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                        <p className="text-[10px] text-white/30 mb-1">Status</p>
                        <p className="text-[13px] font-bold text-white">{selectedUser.status || "active"}</p>
                      </div>
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                        <p className="text-[10px] text-white/30 mb-1">Wallet</p>
                        <p className="text-[11px] font-mono text-white/60 truncate">{selectedUser.wallet_address || "None"}</p>
                      </div>
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                        <p className="text-[10px] text-white/30 mb-1">Joined</p>
                        <p className="text-[13px] font-bold text-white">{format(new Date(selectedUser.created_at), "MMM d, yyyy")}</p>
                      </div>
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                        <p className="text-[10px] text-white/30 mb-1">Bio</p>
                        <p className="text-[12px] text-white/50">{selectedUser.bio || "No bio"}</p>
                      </div>
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                        <p className="text-[10px] text-white/30 mb-1">Theme</p>
                        <p className="text-[13px] font-bold text-white">{selectedUser.theme_preset || "default"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <StatCard label="Posts" value={userPosts.length} icon={FileText} color="text-pink-400" />
                      <StatCard label="Communities" value={userCommunities.length} icon={Globe} color="text-violet-400" />
                      <StatCard label="Trades" value={selectedUser.trades_count ?? 0} icon={TrendingUp} color="text-emerald-400" />
                    </div>
                  </div>
                )}

                {userDetailTab === "activity" && (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Recent Posts</p>
                    {userPosts.map(p => (
                      <div key={p.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                        <p className="text-[12px] text-white/60 line-clamp-2">{p.content}</p>
                        <div className="flex gap-3 mt-2 text-[10px] text-white/25">
                          <span>❤️ {p.like_count}</span>
                          <span>💬 {p.reply_count}</span>
                          <span>{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                    ))}
                    {userPosts.length === 0 && <p className="text-[12px] text-white/25 text-center py-8">No posts</p>}
                  </div>
                )}

                {userDetailTab === "credits" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <StatCard label="Total Credits" value={userCredits?.total_credits ?? 0} icon={Coins} color="text-amber-400" />
                      <StatCard label="Used Credits" value={userCredits?.used_credits ?? 0} icon={Zap} color="text-red-400" />
                      <StatCard label="Remaining" value={(userCredits?.total_credits ?? 0) - (userCredits?.used_credits ?? 0)} icon={Star} color="text-emerald-400" />
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label className="text-[10px] text-white/30">Action</Label>
                        <Select value={creditAction} onValueChange={v => setCreditAction(v as any)}>
                          <SelectTrigger className="h-9 bg-white/[0.03] border-white/[0.08] text-[12px]"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="add">Add</SelectItem><SelectItem value="subtract">Subtract</SelectItem><SelectItem value="set">Set To</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Label className="text-[10px] text-white/30">Amount</Label>
                        <Input type="number" value={creditAmount} onChange={e => setCreditAmount(Number(e.target.value))} className="h-9 bg-white/[0.03] border-white/[0.08] text-[12px]" />
                      </div>
                      <Button size="sm" onClick={() => adjustCredits(selectedUser.user_id)} disabled={processing} className="h-9 bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30">
                        {processing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply"}
                      </Button>
                    </div>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                      {userCreditTxs.map(tx => (
                        <div key={tx.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02]">
                          <div>
                            <span className="text-[11px] font-semibold text-white/60">{tx.tool_name}</span>
                            <span className="text-[10px] text-white/25 ml-2">{tx.description}</span>
                          </div>
                          <span className="text-[11px] font-bold text-red-400">-{tx.cost}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {userDetailTab === "moderation" && (
                  <div className="space-y-4">
                    {/* Role Management */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Role Management</p>
                      <div className="flex gap-2">
                        <ActionButton icon={Crown} label="Make Admin" onClick={() => assignRole(selectedUser.user_id, "admin")} />
                        <ActionButton icon={Shield} label="Make Mod" onClick={() => assignRole(selectedUser.user_id, "moderator")} />
                        <ActionButton icon={UserX} label="Remove Roles" onClick={() => removeRole(selectedUser.user_id)} variant="danger" />
                      </div>
                    </div>

                    {/* Ban/Unban */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Account Actions</p>
                      {selectedUser.status === "banned" ? (
                        <ActionButton icon={UserCheck} label="Unban User" onClick={() => unbanUser(selectedUser.user_id)} variant="success" />
                      ) : (
                        <div className="space-y-2">
                          <Input value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Ban reason (optional)" className="h-9 bg-white/[0.03] border-white/[0.08] text-[12px]" />
                          <div className="flex gap-2">
                            <ActionButton icon={Ban} label="Ban User" onClick={() => banUser(selectedUser.user_id)} variant="danger" loading={processing} />
                            <ActionButton icon={Trash2} label="Delete Account" onClick={() => deleteUser(selectedUser.user_id)} variant="danger" loading={processing} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Admin Notes */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Admin Note</p>
                      <Textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="Internal note about this user..." className="bg-white/[0.03] border-white/[0.08] text-[12px] min-h-[80px]" />
                      <Button size="sm" className="mt-2 h-8 text-[11px]" onClick={async () => {
                        await supabase.from("admin_audit_log").insert({ admin_user_id: user!.id, action: "admin_note", target_type: "user", target_id: selectedUser.user_id, new_values: { note: adminNote } });
                        toast.success("Note saved"); setAdminNote("");
                      }}>Save Note</Button>
                    </div>

                    {/* Wipe Options */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Data Cleanup</p>
                      <div className="flex flex-wrap gap-2">
                        <ActionButton icon={Trash2} label="Wipe Posts" variant="danger" size="xs" onClick={async () => {
                          if (!confirm("Delete all posts by this user?")) return;
                          await supabase.from("community_posts").delete().eq("user_id", selectedUser.user_id);
                          toast.success("Posts wiped"); refresh();
                        }} />
                        <ActionButton icon={Trash2} label="Wipe Memberships" variant="danger" size="xs" onClick={async () => {
                          if (!confirm("Remove from all communities?")) return;
                          await supabase.from("community_members").delete().eq("user_id", selectedUser.user_id);
                          toast.success("Memberships wiped"); refresh();
                        }} />
                        <ActionButton icon={Trash2} label="Force Avatar Reset" variant="danger" size="xs" onClick={async () => {
                          await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", selectedUser.user_id);
                          toast.success("Avatar reset"); refresh();
                        }} />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  };


  /* ═══════════════════════════════════════════════════════════════
     SECTION 3: CONTENT MODERATION
     ═══════════════════════════════════════════════════════════════ */

  const ContentModeration = () => {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "pinned" | "video" | "chart" | "image">("all");
    const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
    const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
    const [bulkMode, setBulkMode] = useState(false);
    const [keywordBlacklist, setKeywordBlacklist] = useState("");
    const [showKeywords, setShowKeywords] = useState(false);

    const filtered = useMemo(() => {
      let list = [...posts];
      if (search) { const q = search.toLowerCase(); list = list.filter(p => p.content?.toLowerCase().includes(q) || p.username?.toLowerCase().includes(q)); }
      if (filter === "pinned") list = list.filter(p => p.is_pinned);
      if (filter === "video") list = list.filter(p => p.video_url);
      if (filter === "image") list = list.filter(p => p.image_url);
      if (filter === "chart") list = list.filter(p => p.post_type === "chart_call");
      return list;
    }, [posts, search, filter]);

    const deletePost = async (postId: string) => {
      await supabase.from("community_posts").delete().eq("id", postId);
      await supabase.from("admin_audit_log").insert({ admin_user_id: user!.id, action: "delete_post", target_type: "post", target_id: postId });
      toast.success("Post deleted");
      setSelectedPost(null);
      refresh();
    };

    const togglePin = async (postId: string, pinned: boolean) => {
      await supabase.from("community_posts").update({ is_pinned: !pinned }).eq("id", postId);
      toast.success(pinned ? "Unpinned" : "Pinned");
      refresh();
    };

    const bulkDelete = async () => {
      if (!confirm(`Delete ${bulkSelected.size} posts?`)) return;
      for (const id of bulkSelected) await supabase.from("community_posts").delete().eq("id", id);
      await supabase.from("admin_audit_log").insert({ admin_user_id: user!.id, action: "bulk_delete_posts", target_type: "posts", new_values: { count: bulkSelected.size } });
      toast.success(`${bulkSelected.size} posts deleted`);
      setBulkSelected(new Set()); setBulkMode(false); refresh();
    };

    return (
      <div className="space-y-4">
        <SectionHeader title="Content Moderation" description={`${posts.length} posts loaded`} action={
          <div className="flex gap-2">
            <ActionButton icon={bulkMode ? X : LayoutGrid} label={bulkMode ? "Cancel" : "Bulk"} onClick={() => { setBulkMode(!bulkMode); setBulkSelected(new Set()); }} />
            <ActionButton icon={Filter} label="Keywords" onClick={() => setShowKeywords(!showKeywords)} />
            <ActionButton icon={RefreshCw} label="Refresh" onClick={refresh} />
          </div>
        } />

        {showKeywords && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Keyword Blacklist</p>
            <Textarea value={keywordBlacklist} onChange={e => setKeywordBlacklist(e.target.value)} placeholder="One keyword per line..." className="bg-white/[0.03] border-white/[0.08] text-[12px] min-h-[60px]" />
            <Button size="sm" className="h-8 text-[11px]" onClick={async () => {
              await supabase.from("platform_settings").upsert({ key: "keyword_blacklist", value: keywordBlacklist, category: "moderation" }, { onConflict: "key" });
              toast.success("Blacklist saved");
            }}>Save</Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[200px]"><SearchBar value={search} onChange={setSearch} placeholder="Search posts..." /></div>
          <div className="flex gap-1.5">
            <Pill label="All" active={filter === "all"} onClick={() => setFilter("all")} />
            <Pill label="📌 Pinned" active={filter === "pinned"} onClick={() => setFilter("pinned")} />
            <Pill label="🎥 Video" active={filter === "video"} onClick={() => setFilter("video")} />
            <Pill label="📈 Charts" active={filter === "chart"} onClick={() => setFilter("chart")} />
            <Pill label="🖼 Image" active={filter === "image"} onClick={() => setFilter("image")} />
          </div>
        </div>

        {bulkMode && bulkSelected.size > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <span className="text-[12px] font-bold text-red-400">{bulkSelected.size} selected</span>
            <ActionButton icon={Trash2} label="Delete Selected" onClick={bulkDelete} variant="danger" size="xs" />
          </div>
        )}

        <div className="space-y-2 max-h-[600px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {filtered.map(p => (
            <div key={p.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.1] transition">
              <div className="flex items-start gap-3">
                {bulkMode && (
                  <input type="checkbox" checked={bulkSelected.has(p.id)} onChange={() => { const s = new Set(bulkSelected); s.has(p.id) ? s.delete(p.id) : s.add(p.id); setBulkSelected(s); }} className="h-4 w-4 mt-1 rounded border-white/20 bg-white/5" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold text-white/50">{p.username || p.user_id.slice(0, 8)}</span>
                    {p.is_pinned && <Badge className="bg-amber-500/20 text-amber-400 text-[9px] border-0">PINNED</Badge>}
                    {p.post_type === "chart_call" && <Badge className="bg-emerald-500/20 text-emerald-400 text-[9px] border-0">CHART</Badge>}
                    {p.video_url && <Badge className="bg-purple-500/20 text-purple-400 text-[9px] border-0">VIDEO</Badge>}
                    <span className="text-[10px] text-white/20 ml-auto">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                  </div>
                  <p className="text-[12px] text-white/60 line-clamp-3">{p.content}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-[10px] text-white/25">❤️ {p.like_count}</span>
                    <span className="text-[10px] text-white/25">💬 {p.reply_count}</span>
                    <span className="text-[10px] text-white/25">🔁 {p.repost_count}</span>
                    <div className="ml-auto flex gap-1.5">
                      <ActionButton icon={p.is_pinned ? XCircle : Star} label={p.is_pinned ? "Unpin" : "Pin"} onClick={() => togglePin(p.id, p.is_pinned)} size="xs" />
                      <ActionButton icon={Trash2} label="Delete" onClick={() => deletePost(p.id)} variant="danger" size="xs" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <EmptyState icon={FileText} title="No posts found" desc="Content will appear here" />}
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     SECTION 4: TOKEN / SUBMISSIONS
     ═══════════════════════════════════════════════════════════════ */

  const TokenSubmissions = () => {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
    const [selected, setSelected] = useState<Submission | null>(null);
    const [editNotes, setEditNotes] = useState("");
    const [processing, setProcessing] = useState(false);

    const filtered = useMemo(() => {
      let list = [...submissions];
      if (search) { const q = search.toLowerCase(); list = list.filter(s => s.token_name?.toLowerCase().includes(q) || s.symbol?.toLowerCase().includes(q) || s.contract_address?.toLowerCase().includes(q)); }
      if (filter !== "all") list = list.filter(s => s.status === filter);
      return list;
    }, [submissions, search, filter]);

    const updateStatus = async (id: string, status: string) => {
      setProcessing(true);
      await supabase.from("pump_v5_submissions").update({ status }).eq("id", id);
      await supabase.from("admin_audit_log").insert({ admin_user_id: user!.id, action: `submission_${status}`, target_type: "submission", target_id: id });
      toast.success(`Token ${status}`);
      refresh();
      setProcessing(false);
    };

    const toggleFeatured = async (id: string, current: boolean) => {
      await supabase.from("pump_v5_submissions").update({ is_featured: !current }).eq("id", id);
      toast.success(current ? "Unfeatured" : "Featured");
      refresh();
    };

    const saveNotes = async (id: string) => {
      await supabase.from("pump_v5_submissions").update({ admin_notes: editNotes }).eq("id", id);
      toast.success("Notes saved");
    };

    const batchApprove = async () => {
      const pending = filtered.filter(s => s.status === "pending");
      if (!confirm(`Approve ${pending.length} pending tokens?`)) return;
      for (const s of pending) await supabase.from("pump_v5_submissions").update({ status: "approved" }).eq("id", s.id);
      toast.success(`${pending.length} tokens approved`);
      refresh();
    };

    return (
      <div className="space-y-4">
        <SectionHeader title="Token Submissions" description={`${stats.pendingSubmissions} pending · ${stats.totalSubmissions} total`} action={
          <div className="flex gap-2">
            {stats.pendingSubmissions > 0 && <ActionButton icon={CheckCircle} label="Approve All Pending" onClick={batchApprove} variant="success" />}
            <ActionButton icon={RefreshCw} label="Refresh" onClick={refresh} />
          </div>
        } />

        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[200px]"><SearchBar value={search} onChange={setSearch} placeholder="Search token, symbol, CA..." /></div>
          <div className="flex gap-1.5">
            <Pill label="All" active={filter === "all"} onClick={() => setFilter("all")} />
            <Pill label="⏳ Pending" active={filter === "pending"} onClick={() => setFilter("pending")} />
            <Pill label="✅ Approved" active={filter === "approved"} onClick={() => setFilter("approved")} />
            <Pill label="❌ Rejected" active={filter === "rejected"} onClick={() => setFilter("rejected")} />
          </div>
        </div>

        <div className="space-y-2 max-h-[600px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {filtered.map(s => (
            <div key={s.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.1] transition cursor-pointer" onClick={() => { setSelected(s); setEditNotes(s.admin_notes ?? ""); }}>
              <div className="flex items-center gap-3">
                {s.logo_url && <img src={s.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-white">{s.token_name}</span>
                    <Badge variant="outline" className="text-[9px] border-white/10 text-white/40">{s.symbol}</Badge>
                    <Badge className={cn("text-[9px] border-0", s.status === "approved" ? "bg-emerald-500/20 text-emerald-400" : s.status === "pending" ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400")}>{s.status.toUpperCase()}</Badge>
                    {s.is_featured && <Badge className="bg-yellow-500/20 text-yellow-400 text-[9px] border-0">⭐ FEATURED</Badge>}
                  </div>
                  <p className="text-[10px] text-white/30 font-mono mt-0.5">{s.contract_address}</p>
                </div>
                <div className="flex gap-1.5">
                  <ActionButton icon={Copy} label="" size="xs" onClick={(e: any) => { e?.stopPropagation(); navigator.clipboard.writeText(s.contract_address); toast.success("CA copied"); }} />
                  <ActionButton icon={ExternalLink} label="" size="xs" onClick={(e: any) => { e?.stopPropagation(); window.open(`https://dexscreener.com/solana/${s.contract_address}`, "_blank"); }} />
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <EmptyState icon={Rocket} title="No submissions" desc="Token submissions will appear here" />}
        </div>

        {/* Token Detail Dialog */}
        <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
          <DialogContent className="max-w-lg bg-[#0a1018] border-white/[0.08]">
            {selected && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-white">
                    {selected.logo_url && <img src={selected.logo_url} alt="" className="h-8 w-8 rounded-lg" />}
                    {selected.token_name} ({selected.symbol})
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                      <p className="text-[10px] text-white/30">Platform</p>
                      <p className="text-[12px] font-bold text-white">{selected.launch_platform}</p>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                      <p className="text-[10px] text-white/30">Tier</p>
                      <p className="text-[12px] font-bold text-white">{selected.promotion_tier}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <p className="text-[10px] text-white/30 mb-1">Contract Address</p>
                    <div className="flex items-center gap-2">
                      <code className="text-[11px] text-white/60 font-mono break-all flex-1">{selected.contract_address}</code>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { navigator.clipboard.writeText(selected.contract_address); toast.success("Copied"); }}><Copy className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 mb-1">Admin Notes</p>
                    <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} className="bg-white/[0.03] border-white/[0.08] text-[12px] min-h-[60px]" />
                    <Button size="sm" className="mt-1 h-7 text-[10px]" onClick={() => saveNotes(selected.id)}>Save Notes</Button>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-white/[0.06]">
                    {selected.status !== "approved" && <ActionButton icon={CheckCircle} label="Approve" onClick={() => { updateStatus(selected.id, "approved"); setSelected(null); }} variant="success" loading={processing} />}
                    {selected.status !== "rejected" && <ActionButton icon={XCircle} label="Reject" onClick={() => { updateStatus(selected.id, "rejected"); setSelected(null); }} variant="danger" loading={processing} />}
                    <ActionButton icon={Star} label={selected.is_featured ? "Unfeature" : "Feature"} onClick={() => { toggleFeatured(selected.id, selected.is_featured); setSelected(null); }} />
                    <ActionButton icon={Trash2} label="Delete" onClick={async () => { await supabase.from("pump_v5_submissions").delete().eq("id", selected.id); toast.success("Deleted"); setSelected(null); refresh(); }} variant="danger" />
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     SECTION 5: COMMUNITY MANAGEMENT
     ═══════════════════════════════════════════════════════════════ */

  const CommunityManagement = () => {
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState<"newest" | "members" | "posts">("newest");
    const [selected, setSelected] = useState<CommunityData | null>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [comPosts, setComPosts] = useState<PostData[]>([]);
    const [detailTab, setDetailTab] = useState<"info" | "members" | "posts">("info");
    const [editName, setEditName] = useState("");
    const [editDesc, setEditDesc] = useState("");

    const filtered = useMemo(() => {
      let list = [...communities];
      if (search) { const q = search.toLowerCase(); list = list.filter(c => c.name?.toLowerCase().includes(q)); }
      if (sort === "members") list.sort((a, b) => (b.member_count ?? 0) - (a.member_count ?? 0));
      if (sort === "posts") list.sort((a, b) => (b.post_count ?? 0) - (a.post_count ?? 0));
      return list;
    }, [communities, search, sort]);

    const loadCommunity = async (c: CommunityData) => {
      setSelected(c);
      setEditName(c.name);
      setEditDesc(c.description ?? "");
      setDetailTab("info");
      const [mRes, pRes] = await Promise.all([
        supabase.from("community_members").select("*").eq("community_id", c.id).limit(100),
        supabase.from("community_posts").select("*").eq("community_id", c.id).order("created_at", { ascending: false }).limit(50),
      ]);
      setMembers(mRes.data ?? []);
      setComPosts(pRes.data as any ?? []);
    };

    const saveCommunity = async () => {
      if (!selected) return;
      await supabase.from("communities").update({ name: editName, description: editDesc }).eq("id", selected.id);
      toast.success("Community updated");
      refresh();
    };

    const deleteCommunity = async (id: string) => {
      if (!confirm("Delete this community and all its posts?")) return;
      await supabase.from("community_posts").delete().eq("community_id", id);
      await supabase.from("community_members").delete().eq("community_id", id);
      await supabase.from("communities").delete().eq("id", id);
      await supabase.from("admin_audit_log").insert({ admin_user_id: user!.id, action: "delete_community", target_type: "community", target_id: id });
      toast.success("Community deleted");
      setSelected(null);
      refresh();
    };

    const kickMember = async (communityId: string, userId: string) => {
      await supabase.from("community_members").delete().eq("community_id", communityId).eq("user_id", userId);
      toast.success("Member removed");
      if (selected) loadCommunity(selected);
    };

    const promoteMod = async (communityId: string, userId: string) => {
      await supabase.from("community_members").update({ role: "moderator" }).eq("community_id", communityId).eq("user_id", userId);
      toast.success("Promoted to mod");
      if (selected) loadCommunity(selected);
    };

    return (
      <div className="space-y-4">
        <SectionHeader title="Community Management" description={`${communities.length} communities`} action={<ActionButton icon={RefreshCw} label="Refresh" onClick={refresh} />} />

        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[200px]"><SearchBar value={search} onChange={setSearch} placeholder="Search communities..." /></div>
          <div className="flex gap-1.5">
            <Pill label="Newest" active={sort === "newest"} onClick={() => setSort("newest")} />
            <Pill label="Most Members" active={sort === "members"} onClick={() => setSort("members")} />
            <Pill label="Most Posts" active={sort === "posts"} onClick={() => setSort("posts")} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {filtered.map(c => (
            <div key={c.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.1] transition cursor-pointer" onClick={() => loadCommunity(c)}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500/20 to-violet-500/20 text-[14px] font-black text-white/60">
                  {c.name?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-white truncate">{c.name}</p>
                  <p className="text-[10px] text-white/30">{c.member_count ?? 0} members · {c.post_count ?? 0} posts</p>
                </div>
                {c.is_private && <Lock className="h-3.5 w-3.5 text-white/20" />}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <EmptyState icon={Globe} title="No communities" desc="Communities will appear here" />}
        </div>

        {/* Community Detail */}
        <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
          <DialogContent className="max-w-2xl bg-[#0a1018] border-white/[0.08] max-h-[85vh] overflow-y-auto">
            {selected && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-white text-lg font-black">{selected.name}</DialogTitle>
                  <DialogDescription className="text-white/30 text-[11px]">{selected.member_count ?? 0} members · Created {format(new Date(selected.created_at), "MMM d, yyyy")}</DialogDescription>
                </DialogHeader>

                <div className="flex gap-1.5 mb-3">
                  {(["info", "members", "posts"] as const).map(t => (
                    <Pill key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} active={detailTab === t} onClick={() => setDetailTab(t)} />
                  ))}
                </div>

                {detailTab === "info" && (
                  <div className="space-y-3">
                    <div><Label className="text-[10px] text-white/30">Name</Label><Input value={editName} onChange={e => setEditName(e.target.value)} className="h-9 bg-white/[0.03] border-white/[0.08] text-[12px]" /></div>
                    <div><Label className="text-[10px] text-white/30">Description</Label><Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="bg-white/[0.03] border-white/[0.08] text-[12px] min-h-[60px]" /></div>
                    <div className="flex gap-2">
                      <ActionButton icon={CheckCircle} label="Save Changes" onClick={saveCommunity} variant="success" />
                      <ActionButton icon={Trash2} label="Delete Community" onClick={() => deleteCommunity(selected.id)} variant="danger" />
                    </div>
                  </div>
                )}

                {detailTab === "members" && (
                  <div className="space-y-1 max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                    {members.map(m => (
                      <div key={m.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/[0.03]">
                        <div>
                          <span className="text-[12px] font-semibold text-white">{m.user_id.slice(0, 12)}…</span>
                          {m.role && <Badge className="ml-2 text-[9px] border-0 bg-purple-500/20 text-purple-400">{m.role}</Badge>}
                        </div>
                        <div className="flex gap-1.5">
                          {m.role !== "moderator" && <ActionButton icon={Shield} label="Mod" onClick={() => promoteMod(selected.id, m.user_id)} size="xs" />}
                          <ActionButton icon={UserX} label="Kick" onClick={() => kickMember(selected.id, m.user_id)} variant="danger" size="xs" />
                        </div>
                      </div>
                    ))}
                    {members.length === 0 && <p className="text-[12px] text-white/25 text-center py-8">No members</p>}
                  </div>
                )}

                {detailTab === "posts" && (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                    {comPosts.map(p => (
                      <div key={p.id} className="flex items-start justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] text-white/60 line-clamp-2">{p.content}</p>
                          <p className="text-[10px] text-white/25 mt-1">❤️ {p.like_count} · 💬 {p.reply_count} · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</p>
                        </div>
                        <ActionButton icon={Trash2} label="" onClick={async () => { await supabase.from("community_posts").delete().eq("id", p.id); toast.success("Deleted"); loadCommunity(selected); }} variant="danger" size="xs" />
                      </div>
                    ))}
                    {comPosts.length === 0 && <p className="text-[12px] text-white/25 text-center py-8">No posts</p>}
                  </div>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     SECTION 6: TRADING & VOICE ROOMS
     ═══════════════════════════════════════════════════════════════ */

  const TradingRooms = () => {
    const [lobbyTab, setLobbyTab] = useState<"lobbies" | "spaces">("lobbies");
    const [search, setSearch] = useState("");

    const filteredLobbies = useMemo(() => {
      if (!search) return lobbies;
      const q = search.toLowerCase();
      return lobbies.filter(l => l.name?.toLowerCase().includes(q));
    }, [lobbies, search]);

    const filteredSpaces = useMemo(() => {
      if (!search) return spaces;
      const q = search.toLowerCase();
      return spaces.filter(s => s.title?.toLowerCase().includes(q));
    }, [spaces, search]);

    const deleteLobby = async (id: string) => {
      if (!confirm("Delete this lobby?")) return;
      await supabase.from("lobby_messages").delete().eq("lobby_id", id);
      await supabase.from("lobby_members").delete().eq("lobby_id", id);
      await supabase.from("trading_lobbies").delete().eq("id", id);
      await supabase.from("admin_audit_log").insert({ admin_user_id: user!.id, action: "delete_lobby", target_type: "lobby", target_id: id });
      toast.success("Lobby deleted");
      refresh();
    };

    const toggleLobby = async (id: string, active: boolean) => {
      await supabase.from("trading_lobbies").update({ is_active: !active }).eq("id", id);
      toast.success(active ? "Deactivated" : "Activated");
      refresh();
    };

    const deleteSpace = async (id: string) => {
      if (!confirm("Delete this space?")) return;
      await supabase.from("space_messages").delete().eq("space_id", id);
      await supabase.from("spaces").delete().eq("id", id);
      toast.success("Space deleted");
      refresh();
    };

    const endSpace = async (id: string) => {
      await supabase.from("spaces").update({ is_live: false }).eq("id", id);
      toast.success("Space ended");
      refresh();
    };

    return (
      <div className="space-y-4">
        <SectionHeader title="Trading & Voice" description={`${stats.activeLobbies} active lobbies · ${stats.activeSpaces} live spaces`} action={<ActionButton icon={RefreshCw} label="Refresh" onClick={refresh} />} />

        <div className="flex gap-2">
          <Pill label={`Lobbies (${lobbies.length})`} active={lobbyTab === "lobbies"} onClick={() => setLobbyTab("lobbies")} />
          <Pill label={`Spaces (${spaces.length})`} active={lobbyTab === "spaces"} onClick={() => setLobbyTab("spaces")} />
        </div>

        <SearchBar value={search} onChange={setSearch} placeholder={lobbyTab === "lobbies" ? "Search lobbies..." : "Search spaces..."} />

        {lobbyTab === "lobbies" && (
          <div className="space-y-2 max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {filteredLobbies.map(l => (
              <div key={l.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", l.is_active ? "bg-emerald-500/10" : "bg-white/[0.04]")}>
                    <Headphones className={cn("h-4 w-4", l.is_active ? "text-emerald-400" : "text-white/30")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-white">{l.name}</span>
                      <Badge className={cn("text-[9px] border-0", l.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.06] text-white/30")}>{l.is_active ? "ACTIVE" : "INACTIVE"}</Badge>
                      <Badge variant="outline" className="text-[9px] border-white/10 text-white/30">{l.privacy}</Badge>
                    </div>
                    <p className="text-[10px] text-white/30">{l.member_count ?? 0} members · {l.description?.slice(0, 60) || "No description"}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <ActionButton icon={l.is_active ? WifiOff : Wifi} label={l.is_active ? "Deactivate" : "Activate"} onClick={() => toggleLobby(l.id, !!l.is_active)} size="xs" />
                    <ActionButton icon={Trash2} label="Delete" onClick={() => deleteLobby(l.id)} variant="danger" size="xs" />
                  </div>
                </div>
              </div>
            ))}
            {filteredLobbies.length === 0 && <EmptyState icon={Headphones} title="No lobbies" desc="Trading lobbies will appear here" />}
          </div>
        )}

        {lobbyTab === "spaces" && (
          <div className="space-y-2 max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {filteredSpaces.map(s => (
              <div key={s.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", s.is_live ? "bg-red-500/10" : "bg-white/[0.04]")}>
                    <Mic className={cn("h-4 w-4", s.is_live ? "text-red-400 animate-pulse" : "text-white/30")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-white">{s.title}</span>
                      {s.is_live && <Badge className="bg-red-500/20 text-red-400 text-[9px] border-0 animate-pulse">🔴 LIVE</Badge>}
                      {s.is_private && <Lock className="h-3 w-3 text-white/20" />}
                    </div>
                    <p className="text-[10px] text-white/30">{s.listener_count} listeners · {s.speaker_count} speakers · {s.topic || "No topic"}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {s.is_live && <ActionButton icon={XCircle} label="End" onClick={() => endSpace(s.id)} variant="danger" size="xs" />}
                    <ActionButton icon={Trash2} label="Delete" onClick={() => deleteSpace(s.id)} variant="danger" size="xs" />
                  </div>
                </div>
              </div>
            ))}
            {filteredSpaces.length === 0 && <EmptyState icon={Mic} title="No spaces" desc="Voice spaces will appear here" />}
          </div>
        )}
      </div>
    );
  };


  /* ═══════════════════════════════════════════════════════════════
     SECTION 7: WALLET INTELLIGENCE
     ═══════════════════════════════════════════════════════════════ */

  const WalletIntelligence = () => {
    const [walletTab, setWalletTab] = useState<"tracked" | "callouts" | "alerts">("tracked");
    const [trackedWallets, setTrackedWallets] = useState<any[]>([]);
    const [callouts, setCallouts] = useState<CalloutData[]>([]);
    const [priceAlerts, setPriceAlerts] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
      if (loaded) return;
      (async () => {
        const [w, c, a] = await Promise.all([
          supabase.from("tracked_wallets").select("*").order("created_at", { ascending: false }).limit(100),
          supabase.from("callouts").select("*").order("created_at", { ascending: false }).limit(100),
          supabase.from("price_alerts").select("*").order("created_at", { ascending: false }).limit(100),
        ]);
        setTrackedWallets(w.data ?? []);
        setCallouts(c.data ?? []);
        setPriceAlerts(a.data ?? []);
        setLoaded(true);
      })();
    }, [loaded]);

    const deleteWallet = async (id: string) => {
      await supabase.from("tracked_wallets").delete().eq("id", id);
      toast.success("Wallet removed");
      setLoaded(false);
    };

    const deleteCallout = async (id: string) => {
      await supabase.from("callouts").delete().eq("id", id);
      toast.success("Callout deleted");
      setLoaded(false);
    };

    const deleteAlert = async (id: string) => {
      await supabase.from("price_alerts").delete().eq("id", id);
      toast.success("Alert deleted");
      setLoaded(false);
    };

    const filteredWallets = useMemo(() => {
      if (!search) return trackedWallets;
      const q = search.toLowerCase();
      return trackedWallets.filter((w: any) => w.wallet_address?.toLowerCase().includes(q) || w.label?.toLowerCase().includes(q));
    }, [trackedWallets, search]);

    return (
      <div className="space-y-4">
        <SectionHeader title="Wallet Intelligence" description={`${trackedWallets.length} wallets · ${callouts.length} callouts · ${priceAlerts.length} alerts`} action={<ActionButton icon={RefreshCw} label="Refresh" onClick={() => setLoaded(false)} />} />

        <div className="flex gap-2">
          <Pill label={`Wallets (${trackedWallets.length})`} active={walletTab === "tracked"} onClick={() => setWalletTab("tracked")} />
          <Pill label={`Callouts (${callouts.length})`} active={walletTab === "callouts"} onClick={() => setWalletTab("callouts")} />
          <Pill label={`Alerts (${priceAlerts.length})`} active={walletTab === "alerts"} onClick={() => setWalletTab("alerts")} />
        </div>

        <SearchBar value={search} onChange={setSearch} placeholder="Search..." />

        {walletTab === "tracked" && (
          <div className="space-y-2 max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {filteredWallets.map((w: any) => (
              <div key={w.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-3">
                <Wallet className="h-4 w-4 text-indigo-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-white truncate">{w.label || w.wallet_address}</p>
                  <p className="text-[10px] text-white/30 font-mono truncate">{w.wallet_address}</p>
                </div>
                <div className="flex gap-1.5">
                  <ActionButton icon={Copy} label="" size="xs" onClick={() => { navigator.clipboard.writeText(w.wallet_address); toast.success("Copied"); }} />
                  <ActionButton icon={ExternalLink} label="" size="xs" onClick={() => window.open(`https://solscan.io/account/${w.wallet_address}`, "_blank")} />
                  <ActionButton icon={Trash2} label="" onClick={() => deleteWallet(w.id)} variant="danger" size="xs" />
                </div>
              </div>
            ))}
            {filteredWallets.length === 0 && <EmptyState icon={Wallet} title="No tracked wallets" desc="Users' tracked wallets will appear here" />}
          </div>
        )}

        {walletTab === "callouts" && (
          <div className="space-y-2 max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {callouts.map((c: any) => (
              <div key={c.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-3">
                <Target className={cn("h-4 w-4 shrink-0", (c.current_pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400")} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-white">{c.token_symbol || c.token_address?.slice(0, 8)}</span>
                    {c.current_pnl != null && (
                      <Badge className={cn("text-[9px] border-0", c.current_pnl >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>
                        {c.current_pnl >= 0 ? "+" : ""}{(c.current_pnl * 100).toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-white/30">Entry: ${c.entry_price?.toFixed(6) || "?"} · Target: ${c.target_price?.toFixed(6) || "?"}</p>
                </div>
                <ActionButton icon={Trash2} label="" onClick={() => deleteCallout(c.id)} variant="danger" size="xs" />
              </div>
            ))}
            {callouts.length === 0 && <EmptyState icon={Target} title="No callouts" desc="Trading callouts will appear here" />}
          </div>
        )}

        {walletTab === "alerts" && (
          <div className="space-y-2 max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {priceAlerts.map((a: any) => (
              <div key={a.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-3">
                <Bell className="h-4 w-4 text-red-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-white">{a.token_symbol || a.token_address?.slice(0, 12)}</p>
                  <p className="text-[10px] text-white/30">Target: ${a.target_price} · {a.condition || "above"}</p>
                </div>
                <Badge className={cn("text-[9px] border-0", a.triggered ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400")}>{a.triggered ? "TRIGGERED" : "ACTIVE"}</Badge>
                <ActionButton icon={Trash2} label="" onClick={() => deleteAlert(a.id)} variant="danger" size="xs" />
              </div>
            ))}
            {priceAlerts.length === 0 && <EmptyState icon={Bell} title="No alerts" desc="Price alerts will appear here" />}
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     SECTION 8: NOTIFICATIONS & COMMS
     ═══════════════════════════════════════════════════════════════ */

  const NotificationsComms = () => {
    const [notifsTab, setNotifsTab] = useState<"broadcast" | "history" | "templates">("broadcast");
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [target, setTarget] = useState<"all" | "admins">("all");
    const [sending, setSending] = useState(false);
    const [templates, setTemplates] = useState<{ name: string; title: string; body: string }[]>([
      { name: "Welcome", title: "Welcome to OG Scan! 🎉", body: "You're now part of the OG crew. Explore communities, track tokens, and join trading lobbies." },
      { name: "Maintenance", title: "Maintenance Mode Enabled 🔧", body: "We're performing platform updates. OG Scan will be back shortly." },
      { name: "New Feature", title: "New Feature Drop 🚀", body: "Check out the latest features we just shipped!" },
      { name: "Security Alert", title: "Security Notice ⚠️", body: "Please update your password and review your account security settings." },
    ]);

    const sendBroadcast = async () => {
      if (!title || !body) { toast.error("Title and body required"); return; }
      setSending(true);
      
      let targetUsers: string[] = [];
      if (target === "all") {
        const { data } = await supabase.from("profiles").select("user_id");
        targetUsers = (data ?? []).map((p: any) => p.user_id);
      } else {
        const { data } = await supabase.from("admin_roles").select("user_id");
        targetUsers = (data ?? []).map((p: any) => p.user_id);
      }

      // Batch insert notifications
      const batch = targetUsers.map(uid => ({ user_id: uid, type: "admin_broadcast", title, body, read: false }));
      const BATCH_SIZE = 100;
      for (let i = 0; i < batch.length; i += BATCH_SIZE) {
        await supabase.from("notifications").insert(batch.slice(i, i + BATCH_SIZE));
      }

      await supabase.from("admin_audit_log").insert({ admin_user_id: user!.id, action: "broadcast_sent", target_type: "notification", new_values: { title, target, count: targetUsers.length } });
      toast.success(`Sent to ${targetUsers.length} users`);
      setTitle(""); setBody("");
      setSending(false);
      refresh();
    };

    return (
      <div className="space-y-4">
        <SectionHeader title="Notifications & Comms" description="Broadcast announcements and manage notifications" />

        <div className="flex gap-2">
          <Pill label="Broadcast" active={notifsTab === "broadcast"} onClick={() => setNotifsTab("broadcast")} />
          <Pill label={`History (${notifications.length})`} active={notifsTab === "history"} onClick={() => setNotifsTab("history")} />
          <Pill label="Templates" active={notifsTab === "templates"} onClick={() => setNotifsTab("templates")} />
        </div>

        {notifsTab === "broadcast" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-white/30">Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Notification title..." className="h-9 bg-white/[0.03] border-white/[0.08] text-[12px]" />
              </div>
              <div>
                <Label className="text-[10px] text-white/30">Target</Label>
                <Select value={target} onValueChange={v => setTarget(v as any)}>
                  <SelectTrigger className="h-9 bg-white/[0.03] border-white/[0.08] text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Users</SelectItem><SelectItem value="admins">Admins Only</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-white/30">Body</Label>
              <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Message body..." className="bg-white/[0.03] border-white/[0.08] text-[12px] min-h-[100px]" />
            </div>
            <div className="flex gap-2">
              <ActionButton icon={Send} label={`Send to ${target === "all" ? "All" : "Admins"}`} onClick={sendBroadcast} variant="success" loading={sending} />
              <ActionButton icon={Eye} label="Preview" onClick={() => toast.info(title + "\n" + body)} />
            </div>

            {/* Quick template buttons */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Quick Templates</p>
              <div className="flex flex-wrap gap-2">
                {templates.map(t => (
                  <button key={t.name} onClick={() => { setTitle(t.title); setBody(t.body); }} className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] text-[11px] text-white/50 hover:bg-white/[0.05] transition">{t.name}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {notifsTab === "history" && (
          <div className="space-y-1 max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {notifications.slice(0, 100).map(n => (
              <div key={n.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03]">
                <div className={cn("h-2 w-2 rounded-full shrink-0", n.read ? "bg-white/10" : "bg-blue-400")} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-white truncate">{n.title}</p>
                  <p className="text-[10px] text-white/30 truncate">{n.body}</p>
                </div>
                <Badge variant="outline" className="text-[9px] border-white/10 text-white/25 shrink-0">{n.type}</Badge>
                <span className="text-[10px] text-white/20 shrink-0">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
              </div>
            ))}
            {notifications.length === 0 && <EmptyState icon={Bell} title="No notifications" desc="Sent notifications will appear here" />}
          </div>
        )}

        {notifsTab === "templates" && (
          <div className="space-y-2">
            {templates.map((t, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 cursor-pointer hover:border-white/[0.1]" onClick={() => { setTitle(t.title); setBody(t.body); setNotifsTab("broadcast"); }}>
                <p className="text-[13px] font-bold text-white">{t.name}</p>
                <p className="text-[11px] text-white/40">{t.title}</p>
                <p className="text-[10px] text-white/25 mt-1">{t.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     SECTION 9: ANALYTICS & INSIGHTS
     ═══════════════════════════════════════════════════════════════ */

  const AnalyticsInsights = () => {
    const [analyticsTab, setAnalyticsTab] = useState<"users" | "content" | "community" | "platform">("users");
    const [usersByDay, setUsersByDay] = useState<{ date: string; count: number }[]>([]);
    const [postsByDay, setPostsByDay] = useState<{ date: string; count: number }[]>([]);
    const [topUsers, setTopUsers] = useState<any[]>([]);
    const [topCommunities, setTopCommunities] = useState<any[]>([]);
    const [topPosts, setTopPosts] = useState<PostData[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
      if (loaded) return;
      (async () => {
        // Calculate signups by day (last 30 days)
        const days: { date: string; count: number }[] = [];
        const pDays: { date: string; count: number }[] = [];
        const now = new Date();
        for (let i = 29; i >= 0; i--) {
          const d = subDays(now, i);
          const start = startOfDay(d).toISOString();
          const end = new Date(startOfDay(d).getTime() + 86400000).toISOString();
          const { count: uc } = await supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", start).lt("created_at", end);
          const { count: pc } = await supabase.from("community_posts").select("id", { count: "exact", head: true }).gte("created_at", start).lt("created_at", end);
          days.push({ date: format(d, "MMM d"), count: uc ?? 0 });
          pDays.push({ date: format(d, "MMM d"), count: pc ?? 0 });
        }
        setUsersByDay(days);
        setPostsByDay(pDays);

        // Top users by trades
        const sorted = [...profiles].sort((a, b) => (b.trades_count ?? 0) - (a.trades_count ?? 0));
        setTopUsers(sorted.slice(0, 20));

        // Top communities
        const sortedC = [...communities].sort((a, b) => (b.member_count ?? 0) - (a.member_count ?? 0));
        setTopCommunities(sortedC.slice(0, 10));

        // Top posts by engagement
        const sortedP = [...posts].sort((a, b) => ((b.like_count ?? 0) + (b.reply_count ?? 0)) - ((a.like_count ?? 0) + (a.reply_count ?? 0)));
        setTopPosts(sortedP.slice(0, 10));

        setLoaded(true);
      })();
    }, [loaded, profiles, communities, posts]);

    const maxSignup = Math.max(...usersByDay.map(d => d.count), 1);
    const maxPosts = Math.max(...postsByDay.map(d => d.count), 1);

    const renderChart = (data: { date: string; count: number }[], max: number, color: string) => (
      <div className="flex items-end gap-[2px] h-[120px]">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
            <div className="absolute -top-6 hidden group-hover:block bg-black/90 border border-white/10 rounded px-2 py-0.5 text-[9px] text-white font-bold whitespace-nowrap">{d.date}: {d.count}</div>
            <div className={cn("w-full rounded-t transition-all", color)} style={{ height: `${Math.max(2, (d.count / max) * 100)}%`, minHeight: "2px" }} />
          </div>
        ))}
      </div>
    );

    return (
      <div className="space-y-4">
        <SectionHeader title="Analytics & Insights" description="Platform metrics and trends" action={<ActionButton icon={RefreshCw} label="Reload" onClick={() => setLoaded(false)} />} />

        <div className="flex gap-2">
          <Pill label="Users" active={analyticsTab === "users"} onClick={() => setAnalyticsTab("users")} />
          <Pill label="Content" active={analyticsTab === "content"} onClick={() => setAnalyticsTab("content")} />
          <Pill label="Community" active={analyticsTab === "community"} onClick={() => setAnalyticsTab("community")} />
          <Pill label="Platform" active={analyticsTab === "platform"} onClick={() => setAnalyticsTab("platform")} />
        </div>

        {!loaded ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-white/30" /><span className="ml-2 text-[12px] text-white/30">Crunching data...</span></div>
        ) : (
          <>
            {analyticsTab === "users" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Signups — Last 30 Days</p>
                  {renderChart(usersByDay, maxSignup, "bg-blue-500/80")}
                  <div className="flex justify-between mt-2">
                    <span className="text-[9px] text-white/20">{usersByDay[0]?.date}</span>
                    <span className="text-[9px] text-white/20">{usersByDay[usersByDay.length - 1]?.date}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Today" value={stats.newToday} icon={UserPlus} color="text-emerald-400" />
                  <StatCard label="This Week" value={stats.newWeek} icon={UserPlus} color="text-cyan-400" />
                  <StatCard label="This Month" value={stats.newMonth} icon={UserPlus} color="text-blue-400" />
                  <StatCard label="Total" value={stats.totalUsers} icon={Users} color="text-indigo-400" />
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Top Users by Trades</p>
                  <div className="space-y-1 max-h-[300px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                    {topUsers.map((u, i) => (
                      <div key={u.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03]">
                        <span className="text-[11px] font-bold text-white/25 w-6 text-right">#{i + 1}</span>
                        <span className="text-[12px] font-semibold text-white flex-1">{u.username || "Anonymous"}</span>
                        <span className="text-[11px] font-bold text-emerald-400">{u.trades_count ?? 0} trades</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {analyticsTab === "content" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Posts — Last 30 Days</p>
                  {renderChart(postsByDay, maxPosts, "bg-pink-500/80")}
                  <div className="flex justify-between mt-2">
                    <span className="text-[9px] text-white/20">{postsByDay[0]?.date}</span>
                    <span className="text-[9px] text-white/20">{postsByDay[postsByDay.length - 1]?.date}</span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Top Posts by Engagement</p>
                  <div className="space-y-2">
                    {topPosts.map((p, i) => (
                      <div key={p.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-amber-400">#{i + 1}</span>
                          <span className="text-[11px] font-bold text-white/50">{p.username || p.user_id?.slice(0, 8)}</span>
                        </div>
                        <p className="text-[12px] text-white/60 line-clamp-2">{p.content}</p>
                        <div className="flex gap-3 mt-1.5 text-[10px] text-white/25">
                          <span>❤️ {p.like_count}</span>
                          <span>💬 {p.reply_count}</span>
                          <span>🔁 {p.repost_count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {analyticsTab === "community" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatCard label="Communities" value={communities.length} icon={Globe} color="text-pink-400" />
                  <StatCard label="Total Posts" value={posts.length} icon={FileText} color="text-violet-400" />
                  <StatCard label="Avg Posts/Community" value={communities.length > 0 ? Math.round(posts.length / communities.length) : 0} icon={BarChart3} color="text-cyan-400" />
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Top Communities by Members</p>
                  <div className="space-y-1">
                    {topCommunities.map((c, i) => (
                      <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03]">
                        <span className="text-[11px] font-bold text-white/25 w-6 text-right">#{i + 1}</span>
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-500/10 text-[11px] font-black text-pink-400">{c.name?.charAt(0)}</div>
                        <span className="text-[12px] font-semibold text-white flex-1">{c.name}</span>
                        <span className="text-[11px] font-bold text-pink-400">{c.member_count ?? 0} members</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {analyticsTab === "platform" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Active Lobbies" value={stats.activeLobbies} icon={Headphones} color="text-purple-400" />
                  <StatCard label="Live Spaces" value={stats.activeSpaces} icon={Mic} color="text-rose-400" />
                  <StatCard label="Tracked Wallets" value={stats.totalTrackedWallets} icon={Wallet} color="text-indigo-400" />
                  <StatCard label="DM Conversations" value={stats.totalDmConversations} icon={MessageSquare} color="text-violet-400" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Callouts" value={stats.totalCallouts} icon={Target} color="text-orange-400" />
                  <StatCard label="Price Alerts" value={stats.totalPriceAlerts} icon={Bell} color="text-red-400" />
                  <StatCard label="Submissions" value={stats.totalSubmissions} icon={Rocket} color="text-green-400" />
                  <StatCard label="Support Tickets" value={stats.openTickets} icon={Inbox} color="text-sky-400" sub="open" />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     SECTION 10: GAMIFICATION
     ═══════════════════════════════════════════════════════════════ */

  const Gamification = () => {
    const [gamTab, setGamTab] = useState<"leaderboard" | "xp" | "badges">("leaderboard");
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [grantUserId, setGrantUserId] = useState("");
    const [grantXp, setGrantXp] = useState(0);

    // Badge management state
    const [dbBadges, setDbBadges] = useState<any[]>([]);
    const [badgesLoaded, setBadgesLoaded] = useState(false);
    const [badgeTab, setBadgeTab] = useState<"manage" | "assign" | "verify">("manage");
    const [newBadgeName, setNewBadgeName] = useState("");
    const [newBadgeIcon, setNewBadgeIcon] = useState("");
    const [newBadgeRarity, setNewBadgeRarity] = useState("common");
    const [assignUserId, setAssignUserId] = useState("");
    const [assignBadgeId, setAssignBadgeId] = useState("");
    const [verifyUserId, setVerifyUserId] = useState("");
    const [userBadges, setUserBadges] = useState<any[]>([]);
    const [seeding, setSeeding] = useState(false);

    const PRESET_BADGES = [
      { name: "OG Team", icon: "🏴‍☠️", rarity: "legendary" },
      { name: "Beta Tester", icon: "🧪", rarity: "epic" },
      { name: "Supporter", icon: "💎", rarity: "rare" },
      { name: "Diamond Hands", icon: "🤲", rarity: "epic" },
      { name: "Whale", icon: "🐋", rarity: "legendary" },
      { name: "Alpha Hunter", icon: "🎯", rarity: "rare" },
      { name: "Trade Master", icon: "📈", rarity: "epic" },
      { name: "Community King", icon: "👑", rarity: "legendary" },
      { name: "Voice OG", icon: "🎙️", rarity: "rare" },
      { name: "Early Bird", icon: "🐣", rarity: "common" },
    ];

    // Load leaderboard from profiles (not the view)
    useEffect(() => {
      if (loaded) return;
      (async () => {
        const { data } = await supabase.from("profiles").select("user_id, username, avatar_url, xp, total_xp, current_level").order("total_xp", { ascending: false, nullsFirst: false }).limit(50);
        setLeaderboard(data ?? []);
        setLoaded(true);
      })();
    }, [loaded]);

    // Load badges from DB
    useEffect(() => {
      if (badgesLoaded) return;
      (async () => {
        const { data } = await supabase.from("badges").select("*").order("created_at", { ascending: true });
        setDbBadges(data ?? []);
        setBadgesLoaded(true);
      })();
    }, [badgesLoaded]);

    // Grant XP — update profiles table directly (not the view)
    const manualGrantXp = async () => {
      if (!grantUserId || !grantXp) { toast.error("User ID and XP required"); return; }
      const { data: prof } = await supabase.from("profiles").select("xp, total_xp, current_level").eq("user_id", grantUserId).single();
      if (!prof) { toast.error("User not found"); return; }
      const newXp = (prof.xp ?? 0) + grantXp;
      const newTotalXp = (prof.total_xp ?? 0) + grantXp;
      const newLevel = Math.max(1, Math.floor(Math.sqrt(newXp / 100)));
      await supabase.from("profiles").update({ xp: newXp, total_xp: newTotalXp, current_level: newLevel }).eq("user_id", grantUserId);
      await supabase.from("admin_audit_log").insert({ admin_user_id: user!.id, action: "grant_xp", target_type: "user", target_id: grantUserId, new_values: { xp: grantXp } }).then(() => {});
      toast.success(`Granted ${grantXp} XP → Level ${newLevel} (${newXp} total XP)`);
      setGrantUserId(""); setGrantXp(0);
      setLoaded(false);
    };

    // Seed preset badges into DB
    const seedPresets = async () => {
      setSeeding(true);
      const existing = new Set(dbBadges.map(b => b.name));
      const toInsert = PRESET_BADGES.filter(b => !existing.has(b.name));
      if (toInsert.length === 0) { toast.info("All preset badges already exist"); setSeeding(false); return; }
      const { error } = await supabase.from("badges").insert(toInsert);
      if (error) { toast.error("Failed to seed: " + error.message); } else { toast.success(`Added ${toInsert.length} preset badges`); }
      setBadgesLoaded(false);
      setSeeding(false);
    };

    // Create custom badge
    const createBadge = async () => {
      if (!newBadgeName || !newBadgeIcon) { toast.error("Name and icon required"); return; }
      const { error } = await supabase.from("badges").insert({ name: newBadgeName, icon: newBadgeIcon, rarity: newBadgeRarity });
      if (error) { toast.error(error.message); return; }
      toast.success(`Badge "${newBadgeName}" created`);
      setNewBadgeName(""); setNewBadgeIcon(""); setNewBadgeRarity("common");
      setBadgesLoaded(false);
    };

    // Delete badge
    const deleteBadge = async (id: string) => {
      await supabase.from("user_badges").delete().eq("badge_id", id);
      await supabase.from("badges").delete().eq("id", id);
      toast.success("Badge deleted");
      setBadgesLoaded(false);
    };

    // Assign badge to user
    const assignBadge = async () => {
      if (!assignUserId || !assignBadgeId) { toast.error("Select user and badge"); return; }
      const badge = dbBadges.find(b => b.id === assignBadgeId);
      // Insert into user_badges
      const { error: e1 } = await supabase.from("user_badges").insert({ user_id: assignUserId, badge_id: assignBadgeId });
      if (e1 && e1.code !== "23505") { toast.error(e1.message); return; }
      // Also insert into profile_badges for display
      if (badge) {
        await supabase.from("profile_badges").insert({
          user_id: assignUserId,
          badge_id: badge.id,
          label: badge.name,
          icon: badge.icon,
          color: badge.rarity === "legendary" ? "#eab308" : badge.rarity === "epic" ? "#a855f7" : badge.rarity === "rare" ? "#3b82f6" : "#6b7280",
          glow: badge.rarity === "legendary" || badge.rarity === "epic",
        }).then(() => {});
      }
      toast.success(`Badge assigned to user`);
      setAssignUserId(""); setAssignBadgeId("");
      // Refresh user badges list if viewing
      if (assignUserId) loadUserBadges(assignUserId);
    };

    // Remove badge from user
    const removeBadge = async (userId: string, badgeId: string) => {
      await supabase.from("user_badges").delete().eq("user_id", userId).eq("badge_id", badgeId);
      await supabase.from("profile_badges").delete().eq("user_id", userId).eq("badge_id", badgeId);
      toast.success("Badge removed");
      loadUserBadges(userId);
    };

    // Load user's badges
    const loadUserBadges = async (userId: string) => {
      const { data } = await supabase.from("user_badges").select("*, badges(*)").eq("user_id", userId);
      setUserBadges(data ?? []);
    };

    // Toggle verified
    const toggleVerified = async () => {
      if (!verifyUserId) { toast.error("User ID required"); return; }
      const { data: prof } = await supabase.from("profiles").select("verified, username").eq("user_id", verifyUserId).single();
      if (!prof) { toast.error("User not found"); return; }
      const newVal = !prof.verified;
      await supabase.from("profiles").update({ verified: newVal }).eq("user_id", verifyUserId);
      toast.success(`${prof.username || verifyUserId} is now ${newVal ? "✅ VERIFIED" : "❌ UNVERIFIED"}`);
      setVerifyUserId("");
    };

    const RARITY_COLORS: Record<string, string> = {
      common: "from-gray-500/20 to-slate-500/20 border-gray-500/20",
      rare: "from-blue-500/20 to-cyan-500/20 border-blue-500/20",
      epic: "from-purple-500/20 to-pink-500/20 border-purple-500/20",
      legendary: "from-amber-500/20 to-orange-500/20 border-amber-500/20",
    };

    return (
      <div className="space-y-4">
        <SectionHeader title="Gamification" description="XP, leaderboards, and badges" action={<ActionButton icon={RefreshCw} label="Reload" onClick={() => { setLoaded(false); setBadgesLoaded(false); }} />} />

        <div className="flex gap-2">
          <Pill label="Leaderboard" active={gamTab === "leaderboard"} onClick={() => setGamTab("leaderboard")} />
          <Pill label="Grant XP" active={gamTab === "xp"} onClick={() => setGamTab("xp")} />
          <Pill label="Badges" active={gamTab === "badges"} onClick={() => setGamTab("badges")} />
        </div>

        {gamTab === "leaderboard" && (
          <div className="space-y-1 max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {leaderboard.map((entry, i) => {
              const level = entry.current_level ?? Math.max(1, Math.floor(Math.sqrt((entry.xp || 0) / 100)));
              return (
                <div key={entry.user_id} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.03] transition">
                  <span className={cn("text-[14px] font-black w-8 text-right", i < 3 ? "text-amber-400" : "text-white/20")}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-[12px] font-black text-amber-400">
                    {entry.username?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-white">{entry.username || entry.user_id.slice(0, 12)}</p>
                    <p className="text-[10px] text-white/30">Level {level}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[14px] font-black text-amber-400">{(entry.total_xp ?? entry.xp ?? 0).toLocaleString()}</p>
                    <p className="text-[9px] text-white/25">XP</p>
                  </div>
                </div>
              );
            })}
            {leaderboard.length === 0 && <EmptyState icon={Trophy} title="No leaderboard entries" desc="XP data will appear here" />}
          </div>
        )}

        {gamTab === "xp" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
              <p className="text-[12px] font-bold text-white">Manual XP Grant</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] text-white/30">User ID</Label>
                  <Input value={grantUserId} onChange={e => setGrantUserId(e.target.value)} placeholder="Paste user_id..." className="h-9 bg-white/[0.03] border-white/[0.08] text-[12px]" />
                </div>
                <div>
                  <Label className="text-[10px] text-white/30">XP Amount</Label>
                  <Input type="number" value={grantXp} onChange={e => setGrantXp(Number(e.target.value))} className="h-9 bg-white/[0.03] border-white/[0.08] text-[12px]" />
                </div>
              </div>
              <p className="text-[10px] text-white/25">Auto level-up: Level = √(XP/100). Granting XP recalculates level automatically.</p>
              <ActionButton icon={Gift} label="Grant XP" onClick={manualGrantXp} variant="success" />
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[12px] font-bold text-white mb-2">XP Actions Config</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                {[{ action: "Post Created", xp: 10 }, { action: "Reply", xp: 5 }, { action: "Like Received", xp: 2 }, { action: "Community Joined", xp: 15 }, { action: "Trade Made", xp: 20 }, { action: "Daily Login", xp: 5 }, { action: "Callout Made", xp: 25 }, { action: "Voice Room Created", xp: 10 }, { action: "Wallet Tracked", xp: 5 }].map(item => (
                  <div key={item.action} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03]">
                    <span className="text-white/50">{item.action}</span>
                    <span className="font-bold text-amber-400">+{item.xp}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {gamTab === "badges" && (
          <div className="space-y-4">
            {/* Badge sub-tabs */}
            <div className="flex gap-2">
              <Pill label="Manage Badges" active={badgeTab === "manage"} onClick={() => setBadgeTab("manage")} />
              <Pill label="Assign to Users" active={badgeTab === "assign"} onClick={() => setBadgeTab("assign")} />
              <Pill label="Verify Badge" active={badgeTab === "verify"} onClick={() => setBadgeTab("verify")} />
            </div>

            {badgeTab === "manage" && (
              <div className="space-y-4">
                {/* Seed preset badges */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[12px] font-bold text-white">Preset Badges ({PRESET_BADGES.length})</p>
                    <ActionButton icon={Zap} label={seeding ? "Seeding..." : "Seed All to DB"} onClick={seedPresets} variant="success" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {PRESET_BADGES.map(b => (
                      <div key={b.name} className={cn("rounded-lg border bg-gradient-to-br p-3 text-center", RARITY_COLORS[b.rarity] || RARITY_COLORS.common)}>
                        <div className="text-2xl mb-1">{b.icon}</div>
                        <p className="text-[10px] font-bold text-white truncate">{b.name}</p>
                        <p className="text-[8px] text-white/30 uppercase">{b.rarity}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DB badges */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[12px] font-bold text-white mb-3">Badges in Database ({dbBadges.length})</p>
                  {dbBadges.length === 0 ? (
                    <p className="text-[11px] text-white/30 text-center py-4">No badges yet — click "Seed All to DB" above</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {dbBadges.map(b => (
                        <div key={b.id} className={cn("rounded-lg border bg-gradient-to-br p-3 text-center relative group", RARITY_COLORS[b.rarity] || RARITY_COLORS.common)}>
                          <button onClick={() => deleteBadge(b.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-red-500/20 hover:bg-red-500/40">
                            <Trash2 className="h-3 w-3 text-red-400" />
                          </button>
                          <div className="text-2xl mb-1">{b.icon || "🏷️"}</div>
                          <p className="text-[10px] font-bold text-white truncate">{b.name}</p>
                          <p className="text-[8px] text-white/30 uppercase">{b.rarity}</p>
                          <p className="text-[7px] text-white/15 font-mono mt-1 truncate">{b.id.slice(0, 8)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Create custom badge */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                  <p className="text-[12px] font-bold text-white">Create Custom Badge</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-[10px] text-white/30">Name</Label>
                      <Input value={newBadgeName} onChange={e => setNewBadgeName(e.target.value)} placeholder="e.g. Whale Hunter" className="h-9 bg-white/[0.03] border-white/[0.08] text-[12px]" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-white/30">Icon (emoji)</Label>
                      <Input value={newBadgeIcon} onChange={e => setNewBadgeIcon(e.target.value)} placeholder="🔥" className="h-9 bg-white/[0.03] border-white/[0.08] text-[12px]" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-white/30">Rarity</Label>
                      <Select value={newBadgeRarity} onValueChange={setNewBadgeRarity}>
                        <SelectTrigger className="h-9 bg-white/[0.03] border-white/[0.08] text-[12px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="common">Common</SelectItem>
                          <SelectItem value="rare">Rare</SelectItem>
                          <SelectItem value="epic">Epic</SelectItem>
                          <SelectItem value="legendary">Legendary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <ActionButton icon={Star} label="Create Badge" onClick={createBadge} variant="success" />
                </div>
              </div>
            )}

            {badgeTab === "assign" && (
              <div className="space-y-4">
                {/* Assign badge */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                  <p className="text-[12px] font-bold text-white">Assign Badge to User</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] text-white/30">User ID</Label>
                      <Input value={assignUserId} onChange={e => { setAssignUserId(e.target.value); if (e.target.value.length > 30) loadUserBadges(e.target.value); }} placeholder="Paste user_id..." className="h-9 bg-white/[0.03] border-white/[0.08] text-[12px]" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-white/30">Badge</Label>
                      <Select value={assignBadgeId} onValueChange={setAssignBadgeId}>
                        <SelectTrigger className="h-9 bg-white/[0.03] border-white/[0.08] text-[12px]"><SelectValue placeholder="Select badge..." /></SelectTrigger>
                        <SelectContent>
                          {dbBadges.map(b => (
                            <SelectItem key={b.id} value={b.id}>{b.icon} {b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <ActionButton icon={Award} label="Assign Badge" onClick={assignBadge} variant="success" />
                </div>

                {/* User's current badges */}
                {userBadges.length > 0 && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="text-[12px] font-bold text-white mb-3">User's Current Badges</p>
                    <div className="flex flex-wrap gap-2">
                      {userBadges.map(ub => (
                        <div key={ub.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] group">
                          <span className="text-lg">{ub.badges?.icon || "🏷️"}</span>
                          <span className="text-[11px] font-bold text-white">{ub.badges?.name || "Unknown"}</span>
                          <button onClick={() => removeBadge(ub.user_id, ub.badge_id)} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                            <X className="h-3 w-3 text-red-400 hover:text-red-300" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick assign from profiles list */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[12px] font-bold text-white mb-3">Quick Assign — Click a user</p>
                  <div className="max-h-[300px] overflow-y-auto space-y-1" style={{ scrollbarWidth: "none" }}>
                    {profiles.slice(0, 30).map(p => (
                      <div key={p.user_id} onClick={() => { setAssignUserId(p.user_id); loadUserBadges(p.user_id); }}
                        className={cn("flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] cursor-pointer transition", assignUserId === p.user_id && "bg-white/[0.06] border border-primary/30")}>
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 text-[10px] font-black text-primary">
                          {p.username?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <span className="text-[12px] text-white font-medium">{p.username || p.user_id.slice(0, 12)}</span>
                        <span className="text-[9px] text-white/20 font-mono ml-auto">{p.user_id.slice(0, 8)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {badgeTab === "verify" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-blue-400" />
                    <p className="text-[12px] font-bold text-white">Verified Badge</p>
                  </div>
                  <p className="text-[10px] text-white/40">Toggle the blue verified checkmark on a user's profile. This is separate from custom badges.</p>
                  <div>
                    <Label className="text-[10px] text-white/30">User ID</Label>
                    <Input value={verifyUserId} onChange={e => setVerifyUserId(e.target.value)} placeholder="Paste user_id..." className="h-9 bg-white/[0.03] border-white/[0.08] text-[12px]" />
                  </div>
                  <ActionButton icon={Shield} label="Toggle Verified" onClick={toggleVerified} variant="success" />
                </div>

                {/* Quick verify from profiles */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[12px] font-bold text-white mb-3">Quick Verify — Click a user</p>
                  <div className="max-h-[300px] overflow-y-auto space-y-1" style={{ scrollbarWidth: "none" }}>
                    {profiles.slice(0, 30).map(p => (
                      <div key={p.user_id} onClick={() => setVerifyUserId(p.user_id)}
                        className={cn("flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] cursor-pointer transition", verifyUserId === p.user_id && "bg-white/[0.06] border border-primary/30")}>
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 text-[10px] font-black text-primary">
                          {p.username?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <span className="text-[12px] text-white font-medium">{p.username || p.user_id.slice(0, 12)}</span>
                        {(p as any).verified && <Shield className="h-3.5 w-3.5 text-blue-400 ml-auto" />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };


  /* ═══════════════════════════════════════════════════════════════
     SECTION 11: PLATFORM SETTINGS
     ═══════════════════════════════════════════════════════════════ */

  const PlatformSettingsSection = () => {
    const [settingsTab, setSettingsTab] = useState<"general" | "features" | "limits" | "branding">("general");
    const [siteName, setSiteName] = useState("OG Scan");
    const [siteDesc, setSiteDesc] = useState("Meme Coin Tracker");
    const [welcomeMsg, setWelcomeMsg] = useState("");
    const [betaCodes, setBetaCodes] = useState("OG,0129");
    const [regOpen, setRegOpen] = useState(true);
    const [defaultTheme, setDefaultTheme] = useState("og-hacker");
    const [maxPostLen, setMaxPostLen] = useState(5000);
    const [postRateLimit, setPostRateLimit] = useState(10);
    const [dmRateLimit, setDmRateLimit] = useState(30);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      // Load existing settings
      platformSettings.forEach(s => {
        if (s.key === "site_name") setSiteName(s.value as string);
        if (s.key === "site_description") setSiteDesc(s.value as string);
        if (s.key === "welcome_message") setWelcomeMsg(s.value as string);
        if (s.key === "beta_codes") setBetaCodes(Array.isArray(s.value) ? s.value.join(",") : String(s.value ?? ""));
        if (s.key === "registration_open") setRegOpen(s.value === true || s.value === "true");
        if (s.key === "default_theme") setDefaultTheme(s.value as string);
        if (s.key === "max_post_length") setMaxPostLen(Number(s.value) || 5000);
        if (s.key === "post_rate_limit") setPostRateLimit(Number(s.value) || 10);
        if (s.key === "dm_rate_limit") setDmRateLimit(Number(s.value) || 30);
      });
    }, [platformSettings]);

    const saveSetting = async (key: string, value: any, category = "general") => {
      setSaving(true);
      await supabase.from("platform_settings").upsert({ key, value, category, description: key.replace(/_/g, " "), updated_at: new Date().toISOString() }, { onConflict: "key" });
      await supabase.from("admin_audit_log").insert({ admin_user_id: user!.id, action: "update_setting", target_type: "setting", target_id: key, new_values: { value } });
      toast.success(`${key} saved`);
      setSaving(false);
      refresh();
    };

    return (
      <div className="space-y-4">
        <SectionHeader title="Platform Settings" description="Configure OG Scan" />

        <div className="flex gap-2">
          <Pill label="General" active={settingsTab === "general"} onClick={() => setSettingsTab("general")} />
          <Pill label="Features" active={settingsTab === "features"} onClick={() => setSettingsTab("features")} />
          <Pill label="Limits" active={settingsTab === "limits"} onClick={() => setSettingsTab("limits")} />
          <Pill label="Branding" active={settingsTab === "branding"} onClick={() => setSettingsTab("branding")} />
        </div>

        {settingsTab === "general" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div><p className="text-[12px] font-bold text-white">Maintenance Mode</p><p className="text-[10px] text-white/30">Block all non-admin access</p></div>
                <Switch checked={maintenanceOn} onCheckedChange={toggleMaintenance} />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="text-[12px] font-bold text-white">Registration Open</p><p className="text-[10px] text-white/30">Allow new signups</p></div>
                <Switch checked={regOpen} onCheckedChange={v => { setRegOpen(v); saveSetting("registration_open", v); }} />
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
              <div>
                <Label className="text-[10px] text-white/30">Site Name</Label>
                <div className="flex gap-2">
                  <Input value={siteName} onChange={e => setSiteName(e.target.value)} className="h-9 bg-white/[0.03] border-white/[0.08] text-[12px] flex-1" />
                  <Button size="sm" className="h-9 text-[11px]" onClick={() => saveSetting("site_name", siteName)} disabled={saving}>Save</Button>
                </div>
              </div>
              <div>
                <Label className="text-[10px] text-white/30">Description</Label>
                <div className="flex gap-2">
                  <Input value={siteDesc} onChange={e => setSiteDesc(e.target.value)} className="h-9 bg-white/[0.03] border-white/[0.08] text-[12px] flex-1" />
                  <Button size="sm" className="h-9 text-[11px]" onClick={() => saveSetting("site_description", siteDesc)} disabled={saving}>Save</Button>
                </div>
              </div>
              <div>
                <Label className="text-[10px] text-white/30">Beta Codes (comma-separated)</Label>
                <div className="flex gap-2">
                  <Input value={betaCodes} onChange={e => setBetaCodes(e.target.value)} className="h-9 bg-white/[0.03] border-white/[0.08] text-[12px] flex-1" />
                  <Button size="sm" className="h-9 text-[11px]" onClick={() => saveSetting("beta_codes", betaCodes.split(",").map(s => s.trim()))} disabled={saving}>Save</Button>
                </div>
              </div>
              <div>
                <Label className="text-[10px] text-white/30">Welcome Message</Label>
                <Textarea value={welcomeMsg} onChange={e => setWelcomeMsg(e.target.value)} placeholder="Shown to new users..." className="bg-white/[0.03] border-white/[0.08] text-[12px] min-h-[60px]" />
                <Button size="sm" className="h-8 mt-1 text-[10px]" onClick={() => saveSetting("welcome_message", welcomeMsg)} disabled={saving}>Save</Button>
              </div>
            </div>
          </div>
        )}

        {settingsTab === "features" && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            {[
              { key: "voice_rooms_enabled", label: "Voice Rooms", desc: "Enable LiveKit voice" },
              { key: "trading_lobbies_enabled", label: "Trading Lobbies", desc: "Enable lobby creation" },
              { key: "communities_enabled", label: "Communities", desc: "Enable community features" },
              { key: "dms_enabled", label: "Direct Messages", desc: "Enable DM system" },
              { key: "callouts_enabled", label: "Callouts", desc: "Enable trading callouts" },
              { key: "token_submissions_enabled", label: "Token Submissions", desc: "Allow token listing requests" },
              { key: "leaderboard_enabled", label: "Leaderboard", desc: "Show XP leaderboard" },
              { key: "wallet_tracking_enabled", label: "Wallet Tracking", desc: "Enable wallet tracker" },
              { key: "price_alerts_enabled", label: "Price Alerts", desc: "Enable price notifications" },
              { key: "spaces_enabled", label: "Spaces", desc: "Enable live audio spaces" },
            ].map(f => {
              const current = platformSettings.find(s => s.key === f.key);
              const enabled = current?.value === true || current?.value === "true";
              return (
                <div key={f.key} className="flex items-center justify-between">
                  <div>
                    <p className="text-[12px] font-bold text-white">{f.label}</p>
                    <p className="text-[10px] text-white/30">{f.desc}</p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={v => saveSetting(f.key, v, "features")} />
                </div>
              );
            })}
          </div>
        )}

        {settingsTab === "limits" && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
            {[
              { key: "max_post_length", label: "Max Post Length", value: maxPostLen, setter: setMaxPostLen, unit: "chars" },
              { key: "post_rate_limit", label: "Post Rate Limit", value: postRateLimit, setter: setPostRateLimit, unit: "per min" },
              { key: "dm_rate_limit", label: "DM Rate Limit", value: dmRateLimit, setter: setDmRateLimit, unit: "per min" },
            ].map(item => (
              <div key={item.key}>
                <Label className="text-[10px] text-white/30">{item.label} ({item.unit})</Label>
                <div className="flex gap-2">
                  <Input type="number" value={item.value} onChange={e => item.setter(Number(e.target.value))} className="h-9 bg-white/[0.03] border-white/[0.08] text-[12px] flex-1" />
                  <Button size="sm" className="h-9 text-[11px]" onClick={() => saveSetting(item.key, item.value, "limits")} disabled={saving}>Save</Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {settingsTab === "branding" && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <div>
              <Label className="text-[10px] text-white/30">Default Theme</Label>
              <Select value={defaultTheme} onValueChange={v => { setDefaultTheme(v); saveSetting("default_theme", v, "branding"); }}>
                <SelectTrigger className="h-9 bg-white/[0.03] border-white/[0.08] text-[12px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="og-hacker">OG Hacker</SelectItem>
                  <SelectItem value="og-matrix">OG Matrix</SelectItem>
                  <SelectItem value="og-radar">OG Radar</SelectItem>
                  <SelectItem value="og-command-deck">OG Command Deck</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "og-hacker", name: "OG Hacker", colors: ["#22d3ee", "#0a1a2e"] },
                { id: "og-matrix", name: "OG Matrix", colors: ["#22c55e", "#0a1a0a"] },
                { id: "og-radar", name: "OG Radar", colors: ["#f59e0b", "#1a150a"] },
                { id: "og-command-deck", name: "OG Command Deck", colors: ["#a855f7", "#1a0a2e"] },
              ].map(t => (
                <div key={t.id} className={cn("rounded-xl border p-3 cursor-pointer transition", defaultTheme === t.id ? "border-white/20 bg-white/[0.04]" : "border-white/[0.06] hover:border-white/[0.1]")} onClick={() => { setDefaultTheme(t.id); saveSetting("default_theme", t.id, "branding"); }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-4 w-4 rounded-full" style={{ background: t.colors[0] }} />
                    <div className="h-4 w-4 rounded-full" style={{ background: t.colors[1] }} />
                  </div>
                  <p className="text-[12px] font-bold text-white">{t.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     SECTION 12: SECURITY CENTER
     ═══════════════════════════════════════════════════════════════ */

  const SecurityCenter = () => {
    const [secTab, setSecTab] = useState<"devices" | "flagged" | "events" | "audit" | "access">("devices");
    const [auditSearch, setAuditSearch] = useState("");
    const [adminRoles, setAdminRoles] = useState<any[]>([]);
    const [devices, setDevices] = useState<any[]>([]);
    const [authEvents, setAuthEvents] = useState<any[]>([]);
    const [flaggedGroups, setFlaggedGroups] = useState<{ type: string; key: string; users: any[] }[]>([]);
    const [deviceSearch, setDeviceSearch] = useState("");
    const [eventSearch, setEventSearch] = useState("");
    const [selectedUser, setSelectedUser] = useState<any | null>(null);
    const [banDialog, setBanDialog] = useState<{ user: any; action: "ban" | "suspend" | "unban" | "unsuspend" } | null>(null);
    const [banReason, setBanReason] = useState("");
    const [loaded, setLoaded] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [stats, setStats] = useState({ totalDevices: 0, uniqueIPs: 0, uniqueFingerprints: 0, bannedUsers: 0, suspendedUsers: 0, eventsToday: 0 });

    /* ── Load data ── */
    const loadAll = useCallback(async () => {
      const [devRes, evRes, roleRes] = await Promise.all([
        supabase.from("user_devices").select("*").order("last_seen_at", { ascending: false }).limit(500),
        supabase.from("auth_events").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("admin_roles").select("*"),
      ]);
      const devs = devRes.data ?? [];
      const evts = evRes.data ?? [];
      setDevices(devs);
      setAuthEvents(evts);
      setAdminRoles(roleRes.data ?? []);

      /* stats */
      const ips = new Set(devs.map((d: any) => d.ip_address).filter(Boolean));
      const fps = new Set(devs.map((d: any) => d.fingerprint).filter(Boolean));
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEvents = evts.filter((e: any) => e.created_at >= todayStart).length;
      const banned = profiles.filter((p: any) => (p as any).is_banned).length;
      const suspended = profiles.filter((p: any) => (p as any).is_suspended).length;
      setStats({ totalDevices: devs.length, uniqueIPs: ips.size, uniqueFingerprints: fps.size, bannedUsers: banned, suspendedUsers: suspended, eventsToday: todayEvents });

      setLoaded(true);
    }, [profiles]);

    useEffect(() => { if (!loaded) loadAll(); }, [loaded, loadAll]);

    /* ── Duplicate scan ── */
    const runDuplicateScan = useCallback(async () => {
      setScanning(true);
      const groups: { type: string; key: string; users: any[] }[] = [];

      /* Group by fingerprint */
      const fpMap: Record<string, Set<string>> = {};
      devices.forEach((d: any) => {
        if (!d.fingerprint) return;
        if (!fpMap[d.fingerprint]) fpMap[d.fingerprint] = new Set();
        fpMap[d.fingerprint].add(d.user_id);
      });
      for (const [fp, userIds] of Object.entries(fpMap)) {
        if (userIds.size > 1) {
          const users = [...userIds].map(uid => {
            const prof = profiles.find((p: any) => p.user_id === uid);
            const dev = devices.find((d: any) => d.user_id === uid && d.fingerprint === fp);
            return { user_id: uid, username: (prof as any)?.username ?? uid.slice(0, 8), is_banned: (prof as any)?.is_banned, is_suspended: (prof as any)?.is_suspended, ip: dev?.ip_address, last_seen: dev?.last_seen_at };
          });
          groups.push({ type: "fingerprint", key: fp, users });
        }
      }

      /* Group by IP */
      const ipMap: Record<string, Set<string>> = {};
      devices.forEach((d: any) => {
        const ip = d.ip_address;
        if (!ip || ip === "unknown") return;
        if (!ipMap[ip]) ipMap[ip] = new Set();
        ipMap[ip].add(d.user_id);
      });
      for (const [ip, userIds] of Object.entries(ipMap)) {
        if (userIds.size > 1) {
          const existsFp = groups.some(g => g.type === "fingerprint" && JSON.stringify([...g.users.map(u => u.user_id)].sort()) === JSON.stringify([...userIds].sort()));
          const users = [...userIds].map(uid => {
            const prof = profiles.find((p: any) => p.user_id === uid);
            return { user_id: uid, username: (prof as any)?.username ?? uid.slice(0, 8), is_banned: (prof as any)?.is_banned, is_suspended: (prof as any)?.is_suspended, ip, last_seen: devices.find((d: any) => d.user_id === uid)?.last_seen_at };
          });
          groups.push({ type: existsFp ? "ip_only" : "ip", key: ip, users });
        }
      }

      /* Group by wallet */
      const walletMap: Record<string, string[]> = {};
      profiles.forEach((p: any) => {
        if (p.wallet_address) {
          if (!walletMap[p.wallet_address]) walletMap[p.wallet_address] = [];
          walletMap[p.wallet_address].push(p.user_id);
        }
      });
      for (const [wallet, userIds] of Object.entries(walletMap)) {
        if (userIds.length > 1) {
          const users = userIds.map(uid => {
            const prof = profiles.find((p: any) => p.user_id === uid);
            return { user_id: uid, username: (prof as any)?.username ?? uid.slice(0, 8), is_banned: (prof as any)?.is_banned, is_suspended: (prof as any)?.is_suspended, ip: null, last_seen: null };
          });
          groups.push({ type: "wallet", key: wallet.slice(0, 12) + "…", users });
        }
      }

      /* Sort: fingerprint matches first, then ip, then wallet */
      groups.sort((a, b) => {
        const order: Record<string, number> = { fingerprint: 0, ip: 1, ip_only: 2, wallet: 3 };
        return (order[a.type] ?? 9) - (order[b.type] ?? 9);
      });

      setFlaggedGroups(groups);
      setScanning(false);
      if (groups.length === 0) toast.success("No duplicate accounts detected");
      else toast.warning(`Found ${groups.length} suspicious groups`);
    }, [devices, profiles]);

    /* ── Ban / Suspend / Unban / Unsuspend ── */
    const executeBanAction = async () => {
      if (!banDialog) return;
      const { user: u, action } = banDialog;
      const updates: any = {};
      if (action === "ban") { updates.is_banned = true; updates.banned_at = new Date().toISOString(); updates.ban_reason = banReason || "Multi-account violation"; }
      if (action === "suspend") { updates.is_suspended = true; updates.suspended_at = new Date().toISOString(); updates.suspension_reason = banReason || "Suspicious activity"; }
      if (action === "unban") { updates.is_banned = false; updates.ban_reason = null; updates.banned_at = null; }
      if (action === "unsuspend") { updates.is_suspended = false; updates.suspension_reason = null; updates.suspended_at = null; }

      const { error } = await supabase.from("profiles").update(updates).eq("user_id", u.user_id);
      if (error) { toast.error("Failed: " + error.message); return; }

      await supabase.from("admin_audit_log").insert({ admin_user_id: user!.id, action: `security_${action}`, target_type: "user", target_id: u.user_id, new_values: updates });
      toast.success(`User ${action === "ban" ? "banned" : action === "suspend" ? "suspended" : action === "unban" ? "unbanned" : "unsuspended"}`);
      setBanDialog(null);
      setBanReason("");
      setLoaded(false);
    };

    /* ── Helpers ── */
    const filteredLogs = useMemo(() => {
      if (!auditSearch) return auditLogs;
      const q = auditSearch.toLowerCase();
      return auditLogs.filter(l => l.action?.toLowerCase().includes(q) || l.target_type?.toLowerCase().includes(q));
    }, [auditLogs, auditSearch]);

    const filteredDevices = useMemo(() => {
      if (!deviceSearch) return devices;
      const q = deviceSearch.toLowerCase();
      return devices.filter((d: any) => {
        const prof = profiles.find((p: any) => p.user_id === d.user_id);
        return d.fingerprint?.toLowerCase().includes(q) || d.ip_address?.includes(q) || (prof as any)?.username?.toLowerCase().includes(q) || d.user_id?.toLowerCase().includes(q);
      });
    }, [devices, deviceSearch, profiles]);

    const filteredEvents = useMemo(() => {
      if (!eventSearch) return authEvents;
      const q = eventSearch.toLowerCase();
      return authEvents.filter((e: any) => {
        const prof = profiles.find((p: any) => p.user_id === e.user_id);
        return e.ip_address?.includes(q) || e.event_type?.includes(q) || (prof as any)?.username?.toLowerCase().includes(q) || e.fingerprint?.toLowerCase().includes(q);
      });
    }, [authEvents, eventSearch, profiles]);

    const removeAdmin = async (userId: string) => {
      if (!confirm("Remove this admin role?")) return;
      await supabase.from("admin_roles").delete().eq("user_id", userId);
      await supabase.from("admin_audit_log").insert({ admin_user_id: user!.id, action: "remove_admin", target_type: "user", target_id: userId });
      toast.success("Role removed");
      setLoaded(false);
    };

    const exportSecurityData = () => {
      const rows = devices.map((d: any) => {
        const prof = profiles.find((p: any) => p.user_id === d.user_id);
        return `${(prof as any)?.username ?? ""},${d.user_id},${d.fingerprint},${d.ip_address ?? ""},${d.platform ?? ""},${d.screen_resolution ?? ""},${d.timezone ?? ""},${d.last_seen_at}`;
      });
      const csv = ["username,user_id,fingerprint,ip,platform,screen,timezone,last_seen"].concat(rows).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `security-data-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
      toast.success("Security data exported");
    };

    const getUserProfile = (userId: string) => profiles.find((p: any) => p.user_id === userId) as any;
    const riskColor = (type: string) => type === "fingerprint" ? "text-red-400 bg-red-500/10 border-red-500/20" : type === "ip" ? "text-orange-400 bg-orange-500/10 border-orange-500/20" : type === "ip_only" ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" : "text-blue-400 bg-blue-500/10 border-blue-500/20";
    const riskLabel = (type: string) => type === "fingerprint" ? "SAME DEVICE" : type === "ip" ? "SAME IP" : type === "ip_only" ? "SHARED IP" : "SAME WALLET";

    return (
      <div className="space-y-4">
        <SectionHeader title="Security & Anti-Fraud" description="Device fingerprinting, IP tracking, duplicate account detection, and account enforcement" action={<ActionButton icon={Download} label="Export Data" onClick={exportSecurityData} />} />

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <StatCard label="Devices" value={stats.totalDevices} icon={Cpu} color="text-[#22d3ee]" />
          <StatCard label="Unique IPs" value={stats.uniqueIPs} icon={Globe} color="text-blue-400" />
          <StatCard label="Fingerprints" value={stats.uniqueFingerprints} icon={Crosshair} color="text-purple-400" />
          <StatCard label="Banned" value={stats.bannedUsers} icon={Ban} color="text-red-400" />
          <StatCard label="Suspended" value={stats.suspendedUsers} icon={AlertTriangle} color="text-orange-400" />
          <StatCard label="Events Today" value={stats.eventsToday} icon={Activity} color="text-emerald-400" />
        </div>

        {/* ── Sub-tabs ── */}
        <div className="flex gap-2 flex-wrap">
          <Pill label={`Devices (${devices.length})`} active={secTab === "devices"} onClick={() => setSecTab("devices")} />
          <Pill label={`Flagged (${flaggedGroups.length})`} active={secTab === "flagged"} onClick={() => { setSecTab("flagged"); if (flaggedGroups.length === 0 && !scanning) runDuplicateScan(); }} />
          <Pill label={`Events (${authEvents.length})`} active={secTab === "events"} onClick={() => setSecTab("events")} />
          <Pill label={`Audit (${auditLogs.length})`} active={secTab === "audit"} onClick={() => setSecTab("audit")} />
          <Pill label={`Access (${adminRoles.length})`} active={secTab === "access"} onClick={() => setSecTab("access")} />
        </div>

        {/* ═══ DEVICES TAB ═══ */}
        {secTab === "devices" && (
          <div className="space-y-2">
            <SearchBar value={deviceSearch} onChange={setDeviceSearch} placeholder="Search by username, IP, fingerprint..." />
            <div className="space-y-1 max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {filteredDevices.map((d: any) => {
                const prof = getUserProfile(d.user_id);
                return (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.03] transition cursor-pointer" onClick={() => setSelectedUser(d)}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#22d3ee]/10">
                      <Cpu className="h-3.5 w-3.5 text-[#22d3ee]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-semibold text-white truncate">{prof?.username || d.user_id.slice(0, 12)}</p>
                        {prof?.is_banned && <Badge className="text-[8px] border-0 bg-red-500/20 text-red-400">BANNED</Badge>}
                        {prof?.is_suspended && <Badge className="text-[8px] border-0 bg-orange-500/20 text-orange-400">SUSPENDED</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-white/30 font-mono">{d.ip_address ?? "no IP"}</span>
                        <span className="text-[10px] text-white/20">•</span>
                        <span className="text-[10px] text-white/30 font-mono">FP: {d.fingerprint?.slice(0, 10)}…</span>
                        {d.platform && <><span className="text-[10px] text-white/20">•</span><span className="text-[10px] text-white/20">{d.platform.slice(0, 20)}</span></>}
                      </div>
                    </div>
                    <span className="text-[10px] text-white/20 shrink-0">{d.last_seen_at ? formatDistanceToNow(new Date(d.last_seen_at), { addSuffix: true }) : "—"}</span>
                  </div>
                );
              })}
              {filteredDevices.length === 0 && <EmptyState icon={Cpu} title="No device data" desc="Device fingerprints appear after users log in" />}
            </div>
          </div>
        )}

        {/* ═══ FLAGGED / DUPLICATES TAB ═══ */}
        {secTab === "flagged" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-8 text-[11px] gap-1.5" onClick={runDuplicateScan} disabled={scanning}>
                {scanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                {scanning ? "Scanning…" : "Re-scan"}
              </Button>
              <span className="text-[10px] text-white/30">Scans devices, IPs, and wallets for shared accounts</span>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {flaggedGroups.map((group, gi) => (
                <div key={`${group.type}-${group.key}-${gi}`} className={cn("rounded-xl border p-4 space-y-2", riskColor(group.type).replace("text-", "border-").replace(/bg-[^\s]+/, "").replace(/\s+/g, " "), "bg-white/[0.02]")}>
                  <div className="flex items-center gap-2">
                    <Badge className={cn("text-[9px] border font-bold", riskColor(group.type))}>{riskLabel(group.type)}</Badge>
                    <span className="text-[10px] text-white/40 font-mono">{group.key.slice(0, 24)}{group.key.length > 24 ? "…" : ""}</span>
                    <span className="text-[10px] text-white/25 ml-auto">{group.users.length} accounts</span>
                  </div>
                  <div className="space-y-1">
                    {group.users.map((u: any) => (
                      <div key={u.user_id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.03]">
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-semibold text-white">{u.username}</p>
                          {u.is_banned && <Badge className="text-[8px] border-0 bg-red-500/20 text-red-400">BANNED</Badge>}
                          {u.is_suspended && <Badge className="text-[8px] border-0 bg-orange-500/20 text-orange-400">SUSPENDED</Badge>}
                          {u.ip && <span className="text-[10px] text-white/20 font-mono">{u.ip}</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          {!u.is_banned && !u.is_suspended && (
                            <>
                              <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 border-orange-500/30 text-orange-400 hover:bg-orange-500/10" onClick={() => { setBanDialog({ user: u, action: "suspend" }); setBanReason("Multi-account violation"); }}>
                                Suspend
                              </Button>
                              <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => { setBanDialog({ user: u, action: "ban" }); setBanReason("Multi-account violation"); }}>
                                Ban
                              </Button>
                            </>
                          )}
                          {u.is_suspended && !u.is_banned && (
                            <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 border-green-500/30 text-green-400 hover:bg-green-500/10" onClick={() => { setBanDialog({ user: u, action: "unsuspend" }); }}>
                              Unsuspend
                            </Button>
                          )}
                          {u.is_banned && (
                            <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 border-green-500/30 text-green-400 hover:bg-green-500/10" onClick={() => { setBanDialog({ user: u, action: "unban" }); }}>
                              Unban
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {flaggedGroups.length === 0 && !scanning && <EmptyState icon={Shield} title="No duplicates found" desc="All accounts look unique" />}
              {scanning && <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-white/30" /></div>}
            </div>
          </div>
        )}

        {/* ═══ AUTH EVENTS TAB ═══ */}
        {secTab === "events" && (
          <div className="space-y-2">
            <SearchBar value={eventSearch} onChange={setEventSearch} placeholder="Search events by user, IP, type..." />
            <div className="space-y-1 max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {filteredEvents.map((e: any) => {
                const prof = getUserProfile(e.user_id);
                return (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.03] transition">
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", e.event_type === "login" ? "bg-emerald-500/10" : "bg-blue-500/10")}>
                      {e.event_type === "login" ? <Key className="h-3.5 w-3.5 text-emerald-400" /> : <RefreshCw className="h-3.5 w-3.5 text-blue-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-semibold text-white">{prof?.username || e.user_id.slice(0, 12)}</p>
                        <Badge variant="outline" className="text-[9px] border-white/10 text-white/40">{e.event_type}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-white/30 font-mono">{e.ip_address ?? "no IP"}</span>
                        {e.fingerprint && <><span className="text-[10px] text-white/20">•</span><span className="text-[10px] text-white/20 font-mono">FP: {e.fingerprint.slice(0, 10)}</span></>}
                      </div>
                    </div>
                    <span className="text-[10px] text-white/20 shrink-0">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</span>
                  </div>
                );
              })}
              {filteredEvents.length === 0 && <EmptyState icon={Activity} title="No auth events yet" desc="Login events appear after users sign in" />}
            </div>
          </div>
        )}

        {/* ═══ AUDIT LOG TAB ═══ */}
        {secTab === "audit" && (
          <div className="space-y-2">
            <SearchBar value={auditSearch} onChange={setAuditSearch} placeholder="Search actions..." />
            <div className="space-y-1 max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {filteredLogs.map(log => (
                <div key={log.id} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.03] transition">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
                    <ShieldAlert className="h-3.5 w-3.5 text-orange-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] border-white/10 text-white/50">{log.action}</Badge>
                      {log.target_type && <span className="text-[10px] text-white/30">{log.target_type}</span>}
                    </div>
                    {log.target_id && <p className="text-[10px] text-white/20 font-mono mt-0.5">{log.target_id}</p>}
                  </div>
                  <span className="text-[10px] text-white/20 shrink-0">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                </div>
              ))}
              {filteredLogs.length === 0 && <EmptyState icon={ShieldAlert} title="No audit logs" desc="Admin actions will be logged here" />}
            </div>
          </div>
        )}

        {/* ═══ ACCESS CONTROL TAB ═══ */}
        {secTab === "access" && (
          <div className="space-y-2">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[12px] font-bold text-white mb-3">Admin & Moderator Roles</p>
              <div className="space-y-1">
                {adminRoles.map((r: any) => {
                  const prof = getUserProfile(r.user_id);
                  return (
                    <div key={r.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/[0.03]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-[11px] font-black text-purple-400">
                          {prof?.username?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-white">{prof?.username || r.user_id.slice(0, 12)}</p>
                          <p className="text-[10px] text-white/30 font-mono">{r.user_id.slice(0, 20)}…</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-[9px] border-0", r.role === "owner" ? "bg-amber-500/20 text-amber-400" : r.role === "admin" ? "bg-red-500/20 text-red-400" : "bg-purple-500/20 text-purple-400")}>{r.role?.toUpperCase()}</Badge>
                        {r.role !== "owner" && <ActionButton icon={Trash2} label="" onClick={() => removeAdmin(r.user_id)} variant="danger" size="xs" />}
                      </div>
                    </div>
                  );
                })}
                {adminRoles.length === 0 && <p className="text-[12px] text-white/25 text-center py-4">No roles assigned</p>}
              </div>
            </div>
          </div>
        )}

        {/* ═══ DEVICE DETAIL PANEL ═══ */}
        {selectedUser && (() => {
          const d = selectedUser;
          const prof = getUserProfile(d.user_id);
          const userDevices = devices.filter((dd: any) => dd.user_id === d.user_id);
          const userEvents = authEvents.filter((e: any) => e.user_id === d.user_id);
          const sameFingerprint = devices.filter((dd: any) => dd.fingerprint === d.fingerprint && dd.user_id !== d.user_id);
          const sameIp = devices.filter((dd: any) => dd.ip_address === d.ip_address && dd.user_id !== d.user_id && dd.ip_address && dd.ip_address !== "unknown");
          return (
            <Dialog open onOpenChange={() => setSelectedUser(null)}>
              <DialogContent className="max-w-lg bg-[#0a0a0f] border-white/10">
                <DialogHeader>
                  <DialogTitle className="text-white flex items-center gap-2">
                    <Shield className="h-4 w-4 text-orange-400" />
                    {prof?.username || d.user_id.slice(0, 12)} — Device Intel
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-[11px]">
                  {/* User info */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-white/[0.03] p-2.5"><span className="text-white/30 block">User ID</span><span className="text-white font-mono text-[10px] break-all">{d.user_id}</span></div>
                    <div className="rounded-lg bg-white/[0.03] p-2.5"><span className="text-white/30 block">Status</span><span className={cn("font-bold", prof?.is_banned ? "text-red-400" : prof?.is_suspended ? "text-orange-400" : "text-green-400")}>{prof?.is_banned ? "BANNED" : prof?.is_suspended ? "SUSPENDED" : "Active"}</span></div>
                    <div className="rounded-lg bg-white/[0.03] p-2.5"><span className="text-white/30 block">IP Address</span><span className="text-white font-mono">{d.ip_address ?? "unknown"}</span></div>
                    <div className="rounded-lg bg-white/[0.03] p-2.5"><span className="text-white/30 block">Fingerprint</span><span className="text-white font-mono text-[10px]">{d.fingerprint}</span></div>
                    <div className="rounded-lg bg-white/[0.03] p-2.5"><span className="text-white/30 block">Platform</span><span className="text-white">{d.platform ?? "—"}</span></div>
                    <div className="rounded-lg bg-white/[0.03] p-2.5"><span className="text-white/30 block">Screen</span><span className="text-white">{d.screen_resolution ?? "—"}</span></div>
                    <div className="rounded-lg bg-white/[0.03] p-2.5"><span className="text-white/30 block">Timezone</span><span className="text-white">{d.timezone ?? "—"}</span></div>
                    <div className="rounded-lg bg-white/[0.03] p-2.5"><span className="text-white/30 block">Language</span><span className="text-white">{d.language ?? "—"}</span></div>
                  </div>
                  {/* Linked accounts */}
                  {(sameFingerprint.length > 0 || sameIp.length > 0) && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 space-y-2">
                      <p className="text-[11px] font-bold text-red-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Linked Accounts Detected</p>
                      {sameFingerprint.length > 0 && (
                        <div><p className="text-[10px] text-red-300/70 mb-1">Same device fingerprint:</p>
                        {sameFingerprint.map((dd: any) => { const p2 = getUserProfile(dd.user_id); return <p key={dd.id} className="text-[10px] text-white/60 font-mono">{p2?.username || dd.user_id.slice(0, 12)} ({dd.ip_address})</p>; })}</div>
                      )}
                      {sameIp.length > 0 && (
                        <div><p className="text-[10px] text-orange-300/70 mb-1">Same IP address:</p>
                        {sameIp.map((dd: any) => { const p2 = getUserProfile(dd.user_id); return <p key={dd.id} className="text-[10px] text-white/60 font-mono">{p2?.username || dd.user_id.slice(0, 12)} (FP: {dd.fingerprint?.slice(0, 10)})</p>; })}</div>
                      )}
                    </div>
                  )}
                  {/* Login history */}
                  <div><p className="text-[11px] font-bold text-white mb-1">Login History ({userEvents.length})</p>
                    <div className="space-y-0.5 max-h-32 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                      {userEvents.slice(0, 20).map((e: any) => (
                        <div key={e.id} className="flex items-center justify-between px-2 py-1 rounded-md hover:bg-white/[0.02]">
                          <span className="text-[10px] text-white/40 font-mono">{e.ip_address} — {e.event_type}</span>
                          <span className="text-[10px] text-white/20">{format(new Date(e.created_at), "MMM d, HH:mm")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-white/[0.06]">
                    {!prof?.is_banned && !prof?.is_suspended && (
                      <>
                        <Button size="sm" variant="outline" className="h-8 text-[10px] border-orange-500/30 text-orange-400 hover:bg-orange-500/10 flex-1" onClick={() => { setBanDialog({ user: { user_id: d.user_id, username: prof?.username }, action: "suspend" }); setBanReason(""); setSelectedUser(null); }}>Suspend</Button>
                        <Button size="sm" variant="outline" className="h-8 text-[10px] border-red-500/30 text-red-400 hover:bg-red-500/10 flex-1" onClick={() => { setBanDialog({ user: { user_id: d.user_id, username: prof?.username }, action: "ban" }); setBanReason(""); setSelectedUser(null); }}>Ban</Button>
                      </>
                    )}
                    {prof?.is_suspended && <Button size="sm" variant="outline" className="h-8 text-[10px] border-green-500/30 text-green-400 hover:bg-green-500/10 flex-1" onClick={() => { setBanDialog({ user: { user_id: d.user_id, username: prof?.username }, action: "unsuspend" }); setSelectedUser(null); }}>Unsuspend</Button>}
                    {prof?.is_banned && <Button size="sm" variant="outline" className="h-8 text-[10px] border-green-500/30 text-green-400 hover:bg-green-500/10 flex-1" onClick={() => { setBanDialog({ user: { user_id: d.user_id, username: prof?.username }, action: "unban" }); setSelectedUser(null); }}>Unban</Button>}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}

        {/* ═══ BAN/SUSPEND CONFIRMATION DIALOG ═══ */}
        {banDialog && (
          <Dialog open onOpenChange={() => setBanDialog(null)}>
            <DialogContent className="max-w-sm bg-[#0a0a0f] border-white/10">
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  {banDialog.action === "ban" ? <Ban className="h-4 w-4 text-red-400" /> : banDialog.action === "suspend" ? <AlertTriangle className="h-4 w-4 text-orange-400" /> : <UserCheck className="h-4 w-4 text-green-400" />}
                  {banDialog.action === "ban" ? "Ban" : banDialog.action === "suspend" ? "Suspend" : banDialog.action === "unban" ? "Unban" : "Unsuspend"} User
                </DialogTitle>
                <DialogDescription className="text-white/40 text-[11px]">
                  {banDialog.action === "ban" || banDialog.action === "suspend"
                    ? `This will ${banDialog.action} "${banDialog.user.username || banDialog.user.user_id.slice(0, 12)}". They'll be signed out on next visit.`
                    : `Restore access for "${banDialog.user.username || banDialog.user.user_id.slice(0, 12)}".`}
                </DialogDescription>
              </DialogHeader>
              {(banDialog.action === "ban" || banDialog.action === "suspend") && (
                <div className="space-y-1">
                  <Label className="text-[11px] text-white/50">Reason</Label>
                  <Input value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Multi-account violation" className="h-8 text-[11px] bg-white/[0.04] border-white/10" />
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" size="sm" className="h-8 text-[11px]" onClick={() => setBanDialog(null)}>Cancel</Button>
                <Button size="sm" className={cn("h-8 text-[11px]", banDialog.action === "ban" ? "bg-red-600 hover:bg-red-700" : banDialog.action === "suspend" ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700")} onClick={executeBanAction}>
                  Confirm {banDialog.action === "ban" ? "Ban" : banDialog.action === "suspend" ? "Suspend" : banDialog.action === "unban" ? "Unban" : "Unsuspend"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     SECTION 13: SUPPORT & TICKETS
     ═══════════════════════════════════════════════════════════════ */

  const SupportTicketsSection = () => {
    const [ticketFilter, setTicketFilter] = useState<"all" | "open" | "closed">("all");
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [ticketMessages, setTicketMessages] = useState<any[]>([]);
    const [replyText, setReplyText] = useState("");
    const [sending, setSending] = useState(false);

    const filtered = useMemo(() => {
      if (ticketFilter === "all") return supportTickets;
      if (ticketFilter === "open") return supportTickets.filter(t => t.status === "open" || t.status === "pending");
      return supportTickets.filter(t => t.status === "closed" || t.status === "resolved");
    }, [supportTickets, ticketFilter]);

    const loadTicket = async (ticket: SupportTicket) => {
      setSelectedTicket(ticket);
      const { data } = await supabase.from("support_messages").select("*").eq("ticket_id", ticket.id).order("created_at", { ascending: true });
      setTicketMessages(data ?? []);
    };

    const replyToTicket = async () => {
      if (!replyText || !selectedTicket) return;
      setSending(true);
      await supabase.from("support_messages").insert({ ticket_id: selectedTicket.id, user_id: user!.id, content: replyText, is_admin: true });
      await supabase.from("support_tickets").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", selectedTicket.id);
      toast.success("Reply sent");
      setReplyText("");
      loadTicket(selectedTicket);
      setSending(false);
    };

    const closeTicket = async (id: string) => {
      await supabase.from("support_tickets").update({ status: "closed", updated_at: new Date().toISOString() }).eq("id", id);
      toast.success("Ticket closed");
      setSelectedTicket(null);
      refresh();
    };

    return (
      <div className="space-y-4">
        <SectionHeader title="Support & Tickets" description={`${stats.openTickets} open · ${supportTickets.length} total`} />

        <div className="flex gap-2">
          <Pill label={`All (${supportTickets.length})`} active={ticketFilter === "all"} onClick={() => setTicketFilter("all")} />
          <Pill label={`Open (${stats.openTickets})`} active={ticketFilter === "open"} onClick={() => setTicketFilter("open")} />
          <Pill label="Closed" active={ticketFilter === "closed"} onClick={() => setTicketFilter("closed")} />
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {filtered.map(t => (
            <div key={t.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.1] transition cursor-pointer" onClick={() => loadTicket(t)}>
              <div className="flex items-center gap-3">
                <div className={cn("h-2 w-2 rounded-full shrink-0", t.status === "open" || t.status === "pending" ? "bg-amber-400" : t.status === "in_progress" ? "bg-blue-400" : "bg-emerald-400")} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-white truncate">{t.subject}</p>
                  <p className="text-[10px] text-white/30">{t.username || t.user_id?.slice(0, 12)} · {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</p>
                </div>
                <Badge className={cn("text-[9px] border-0", t.priority === "high" || t.priority === "urgent" ? "bg-red-500/20 text-red-400" : "bg-white/[0.06] text-white/30")}>{t.priority || "normal"}</Badge>
                <Badge className={cn("text-[9px] border-0", t.status === "open" ? "bg-amber-500/20 text-amber-400" : t.status === "in_progress" ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400")}>{t.status}</Badge>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <EmptyState icon={Inbox} title="No tickets" desc="Support tickets will appear here" />}
        </div>

        {/* Ticket Detail */}
        <Dialog open={!!selectedTicket} onOpenChange={v => !v && setSelectedTicket(null)}>
          <DialogContent className="max-w-lg bg-[#0a1018] border-white/[0.08] max-h-[85vh] overflow-y-auto">
            {selectedTicket && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-white text-base font-black">{selectedTicket.subject}</DialogTitle>
                  <DialogDescription className="text-white/30 text-[11px]">{selectedTicket.status} · {selectedTicket.priority}</DialogDescription>
                </DialogHeader>
                <div className="space-y-2 max-h-[300px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                  {ticketMessages.map(m => (
                    <div key={m.id} className={cn("rounded-lg p-3", m.is_admin ? "bg-blue-500/10 border border-blue-500/20 ml-6" : "bg-white/[0.03] border border-white/[0.06] mr-6")}>
                      <p className="text-[10px] font-bold text-white/40 mb-1">{m.is_admin ? "Admin" : "User"} · {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</p>
                      <p className="text-[12px] text-white/60">{m.content}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Type reply..." className="h-9 bg-white/[0.03] border-white/[0.08] text-[12px] flex-1" onKeyDown={e => e.key === "Enter" && replyToTicket()} />
                  <Button size="sm" className="h-9" onClick={replyToTicket} disabled={sending}><Send className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="flex gap-2 mt-1">
                  <ActionButton icon={CheckCircle} label="Close Ticket" onClick={() => closeTicket(selectedTicket.id)} variant="success" />
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     SECTION 14: DM & CHAT MANAGEMENT
     ═══════════════════════════════════════════════════════════════ */

  const DmChatManagement = () => {
    const [dmData, setDmData] = useState<any[]>([]);
    const [socialMsgs, setSocialMsgs] = useState<any[]>([]);
    const [chatTab, setChatTab] = useState<"dms" | "social" | "moderation">("dms");
    const [loaded, setLoaded] = useState(false);
    const [stats2, setStats2] = useState({ totalDms: 0, totalSocial: 0, todayMessages: 0 });

    useEffect(() => {
      if (loaded) return;
      (async () => {
        const [dms, social] = await Promise.all([
          supabase.from("dm_conversations").select("*").order("last_message_at", { ascending: false }).limit(50),
          supabase.from("social_messages").select("*").order("created_at", { ascending: false }).limit(100),
        ]);
        setDmData(dms.data ?? []);
        setSocialMsgs(social.data ?? []);
        const { count: dmCount } = await supabase.from("dm_messages").select("id", { count: "exact", head: true });
        setStats2({ totalDms: dms.data?.length ?? 0, totalSocial: social.data?.length ?? 0, todayMessages: dmCount ?? 0 });
        setLoaded(true);
      })();
    }, [loaded]);

    const deleteMessage = async (table: string, id: string) => {
      await supabase.from(table).delete().eq("id", id);
      toast.success("Message deleted");
      setLoaded(false);
    };

    return (
      <div className="space-y-4">
        <SectionHeader title="DM & Chat Management" description={`${stats2.totalDms} conversations · ${stats2.totalSocial} social messages`} action={<ActionButton icon={RefreshCw} label="Reload" onClick={() => setLoaded(false)} />} />

        <div className="flex gap-2">
          <Pill label={`DMs (${dmData.length})`} active={chatTab === "dms"} onClick={() => setChatTab("dms")} />
          <Pill label={`Social (${socialMsgs.length})`} active={chatTab === "social"} onClick={() => setChatTab("social")} />
          <Pill label="Moderation" active={chatTab === "moderation"} onClick={() => setChatTab("moderation")} />
        </div>

        {chatTab === "dms" && (
          <div className="space-y-1 max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {dmData.map((d: any) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.03]">
                <MessageSquare className="h-4 w-4 text-violet-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-white">{Array.isArray(d.participant_ids) ? d.participant_ids.map((id: string) => id.slice(0, 6)).join(" ↔ ") : d.id.slice(0, 12)}</p>
                  <p className="text-[10px] text-white/30">{d.last_message_at ? formatDistanceToNow(new Date(d.last_message_at), { addSuffix: true }) : "No messages"}</p>
                </div>
              </div>
            ))}
            {dmData.length === 0 && <EmptyState icon={MessageSquare} title="No DM conversations" desc="DM data will appear here" />}
          </div>
        )}

        {chatTab === "social" && (
          <div className="space-y-1 max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {socialMsgs.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.03]">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-white/60 line-clamp-1">{m.content || m.message}</p>
                  <p className="text-[10px] text-white/25">{m.user_id?.slice(0, 8)} · {m.created_at ? formatDistanceToNow(new Date(m.created_at), { addSuffix: true }) : ""}</p>
                </div>
                <ActionButton icon={Trash2} label="" onClick={() => deleteMessage("social_messages", m.id)} variant="danger" size="xs" />
              </div>
            ))}
            {socialMsgs.length === 0 && <EmptyState icon={MessageSquare} title="No messages" desc="Social messages will appear here" />}
          </div>
        )}

        {chatTab === "moderation" && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="DM Conversations" value={stats2.totalDms} icon={MessageSquare} color="text-violet-400" />
              <StatCard label="Social Messages" value={stats2.totalSocial} icon={Globe} color="text-blue-400" />
              <StatCard label="Total DM Messages" value={stats2.todayMessages} icon={Mail} color="text-pink-400" />
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[12px] font-bold text-white mb-2">Bulk Cleanup</p>
              <div className="flex flex-wrap gap-2">
                <ActionButton icon={Trash2} label="Purge old DMs (30d+)" variant="danger" onClick={async () => {
                  if (!confirm("Delete all DM messages older than 30 days?")) return;
                  const cutoff = subDays(new Date(), 30).toISOString();
                  await supabase.from("dm_messages").delete().lt("created_at", cutoff);
                  toast.success("Old DMs purged");
                }} />
                <ActionButton icon={Trash2} label="Purge old social msgs (30d+)" variant="danger" onClick={async () => {
                  if (!confirm("Delete all social messages older than 30 days?")) return;
                  const cutoff = subDays(new Date(), 30).toISOString();
                  await supabase.from("social_messages").delete().lt("created_at", cutoff);
                  toast.success("Old social messages purged");
                }} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     SECTION 15: DATA & EXPORT TOOLS
     ═══════════════════════════════════════════════════════════════ */

  /* ═══════════════════════════════════════════════════════════════
     CONTENT DATA — Downloadable content files for social media team
     ═══════════════════════════════════════════════════════════════ */
  const ContentData = () => {
    const [downloading, setDownloading] = useState<string | null>(null);

    const files = [
      {
        id: "updates",
        icon: FileText,
        title: "Full Feature Updates (48h)",
        desc: "Complete changelog of every new feature, fix, and improvement. Use this as the master source for all content.",
        filename: "og-scan-updates-48h.md",
        color: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/20",
        iconColor: "text-cyan-400",
        badge: "153 Commits",
      },
      {
        id: "content",
        icon: Megaphone,
        title: "Content Strategy & Ideas",
        desc: "Content pillars, post templates, structures, hashtag strategy, engagement tactics, and weekly schedule template.",
        filename: "og-scan-content-plan.md",
        color: "from-purple-500/20 to-purple-500/5 border-purple-500/20",
        iconColor: "text-purple-400",
        badge: "Strategy",
      },
      {
        id: "calendar",
        icon: Calendar,
        title: "2-Week Daily Content Calendar",
        desc: "14-day plan — one feature per day with full tweet copy, thread structure, and image/visual ideas for each post.",
        filename: "og-scan-2week-calendar.md",
        color: "from-amber-500/20 to-amber-500/5 border-amber-500/20",
        iconColor: "text-amber-400",
        badge: "14 Days",
      },
    ];

    const downloadFile = async (filename: string, id: string) => {
      setDownloading(id);
      try {
        const response = await fetch(`/content/${filename}`);
        if (!response.ok) throw new Error("File not found");
        const text = await response.text();
        const blob = new Blob([text], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${filename}`);
      } catch {
        toast.error("Download failed");
      }
      setDownloading(null);
    };

    return (
      <div className="space-y-4">
        <SectionHeader title="Data" description="Downloadable content files for your content manager and social media team" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {files.map(f => (
            <div
              key={f.id}
              className={cn(
                "group relative rounded-2xl border bg-gradient-to-b p-5 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl",
                f.color,
              )}
              onClick={() => downloadFile(f.filename, f.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06]", f.iconColor)}>
                  <f.icon className="h-5 w-5" />
                </div>
                <Badge className="text-[9px] border-0 bg-white/[0.08] text-white/50">{f.badge}</Badge>
              </div>
              <h3 className="text-[13px] font-bold text-white mb-1">{f.title}</h3>
              <p className="text-[11px] text-white/40 leading-relaxed mb-4">{f.desc}</p>
              <div className="flex items-center gap-2 text-[11px]">
                {downloading === f.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-white/30 group-hover:text-white/60 transition" />
                )}
                <span className="text-white/30 group-hover:text-white/60 transition font-medium">
                  {downloading === f.id ? "Downloading…" : "Click to download"}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 mt-4">
          <p className="text-[12px] font-bold text-white mb-2">📋 How to use these files</p>
          <div className="space-y-1.5 text-[11px] text-white/40">
            <p>1. <strong className="text-white/60">Feature Updates</strong> — Master list of everything new. Reference this when writing any post.</p>
            <p>2. <strong className="text-white/60">Content Strategy</strong> — Templates, hashtags, and formats. Copy-paste the thread structures.</p>
            <p>3. <strong className="text-white/60">2-Week Calendar</strong> — Follow day by day. One feature per post. Ready-to-use tweet copy included.</p>
          </div>
        </div>
      </div>
    );
  };

  const DataExport = () => {
    const [tableCounts, setTableCounts] = useState<{ name: string; count: number }[]>([]);
    const [loaded, setLoaded] = useState(false);

    const TABLES = [
      "profiles", "communities", "community_posts", "community_post_replies",
      "community_members", "community_post_likes", "community_bookmarks",
      "trading_lobbies", "lobby_members", "lobby_messages",
      "spaces", "space_messages", "space_polls",
      "social_voice_rooms", "social_messages",
      "dm_conversations", "dm_messages",
      "notifications", "support_tickets", "support_messages",
      "callouts", "tracked_wallets", "price_alerts",
      "pump_v5_submissions", "admin_audit_log", "admin_roles",
      "leaderboard", "user_credits", "credit_transactions",
      "followers", "user_activities", "trade_history",
    ];

    useEffect(() => {
      if (loaded) return;
      (async () => {
        const counts: { name: string; count: number }[] = [];
        for (const t of TABLES) {
          const { count } = await supabase.from(t).select("id", { count: "exact", head: true });
          counts.push({ name: t, count: count ?? 0 });
        }
        counts.sort((a, b) => b.count - a.count);
        setTableCounts(counts);
        setLoaded(true);
      })();
    }, [loaded]);

    const exportTable = async (table: string) => {
      toast.info(`Exporting ${table}...`);
      const { data, error } = await supabase.from(table).select("*").limit(10000);
      if (error || !data) { toast.error("Export failed"); return; }
      const csv = data.length > 0 ? [Object.keys(data[0]).join(","), ...data.map(row => Object.values(row).map(v => JSON.stringify(v ?? "")).join(","))].join("\n") : "No data";
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${table}-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
      toast.success(`${table} exported (${data.length} rows)`);
    };

    const exportAll = async () => {
      toast.info("Exporting all tables...");
      const allData: Record<string, any[]> = {};
      for (const t of TABLES) {
        const { data } = await supabase.from(t).select("*").limit(10000);
        allData[t] = data ?? [];
      }
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `ogscan-full-export-${format(new Date(), "yyyy-MM-dd")}.json`; a.click();
      toast.success("Full export complete");
    };

    return (
      <div className="space-y-4">
        <SectionHeader title="Data & Export Tools" description="Database overview and export" action={
          <div className="flex gap-2">
            <ActionButton icon={Download} label="Export All (JSON)" onClick={exportAll} variant="success" />
            <ActionButton icon={RefreshCw} label="Reload" onClick={() => setLoaded(false)} />
          </div>
        } />

        {!loaded ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-white/30" /><span className="ml-2 text-[12px] text-white/30">Counting rows...</span></div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Tables" value={TABLES.length} icon={Database} color="text-lime-400" />
              <StatCard label="Total Rows" value={tableCounts.reduce((s, t) => s + t.count, 0).toLocaleString()} icon={Layers} color="text-emerald-400" />
              <StatCard label="Largest Table" value={tableCounts[0]?.name || "—"} icon={BarChart3} color="text-blue-400" sub={`${tableCounts[0]?.count.toLocaleString()} rows`} />
              <StatCard label="Empty Tables" value={tableCounts.filter(t => t.count === 0).length} icon={CircleDot} color="text-white/30" />
            </div>

            <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04]">
              {tableCounts.map(t => (
                <div key={t.name} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition">
                  <Database className="h-3.5 w-3.5 text-white/20 shrink-0" />
                  <span className="text-[12px] font-mono text-white/60 flex-1">{t.name}</span>
                  <span className={cn("text-[12px] font-bold", t.count > 0 ? "text-emerald-400" : "text-white/20")}>{t.count.toLocaleString()}</span>
                  {t.count > 0 && <ActionButton icon={Download} label="CSV" onClick={() => exportTable(t.name)} size="xs" />}
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[12px] font-bold text-white mb-2">Cleanup Tools</p>
              <div className="flex flex-wrap gap-2">
                <ActionButton icon={Trash2} label="Purge Notifications (30d+)" variant="danger" onClick={async () => {
                  if (!confirm("Delete notifications older than 30 days?")) return;
                  await supabase.from("notifications").delete().lt("created_at", subDays(new Date(), 30).toISOString());
                  toast.success("Old notifications purged"); setLoaded(false);
                }} />
                <ActionButton icon={Trash2} label="Purge Audit Logs (90d+)" variant="danger" onClick={async () => {
                  if (!confirm("Delete audit logs older than 90 days?")) return;
                  await supabase.from("admin_audit_log").delete().lt("created_at", subDays(new Date(), 90).toISOString());
                  toast.success("Old audit logs purged"); setLoaded(false);
                }} />
                <ActionButton icon={Trash2} label="Clear Empty Tables" variant="danger" onClick={() => toast.info("Nothing to clear — empty tables don't take space")} />
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     SECTION 16: DEVELOPER & API
     ═══════════════════════════════════════════════════════════════ */

  const DeveloperApi = () => {
    const [devTab, setDevTab] = useState<"overview" | "api" | "webhooks">("overview");
    const [voiceRooms, setVoiceRooms] = useState<any[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
      if (loaded) return;
      (async () => {
        const { data } = await supabase.from("social_voice_rooms").select("*").order("created_at", { ascending: false }).limit(20);
        setVoiceRooms(data ?? []);
        setLoaded(true);
      })();
    }, [loaded]);

    return (
      <div className="space-y-4">
        <SectionHeader title="Developer & API" description="Technical tools and integrations" />

        <div className="flex gap-2">
          <Pill label="Overview" active={devTab === "overview"} onClick={() => setDevTab("overview")} />
          <Pill label="API Config" active={devTab === "api"} onClick={() => setDevTab("api")} />
          <Pill label="LiveKit" active={devTab === "webhooks"} onClick={() => setDevTab("webhooks")} />
        </div>

        {devTab === "overview" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="Voice Rooms" value={voiceRooms.length} icon={Mic} color="text-purple-400" />
              <StatCard label="Supabase" value="Connected" icon={Database} color="text-emerald-400" />
              <StatCard label="LiveKit" value="Configured" icon={Radio} color="text-cyan-400" />
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[12px] font-bold text-white mb-2">Tech Stack</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { name: "React + TypeScript", icon: "⚛️" },
                  { name: "Vite", icon: "⚡" },
                  { name: "Tailwind CSS", icon: "🎨" },
                  { name: "shadcn/ui", icon: "🧩" },
                  { name: "Supabase", icon: "🗄️" },
                  { name: "LiveKit", icon: "🎤" },
                  { name: "Vercel", icon: "▲" },
                  { name: "Helius API", icon: "🌐" },
                  { name: "DexScreener", icon: "📊" },
                ].map(t => (
                  <div key={t.name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03]">
                    <span>{t.icon}</span>
                    <span className="text-[11px] text-white/50">{t.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {devTab === "api" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
              <p className="text-[12px] font-bold text-white">API Endpoints</p>
              {[
                { name: "Helius RPC", url: "mainnet.helius-rpc.com", status: "active" },
                { name: "DexScreener", url: "api.dexscreener.com", status: "active" },
                { name: "Supabase", url: "ffjipnkhcebjvttliptb.supabase.co", status: "active" },
                { name: "LiveKit", url: "new-7unnd5e1.livekit.cloud", status: "active" },
              ].map(api => (
                <div key={api.name} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03]">
                  <div className={cn("h-2 w-2 rounded-full", api.status === "active" ? "bg-emerald-400" : "bg-red-400")} />
                  <div className="flex-1">
                    <p className="text-[12px] font-semibold text-white">{api.name}</p>
                    <p className="text-[10px] text-white/30 font-mono">{api.url}</p>
                  </div>
                  <Badge className={cn("text-[9px] border-0", api.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>{api.status.toUpperCase()}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {devTab === "webhooks" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[12px] font-bold text-white mb-2">LiveKit Voice Rooms</p>
              <div className="space-y-1 max-h-[300px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                {voiceRooms.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.03]">
                    <div>
                      <p className="text-[12px] font-semibold text-white">{r.name || r.room_name || r.id.slice(0, 12)}</p>
                      <p className="text-[10px] text-white/30">{r.created_at ? formatDistanceToNow(new Date(r.created_at), { addSuffix: true }) : ""}</p>
                    </div>
                    <Badge className={cn("text-[9px] border-0", r.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.06] text-white/30")}>{r.is_active ? "LIVE" : "ENDED"}</Badge>
                  </div>
                ))}
                {voiceRooms.length === 0 && <p className="text-[12px] text-white/25 text-center py-6">No voice rooms</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     MAIN RENDER
     ═══════════════════════════════════════════════════════════════ */

  return (
    <Wrap>
      <div className="flex flex-col lg:flex-row min-h-screen">
        {/* Sidebar Navigation */}
        <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-white/[0.06] bg-black/20 p-3 gap-1 sticky top-0 h-screen overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          <div className="flex items-center gap-2 px-3 py-3 mb-2">
            <Shield className="h-5 w-5 text-[#22d3ee]" />
            <span className="text-[14px] font-black text-white tracking-tight">Admin</span>
          </div>
          {NAV_SECTIONS.map(s => (
            <button key={s.id} onClick={() => setTab(s.id)} className={cn("flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all text-left", tab === s.id ? "bg-white/[0.08] text-white" : "text-white/40 hover:bg-white/[0.04] hover:text-white/60")}>
              <s.icon className={cn("h-3.5 w-3.5", tab === s.id ? s.color : "")} />
              {s.label}
            </button>
          ))}
        </aside>

        {/* Mobile Tab Select */}
        <div className="lg:hidden sticky top-0 z-20 w-full border-b border-white/[0.06] bg-black/50 backdrop-blur-xl">
          <div className="flex items-center gap-2 px-3 py-2">
            <Shield className="h-4 w-4 text-[#22d3ee]" />
            <Select value={tab} onValueChange={v => setTab(v as TabId)}>
              <SelectTrigger className="h-8 bg-white/[0.03] border-white/[0.08] text-[12px] flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {NAV_SECTIONS.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 min-w-0 p-4 lg:p-6 overflow-y-auto">
          {tab === "overview" && renderCommandCenter()}
          {tab === "users" && <UserManagement />}
          {tab === "content" && <ContentModeration />}
          {tab === "submissions" && <TokenSubmissions />}
          {tab === "community" && <CommunityManagement />}
          {tab === "trading" && <TradingRooms />}
          {tab === "wallets" && <WalletIntelligence />}
          {tab === "notifications" && <NotificationsComms />}
          {tab === "analytics" && <AnalyticsInsights />}
          {tab === "gamification" && <Gamification />}
          {tab === "settings" && <PlatformSettingsSection />}
          {tab === "security" && <SecurityCenter />}
          {tab === "support" && <SupportTicketsSection />}
          {tab === "dms" && <DmChatManagement />}
          {tab === "data" && <ContentData />}
          {tab === "export" && <DataExport />}
          {tab === "developer" && <DeveloperApi />}
        </main>
      </div>
    </Wrap>
  );
};

export default Admin;
