import { Link } from "react-router-dom";
import { useSocialStore } from "../hooks/useSocialStore";
import { traderRankScore, rankByMetric } from "../growth/leaderboard";
import { joinCommunity } from "../store/localSocialStore";

export default function TradingCommunities() {
  const { communities, profiles, posts, currentUserId } = useSocialStore();
  const trading = communities.filter((c) => ["token", "holder", "alpha", "trading"].includes(c.kind));

  const rankings = rankByMetric(
    profiles.map((p) => ({
      userId: p.id,
      username: p.username,
      value: traderRankScore({
        pnlPct: (p.reputation - 50) * 1.2,
        winRate: 40 + p.reputation / 3,
        volumeUsd: p.xp * 40,
        followers: p.followers.length * 40,
      }),
    })),
  );

  const alphaPosts = posts.filter((p) => p.communityId === "c_alpha" || p.communityId === "c_sol_traders");

  return (
    <div>
      <header className="oxs-hero">
        <h1>Trading communities</h1>
        <p>Token communities, holder-only groups, trader rankings, alpha channels, and discussion rooms.</p>
      </header>

      <div className="oxs-grid oxs-grid-3" style={{ marginBottom: "1rem" }}>
        {trading.map((c) => {
          const joined = c.memberIds.includes(currentUserId);
          return (
            <div key={c.id} className="oxs-panel">
              <div style={{ fontSize: "1.4rem", marginBottom: "0.35rem" }}>{c.avatarEmoji}</div>
              <h3 style={{ marginBottom: "0.35rem" }}>{c.name}</h3>
              <span className="oxs-badge" style={{ marginBottom: "0.5rem" }}>
                {c.kind}
                {c.holderOnly ? " · gated" : ""}
              </span>
              <p className="oxs-muted" style={{ fontSize: "0.8rem", minHeight: "2.4rem" }}>
                {c.description}
              </p>
              <button className="oxs-btn" type="button" disabled={joined} onClick={() => joinCommunity(c.id)}>
                {joined ? "In room" : c.holderOnly ? "Verify & join" : "Enter"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="oxs-grid oxs-grid-2">
        <div className="oxs-panel">
          <h3>Trader rankings</h3>
          <table className="oxs-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Trader</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {rankings.slice(0, 8).map((r) => (
                <tr key={r.userId}>
                  <td>{r.rank}</td>
                  <td>
                    <Link className="oxs-link" to={`/hq/profile/${r.userId}`}>
                      @{r.username}
                    </Link>
                  </td>
                  <td>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="oxs-panel">
          <h3>Alpha channel</h3>
          {alphaPosts.length === 0 && <p className="oxs-muted">No alpha posts yet.</p>}
          {alphaPosts.slice(0, 5).map((p) => {
            const a = profiles.find((x) => x.id === p.authorId);
            return (
              <div key={p.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid rgba(255,120,72,0.08)" }}>
                <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>@{a?.username}</div>
                <div className="oxs-muted" style={{ fontSize: "0.8rem" }}>
                  {p.content}
                </div>
              </div>
            );
          })}
          <Link to="/hq/feed" className="oxs-link" style={{ fontSize: "0.82rem" }}>
            Discuss in feed →
          </Link>
        </div>
      </div>
    </div>
  );
}
