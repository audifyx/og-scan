import { Link } from "react-router-dom";
import type { SocialPost, SocialProfile } from "../store/localSocialStore";
import { commentOnPost, fileReport, likePost } from "../store/localSocialStore";
import { useState } from "react";

function initials(p?: SocialProfile | null) {
  if (!p) return "?";
  return (p.displayName || p.username || "?").slice(0, 2).toUpperCase();
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function PostCard({
  post,
  author,
  meId,
}: {
  post: SocialPost;
  author?: SocialProfile;
  meId: string;
}) {
  const [comment, setComment] = useState("");
  const [showComments, setShowComments] = useState(false);
  const liked = post.likes.includes(meId);

  return (
    <article className="oxs-post">
      <div className="oxs-avatar">{initials(author)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: "0.45rem", alignItems: "baseline", flexWrap: "wrap" }}>
          <Link to={`/hq/profile/${post.authorId}`} className="oxs-link" style={{ fontWeight: 700, color: "inherit", textDecoration: "none" }}>
            {author?.displayName || "Unknown"}
          </Link>
          <span className="oxs-muted" style={{ fontSize: "0.78rem" }}>
            @{author?.username || "anon"} · {timeAgo(post.createdAt)}
          </span>
          {post.pinned && <span className="oxs-badge">Pinned</span>}
          {post.flagged && <span className="oxs-badge oxs-badge-danger">Flagged</span>}
        </div>
        <p style={{ margin: "0.35rem 0 0", whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{post.content}</p>
        <div className="oxs-actions">
          <button type="button" className={liked ? "liked" : undefined} onClick={() => likePost(post.id)}>
            ♥ {post.likes.length}
          </button>
          <button type="button" onClick={() => setShowComments((v) => !v)}>
            💬 {post.comments.length}
          </button>
          <button
            type="button"
            onClick={() => fileReport({ targetType: "post", targetId: post.id, reason: "User report" })}
          >
            Report
          </button>
        </div>
        {showComments && (
          <div style={{ marginTop: "0.65rem" }}>
            {post.comments.map((c) => (
              <div key={c.id} className="oxs-muted" style={{ fontSize: "0.82rem", marginBottom: "0.35rem" }}>
                <strong style={{ color: "var(--oxs-text)" }}>{c.authorId === meId ? "You" : c.authorId}</strong>: {c.content}
              </div>
            ))}
            <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem" }}>
              <input
                className="oxs-input"
                placeholder="Write a comment…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button
                className="oxs-btn"
                type="button"
                disabled={!comment.trim()}
                onClick={() => {
                  commentOnPost(post.id, comment);
                  setComment("");
                }}
              >
                Reply
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
