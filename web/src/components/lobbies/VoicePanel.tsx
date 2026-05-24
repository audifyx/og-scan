/**
 * VoicePanel v3 — Scalable voice chat: 10 speakers (WebRTC mesh) + 100+ listeners (receive-only).
 *
 * Architecture:
 * - Speakers: full WebRTC mesh between all speakers (up to 10, max 45 peer connections)
 * - Listeners: each listener opens receive-only connections from each speaker
 *   (no mic capture, no outbound audio, only inbound from speakers)
 * - Supabase Presence tracks role ("speaker" | "listener") for each user
 * - Supabase Broadcast handles WebRTC signaling + host commands
 * - Host can promote listeners to speakers, demote speakers, mute speakers
 */
import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import { Mic, MicOff, PhoneOff, Volume2, Radio, Settings2, Phone, Hand, Crown, UserPlus, Shield, Headphones } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { safeAvatarUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type VoiceRole = "speaker" | "listener";

export interface VoicePanelHandle {
  leaveVoice: () => Promise<void>;
  getParticipants: () => VoiceParticipant[];
  promoteToSpeaker: (userId: string) => void;
  demoteToListener: (userId: string) => void;
  muteUser: (userId: string) => void;
}

interface VoicePanelProps {
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

// Free STUN servers for NAT traversal
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
];

const MAX_SPEAKERS_DEFAULT = 10;

export const VoicePanel = forwardRef<VoicePanelHandle, VoicePanelProps>(({
  lobbyId, lobbyName, autoJoin = true, isRecording = false, spaceId, hostId,
  initialRole = "speaker", maxSpeakers = MAX_SPEAKERS_DEFAULT,
  onRecordingSaved, onParticipantsChange, onRoleChange, compact = false,
}, ref) => {
  const { user, profile } = useAuth();
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"auto" | "push">("auto");
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [pushActive, setPushActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [joining, setJoining] = useState(false);
  const [role, setRole] = useState<VoiceRole>(initialRole);

  // Refs for audio & WebRTC
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const presenceChannelRef = useRef<any>(null);
  const signalingChannelRef = useRef<any>(null);
  const connectedRef = useRef(false);
  const mutedRef = useRef(true);
  const userIdRef = useRef<string>("");
  const roleRef = useRef<VoiceRole>(initialRole);
  const participantsRef = useRef<VoiceParticipant[]>([]);

  // Recording refs
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const mixDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  // Keep refs in sync
  useEffect(() => { connectedRef.current = connected; }, [connected]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { userIdRef.current = user?.id ?? ""; }, [user?.id]);
  useEffect(() => { roleRef.current = role; onRoleChange?.(role); }, [role]);
  useEffect(() => { participantsRef.current = participants; onParticipantsChange?.(participants); }, [participants]);

  // Auto-join on mount
  useEffect(() => {
    if (autoJoin && user) {
      joinVoice();
    }
    // Save recording on page unload (best-effort)
    const handleBeforeUnload = () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop(); // triggers onstop → upload
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      leaveVoice();
    };
  }, [lobbyId, user?.id]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    leaveVoice,
    getParticipants: () => participantsRef.current,
    promoteToSpeaker: (userId: string) => sendCommand("promote", userId),
    demoteToListener: (userId: string) => sendCommand("demote", userId),
    muteUser: (userId: string) => sendCommand("force-mute", userId),
  }));

  // ─── Send host command via broadcast ───
  const sendCommand = (cmd: string, targetUserId: string) => {
    signalingChannelRef.current?.send({
      type: "broadcast", event: "command",
      payload: { cmd, from: userIdRef.current, target: targetUserId },
    });
  };

  // ─── Core: Join voice room ───
  const joinVoice = async () => {
    if (!user || connectedRef.current) return;
    setJoining(true);
    try {
      let stream: MediaStream | null = null;

      // Speakers get mic, listeners don't
      if (role === "speaker") {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        localStreamRef.current = stream;
        // Start muted
        stream.getAudioTracks().forEach(t => (t.enabled = false));
        setMuted(true);
        mutedRef.current = true;

        // Set up speaking detection
        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyserRef.current = analyser;
        startSpeakingDetection();

        // Recording mix
        if (isRecording) {
          const mixDest = audioCtx.createMediaStreamAudioDestination();
          mixDestinationRef.current = mixDest;
          source.connect(mixDest);
        }
      }

      // Signaling channel
      const sigCh = supabase.channel(`voice-signal-${lobbyId}`);
      sigCh
        .on("broadcast", { event: "signal" }, ({ payload }) => {
          if (payload.to === user.id) {
            handleSignal(payload.from, payload.data);
          }
        })
        .on("broadcast", { event: "join" }, ({ payload }) => {
          if (payload.user_id !== user.id) {
            handleRemoteJoin(payload.user_id, payload.role);
          }
        })
        .on("broadcast", { event: "leave" }, ({ payload }) => {
          removePeer(payload.user_id);
        })
        .on("broadcast", { event: "role-change" }, ({ payload }) => {
          if (payload.user_id !== user.id) {
            // Remote user changed role — rebuild connections
            removePeer(payload.user_id);
            setTimeout(() => handleRemoteJoin(payload.user_id, payload.role), 300);
          }
        })
        .on("broadcast", { event: "command" }, ({ payload }) => {
          if (payload.target === user.id) {
            handleCommand(payload.cmd, payload.from);
          }
        })
        .subscribe();
      signalingChannelRef.current = sigCh;

      // Presence channel
      const presCh = supabase.channel(`voice-presence-${lobbyId}`, {
        config: { presence: { key: user.id } },
      });
      presCh
        .on("presence", { event: "sync" }, () => {
          const state = presCh.presenceState();
          const users: VoiceParticipant[] = Object.entries(state).map(([key, value]: [string, any]) => {
            const p = value[0];
            return {
              id: key,
              user_id: p.user_id,
              username: p.username,
              avatar_url: p.avatar_url,
              is_speaking: p.is_speaking || false,
              is_muted: p.is_muted ?? true,
              role: p.role || "listener",
              joined_at: p.joined_at || new Date().toISOString(),
            };
          });
          setParticipants(users);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await presCh.track({
              user_id: user.id,
              username: profile?.username || "User",
              avatar_url: profile?.avatar_url,
              is_speaking: false,
              is_muted: true,
              role: role,
              joined_at: new Date().toISOString(),
            });

            // Announce join
            sigCh.send({
              type: "broadcast", event: "join",
              payload: { user_id: user.id, role: role },
            });
          }
        });
      presenceChannelRef.current = presCh;

      setConnected(true);
      connectedRef.current = true;
      setError("");

      // Start recording
      if (isRecording && mixDestinationRef.current) {
        startRecording(mixDestinationRef.current.stream);
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        if (role === "speaker") {
          // Fall back to listener if mic denied
          setRole("listener");
          roleRef.current = "listener";
          setError("Microphone denied. Joining as listener.");
          setTimeout(() => { setError(""); joinVoice(); }, 500);
          setJoining(false);
          return;
        }
        setError("Microphone access denied.");
      } else if (err.name === "NotFoundError") {
        if (role === "speaker") {
          setRole("listener");
          roleRef.current = "listener";
          setError("No microphone found. Joining as listener.");
          setTimeout(() => { setError(""); joinVoice(); }, 500);
          setJoining(false);
          return;
        }
        setError("No microphone found.");
      } else {
        setError("Failed to connect to voice.");
      }
    }
    setJoining(false);
  };

  // ─── Handle remote user joining ───
  const handleRemoteJoin = (remoteUserId: string, remoteRole: VoiceRole) => {
    const myRole = roleRef.current;

    // Speaker ↔ Speaker: full mesh (both create/accept connections)
    if (myRole === "speaker" && remoteRole === "speaker") {
      createPeerConnection(remoteUserId, true, "sendrecv");
    }
    // Speaker → Listener: speaker sends audio to listener (speaker initiates, sendonly)
    else if (myRole === "speaker" && remoteRole === "listener") {
      createPeerConnection(remoteUserId, true, "sendonly");
    }
    // Listener ← Speaker: listener receives from speaker (don't initiate, wait for offer)
    // (handled by the signal handler when speaker sends offer)
  };

  // ─── Handle host commands ───
  const handleCommand = async (cmd: string, fromUserId: string) => {
    // Only accept commands from host
    if (fromUserId !== hostId) return;

    if (cmd === "promote") {
      // Promote to speaker
      await switchRole("speaker");
    } else if (cmd === "demote") {
      // Demote to listener
      await switchRole("listener");
    } else if (cmd === "force-mute") {
      // Force mute
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(t => (t.enabled = false));
      }
      setMuted(true);
      mutedRef.current = true;
    }
  };

  // ─── Switch role (speaker ↔ listener) ───
  const switchRole = async (newRole: VoiceRole) => {
    if (newRole === roleRef.current) return;

    // Close all existing peer connections
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    remoteAudioRef.current.forEach((el) => { el.srcObject = null; el.remove(); });
    remoteAudioRef.current.clear();

    // Stop speaking detection
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    if (newRole === "speaker") {
      // Acquire mic
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        localStreamRef.current = stream;
        stream.getAudioTracks().forEach(t => (t.enabled = false));
        setMuted(true);
        mutedRef.current = true;

        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyserRef.current = analyser;
        startSpeakingDetection();

        if (isRecording && !mixDestinationRef.current) {
          const mixDest = audioCtx.createMediaStreamAudioDestination();
          mixDestinationRef.current = mixDest;
          source.connect(mixDest);
        }
      } catch {
        return; // Can't get mic, stay as listener
      }
    } else {
      // Release mic
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      setMuted(true);
      mutedRef.current = true;
      setSpeaking(false);
    }

    setRole(newRole);
    roleRef.current = newRole;

    // Update presence
    if (presenceChannelRef.current && user) {
      await presenceChannelRef.current.track({
        user_id: user.id,
        username: profile?.username || "User",
        avatar_url: profile?.avatar_url,
        is_speaking: false,
        is_muted: true,
        role: newRole,
        joined_at: new Date().toISOString(),
      });
    }

    // Announce role change so others rebuild connections
    signalingChannelRef.current?.send({
      type: "broadcast", event: "role-change",
      payload: { user_id: user?.id, role: newRole },
    });

    // Re-announce join to rebuild connections with everyone
    setTimeout(() => {
      signalingChannelRef.current?.send({
        type: "broadcast", event: "join",
        payload: { user_id: user?.id, role: newRole },
      });
    }, 500);
  };

  // ─── WebRTC: Create peer connection ───
  const createPeerConnection = async (remoteUserId: string, isInitiator: boolean, direction: "sendrecv" | "sendonly" | "recvonly" = "sendrecv") => {
    if (!user) return;

    // Avoid duplicate connections
    const existing = peersRef.current.get(remoteUserId);
    if (existing) {
      existing.close();
      peersRef.current.delete(remoteUserId);
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current.set(remoteUserId, pc);

    // Add local audio tracks if we're a speaker (sendrecv or sendonly)
    if ((direction === "sendrecv" || direction === "sendonly") && localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // For receive-only (listener), add a transceiver to signal we want to receive
    if (direction === "recvonly") {
      pc.addTransceiver("audio", { direction: "recvonly" });
    }

    // Handle incoming remote audio
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (remoteStream) {
        let audioEl = remoteAudioRef.current.get(remoteUserId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          audioEl.playsInline = true;
          remoteAudioRef.current.set(remoteUserId, audioEl);
        }
        audioEl.srcObject = remoteStream;
        audioEl.play().catch(() => {});

        // Add to recording mix
        if (isRecording && audioContextRef.current && mixDestinationRef.current) {
          try {
            const remoteSource = audioContextRef.current.createMediaStreamSource(remoteStream);
            remoteSource.connect(mixDestinationRef.current);
          } catch { /* ignore */ }
        }
      }
    };

    // Send ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && signalingChannelRef.current) {
        signalingChannelRef.current.send({
          type: "broadcast", event: "signal",
          payload: {
            from: user.id, to: remoteUserId,
            data: { type: "ice-candidate", candidate: event.candidate.toJSON() },
          },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        removePeer(remoteUserId);
      }
    };

    // If initiator, create and send offer
    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        signalingChannelRef.current?.send({
          type: "broadcast", event: "signal",
          payload: {
            from: user.id, to: remoteUserId,
            data: { type: "offer", sdp: offer.sdp, senderRole: roleRef.current },
          },
        });
      } catch (e) {
        console.error("[VoicePanel] Failed to create offer:", e);
      }
    }

    return pc;
  };

  // ─── WebRTC: Handle incoming signals ───
  const handleSignal = async (fromUserId: string, data: any) => {
    if (!user) return;

    if (data.type === "offer") {
      const senderRole: VoiceRole = data.senderRole || "speaker";
      const myRole = roleRef.current;

      // Determine our connection direction based on roles
      let direction: "sendrecv" | "sendonly" | "recvonly" = "sendrecv";
      if (myRole === "listener") {
        direction = "recvonly";
      } else if (myRole === "speaker" && senderRole === "listener") {
        direction = "sendonly";
      }

      const pc = await createPeerConnection(fromUserId, false, direction);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: data.sdp }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        signalingChannelRef.current?.send({
          type: "broadcast", event: "signal",
          payload: {
            from: user.id, to: fromUserId,
            data: { type: "answer", sdp: answer.sdp },
          },
        });
      } catch (e) {
        console.error("[VoicePanel] Failed to handle offer:", e);
      }
    } else if (data.type === "answer") {
      const pc = peersRef.current.get(fromUserId);
      if (pc && pc.signalingState === "have-local-offer") {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: data.sdp }));
        } catch (e) {
          console.error("[VoicePanel] Failed to handle answer:", e);
        }
      }
    } else if (data.type === "ice-candidate") {
      const pc = peersRef.current.get(fromUserId);
      if (pc && data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch { /* safe to ignore */ }
      }
    }
  };

  // ─── Remove a peer ───
  const removePeer = (userId: string) => {
    const pc = peersRef.current.get(userId);
    if (pc) { pc.close(); peersRef.current.delete(userId); }
    const audio = remoteAudioRef.current.get(userId);
    if (audio) { audio.srcObject = null; audio.remove(); remoteAudioRef.current.delete(userId); }
  };

  // ─── Speaking detection ───
  const startSpeakingDetection = () => {
    const check = () => {
      if (!analyserRef.current) return;
      const data = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const isSpeaking = avg > 15 && !mutedRef.current;
      setSpeaking(isSpeaking);
      animFrameRef.current = requestAnimationFrame(check);
    };
    check();
  };

  // ─── Update presence on state changes ───
  useEffect(() => {
    if (presenceChannelRef.current && user && connected) {
      presenceChannelRef.current.track({
        user_id: user.id,
        username: profile?.username || "User",
        avatar_url: profile?.avatar_url,
        is_speaking: speaking && !muted && role === "speaker",
        is_muted: muted,
        role: role,
        joined_at: new Date().toISOString(),
      });
    }
  }, [muted, speaking, connected, role]);

  // ─── Mute / Unmute (speakers only) ───
  const toggleMute = () => {
    if (role !== "speaker" || !localStreamRef.current) return;
    const newMuted = !muted;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
    setMuted(newMuted);
    mutedRef.current = newMuted;
  };

  // ─── Push to Talk ───
  const handlePushToTalk = useCallback((active: boolean) => {
    if (mode !== "push" || role !== "speaker" || !localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(t => (t.enabled = active));
    setPushActive(active);
    setMuted(!active);
    mutedRef.current = !active;
  }, [mode, role]);

  // ─── Recording ───
  const startRecording = (stream: MediaStream) => {
    try {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      recorder.start(1000);
      recorderRef.current = recorder;
      recordingStartRef.current = Date.now();
    } catch (e) {
      console.error("[VoicePanel] Failed to start recording:", e);
    }
  };

  const stopAndSaveRecording = async (): Promise<void> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        const durationSec = Math.round((Date.now() - recordingStartRef.current) / 1000);
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType });
        recordedChunksRef.current = [];
        if (blob.size < 1000 || !spaceId) { console.warn("[VoicePanel] Recording too small or no spaceId, skipping save", blob.size, spaceId); resolve(); return; }
        try {
          const ext = recorder.mimeType.includes("webm") ? "webm" : "mp4";
          const filePath = `${userIdRef.current}/${spaceId}.${ext}`;
          console.log("[VoicePanel] Uploading recording:", filePath, "size:", blob.size, "duration:", durationSec);
          const { error: uploadError } = await supabase.storage
            .from("space-recordings")
            .upload(filePath, blob, { contentType: recorder.mimeType, upsert: true });
          if (uploadError) { console.error("[VoicePanel] Upload failed:", uploadError.message); resolve(); return; }
          const { data: urlData } = supabase.storage.from("space-recordings").getPublicUrl(filePath);
          const url = urlData?.publicUrl;
          if (url) {
            const { error: updateErr } = await supabase.from("spaces").update({ recording_url: url, duration_seconds: durationSec }).eq("id", spaceId);
            if (updateErr) console.error("[VoicePanel] DB update failed:", updateErr.message);
            else console.log("[VoicePanel] Recording saved:", url);
            onRecordingSaved?.(url, durationSec);
          }
        } catch (e) { console.error("[VoicePanel] Recording save error:", e); }
        resolve();
      };
      recorder.stop();
    });
  };

  // ─── Disconnect ───
  const leaveVoice = async () => {
    await stopAndSaveRecording();
    if (signalingChannelRef.current && userIdRef.current) {
      signalingChannelRef.current.send({
        type: "broadcast", event: "leave",
        payload: { user_id: userIdRef.current },
      });
    }
    peersRef.current.forEach((pc, userId) => {
      pc.close();
      const audio = remoteAudioRef.current.get(userId);
      if (audio) { audio.srcObject = null; audio.remove(); }
    });
    peersRef.current.clear();
    remoteAudioRef.current.clear();
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (presenceChannelRef.current) {
      presenceChannelRef.current.untrack();
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }
    if (signalingChannelRef.current) {
      supabase.removeChannel(signalingChannelRef.current);
      signalingChannelRef.current = null;
    }
    setConnected(false);
    connectedRef.current = false;
    setMuted(true);
    mutedRef.current = true;
    setParticipants([]);
    setSpeaking(false);
  };

  // Derived
  const speakers = participants.filter(p => p.role === "speaker");
  const listeners = participants.filter(p => p.role === "listener");
  const speakerCount = speakers.length;
  const isHost = user?.id === hostId;
  const canSpeak = role === "speaker";

  // ─── Error state ───
  if (error) {
    return (
      <div className="og-glass-card rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <Volume2 className="h-4 w-4 text-primary" />
          <span className="text-[10px] font-semibold font-display tracking-wider">VOICE CHAT</span>
        </div>
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
          <p className="text-xs text-destructive">{error}</p>
          <button onClick={() => { setError(""); joinVoice(); }} className="mt-2 text-[10px] text-primary underline">Retry</button>
        </div>
      </div>
    );
  }

  // ─── Render ───
  return (
    <div className="og-glass-card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-primary/10 flex items-center gap-2">
        <div className="relative">
          <Volume2 className={`h-4 w-4 ${connected ? "text-green-400" : "text-primary"}`} />
          {connected && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
        </div>
        <span className="text-[10px] font-semibold font-display tracking-wider">VOICE</span>
        {connected && (
          <>
            <Badge className="ml-auto text-[8px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 h-4 gap-1">
              <Mic className="h-2.5 w-2.5" />{speakerCount}/{maxSpeakers}
            </Badge>
            <Badge className="text-[8px] bg-blue-500/10 text-blue-400 border-blue-500/20 h-4 gap-1">
              <Headphones className="h-2.5 w-2.5" />{listeners.length}
            </Badge>
          </>
        )}
        {connected && (
          <button onClick={() => setShowSettings(!showSettings)} className="p-1 rounded-lg hover:bg-white/[0.04] text-muted-foreground transition-colors">
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Settings dropdown */}
      {showSettings && connected && canSpeak && (
        <div className="px-3 py-2 border-b border-border/20 bg-muted/10 space-y-2">
          <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Voice Mode</p>
          <div className="flex gap-2">
            <button onClick={() => { setMode("auto"); setShowSettings(false); }}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${mode === "auto" ? "bg-primary/15 text-primary border border-primary/30" : "bg-white/[0.03] text-muted-foreground border border-border/20"}`}>
              Auto Detect
            </button>
            <button onClick={() => {
              setMode("push"); setMuted(true); mutedRef.current = true;
              localStreamRef.current?.getAudioTracks().forEach(t => (t.enabled = false));
              setShowSettings(false);
            }}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${mode === "push" ? "bg-primary/15 text-primary border border-primary/30" : "bg-white/[0.03] text-muted-foreground border border-border/20"}`}>
              Push to Talk
            </button>
          </div>
        </div>
      )}

      <div className="p-3">
        {!connected ? (
          <button onClick={joinVoice} disabled={joining}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 text-green-400 font-semibold text-xs hover:from-green-500/30 hover:to-emerald-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            {joining ? <><div className="h-4 w-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" /> Connecting...</> :
              <><Phone className="h-4 w-4" /> Join Voice</>}
          </button>
        ) : (
          <div className="space-y-3">
            {/* Speakers section */}
            {!compact && speakers.length > 0 && (
              <div>
                <p className="text-[8px] font-bold text-white/20 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Mic className="h-2.5 w-2.5" /> Speakers ({speakerCount}/{maxSpeakers})
                </p>
                <div className="flex flex-wrap gap-2">
                  {speakers.map((p) => (
                    <div key={p.id} className="flex flex-col items-center gap-1 group relative">
                      <div className={cn("relative w-10 h-10 rounded-full border-2 transition-all",
                        p.is_speaking && !p.is_muted ? "border-green-400 shadow-[0_0_12px_rgba(34,197,94,0.5)]"
                          : p.is_muted ? "border-red-400/30" : "border-border/30"
                      )}>
                        <img src={safeAvatarUrl(p.avatar_url) || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${p.username}`}
                          className="w-full h-full rounded-full object-cover" alt={p.username}
                          onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=fallback`; }} />
                        {p.is_muted && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                            <MicOff className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                        {p.is_speaking && !p.is_muted && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center animate-pulse">
                            <Mic className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                        {p.user_id === hostId && (
                          <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                            <Crown className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <span className={cn("text-[8px] font-semibold truncate max-w-[48px]",
                        p.user_id === user?.id ? "text-primary" : "text-muted-foreground"
                      )}>
                        {p.user_id === user?.id ? "You" : p.username}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Listeners section (compact) */}
            {!compact && listeners.length > 0 && (
              <div>
                <p className="text-[8px] font-bold text-white/20 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Headphones className="h-2.5 w-2.5" /> Listeners ({listeners.length})
                </p>
                <div className="flex -space-x-1.5">
                  {listeners.slice(0, 8).map((p) => (
                    <div key={p.id} className="w-7 h-7 rounded-full border-2 border-[#0a0f18] bg-white/[0.05] flex items-center justify-center overflow-hidden" title={p.username}>
                      <img src={safeAvatarUrl(p.avatar_url) || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${p.username}`}
                        className="w-full h-full rounded-full object-cover" alt="" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=fallback`; }} />
                    </div>
                  ))}
                  {listeners.length > 8 && (
                    <div className="w-7 h-7 rounded-full border-2 border-[#0a0f18] bg-white/[0.06] flex items-center justify-center">
                      <span className="text-[8px] font-bold text-white/30">+{listeners.length - 8}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {participants.length === 0 && (
              <p className="text-[10px] text-muted-foreground/50 w-full text-center py-2">Connecting...</p>
            )}

            {/* Role indicator & mute status */}
            {canSpeak ? (
              <div className={cn("text-center text-[10px] font-bold py-1.5 rounded-lg border",
                muted ? "bg-red-500/5 border-red-500/15 text-red-400/80" : "bg-green-500/5 border-green-500/15 text-green-400/80"
              )}>
                {muted ? "🔇 You are muted" : "🎤 You are live — others can hear you"}
              </div>
            ) : (
              <div className="text-center text-[10px] font-bold py-1.5 rounded-lg border bg-blue-500/5 border-blue-500/15 text-blue-400/80">
                🎧 Listening — {speakerCount < maxSpeakers ? "raise hand to speak" : "speaker slots full"}
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-2">
              {canSpeak ? (
                mode === "push" ? (
                  <button
                    onMouseDown={() => handlePushToTalk(true)}
                    onMouseUp={() => handlePushToTalk(false)}
                    onTouchStart={(e) => { e.preventDefault(); handlePushToTalk(true); }}
                    onTouchEnd={(e) => { e.preventDefault(); handlePushToTalk(false); }}
                    className={cn("flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 select-none",
                      pushActive ? "bg-green-500/20 text-green-400 border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]"
                        : "bg-white/[0.03] text-muted-foreground border border-border/30"
                    )}>
                    <Mic className="h-4 w-4" />{pushActive ? "Speaking..." : "Hold to Talk"}
                  </button>
                ) : (
                  <button onClick={toggleMute}
                    className={cn("p-3 rounded-full transition-all",
                      muted ? "bg-red-500/20 text-red-400 border-2 border-red-500/40 hover:bg-red-500/30"
                        : "bg-green-500/20 text-green-400 border-2 border-green-500/40 shadow-[0_0_20px_rgba(34,197,94,0.25)] hover:bg-green-500/30"
                    )} title={muted ? "Click to unmute" : "Click to mute"}>
                    {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  </button>
                )
              ) : (
                /* Listener: Request to speak button */
                speakerCount < maxSpeakers && (
                  <button onClick={() => switchRole("speaker")}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/15 transition-all flex items-center justify-center gap-2">
                    <Hand className="h-4 w-4" /> Request to Speak
                  </button>
                )
              )}
              <button onClick={leaveVoice}
                className="p-3 rounded-full bg-red-500/20 text-red-400 border-2 border-red-500/40 hover:bg-red-500/30 transition-colors" title="Leave voice">
                <PhoneOff className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

VoicePanel.displayName = "VoicePanel";
