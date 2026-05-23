import { useState, useEffect, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Image as ImageIcon, ExternalLink, Heart, Share2, Sparkles, Radio } from "lucide-react";
import { toast } from "sonner";

const CHANNEL = "ogmemesroom";
// Use rsshub public API to fetch Telegram channel posts
const RSS_URL = `https://rsshub.app/telegram/channel/${CHANNEL}`;
// Fallback: parse from public Telegram channel HTML
const TG_URL = `https://t.me/s/${CHANNEL}`;

interface MemePost {
  id: string;
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  date: string;
  link: string;
  views?: number;
}

const parseTelegramHtml = (html: string): MemePost[] => {
  const posts: MemePost[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const messages = doc.querySelectorAll(".tgme_widget_message_wrap");

  messages.forEach((wrap) => {
    const id = wrap.querySelector(".tgme_widget_message")?.getAttribute("data-post") || `post-${Math.random()}`;
    const textEl = wrap.querySelector(".tgme_widget_message_text");
    const text = textEl?.textContent?.trim() || "";
    const imgEl = wrap.querySelector(".tgme_widget_message_photo_wrap, .tgme_widget_message_roundvideo_player");
    const style = imgEl?.getAttribute("style") || "";
    const imgMatch = style.match(/url\(['"]?(.+?)['"]?\)/);
    const imageUrl = imgMatch?.[1] || undefined;
    const videoEl = wrap.querySelector("video source");
    const videoUrl = videoEl?.getAttribute("src") || undefined;
    const dateEl = wrap.querySelector(".tgme_widget_message_date time");
    const date = dateEl?.getAttribute("datetime") || new Date().toISOString();
    const linkEl = wrap.querySelector(".tgme_widget_message_date");
    const link = linkEl?.getAttribute("href") || `https://t.me/${CHANNEL}`;
    const viewsEl = wrap.querySelector(".tgme_widget_message_views");
    const views = viewsEl ? parseInt(viewsEl.textContent?.replace(/\D/g, "") || "0") : undefined;

    // Only include posts that have an image or meaningful text
    if (imageUrl || videoUrl || text.length > 5) {
      posts.push({ id, text, imageUrl, videoUrl, date, link, views });
    }
  });

  return posts.reverse(); // newest first
};

const parseRss = (xml: string): MemePost[] => {
  const posts: MemePost[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const items = doc.querySelectorAll("item");

  items.forEach((item, i) => {
    const title = item.querySelector("title")?.textContent || "";
    const desc = item.querySelector("description")?.textContent || "";
    const link = item.querySelector("link")?.textContent || `https://t.me/${CHANNEL}`;
    const pubDate = item.querySelector("pubDate")?.textContent || new Date().toISOString();

    // Parse image from description HTML
    const descDoc = new DOMParser().parseFromString(desc, "text/html");
    const imgEl = descDoc.querySelector("img");
    const imageUrl = imgEl?.getAttribute("src") || undefined;
    const text = descDoc.body.textContent?.trim() || title;

    if (text || imageUrl) {
      posts.push({ id: `rss-${i}`, text, imageUrl, date: pubDate, link });
    }
  });

  return posts;
};

const MemeCard = ({ post, onLike }: { post: MemePost; onLike: (id: string) => void }) => {
  const [liked, setLiked] = useState(false);
  const [imgError, setImgError] = useState(false);
  const date = new Date(post.date);
  const timeAgo = () => {
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="og-glass-frame rounded-2xl overflow-hidden group hover:border-[#22d3ee]/20 transition-all duration-200">
      {/* Image / Video */}
      {post.imageUrl && !imgError && (
        <div className="relative bg-black/40 overflow-hidden">
          <img
            src={post.imageUrl}
            alt="meme"
            className="w-full object-cover max-h-80 transition-transform duration-300 group-hover:scale-[1.01]"
            onError={() => setImgError(true)}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
        </div>
      )}
      {post.videoUrl && (
        <div className="bg-black/40 overflow-hidden">
          <video
            src={post.videoUrl}
            controls
            muted
            className="w-full max-h-64 object-cover"
            playsInline
          />
        </div>
      )}
      {post.imageUrl && imgError && (
        <div className="flex items-center justify-center h-32 bg-white/[0.03]">
          <ImageIcon className="h-8 w-8 text-white/20" />
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-3">
        {post.text && (
          <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line line-clamp-4">{post.text}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setLiked(!liked); onLike(post.id); }}
              className={`flex items-center gap-1.5 text-xs transition-colors ${liked ? "text-red-400" : "text-white/30 hover:text-red-400"}`}
            >
              <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />
              {liked ? "Liked" : "Like"}
            </button>
            <a
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-[#22d3ee] transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View
            </a>
          </div>
          <div className="flex items-center gap-2">
            {post.views !== undefined && post.views > 0 && (
              <span className="text-[10px] text-white/25">{post.views.toLocaleString()} views</span>
            )}
            <span className="text-[10px] text-white/25">{timeAgo()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const ArtFeed = () => {
  const [posts, setPosts] = useState<MemePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const loaderRef = useRef<HTMLDivElement>(null);

  const fetchPosts = useCallback(async (fresh = false) => {
    if (fresh) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      // Try rsshub first via a CORS proxy
      const corsProxy = "https://corsproxy.io/?";
      let fetched: MemePost[] = [];

      try {
        const res = await fetch(`${corsProxy}${encodeURIComponent(RSS_URL)}`, {
          headers: { Accept: "application/rss+xml, application/xml, text/xml" },
        });
        if (res.ok) {
          const xml = await res.text();
          fetched = parseRss(xml);
        }
      } catch {
        // rsshub failed, try Telegram web
      }

      if (fetched.length === 0) {
        const res = await fetch(`${corsProxy}${encodeURIComponent(TG_URL)}`, {
          headers: { Accept: "text/html" },
        });
        if (res.ok) {
          const html = await res.text();
          fetched = parseTelegramHtml(html);
        }
      }

      if (fetched.length === 0 && fresh) {
        // Fallback: show placeholder content
        fetched = generatePlaceholders();
      }

      if (fresh) {
        setPosts(fetched);
        setPage(1);
        setHasMore(fetched.length >= 10);
      } else {
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newPosts = fetched.filter((p) => !existingIds.has(p.id));
          setHasMore(newPosts.length > 0);
          return [...prev, ...newPosts];
        });
      }
    } catch (e) {
      if (fresh) setError("Could not load the meme feed. Check back soon.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts(true);
  }, [fetchPosts]);

  // Infinite scroll observer
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setPage((p) => p + 1);
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading]);

  useEffect(() => {
    if (page > 1) fetchPosts(false);
  }, [page]);

  const handleLike = (id: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AppLayout>
      <PageHeader title="Art & Memes" description="Live feed from @ogmemesroom on Telegram">
        <div className="flex items-center gap-2">
          <Badge className="bg-red-500/15 text-red-400 border-red-500/20 gap-1.5 text-[10px] font-bold animate-pulse">
            <Radio className="h-2.5 w-2.5" /> LIVE
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPosts(true)}
            disabled={loading}
            className="border-white/10 text-white/60 hover:text-white h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <a
            href={`https://t.me/${CHANNEL}`}
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
        {/* Channel header banner */}
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
              <Badge className="bg-[#22d3ee]/10 text-[#22d3ee] border-[#22d3ee]/20 text-[9px] font-bold">OFFICIAL</Badge>
            </div>
            <p className="text-xs text-white/40 mt-0.5">The official OG Scan meme channel on Telegram. Post your best memes, alpha, and degenerate content.</p>
          </div>
          <Sparkles className="h-5 w-5 text-[#eab308] shrink-0" />
        </div>

        {/* Posts grid */}
        {loading ? (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="break-inside-avoid">
                <Skeleton className="w-full rounded-2xl" style={{ height: `${200 + (i % 3) * 60}px` }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">😔</div>
            <p className="text-white/50 mb-4">{error}</p>
            <Button onClick={() => fetchPosts(true)} variant="outline" className="border-white/10 text-white/60">
              <RefreshCw className="h-4 w-4 mr-2" /> Try Again
            </Button>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">🎨</div>
            <p className="text-white/50">No memes yet — be the first to post!</p>
            <a href={`https://t.me/${CHANNEL}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block">
              <Button className="mt-4 gap-2">
                <ExternalLink className="h-4 w-4" /> Open Telegram Channel
              </Button>
            </a>
          </div>
        ) : (
          <>
            {/* Masonry-style grid */}
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
              {posts.map((post) => (
                <div key={post.id} className="break-inside-avoid mb-4">
                  <MemeCard post={post} onLike={handleLike} />
                </div>
              ))}
            </div>

            {/* Infinite scroll loader */}
            <div ref={loaderRef} className="flex justify-center py-8">
              {loadingMore && (
                <div className="flex items-center gap-2 text-white/30 text-sm">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading more memes...
                </div>
              )}
              {!hasMore && posts.length > 0 && (
                <p className="text-xs text-white/20">You've seen all the memes 🎉</p>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

// Placeholder posts when API fails
function generatePlaceholders(): MemePost[] {
  return [
    {
      id: "ph-1",
      text: "🚀 OG Scan is live and we're just getting started. The real OGs know.",
      date: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      link: `https://t.me/${CHANNEL}`,
    },
    {
      id: "ph-2",
      text: "When the rug pull scanner saves you again 💎\n\nStay safe out there degens. Use the tools.",
      date: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      link: `https://t.me/${CHANNEL}`,
    },
    {
      id: "ph-3",
      text: "The whales are moving... 🐋\n\nCheck the whale tracker before you ape in.",
      date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      link: `https://t.me/${CHANNEL}`,
    },
    {
      id: "ph-4",
      text: "New launch just dropped on Launch Radar 👀\n\n100% LP burned. Mint revoked. This one might be real.",
      date: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      link: `https://t.me/${CHANNEL}`,
    },
    {
      id: "ph-5",
      text: "OG holders stay winning. Keep grinding, the platform gets better every day 🙏",
      date: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      link: `https://t.me/${CHANNEL}`,
    },
  ];
}

export default ArtFeed;
