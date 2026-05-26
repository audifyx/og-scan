/* ══════════════════════════════════════════════════════════════
   Admin · User Management
   Features: list, search, filter, detail modal, edit profile,
   ban/suspend, delete, assign admin, credits mgmt, activity,
   followers, export, bulk actions
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { logAudit, shortId } from "../helpers";
import {
  Users, Search, Eye, Trash2, Shield, Ban, UserCheck,
  Coins, Activity, Download, CheckCircle, X, Loader2,
  Edit, UserX, Crown, RefreshCw, ChevronDown, ArrowUpDown,
  Copy, Mail, Wallet, Heart, UserPlus, Settings, Zap,
} from "lucide-react";
import type { UserProfile, UserCreditsData, CreditTransaction, AdminRole, FollowerData, UserActivity } from "../types";

type SortField = "created_at" | "username" | "credits_used";
type SortDir = "asc" | "desc";

export const UserManagement = () => {
  const { user: adminUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userCredits, setUserCredits] = useState<Record<string, UserCreditsData>>({});
  const [adminRoles, setAdminRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  // Detail modal
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [detailTab, setDetailTab] = useState("info");
  const [userTransactions, setUserTransactions] = useState<CreditTransaction[]>([]);
  const [userFollowers, setUserFollowers] = useState<FollowerData[]>([]);
  const [userFollowing, setUserFollowing] = useState<FollowerData[]>([]);
  const [userActivityLog, setUserActivityLog] = useState<UserActivity[]>([]);

  // Edit states
  const [editingProfile, setEditingProfile] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editWallet, setEditWallet] = useState("");

  // Credits
  const [editingCredits, setEditingCredits] = useState(false);
  const [creditAdjustType, setCreditAdjustType] = useState<"add" | "subtract" | "set">("add");
  const [newCreditAmount, setNewCreditAmount] = useState(0);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const [profilesR, creditsR, rolesR] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_credits").select("*"),
      supabase.from("admin_roles").select("*"),
    ]);
    setUsers(profilesR.data || []);
    const m: Record<string, UserCreditsData> = {};
    (creditsR.data || []).forEach((c: any) => { m[c.user_id] = c; });
    setUserCredits(m);
    setAdminRoles(rolesR.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const getUserRole = (userId: string) => {
    const role = adminRoles.find((r) => r.user_id === userId);
    return role?.role || "user";
  };

  const openUserDetail = async (p: UserProfile) => {
    setSelectedUser(p);
    setDetailTab("info");
    setEditingProfile(false);
    setEditingCredits(false);
    setEditUsername(p.username || "");
    setEditBio(p.bio || "");
    setEditWallet(p.wallet_address || "");
    // Fetch related data in parallel
    const [txR, followersR, followingR, actR] = await Promise.all([
      supabase.from("credit_transactions").select("*").eq("user_id", p.user_id).order("created_at", { ascending: false }).limit(100),
      supabase.from("followers").select("*").eq("following_id", p.user_id).limit(100),
      supabase.from("followers").select("*").eq("follower_id", p.user_id).limit(100),
      supabase.from("user_activity").select("*").eq("user_id", p.user_id).order("created_at", { ascending: false }).limit(50),
    ]);
    setUserTransactions(txR.data || []);
    setUserFollowers(followersR.data || []);
    setUserFollowing(followingR.data || []);
    setUserActivityLog(actR.data || []);
  };

  /* ── Actions ── */
  const updateProfile = async () => {
    if (!selectedUser || !adminUser) return;
    const updates: any = {};
    if (editUsername !== (selectedUser.username || "")) updates.username = editUsername || null;
    if (editBio !== (selectedUser.bio || "")) updates.bio = editBio || null;
    if (editWallet !== (selectedUser.wallet_address || "")) updates.wallet_address = editWallet || null;
    if (Object.keys(updates).length === 0) { toast.info("No changes"); return; }
    const { error } = await supabase.from("profiles").update(updates).eq("user_id", selectedUser.user_id);
    if (error) { toast.error("Update failed"); return; }
    await logAudit(adminUser.id, `Edited profile: ${selectedUser.username || shortId(selectedUser.user_id)}`, "profiles", selectedUser.user_id, undefined, updates);
    toast.success("Profile updated");
    setEditingProfile(false);
    fetchUsers();
  };

  const updateCredits = async () => {
    if (!selectedUser || !adminUser) return;
    const cur = userCredits[selectedUser.user_id];
    if (!cur) { toast.error("No credit record"); return; }
    let newUsed = cur.used_credits;
    if (creditAdjustType === "set") newUsed = cur.total_credits - newCreditAmount;
    else if (creditAdjustType === "add") newUsed = Math.max(0, cur.used_credits - newCreditAmount);
    else newUsed = Math.min(cur.total_credits, cur.used_credits + newCreditAmount);
    const { error } = await supabase.from("user_credits").update({ used_credits: newUsed }).eq("user_id", selectedUser.user_id);
    if (error) { toast.error("Failed"); return; }
    await logAudit(adminUser.id, `Credits ${creditAdjustType} ${newCreditAmount} → ${selectedUser.username || shortId(selectedUser.user_id)}`, "user_credits", selectedUser.user_id, { used_credits: cur.used_credits }, { used_credits: newUsed });
    toast.success("Credits updated");
    setUserCredits((prev) => ({ ...prev, [selectedUser.user_id]: { ...cur, used_credits: newUsed } }));
    setEditingCredits(false);
  };

  const resetCredits = async (userId: string) => {
    if (!adminUser || !window.confirm("Reset this user's credits to full?")) return;
    const { error } = await supabase.from("user_credits").update({ used_credits: 0 }).eq("user_id", userId);
    if (error) { toast.error("Failed"); return; }
    await logAudit(adminUser.id, "Credits reset to full", "user_credits", userId);
    toast.success("Credits reset");
    fetchUsers();
  };

  const assignRole = async (userId: string, role: string) => {
    if (!adminUser) return;
    if (role === "user") {
      await supabase.from("admin_roles").delete().eq("user_id", userId);
    } else {
      await supabase.from("admin_roles").upsert({ user_id: userId, role }, { onConflict: "user_id" });
    }
    await logAudit(adminUser.id, `Role changed to "${role}"`, "admin_roles", userId, undefined, { role });
    toast.success(`Role set to ${role}`);
    const { data } = await supabase.from("admin_roles").select("*");
    setAdminRoles(data || []);
  };

  const banUser = async (userId: string) => {
    if (!adminUser || !window.confirm("Ban this user? They will lose access.")) return;
    await supabase.from("profiles").update({ is_banned: true }).eq("user_id", userId);
    await logAudit(adminUser.id, "Banned user", "profiles", userId);
    toast.success("User banned");
    fetchUsers();
  };

  const unbanUser = async (userId: string) => {
    if (!adminUser) return;
    await supabase.from("profiles").update({ is_banned: false }).eq("user_id", userId);
    await logAudit(adminUser.id, "Unbanned user", "profiles", userId);
    toast.success("User unbanned");
    fetchUsers();
  };

  const deleteUser = async (userId: string) => {
    if (!adminUser || !window.confirm("DELETE this user permanently? This removes their profile, credits, activity, and all associated data. This cannot be undone.")) return;
    // Delete from related tables first
    await Promise.all([
      supabase.from("credit_transactions").delete().eq("user_id", userId),
      supabase.from("user_credits").delete().eq("user_id", userId),
      supabase.from("user_activity").delete().eq("user_id", userId),
      supabase.from("followers").delete().eq("follower_id", userId),
      supabase.from("followers").delete().eq("following_id", userId),
      supabase.from("notifications").delete().eq("user_id", userId),
      supabase.from("price_alerts").delete().eq("user_id", userId),
      supabase.from("tracked_wallets").delete().eq("user_id", userId),
      supabase.from("tracked_tokens").delete().eq("user_id", userId),
      supabase.from("trade_history").delete().eq("user_id", userId),
      supabase.from("community_members").delete().eq("user_id", userId),
      supabase.from("lobby_members").delete().eq("user_id", userId),
      supabase.from("admin_roles").delete().eq("user_id", userId),
    ]);
    await supabase.from("profiles").delete().eq("user_id", userId);
    await logAudit(adminUser.id, "Deleted user account", "profiles", userId);
    toast.success("User deleted");
    setSelectedUser(null);
    fetchUsers();
  };

  const bulkBan = async () => {
    if (!adminUser || selectedUsers.size === 0) return;
    if (!window.confirm(`Ban ${selectedUsers.size} selected users?`)) return;
    for (const uid of selectedUsers) {
      await supabase.from("profiles").update({ is_banned: true }).eq("user_id", uid);
    }
    await logAudit(adminUser.id, `Bulk banned ${selectedUsers.size} users`, "profiles");
    toast.success(`${selectedUsers.size} users banned`);
    setSelectedUsers(new Set());
    fetchUsers();
  };

  const bulkDelete = async () => {
    if (!adminUser || selectedUsers.size === 0) return;
    if (!window.confirm(`DELETE ${selectedUsers.size} users permanently? Cannot be undone!`)) return;
    for (const uid of selectedUsers) {
      await supabase.from("profiles").delete().eq("user_id", uid);
    }
    await logAudit(adminUser.id, `Bulk deleted ${selectedUsers.size} users`, "profiles");
    toast.success(`${selectedUsers.size} users deleted`);
    setSelectedUsers(new Set());
    fetchUsers();
  };

  const exportUsers = () => {
    const csvRows = ["user_id,username,wallet,created_at,credits_used,credits_total,role"];
    filteredUsers.forEach((u) => {
      const c = userCredits[u.user_id];
      csvRows.push(`${u.user_id},${u.username || ""},${u.wallet_address || ""},${u.created_at},${c?.used_credits || 0},${c?.total_credits || 50000},${getUserRole(u.user_id)}`);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ogscan_users.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported");
  };

  const toggleSelectUser = (uid: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map((u) => u.user_id)));
    }
  };

  /* ── Filtering & Sorting ── */
  const filteredUsers = users
    .filter((u) => {
      if (filterRole !== "all" && getUserRole(u.user_id) !== filterRole) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (u.username || "").toLowerCase().includes(q)
        || u.user_id.toLowerCase().includes(q)
        || (u.wallet_address || "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "username") return ((a.username || "").localeCompare(b.username || "")) * dir;
      if (sortField === "credits_used") return ((userCredits[a.user_id]?.used_credits || 0) - (userCredits[b.user_id]?.used_credits || 0)) * dir;
      return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
    });

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#22d3ee]" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Users className="h-6 w-6 text-[#22d3ee]" /> User Management
          </h2>
          <p className="text-sm text-muted-foreground">{users.length} registered users</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={exportUsers} variant="outline" size="sm" className="gap-2">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button onClick={fetchUsers} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by username, ID, or wallet…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="user">Users</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
            <SelectItem value="owner">Owners</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Join Date</SelectItem>
            <SelectItem value="username">Username</SelectItem>
            <SelectItem value="credits_used">Credits Used</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}>
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Bulk Actions Bar */}
      {selectedUsers.size > 0 && (
        <Card className="og-glass-card border-yellow-500/30">
          <CardContent className="p-3 flex items-center justify-between">
            <span className="text-sm font-medium">{selectedUsers.size} user(s) selected</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={bulkBan} className="gap-1.5 text-yellow-500 border-yellow-500/30">
                <Ban className="h-3.5 w-3.5" /> Ban Selected
              </Button>
              <Button size="sm" variant="outline" onClick={bulkDelete} className="gap-1.5 text-red-500 border-red-500/30">
                <Trash2 className="h-3.5 w-3.5" /> Delete Selected
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedUsers(new Set())}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Table */}
      <Card className="og-glass-card">
        <CardContent className="p-0">
          <ScrollArea className="h-[550px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input type="checkbox" checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0} onChange={toggleSelectAll} className="rounded" />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((p) => {
                  const c = userCredits[p.user_id];
                  const used = c?.used_credits || 0;
                  const total = c?.total_credits || 50000;
                  const left = total - used;
                  const role = getUserRole(p.user_id);
                  const isBanned = (p as any).is_banned;
                  return (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-white/[0.03]" onClick={() => openUserDetail(p)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedUsers.has(p.user_id)} onChange={() => toggleSelectUser(p.user_id)} className="rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#22d3ee] to-purple-600 flex items-center justify-center text-xs font-bold">
                            {(p.username || p.user_id).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{p.username || "—"}</p>
                            <code className="text-[10px] text-muted-foreground">{shortId(p.user_id)}</code>
                          </div>
                          {isBanned && <Badge className="bg-red-500/20 text-red-400 text-[10px]">BANNED</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          role === "owner" ? "border-yellow-500/50 text-yellow-400" :
                          role === "admin" ? "border-[#22d3ee]/50 text-[#22d3ee]" : "text-white/50"
                        }>
                          {role === "owner" && <Crown className="h-3 w-3 mr-1" />}
                          {role === "admin" && <Shield className="h-3 w-3 mr-1" />}
                          {role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full bg-[#22d3ee]" style={{ width: `${Math.min(100, (used / total) * 100)}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{left.toLocaleString()}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openUserDetail(p)} title="View Details">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => isBanned ? unbanUser(p.user_id) : banUser(p.user_id)} title={isBanned ? "Unban" : "Ban"}>
                            {isBanned ? <UserCheck className="h-4 w-4 text-green-400" /> : <Ban className="h-4 w-4 text-yellow-400" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteUser(p.user_id)} title="Delete">
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* ── User Detail Modal ── */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto bg-[#0a1118] border-white/10">
          {selectedUser && (() => {
            const c = userCredits[selectedUser.user_id];
            const role = getUserRole(selectedUser.user_id);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#22d3ee] to-purple-600 flex items-center justify-center font-bold">
                      {(selectedUser.username || selectedUser.user_id).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-lg">{selectedUser.username || "Unnamed User"}</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-muted-foreground">{selectedUser.user_id}</code>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { navigator.clipboard.writeText(selectedUser.user_id); toast.success("Copied"); }}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <Badge variant="outline" className="ml-auto">{role}</Badge>
                  </DialogTitle>
                </DialogHeader>

                <Tabs value={detailTab} onValueChange={setDetailTab}>
                  <TabsList className="bg-white/[0.04] w-full justify-start">
                    <TabsTrigger value="info">Profile</TabsTrigger>
                    <TabsTrigger value="credits">Credits</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                    <TabsTrigger value="social">Social</TabsTrigger>
                    <TabsTrigger value="admin">Admin</TabsTrigger>
                  </TabsList>

                  {/* Profile Tab */}
                  <TabsContent value="info" className="space-y-4">
                    {!editingProfile ? (
                      <Card className="og-glass-card">
                        <CardContent className="p-4 space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div><Label className="text-xs text-muted-foreground">Username</Label><p className="font-medium">{selectedUser.username || "—"}</p></div>
                            <div><Label className="text-xs text-muted-foreground">Wallet</Label><p className="font-mono text-sm truncate">{selectedUser.wallet_address || "—"}</p></div>
                            <div><Label className="text-xs text-muted-foreground">Joined</Label><p className="text-sm">{format(new Date(selectedUser.created_at), "PPP")}</p></div>
                            <div><Label className="text-xs text-muted-foreground">Theme</Label><p className="text-sm">{selectedUser.theme_preset || "default"}</p></div>
                          </div>
                          <div><Label className="text-xs text-muted-foreground">Bio</Label><p className="text-sm">{selectedUser.bio || "No bio"}</p></div>
                          <div className="grid grid-cols-2 gap-4">
                            <div><Label className="text-xs text-muted-foreground">Total PnL</Label><p className="font-medium">{selectedUser.total_pnl != null ? `$${selectedUser.total_pnl.toLocaleString()}` : "—"}</p></div>
                            <div><Label className="text-xs text-muted-foreground">Trades</Label><p className="font-medium">{selectedUser.trades_count ?? "—"}</p></div>
                          </div>
                          <Button onClick={() => setEditingProfile(true)} className="gap-2"><Edit className="h-4 w-4" /> Edit Profile</Button>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="og-glass-card border-[#22d3ee]/30">
                        <CardContent className="p-4 space-y-4">
                          <div><Label>Username</Label><Input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="mt-1" /></div>
                          <div><Label>Bio</Label><Textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} className="mt-1" rows={3} /></div>
                          <div><Label>Wallet Address</Label><Input value={editWallet} onChange={(e) => setEditWallet(e.target.value)} className="mt-1" /></div>
                          <div className="flex gap-2">
                            <Button onClick={updateProfile} className="gap-2 bg-green-600 hover:bg-green-700"><CheckCircle className="h-4 w-4" /> Save</Button>
                            <Button variant="outline" onClick={() => setEditingProfile(false)}><X className="h-4 w-4 mr-1" /> Cancel</Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* Credits Tab */}
                  <TabsContent value="credits" className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <Card className="og-glass-card"><CardContent className="p-4 text-center">
                        <Coins className="h-6 w-6 text-purple-400 mx-auto mb-2" />
                        <p className="text-xl font-bold">{(c?.used_credits || 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Used</p>
                      </CardContent></Card>
                      <Card className="og-glass-card"><CardContent className="p-4 text-center">
                        <Zap className="h-6 w-6 text-green-400 mx-auto mb-2" />
                        <p className="text-xl font-bold">{((c?.total_credits || 50000) - (c?.used_credits || 0)).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Remaining</p>
                      </CardContent></Card>
                      <Card className="og-glass-card"><CardContent className="p-4 text-center">
                        <Activity className="h-6 w-6 text-[#22d3ee] mx-auto mb-2" />
                        <p className="text-xl font-bold">{userTransactions.length}</p>
                        <p className="text-xs text-muted-foreground">Transactions</p>
                      </CardContent></Card>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { setEditingCredits(!editingCredits); }} variant="outline" className="gap-1.5">
                        <Settings className="h-3.5 w-3.5" /> Adjust Credits
                      </Button>
                      <Button size="sm" onClick={() => resetCredits(selectedUser.user_id)} variant="outline" className="gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5" /> Reset to Full
                      </Button>
                    </div>

                    {editingCredits && (
                      <Card className="og-glass-card border-[#22d3ee]/30">
                        <CardContent className="p-4 space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            {(["add", "subtract", "set"] as const).map((t) => (
                              <Button key={t} variant={creditAdjustType === t ? "default" : "outline"} onClick={() => setCreditAdjustType(t)} size="sm">
                                {t === "add" ? "Add" : t === "subtract" ? "Subtract" : "Set Balance"}
                              </Button>
                            ))}
                          </div>
                          <Input type="number" value={newCreditAmount} onChange={(e) => setNewCreditAmount(parseFloat(e.target.value) || 0)} placeholder="Amount..." />
                          <div className="flex gap-2">
                            <Button onClick={updateCredits} className="flex-1 bg-green-600 hover:bg-green-700"><CheckCircle className="h-4 w-4 mr-1" /> Apply</Button>
                            <Button variant="outline" onClick={() => setEditingCredits(false)} className="flex-1"><X className="h-4 w-4 mr-1" /> Cancel</Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card className="og-glass-card">
                      <CardHeader className="pb-3"><CardTitle className="text-sm">Recent Transactions</CardTitle></CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[200px]">
                          {userTransactions.length === 0 ? <p className="text-center py-4 text-sm text-muted-foreground">No transactions</p> : (
                            <div className="space-y-2">
                              {userTransactions.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03]">
                                  <div><p className="text-sm font-medium">{tx.tool_name}</p><p className="text-[10px] text-muted-foreground">{tx.tool_category}</p></div>
                                  <div className="text-right"><p className="text-sm font-semibold text-red-400">-{tx.cost}</p><p className="text-[10px] text-muted-foreground">{format(new Date(tx.created_at), "MMM d, HH:mm")}</p></div>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Activity Tab */}
                  <TabsContent value="activity">
                    <Card className="og-glass-card">
                      <CardHeader className="pb-3"><CardTitle className="text-sm">User Activity Log</CardTitle></CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[350px]">
                          {userActivityLog.length === 0 ? <p className="text-center py-4 text-sm text-muted-foreground">No activity recorded</p> : (
                            <div className="space-y-2">
                              {userActivityLog.map((a) => (
                                <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03]">
                                  <Activity className="h-4 w-4 text-[#22d3ee] flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{a.action}</p>
                                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Social Tab */}
                  <TabsContent value="social" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Card className="og-glass-card">
                        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Heart className="h-4 w-4" /> Followers ({userFollowers.length})</CardTitle></CardHeader>
                        <CardContent><ScrollArea className="h-[150px]">
                          {userFollowers.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">No followers</p> : userFollowers.map((f) => (
                            <div key={f.id} className="flex items-center gap-2 py-1.5"><UserPlus className="h-3 w-3 text-muted-foreground" /><code className="text-xs">{shortId(f.follower_id)}</code></div>
                          ))}
                        </ScrollArea></CardContent>
                      </Card>
                      <Card className="og-glass-card">
                        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Following ({userFollowing.length})</CardTitle></CardHeader>
                        <CardContent><ScrollArea className="h-[150px]">
                          {userFollowing.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Not following anyone</p> : userFollowing.map((f) => (
                            <div key={f.id} className="flex items-center gap-2 py-1.5"><Users className="h-3 w-3 text-muted-foreground" /><code className="text-xs">{shortId(f.following_id)}</code></div>
                          ))}
                        </ScrollArea></CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  {/* Admin Tab */}
                  <TabsContent value="admin" className="space-y-4">
                    <Card className="og-glass-card">
                      <CardHeader className="pb-3"><CardTitle className="text-sm">Role Management</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Label>Current Role:</Label>
                          <Badge>{role}</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant={role === "user" ? "default" : "outline"} onClick={() => assignRole(selectedUser.user_id, "user")}>User</Button>
                          <Button size="sm" variant={role === "admin" ? "default" : "outline"} onClick={() => assignRole(selectedUser.user_id, "admin")}>Admin</Button>
                          <Button size="sm" variant={role === "owner" ? "default" : "outline"} onClick={() => assignRole(selectedUser.user_id, "owner")}>Owner</Button>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="og-glass-card border-red-500/20">
                      <CardHeader className="pb-3"><CardTitle className="text-sm text-red-400">Danger Zone</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        <Button variant="outline" onClick={() => (selectedUser as any).is_banned ? unbanUser(selectedUser.user_id) : banUser(selectedUser.user_id)} className="w-full gap-2 border-yellow-500/30 text-yellow-400">
                          <Ban className="h-4 w-4" /> {(selectedUser as any).is_banned ? "Unban User" : "Ban User"}
                        </Button>
                        <Button variant="outline" onClick={() => deleteUser(selectedUser.user_id)} className="w-full gap-2 border-red-500/30 text-red-400">
                          <Trash2 className="h-4 w-4" /> Delete Account Permanently
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};
