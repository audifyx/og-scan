/**
 * VoiceLobbyBrowser — browse + create + join LiveKit voice lobbies.
 *
 * Sources (no new backend tables required):
 *  - Main Lobby: always-on, room `orbitx-main-lobby`
 *  - Live MCP rooms: read from public `mcp_voice_rooms` (created by Agent MCP)
 *  - Your lobbies: created here, remembered in localStorage
 *  - Join by code: type any lobby name to jump in
 *
 * Voice itself runs on LiveKit via the `livekit-token` edge function
 * (see ./livekitToken.ts). Rooms auto-create on first join.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Mic,
  MicOff,
  PhoneOff,
  Plus,
  Globe,
  Users,
  Loader2,
  Volume2,
  Hash,
  X,
  Radio,
  Crown,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useLiveKit } from "@/hooks/useLiveKit";
import { cn } from "@/lib/utils";
import {
  MAIN_LOBBY_ROOM,
  USER_LOBBY_PREFIX,
  slugifyRoom,
} from "./livekitToken";

interface LobbyEntry {
  id: string; // room name
  name: string;
  topic: string | null;
  kind: "main" | "mcp" | "mine";
  host?: string | null;
  live?: boolean;
}

const MINE_KEY = "orbitx.voice.my-lobbies.v1";

function loadMine(): LobbyEntry[] {
  try {
    const raw = localStorage.getItem(MINE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export default function VoiceLobbyBrowser() {
  const { user } = useAuth();
  const [lobbies, setLobbies] = useState<LobbyEntry[]>([]);
  const [mine, setMine] = useState<LobbyEntry[]>(() => loadMine());
  const [loading, setLoading] = useState(true);
  const [activeRoom, setActiveRoom] = useState<LobbyEntry | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [cName, setCName] = useState("");
  const [cTopic, setCTopic] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);

  const identity = useMemo(
    () => (user?.id ? `web:${user.id}` : ""),
    [user]
  );
  const displayName = useMemo(() => {
    const p = user as any;
    return p?.user_metadata?.username || p?.email?.split("@")[0] || "Trader";
  }, [user]);

  const voice = useLiveKit({
    roomName: activeRoom?.id || "",
    identity,
    displayName,
    autoJoin: false,
  });

  // Live MCP rooms from the public table
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("mcp_voice_rooms")
          .select("slug,name,topic,livekit_room,host_label,status")
          .eq("status", "live")
          .eq("is_private", false)
          .order("created_at", { ascending: false })
          .limit(30);
        if (!cancelled && data) {
          setLobbies(
            (data as any[]).map((r) => ({
              id: r.livekit_room || `mcp-${r.slug}`,
              name: r.name,
              topic: r.topic,
              kind: "mcp" as const,
              host: r.host_label,
              live: true,
            }))
          );
        }
      } catch {
        /* table may not exist — MCP rooms just won't list */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistMine = (list: LobbyEntry[]) => {
    setMine(list);
    try {
      localStorage.setItem(MINE_KEY, JSON.stringify(list));
    } catch {
      /* noop */
    }
  };

  const joinLobby = useCallback(
    async (lobby: LobbyEntry) => {
      if (activeRoom?.id === lobby.id) return;
      if (voice.connected) await voice.leave();
      setActiveRoom(lobby);
      // join after state settles
      setTimeout(() => voice.join(), 50);
    },
    [activeRoom, voice]
  );

  const leaveLobby = useCallback(async () => {
    await voice.leave();
    setActiveRoom(null);
  }, [voice]);

  const createLobby = useCallback(async () => {
    const name = cName.trim();
    if (!name || creating) return;
    setCreating(true);
    const room = USER_LOBBY_PREFIX + slugifyRoom(name);
    const entry: LobbyEntry = {
      id: room,
      name,
      topic: cTopic.trim() || null,
      kind: "mine",
      live: true,
    };
    persistMine([entry, ...mine.filter((m) => m.id !== room)]);
    setCName("");
    setCTopic("");
    setShowCreate(false);
    setCreating(false);
    await joinLobby(entry);
  }, [cName, cTopic, creating, mine, joinLobby]);

  const joinByCode = useCallback(async () => {
    const code = joinCode.trim();
    if (!code) return;
    const room = code.startsWith(USER_LOBBY_PREFIX) || code === MAIN_LOBBY_ROOM
      ? code
      : USER_LOBBY_PREFIX + slugifyRoom(code);
    setJoinCode("");
    setShowJoinCode(false);
    await joinLobby({ id: room, name: code, topic: null, kind: "mine", live: true });
  }, [joinCode, joinLobby]);

  const all: LobbyEntry[] = useMemo(
    () => [
      { id: MAIN_LOBBY_ROOM, name: "Main Lobby", topic: "The always-on OrbitX hangout", kind: "main" as const, live: true },
      ...mine,
      ...lobbies,
    ],
    [mine, lobbies]
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Voice Lobbies</h1>
          <p className="text-sm text-muted-foreground">
            Live voice on LiveKit — jump in the main lobby or start your own.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowJoinCode(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold hover:border-white/30"
          >
            <Hash size={15} /> Join by code
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
          >
            <Plus size={15} /> New lobby
          </button>
        </div>
      </div>

      {!user && (
        <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          Sign in to talk — listening works for everyone, but the mic needs an account.
        </div>
      )}
      {voice.error && (
        <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
          {voice.error}
        </div>
      )}

      {/* In-room panel */}
      {activeRoom && (
        <div className="mb-5 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              <div>
                <div className="font-semibold">{activeRoom.name}</div>
                <div className="text-xs text-muted-foreground">
                  {voice.connecting ? "Connecting…" : voice.connected ? `${voice.participantCount} in room` : "Joining…"}
                </div>
              </div>
            </div>
            <button
              onClick={leaveLobby}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/25"
            >
              <PhoneOff size={15} /> Leave
            </button>
          </div>
          <div className="px-5 py-4">
            {voice.connecting && !voice.connected ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={15} className="animate-spin" /> Connecting to voice…
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <button
                    onClick={() => voice.toggleMute()}
                    disabled={!user}
                    className={cn(
                      "inline-flex h-12 w-12 items-center justify-center rounded-full transition",
                      voice.muted
                        ? "bg-white/10 text-white hover:bg-white/20"
                        : "bg-emerald-400 text-black shadow-[0_0_24px_rgba(52,211,153,0.5)]"
                    )}
                    title={voice.muted ? "Unmute" : "Mute"}
                  >
                    {voice.muted ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>
                  <div className="text-sm">
                    <div className="font-medium">{voice.muted ? "You're muted" : "You're live"}</div>
                    <div className="text-muted-foreground">Tap the mic to {voice.muted ? "talk" : "mute"}</div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {voice.participants.length === 0 && (
                    <div className="text-sm text-muted-foreground">No one else here yet.</div>
                  )}
                  {voice.participants.map((p) => (
                    <div
                      key={p.identity}
                      className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2"
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                          p.isSpeaking ? "bg-emerald-400 text-black" : "bg-white/10 text-white/70"
                        )}
                      >
                        {(p.name || "?").slice(0, 1).toUpperCase()}
                      </span>
                      <span className="flex-1 truncate text-sm font-medium">{p.name}</span>
                      {p.isLocal && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/60">
                          you
                        </span>
                      )}
                      {p.isSpeaking ? (
                        <Volume2 size={15} className="text-emerald-400" />
                      ) : (
                        <span className="text-[11px] text-white/30">{p.isMuted ? "muted" : "listening"}</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Lobby list */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" /> Loading lobbies…
          </div>
        ) : (
          all.map((lobby) => (
            <button
              key={lobby.id}
              onClick={() => joinLobby(lobby)}
              className={cn(
                "group flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition",
                activeRoom?.id === lobby.id
                  ? "border-emerald-400/50 bg-emerald-400/[0.07]"
                  : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
              )}
            >
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                  lobby.kind === "main"
                    ? "bg-gradient-to-br from-blue-500 to-violet-500 text-white"
                    : lobby.kind === "mcp"
                      ? "bg-white/10 text-white/80"
                      : "bg-teal-400/15 text-teal-300"
                )}
              >
                {lobby.kind === "main" ? <Radio size={19} /> : lobby.kind === "mcp" ? <Crown size={18} /> : <Users size={18} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-semibold">{lobby.name}</span>
                  {lobby.kind === "main" && (
                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-300">
                      always on
                    </span>
                  )}
                </span>
                {lobby.topic && <span className="block truncate text-xs text-muted-foreground">{lobby.topic}</span>}
                {lobby.host && <span className="block text-[11px] text-white/40">hosted by {lobby.host}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-300">
                <Globe size={13} /> Join
              </span>
            </button>
          ))
        )}
        {!loading && all.length === 1 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Only the main lobby is live — start your own above.
          </p>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={() => setShowCreate(false)}>
          <div
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0e14] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">New voice lobby</h2>
              <button onClick={() => setShowCreate(false)} className="rounded-full p-1.5 hover:bg-white/10">
                <X size={17} />
              </button>
            </div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">Lobby name</label>
            <input
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              placeholder="e.g. Night traders"
              maxLength={48}
              className="mb-3 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-teal-300/60"
            />
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">Topic (optional)</label>
            <input
              value={cTopic}
              onChange={(e) => setCTopic(e.target.value)}
              placeholder="What are you talking about?"
              maxLength={120}
              className="mb-5 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-teal-300/60"
            />
            <button
              onClick={createLobby}
              disabled={!cName.trim() || creating}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-bold text-black disabled:opacity-40"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Create & join
            </button>
            <p className="mt-3 text-center text-[11px] text-white/40">
              Room code: <span className="font-mono">{USER_LOBBY_PREFIX}{slugifyRoom(cName) || "…"}</span> — share it so friends can join by code.
            </p>
          </div>
        </div>
      )}

      {/* Join-by-code modal */}
      {showJoinCode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={() => setShowJoinCode(false)}>
          <div
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0e14] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Join by code</h2>
              <button onClick={() => setShowJoinCode(false)} className="rounded-full p-1.5 hover:bg-white/10">
                <X size={17} />
              </button>
            </div>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Paste a lobby name or code"
              className="mb-4 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 font-mono text-sm outline-none focus:border-teal-300/60"
            />
            <button
              onClick={joinByCode}
              disabled={!joinCode.trim()}
              className="w-full rounded-full bg-white py-3 text-sm font-bold text-black disabled:opacity-40"
            >
              Join lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
