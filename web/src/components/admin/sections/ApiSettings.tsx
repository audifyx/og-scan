/* ══════════════════════════════════════════════════════════════
   Admin · API Settings
   Manage platform API secrets, developer API keys, and rate-limit logs.
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { logAudit } from "../helpers";
import { KeyRound, Trash2, RefreshCw, Loader2, ShieldOff } from "lucide-react";

type Tab = "secrets" | "keys" | "limits";

export const ApiSettings = () => {
  const { user: admin } = useAuth();
  const [tab, setTab] = useState<Tab>("secrets");
  const [loading, setLoading] = useState(true);
  const [secrets, setSecrets] = useState<any[]>([]);
  const [keys, setKeys] = useState<any[]>([]);
  const [limits, setLimits] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const [s, k, l] = await Promise.all([
      supabase.from("api_secrets").select("id,key_name,category,description,is_active,updated_at").order("key_name"),
      supabase.from("developer_api_keys").select("id,name,key_prefix,scopes,is_active,request_count,rate_limit_rpm,last_used_at,expires_at,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("api_rate_limit_log").select("id,endpoint,window_start").order("window_start", { ascending: false }).limit(100),
    ]);
    setSecrets(s.data || []); setKeys(k.data || []); setLimits(l.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggleSecret = async (id: string, name: string, cur: boolean) => {
    const { error } = await supabase.from("api_secrets").update({ is_active: !cur, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    if (admin) await logAudit(admin.id, `${cur ? "Disabled" : "Enabled"} API secret: ${name}`, "api_secrets");
    toast.success(cur ? "Disabled" : "Enabled"); load();
  };
  const delSecret = async (id: string, name: string) => {
    if (!window.confirm(`Delete secret "${name}"?`)) return;
    const { error } = await supabase.from("api_secrets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (admin) await logAudit(admin.id, `Deleted API secret: ${name}`, "api_secrets");
    toast.success("Deleted"); load();
  };
  const revokeKey = async (id: string, name: string, cur: boolean) => {
    const { error } = await supabase.from("developer_api_keys").update({ is_active: !cur }).eq("id", id);
    if (error) return toast.error(error.message);
    if (admin) await logAudit(admin.id, `${cur ? "Revoked" : "Reactivated"} developer key: ${name}`, "developer_api_keys");
    toast.success(cur ? "Revoked" : "Reactivated"); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {(["secrets", "keys", "limits"] as Tab[]).map((t) => (
            <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} className="capitalize" onClick={() => setTab(t)}>
              {t === "secrets" ? "Platform secrets" : t === "keys" ? "Developer keys" : "Rate limits"}
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : tab === "secrets" ? (
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" /> Platform API secrets <Badge variant="outline" className="text-[10px]">{secrets.length}</Badge></CardTitle></CardHeader>
          <CardContent><ScrollArea className="max-h-[520px] pr-3"><div className="space-y-1.5">
            {secrets.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="font-mono text-[13px] text-foreground">{s.key_name}</span>{s.category && <Badge variant="outline" className="text-[10px]">{s.category}</Badge>}</div>
                  {s.description && <div className="truncate text-[11px] text-muted-foreground">{s.description}</div>}
                </div>
                <Switch checked={!!s.is_active} onCheckedChange={() => toggleSecret(s.id, s.key_name, !!s.is_active)} />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-300" onClick={() => delSecret(s.id, s.key_name)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {secrets.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">No API secrets.</div>}
          </div></ScrollArea></CardContent></Card>
      ) : tab === "keys" ? (
        <Card><CardHeader><CardTitle className="text-base">Developer API keys <Badge variant="outline" className="text-[10px]">{keys.length}</Badge></CardTitle></CardHeader>
          <CardContent><ScrollArea className="max-h-[520px] pr-3"><div className="space-y-1.5">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-[13px] font-medium text-foreground">{k.name || "unnamed"}</span><span className="font-mono text-[11px] text-muted-foreground">{k.key_prefix}…</span>{!k.is_active && <Badge variant="outline" className="text-[10px] text-rose-300">revoked</Badge>}</div>
                  <div className="text-[11px] text-muted-foreground">{(k.request_count ?? 0).toLocaleString()} reqs · {k.rate_limit_rpm ?? "—"} rpm{k.last_used_at ? ` · used ${formatDistanceToNow(new Date(k.last_used_at), { addSuffix: true })}` : ""}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => revokeKey(k.id, k.name, !!k.is_active)}><ShieldOff className="mr-1 h-3.5 w-3.5" />{k.is_active ? "Revoke" : "Restore"}</Button>
              </div>
            ))}
            {keys.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">No developer keys.</div>}
          </div></ScrollArea></CardContent></Card>
      ) : (
        <Card><CardHeader><CardTitle className="text-base">Recent rate-limit hits <Badge variant="outline" className="text-[10px]">{limits.length}</Badge></CardTitle></CardHeader>
          <CardContent><ScrollArea className="max-h-[520px] pr-3"><div className="space-y-1">
            {limits.map((l) => (
              <div key={l.id} className="flex items-center justify-between border-b border-white/5 py-1.5 text-[12px]">
                <span className="truncate font-mono text-foreground">{l.endpoint}</span>
                <span className="shrink-0 text-muted-foreground/70">{formatDistanceToNow(new Date(l.window_start), { addSuffix: true })}</span>
              </div>
            ))}
            {limits.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">No rate-limit events.</div>}
          </div></ScrollArea></CardContent></Card>
      )}
    </div>
  );
};
export default ApiSettings;
