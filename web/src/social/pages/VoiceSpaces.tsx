import { Link } from "react-router-dom";
import { SocialPageHeader } from "../components/SocialPageHeader";
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
      <SocialPageHeader title="Voice spaces" subtitle="Live audio rooms — trading, gaming, and creator AMAs." />

      {voice.map((v) => {
        const host = profiles.find((p) => p.id === v.hostId);
        return (
          <div key={v.id} className="oxs-space-card">
            {v.live ? <div className="oxs-space-live" aria-label="Live" /> : <div style={{ width: 10 }} />}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                <strong style={{ fontSize: "1rem" }}>{v.title}</strong>
                <span className={`oxs-badge ${v.live ? "oxs-badge-live" : ""}`}>
                  {v.live ? "Live" : "Scheduled"}
                </span>
                <span className="oxs-badge oxs-badge-discord">{KIND_LABEL[v.kind] || v.kind}</span>
                {v.moderated ? <span className="oxs-badge oxs-badge-tg">Moderated</span> : null}
              </div>
              <p className="oxs-muted" style={{ fontSize: "0.85rem", margin: "0.4rem 0 0.65rem" }}>
                Host @{host?.username || "unknown"} · {v.listeners} listening
                {me?.isMod ? " · Mod tools enabled" : ""}
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button className="oxs-btn" type="button" onClick={() => joinVoice(v.id)}>
                  {v.live ? "Join space" : "Notify me"}
                </button>
                <Link to="/hq/spaces" className="oxs-btn oxs-btn-ghost" style={{ textDecoration: "none" }}>
                  Full spaces app
                </Link>
              </div>
            </div>
          </div>
        );
      })}

      <div className="oxs-panel--card">
        <h3>Moderation</h3>
        <p className="oxs-muted" style={{ fontSize: "0.88rem", margin: 0 }}>
          Mute, remove, and report flows for voice + posts live in the owner moderation desk. Production audio runs via LiveKit in Spaces and Channels.
        </p>
      </div>
    </div>
  );
}
