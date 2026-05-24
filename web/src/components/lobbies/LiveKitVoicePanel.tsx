/**
 * LiveKitVoicePanel — Drop-in replacement for VoicePanel using LiveKit SFU.
 *
 * Exposes the same VoicePanelHandle interface (leaveVoice, saveRecording,
 * getParticipants, promoteToSpeaker, demoteToListener, muteUser) so
 * Spaces.tsx can use it without changes.
 *
 * Architecture:
 * - All audio via LiveKit SFU (no peer-to-peer mesh)
 * - Token from Supabase Edge Function `livekit-token`
 * - Supabase Presence for role tracking (speaker/listener)
 * - Supabase Broadcast for host commands (promote/demote/mute)
 * - LiveKit handles all WebRTC, TURN/STUN, codec negotiation
 */
import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  LocalParticipant,
  Track,
  ConnectionState,
  LocalTrackPublication,
  RemoteTrackPublication,
} from "livekit-client";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const LIVEKIT_URL = "wss://new-7unnd5e1.livekit.cloud";

// Re-export types from original VoicePanel for compatibility
export type VoiceRole = "speaker" | "listener";

export interface VoicePanelHandle {
  leaveVoice: () => Promise<void>;
  saveRecording: () => Promise<void>;
  getParticipants: () => VoiceParticipant[];
  promoteToSpeaker: (userId: string) => void;
  demoteToListener: (userId: string) => void;
  muteUser: (userId: string) => void;
}

export interface VoiceParticipant {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_speaking: boolean;
  is_muted: boolean;
  role: VoiceRole;
  joined_at: string;
}

interface LiveKitVoicePanelProps {
  lobbyId: string;
  lobbyName: string;
  autoJoin?: boolean;
  isRecording?: boolean;
  spaceId?: string;
  hostId?: string;
  initialRole?: VoiceRole;
  maxSpeakers?: number;
  onRecordingSaved?: (url: string, durationSec: number) => void;
  onParticipantsChange?: (participants: VoiceParticipant[]) => void;
  onRoleChange?: (role: VoiceRole) => void;
  compact?: boolean;
}

export const LiveKitVoicePanel = forwardRef<VoicePanelHandle, LiveKitVoicePanelProps>(({
  lobbyId, lobbyName, autoJoin = true, isRecording = false, spaceId, hostId,
  initialRole = "speaker", maxSpeakers = 10,
  onRecordingSaved, onParticipantsChange, onRoleChange, compact = false,
}, ref) => {
  const { user, profile } = useAuth();
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(true);
  const [role, setRole] = useState<VoiceRole>(initialRole);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);

  const roomRef = useRef<Room | null>(null);
  const presenceChannelRef = useRef<any>(null);
  const broadcastChannelRef = useRef<any>(null);
  const connectedRef = useRef(false);
  const mutedRef = useRef(true);
  const roleRef = useRef<VoiceRole>(initialRole);
  const participantsRef = useRef<VoiceParticipant[]>([]);
  const userIdRef = useRef<string>("");

  // Recording refs
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);

  // Keep refs in sync
  useEffect(() => { connectedRef.current = connected; }, [connected]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { userIdRef.current = user?.id ?? ""; }, [user?.id]);
  useEffect(() => { roleRef.current = role; onRoleChange?.(role); }, [role]);
  useEffect(() => { participantsRef.current = participants; onParticipantsChange?.(participants); }, [participants]);

  /* ─── Fetch LiveKit token ─── */
  const fetchToken = async (roomName: string, identity: string, name: string): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/livekit-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ roomName, identity, name }),
      });
      const data = await resp.json();
      return data?.token || null;
    } catch {
      return null;
    }
  };

  /* ─── Join LiveKit room ─── */
  const joinVoice = useCallback(async () => {
    if (!user || connectedRef.current) return;
    try {
      const token = await fetchToken(
        `space-${lobbyId}`,
        user.id,
        profile?.username || "Anon",
      );
      if (!token) throw new Error("Failed to get LiveKit token");

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      /* Event handlers */
      room.on(RoomEvent.Connected, () => {
        setConnected(true);
        connectedRef.current = true;
      });
      room.on(RoomEvent.Disconnected, () => {
        setConnected(false);
        connectedRef.current = false;
      });

      // Track speaking via ActiveSpeakersChanged
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const speakerIds = new Set(speakers.map((s) => s.identity));
        setParticipants((prev) =>
          prev.map((p) => ({
            ...p,
            is_speaking: speakerIds.has(p.user_id),
          }))
        );
      });

      // Participant events for updating list
      const updateParticipantList = () => {
        if (!roomRef.current) return;
        const r = roomRef.current;
        const allP: VoiceParticipant[] = [];

        // Local participant
        const lp = r.localParticipant;
        if (lp) {
          allP.push({
            id: lp.identity,
            user_id: lp.identity,
            username: lp.name || "You",
            avatar_url: null,
            is_speaking: lp.isSpeaking,
            is_muted: !lp.isMicrophoneEnabled,
            role: roleRef.current,
            joined_at: new Date().toISOString(),
          });
        }

        // Remote participants
        r.remoteParticipants.forEach((rp) => {
          allP.push({
            id: rp.identity,
            user_id: rp.identity,
            username: rp.name || "Anon",
            avatar_url: null,
            is_speaking: rp.isSpeaking,
            is_muted: !rp.isMicrophoneEnabled,
            role: "speaker", // Will be updated by presence
            joined_at: new Date().toISOString(),
          });
        });
        setParticipants(allP);
      };

      room.on(RoomEvent.ParticipantConnected, updateParticipantList);
      room.on(RoomEvent.ParticipantDisconnected, updateParticipantList);
      room.on(RoomEvent.TrackSubscribed, updateParticipantList);
      room.on(RoomEvent.TrackUnsubscribed, updateParticipantList);
      room.on(RoomEvent.TrackMuted, updateParticipantList);
      room.on(RoomEvent.TrackUnmuted, updateParticipantList);

      // Connect
      await room.connect(LIVEKIT_URL, token);
      roomRef.current = room;

      // Publish mic if speaker
      if (initialRole === "speaker") {
        await room.localParticipant.setMicrophoneEnabled(true);
        // Start muted
        await room.localParticipant.setMicrophoneEnabled(false);
        setMuted(true);
      }

      // Set up recording if needed
      if (isRecording) {
        startRecording(room);
      }

      updateParticipantList();

      // Set up Supabase presence for role tracking
      setupPresence();
      // Set up Supabase broadcast for host commands
      setupBroadcast();

    } catch (err: any) {
      console.error("LiveKit join error:", err);
    }
  }, [user, lobbyId, profile, initialRole, isRecording]);

  /* ─── Leave voice ─── */
  const leaveVoice = useCallback(async () => {
    try {
      if (recorderRef.current?.state !== "inactive") {
        recorderRef.current?.stop();
      }
    } catch {}
    try {
      roomRef.current?.disconnect();
      roomRef.current = null;
    } catch {}
    if (presenceChannelRef.current) {
      await supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }
    if (broadcastChannelRef.current) {
      await supabase.removeChannel(broadcastChannelRef.current);
      broadcastChannelRef.current = null;
    }
    setConnected(false);
    connectedRef.current = false;
    setParticipants([]);
  }, []);

  /* ─── Supabase Presence for roles ─── */
  const setupPresence = () => {
    if (!user) return;
    const ch = supabase.channel(`lk-presence-${lobbyId}`, {
      config: { presence: { key: user.id } },
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      // Merge presence roles into participants
      setParticipants((prev) =>
        prev.map((p) => {
          const presenceData = state[p.user_id]?.[0] as any;
          if (presenceData) {
            return {
              ...p,
              username: presenceData.username || p.username,
              avatar_url: presenceData.avatar_url || p.avatar_url,
              role: presenceData.role || p.role,
            };
          }
          return p;
        })
      );
    }).subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({
          user_id: user.id,
          username: profile?.username || "Anon",
          avatar_url: profile?.avatar_url,
          role: roleRef.current,
          joined_at: new Date().toISOString(),
        });
      }
    });
    presenceChannelRef.current = ch;
  };

  /* ─── Supabase Broadcast for host commands ─── */
  const setupBroadcast = () => {
    if (!user) return;
    const ch = supabase.channel(`lk-commands-${lobbyId}`);
    ch.on("broadcast", { event: "command" }, ({ payload }) => {
      if (payload.target !== user.id) return;
      handleCommand(payload.cmd, payload.from);
    }).subscribe();
    broadcastChannelRef.current = ch;
  };

  const handleCommand = async (cmd: string, from: string) => {
    const room = roomRef.current;
    if (!room) return;

    switch (cmd) {
      case "promote":
        setRole("speaker");
        roleRef.current = "speaker";
        await room.localParticipant.setMicrophoneEnabled(true);
        // Update presence
        presenceChannelRef.current?.track({
          user_id: user!.id,
          username: profile?.username || "Anon",
          avatar_url: profile?.avatar_url,
          role: "speaker",
          joined_at: new Date().toISOString(),
        });
        break;
      case "demote":
        setRole("listener");
        roleRef.current = "listener";
        await room.localParticipant.setMicrophoneEnabled(false);
        setMuted(true);
        presenceChannelRef.current?.track({
          user_id: user!.id,
          username: profile?.username || "Anon",
          avatar_url: profile?.avatar_url,
          role: "listener",
          joined_at: new Date().toISOString(),
        });
        break;
      case "force-mute":
        await room.localParticipant.setMicrophoneEnabled(false);
        setMuted(true);
        break;
    }
  };

  const sendCommand = (cmd: string, targetUserId: string) => {
    broadcastChannelRef.current?.send({
      type: "broadcast",
      event: "command",
      payload: { cmd, from: userIdRef.current, target: targetUserId },
    });
  };

  /* ─── Recording ─── */
  const startRecording = (room: Room) => {
    try {
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();

      // Capture local audio
      const localTrack = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      if (localTrack?.track?.mediaStreamTrack) {
        const source = audioCtx.createMediaStreamSource(new MediaStream([localTrack.track.mediaStreamTrack]));
        source.connect(dest);
      }

      // Capture remote audio
      room.remoteParticipants.forEach((rp) => {
        rp.audioTrackPublications.forEach((pub) => {
          if (pub.track?.mediaStreamTrack) {
            const source = audioCtx.createMediaStreamSource(new MediaStream([pub.track.mediaStreamTrack]));
            source.connect(dest);
          }
        });
      });

      const recorder = new MediaRecorder(dest.stream, { mimeType: "audio/webm;codecs=opus" });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      recordingStartRef.current = Date.now();
    } catch (err) {
      console.error("Recording setup error:", err);
    }
  };

  const stopAndSaveRecording = async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        const durationMs = Date.now() - recordingStartRef.current;
        const durationSec = Math.round(durationMs / 1000);
        if (blob.size > 0 && spaceId) {
          const filename = `recordings/space-${spaceId}-${Date.now()}.webm`;
          const { data, error } = await supabase.storage.from("voice-recordings").upload(filename, blob);
          if (!error && data) {
            const { data: urlData } = supabase.storage.from("voice-recordings").getPublicUrl(filename);
            onRecordingSaved?.(urlData.publicUrl, durationSec);
          }
        }
        recordedChunksRef.current = [];
        resolve();
      };
      recorder.stop();
    });
  };

  /* ─── Expose imperative handle ─── */
  useImperativeHandle(ref, () => ({
    leaveVoice,
    saveRecording: stopAndSaveRecording,
    getParticipants: () => participantsRef.current,
    promoteToSpeaker: (userId: string) => sendCommand("promote", userId),
    demoteToListener: (userId: string) => sendCommand("demote", userId),
    muteUser: (userId: string) => sendCommand("force-mute", userId),
  }));

  /* ─── Auto-join ─── */
  useEffect(() => {
    if (autoJoin && user) {
      joinVoice();
    }
    return () => { leaveVoice(); };
  }, [lobbyId, user?.id]);

  /* ─── Toggle mute ─── */
  const toggleMute = async () => {
    const room = roomRef.current;
    if (!room) return;
    const newMuted = !muted;
    await room.localParticipant.setMicrophoneEnabled(!newMuted);
    setMuted(newMuted);
  };

  // This component is rendered hidden in Spaces — it provides voice functionality
  // without visible UI (Spaces renders its own participant UI)
  return <div className="hidden" data-livekit-voice data-connected={connected} data-room={lobbyId} />;
});

LiveKitVoicePanel.displayName = "LiveKitVoicePanel";
