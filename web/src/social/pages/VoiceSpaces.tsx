import { useMemo, useState } from "react";
import { useSocialStore } from "../hooks/useSocialStore";
import { joinVoice } from "../store/localSocialStore";

const KIND_LABEL: Record<string, string> = {
  trading: "Trading room",
  gaming: "Gaming lobby",
  creator: "Creator room",
  general: "General",
};

export default function VoiceSpaces() {
  const { voice, profiles, currentUserId } = useSocialStore();
  const me = profiles.find((p) => p.id === currentUserId);

  return (
    <div>
      <header className="oxs-hero">
        <h1>Voice spaces</h1>
        <p>Live voice for trading rooms, gaming lobbies, creator AMAs — with host moderation.</p>
      </header>

      <div className="oxs-grid oxs-grid-2">
        {voice.map((v) => {
          const host = profiles.find((p) => p.id === v.hostId);
          return (
            <div key={v.id} className="oxs-panel">
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ marginBottom: "0.35rem" }}>{v.title}</h3>
                  <span className={`oxs-badge ${v.live ? "oxs-badge-mint" : ""}`}>
                    {v.live ? "Live" : "Scheduled"} · {KIND_LABEL[v.kind] || v.kind}
                  </span>
                </div>
                {v.moderated && <span className="oxs-badge oxs-badge-sky">Moderated</span>}
              </div>
              <p className="oxs-muted" style={{ fontSize: "0.82rem", margin: "0.65rem 0" }}>
                Host @{host?.username || "unknown"} · {v.listeners} listening
                {me?.isMod ? " · You have mod tools" : ""}
              </p>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                <button className="oxs-btn" type="button" onClick={() => joinVoice(v.id)}>
                  {v.live ? "Join room" : "Notify me"}
                </button>
                <a href="/voice-rooms" className="oxs-btn oxs-btn-ghost" style={{ textDecoration: "none" }}>
                  LiveKit lobbies
                </a>
                <a href="/spaces" className="oxs-btn oxs-btn-ghost" style={{ textDecoration: "none" }}>
                  Spaces
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div className="oxs-panel" style={{ marginTop: "1rem" }}>
        <h3>Moderation tools</h3>
        <p className="oxs-muted" style={{ fontSize: "0.85rem", margin: 0 }}>
          Mute, remove, and report flows for voice + posts live in the owner moderation desk
          (private URL). Production audio continues via LiveKit in Voice Lobbies / SocialHub.
        </p>
      </div>
    </div>
  );
}
