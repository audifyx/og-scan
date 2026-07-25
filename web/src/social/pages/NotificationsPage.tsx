import { Link } from "react-router-dom";
import { useSocialStore } from "../hooks/useSocialStore";
import { markNotificationsRead } from "../store/localSocialStore";

export default function NotificationsPage() {
  const { notifications, currentUserId } = useSocialStore();
  const mine = notifications.filter((n) => n.userId === currentUserId);

  return (
    <div>
      <header className="oxs-hero">
        <h1>Notifications</h1>
        <p>Follows, likes, comments, XP drops, voice goes-live, and moderation alerts.</p>
        <button className="oxs-btn oxs-btn-ghost" type="button" style={{ marginTop: "0.75rem" }} onClick={() => markNotificationsRead()}>
          Mark all read
        </button>
      </header>

      <div className="oxs-panel">
        {mine.length === 0 && <p className="oxs-muted">You&apos;re all caught up.</p>}
        {mine.map((n) => (
          <div
            key={n.id}
            style={{
              padding: "0.75rem 0",
              borderBottom: "1px solid rgba(255,120,72,0.08)",
              opacity: n.read ? 0.65 : 1,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
              <strong>{n.title}</strong>
              {!n.read && <span className="oxs-badge">New</span>}
            </div>
            <div className="oxs-muted" style={{ fontSize: "0.84rem", marginTop: "0.25rem" }}>
              {n.body}
            </div>
            {n.href && (
              <Link className="oxs-link" to={n.href} style={{ fontSize: "0.8rem" }}>
                Open →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
