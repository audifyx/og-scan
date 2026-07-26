import { Suspense, lazy, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Mic, MicOff, PhoneOff, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import type { VoicePanelHandle, VoiceParticipant } from "@/components/lobbies/LiveKitVoicePanel";

const LiveKitVoicePanel = lazy(() =>
  import("@/components/lobbies/LiveKitVoicePanel").then((m) => ({ default: m.LiveKitVoicePanel })),
);

/**
 * Soft UI voice plaza — LiveKit is headless (Spaces owns its chrome),
 * so OrbitX City wraps it with mute / leave / roster controls.
 */
export function VoicePanel() {
  const { user } = useAuth();
  const { voiceOpen, setVoiceOpen, lobby } = useCity();
  const voiceRef = useRef<VoicePanelHandle>(null);
  const [muted, setMuted] = useState(true);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="oxc-stack">
        <p className="oxc-muted">Sign in to join lobby voice. Voice needs a live OrbitX account + LiveKit token.</p>
        <Link className="oxc-btn primary" to="/auth">
          Sign in <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  const roomId = lobby?.id || "oxc-main-lobby";
  const roomName = lobby?.label || "OrbitX City Lobby";

  const leave = async () => {
    try {
      await voiceRef.current?.leaveVoice();
    } catch {
      /* ignore */
    }
    setVoiceOpen(false);
    setParticipants([]);
  };

  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    try {
      await voiceRef.current?.toggleMute(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mic toggle failed");
    }
  };

  return (
    <div className="oxc-stack">
      <p className="oxc-muted">
        Voice channel for <strong>{roomName}</strong>. Talk while you walk — powered by LiveKit.
      </p>

      {!voiceOpen ? (
        <button type="button" className="oxc-btn primary" onClick={() => { setError(null); setVoiceOpen(true); }}>
          Join lobby voice
        </button>
      ) : (
        <>
          <div className="oxc-voice-shell">
            <div className="oxc-voice-status">
              <span className="oxc-voice-live">LIVE</span>
              <span>{roomName}</span>
              <em>
                <Users className="h-3.5 w-3.5" /> {Math.max(participants.length, 1)}
              </em>
            </div>

            <div className="oxc-voice-roster">
              {participants.length === 0 && (
                <div className="oxc-muted">Connecting… you&apos;ll appear here once LiveKit links.</div>
              )}
              {participants.map((p) => (
                <div key={p.id} className={`oxc-voice-peer ${p.is_speaking ? "speaking" : ""}`}>
                  <span>@{p.username}</span>
                  <small>{p.role}{p.is_muted ? " · muted" : ""}</small>
                </div>
              ))}
            </div>

            <div className="oxc-actions">
              <button type="button" className="oxc-btn primary compact" onClick={toggleMute}>
                {muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                {muted ? "Unmute" : "Mute"}
              </button>
              <button type="button" className="oxc-btn ghost compact" onClick={leave}>
                <PhoneOff className="h-3.5 w-3.5" /> Leave
              </button>
            </div>

            {error && <p className="oxc-muted">{error}</p>}

            <Suspense fallback={<div className="oxc-muted">Loading voice…</div>}>
              <LiveKitVoicePanel
                ref={voiceRef}
                lobbyId={roomId}
                lobbyName={`OrbitX City · ${roomName}`}
                autoJoin
                compact
                initialRole="speaker"
                onParticipantsChange={setParticipants}
                onMuteChange={setMuted}
              />
            </Suspense>
          </div>
        </>
      )}

      <Link className="oxc-btn ghost" to="/spaces">
        Open Spaces <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
