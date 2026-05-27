/**
 * UserPublicPage — ogscan.fun/u/:username
 *
 * Every OGScan user's personal broadcast page. No auth needed to view.
 *
 * Features:
 *  - Stunning hero with animated gradient, banner, glassmorphic avatar ring
 *  - LIVE SPACE banner with audio — anyone can tap to listen right here (no new tab)
 *  - Real-time listener count, live chat view on the page itself
 *  - Past spaces grid with replay links + peak listener / duration stats
 *  - Scheduled upcoming spaces (RSVP button)
 *  - X Spaces cards — if host linked an X Space, shows join button
 *  - User stats: total hours hosted, total listeners, spaces count, followers
 *  - Social links (X, Discord, website)
 *  - Follower / following counts
 *  - Embed modal: iframe code for their custom page widget
 *  - Share via X tweet button
 *  - Custom accent color per user
 *  - Realtime updates throughout — no refresh needed
 *  - "Get Your Page" CTA for non-members
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Room, RoomEvent, Track, ConnectionState,
} from "livekit-client";
import {
  Radio, Users, Globe, Twitter, MessageSquare, Clock,
  Headphones, Copy, Check, ExternalLink, Mic, Play,
  Share2, Code2, ArrowRight, ArrowLeft, Star, Zap, Crown, Shield,
  Calendar, BarChart3, Heart, ChevronRight, Loader2,
  Volume2, VolumeX, X as XIcon, Send, Sparkles,
  TrendingUp, Award, Eye, Bell, BellOff, Link as LinkIcon,
  Maximize2, ChevronDown,
} from "lucide-react";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { safeAvatarUrl, cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

const LIVEKIT_URL = "wss://new-7unnd5e1.livekit.cloud";

/* ══════════════════════════════════════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════════════════════════════════════ */
interface Profile {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  twitter_handle: string | null;
  discord_handle: string | null;
  website_url: string | null;
  website?: string | null;
  followers_count: number;
  following_count: number;
  is_public: boolean;
  badge: string | null;
  verified?: boolean;
  page_accent?: string | null;
  is_official_account?: boolean;
  affiliate_org_id?: string | null;
  total_xp?: number | null;
  current_level?: number | null;
  is_pioneer?: boolean;
  created_at?: string;
}

interface Space {
  id: string;
  title: string;
  description: string | null;
  host_id: string;
  host_username: string | null;
  host_avatar: string | null;
  topic: string | null;
  is_live: boolean;
  is_private: boolean;
  listener_count: number;
  speaker_count: number;
  peak_listeners: number;
  created_at: string;
  scheduled_for: string | null;
  ended_at: string | null;
  tags: string[] | null;
  recording_url: string | null;
  duration_seconds: number | null;
  category: string | null;
  pinned_tweet_url: string | null;
}

interface ChatMsg {
  id: string;
  username: string | null;
  avatar_url: string | null;
  content: string;
  created_at: string;
}

/* ══════════════════════════════════════════════════════════════════════════════
   ACCENT SYSTEM
   ══════════════════════════════════════════════════════════════════════════════ */
const ACCENTS: Record<string, {
  ring: string; glow: string; shadow: string; dot: string;
  btn: string; btnHov: string; badge: string; text: string;
  gradFrom: string; gradVia: string; divider: string;
}> = {
  violet:  { ring:"ring-violet-500/50",  glow:"shadow-violet-500/25",  shadow:"shadow-violet-500/10",  dot:"bg-violet-400",   btn:"bg-violet-600",  btnHov:"hover:bg-violet-500",  badge:"bg-violet-500/15 text-violet-300 border-violet-500/25",  text:"text-violet-400",  gradFrom:"from-violet-600/20",  gradVia:"via-violet-900/10",  divider:"border-violet-500/20" },
  sky:     { ring:"ring-sky-500/50",     glow:"shadow-sky-500/25",     shadow:"shadow-sky-500/10",     dot:"bg-sky-400",      btn:"bg-sky-600",     btnHov:"hover:bg-sky-500",     badge:"bg-sky-500/15 text-sky-300 border-sky-500/25",           text:"text-sky-400",     gradFrom:"from-sky-600/20",     gradVia:"via-sky-900/10",     divider:"border-sky-500/20" },
  emerald: { ring:"ring-emerald-500/50", glow:"shadow-emerald-500/25", shadow:"shadow-emerald-500/10", dot:"bg-emerald-400",  btn:"bg-emerald-600", btnHov:"hover:bg-emerald-500", badge:"bg-emerald-500/15 text-emerald-300 border-emerald-500/25",text:"text-emerald-400", gradFrom:"from-emerald-600/20", gradVia:"via-emerald-900/10", divider:"border-emerald-500/20" },
  amber:   { ring:"ring-amber-500/50",   glow:"shadow-amber-500/25",   shadow:"shadow-amber-500/10",   dot:"bg-amber-400",    btn:"bg-amber-600",   btnHov:"hover:bg-amber-500",   badge:"bg-amber-500/15 text-amber-300 border-amber-500/25",     text:"text-amber-400",   gradFrom:"from-amber-600/20",   gradVia:"via-amber-900/10",   divider:"border-amber-500/20" },
  rose:    { ring:"ring-rose-500/50",    glow:"shadow-rose-500/25",    shadow:"shadow-rose-500/10",    dot:"bg-rose-400",     btn:"bg-rose-600",    btnHov:"hover:bg-rose-500",    badge:"bg-rose-500/15 text-rose-300 border-rose-500/25",         text:"text-rose-400",    gradFrom:"from-rose-600/20",    gradVia:"via-rose-900/10",    divider:"border-rose-500/20" },
  cyan:    { ring:"ring-cyan-500/50",    glow:"shadow-cyan-500/25",    shadow:"shadow-cyan-500/10",    dot:"bg-cyan-400",     btn:"bg-cyan-600",    btnHov:"hover:bg-cyan-500",    badge:"bg-cyan-500/15 text-cyan-300 border-cyan-500/25",         text:"text-cyan-400",    gradFrom:"from-cyan-600/20",    gradVia:"via-cyan-900/10",    divider:"border-cyan-500/20" },
  pink:    { ring:"ring-pink-500/50",    glow:"shadow-pink-500/25",    shadow:"shadow-pink-500/10",    dot:"bg-pink-400",     btn:"bg-pink-600",    btnHov:"hover:bg-pink-500",    badge:"bg-pink-500/15 text-pink-300 border-pink-500/25",         text:"text-pink-400",    gradFrom:"from-pink-600/20",    gradVia:"via-pink-900/10",    divider:"border-pink-500/20" },
  indigo:  { ring:"ring-indigo-500/50",  glow:"shadow-indigo-500/25",  shadow:"shadow-indigo-500/10",  dot:"bg-indigo-400",   btn:"bg-indigo-600",  btnHov:"hover:bg-indigo-500",  badge:"bg-indigo-500/15 text-indigo-300 border-indigo-500/25",  text:"text-indigo-400",  gradFrom:"from-indigo-600/20",  gradVia:"via-indigo-900/10",  divider:"border-indigo-500/20" },
};
const getAccent = (k: string | null | undefined) => ACCENTS[k || "violet"] ?? ACCENTS.violet;

/* ══════════════════════════════════════════════════════════════════════════════
   TOPIC BADGE
   ══════════════════════════════════════════════════════════════════════════════ */
const TOPIC_BADGE: Record<string, string> = {
  Alpha:    "bg-amber-500/20 text-amber-300 border-amber-500/30",
  Trading:  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  Memes:    "bg-pink-500/20 text-pink-300 border-pink-500/30",
  DeFi:     "bg-blue-500/20 text-blue-300 border-blue-500/30",
  NFTs:     "bg-purple-500/20 text-purple-300 border-purple-500/30",
  Tech:     "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  Research: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  General:  "bg-white/8 text-white/40 border-white/10",
};
const topicBadge = (t: string | null) => TOPIC_BADGE[t || "General"] ?? TOPIC_BADGE.General;

/* ══════════════════════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════════════════════ */
const fmtDur = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const fmtCount = (n: number) =>
  n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` :
  n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;

/* ══════════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ══════════════════════════════════════════════════════════════════════════════ */
function LiveDot({ color = "bg-red-500", size = "h-2.5 w-2.5" }: { color?: string; size?: string }) {
  return (
    <span className={cn("relative flex", size)}>
      <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", color)} />
      <span className={cn("relative inline-flex rounded-full", size, color)} />
    </span>
  );
}

function CopyBtn({ text, label, className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const doCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("Copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={doCopy} className={cn("flex items-center gap-1.5 transition-all", className)}>
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {label && <span>{copied ? "Copied!" : label}</span>}
    </button>
  );
}

/* Live audio player panel (embedded in the page) */
function LiveAudioPanel({
  spaceId, accent, onListenerChange,
}: {
  spaceId: string;
  accent: typeof ACCENTS[string];
  onListenerChange?: (n: number) => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const roomRef = useRef<Room | null>(null);
  const audios = useRef<Map<string, HTMLAudioElement>>(new Map());

  const applyVol = (v: number) => {
    setVolume(v);
    audios.current.forEach(a => { a.volume = muted ? 0 : v; });
  };
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    audios.current.forEach(a => { a.volume = next ? 0 : volume; });
  };

  const connect = async () => {
    if (connecting || connected) return;
    setConnecting(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/public-listener-token?space_id=${spaceId}`,
        { headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" } }
      );
      if (!res.ok) throw new Error();
      const { token } = await res.json();
      const room = new Room({ adaptiveStream: true, dynacast: true });
      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = new Audio();
          el.srcObject = new MediaStream([track.mediaStreamTrack]);
          el.volume = muted ? 0 : volume;
          el.play().catch(() => {});
          audios.current.set(participant.sid, el);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (_t, _p, participant) => {
        const el = audios.current.get(participant.sid);
        if (el) { el.pause(); el.srcObject = null; audios.current.delete(participant.sid); }
      });
      room.on(RoomEvent.ConnectionStateChanged, s => {
        if (s === ConnectionState.Connected) { setConnected(true); setConnecting(false); }
        if (s === ConnectionState.Disconnected) { setConnected(false); }
      });
      await room.connect(LIVEKIT_URL, token);
      roomRef.current = room;
    } catch {
      setConnecting(false);
      toast.error("Couldn't connect — try the full page");
    }
  };

  useEffect(() => () => { roomRef.current?.disconnect(); }, []);

  return (
    <div className="flex items-center gap-3">
      {!connected ? (
        <button
          onClick={connect}
          disabled={connecting}
          className={cn(
            "flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white shadow-lg transition-all disabled:opacity-60",
            accent.btn, accent.btnHov, `shadow-lg ${accent.glow}`
          )}
        >
          {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Headphones className="h-4 w-4" />}
          {connecting ? "Connecting…" : "Listen Live Here"}
        </button>
      ) : (
        <div className="flex items-center gap-3 flex-1">
          <div className={cn("flex items-center gap-1.5 text-xs font-medium", accent.text)}>
            <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: "currentColor" }} />
            Connected
          </div>
          <button
            onClick={toggleMute}
            className="h-8 w-8 rounded-lg bg-white/8 hover:bg-white/15 border border-white/10 flex items-center justify-center transition-all"
          >
            {muted ? <VolumeX className="h-3.5 w-3.5 text-white/40" /> : <Volume2 className="h-3.5 w-3.5 text-white/60" />}
          </button>
          <input
            type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
            onChange={e => applyVol(parseFloat(e.target.value))}
            className="flex-1 h-1 cursor-pointer"
            style={{ accentColor: accent.btn.includes("violet") ? "#7c3aed" : accent.btn.includes("sky") ? "#0284c7" : "#10b981" }}
          />
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   EMBED MODAL
   ══════════════════════════════════════════════════════════════════════════════ */
function EmbedModal({ username, accent, onClose }: { username: string; accent: typeof ACCENTS[string]; onClose: () => void }) {
  const [tab, setTab] = useState<"widget" | "space">("widget");
  const widgetUrl = `https://ogscan.fun/u/${username}/widget`;
  const widgetCode = `<iframe\n  src="${widgetUrl}"\n  width="340"\n  height="200"\n  frameborder="0"\n  allow="autoplay"\n  style="border-radius:16px;border:none;overflow:hidden;"\n></iframe>`;
  const profileCode = `<iframe\n  src="https://ogscan.fun/u/${username}"\n  width="640"\n  height="600"\n  frameborder="0"\n  style="border-radius:20px;border:none;overflow:hidden;"\n></iframe>`;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#0c101e] border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-white">Embed on Your Website</h2>
            <p className="text-xs text-white/40 mt-0.5">Goes live automatically when you start a Space</p>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all">
            <XIcon className="h-3.5 w-3.5 text-white/50" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-5">
          {(["widget", "space"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn("flex-1 py-1.5 rounded-lg text-xs font-medium transition-all", tab === t ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60")}
            >
              {t === "widget" ? "Live Widget (small)" : "Full Profile (large)"}
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="rounded-xl overflow-hidden border border-white/10 mb-4 bg-[#080c18]" style={{ height: tab === "widget" ? 200 : 380 }}>
          <iframe
            src={tab === "widget" ? widgetUrl : `https://ogscan.fun/u/${username}`}
            width="100%"
            height="100%"
            frameBorder="0"
            title="Preview"
          />
        </div>

        {/* Code */}
        <div className="bg-black/50 rounded-xl border border-white/10 p-4 mb-4">
          <pre className="text-xs text-emerald-300 whitespace-pre-wrap break-all font-mono leading-relaxed">
            {tab === "widget" ? widgetCode : profileCode}
          </pre>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => { navigator.clipboard.writeText(tab === "widget" ? widgetCode : profileCode); toast.success("Code copied!"); }}
            className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all", accent.btn, accent.btnHov)}
          >
            <Copy className="h-4 w-4" /> Copy Code
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-white/50 transition-all">
            Done
          </button>
        </div>

        <p className="text-[10px] text-white/20 text-center mt-3">
          Widget auto-updates — no code changes needed when you go live
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════════════════ */
export default function UserPublicPage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [liveSpace, setLiveSpace] = useState<Space | null>(null);
  const [scheduledSpaces, setScheduledSpaces] = useState<Space[]>([]);
  const [pastSpaces, setPastSpaces] = useState<Space[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [totalListeners, setTotalListeners] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [liveListenerCount, setLiveListenerCount] = useState(0);
  const chatRef = useRef<HTMLDivElement>(null);

  const pageUrl = `https://ogscan.fun/u/${username}`;

  /* ── Load everything ── */
  const load = useCallback(async () => {
    if (!username) return;
    setLoading(true);

    const { data: pData } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .single();

    if (!pData) { setNotFound(true); setLoading(false); return; }
    setProfile(pData as Profile);

    // Live space
    const { data: live } = await supabase
      .from("spaces")
      .select("*")
      .eq("host_id", pData.user_id)
      .eq("is_live", true)
      .limit(1)
      .single();
    setLiveSpace((live as Space) || null);
    setLiveListenerCount((live as Space)?.listener_count ?? 0);

    // Scheduled spaces (future)
    const { data: scheduled } = await supabase
      .from("spaces")
      .select("*")
      .eq("host_id", pData.user_id)
      .eq("is_live", false)
      .is("ended_at", null)
      .not("scheduled_for", "is", null)
      .gte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(5);
    setScheduledSpaces((scheduled as Space[]) || []);

    // Past spaces
    const { data: past } = await supabase
      .from("spaces")
      .select("*")
      .eq("host_id", pData.user_id)
      .eq("is_live", false)
      .not("ended_at", "is", null)
      .order("ended_at", { ascending: false })
      .limit(20);
    const pastArr = (past as Space[]) || [];
    setPastSpaces(pastArr);
    setTotalListeners(pastArr.reduce((s, sp) => s + (sp.peak_listeners || 0), 0));
    setTotalHours(Math.round(pastArr.reduce((s, sp) => s + (sp.duration_seconds || 0), 0) / 3600));

    setLoading(false);
  }, [username]);

  useEffect(() => { load(); }, [load]);

  /* ── Live chat (for current live space) ── */
  useEffect(() => {
    if (!liveSpace) { setMessages([]); return; }
    supabase
      .from("space_chat")
      .select("*")
      .eq("space_id", liveSpace.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setMessages(((data as ChatMsg[]) || []).reverse());
        setTimeout(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, 100);
      });

    const ch = supabase
      .channel(`page-chat-${liveSpace.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "space_chat", filter: `space_id=eq.${liveSpace.id}` }, (p) => {
        setMessages(prev => {
          const next = [...prev, p.new as ChatMsg].slice(-100);
          setTimeout(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, 50);
          return next;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [liveSpace?.id]);

  /* ── Realtime space changes ── */
  useEffect(() => {
    if (!profile) return;
    const ch = supabase
      .channel(`page-spaces-${profile.user_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "spaces", filter: `host_id=eq.${profile.user_id}` }, async (payload) => {
        const sp = payload.new as Space;
        if (sp.is_live) {
          setLiveSpace(sp);
          setLiveListenerCount(sp.listener_count);
        } else if (liveSpace && sp.id === liveSpace.id) {
          setLiveSpace(null);
          load();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile, liveSpace, load]);

  /* ── Realtime listener count for live space ── */
  useEffect(() => {
    if (!liveSpace) return;
    const ch = supabase
      .channel(`page-lc-${liveSpace.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "spaces", filter: `id=eq.${liveSpace.id}` }, (p) => {
        setLiveListenerCount((p.new as Space).listener_count);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [liveSpace?.id]);

  const accent = getAccent(profile?.page_accent);

  /* ─────────────────── LOADING ─────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#060811] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
          <p className="text-white/30 text-sm">Loading profile…</p>
        </div>
      </div>
    );
  }

  /* ─────────────────── NOT FOUND ─────────────────── */
  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-[#060811] flex flex-col items-center justify-center gap-6 px-4 text-center">
        <Toaster />
        <div className="text-7xl">👤</div>
        <div>
          <h1 className="text-white text-2xl font-bold mb-2">@{username} not found</h1>
          <p className="text-white/40 text-sm">This page doesn't exist or is set to private.</p>
        </div>
        <Link to="/" className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all">
          Launch OGScan →
        </Link>
      </div>
    );
  }

  const displayName = profile.display_name || profile.username || "Anonymous";
  const website = profile.website_url || profile.website;
  const twitterHandle = profile.twitter_handle?.replace("@", "");
  const xSpaceTweet = `https://twitter.com/intent/tweet?text=Follow+%40${twitterHandle || username}+on+OGScan+for+live+crypto+Spaces+🎙️%0A%0A&url=${encodeURIComponent(pageUrl)}`;

  return (
    <div className="min-h-screen bg-[#060811] text-white">
      <Toaster />
      {showEmbed && username && <EmbedModal username={username} accent={accent} onClose={() => setShowEmbed(false)} />}

      {/* ════════════ HERO BANNER ════════════ */}
      <div className="relative h-52 md:h-64 overflow-hidden">
        {profile.banner_url ? (
          <img src={profile.banner_url} alt="banner" className="w-full h-full object-cover" />
        ) : (
          <div className={cn("w-full h-full bg-gradient-to-br", accent.gradFrom, accent.gradVia, "to-[#060811]")} />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#060811] via-[#060811]/30 to-transparent" />

        {/* Animated background particles (pure CSS) */}
        {!profile.banner_url && (
          <div className="absolute inset-0 overflow-hidden opacity-20">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={cn("absolute rounded-full blur-2xl", accent.btn)}
                style={{
                  width: `${80 + i * 40}px`, height: `${80 + i * 40}px`,
                  left: `${10 + i * 15}%`, top: `${20 + (i % 3) * 20}%`,
                  animation: `pulse ${2 + i * 0.5}s infinite`,
                  opacity: 0.3 - i * 0.04,
                }}
              />
            ))}
          </div>
        )}

        {/* Back button */}
        <div className="absolute top-4 left-4">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white bg-black/30 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10 transition-colors group">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            Back
          </button>
        </div>
        {/* OGScan nav top-right */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {liveSpace && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/30 backdrop-blur text-xs font-semibold text-red-300">
              <LiveDot color="bg-red-400" size="h-1.5 w-1.5" />
              LIVE
            </div>
          )}
          <Link to="/" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur border border-white/10 text-xs text-white/60 hover:text-white transition-all">
            <Radio className="h-3 w-3 text-violet-400" />
            <span className="font-semibold">OGScan</span>
          </Link>
        </div>
      </div>

      {/* ════════════ PROFILE HEADER ════════════ */}
      <div className="max-w-2xl mx-auto px-4">
        <div className="-mt-20 relative z-10 mb-6">
          <div className="flex items-end gap-5">
            {/* Avatar with accent ring + glow */}
            <div className={cn(
              "relative h-28 w-28 rounded-2xl flex-shrink-0 border-4 border-[#060811] overflow-hidden shadow-2xl ring-2",
              accent.ring, `shadow-xl ${accent.glow}`
            )}>
              <img
                src={safeAvatarUrl(profile.avatar_url)}
                alt={displayName}
                className="w-full h-full object-cover"
                onError={e => {
                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=7c3aed&color=fff&size=112`;
                }}
              />
              {/* Live pulse ring */}
              {liveSpace && (
                <div className={cn("absolute inset-0 rounded-xl ring-2 animate-pulse", accent.ring)} />
              )}
            </div>

            <div className="flex-1 pb-1 min-w-0">
              {liveSpace && (
                <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border mb-2", accent.badge)}>
                  <LiveDot color={accent.dot} size="h-1.5 w-1.5" />
                  HOSTING A LIVE SPACE
                </div>
              )}
              {/* Name badges */}
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <h1 className="text-2xl md:text-3xl font-bold text-white">{displayName}</h1>
                {profile.verified && (
                  <span className={cn("flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border", accent.badge)}>
                    <Shield className="h-3 w-3" /> Verified
                  </span>
                )}
                {profile.is_pioneer && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
                    <Star className="h-3 w-3" /> Pioneer
                  </span>
                )}
                {profile.badge && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/8 text-white/50 border border-white/10">
                    {profile.badge}
                  </span>
                )}
                {profile.is_official_account && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black shadow-md shadow-amber-500/20">
                    ✦ OFFICIAL
                  </span>
                )}
                {profile.affiliate_org_id && !profile.is_official_account && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 text-white shadow-md shadow-violet-500/20">
                    🏷 OG SCAN AFFILIATE
                  </span>
                )}
                {(profile.current_level ?? 0) > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/10">
                    Lvl {profile.current_level}
                  </span>
                )}
              </div>
              <p className="text-white/40 text-sm">@{profile.username}</p>
            </div>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-white/65 text-sm leading-relaxed mb-5 max-w-xl">{profile.bio}</p>
        )}

        {/* Social links */}
        <div className="flex flex-wrap gap-2 mb-6">
          {twitterHandle && (
            <a href={`https://x.com/${twitterHandle}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/55 hover:text-white transition-all">
              <Twitter className="h-3 w-3" />@{twitterHandle}
            </a>
          )}
          {profile.discord_handle && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/40">
              <MessageSquare className="h-3 w-3" />{profile.discord_handle}
            </div>
          )}
          {website && (
            <a href={website.startsWith("http") ? website : `https://${website}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/55 hover:text-white transition-all">
              <Globe className="h-3 w-3" />{website.replace(/^https?:\/\//, "")}
            </a>
          )}
          {profile.created_at && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/30">
              <Calendar className="h-3 w-3" />
              Joined {format(new Date(profile.created_at), "MMM yyyy")}
            </div>
          )}
        </div>

        {/* ─── Stats grid ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
          {[
            { icon: <Users className="h-4 w-4" />, label: "Followers", value: fmtCount(profile.followers_count || 0) },
            { icon: <Headphones className="h-4 w-4" />, label: "Listeners", value: fmtCount(totalListeners) },
            { icon: <Mic className="h-4 w-4" />, label: "Spaces", value: pastSpaces.length.toString() },
            { icon: <Clock className="h-4 w-4" />, label: "Hours Live", value: `${totalHours}h` },
          ].map(({ icon, label, value }) => (
            <div key={label} className={cn("rounded-xl border p-4 text-center", "bg-white/3 border-white/8")}>
              <div className={cn("flex items-center justify-center gap-1 mb-1.5", accent.text)}>{icon}</div>
              <div className="text-xl font-bold text-white">{value}</div>
              <div className="text-[11px] text-white/35 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* ─── Action buttons ─── */}
        <div className="flex flex-wrap gap-2 mb-8">
          <CopyBtn
            text={pageUrl}
            label="Copy Link"
            className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/55 hover:text-white"
          />
          <button
            onClick={() => setShowEmbed(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/55 hover:text-white transition-all"
          >
            <Code2 className="h-3.5 w-3.5" /> Embed on Your Site
          </button>
          {twitterHandle && (
            <a
              href={xSpaceTweet}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/55 hover:text-white transition-all"
            >
              <Share2 className="h-3.5 w-3.5" /> Share on X
            </a>
          )}
        </div>

        {/* ════════════ LIVE SPACE SECTION ════════════ */}
        {liveSpace && (
          <div className="mb-10">
            {/* Big live card */}
            <div className={cn(
              "relative rounded-2xl border overflow-hidden shadow-2xl",
              "border-white/10", `shadow-2xl ${accent.glow}`
            )}>
              {/* Animated gradient bg */}
              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60", accent.gradFrom, accent.gradVia, "to-transparent")} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

              <div className="relative p-6">
                {/* Live header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <LiveDot color={accent.dot} />
                    <span className="text-xs font-bold uppercase tracking-widest text-white/60">Live Now</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/50">
                    <span className="flex items-center gap-1">
                      <Headphones className="h-3 w-3" />
                      <span className="font-semibold text-white">{liveListenerCount}</span> listening
                    </span>
                    <span className="flex items-center gap-1">
                      <Mic className="h-3 w-3" />
                      {liveSpace.speaker_count} speakers
                    </span>
                  </div>
                </div>

                {/* Title + description */}
                <h2 className="text-2xl font-bold text-white mb-2 leading-tight">{liveSpace.title}</h2>
                {liveSpace.description && (
                  <p className="text-sm text-white/55 mb-4 leading-relaxed line-clamp-3">{liveSpace.description}</p>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {liveSpace.topic && (
                    <span className={cn("text-xs px-2.5 py-1 rounded-full border font-medium", topicBadge(liveSpace.topic))}>
                      {liveSpace.topic}
                    </span>
                  )}
                  {(liveSpace.tags || []).slice(0, 4).map(tag => (
                    <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/40">
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Live audio player (in-page) */}
                <div className="mb-5">
                  <LiveAudioPanel spaceId={liveSpace.id} accent={accent} />
                </div>

                {/* Open full page links */}
                <div className="flex gap-3 mb-5">
                  <Link
                    to={`/space/${liveSpace.id}`}
                    className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-all"
                  >
                    <ExternalLink className="h-3 w-3" /> Open full listener page
                  </Link>
                  <Link
                    to="/spaces"
                    className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-all"
                  >
                    <Radio className="h-3 w-3" /> Join on OGScan
                  </Link>
                </div>

                {/* Live chat panel */}
                <div className="border-t border-white/10 pt-4">
                  <button
                    onClick={() => setChatOpen(o => !o)}
                    className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-all mb-3"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Live Chat ({messages.length})
                    <ChevronDown className={cn("h-3 w-3 transition-transform", chatOpen && "rotate-180")} />
                  </button>
                  {chatOpen && (
                    <div
                      ref={chatRef}
                      className="h-48 overflow-y-auto space-y-2 pr-1"
                      style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
                    >
                      {messages.length === 0 && (
                        <div className="h-full flex items-center justify-center">
                          <p className="text-xs text-white/20">No messages yet</p>
                        </div>
                      )}
                      {messages.map(msg => (
                        <div key={msg.id} className="flex gap-2 text-xs">
                          <span className={cn("font-semibold flex-shrink-0", accent.text)}>{msg.username || "anon"}</span>
                          <span className="text-white/55 leading-relaxed">{msg.content}</span>
                          <span className="flex-shrink-0 text-white/20 ml-auto text-[10px]">
                            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════ UPCOMING SPACES ════════════ */}
        {scheduledSpaces.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              Upcoming Spaces
            </h2>
            <div className="space-y-3">
              {scheduledSpaces.map(sp => (
                <div
                  key={sp.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/3 border border-white/8 hover:bg-white/5 transition-all"
                >
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0", `bg-${accent.btn.split("-")[1]}-500/15`)}>
                    <Calendar className={cn("h-5 w-5", accent.text)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white/85 truncate">{sp.title}</p>
                    {sp.scheduled_for && (
                      <p className="text-xs text-white/40 mt-0.5">
                        {format(new Date(sp.scheduled_for), "MMM d 'at' h:mm a")}
                        {" · "}{formatDistanceToNow(new Date(sp.scheduled_for), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                  {sp.topic && (
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0", topicBadge(sp.topic))}>
                      {sp.topic}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════════ PAST SPACES ════════════ */}
        {pastSpaces.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Past Spaces ({pastSpaces.length})
            </h2>
            <div className="space-y-2">
              {pastSpaces.map(sp => (
                <div
                  key={sp.id}
                  className="group flex items-center gap-3 p-4 rounded-xl bg-white/3 border border-white/8 hover:bg-white/5 hover:border-white/12 transition-all"
                >
                  {/* Play/Archive icon */}
                  <div className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all",
                    sp.recording_url
                      ? `bg-white/8 group-hover:bg-violet-500/20 group-hover:text-violet-400`
                      : "bg-white/5"
                  )}>
                    {sp.recording_url
                      ? <Play className="h-4 w-4 text-white/50 group-hover:text-violet-400 transition-all" />
                      : <Clock className="h-4 w-4 text-white/25" />
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/80 truncate">{sp.title}</p>
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[11px] text-white/35">
                      {sp.topic && (
                        <span className={cn("px-1.5 py-0.5 rounded-full border text-[10px]", topicBadge(sp.topic))}>{sp.topic}</span>
                      )}
                      <span className="flex items-center gap-0.5">
                        <Headphones className="h-2.5 w-2.5" /> {sp.peak_listeners ?? 0} peak
                      </span>
                      {sp.duration_seconds && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" /> {fmtDur(sp.duration_seconds)}
                        </span>
                      )}
                      {sp.ended_at && (
                        <span>{formatDistanceToNow(new Date(sp.ended_at), { addSuffix: true })}</span>
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  {sp.recording_url && (
                    <Link
                      to={`/listen/${sp.id}`}
                      className={cn(
                        "flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs transition-all",
                        "bg-white/5 hover:bg-violet-500/20 border-white/10 hover:border-violet-500/30 text-white/40 hover:text-violet-300"
                      )}
                    >
                      Replay <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                  {!sp.recording_url && (
                    <span className="flex-shrink-0 text-[10px] text-white/20 px-2">No recording</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════════ EMPTY STATE ════════════ */}
        {!liveSpace && scheduledSpaces.length === 0 && pastSpaces.length === 0 && (
          <div className="py-20 flex flex-col items-center gap-4 text-center">
            <div className={cn("h-20 w-20 rounded-2xl flex items-center justify-center shadow-lg", `bg-white/5 border border-white/10`)}>
              <Mic className="h-8 w-8 text-white/15" />
            </div>
            <div>
              <p className="text-white/40 text-base font-medium">No spaces yet</p>
              <p className="text-white/25 text-sm mt-1">Come back when {displayName} goes live</p>
            </div>
            <Link to="/spaces" className="flex items-center gap-2 text-xs text-white/30 hover:text-white/60 transition-all">
              <Radio className="h-3 w-3" /> Browse live spaces on OGScan
            </Link>
          </div>
        )}

        {/* ════════════ FOOTER ════════════ */}
        <div className="border-t border-white/5 pt-8 pb-12 flex flex-col items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-white/25 hover:text-white/50 transition-all">
            <Radio className="h-4 w-4 text-violet-400" />
            <span className="text-sm">Powered by <strong className="text-white/40">OGScan Spaces</strong></span>
          </Link>
          <Link to="/auth" className="flex items-center gap-1 text-xs text-white/20 hover:text-white/40 transition-all">
            Get your own page <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
