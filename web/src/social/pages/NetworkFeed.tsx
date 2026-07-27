import { FormEvent, useMemo, useState } from "react";
import { Image, Smile } from "lucide-react";
import { PostCard } from "../components/PostCard";
import { SocialPageHeader } from "../components/SocialPageHeader";
import { useCurrentProfile, useSocialStore } from "../hooks/useSocialStore";
import { createPost, isSpammy } from "../store/localSocialStore";

export default function NetworkFeed() {
  const { posts, profiles, currentUserId } = useSocialStore();
  const me = useCurrentProfile();
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const feed = useMemo(() => {
    if (tab === "following" && me) {
      return posts.filter((p) => me.following.includes(p.authorId) || p.authorId === me.id);
    }
    return posts;
  }, [posts, tab, me]);

  function onPost(e: FormEvent) {
    e.preventDefault();
    const recent = posts.filter((p) => p.authorId === currentUserId).slice(0, 8);
    const spam = isSpammy(
      draft,
      recent.map((p) => p.content),
      Date.now(),
      recent.map((p) => p.createdAt),
    );
    if (spam) {
      setError(spam);
      return;
    }
    setError(null);
    createPost(draft);
    setDraft("");
  }

  return (
    <div>
      <SocialPageHeader title="Home" subtitle="See what's happening in OrbitX." />

      <div className="oxs-tabs">
        {(["foryou", "following"] as const).map((t) => (
          <button key={t} type="button" className={`oxs-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t === "foryou" ? "For you" : "Following"}
          </button>
        ))}
      </div>

      <form className="oxs-compose" onSubmit={onPost}>
        <div className="oxs-avatar">{me?.displayName.slice(0, 2).toUpperCase() || "?"}</div>
        <div style={{ flex: 1 }}>
          <textarea
            className="oxs-textarea"
            placeholder="What's happening?"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
          />
          <div className="oxs-compose-actions">
            <div style={{ display: "flex", gap: "0.25rem", color: "var(--oxs-x)" }}>
              <button type="button" className="oxs-btn-ghost" style={{ padding: "0.35rem", border: "none", borderRadius: "999px" }} aria-label="Media">
                <Image size={18} />
              </button>
              <button type="button" className="oxs-btn-ghost" style={{ padding: "0.35rem", border: "none", borderRadius: "999px" }} aria-label="Emoji">
                <Smile size={18} />
              </button>
              <span className="oxs-muted" style={{ fontSize: "0.75rem", alignSelf: "center", marginLeft: "0.35rem" }}>
                {draft.length}/2000
              </span>
            </div>
            <button className="oxs-btn" type="submit" disabled={!draft.trim()}>
              Post
            </button>
          </div>
          {error ? <p style={{ color: "var(--oxs-red)", fontSize: "0.82rem", margin: "0.45rem 0 0" }}>{error}</p> : null}
        </div>
      </form>

      {feed.length === 0 ? (
        <div className="oxs-panel oxs-muted">No posts in this view yet.</div>
      ) : (
        feed.map((p) => (
          <PostCard key={p.id} post={p} author={profiles.find((x) => x.id === p.authorId)} meId={currentUserId} />
        ))
      )}
    </div>
  );
}
