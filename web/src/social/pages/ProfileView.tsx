import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { Calendar, MapPin } from "lucide-react";
import { useSocialStore } from "../hooks/useSocialStore";
import { toggleFollow } from "../store/localSocialStore";
import { progressToNext, tierForXp } from "../growth/xp";
import { PostCard } from "../components/PostCard";

export default function ProfileView() {
  const { userId } = useParams<{ userId?: string }>();
  const { profiles, posts, currentUserId } = useSocialStore();
  const [tab, setTab] = useState<"posts" | "replies" | "media">("posts");
  const id = userId || currentUserId;
  const profile = profiles.find((p) => p.id === id);
  const me = profiles.find((p) => p.id === currentUserId);
  const following = !!me?.following.includes(id);
  const tier = tierForXp(profile?.xp ?? 0);
  const prog = progressToNext(profile?.xp ?? 0);
  const myPosts = posts.filter((p) => p.authorId === id);

  if (!profile) {
    return (
      <div className="oxs-page-head">
        <h1>Profile</h1>
        <p className="oxs-muted">User not found.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="oxs-profile-banner" />
      <div className="oxs-profile-head">
        <div className="oxs-profile-actions">
          {id !== currentUserId ? (
            <button
              className={`oxs-btn ${following ? "oxs-btn-following" : "oxs-btn-follow"}`}
              type="button"
              onClick={() => toggleFollow(id)}
            >
              {following ? "Following" : "Follow"}
            </button>
          ) : (
            <Link to="/hq/growth" className="oxs-btn oxs-btn-ghost" style={{ textDecoration: "none" }}>
              Edit growth
            </Link>
          )}
        </div>
        <div className="oxs-avatar oxs-avatar--xl">{profile.displayName.slice(0, 2).toUpperCase()}</div>
        <h1 style={{ margin: "0.65rem 0 0", fontSize: "1.35rem", fontWeight: 800 }}>{profile.displayName}</h1>
        <div className="oxs-muted" style={{ fontSize: "0.92rem" }}>
          @{profile.username}
          {profile.isCreator ? " · Creator" : ""}
          {profile.isMod ? " · Mod" : ""}
        </div>
        <p style={{ margin: "0.75rem 0 0", lineHeight: 1.45 }}>{profile.bio}</p>
        <div className="oxs-muted" style={{ display: "flex", gap: "1rem", marginTop: "0.55rem", fontSize: "0.85rem", flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
            <MapPin size={14} /> OrbitX
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
            <Calendar size={14} /> Joined {new Date(profile.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
          </span>
        </div>
        <div className="oxs-profile-stats">
          <span><strong>{profile.following.length}</strong> <span className="oxs-muted">Following</span></span>
          <span><strong>{profile.followers.length}</strong> <span className="oxs-muted">Followers</span></span>
          <span><strong>{tier.title}</strong> <span className="oxs-muted">· {profile.xp} XP</span></span>
        </div>
        <div className="oxs-progress" style={{ marginTop: "0.65rem", maxWidth: 280 }}>
          <span style={{ width: `${prog.pct}%` }} />
        </div>
      </div>

      <div className="oxs-tabs">
        {(["posts", "replies", "media"] as const).map((t) => (
          <button key={t} type="button" className={`oxs-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "posts" ? (
        myPosts.length === 0 ? (
          <div className="oxs-panel oxs-muted">No posts yet.</div>
        ) : (
          myPosts.map((p) => <PostCard key={p.id} post={p} author={profile} meId={currentUserId} />)
        )
      ) : (
        <div className="oxs-panel oxs-muted">Nothing here yet.</div>
      )}
    </div>
  );
}
