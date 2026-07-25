import { Link } from "react-router-dom";
import { useSocialStore } from "../hooks/useSocialStore";
import { joinCommunity } from "../store/localSocialStore";

export default function CommunitiesHub() {
  const { communities, currentUserId } = useSocialStore();

  return (
    <div>
      <header className="oxs-hero">
        <h1>Communities & groups</h1>
        <p>Public groups, token communities, and discussion homes connecting traders and gamers.</p>
      </header>

      <div className="oxs-grid oxs-grid-2">
        {communities.map((c) => {
          const joined = c.memberIds.includes(currentUserId);
          return (
            <div key={c.id} className="oxs-panel">
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <div className="oxs-avatar" style={{ fontSize: "1.1rem" }}>
                  {c.avatarEmoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0 }}>{c.name}</h3>
                    <span className="oxs-badge">{c.kind}</span>
                    {c.holderOnly && <span className="oxs-badge oxs-badge-mint">Holder-only</span>}
                  </div>
                  <p className="oxs-muted" style={{ margin: "0.4rem 0", fontSize: "0.85rem" }}>
                    {c.description}
                  </p>
                  <div className="oxs-muted" style={{ fontSize: "0.75rem", marginBottom: "0.65rem" }}>
                    {c.memberCount} members · /{c.slug}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    <button
                      className="oxs-btn"
                      type="button"
                      disabled={joined}
                      onClick={() => joinCommunity(c.id)}
                    >
                      {joined ? "Joined" : "Join"}
                    </button>
                    <Link to={`/hq/trading`} className="oxs-btn oxs-btn-ghost" style={{ textDecoration: "none" }}>
                      Rooms
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="oxs-panel" style={{ marginTop: "1rem" }}>
        <h3>Deep community surfaces</h3>
        <p className="oxs-muted" style={{ fontSize: "0.85rem", margin: "0 0 0.75rem" }}>
          Existing production community apps remain available:
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", fontSize: "0.85rem" }}>
          <a className="oxs-link" href="/community">
            X-style community →
          </a>
          <a className="oxs-link" href="/community-classic">
            Discord classic →
          </a>
          <a className="oxs-link" href="/rooms">
            Community rooms →
          </a>
        </div>
      </div>
    </div>
  );
}
