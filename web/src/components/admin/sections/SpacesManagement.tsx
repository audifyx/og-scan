/* ══════════════════════════════════════════════════════════════
   Admin · Spaces Management
   Features: list, detail modal (recordings, messages, polls,
   Q&A questions, speaker requests), end spaces, delete, export
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { logAudit, shortId } from "../helpers";
import {
  Mic, Search, Trash2, Loader2, RefreshCw, Eye, Radio,
  MessageSquare, BarChart, HelpCircle, Hand, Film, Play,
  StopCircle, Download,
} from "lucide-react";

export const SpacesManagement = () => {
  const { user: admin } = useAuth();
  const [spaces, setSpaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selected, setSelected] = useState<any>(null);
  const [detailTab, setDetailTab] = useState("info");
  const [recordings, setRecordings] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [polls, setPolls] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [speakerReqs, setSpeakerReqs] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any[]>([]);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from("spaces").select("*").order("created_at", { ascending: false });
    setSpaces(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openDetail = async (s: any) => {
    setSelected(s); setDetailTab("info");
    const [recsR, msgsR, pollsR, qasR, speakR, hlR] = await Promise.all([
      supabase.from("space-recordings").select("*").eq("space_id", s.id).order("created_at", { ascending: false }),
      supabase.from("space_messages").select("*").eq("space_id", s.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("space_polls").select("*").eq("space_id", s.id),
      supabase.from("space_qa_questions").select("*").eq("space_id", s.id).order("created_at", { ascending: false }),
      supabase.from("speaker_requests").select("*").eq("space_id", s.id).order("created_at", { ascending: false }),
      supabase.from("space_highlights").select("*").eq("space_id", s.id),
    ]);
    setRecordings(recsR.data || []);
    setMessages(msgsR.data || []);
    setPolls(pollsR.data || []);
    setQuestions(qasR.data || []);
    setSpeakerReqs(speakR.data || []);
    setHighlights(hlR.data || []);
  };

  const endSpace = async (id: string) => {
    if (!admin || !window.confirm("End this live space?")) return;
    await supabase.from("spaces").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", id);
    await logAudit(admin.id, "Ended space", "spaces", id);
    toast.success("Space ended");
    fetch();
  };

  const deleteSpace = async (id: string) => {
    if (!admin || !window.confirm("Delete this space and all data?")) return;
    await Promise.all([
      supabase.from("space_messages").delete().eq("space_id", id),
      supabase.from("space_polls").delete().eq("space_id", id),
      supabase.from("space_qa_questions").delete().eq("space_id", id),
      supabase.from("speaker_requests").delete().eq("space_id", id),
      supabase.from("space_highlights").delete().eq("space_id", id),
      supabase.from("space-recordings").delete().eq("space_id", id),
    ]);
    await supabase.from("spaces").delete().eq("id", id);
    await logAudit(admin.id, "Deleted space", "spaces", id);
    toast.success("Deleted");
    setSelected(null);
    fetch();
  };

  const deleteMessage = async (id: string) => {
    await supabase.from("space_messages").delete().eq("id", id);
    toast.success("Deleted");
    if (selected) openDetail(selected);
  };

  const deleteRecording = async (id: string) => {
    if (!window.confirm("Delete this recording?")) return;
    await supabase.from("space-recordings").delete().eq("id", id);
    toast.success("Deleted");
    if (selected) openDetail(selected);
  };

  const manageSpeakerReq = async (id: string, status: string) => {
    await supabase.from("speaker_requests").update({ status }).eq("id", id);
    toast.success(`Request ${status}`);
    if (selected) openDetail(selected);
  };

  const filtered = spaces.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (!search) return true;
    return (s.title || "").toLowerCase().includes(search.toLowerCase());
  });

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#22d3ee]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3"><Mic className="h-6 w-6 text-[#22d3ee]" /> Spaces Management</h2>
          <p className="text-sm text-muted-foreground">{spaces.length} spaces, {spaces.filter((s) => s.status === "live").length} live</p>
        </div>
        <Button onClick={fetch} variant="outline" size="sm"><RefreshCw className="h-3.5 w-3.5" /></Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search spaces…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="ended">Ended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="h-[550px]">
        <div className="space-y-3">
          {filtered.map((s) => (
            <Card key={s.id} className="og-glass-card cursor-pointer hover:border-white/20 transition" onClick={() => openDetail(s)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-2.5 rounded-xl bg-pink-500/20"><Mic className="h-5 w-5 text-pink-400" /></div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{s.title || "Untitled Space"}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                      <code>{shortId(s.host_id || s.created_by || "")}</code>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Badge className={s.status === "live" ? "bg-red-500/20 text-red-400" : s.status === "scheduled" ? "bg-yellow-500/20 text-yellow-400" : "bg-gray-500/20 text-gray-400"}>
                    {s.status === "live" && <Radio className="h-3 w-3 mr-1 animate-pulse" />}
                    {s.status}
                  </Badge>
                  {s.status === "live" && <Button size="sm" variant="outline" onClick={() => endSpace(s.id)} className="gap-1.5 text-red-400"><StopCircle className="h-3.5 w-3.5" /> End</Button>}
                  <Button size="sm" variant="ghost" onClick={() => deleteSpace(s.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground">No spaces found</p>}
        </div>
      </ScrollArea>

      {/* Detail Modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto bg-[#0a1118] border-white/10">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Mic className="h-6 w-6 text-pink-400" />
                  <div><p>{selected.title || "Untitled Space"}</p><p className="text-xs text-muted-foreground">{selected.status}</p></div>
                </DialogTitle>
              </DialogHeader>
              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList className="bg-white/[0.04] w-full justify-start flex-wrap">
                  <TabsTrigger value="info">Info</TabsTrigger>
                  <TabsTrigger value="recordings">Recordings ({recordings.length})</TabsTrigger>
                  <TabsTrigger value="messages">Chat ({messages.length})</TabsTrigger>
                  <TabsTrigger value="polls">Polls ({polls.length})</TabsTrigger>
                  <TabsTrigger value="qa">Q&A ({questions.length})</TabsTrigger>
                  <TabsTrigger value="speakers">Speakers ({speakerReqs.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                  <Card className="og-glass-card"><CardContent className="p-4 space-y-2">
                    <div className="grid grid-cols-3 gap-4">
                      <div><Label className="text-xs text-muted-foreground">Host</Label><code className="text-xs">{shortId(selected.host_id || selected.created_by || "")}</code></div>
                      <div><Label className="text-xs text-muted-foreground">Status</Label><Badge>{selected.status}</Badge></div>
                      <div><Label className="text-xs text-muted-foreground">Listeners</Label><p className="text-sm">{selected.listener_count || 0}</p></div>
                    </div>
                    <div><Label className="text-xs text-muted-foreground">Description</Label><p className="text-sm">{selected.description || "—"}</p></div>
                  </CardContent></Card>
                  <div className="flex gap-2">
                    {selected.status === "live" && <Button size="sm" onClick={() => endSpace(selected.id)} className="gap-2 text-red-400" variant="outline"><StopCircle className="h-3.5 w-3.5" /> End Space</Button>}
                    <Button size="sm" onClick={() => deleteSpace(selected.id)} className="gap-2 text-red-400 border-red-500/30" variant="outline"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                  </div>
                </TabsContent>

                <TabsContent value="recordings"><ScrollArea className="h-[400px]"><div className="space-y-2">
                  {recordings.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                      <div className="flex items-center gap-3"><Film className="h-4 w-4 text-purple-400" /><div>
                        <p className="text-sm">{r.file_name || "Recording"}</p>
                        <p className="text-[10px] text-muted-foreground">{r.duration ? `${Math.round(r.duration / 60)}m` : "—"} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</p>
                      </div></div>
                      <div className="flex gap-1">
                        {r.url && <a href={r.url} target="_blank" rel="noopener"><Button size="sm" variant="ghost"><Play className="h-3.5 w-3.5" /></Button></a>}
                        <Button size="sm" variant="ghost" onClick={() => deleteRecording(r.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
                      </div>
                    </div>
                  ))}
                  {recordings.length === 0 && <p className="text-center py-4 text-sm text-muted-foreground">No recordings</p>}
                </div></ScrollArea></TabsContent>

                <TabsContent value="messages"><ScrollArea className="h-[400px]"><div className="space-y-2">
                  {messages.map((m) => (
                    <div key={m.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-white/[0.03]">
                      <div className="flex-1 min-w-0"><code className="text-[10px] text-muted-foreground">{shortId(m.user_id)}</code><p className="text-sm line-clamp-2">{m.content}</p></div>
                      <Button size="sm" variant="ghost" onClick={() => deleteMessage(m.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
                    </div>
                  ))}
                  {messages.length === 0 && <p className="text-center py-4 text-sm text-muted-foreground">No messages</p>}
                </div></ScrollArea></TabsContent>

                <TabsContent value="polls"><ScrollArea className="h-[400px]"><div className="space-y-2">
                  {polls.map((p) => (
                    <Card key={p.id} className="og-glass-card"><CardContent className="p-3">
                      <p className="font-medium text-sm">{p.question}</p>
                      <div className="mt-2 space-y-1">
                        {(p.options || []).map((o: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs"><BarChart className="h-3 w-3 text-muted-foreground" /><span>{typeof o === "string" ? o : o.text || `Option ${i + 1}`}</span></div>
                        ))}
                      </div>
                      <Badge variant="outline" className="mt-2 text-[10px]">{p.status || "active"}</Badge>
                    </CardContent></Card>
                  ))}
                  {polls.length === 0 && <p className="text-center py-4 text-sm text-muted-foreground">No polls</p>}
                </div></ScrollArea></TabsContent>

                <TabsContent value="qa"><ScrollArea className="h-[400px]"><div className="space-y-2">
                  {questions.map((q) => (
                    <div key={q.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03]">
                      <HelpCircle className="h-4 w-4 text-blue-400 mt-0.5" />
                      <div className="flex-1"><p className="text-sm">{q.question}</p><div className="flex gap-2 mt-1"><code className="text-[10px] text-muted-foreground">{shortId(q.user_id)}</code><Badge variant="outline" className="text-[10px]">{q.status || "open"}</Badge></div></div>
                    </div>
                  ))}
                  {questions.length === 0 && <p className="text-center py-4 text-sm text-muted-foreground">No questions</p>}
                </div></ScrollArea></TabsContent>

                <TabsContent value="speakers"><ScrollArea className="h-[400px]"><div className="space-y-2">
                  {speakerReqs.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                      <div className="flex items-center gap-3"><Hand className="h-4 w-4 text-yellow-400" /><div><code className="text-xs">{shortId(r.user_id)}</code><p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</p></div></div>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                        {r.status === "pending" && (<>
                          <Button size="sm" variant="ghost" onClick={() => manageSpeakerReq(r.id, "approved")} className="text-green-400">✓</Button>
                          <Button size="sm" variant="ghost" onClick={() => manageSpeakerReq(r.id, "rejected")} className="text-red-400">✗</Button>
                        </>)}
                      </div>
                    </div>
                  ))}
                  {speakerReqs.length === 0 && <p className="text-center py-4 text-sm text-muted-foreground">No speaker requests</p>}
                </div></ScrollArea></TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
