/**
 * EmbedCombined — ogscan.fun/embed/combined/:username
 *
 * Full combined embeddable widget. No auth, no chrome.
 * Shows: OG SCAN branded header · OG Spaces widget · Profile widget
 * Designed to be dropped as a single <iframe> on any external website.
 *
 * iframe embed code:
 *   <iframe src="https://ogscan.fun/embed/combined/YOUR_USERNAME"
 *     width="100%" height="800" frameborder="0" allowtransparency="true"
 *     style="border:none;border-radius:16px;overflow:hidden;"></iframe>
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Radio, Headphones, Mic, Loader2, Globe, Twitter,
  MessageSquare, Clock, ExternalLink, Play, Users,
  Calendar, ArrowRight, Bell, Volume2, VolumeX,
  Crown, Wifi,
} from "lucide-react";
import {
  Room, RoomEvent, Track, ConnectionState,
} from "livekit-client";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { safeAvatarUrl, cn } from "@/lib/utils";
import { formatDistanceToNow, format, isPast } from "date-fns";

const LIVEKIT_URL = "wss://new-7unnd5e1.livekit.cloud";
const REACTION_EMOJIS = ["🔥", "❤️", "🚀", "💎", "👏", "⚡"];

/* ─── Types ─────────────────────────────────────────────── */
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
  page_accent: string | null;
  followers_count: number;
}

interface Space {
  id: string;
  title: string;
  topic: string | null;
  description: string | null;
  is_live: boolean;
  listener_count: number;
  ended_at: string | null;
  scheduled_for: string | null;
  peak_listeners: number | null;
  duration_seconds: number | null;
  category: string | null;
}

interface LiveSpeaker {
  identity: string;
  name: string;
  isSpeaking: boolean;
}

interface FloatReaction { id: number; emoji: string; x: number }

/* ─── Accent palette ─────────────────────────────────────── */
const ACCENT: Record<string, {
  gradient: string; glow: string; dot: string; btn: string;
  text: string; subtleBg: string; border: string; ring: string;
  waveColor: string; badge: string; profileGrad: string;
}> = {
  violet:  { gradient: "from-violet-600 to-violet-800",   glow: "shadow-violet-500/40",   dot: "bg-violet-400", btn: "bg-violet-600 hover:bg-violet-500",   text: "text-violet-400",   subtleBg: "bg-violet-500/10",   border: "border-violet-500/30",   ring: "border-violet-500",   waveColor: "139,92,246",  badge: "bg-violet-500/20 text-violet-300 border-violet-500/40", profileGrad: "from-violet-900/60 via-violet-800/30 to-transparent" },
  sky:     { gradient: "from-sky-600 to-sky-800",          glow: "shadow-sky-500/40",       dot: "bg-sky-400",    btn: "bg-sky-600 hover:bg-sky-500",         text: "text-sky-400",       subtleBg: "bg-sky-500/10",       border: "border-sky-500/30",       ring: "border-sky-500",       waveColor: "14,165,233",  badge: "bg-sky-500/20 text-sky-300 border-sky-500/40",     profileGrad: "from-sky-900/60 via-sky-800/30 to-transparent" },
  emerald: { gradient: "from-emerald-600 to-emerald-800", glow: "shadow-emerald-500/40",   dot: "bg-emerald-400",btn: "bg-emerald-600 hover:bg-emerald-500", text: "text-emerald-400",   subtleBg: "bg-emerald-500/10",   border: "border-emerald-500/30",   ring: "border-emerald-500",   waveColor: "16,185,129",  badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", profileGrad: "from-emerald-900/60 via-emerald-800/30 to-transparent" },
  amber:   { gradient: "from-amber-600 to-amber-800",      glow: "shadow-amber-500/40",     dot: "bg-amber-400",  btn: "bg-amber-600 hover:bg-amber-500",     text: "text-amber-400",     subtleBg: "bg-amber-500/10",     border: "border-amber-500/30",     ring: "border-amber-500",     waveColor: "245,158,11",  badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",   profileGrad: "from-amber-900/60 via-amber-800/30 to-transparent" },
  rose:    { gradient: "from-rose-600 to-rose-800",        glow: "shadow-rose-500/40",      dot: "bg-rose-400",   btn: "bg-rose-600 hover:bg-rose-500",       text: "text-rose-400",      subtleBg: "bg-rose-500/10",      border: "border-rose-500/30",      ring: "border-rose-500",      waveColor: "244,63,94",   badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",    profileGrad: "from-rose-900/60 via-rose-800/30 to-transparent" },
  cyan:    { gradient: "from-cyan-600 to-cyan-800",        glow: "shadow-cyan-500/40",      dot: "bg-cyan-400",   btn: "bg-cyan-600 hover:bg-cyan-500",       text: "text-cyan-400",      subtleBg: "bg-cyan-500/10",      border: "border-cyan-500/30",      ring: "border-cyan-500",      waveColor: "6,182,212",   badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",    profileGrad: "from-cyan-900/60 via-cyan-800/30 to-transparent" },
  pink:    { gradient: "from-pink-600 to-pink-800",        glow: "shadow-pink-500/40",      dot: "bg-pink-400",   btn: "bg-pink-600 hover:bg-pink-500",       text: "text-pink-400",      subtleBg: "bg-pink-500/10",      border: "border-pink-500/30",      ring: "border-pink-500",      waveColor: "236,72,153",  badge: "bg-pink-500/20 text-pink-300 border-pink-500/40",    profileGrad: "from-pink-900/60 via-pink-800/30 to-transparent" },
  indigo:  { gradient: "from-indigo-600 to-indigo-800",   glow: "shadow-indigo-500/40",    dot: "bg-indigo-400", btn: "bg-indigo-600 hover:bg-indigo-500",   text: "text-indigo-400",    subtleBg: "bg-indigo-500/10",    border: "border-indigo-500/30",    ring: "border-indigo-500",    waveColor: "99,102,241",  badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40", profileGrad: "from-indigo-900/60 via-indigo-800/30 to-transparent" },
};
const getA = (k: string | null | undefined) => ACCENT[k ?? "violet"] ?? ACCENT.violet;

function LiveDot({ color = "bg-red-400" }: { color?: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
      <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", color)} />
      <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", color)} />
    </span>
  );
}

function formatDuration(s: number | null | undefined): string {
  if (!s) return "";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Countdown({ target }: { target: string }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const update = () => {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) { setLabel("Starting soon"); return; }
      const h = Math.floor(diff / 3.6e6), m = Math.floor((diff % 3.6e6) / 6e4), s = Math.floor((diff % 6e4) / 1e3);
      setLabel(h > 0 ? `in ${h}h ${m}m` : m > 0 ? `in ${m}m ${s}s` : `in ${s}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [target]);
  return <span>{label}</span>;
}

function LiveWaveform({ active, color }: { active: boolean; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const bars = 24;
    const draw = () => {
      frameRef.current++;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const barW = w / bars;
      for (let i = 0; i < bars; i++) {
        const t = frameRef.current * 0.05 + i * 0.35;
        const amp = active ? Math.abs(Math.sin(t + i * 0.6)) * 0.85 + 0.15 : 0.08;
        const barH = amp * h * 0.9;
        const x = i * barW + 1;
        const y = (h - barH) / 2;
        const alpha = active ? 0.4 + amp * 0.6 : 0.12;
        ctx.fillStyle = `rgba(${color}, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x, y, Math.max(barW - 2, 1), barH, 2);
        ctx.fill();
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [active, color]);

  return <canvas ref={canvasRef} width={280} height={28} className="w-full h-7 block opacity-80" />;
}

/* ─── OG SCAN Banner logo ─────────────────────────────────── */
function OGScanBanner() {
  return (
    <div className="flex flex-col items-center justify-center py-5 px-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0a0c1a 0%, #0d0f20 50%, #0a0c1a 100%)" }}>
      {/* Grid bg */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: "linear-gradient(rgba(139,92,246,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,.8) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
      <div className="relative z-10 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          {/* OG icon */}
          <div className="h-7 w-7 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #7c3aed, #06b6d4)" }}>
            <Radio className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tight"
            style={{ background: "linear-gradient(90deg, #a78bfa 0%, #06b6d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            OG SCAN EMBEDDED
          </h1>
        </div>
        <p className="text-[11px] text-white/30 tracking-wide">The Ultimate Solana Alpha &amp; Trading Platform</p>
      </div>
    </div>
  );
}

/* ─── Section header ─────────────────────────────────────── */
function SectionHeader({ icon, label, accent }: { icon: React.ReactNode; label: string; accent: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]"
      style={{ background: "rgba(255,255,255,0.02)" }}>
      <span className={cn("text-sm", accent)}>{icon}</span>
      <span className={cn("text-xs font-black uppercase tracking-widest", accent)}>{label}</span>
    </div>
  );
}

/* ─── Component ─────────────────────────────────────────── */
export default function EmbedCombined() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [liveSpace, setLiveSpace] = useState<Space | null>(null);
  const [upcoming, setUpcoming] = useState<Space[]>([]);
  const [lastSpace, setLastSpace] = useState<Space | null>(null);
  const [pastSpaces, setPastSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);

  // LiveKit state
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [liveSpeakers, setLiveSpeakers] = useState<LiveSpeaker[]>([]);
  const [floatReactions, setFloatReactions] = useState<FloatReaction[]>([]);
  const roomRef = useRef<Room | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const reactionCounter = useRef(0);

  const load = useCallback(async () => {
    if (!username) return;
    const { data: p } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, banner_url, bio, twitter_handle, discord_handle, website_url, page_accent, followers_count")
      .eq("username", username)
      .single();
    if (!p) { setLoading(false); return; }
    setProfile(p as Profile);

    const [{ data: live }, { data: upcom }, { data: last }, { data: past }] = await Promise.all([
      supabase.from("spaces").select("id, title, topic, description, is_live, listener_count, ended_at, scheduled_for, peak_listeners, duration_seconds, category").eq("host_id", p.user_id).eq("is_live", true).limit(1).maybeSingle(),
      supabase.from("spaces").select("id, title, topic, description, is_live, listener_count, ended_at, scheduled_for, peak_listeners, duration_seconds, category").eq("host_id", p.user_id).eq("is_live", false).is("ended_at", null).not("scheduled_for", "is", null).gt("scheduled_for", new Date().toISOString()).order("scheduled_for", { ascending: true }).limit(3),
      supabase.from("spaces").select("id, title, topic, description, is_live, listener_count, ended_at, scheduled_for, peak_listeners, duration_seconds, category").eq("host_id", p.user_id).eq("is_live", false).not("ended_at", "is", null).order("ended_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("spaces").select("id, title, topic, description, is_live, listener_count, ended_at, scheduled_for, peak_listeners, duration_seconds, category").eq("host_id", p.user_id).eq("is_live", false).not("ended_at", "is", null).order("ended_at", { ascending: false }).limit(5),
    ]);
    setLiveSpace(live as Space || null);
    setUpcoming((upcom as Space[]) || []);
    setLastSpace(last as Space || null);
    setPastSpaces((past as Space[]) || []);
    setLoading(false);
  }, [username]);

  useEffect(() => { load(); }, [load]);

  /* Realtime space updates */
  useEffect(() => {
    if (!profile) return;
    const ch = supabase
      .channel(`embed-combined-${profile.user_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "spaces", filter: `host_id=eq.${profile.user_id}` }, payload => {
        const sp = payload.new as Space;
        if (sp.is_live) {
          setLiveSpace(sp);
          setUpcoming(prev => prev.filter(u => u.id !== sp.id));
        } else {
          if (liveSpace?.id === sp.id) {
            setLiveSpace(null);
            if (roomRef.current) { roomRef.current.disconnect(); roomRef.current = null; setConnected(false); setLiveSpeakers([]); }
          }
          if (sp.ended_at) {
            setLastSpace(sp);
            setPastSpaces(prev => [sp, ...prev.filter(s => s.id !== sp.id)].slice(0, 5));
            setUpcoming(prev => prev.filter(u => u.id !== sp.id));
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.user_id, liveSpace?.id]);

  /* Realtime listener count */
  useEffect(() => {
    if (!liveSpace) return;
    const ch = supabase
      .channel(`embed-combined-lc-${liveSpace.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "spaces", filter: `id=eq.${liveSpace.id}` }, p => {
        setLiveSpace(prev => prev ? { ...prev, listener_count: (p.new as Space).listener_count } : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [liveSpace?.id]);

  /* LiveKit */
  const connectLiveKit = useCallback(async () => {
    if (!liveSpace || connecting || connected) return;
    setConnecting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/public-listener-token?space_id=${liveSpace.id}`, { headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Token error");
      const { token } = await res.json();
      const room = new Room({ adaptiveStream: true, dynacast: true });
      const updateSpeakers = () => {
        const active = new Set(room.activeSpeakers.map(s => s.identity));
        const list: LiveSpeaker[] = [];
        room.remoteParticipants.forEach(p => { list.push({ identity: p.identity, name: p.name || p.identity.slice(0, 8), isSpeaking: active.has(p.identity) }); });
        setLiveSpeakers(list);
      };
      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = new Audio(); el.srcObject = new MediaStream([track.mediaStreamTrack]); el.volume = muted ? 0 : volume; el.play().catch(() => {}); audioRefs.current.set(participant.sid, el);
        }
        updateSpeakers();
      });
      room.on(RoomEvent.TrackUnsubscribed, (_t, _p, participant) => { const el = audioRefs.current.get(participant.sid); if (el) { el.pause(); el.srcObject = null; audioRefs.current.delete(participant.sid); } updateSpeakers(); });
      room.on(RoomEvent.ActiveSpeakersChanged, updateSpeakers);
      room.on(RoomEvent.ParticipantConnected, updateSpeakers);
      room.on(RoomEvent.ParticipantDisconnected, updateSpeakers);
      room.on(RoomEvent.Disconnected, () => { setConnected(false); setLiveSpeakers([]); });
      room.on(RoomEvent.ConnectionStateChanged, s => { if (s === ConnectionState.Connected) { setConnected(true); setConnecting(false); updateSpeakers(); } });
      await room.connect(LIVEKIT_URL, token);
      roomRef.current = room;
    } catch { setConnecting(false); }
  }, [liveSpace, connecting, connected, volume, muted]);

  const disconnectLiveKit = useCallback(() => {
    if (roomRef.current) { roomRef.current.disconnect(); roomRef.current = null; }
    audioRefs.current.forEach(el => { el.pause(); el.srcObject = null; });
    audioRefs.current.clear();
    setConnected(false); setLiveSpeakers([]);
  }, []);

  const toggleMute = () => { const next = !muted; setMuted(next); audioRefs.current.forEach(el => { el.volume = next ? 0 : volume; }); };
  const applyVolume = (v: number) => { setVolume(v); audioRefs.current.forEach(el => { el.volume = muted ? 0 : v; }); };
  const sendReaction = (emoji: string) => {
    reactionCounter.current++;
    const id = reactionCounter.current;
    setFloatReactions(prev => [...prev, { id, emoji, x: 10 + Math.random() * 80 }]);
    setTimeout(() => setFloatReactions(prev => prev.filter(r => r.id !== id)), 2800);
  };
  useEffect(() => () => { roomRef.current?.disconnect(); }, []);

  const a = getA(profile?.page_accent);
  const displayName = profile?.display_name || profile?.username || username || "Host";
  const profileUrl = `https://ogscan.fun/u/${username}`;

  return (
    <div className="w-full bg-[#07090f] font-sans text-white" style={{ fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #07090f; overflow-x: hidden; }
        a { text-decoration: none; color: inherit; }
        @keyframes ping { 75%,100% { transform:scale(2); opacity:0; } }
        .animate-ping { animation: ping 1s cubic-bezier(0,0,.2,1) infinite; }
        @keyframes breathe { 0%,100% { opacity:.8; } 50% { opacity:1; } }
        .breathe { animation: breathe 2s ease-in-out infinite; }
        @keyframes floatUp { 0% { opacity:1; transform:translateY(0) scale(1); } 60% { opacity:.8; transform:translateY(-45px) scale(1.25); } 100% { opacity:0; transform:translateY(-100px) scale(.6); } }
        .float-reaction { animation: floatUp 2.6s ease-out forwards; position:absolute; pointer-events:none; font-size:1.25rem; }
        @keyframes slideIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .slide-in { animation: slideIn .25s ease-out; }
        @keyframes pulse-ring { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.5; transform:scale(1.05); } }
        .live-ring { animation: pulse-ring 2s ease-in-out infinite; }
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius:2px; }
      `}</style>

      {/* ── OG SCAN Banner Header ─────────────────────── */}
      <OGScanBanner />

      {loading ? (
        <div className="w-full flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      ) : !profile ? (
        <div className="w-full flex items-center justify-center py-16 px-6">
          <div className="text-center">
            <Radio className="h-10 w-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">@{username} not found on OGScan</p>
          </div>
        </div>
      ) : (
        <>
          {/* ══════════ OG SPACES SECTION ══════════ */}
          <div className="border-b border-white/[0.05]">
            <SectionHeader
              icon={<Radio className="h-3.5 w-3.5 inline" />}
              label="OG SPACES"
              accent={a.text}
            />

            {/* Floating reactions */}
            <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
              {floatReactions.map(r => (
                <div key={r.id} className="float-reaction" style={{ left: `${r.x}%`, bottom: "80px" }}>{r.emoji}</div>
              ))}
            </div>

            {liveSpace ? (
              /* LIVE spaces */
              <div className="relative overflow-hidden">
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-10", a.gradient)} />
                <div className="relative p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                      <div className="h-11 w-11 rounded-full overflow-hidden border-2 border-white/10">
                        <img src={safeAvatarUrl(profile.avatar_url)} alt={displayName} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=111827&color=888&size=44`; }} />
                      </div>
                      <div className={cn("absolute -inset-1 rounded-full border-2 breathe", a.ring)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{displayName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <LiveDot color={a.dot} />
                        <span className={cn("text-[10px] font-black uppercase tracking-widest", a.text)}>Live Now</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-white/40 text-[11px]">
                      <Headphones className="h-3 w-3" />
                      <span className="font-bold text-white/60">{liveSpace.listener_count}</span>
                    </div>
                  </div>
                  <h2 className="text-base font-black text-white mb-1 leading-snug">{liveSpace.title}</h2>
                  {liveSpace.topic && <p className={cn("text-[11px] mb-3", a.text)}>{liveSpace.topic}</p>}
                  <div className="mb-3"><LiveWaveform active={connected} color={a.waveColor} /></div>
                  {connected && liveSpeakers.length > 0 && (
                    <div className="mb-3 slide-in">
                      <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1.5 font-semibold">Speakers</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {liveSpeakers.slice(0, 6).map(s => (
                          <div key={s.identity} className={cn("h-6 w-6 rounded-full border flex items-center justify-center text-[9px] font-bold transition-all", s.isSpeaking ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/5 text-white/30")}>
                            {(s.name[0] || "?").toUpperCase()}
                          </div>
                        ))}
                        {liveSpeakers.length > 6 && <span className="text-[9px] text-white/25">+{liveSpeakers.length - 6}</span>}
                      </div>
                    </div>
                  )}
                  {!connected ? (
                    <button onClick={connectLiveKit} disabled={connecting} className={cn("w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-lg mb-2", a.btn, a.glow)}>
                      {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Headphones className="h-4 w-4" />}
                      {connecting ? "Connecting…" : "Listen Live"}
                    </button>
                  ) : (
                    <div className="mb-2 space-y-2 slide-in">
                      <div className="flex items-center gap-2">
                        <button onClick={toggleMute} className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] transition-all">
                          {muted ? <VolumeX className="h-3.5 w-3.5 text-white/40" /> : <Volume2 className="h-3.5 w-3.5 text-white/70" />}
                        </button>
                        <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={e => applyVolume(parseFloat(e.target.value))} className="flex-1 h-1 cursor-pointer" style={{ accentColor: `rgb(${a.waveColor})` }} />
                        <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />Live
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-1 flex-1">
                          {REACTION_EMOJIS.map(e => <button key={e} onClick={() => sendReaction(e)} className="text-base hover:scale-125 transition-transform select-none">{e}</button>)}
                        </div>
                        <button onClick={disconnectLiveKit} className="text-[9px] text-white/25 hover:text-white/50 transition-colors px-2 py-1 rounded-lg border border-white/[0.06]">Leave</button>
                      </div>
                    </div>
                  )}
                  <a href={`https://ogscan.fun/space/${liveSpace.id}`} target="_blank" rel="noopener noreferrer">
                    <button className="w-full flex items-center justify-center gap-1 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-[10px] text-white/35 hover:text-white/60 transition-all">Open Full Space ↗</button>
                  </a>
                </div>
              </div>
            ) : (
              /* OFFLINE spaces */
              <div className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full overflow-hidden border border-white/10">
                    <img src={safeAvatarUrl(profile.avatar_url)} alt={displayName} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=111827&color=888&size=40`; }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{displayName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-white/15" />
                      <p className="text-[10px] text-white/35">Not live right now</p>
                    </div>
                  </div>
                </div>
                {upcoming.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Calendar className="h-3 w-3 text-white/25" />
                      <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">Upcoming</p>
                    </div>
                    <div className="space-y-2">
                      {upcoming.map(sp => (
                        <a key={sp.id} href={`https://ogscan.fun/u/${username}`} target="_blank" rel="noopener noreferrer" className={cn("block rounded-xl border p-3 hover:opacity-90 transition-all", a.subtleBg, a.border)}>
                          <p className="text-xs font-semibold text-white/80 line-clamp-1">{sp.title}</p>
                          {sp.topic && <p className={cn("text-[10px] mt-0.5", a.text)}>{sp.topic}</p>}
                          {sp.scheduled_for && (
                            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-white/35">
                              <Bell className="h-2.5 w-2.5" />
                              <span className={cn("font-semibold", a.text)}><Countdown target={sp.scheduled_for} /></span>
                              <span>·</span>
                              <span>{format(new Date(sp.scheduled_for), "MMM d, h:mm a")}</span>
                            </div>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {lastSpace && upcoming.length === 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock className="h-3 w-3 text-white/25" />
                      <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">Last Space</p>
                    </div>
                    <a href={`https://ogscan.fun/listen/${lastSpace.id}`} target="_blank" rel="noopener noreferrer">
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 hover:bg-white/[0.06] transition-all cursor-pointer group">
                        <p className="text-xs font-semibold text-white/65 group-hover:text-white/85 line-clamp-1">{lastSpace.title}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/25">
                          {lastSpace.ended_at && <span>{formatDistanceToNow(new Date(lastSpace.ended_at), { addSuffix: true })}</span>}
                          {lastSpace.peak_listeners && <><span>·</span><span>{lastSpace.peak_listeners} peak</span></>}
                          {lastSpace.duration_seconds && <><span>·</span><span>{formatDuration(lastSpace.duration_seconds)}</span></>}
                        </div>
                      </div>
                    </a>
                  </div>
                )}
                {!lastSpace && upcoming.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-5">
                    <Mic className="h-7 w-7 text-white/8" />
                    <p className="text-[11px] text-white/20 text-center">No spaces yet</p>
                  </div>
                )}
                <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                  <div className={cn("flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all cursor-pointer group mt-2")}>
                    <div className="flex items-center gap-2">
                      <Radio className={cn("h-3 w-3", a.text)} />
                      <span className="text-[10px] text-white/35 group-hover:text-white/60">@{profile.username} on OGScan</span>
                    </div>
                    <ArrowRight className="h-3 w-3 text-white/15 group-hover:text-white/40" />
                  </div>
                </a>
              </div>
            )}
          </div>

          {/* ══════════ PROFILE SECTION ══════════ */}
          <div>
            <SectionHeader
              icon={<Users className="h-3.5 w-3.5 inline" />}
              label="PROFILE"
              accent="text-sky-400"
            />

            {/* Banner */}
            <div className="relative h-24 overflow-hidden">
              {profile.banner_url ? (
                <img src={profile.banner_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className={cn("w-full h-full bg-gradient-to-br", a.profileGrad, "bg-[#0d1021]")} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#07090f] via-[#07090f]/10 to-transparent" />
              {liveSpace && (
                <div className="absolute top-2.5 right-3 flex items-center gap-1 bg-red-500/90 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                  <LiveDot color="bg-white" />LIVE
                </div>
              )}
            </div>

            <div className="px-4 pb-4">
              {/* Avatar */}
              <div className="relative -mt-8 mb-3 flex items-end justify-between">
                <div className="relative">
                  <div className={cn("h-14 w-14 rounded-full overflow-hidden border-2 border-[#07090f]", liveSpace ? "live-ring" : "")}>
                    <img src={safeAvatarUrl(profile.avatar_url)} alt={displayName} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=111827&color=888&size=56`; }} />
                  </div>
                  {liveSpace && <div className={cn("absolute -inset-1 rounded-full border-2 live-ring", a.ring)} />}
                </div>
                <div className="flex items-center gap-1 text-white/30 text-xs">
                  <Users className="h-3 w-3" />
                  <span>{profile.followers_count ?? 0} followers</span>
                </div>
              </div>

              <h1 className="text-base font-bold text-white leading-tight">{displayName}</h1>
              <p className="text-xs text-white/35 mt-0.5 mb-2">@{profile.username}</p>
              {profile.bio && <p className="text-xs text-white/50 leading-relaxed mb-3 line-clamp-3">{profile.bio}</p>}

              {(profile.twitter_handle || profile.discord_handle || profile.website_url) && (
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  {profile.twitter_handle && (
                    <a href={`https://x.com/${profile.twitter_handle}`} target="_blank" rel="noopener noreferrer" className={cn("flex items-center gap-1 text-[11px]", a.text)}>
                      <Twitter className="h-3 w-3" />@{profile.twitter_handle}
                    </a>
                  )}
                  {profile.discord_handle && (
                    <span className="flex items-center gap-1 text-[11px] text-white/35">
                      <MessageSquare className="h-3 w-3" />{profile.discord_handle}
                    </span>
                  )}
                  {profile.website_url && (
                    <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-white/35 hover:text-white/60">
                      <Globe className="h-3 w-3" />{profile.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  )}
                </div>
              )}

              {/* Past spaces preview */}
              {pastSpaces.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock className="h-3 w-3 text-white/25" />
                    <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">Past Spaces</p>
                  </div>
                  <div className="space-y-1.5">
                    {pastSpaces.slice(0, 3).map(sp => (
                      <a key={sp.id} href={`https://ogscan.fun/listen/${sp.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all group">
                        <p className="text-xs text-white/65 group-hover:text-white/85 line-clamp-1 flex-1">{sp.title}</p>
                        <div className="flex items-center gap-1.5 text-[9px] text-white/20 flex-shrink-0">
                          {sp.ended_at && <span>{formatDistanceToNow(new Date(sp.ended_at), { addSuffix: true })}</span>}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                <div className={cn("flex items-center justify-between px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] transition-all cursor-pointer group")}>
                  <div className="flex items-center gap-2">
                    <Radio className={cn("h-3.5 w-3.5", a.text)} />
                    <span className="text-xs text-white/40 group-hover:text-white/70">Follow @{profile.username} on OGScan</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-white/20 group-hover:text-white/50 group-hover:translate-x-0.5 transition-all" />
                </div>
              </a>
            </div>
          </div>

          {/* ── Footer ─────────────────────────────────── */}
          <div className="px-4 py-3 border-t border-white/[0.05] flex items-center justify-center gap-1.5">
            <Radio className="h-2 w-2 text-violet-400/40" />
            <a href="https://ogscan.fun" target="_blank" rel="noopener noreferrer" className="text-[9px] text-white/15 hover:text-violet-400/60 transition-colors tracking-wider">
              Powered by <span className="text-violet-400/50">OG SCAN</span> · Built for Solana Traders
            </a>
          </div>
        </>
      )}
    </div>
  );
}
