/* ══════════════════════════════════════════════════════════════
   Admin · Trading Lobby Management
   Features: list, create, edit, delete, members, messages,
   watchlists, toggle active/inactive
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { logAudit, shortId } from "../helpers";
import {
  Headphones, Search, Trash2, Users, MessageSquare, Eye,
  Loader2, RefreshCw, Plus, CheckCircle, X, Edit,
  UserMinus, Radio, Bookmark,
} from "lucide-react";
import type { LobbyData } from "../types";

export const LobbyManagement = () => {
  const { user: admin } = useAuth();
  const [lobbies, setLobbies] = useState<LobbyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Detail
  const [selected, setSelected] = useState<LobbyData | null>(null);
  const [detailTab, setDetailTab] = useState("info");
  const [members, setMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [watchlists, setWatchlists] = useState<any[]>([]);

  // Create/edit
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPrivacy, setFormPrivacy] = useState("public");

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from("trading_lobbies").select("*").order("created_at", { ascending: false });
    setLobbies(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openDetail = async (l: LobbyData) => {
    setSelected(l); setDetailTab("info");
    const [membersR, messagesR, watchlistR] = await Promise.all([
      supabase.from("lobby_members").select("*").eq("lobby_id", l.id).limit(200),
      supabase.from("lobby_messages").select("*").eq("lobby_id", l.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("lobby_watchlists").select("*").eq("lobby_id", l.id).limit(100),
    ]);
    setMembers(membersR.data || []);
    setMessages(messagesR.data || []);
    setWatchlists(watchlistR.data || []);
  };

  const toggleActive = async (l: LobbyData) => {
    if (!admin) return;
    const newActive = !l.is_active;
    await supabase.from("trading_lobbies").update({ is_active: newActive }).eq("id", l.id);
    await logAudit(admin.id, `${newActive ? "Activated" : "Deactivated"} lobby: ${l.name}`, "trading_lobbies", l.id);
    toast.success(newActive ? "Activated" : "Deactivated");
    fetch();
  };

  const deleteLobby = async (id: string, name: string) => {
    if (!admin || !window.confirm(`Delete lobby "${name}" and all messages/members?`)) return;
    await Promise.all([
      supabase.from("lobby_messages").delete().eq("lobby_id", id),
      supabase.from("lobby_members").delete().eq("lobby_id", id),
      supabase.from("lobby_watchlists").delete().eq("lobby_id", id),
    ]);
    await supabase.from("trading_lobbies").delete().eq("id", id);
    await logAudit(admin.id, `Deleted lobby: ${name}`, "trading_lobbies", id);
    toast.success("Deleted");
    setSelected(null);
    fetch();
  };

  const removeMember = async (id: string) => {
    if (!admin) return;
    await supabase.from("lobby_members").delete().eq("id", id);
    toast.success("Removed");
    if (selected) openDetail(selected);
  };

  const deleteMessage = async (id: string) => {
    if (!admin) return;
    await supabase.from("lobby_messages").delete().eq("id", id);
    toast.success("Deleted");
    if (selected) openDetail(selected);
  };

  const clearAllMessages = async (lobbyId: string) => {
    if (!admin || !window.confirm("Clear ALL messages in this lobby?")) return;
    await supabase.from("lobby_messages").delete().eq("lobby_id", lobbyId);
    await logAudit(admin.id, "Cleared all lobby messages", "lobby_messages", lobbyId);
    toast.success("Messages cleared");
    if (selected) openDetail(selected);
  };

  const createOrEdit = async () => {
    if (!admin || !formName.trim()) return;
    if (editMode && selected) {
      await supabase.from("trading_lobbies").update({ name: formName, description: formDesc || null, privacy: formPrivacy }).eq("id", selected.id);
      await logAudit(admin.id, `Edited lobby: ${formName}`, "trading_lobbies", selected.id);
      toast.success("Updated");
    } else {
      await supabase.from("trading_lobbies").insert({ name: formName, description: formDesc || null, privacy: formPrivacy, created_by: admin.id, is_active: true });
      await logAudit(admin.id, `Created lobby: ${formName}`, "trading_lobbies");
      toast.success("Created");
    }
    setShowForm(false);
    fetch();
  };

  const filtered = lobbies.filter((l) => !search || l.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#22d3ee]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3"><Headphones className="h-6 w-6 text-[#22d3ee]" /> Trading Lobbies</h2>
          <p className="text-sm text-muted-foreground">{lobbies.length} total, {lobbies.filter((l) => l.is_active).length} active</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setFormName(""); setFormDesc(""); setFormPrivacy("public"); setEditMode(false); setShowForm(true); }} size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" /> Create</Button>
          <Button onClick={fetch} variant="outline" size="sm"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search lobbies…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>

      <ScrollArea className="h-[550px]">
        <div className="space-y-3">
          {filtered.map((l) => (
            <Card key={l.id} className="og-glass-card cursor-pointer hover:border-white/20 transition" onClick={() => openDetail(l)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-2.5 rounded-xl bg-blue-500/20"><Headphones className="h-5 w-5 text-blue-400" /></div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{l.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{l.description || "No description"}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {l.member_count || 0}</span>
                      <Badge variant="outline" className="text-[10px]">{l.privacy}</Badge>
                      <span>by {l.creator_name || shortId(l.created_by)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Switch checked={!!l.is_active} onCheckedChange={() => toggleActive(l)} />
                  <Badge className={l.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>{l.is_active ? "Active" : "Inactive"}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => { setFormName(l.name); setFormDesc(l.description || ""); setFormPrivacy(l.privacy); setEditMode(true); setSelected(l); setShowForm(true); }}><Edit className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteLobby(l.id, l.name)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground">No lobbies found</p>}
        </div>
      </ScrollArea>

      {/* Detail Modal */}
      <Dialog open={!!selected && !showForm} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto bg-[#0a1118] border-white/10">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Headphones className="h-6 w-6 text-blue-400" />
                  <div><p className="font-semibold">{selected.name}</p><p className="text-xs text-muted-foreground">{selected.privacy} · {selected.member_count || 0} members</p></div>
                </DialogTitle>
              </DialogHeader>
              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList className="bg-white/[0.04] w-full justify-start">
                  <TabsTrigger value="info">Info</TabsTrigger>
                  <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
                  <TabsTrigger value="messages">Messages ({messages.length})</TabsTrigger>
                  <TabsTrigger value="watchlists">Watchlists ({watchlists.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                  <Card className="og-glass-card"><CardContent className="p-4 space-y-2">
                    <div><Label className="text-xs text-muted-foreground">Description</Label><p className="text-sm">{selected.description || "—"}</p></div>
                    <div className="grid grid-cols-3 gap-4">
                      <div><Label className="text-xs text-muted-foreground">Privacy</Label><p className="text-sm">{selected.privacy}</p></div>
                      <div><Label className="text-xs text-muted-foreground">Status</Label><Badge className={selected.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>{selected.is_active ? "Active" : "Inactive"}</Badge></div>
                      <div><Label className="text-xs text-muted-foreground">Creator</Label><code className="text-xs">{shortId(selected.created_by)}</code></div>
                    </div>
                  </CardContent></Card>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => clearAllMessages(selected.id)} className="gap-2 text-orange-400"><Trash2 className="h-3.5 w-3.5" /> Clear Messages</Button>
                    <Button size="sm" variant="outline" onClick={() => deleteLobby(selected.id, selected.name)} className="gap-2 text-red-400 border-red-500/30"><Trash2 className="h-3.5 w-3.5" /> Delete Lobby</Button>
                  </div>
                </TabsContent>

                <TabsContent value="members">
                  <ScrollArea className="h-[400px]"><div className="space-y-2">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                        <div><code className="text-xs">{shortId(m.user_id)}</code><p className="text-[10px] text-muted-foreground">{m.role} · {formatDistanceToNow(new Date(m.joined_at), { addSuffix: true })}</p></div>
                        <Button size="sm" variant="ghost" onClick={() => removeMember(m.id)}><UserMinus className="h-4 w-4 text-red-400" /></Button>
                      </div>
                    ))}
                    {members.length === 0 && <p className="text-center py-4 text-sm text-muted-foreground">No members</p>}
                  </div></ScrollArea>
                </TabsContent>

                <TabsContent value="messages">
                  <ScrollArea className="h-[400px]"><div className="space-y-2">
                    {messages.map((m) => (
                      <div key={m.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03]">
                        <div className="flex-1 min-w-0">
                          <code className="text-[10px] text-muted-foreground">{shortId(m.user_id)}</code>
                          <p className="text-sm line-clamp-2">{m.content}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => deleteMessage(m.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
                      </div>
                    ))}
                    {messages.length === 0 && <p className="text-center py-4 text-sm text-muted-foreground">No messages</p>}
                  </div></ScrollArea>
                </TabsContent>

                <TabsContent value="watchlists">
                  <ScrollArea className="h-[400px]"><div className="space-y-2">
                    {watchlists.map((w) => (
                      <div key={w.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03]">
                        <Bookmark className="h-4 w-4 text-yellow-400" />
                        <div>
                          <p className="text-sm font-medium">{w.token_symbol || w.token_address || "Unknown"}</p>
                          <code className="text-[10px] text-muted-foreground">{w.token_address ? shortId(w.token_address) : ""}</code>
                        </div>
                      </div>
                    ))}
                    {watchlists.length === 0 && <p className="text-center py-4 text-sm text-muted-foreground">No watchlist items</p>}
                  </div></ScrollArea>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg bg-[#0a1118] border-white/10">
          <DialogHeader><DialogTitle>{editMode ? "Edit" : "Create"} Lobby</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} className="mt-1" /></div>
            <div><Label>Description</Label><Textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="mt-1" rows={3} /></div>
            <div><Label>Privacy</Label>
              <Select value={formPrivacy} onValueChange={setFormPrivacy}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="invite-only">Invite Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={createOrEdit} className="flex-1 gap-2"><CheckCircle className="h-4 w-4" /> {editMode ? "Save" : "Create"}</Button>
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1"><X className="h-4 w-4 mr-1" /> Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
