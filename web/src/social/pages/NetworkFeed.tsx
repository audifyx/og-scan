import { FormEvent, useMemo, useState } from "react";
import { PostCard } from "../components/PostCard";
import { useSocialStore } from "../hooks/useSocialStore";
import { createPost, isSpammy } from "../store/localSocialStore";

export default function NetworkFeed() {
  const { posts, profiles, currentUserId } = useSocialStore();
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const me = profiles.find((p) => p.id === currentUserId);

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
      <header className="oxs-hero">
        <h1>Feed</h1>
        <p>Posts, comments, likes, and following — the OrbitX social network timeline.</p>
      </header>

      <form className="oxs-panel" onSubmit={onPost} style={{ marginBottom: "1rem" }}>
        <h3>Compose</h3>
        <textarea
          className="oxs-textarea"
          placeholder="Share alpha, lobby invites, or community updates…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
        />
        {error && (
          <p style={{ color: "var(--oxs-danger)", fontSize: "0.82rem", margin: "0.45rem 0 0" }}>{error}</p>
        )}
        <div style={{ marginTop: "0.65rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="oxs-muted" style={{ fontSize: "0.75rem" }}>
            Anti-spam on · {draft.length}/2000
          </span>
          <button className="oxs-btn" type="submit" disabled={!draft.trim()}>
            Post
          </button>
        </div>
      </form>

      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem" }}>
        {(["foryou", "following"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? "oxs-btn" : "oxs-btn oxs-btn-ghost"}
            onClick={() => setTab(t)}
          >
            {t === "foryou" ? "For you" : "Following"}
          </button>
        ))}
      </div>

      <div className="oxs-panel">
        {feed.length === 0 && <p className="oxs-muted">No posts in this view yet.</p>}
        {feed.map((p) => (
          <PostCard key={p.id} post={p} author={profiles.find((x) => x.id === p.authorId)} meId={currentUserId} />
        ))}
      </div>
    </div>
  );
}
