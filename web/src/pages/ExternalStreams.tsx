/**
 * ExternalStreams — ogscan.fun/streams
 *
 * Feature 17: External Stream Linking (Twitch / YouTube / LinkedIn / Facebook)
 * - Paste any stream URL → auto-fetch title + thumbnail → show as a card
 * - Platform auto-detection from URL
 * - Cards appear in discovery feed when is_live = true
 * - Host can mark stream as ended / delete card
 * - Cards link out to native platform with a "Join on [Platform]" CTA
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  ExternalLink, Plus, Trash2, Loader2, Globe, Tv, Youtube,
  Linkedin, Play, Radio, X, CheckCircle2, AlertCircle, RefreshCw,
  Link as LinkIcon, Eye, Clock, ToggleLeft, ToggleRight,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { safeAvatarUrl } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface StreamCard {
  id: string;
  user_id: string;
  username: string | null;
  platform: "twitch" | "youtube" | "linkedin" | "facebook" | "other";
  stream_url: string;
  title: string | null;
  thumbnail_url: string | null;
  viewer_count: number | null;
  is_live: boolean;
  created_at: string;
  // enriched locally
  host_username?: string;
  host_avatar?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform helpers
// ─────────────────────────────────────────────────────────────────────────────

function detectPlatform(url: string): StreamCard["platform"] {
  const u = url.toLowerCase();
  if (u.includes("twitch.tv")) return "twitch";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("linkedin.com")) return "linkedin";
  if (u.includes("facebook.com") || u.includes("fb.gg") || u.includes("fb.watch")) return "facebook";
  return "other";
}

function platformLabel(p: StreamCard["platform"]): string {
  return { twitch: "Twitch", youtube: "YouTube", linkedin: "LinkedIn Live", facebook: "Facebook Live", other: "Live Stream" }[p];
}

function platformColor(p: StreamCard["platform"]): string {
  return {
    twitch: "from-purple-500/20 to-purple-900/5 border-purple-500/20",
    youtube: "from-red-500/20 to-red-900/5 border-red-500/20",
    linkedin: "from-blue-500/20 to-blue-900/5 border-blue-500/20",
    facebook: "from-indigo-500/20 to-indigo-900/5 border-indigo-500/20",
    other: "from-white/5 to-white/0 border-white/10",
  }[p];
}

function PlatformIcon({ platform, className }: { platform: StreamCard["platform"]; className?: string }) {
  if (platform === "twitch") return <Tv className={cn("text-purple-400", className)} />;
  if (platform === "youtube") return <Youtube className={cn("text-red-400", className)} />;
  if (platform === "linkedin") return <Linkedin className={cn("text-blue-400", className)} />;
  if (platform === "facebook") return <Globe className={cn("text-indigo-400", className)} />;
  return <Radio className={cn("text-white/40", className)} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch metadata for a URL
// ─────────────────────────────────────────────────────────────────────────────

async function fetchStreamMeta(url: string, platform: StreamCard["platform"]): Promise<{ title: string; thumbnail: string | null }> {
  // YouTube oEmbed
  if (platform === "youtube") {
    try {
      const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const res = await fetch(oembed);
      if (res.ok) {
        const data = await res.json();
        return { title: data.title || "YouTube Live", thumbnail: data.thumbnail_url || null };
      }
    } catch (_) {}
  }
  // Twitch: extract channel name from URL
  if (platform === "twitch") {
    const match = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
    if (match) {
      return { title: `${match[1]} — Live on Twitch`, thumbnail: null };
    }
  }
  // LinkedIn: just use domain title
  if (platform === "linkedin") {
    return { title: "LinkedIn Live Stream", thumbnail: null };
  }
  if (platform === "facebook") {
    return { title: "Facebook Live Stream", thumbnail: null };
  }
  // Fallback: extract from URL
  try {
    const u = new URL(url);
    return { title: `Live on ${u.hostname.replace("www.", "")}`, thumbnail: null };
  } catch (_) {
    return { title: "Live Stream", thumbnail: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Stream Modal
// ─────────────────────────────────────────────────────────────────────────────

function AddStreamModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const navigate = useNavigate();
  const [detecting, setDetecting] = useState(false);
  const [meta, setMeta] = useState<{ title: string; thumbnail: string | null } | null>(null);
  const [platform, setPlatform] = useState<StreamCard["platform"] | null>(null);
  const [saving, setSaving] = useState(false);
  const [urlError, setUrlError] = useState("");

  const handleDetect = async () => {
    if (!url.trim()) return;
    setUrlError("");
    setDetecting(true);
    try {
      new URL(url); // validate
      const p = detectPlatform(url);
      setPlatform(p);
      const m = await fetchStreamMeta(url, p);
      setMeta(m);
    } catch (_) {
      setUrlError("Please enter a valid URL");
    } finally {
      setDetecting(false);
    }
  };

  const handleAdd = async () => {
    if (!user || !url || !platform) return;
    setSaving(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user.id)
        .single();

      const { error } = await supabase.from("external_stream_cards").insert({
        user_id: user.id,
        username: profile?.username || user.email?.split("@")[0] || "anon",
        platform,
        stream_url: url.trim(),
        title: meta?.title || "Live Stream",
        thumbnail_url: meta?.thumbnail || null,
        is_live: true,
      });

      if (error) throw error;
      toast.success("Stream card added! It'll show in Discovery.");
      onAdded();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to add stream");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#0d0d1a] border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-purple-400" />
            Link External Stream
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-white/40 leading-relaxed">
          Paste your Twitch, YouTube Live, LinkedIn Live, or Facebook Live URL. A card will appear in the OGScan discovery feed so your followers can find you.
        </p>

        {/* Supported platforms */}
        <div className="flex gap-3">
          {(["twitch", "youtube", "linkedin", "facebook"] as const).map((p) => (
            <div key={p} className={cn(
              "flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border transition-all",
              platform === p ? "border-purple-500/40 bg-purple-500/10 text-white/70" : "border-white/5 text-white/20"
            )}>
              <PlatformIcon platform={p} className="h-3 w-3" />
              {platformLabel(p).split(" ")[0]}
            </div>
          ))}
        </div>

        {/* URL input */}
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => { setUrl(e.target.value); setMeta(null); setPlatform(null); setUrlError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleDetect()}
            placeholder="https://twitch.tv/yourchannel"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-purple-500/50"
          />
          <button
            onClick={handleDetect}
            disabled={!url.trim() || detecting}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/50 hover:text-white/70 hover:border-white/20 transition-all disabled:opacity-40"
          >
            {detecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Detect"}
          </button>
        </div>

        {urlError && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />{urlError}
          </p>
        )}

        {/* Preview */}
        {meta && platform && (
          <div className={cn(
            "p-3 rounded-xl border bg-gradient-to-br flex items-start gap-3 transition-all",
            platformColor(platform)
          )}>
            {meta.thumbnail ? (
              <img src={meta.thumbnail} alt="" className="w-14 h-9 rounded object-cover flex-shrink-0" />
            ) : (
              <div className="w-14 h-9 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
                <PlatformIcon platform={platform} className="h-5 w-5" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] text-red-400 font-semibold">LIVE</span>
                <span className="text-[10px] text-white/30 ml-1">{platformLabel(platform)}</span>
              </div>
              <p className="text-xs text-white/80 font-medium truncate">{meta.title}</p>
            </div>
            <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white/70 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!meta || !platform || saving}
            className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add Stream Card
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stream Card Component
// ─────────────────────────────────────────────────────────────────────────────

function StreamCardItem({
  card,
  isOwner,
  onToggleLive,
  onDelete,
}: {
  card: StreamCard;
  isOwner: boolean;
  onToggleLive: (id: string, live: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={cn(
      "group relative bg-gradient-to-br border rounded-xl overflow-hidden",
      platformColor(card.platform)
    )}>
      {/* Thumbnail / platform icon */}
      <div className="flex gap-3 p-4">
        <div className="relative flex-shrink-0">
          {card.thumbnail_url ? (
            <img
              src={card.thumbnail_url}
              alt={card.title || "stream"}
              className="w-20 h-12 rounded-lg object-cover"
            />
          ) : (
            <div className="w-20 h-12 rounded-lg bg-white/10 flex items-center justify-center">
              <PlatformIcon platform={card.platform} className="h-6 w-6" />
            </div>
          )}
          {card.is_live && (
            <div className="absolute top-1 left-1 flex items-center gap-0.5 bg-red-600 rounded px-1 py-0.5">
              <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
              <span className="text-[8px] text-white font-bold">LIVE</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <PlatformIcon platform={card.platform} className="h-3 w-3" />
            <span className="text-[10px] text-white/40 font-medium">{platformLabel(card.platform)}</span>
            <span className="text-white/15">·</span>
            <span className="text-[10px] text-white/30">{formatDistanceToNow(new Date(card.created_at), { addSuffix: true })}</span>
          </div>

          <p className="text-sm font-semibold text-white/90 line-clamp-2 leading-snug">
            {card.title || "Live Stream"}
          </p>

          {card.username && (
            <p className="text-xs text-white/40 mt-0.5">@{card.username}</p>
          )}

          {card.viewer_count != null && (
            <p className="text-xs text-white/30 flex items-center gap-1 mt-1">
              <Eye className="h-3 w-3" /> {card.viewer_count.toLocaleString()} viewers
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-white/5 px-4 py-2.5 flex items-center justify-between gap-2">
        <a
          href={card.stream_url}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all",
            card.is_live
              ? "bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30"
              : "bg-white/5 border border-white/10 text-white/40 hover:text-white/70"
          )}
        >
          <Play className="h-3 w-3" />
          {card.is_live ? `Join on ${platformLabel(card.platform).split(" ")[0]}` : "View Stream"}
          <ExternalLink className="h-2.5 w-2.5" />
        </a>

        {isOwner && (
          <div className="flex items-center gap-2">
            {/* Toggle live */}
            <button
              onClick={() => onToggleLive(card.id, !card.is_live)}
              className={cn(
                "flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border transition-all",
                card.is_live
                  ? "border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  : "border-white/10 text-white/30 hover:border-white/20"
              )}
            >
              {card.is_live ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
              {card.is_live ? "Live" : "Ended"}
            </button>
            <button
              onClick={() => onDelete(card.id)}
              className="p-1 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

type FilterMode = "all" | "live" | "mine";

export default function ExternalStreams() {
  const { user } = useAuth();
  const [cards, setCards] = useState<StreamCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>("live");
  const [showAdd, setShowAdd] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase.from("external_stream_cards").select("*").order("created_at", { ascending: false });
      if (filter === "live") q = q.eq("is_live", true) as any;
      if (filter === "mine" && user) q = q.eq("user_id", user.id) as any;
      const { data, error } = await q;
      if (error) throw error;

      // Enrich with profile data
      const enriched = await Promise.all((data || []).map(async (c: any) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("user_id", c.user_id)
          .maybeSingle();
        return {
          ...c,
          host_username: profile?.username || c.username || "anon",
          host_avatar: profile?.avatar_url || null,
        };
      }));

      setCards(enriched as StreamCard[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter, user, refreshKey]);

  useEffect(() => { loadCards(); }, [loadCards]);

  const handleToggleLive = async (id: string, live: boolean) => {
    const { error } = await supabase.from("external_stream_cards").update({ is_live: live }).eq("id", id);
    if (error) { toast.error("Update failed"); return; }
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, is_live: live } : c));
    toast.success(live ? "Marked as live" : "Marked as ended");
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("external_stream_cards").delete().eq("id", id);
    if (error) { toast.error("Delete failed"); return; }
    setCards((prev) => prev.filter((c) => c.id !== id));
    toast.success("Stream card removed");
  };

  const liveCount = cards.filter((c) => c.is_live).length;

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      <Toaster />

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#080810]/95 backdrop-blur-md border-b border-white/5 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors group mb-4">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-purple-400" />
            <h1 className="text-base font-bold text-white">External Streams</h1>
            {liveCount > 0 && (
              <div className="flex items-center gap-1 bg-red-500/15 border border-red-500/20 rounded-full px-2 py-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] text-red-400 font-semibold">{liveCount} LIVE</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            {user && (
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 transition-colors px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Link Stream
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Subtitle */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <p className="text-xs text-white/30 mb-4">
          Link your Twitch, YouTube, LinkedIn, or Facebook live streams. Cards appear in the OGScan Discovery feed.
        </p>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          {(["live", "all", "mine"] as FilterMode[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                filter === f
                  ? "bg-purple-600/30 border border-purple-500/50 text-purple-300"
                  : "bg-white/5 border border-transparent text-white/40 hover:text-white/70"
              )}
            >
              {f === "live" ? "🔴 Live Now" : f === "all" ? "All" : "Mine"}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="max-w-2xl mx-auto px-4 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 text-purple-400 animate-spin" />
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-16">
            <Radio className="h-10 w-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/30">
              {filter === "live" ? "No external streams live right now" :
               filter === "mine" ? "You haven't linked any streams yet" :
               "No streams linked yet"}
            </p>
            {user && (
              <button
                onClick={() => setShowAdd(true)}
                className="mt-4 flex items-center gap-1.5 mx-auto bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 px-4 py-2 rounded-xl text-sm transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                Link your stream
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cards.map((card) => (
              <StreamCardItem
                key={card.id}
                card={card}
                isOwner={user?.id === card.user_id}
                onToggleLive={handleToggleLive}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddStreamModal
          onClose={() => setShowAdd(false)}
          onAdded={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
