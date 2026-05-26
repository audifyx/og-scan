/* ══════════════════════════════════════════════════════════════
   Admin · Chat & Discussions Management
   Features: chat messages, alpha discussions, chat-tracked
   wallets, delete msgs, bulk clear, search
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { logAudit, shortId } from "../helpers";
import {
  MessageSquare, Search, Trash2, Loader2, RefreshCw,
  Wallet, Brain, AlertTriangle,
} from "lucide-react";

export const ChatManagement = () => {
  const { user: admin } = useAuth();
  const [tab, setTab] = useState("messages");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [chatWallets, setChatWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetch = async () => {
    setLoading(true);
    const [msgsR, discR, walletsR] = await Promise.all([
      supabase.from("chat_messages").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("alpha_discussions").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("chat_tracked_wallets").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setChatMessages(msgsR.data || []);
    setDiscussions(discR.data || []);
    setChatWallets(walletsR.data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const deleteMessage = async (id: string) => {
    if (!admin) return;
    await supabase.from("chat_messages").delete().eq("id", id);
    toast.success("Deleted");
    fetch();
  };

  const bulkDeleteMessages = async () => {
    if (!admin || selected.size === 0 || !window.confirm(`Delete ${selected.size} messages?`)) return;
    for (const id of selected) await supabase.from("chat_messages").delete().eq("id", id);
    await logAudit(admin.id, `Bulk deleted ${selected.size} chat messages`, "chat_messages");
    toast.success(`${selected.size} deleted`);
    setSelected(new Set());
    fetch();
  };

  const clearAllMessages = async () => {
    if (!admin || !window.confirm("Clear ALL chat messages? This cannot be undone!")) return;
    await supabase.from("chat_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await logAudit(admin.id, "Cleared all chat messages", "chat_messages");
    toast.success("All messages cleared");
    fetch();
  };

  const deleteDiscussion = async (id: string) => {
    if (!admin || !window.confirm("Delete this discussion?")) return;
    await supabase.from("alpha_discussions").delete().eq("id", id);
    toast.success("Deleted");
    fetch();
  };

  const deleteChatWallet = async (id: string) => {
    if (!admin) return;
    await supabase.from("chat_tracked_wallets").delete().eq("id", id);
    toast.success("Removed");
    fetch();
  };

  const filteredMsgs = chatMessages.filter((m) => !search || (m.content || "").toLowerCase().includes(search.toLowerCase()));
  const filteredDisc = discussions.filter((d) => !search || (d.title || d.content || "").toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#22d3ee]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3"><MessageSquare className="h-6 w-6 text-[#22d3ee]" /> Chat & Discussions</h2>
          <p className="text-sm text-muted-foreground">{chatMessages.length} messages, {discussions.length} discussions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={clearAllMessages} variant="outline" size="sm" className="gap-2 text-red-400 border-red-500/30"><AlertTriangle className="h-3.5 w-3.5" /> Clear All</Button>
          <Button onClick={fetch} variant="outline" size="sm"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="og-glass-card"><CardContent className="p-3 flex items-center gap-2"><MessageSquare className="h-5 w-5 text-indigo-400" /><div><p className="text-lg font-bold">{chatMessages.length}</p><p className="text-[10px] text-muted-foreground">Chat Messages</p></div></CardContent></Card>
        <Card className="og-glass-card"><CardContent className="p-3 flex items-center gap-2"><Brain className="h-5 w-5 text-purple-400" /><div><p className="text-lg font-bold">{discussions.length}</p><p className="text-[10px] text-muted-foreground">Alpha Discussions</p></div></CardContent></Card>
        <Card className="og-glass-card"><CardContent className="p-3 flex items-center gap-2"><Wallet className="h-5 w-5 text-green-400" /><div><p className="text-lg font-bold">{chatWallets.length}</p><p className="text-[10px] text-muted-foreground">Tracked Wallets</p></div></CardContent></Card>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
        {selected.size > 0 && (
          <Button variant="outline" size="sm" onClick={bulkDeleteMessages} className="gap-2 text-red-400"><Trash2 className="h-3.5 w-3.5" /> Delete {selected.size}</Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/[0.04]">
          <TabsTrigger value="messages">Messages ({filteredMsgs.length})</TabsTrigger>
          <TabsTrigger value="discussions">Discussions ({filteredDisc.length})</TabsTrigger>
          <TabsTrigger value="wallets">Tracked Wallets ({chatWallets.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="mt-4">
          <ScrollArea className="h-[500px]"><div className="space-y-2">
            {filteredMsgs.map((m) => (
              <div key={m.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03]">
                <input type="checkbox" checked={selected.has(m.id)} onChange={() => { setSelected((p) => { const s = new Set(p); s.has(m.id) ? s.delete(m.id) : s.add(m.id); return s; }); }} className="mt-1 rounded" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <code className="text-[10px] text-muted-foreground">{shortId(m.user_id || m.sender_id || "")}</code>
                    {m.room_id && <Badge variant="outline" className="text-[10px]">Room: {shortId(m.room_id)}</Badge>}
                  </div>
                  <p className="text-sm line-clamp-2">{m.content}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteMessage(m.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
              </div>
            ))}
            {filteredMsgs.length === 0 && <p className="text-center py-8 text-muted-foreground">No messages</p>}
          </div></ScrollArea>
        </TabsContent>

        <TabsContent value="discussions" className="mt-4">
          <ScrollArea className="h-[500px]"><div className="space-y-2">
            {filteredDisc.map((d) => (
              <Card key={d.id} className="og-glass-card">
                <CardContent className="p-4 flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{d.title || "Untitled"}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{d.content || d.description || "—"}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                      <code>{shortId(d.user_id || d.author_id || "")}</code>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => deleteDiscussion(d.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                </CardContent>
              </Card>
            ))}
            {filteredDisc.length === 0 && <p className="text-center py-8 text-muted-foreground">No discussions</p>}
          </div></ScrollArea>
        </TabsContent>

        <TabsContent value="wallets" className="mt-4">
          <ScrollArea className="h-[500px]"><div className="space-y-2">
            {chatWallets.map((w) => (
              <div key={w.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                <div className="flex items-center gap-3">
                  <Wallet className="h-4 w-4 text-green-400" />
                  <div>
                    <p className="text-sm font-mono">{w.wallet_address ? `${w.wallet_address.slice(0, 12)}…` : "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{w.label || w.name || "No label"} · by {shortId(w.user_id || "")}</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteChatWallet(w.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
              </div>
            ))}
            {chatWallets.length === 0 && <p className="text-center py-8 text-muted-foreground">No tracked wallets</p>}
          </div></ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};
