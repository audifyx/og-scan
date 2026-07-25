import { Link } from "react-router-dom";
import { useSocialStore } from "../hooks/useSocialStore";
import { resolveReport, resetSocialDemo, setUserRestriction } from "../store/localSocialStore";

export default function ModerationAdmin() {
  const { reports, posts, profiles, currentUserId } = useSocialStore();
  const me = profiles.find((p) => p.id === currentUserId);
  const open = reports.filter((r) => r.status === "open");

  return (
    <div>
      <header className="oxs-hero">
        <h1>Moderation</h1>
        <p>Reports, anti-spam review, community management, and user controls for Social HQ.</p>
        {!me?.isMod && (
          <p className="oxs-muted" style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
            Demo mode: local mod tools. Production admins also use platform Community Management.
          </p>
        )}
      </header>

      <div className="oxs-grid oxs-grid-3" style={{ marginBottom: "1rem" }}>
        <div className="oxs-panel oxs-stat">
          <div className="label">Open reports</div>
          <div className="value">{open.length}</div>
        </div>
        <div className="oxs-panel oxs-stat">
          <div className="label">Flagged posts</div>
          <div className="value">{posts.filter((p) => p.flagged).length}</div>
        </div>
        <div className="oxs-panel oxs-stat">
          <div className="label">Restricted users</div>
          <div className="value">{profiles.filter((p) => p.muted || p.banned).length}</div>
        </div>
      </div>

      <div className="oxs-panel" style={{ marginBottom: "1rem" }}>
        <h3>Report queue</h3>
        {reports.length === 0 && <p className="oxs-muted">Queue empty.</p>}
        {reports.map((r) => (
          <div key={r.id} style={{ padding: "0.75rem 0", borderBottom: "1px solid rgba(255,120,72,0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
              <div>
                <strong>
                  {r.targetType} · {r.targetId}
                </strong>
                <div className="oxs-muted" style={{ fontSize: "0.8rem" }}>
                  {r.reason} · {r.status}
                </div>
              </div>
              <span className={`oxs-badge ${r.status === "open" ? "oxs-badge-danger" : "oxs-badge-mint"}`}>{r.status}</span>
            </div>
            {r.status === "open" && (
              <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.55rem", flexWrap: "wrap" }}>
                <button className="oxs-btn" type="button" onClick={() => resolveReport(r.id, "resolved", "remove_post")}>
                  Remove content
                </button>
                <button
                  className="oxs-btn oxs-btn-ghost"
                  type="button"
                  onClick={() => {
                    const post = posts.find((p) => p.id === r.targetId);
                    if (post) setUserRestriction(post.authorId, "mute");
                    resolveReport(r.id, "resolved", "mute_user");
                  }}
                >
                  Mute author
                </button>
                <button className="oxs-btn oxs-btn-ghost" type="button" onClick={() => resolveReport(r.id, "dismissed")}>
                  Dismiss
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="oxs-grid oxs-grid-2">
        <div className="oxs-panel">
          <h3>User controls</h3>
          <table className="oxs-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link className="oxs-link" to={`/hq/profile/${p.id}`}>
                      @{p.username}
                    </Link>
                  </td>
                  <td>{p.banned ? "Banned" : p.muted ? "Muted" : p.isMod ? "Mod" : "Active"}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      <button
                        className="oxs-btn oxs-btn-ghost"
                        type="button"
                        style={{ padding: "0.3rem 0.5rem", fontSize: "0.7rem" }}
                        onClick={() => setUserRestriction(p.id, "mute")}
                      >
                        Mute
                      </button>
                      <button
                        className="oxs-btn oxs-btn-ghost"
                        type="button"
                        style={{ padding: "0.3rem 0.5rem", fontSize: "0.7rem" }}
                        onClick={() => setUserRestriction(p.id, "ban")}
                      >
                        Ban
                      </button>
                      <button
                        className="oxs-btn oxs-btn-ghost"
                        type="button"
                        style={{ padding: "0.3rem 0.5rem", fontSize: "0.7rem" }}
                        onClick={() => setUserRestriction(p.id, "clear")}
                      >
                        Clear
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="oxs-panel">
          <h3>Anti-spam & community ops</h3>
          <ul className="oxs-muted" style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem", lineHeight: 1.55 }}>
            <li>Composer rate limits + duplicate detection</li>
            <li>Link flooding blocked at post time</li>
            <li>Flagged posts surface in queue</li>
            <li>Holder-only / alpha rooms reduce drive-by spam</li>
          </ul>
          <div style={{ marginTop: "0.9rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button className="oxs-btn oxs-btn-ghost" type="button" onClick={() => resetSocialDemo()}>
              Reset demo graph
            </button>
            <a href="/community-classic" className="oxs-btn" style={{ textDecoration: "none" }}>
              Live community app
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
