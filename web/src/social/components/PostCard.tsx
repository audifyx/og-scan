import { Link } from "react-router-dom";
import type { SocialPost, SocialProfile } from "../store/localSocialStore";
import { commentOnPost, fileReport, likePost } from "../store/localSocialStore";
import { useState } from "react";
import { Heart, MessageCircle, Repeat2, Share, Flag, BarChart2 } from "lucide-react";

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
      <Link to={`/hq/profile/${post.authorId}`} className="oxs-avatar" style={{ textDecoration: "none", color: "#fff" }}>
        {initials(author)}
      </Link>
      <div className="oxs-post-body">
        <div className="oxs-post-meta">
          <Link to={`/hq/profile/${post.authorId}`} className="oxs-post-name">
            {author?.displayName || "Unknown"}
          </Link>
          <span className="oxs-post-handle">@{author?.username || "anon"}</span>
          <span className="oxs-post-time">· {timeAgo(post.createdAt)}</span>
          {post.pinned ? <span className="oxs-badge">Pinned</span> : null}
          {post.flagged ? <span className="oxs-badge oxs-badge-danger">Flagged</span> : null}
        </div>
        <p className="oxs-post-text">{post.content}</p>
        <div className="oxs-post-actions">
          <button type="button" aria-label="Comment" onClick={() => setShowComments((v) => !v)}>
            <MessageCircle size={18} /> {post.comments.length || ""}
          </button>
          <button type="button" aria-label="Repost">
            <Repeat2 size={18} />
          </button>
          <button type="button" className={liked ? "liked" : undefined} aria-label="Like" onClick={() => likePost(post.id)}>
            <Heart size={18} fill={liked ? "currentColor" : "none"} /> {post.likes.length || ""}
          </button>
          <button type="button" aria-label="Views">
            <BarChart2 size={18} />
          </button>
          <button type="button" aria-label="Share">
            <Share size={18} />
          </button>
          <button
            type="button"
            aria-label="Report"
            onClick={() => fileReport({ targetType: "post", targetId: post.id, reason: "User report" })}
          >
            <Flag size={16} />
          </button>
        </div>
        {showComments ? (
          <div style={{ marginTop: "0.65rem" }}>
            {post.comments.map((c) => (
              <div key={c.id} className="oxs-bubble" style={{ marginBottom: "0.45rem" }}>
                <strong style={{ fontSize: "0.78rem", color: "var(--oxs-x)" }}>
                  {c.authorId === meId ? "You" : c.authorId}
                </strong>
                <div>{c.content}</div>
              </div>
            ))}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <input
                className="oxs-input-box oxs-input"
                placeholder="Post your reply"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                style={{ flex: 1 }}
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
        ) : null}
      </div>
    </article>
  );
}
