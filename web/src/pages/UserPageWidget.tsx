/**
 * UserPageWidget — ogscan.fun/u/:username/widget
 *
 * Ultra-compact embeddable iframe widget for a user's website.
 * No auth, no chrome. 340×200 (scales with container).
 *
 * LIVE state: animated pulsing card, space title, live listener count,
 *   last 3 chat messages (auto-scrolling), volume control, "Listen" CTA
 * OFFLINE state: avatar, last space, time since, "Follow on OGScan" CTA
 * Realtime: updates via Supabase subscriptions — no refresh needed
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  Room, RoomEvent, Track, ConnectionState,
} from "livekit-client";
import {
  Radio, Headphones, Mic, Loader2, Volume2, VolumeX,
  Clock, MessageSquare,
} from "lucide-react";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { safeAvatarUrl } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const LIVEKIT_URL = "wss://new-7unnd5e1.livekit.cloud";

interface Profile {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  page_accent?: string | null;
}
interface Space {
  id: string;
  title: string;
  topic: string | null;
  is_live: boolean;
  listener_count: number;
  ended_at: string | null;
}
interface ChatMsg {
  id: string;
  username: string | null;
  content: string;
  created_at: string;
}

/* ── Accent ── */
const ACCENT: Record<string, { btn: string; dot: string; text: string; glow: string }> = {
  violet:  { btn: "bg-violet-600 hover:bg-violet-500",  dot: "bg-violet-400",   text: "text-violet-400",   glow: "shadow-violet-500/30" },
  sky:     { btn: "bg-sky-600 hover:bg-sky-500",        dot: "bg-sky-400",       text: "text-sky-400",       glow: "shadow-sky-500/30" },
  emerald: { btn: "bg-emerald-600 hover:bg-emerald-500",dot: "bg-emerald-400",   text: "text-emerald-400",   glow: "shadow-emerald-500/30" },
  amber:   { btn: "bg-amber-600 hover:bg-amber-500",    dot: "bg-amber-400",     text: "text-amber-400",     glow: "shadow-amber-500/30" },
  rose:    { btn: "bg-rose-600 hover:bg-rose-500",      dot: "bg-rose-400",      text: "text-rose-400",      glow: "shadow-rose-500/30" },
  cyan:    { btn: "bg-cyan-600 hover:bg-cyan-500",      dot: "bg-cyan-400",      text: "text-cyan-400",      glow: "shadow-cyan-500/30" },
  pink:    { btn: "bg-pink-600 hover:bg-pink-500",      dot: "bg-pink-400",      text: "text-pink-400",      glow: "shadow-pink-500/30" },
  indigo:  { btn: "bg-indigo-600 hover:bg-indigo-500",  dot: "bg-indigo-400",    text: "text-indigo-400",    glow: "shadow-indigo-500/30" },
};
const getA = (k: string | null | undefined) => ACCENT[k ?? "violet"] ?? ACCENT.violet;

function LiveDot({ color = "bg-red-400" }: { color?: string }) {
  return (
    <span className="relative flex h-2 w-2 flex-shrink-0">
      <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", color)} />
      <span className={cn("relative inline-flex rounded-full h-2 w-2", color)} />
    </span>
  );
}

export default function UserPageWidget() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [liveSpace, setLiveSpace] = useState<Space | null>(null);
  const [lastSpace, setLastSpace] = useState<Space | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const roomRef = useRef<Room | null>(null);
  const audios = useRef<Map<string, HTMLAudioElement>>(new Map());
  const chatRef = useRef<HTMLDivElement>(null);

  /* ── Load ── */
  const load = useCallback(async () => {
    if (!username) return;
    const { data: p } = await supabase
      .from("user_profiles")
      .select("user_id, username, display_name, avatar_url, page_accent")
      .eq("username", username)
      .single();

    if (!p) { setLoading(false); return; }
    setProfile(p as Profile);

    const { data: live } = await supabase
      .from("spaces")
      .select("id, title, topic, is_live, listener_count, ended_at")
      .eq("host_id", p.user_id)
      .eq("is_live", true)
      .limit(1)
      .single();

    const liveS = live as Space || null;
    setLiveSpace(liveS);

    if (!liveS) {
      const { data: last } = await supabase
        .from("spaces")
        .select("id, title, topic, is_live, listener_count, ended_at")
        .eq("host_id", p.user_id)
        .eq("is_live", false)
        .not("ended_at", "is", null)
        .order("ended_at", { ascending: false })
        .limit(1)
        .single();
      setLastSpace(last as Space || null);
    }
    setLoading(false);
  }, [username]);

  useEffect(() => { load(); }, [load]);

  /* ── Chat for live space ── */
  useEffect(() => {
    if (!liveSpace) { setMessages([]); return; }
    supabase
      .from("space_chat")
      .select("id, username, content, created_at")
      .eq("space_id", liveSpace.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setMessages(((data as ChatMsg[]) || []).reverse());
        setTimeout(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, 50);
      });

    const ch = supabase
      .channel(`widget-chat-${liveSpace.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "space_chat", filter: `space_id=eq.${liveSpace.id}` }, p => {
        setMessages(prev => {
          const next = [...prev, p.new as ChatMsg].slice(-10);
          setTimeout(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, 30);
          return next;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [liveSpace?.id]);

  /* ── Realtime space updates ── */
  useEffect(() => {
    if (!profile) return;
    const ch = supabase
      .channel(`widget-spaces-${profile.user_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "spaces", filter: `host_id=eq.${profile.user_id}` }, async payload => {
        const sp = payload.new as Space;
        if (sp.is_live) { setLiveSpace(sp); setLastSpace(null); }
        else {
          setLiveSpace(null);
          setLastSpace(sp);
          // Disconnect audio if was connected
          roomRef.current?.disconnect();
          setConnected(false);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile]);

  /* ── Realtime listener count ── */
  useEffect(() => {
    if (!liveSpace) return;
    const ch = supabase
      .channel(`widget-lc-${liveSpace.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "spaces", filter: `id=eq.${liveSpace.id}` }, p => {
        setLiveSpace(prev => prev ? { ...prev, listener_count: (p.new as Space).listener_count } : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [liveSpace?.id]);

  /* ── Audio connect ── */
  const connect = async () => {
    if (!liveSpace || connecting || connected) return;
    setConnecting(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/public-listener-token?space_id=${liveSpace.id}`,
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
    }
  };

  const applyVol = (v: number) => { setVolume(v); audios.current.forEach(a => { a.volume = muted ? 0 : v; }); };
  const toggleMute = () => { const next = !muted; setMuted(next); audios.current.forEach(a => { a.volume = next ? 0 : volume; }); };
  useEffect(() => () => { roomRef.current?.disconnect(); }, []);

  const a = getA(profile?.page_accent);
  const displayName = profile?.display_name || profile?.username || username || "Host";
  const pageUrl = `https://ogscan.fun/u/${username}`;

  if (loading) {
    return (
      <div className="w-full h-full min-h-[180px] bg-[#060811] flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="w-full h-full min-h-[180px] bg-[#060811] flex items-center justify-center p-4">
        <p className="text-white/25 text-xs text-center">@{username} not found</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[180px] bg-[#060811] font-sans flex flex-col overflow-hidden text-white">
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #060811; overflow: hidden; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>

      {liveSpace ? (
        /* ════ LIVE STATE ════ */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center gap-2 px-3 pt-3 pb-2">
            <div className="relative flex-shrink-0">
              <div className="h-8 w-8 rounded-full overflow-hidden border-2 border-white/10">
                <img
                  src={safeAvatarUrl(profile.avatar_url)}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=7c3aed&color=fff&size=32`; }}
                />
              </div>
              {/* Live ring */}
              <div className={cn("absolute -inset-0.5 rounded-full border-2 animate-pulse", a.dot.replace("bg-", "border-"))} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <LiveDot color={a.dot} />
                <span className={cn("text-[10px] font-bold uppercase tracking-wider", a.text)}>Live</span>
              </div>
              <p className="text-[10px] text-white/50 truncate">{displayName}</p>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-white/35 flex-shrink-0">
              <Headphones className="h-2.5 w-2.5" />
              <span className="font-medium text-white/60">{liveSpace.listener_count}</span>
            </div>
          </div>

          {/* Space title */}
          <div className="px-3 pb-2">
            <p className="text-sm font-bold text-white line-clamp-1 leading-tight">{liveSpace.title}</p>
            {liveSpace.topic && <p className={cn("text-[10px] mt-0.5", a.text)}>{liveSpace.topic}</p>}
          </div>

          {/* Chat preview */}
          <div
            ref={chatRef}
            className="flex-1 overflow-y-auto px-3 pb-1 space-y-1 min-h-0"
          >
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <p className="text-[10px] text-white/20">Chat is quiet…</p>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className="flex gap-1.5 text-[10px] leading-relaxed">
                <span className={cn("font-semibold flex-shrink-0", a.text)}>{msg.username || "anon"}:</span>
                <span className="text-white/55 line-clamp-1">{msg.content}</span>
              </div>
            ))}
          </div>

          {/* Audio controls */}
          <div className="px-3 pb-2 pt-1 border-t border-white/8 flex items-center gap-2">
            {!connected ? (
              <button
                onClick={connect}
                disabled={connecting}
                className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold text-white transition-all shadow-lg disabled:opacity-60", a.btn, `shadow-lg ${a.glow}`)}
              >
                {connecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Headphones className="h-3 w-3" />}
                {connecting ? "Connecting…" : "Listen Live"}
              </button>
            ) : (
              <>
                <button onClick={toggleMute} className="h-6 w-6 rounded-md bg-white/8 hover:bg-white/15 flex items-center justify-center flex-shrink-0 transition-all">
                  {muted ? <VolumeX className="h-2.5 w-2.5 text-white/40" /> : <Volume2 className="h-2.5 w-2.5 text-white/60" />}
                </button>
                <input
                  type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                  onChange={e => applyVol(parseFloat(e.target.value))}
                  className="flex-1 h-0.5 cursor-pointer"
                  style={{ accentColor: "#7c3aed" }}
                />
                <div className={cn("flex items-center gap-1 text-[9px] font-semibold flex-shrink-0", a.text)}>
                  <div className="h-1 w-1 rounded-full bg-current animate-pulse" />
                  LIVE
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* ════ OFFLINE STATE ════ */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Host info */}
          <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
            <div className="h-9 w-9 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
              <img
                src={safeAvatarUrl(profile.avatar_url)}
                alt={displayName}
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=111827&color=555&size=36`; }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{displayName}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-white/20 flex-shrink-0" />
                <p className="text-[10px] text-white/35">Not live right now</p>
              </div>
            </div>
          </div>

          {/* Last space or placeholder */}
          <div className="flex-1 flex flex-col justify-center px-3 pb-2">
            {lastSpace ? (
              <div className="bg-white/3 rounded-xl border border-white/8 p-3">
                <div className="flex items-center gap-1 mb-1.5">
                  <Clock className="h-2.5 w-2.5 text-white/25" />
                  <p className="text-[9px] text-white/30 uppercase tracking-wider">Last Space</p>
                </div>
                <p className="text-xs font-semibold text-white/60 line-clamp-2 leading-snug">{lastSpace.title}</p>
                {lastSpace.ended_at && (
                  <p className="text-[10px] text-white/25 mt-1.5">
                    {formatDistanceToNow(new Date(lastSpace.ended_at), { addSuffix: true })}
                    {lastSpace.listener_count > 0 && ` · ${lastSpace.listener_count} listeners`}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-2">
                <Mic className="h-6 w-6 text-white/10" />
                <p className="text-[10px] text-white/20 text-center">No spaces hosted yet</p>
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="px-3 pb-2">
            <a
              href={pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "block w-full py-1.5 rounded-lg text-center text-[11px] font-semibold transition-all",
                "bg-white/5 hover:bg-white/10 border border-white/10 text-white/45 hover:text-white"
              )}
            >
              Follow @{profile.username} on OGScan
            </a>
          </div>
        </div>
      )}

      {/* Branding */}
      <div className="flex items-center justify-center gap-1 py-1.5 border-t border-white/5">
        <Radio className="h-2 w-2 text-violet-400/50" />
        <span className="text-[8px] text-white/18 tracking-wide">ogscan.fun</span>
      </div>
    </div>
  );
}
