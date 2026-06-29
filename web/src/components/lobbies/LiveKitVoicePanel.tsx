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
import { toast } from "sonner";

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
  toggleMute: (muted: boolean) => Promise<void>;
  getRoom: () => Room | null;
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
  onMuteChange?: (muted: boolean) => void;
  compact?: boolean;
}

export const LiveKitVoicePanel = forwardRef<VoicePanelHandle, LiveKitVoicePanelProps>(({
  lobbyId, lobbyName, autoJoin = true, isRecording = false, spaceId, hostId,
  initialRole = "speaker", maxSpeakers = 10,
  onRecordingSaved, onParticipantsChange, onRoleChange, onMuteChange, compact = false,
}, ref) => {
  const { user, profile } = useAuth();
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(true);
  const [role, setRole] = useState<VoiceRole>(initialRole);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);

  const roomRef = useRef<Room | null>(null);
  const presenceChannelRef = useRef<any>(null);
  const broadcastChannelRef = useRef<any>(null);
  const dbPromoteChannelRef = useRef<any>(null);
  const connectedRef = useRef(false);
  const mutedRef = useRef(true);
  const roleRef = useRef<VoiceRole>(initialRole);
  const participantsRef = useRef<VoiceParticipant[]>([]);
  const userIdRef = useRef<string>("");
  const sessionIdRef = useRef<string>(typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  const getParticipantIdentity = useCallback((userId?: string | null) => {
    const baseUserId = userId || userIdRef.current;
    return baseUserId ? `${baseUserId}:${sessionIdRef.current}` : "";
  }, []);

  const getUserIdFromIdentity = useCallback((identity: string) => {
    const [baseUserId] = identity.split(":");
    return baseUserId || identity;
  }, []);

  const updateLocalParticipant = useCallback((patch: Partial<VoiceParticipant>) => {
    const localParticipantId = getParticipantIdentity();
    if (!localParticipantId) return;
    setParticipants((prev) => prev.map((participant) =>
      participant.id === localParticipantId
        ? { ...participant, ...patch }
        : participant
    ));
  }, [getParticipantIdentity]);

  // Recording refs
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);

  // Keep refs in sync
  useEffect(() => { connectedRef.current = connected; }, [connected]);
  useEffect(() => { mutedRef.current = muted; onMuteChange?.(muted); }, [muted]);
  useEffect(() => { userIdRef.current = user?.id ?? ""; }, [user?.id]);
  useEffect(() => { roleRef.current = role; onRoleChange?.(role); }, [role]);
  useEffect(() => {
    if (initialRole !== "speaker" || roleRef.current === "speaker") return;

    roleRef.current = "speaker";
    setRole("speaker");
    updateLocalParticipant({ role: "speaker", is_muted: false });

    const room = roomRef.current;
    if (room) {
      room.localParticipant.setMicrophoneEnabled(true).catch((err) => {
        console.error("[LiveKit] Failed to sync host mic after role update:", err);
      });
      setMuted(false);
    }

    presenceChannelRef.current?.track({
      user_id: user?.id || userIdRef.current,
      session_id: getParticipantIdentity(user?.id),
      username: profile?.username || "Anon",
      avatar_url: profile?.avatar_url,
      role: "speaker",
      joined_at: new Date().toISOString(),
    });
  }, [getParticipantIdentity, initialRole, profile?.avatar_url, profile?.username, updateLocalParticipant, user?.id]);
  useEffect(() => {
    if (!user || !presenceChannelRef.current) return;
    presenceChannelRef.current.track({
      user_id: user.id,
      session_id: getParticipantIdentity(user.id),
      username: profile?.username || "Anon",
      avatar_url: profile?.avatar_url,
      role,
      joined_at: new Date().toISOString(),
    });
  }, [getParticipantIdentity, user?.id, profile?.username, profile?.avatar_url, role]);
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
        getParticipantIdentity(user.id),
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
            is_speaking: speakerIds.has(p.id),
          }))
        );
      });

      // Participant events for updating list
      const updateParticipantList = () => {
        if (!roomRef.current) return;
        const r = roomRef.current;
        const allP: VoiceParticipant[] = [];
        const prevById = new Map(participantsRef.current.map((participant) => [participant.id, participant]));
        const presenceState = presenceChannelRef.current?.presenceState?.() ?? {};
        const getLatestPresence = (participantId: string) => {
          const entries = presenceState[participantId] as any[] | undefined;
          return entries && entries.length > 0 ? entries[entries.length - 1] : null;
        };

        // Local participant
        const lp = r.localParticipant;
        if (lp) {
          const prevLocal = prevById.get(lp.identity);
          const localPresence = getLatestPresence(lp.identity);
          allP.push({
            id: lp.identity,
            user_id: user.id,
            username: profile?.username || localPresence?.username || lp.name || prevLocal?.username || "You",
            avatar_url: profile?.avatar_url ?? localPresence?.avatar_url ?? prevLocal?.avatar_url ?? null,
            is_speaking: lp.isSpeaking,
            is_muted: !lp.isMicrophoneEnabled,
            role: roleRef.current,
            joined_at: prevLocal?.joined_at || localPresence?.joined_at || new Date().toISOString(),
          });
        }

        // Remote participants
        r.remoteParticipants.forEach((rp) => {
          const prevRemote = prevById.get(rp.identity);
          const remotePresence = getLatestPresence(rp.identity);
          allP.push({
            id: rp.identity,
            user_id: getUserIdFromIdentity(rp.identity),
            username: remotePresence?.username || prevRemote?.username || rp.name || "Anon",
            avatar_url: remotePresence?.avatar_url || prevRemote?.avatar_url || null,
            is_speaking: rp.isSpeaking,
            is_muted: !rp.isMicrophoneEnabled,
            role: remotePresence?.role || prevRemote?.role || "listener",
            joined_at: prevRemote?.joined_at || remotePresence?.joined_at || new Date().toISOString(),
          });
        });
        setParticipants(allP);
      };

      room.on(RoomEvent.ParticipantConnected, updateParticipantList);
      room.on(RoomEvent.ParticipantDisconnected, updateParticipantList);
      room.on(RoomEvent.TrackMuted, updateParticipantList);
      room.on(RoomEvent.TrackUnmuted, updateParticipantList);

      // Attach remote audio tracks for actual playback
      room.on(RoomEvent.TrackSubscribed, (track, _pub, _participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.setAttribute("data-lk-participant", _participant.identity);
          document.body.appendChild(el);
        }
        updateParticipantList();
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => el.remove());
        updateParticipantList();
      });

      // Connect
      await room.connect(LIVEKIT_URL, token);
      roomRef.current = room;

      // Enable audio playback (handles browser autoplay policy)
      try { await room.startAudio(); } catch {}

      // Speakers: publish mic but start muted. Listeners: ensure mic is off.
      try {
        await room.localParticipant.setMicrophoneEnabled(false);
      } catch {}
      setMuted(true);

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
  }, [getParticipantIdentity, getUserIdFromIdentity, user, lobbyId, profile, initialRole, isRecording]);

  /* ─── Leave voice ─── */
  const leaveVoice = useCallback(async () => {
    try {
      if (recorderRef.current?.state !== "inactive") {
        recorderRef.current?.stop();
      }
    } catch {}
    try {
      // Detach all remote audio elements before disconnecting
      const room = roomRef.current;
      if (room) {
        room.remoteParticipants.forEach((rp) => {
          rp.audioTrackPublications.forEach((pub) => {
            if (pub.track) pub.track.detach().forEach((el) => el.remove());
          });
        });
        room.disconnect();
      }
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
    if (dbPromoteChannelRef.current) {
      if ((dbPromoteChannelRef as any)._pollInterval) {
        clearInterval((dbPromoteChannelRef as any)._pollInterval);
      }
      await supabase.removeChannel(dbPromoteChannelRef.current);
      dbPromoteChannelRef.current = null;
    }
    setConnected(false);
    connectedRef.current = false;
    setParticipants([]);
  }, []);

  /* ─── Supabase Presence for roles ─── */
  const setupPresence = () => {
    if (!user) return;
    const participantIdentity = getParticipantIdentity(user.id);
    const ch = supabase.channel(`lk-presence-${lobbyId}`, {
      config: { presence: { key: participantIdentity } },
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      // Merge presence roles into participants
      setParticipants((prev) =>
        prev.map((p) => {
          const presenceEntries = state[p.id] as any[] | undefined;
          const latestPresence = presenceEntries && presenceEntries.length > 0
            ? presenceEntries[presenceEntries.length - 1]
            : null;

          if (p.id === participantIdentity) {
            return {
              ...p,
              username: profile?.username || latestPresence?.username || p.username,
              avatar_url: profile?.avatar_url ?? latestPresence?.avatar_url ?? p.avatar_url,
              role: roleRef.current,
              is_muted: mutedRef.current,
            };
          }

          if (latestPresence) {
            return {
              ...p,
              username: latestPresence.username || p.username,
              avatar_url: latestPresence.avatar_url || p.avatar_url,
              role: latestPresence.role || p.role,
            };
          }
          return p;
        })
      );
    }).subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({
          user_id: user.id,
          session_id: participantIdentity,
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

    const syncApprovedPromotion = async () => {
      if (!spaceId || roleRef.current === "speaker") return;
      const { data } = await supabase
        .from("speaker_requests")
        .select("id")
        .eq("space_id", spaceId)
        .eq("user_id", user.id)
        .eq("status", "approved")
        .limit(1);

      if (data && data.length > 0 && roleRef.current === "listener") {
        console.log("[LiveKit] Initial approved request detected for", user.id);
        await handleCommand("promote", user.id);
      }
    };

    const ch = supabase.channel(`lk-commands-${lobbyId}`);
    ch.on("broadcast", { event: "command" }, ({ payload }) => {
      if (payload.target !== user.id) return;
      handleCommand(payload.cmd, payload.from);
    }).subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void syncApprovedPromotion();
      }
    });
    broadcastChannelRef.current = ch;

    // Redundant DB-backed promote: subscribe to speaker_requests changes
    // so promote works even if broadcast is missed
    if (spaceId) {
      const handleDbPromote = (payload: any) => {
        const row = (payload.new ?? payload) as any;
        if (row.user_id === user.id && row.status === "approved" && roleRef.current === "listener") {
          console.log("[LiveKit] DB promote detected for", user.id);
          handleCommand("promote", row.user_id);
        }
      };
      const dbCh = supabase.channel(`lk-db-promote-${lobbyId}-${user.id}`)
        .on("postgres_changes", {
          event: "UPDATE",
          schema: "public",
          table: "speaker_requests",
          filter: `space_id=eq.${spaceId}`,
        }, handleDbPromote)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "speaker_requests",
          filter: `space_id=eq.${spaceId}`,
        }, handleDbPromote)
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            void syncApprovedPromotion();
          }
        });
      dbPromoteChannelRef.current = dbCh;

      // Polling fallback: check every 5s if we have an approved request
      const pollInterval = setInterval(async () => {
        if (roleRef.current === "speaker") return;
        const { data } = await supabase.from("speaker_requests")
          .select("status")
          .eq("space_id", spaceId)
          .eq("user_id", user.id)
          .eq("status", "approved")
          .limit(1);
        if (data && data.length > 0 && roleRef.current === "listener") {
          console.log("[LiveKit] Poll detected approved request for", user.id);
          handleCommand("promote", user.id);
        }
      }, 1500);
      // Store interval for cleanup
      (dbPromoteChannelRef as any)._pollInterval = pollInterval;
    }
  };

  const handleCommand = async (cmd: string, _from: string) => {
    const room = roomRef.current;
    if (!room) return;

    switch (cmd) {
      case "promote": {
        // Idempotent: skip if already a speaker
        if (roleRef.current === "speaker") return;
        setRole("speaker");
        roleRef.current = "speaker";
        setMuted(true);
        updateLocalParticipant({ role: "speaker", is_muted: true });

        // Mark the user as on stage immediately even if mic access/publish takes a moment.
        presenceChannelRef.current?.track({
          user_id: user!.id,
          session_id: getParticipantIdentity(user!.id),
          username: profile?.username || "Anon",
          avatar_url: profile?.avatar_url,
          role: "speaker",
          joined_at: new Date().toISOString(),
        });

        try {
          await room.localParticipant.setMicrophoneEnabled(true);
          setMuted(false);
          updateLocalParticipant({ is_muted: false });
        } catch (err) {
          console.error("[LiveKit] Promote mic enable failed:", err);
          toast("You were brought to stage — allow mic access or tap unmute to speak.");
        }

        // Clean up speaker_request so user can re-raise later if demoted
        if (spaceId) {
          supabase.from("speaker_requests").delete().eq("space_id", spaceId).eq("user_id", user!.id);
        }
        break;
      }
      case "demote":
        setRole("listener");
        roleRef.current = "listener";
        updateLocalParticipant({ role: "listener", is_muted: true });
        try {
          await room.localParticipant.setMicrophoneEnabled(false);
        } catch {}
        setMuted(true);
        presenceChannelRef.current?.track({
          user_id: user!.id,
          session_id: getParticipantIdentity(user!.id),
          username: profile?.username || "Anon",
          avatar_url: profile?.avatar_url,
          role: "listener",
          joined_at: new Date().toISOString(),
        });
        break;
      case "force-mute":
        try {
          await room.localParticipant.setMicrophoneEnabled(false);
        } catch {}
        setMuted(true);
        updateLocalParticipant({ is_muted: true });
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
  /* ─── Toggle mute (accepts explicit muted boolean or toggles) ─── */
  const toggleMute = useCallback(async (forceMuted?: boolean) => {
    const room = roomRef.current;
    if (!room) return;
    const newMuted = forceMuted !== undefined ? forceMuted : !muted;
    try {
      await room.localParticipant.setMicrophoneEnabled(!newMuted);
      setMuted(newMuted);
      updateLocalParticipant({ is_muted: newMuted });
    } catch (err) {
      console.error("[LiveKit] toggleMute failed:", err);
      toast("Could not change mic state. Please allow microphone access and try again.");
      setMuted(true);
      updateLocalParticipant({ is_muted: true });
    }
  }, [muted, updateLocalParticipant]);

  useImperativeHandle(ref, () => ({
    leaveVoice,
    saveRecording: stopAndSaveRecording,
    getParticipants: () => participantsRef.current,
    promoteToSpeaker: (userId: string) => {
      // Broadcast for instant response
      sendCommand("promote", userId);
      // DB write as reliable fallback — update existing speaker_request OR insert one
      if (spaceId) {
        supabase.from("speaker_requests")
          .update({ status: "approved" })
          .eq("space_id", spaceId)
          .eq("user_id", userId)
          .eq("status", "pending")
          .then(({ data, error }) => {
            // If no pending request found, insert an approved one directly
            if (!error) {
              supabase.from("speaker_requests")
                .select("id")
                .eq("space_id", spaceId)
                .eq("user_id", userId)
                .eq("status", "approved")
                .then(({ data: existing }) => {
                  if (!existing?.length) {
                    supabase.from("speaker_requests").insert({
                      space_id: spaceId, user_id: userId, status: "approved", username: "promoted",
                    }).then(() => {});
                  }
                });
            }
          });
      }
    },
    demoteToListener: (userId: string) => sendCommand("demote", userId),
    muteUser: (userId: string) => sendCommand("force-mute", userId),
    toggleMute,
    getRoom: () => roomRef.current,
  }));

  /* ─── Auto-join ─── */
  useEffect(() => {
    if (autoJoin && user) {
      joinVoice();
    }
    return () => { leaveVoice(); };
  }, [lobbyId, user?.id]);

  // This component is rendered hidden in Spaces — it provides voice functionality
  // without visible UI (Spaces renders its own participant UI)
  return <div className="hidden" data-livekit-voice data-connected={connected} data-room={lobbyId} />;
});

LiveKitVoicePanel.displayName = "LiveKitVoicePanel";
