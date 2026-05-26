/**
 * EmbedSpace — ogscan.fun/embed/space/:spaceId
 *
 * Embeddable no-chrome live space player for iframes.
 * - No navigation / header / sidebar
 * - Connects to LiveKit in listen-only mode (public listener token)
 * - Shows: space title, host, listener count, live chat (read-only), volume
 * - "Open Full" link to ogscan.fun/space/:spaceId
 * - Designed to be embedded in any website via iframe
 *
 * Host copies this embed code from their Host Controls panel.
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { safeAvatarUrl } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const LIVEKIT_URL = "wss://new-7unnd5e1.livekit.cloud";

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

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
    </span>
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
  const roomRef = useRef<Room | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const chatRef = useRef<HTMLDivElement>(null);
  const publicUrl = `https://ogscan.fun/space/${spaceId}`;

  /* ── Fetch space ── */
  useEffect(() => {
    async function load() {
      if (!spaceId) return;
      const { data } = await supabase.from("spaces").select("*").eq("id", spaceId).single();
      setSpace(data as Space || null);
      setLoading(false);
    }
    load();

    // Realtime space updates
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
      .limit(30)
      .then(({ data }) => {
        setMessages(((data as ChatMsg[]) || []).reverse());
        setTimeout(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, 100);
      });

    const ch = supabase
      .channel(`embed-chat-${spaceId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "space_chat", filter: `space_id=eq.${spaceId}` }, (p) => {
        setMessages(prev => {
          const next = [...prev, p.new as ChatMsg].slice(-50);
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
      });
      room.on(RoomEvent.TrackUnsubscribed, (_t, _p, participant) => {
        const el = audioRefs.current.get(participant.sid);
        if (el) { el.pause(); el.srcObject = null; audioRefs.current.delete(participant.sid); }
      });
      room.on(RoomEvent.Disconnected, () => { setConnected(false); });
      room.on(RoomEvent.ConnectionStateChanged, (s) => {
        if (s === ConnectionState.Connected) { setConnected(true); setConnecting(false); }
      });

      await room.connect(LIVEKIT_URL, token);
      roomRef.current = room;
    } catch {
      setConnecting(false);
    }
  }, [spaceId, connecting, connected, volume]);

  /* ── Volume control ── */
  const applyVolume = (v: number) => {
    setVolume(v);
    audioRefs.current.forEach(el => { el.volume = muted ? 0 : v; });
  };
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    audioRefs.current.forEach(el => { el.volume = next ? 0 : volume; });
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
    <div className="w-full h-full min-h-[220px] bg-[#060811] font-sans flex flex-col text-white">
      <style>{`* { margin: 0; padding: 0; box-sizing: border-box; } body { background: #060811; }`}</style>

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-white/8">
        {/* Host avatar */}
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
          <p className="text-xs font-semibold text-white truncate">{space.title}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!ended && <div className="flex items-center gap-1"><LiveDot /><span className="text-[9px] text-white/40 uppercase tracking-wider">Live</span></div>}
          {ended && <span className="text-[9px] text-white/30 uppercase tracking-wider">Ended</span>}
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/60 transition-all">
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] text-white/30 border-b border-white/5">
        <span className="flex items-center gap-0.5"><Headphones className="h-2.5 w-2.5" /> {space.listener_count}</span>
        <span className="flex items-center gap-0.5"><Mic className="h-2.5 w-2.5" /> {space.speaker_count} speakers</span>
        {space.topic && <span className="text-white/20">{space.topic}</span>}
      </div>

      {/* ── Chat ── */}
      <div ref={chatRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-1 py-4">
            <MessageSquare className="h-4 w-4 text-white/15" />
            <p className="text-[10px] text-white/20">No messages yet</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className="flex gap-1.5">
            <span className="text-[10px] text-violet-400 font-medium flex-shrink-0">{msg.username || "anon"}</span>
            <span className="text-[10px] text-white/60 leading-relaxed">{msg.content}</span>
          </div>
        ))}
      </div>

      {/* ── Controls ── */}
      {!ended && (
        <div className="px-3 py-2 border-t border-white/8 flex items-center gap-2">
          {!connected ? (
            <button
              onClick={connect}
              disabled={connecting}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs font-semibold text-white transition-all"
            >
              {connecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Headphones className="h-3 w-3" />}
              {connecting ? "Connecting…" : "Listen Live"}
            </button>
          ) : (
            <>
              <button
                onClick={toggleMute}
                className="flex items-center justify-center h-7 w-7 rounded-lg bg-white/8 hover:bg-white/15 border border-white/10 transition-all"
              >
                {muted ? <VolumeX className="h-3 w-3 text-white/40" /> : <Volume2 className="h-3 w-3 text-white/60" />}
              </button>
              <input
                type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                onChange={e => applyVolume(parseFloat(e.target.value))}
                className="flex-1 h-1 accent-violet-500 cursor-pointer"
              />
              <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </div>
            </>
          )}
        </div>
      )}

      {ended && (
        <div className="px-3 py-2 border-t border-white/8">
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-1.5 rounded-lg bg-white/5 border border-white/10 text-center text-[10px] text-white/40 hover:text-white/60 transition-all"
          >
            View Replay on OGScan →
          </a>
        </div>
      )}

      {/* Branding */}
      <div className="px-3 py-1.5 flex items-center justify-center gap-1">
        <Radio className="h-2 w-2 text-violet-400/40" />
        <span className="text-[8px] text-white/15">ogscan.fun</span>
      </div>
    </div>
  );
}
