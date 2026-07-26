import { Link } from "react-router-dom";
import { useCurrentProfile, useSocialStore } from "../hooks/useSocialStore";
import { progressToNext } from "../growth/xp";

export default function SocialHome() {
  const { posts, communities, voice, profiles } = useSocialStore();
  const me = useCurrentProfile();
  const prog = progressToNext(me?.xp ?? 0);
  const live = voice.filter((v) => v.live).length;

  return (
    <div>
      <header className="oxs-hero">
        <h1>OrbitX</h1>
        <p>
          Social network for traders, gamers, and communities — feeds, holder rooms, live voice, referrals, and reputation in one HQ.
        </p>
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link to="/hq/feed" className="oxs-btn" style={{ textDecoration: "none" }}>
            Open feed
          </Link>
          <Link to="/hq/voice" className="oxs-btn oxs-btn-ghost" style={{ textDecoration: "none" }}>
            Join voice
          </Link>
          <Link to="/hq/growth" className="oxs-btn oxs-btn-ghost" style={{ textDecoration: "none" }}>
            Claim XP
          </Link>
        </div>
      </header>

      <div className="oxs-grid oxs-grid-3" style={{ marginBottom: "1rem" }}>
        <div className="oxs-panel oxs-stat">
          <div className="label">Your XP</div>
          <div className="value">{me?.xp ?? 0}</div>
          <div className="oxs-muted" style={{ fontSize: "0.78rem", marginTop: "0.35rem" }}>
            {prog.current.title}
            {prog.next ? ` → ${prog.next.title}` : " · Max tier"}
          </div>
          <div className="oxs-progress" style={{ marginTop: "0.55rem" }}>
            <span style={{ width: `${prog.pct}%` }} />
          </div>
        </div>
        <div className="oxs-panel oxs-stat">
          <div className="label">Communities</div>
          <div className="value">{communities.length}</div>
          <div className="oxs-muted" style={{ fontSize: "0.78rem", marginTop: "0.35rem" }}>
            Token · holder · alpha · gaming
          </div>
        </div>
        <div className="oxs-panel oxs-stat">
          <div className="label">Live voice</div>
          <div className="value oxs-pulse">{live}</div>
          <div className="oxs-muted" style={{ fontSize: "0.78rem", marginTop: "0.35rem" }}>
            Trading · gaming · creator rooms
          </div>
        </div>
      </div>

      <div className="oxs-grid oxs-grid-2">
        <div className="oxs-panel">
          <h3>Latest posts</h3>
          {posts.slice(0, 4).map((p) => {
            const a = profiles.find((x) => x.id === p.authorId);
            return (
              <div key={p.id} style={{ padding: "0.55rem 0", borderBottom: "1px solid rgba(255,120,72,0.08)" }}>
                <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>@{a?.username || "anon"}</div>
                <div className="oxs-muted" style={{ fontSize: "0.82rem" }}>
                  {p.content.slice(0, 120)}
                  {p.content.length > 120 ? "…" : ""}
                </div>
              </div>
            );
          })}
          <Link to="/hq/feed" className="oxs-link" style={{ fontSize: "0.82rem" }}>
            View full feed →
          </Link>
        </div>
        <div className="oxs-panel">
          <h3>Jump in</h3>
          {[
            { t: "Trading communities", d: "Token rooms, holder gates, trader rankings.", href: "/hq/trading" },
            { t: "Voice spaces", d: "Live rooms with moderation tools.", href: "/hq/voice" },
            { t: "Growth & referrals", d: "XP, invites, creator program.", href: "/hq/growth" },
            { t: "Classic Discord hub", d: "Existing LiveKit community app.", href: "/community-classic" },
          ].map((x) => (
            <Link
              key={x.href}
              to={x.href}
              style={{ display: "block", textDecoration: "none", color: "inherit", padding: "0.55rem 0", borderBottom: "1px solid rgba(255,120,72,0.08)" }}
            >
              <div style={{ fontWeight: 700 }}>{x.t}</div>
              <div className="oxs-muted" style={{ fontSize: "0.8rem" }}>
                {x.d}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
