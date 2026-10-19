/**
 * CommunityVoice — Voice lobby for a community.
 * Each community gets its own LiveKit room: `community-{communityId}`.
 * Anyone viewing the community can join the voice lobby.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Room, RoomEvent, RemoteParticipant, Track } from "livekit-client";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Mic, MicOff, PhoneOff, Volume2, Users } from "lucide-react";

const LIVEKIT_URL = "wss://new-7unnd5e1.livekit.cloud";

interface Props {
  communityId: string;
  communityName: string;
}

interface ParticipantInfo {
  identity: string;
  name: string;
  speaking: boolean;
  muted: boolean;
  isLocal: boolean;
}

export default function CommunityVoice({ communityId, communityName }: Props) {
  const { user } = useAuth();
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [muted, setMuted] = useState(false);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);

  const updateParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const list: ParticipantInfo[] = [];
    // Local
    list.push({
      identity: room.localParticipant.identity,
      name: room.localParticipant.name || room.localParticipant.identity,
      speaking: room.localParticipant.isSpeaking,
      muted: room.localParticipant.isMicrophoneEnabled === false,
      isLocal: true,
    });
    // Remote
    room.remoteParticipants.forEach((p: RemoteParticipant) => {
      list.push({
        identity: p.identity,
        name: p.name || p.identity,
        speaking: p.isSpeaking,
        muted: !p.isMicrophoneEnabled,
        isLocal: false,
      });
    });
    setParticipants(list);
  }, []);

  const join = async () => {
    if (!user || joining || joined) return;
    setJoining(true);
    setError(null);
    try {
      // Get LiveKit token from edge function
      const { data, error: fnError } = await supabase.functions.invoke("livekit-token", {
        body: {
          room: `community-${communityId}`,
          identity: user.id,
          name: user.email?.split("@")[0] || "Member",
        },
      });
      if (fnError) throw fnError;
      const token = data?.token;
      if (!token) throw new Error("No token received");

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected, updateParticipants);
      room.on(RoomEvent.ParticipantDisconnected, updateParticipants);
      room.on(RoomEvent.ActiveSpeakersChanged, updateParticipants);
      room.on(RoomEvent.TrackMuted, updateParticipants);
      room.on(RoomEvent.TrackUnmuted, updateParticipants);
      room.on(RoomEvent.LocalTrackPublished, updateParticipants);

      await room.connect(LIVEKIT_URL, token);
      await room.localParticipant.setMicrophoneEnabled(true);
      setJoined(true);
      updateParticipants();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join voice");
    } finally {
      setJoining(false);
    }
  };

  const leave = async () => {
    await roomRef.current?.disconnect();
    roomRef.current = null;
    setJoined(false);
    setParticipants([]);
  };

  const toggleMute = async () => {
    const room = roomRef.current;
    if (!room) return;
    const newMuted = !muted;
    await room.localParticipant.setMicrophoneEnabled(!newMuted);
    setMuted(newMuted);
    updateParticipants();
  };

  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
    };
  }, []);

  if (!joined) {
    return (
      <div className="p-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600/20">
          <Volume2 className="h-8 w-8 text-blue-400" />
        </div>
        <h3 className="text-lg font-bold text-white">{communityName} Voice Lobby</h3>
        <p className="mt-2 text-sm text-white/50">
          Join the community voice channel. Talk with other members in real-time.
        </p>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <button
          onClick={join}
          disabled={joining || !user}
          className="mt-4 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {joining ? "Joining…" : "Join Voice"}
        </button>
        {!user && <p className="mt-2 text-xs text-white/40">Login to join voice</p>}
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-white/50" />
          <span className="text-sm text-white/60">{participants.length} in voice</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleMute}
            className={`rounded-full p-3 transition-colors ${muted ? "bg-red-600" : "bg-white/10 hover:bg-white/20"}`}
          >
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button
            onClick={leave}
            className="rounded-full bg-red-600 p-3 hover:bg-red-700 transition-colors"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {participants.map((p) => (
          <div
            key={p.identity}
            className={`rounded-xl border p-4 text-center transition-colors ${
              p.speaking ? "border-green-400 bg-green-400/10" : "border-white/10 bg-white/5"
            }`}
          >
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600/30 text-lg font-bold">
              {p.name.charAt(0).toUpperCase()}
            </div>
            <p className="truncate text-sm font-medium">{p.name}</p>
            <p className="text-xs text-white/40">
              {p.isLocal ? "You" : ""} {p.muted ? "🔇" : p.speaking ? "🟢 speaking" : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
