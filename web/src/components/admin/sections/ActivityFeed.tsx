/* ══════════════════════════════════════════════════════════════
   Admin · Activity Feed
   Unified chronological feed across platform_events, user_activity,
   and live_feed_events.
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";
import { Activity, RefreshCw, Loader2, Globe, User, Radio } from "lucide-react";

type Item = { id: string; source: string; type: string; text: string; ts: string; whale?: boolean };
type Filter = "all" | "platform" | "user" | "live";

const SRC_META: Record<string, { icon: any; cls: string }> = {
  platform: { icon: Globe, cls: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200" },
  user:     { icon: User,  cls: "border-violet-400/30 bg-violet-400/10 text-violet-200" },
  live:     { icon: Radio, cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" },
};

export const ActivityFeed = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const load = async () => {
    setLoading(true);
    const [pe, ua, lf] = await Promise.all([
      supabase.from("platform_events").select("id,event_type,target_type,created_at").order("created_at", { ascending: false }).limit(60),
      supabase.from("user_activity").select("id,activity_type,title,description,created_at").order("created_at", { ascending: false }).limit(60),
      supabase.from("live_feed_events").select("id,event_type,token_symbol,amount_usd,is_whale,timestamp").order("timestamp", { ascending: false }).limit(60),
    ]);
    const merged: Item[] = [];
    (pe.data || []).forEach((r: any) => merged.push({ id: "p" + r.id, source: "platform", type: r.event_type, text: r.target_type ? `${r.event_type} · ${r.target_type}` : r.event_type, ts: r.created_at }));
    (ua.data || []).forEach((r: any) => merged.push({ id: "u" + r.id, source: "user", type: r.activity_type, text: r.title || r.description || r.activity_type, ts: r.created_at }));
    (lf.data || []).forEach((r: any) => merged.push({ id: "l" + r.id, source: "live", type: r.event_type, text: `${r.event_type} ${r.token_symbol || ""} ${r.amount_usd ? "$" + Math.round(r.amount_usd).toLocaleString() : ""}`.trim(), ts: r.timestamp, whale: r.is_whale }));
    merged.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    setItems(merged);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const shown = items.filter((i) => filter === "all" || i.source === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {(["all", "platform", "user", "live"] as Filter[]).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="capitalize" onClick={() => setFilter(f)}>{f}</Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Activity feed <Badge variant="outline" className="text-[10px]">{shown.length}</Badge></CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : shown.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No recent activity.</div>
          ) : (
            <ScrollArea className="max-h-[560px] pr-3"><div className="space-y-1.5">
              {shown.map((it) => {
                const meta = SRC_META[it.source]; const Icon = meta.icon;
                return (
                  <div key={it.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                    <Badge variant="outline" className={`gap-1 text-[10px] ${meta.cls}`}><Icon className="h-3 w-3" /> {it.source}</Badge>
                    <div className="min-w-0 flex-1 truncate text-[13px] text-foreground">{it.text}{it.whale && <span className="ml-2 text-amber-300">🐋</span>}</div>
                    <div className="shrink-0 text-[11px] text-muted-foreground/70">{formatDistanceToNow(new Date(it.ts), { addSuffix: true })}</div>
                  </div>
                );
              })}
            </div></ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
export default ActivityFeed;
