import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, PhoneOff, Volume2, Users, Radio, Settings2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

interface VoicePanelProps {
  lobbyId: string;
  lobbyName: string;
  autoJoin?: boolean;
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

export const VoicePanel = ({ lobbyId, lobbyName, autoJoin = true }: VoicePanelProps) => {
  const { user, profile } = useAuth();
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"auto" | "push">("auto");
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [pushActive, setPushActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const presenceChannelRef = useRef<any>(null);

  // Auto-join on mount
  useEffect(() => {
    if (autoJoin && user) {
      connectVoice();
    }
    return () => {
      cleanup();
    };
  }, [lobbyId, user?.id]);

  // Presence channel for voice participants
  useEffect(() => {
    if (!connected || !user) return;

    const channel = supabase.channel(`voice-presence-${lobbyId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users: VoiceParticipant[] = Object.entries(state).map(([key, value]: [string, any]) => {
          const p = value[0];
          return {
            id: key,
            user_id: p.user_id,
            username: p.username,
            avatar_url: p.avatar_url,
            is_speaking: p.is_speaking || false,
            is_muted: p.is_muted || false,
            joined_at: p.joined_at || new Date().toISOString(),
          };
        });
        setParticipants(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            username: profile?.username || "User",
            avatar_url: profile?.avatar_url,
            is_speaking: false,
            is_muted: muted,
            joined_at: new Date().toISOString(),
          });
        }
      });

    presenceChannelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [connected, lobbyId, user?.id]);

  // Update presence when muted state changes
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
  }, [muted, speaking]);

  const cleanup = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (presenceChannelRef.current) {
      presenceChannelRef.current.untrack();
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }
  };

  const connectVoice = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analysis for speaking detection
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start muted by default
      stream.getAudioTracks().forEach(t => (t.enabled = false));

      setConnected(true);
      setMuted(true);
      setError("");

      // Start speaking detection loop
      detectSpeaking();
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Microphone access denied. Please allow microphone access.");
      } else {
        setError("Failed to connect to voice. Check your microphone.");
      }
    }
  };

  const detectSpeaking = () => {
    const check = () => {
      if (!analyserRef.current) return;
      const data = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const isSpeaking = avg > 15;
      setSpeaking(isSpeaking);
      animFrameRef.current = requestAnimationFrame(check);
    };
    check();
  };

  const toggleMute = () => {
    if (!streamRef.current) return;
    const newMuted = !muted;
    streamRef.current.getAudioTracks().forEach(t => (t.enabled = !newMuted));
    setMuted(newMuted);
  };

  const handlePushToTalk = useCallback((active: boolean) => {
    if (mode !== "push" || !streamRef.current) return;
    streamRef.current.getAudioTracks().forEach(t => (t.enabled = active));
    setPushActive(active);
    setMuted(!active);
  }, [mode]);

  const disconnect = () => {
    cleanup();
    setConnected(false);
    setMuted(true);
    setParticipants([]);
    setSpeaking(false);
  };

  if (error) {
    return (
      <div className="glass-card rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <Volume2 className="h-4 w-4 text-primary" />
          <span className="text-[10px] font-semibold font-display tracking-wider">VOICE CHAT</span>
        </div>
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
          <p className="text-xs text-destructive">{error}</p>
          <button onClick={connectVoice} className="mt-2 text-[10px] text-primary underline">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden">
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
          <button onClick={() => setShowSettings(!showSettings)} className="p-1 rounded-lg hover:bg-muted/30 text-muted-foreground transition-colors">
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
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${mode === "auto" ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted/20 text-muted-foreground border border-border/20"}`}
            >
              Auto Detect
            </button>
            <button
              onClick={() => { setMode("push"); setMuted(true); streamRef.current?.getAudioTracks().forEach(t => (t.enabled = false)); setShowSettings(false); }}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${mode === "push" ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted/20 text-muted-foreground border border-border/20"}`}
            >
              Push to Talk
            </button>
          </div>
        </div>
      )}

      <div className="p-3">
        {!connected ? (
          <button
            onClick={connectVoice}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 text-green-400 font-semibold text-xs hover:from-green-500/30 hover:to-emerald-500/30 transition-all flex items-center justify-center gap-2"
          >
            <Mic className="h-4 w-4" />
            Connecting to voice...
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
                      src={p.avatar_url || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${p.username}`}
                      className="w-full h-full rounded-full object-cover"
                      alt={p.username}
                    />
                    {p.is_muted && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                        <MicOff className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                    {p.is_speaking && !p.is_muted && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
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

            {/* Controls */}
            <div className="flex items-center justify-center gap-2">
              {mode === "push" ? (
                <button
                  onMouseDown={() => handlePushToTalk(true)}
                  onMouseUp={() => handlePushToTalk(false)}
                  onTouchStart={() => handlePushToTalk(true)}
                  onTouchEnd={() => handlePushToTalk(false)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                    pushActive
                      ? "bg-green-500/20 text-green-400 border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]"
                      : "bg-muted/20 text-muted-foreground border border-border/30"
                  }`}
                >
                  <Mic className="h-4 w-4" />
                  {pushActive ? "Speaking..." : "Hold to Talk"}
                </button>
              ) : (
                <button
                  onClick={toggleMute}
                  className={`p-2.5 rounded-full transition-all ${
                    muted 
                      ? "bg-red-500/20 text-red-400 border border-red-500/30" 
                      : "bg-green-500/20 text-green-400 border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]"
                  }`}
                >
                  {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
              <button
                onClick={disconnect}
                className="p-2.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
              >
                <PhoneOff className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
