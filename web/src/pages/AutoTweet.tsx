/**
 * AutoTweet — ogscan.fun/auto-tweet
 *
 * Automated tweet when a space goes live.
 * - Connect X (Twitter) handle
 * - Build tweet templates with smart variables ({title}, {url}, {listeners}, {time})
 * - Enable/disable auto-tweet per space or globally
 * - Preview rendered tweet
 * - Audit log of all sent tweets
 * - Also: manual "Tweet Now" from any live space
 */

import React, { useState, useEffect } from "react";
import {
  Twitter, Send, Check, Loader2, AlertCircle, Clock,
  Bell, Zap, Settings, Eye, ChevronRight, Radio,
  Copy, ExternalLink, Plus, Trash2, Globe, Lock,
  RefreshCw, Hash, Toggle, X as XIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TweetTemplate {
  id: string;
  name: string;
  template: string;
  is_default: boolean;
  send_on_start: boolean;
}

interface TweetLog {
  id: string;
  space_title: string;
  tweet_content: string;
  sent_at: string;
  status: "sent" | "failed" | "manual";
  tweet_url?: string;
}

const DEFAULT_TEMPLATES: TweetTemplate[] = [
  {
    id: "1",
    name: "Simple Announce",
    template: "🎙️ I'm going LIVE on @OGScanApp!\n\n{title}\n\nJoin now 👉 {url}\n\n#OGScan #Spaces",
    is_default: true,
    send_on_start: true,
  },
  {
    id: "2",
    name: "Hype Drop",
    template: "🔥 LIVE NOW on OGScan Spaces!\n\n\"{title}\"\n\nDrop in and join the convo 🎧\n{url}\n\n#Crypto #Spaces #OGScan",
    is_default: false,
    send_on_start: true,
  },
  {
    id: "3",
    name: "Minimal",
    template: "Live now → {url}",
    is_default: false,
    send_on_start: false,
  },
];

const VARIABLES = [
  { key: "{title}", desc: "Space title" },
  { key: "{url}", desc: "Public listener link" },
  { key: "{time}", desc: "Current time" },
  { key: "{listeners}", desc: "Live listener count" },
  { key: "{host}", desc: "Your username" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tweet preview renderer
// ─────────────────────────────────────────────────────────────────────────────

function renderTemplate(
  template: string,
  vars: Record<string, string>
): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(k, v);
  }
  return out;
}

const SAMPLE_VARS: Record<string, string> = {
  "{title}": "Crypto Market Breakdown 🔥",
  "{url}": "https://ogscan.fun/space/abc123",
  "{time}": "9:00 AM",
  "{listeners}": "247",
  "{host}": "@cryptoking",
};

// ─────────────────────────────────────────────────────────────────────────────
// Tweet Log Row
// ─────────────────────────────────────────────────────────────────────────────

function TweetLogRow({ log }: { log: TweetLog }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
              log.status === "sent"
                ? "bg-emerald-500/20 text-emerald-300"
                : log.status === "manual"
                ? "bg-sky-500/20 text-sky-300"
                : "bg-red-500/20 text-red-300"
            )}>
              {log.status}
            </span>
            <span className="text-xs font-semibold text-white truncate">{log.space_title}</span>
          </div>
          <p className="text-[11px] text-white/40">
            {format(new Date(log.sent_at), "MMM d, yyyy · h:mm a")} ·{" "}
            {formatDistanceToNow(new Date(log.sent_at), { addSuffix: true })}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {log.tweet_url && (
            <a
              href={log.tweet_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg p-1.5 text-white/25 hover:text-sky-400 hover:bg-sky-400/10 transition"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded-lg p-1.5 text-white/25 hover:text-white hover:bg-white/10 transition"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 rounded-lg bg-white/[0.04] p-3">
          <p className="whitespace-pre-wrap text-xs text-white/60 leading-relaxed">{log.tweet_content}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function AutoTweet() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"templates" | "settings" | "logs">("templates");
  const [templates, setTemplates] = useState<TweetTemplate[]>(DEFAULT_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<TweetTemplate>(DEFAULT_TEMPLATES[0]);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editName, setEditName] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [autoTweetEnabled, setAutoTweetEnabled] = useState(true);
  const [tweetLogs, setTweetLogs] = useState<TweetLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingHandle, setSavingHandle] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadSettings();
    loadLogs();
  }, [user]);

  async function loadSettings() {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("twitter_handle, auto_tweet_enabled, tweet_template_id")
      .eq("id", user.id)
      .single();
    if (data) {
      setXHandle(data.twitter_handle ?? "");
      setAutoTweetEnabled(data.auto_tweet_enabled ?? true);
    }
  }

  async function loadLogs() {
    if (!user) return;
    const { data } = await supabase
      .from("auto_tweet_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("sent_at", { ascending: false })
      .limit(20);
    if (data) setTweetLogs(data as TweetLog[]);
  }

  async function saveHandle() {
    setSavingHandle(true);
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ twitter_handle: xHandle.replace("@", ""), auto_tweet_enabled: autoTweetEnabled })
      .eq("id", user.id);
    setSavingHandle(false);
    toast.success("X handle saved!");
  }

  async function handlePostManual() {
    setLoading(true);
    const rendered = renderTemplate(selectedTemplate.template, SAMPLE_VARS);
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(rendered)}`;
    window.open(tweetUrl, "_blank");
    // Log it
    const newLog: TweetLog = {
      id: Date.now().toString(),
      space_title: "Manual Tweet",
      tweet_content: rendered,
      sent_at: new Date().toISOString(),
      status: "manual",
      tweet_url: undefined,
    };
    setTweetLogs((prev) => [newLog, ...prev]);
    await supabase.from("auto_tweet_logs").insert({
      user_id: user?.id,
      space_title: "Manual Tweet",
      tweet_content: rendered,
      sent_at: new Date().toISOString(),
      status: "manual",
    });
    setLoading(false);
    toast.success("Tweet opened in X!");
  }

  function startEdit(t: TweetTemplate) {
    setEditingTemplate(t.id);
    setEditText(t.template);
    setEditName(t.name);
  }

  function saveEdit() {
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === editingTemplate ? { ...t, template: editText, name: editName } : t
      )
    );
    if (selectedTemplate.id === editingTemplate) {
      setSelectedTemplate((prev) => ({ ...prev, template: editText, name: editName }));
    }
    setEditingTemplate(null);
    toast.success("Template saved!");
  }

  function addTemplate() {
    const newT: TweetTemplate = {
      id: Date.now().toString(),
      name: "New Template",
      template: "🎙️ I'm live on OGScan Spaces!\n\n{title}\n\n{url}",
      is_default: false,
      send_on_start: false,
    };
    setTemplates((prev) => [...prev, newT]);
    startEdit(newT.id);
  }

  function deleteTemplate(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (selectedTemplate.id === id && templates.length > 1) {
      setSelectedTemplate(templates.find((t) => t.id !== id)!);
    }
    toast.success("Template deleted");
  }

  const previewText = renderTemplate(selectedTemplate.template, SAMPLE_VARS);
  const charCount = previewText.length;

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="border-b border-white/[0.07] bg-[#0a0a14] px-4 py-5">
        <div className="mx-auto max-w-5xl">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors group mb-4"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            Back
          </button>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10">
              <Twitter className="h-4.5 w-4.5 text-sky-400" style={{ height: 18, width: 18 }} />
            </div>
            <div>
              <h1 className="text-lg font-black text-white">Auto-Tweet</h1>
              <p className="text-xs text-white/40">Automatically post to X when your space goes live</p>
            </div>
            {/* Global toggle */}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-white/40">Auto-tweet</span>
              <button
                onClick={() => setAutoTweetEnabled(!autoTweetEnabled)}
                className={cn(
                  "relative h-5 w-9 rounded-full transition",
                  autoTweetEnabled ? "bg-sky-500" : "bg-white/10"
                )}
              >
                <span className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                  autoTweetEnabled ? "translate-x-4" : "translate-x-0.5"
                )} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-2">
            {[
              { key: "templates", label: "Templates", icon: Hash },
              { key: "settings", label: "X Account", icon: Twitter },
              { key: "logs", label: "Tweet Log", icon: Clock },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key as typeof tab)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  tab === key
                    ? "bg-white/[0.08] text-white"
                    : "text-white/45 hover:bg-white/[0.04] hover:text-white/70"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* ─────── TEMPLATES TAB ─────── */}
        {tab === "templates" && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: template list */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-white/70">Tweet Templates</h2>
                <button
                  onClick={addTemplate}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-white/60 hover:text-white hover:border-white/20 transition"
                >
                  <Plus className="h-3 w-3" />
                  New
                </button>
              </div>
              <div className="space-y-3">
                {templates.map((t) => (
                  <div key={t.id}>
                    {editingTemplate === t.id ? (
                      <div className="rounded-xl border border-sky-500/30 bg-sky-500/[0.05] p-4 space-y-3">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold text-white outline-none focus:border-sky-500/60"
                          placeholder="Template name"
                        />
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={4}
                          className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white/80 outline-none focus:border-sky-500/60 resize-none leading-relaxed"
                          placeholder="Write your tweet template..."
                        />
                        <div className="flex gap-2">
                          <button onClick={saveEdit} className="flex-1 rounded-lg bg-sky-600 py-2 text-xs font-bold text-white hover:bg-sky-500 transition">Save</button>
                          <button onClick={() => setEditingTemplate(null)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 hover:text-white transition">Cancel</button>
                        </div>
                        {/* Variable chips */}
                        <div className="flex flex-wrap gap-1.5">
                          {VARIABLES.map(({ key, desc }) => (
                            <button
                              key={key}
                              onClick={() => setEditText((prev) => prev + key)}
                              title={desc}
                              className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-mono text-white/50 hover:border-sky-500/30 hover:text-sky-300 transition"
                            >
                              {key}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedTemplate(t)}
                        className={cn(
                          "w-full rounded-xl border p-4 text-left transition",
                          selectedTemplate.id === t.id
                            ? "border-sky-500/30 bg-sky-500/[0.07]"
                            : "border-white/[0.07] bg-white/[0.03] hover:border-white/15"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-white">{t.name}</span>
                          <div className="flex items-center gap-1">
                            {t.is_default && (
                              <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-bold text-sky-300">DEFAULT</span>
                            )}
                            {t.send_on_start && (
                              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">AUTO</span>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-white/40 leading-relaxed line-clamp-2">{t.template}</p>
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); startEdit(t); }}
                            className="rounded px-2 py-0.5 text-[10px] text-white/40 hover:text-white hover:bg-white/10 transition"
                          >
                            Edit
                          </button>
                          {templates.length > 1 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}
                              className="rounded px-2 py-0.5 text-[10px] text-white/30 hover:text-red-400 hover:bg-red-400/10 transition"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: preview + post */}
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white/70 mb-3">Preview</h2>
                {/* X-style tweet card */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-white/40 font-black text-sm">
                      {xHandle ? xHandle[0].toUpperCase() : "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-bold text-white">{xHandle || "Your Name"}</span>
                        <span className="text-xs text-white/30">@{(xHandle || "yourusername").replace("@", "")} · now</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-white/80 leading-relaxed">{previewText}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-3">
                    <span className={cn(
                      "text-xs font-mono",
                      charCount > 280 ? "text-red-400" : charCount > 240 ? "text-amber-400" : "text-white/30"
                    )}>
                      {charCount}/280 chars
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(previewText);
                        toast.success("Tweet text copied!");
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/40 hover:text-white hover:border-white/20 transition"
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </button>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={handlePostManual}
                disabled={loading || charCount > 280}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1DA1F2] py-3 text-sm font-bold text-white hover:bg-[#1a91da] disabled:opacity-50 transition"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Twitter className="h-4 w-4" />}
                Post to X Now
              </button>

              {/* Auto-tweet info */}
              <div className={cn(
                "rounded-xl border p-3 text-xs",
                autoTweetEnabled
                  ? "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-300"
                  : "border-white/[0.06] bg-white/[0.02] text-white/35"
              )}>
                <div className="flex items-center gap-1.5 font-semibold mb-1">
                  <Zap className="h-3 w-3" />
                  Auto-tweet is {autoTweetEnabled ? "ON" : "OFF"}
                </div>
                <p className="text-[11px] opacity-70">
                  {autoTweetEnabled
                    ? `When you start a space, the selected template will be posted to X automatically.`
                    : "Turn on auto-tweet to post to X automatically when you go live."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─────── SETTINGS TAB ─────── */}
        {tab === "settings" && (
          <div className="max-w-md space-y-5">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Twitter className="h-4 w-4 text-sky-400" />
                <span className="text-sm font-bold text-white">X (Twitter) Handle</span>
              </div>
              <div className="flex gap-2">
                <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white/40">@</div>
                <input
                  value={xHandle.replace("@", "")}
                  onChange={(e) => setXHandle(e.target.value)}
                  placeholder="yourusername"
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-sky-500/60"
                />
              </div>
              <p className="mt-2 text-[11px] text-white/35">
                Used as sender display name in previews. OGScan opens Twitter's intent URL
                to post — you post with one tap from your own account.
              </p>
              <button
                onClick={saveHandle}
                disabled={savingHandle}
                className="mt-4 flex items-center gap-2 rounded-xl bg-sky-600/80 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-50 transition"
              >
                {savingHandle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save
              </button>
            </div>
            <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-4 text-xs text-amber-300/80">
              <AlertCircle className="mb-1.5 h-3.5 w-3.5" />
              <p>
                Full X API v2 OAuth would allow fully automated posting. For now, auto-tweet
                opens Twitter's web intent for a single-click post — your credentials stay on X.
                Full API automation is on the roadmap for verified business accounts.
              </p>
            </div>
          </div>
        )}

        {/* ─────── LOGS TAB ─────── */}
        {tab === "logs" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white/70">Tweet History</h2>
              <button onClick={loadLogs} className="rounded-lg p-1.5 text-white/30 hover:text-white hover:bg-white/10 transition">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            {tweetLogs.length === 0 ? (
              <div className="py-16 text-center">
                <Twitter className="mx-auto mb-3 h-8 w-8 text-white/10" />
                <p className="text-sm text-white/35">No tweets sent yet</p>
                <p className="mt-1 text-xs text-white/20">
                  Go live or use "Post to X Now" to send your first auto-tweet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tweetLogs.map((log) => (
                  <TweetLogRow key={log.id} log={log} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
