/**
 * PublicSpaceListen — Public standalone live-listener page.
 * No auth required. Anyone with the link can listen to a live OG Space.
 * Shareable link: ogscan.fun/space/:spaceId
 *
 * Architecture:
 * - Fetches space info from Supabase (public read)
 * - Gets a listener-only LiveKit token from `public-listener-token` edge fn
 * - Connects to LiveKit room in subscribe-only mode (no mic publish)
 * - Shows live chat (read-only), listener count, host info
 * - Keeps a realtime listener count via Supabase presence/broadcast
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  ConnectionState,
} from "livekit-client";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import {
  Mic, MicOff, Users, Radio, Headphones, Share2, Copy,
  Globe, ArrowLeft, Loader2, Volume2, VolumeX, Wifi, WifiOff,
  ExternalLink, Crown, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

const LIVEKIT_URL = "wss://new-7unnd5e1.livekit.cloud";

/* ─── Types ─── */
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
}

const TOPIC_GRADIENTS: Record<string, string> = {
  Alpha: "from-amber-500/30 via-amber-600/10 to-transparent",
  Trading: "from-emerald-500/30 via-emerald-600/10 to-transparent",
  Memecoins: "from-pink-500/30 via-pink-600/10 to-transparent",
  DeFi: "from-blue-500/30 via-blue-600/10 to-transparent",
  NFTs: "from-purple-500/30 via-purple-600/10 to-transparent",
  News: "from-cyan-500/30 via-cyan-600/10 to-transparent",
  General: "from-white/10 via-white/5 to-transparent",
};

const TOPIC_BADGE: Record<string, string> = {
  Alpha: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  Trading: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  Memecoins: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  DeFi: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  NFTs: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  News: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  General: "bg-white/10 text-white/50 border-white/10",
};

/* ── Pulsing dot ── */
const LivePulse = () => (
  <span className="relative flex h-2 w-2">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
  </span>
);

/* ── Speaker waveform ── */
const SpeakerWave = ({ active }: { active: boolean }) => (
  <div className="flex items-end gap-[2px] h-4">
    {[0.4, 0.8, 0.6, 1.0, 0.7, 0.5, 0.9].map((h, i) => (
      <div
        key={i}
        className={cn(
          "w-[3px] rounded-full transition-all",
          active ? "bg-emerald-400" : "bg-white/20"
        )}
        style={{
          height: `${active ? h * 100 : 30}%`,
          animationDuration: active ? `${0.3 + i * 0.07}s` : undefined,
        }}
      />
    ))}
  </div>
);

/* ════════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════════ */
const PublicSpaceListen = () => {
  const { spaceId } = useParams<{ spaceId: string }>();

  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // LiveKit state
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [activeSpeakers, setActiveSpeakers] = useState<Set<string>>(new Set());
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);

  // Public listener count (separate from registered users)
  const [publicListeners, setPublicListeners] = useState(0);

  // Chat messages (read-only)
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const roomRef = useRef<Room | null>(null);
  const presenceRef = useRef<any>(null);
  const guestIdRef = useRef<string>("");
  const volumeRef = useRef<HTMLInputElement>(null);
  const [volume, setVolume] = useState(1);
  const [copied, setCopied] = useState(false);

  /* ── Fetch space ── */
  useEffect(() => {
    if (!spaceId) { setError("No space ID provided"); setLoading(false); return; }
    const load = async () => {
      const { data, error: err } = await supabase
        .from("spaces")
        .select("id,title,description,host_id,host_username,host_avatar,topic,is_live,is_private,listener_count,speaker_count,created_at,ended_at,tags")
        .eq("id", spaceId)
        .single();
      if (err || !data) { setError("Space not found"); setLoading(false); return; }
      if (data.ended_at) {
        // Space ended — redirect to replay
        window.location.href = `/listen/${spaceId}`;
        return;
      }
      setSpace(data as Space);
      setLoading(false);
    };
    load();
  }, [spaceId]);

  /* ── Realtime space updates ── */
  useEffect(() => {
    if (!spaceId) return;
    const ch = supabase
      .channel(`pub-space-${spaceId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "spaces", filter: `id=eq.${spaceId}` },
        (p) => {
          const updated = p.new as Space;
          if (updated.ended_at) { window.location.href = `/listen/${spaceId}`; return; }
          setSpace(prev => prev ? { ...prev, ...updated } : updated);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [spaceId]);

  /* ── Load recent chat messages ── */
  useEffect(() => {
    if (!spaceId) return;
    const load = async () => {
      const { data } = await supabase
        .from("space_messages")
        .select("id, content, created_at, user_id, profiles!space_messages_user_id_fkey(username)")
        .eq("space_id", spaceId)
        .order("created_at", { ascending: true })
        .limit(50);
      if (data) {
        setChatMessages(data.map((m: any) => ({
          id: m.id,
          username: m.profiles?.username || "User",
          content: m.content,
          created_at: m.created_at,
          is_host: m.user_id === space?.host_id,
        })));
      }
    };
    load();

    // Subscribe to new messages
    const ch = supabase.channel(`pub-chat-${spaceId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "space_messages", filter: `space_id=eq.${spaceId}` },
        async (p) => {
          const msg = p.new as any;
          const { data: prof } = await supabase.from("profiles").select("username").eq("user_id", msg.user_id).single();
          setChatMessages(prev => [...prev.slice(-99), {
            id: msg.id,
            username: prof?.username || "User",
            content: msg.content,
            created_at: msg.created_at,
            is_host: msg.user_id === space?.host_id,
          }]);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [spaceId, space?.host_id]);

  /* ── Auto-scroll chat ── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  /* ── Get public listener token ── */
  const getToken = async (): Promise<string | null> => {
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/public-listener-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ spaceId, guestName: `Guest` }),
      });
      const data = await resp.json();
      if (data.token) {
        guestIdRef.current = data.guestId;
        return data.token;
      }
      return null;
    } catch { return null; }
  };

  /* ── Connect to LiveKit ── */
  const connect = useCallback(async () => {
    if (connecting || connected || !spaceId) return;
    setConnecting(true);
    try {
      const token = await getToken();
      if (!token) { toast.error("Failed to get audio token"); setConnecting(false); return; }

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.Connected, () => {
        setConnected(true); setConnecting(false);
        toast.success("You're now listening live 🎧");
      });
      room.on(RoomEvent.Disconnected, () => {
        setConnected(false); setConnecting(false);
        roomRef.current = null;
      });
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setActiveSpeakers(new Set(speakers.map(s => s.identity)));
      });
      room.on(RoomEvent.ParticipantConnected, () => {
        setRemoteParticipants([...room.remoteParticipants.values()]);
      });
      room.on(RoomEvent.ParticipantDisconnected, () => {
        setRemoteParticipants([...room.remoteParticipants.values()]);
      });
      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.volume = volume;
          document.body.appendChild(el);
          (el as any).__lk_participant = participant.identity;
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach(el => el.remove());
      });

      await room.connect(LIVEKIT_URL, token);
      setRemoteParticipants([...room.remoteParticipants.values()]);

      // Track public listener count via Supabase Broadcast
      const pubCh = supabase.channel(`public-listeners-${spaceId}`, {
        config: { presence: { key: guestIdRef.current } },
      });
      pubCh.on("presence", { event: "sync" }, () => {
        const state = pubCh.presenceState();
        setPublicListeners(Object.keys(state).length);
      });
      await pubCh.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await pubCh.track({ joined_at: new Date().toISOString() });
        }
      });
      presenceRef.current = pubCh;

    } catch (e: any) {
      console.error("LiveKit connect error:", e);
      toast.error("Failed to connect: " + (e?.message || "Unknown error"));
      setConnecting(false);
    }
  }, [spaceId, connecting, connected, volume]);

  /* ── Disconnect ── */
  const disconnect = useCallback(async () => {
    if (presenceRef.current) {
      await presenceRef.current.untrack();
      supabase.removeChannel(presenceRef.current);
      presenceRef.current = null;
    }
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    // Remove any attached audio elements
    document.querySelectorAll("audio[data-lk]").forEach(el => el.remove());
    setConnected(false);
    setActiveSpeakers(new Set());
    setRemoteParticipants([]);
    setPublicListeners(0);
  }, []);

  /* ── Volume control ── */
  const handleVolume = (v: number) => {
    setVolume(v);
    document.querySelectorAll("audio").forEach(el => { el.volume = v; });
  };

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => { disconnect(); };
  }, []);

  /* ── Copy share link ── */
  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Share link copied! 🔗");
    });
  };

  /* ── Render ── */
  if (loading) return (
    <div className="min-h-screen bg-[#070b10] flex items-center justify-center">
      <Loader2 className="h-8 w-8 text-white/20 animate-spin" />
    </div>
  );

  if (error || !space) return (
    <div className="min-h-screen bg-[#070b10] flex flex-col items-center justify-center gap-4 px-4">
      <Radio className="h-12 w-12 text-white/10" />
      <p className="text-white/40 text-lg font-semibold">{error || "Space not found"}</p>
      <a href="/spaces" className="text-sm text-cyan-400/70 hover:text-cyan-400 underline">Browse live spaces →</a>
    </div>
  );

  const topicGrad = TOPIC_GRADIENTS[space.topic || ""] || TOPIC_GRADIENTS.General;
  const topicBadge = TOPIC_BADGE[space.topic || ""] || TOPIC_BADGE.General;
  const totalListeners = (space.listener_count || 0) + publicListeners;
  const speakerParticipants = remoteParticipants.filter(p => !p.identity.startsWith("guest-"));

  return (
    <div className="min-h-screen bg-[#070b10] text-white flex flex-col">
      <Toaster position="top-center" />

      {/* ── Gradient header ── */}
      <div className={cn("relative overflow-hidden", "bg-gradient-to-b", topicGrad, "pt-safe")}>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#070b10] pointer-events-none" />

        {/* Nav bar */}
        <div className="relative flex items-center justify-between px-4 pt-4 pb-2">
          <a href="/spaces" className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition text-sm">
            <ArrowLeft className="h-4 w-4" />
            <span>Spaces</span>
          </a>
          <button onClick={copyLink} className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition text-sm">
            {copied ? <><Copy className="h-4 w-4 text-emerald-400" /><span className="text-emerald-400">Copied!</span></> : <><Share2 className="h-4 w-4" /><span>Share</span></>}
          </button>
        </div>

        {/* Space info */}
        <div className="relative px-5 pb-6 pt-2">
          {/* Live badge */}
          {space.is_live && (
            <div className="flex items-center gap-2 mb-3">
              <LivePulse />
              <span className="text-xs font-black text-red-400 tracking-widest uppercase">Live Now</span>
            </div>
          )}

          <h1 className="text-2xl font-black text-white leading-tight mb-2">{space.title}</h1>

          {space.description && (
            <p className="text-sm text-white/50 mb-3 leading-relaxed">{space.description}</p>
          )}

          {/* Host + topic row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Host */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10 overflow-hidden flex items-center justify-center">
                {space.host_avatar
                  ? <img src={space.host_avatar} alt="" className="w-full h-full object-cover" />
                  : <Crown className="h-3.5 w-3.5 text-amber-400" />}
              </div>
              <div>
                <p className="text-[10px] text-white/30 leading-none">Hosted by</p>
                <p className="text-xs font-bold text-white/70 leading-tight">@{space.host_username || "Host"}</p>
              </div>
            </div>

            {space.topic && (
              <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-black border tracking-wide", topicBadge)}>
                {space.topic}
              </span>
            )}

            {/* Tags */}
            {space.tags?.map(t => (
              <span key={t} className="px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[10px] text-white/30">#{t}</span>
            ))}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-1.5 text-white/40 text-xs">
              <Mic className="h-3.5 w-3.5" />
              <span>{space.speaker_count || 0} speaking</span>
            </div>
            <div className="flex items-center gap-1.5 text-white/40 text-xs">
              <Headphones className="h-3.5 w-3.5" />
              <span>{totalListeners} listening</span>
            </div>
            {publicListeners > 0 && (
              <div className="flex items-center gap-1.5 text-cyan-400/60 text-xs">
                <Globe className="h-3.5 w-3.5" />
                <span>{publicListeners} via public link</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 gap-4 pb-32">

        {/* ── Connect card ── */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-5 mt-4">
          <div className="flex items-center gap-3 mb-4">
            {connected
              ? <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center"><Volume2 className="h-5 w-5 text-emerald-400" /></div>
              : <div className="w-10 h-10 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center"><MicOff className="h-5 w-5 text-white/30" /></div>
            }
            <div className="flex-1">
              <p className="text-sm font-bold text-white/80">
                {connected ? "You're listening live" : "Join as public listener"}
              </p>
              <p className="text-[11px] text-white/30">
                {connected ? "Audio is streaming • no account needed" : "No account required — listen anonymously"}
              </p>
            </div>
            {connected
              ? <div className="flex items-center gap-1.5"><Wifi className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-400 font-semibold">Connected</span></div>
              : null
            }
          </div>

          {/* Volume slider (only when connected) */}
          {connected && (
            <div className="flex items-center gap-3 mb-4">
              <VolumeX className="h-4 w-4 text-white/30 flex-shrink-0" />
              <input
                ref={volumeRef}
                type="range" min={0} max={1} step={0.01} value={volume}
                onChange={e => handleVolume(parseFloat(e.target.value))}
                className="flex-1 h-1.5 rounded-full accent-cyan-400 cursor-pointer"
              />
              <Volume2 className="h-4 w-4 text-white/30 flex-shrink-0" />
            </div>
          )}

          <div className="flex gap-3">
            {!connected ? (
              <button
                onClick={connect}
                disabled={connecting || !space.is_live}
                className={cn(
                  "flex-1 h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all",
                  space.is_live
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20"
                    : "bg-white/[0.04] border border-white/[0.08] text-white/20 cursor-not-allowed"
                )}
              >
                {connecting
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Connecting…</>
                  : space.is_live
                    ? <><Headphones className="h-4 w-4" /> Listen Live</>
                    : "Space not live"
                }
              </button>
            ) : (
              <button
                onClick={disconnect}
                className="flex-1 h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
              >
                <WifiOff className="h-4 w-4" /> Disconnect
              </button>
            )}

            {/* Join with account CTA */}
            <a
              href={`/auth?redirect=/spaces?join=${space.id}`}
              className="h-11 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-white/[0.04] border border-white/[0.08] text-white/50 hover:bg-white/[0.08] hover:text-white/70 transition-all whitespace-nowrap"
            >
              <ExternalLink className="h-4 w-4" />
              Join with account
            </a>
          </div>

          {!space.is_live && (
            <p className="text-[11px] text-amber-400/60 mt-3 flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5" />
              This space is currently offline. Check back when it goes live.
            </p>
          )}
        </div>

        {/* ── Active speakers ── */}
        {connected && remoteParticipants.length > 0 && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-4">
            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">
              On Air ({speakerParticipants.length})
            </p>
            <div className="grid grid-cols-4 gap-3">
              {speakerParticipants.map(p => (
                <div key={p.identity} className="flex flex-col items-center gap-1.5">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl bg-white/[0.05] border flex items-center justify-center text-sm font-bold",
                    activeSpeakers.has(p.identity) ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/[0.08]"
                  )}>
                    {(p.name || p.identity)[0]?.toUpperCase() || "?"}
                  </div>
                  <p className="text-[9px] text-white/40 truncate w-full text-center">{p.name || p.identity}</p>
                  <SpeakerWave active={activeSpeakers.has(p.identity)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Live chat (read-only) ── */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] flex flex-col overflow-hidden" style={{ maxHeight: 360 }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
            <MessageSquare className="h-4 w-4 text-white/30" />
            <p className="text-xs font-bold text-white/40">Live Chat</p>
            <span className="text-[10px] text-white/20 ml-auto">(read-only)</span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5" style={{ scrollbarWidth: "none" }}>
            {chatMessages.length === 0 ? (
              <p className="text-[11px] text-white/20 text-center py-4">No messages yet…</p>
            ) : chatMessages.map(msg => (
              <div key={msg.id} className="flex gap-2.5">
                <div className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[8px] font-bold text-white/40">
                    {(msg.username || "?")[0]?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className={cn("text-[10px] font-bold mr-1.5", msg.is_host ? "text-amber-400" : "text-white/50")}>
                    {msg.is_host && <Crown className="h-2.5 w-2.5 inline mr-0.5 text-amber-400" />}
                    {msg.username}
                  </span>
                  <span className="text-[11px] text-white/60">{msg.content}</span>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="px-4 py-3 border-t border-white/[0.06]">
            <a
              href={`/auth?redirect=/spaces?join=${space.id}`}
              className="block w-full text-center text-[11px] text-cyan-400/60 hover:text-cyan-400 transition py-1"
            >
              Sign in to chat →
            </a>
          </div>
        </div>

        {/* ── OG Scan CTA ── */}
        <div className="rounded-2xl bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-white/[0.07] p-5 text-center">
          <p className="text-sm font-bold text-white/70 mb-1">Want the full experience?</p>
          <p className="text-[11px] text-white/30 mb-4">Host spaces, chat live, earn XP, and explore 1000+ tokens on OG Scan.</p>
          <a
            href="/auth"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-bold hover:from-cyan-400 hover:to-blue-500 transition shadow-lg shadow-cyan-500/20"
          >
            <ExternalLink className="h-4 w-4" />
            Join OG Scan Free
          </a>
        </div>
      </div>

      {/* ── Sticky footer branding ── */}
      <div className="fixed bottom-0 inset-x-0 bg-[#070b10]/95 backdrop-blur-xl border-t border-white/[0.06] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {connected && <><LivePulse /><span className="text-xs text-white/40">Listening live</span></>}
          {!connected && <span className="text-xs text-white/20">OG Scan · Public Spaces</span>}
        </div>
        <a href="/" className="text-[11px] text-cyan-400/50 hover:text-cyan-400 transition">ogscan.fun</a>
      </div>
    </div>
  );
};

export default PublicSpaceListen;
