/**
 * EmbedSpace — ogscan.fun/embed/space/:spaceId
 *
 * Advanced embeddable live space player for iframes.
 * - No navigation / header / sidebar
 * - Connects to LiveKit in listen-only mode (public listener token)
 * - Shows: host + speaker grid w/ speaking rings, animated waveform,
 *   live chat with send, floating reactions, listener count, volume control
 * - Copy embed code + share button
 * - "Open Full" link to ogscan.fun/space/:spaceId
 * - Designed to be embedded in any website via iframe
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
  Headphones, Volume2, VolumeX, Loader2, Radio,
  Users, Mic, ExternalLink, MessageSquare, Crown,
  Send, Copy, Share2, Check, Smile,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { safeAvatarUrl } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const LIVEKIT_URL = "wss://new-7unnd5e1.livekit.cloud";

const REACTION_EMOJIS = ["🔥", "❤️", "🚀", "💎", "👏", "💯", "⚡", "🎯"];

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
  created_at: string;
  ended_at: string | null;
  tags: string[] | null;
}

interface ChatMsg {
  id: string;
  username: string | null;
  content: string;
  created_at: string;
  is_host?: boolean;
  avatar_url?: string | null;
}

interface Speaker {
  identity: string;
  name: string;
  avatar: string | null;
  isSpeaking: boolean;
  isMuted: boolean;
  isHost: boolean;
}

interface FloatReaction { id: number; emoji: string; x: number }

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
    </span>
  );
}

// Animated audio waveform bars
function WaveformBars({ active, bars = 20 }: { active: boolean; bars?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      frameRef.current++;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const barW = w / bars;
      for (let i = 0; i < bars; i++) {
        const t = frameRef.current * 0.04 + i * 0.4;
        const amplitude = active ? (0.3 + 0.7 * Math.abs(Math.sin(t + i * 0.7))) : 0.08;
        const barH = Math.max(amplitude * h * 0.85, 2);
        const x = i * barW + 1;
        const y = (h - barH) / 2;
        const alpha = active ? 0.5 + amplitude * 0.5 : 0.15;
        ctx.fillStyle = active
          ? `rgba(139, 92, 246, ${alpha})`
          : `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x, y, Math.max(barW - 2, 1), barH, 2);
        ctx.fill();
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [active, bars]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={32}
      className="w-full h-8 block"
    />
  );
}

// Speaker avatar with pulsing speaking ring
function SpeakerAvatar({ speaker }: { speaker: Speaker }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <div className="relative">
        <div
          className={cn(
            "h-8 w-8 rounded-full overflow-hidden border-2 transition-all duration-300",
            speaker.isSpeaking
              ? "border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
              : "border-white/10"
          )}
        >
          <img
            src={safeAvatarUrl(speaker.avatar)}
            alt={speaker.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(speaker.name[0] || "?")}&background=4c1d95&color=fff&size=32`;
            }}
          />
        </div>
        {speaker.isHost && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
            <Crown className="h-2 w-2 text-amber-400" />
          </div>
        )}
        {speaker.isSpeaking && (
          <div className="absolute -bottom-0.5 -right-0.5 flex items-end gap-[1px] h-3">
            {[0.5, 1, 0.7].map((h, i) => (
              <div
                key={i}
                className="w-[2px] rounded-full bg-emerald-400"
                style={{
                  height: `${h * 100}%`,
                  animation: `waveBar ${0.4 + i * 0.1}s ease-in-out infinite alternate`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>
      <span className="text-[9px] text-white/40 truncate max-w-[52px] text-center leading-tight">
        {speaker.name.length > 8 ? speaker.name.slice(0, 7) + "…" : speaker.name}
      </span>
    </div>
  );
}

export default function EmbedSpace() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [floatReactions, setFloatReactions] = useState<FloatReaction[]>([]);
  const [showEmbedCode, setShowEmbedCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [activeTab, setActiveTab] = useState<"chat" | "speakers">("chat");

  const roomRef = useRef<Room | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const chatRef = useRef<HTMLDivElement>(null);
  const reactionCounter = useRef(0);
  const publicUrl = `https://ogscan.fun/space/${spaceId}`;
  const embedCode = `<iframe src="https://ogscan.fun/embed/space/${spaceId}" width="360" height="520" frameborder="0" allow="autoplay" style="border-radius:16px;"></iframe>`;

  /* ── Fetch space ── */
  useEffect(() => {
    async function load() {
      if (!spaceId) return;
      const { data } = await supabase.from("spaces").select("*").eq("id", spaceId).single();
      setSpace(data as Space || null);
      setLoading(false);
    }
    load();

    const ch = supabase
      .channel(`embed-space-${spaceId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "spaces", filter: `id=eq.${spaceId}` }, (p) => {
        setSpace(p.new as Space);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [spaceId]);

  /* ── Fetch chat ── */
  useEffect(() => {
    if (!spaceId) return;
    supabase
      .from("space_chat")
      .select("*")
      .eq("space_id", spaceId)
      .order("created_at", { ascending: false })
      .limit(40)
      .then(({ data }) => {
        setMessages(((data as ChatMsg[]) || []).reverse());
        setTimeout(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, 100);
      });

    const ch = supabase
      .channel(`embed-chat-${spaceId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "space_chat", filter: `space_id=eq.${spaceId}` }, (p) => {
        setMessages(prev => {
          const next = [...prev, p.new as ChatMsg].slice(-60);
          setTimeout(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, 50);
          return next;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [spaceId]);

  /* ── Connect to LiveKit ── */
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

      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = new Audio();
          el.srcObject = new MediaStream([track.mediaStreamTrack]);
          el.volume = volume;
          el.play().catch(() => {});
          audioRefs.current.set(participant.sid, el);
        }
        updateSpeakers(room, spaceId);
      });
      room.on(RoomEvent.TrackUnsubscribed, (_t, _p, participant) => {
        const el = audioRefs.current.get(participant.sid);
        if (el) { el.pause(); el.srcObject = null; audioRefs.current.delete(participant.sid); }
        updateSpeakers(room, spaceId);
      });
      room.on(RoomEvent.ParticipantConnected, () => updateSpeakers(room, spaceId));
      room.on(RoomEvent.ParticipantDisconnected, () => updateSpeakers(room, spaceId));
      room.on(RoomEvent.ActiveSpeakersChanged, () => updateSpeakers(room, spaceId));
      room.on(RoomEvent.TrackMuted, () => updateSpeakers(room, spaceId));
      room.on(RoomEvent.TrackUnmuted, () => updateSpeakers(room, spaceId));
      room.on(RoomEvent.Disconnected, () => { setConnected(false); });
      room.on(RoomEvent.ConnectionStateChanged, (s) => {
        if (s === ConnectionState.Connected) {
          setConnected(true);
          setConnecting(false);
          updateSpeakers(room, spaceId);
        }
      });

      await room.connect(LIVEKIT_URL, token);
      roomRef.current = room;
    } catch {
      setConnecting(false);
    }
  }, [spaceId, connecting, connected, volume]);

  /* ── Update speakers from LiveKit room ── */
  const updateSpeakers = (room: Room, hostSpaceId: string) => {
    const list: Speaker[] = [];
    // Host from space data
    const activeSpeakers = new Set(room.activeSpeakers.map((s) => s.identity));

    room.remoteParticipants.forEach((p: RemoteParticipant) => {
      const hasMic = Array.from(p.audioTrackPublications.values()).some(pub => !pub.isMuted && pub.isSubscribed);
      list.push({
        identity: p.identity,
        name: p.name || p.identity.slice(0, 8),
        avatar: null,
        isSpeaking: activeSpeakers.has(p.identity),
        isMuted: !hasMic,
        isHost: false,
      });
    });
    setSpeakers(list);
  };

  /* ── Volume / mute ── */
  const applyVolume = (v: number) => {
    setVolume(v);
    audioRefs.current.forEach(el => { el.volume = muted ? 0 : v; });
  };
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    audioRefs.current.forEach(el => { el.volume = next ? 0 : volume; });
  };

  /* ── Send chat (anonymous via Supabase — inserts with session if available) ── */
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

  /* ── Send reaction ── */
  const sendReaction = (emoji: string) => {
    reactionCounter.current++;
    const id = reactionCounter.current;
    setFloatReactions(prev => [...prev, { id, emoji, x: 10 + Math.random() * 80 }]);
    setTimeout(() => setFloatReactions(prev => prev.filter(r => r.id !== id)), 3000);
    setShowReactions(false);
  };

  /* ── Copy embed code ── */
  const copyEmbedCode = () => {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
  };

  /* ── Cleanup ── */
  useEffect(() => {
    return () => { roomRef.current?.disconnect(); };
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full min-h-[220px] bg-[#060811] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!space) {
    return (
      <div className="w-full h-full min-h-[220px] bg-[#060811] flex items-center justify-center p-4">
        <p className="text-white/30 text-xs text-center">Space not found</p>
      </div>
    );
  }

  const ended = !!space.ended_at || !space.is_live;

  return (
    <div className="w-full h-full min-h-[480px] bg-[#060811] font-sans flex flex-col text-white overflow-hidden relative">
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #060811; }
        @keyframes waveBar { 0% { transform: scaleY(0.3); } 100% { transform: scaleY(1); } }
        @keyframes floatUp { 0% { opacity:1; transform:translateY(0) scale(1); } 60% { opacity:.8; transform:translateY(-50px) scale(1.2); } 100% { opacity:0; transform:translateY(-110px) scale(.6); } }
        .float-reaction { animation: floatUp 2.8s ease-out forwards; }
        @keyframes slideIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
        .slide-in { animation: slideIn .2s ease-out; }
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius:2px; }
      `}</style>

      {/* ── Floating reactions ── */}
      <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
        {floatReactions.map(r => (
          <div
            key={r.id}
            className="float-reaction absolute bottom-20 text-xl select-none"
            style={{ left: `${r.x}%` }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* ── Embed code overlay ── */}
      {showEmbedCode && (
        <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 slide-in">
          <div className="w-full max-w-xs">
            <p className="text-xs font-bold text-white/60 mb-2 text-center uppercase tracking-wider">Embed Code</p>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-3">
              <code className="text-[9px] text-violet-300 break-all leading-relaxed font-mono">{embedCode}</code>
            </div>
            <button
              onClick={copyEmbedCode}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white transition-all mb-2"
            >
              {copied ? <><Check className="h-3 w-3" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy Code</>}
            </button>
            <button
              onClick={() => setShowEmbedCode(false)}
              className="w-full py-2 rounded-xl border border-white/10 text-xs text-white/40 hover:text-white/70 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2 border-b border-white/8 flex-shrink-0">
        <div className="h-7 w-7 rounded-full overflow-hidden flex-shrink-0 border border-white/10">
          <img
            src={safeAvatarUrl(space.host_avatar)}
            alt={space.host_username || "Host"}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(space.host_username || "H")}&background=7c3aed&color=fff&size=28`; }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-white/30 truncate flex items-center gap-1">
            <Crown className="h-2.5 w-2.5 text-amber-400" />
            {space.host_username || "Host"}
          </p>
          <p className="text-xs font-bold text-white truncate leading-tight">{space.title}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!ended && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/20">
              <LiveDot />
              <span className="text-[9px] text-red-400 uppercase tracking-wider font-bold">Live</span>
            </div>
          )}
          {ended && <span className="text-[9px] text-white/25 uppercase tracking-wider">Ended</span>}
          {/* Action buttons */}
          <button
            onClick={copyLink}
            title="Share"
            className="h-6 w-6 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
          >
            <Share2 className="h-3 w-3 text-white/40" />
          </button>
          <button
            onClick={() => setShowEmbedCode(true)}
            title="Embed"
            className="h-6 w-6 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
          >
            <Copy className="h-3 w-3 text-white/40" />
          </button>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" title="Open full page" className="h-6 w-6 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
            <ExternalLink className="h-3 w-3 text-white/40" />
          </a>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] text-white/30 border-b border-white/5 flex-shrink-0">
        <span className="flex items-center gap-1"><Headphones className="h-2.5 w-2.5" /> {space.listener_count} listening</span>
        <span className="flex items-center gap-1"><Mic className="h-2.5 w-2.5" /> {space.speaker_count} speakers</span>
        {space.topic && <span className="text-white/20 truncate">{space.topic}</span>}
      </div>

      {/* ── Waveform (when connected) ── */}
      {connected && !ended && (
        <div className="px-3 pt-2 pb-1 flex-shrink-0">
          <WaveformBars active={connected && !muted} />
        </div>
      )}

      {/* ── Speakers grid (when connected and has speakers) ── */}
      {connected && speakers.length > 0 && (
        <div className="px-3 pb-2 flex-shrink-0">
          <p className="text-[9px] text-white/20 uppercase tracking-wider mb-1.5 font-semibold">Speakers</p>
          <div className="flex flex-wrap gap-3">
            {/* Host always first */}
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div className="relative">
                <div className="h-8 w-8 rounded-full overflow-hidden border-2 border-amber-400/30">
                  <img
                    src={safeAvatarUrl(space.host_avatar)}
                    alt={space.host_username || "Host"}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(space.host_username || "H")}&background=7c3aed&color=fff&size=32`; }}
                  />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
                  <Crown className="h-2 w-2 text-amber-400" />
                </div>
              </div>
              <span className="text-[9px] text-white/40 truncate max-w-[52px] text-center">
                {(space.host_username || "Host").length > 8 ? (space.host_username || "Host").slice(0, 7) + "…" : (space.host_username || "Host")}
              </span>
            </div>
            {speakers.slice(0, 7).map(s => (
              <SpeakerAvatar key={s.identity} speaker={s} />
            ))}
            {speakers.length > 7 && (
              <div className="flex flex-col items-center gap-1">
                <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <span className="text-[9px] text-white/40 font-bold">+{speakers.length - 7}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tabs (chat / speakers) ── */}
      <div className="flex border-b border-white/5 flex-shrink-0">
        <button
          onClick={() => setActiveTab("chat")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all",
            activeTab === "chat" ? "text-violet-400 border-b-2 border-violet-400" : "text-white/25 hover:text-white/50"
          )}
        >
          <MessageSquare className="h-2.5 w-2.5" />
          Chat
        </button>
        <button
          onClick={() => setActiveTab("speakers")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all",
            activeTab === "speakers" ? "text-violet-400 border-b-2 border-violet-400" : "text-white/25 hover:text-white/50"
          )}
        >
          <Users className="h-2.5 w-2.5" />
          People
        </button>
      </div>

      {/* ── Chat messages ── */}
      {activeTab === "chat" && (
        <div ref={chatRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-1 py-4">
              <MessageSquare className="h-4 w-4 text-white/15" />
              <p className="text-[10px] text-white/20">No messages yet</p>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className="flex items-start gap-1.5 group slide-in">
              <div className="w-4 h-4 rounded-full bg-violet-800/40 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[7px] text-violet-300 font-bold">{(msg.username || "A")[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-violet-400 font-semibold mr-1.5">{msg.username || "anon"}</span>
                <span className="text-[10px] text-white/60 leading-relaxed break-words">{msg.content}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── People tab ── */}
      {activeTab === "speakers" && (
        <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
          {/* Host */}
          <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] transition-all">
            <div className="relative">
              <div className="h-8 w-8 rounded-full overflow-hidden border border-amber-400/30">
                <img
                  src={safeAvatarUrl(space.host_avatar)}
                  alt={space.host_username || "Host"}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(space.host_username || "H")}&background=7c3aed&color=fff&size=32`; }}
                />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
                <Crown className="h-2 w-2 text-amber-400" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-white/80 truncate">{space.host_username || "Host"}</p>
              <p className="text-[9px] text-amber-400/60 font-semibold">Host</p>
            </div>
            <Mic className="h-3 w-3 text-white/20" />
          </div>

          {speakers.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Users className="h-5 w-5 text-white/10" />
              <p className="text-[10px] text-white/20">
                {connected ? "Only host is live" : "Connect to see speakers"}
              </p>
            </div>
          )}

          {speakers.map(s => (
            <div key={s.identity} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] transition-all">
              <div className={cn(
                "h-8 w-8 rounded-full overflow-hidden border transition-all",
                s.isSpeaking ? "border-emerald-400/50 shadow-[0_0_6px_rgba(52,211,153,0.3)]" : "border-white/10"
              )}>
                <img
                  src={safeAvatarUrl(s.avatar)}
                  alt={s.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name[0] || "?")}&background=374151&color=888&size=32`; }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-white/70 truncate">{s.name}</p>
                <p className="text-[9px] text-white/30">{s.isSpeaking ? "Speaking..." : "Speaker"}</p>
              </div>
              {s.isSpeaking ? (
                <div className="flex items-end gap-[2px] h-3">
                  {[0.5, 1, 0.7].map((h, i) => (
                    <div key={i} className="w-[2px] rounded-full bg-emerald-400" style={{ height: `${h * 100}%`, animation: `waveBar ${0.4 + i * 0.1}s ease-in-out infinite alternate` }} />
                  ))}
                </div>
              ) : (
                s.isMuted ? <VolumeX className="h-3 w-3 text-white/15" /> : <Mic className="h-3 w-3 text-white/20" />
              )}
            </div>
          ))}

          <div className="mt-3 px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <p className="text-[9px] text-white/20 text-center">
              {space.listener_count} listeners · {space.speaker_count} speakers
            </p>
          </div>
        </div>
      )}

      {/* ── Chat input (when connected + live) ── */}
      {!ended && activeTab === "chat" && (
        <div className="px-3 py-1.5 border-t border-white/5 flex gap-1.5 flex-shrink-0">
          <div className="relative flex-1">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendChat())}
              placeholder={connected ? "Say something..." : "Connect to chat"}
              disabled={!connected}
              maxLength={200}
              className="w-full h-7 pl-2.5 pr-7 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/30 disabled:opacity-40 transition-all"
            />
          </div>
          <button
            onClick={() => setShowReactions(v => !v)}
            className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all flex-shrink-0"
          >
            <Smile className="h-3 w-3 text-white/40" />
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

      {/* ── Reaction picker ── */}
      {showReactions && !ended && (
        <div className="px-3 pb-1.5 flex-shrink-0 slide-in">
          <div className="flex items-center gap-1.5 flex-wrap">
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
        </div>
      )}

      {/* ── Controls ── */}
      <div className="px-3 py-2 border-t border-white/8 flex-shrink-0">
        {!ended ? (
          !connected ? (
            <button
              onClick={connect}
              disabled={connecting}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs font-bold text-white transition-all"
            >
              {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Headphones className="h-3.5 w-3.5" />}
              {connecting ? "Connecting…" : "Listen Live"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="flex items-center justify-center h-8 w-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 transition-all flex-shrink-0"
              >
                {muted ? <VolumeX className="h-3.5 w-3.5 text-white/40" /> : <Volume2 className="h-3.5 w-3.5 text-white/70" />}
              </button>
              <input
                type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                onChange={e => applyVolume(parseFloat(e.target.value))}
                className="flex-1 h-1 accent-violet-500 cursor-pointer"
              />
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 flex-shrink-0">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </div>
            </div>
          )
        ) : (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-1.5 rounded-xl bg-white/5 border border-white/10 text-center text-[10px] text-white/40 hover:text-white/60 transition-all"
          >
            View Replay on OGScan →
          </a>
        )}
      </div>

      {/* Branding */}
      <div className="px-3 py-1 flex items-center justify-center gap-1 border-t border-white/[0.04] flex-shrink-0">
        <Radio className="h-2 w-2 text-violet-400/40" />
        <span className="text-[8px] text-white/15">ogscan.fun</span>
      </div>
    </div>
  );
}
