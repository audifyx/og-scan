/**
 * OrbitX Social Center — public embed widgets (no auth, no chrome).
 * Drop-in iframes for any website:
 *   /embed/social/post/:id          — single post (with chart if attached)
 *   /embed/social/profile/:username — profile card
 *   /embed/social/feed?user=X      — live feed (polls every 30s)
 *   /embed/social/feed?tag=$SOL    — live cashtag feed
 */
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Heart, MessageCircle, Repeat2, BadgeCheck, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const SITE = "https://orbitx.world";

interface EmbedPost {
  id: string; username: string | null; avatar_url: string | null;
  text: string; likes: number; created_at: string; repost_of?: string | null;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function EmbedShell({ children, height }: { children: React.ReactNode; height?: number }) {
  return (
    <div style={{ fontFamily: "Manrope, system-ui, sans-serif", background: "#000", color: "#fff", minHeight: height || "auto" }}>
      <style>{`a{color:#60a5fa}`}</style>
      {children}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
        <span>OrbitX Social Center</span>
        <a href={SITE} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#60a5fa", textDecoration: "none", fontWeight: 700 }}>
          orbitx.world <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}

function PostBody({ p }: { p: EmbedPost }) {
  // Strip [chart:..] markers for the text view; charts render via the main app
  const text = (p.text || "").replace(/\[chart:[^\]]+\]/g, "").trim();
  const hasChart = /\[chart:[^\]]+\]/.test(p.text || "");
  return (
    <div style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
        {p.avatar_url
          ? <img src={p.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: 999 }} />
          : <span style={{ width: 40, height: 40, borderRadius: 999, background: "linear-gradient(135deg,#3b82f6,#60a5fa)", display: "grid", placeItems: "center", fontWeight: 800 }}>{(p.username || "?")[0]?.toUpperCase()}</span>}
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}>
            {p.username || "Anon"} <BadgeCheck size={14} color="#f0c75e" />
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>@{(p.username || "anon").toLowerCase()} · {timeAgo(p.created_at)}</div>
        </div>
      </div>
      {text && <div style={{ fontSize: 14.5, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{text}</div>}
      {hasChart && (
        <a href={`${SITE}/orbitx-social`} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 10, padding: 12, borderRadius: 14, border: "1px solid rgba(59,130,246,0.35)", background: "rgba(59,130,246,0.07)", textDecoration: "none" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>📊 Price chart attached</span>
          <span style={{ display: "block", fontSize: 11.5, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>View the interactive chart on OrbitX Social Center →</span>
        </a>
      )}
      <div style={{ display: "flex", gap: 22, marginTop: 10, color: "rgba(255,255,255,0.4)", fontSize: 12.5 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><MessageCircle size={15} /></span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Repeat2 size={15} /></span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Heart size={15} />{p.likes > 0 ? p.likes : ""}</span>
      </div>
    </div>
  );
}

export function SocialPostEmbed() {
  const { id } = useParams();
  const [post, setPost] = useState<EmbedPost | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    fetch(`/api/social/post/${id}`)
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setPost(d.post); else setMissing(true); })
      .catch(() => setMissing(true));
  }, [id]);
  return (
    <EmbedShell>
      {missing ? <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Post not found.</div>
        : post ? <PostBody p={post} />
        : <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Loading…</div>}
    </EmbedShell>
  );
}

export function SocialProfileEmbed() {
  const { username } = useParams();
  const [data, setData] = useState<any>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    fetch(`/api/social/profile/${username}`)
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setData(d); else setMissing(true); })
      .catch(() => setMissing(true));
  }, [username]);
  return (
    <EmbedShell>
      {missing ? <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Profile not found.</div>
        : !data ? <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Loading…</div>
        : (
          <div style={{ padding: "16px" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {data.profile.avatar_url
                ? <img src={data.profile.avatar_url} alt="" style={{ width: 56, height: 56, borderRadius: 999 }} />
                : <span style={{ width: 56, height: 56, borderRadius: 999, background: "linear-gradient(135deg,#3b82f6,#f0c75e)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 22 }}>{(data.profile.username || "?")[0]?.toUpperCase()}</span>}
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, display: "flex", alignItems: "center", gap: 5 }}>
                  {data.profile.display_name || data.profile.username}
                  {data.profile.verified && <BadgeCheck size={15} color="#f0c75e" />}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>@{data.profile.username}</div>
              </div>
              <a href={`${SITE}/orbitx-social`} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", background: "#fff", color: "#000", borderRadius: 999, padding: "7px 16px", fontSize: 13, fontWeight: 800, textDecoration: "none" }}>Follow</a>
            </div>
            {data.profile.bio && <div style={{ marginTop: 10, fontSize: 13.5, color: "rgba(255,255,255,0.7)" }}>{data.profile.bio}</div>}
            <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", padding: "8px 0" }}>Latest posts</div>
              {(data.latest_posts || []).map((p: EmbedPost) => <PostBody key={p.id} p={p} />)}
            </div>
          </div>
        )}
    </EmbedShell>
  );
}

export function SocialFeedEmbed() {
  const [params] = useSearchParams();
  const user = params.get("user") || "";
  const tag = params.get("tag") || "";
  const limit = Math.min(Number(params.get("limit")) || 10, 25);
  const [posts, setPosts] = useState<EmbedPost[]>([]);
  const title = useMemo(() => user ? `@${user}` : tag ? tag : "OrbitX", [user, tag]);

  useEffect(() => {
    let on = true;
    const load = () => {
      const url = user ? `/api/social/feed/${encodeURIComponent(user)}?limit=${limit}`
        : tag ? `/api/social/feed?tag=${encodeURIComponent(tag)}&limit=${limit}` : null;
      if (!url) return;
      fetch(url).then((r) => r.json()).then((d) => { if (on && d?.ok) setPosts(d.posts); }).catch(() => {});
    };
    load();
    const id = setInterval(load, 30000); // realtime-ish polling
    return () => { on = false; clearInterval(id); };
  }, [user, tag, limit]);

  return (
    <EmbedShell>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", fontWeight: 800, fontSize: 14 }}>
        Live feed · <span style={{ color: "#60a5fa" }}>{title}</span>
        <span style={{ float: "right", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "#34d399", fontWeight: 700 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: "#34d399", display: "inline-block" }} /> LIVE
        </span>
      </div>
      <div style={{ maxHeight: 520, overflowY: "auto" }}>
        {posts.length === 0
          ? <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>No posts yet.</div>
          : posts.map((p) => <div key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}><PostBody p={p} /></div>)}
      </div>
    </EmbedShell>
  );
}

/** Copy-paste snippet helper shown in the app's share menu. */
export function embedSnippet(kind: "post" | "profile" | "feed", id: string): string {
  const src = kind === "post" ? `${SITE}/embed/social/post/${id}`
    : kind === "profile" ? `${SITE}/embed/social/profile/${id}`
    : `${SITE}/embed/social/feed?${id}`;
  const h = kind === "feed" ? 560 : 240;
  return `<iframe src="${src}" width="100%" height="${h}" frameborder="0" style="max-width:550px;border-radius:16px;overflow:hidden" allowtransparency="true"></iframe>`;
}
