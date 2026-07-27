import { Link } from "react-router-dom";
import { SocialPageHeader } from "../components/SocialPageHeader";
import { useSocialStore } from "../hooks/useSocialStore";

export default function CreatorProgram() {
  const { profiles } = useSocialStore();
  const creators = profiles.filter((p) => p.isCreator);

  return (
    <div>
      <SocialPageHeader title="Creator program" subtitle="Featured voices, voice priority, and referral upside." />

      <div className="oxs-grid oxs-grid-2">
        <div className="oxs-panel--card" style={{ margin: 0 }}>
          <h3>Benefits</h3>
          <ul className="oxs-muted" style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.9rem", lineHeight: 1.65 }}>
            <li>Creator badge on profile + feed</li>
            <li>Priority voice room slots</li>
            <li>Elevated referral XP multiplier</li>
            <li>Featured placement on Social HQ</li>
          </ul>
        </div>
        <div className="oxs-panel--card" style={{ margin: 0 }}>
          <h3>How to qualify</h3>
          <ol className="oxs-muted" style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.9rem", lineHeight: 1.65 }}>
            <li>Reach Trusted reputation (1,500 XP)</li>
            <li>Host 3 moderated voice sessions</li>
            <li>Maintain clean mod record</li>
          </ol>
          <Link to="/hq/growth" className="oxs-btn" style={{ display: "inline-block", marginTop: "0.85rem", textDecoration: "none" }}>
            Open growth center
          </Link>
        </div>
      </div>

      <div className="oxs-panel--card">
        <h3>Featured creators</h3>
        <div className="oxs-grid oxs-grid-3" style={{ padding: 0 }}>
          {creators.map((c) => (
            <Link key={c.id} to={`/hq/profile/${c.id}`} className="oxs-community" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="oxs-avatar oxs-avatar--lg">{c.displayName.slice(0, 2).toUpperCase()}</div>
              <div style={{ fontWeight: 800, marginTop: "0.5rem" }}>{c.displayName}</div>
              <div className="oxs-muted" style={{ fontSize: "0.82rem" }}>@{c.username} · {c.followers.length} followers</div>
              <span className="oxs-badge" style={{ marginTop: "0.5rem" }}>Creator</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
