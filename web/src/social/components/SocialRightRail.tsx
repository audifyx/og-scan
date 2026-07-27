import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { useSocialStore } from "../hooks/useSocialStore";

const TRENDS = [
  { tag: "Trending · Crypto", title: "$ORBITX", posts: "2.4K posts" },
  { tag: "Trending in Solana", title: "Alpha calls", posts: "890 posts" },
  { tag: "Gaming · Live", title: "OrbitX City", posts: "412 posts" },
  { tag: "Spaces", title: "Voice rooms", posts: "Live now" },
];

export function SocialRightRail() {
  const { profiles } = useSocialStore();
  const suggested = profiles.filter((p) => p.isCreator).slice(0, 3);

  return (
    <aside className="oxs-rail" aria-label="Sidebar">
      <div className="oxs-search">
        <div style={{ position: "relative" }}>
          <Search size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#71767b" }} />
          <input type="search" placeholder="Search" aria-label="Search" />
        </div>
      </div>

      <div className="oxs-rail-card">
        <h3>Subscribe to Premium</h3>
        <div style={{ padding: "0 16px 16px", fontSize: 15, color: "#71767b", lineHeight: 1.4 }}>
          Unlock exclusive features and support OrbitX Social.
        </div>
        <div style={{ padding: "0 16px 16px" }}>
          <button type="button" className="oxs-btn" style={{ width: "100%", justifyContent: "center" }}>
            Subscribe
          </button>
        </div>
      </div>

      <div className="oxs-rail-card">
        <h3>What&apos;s happening</h3>
        {TRENDS.map((t) => (
          <Link key={t.title} to="/hq/feed" className="oxs-rail-item">
            <div className="meta">{t.tag}</div>
            <div className="title">{t.title}</div>
            <div className="meta">{t.posts}</div>
          </Link>
        ))}
        <Link to="/hq/communities" className="oxs-rail-item" style={{ color: "#1d9bf0", fontSize: 15, fontWeight: 700 }}>
          Show more
        </Link>
      </div>

      <div className="oxs-rail-card">
        <h3>Who to follow</h3>
        {suggested.map((p) => (
          <div key={p.id} className="oxs-rail-item" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Link to={`/hq/profile/${p.id}`} className="oxs-avatar" style={{ textDecoration: "none", color: "#fff", width: 40, height: 40 }}>
              {p.displayName.slice(0, 2).toUpperCase()}
            </Link>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link to={`/hq/profile/${p.id}`} className="title" style={{ display: "block", textDecoration: "none", color: "inherit", fontSize: 15 }}>
                {p.displayName}
              </Link>
              <div className="meta">@{p.username}</div>
            </div>
            <Link to={`/hq/profile/${p.id}`} className="oxs-btn" style={{ padding: "6px 14px", fontSize: 14 }}>
              Follow
            </Link>
          </div>
        ))}
        <Link to="/hq/communities" className="oxs-rail-item" style={{ color: "#1d9bf0", fontSize: 15, fontWeight: 700 }}>
          Show more
        </Link>
      </div>

      <div style={{ padding: "0 16px", fontSize: 13, color: "#71767b", lineHeight: 1.6 }}>
        <Link to="/terms" className="oxs-link" style={{ marginRight: 12 }}>Terms</Link>
        <Link to="/privacy" className="oxs-link">Privacy</Link>
        <div style={{ marginTop: 8 }}>© OrbitX Social</div>
      </div>
    </aside>
  );
}
