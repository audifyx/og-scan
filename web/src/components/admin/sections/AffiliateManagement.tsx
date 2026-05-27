/* ══════════════════════════════════════════════════════════════
   Admin · Affiliate Management  (admin-only)
   Features:
   - Create & manage affiliate accounts
   - Assign custom referral codes / links
   - Track clicks, sign-ups, conversions per affiliate
   - Set & display commission rates
   - Approve / suspend affiliates
   - Payout tracking
   - Copy referral links
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { logAudit, shortId } from "../helpers";
import {
  Users, Search, Plus, Copy, Link2, CheckCircle, Ban,
  RefreshCw, Loader2, Edit, Trash2, Eye, DollarSign,
  TrendingUp, MousePointerClick, UserPlus, Percent,
  ExternalLink, X, Save, BarChart2, BadgeCheck,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────
interface Affiliate {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  referral_code: string;
  commission_rate: number;       // 0–100 (%)
  status: "pending" | "active" | "suspended";
  clicks: number;
  signups: number;
  conversions: number;
  total_earnings: number;
  paid_out: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

type TabKey = "list" | "payouts";

// ─── Helpers ──────────────────────────────────────────────────
const BASE_URL = typeof window !== "undefined" ? window.location.origin : "https://ogscan.app";

const refLink = (code: string) => `${BASE_URL}/?ref=${code}`;

const statusColor: Record<Affiliate["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  suspended: "bg-red-500/15 text-red-400 border-red-500/25",
};

const copyToClipboard = (text: string, label = "Copied!") => {
  navigator.clipboard.writeText(text).then(() => toast.success(label));
};

// ─── Stats card ───────────────────────────────────────────────
const StatCard = ({
  icon: Icon, label, value, sub, color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) => (
  <Card className="bg-white/[0.03] border-white/[0.07]">
    <CardContent className="p-4 flex items-center gap-4">
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[11px] text-white/40 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        {sub && <p className="text-[11px] text-white/30">{sub}</p>}
      </div>
    </CardContent>
  </Card>
);

// ─── Main ─────────────────────────────────────────────────────
export const AffiliateManagement = () => {
  const { user: adminUser } = useAuth();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tab, setTab] = useState<TabKey>("list");

  // Detail / edit modal
  const [selected, setSelected] = useState<Affiliate | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newAffiliate, setNewAffiliate] = useState({
    name: "",
    email: "",
    referral_code: "",
    commission_rate: 10,
    notes: "",
  });

  // Edit form state (mirrors selected affiliate)
  const [editFields, setEditFields] = useState({
    name: "",
    email: "",
    referral_code: "",
    commission_rate: 10,
    status: "active" as Affiliate["status"],
    notes: "",
  });

  // ── Fetch ──────────────────────────────────────────────────
  const fetchAffiliates = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("affiliates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load affiliates");
    } else {
      setAffiliates(data as Affiliate[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAffiliates(); }, [fetchAffiliates]);

  // ── Computed stats ─────────────────────────────────────────
  const stats = {
    total: affiliates.length,
    active: affiliates.filter((a) => a.status === "active").length,
    totalClicks: affiliates.reduce((s, a) => s + (a.clicks || 0), 0),
    totalSignups: affiliates.reduce((s, a) => s + (a.signups || 0), 0),
    totalConversions: affiliates.reduce((s, a) => s + (a.conversions || 0), 0),
    totalEarnings: affiliates.reduce((s, a) => s + (a.total_earnings || 0), 0),
    totalOwed: affiliates.reduce((s, a) => s + Math.max(0, (a.total_earnings || 0) - (a.paid_out || 0)), 0),
  };

  // ── Filter ─────────────────────────────────────────────────
  const filtered = affiliates.filter((a) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.referral_code.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── Create ─────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newAffiliate.name.trim() || !newAffiliate.email.trim() || !newAffiliate.referral_code.trim()) {
      toast.error("Name, email and referral code are required");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.from("affiliates").insert([
      {
        name: newAffiliate.name.trim(),
        email: newAffiliate.email.trim().toLowerCase(),
        referral_code: newAffiliate.referral_code.trim().toUpperCase(),
        commission_rate: newAffiliate.commission_rate,
        notes: newAffiliate.notes.trim() || null,
        status: "pending",
        clicks: 0,
        signups: 0,
        conversions: 0,
        total_earnings: 0,
        paid_out: 0,
      },
    ]).select().single();
    setCreating(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Affiliate created ✔");
      setAffiliates((prev) => [data as Affiliate, ...prev]);
      setShowCreate(false);
      setNewAffiliate({ name: "", email: "", referral_code: "", commission_rate: 10, notes: "" });
      await logAudit(adminUser!.id, "create_affiliate", "affiliate", data.id, {}, data);
    }
  };

  // ── Open detail ────────────────────────────────────────────
  const openDetail = (a: Affiliate) => {
    setSelected(a);
    setEditFields({
      name: a.name,
      email: a.email,
      referral_code: a.referral_code,
      commission_rate: a.commission_rate,
      status: a.status,
      notes: a.notes || "",
    });
    setEditMode(false);
  };

  // ── Save edits ─────────────────────────────────────────────
  const handleSave = async () => {
    if (!selected) return;
    const { data, error } = await supabase
      .from("affiliates")
      .update({
        name: editFields.name.trim(),
        email: editFields.email.trim().toLowerCase(),
        referral_code: editFields.referral_code.trim().toUpperCase(),
        commission_rate: editFields.commission_rate,
        status: editFields.status,
        notes: editFields.notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selected.id)
      .select()
      .single();
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Affiliate updated ✔");
      const updated = data as Affiliate;
      setAffiliates((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setSelected(updated);
      setEditMode(false);
      await logAudit(adminUser!.id, "update_affiliate", "affiliate", updated.id, selected, updated);
    }
  };

  // ── Quick status toggle ────────────────────────────────────
  const quickStatus = async (a: Affiliate, status: Affiliate["status"]) => {
    const { error } = await supabase
      .from("affiliates")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Affiliate ${status}`);
    setAffiliates((prev) => prev.map((x) => x.id === a.id ? { ...x, status } : x));
    if (selected?.id === a.id) setSelected((prev) => prev ? { ...prev, status } : prev);
    await logAudit(adminUser!.id, `affiliate_${status}`, "affiliate", a.id, { status: a.status }, { status });
  };

  // ── Delete ─────────────────────────────────────────────────
  const handleDelete = async (a: Affiliate) => {
    if (!confirm(`Delete affiliate "${a.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("affiliates").delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Affiliate deleted");
    setAffiliates((prev) => prev.filter((x) => x.id !== a.id));
    if (selected?.id === a.id) setSelected(null);
    await logAudit(adminUser!.id, "delete_affiliate", "affiliate", a.id, a, {});
  };

  // ── Mark paid ──────────────────────────────────────────────
  const markPaid = async (a: Affiliate) => {
    const owed = Math.max(0, (a.total_earnings || 0) - (a.paid_out || 0));
    if (owed <= 0) { toast.info("Nothing owed"); return; }
    const { data, error } = await supabase
      .from("affiliates")
      .update({ paid_out: a.total_earnings, updated_at: new Date().toISOString() })
      .eq("id", a.id)
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked $${owed.toFixed(2)} as paid ✔`);
    setAffiliates((prev) => prev.map((x) => x.id === a.id ? data as Affiliate : x));
    if (selected?.id === a.id) setSelected(data as Affiliate);
    await logAudit(adminUser!.id, "affiliate_payout", "affiliate", a.id, { paid_out: a.paid_out }, { paid_out: a.total_earnings });
  };

  // ── Generate random code ───────────────────────────────────
  const genCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-[#22d3ee]" />
            Affiliate Management
          </h2>
          <p className="text-sm text-white/40 mt-0.5">
            Create, manage and track all affiliate partners
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchAffiliates}
            className="text-white/50 hover:text-white gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreate(true)}
            className="bg-[#22d3ee]/20 hover:bg-[#22d3ee]/30 text-[#22d3ee] border border-[#22d3ee]/25 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New Affiliate
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Affiliates" value={stats.total} sub={`${stats.active} active`} color="bg-[#22d3ee]/10 text-[#22d3ee]" />
        <StatCard icon={MousePointerClick} label="Total Clicks" value={stats.totalClicks.toLocaleString()} color="bg-purple-500/10 text-purple-400" />
        <StatCard icon={UserPlus} label="Sign-ups" value={stats.totalSignups.toLocaleString()} sub={`${stats.totalConversions} conversions`} color="bg-emerald-500/10 text-emerald-400" />
        <StatCard icon={DollarSign} label="Total Owed" value={`$${stats.totalOwed.toFixed(2)}`} sub={`$${stats.totalEarnings.toFixed(2)} earned`} color="bg-yellow-500/10 text-yellow-400" />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="bg-white/[0.04] border border-white/[0.07]">
          <TabsTrigger value="list">Affiliates</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>

        {/* ── List tab ── */}
        <TabsContent value="list" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, code…"
                className="pl-8 bg-white/[0.04] border-white/[0.07] text-sm h-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 bg-white/[0.04] border-white/[0.07] h-9 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-[#22d3ee]" />
            </div>
          ) : filtered.length === 0 ? (
            <Card className="bg-white/[0.02] border-white/[0.06]">
              <CardContent className="py-12 text-center text-white/30 text-sm">
                {affiliates.length === 0 ? (
                  <>
                    <Users className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p>No affiliates yet.</p>
                    <p className="text-xs mt-1 text-white/20">Click "New Affiliate" to add one.</p>
                  </>
                ) : "No affiliates match your filter."}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white/[0.02] border-white/[0.06] overflow-hidden">
              <ScrollArea className="max-h-[520px]">
                <table className="w-full text-sm">
                  <thead className="border-b border-white/[0.06] sticky top-0 bg-[#0a1118]/90 backdrop-blur-sm">
                    <tr className="text-white/30 text-[11px] font-medium uppercase tracking-wider">
                      <th className="text-left px-4 py-2.5">Affiliate</th>
                      <th className="text-left px-4 py-2.5 hidden md:table-cell">Code</th>
                      <th className="text-left px-4 py-2.5 hidden lg:table-cell">Commission</th>
                      <th className="text-right px-4 py-2.5 hidden sm:table-cell">Clicks</th>
                      <th className="text-right px-4 py-2.5 hidden sm:table-cell">Sign-ups</th>
                      <th className="text-right px-4 py-2.5">Earnings</th>
                      <th className="text-center px-4 py-2.5">Status</th>
                      <th className="text-right px-4 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filtered.map((a) => {
                      const owed = Math.max(0, (a.total_earnings || 0) - (a.paid_out || 0));
                      return (
                        <tr key={a.id} className="hover:bg-white/[0.025] transition-colors group">
                          {/* Name / email */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#22d3ee]/30 to-purple-500/30 flex items-center justify-center text-xs font-bold text-white/80 shrink-0">
                                {a.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-white/90 truncate max-w-[120px]">{a.name}</p>
                                <p className="text-[11px] text-white/35 truncate max-w-[120px]">{a.email}</p>
                              </div>
                            </div>
                          </td>
                          {/* Code + copy */}
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="flex items-center gap-1">
                              <code className="text-[#22d3ee] text-xs font-mono bg-[#22d3ee]/10 px-1.5 py-0.5 rounded">
                                {a.referral_code}
                              </code>
                              <button
                                onClick={() => copyToClipboard(refLink(a.referral_code), "Link copied!")}
                                className="opacity-0 group-hover:opacity-100 transition text-white/30 hover:text-white"
                                title="Copy referral link"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                          {/* Commission */}
                          <td className="px-4 py-3 hidden lg:table-cell text-white/50">
                            {a.commission_rate}%
                          </td>
                          {/* Clicks */}
                          <td className="px-4 py-3 text-right text-white/60 hidden sm:table-cell">
                            {(a.clicks || 0).toLocaleString()}
                          </td>
                          {/* Sign-ups */}
                          <td className="px-4 py-3 text-right text-white/60 hidden sm:table-cell">
                            {(a.signups || 0).toLocaleString()}
                          </td>
                          {/* Earnings */}
                          <td className="px-4 py-3 text-right">
                            <div>
                              <p className="font-medium text-white/80">${(a.total_earnings || 0).toFixed(2)}</p>
                              {owed > 0 && (
                                <p className="text-[10px] text-yellow-400">${owed.toFixed(2)} owed</p>
                              )}
                            </div>
                          </td>
                          {/* Status badge */}
                          <td className="px-4 py-3 text-center">
                            <Badge className={`text-[10px] border ${statusColor[a.status]}`}>
                              {a.status}
                            </Badge>
                          </td>
                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openDetail(a)}
                                className="p-1.5 rounded-md text-white/30 hover:text-white hover:bg-white/[0.06] transition"
                                title="View details"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              {a.status !== "active" && (
                                <button
                                  onClick={() => quickStatus(a, "active")}
                                  className="p-1.5 rounded-md text-white/30 hover:text-emerald-400 hover:bg-emerald-500/10 transition"
                                  title="Activate"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {a.status !== "suspended" && (
                                <button
                                  onClick={() => quickStatus(a, "suspended")}
                                  className="p-1.5 rounded-md text-white/30 hover:text-red-400 hover:bg-red-500/10 transition"
                                  title="Suspend"
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(a)}
                                className="p-1.5 rounded-md text-white/30 hover:text-red-400 hover:bg-red-500/10 transition"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollArea>
            </Card>
          )}
        </TabsContent>

        {/* ── Payouts tab ── */}
        <TabsContent value="payouts" className="mt-4">
          <Card className="bg-white/[0.02] border-white/[0.06]">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-yellow-400" />
                Outstanding Payouts
              </CardTitle>
              <CardDescription className="text-white/35 text-xs">
                Affiliates with unpaid commissions
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {affiliates.filter((a) => (a.total_earnings || 0) - (a.paid_out || 0) > 0).length === 0 ? (
                <p className="px-6 pb-6 text-sm text-white/30">
                  No outstanding payouts 🎉
                </p>
              ) : (
                <ScrollArea className="max-h-96">
                  <table className="w-full text-sm">
                    <thead className="border-b border-white/[0.06] bg-white/[0.02]">
                      <tr className="text-white/30 text-[11px] uppercase tracking-wider">
                        <th className="text-left px-4 py-2.5">Affiliate</th>
                        <th className="text-right px-4 py-2.5">Total Earned</th>
                        <th className="text-right px-4 py-2.5">Already Paid</th>
                        <th className="text-right px-4 py-2.5">Owed</th>
                        <th className="text-right px-4 py-2.5">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {affiliates
                        .filter((a) => (a.total_earnings || 0) - (a.paid_out || 0) > 0)
                        .sort((a, b) => ((b.total_earnings - b.paid_out) - (a.total_earnings - a.paid_out)))
                        .map((a) => {
                          const owed = (a.total_earnings || 0) - (a.paid_out || 0);
                          return (
                            <tr key={a.id} className="hover:bg-white/[0.025]">
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium text-white/80">{a.name}</p>
                                  <p className="text-[11px] text-white/30">{a.email}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-white/60">
                                ${(a.total_earnings || 0).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right text-white/60">
                                ${(a.paid_out || 0).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-yellow-400">
                                ${owed.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  size="sm"
                                  onClick={() => markPaid(a)}
                                  className="h-7 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/25"
                                >
                                  Mark Paid
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ════════════════════════════════════════════════════════
          Create affiliate modal
      ════════════════════════════════════════════════════════ */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md bg-[#0a1118] border-white/[0.09] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4 text-[#22d3ee]" />
              New Affiliate
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs text-white/50 mb-1.5 block">Full Name *</Label>
                <Input
                  value={newAffiliate.name}
                  onChange={(e) => setNewAffiliate((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Jane Smith"
                  className="bg-white/[0.04] border-white/[0.08] text-sm"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-white/50 mb-1.5 block">Email *</Label>
                <Input
                  value={newAffiliate.email}
                  onChange={(e) => setNewAffiliate((p) => ({ ...p, email: e.target.value }))}
                  placeholder="jane@example.com"
                  type="email"
                  className="bg-white/[0.04] border-white/[0.08] text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-white/50 mb-1.5 block">Referral Code *</Label>
                <div className="flex gap-1.5">
                  <Input
                    value={newAffiliate.referral_code}
                    onChange={(e) => setNewAffiliate((p) => ({ ...p, referral_code: e.target.value.toUpperCase() }))}
                    placeholder="JANE2024"
                    className="bg-white/[0.04] border-white/[0.08] text-sm font-mono"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setNewAffiliate((p) => ({ ...p, referral_code: genCode() }))}
                    className="shrink-0 text-white/40 hover:text-white border border-white/[0.08] h-9 px-2"
                    title="Auto-generate"
                  >
                    ✨
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-white/50 mb-1.5 block">Commission %</Label>
                <div className="relative">
                  <Input
                    value={newAffiliate.commission_rate}
                    onChange={(e) => setNewAffiliate((p) => ({ ...p, commission_rate: Math.min(100, Math.max(0, +e.target.value || 0)) }))}
                    type="number"
                    min={0}
                    max={100}
                    className="bg-white/[0.04] border-white/[0.08] text-sm pr-8"
                  />
                  <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                </div>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-white/50 mb-1.5 block">Notes (optional)</Label>
                <Input
                  value={newAffiliate.notes}
                  onChange={(e) => setNewAffiliate((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="e.g. Influencer — 100k followers"
                  className="bg-white/[0.04] border-white/[0.08] text-sm"
                />
              </div>
            </div>
            {/* Preview link */}
            {newAffiliate.referral_code && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.07]">
                <Link2 className="h-3.5 w-3.5 text-white/30 shrink-0" />
                <p className="text-[11px] text-white/40 truncate font-mono">
                  {refLink(newAffiliate.referral_code)}
                </p>
                <button
                  onClick={() => copyToClipboard(refLink(newAffiliate.referral_code), "Link copied!")}
                  className="shrink-0 text-white/30 hover:text-white"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)} className="text-white/50">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={creating}
                className="bg-[#22d3ee]/20 hover:bg-[#22d3ee]/30 text-[#22d3ee] border border-[#22d3ee]/25 gap-1.5"
              >
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Create Affiliate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════
          Detail / edit modal
      ════════════════════════════════════════════════════════ */}
      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null); }}>
        <DialogContent className="max-w-lg bg-[#0a1118] border-white/[0.09] text-white">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <BadgeCheck className="h-4 w-4 text-[#22d3ee]" />
                  {editMode ? "Edit Affiliate" : selected.name}
                  <Badge className={`ml-2 text-[10px] border ${statusColor[selected.status]}`}>
                    {selected.status}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              {editMode ? (
                /* Edit form */
                <div className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label className="text-xs text-white/50 mb-1.5 block">Name</Label>
                      <Input value={editFields.name} onChange={(e) => setEditFields((p) => ({ ...p, name: e.target.value }))} className="bg-white/[0.04] border-white/[0.08] text-sm" />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-white/50 mb-1.5 block">Email</Label>
                      <Input value={editFields.email} onChange={(e) => setEditFields((p) => ({ ...p, email: e.target.value }))} type="email" className="bg-white/[0.04] border-white/[0.08] text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-white/50 mb-1.5 block">Referral Code</Label>
                      <Input value={editFields.referral_code} onChange={(e) => setEditFields((p) => ({ ...p, referral_code: e.target.value.toUpperCase() }))} className="bg-white/[0.04] border-white/[0.08] text-sm font-mono" />
                    </div>
                    <div>
                      <Label className="text-xs text-white/50 mb-1.5 block">Commission %</Label>
                      <Input value={editFields.commission_rate} onChange={(e) => setEditFields((p) => ({ ...p, commission_rate: Math.min(100, Math.max(0, +e.target.value || 0)) }))} type="number" min={0} max={100} className="bg-white/[0.04] border-white/[0.08] text-sm" />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-white/50 mb-1.5 block">Status</Label>
                      <Select value={editFields.status} onValueChange={(v) => setEditFields((p) => ({ ...p, status: v as Affiliate["status"] }))}>
                        <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-sm h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-white/50 mb-1.5 block">Notes</Label>
                      <Input value={editFields.notes} onChange={(e) => setEditFields((p) => ({ ...p, notes: e.target.value }))} className="bg-white/[0.04] border-white/[0.08] text-sm" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditMode(false)} className="text-white/50">
                      <X className="h-3.5 w-3.5 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} className="bg-[#22d3ee]/20 hover:bg-[#22d3ee]/30 text-[#22d3ee] border border-[#22d3ee]/25 gap-1.5">
                      <Save className="h-3.5 w-3.5" /> Save
                    </Button>
                  </div>
                </div>
              ) : (
                /* View details */
                <div className="space-y-5 mt-2">
                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Clicks", value: (selected.clicks || 0).toLocaleString(), icon: MousePointerClick, color: "text-purple-400" },
                      { label: "Sign-ups", value: (selected.signups || 0).toLocaleString(), icon: UserPlus, color: "text-[#22d3ee]" },
                      { label: "Conversions", value: (selected.conversions || 0).toLocaleString(), icon: TrendingUp, color: "text-emerald-400" },
                    ].map((s) => (
                      <div key={s.label} className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <s.icon className={`h-4 w-4 mx-auto mb-1 ${s.color}`} />
                        <p className="text-base font-bold">{s.value}</p>
                        <p className="text-[10px] text-white/30">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Earnings */}
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1.5">
                    <p className="text-[10px] text-white/30 uppercase tracking-wide font-medium">Earnings</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Commission rate</span>
                      <span className="font-medium">{selected.commission_rate}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Total earned</span>
                      <span className="font-medium">${(selected.total_earnings || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Paid out</span>
                      <span className="font-medium">${(selected.paid_out || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-white/[0.06] pt-1.5">
                      <span className="text-white/50">Outstanding</span>
                      <span className="font-bold text-yellow-400">${Math.max(0, (selected.total_earnings || 0) - (selected.paid_out || 0)).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Referral link */}
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wide font-medium mb-1.5">Referral Link</p>
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.07]">
                      <Link2 className="h-3.5 w-3.5 text-white/30 shrink-0" />
                      <p className="text-[11px] text-white/50 truncate font-mono flex-1">
                        {refLink(selected.referral_code)}
                      </p>
                      <button
                        onClick={() => copyToClipboard(refLink(selected.referral_code), "Referral link copied!")}
                        className="shrink-0 text-white/30 hover:text-[#22d3ee] transition"
                        title="Copy link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="text-xs text-white/25 space-y-0.5">
                    <p>Created {format(new Date(selected.created_at), "dd MMM yyyy")}</p>
                    {selected.notes && <p className="italic text-white/35">{selected.notes}</p>}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/[0.06]">
                    <Button size="sm" onClick={() => setEditMode(true)} className="gap-1.5 h-8 text-xs bg-white/[0.06] hover:bg-white/[0.09] text-white/70 border border-white/[0.08]">
                      <Edit className="h-3.5 w-3.5" /> Edit
                    </Button>
                    {selected.status !== "active" && (
                      <Button size="sm" onClick={() => quickStatus(selected, "active")} className="gap-1.5 h-8 text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/25">
                        <CheckCircle className="h-3.5 w-3.5" /> Activate
                      </Button>
                    )}
                    {selected.status !== "suspended" && (
                      <Button size="sm" onClick={() => quickStatus(selected, "suspended")} className="gap-1.5 h-8 text-xs bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/25">
                        <Ban className="h-3.5 w-3.5" /> Suspend
                      </Button>
                    )}
                    {(selected.total_earnings || 0) - (selected.paid_out || 0) > 0 && (
                      <Button size="sm" onClick={() => markPaid(selected)} className="gap-1.5 h-8 text-xs bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-400 border border-yellow-500/25">
                        <DollarSign className="h-3.5 w-3.5" /> Mark Paid
                      </Button>
                    )}
                    <Button size="sm" onClick={() => handleDelete(selected)} className="gap-1.5 h-8 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 ml-auto">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
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
