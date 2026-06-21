import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Bell, Trash2, Loader2, Plus, Webhook, Bot, Twitter, Send, Radar } from "lucide-react";

export default function Alerts() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState("token");
  const [mint, setMint] = useState("");
  const [nl, setNl] = useState("");
  const [url, setUrl] = useState("");

  const call = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("alerts", { body });
    if (error || data?.error) throw new Error(data?.error || error?.message);
    return data;
  };
  const load = async () => { setLoading(true); try { const d = await call({ action: "list" }); setRules(d.rules || []); } catch { /* ignore */ } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const test = async () => {
    if (!url.trim()) { toast.error("Enter a webhook URL first"); return; }
    setBusy(true);
    try { const d = await call({ action: "test", webhook_url: url.trim() }); toast[d.ok ? "success" : "error"](d.ok ? "Test sent — check your webhook" : "Webhook rejected the test"); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const create = async () => {
    if (!url.trim()) { toast.error("Webhook URL required"); return; }
    if (type === "token" && !mint.trim()) { toast.error("Contract address required for token alerts"); return; }
    setBusy(true);
    try {
      await call({ action: "create", type, mint: mint.trim() || null, nl_request: nl.trim() || null, webhook_url: url.trim() });
      setMint(""); setNl(""); toast.success("Alert created");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const toggle = async (r: any) => { try { await call({ action: "update", id: r.id, enabled: !r.enabled }); await load(); } catch (e: any) { toast.error(e.message); } };
  const del = async (r: any) => { try { await call({ action: "delete", id: r.id }); await load(); } catch (e: any) { toast.error(e.message); } };

  return (
    <AppLayout>
      <PageHeader title="Webhook Alerts" description="Get token & migration alerts in Discord or any webhook — no full bot needed" />
      <div className="px-4 pb-24 max-w-[820px] mx-auto space-y-4">
        {/* create */}
        <Card className="p-5 glass-card">
          <div className="flex items-center gap-2 mb-3"><Bell className="h-4 w-4 text-og-lime" /><h3 className="font-bold text-white text-[15px]">New alert</h3></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-white/50 text-[11px]">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="bg-white/5 border-white/10 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="token">Token (by contract)</SelectItem><SelectItem value="migrations">Pump.fun migrations (all)</SelectItem></SelectContent>
              </Select>
            </div>
            {type === "token" && (
              <div>
                <Label className="text-white/50 text-[11px]">Contract address</Label>
                <Input value={mint} onChange={(e) => setMint(e.target.value)} placeholder="paste CA…" className="bg-white/5 border-white/10 text-sm font-mono mt-1" />
              </div>
            )}
          </div>
          {type === "token" && (
            <div className="mt-3">
              <Label className="text-white/50 text-[11px]">Tell the brain what to alert you about</Label>
              <Textarea value={nl} onChange={(e) => setNl(e.target.value)} placeholder="e.g. alert me when it 2x's, dips 20%, or crosses $10M market cap" className="bg-white/5 border-white/10 text-sm mt-1 min-h-[64px]" />
              <div className="text-white/30 text-[10px] mt-1">AI converts this into precise conditions. Leave blank to get every notable move.</div>
            </div>
          )}
          <div className="mt-3">
            <Label className="text-white/50 text-[11px]">Discord webhook or any custom webhook URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/…  or your own webhook" className="bg-white/5 border-white/10 text-sm mt-1" />
          </div>
          <div className="flex gap-2 mt-3">
            <Button onClick={create} disabled={busy} className="rounded-xl bg-og-lime/90 text-black hover:bg-og-lime font-bold">{busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />} Create alert</Button>
            <Button onClick={test} disabled={busy} variant="outline" className="rounded-xl"><Send className="h-3.5 w-3.5 mr-1.5" /> Test webhook</Button>
          </div>
        </Card>

        {/* list */}
        <Card className="p-5 glass-card">
          <div className="flex items-center gap-2 mb-3"><Webhook className="h-4 w-4 text-og-cyan" /><h3 className="font-bold text-white text-[15px]">Your alerts</h3></div>
          {loading ? (
            <div className="flex items-center gap-2 text-white/40 text-[13px]"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : rules.length ? (
            <div className="space-y-2">
              {rules.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <Badge variant="outline" className="text-[9px] uppercase shrink-0">{r.type}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-white/85 text-[13px] font-semibold truncate">{r.name || r.symbol || r.mint || "Migrations"}</div>
                    <div className="text-white/35 text-[11px] truncate">{r.nl_request || (r.conditions?.length ? `${r.conditions.length} condition(s)` : "all notable moves")} · {r.channel_type}</div>
                  </div>
                  <Switch checked={!!r.enabled} onCheckedChange={() => toggle(r)} />
                  <Button size="sm" variant="ghost" onClick={() => del(r)} className="h-8 px-2 text-red-400/70 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-white/30 text-[13px]">No alerts yet. Create one above.</div>
          )}
        </Card>

        <MigrationWatchCard />

        {/* full bot + auto-poster live in Settings > Connections */}
        <Card className="p-4 glass-card">
          <div className="flex items-center gap-2 mb-1"><Bot className="h-4 w-4 text-[#5865F2]" /><Twitter className="h-4 w-4 text-og-cyan" /><h4 className="font-bold text-white text-[13px]">Want a full Discord bot or X auto-poster?</h4></div>
          <p className="text-white/40 text-[11px]">Bring your own Discord bot (slash commands) and connect your X account to auto-post migrations &amp; reports from <a href="/settings" className="text-og-lime hover:underline">Settings → Connections</a>.</p>
        </Card>

        <div className="text-white/30 text-[11px] text-center">Want the full experience (scans, PDFs/HTML reports, wallet tools, chat)? Use the Telegram super bot. Webhooks are the lightweight alerts-only channel.</div>
      </div>
    </AppLayout>
  );
}


// ── Conversational migration watches (firehose filters) ────────────────────────
function MigrationWatchCard() {
  const [watches, setWatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [nl, setNl] = useState("");
  const [url, setUrl] = useState("");

  const fn = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("migration-watch", { body });
    if (error || data?.error) throw new Error(data?.error || error?.message);
    return data;
  };
  const load = async () => { setLoading(true); try { const d = await fn({ action: "list" }); setWatches(d.watches || []); } catch { /* ignore */ } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!url.trim()) { toast.error("Webhook URL required"); return; }
    setBusy(true);
    try { await fn({ action: "create", nl_request: nl.trim() || null, webhook_url: url.trim() }); setNl(""); toast.success("Watch created - AI compiled your filter"); await load(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const toggle = async (w: any) => { try { await fn({ action: "update", id: w.id, enabled: !w.enabled }); await load(); } catch (e: any) { toast.error(e.message); } };
  const del = async (w: any) => { try { await fn({ action: "delete", id: w.id }); await load(); } catch (e: any) { toast.error(e.message); } };

  return (
    <Card className="p-5 glass-card">
      <div className="flex items-center gap-2 mb-1"><Radar className="h-4 w-4 text-og-cyan" /><h3 className="font-bold text-white text-[15px]">Migration watches</h3><Badge className="ml-auto text-[9px] bg-og-cyan/15 text-og-cyan border-0">AI</Badge></div>
      <p className="text-white/40 text-[11px] mb-3">Describe what you want in plain English. Grim watches every pump.fun graduation and pings you only when one matches.</p>
      <Textarea value={nl} onChange={(e) => setNl(e.target.value)} placeholder="e.g. alert me on migrations with 50+ holders, revoked mint, and over $30k market cap" className="bg-white/5 border-white/10 text-sm min-h-[60px]" />
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Discord webhook or any webhook URL" className="bg-white/5 border-white/10 text-sm mt-2" />
      <Button onClick={create} disabled={busy} className="rounded-xl bg-og-cyan/90 text-black hover:bg-og-cyan font-bold mt-2">{busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />} Create watch</Button>

      {loading ? null : watches.length ? (
        <div className="space-y-2 mt-4">
          {watches.map((w) => (
            <div key={w.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <Radar className="h-3.5 w-3.5 text-og-cyan shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-white/85 text-[12px] truncate">{w.nl_request || "every migration"}</div>
                <div className="text-white/30 text-[10px]">{(w.conditions?.length || 0)} condition(s){w.webhook_hint ? ` · ${w.webhook_hint}` : ""}</div>
              </div>
              <Switch checked={!!w.enabled} onCheckedChange={() => toggle(w)} />
              <Button size="sm" variant="ghost" onClick={() => del(w)} className="h-8 px-2 text-red-400/70 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
