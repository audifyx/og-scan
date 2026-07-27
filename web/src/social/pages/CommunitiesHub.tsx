import { Link } from "react-router-dom";
import { SocialPageHeader } from "../components/SocialPageHeader";
import { useSocialStore } from "../hooks/useSocialStore";
import { joinCommunity } from "../store/localSocialStore";

export default function CommunitiesHub() {
  const { communities, currentUserId } = useSocialStore();

  return (
    <div>
        <SocialPageHeader title="Explore" subtitle="Discover communities, token rooms, and groups." />

      <div className="oxs-grid oxs-grid-2">
        {communities.map((c) => {
          const joined = c.memberIds.includes(currentUserId);
          return (
            <div key={c.id} className="oxs-community">
              <div className="oxs-community-icon">{c.avatarEmoji}</div>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>{c.name}</h3>
                <span className="oxs-badge oxs-badge-discord">{c.kind}</span>
                {c.holderOnly ? <span className="oxs-badge oxs-badge-live">Holder-only</span> : null}
              </div>
              <p className="oxs-muted" style={{ margin: "0.45rem 0", fontSize: "0.88rem", lineHeight: 1.45 }}>
                {c.description}
              </p>
              <div className="oxs-muted" style={{ fontSize: "0.78rem", marginBottom: "0.75rem" }}>
                {c.memberCount} members · /{c.slug}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button className="oxs-btn" type="button" disabled={joined} onClick={() => joinCommunity(c.id)}>
                  {joined ? "Joined" : "Join server"}
                </button>
                <Link to="/hq/chat" className="oxs-btn oxs-btn-ghost" style={{ textDecoration: "none" }}>
                  Open channels
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="oxs-panel--card">
        <h3>More community surfaces</h3>
        <p className="oxs-muted" style={{ fontSize: "0.88rem", margin: "0 0 0.75rem" }}>
          Full-featured chat, rooms, and spaces live inside the HQ shell:
        </p>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.88rem" }}>
          <Link className="oxs-link" to="/hq/chat">Channels →</Link>
          <Link className="oxs-link" to="/hq/rooms">Rooms →</Link>
          <Link className="oxs-link" to="/hq/spaces">Spaces →</Link>
          <Link className="oxs-link" to="/hq/messages">DMs →</Link>
        </div>
      </div>
    </div>
  );
}
