import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { useSocialStore } from "../hooks/useSocialStore";

const TRENDS = [
  { tag: "Trending · Crypto", title: "$ORBITX", posts: "2.4K posts" },
  { tag: "Trending", title: "Solana alpha", posts: "890 posts" },
  { tag: "Gaming · Live", title: "OrbitX City", posts: "412 posts" },
  { tag: "Trading", title: "Voice rooms", posts: "156 live" },
];

export function SocialRightRail() {
  const { profiles, voice, communities } = useSocialStore();
  const live = voice.filter((v) => v.live).length;
  const suggested = profiles.filter((p) => p.isCreator).slice(0, 3);

  return (
    <aside className="oxs-rail" aria-label="Discover">
      <div className="oxs-search">
        <div style={{ position: "relative" }}>
          <Search size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--oxs-muted)" }} />
          <input type="search" placeholder="Search OrbitX" aria-label="Search" />
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
        <Link to="/hq/feed" className="oxs-rail-item" style={{ color: "var(--oxs-x)" }}>
          Show more
        </Link>
      </div>

      <div className="oxs-rail-card">
        <h3>Live now</h3>
        <Link to="/hq/voice" className="oxs-rail-item">
          <div className="meta">Voice spaces</div>
          <div className="title">{live} rooms live</div>
        </Link>
        <Link to="/hq/spaces" className="oxs-rail-item">
          <div className="meta">Twitter Spaces</div>
          <div className="title">Open spaces hub →</div>
        </Link>
      </div>

      <div className="oxs-rail-card">
        <h3>Who to follow</h3>
        {suggested.map((p) => (
          <Link key={p.id} to={`/hq/profile/${p.id}`} className="oxs-rail-item" style={{ display: "flex", gap: "0.65rem", alignItems: "center" }}>
            <div className="oxs-avatar" style={{ width: 40, height: 40 }}>
              {p.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="title" style={{ fontSize: "0.88rem" }}>{p.displayName}</div>
              <div className="meta">@{p.username}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="oxs-rail-card">
        <h3>Communities</h3>
        {communities.slice(0, 4).map((c) => (
          <Link key={c.id} to="/hq/communities" className="oxs-rail-item">
            <div className="title">{c.avatarEmoji} {c.name}</div>
            <div className="meta">{c.memberCount} members</div>
          </Link>
        ))}
      </div>
    </aside>
  );
}
