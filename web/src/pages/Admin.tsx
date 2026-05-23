import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow, format, subDays } from "date-fns";
import { 
  Shield, Rocket, CheckCircle, XCircle, Clock, Star, 
  Users, AlertTriangle, Eye, Trash2, RefreshCw,
  Activity, FileText, Settings, Mail,
  Search, BarChart3, Loader2, Database, Zap,
  MessageSquare, Globe, Lock, Coins, Bell, X,
  Ban, UserCheck, Send, Headphones, TrendingUp,
  PieChart, ShieldAlert, ToggleLeft, Volume2
} from "lucide-react";

// Types
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
  theme_preset: string | null;
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

const SETTING_CATEGORIES = [
  { id: 'submissions', name: 'Submissions', icon: Rocket },
  { id: 'moderation', name: 'Moderation', icon: Shield },
  { id: 'users', name: 'Users', icon: Users },
  { id: 'chat', name: 'Chat', icon: MessageSquare },
  { id: 'api', name: 'API', icon: Globe },
  { id: 'display', name: 'Display', icon: Eye },
];

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userCredits, setUserCredits] = useState<Record<string, UserCreditsData>>({});
  const [platformSettings, setPlatformSettings] = useState<PlatformSetting[]>([]);
  const [lobbies, setLobbies] = useState<LobbyData[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0, activeToday: 0, totalSubmissions: 0,
    pendingSubmissions: 0, totalCreditsUsed: 0, activeLobbies: 0,
  });
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("overview");
  const [settingsCategory, setSettingsCategory] = useState("submissions");
  const [savingSettings, setSavingSettings] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userTransactions, setUserTransactions] = useState<CreditTransaction[]>([]);
  const [editingCredits, setEditingCredits] = useState(false);
  const [newCreditAmount, setNewCreditAmount] = useState<number>(0);
  const [creditAdjustType, setCreditAdjustType] = useState<'set' | 'add' | 'subtract'>('add');
  // Announcement
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);

  useEffect(() => { checkAdminStatus(); }, [user]);
  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(() => { fetchAuditLogs(); fetchStats(); }, 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const checkAdminStatus = async () => {
    if (!user) { setLoading(false); return; }
    try {
      if (user.email === "audifyx@gmail.com") {
        setIsAdmin(true); fetchAllData(); setLoading(false); return;
      }
      const { data, error } = await supabase.from("admin_roles").select("role").eq("user_id", user.id).maybeSingle();
      if (error || !data || !["admin", "owner"].includes(data.role)) { setIsAdmin(false); setLoading(false); return; }
      setIsAdmin(true); fetchAllData();
    } catch { setIsAdmin(false); } finally { setLoading(false); }
  };

  const fetchAllData = async () => {
    await Promise.all([fetchSubmissions(), fetchAuditLogs(), fetchUsers(), fetchStats(), fetchPlatformSettings(), fetchLobbies()]);
  };

  const fetchSubmissions = async () => {
    const { data } = await supabase.from("pump_v5_submissions").select("*").order("created_at", { ascending: false });
    setSubmissions(data || []);
  };
  const fetchAuditLogs = async () => {
    const { data } = await supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(200);
    setAuditLogs(data || []);
  };
  const fetchUsers = async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setUsers(data || []);
    const { data: creditsData } = await supabase.from("user_credits").select("*");
    if (creditsData) {
      const m: Record<string, UserCreditsData> = {};
      creditsData.forEach(c => { m[c.user_id] = c; });
      setUserCredits(m);
    }
  };
  const fetchLobbies = async () => {
    const { data } = await supabase.from("trading_lobbies").select("*").order("created_at", { ascending: false });
    setLobbies(data || []);
  };
  const fetchStats = async () => {
    const [profilesResult, submissionsResult, creditsResult, lobbiesResult] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("pump_v5_submissions").select("id, status"),
      supabase.from("credit_transactions").select("cost"),
      supabase.from("trading_lobbies").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);
    const pendingCount = submissionsResult.data?.filter(s => s.status === "pending").length || 0;
    const totalCredits = creditsResult.data?.reduce((sum, tx) => sum + (tx.cost || 0), 0) || 0;
    setStats({
      totalUsers: profilesResult.count || 0, activeToday: 0,
      totalSubmissions: submissionsResult.data?.length || 0,
      pendingSubmissions: pendingCount, totalCreditsUsed: totalCredits,
      activeLobbies: lobbiesResult.count || 0,
    });
  };
  const fetchPlatformSettings = async () => {
    const { data } = await supabase.from("platform_settings").select("*").order("category", { ascending: true });
    setPlatformSettings(data || []);
  };
  const fetchUserTransactions = async (userId: string) => {
    const { data } = await supabase.from("credit_transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
    setUserTransactions(data || []);
  };

  const openUserDetail = async (p: UserProfile) => {
    setSelectedUser(p); setEditingCredits(false);
    const c = userCredits[p.user_id];
    setNewCreditAmount(c ? c.total_credits - c.used_credits : 50000);
    await fetchUserTransactions(p.user_id);
  };

  const updateUserCredits = async () => {
    if (!selectedUser || !user) return;
    const cur = userCredits[selectedUser.user_id];
    if (!cur) { toast.error("No credit record"); return; }
    let newUsed = cur.used_credits;
    if (creditAdjustType === 'set') newUsed = cur.total_credits - newCreditAmount;
    else if (creditAdjustType === 'add') newUsed = Math.max(0, cur.used_credits - newCreditAmount);
    else newUsed = Math.min(cur.total_credits, cur.used_credits + newCreditAmount);
    const { error } = await supabase.from("user_credits").update({ used_credits: newUsed }).eq("user_id", selectedUser.user_id);
    if (error) { toast.error("Failed"); return; }
    await supabase.from("admin_audit_log").insert({ admin_user_id: user.id, action: `Credits ${creditAdjustType} ${newCreditAmount} for ${selectedUser.username || selectedUser.user_id.slice(0,8)}`, target_type: "user_credits", target_id: selectedUser.user_id, old_values: { used_credits: cur.used_credits }, new_values: { used_credits: newUsed } });
    toast.success("Credits updated");
    setUserCredits(prev => ({ ...prev, [selectedUser.user_id]: { ...cur, used_credits: newUsed } }));
    setEditingCredits(false); fetchAuditLogs();
  };

  const updateSetting = async (key: string, newValue: any) => {
    if (!user) return;
    setSavingSettings(key);
    const { error } = await supabase.from("platform_settings").update({ value: newValue, updated_by: user.id }).eq("key", key);
    if (!error) {
      setPlatformSettings(prev => prev.map(s => s.key === key ? { ...s, value: newValue } : s));
      await supabase.from("admin_audit_log").insert({ admin_user_id: user.id, action: `Updated setting: ${key}`, target_type: "platform_settings", target_id: key, new_values: newValue });
      toast.success("Setting updated"); fetchAuditLogs();
    } else toast.error("Failed");
    setSavingSettings(null);
  };

  const updateSubmission = async (id: string, updates: Partial<Submission>) => {
    if (!user) return;
    setProcessing(true);
    const { error } = await supabase.from("pump_v5_submissions").update({ ...updates, approved_by: user.id, approved_at: new Date().toISOString() }).eq("id", id);
    if (!error) {
      await supabase.from("admin_audit_log").insert({ admin_user_id: user.id, action: `Submission ${updates.status || "edit"}`, target_type: "pump_v5_submissions", target_id: id, new_values: updates });
      toast.success("Updated"); fetchSubmissions(); fetchAuditLogs();
    } else toast.error("Failed");
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
    toast.success("Lobby deleted"); fetchLobbies();
  };

  const sendAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementMessage.trim() || !user) return;
    setSendingAnnouncement(true);
    try {
      // Send to all users
      const userIds = users.map(u => u.user_id);
      const notifications = userIds.map(uid => ({
        user_id: uid, title: announcementTitle, message: announcementMessage,
        type: "announcement", data: { from: "admin" },
      }));
      // Batch insert in chunks of 50
      for (let i = 0; i < notifications.length; i += 50) {
        await supabase.from("notifications").insert(notifications.slice(i, i + 50));
      }
      await supabase.from("admin_audit_log").insert({ admin_user_id: user.id, action: `Sent announcement: ${announcementTitle}`, target_type: "notifications", new_values: { title: announcementTitle, recipients: userIds.length } });
      toast.success(`Announcement sent to ${userIds.length} users`);
      setAnnouncementTitle(""); setAnnouncementMessage(""); fetchAuditLogs();
    } catch { toast.error("Failed to send"); }
    setSendingAnnouncement(false);
  };

  if (loading) return <AppLayout><div className="flex items-center justify-center h-full"><Loader2 className="h-12 w-12 animate-spin text-[#22d3ee]" /></div></AppLayout>;
  if (!isAdmin) return <AppLayout><div className="flex flex-col items-center justify-center h-full gap-4"><Shield className="h-16 w-16 text-destructive" /><h1 className="text-2xl font-bold">Access Denied</h1><p className="text-muted-foreground">You don't have permission to view this page.</p><Button onClick={() => navigate("/wallets")}>Go Home</Button></div></AppLayout>;

  const pendingCount = submissions.filter(s => s.status === "pending").length;
  const filteredSubmissions = submissions.filter(s => s.token_name.toLowerCase().includes(searchQuery.toLowerCase()) || s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || s.contract_address.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredUsers = users.filter(u => !searchQuery || (u.username || "").toLowerCase().includes(searchQuery.toLowerCase()) || u.user_id.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredSettings = platformSettings.filter(s => s.category === settingsCategory);

  const renderSettingControl = (setting: PlatformSetting) => {
    const isBoolean = setting.value?.hasOwnProperty?.('enabled');
    const hasValue = setting.value?.hasOwnProperty?.('value');
    return (
      <div key={setting.key} className="flex items-center justify-between py-4 border-b border-white/[0.07] last:border-0">
        <div className="flex-1">
          <Label className="text-sm font-medium">{setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
        </div>
        <div className="flex items-center gap-3">
          {isBoolean && <Switch checked={setting.value.enabled} onCheckedChange={(checked) => updateSetting(setting.key, { ...setting.value, enabled: checked })} disabled={savingSettings === setting.key} />}
          {hasValue && !isBoolean && <Input type="number" value={setting.value.value} onChange={(e) => updateSetting(setting.key, { ...setting.value, value: parseInt(e.target.value) })} className="w-24" disabled={savingSettings === setting.key} />}
          {savingSettings === setting.key && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>
    );
  };

  const StatCard = ({ icon: Icon, label, value, color, sub }: { icon: any; label: string; value: string | number; color: string; sub?: string }) => (
    <Card className="og-glass-card">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${color}`}><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground/70">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <ScrollArea className="h-[calc(100vh-60px)]">
        <div className="p-4 lg:p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-destructive/20"><Shield className="h-8 w-8 text-[#22d3ee]" /></div>
              <div>
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <p className="text-muted-foreground text-sm">Platform Management & Analytics</p>
              </div>
            </div>
            <Button onClick={fetchAllData} variant="outline" className="gap-2 rounded-xl"><RefreshCw className="h-4 w-4" /> Refresh</Button>
          </div>

          {/* Tabs */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="bg-white/[0.04] p-1 rounded-xl flex overflow-x-auto w-full gap-1 h-auto flex-wrap">
              {[
                { val: "overview", icon: BarChart3, label: "Overview" },
                { val: "users", icon: Users, label: "Users" },
                { val: "submissions", icon: Rocket, label: "Tokens", badge: pendingCount },
                { val: "lobbies", icon: Headphones, label: "Lobbies" },
                { val: "credits", icon: Coins, label: "Credits" },
                { val: "logs", icon: FileText, label: "Logs" },
                { val: "announcements", icon: Bell, label: "Announce" },
                { val: "security", icon: ShieldAlert, label: "Security" },
                { val: "settings", icon: Settings, label: "Settings" },
              ].map(t => (
                <TabsTrigger key={t.val} value={t.val} className="gap-1.5 rounded-lg flex-shrink-0 text-xs px-3">
                  <t.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t.label}</span>
                  {t.badge ? <Badge className="ml-1 h-4 px-1 text-[10px] bg-yellow-500/20 text-yellow-500">{t.badge}</Badge> : null}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* OVERVIEW */}
            <TabsContent value="overview" className="mt-6 space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                <StatCard icon={Users} label="Total Users" value={stats.totalUsers} color="bg-primary/20 text-[#22d3ee]" />
                <StatCard icon={Clock} label="Pending" value={pendingCount} color="bg-yellow-500/20 text-yellow-500" />
                <StatCard icon={Rocket} label="Tokens" value={stats.totalSubmissions} color="bg-green-500/20 text-green-500" />
                <StatCard icon={Activity} label="Actions" value={auditLogs.length} color="bg-secondary/20 text-secondary" />
                <StatCard icon={Coins} label="Credits Used" value={`$${stats.totalCreditsUsed.toLocaleString()}`} color="bg-accent/20 text-accent" />
                <StatCard icon={Headphones} label="Lobbies" value={stats.activeLobbies} color="bg-blue-500/20 text-blue-500" />
              </div>

              {/* Recent Activity */}
              <Card className="og-glass-card">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-lg flex items-center gap-2"><Activity className="h-5 w-5 text-[#22d3ee]" /> Recent Activity</CardTitle>
                  <Badge variant="outline" className="gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />Live</Badge>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {auditLogs.slice(0, 10).map(log => (
                      <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                        <Activity className="h-4 w-4 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{log.action}</p>
                          <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</p>
                        </div>
                        {log.target_type && <Badge variant="outline" className="text-[10px] flex-shrink-0">{log.target_type}</Badge>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats Cards */}
              <div className="grid sm:grid-cols-2 gap-4">
                <Card className="og-glass-card">
                  <CardHeader className="pb-3"><CardTitle className="text-lg">Top Credit Users</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {users.slice(0, 5).map(u => {
                        const c = userCredits[u.user_id];
                        return (
                          <div key={u.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                            <span className="text-sm font-medium truncate">{u.username || u.user_id.slice(0, 8)}</span>
                            <span className="text-sm text-accent">${(c?.used_credits || 0).toLocaleString()}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
                <Card className="og-glass-card">
                  <CardHeader className="pb-3"><CardTitle className="text-lg">Recent Submissions</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {submissions.slice(0, 5).map(s => (
                        <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-[10px] font-bold">{s.symbol.slice(0, 2)}</div>
                            <span className="text-sm font-medium">{s.token_name}</span>
                          </div>
                          <Badge className={s.status === "pending" ? "bg-yellow-500/20 text-yellow-500" : s.status === "approved" || s.status === "live" ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"} variant="outline">{s.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* USERS */}
            <TabsContent value="users" className="mt-6">
              <Card className="og-glass-card">
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
                  <div><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-[#22d3ee]" /> User Accounts</CardTitle><CardDescription>{users.length} registered users</CardDescription></div>
                  <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-64" /></div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead><TableHead>Username</TableHead><TableHead>Credits Used</TableHead><TableHead>Credits Left</TableHead><TableHead>Joined</TableHead><TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map(p => {
                          const c = userCredits[p.user_id];
                          const used = c?.used_credits || 0;
                          const total = c?.total_credits || 50000;
                          const left = total - used;
                          return (
                            <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openUserDetail(p)}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold">{(p.username || p.user_id).charAt(0).toUpperCase()}</div>
                                  <code className="text-xs bg-white/[0.04] px-2 py-1 rounded">{p.user_id.slice(0, 8)}...</code>
                                </div>
                              </TableCell>
                              <TableCell><span className="font-medium">{p.username || "—"}</span></TableCell>
                              <TableCell><Badge variant="outline" className="bg-accent/10 text-accent"><Coins className="h-3 w-3 mr-1" />${used.toLocaleString()}</Badge></TableCell>
                              <TableCell><span className={left < 5000 ? "text-yellow-500" : "text-green-500"}>${left.toLocaleString()}</span></TableCell>
                              <TableCell className="text-muted-foreground text-sm">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</TableCell>
                              <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openUserDetail(p); }}><Eye className="h-4 w-4" /></Button></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SUBMISSIONS */}
            <TabsContent value="submissions" className="mt-6">
              <Card className="og-glass-card">
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
                  <div><CardTitle className="flex items-center gap-2"><Rocket className="h-5 w-5 text-[#22d3ee]" /> Token Submissions</CardTitle><CardDescription>Manage PUMP V5 token listings</CardDescription></div>
                  <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search tokens..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-64" /></div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader><TableRow><TableHead>Token</TableHead><TableHead>Contract</TableHead><TableHead>Platform</TableHead><TableHead>Status</TableHead><TableHead>Featured</TableHead><TableHead>Submitted</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {filteredSubmissions.map(s => (
                          <TableRow key={s.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {s.logo_url ? <img src={s.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" onError={(e) => { const el = e.target as HTMLImageElement; el.style.display = "none"; }} /> : <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold">{s.symbol.slice(0, 2)}</div>}
                                <div><p className="font-medium">{s.token_name}</p><p className="text-xs text-muted-foreground">${s.symbol}</p></div>
                              </div>
                            </TableCell>
                            <TableCell><code className="text-xs bg-white/[0.04] px-2 py-1 rounded">{s.contract_address.slice(0, 8)}...</code></TableCell>
                            <TableCell><Badge variant="outline">{s.launch_platform}</Badge></TableCell>
                            <TableCell><Badge className={s.status === "pending" ? "bg-yellow-500/20 text-yellow-500" : s.status === "approved" || s.status === "live" ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"}>{s.status}</Badge></TableCell>
                            <TableCell><Switch checked={s.is_featured} onCheckedChange={(c) => updateSubmission(s.id, { is_featured: c })} /></TableCell>
                            <TableCell className="text-muted-foreground text-sm">{formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {s.status === "pending" && (<><Button size="sm" variant="ghost" onClick={() => updateSubmission(s.id, { status: "approved" })} disabled={processing}><CheckCircle className="h-4 w-4 text-green-500" /></Button><Button size="sm" variant="ghost" onClick={() => updateSubmission(s.id, { status: "rejected" })} disabled={processing}><XCircle className="h-4 w-4 text-red-500" /></Button></>)}
                                <Button size="sm" variant="ghost" onClick={() => deleteSubmission(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* LOBBIES */}
            <TabsContent value="lobbies" className="mt-6">
              <Card className="og-glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Headphones className="h-5 w-5 text-[#22d3ee]" /> Trading Lobbies</CardTitle>
                  <CardDescription>{lobbies.length} lobbies total, {lobbies.filter(l => l.is_active).length} active</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-3">
                      {lobbies.map(lobby => (
                        <div key={lobby.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/30">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="p-2.5 rounded-xl bg-primary/20"><Headphones className="h-5 w-5 text-[#22d3ee]" /></div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{lobby.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{lobby.description || "No description"}</p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {lobby.member_count || 0}</span>
                                <Badge variant="outline" className="text-[10px]">{lobby.privacy}</Badge>
                                <span>by {lobby.creator_name || lobby.created_by.slice(0, 8)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge className={lobby.is_active ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"}>{lobby.is_active ? "Active" : "Inactive"}</Badge>
                            <Button size="sm" variant="ghost" onClick={() => deleteLobby(lobby.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </div>
                      ))}
                      {lobbies.length === 0 && <div className="text-center py-8 text-muted-foreground">No lobbies yet</div>}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* CREDITS */}
            <TabsContent value="credits" className="mt-6 space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Coins} label="Total Credits Used" value={`$${stats.totalCreditsUsed.toLocaleString()}`} color="bg-accent/20 text-accent" />
                <StatCard icon={Users} label="Users w/ Credits" value={Object.keys(userCredits).length} color="bg-primary/20 text-[#22d3ee]" />
                <StatCard icon={TrendingUp} label="Avg Usage" value={`$${Object.keys(userCredits).length ? Math.round(stats.totalCreditsUsed / Object.keys(userCredits).length).toLocaleString() : 0}`} color="bg-green-500/20 text-green-500" />
                <StatCard icon={AlertTriangle} label="Low Balance" value={Object.values(userCredits).filter(c => (c.total_credits - c.used_credits) < 5000).length} color="bg-yellow-500/20 text-yellow-500" />
              </div>
              <Card className="og-glass-card">
                <CardHeader><CardTitle className="text-lg">Credit Leaderboard</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {users.sort((a, b) => (userCredits[b.user_id]?.used_credits || 0) - (userCredits[a.user_id]?.used_credits || 0)).slice(0, 20).map((u, i) => {
                        const c = userCredits[u.user_id];
                        return (
                          <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 hover:bg-muted/30 cursor-pointer" onClick={() => openUserDetail(u)}>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-muted-foreground w-6">#{i + 1}</span>
                              <span className="text-sm font-medium">{u.username || u.user_id.slice(0, 8)}</span>
                            </div>
                            <span className="text-sm font-semibold text-accent">${(c?.used_credits || 0).toLocaleString()}</span>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* LOGS */}
            <TabsContent value="logs" className="mt-6">
              <Card className="og-glass-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-[#22d3ee]" /> Audit Logs</CardTitle><CardDescription>Real-time admin activity (auto-refreshes 30s)</CardDescription></div>
                  <Badge variant="outline" className="gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />Live</Badge>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-3">
                      {auditLogs.map(log => (
                        <div key={log.id} className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 border border-white/[0.07]">
                          <div className="p-2 rounded-lg bg-primary/10"><Activity className="h-4 w-4 text-[#22d3ee]" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{log.action}</span>
                              {log.target_type && <Badge variant="outline" className="text-xs">{log.target_type}</Badge>}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}</span>
                              <span>•</span>
                              <span>Admin: {log.admin_user_id.slice(0, 8)}...</span>
                            </div>
                            {log.new_values && <div className="mt-2 p-2 rounded-lg bg-white/[0.04] text-xs font-mono overflow-x-auto max-h-20">{JSON.stringify(log.new_values, null, 2)}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ANNOUNCEMENTS */}
            <TabsContent value="announcements" className="mt-6 space-y-6">
              <Card className="og-glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-[#22d3ee]" /> Send Announcement</CardTitle>
                  <CardDescription>Broadcast a notification to all users</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Title</Label>
                    <Input value={announcementTitle} onChange={e => setAnnouncementTitle(e.target.value)} placeholder="Announcement title..." className="mt-1" />
                  </div>
                  <div>
                    <Label>Message</Label>
                    <Textarea value={announcementMessage} onChange={e => setAnnouncementMessage(e.target.value)} placeholder="Write your announcement..." className="mt-1 min-h-[100px]" />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Will be sent to {users.length} users</p>
                    <Button onClick={sendAnnouncement} disabled={sendingAnnouncement || !announcementTitle.trim() || !announcementMessage.trim()} className="gap-2">
                      {sendingAnnouncement ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send to All
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECURITY */}
            <TabsContent value="security" className="mt-6 space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <Card className="og-glass-card">
                  <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-[#22d3ee]" /> Security Overview</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                      <span className="text-sm">RLS Policies Active</span>
                      <Badge className="bg-green-500/20 text-green-500">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                      <span className="text-sm">Admin Auth</span>
                      <Badge className="bg-green-500/20 text-green-500">JWT + Email</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                      <span className="text-sm">Edge Functions</span>
                      <Badge className="bg-green-500/20 text-green-500">Secured</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                      <span className="text-sm">Audit Logging</span>
                      <Badge className="bg-green-500/20 text-green-500">Active</Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card className="og-glass-card">
                  <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Ban className="h-5 w-5 text-destructive" /> Moderation</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">User moderation tools are available in the Users tab. Click any user to view details and manage credits.</p>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                      <span className="text-sm">Total Admin Actions</span>
                      <span className="text-sm font-bold">{auditLogs.length}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                      <span className="text-sm">Pending Reviews</span>
                      <span className="text-sm font-bold text-yellow-500">{pendingCount}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* SETTINGS */}
            <TabsContent value="settings" className="mt-6">
              <div className="grid lg:grid-cols-4 gap-6">
                <Card className="og-glass-card lg:col-span-1">
                  <CardHeader><CardTitle className="text-lg">Categories</CardTitle></CardHeader>
                  <CardContent className="p-2">
                    <div className="space-y-1">
                      {SETTING_CATEGORIES.map(cat => (
                        <Button key={cat.id} variant={settingsCategory === cat.id ? "secondary" : "ghost"} className="w-full justify-start gap-3" onClick={() => setSettingsCategory(cat.id)}>
                          <cat.icon className="h-4 w-4" />{cat.name}<Badge variant="outline" className="ml-auto text-xs">{platformSettings.filter(s => s.category === cat.id).length}</Badge>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card className="og-glass-card lg:col-span-3">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5 text-[#22d3ee]" /> {SETTING_CATEGORIES.find(c => c.id === settingsCategory)?.name} Settings</CardTitle>
                    <CardDescription>Configure platform behavior and features</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="divide-y divide-border/50">
                      {filteredSettings.map(renderSettingControl)}
                      {filteredSettings.length === 0 && <div className="py-8 text-center text-muted-foreground">No settings in this category</div>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* User Detail Modal */}
          <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-sm font-bold">{(selectedUser?.username || selectedUser?.user_id || "U").charAt(0).toUpperCase()}</div>
                  <div><p className="font-semibold">{selectedUser?.username || "User"}</p><p className="text-xs text-muted-foreground font-mono">{selectedUser?.user_id}</p></div>
                </DialogTitle>
              </DialogHeader>
              {selectedUser && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="og-glass-card"><CardContent className="p-4 text-center"><Coins className="h-6 w-6 text-accent mx-auto mb-2" /><p className="text-2xl font-bold">${(userCredits[selectedUser.user_id]?.used_credits || 0).toLocaleString()}</p><p className="text-xs text-muted-foreground">Used</p></CardContent></Card>
                    <Card className="og-glass-card"><CardContent className="p-4 text-center"><Zap className="h-6 w-6 text-green-500 mx-auto mb-2" /><p className="text-2xl font-bold">${((userCredits[selectedUser.user_id]?.total_credits || 50000) - (userCredits[selectedUser.user_id]?.used_credits || 0)).toLocaleString()}</p><p className="text-xs text-muted-foreground">Left</p></CardContent></Card>
                    <Card className="og-glass-card"><CardContent className="p-4 text-center"><Activity className="h-6 w-6 text-primary mx-auto mb-2" /><p className="text-2xl font-bold">{userTransactions.length}</p><p className="text-xs text-muted-foreground">Txns</p></CardContent></Card>
                  </div>
                  <Card className="og-glass-card border-primary/30">
                    <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><Coins className="h-5 w-5 text-[#22d3ee]" /> Manage Credits</CardTitle></CardHeader>
                    <CardContent>
                      {!editingCredits ? (
                        <Button onClick={() => setEditingCredits(true)} className="w-full"><Settings className="h-4 w-4 mr-2" /> Edit Credit Balance</Button>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-2">
                            {(['add', 'subtract', 'set'] as const).map(t => (
                              <Button key={t} variant={creditAdjustType === t ? 'default' : 'outline'} onClick={() => setCreditAdjustType(t)} className="w-full" size="sm">{t === 'add' ? 'Add' : t === 'subtract' ? 'Subtract' : 'Set Balance'}</Button>
                            ))}
                          </div>
                          <Input type="number" value={newCreditAmount} onChange={e => setNewCreditAmount(parseFloat(e.target.value) || 0)} placeholder="Amount..." />
                          <div className="flex gap-2">
                            <Button onClick={updateUserCredits} className="flex-1 bg-green-600 hover:bg-green-700"><CheckCircle className="h-4 w-4 mr-2" /> Apply</Button>
                            <Button variant="outline" onClick={() => setEditingCredits(false)} className="flex-1"><X className="h-4 w-4 mr-2" /> Cancel</Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="og-glass-card">
                    <CardHeader className="pb-3"><CardTitle className="text-lg">Transaction History</CardTitle></CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[200px]">
                        {userTransactions.length === 0 ? <div className="text-center py-8 text-muted-foreground">No transactions</div> : (
                          <div className="space-y-2">
                            {userTransactions.map(tx => (
                              <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                <div><p className="font-medium text-sm">{tx.tool_name}</p><p className="text-xs text-muted-foreground">{tx.tool_category}</p></div>
                                <div className="text-right"><p className="font-semibold text-red-500">-${tx.cost.toFixed(2)}</p><p className="text-xs text-muted-foreground">{format(new Date(tx.created_at), 'MMM d, HH:mm')}</p></div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </ScrollArea>
    </AppLayout>
  );
};

export default Admin;
