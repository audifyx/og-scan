/* ══════════════════════════════════════════════════════════════
   Admin · Audit Log
   Features: full trail, filter by action/admin/target/date,
   detail modal, export CSV, search, pagination
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { shortId } from "../helpers";
import {
  FileText, Search, Loader2, RefreshCw, Download, Eye,
  Activity, Shield, Clock, Filter, Trash2,
} from "lucide-react";

export const AuditLog = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [targetFilter, setTargetFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

  const fetch = async () => {
    setLoading(true);
    let query = supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (dateRange === "today") query = query.gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
    else if (dateRange === "week") query = query.gte("created_at", subDays(new Date(), 7).toISOString());
    else if (dateRange === "month") query = query.gte("created_at", subDays(new Date(), 30).toISOString());

    const { data } = await query;
    setLogs(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [page, dateRange]);

  const uniqueActions = [...new Set(logs.map((l) => l.action).filter(Boolean))].sort();
  const uniqueTargets = [...new Set(logs.map((l) => l.target_type).filter(Boolean))].sort();

  const filtered = logs.filter((l) => {
    if (actionFilter !== "all" && l.action !== actionFilter) return false;
    if (targetFilter !== "all" && l.target_type !== targetFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (l.action || "").toLowerCase().includes(q)
      || (l.target_type || "").toLowerCase().includes(q)
      || (l.admin_id || "").toLowerCase().includes(q)
      || (l.target_id || "").toLowerCase().includes(q);
  });

  const exportCSV = () => {
    const rows = ["id,admin_id,action,target_type,target_id,created_at"];
    filtered.forEach((l) => {
      rows.push(`${l.id},${l.admin_id},${(l.action || "").replace(/,/g, ";")},${l.target_type || ""},${l.target_id || ""},${l.created_at}`);
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "audit_log.csv"; a.click();
    toast.success("Exported");
  };

  const clearOldLogs = async () => {
    if (!window.confirm("Delete audit logs older than 90 days?")) return;
    const cutoff = subDays(new Date(), 90).toISOString();
    await supabase.from("admin_audit_log").delete().lt("created_at", cutoff);
    toast.success("Old logs cleared");
    fetch();
  };

  const actionColor = (action: string) => {
    if (action?.includes("Delete") || action?.includes("delete") || action?.includes("Banned") || action?.includes("banned")) return "text-red-400";
    if (action?.includes("Created") || action?.includes("created") || action?.includes("Approved") || action?.includes("approved")) return "text-green-400";
    if (action?.includes("Updated") || action?.includes("updated") || action?.includes("Edited") || action?.includes("edited")) return "text-yellow-400";
    return "text-[#22d3ee]";
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#22d3ee]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3"><FileText className="h-6 w-6 text-[#22d3ee]" /> Audit Log</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} entries shown</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportCSV} variant="outline" size="sm" className="gap-2"><Download className="h-3.5 w-3.5" /> Export</Button>
          <Button onClick={clearOldLogs} variant="outline" size="sm" className="gap-2 text-orange-400"><Trash2 className="h-3.5 w-3.5" /> Clear 90d+</Button>
          <Button onClick={fetch} variant="outline" size="sm"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search logs…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={dateRange} onValueChange={(v) => { setDateRange(v); setPage(0); }}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {uniqueActions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={targetFilter} onValueChange={setTargetFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Target" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Targets</SelectItem>
            {uniqueTargets.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="og-glass-card">
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="space-y-1 p-2">
              {filtered.map((l) => (
                <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition" onClick={() => setSelected(l)}>
                  <Activity className={`h-4 w-4 flex-shrink-0 ${actionColor(l.action)}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${actionColor(l.action)}`}>{l.action}</p>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1"><Shield className="h-3 w-3" />{shortId(l.admin_id)}</span>
                      {l.target_type && <Badge variant="outline" className="text-[10px]">{l.target_type}</Badge>}
                      {l.target_id && <code>{shortId(l.target_id)}</code>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}</span>
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground">No audit logs found</p>}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
        <span className="text-xs text-muted-foreground">Page {page + 1}</span>
        <Button variant="outline" size="sm" disabled={logs.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg bg-[#0a1118] border-white/10">
          {selected && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-[#22d3ee]" /> Audit Entry</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-xs text-muted-foreground">Action</Label><p className={`text-sm font-medium ${actionColor(selected.action)}`}>{selected.action}</p></div>
                  <div><Label className="text-xs text-muted-foreground">Admin</Label><code className="text-xs">{selected.admin_id}</code></div>
                  <div><Label className="text-xs text-muted-foreground">Target Type</Label><p className="text-sm">{selected.target_type || "—"}</p></div>
                  <div><Label className="text-xs text-muted-foreground">Target ID</Label><code className="text-xs">{selected.target_id || "—"}</code></div>
                  <div><Label className="text-xs text-muted-foreground">Timestamp</Label><p className="text-sm">{format(new Date(selected.created_at), "PPpp")}</p></div>
                  <div><Label className="text-xs text-muted-foreground">ID</Label><code className="text-xs">{selected.id}</code></div>
                </div>
                {selected.old_data && (
                  <div><Label className="text-xs text-muted-foreground">Previous Data</Label><pre className="text-xs bg-white/[0.03] p-3 rounded-lg mt-1 overflow-auto max-h-[150px]">{JSON.stringify(selected.old_data, null, 2)}</pre></div>
                )}
                {selected.new_data && (
                  <div><Label className="text-xs text-muted-foreground">New Data</Label><pre className="text-xs bg-white/[0.03] p-3 rounded-lg mt-1 overflow-auto max-h-[150px]">{JSON.stringify(selected.new_data, null, 2)}</pre></div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
