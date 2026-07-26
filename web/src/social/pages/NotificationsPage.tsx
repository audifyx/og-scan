import { Link } from "react-router-dom";
import { Bell, Heart, MessageCircle, UserPlus, Sparkles } from "lucide-react";
import { SocialPageHeader } from "../components/SocialPageHeader";
import { useSocialStore } from "../hooks/useSocialStore";
import { markNotificationsRead } from "../store/localSocialStore";

const ICON: Record<string, typeof Bell> = {
  follow: UserPlus,
  like: Heart,
  comment: MessageCircle,
  mention: MessageCircle,
  referral: UserPlus,
  xp: Sparkles,
  mod: Bell,
  voice: Bell,
  default: Bell,
};

export default function NotificationsPage() {
  const { notifications, currentUserId } = useSocialStore();
  const mine = notifications.filter((n) => n.userId === currentUserId);

  return (
    <div>
      <SocialPageHeader
        title="Notifications"
        subtitle="Follows, likes, comments, and voice alerts."
        actions={
          <button className="oxs-btn oxs-btn-ghost" type="button" onClick={() => markNotificationsRead()}>
            Mark all read
          </button>
        }
      />

      {mine.length === 0 ? (
        <div className="oxs-panel oxs-muted">You&apos;re all caught up.</div>
      ) : (
        mine.map((n) => {
          const Icon = ICON[n.type] || ICON.default;
          return (
            <div key={n.id} className={`oxs-notif${n.read ? "" : " unread"}`}>
              <div className="oxs-avatar" style={{ width: 36, height: 36, background: "var(--oxs-x-dim)", color: "var(--oxs-x)" }}>
                <Icon size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                  <strong>{n.title}</strong>
                  {!n.read ? <span className="oxs-badge">New</span> : null}
                </div>
                <div className="oxs-muted" style={{ fontSize: "0.88rem", marginTop: "0.2rem" }}>{n.body}</div>
                {n.href ? (
                  <Link className="oxs-link" to={n.href} style={{ fontSize: "0.82rem" }}>
                    Open →
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
