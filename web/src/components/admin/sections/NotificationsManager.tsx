/* ══════════════════════════════════════════════════════════════
   Admin · Notifications Manager
   Features: broadcast to all users, send targeted notifications,
   view history, delete, templates, announcements
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { logAudit, shortId } from "../helpers";
import {
  Bell, Search, Trash2, Loader2, RefreshCw, Send,
  Users, Megaphone, FileText, Plus, Eye,
} from "lucide-react";

const TEMPLATES = [
  { name: "Maintenance", title: "Scheduled Maintenance", message: "OG Scan will undergo scheduled maintenance. We'll be back shortly." },
  { name: "New Feature", title: "New Feature Available!", message: "We've just shipped a new feature. Check it out!" },
  { name: "Security Alert", title: "Security Notice", message: "For your security, please review your account settings." },
  { name: "Token Alert", title: "Hot Token Alert 🔥", message: "A new trending token has been listed. Don't miss out!" },
  { name: "Welcome", title: "Welcome to OG Scan! 🎉", message: "Thanks for joining OG Scan. Explore tokens, join communities, and connect with traders." },
];

export const NotificationsManager = () => {
  const { user: admin } = useAuth();
  const [tab, setTab] = useState("send");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Send form
  const [sendType, setSendType] = useState<"broadcast" | "targeted">("broadcast");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [notifType, setNotifType] = useState("announcement");
  const [sending, setSending] = useState(false);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(500);
    setNotifications(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const sendNotification = async () => {
    if (!admin || !title.trim() || !message.trim()) { toast.error("Title and message required"); return; }
    setSending(true);
    if (sendType === "targeted") {
      if (!targetUserId.trim()) { toast.error("User ID required"); setSending(false); return; }
      const { error } = await supabase.from("notifications").insert({
        user_id: targetUserId.trim(), title, message, type: notifType, is_read: false,
      });
      if (error) { toast.error("Failed"); setSending(false); return; }
      await logAudit(admin.id, `Sent notification to ${shortId(targetUserId)}`, "notifications");
      toast.success("Sent");
    } else {
      const { data: profiles } = await supabase.from("profiles").select("user_id");
      if (!profiles || profiles.length === 0) { toast.error("No users found"); setSending(false); return; }
      if (!window.confirm(`Broadcast to ${profiles.length} users?`)) { setSending(false); return; }
      const batch = profiles.map((p: any) => ({
        user_id: p.user_id, title, message, type: notifType, is_read: false,
      }));
      // Insert in chunks of 100
      for (let i = 0; i < batch.length; i += 100) {
        await supabase.from("notifications").insert(batch.slice(i, i + 100));
      }
      await logAudit(admin.id, `Broadcast notification to ${profiles.length} users: ${title}`, "notifications");
      toast.success(`Broadcast sent to ${profiles.length} users`);
    }
    setTitle(""); setMessage(""); setTargetUserId("");
    setSending(false);
    fetch();
  };

  const deleteNotification = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    toast.success("Deleted");
    fetch();
  };

  const clearReadNotifications = async () => {
    if (!admin || !window.confirm("Delete all read notifications?")) return;
    await supabase.from("notifications").delete().eq("is_read", true);
    await logAudit(admin.id, "Cleared read notifications", "notifications");
    toast.success("Cleared");
    fetch();
  };

  const clearAllNotifications = async () => {
    if (!admin || !window.confirm("Delete ALL notifications? This cannot be undone!")) return;
    await supabase.from("notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await logAudit(admin.id, "Cleared all notifications", "notifications");
    toast.success("All cleared");
    fetch();
  };

  const applyTemplate = (tmpl: typeof TEMPLATES[0]) => {
    setTitle(tmpl.title);
    setMessage(tmpl.message);
  };

  const filtered = notifications.filter((n) => !search || (n.title || "").toLowerCase().includes(search.toLowerCase()) || (n.message || "").toLowerCase().includes(search.toLowerCase()));
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#22d3ee]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3"><Bell className="h-6 w-6 text-[#22d3ee]" /> Notifications</h2>
          <p className="text-sm text-muted-foreground">{notifications.length} total, {unreadCount} unread</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={clearReadNotifications} variant="outline" size="sm" className="gap-2"><Trash2 className="h-3.5 w-3.5" /> Clear Read</Button>
          <Button onClick={clearAllNotifications} variant="outline" size="sm" className="gap-2 text-red-400 border-red-500/30"><Trash2 className="h-3.5 w-3.5" /> Clear All</Button>
          <Button onClick={fetch} variant="outline" size="sm"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/[0.04]">
          <TabsTrigger value="send" className="gap-2"><Megaphone className="h-3.5 w-3.5" /> Send</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><FileText className="h-3.5 w-3.5" /> History ({notifications.length})</TabsTrigger>
          <TabsTrigger value="templates" className="gap-2"><FileText className="h-3.5 w-3.5" /> Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="mt-4">
          <Card className="og-glass-card">
            <CardHeader><CardTitle className="text-lg">Compose Notification</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Button variant={sendType === "broadcast" ? "default" : "outline"} onClick={() => setSendType("broadcast")} className="gap-2 flex-1"><Users className="h-4 w-4" /> Broadcast</Button>
                <Button variant={sendType === "targeted" ? "default" : "outline"} onClick={() => setSendType("targeted")} className="gap-2 flex-1"><Send className="h-4 w-4" /> Targeted</Button>
              </div>
              {sendType === "targeted" && (
                <div><Label>User ID</Label><Input value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} className="mt-1 font-mono" placeholder="Paste user UUID…" /></div>
              )}
              <div><Label>Type</Label>
                <Select value={notifType} onValueChange={setNotifType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="announcement">Announcement</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="promotion">Promotion</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="feature">Feature Update</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" placeholder="Notification title…" /></div>
              <div><Label>Message</Label><Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1" rows={4} placeholder="Notification body…" /></div>
              <Button onClick={sendNotification} disabled={sending} className="w-full gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sendType === "broadcast" ? "Broadcast to All Users" : "Send to User"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-4">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search notifications…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
          <ScrollArea className="h-[500px]"><div className="space-y-2">
            {filtered.map((n) => (
              <div key={n.id} className="flex items-start justify-between p-3 rounded-lg bg-white/[0.03]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium">{n.title || "—"}</p>
                    <Badge variant="outline" className="text-[10px]">{n.type}</Badge>
                    {!n.is_read && <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">Unread</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{n.message}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <code>{shortId(n.user_id)}</code>
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteNotification(n.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground">No notifications</p>}
          </div></ScrollArea>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TEMPLATES.map((t) => (
              <Card key={t.name} className="og-glass-card cursor-pointer hover:border-white/20 transition" onClick={() => { applyTemplate(t); setTab("send"); }}>
                <CardContent className="p-4">
                  <p className="font-medium text-sm mb-1">{t.name}</p>
                  <p className="text-xs text-[#22d3ee]">{t.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.message}</p>
                  <Button size="sm" variant="outline" className="mt-3 gap-2 text-xs"><Plus className="h-3 w-3" /> Use Template</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
