import { Link } from "react-router-dom";
import { useSocialStore } from "../hooks/useSocialStore";
import { rankByMetric } from "../growth/leaderboard";

export default function LeaderboardsPage() {
  const { profiles } = useSocialStore();

  const byXp = rankByMetric(profiles.map((p) => ({ userId: p.id, username: p.username, value: p.xp })));
  const byFollowers = rankByMetric(
    profiles.map((p) => ({ userId: p.id, username: p.username, value: p.followers.length })),
  );
  const byRep = rankByMetric(profiles.map((p) => ({ userId: p.id, username: p.username, value: p.reputation })));

  const boards = [
    { title: "XP leaders", rows: byXp },
    { title: "Most followed", rows: byFollowers },
    { title: "Reputation", rows: byRep },
  ];

  return (
    <div>
      <header className="oxs-hero">
        <h1>Leaderboards</h1>
        <p>XP, followers, and reputation rankings across the OrbitX social graph.</p>
      </header>
      <div className="oxs-grid oxs-grid-3">
        {boards.map((b) => (
          <div key={b.title} className="oxs-panel">
            <h3>{b.title}</h3>
            <table className="oxs-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>User</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r) => (
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
        ))}
      </div>
    </div>
  );
}
