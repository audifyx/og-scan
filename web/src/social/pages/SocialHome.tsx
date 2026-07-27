import { Link } from "react-router-dom";
import { Hash, Mail, Radio, Users, MessageSquare, Sparkles } from "lucide-react";
import { useCurrentProfile, useSocialStore } from "../hooks/useSocialStore";
import { progressToNext } from "../growth/xp";
import { PostCard } from "../components/PostCard";
import { SocialPageHeader } from "../components/SocialPageHeader";

export default function SocialHome() {
  const { posts, communities, voice, profiles, currentUserId } = useSocialStore();
  const me = useCurrentProfile();
  const prog = progressToNext(me?.xp ?? 0);
  const live = voice.filter((v) => v.live).length;

  const tiles = [
    { href: "/hq/feed", icon: Hash, label: "For you feed", desc: "Posts, likes, and replies — X-style timeline", cls: "oxs-tile-icon--x" },
    { href: "/hq/messages", icon: Mail, label: "Direct messages", desc: "Private chats — Telegram-style DMs", cls: "oxs-tile-icon--tg" },
    { href: "/hq/chat", icon: MessageSquare, label: "Community channels", desc: "Discord-style text + voice channels", cls: "oxs-tile-icon--dc" },
    { href: "/hq/communities", icon: Users, label: "Communities", desc: `${communities.length} groups · token · gaming · alpha`, cls: "oxs-tile-icon--dc" },
    { href: "/hq/voice", icon: Radio, label: "Voice spaces", desc: `${live} live now · trading & creator rooms`, cls: "oxs-tile-icon--x" },
    { href: "/hq/growth", icon: Sparkles, label: "Growth & XP", desc: `${me?.xp ?? 0} XP · ${prog.current.title}`, cls: "oxs-tile-icon--tg" },
  ];

  return (
    <div>
      <SocialPageHeader title="Home" subtitle="Your social hub — feed, DMs, communities, and voice." />

      <div className="oxs-grid oxs-grid-3">
        <div className="oxs-stat">
          <div className="label">Your XP</div>
          <div className="value">{me?.xp ?? 0}</div>
          <div className="oxs-muted" style={{ fontSize: "0.78rem", marginTop: "0.35rem" }}>{prog.current.title}</div>
          <div className="oxs-progress" style={{ marginTop: "0.5rem" }}>
            <span style={{ width: `${prog.pct}%` }} />
          </div>
        </div>
        <div className="oxs-stat">
          <div className="label">Communities</div>
          <div className="value">{communities.length}</div>
        </div>
        <div className="oxs-stat">
          <div className="label">Live voice</div>
          <div className="value oxs-pulse">{live}</div>
        </div>
      </div>

      {tiles.map((t) => (
        <Link key={t.href} to={t.href} className="oxs-tile">
          <div className={`oxs-tile-icon ${t.cls}`}>
            <t.icon size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>{t.label}</div>
            <div className="oxs-muted" style={{ fontSize: "0.85rem" }}>{t.desc}</div>
          </div>
        </Link>
      ))}

      <SocialPageHeader title="Latest posts" />
      {posts.slice(0, 5).map((p) => (
        <PostCard key={p.id} post={p} author={profiles.find((x) => x.id === p.authorId)} meId={currentUserId} />
      ))}
      <div style={{ padding: "0.85rem 1rem" }}>
        <Link to="/hq/feed" className="oxs-link">View full feed →</Link>
      </div>
    </div>
  );
}
