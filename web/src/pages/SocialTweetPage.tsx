/**
 * Public tweet detail page — every post gets its own shareable URL:
 *   /social/t/:id   (primary)
 *   /orbitx-social/t/:id   (alias)
 *   /social/:username/status/:id   (alias)
 *
 * X-style: back header, the post large, replies below. Public — no login needed.
 * Reply/like/etc actions prompt login when logged out.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart, MessageCircle, Repeat2, Share, BadgeCheck, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { safeAvatarUrl } from "@/lib/utils";
import "@/components/social-x/x-social.css";

interface Post {
  id: string; user_id: string; username: string | null; avatar_url: string | null;
  content: string; likes_count: number | null; liked_by: string[] | null;
  created_at: string; reply_to?: string | null; repost_of?: string | null;
}

const dicebear = (seed: string) => `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(seed || "og")}`;
const avatarOf = (url: string | null | undefined, seed: string) => safeAvatarUrl(url) || dicebear(seed);

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (isNaN(s) || s < 0) return "now";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fullDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    hour: "numeric", minute: "2-digit", month: "short", day: "numeric", year: "numeric",
  });
}

export default function SocialTweetPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }
    let live = true;
    (async () => {
      setLoading(true); setNotFound(false);
      try {
        const { data, error } = await supabase
          .from("social_messages")
          .select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at,reply_to,repost_of")
          .eq("id", id).single();
        if (!live) return;
        if (error || !data) { setNotFound(true); setPost(null); }
        else {
          setPost(data as Post);
          const { data: reps } = await supabase
            .from("social_messages")
            .select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at,reply_to,repost_of")
            .eq("reply_to", id).order("created_at", { ascending: true }).limit(100);
          if (live && reps) setReplies(reps as Post[]);
        }
      } catch {
        if (live) setNotFound(true);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [id]);

  const goLogin = useCallback(() => {
    window.location.href = `/auth?return=${encodeURIComponent(`/social/t/${id}`)}`;
  }, [id]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/social/t/${id}`);
    } catch { /* ignore */ }
  }, [id]);

  const requireLogin = () => { if (!user) goLogin(); return Boolean(user); };

  return (
    <div className="osc-shell ox-x-social" style={{ minHeight: "100dvh" }}>
      <div className="osc-shell__atmosphere" aria-hidden>
        <div className="osc-shell__blob osc-shell__blob--a" />
        <div className="osc-shell__blob osc-shell__blob--b" />
      </div>
      <div className="relative z-[1] mx-auto w-full max-w-[600px] border-x border-white/[0.08] min-h-[100dvh] bg-black/40">
        {/* Header */}
        <div className="osc-sticky flex items-center gap-6 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/10"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-[20px] font-extrabold text-white" style={{ fontFamily: "var(--osc-font-display)" }}>Post</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
          </div>
        ) : notFound || !post ? (
          <div className="px-6 py-20 text-center">
            <div className="text-[28px] font-extrabold text-white">This post doesn't exist</div>
            <p className="mx-auto mt-2 max-w-xs text-[14px] text-white/45">
              It may have been deleted, or the link is wrong.
            </p>
            <button
              type="button"
              onClick={() => navigate("/social")}
              className="osc-btn-primary mt-6"
            >
              Back to Social Center
            </button>
          </div>
        ) : (
          <>
            {/* Main post — large X-style */}
            <article className="border-b border-white/[0.08] px-4 pb-3 pt-4">
              <div className="flex items-center gap-3">
                <img src={avatarOf(post.avatar_url, post.user_id)} alt="" className="h-11 w-11 rounded-full object-cover" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-[15px] font-extrabold text-white">
                    <span className="truncate">{post.username || "Anon"}</span>
                    <BadgeCheck className="h-4 w-4 shrink-0 text-[#f0c75e]" />
                  </div>
                  <div className="truncate text-[14px] text-white/45">
                    @{(post.username || "anon").toLowerCase().replace(/\s+/g, "")}
                  </div>
                </div>
              </div>
              <div className="mt-3 whitespace-pre-wrap break-words text-[17px] leading-normal text-white">
                {post.content}
              </div>
              <div className="mt-3 border-b border-white/[0.08] pb-3 text-[14px] text-white/45">
                {fullDate(post.created_at)}
              </div>
              <div className="flex items-center justify-between py-1">
                <button
                  type="button"
                  onClick={() => { if (requireLogin()) navigate(`/social`); }}
                  className="osc-act group"
                  title="Reply"
                >
                  <span className="osc-act__pill"><MessageCircle className="h-[18px] w-[18px]" /></span>
                  {replies.length > 0 && <span>{replies.length}</span>}
                </button>
                <button type="button" onClick={requireLogin} className="osc-act osc-act--green group" title="Repost">
                  <span className="osc-act__pill"><Repeat2 className="h-[18px] w-[18px]" /></span>
                </button>
                <button type="button" onClick={requireLogin} className="osc-act osc-act--pink group" title="Like">
                  <span className="osc-act__pill"><Heart className="h-[18px] w-[18px]" /></span>
                  {(post.likes_count ?? 0) > 0 && <span>{post.likes_count}</span>}
                </button>
                <button type="button" onClick={copyLink} className="osc-act group" title="Copy link">
                  <span className="osc-act__pill"><Share className="h-[18px] w-[18px]" /></span>
                </button>
              </div>
              {!user && (
                <button
                  type="button"
                  onClick={goLogin}
                  className="osc-btn-primary mt-3 w-full"
                >
                  Sign in with X to join the conversation
                </button>
              )}
            </article>

            {/* Replies */}
            <div className="px-4 py-3 text-[15px] font-extrabold text-white">Replies</div>
            {replies.length === 0 ? (
              <div className="px-4 py-10 text-center text-[14px] text-white/40">
                No replies yet. Be the first.
              </div>
            ) : (
              replies.map((r) => (
                <article key={r.id} className="osc-post">
                  <img src={avatarOf(r.avatar_url, r.user_id)} alt="" className="osc-post__avatar" />
                  <div className="min-w-0 flex-1">
                    <div className="osc-post__head">
                      <span className="osc-post__name">{r.username || "Anon"}</span>
                      <span className="osc-post__meta">
                        @{(r.username || "anon").toLowerCase().replace(/\s+/g, "")} · {timeAgo(r.created_at)}
                      </span>
                    </div>
                    <div className="osc-post__body">{r.content}</div>
                    <div className="osc-actions">
                      <span className="osc-act"><span className="osc-act__pill"><MessageCircle className="h-[18px] w-[18px]" /></span></span>
                      <span className="osc-act"><span className="osc-act__pill"><Repeat2 className="h-[18px] w-[18px]" /></span></span>
                      <span className="osc-act">
                        <span className="osc-act__pill"><Heart className="h-[18px] w-[18px]" /></span>
                        {(r.likes_count ?? 0) > 0 && <span>{r.likes_count}</span>}
                      </span>
                    </div>
                  </div>
                </article>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
