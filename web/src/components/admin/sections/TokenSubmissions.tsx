/* ══════════════════════════════════════════════════════════════
   Admin · Token Submissions
   Features: queue, approve/reject, feature, delete, edit notes,
   tracked tokens management, bulk actions
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { logAudit, shortId } from "../helpers";
import {
  Rocket, Search, Trash2, CheckCircle, XCircle, Star,
  Loader2, RefreshCw, Eye, Edit, Copy, ExternalLink,
  Clock, Filter, Coins,
} from "lucide-react";
import type { Submission, TrackedToken } from "../types";

export const TokenSubmissions = () => {
  const { user: admin } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [trackedTokens, setTrackedTokens] = useState<TrackedToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tab, setTab] = useState("submissions");
  const [processing, setProcessing] = useState(false);

  // Detail
  const [selected, setSelected] = useState<Submission | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const fetch = async () => {
    setLoading(true);
    const [subsR, tokensR] = await Promise.all([
      supabase.from("pump_v5_submissions").select("*").order("created_at", { ascending: false }),
      supabase.from("tracked_tokens").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    setSubmissions(subsR.data || []);
    setTrackedTokens(tokensR.data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const updateSubmission = async (id: string, updates: Partial<Submission>) => {
    if (!admin) return;
    setProcessing(true);
    const { error } = await supabase.from("pump_v5_submissions").update({
      ...updates, approved_by: admin.id, approved_at: new Date().toISOString(),
    }).eq("id", id);
    if (!error) {
      await logAudit(admin.id, `Submission ${updates.status || "edit"}`, "pump_v5_submissions", id, undefined, updates);
      toast.success("Updated");
      fetch();
    } else toast.error("Failed");
    setProcessing(false);
  };

  const bulkApprove = async () => {
    if (!admin) return;
    const pending = submissions.filter((s) => s.status === "pending");
    if (!window.confirm(`Approve all ${pending.length} pending submissions?`)) return;
    for (const s of pending) {
      await supabase.from("pump_v5_submissions").update({ status: "approved", approved_by: admin.id, approved_at: new Date().toISOString() }).eq("id", s.id);
    }
    await logAudit(admin.id, `Bulk approved ${pending.length} submissions`, "pump_v5_submissions");
    toast.success(`${pending.length} approved`);
    fetch();
  };

  const bulkReject = async () => {
    if (!admin) return;
    const pending = submissions.filter((s) => s.status === "pending");
    if (!window.confirm(`Reject all ${pending.length} pending submissions?`)) return;
    for (const s of pending) {
      await supabase.from("pump_v5_submissions").update({ status: "rejected" }).eq("id", s.id);
    }
    await logAudit(admin.id, `Bulk rejected ${pending.length} submissions`, "pump_v5_submissions");
    toast.success(`${pending.length} rejected`);
    fetch();
  };

  const deleteSubmission = async (id: string) => {
    if (!admin || !window.confirm("Delete this submission?")) return;
    await supabase.from("pump_v5_submissions").delete().eq("id", id);
    await logAudit(admin.id, "Deleted submission", "pump_v5_submissions", id);
    toast.success("Deleted");
    setSelected(null);
    fetch();
  };

  const saveNotes = async () => {
    if (!admin || !selected) return;
    await supabase.from("pump_v5_submissions").update({ admin_notes: adminNotes }).eq("id", selected.id);
    toast.success("Notes saved");
    fetch();
  };

  const deleteTrackedToken = async (id: string) => {
    if (!admin || !window.confirm("Remove this tracked token?")) return;
    await supabase.from("tracked_tokens").delete().eq("id", id);
    toast.success("Removed");
    fetch();
  };

  const pendingCount = submissions.filter((s) => s.status === "pending").length;
  const filtered = submissions.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return s.token_name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q) || s.contract_address.toLowerCase().includes(q);
  });

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#22d3ee]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3"><Rocket className="h-6 w-6 text-[#22d3ee]" /> Token Listings</h2>
          <p className="text-sm text-muted-foreground">{submissions.length} submissions, {pendingCount} pending</p>
        </div>
        <div className="flex gap-2">
          {pendingCount > 0 && (
            <>
              <Button onClick={bulkApprove} size="sm" className="gap-2 bg-green-600 hover:bg-green-700"><CheckCircle className="h-3.5 w-3.5" /> Approve All ({pendingCount})</Button>
              <Button onClick={bulkReject} size="sm" variant="outline" className="gap-2 text-red-400"><XCircle className="h-3.5 w-3.5" /> Reject All</Button>
            </>
          )}
          <Button onClick={fetch} variant="outline" size="sm"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/[0.04]">
          <TabsTrigger value="submissions">Submissions ({submissions.length})</TabsTrigger>
          <TabsTrigger value="tracked">Tracked Tokens ({trackedTokens.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="submissions" className="mt-4 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search tokens…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="og-glass-card">
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Token</TableHead><TableHead>Contract</TableHead><TableHead>Platform</TableHead>
                      <TableHead>Status</TableHead><TableHead>Featured</TableHead><TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s) => (
                      <TableRow key={s.id} className="cursor-pointer hover:bg-white/[0.03]" onClick={() => { setSelected(s); setAdminNotes(s.admin_notes || ""); }}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {s.logo_url ? <img src={s.logo_url} alt="" className="h-7 w-7 rounded-lg object-cover" /> : <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#22d3ee] to-purple-600 flex items-center justify-center text-[10px] font-bold">{s.symbol.slice(0, 2)}</div>}
                            <div><p className="font-medium text-sm">{s.token_name}</p><p className="text-[10px] text-muted-foreground">${s.symbol}</p></div>
                          </div>
                        </TableCell>
                        <TableCell><code className="text-[10px] bg-white/[0.04] px-1.5 py-0.5 rounded">{s.contract_address.slice(0, 10)}…</code></TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{s.launch_platform}</Badge></TableCell>
                        <TableCell><Badge className={s.status === "pending" ? "bg-yellow-500/20 text-yellow-400" : s.status === "approved" || s.status === "live" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>{s.status}</Badge></TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}><Switch checked={s.is_featured} onCheckedChange={(c) => updateSubmission(s.id, { is_featured: c })} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            {s.status === "pending" && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => updateSubmission(s.id, { status: "approved" })} disabled={processing}><CheckCircle className="h-4 w-4 text-green-400" /></Button>
                                <Button size="sm" variant="ghost" onClick={() => updateSubmission(s.id, { status: "rejected" })} disabled={processing}><XCircle className="h-4 w-4 text-red-400" /></Button>
                              </>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => deleteSubmission(s.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
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

        <TabsContent value="tracked" className="mt-4">
          <Card className="og-glass-card">
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Token</TableHead><TableHead>Address</TableHead><TableHead>User</TableHead><TableHead>Added</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {trackedTokens.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.token_symbol || "—"}</TableCell>
                        <TableCell><code className="text-[10px]">{shortId(t.token_address)}</code></TableCell>
                        <TableCell><code className="text-[10px]">{shortId(t.user_id)}</code></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</TableCell>
                        <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => deleteTrackedToken(t.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg bg-[#0a1118] border-white/10">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selected.logo_url ? <img src={selected.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#22d3ee] to-purple-600 flex items-center justify-center font-bold">{selected.symbol.slice(0, 2)}</div>}
                  <div><p className="font-semibold">{selected.token_name} (${selected.symbol})</p><p className="text-xs text-muted-foreground">{selected.launch_platform}</p></div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div><Label className="text-xs text-muted-foreground">Contract Address</Label>
                  <div className="flex items-center gap-2 mt-1"><code className="text-xs bg-white/[0.04] px-2 py-1 rounded flex-1 truncate">{selected.contract_address}</code>
                    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(selected.contract_address); toast.success("Copied"); }}><Copy className="h-3 w-3" /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div><Label className="text-xs text-muted-foreground">Status</Label><Badge className="mt-1">{selected.status}</Badge></div>
                  <div><Label className="text-xs text-muted-foreground">Tier</Label><p className="text-sm">{selected.promotion_tier}</p></div>
                  <div><Label className="text-xs text-muted-foreground">Featured</Label><p className="text-sm">{selected.is_featured ? "Yes" : "No"}</p></div>
                </div>
                <div><Label>Admin Notes</Label><Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} className="mt-1" rows={3} />
                  <Button size="sm" onClick={saveNotes} className="mt-2 gap-2"><Edit className="h-3.5 w-3.5" /> Save Notes</Button>
                </div>
                <div className="flex gap-2">
                  {selected.status === "pending" && (
                    <>
                      <Button onClick={() => { updateSubmission(selected.id, { status: "approved" }); setSelected(null); }} className="flex-1 bg-green-600 hover:bg-green-700 gap-2"><CheckCircle className="h-4 w-4" /> Approve</Button>
                      <Button onClick={() => { updateSubmission(selected.id, { status: "rejected" }); setSelected(null); }} variant="outline" className="flex-1 text-red-400 gap-2"><XCircle className="h-4 w-4" /> Reject</Button>
                    </>
                  )}
                  <Button onClick={() => deleteSubmission(selected.id)} variant="outline" className="text-red-400 border-red-500/30 gap-2"><Trash2 className="h-4 w-4" /> Delete</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
