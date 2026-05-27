/**
 * EmbedSpaces — ogscan.fun/embed/spaces/:username
 *
 * Advanced spaces widget. No auth, no chrome.
 * Designed for embedding on a user's personal website.
 *
 * LIVE:     Pulsing hero · inline LiveKit listen button · animated waveform
 *           speaker roster · live reactions · listener count
 * UPCOMING: Next scheduled space(s) with live countdown
 * OFFLINE:  Last space replay · "Not live" state · Follow CTA
 *
 * Realtime: Supabase subscriptions — auto-switches states instantly.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Radio, Headphones, Mic, Loader2, Play, Calendar,
  Clock, Users, ArrowRight, Bell, Volume2, VolumeX,
  Crown, Wifi,
} from "lucide-react";
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
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
  page_accent: string | null;
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
  waveColor: string;
}> = {
  violet:  { gradient: "from-violet-600 to-violet-800",   glow: "shadow-violet-500/40",   dot: "bg-violet-400", btn: "bg-violet-600 hover:bg-violet-500",   text: "text-violet-400",   subtleBg: "bg-violet-500/10",   border: "border-violet-500/30",   ring: "border-violet-500",   waveColor: "139,92,246" },
  sky:     { gradient: "from-sky-600 to-sky-800",          glow: "shadow-sky-500/40",       dot: "bg-sky-400",    btn: "bg-sky-600 hover:bg-sky-500",         text: "text-sky-400",       subtleBg: "bg-sky-500/10",       border: "border-sky-500/30",       ring: "border-sky-500",       waveColor: "14,165,233" },
  emerald: { gradient: "from-emerald-600 to-emerald-800", glow: "shadow-emerald-500/40",   dot: "bg-emerald-400",btn: "bg-emerald-600 hover:bg-emerald-500", text: "text-emerald-400",   subtleBg: "bg-emerald-500/10",   border: "border-emerald-500/30",   ring: "border-emerald-500",   waveColor: "16,185,129" },
  amber:   { gradient: "from-amber-600 to-amber-800",      glow: "shadow-amber-500/40",     dot: "bg-amber-400",  btn: "bg-amber-600 hover:bg-amber-500",     text: "text-amber-400",     subtleBg: "bg-amber-500/10",     border: "border-amber-500/30",     ring: "border-amber-500",     waveColor: "245,158,11" },
  rose:    { gradient: "from-rose-600 to-rose-800",        glow: "shadow-rose-500/40",      dot: "bg-rose-400",   btn: "bg-rose-600 hover:bg-rose-500",       text: "text-rose-400",      subtleBg: "bg-rose-500/10",      border: "border-rose-500/30",      ring: "border-rose-500",      waveColor: "244,63,94" },
  cyan:    { gradient: "from-cyan-600 to-cyan-800",        glow: "shadow-cyan-500/40",      dot: "bg-cyan-400",   btn: "bg-cyan-600 hover:bg-cyan-500",       text: "text-cyan-400",      subtleBg: "bg-cyan-500/10",      border: "border-cyan-500/30",      ring: "border-cyan-500",      waveColor: "6,182,212" },
  pink:    { gradient: "from-pink-600 to-pink-800",        glow: "shadow-pink-500/40",      dot: "bg-pink-400",   btn: "bg-pink-600 hover:bg-pink-500",       text: "text-pink-400",      subtleBg: "bg-pink-500/10",      border: "border-pink-500/30",      ring: "border-pink-500",      waveColor: "236,72,153" },
  indigo:  { gradient: "from-indigo-600 to-indigo-800",   glow: "shadow-indigo-500/40",    dot: "bg-indigo-400", btn: "bg-indigo-600 hover:bg-indigo-500",   text: "text-indigo-400",    subtleBg: "bg-indigo-500/10",    border: "border-indigo-500/30",    ring: "border-indigo-500",    waveColor: "99,102,241" },
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

// Animated waveform canvas
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

/* ─── Component ─────────────────────────────────────────── */
export default function EmbedSpaces() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [liveSpace, setLiveSpace] = useState<Space | null>(null);
  const [upcoming, setUpcoming] = useState<Space[]>([]);
  const [lastSpace, setLastSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);

  // LiveKit listening state
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
      .select("user_id, username, display_name, avatar_url, page_accent")
      .eq("username", username)
      .single();
    if (!p) { setLoading(false); return; }
    setProfile(p as Profile);

    const { data: live } = await supabase
      .from("spaces")
      .select("id, title, topic, description, is_live, listener_count, ended_at, scheduled_for, peak_listeners, duration_seconds, category")
      .eq("host_id", p.user_id).eq("is_live", true).limit(1).maybeSingle();
    setLiveSpace(live as Space || null);

    const { data: upcom } = await supabase
      .from("spaces")
      .select("id, title, topic, description, is_live, listener_count, ended_at, scheduled_for, peak_listeners, duration_seconds, category")
      .eq("host_id", p.user_id).eq("is_live", false).is("ended_at", null)
      .not("scheduled_for", "is", null).gt("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true }).limit(3);
    setUpcoming((upcom as Space[]) || []);

    const { data: last } = await supabase
      .from("spaces")
      .select("id, title, topic, description, is_live, listener_count, ended_at, scheduled_for, peak_listeners, duration_seconds, category")
      .eq("host_id", p.user_id).eq("is_live", false).not("ended_at", "is", null)
      .order("ended_at", { ascending: false }).limit(1).maybeSingle();
    setLastSpace(last as Space || null);
    setLoading(false);
  }, [username]);

  useEffect(() => { load(); }, [load]);

  /* Realtime space updates */
  useEffect(() => {
    if (!profile) return;
    const ch = supabase
      .channel(`embed-spaces-${profile.user_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "spaces", filter: `host_id=eq.${profile.user_id}` }, payload => {
        const sp = payload.new as Space;
        if (sp.is_live) {
          setLiveSpace(sp);
          setUpcoming(prev => prev.filter(u => u.id !== sp.id));
        } else {
          if (liveSpace?.id === sp.id) {
            setLiveSpace(null);
            // Disconnect LiveKit if we're connected
            if (roomRef.current) {
              roomRef.current.disconnect();
              roomRef.current = null;
              setConnected(false);
              setLiveSpeakers([]);
            }
          }
          if (sp.ended_at) {
            setLastSpace(sp);
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
      .channel(`embed-spaces-lc-${liveSpace.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "spaces", filter: `id=eq.${liveSpace.id}` }, p => {
        setLiveSpace(prev => prev ? { ...prev, listener_count: (p.new as Space).listener_count } : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [liveSpace?.id]);

  /* ── LiveKit inline listen ── */
  const connectLiveKit = useCallback(async () => {
    if (!liveSpace || connecting || connected) return;
    setConnecting(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/public-listener-token?space_id=${liveSpace.id}`,
        { headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" } }
      );
      if (!res.ok) throw new Error("Token error");
      const { token } = await res.json();

      const room = new Room({ adaptiveStream: true, dynacast: true });

      const updateSpeakers = () => {
        const activeSpeakers = new Set(room.activeSpeakers.map(s => s.identity));
        const list: LiveSpeaker[] = [];
        room.remoteParticipants.forEach(p => {
          list.push({ identity: p.identity, name: p.name || p.identity.slice(0, 8), isSpeaking: activeSpeakers.has(p.identity) });
        });
        setLiveSpeakers(list);
      };

      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = new Audio();
          el.srcObject = new MediaStream([track.mediaStreamTrack]);
          el.volume = muted ? 0 : volume;
          el.play().catch(() => {});
          audioRefs.current.set(participant.sid, el);
        }
        updateSpeakers();
      });
      room.on(RoomEvent.TrackUnsubscribed, (_t, _p, participant) => {
        const el = audioRefs.current.get(participant.sid);
        if (el) { el.pause(); el.srcObject = null; audioRefs.current.delete(participant.sid); }
        updateSpeakers();
      });
      room.on(RoomEvent.ActiveSpeakersChanged, updateSpeakers);
      room.on(RoomEvent.ParticipantConnected, updateSpeakers);
      room.on(RoomEvent.ParticipantDisconnected, updateSpeakers);
      room.on(RoomEvent.Disconnected, () => { setConnected(false); setLiveSpeakers([]); });
      room.on(RoomEvent.ConnectionStateChanged, s => {
        if (s === ConnectionState.Connected) { setConnected(true); setConnecting(false); updateSpeakers(); }
      });

      await room.connect(LIVEKIT_URL, token);
      roomRef.current = room;
    } catch {
      setConnecting(false);
    }
  }, [liveSpace, connecting, connected, volume, muted]);

  const disconnectLiveKit = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    audioRefs.current.forEach(el => { el.pause(); el.srcObject = null; });
    audioRefs.current.clear();
    setConnected(false);
    setLiveSpeakers([]);
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    audioRefs.current.forEach(el => { el.volume = next ? 0 : volume; });
  };

  const applyVolume = (v: number) => {
    setVolume(v);
    audioRefs.current.forEach(el => { el.volume = muted ? 0 : v; });
  };

  /* ── Reactions ── */
  const sendReaction = (emoji: string) => {
    reactionCounter.current++;
    const id = reactionCounter.current;
    setFloatReactions(prev => [...prev, { id, emoji, x: 10 + Math.random() * 80 }]);
    setTimeout(() => setFloatReactions(prev => prev.filter(r => r.id !== id)), 2800);
  };

  /* Cleanup on unmount */
  useEffect(() => () => { roomRef.current?.disconnect(); }, []);

  const a = getA(profile?.page_accent);
  const displayName = profile?.display_name || profile?.username || username || "Host";
  const profileUrl = `https://ogscan.fun/u/${username}`;

  if (loading) {
    return (
      <div className="w-full min-h-[200px] bg-[#07090f] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="w-full min-h-[200px] bg-[#07090f] flex items-center justify-center p-6">
        <p className="text-white/25 text-sm text-center">@{username} not found</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#07090f] font-sans text-white overflow-hidden relative" style={{ fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07090f; overflow-x: hidden; }
        a { text-decoration: none; color: inherit; }
        @keyframes ping { 75%,100% { transform:scale(2); opacity:0; } }
        .animate-ping { animation: ping 1s cubic-bezier(0,0,.2,1) infinite; }
        @keyframes breathe { 0%,100% { opacity:.8; } 50% { opacity:1; } }
        .breathe { animation: breathe 2s ease-in-out infinite; }
        @keyframes floatUp { 0% { opacity:1; transform:translateY(0) scale(1); } 60% { opacity:.8; transform:translateY(-45px) scale(1.25); } 100% { opacity:0; transform:translateY(-100px) scale(.6); } }
        .float-reaction { animation: floatUp 2.6s ease-out forwards; position:absolute; pointer-events:none; font-size:1.25rem; }
        @keyframes slideIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .slide-in { animation: slideIn .25s ease-out; }
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius:2px; }
      `}</style>

      {/* ── Floating reactions ── */}
      <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
        {floatReactions.map(r => (
          <div key={r.id} className="float-reaction" style={{ left: `${r.x}%`, bottom: "80px" }}>
            {r.emoji}
          </div>
        ))}
      </div>

      {/* ════ LIVE STATE ════════════════════════════════════ */}
      {liveSpace ? (
        <div className="relative overflow-hidden">
          {/* Gradient background */}
          <div className={cn("absolute inset-0 bg-gradient-to-br opacity-15", a.gradient)} />

          <div className="relative p-4">
            {/* Host row */}
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <div className="h-11 w-11 rounded-full overflow-hidden border-2 border-white/10">
                  <img
                    src={safeAvatarUrl(profile.avatar_url)}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=111827&color=888&size=44`; }}
                  />
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
              <div className="flex items-center gap-1 text-white/40 text-[11px] flex-shrink-0">
                <Headphones className="h-3 w-3" />
                <span className="font-bold text-white/60">{liveSpace.listener_count}</span>
              </div>
            </div>

            {/* Space title */}
            <div className="mb-3">
              <h2 className="text-base font-black text-white leading-snug">{liveSpace.title}</h2>
              {liveSpace.topic && (
                <p className={cn("text-[11px] mt-0.5", a.text)}>{liveSpace.topic}</p>
              )}
            </div>

            {/* Waveform */}
            <div className="mb-3">
              <LiveWaveform active={connected} color={a.waveColor} />
            </div>

            {/* Live speakers (when connected) */}
            {connected && liveSpeakers.length > 0 && (
              <div className="mb-3 slide-in">
                <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1.5 font-semibold">Speakers</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {liveSpeakers.slice(0, 6).map(s => (
                    <div key={s.identity} className="flex flex-col items-center gap-0.5">
                      <div className={cn(
                        "h-6 w-6 rounded-full border flex items-center justify-center text-[9px] font-bold transition-all",
                        s.isSpeaking
                          ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-300 shadow-[0_0_6px_rgba(52,211,153,.25)]"
                          : "border-white/10 bg-white/5 text-white/30"
                      )}>
                        {(s.name[0] || "?").toUpperCase()}
                      </div>
                    </div>
                  ))}
                  {liveSpeakers.length > 6 && (
                    <span className="text-[9px] text-white/25">+{liveSpeakers.length - 6}</span>
                  )}
                </div>
              </div>
            )}

            {/* Listen controls */}
            {!connected ? (
              <button
                onClick={connectLiveKit}
                disabled={connecting}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-lg mb-2",
                  a.btn, a.glow
                )}
              >
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Headphones className="h-4 w-4" />}
                {connecting ? "Connecting…" : "Listen Live"}
              </button>
            ) : (
              <div className="mb-2 space-y-2 slide-in">
                {/* Volume row */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleMute}
                    className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] transition-all flex-shrink-0"
                  >
                    {muted ? <VolumeX className="h-3.5 w-3.5 text-white/40" /> : <Volume2 className="h-3.5 w-3.5 text-white/70" />}
                  </button>
                  <input
                    type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                    onChange={e => applyVolume(parseFloat(e.target.value))}
                    className={cn("flex-1 h-1 cursor-pointer")}
                    style={{ accentColor: `rgb(${a.waveColor})` }}
                  />
                  <div className="flex items-center gap-1 text-[10px] text-emerald-400 flex-shrink-0">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </div>
                </div>

                {/* Reaction bar + disconnect */}
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 flex-1">
                    {REACTION_EMOJIS.map(e => (
                      <button
                        key={e}
                        onClick={() => sendReaction(e)}
                        className="text-base hover:scale-125 transition-transform select-none"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={disconnectLiveKit}
                    className="text-[9px] text-white/25 hover:text-white/50 transition-colors px-2 py-1 rounded-lg border border-white/[0.06] hover:border-white/[0.12] flex-shrink-0"
                  >
                    Leave
                  </button>
                </div>
              </div>
            )}

            {/* Open Full button */}
            <a href={`https://ogscan.fun/space/${liveSpace.id}`} target="_blank" rel="noopener noreferrer">
              <button className="w-full flex items-center justify-center gap-1 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-[10px] text-white/35 hover:text-white/60 transition-all">
                Open Full Space ↗
              </button>
            </a>
          </div>
        </div>
      ) : (
        /* ════ OFFLINE STATE ════════════════════════════════ */
        <div className="p-4">
          {/* Host info */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
              <img
                src={safeAvatarUrl(profile.avatar_url)}
                alt={displayName}
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=111827&color=888&size=40`; }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{displayName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-white/15" />
                <p className="text-[10px] text-white/35">Not live right now</p>
              </div>
            </div>
          </div>

          {/* Upcoming spaces */}
          {upcoming.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Calendar className="h-3 w-3 text-white/25" />
                <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">Upcoming</p>
              </div>
              <div className="space-y-2">
                {upcoming.map(sp => (
                  <a
                    key={sp.id}
                    href={`https://ogscan.fun/u/${username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn("block rounded-xl border p-3 hover:opacity-90 transition-all", a.subtleBg, a.border)}
                  >
                    <p className="text-xs font-semibold text-white/80 line-clamp-1">{sp.title}</p>
                    {sp.topic && <p className={cn("text-[10px] mt-0.5", a.text)}>{sp.topic}</p>}
                    {sp.scheduled_for && (
                      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-white/35">
                        <Bell className="h-2.5 w-2.5" />
                        <span className={cn("font-semibold", a.text)}>
                          <Countdown target={sp.scheduled_for} />
                        </span>
                        <span>·</span>
                        <span>{format(new Date(sp.scheduled_for), "MMM d, h:mm a")}</span>
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Last past space */}
          {lastSpace && upcoming.length === 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="h-3 w-3 text-white/25" />
                <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">Last Space</p>
              </div>
              <a href={`https://ogscan.fun/listen/${lastSpace.id}`} target="_blank" rel="noopener noreferrer">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 hover:bg-white/[0.06] transition-all cursor-pointer group">
                  <p className="text-xs font-semibold text-white/65 group-hover:text-white/85 transition-colors line-clamp-1">{lastSpace.title}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/25">
                    {lastSpace.ended_at && <span>{formatDistanceToNow(new Date(lastSpace.ended_at), { addSuffix: true })}</span>}
                    {lastSpace.peak_listeners && <><span>·</span><span>{lastSpace.peak_listeners} peak</span></>}
                    {lastSpace.duration_seconds && <><span>·</span><span>{formatDuration(lastSpace.duration_seconds)}</span></>}
                  </div>
                </div>
              </a>
            </div>
          )}

          {/* Empty state */}
          {!lastSpace && upcoming.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-6 mb-4">
              <Mic className="h-8 w-8 text-white/8" />
              <p className="text-[11px] text-white/20 text-center">No spaces yet</p>
            </div>
          )}
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────── */}
      <div className="px-4 pb-3 pt-1 border-t border-white/[0.06]">
        <a href={profileUrl} target="_blank" rel="noopener noreferrer">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all cursor-pointer group">
            <div className="flex items-center gap-2">
              <Radio className={cn("h-3 w-3", a.text)} />
              <span className="text-[10px] text-white/35 group-hover:text-white/60 transition-colors">
                @{profile.username} on OGScan
              </span>
            </div>
            <ArrowRight className="h-3 w-3 text-white/15 group-hover:text-white/40 transition-all group-hover:translate-x-0.5" />
          </div>
        </a>
      </div>
    </div>
  );
}
