/**
 * ArtFeed — Live meme feed from @ogmemesroom on Telegram.
 *
 * Architecture:
 *  1. Supabase Edge Function `og-memes` fetches t.me/s/ogmemesroom server-side
 *     (no CORS issues) and returns real post IDs + metadata.
 *  2. Each post is rendered via the official Telegram post widget
 *     (telegram-widget.js), which correctly displays .webp document posts
 *     using Telegram's own CDN — no fake thumbnails, no placeholders.
 *  3. IntersectionObserver for lazy-loading widgets.
 *  4. "Load more" pagination using ?before= query param.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  ExternalLink,
  Radio,
  Sparkles,
  AlertCircle,
} from "lucide-react";
// ─── Types ────────────────────────────────────────────────────────────────────

interface TgPost {
  id: number;
  link: string;
  date: string | null;
  views: number | null;
  docName: string | null;
}

interface FeedPage {
  channel: string;
  posts: TgPost[];
  nextBefore: number | null;
}

// ─── API proxy (Vercel serverless function — no CORS) ─────────────────────────

const API = "/api/og-memes";

async function fetchPosts(before?: number): Promise<FeedPage> {
  const url = before ? `${API}?before=${before}` : API;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Feed API returned ${res.status}`);
  return res.json();
}

// ─── Telegram Widget Component ─────────────────────────────────────────────────

/**
 * Renders a single Telegram post widget using the official telegram-widget.js.
 * Lazy-loads the widget script only when the container is visible.
 */
const TelegramPost = ({
  channel,
  postId,
}: {
  channel: string;
  postId: number;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(false);

  // Intersection observer — only inject script when card scrolls into view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Inject telegram-widget.js once visible
  useEffect(() => {
    if (!visible || !containerRef.current || loaded) return;

    const wrapper = containerRef.current;
    wrapper.innerHTML = ""; // clear previous if re-render

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-post", `${channel}/${postId}`);
    script.setAttribute("data-width", "100%");
    script.setAttribute("data-dark", "1");
    script.setAttribute("data-dark-color", "22d3ee");
    script.async = true;
    script.onload = () => setLoaded(true);

    wrapper.appendChild(script);
  }, [visible, channel, postId, loaded]);

  return (
    <div className="og-glass-frame rounded-2xl overflow-hidden transition-all duration-200">
      {/* Skeleton while widget loads */}
      {!loaded && (
        <div className="p-4 space-y-3 animate-pulse">
          <Skeleton className="w-full h-48 rounded-xl bg-white/[0.05]" />
          <Skeleton className="w-3/4 h-3 rounded bg-white/[0.05]" />
          <Skeleton className="w-1/2 h-3 rounded bg-white/[0.05]" />
        </div>
      )}

      {/* Widget mounts here */}
      <div
        ref={containerRef}
        className={`tg-widget-host ${loaded ? "" : "hidden"}`}
        style={{ minHeight: loaded ? undefined : 0 }}
      />
    </div>
  );
};

// ─── Main Feed Component ───────────────────────────────────────────────────────

const ArtFeed = ({ inline = false }: { inline?: boolean }) => {
  const [posts, setPosts] = useState<TgPost[]>([]);
  const [channel, setChannel] = useState("ogmemesroom");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const loadFresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPosts();
      setChannel(page.channel);
      setPosts(page.posts);
      setNextBefore(page.nextBefore);
      setHasMore(page.posts.length >= 10 && page.nextBefore !== null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not load the meme feed. Try again shortly."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPosts(nextBefore);
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.posts.filter((p) => !seen.has(p.id))];
      });
      setNextBefore(page.nextBefore);
      setHasMore(page.posts.length >= 10 && page.nextBefore !== null);
    } catch {
      // silent — just stop showing load more
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [nextBefore, loadingMore]);

  useEffect(() => {
    loadFresh();
  }, [loadFresh]);

  const content = (
    <>
      <PageHeader
        title="Art & Memes"
        description={`Live feed from @${channel} on Telegram`}
      >
        <div className="flex items-center gap-2">
          <Badge className="bg-red-500/15 text-red-400 border-red-500/20 gap-1.5 text-[10px] font-bold animate-pulse">
            <Radio className="h-2.5 w-2.5" /> LIVE
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={loadFresh}
            disabled={loading}
            className="border-white/10 text-white/60 hover:text-white h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <a
            href={`https://t.me/${channel}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="outline"
              size="sm"
              className="border-[#22d3ee]/20 text-[#22d3ee] hover:bg-[#22d3ee]/10 h-8 gap-1.5 text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Join Channel
            </Button>
          </a>
        </div>
      </PageHeader>

      <div className="p-4 lg:p-6">
        {/* Channel banner */}
        <div className="og-glass-frame rounded-2xl p-4 mb-6 flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#22d3ee] to-[#eab308] flex items-center justify-center text-xl font-black text-black">
              OG
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-400 border-2 border-[#070d14]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-black text-white">OG Memes Room</p>
              <Badge className="bg-[#22d3ee]/10 text-[#22d3ee] border-[#22d3ee]/20 text-[9px] font-bold">
                OFFICIAL
              </Badge>
            </div>
            <p className="text-xs text-white/40 mt-0.5">
              The official OG Scan meme channel on Telegram — live, unfiltered.
            </p>
          </div>
          <Sparkles className="h-5 w-5 text-[#eab308] shrink-0" />
        </div>

        {/* ── Loading state ── */}
        {loading ? (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="break-inside-avoid mb-4">
                <div className="og-glass-frame rounded-2xl p-4 space-y-3 animate-pulse">
                  <Skeleton
                    className="w-full rounded-xl bg-white/[0.05]"
                    style={{ height: `${180 + (i % 3) * 60}px` }}
                  />
                  <Skeleton className="w-3/4 h-3 rounded bg-white/[0.05]" />
                  <Skeleton className="w-1/2 h-3 rounded bg-white/[0.05]" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          /* ── Error state ── */
          <div className="text-center py-20 space-y-4">
            <AlertCircle className="h-10 w-10 text-white/20 mx-auto" />
            <p className="text-white/40 text-sm">{error}</p>
            <Button
              onClick={loadFresh}
              variant="outline"
              className="border-white/10 text-white/60"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        ) : posts.length === 0 ? (
          /* ── Empty state ── */
          <div className="text-center py-20 space-y-4">
            <div className="text-4xl">🎨</div>
            <p className="text-white/50">No posts yet — check back soon!</p>
            <a
              href={`https://t.me/${channel}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Open Telegram Channel
              </Button>
            </a>
          </div>
        ) : (
          /* ── Posts grid ── */
          <>
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
              {posts.map((post) => (
                <div key={post.id} className="break-inside-avoid mb-4">
                  <TelegramPost channel={channel} postId={post.id} />
                </div>
              ))}
            </div>

            {/* Load more */}
            <div className="flex justify-center py-8">
              {hasMore ? (
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="border-white/10 text-white/60 hover:text-white gap-2"
                >
                  {loadingMore ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load more memes"
                  )}
                </Button>
              ) : (
                <p className="text-xs text-white/20">
                  You&apos;ve seen all the memes 🎉
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
  return inline ? content : <AppLayout>{content}</AppLayout>;
};

export default ArtFeed;
