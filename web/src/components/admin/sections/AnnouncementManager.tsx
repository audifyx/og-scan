/* ══════════════════════════════════════════════════════════════
   Admin · Announcement Manager
   Exposes the existing `announcements` table: create, edit, delete,
   set severity/audience/expiry, and view active vs expired.
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
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { logAudit } from "../helpers";
import {
  Megaphone, Trash2, Loader2, RefreshCw, Plus, Pencil, X,
  Info, AlertTriangle, CheckCircle2, Flame,
} from "lucide-react";

type Announcement = {
  id: string;
  title: string;
  body: string;
  severity: string;
  audience: string;
  created_at: string;
  expires_at: string | null;
};

const SEVERITIES = ["info", "success", "warning", "critical"] as const;
const AUDIENCES = ["all", "free", "pro", "affiliates"] as const;

const SEV_META: Record<string, { icon: any; cls: string }> = {
  info:     { icon: Info,         cls: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200" },
  success:  { icon: CheckCircle2, cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" },
  warning:  { icon: AlertTriangle,cls: "border-amber-400/30 bg-amber-400/10 text-amber-200" },
  critical: { icon: Flame,        cls: "border-rose-500/30 bg-rose-500/10 text-rose-200" },
};

const emptyForm = { title: "", body: "", severity: "info", audience: "all", expires_at: "" };

export const AnnouncementManager = () => {
  const { user: admin } = useAuth();
  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as Announcement[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, []);

  const resetForm = () => { setForm(emptyForm); setEditingId(null); };

  const startEdit = (a: Announcement) => {
    setEditingId(a.id);
    setForm({
      title: a.title,
      body: a.body,
      severity: a.severity || "info",
      audience: a.audience || "all",
      expires_at: a.expires_at ? a.expires_at.slice(0, 16) : "",
    });
  };

  const save = async () => {
    if (!admin) return;
    if (!form.title.trim() || !form.body.trim()) { toast.error("Title and body are required"); return; }
    setSaving(true);
    const payload: Record<string, any> = {
      title: form.title.trim(),
      body: form.body.trim(),
      severity: form.severity,
      audience: form.audience,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from("announcements").update(payload).eq("id", editingId));
    } else {
      payload.created_by = admin.id;
      ({ error } = await supabase.from("announcements").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await logAudit(admin.id, `${editingId ? "Updated" : "Created"} announcement: ${payload.title}`, "announcements");
    toast.success(editingId ? "Announcement updated" : "Announcement published");
    resetForm();
    fetchRows();
  };

  const remove = async (a: Announcement) => {
    if (!admin || !window.confirm(`Delete announcement "${a.title}"?`)) return;
    const { error } = await supabase.from("announcements").delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    await logAudit(admin.id, `Deleted announcement: ${a.title}`, "announcements");
    toast.success("Deleted");
    if (editingId === a.id) resetForm();
    fetchRows();
  };

  const isExpired = (a: Announcement) => !!a.expires_at && new Date(a.expires_at).getTime() < Date.now();
  const activeCount = rows.filter((a) => !isExpired(a)).length;

  return (
    <div className="space-y-5">
      {/* Composer */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4" />
            {editingId ? "Edit announcement" : "New announcement"}
          </CardTitle>
          {editingId && (
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <X className="h-4 w-4 mr-1" /> Cancel edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} maxLength={140}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Scheduled maintenance tonight" />
          </div>
          <div className="space-y-1.5">
            <Label>Body</Label>
            <Textarea value={form.body} rows={3}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="What do you want users to know?" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Severity</Label>
              <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Audience</Label>
              <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Expires (optional)</Label>
              <Input type="datetime-local" value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : editingId ? <Pencil className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              {editingId ? "Save changes" : "Publish announcement"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            Announcements
            <Badge variant="outline" className="text-[10px]">{activeCount} active / {rows.length} total</Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchRows} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No announcements yet. Create one above.</div>
          ) : (
            <ScrollArea className="max-h-[520px] pr-3">
              <div className="space-y-2">
                {rows.map((a) => {
                  const meta = SEV_META[a.severity] || SEV_META.info;
                  const SevIcon = meta.icon;
                  const expired = isExpired(a);
                  return (
                    <div key={a.id}
                      className={`rounded-xl border p-3 transition-colors ${expired ? "border-white/5 bg-white/[0.01] opacity-60" : "border-white/10 bg-white/[0.03]"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={`gap-1 text-[10px] capitalize ${meta.cls}`}>
                              <SevIcon className="h-3 w-3" /> {a.severity}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] capitalize">{a.audience}</Badge>
                            {expired && <Badge variant="outline" className="text-[10px] border-white/10 text-muted-foreground">expired</Badge>}
                          </div>
                          <div className="mt-1.5 truncate text-sm font-semibold text-foreground">{a.title}</div>
                          <div className="mt-0.5 whitespace-pre-wrap text-[13px] text-muted-foreground">{a.body}</div>
                          <div className="mt-1.5 text-[11px] text-muted-foreground/70">
                            {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                            {a.expires_at && ` · ${expired ? "expired" : "expires"} ${formatDistanceToNow(new Date(a.expires_at), { addSuffix: true })}`}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(a)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-300 hover:text-rose-200" onClick={() => remove(a)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnnouncementManager;
