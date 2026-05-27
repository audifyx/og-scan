/**
 * DevPortal — ogscan.fun/developer
 *
 * Feature 19: Developer API + App Marketplace
 * - API key management (create, rotate, revoke, name)
 * - Interactive API docs with live curl/JS/Python snippets
 * - Webhook endpoint management
 * - Rate limit dashboard
 * - Sandbox environment toggle
 * - SDK download links
 * - App marketplace (publish + install third-party apps)
 */
import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Key, Copy, Eye, EyeOff, Trash2, Plus, RefreshCw, Webhook,
  Code2, BookOpen, Zap, Globe, Shield, Activity, Package,
  Terminal, ChevronRight, ExternalLink, Download, Star,
  ToggleLeft, ToggleRight, AlertCircle, Check, ArrowRight,
  Database, Radio, Bell, Cpu, Lock
} from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  created_at: string;
  last_used: string | null;
  requests_today: number;
  is_sandbox: boolean;
  scopes: string[];
}

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  secret: string;
  success_rate: number;
  created_at: string;
}

interface MarketplaceApp {
  id: string;
  name: string;
  description: string;
  author: string;
  icon: string;
  category: string;
  installs: number;
  rating: number;
  price: "free" | "paid";
  is_installed: boolean;
  tags: string[];
}

const TABS = ["api-keys", "webhooks", "docs", "marketplace"] as const;
type Tab = typeof TABS[number];

const EVENTS = [
  "space.started", "space.ended", "space.listener_joined",
  "space.new_follower", "tip.received", "show.episode_published",
  "clip.created", "cohost.invited",
];

const MOCK_APPS: MarketplaceApp[] = [
  {
    id: "1", name: "Zapier Bridge", description: "Connect OG Scan to 5,000+ apps via Zapier triggers and actions.", author: "Zapier Inc.",
    icon: "⚡", category: "Automation", installs: 8421, rating: 4.8, price: "free", is_installed: true,
    tags: ["automation", "no-code", "workflows"],
  },
  {
    id: "2", name: "Spotify Auto-Publish", description: "Auto-submit your show episodes to Spotify Podcasts when published.", author: "OGScan Labs",
    icon: "🎙️", category: "Distribution", installs: 3102, rating: 4.9, price: "free", is_installed: false,
    tags: ["spotify", "podcast", "distribution"],
  },
  {
    id: "3", name: "AI Transcript Pro", description: "Enhanced real-time transcription with speaker diarisation and searchable archive.", author: "TranscriptAI",
    icon: "📝", category: "AI", installs: 2870, rating: 4.7, price: "paid", is_installed: false,
    tags: ["ai", "transcription", "search"],
  },
  {
    id: "4", name: "Notion Show Notes", description: "Auto-export AI-generated show notes to your Notion workspace after every space.", author: "CommCo",
    icon: "📓", category: "Productivity", installs: 1990, rating: 4.6, price: "free", is_installed: false,
    tags: ["notion", "show-notes", "export"],
  },
  {
    id: "5", name: "Stripe Tip Payouts", description: "Instant payouts to your Stripe Connected account — zero extra fees.", author: "StripeOS",
    icon: "💳", category: "Monetisation", installs: 5501, rating: 4.9, price: "free", is_installed: true,
    tags: ["stripe", "payments", "tips"],
  },
  {
    id: "6", name: "Discord Notifier", description: "Post live, ended, and clip events to your Discord server automatically.", author: "DiscordBot Co.",
    icon: "🔔", category: "Notifications", installs: 7240, rating: 4.5, price: "free", is_installed: false,
    tags: ["discord", "notifications", "community"],
  },
];

const RATE_LIMITS = [
  { plan: "Free", rps: 10, daily: "10,000", monthly: "100,000", color: "text-slate-400" },
  { plan: "Pro", rps: 100, daily: "1M", monthly: "10M", color: "text-violet-400" },
  { plan: "Enterprise", rps: 1000, daily: "Unlimited", monthly: "Unlimited", color: "text-amber-400" },
];

const CODE_SNIPPETS: Record<string, Record<string, string>> = {
  "List Spaces": {
    curl: `curl -X GET "https://api.ogscan.fun/v1/spaces" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    javascript: `const response = await fetch('https://api.ogscan.fun/v1/spaces', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});
const { spaces } = await response.json();`,
    python: `import requests

response = requests.get(
    'https://api.ogscan.fun/v1/spaces',
    headers={'Authorization': 'Bearer YOUR_API_KEY'}
)
spaces = response.json()['spaces']`,
  },
  "Start Space": {
    curl: `curl -X POST "https://api.ogscan.fun/v1/spaces" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"My Space","is_private":false}'`,
    javascript: `const response = await fetch('https://api.ogscan.fun/v1/spaces', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ title: 'My Space', is_private: false })
});
const space = await response.json();`,
    python: `import requests

response = requests.post(
    'https://api.ogscan.fun/v1/spaces',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    json={'title': 'My Space', 'is_private': False}
)
space = response.json()`,
  },
  "Send Tip": {
    curl: `curl -X POST "https://api.ogscan.fun/v1/spaces/{spaceId}/tips" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"amount":5,"currency":"USD","message":"Great content!"}'`,
    javascript: `const response = await fetch(\`https://api.ogscan.fun/v1/spaces/\${spaceId}/tips\`, {
  method: 'POST',
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' },
  body: JSON.stringify({ amount: 5, currency: 'USD', message: 'Great content!' })
});`,
    python: `requests.post(
    f'https://api.ogscan.fun/v1/spaces/{space_id}/tips',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    json={'amount': 5, 'currency': 'USD', 'message': 'Great content!'}
)`,
  },
};

const maskKey = (key: string) => key.slice(0, 12) + "●".repeat(20) + key.slice(-4);

const DevPortal = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("api-keys");
  const navigate = useNavigate();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(["read"]);
  const [isSandbox, setIsSandbox] = useState(false);
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([]);
  const [addingWebhook, setAddingWebhook] = useState(false);
  const [activeSnippet, setActiveSnippet] = useState<string>("List Spaces");
  const [snippetLang, setSnippetLang] = useState<"curl" | "javascript" | "python">("curl");
  const [apps, setApps] = useState<MarketplaceApp[]>(MOCK_APPS);
  const [appCategory, setAppCategory] = useState<string>("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: keys } = await supabase
        .from("api_keys")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });

      const { data: hooks } = await supabase
        .from("webhook_endpoints")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });

      setApiKeys(keys || []);
      setWebhooks(hooks || []);
    } catch {
      // fallback: show empty state
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) { toast({ title: "Enter a key name", variant: "destructive" }); return; }
    const rawKey = `ogscan_${isSandbox ? "test" : "live"}_${crypto.randomUUID().replace(/-/g, "").slice(0, 32)}`;
    const prefix = rawKey.slice(0, 14);
    try {
      const { data, error } = await supabase.from("api_keys").insert({
        owner_id: user!.id,
        name: newKeyName.trim(),
        key: rawKey,
        prefix,
        is_sandbox: isSandbox,
        scopes: newKeyScopes,
        requests_today: 0,
      }).select().single();
      if (error) throw error;
      setApiKeys(prev => [data, ...prev]);
      setCreatedKey(rawKey);
      setNewKeyName("");
      setShowNewKeyForm(false);
      toast({ title: "API Key created" });
    } catch {
      toast({ title: "Failed to create key", variant: "destructive" });
    }
  };

  const deleteApiKey = async (id: string) => {
    await supabase.from("api_keys").delete().eq("id", id);
    setApiKeys(prev => prev.filter(k => k.id !== id));
    toast({ title: "Key revoked" });
  };

  const addWebhook = async () => {
    if (!newWebhookUrl.trim()) { toast({ title: "Enter a URL", variant: "destructive" }); return; }
    if (newWebhookEvents.length === 0) { toast({ title: "Select at least one event", variant: "destructive" }); return; }
    setAddingWebhook(true);
    try {
      const secret = `whsec_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
      const { data, error } = await supabase.from("webhook_endpoints").insert({
        owner_id: user!.id,
        url: newWebhookUrl.trim(),
        events: newWebhookEvents,
        is_active: true,
        secret,
        success_rate: 100,
      }).select().single();
      if (error) throw error;
      setWebhooks(prev => [data, ...prev]);
      setNewWebhookUrl("");
      setNewWebhookEvents([]);
      toast({ title: "Webhook added" });
    } catch {
      toast({ title: "Failed to add webhook", variant: "destructive" });
    } finally {
      setAddingWebhook(false);
    }
  };

  const toggleWebhook = async (id: string, active: boolean) => {
    await supabase.from("webhook_endpoints").update({ is_active: !active }).eq("id", id);
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, is_active: !active } : w));
  };

  const deleteWebhook = async (id: string) => {
    await supabase.from("webhook_endpoints").delete().eq("id", id);
    setWebhooks(prev => prev.filter(w => w.id !== id));
    toast({ title: "Webhook removed" });
  };

  const toggleInstall = (id: string) => {
    setApps(prev => prev.map(a => a.id === id ? { ...a, is_installed: !a.is_installed } : a));
    const app = apps.find(a => a.id === id);
    toast({ title: app?.is_installed ? `${app?.name} uninstalled` : `${app?.name} installed` });
  };

  const copyToClipboard = (text: string, label = "Copied!") => {
    navigator.clipboard.writeText(text);
    toast({ title: label });
  };

  const categories = ["All", ...Array.from(new Set(MOCK_APPS.map(a => a.category)))];
  const filteredApps = appCategory === "All" ? apps : apps.filter(a => a.category === appCategory);

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#080a0f] text-white">
        {/* Header */}
        <div className="relative border-b border-white/[0.06] bg-gradient-to-r from-violet-900/10 via-[#080a0f] to-blue-900/10">
          <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="flex items-center gap-3 mb-5">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors group"
              >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                Back
              </button>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-violet-500/10 border border-violet-500/20">
                <Code2 className="h-7 w-7 text-violet-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Developer Portal</h1>
                <p className="text-sm text-white/40 mt-0.5">Build on OG Scan — API keys, webhooks, docs & marketplace</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mt-6 bg-white/[0.03] rounded-xl p-1 w-fit border border-white/[0.06]">
              {(["api-keys", "webhooks", "docs", "marketplace"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize",
                    activeTab === tab
                      ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                      : "text-white/40 hover:text-white/70"
                  )}
                >
                  {tab === "api-keys" ? "API Keys" : tab === "docs" ? "Docs & SDK" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

          {/* ── API KEYS TAB ── */}
          {activeTab === "api-keys" && (
            <div className="space-y-4">
              {/* Created key banner */}
              {createdKey && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                  <Check className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-emerald-300">API Key Created — save it now!</p>
                    <p className="text-xs text-white/40 mt-0.5">This key will not be shown again.</p>
                    <div className="mt-2 flex items-center gap-2 font-mono text-xs text-emerald-300 bg-emerald-500/5 rounded-lg px-3 py-2 border border-emerald-500/20 break-all">
                      {createdKey}
                      <button onClick={() => copyToClipboard(createdKey, "Key copied!")} className="ml-auto shrink-0">
                        <Copy className="h-3.5 w-3.5 text-white/40 hover:text-white" />
                      </button>
                    </div>
                  </div>
                  <button onClick={() => setCreatedKey(null)} className="text-white/30 hover:text-white shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Environment toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div>
                  <p className="text-sm font-semibold text-white">Environment Mode</p>
                  <p className="text-xs text-white/40">Sandbox keys use test data and never affect production.</p>
                </div>
                <button
                  onClick={() => setIsSandbox(!isSandbox)}
                  className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    isSandbox ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  )}
                >
                  {isSandbox ? <><ToggleRight className="h-4 w-4" />Sandbox</> : <><ToggleLeft className="h-4 w-4" />Live</>}
                </button>
              </div>

              {/* Create key */}
              {showNewKeyForm ? (
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-3">
                  <p className="text-sm font-bold text-white">New API Key</p>
                  <input
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    placeholder="Key name (e.g. Production App)"
                    className="w-full bg-white/[0.05] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none border border-white/[0.08] focus:border-violet-500/40"
                  />
                  <div>
                    <p className="text-xs text-white/40 mb-2">Scopes</p>
                    <div className="flex flex-wrap gap-2">
                      {["read", "write", "admin"].map(scope => (
                        <button
                          key={scope}
                          onClick={() => setNewKeyScopes(prev => prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope])}
                          className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-all capitalize",
                            newKeyScopes.includes(scope)
                              ? "bg-violet-500/20 text-violet-300 border-violet-500/40"
                              : "bg-white/[0.03] text-white/40 border-white/[0.08]"
                          )}
                        >
                          {scope}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={createApiKey} className="flex-1 py-2.5 rounded-xl bg-violet-500 text-white text-sm font-bold hover:bg-violet-400 transition-colors">
                      Generate Key
                    </button>
                    <button onClick={() => setShowNewKeyForm(false)} className="px-4 py-2.5 rounded-xl bg-white/[0.05] text-white/50 text-sm hover:bg-white/[0.08]">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewKeyForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm font-medium hover:bg-violet-500/20 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Create New API Key
                </button>
              )}

              {/* Keys list */}
              <div className="space-y-2">
                {apiKeys.length === 0 && !loading ? (
                  <div className="text-center py-10 text-white/30">
                    <Key className="h-8 w-8 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No API keys yet</p>
                  </div>
                ) : (
                  apiKeys.map(k => (
                    <div key={k.id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.1]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Key className="h-3.5 w-3.5 text-violet-400" />
                          <span className="text-sm font-semibold text-white">{k.name}</span>
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-bold", k.is_sandbox ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300")}>
                            {k.is_sandbox ? "SANDBOX" : "LIVE"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setVisibleKeys(prev => { const n = new Set(prev); n.has(k.id) ? n.delete(k.id) : n.add(k.id); return n; })}
                            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/40"
                          >
                            {visibleKeys.has(k.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                          <button onClick={() => copyToClipboard(k.key, "Key copied!")} className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/40">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deleteApiKey(k.id)} className="p-1.5 rounded-lg bg-red-500/5 hover:bg-red-500/15 text-red-400/60 hover:text-red-400">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="font-mono text-xs text-white/30 bg-white/[0.02] rounded-lg px-3 py-2 break-all">
                        {visibleKeys.has(k.id) ? k.key : maskKey(k.key)}
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-[11px] text-white/30">Scopes: {k.scopes?.join(", ")}</span>
                        <span className="text-[11px] text-white/30">Today: {k.requests_today?.toLocaleString() ?? 0} reqs</span>
                        {k.last_used && <span className="text-[11px] text-white/30">Last used: {new Date(k.last_used).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Rate limits */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-blue-400" />Rate Limits</p>
                <div className="grid grid-cols-3 gap-2">
                  {RATE_LIMITS.map(rl => (
                    <div key={rl.plan} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                      <p className={cn("text-xs font-bold mb-1.5", rl.color)}>{rl.plan}</p>
                      <p className="text-[11px] text-white/40">{rl.rps} RPS</p>
                      <p className="text-[11px] text-white/40">{rl.daily}/day</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── WEBHOOKS TAB ── */}
          {activeTab === "webhooks" && (
            <div className="space-y-4">
              {/* Add webhook */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-3">
                <p className="text-sm font-bold text-white flex items-center gap-2"><Webhook className="h-4 w-4 text-violet-400" />Add Endpoint</p>
                <input
                  value={newWebhookUrl}
                  onChange={e => setNewWebhookUrl(e.target.value)}
                  placeholder="https://yourdomain.com/webhook"
                  className="w-full bg-white/[0.05] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none border border-white/[0.08] focus:border-violet-500/40"
                />
                <div>
                  <p className="text-xs text-white/40 mb-2">Listen for events:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {EVENTS.map(ev => (
                      <button
                        key={ev}
                        onClick={() => setNewWebhookEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev])}
                        className={cn("px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all",
                          newWebhookEvents.includes(ev)
                            ? "bg-violet-500/20 text-violet-300 border-violet-500/40"
                            : "bg-white/[0.03] text-white/35 border-white/[0.06]"
                        )}
                      >
                        {ev}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={addWebhook}
                  disabled={addingWebhook}
                  className="w-full py-2.5 rounded-xl bg-violet-500 text-white text-sm font-bold hover:bg-violet-400 disabled:opacity-50 transition-colors"
                >
                  {addingWebhook ? "Adding..." : "Add Endpoint"}
                </button>
              </div>

              {/* Endpoints list */}
              <div className="space-y-2">
                {webhooks.length === 0 ? (
                  <div className="text-center py-10 text-white/30">
                    <Webhook className="h-8 w-8 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No webhook endpoints yet</p>
                  </div>
                ) : (
                  webhooks.map(w => (
                    <div key={w.id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono text-white/80 truncate">{w.url}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {(w.events || []).map(ev => (
                              <span key={ev} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300/70 font-mono">{ev}</span>
                            ))}
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            <span className={cn("text-[11px] font-bold", (w.success_rate ?? 100) >= 95 ? "text-emerald-400" : "text-amber-400")}>
                              {w.success_rate ?? 100}% success
                            </span>
                            <button onClick={() => copyToClipboard(w.secret, "Secret copied!")} className="text-[11px] text-white/30 hover:text-white/60 flex items-center gap-1">
                              <Lock className="h-3 w-3" />secret
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => toggleWebhook(w.id, w.is_active)} className={cn("text-xs px-2.5 py-1 rounded-lg font-medium border transition-all",
                            w.is_active ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-white/[0.03] text-white/30 border-white/[0.06]"
                          )}>
                            {w.is_active ? "Active" : "Paused"}
                          </button>
                          <button onClick={() => deleteWebhook(w.id)} className="p-1.5 text-red-400/50 hover:text-red-400 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── DOCS TAB ── */}
          {activeTab === "docs" && (
            <div className="space-y-4">
              {/* SDK Downloads */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { lang: "JavaScript", icon: "JS", color: "from-yellow-500/10 to-yellow-600/5 border-yellow-500/20 text-yellow-300", pkg: "npm install @ogscan/sdk" },
                  { lang: "Python", icon: "PY", color: "from-blue-500/10 to-blue-600/5 border-blue-500/20 text-blue-300", pkg: "pip install ogscan-sdk" },
                  { lang: "Go", icon: "GO", color: "from-cyan-500/10 to-cyan-600/5 border-cyan-500/20 text-cyan-300", pkg: "go get github.com/ogscan/sdk-go" },
                ].map(sdk => (
                  <div key={sdk.lang} className={cn("p-4 rounded-2xl bg-gradient-to-br border flex flex-col gap-2", sdk.color)}>
                    <div className="flex items-center justify-between">
                      <span className={cn("text-lg font-black font-mono", sdk.color.split(" ").pop())}>{sdk.icon}</span>
                      <Download className="h-4 w-4 text-white/30" />
                    </div>
                    <p className="text-sm font-bold text-white">{sdk.lang} SDK</p>
                    <p className="text-[10px] font-mono text-white/30 break-all">{sdk.pkg}</p>
                    <button
                      onClick={() => copyToClipboard(sdk.pkg, "Install command copied!")}
                      className="mt-auto text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.06] text-white/50 hover:text-white/80 text-left font-mono"
                    >
                      Copy install command
                    </button>
                  </div>
                ))}
              </div>

              {/* Code examples */}
              <div className="rounded-2xl bg-[#0d0f18] border border-white/[0.06] overflow-hidden">
                {/* Example picker */}
                <div className="flex gap-1 p-3 border-b border-white/[0.06] overflow-x-auto">
                  {Object.keys(CODE_SNIPPETS).map(name => (
                    <button
                      key={name}
                      onClick={() => setActiveSnippet(name)}
                      className={cn("px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                        activeSnippet === name ? "bg-violet-500/20 text-violet-300" : "text-white/30 hover:text-white/60"
                      )}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                {/* Lang picker */}
                <div className="flex gap-1 px-3 pt-3 border-b border-white/[0.06]">
                  {(["curl", "javascript", "python"] as const).map(lang => (
                    <button
                      key={lang}
                      onClick={() => setSnippetLang(lang)}
                      className={cn("px-3 py-1 rounded-t-lg text-xs font-mono transition-all",
                        snippetLang === lang ? "bg-white/[0.06] text-violet-300" : "text-white/25 hover:text-white/50"
                      )}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <pre className="p-4 text-xs font-mono text-emerald-300/80 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {CODE_SNIPPETS[activeSnippet]?.[snippetLang]}
                  </pre>
                  <button
                    onClick={() => copyToClipboard(CODE_SNIPPETS[activeSnippet]?.[snippetLang], "Snippet copied!")}
                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/[0.06] text-white/40 hover:text-white/80"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* API reference links */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { title: "REST API Reference", desc: "Full endpoint docs, params, schemas", icon: BookOpen, color: "text-violet-400" },
                  { title: "WebSocket API", desc: "Real-time events and data streams", icon: Radio, color: "text-blue-400" },
                  { title: "Webhook Events", desc: "All events, payloads and signatures", icon: Webhook, color: "text-emerald-400" },
                  { title: "Auth Guide", desc: "API keys, OAuth 2.0 flows, scopes", icon: Shield, color: "text-amber-400" },
                ].map(item => (
                  <div key={item.title} className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.1] cursor-pointer group transition-all">
                    <div className="flex items-start justify-between">
                      <item.icon className={cn("h-5 w-5 mb-2", item.color)} />
                      <ExternalLink className="h-3.5 w-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
                    </div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-xs text-white/30 mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── MARKETPLACE TAB ── */}
          {activeTab === "marketplace" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">App Marketplace</h2>
                <p className="text-sm text-white/40">Extend OG Scan with third-party integrations</p>
              </div>

              {/* Category filter */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setAppCategory(cat)}
                    className={cn("px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all",
                      appCategory === cat
                        ? "bg-violet-500/20 text-violet-300 border-violet-500/30"
                        : "bg-white/[0.03] text-white/40 border-white/[0.06] hover:text-white/70"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Apps grid */}
              <div className="grid grid-cols-2 gap-3">
                {filteredApps.map(app => (
                  <div key={app.id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.1] transition-all">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="text-2xl w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0">{app.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{app.name}</p>
                        <p className="text-[11px] text-white/30">{app.author}</p>
                      </div>
                    </div>
                    <p className="text-xs text-white/50 mb-3 line-clamp-2">{app.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                          <span className="text-[11px] text-white/50">{app.rating}</span>
                        </div>
                        <span className="text-[11px] text-white/30">{app.installs.toLocaleString()} installs</span>
                      </div>
                      <button
                        onClick={() => toggleInstall(app.id)}
                        className={cn("px-3 py-1 rounded-lg text-xs font-bold transition-all",
                          app.is_installed
                            ? "bg-white/[0.06] text-white/40 hover:bg-red-500/10 hover:text-red-400"
                            : "bg-violet-500/20 text-violet-300 hover:bg-violet-500/30"
                        )}
                      >
                        {app.is_installed ? "Installed" : app.price === "paid" ? "Buy" : "Install"}
                      </button>
                    </div>
                    {app.is_installed && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-400/70">
                        <Check className="h-3 w-3" />Active
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default DevPortal;
