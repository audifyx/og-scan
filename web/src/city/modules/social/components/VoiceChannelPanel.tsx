/**
 * VoiceChannelPanel — join/leave, participant list, mic meter, push-to-talk.
 * Written against the VoiceProvider seam; lights up for real multiplayer
 * when the LiveKit token endpoint ships (see engine/voiceArchitecture.ts).
 */

import { useVoice } from "../hooks/useVoice";
import type { VoiceChannelKind } from "../types";

export function VoiceChannelPanel({
  channelId,
  kind,
  label,
  npcNames = [],
  identity,
  compact = false,
}: {
  channelId: string;
  kind: VoiceChannelKind;
  label: string;
  npcNames?: string[];
  identity: string;
  compact?: boolean;
}) {
  const v = useVoice();

  const joinLabel =
    kind === "campfire" ? "Join campfire chat" : kind === "openmic" ? "Join stage audio" : "Join party channel";

  if (!v.joined) {
    return (
      <div className={`oxs-voice ${compact ? "oxs-voice-compact" : ""}`}>
        <div className="oxs-voice-head">
          <span className="oxs-voice-title">🔊 {label}</span>
          {v.providerKind === "local" && <span className="oxs-chip">local sim</span>}
        </div>
        <p className="oxs-muted">
          {kind === "campfire"
            ? "Voice chat around the fire. Push-to-talk, mute by default."
            : kind === "openmic"
              ? "Stage audio for open mic. The room hears you when you hold TALK."
              : "Party channel. Talk over the music."}
        </p>
        {v.error && <p className="oxs-error">{v.error}</p>}
        <button
          className="oxs-btn oxs-btn-primary"
          disabled={v.joining}
          onClick={() => v.join(channelId, kind, identity)}
        >
          {v.joining ? "Joining…" : joinLabel}
        </button>
        {npcNames.length > 0 && (
          <p className="oxs-muted oxs-small">Usually hanging around: {npcNames.slice(0, 4).join(", ")}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`oxs-voice ${compact ? "oxs-voice-compact" : ""}`}>
      <div className="oxs-voice-head">
        <span className="oxs-voice-title">
          <span className="oxs-live-dot" /> {label}
        </span>
        <button className="oxs-btn oxs-btn-ghost" onClick={v.leave}>
          Leave
        </button>
      </div>
      <div className="oxs-participants">
        {v.participants.map((p) => (
          <div key={p.id} className={`oxs-participant ${p.speaking ? "speaking" : ""}`}>
            <span
              className="oxs-mic-dot"
              style={{ opacity: 0.25 + p.level * 0.75, background: p.speaking ? "#4ade80" : "#64748b" }}
            />
            <span className="oxs-participant-name">{p.name}</span>
            {p.muted && <span className="oxs-muted oxs-small">muted</span>}
          </div>
        ))}
        {v.participants.length === 0 && <p className="oxs-muted">Quiet… for now.</p>}
      </div>
      <div className="oxs-voice-controls">
        <button
          className={`oxs-btn ${v.muted ? "oxs-btn-primary" : "oxs-btn-ghost"}`}
          onClick={() => v.setMuted(!v.muted)}
        >
          {v.muted ? "🔇 Unmute" : "🎙 Mute"}
        </button>
        <button
          className="oxs-btn oxs-btn-talk"
          disabled={v.muted}
          onPointerDown={() => v.setTalking(true)}
          onPointerUp={() => v.setTalking(false)}
          onPointerLeave={() => v.setTalking(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          HOLD TO TALK
        </button>
        <div className="oxs-meter" aria-hidden>
          <div className="oxs-meter-fill" style={{ width: `${Math.round(v.level * 100)}%` }} />
        </div>
      </div>
      {v.providerKind === "local" && (
        <p className="oxs-muted oxs-small">
          Local voice sim — real multiplayer unlocks when the LiveKit token endpoint ships (GAP-1).
        </p>
      )}
    </div>
  );
}
