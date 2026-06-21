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
import { Bell, Trash2, Loader2, Plus, Webhook, Bot, Twitter, Send, Copy } from "lucide-react";

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

        {/* power integrations */}
        <div className="grid sm:grid-cols-2 gap-3 items-start">
          <DiscordBotCard />
          <XPosterCard />
        </div>

        <div className="text-white/30 text-[11px] text-center">Want the full experience (scans, PDFs/HTML reports, wallet tools, chat)? Use the Telegram super bot. Webhooks are the lightweight alerts-only channel.</div>
      </div>
    </AppLayout>
  );
}

// ── Bring-your-own Discord bot ─────────────────────────────────────────────────
function DiscordBotCard() {
  const [bot, setBot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [appId, setAppId] = useState("");
  const [pubKey, setPubKey] = useState("");
  const [botToken, setBotToken] = useState("");
  const [endpoint, setEndpoint] = useState("");

  const fn = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("discord-bot-connect", { body });
    if (error || data?.error) throw new Error(data?.error || error?.message);
    return data;
  };
  const load = async () => { setLoading(true); try { const d = await fn({ action: "status" }); setBot(d.bot); } catch { /* ignore */ } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const connect = async () => {
    if (!appId.trim() || !pubKey.trim() || !botToken.trim()) { toast.error("All three fields are required"); return; }
    setBusy(true);
    try {
      const d = await fn({ action: "connect", application_id: appId.trim(), public_key: pubKey.trim(), bot_token: botToken.trim() });
      setBot(d.bot); setEndpoint(d.interactions_url || ""); setBotToken("");
      toast.success("Discord bot connected — commands registered");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const setFlag = async (k: string, v: boolean) => { try { const d = await fn({ action: "settings", [k]: v }); setBot(d.bot); } catch (e: any) { toast.error(e.message); } };
  const disconnect = async () => { setBusy(true); try { await fn({ action: "disconnect" }); setBot(null); toast.success("Disconnected"); } catch (e: any) { toast.error(e.message); } finally { setBusy(false); } };
  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copied"); };

  return (
    <Card className="p-4 glass-card">
      <div className="flex items-center gap-2 mb-2"><Bot className="h-4 w-4 text-[#5865F2]" /><h4 className="font-bold text-white text-[13px]">Bring your own Discord bot</h4>{bot && <Badge className="ml-auto text-[9px] bg-og-lime/20 text-og-lime border-0">LIVE</Badge>}</div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/40 text-[12px]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>
      ) : bot ? (
        <div className="space-y-2.5">
          <div className="text-white/60 text-[11px]">Connected as <span className="text-white/90 font-semibold">{bot.bot_username || bot.application_id}</span> · token {bot.token_hint}</div>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2">
            <div className="text-white/40 text-[10px] mb-1">Interactions Endpoint URL — paste into your Discord app → General Information</div>
            <div className="flex items-center gap-1.5">
              <code className="text-white/70 text-[10px] truncate flex-1">{endpoint || `${supabaseFnBase()}/discord-interactions`}</code>
              <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => copy(endpoint || `${supabaseFnBase()}/discord-interactions`)}><Copy className="h-3 w-3" /></Button>
            </div>
          </div>
          <label className="flex items-center justify-between"><span className="text-white/60 text-[11px]">Bot enabled</span><Switch checked={!!bot.enabled} onCheckedChange={(v) => setFlag("enabled", v)} /></label>
          <label className="flex items-center justify-between"><span className="text-white/60 text-[11px]">AI chat (/chat)</span><Switch checked={!!bot.ai_enabled} onCheckedChange={(v) => setFlag("ai_enabled", v)} /></label>
          <Button size="sm" variant="ghost" disabled={busy} onClick={disconnect} className="h-7 px-2 text-red-400/70 hover:text-red-300 text-[11px]"><Trash2 className="h-3 w-3 mr-1" /> Disconnect</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-white/40 text-[11px]">Run a full branded Discord bot (slash commands: /chat /migrations /news /alpha). Create an app at discord.com/developers, then paste:</p>
          <Input value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="Application ID" className="bg-white/5 border-white/10 text-xs font-mono h-8" />
          <Input value={pubKey} onChange={(e) => setPubKey(e.target.value)} placeholder="Public Key" className="bg-white/5 border-white/10 text-xs font-mono h-8" />
          <Input value={botToken} onChange={(e) => setBotToken(e.target.value)} type="password" placeholder="Bot Token" className="bg-white/5 border-white/10 text-xs font-mono h-8" />
          <Button size="sm" disabled={busy} onClick={connect} className="rounded-lg bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold text-[12px] w-full">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Bot className="h-3.5 w-3.5 mr-1.5" />} Connect bot</Button>
        </div>
      )}
    </Card>
  );
}

// ── X / Twitter auto-poster ────────────────────────────────────────────────────
function XPosterCard() {
  const [acct, setAcct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [k1, setK1] = useState(""); const [k2, setK2] = useState(""); const [k3, setK3] = useState(""); const [k4, setK4] = useState("");

  const fn = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("x-poster", { body });
    if (error || data?.error) throw new Error(data?.error || error?.message);
    return data;
  };
  const load = async () => { setLoading(true); try { const d = await fn({ action: "status" }); setAcct(d.account); } catch { /* ignore */ } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const connect = async () => {
    if (!k1.trim() || !k2.trim() || !k3.trim() || !k4.trim()) { toast.error("All four keys are required"); return; }
    setBusy(true);
    try {
      const d = await fn({ action: "connect", api_key: k1.trim(), api_secret: k2.trim(), access_token: k3.trim(), access_secret: k4.trim() });
      setAcct(d.account); setK1(""); setK2(""); setK3(""); setK4("");
      toast.success("X account connected");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const setFlag = async (k: string, v: boolean) => { try { const d = await fn({ action: "settings", [k]: v }); setAcct(d.account); } catch (e: any) { toast.error(e.message); } };
  const testTweet = async () => { setBusy(true); try { const d = await fn({ action: "test" }); toast[d.ok ? "success" : "error"](d.ok ? "Test tweet posted" : (d.error || "Failed")); } catch (e: any) { toast.error(e.message); } finally { setBusy(false); } };
  const disconnect = async () => { setBusy(true); try { await fn({ action: "disconnect" }); setAcct(null); toast.success("Disconnected"); } catch (e: any) { toast.error(e.message); } finally { setBusy(false); } };

  return (
    <Card className="p-4 glass-card">
      <div className="flex items-center gap-2 mb-2"><Twitter className="h-4 w-4 text-og-cyan" /><h4 className="font-bold text-white text-[13px]">X / Twitter auto-poster</h4>{acct && <Badge className="ml-auto text-[9px] bg-og-lime/20 text-og-lime border-0">LIVE</Badge>}</div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/40 text-[12px]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>
      ) : acct ? (
        <div className="space-y-2.5">
          <div className="text-white/60 text-[11px]">Posting as <span className="text-white/90 font-semibold">{acct.handle || "your account"}</span> · key {acct.key_hint}</div>
          <label className="flex items-center justify-between"><span className="text-white/60 text-[11px]">Enabled</span><Switch checked={!!acct.enabled} onCheckedChange={(v) => setFlag("enabled", v)} /></label>
          <label className="flex items-center justify-between"><span className="text-white/60 text-[11px]">Auto-post migrations</span><Switch checked={!!acct.auto_migrations} onCheckedChange={(v) => setFlag("auto_migrations", v)} /></label>
          <label className="flex items-center justify-between"><span className="text-white/60 text-[11px]">Auto-post reports</span><Switch checked={!!acct.auto_reports} onCheckedChange={(v) => setFlag("auto_reports", v)} /></label>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={testTweet} variant="outline" className="rounded-lg text-[11px] h-7"><Send className="h-3 w-3 mr-1" /> Test tweet</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={disconnect} className="h-7 px-2 text-red-400/70 hover:text-red-300 text-[11px]"><Trash2 className="h-3 w-3 mr-1" /> Disconnect</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-white/40 text-[11px]">Auto-post migrations & reports to your own X account. Create an app at developer.x.com (OAuth 1.0a, Read+Write), then paste your keys:</p>
          <Input value={k1} onChange={(e) => setK1(e.target.value)} placeholder="API Key (consumer key)" className="bg-white/5 border-white/10 text-xs font-mono h-8" />
          <Input value={k2} onChange={(e) => setK2(e.target.value)} type="password" placeholder="API Secret" className="bg-white/5 border-white/10 text-xs font-mono h-8" />
          <Input value={k3} onChange={(e) => setK3(e.target.value)} placeholder="Access Token" className="bg-white/5 border-white/10 text-xs font-mono h-8" />
          <Input value={k4} onChange={(e) => setK4(e.target.value)} type="password" placeholder="Access Token Secret" className="bg-white/5 border-white/10 text-xs font-mono h-8" />
          <Button size="sm" disabled={busy} onClick={connect} className="rounded-lg bg-og-cyan/90 hover:bg-og-cyan text-black font-bold text-[12px] w-full">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Twitter className="h-3.5 w-3.5 mr-1.5" />} Connect X</Button>
        </div>
      )}
    </Card>
  );
}

function supabaseFnBase() {
  const u = (import.meta as any).env?.VITE_SUPABASE_URL || "";
  return u ? `${u}/functions/v1` : "/functions/v1";
}
