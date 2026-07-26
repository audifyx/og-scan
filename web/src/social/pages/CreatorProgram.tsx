import { Link } from "react-router-dom";
import { useSocialStore } from "../hooks/useSocialStore";

export default function CreatorProgram() {
  const { profiles } = useSocialStore();
  const creators = profiles.filter((p) => p.isCreator);

  return (
    <div>
      <header className="oxs-hero">
        <h1>Creator program</h1>
        <p>Amplify voices that host rooms, ship alpha, and grow communities — with reputation and referral upside.</p>
      </header>

      <div className="oxs-grid oxs-grid-2" style={{ marginBottom: "1rem" }}>
        <div className="oxs-panel">
          <h3>Benefits</h3>
          <ul className="oxs-muted" style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.88rem", lineHeight: 1.6 }}>
            <li>Creator badge on profile + feed</li>
            <li>Priority voice room slots</li>
            <li>Elevated referral XP multiplier</li>
            <li>Access to Alpha Desk tooling</li>
            <li>Featured placement on Social HQ</li>
          </ul>
        </div>
        <div className="oxs-panel">
          <h3>How to qualify</h3>
          <ol className="oxs-muted" style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.88rem", lineHeight: 1.6 }}>
            <li>Reach Trusted reputation (1,500 XP)</li>
            <li>Host 3 moderated voice sessions</li>
            <li>Maintain clean mod record</li>
            <li>Apply via Growth referrals + profile</li>
          </ol>
          <Link to="/hq/growth" className="oxs-btn" style={{ display: "inline-block", marginTop: "0.9rem", textDecoration: "none" }}>
            Open growth center
          </Link>
        </div>
      </div>

      <div className="oxs-panel">
        <h3>Featured creators</h3>
        <div className="oxs-grid oxs-grid-3">
          {creators.map((c) => (
            <Link
              key={c.id}
              to={`/hq/profile/${c.id}`}
              style={{ textDecoration: "none", color: "inherit", border: "1px solid var(--oxs-line)", borderRadius: 8, padding: "0.85rem" }}
            >
              <div className="oxs-avatar" style={{ marginBottom: "0.5rem" }}>
                {c.displayName.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ fontWeight: 700 }}>{c.displayName}</div>
              <div className="oxs-muted" style={{ fontSize: "0.78rem" }}>
                @{c.username} · {c.followers.length} followers
              </div>
              <span className="oxs-badge" style={{ marginTop: "0.45rem" }}>
                Creator
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
