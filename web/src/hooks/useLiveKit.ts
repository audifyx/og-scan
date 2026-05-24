/**
 * useLiveKit — Reusable hook for LiveKit voice rooms.
 * Handles token fetch, Room connection, audio tracks, and participant tracking.
 * Used by both SocialHub voice and Spaces.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  ConnectionState,
} from "livekit-client";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

const LIVEKIT_URL = "wss://new-7unnd5e1.livekit.cloud";

export interface LiveKitParticipant {
  identity: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isLocal: boolean;
  audioTrack: boolean;
  metadata?: Record<string, unknown>;
}

interface UseLiveKitOptions {
  roomName: string;
  identity: string;
  displayName: string;
  autoJoin?: boolean;
  onParticipantsChange?: (participants: LiveKitParticipant[]) => void;
}

export function useLiveKit(options: UseLiveKitOptions) {
  const { roomName, identity, displayName, autoJoin = false, onParticipantsChange } = options;
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(true);
  const [participants, setParticipants] = useState<LiveKitParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const mountedRef = useRef(true);

  // Get token from Supabase edge function
  const getToken = useCallback(async (): Promise<string | null> => {
    if (!identity || !roomName) {
      return null;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${SUPABASE_URL}/functions/v1/livekit-token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            roomName,
            identity,
            name: displayName,
          }),
        }
      );
      if (!resp.ok) throw new Error(`Server error (${resp.status})`);
      const data = await resp.json();
      if (data.token) return data.token;
      if (data.error) throw new Error(data.error);
      throw new Error("No token received");
    } catch (e: any) {
      const msg = e.message === "Failed to fetch"
        ? "Unable to reach voice server — check your connection"
        : `Token error: ${e.message}`;
      setError(msg);
      return null;
    }
  }, [roomName, identity, displayName]);

  // Build participants list from room state
  const syncParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;

    const list: LiveKitParticipant[] = [];

    // Local participant
    const local = room.localParticipant;
    if (local) {
      const localAudio = Array.from(local.audioTrackPublications.values()).some(
        (pub) => pub.track && !pub.isMuted
      );
      list.push({
        identity: local.identity,
        name: local.name || local.identity,
        isSpeaking: local.isSpeaking,
        isMuted: !localAudio,
        isLocal: true,
        audioTrack: local.audioTrackPublications.size > 0,
        metadata: local.metadata ? tryParseJSON(local.metadata) : undefined,
      });
    }

    // Remote participants
    room.remoteParticipants.forEach((p: RemoteParticipant) => {
      const hasAudio = Array.from(p.audioTrackPublications.values()).some(
        (pub) => pub.isSubscribed && pub.track && !pub.isMuted
      );
      list.push({
        identity: p.identity,
        name: p.name || p.identity,
        isSpeaking: p.isSpeaking,
        isMuted: !hasAudio,
        isLocal: false,
        audioTrack: p.audioTrackPublications.size > 0,
        metadata: p.metadata ? tryParseJSON(p.metadata) : undefined,
      });
    });

    setParticipants(list);
    onParticipantsChange?.(list);
  }, [onParticipantsChange]);

  // Connect to room
  const join = useCallback(async () => {
    if (roomRef.current?.state === ConnectionState.Connected) return;
    setConnecting(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        setConnecting(false);
        return;
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true },
      });

      // Wire up events
      room.on(RoomEvent.Connected, () => {
        if (!mountedRef.current) return;
        setConnected(true);
        setConnecting(false);
        syncParticipants();
      });

      room.on(RoomEvent.Disconnected, () => {
        if (!mountedRef.current) return;
        setConnected(false);
        setParticipants([]);
        onParticipantsChange?.([]);
      });

      room.on(RoomEvent.ParticipantConnected, () => syncParticipants());
      room.on(RoomEvent.ParticipantDisconnected, () => syncParticipants());
      room.on(RoomEvent.TrackSubscribed, () => syncParticipants());
      room.on(RoomEvent.TrackUnsubscribed, () => syncParticipants());
      room.on(RoomEvent.TrackMuted, () => syncParticipants());
      room.on(RoomEvent.TrackUnmuted, () => syncParticipants());
      room.on(RoomEvent.ActiveSpeakersChanged, () => syncParticipants());
      room.on(RoomEvent.LocalTrackPublished, () => syncParticipants());
      room.on(RoomEvent.LocalTrackUnpublished, () => syncParticipants());

      room.on(RoomEvent.MediaDevicesError, (e: Error) => {
        console.warn("LiveKit media device error:", e);
        // Don't set error — user might just not have granted mic permission yet
      });

      roomRef.current = room;

      await room.connect(LIVEKIT_URL, token);

      // Enable mic (muted by default)
      try {
        await room.localParticipant.setMicrophoneEnabled(false);
      } catch {
        // mic not available is fine — user can still listen
      }

      setMuted(true);
      syncParticipants();
    } catch (e: any) {
      console.error("LiveKit connect error:", e);
      setError(`Connection failed: ${e.message}`);
      setConnecting(false);
    }
  }, [getToken, syncParticipants, onParticipantsChange]);

  // Leave room
  const leave = useCallback(async () => {
    const room = roomRef.current;
    if (room) {
      await room.disconnect(true);
      roomRef.current = null;
    }
    setConnected(false);
    setMuted(true);
    setParticipants([]);
    onParticipantsChange?.([]);
  }, [onParticipantsChange]);

  // Toggle mute
  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room?.localParticipant) return;

    const newMuted = !muted;
    try {
      await room.localParticipant.setMicrophoneEnabled(!newMuted);
      setMuted(newMuted);
      syncParticipants();
    } catch (e: any) {
      console.error("Mute toggle error:", e);
      setError(`Mic error: ${e.message}`);
    }
  }, [muted, syncParticipants]);

  // Auto-join
  useEffect(() => {
    if (autoJoin && identity && roomName) {
      join();
    }
  }, [autoJoin, identity, roomName]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (roomRef.current) {
        roomRef.current.disconnect(true);
        roomRef.current = null;
      }
    };
  }, []);

  return {
    connected,
    connecting,
    muted,
    participants,
    participantCount: participants.length,
    error,
    join,
    leave,
    toggleMute,
    room: roomRef.current,
  };
}

function tryParseJSON(s: string): Record<string, unknown> | undefined {
  try { return JSON.parse(s); } catch { return undefined; }
}
