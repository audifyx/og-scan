/* ══════════════════════════════════════════════════════════════
   Admin · Price Alerts Management
   Features: view all alerts, filter by active/inactive,
   delete, bulk delete, analytics, search
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { logAudit, shortId } from "../helpers";
import {
  Zap, Search, Trash2, Loader2, RefreshCw, Bell,
  BellOff, TrendingUp, TrendingDown, AlertTriangle,
} from "lucide-react";

export const PriceAlerts = () => {
  const { user: admin } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from("price_alerts").select("*").order("created_at", { ascending: false });
    setAlerts(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const toggleAlert = async (id: string, currentActive: boolean) => {
    await supabase.from("price_alerts").update({ is_active: !currentActive }).eq("id", id);
    toast.success(currentActive ? "Deactivated" : "Activated");
    fetch();
  };

  const deleteAlert = async (id: string) => {
    if (!admin) return;
    await supabase.from("price_alerts").delete().eq("id", id);
    toast.success("Deleted");
    fetch();
  };

  const bulkDelete = async () => {
    if (!admin || selected.size === 0 || !window.confirm(`Delete ${selected.size} alerts?`)) return;
    for (const id of selected) await supabase.from("price_alerts").delete().eq("id", id);
    await logAudit(admin.id, `Bulk deleted ${selected.size} alerts`, "price_alerts");
    toast.success(`${selected.size} deleted`);
    setSelected(new Set());
    fetch();
  };

  const clearTriggered = async () => {
    if (!admin || !window.confirm("Delete all triggered (inactive) alerts?")) return;
    await supabase.from("price_alerts").delete().eq("is_active", false);
    await logAudit(admin.id, "Cleared triggered alerts", "price_alerts");
    toast.success("Cleared");
    fetch();
  };

  const clearAll = async () => {
    if (!admin || !window.confirm("Delete ALL price alerts?")) return;
    await supabase.from("price_alerts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await logAudit(admin.id, "Cleared all price alerts", "price_alerts");
    toast.success("All cleared");
    fetch();
  };

  const filtered = alerts.filter((a) => {
    if (activeFilter === "active" && !a.is_active) return false;
    if (activeFilter === "inactive" && a.is_active) return false;
    if (!search) return true;
    return (a.token_symbol || "").toLowerCase().includes(search.toLowerCase())
      || (a.token_address || "").toLowerCase().includes(search.toLowerCase());
  });

  const activeCount = alerts.filter((a) => a.is_active).length;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#22d3ee]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3"><Zap className="h-6 w-6 text-[#22d3ee]" /> Price Alerts</h2>
          <p className="text-sm text-muted-foreground">{alerts.length} total, {activeCount} active</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={clearTriggered} variant="outline" size="sm" className="gap-2"><BellOff className="h-3.5 w-3.5" /> Clear Triggered</Button>
          <Button onClick={clearAll} variant="outline" size="sm" className="gap-2 text-red-400 border-red-500/30"><Trash2 className="h-3.5 w-3.5" /> Clear All</Button>
          <Button onClick={fetch} variant="outline" size="sm"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="og-glass-card"><CardContent className="p-3 flex items-center gap-2"><Bell className="h-5 w-5 text-amber-400" /><div><p className="text-lg font-bold">{activeCount}</p><p className="text-[10px] text-muted-foreground">Active</p></div></CardContent></Card>
        <Card className="og-glass-card"><CardContent className="p-3 flex items-center gap-2"><BellOff className="h-5 w-5 text-gray-400" /><div><p className="text-lg font-bold">{alerts.length - activeCount}</p><p className="text-[10px] text-muted-foreground">Triggered</p></div></CardContent></Card>
        <Card className="og-glass-card"><CardContent className="p-3 flex items-center gap-2"><Zap className="h-5 w-5 text-[#22d3ee]" /><div><p className="text-lg font-bold">{alerts.length}</p><p className="text-[10px] text-muted-foreground">Total</p></div></CardContent></Card>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by token…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Triggered</SelectItem>
          </SelectContent>
        </Select>
        {selected.size > 0 && <Button variant="outline" size="sm" onClick={bulkDelete} className="gap-2 text-red-400"><Trash2 className="h-3.5 w-3.5" /> Delete {selected.size}</Button>}
      </div>

      <ScrollArea className="h-[500px]">
        <div className="space-y-2">
          {filtered.map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
              <input type="checkbox" checked={selected.has(a.id)} onChange={() => { setSelected((p) => { const s = new Set(p); s.has(a.id) ? s.delete(a.id) : s.add(a.id); return s; }); }} className="rounded" />
              <div className="p-2 rounded-lg bg-amber-500/20">
                {a.condition === "above" ? <TrendingUp className="h-4 w-4 text-green-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{a.token_symbol || "Unknown"}</p>
                  <Badge variant="outline" className="text-[10px]">{a.condition || "threshold"}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                  <span>Target: ${a.target_price?.toLocaleString() || "—"}</span>
                  <span>·</span>
                  <code>{shortId(a.user_id)}</code>
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                </div>
              </div>
              <Switch checked={a.is_active} onCheckedChange={() => toggleAlert(a.id, a.is_active)} />
              <Button size="sm" variant="ghost" onClick={() => deleteAlert(a.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground">No alerts found</p>}
        </div>
      </ScrollArea>
    </div>
  );
};
