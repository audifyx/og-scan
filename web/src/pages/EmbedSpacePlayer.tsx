/**
 * EmbedSpacePlayer — ogscan.fun/embed/space-player/:spaceId
 *
 * Full-featured advanced embeddable space player.
 * The most advanced embed — designed to replace a basic stream widget.
 *
 * Features:
 * - Inline LiveKit listen (public token, no auth)
 * - Animated waveform visualizer (canvas, real-time)
 * - Speaker grid with speaking pulse rings + audio EQ bars
 * - Live chat with send + emoji reactions
 * - Floating emoji reactions
 * - Raise hand / Q&A queue indicator
 * - Volume + mute controls
 * - Copy share link + copy embed code panel
 * - Ended state → replay CTA
 * - Glassmorphism dark design — matches OGScan aesthetic
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  ConnectionState,
} from "livekit-client";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import {
  Headphones, Volume2, VolumeX, Loader2, Radio, Mic,
  ExternalLink, MessageSquare, Crown, Send, Copy, Share2,
  Check, Users, Play, Hand, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { safeAvatarUrl } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const LIVEKIT_URL = "wss://new-7unnd5e1.livekit.cloud";
const REACTIONS = ["🔥", "❤️", "🚀", "💎", "👏", "💯", "⚡", "🎯", "😂", "🧠"];

interface Space {
  id: string;
  title: string;
  description: string | null;
  host_id: string;
  host_username: string | null;
  host_avatar: string | null;
  topic: string | null;
  is_live: boolean;
  listener_count: number;
  speaker_count: number;
  created_at: string;
  ended_at: string | null;
  tags: string[] | null;
  peak_listeners: number | null;
  duration_seconds: number | null;
}

interface ChatMsg {
  id: string;
  username: string | null;
  content: string;
  created_at: string;
  is_host?: boolean;
}

interface Speaker {
  identity: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
}

interface FloatReaction { id: number; emoji: string; x: number; size: number }

/* ── Live pulsing dot ── */
function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
    </span>
  );
}

/* ── Animated canvas waveform ── */
function Waveform({ active, color = "139,92,246" }: { active: boolean; color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const bars = 28;

    const draw = () => {
      frameRef.current++;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const barW = w / bars;
      for (let i = 0; i < bars; i++) {
        const t = frameRef.current * 0.045 + i * 0.38;
        const amp = active
          ? Math.abs(Math.sin(t + Math.sin(i * 0.5) * 0.7)) * 0.8 + 0.2
          : 0.07;
        const barH = amp * h * 0.88;
        const x = i * barW + 1;
        const y = (h - barH) / 2;
        const alpha = active ? 0.35 + amp * 0.65 : 0.1;
        ctx.fillStyle = `rgba(${color}, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x, y, Math.max(barW - 2, 1), barH, 2);
        ctx.fill();
        if (active && amp > 0.75) {
          ctx.shadowColor = `rgba(${color}, 0.4)`;
          ctx.shadowBlur = 5;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [active, color]);

  return <canvas ref={canvasRef} width={320} height={40} className="w-full h-10 block" />;
}

/* ── Audio EQ bars (small, in speaker card) ── */
function MiniEQ({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-[2px] h-3.5 w-6">
      {[0.5, 1, 0.7, 0.9, 0.6].map((h, i) => (
        <div
          key={i}
          className={cn("w-[2px] rounded-full", active ? "bg-emerald-400" : "bg-white/15")}
          style={{
            height: active ? `${h * 100}%` : "25%",
            transition: "height 0.1s ease",
            animation: active ? `eqWave ${0.3 + i * 0.08}s ease-in-out infinite alternate` : "none",
          }}
        />
      ))}
    </div>
  );
}

/* ── Speaker card ── */
function SpeakerCard({ speaker, isHost, avatar, displayName }: {
  speaker?: Speaker;
  isHost?: boolean;
  avatar?: string | null;
  displayName?: string;
}) {
  const name = speaker?.name || displayName || "?";
  const speaking = speaker?.isSpeaking || false;

  return (
    <div className={cn(
      "flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border transition-all duration-300 min-w-0",
      speaking
        ? "border-emerald-500/30 bg-emerald-500/[0.05] shadow-[0_0_12px_rgba(52,211,153,0.12)]"
        : "border-white/[0.07] bg-white/[0.02]"
    )}>
      <div className="relative">
        <div className={cn(
          "h-10 w-10 rounded-full overflow-hidden border-2 transition-all duration-300",
          speaking ? "border-emerald-400/60" : isHost ? "border-amber-400/30" : "border-white/10"
        )}>
          <img
            src={safeAvatarUrl(avatar || null)}
            alt={name}
            className="w-full h-full object-cover"
            onError={e => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name[0] || "?")}&background=${speaking ? "065f46" : "1f2937"}&color=${speaking ? "6ee7b7" : "9ca3af"}&size=40`;
            }}
          />
        </div>
        {isHost && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
            <Crown className="h-2 w-2 text-amber-400" />
          </div>
        )}
        {speaking && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
            <MiniEQ active />
          </div>
        )}
      </div>
      <span className="text-[9px] text-white/50 font-medium truncate max-w-[68px] text-center leading-tight">
        {name.length > 9 ? name.slice(0, 8) + "…" : name}
      </span>
      {isHost && <span className="text-[8px] text-amber-400/50 font-black uppercase tracking-wider -mt-1">Host</span>}
    </div>
  );
}

export default function EmbedSpacePlayer() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [floatReactions, setFloatReactions] = useState<FloatReaction[]>([]);
  const [showEmbed, setShowEmbed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [tab, setTab] = useState<"chat" | "people">("chat");
  const [handRaised, setHandRaised] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const chatRef = useRef<HTMLDivElement>(null);
  const reactionCounter = useRef(0);

  const publicUrl = `https://ogscan.fun/space/${spaceId}`;
  const embedCode = `<iframe\n  src="https://ogscan.fun/embed/space-player/${spaceId}"\n  width="380"\n  height="600"\n  frameborder="0"\n  allow="autoplay"\n  style="border-radius:20px; border: 1px solid rgba(255,255,255,0.08);">\n</iframe>`;

  /* ── Fetch space ── */
  useEffect(() => {
    if (!spaceId) return;
    supabase.from("spaces").select("*").eq("id", spaceId).single()
      .then(({ data }) => { setSpace(data as Space || null); setLoading(false); });

    const ch = supabase.channel(`esp-space-${spaceId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "spaces", filter: `id=eq.${spaceId}` }, p => setSpace(p.new as Space))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [spaceId]);

  /* ── Fetch + subscribe chat ── */
  useEffect(() => {
    if (!spaceId) return;
    supabase.from("space_chat").select("*").eq("space_id", spaceId)
      .order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => {
        setMessages(((data as ChatMsg[]) || []).reverse());
        setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 100);
      });

    const ch = supabase.channel(`esp-chat-${spaceId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "space_chat", filter: `space_id=eq.${spaceId}` }, p => {
        setMessages(prev => {
          const next = [...prev, p.new as ChatMsg].slice(-60);
          setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 50);
          return next;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [spaceId]);

  /* ── LiveKit connect ── */
  const connect = useCallback(async () => {
    if (!spaceId || connecting || connected) return;
    setConnecting(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/public-listener-token?space_id=${spaceId}`,
        { headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" } }
      );
      if (!res.ok) throw new Error("Token error");
      const { token } = await res.json();
      const room = new Room({ adaptiveStream: true, dynacast: true });

      const syncSpeakers = () => {
        const active = new Set(room.activeSpeakers.map(s => s.identity));
        const list: Speaker[] = [];
        room.remoteParticipants.forEach((p: RemoteParticipant) => {
          const hasMic = Array.from(p.audioTrackPublications.values()).some(pub => !pub.isMuted && pub.isSubscribed);
          list.push({ identity: p.identity, name: p.name || p.identity.slice(0, 10), isSpeaking: active.has(p.identity), isMuted: !hasMic });
        });
        setSpeakers(list);
      };

      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = new Audio();
          el.srcObject = new MediaStream([track.mediaStreamTrack]);
          el.volume = muted ? 0 : volume;
          el.play().catch(() => {});
          audioRefs.current.set(participant.sid, el);
        }
        syncSpeakers();
      });
      room.on(RoomEvent.TrackUnsubscribed, (_t, _p, participant) => {
        const el = audioRefs.current.get(participant.sid);
        if (el) { el.pause(); el.srcObject = null; audioRefs.current.delete(participant.sid); }
        syncSpeakers();
      });
      room.on(RoomEvent.ActiveSpeakersChanged, syncSpeakers);
      room.on(RoomEvent.ParticipantConnected, syncSpeakers);
      room.on(RoomEvent.ParticipantDisconnected, syncSpeakers);
      room.on(RoomEvent.TrackMuted, syncSpeakers);
      room.on(RoomEvent.TrackUnmuted, syncSpeakers);
      room.on(RoomEvent.Disconnected, () => { setConnected(false); setSpeakers([]); });
      room.on(RoomEvent.ConnectionStateChanged, s => {
        if (s === ConnectionState.Connected) { setConnected(true); setConnecting(false); syncSpeakers(); }
      });

      await room.connect(LIVEKIT_URL, token);
      roomRef.current = room;
    } catch { setConnecting(false); }
  }, [spaceId, connecting, connected, volume, muted]);

  const toggleMute = () => {
    const n = !muted; setMuted(n);
    audioRefs.current.forEach(el => { el.volume = n ? 0 : volume; });
  };
  const applyVolume = (v: number) => {
    setVolume(v);
    audioRefs.current.forEach(el => { el.volume = muted ? 0 : v; });
  };

  /* ── Send chat ── */
  const sendChat = async () => {
    if (!chatInput.trim() || !spaceId || sendingChat) return;
    setSendingChat(true);
    const { data: { session } } = await supabase.auth.getSession();
    const username = session?.user?.user_metadata?.username || session?.user?.email?.split("@")[0] || "Listener";
    await supabase.from("space_chat").insert({
      space_id: spaceId,
      user_id: session?.user?.id || "anonymous",
      username,
      content: chatInput.trim(),
    });
    setChatInput("");
    setSendingChat(false);
  };

  /* ── Reactions ── */
  const sendReaction = (emoji: string) => {
    reactionCounter.current++;
    const id = reactionCounter.current;
    const size = 16 + Math.random() * 12;
    setFloatReactions(prev => [...prev, { id, emoji, x: 5 + Math.random() * 85, size }]);
    setTimeout(() => setFloatReactions(prev => prev.filter(r => r.id !== id)), 3000);
    setShowReactionPicker(false);
  };

  /* ── Copy helpers ── */
  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl).then(() => { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 1500); });
  };

  useEffect(() => () => { roomRef.current?.disconnect(); }, []);

  if (loading) return (
    <div className="w-full h-full min-h-[320px] bg-[#060914] flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
    </div>
  );

  if (!space) return (
    <div className="w-full h-full min-h-[320px] bg-[#060914] flex items-center justify-center p-4">
      <div className="text-center">
        <Radio className="h-8 w-8 text-white/10 mx-auto mb-2" />
        <p className="text-white/30 text-xs">Space not found</p>
      </div>
    </div>
  );

  const ended = !!space.ended_at || !space.is_live;

  return (
    <div className="w-full h-full min-h-[560px] bg-[#060914] font-sans text-white flex flex-col relative overflow-hidden">
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060914; }
        @keyframes ping { 75%,100% { transform:scale(2); opacity:0; } }
        .animate-ping { animation: ping 1s cubic-bezier(0,0,.2,1) infinite; }
        @keyframes floatUp { 0% { opacity:1; transform:translateY(0) scale(1); } 60% { opacity:.7; transform:translateY(-55px) scale(1.3) rotate(5deg); } 100% { opacity:0; transform:translateY(-120px) scale(.5) rotate(-5deg); } }
        .float-reaction { animation: floatUp 3s ease-out forwards; position:absolute; pointer-events:none; }
        @keyframes eqWave { 0% { transform:scaleY(.4); } 100% { transform:scaleY(1); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .slide-up { animation: slideUp .2s ease-out; }
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius:2px; }
        input[type="range"]::-webkit-slider-thumb { cursor:pointer; }
      `}</style>

      {/* ── Floating reactions ── */}
      <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
        {floatReactions.map(r => (
          <div
            key={r.id}
            className="float-reaction"
            style={{ left: `${r.x}%`, bottom: "80px", fontSize: `${r.size}px` }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* ── Embed code overlay ── */}
      {showEmbed && (
        <div className="absolute inset-0 z-40 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-5 slide-up">
          <div className="w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-white">Embed this Space</p>
              <button onClick={() => setShowEmbed(false)} className="text-white/30 hover:text-white/70 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3 mb-3">
              <code className="text-[9px] text-violet-300 break-all leading-5 font-mono whitespace-pre">{embedCode}</code>
            </div>
            <button
              onClick={copyEmbed}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white transition-all"
            >
              {copied ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy Embed Code</>}
            </button>
            <div className="mt-2 text-center">
              <span className="text-[10px] text-white/25">Paste into any website or CMS</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero area ── */}
      <div className={cn(
        "relative overflow-hidden flex-shrink-0",
        connected ? "bg-gradient-to-br from-violet-950/40 via-purple-950/20 to-[#060914]" : "bg-[#060914]"
      )}>
        {/* Subtle glow when live */}
        {!ended && <div className="absolute inset-0 bg-gradient-to-b from-violet-600/5 to-transparent pointer-events-none" />}

        <div className="relative px-4 pt-3 pb-3">
          {/* Top row: host + title + actions */}
          <div className="flex items-start gap-3 mb-2">
            <div className="relative flex-shrink-0">
              <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-white/10">
                <img
                  src={safeAvatarUrl(space.host_avatar)}
                  alt={space.host_username || "Host"}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(space.host_username || "H")}&background=4c1d95&color=fff&size=40`; }}
                />
              </div>
              {!ended && connected && (
                <div className="absolute -inset-0.5 rounded-full border-2 border-violet-500/60 animate-pulse" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <Crown className="h-3 w-3 text-amber-400 flex-shrink-0" />
                <span className="text-[10px] text-white/35 truncate">{space.host_username || "Host"}</span>
                {!ended && (
                  <div className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/20 flex-shrink-0">
                    <LiveDot />
                    <span className="text-[9px] text-red-400 font-black uppercase tracking-wide">Live</span>
                  </div>
                )}
                {ended && <span className="ml-auto text-[9px] text-white/20 uppercase tracking-wide">Ended</span>}
              </div>
              <h2 className="text-sm font-black text-white leading-snug line-clamp-2">{space.title}</h2>
              {space.topic && <p className="text-[10px] text-violet-400 mt-0.5">{space.topic}</p>}
            </div>
          </div>

          {/* Stats + action buttons */}
          <div className="flex items-center gap-2 mb-2.5">
            <div className="flex items-center gap-3 text-[10px] text-white/30 flex-1">
              <span className="flex items-center gap-1"><Headphones className="h-2.5 w-2.5" />{space.listener_count}</span>
              <span className="flex items-center gap-1"><Mic className="h-2.5 w-2.5" />{space.speaker_count}</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={copyLink} title="Copy link" className="h-6 w-6 flex items-center justify-center rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-all">
                {copiedLink ? <Check className="h-3 w-3 text-emerald-400" /> : <Share2 className="h-3 w-3 text-white/35" />}
              </button>
              <button onClick={() => setShowEmbed(true)} title="Embed code" className="h-6 w-6 flex items-center justify-center rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-all">
                <Copy className="h-3 w-3 text-white/35" />
              </button>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" title="Open full page" className="h-6 w-6 flex items-center justify-center rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-all">
                <ExternalLink className="h-3 w-3 text-white/35" />
              </a>
            </div>
          </div>

          {/* Waveform */}
          <div className="rounded-xl overflow-hidden border border-white/[0.04] bg-white/[0.02]">
            <Waveform active={connected && !muted && !ended} />
          </div>
        </div>
      </div>

      {/* ── Speaker grid ── */}
      {(connected || speakers.length > 0) && (
        <div className="px-4 pb-2 flex-shrink-0 slide-up">
          <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {/* Host always first */}
            <SpeakerCard
              isHost
              avatar={space.host_avatar}
              displayName={space.host_username || "Host"}
            />
            {speakers.slice(0, 5).map(s => (
              <SpeakerCard key={s.identity} speaker={s} />
            ))}
            {speakers.length > 5 && (
              <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.02] flex-shrink-0">
                <div className="h-10 w-10 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center">
                  <span className="text-[10px] text-white/35 font-bold">+{speakers.length - 5}</span>
                </div>
                <span className="text-[9px] text-white/30">more</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex border-b border-white/[0.06] flex-shrink-0">
        {(["chat", "people"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all",
              tab === t ? "text-violet-400 border-b-2 border-violet-500" : "text-white/20 hover:text-white/40"
            )}
          >
            {t === "chat" ? <MessageSquare className="h-2.5 w-2.5" /> : <Users className="h-2.5 w-2.5" />}
            {t === "chat" ? "Chat" : "People"}
          </button>
        ))}
      </div>

      {/* ── Chat tab ── */}
      {tab === "chat" && (
        <div ref={chatRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
              <MessageSquare className="h-5 w-5 text-white/10" />
              <p className="text-[10px] text-white/20">No messages yet — be first!</p>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className="flex items-start gap-2 slide-up">
              <div className="h-5 w-5 rounded-full bg-violet-900/40 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[8px] font-black text-violet-300">{(msg.username || "A")[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-violet-400 mr-1.5">{msg.username || "anon"}</span>
                <span className="text-[10px] text-white/60 leading-relaxed break-words">{msg.content}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── People tab ── */}
      {tab === "people" && (
        <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
          {/* Host */}
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.03] transition-all">
            <div className="relative">
              <div className="h-8 w-8 rounded-full overflow-hidden border border-amber-400/30">
                <img src={safeAvatarUrl(space.host_avatar)} alt="" className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=H&background=4c1d95&color=fff&size=32`; }} />
              </div>
              <Crown className="absolute -top-0.5 -right-0.5 h-3 w-3 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-white/80 truncate">{space.host_username || "Host"}</p>
              <p className="text-[9px] text-amber-400/60 font-bold">Host</p>
            </div>
            <Mic className="h-3 w-3 text-white/20 flex-shrink-0" />
          </div>

          {speakers.map(s => (
            <div key={s.identity} className={cn("flex items-center gap-3 px-2 py-2 rounded-xl transition-all", s.isSpeaking ? "bg-emerald-500/[0.04]" : "hover:bg-white/[0.02]")}>
              <div className={cn("h-8 w-8 rounded-full border flex items-center justify-center text-[10px] font-bold transition-all",
                s.isSpeaking ? "border-emerald-400/50 bg-emerald-900/30 text-emerald-300" : "border-white/10 bg-white/[0.03] text-white/30"
              )}>
                {(s.name[0] || "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-white/70 truncate">{s.name}</p>
                <p className="text-[9px] text-white/25">{s.isSpeaking ? "Speaking" : s.isMuted ? "Muted" : "Speaker"}</p>
              </div>
              {s.isSpeaking ? <MiniEQ active /> : <Mic className="h-3 w-3 text-white/15 flex-shrink-0" />}
            </div>
          ))}

          {!connected && speakers.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Users className="h-5 w-5 text-white/8" />
              <p className="text-[10px] text-white/20">Connect to see live speakers</p>
            </div>
          )}

          <div className="mt-3 p-2 rounded-xl border border-white/[0.04] bg-white/[0.02] text-center">
            <p className="text-[9px] text-white/20">{space.listener_count} listening · {space.speaker_count} speaking</p>
          </div>
        </div>
      )}

      {/* ── Reaction picker ── */}
      {showReactionPicker && !ended && (
        <div className="px-3 pb-1 flex-shrink-0 slide-up">
          <div className="flex items-center gap-1.5 flex-wrap p-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            {REACTIONS.map(e => (
              <button key={e} onClick={() => sendReaction(e)} className="text-lg hover:scale-125 transition-transform select-none">
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Chat input (chat tab + live) ── */}
      {!ended && tab === "chat" && (
        <div className="px-3 py-1.5 border-t border-white/[0.06] flex gap-1.5 items-center flex-shrink-0">
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendChat())}
            placeholder={connected ? "Say something…" : "Connect to chat"}
            disabled={!connected}
            maxLength={200}
            className="flex-1 h-7 px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/30 disabled:opacity-40 transition-all"
          />
          <button onClick={() => setShowReactionPicker(v => !v)} className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all flex-shrink-0">
            <span className="text-base leading-none">😀</span>
          </button>
          {/* Raise hand */}
          <button
            onClick={() => setHandRaised(v => !v)}
            disabled={!connected}
            className={cn("h-7 w-7 flex items-center justify-center rounded-lg border transition-all flex-shrink-0",
              handRaised ? "bg-amber-500/20 border-amber-500/40" : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08]"
            )}
          >
            <Hand className={cn("h-3.5 w-3.5", handRaised ? "text-amber-400" : "text-white/35")} />
          </button>
          <button
            onClick={sendChat}
            disabled={!connected || !chatInput.trim() || sendingChat}
            className="h-7 w-7 flex items-center justify-center rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-30 transition-all flex-shrink-0"
          >
            <Send className="h-3 w-3 text-white" />
          </button>
        </div>
      )}

      {/* ── Main controls ── */}
      <div className="px-3 pb-2.5 pt-1.5 flex-shrink-0 border-t border-white/[0.06]">
        {!ended ? (
          !connected ? (
            <button
              onClick={connect}
              disabled={connecting}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-bold text-white transition-all shadow-lg shadow-violet-500/20"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Headphones className="h-4 w-4" />}
              {connecting ? "Connecting to LiveKit…" : "Listen Live"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] transition-all flex-shrink-0">
                {muted ? <VolumeX className="h-3.5 w-3.5 text-white/40" /> : <Volume2 className="h-3.5 w-3.5 text-white/70" />}
              </button>
              <input
                type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                onChange={e => applyVolume(parseFloat(e.target.value))}
                className="flex-1 h-1 accent-violet-500 cursor-pointer"
              />
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 flex-shrink-0">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold">Live</span>
              </div>
            </div>
          )
        ) : (
          <a href={publicUrl} target="_blank" rel="noopener noreferrer">
            <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.07] text-xs text-white/50 hover:text-white/70 transition-all">
              <Play className="h-3.5 w-3.5" />
              View Replay on OGScan
            </button>
          </a>
        )}
      </div>

      {/* Branding */}
      <div className="px-3 pb-2 flex items-center justify-center gap-1 flex-shrink-0">
        <Radio className="h-2 w-2 text-violet-400/30" />
        <span className="text-[8px] text-white/12 tracking-wide">ogscan.fun</span>
      </div>
    </div>
  );
}
