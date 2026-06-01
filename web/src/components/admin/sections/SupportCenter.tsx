/* ══════════════════════════════════════════════════════════════
   Admin · Support Center
   Features: tickets list, detail with messages thread, respond,
   close/reopen, priority, assign, delete
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { logAudit, shortId } from "../helpers";
import {
  LifeBuoy, Search, Trash2, Loader2, RefreshCw, Send,
  CheckCircle, Clock, AlertTriangle, XCircle, MessageSquare,
  ArrowUpCircle, ArrowDownCircle, Eye,
} from "lucide-react";

export const SupportCenter = () => {
  const { user: admin } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from("support_tickets").select("*").order("created_at", { ascending: false });
    setTickets(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  // Real-time: new tickets + new messages in the open ticket
  useEffect(() => {
    const channel = supabase.channel("admin-support-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_tickets" },
        () => fetch()
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "support_tickets" },
        () => fetch()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!selected) return;
    const channel = supabase.channel(`admin-support-msgs-${selected.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${selected.id}` },
        (payload) => setMessages(prev => [...prev, payload.new as any])
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected?.id]);

  const openTicket = async (t: any) => {
    setSelected(t); setReplyText("");
    const { data } = await supabase.from("support_messages").select("*").eq("ticket_id", t.id).order("created_at", { ascending: true });
    setMessages(data || []);
  };

  const sendReply = async () => {
    if (!admin || !selected || !replyText.trim()) return;
    setSending(true);
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: selected.id, sender_id: admin.id, content: replyText.trim(), is_admin: true,
    });
    if (error) { toast.error("Failed"); setSending(false); return; }
    await supabase.from("support_tickets").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", selected.id);
    await logAudit(admin.id, "Replied to support ticket", "support_tickets", selected.id);
    toast.success("Reply sent");
    setReplyText("");
    setSending(false);
    openTicket(selected);
    fetch();
  };

  const updateTicketStatus = async (id: string, status: string) => {
    if (!admin) return;
    await supabase.from("support_tickets").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    await logAudit(admin.id, `Ticket ${status}`, "support_tickets", id);
    toast.success(`Ticket ${status}`);
    fetch();
    if (selected?.id === id) setSelected({ ...selected, status });
  };

  const updatePriority = async (id: string, priority: string) => {
    if (!admin) return;
    await supabase.from("support_tickets").update({ priority }).eq("id", id);
    toast.success(`Priority set to ${priority}`);
    fetch();
  };

  const deleteTicket = async (id: string) => {
    if (!admin || !window.confirm("Delete this ticket and all messages?")) return;
    await supabase.from("support_messages").delete().eq("ticket_id", id);
    await supabase.from("support_tickets").delete().eq("id", id);
    await logAudit(admin.id, "Deleted support ticket", "support_tickets", id);
    toast.success("Deleted");
    setSelected(null);
    fetch();
  };

  const closeAllResolved = async () => {
    if (!admin || !window.confirm("Close all resolved tickets?")) return;
    await supabase.from("support_tickets").update({ status: "closed" }).eq("status", "resolved");
    await logAudit(admin.id, "Bulk closed resolved tickets", "support_tickets");
    toast.success("Done");
    fetch();
  };

  const priorityColor = (p: string) => {
    if (p === "urgent" || p === "critical") return "bg-red-500/20 text-red-400";
    if (p === "high") return "bg-orange-500/20 text-orange-400";
    if (p === "medium") return "bg-yellow-500/20 text-yellow-400";
    return "bg-gray-500/20 text-gray-400";
  };

  const statusColor = (s: string) => {
    if (s === "open") return "bg-blue-500/20 text-blue-400";
    if (s === "in_progress") return "bg-yellow-500/20 text-yellow-400";
    if (s === "resolved") return "bg-green-500/20 text-green-400";
    return "bg-gray-500/20 text-gray-400";
  };

  const filtered = tickets.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (!search) return true;
    return (t.subject || "").toLowerCase().includes(search.toLowerCase()) || (t.description || "").toLowerCase().includes(search.toLowerCase());
  });

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#22d3ee]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3"><LifeBuoy className="h-6 w-6 text-[#22d3ee]" /> Support Center</h2>
          <p className="text-sm text-muted-foreground">{openCount} open, {inProgressCount} in progress</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={closeAllResolved} variant="outline" size="sm" className="gap-2"><CheckCircle className="h-3.5 w-3.5" /> Close Resolved</Button>
          <Button onClick={fetch} variant="outline" size="sm"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Open", count: openCount, icon: Clock, color: "text-blue-400" },
          { label: "In Progress", count: inProgressCount, icon: ArrowUpCircle, color: "text-yellow-400" },
          { label: "Resolved", count: tickets.filter((t) => t.status === "resolved").length, icon: CheckCircle, color: "text-green-400" },
          { label: "Closed", count: tickets.filter((t) => t.status === "closed").length, icon: XCircle, color: "text-gray-400" },
        ].map((s) => (
          <Card key={s.label} className="og-glass-card"><CardContent className="p-3 flex items-center gap-2">
            <s.icon className={`h-5 w-5 ${s.color}`} />
            <div><p className="text-lg font-bold">{s.count}</p><p className="text-[10px] text-muted-foreground">{s.label}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search tickets…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="h-[500px]">
        <div className="space-y-2">
          {filtered.map((t) => (
            <Card key={t.id} className="og-glass-card cursor-pointer hover:border-white/20 transition" onClick={() => openTicket(t)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{t.subject || "No subject"}</p>
                    <Badge className={statusColor(t.status)}>{t.status}</Badge>
                    <Badge className={priorityColor(t.priority || "low")}>{t.priority || "low"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{t.description || "No description"}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <code>{shortId(t.user_id)}</code>
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" onClick={() => deleteTicket(t.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground">No tickets found</p>}
        </div>
      </ScrollArea>

      {/* Ticket Detail Modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto bg-[#0a1118] border-white/10">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <LifeBuoy className="h-6 w-6 text-[#22d3ee]" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{selected.subject || "No subject"}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge className={statusColor(selected.status)}>{selected.status}</Badge>
                      <Badge className={priorityColor(selected.priority || "low")}>{selected.priority || "low"}</Badge>
                      <code className="text-[10px] text-muted-foreground">{shortId(selected.user_id)}</code>
                    </div>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {selected.description && (
                  <Card className="og-glass-card"><CardContent className="p-3">
                    <p className="text-sm">{selected.description}</p>
                  </CardContent></Card>
                )}

                <div className="flex gap-2 flex-wrap">
                  <Select value={selected.status} onValueChange={(v) => updateTicketStatus(selected.id, v)}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selected.priority || "low"} onValueChange={(v) => updatePriority(selected.id, v)}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => deleteTicket(selected.id)} className="gap-1.5 text-red-400 border-red-500/30 ml-auto"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                </div>

                {/* Messages Thread */}
                <Card className="og-glass-card">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Conversation</CardTitle></CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[250px] mb-4">
                      <div className="space-y-3">
                        {messages.map((m) => (
                          <div key={m.id} className={`p-3 rounded-lg ${m.is_admin ? "bg-[#22d3ee]/10 border border-[#22d3ee]/20 ml-8" : "bg-white/[0.03] mr-8"}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-[10px]">{m.is_admin ? "Admin" : "User"}</Badge>
                              <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                          </div>
                        ))}
                        {messages.length === 0 && <p className="text-center py-4 text-sm text-muted-foreground">No messages yet</p>}
                      </div>
                    </ScrollArea>

                    <div className="flex gap-2">
                      <Textarea placeholder="Type your reply…" value={replyText} onChange={(e) => setReplyText(e.target.value)} className="flex-1" rows={2} />
                      <Button onClick={sendReply} disabled={sending || !replyText.trim()} className="self-end gap-2">
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
