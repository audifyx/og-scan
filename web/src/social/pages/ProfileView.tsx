import { Link, useParams } from "react-router-dom";
import { useSocialStore } from "../hooks/useSocialStore";
import { toggleFollow } from "../store/localSocialStore";
import { progressToNext, tierForXp } from "../growth/xp";
import { PostCard } from "../components/PostCard";

export default function ProfileView() {
  const { userId } = useParams<{ userId?: string }>();
  const { profiles, posts, currentUserId } = useSocialStore();
  const id = userId || currentUserId;
  const profile = profiles.find((p) => p.id === id);
  const me = profiles.find((p) => p.id === currentUserId);
  const following = !!me?.following.includes(id);
  const tier = tierForXp(profile?.xp ?? 0);
  const prog = progressToNext(profile?.xp ?? 0);
  const myPosts = posts.filter((p) => p.authorId === id);

  if (!profile) {
    return (
      <div>
        <header className="oxs-hero">
          <h1>Profile</h1>
          <p className="oxs-muted">User not found.</p>
        </header>
      </div>
    );
  }

  return (
    <div>
      <header className="oxs-hero">
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <div className="oxs-avatar" style={{ width: 64, height: 64, fontSize: "1.2rem" }}>
            {profile.displayName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 style={{ marginBottom: "0.15rem" }}>{profile.displayName}</h1>
            <p className="oxs-muted" style={{ margin: 0 }}>
              @{profile.username}
              {profile.isCreator ? " · Creator" : ""}
              {profile.isMod ? " · Mod" : ""}
              {profile.banned ? " · Banned" : profile.muted ? " · Muted" : ""}
            </p>
          </div>
        </div>
        <p style={{ marginTop: "0.85rem" }}>{profile.bio}</p>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.85rem", flexWrap: "wrap" }}>
          {id !== currentUserId && (
            <button className="oxs-btn" type="button" onClick={() => toggleFollow(id)}>
              {following ? "Following" : "Follow"}
            </button>
          )}
          <Link to="/hq/growth" className="oxs-btn oxs-btn-ghost" style={{ textDecoration: "none" }}>
            Growth
          </Link>
        </div>
      </header>

      <div className="oxs-grid oxs-grid-3" style={{ marginBottom: "1rem" }}>
        <div className="oxs-panel oxs-stat">
          <div className="label">Followers</div>
          <div className="value">{profile.followers.length}</div>
        </div>
        <div className="oxs-panel oxs-stat">
          <div className="label">Following</div>
          <div className="value">{profile.following.length}</div>
        </div>
        <div className="oxs-panel oxs-stat">
          <div className="label">Reputation</div>
          <div className="value">{tier.title}</div>
          <div className="oxs-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
            {profile.xp} XP · {prog.pct}% to next
          </div>
          <div className="oxs-progress" style={{ marginTop: "0.45rem" }}>
            <span style={{ width: `${prog.pct}%` }} />
          </div>
        </div>
      </div>

      <div className="oxs-panel">
        <h3>Posts</h3>
        {myPosts.length === 0 && <p className="oxs-muted">No posts yet.</p>}
        {myPosts.map((p) => (
          <PostCard key={p.id} post={p} author={profile} meId={currentUserId} />
        ))}
      </div>
    </div>
  );
}
