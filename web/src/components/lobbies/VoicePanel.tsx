/**
 * VoicePanel — Real two-way voice chat using WebRTC + Supabase Realtime signaling.
 *
 * How it works:
 * 1. Each user captures their mic via getUserMedia
 * 2. Supabase Presence tracks who's in the room
 * 3. Supabase Broadcast channel exchanges WebRTC signaling (SDP offers/answers, ICE candidates)
 * 4. RTCPeerConnection handles actual audio streaming between peers
 * 5. Mute/unmute toggles the local audio track (stops sending audio to peers)
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, PhoneOff, Volume2, Radio, Settings2, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { safeAvatarUrl } from "@/lib/utils";

interface VoicePanelProps {
  lobbyId: string;
  lobbyName: string;
  autoJoin?: boolean;
  isRecording?: boolean;
  spaceId?: string;
  onRecordingSaved?: (url: string, durationSec: number) => void;
}

interface VoiceParticipant {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_speaking: boolean;
  is_muted: boolean;
  joined_at: string;
}

// Free STUN/TURN servers for NAT traversal
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
];

export const VoicePanel = ({ lobbyId, lobbyName, autoJoin = true, isRecording = false, spaceId, onRecordingSaved }: VoicePanelProps) => {
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

  // Recording refs
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const mixDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  // Keep refs in sync
  useEffect(() => { connectedRef.current = connected; }, [connected]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { userIdRef.current = user?.id ?? ""; }, [user?.id]);

  // Auto-join on mount
  useEffect(() => {
    if (autoJoin && user) {
      joinVoice();
    }
    return () => { leaveVoice(); };
  }, [lobbyId, user?.id]);

  // ─── Core: Join voice room ───
  const joinVoice = async () => {
    if (!user || connectedRef.current) return;
    setJoining(true);
    try {
      // 1. Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = stream;

      // Start muted
      stream.getAudioTracks().forEach(t => (t.enabled = false));
      setMuted(true);
      mutedRef.current = true;

      // 2. Set up audio context for speaking detection + recording mix
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;
      startSpeakingDetection();

      // Set up recording mix destination (combines local + all remote audio)
      if (isRecording) {
        const mixDest = audioCtx.createMediaStreamAudioDestination();
        mixDestinationRef.current = mixDest;
        // Add local mic to the mix
        source.connect(mixDest);
      }

      // 3. Set up Supabase signaling channel (for WebRTC SDP/ICE exchange)
      const sigCh = supabase.channel(`voice-signal-${lobbyId}`);
      sigCh
        .on("broadcast", { event: "signal" }, ({ payload }) => {
          if (payload.to === user.id) {
            handleSignal(payload.from, payload.data);
          }
        })
        .on("broadcast", { event: "join" }, ({ payload }) => {
          if (payload.user_id !== user.id) {
            // New user joined — create an offer to them
            createPeerConnection(payload.user_id, true);
          }
        })
        .on("broadcast", { event: "leave" }, ({ payload }) => {
          removePeer(payload.user_id);
        })
        .subscribe();
      signalingChannelRef.current = sigCh;

      // 4. Set up presence channel
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
              joined_at: p.joined_at || new Date().toISOString(),
            };
          });
          setParticipants(users);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            // Track our presence
            await presCh.track({
              user_id: user.id,
              username: profile?.username || "User",
              avatar_url: profile?.avatar_url,
              is_speaking: false,
              is_muted: true,
              joined_at: new Date().toISOString(),
            });

            // Announce join so existing peers create connections to us
            sigCh.send({
              type: "broadcast",
              event: "join",
              payload: { user_id: user.id },
            });
          }
        });
      presenceChannelRef.current = presCh;

      setConnected(true);
      connectedRef.current = true;
      setError("");

      // Start recording if enabled
      if (isRecording && mixDestinationRef.current) {
        startRecording(mixDestinationRef.current.stream);
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Microphone access denied. Please allow microphone access in your browser settings.");
      } else if (err.name === "NotFoundError") {
        setError("No microphone found. Please connect a microphone.");
      } else {
        setError("Failed to connect to voice. Check your microphone.");
      }
    }
    setJoining(false);
  };

  // ─── WebRTC: Create peer connection ───
  const createPeerConnection = async (remoteUserId: string, isInitiator: boolean) => {
    if (!localStreamRef.current || !user) return;

    // Avoid duplicate connections
    const existing = peersRef.current.get(remoteUserId);
    if (existing) {
      existing.close();
      peersRef.current.delete(remoteUserId);
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current.set(remoteUserId, pc);

    // Add our local audio tracks to the connection
    localStreamRef.current.getAudioTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!);
    });

    // Handle incoming remote audio
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (remoteStream) {
        // Create an audio element to play the remote user's audio
        let audioEl = remoteAudioRef.current.get(remoteUserId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          audioEl.playsInline = true;
          remoteAudioRef.current.set(remoteUserId, audioEl);
        }
        audioEl.srcObject = remoteStream;
        audioEl.play().catch(() => { /* autoplay might be blocked, user interaction needed */ });

        // Add remote audio to recording mix
        if (isRecording && audioContextRef.current && mixDestinationRef.current) {
          try {
            const remoteSource = audioContextRef.current.createMediaStreamSource(remoteStream);
            remoteSource.connect(mixDestinationRef.current);
          } catch { /* ignore if already connected */ }
        }
      }
    };

    // Send ICE candidates to the remote peer via signaling channel
    pc.onicecandidate = (event) => {
      if (event.candidate && signalingChannelRef.current) {
        signalingChannelRef.current.send({
          type: "broadcast",
          event: "signal",
          payload: {
            from: user.id,
            to: remoteUserId,
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

    // If we're the initiator, create an offer
    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        signalingChannelRef.current?.send({
          type: "broadcast",
          event: "signal",
          payload: {
            from: user.id,
            to: remoteUserId,
            data: { type: "offer", sdp: offer.sdp },
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
      // Received an offer — create peer connection and send answer
      const pc = await createPeerConnection(fromUserId, false);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: data.sdp }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        signalingChannelRef.current?.send({
          type: "broadcast",
          event: "signal",
          payload: {
            from: user.id,
            to: fromUserId,
            data: { type: "answer", sdp: answer.sdp },
          },
        });
      } catch (e) {
        console.error("[VoicePanel] Failed to handle offer:", e);
      }
    } else if (data.type === "answer") {
      // Received an answer to our offer
      const pc = peersRef.current.get(fromUserId);
      if (pc && pc.signalingState === "have-local-offer") {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: data.sdp }));
        } catch (e) {
          console.error("[VoicePanel] Failed to handle answer:", e);
        }
      }
    } else if (data.type === "ice-candidate") {
      // Received an ICE candidate
      const pc = peersRef.current.get(fromUserId);
      if (pc && data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          // ICE candidates can arrive before remote description is set — safe to ignore
        }
      }
    }
  };

  // ─── Remove a peer connection ───
  const removePeer = (userId: string) => {
    const pc = peersRef.current.get(userId);
    if (pc) {
      pc.close();
      peersRef.current.delete(userId);
    }
    const audio = remoteAudioRef.current.get(userId);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
      remoteAudioRef.current.delete(userId);
    }
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

  // ─── Update presence when mute/speaking changes ───
  useEffect(() => {
    if (presenceChannelRef.current && user && connected) {
      presenceChannelRef.current.track({
        user_id: user.id,
        username: profile?.username || "User",
        avatar_url: profile?.avatar_url,
        is_speaking: speaking && !muted,
        is_muted: muted,
        joined_at: new Date().toISOString(),
      });
    }
  }, [muted, speaking, connected]);

  // ─── Mute / Unmute ───
  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const newMuted = !muted;
    // Enable/disable the actual audio track — this controls what peers receive
    localStreamRef.current.getAudioTracks().forEach(t => {
      t.enabled = !newMuted;
    });
    setMuted(newMuted);
    mutedRef.current = newMuted;
  };

  // ─── Push to Talk ───
  const handlePushToTalk = useCallback((active: boolean) => {
    if (mode !== "push" || !localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(t => (t.enabled = active));
    setPushActive(active);
    setMuted(!active);
    mutedRef.current = !active;
  }, [mode]);

  // ─── Recording ───
  const startRecording = (stream: MediaStream) => {
    try {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.start(1000); // collect data every second
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

        if (blob.size < 1000 || !spaceId) { resolve(); return; } // Skip tiny recordings

        // Upload to Supabase Storage
        try {
          const ext = recorder.mimeType.includes("webm") ? "webm" : "mp4";
          const filePath = `${userIdRef.current}/${spaceId}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("space-recordings")
            .upload(filePath, blob, { contentType: recorder.mimeType, upsert: true });

          if (uploadError) {
            console.error("[VoicePanel] Upload error:", uploadError);
            resolve();
            return;
          }

          const { data: urlData } = supabase.storage.from("space-recordings").getPublicUrl(filePath);
          const url = urlData?.publicUrl;

          if (url) {
            // Save recording URL to the space record
            await supabase.from("spaces").update({ recording_url: url, duration_seconds: durationSec }).eq("id", spaceId);
            onRecordingSaved?.(url, durationSec);
          }
        } catch (e) {
          console.error("[VoicePanel] Failed to save recording:", e);
        }
        resolve();
      };
      recorder.stop();
    });
  };

  // ─── Disconnect ───
  const leaveVoice = async () => {
    // Save recording before cleanup
    await stopAndSaveRecording();

    // Announce departure
    if (signalingChannelRef.current && userIdRef.current) {
      signalingChannelRef.current.send({
        type: "broadcast",
        event: "leave",
        payload: { user_id: userIdRef.current },
      });
    }

    // Close all peer connections
    peersRef.current.forEach((pc, userId) => {
      pc.close();
      const audio = remoteAudioRef.current.get(userId);
      if (audio) { audio.srcObject = null; audio.remove(); }
    });
    peersRef.current.clear();
    remoteAudioRef.current.clear();

    // Stop animation frame
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Remove Supabase channels
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

  const disconnect = async () => {
    await leaveVoice();
  };

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
          {connected && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          )}
        </div>
        <span className="text-[10px] font-semibold font-display tracking-wider">VOICE CHAT</span>
        {connected && (
          <Badge className="ml-auto text-[8px] bg-green-500/10 text-green-400 border-green-500/20 h-4 gap-1">
            <Radio className="h-2.5 w-2.5" />
            {participants.length} in call
          </Badge>
        )}
        {connected && (
          <button onClick={() => setShowSettings(!showSettings)} className="p-1 rounded-lg hover:bg-white/[0.04] text-muted-foreground transition-colors">
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Settings dropdown */}
      {showSettings && connected && (
        <div className="px-3 py-2 border-b border-border/20 bg-muted/10 space-y-2">
          <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Voice Mode</p>
          <div className="flex gap-2">
            <button
              onClick={() => { setMode("auto"); setShowSettings(false); }}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${mode === "auto" ? "bg-primary/15 text-primary border border-primary/30" : "bg-white/[0.03] text-muted-foreground border border-border/20"}`}
            >
              Auto Detect
            </button>
            <button
              onClick={() => {
                setMode("push");
                setMuted(true);
                mutedRef.current = true;
                localStreamRef.current?.getAudioTracks().forEach(t => (t.enabled = false));
                setShowSettings(false);
              }}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${mode === "push" ? "bg-primary/15 text-primary border border-primary/30" : "bg-white/[0.03] text-muted-foreground border border-border/20"}`}
            >
              Push to Talk
            </button>
          </div>
        </div>
      )}

      <div className="p-3">
        {!connected ? (
          <button
            onClick={joinVoice}
            disabled={joining}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 text-green-400 font-semibold text-xs hover:from-green-500/30 hover:to-emerald-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {joining ? (
              <><div className="h-4 w-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" /> Connecting...</>
            ) : (
              <><Phone className="h-4 w-4" /> Join Voice</>
            )}
          </button>
        ) : (
          <div className="space-y-3">
            {/* Participants */}
            <div className="flex flex-wrap gap-2">
              {participants.map((p) => (
                <div key={p.id} className="flex flex-col items-center gap-1 group">
                  <div className={`relative w-10 h-10 rounded-full border-2 transition-all ${
                    p.is_speaking && !p.is_muted
                      ? "border-green-400 shadow-[0_0_12px_rgba(34,197,94,0.5)]"
                      : p.is_muted
                      ? "border-red-400/30"
                      : "border-border/30"
                  }`}>
                    <img
                      src={safeAvatarUrl(p.avatar_url) || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${p.username}`}
                      className="w-full h-full rounded-full object-cover"
                      alt={p.username}
                      onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=fallback`; }}
                    />
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
                  </div>
                  <span className={`text-[8px] font-semibold truncate max-w-[48px] ${
                    p.user_id === user?.id ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {p.user_id === user?.id ? "You" : p.username}
                  </span>
                </div>
              ))}
              {participants.length === 0 && (
                <p className="text-[10px] text-muted-foreground/50 w-full text-center py-2">Connecting...</p>
              )}
            </div>

            {/* Mute status indicator */}
            <div className={`text-center text-[10px] font-bold py-1.5 rounded-lg border ${
              muted
                ? "bg-red-500/5 border-red-500/15 text-red-400/80"
                : "bg-green-500/5 border-green-500/15 text-green-400/80"
            }`}>
              {muted ? "🔇 You are muted" : "🎤 You are live — others can hear you"}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2">
              {mode === "push" ? (
                <button
                  onMouseDown={() => handlePushToTalk(true)}
                  onMouseUp={() => handlePushToTalk(false)}
                  onTouchStart={(e) => { e.preventDefault(); handlePushToTalk(true); }}
                  onTouchEnd={(e) => { e.preventDefault(); handlePushToTalk(false); }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 select-none ${
                    pushActive
                      ? "bg-green-500/20 text-green-400 border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]"
                      : "bg-white/[0.03] text-muted-foreground border border-border/30"
                  }`}
                >
                  <Mic className="h-4 w-4" />
                  {pushActive ? "Speaking..." : "Hold to Talk"}
                </button>
              ) : (
                <button
                  onClick={toggleMute}
                  className={`p-3 rounded-full transition-all ${
                    muted
                      ? "bg-red-500/20 text-red-400 border-2 border-red-500/40 hover:bg-red-500/30"
                      : "bg-green-500/20 text-green-400 border-2 border-green-500/40 shadow-[0_0_20px_rgba(34,197,94,0.25)] hover:bg-green-500/30"
                  }`}
                  title={muted ? "Click to unmute" : "Click to mute"}
                >
                  {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>
              )}
              <button
                onClick={disconnect}
                className="p-3 rounded-full bg-red-500/20 text-red-400 border-2 border-red-500/40 hover:bg-red-500/30 transition-colors"
                title="Leave voice"
              >
                <PhoneOff className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
