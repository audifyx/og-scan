/**
 * DeveloperAPI — API key management and developer tools.
 * Create/revoke API keys, configure scopes, manage webhooks,
 * view usage stats, and access API documentation links.
 */
import React, { useState, useEffect } from "react";
import {
  Key, Plus, Trash2, Eye, EyeOff, Copy, Check, ChevronLeft,
  Zap, Globe, Code, BarChart3, AlertCircle, ExternalLink,
  Webhook, RefreshCw, Shield, Clock, Activity
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  request_count: number;
  rate_limit_rpm: number;
  created_at: string;
  expires_at: string | null;
}

interface Webhook {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  secret: string | null;
  last_triggered_at: string | null;
  success_count: number;
  fail_count: number;
  created_at: string;
}

const ALL_SCOPES = [
  { id: "spaces:read", label: "Read Spaces", desc: "List and fetch space data" },
  { id: "spaces:write", label: "Write Spaces", desc: "Create and update spaces" },
  { id: "users:read", label: "Read Users", desc: "Fetch public user profiles" },
  { id: "analytics:read", label: "Read Analytics", desc: "Access your analytics data" },
  { id: "clips:read", label: "Read Clips", desc: "Fetch clip data" },
  { id: "clips:write", label: "Write Clips", desc: "Create and update clips" },
  { id: "webhooks:manage", label: "Webhooks", desc: "Manage webhook subscriptions" },
];

const WEBHOOK_EVENTS = [
  "space.started", "space.ended", "space.listener_joined",
  "clip.created", "user.followed", "show.episode_published",
];

const ScopeTag = ({ scope, selected, onClick }: { scope: string; selected: boolean; onClick: () => void }) => (
  <button onClick={onClick} className={cn(
    "px-2.5 py-1 rounded-full text-xs font-bold transition-all",
    selected ? "bg-violet-600/20 text-violet-400 border border-violet-500/20" : "bg-white/[0.04] text-white/30 hover:text-white/60 border border-transparent"
  )}>{scope}</button>
);

const DeveloperAPI: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"keys" | "webhooks" | "docs">("keys");
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [showCreateWebhook, setShowCreateWebhook] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<Set<string>>(new Set(["spaces:read"]));
  const [newKeyExpiry, setNewKeyExpiry] = useState("never");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<Set<string>>(new Set(["space.started"]));
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [justCreatedKey, setJustCreatedKey] = useState<string | null>(null);

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    const [{ data: keys }, { data: hooks }] = await Promise.all([
      supabase.from("developer_api_keys").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("developer_webhooks").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
    ]);
    setApiKeys((keys || []) as APIKey[]);
    setWebhooks((hooks || []) as Webhook[]);
    setLoading(false);
  };

  const generateKey = () => `ogscan_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

  const createKey = async () => {
    if (!newKeyName.trim() || !user || creatingKey) return;
    setCreatingKey(true);
    const rawKey = generateKey();
    const prefix = rawKey.slice(0, 14) + "...";
    const { data } = await supabase.from("developer_api_keys").insert({
      user_id: user.id,
      name: newKeyName.trim(),
      key_hash: btoa(rawKey), // In production: real hash
      key_prefix: prefix,
      scopes: Array.from(newKeyScopes),
      is_active: true,
      request_count: 0,
      rate_limit_rpm: 60,
      expires_at: newKeyExpiry === "never" ? null : new Date(Date.now() + parseInt(newKeyExpiry) * 86400000).toISOString(),
    }).select().single();
    if (data) {
      setApiKeys(prev => [data as APIKey, ...prev]);
      setJustCreatedKey(rawKey);
    }
    setNewKeyName("");
    setNewKeyScopes(new Set(["spaces:read"]));
    setShowCreateKey(false);
    setCreatingKey(false);
  };

  const revokeKey = async (id: string) => {
    await supabase.from("developer_api_keys").update({ is_active: false }).eq("id", id);
    setApiKeys(prev => prev.map(k => k.id === id ? { ...k, is_active: false } : k));
  };

  const deleteKey = async (id: string) => {
    await supabase.from("developer_api_keys").delete().eq("id", id);
    setApiKeys(prev => prev.filter(k => k.id !== id));
  };

  const createWebhook = async () => {
    if (!newWebhookUrl.trim() || !user || creatingWebhook) return;
    setCreatingWebhook(true);
    const { data } = await supabase.from("developer_webhooks").insert({
      user_id: user.id,
      url: newWebhookUrl.trim(),
      events: Array.from(newWebhookEvents),
      is_active: true,
      secret: `whsec_${Math.random().toString(36).slice(2)}`,
      success_count: 0,
      fail_count: 0,
    }).select().single();
    if (data) setWebhooks(prev => [data as Webhook, ...prev]);
    setNewWebhookUrl("");
    setShowCreateWebhook(false);
    setCreatingWebhook(false);
  };

  const toggleWebhook = async (id: string, active: boolean) => {
    await supabase.from("developer_webhooks").update({ is_active: active }).eq("id", id);
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, is_active: active } : w));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-4 py-4 flex items-center gap-3 sticky top-0 bg-[#0a0a0f]/95 backdrop-blur z-10">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-white/[0.06]">
          <ChevronLeft className="h-5 w-5 text-white/40" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-black">Developer API</h1>
          <p className="text-xs text-white/30">API keys, webhooks & docs</p>
        </div>
        <a href="https://docs.ogscan.fun" target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors">
          <ExternalLink className="h-3.5 w-3.5" /> Docs
        </a>
      </div>

      {/* Just-created key banner */}
      {justCreatedKey && (
        <div className="m-4 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
          <div className="flex items-start gap-2 mb-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-400">API Key Created!</p>
              <p className="text-xs text-white/30">Copy this now — it won't be shown again.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-black/30 rounded-xl px-3 py-2 mt-2">
            <code className="flex-1 text-xs text-emerald-300 font-mono truncate">{justCreatedKey}</code>
            <button onClick={() => copyToClipboard(justCreatedKey, "new")}
              className="shrink-0 p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
              {copiedId === "new" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-white/30" />}
            </button>
          </div>
          <button onClick={() => setJustCreatedKey(null)} className="text-xs text-white/20 hover:text-white/40 mt-2 transition-colors">
            I've saved it — dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 px-4 py-3 border-b border-white/[0.06]">
        {([
          { id: "keys", label: "API Keys", icon: Key },
          { id: "webhooks", label: "Webhooks", icon: Zap },
          { id: "docs", label: "Reference", icon: Code },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all",
              activeTab === tab.id ? "bg-violet-600/20 text-violet-400 border border-violet-500/20" : "text-white/30 hover:text-white/60"
            )}>
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 space-y-3 max-w-2xl">
        {/* API Keys */}
        {activeTab === "keys" && (
          <>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs text-white/30">{apiKeys.length} key{apiKeys.length !== 1 ? "s" : ""}</p>
              <button onClick={() => setShowCreateKey(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600/20 text-violet-400 text-xs font-bold hover:bg-violet-600/40 border border-violet-500/20 transition-colors">
                <Plus className="h-3.5 w-3.5" /> New Key
              </button>
            </div>
            {loading ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white/[0.03] animate-pulse" />)
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-12">
                <Key className="h-10 w-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 font-bold">No API keys yet</p>
              </div>
            ) : (
              apiKeys.map(k => (
                <div key={k.id} className={cn("p-4 rounded-2xl border transition-all", k.is_active ? "bg-white/[0.03] border-white/[0.06]" : "bg-white/[0.01] border-white/[0.03] opacity-50")}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white">{k.name}</p>
                        <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-full",
                          k.is_active ? "text-emerald-400 bg-emerald-500/10" : "text-white/20 bg-white/[0.04]"
                        )}>{k.is_active ? "Active" : "Revoked"}</span>
                      </div>
                      <p className="text-xs text-white/25 font-mono mt-0.5">{k.key_prefix}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => copyToClipboard(k.key_prefix, k.id)}
                        className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
                        {copiedId === k.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-white/25" />}
                      </button>
                      {k.is_active && (
                        <button onClick={() => revokeKey(k.id)} className="p-1.5 rounded-lg hover:bg-amber-500/10 transition-colors" title="Revoke">
                          <Shield className="h-3.5 w-3.5 text-white/25 hover:text-amber-400" />
                        </button>
                      )}
                      <button onClick={() => deleteKey(k.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
                        <Trash2 className="h-3.5 w-3.5 text-white/25 hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {k.scopes.map(s => <span key={s} className="text-[10px] font-bold text-violet-400/70 bg-violet-500/10 px-2 py-0.5 rounded-full">{s}</span>)}
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-white/20">
                    <span><Activity className="h-3 w-3 inline mr-0.5" />{k.request_count.toLocaleString()} reqs</span>
                    <span><Clock className="h-3 w-3 inline mr-0.5" />{k.rate_limit_rpm} rpm</span>
                    {k.last_used_at && <span>Used {new Date(k.last_used_at).toLocaleDateString("en-AU")}</span>}
                    {k.expires_at && <span>Expires {new Date(k.expires_at).toLocaleDateString("en-AU")}</span>}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* Webhooks */}
        {activeTab === "webhooks" && (
          <>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs text-white/30">{webhooks.length} webhook{webhooks.length !== 1 ? "s" : ""}</p>
              <button onClick={() => setShowCreateWebhook(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600/20 text-violet-400 text-xs font-bold hover:bg-violet-600/40 border border-violet-500/20 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add Webhook
              </button>
            </div>
            {webhooks.length === 0 ? (
              <div className="text-center py-12">
                <Zap className="h-10 w-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 font-bold">No webhooks yet</p>
              </div>
            ) : (
              webhooks.map(w => (
                <div key={w.id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-xs text-white/70 font-mono truncate flex-1">{w.url}</p>
                    <button onClick={() => toggleWebhook(w.id, !w.is_active)}
                      className={cn("relative w-8 h-4 rounded-full transition-colors shrink-0", w.is_active ? "bg-emerald-600" : "bg-white/[0.1]")}>
                      <span className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all", w.is_active ? "left-4" : "left-0.5")} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {w.events.map(e => <span key={e} className="text-[10px] font-bold text-amber-400/70 bg-amber-500/10 px-2 py-0.5 rounded-full">{e}</span>)}
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-white/20">
                    <span className="text-emerald-400/60">✓ {w.success_count}</span>
                    {w.fail_count > 0 && <span className="text-red-400/60">✗ {w.fail_count}</span>}
                    {w.last_triggered_at && <span>Last: {new Date(w.last_triggered_at).toLocaleDateString("en-AU")}</span>}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* Docs */}
        {activeTab === "docs" && (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-violet-600/5 border border-violet-500/20">
              <p className="text-sm font-bold text-violet-400 mb-1">Base URL</p>
              <code className="text-xs text-white/60 font-mono">https://api.ogscan.fun/v1</code>
            </div>
            {[
              { method: "GET", path: "/spaces", desc: "List all live and recent spaces" },
              { method: "GET", path: "/spaces/:id", desc: "Get a specific space" },
              { method: "POST", path: "/spaces", desc: "Create a scheduled space" },
              { method: "GET", path: "/clips", desc: "List clips" },
              { method: "GET", path: "/users/:username", desc: "Get public user profile" },
              { method: "GET", path: "/analytics/spaces", desc: "Your host analytics" },
              { method: "POST", path: "/webhooks", desc: "Register a webhook" },
            ].map(ep => (
              <div key={ep.path} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <span className={cn("shrink-0 text-[10px] font-black px-2 py-1 rounded-lg",
                  ep.method === "GET" ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10"
                )}>{ep.method}</span>
                <code className="text-xs text-white/60 font-mono flex-1">{ep.path}</code>
                <p className="text-xs text-white/25 shrink-0 hidden sm:block">{ep.desc}</p>
              </div>
            ))}
            <a href="https://docs.ogscan.fun" target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] text-sm font-bold text-white/50 hover:text-white/80 transition-all">
              <ExternalLink className="h-4 w-4" /> View Full Documentation
            </a>
          </div>
        )}
      </div>

      {/* Create Key Modal */}
      {showCreateKey && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#13131f] border border-white/[0.1] rounded-2xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-black">New API Key</h2>
              <button onClick={() => setShowCreateKey(false)} className="p-1 rounded-lg hover:bg-white/[0.06]">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 font-bold uppercase tracking-wide block mb-1.5">Key Name</label>
                <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                  placeholder="My App v1" className="w-full bg-white/[0.05] rounded-xl px-4 py-2.5 text-sm text-white outline-none border border-white/[0.06] focus:border-violet-500/40" />
              </div>
              <div>
                <label className="text-xs text-white/40 font-bold uppercase tracking-wide block mb-2">Scopes</label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_SCOPES.map(s => (
                    <ScopeTag key={s.id} scope={s.id}
                      selected={newKeyScopes.has(s.id)}
                      onClick={() => {
                        const next = new Set(newKeyScopes);
                        next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                        setNewKeyScopes(next);
                      }} />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 font-bold uppercase tracking-wide block mb-1.5">Expires</label>
                <select value={newKeyExpiry} onChange={e => setNewKeyExpiry(e.target.value)}
                  className="w-full bg-white/[0.05] rounded-xl px-4 py-2.5 text-sm text-white outline-none border border-white/[0.06]">
                  <option value="never">Never</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="365">1 year</option>
                </select>
              </div>
              <button onClick={createKey} disabled={!newKeyName.trim() || creatingKey}
                className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 font-bold text-sm transition-colors disabled:opacity-40">
                {creatingKey ? "Generating…" : "Generate Key"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Webhook Modal */}
      {showCreateWebhook && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#13131f] border border-white/[0.1] rounded-2xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-black">Add Webhook</h2>
              <button onClick={() => setShowCreateWebhook(false)} className="p-1 rounded-lg hover:bg-white/[0.06]">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 font-bold uppercase tracking-wide block mb-1.5">Endpoint URL</label>
                <input value={newWebhookUrl} onChange={e => setNewWebhookUrl(e.target.value)}
                  placeholder="https://api.myapp.com/webhooks/ogscan"
                  className="w-full bg-white/[0.05] rounded-xl px-4 py-2.5 text-sm text-white outline-none border border-white/[0.06] focus:border-violet-500/40" />
              </div>
              <div>
                <label className="text-xs text-white/40 font-bold uppercase tracking-wide block mb-2">Events</label>
                <div className="flex flex-wrap gap-1.5">
                  {WEBHOOK_EVENTS.map(ev => (
                    <ScopeTag key={ev} scope={ev}
                      selected={newWebhookEvents.has(ev)}
                      onClick={() => {
                        const next = new Set(newWebhookEvents);
                        next.has(ev) ? next.delete(ev) : next.add(ev);
                        setNewWebhookEvents(next);
                      }} />
                  ))}
                </div>
              </div>
              <button onClick={createWebhook} disabled={!newWebhookUrl.trim() || creatingWebhook}
                className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 font-bold text-sm transition-colors disabled:opacity-40">
                {creatingWebhook ? "Creating…" : "Add Webhook"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeveloperAPI;
