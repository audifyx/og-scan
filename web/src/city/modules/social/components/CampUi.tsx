/**
 * CampUi — camping weekends: Whisper Pines + Stillwater Lake.
 *
 * Live/upcoming schedule from hangoutEngine + campfire voice chat via
 * VoiceChannelPanel (voiceArchitecture: LocalVoiceStub today, LiveKit
 * provider once the token endpoint ships — gaps marked in MODULE.md).
 */

import { useEffect, useState } from "react";
import { fmtCountdown, getHangoutStatus } from "../engine/hangoutEngine";
import { venueById } from "../data/socialData";
import { VoiceChannelPanel } from "./VoiceChannelPanel";

export interface CampUiProps {
  playerHandle: string;
  embedded?: boolean;
}

export function CampUi({ playerHandle, embedded = false }: CampUiProps) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(iv);
  }, [tick]);

  const status = getHangoutStatus();
  const camps = status.live.filter((e) => e.kind === "camp");
  const nextCamp = status.upcoming.find((u) => u.event.kind === "camp");
  const active = camps[0] ?? null;

  return (
    <div className={`oxs-venue ${embedded ? "oxs-embedded" : ""}`}>
      <h2 className="oxs-title">🏕 Camping</h2>
      {active ? (
        <div className="oxs-card oxs-card-live">
          <div className="oxs-row">
            <span className="oxs-live-dot" />
            <strong>{active.title}</strong>
          </div>
          <p className="oxs-muted oxs-small">
            {venueById(active.venueId)?.name} · {active.attendees} campers around the fire
          </p>
          <p className="oxs-small">
            No signal, no charts — just fire, talk, and rumor-grade gossip.
          </p>
        </div>
      ) : (
        <div className="oxs-card">
          <p className="oxs-muted">The hills are quiet right now.</p>
          {nextCamp && (
            <p>
              Next campout: <strong>{nextCamp.event.title}</strong> — in{" "}
              <strong>{fmtCountdown(nextCamp.startsInMs)}</strong>
            </p>
          )}
          <p className="oxs-muted oxs-small">
            Saturdays → Sundays at Whisper Pines / Stillwater Lake. Bring layers.
          </p>
        </div>
      )}

      <VoiceChannelPanel
        channelId={active ? `campfire-${active.id}` : "campfire-hills"}
        kind="campfire"
        label={active ? `${active.title} — fire chat` : "Campfire chat (offline)"}
        npcNames={["Quiet Quinn", "Vice Vic", "Chart Chef"]}
        identity={playerHandle}
      />
      <p className="oxs-muted oxs-small">
        Campfire voice is a local sim today — real multiplayer unlocks when the
        LiveKit token endpoint ships (MODULE.md § voice gaps).
      </p>
    </div>
  );
}
