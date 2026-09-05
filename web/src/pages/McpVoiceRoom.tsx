/**
 * Public LiveKit VC join — anyone with the MCP join link can enter.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Headphones, Loader2, Mic, MicOff, PhoneOff, Radio } from "lucide-react";
import { Room, RoomEvent } from "livekit-client";
import { cn } from "@/lib/utils";

type VcRoom = {
  slug: string;
  name: string;
  topic?: string | null;
  joinUrl?: string;
  livekitRoom?: string;
  host?: string | null;
};

export default function McpVoiceRoom() {
  const { slug } = useParams<{ slug?: string }>();
  const [rooms, setRooms] = useState<VcRoom[]>([]);
  const [room, setRoom] = useState<VcRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(true);
  const [joining, setJoining] = useState(false);
  const lkRef = useRef<Room | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const path = slug ? `/api/mcp-vc?slug=${encodeURIComponent(slug)}` : "/api/mcp-vc?slug=list";
      const r = await fetch(path);
      const text = await r.text();
      let data: { ok?: boolean; message?: string; rooms?: VcRoom[] } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        if (slug) setError("Voice API is not available here (needs /api/mcp-vc).");
        else setRooms([]);
        return;
      }
      if (slug) {
        if (!data?.ok) setError(data?.message || "VC not found");
        else setRoom(data as VcRoom);
      } else {
        setRooms(Array.isArray(data?.rooms) ? data.rooms : []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load VC");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
    return () => {
      lkRef.current?.disconnect();
      lkRef.current = null;
    };
  }, [load]);

  const join = async () => {
    if (!slug) return;
    setJoining(true);
    setError(null);
    try {
      const r = await fetch("/api/mcp-vc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, displayName: "Guest" }),
      });
      const data = await r.json();
      if (!data?.ok) throw new Error(data?.message || "Join failed");
      if (!data.token || !data.livekitUrl) {
        throw new Error(data.tokenError || "LiveKit is not configured on the server yet. The room exists — retry after LIVEKIT_* env is set.");
      }
      const lk = new Room({ adaptiveStream: true, dynacast: true });
      lk.on(RoomEvent.Disconnected, () => setConnected(false));
      await lk.connect(data.livekitUrl, data.token);
      await lk.localParticipant.setMicrophoneEnabled(false);
      lkRef.current = lk;
      setConnected(true);
      setMuted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Join failed");
    } finally {
      setJoining(false);
    }
  };

  const toggleMic = async () => {
    const lk = lkRef.current;
    if (!lk) return;
    const next = muted;
    await lk.localParticipant.setMicrophoneEnabled(next);
    setMuted(!next);
  };

  const leave = async () => {
    await lkRef.current?.disconnect();
    lkRef.current = null;
    setConnected(false);
  };

  return (
    <div className="relative min-h-screen bg-og-ink text-white">
      <div className="pointer-events-none absolute -top-40 left-[20%] h-[520px] w-[520px] rounded-full bg-og-cyan/12 blur-[140px]" />
      <div className="relative mx-auto max-w-lg px-4 py-10">
        <Link to="/app" className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-og-cyan">
          OrbitX · MCP voice
        </Link>
        <h1 className="mt-3 font-display text-2xl font-black">
          {slug ? room?.name || "Voice chat" : "Open VCs"}
        </h1>
        <p className="mt-1 text-sm text-white/50">
          {slug
            ? room?.topic || "Anyone with this link can join from the MCP."
            : "Rooms started from Agent MCP. Pick one and jump in."}
        </p>

        {loading && (
          <div className="mt-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-og-cyan" />
          </div>
        )}
        {error && <p className="mt-6 rounded-xl border border-og-blood/40 bg-og-blood/10 px-4 py-3 text-sm text-og-blood">{error}</p>}

        {!slug && !loading && (
          <ul className="mt-6 space-y-2">
            {rooms.length === 0 && (
              <li className="glass-card px-4 py-6 text-sm text-white/50">No live VCs. Start one from MCP: “start a VC named alpha desk”.</li>
            )}
            {rooms.map((r) => (
              <li key={r.slug}>
                <Link
                  to={`/vc/${r.slug}`}
                  className="glass-card flex items-center gap-3 px-4 py-3 transition hover:border-og-cyan/40"
                >
                  <Radio className="h-4 w-4 text-og-lime" />
                  <div>
                    <div className="text-sm font-bold">{r.name}</div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">{r.slug}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {slug && room && !loading && (
          <div className="glass-card mt-8 p-5">
            <div className="flex items-center gap-2 text-og-lime">
              <Headphones className="h-4 w-4" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em]">LiveKit</span>
            </div>
            <p className="mt-2 text-lg font-black">{room.name}</p>
            {room.host && <p className="text-xs text-white/40">Host {room.host}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              {!connected ? (
                <button
                  type="button"
                  onClick={() => void join()}
                  disabled={joining}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-og-lime px-4 text-sm font-bold text-black disabled:opacity-50"
                >
                  {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                  Join VC
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void toggleMic()}
                    className={cn(
                      "inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 text-sm font-bold",
                      muted ? "border-white/20 text-white/70" : "border-og-lime/50 bg-og-lime/15 text-og-lime",
                    )}
                  >
                    {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {muted ? "Unmute" : "Mute"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void leave()}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-og-blood/40 bg-og-blood/10 px-4 text-sm font-bold text-og-blood"
                  >
                    <PhoneOff className="h-4 w-4" /> Leave
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
