/**
 * Communities — X/Twitter-style social feed for crypto communities.
 * Features: Posts, Threads, Articles, News tab, Comments, Likes, Reposts, Bookmarks.
 * Rendered inline inside Index.tsx — no AppLayout wrapper.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Users, Plus, Search, MessageSquare, Heart, Trash2, ArrowLeft,
  Repeat2, Bookmark, Share, Eye, ChevronRight,
  X as XIcon, Loader2, Newspaper, Home, PenSquare, Pin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface Community {
  id: string;
  name: string;
  description: string | null;
  privacy: string;
  created_by: string;
  creator_name: string | null;
  member_count: number;
  post_count?: number;
  created_at: string;
  icon: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  category?: string | null;
  is_active?: boolean;
  invite_code?: string | null;
}

interface Post {
  id: string;
  community_id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  content: string;
  image_url: string | null;
  likes_count: number;
  replies_count: number;
  reposts_count?: number;
  bookmarks_count?: number;
  views_count?: number;
  created_at: string;
  post_type?: string; // 'post' | 'thread' | 'article'
  thread_id?: string | null;
  thread_order?: number;
  is_article?: boolean;
  article_title?: string | null;
  article_cover_url?: string | null;
  is_pinned?: boolean;
  tags?: string[];
  // Client state
  liked?: boolean;
  reposted?: boolean;
  bookmarked?: boolean;
}

interface PostReply {
  id: string;
  post_id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  content: string;
  likes_count: number;
  created_at: string;
  liked?: boolean;
}

/* ═══════════════════════════════════════════════════════════════
   Main View Router
   ═══════════════════════════════════════════════════════════════ */

type MainView = "home" | "explore" | "news" | "community";
type FeedSort = "latest" | "top" | "trending";

const Communities = () => {
  const { user } = useAuth();
  const [mainView, setMainView] = useState<MainView>("home");
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);

  // When selecting a community, go to its feed
  const openCommunity = (c: Community) => {
    setSelectedCommunity(c);
    setMainView("community");
    setSelectedPost(null);
  };

  // When selecting a post, show post detail with replies
  const openPost = (p: Post) => {
    setSelectedPost(p);
  };

  const goBack = () => {
    if (selectedPost) {
      setSelectedPost(null);
    } else if (selectedCommunity) {
      setSelectedCommunity(null);
      setMainView("home");
    }
  };

  return (
    <div className="max-w-2xl mx-auto relative">
      {/* ─── Top Nav ─── */}
      <TopNav
        mainView={mainView}
        setMainView={setMainView}
        selectedCommunity={selectedCommunity}
        selectedPost={selectedPost}
        goBack={goBack}
        onCompose={() => setShowCompose(true)}
      />

      {/* ─── Content ─── */}
      {selectedPost ? (
        <PostDetail
          post={selectedPost}
          user={user}
          onBack={() => setSelectedPost(null)}
        />
      ) : mainView === "community" && selectedCommunity ? (
        <CommunityFeed
          community={selectedCommunity}
          user={user}
          onSelectPost={openPost}
          onCompose={() => setShowCompose(true)}
        />
      ) : mainView === "news" ? (
        <NewsFeed user={user} onSelectPost={openPost} />
      ) : mainView === "explore" ? (
        <ExploreCommunities
          user={user}
          onSelect={openCommunity}
          onCreateNew={() => setShowCreateCommunity(true)}
        />
      ) : (
        <HomeFeed
          user={user}
          onSelectPost={openPost}
          onSelectCommunity={openCommunity}
        />
      )}

      {/* ─── FAB ─── */}
      <button
        onClick={() => setShowCompose(true)}
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 w-14 h-14 rounded-full bg-primary shadow-lg shadow-primary/30 flex items-center justify-center text-white hover:scale-105 transition-transform"
      >
        <PenSquare className="h-5 w-5" />
      </button>

      {/* ─── Compose Modal ─── */}
      {showCompose && (
        <ComposeModal
          user={user}
          community={selectedCommunity}
          onClose={() => setShowCompose(false)}
        />
      )}

      {/* ─── Create Community Modal ─── */}
      {showCreateCommunity && (
        <CreateCommunityModal
          user={user}
          onClose={() => setShowCreateCommunity(false)}
          onCreated={(c) => { setShowCreateCommunity(false); openCommunity(c); }}
        />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Top Navigation — X-style tabs
   ═══════════════════════════════════════════════════════════════ */

function TopNav({
  mainView, setMainView, selectedCommunity, selectedPost, goBack, onCompose
}: {
  mainView: MainView;
  setMainView: (v: MainView) => void;
  selectedCommunity: Community | null;
  selectedPost: Post | null;
  goBack: () => void;
  onCompose: () => void;
}) {
  const showBack = !!selectedPost || !!selectedCommunity;
  const title = selectedPost
    ? "Post"
    : selectedCommunity
      ? selectedCommunity.name
      : "Communities";

  return (
    <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
      {/* Title bar */}
      <div className="flex items-center gap-3 px-4 py-3">
        {showBack && (
          <button onClick={goBack} className="p-1 -ml-1 rounded-full hover:bg-white/[0.06] text-white/60">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-lg font-bold text-white flex-1 truncate">{title}</h1>
        {!showBack && (
          <button onClick={onCompose} className="p-2 rounded-full hover:bg-white/[0.06] text-white/40">
            <PenSquare className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Tab bar — only show on root views */}
      {!selectedPost && !selectedCommunity && (
        <div className="flex border-b border-white/[0.04]">
          {([
            { id: "home" as MainView, label: "Home", icon: <Home className="h-4 w-4" /> },
            { id: "explore" as MainView, label: "Explore", icon: <Search className="h-4 w-4" /> },
            { id: "news" as MainView, label: "News", icon: <Newspaper className="h-4 w-4" /> },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setMainView(tab.id)}
              className={cn(
                "flex-1 py-3 text-center text-sm font-medium transition-colors relative",
                mainView === tab.id ? "text-white" : "text-white/30 hover:text-white/50"
              )}
            >
              {tab.label}
              {mainView === tab.id && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-[3px] rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Home Feed — All posts from joined communities
   ═══════════════════════════════════════════════════════════════ */

function HomeFeed({
  user, onSelectPost, onSelectCommunity
}: {
  user: any;
  onSelectPost: (p: Post) => void;
  onSelectCommunity: (c: Community) => void;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<FeedSort>("latest");

  // Fetch communities for the horizontal scroll
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("communities").select("*")
        .eq("is_active", true).order("member_count", { ascending: false }).limit(20);
      setCommunities((data || []) as Community[]);
    })();
  }, []);

  const fetchHomeFeed = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase.from("community_posts").select("*").limit(50);
      if (sort === "latest") q = q.order("created_at", { ascending: false });
      else if (sort === "top") q = q.order("likes_count", { ascending: false });
      else q = q.order("views_count", { ascending: false });

      const { data } = await q;
      let items = (data || []) as Post[];

      // Enrich with user's interactions
      if (user && items.length > 0) {
        const ids = items.map(p => p.id);
        const [likes, reposts, bookmarks] = await Promise.all([
          supabase.from("community_post_likes").select("post_id").eq("user_id", user.id).in("post_id", ids),
          supabase.from("community_reposts").select("post_id").eq("user_id", user.id).in("post_id", ids),
          supabase.from("community_bookmarks").select("post_id").eq("user_id", user.id).in("post_id", ids),
        ]);
        const likeSet = new Set((likes.data || []).map(l => l.post_id));
        const repostSet = new Set((reposts.data || []).map(r => r.post_id));
        const bookmarkSet = new Set((bookmarks.data || []).map(b => b.post_id));
        items = items.map(p => ({
          ...p,
          liked: likeSet.has(p.id),
          reposted: repostSet.has(p.id),
          bookmarked: bookmarkSet.has(p.id),
        }));
      }

      setPosts(items);
    } catch (e) {
      console.error("HomeFeed error:", e);
    } finally {
      setLoading(false);
    }
  }, [user, sort]);

  useEffect(() => { fetchHomeFeed(); }, [fetchHomeFeed]);

  return (
    <div>
      {/* Your Communities — horizontal scroll */}
      {communities.length > 0 && (
        <div className="py-3 border-b border-white/[0.04]">
          <div className="flex items-center justify-between px-4 mb-2.5">
            <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Your Communities</p>
            <button onClick={() => onSelectCommunity(communities[0])} className="text-[10px] text-primary font-medium">See all</button>
          </div>
          <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide pb-1">
            {communities.map(c => (
              <CommunityCard key={c.id} community={c} onClick={() => onSelectCommunity(c)} variant="compact" />
            ))}
          </div>
        </div>
      )}

      {/* Sort tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-white/[0.04]">
        {(["latest", "top", "trending"] as FeedSort[]).map(s => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              sort === s ? "bg-primary/10 text-primary" : "text-white/25 hover:text-white/40"
            )}
          >
            {s === "latest" ? "Latest" : s === "top" ? "🔥 Top" : "📈 Trending"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 text-white/10 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-10 w-10" />}
          title="No posts yet"
          subtitle="Join a community and start posting!"
        />
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              user={user}
              onClick={() => onSelectPost(post)}
              onUpdate={fetchHomeFeed}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Explore — Discover communities
   ═══════════════════════════════════════════════════════════════ */

function ExploreCommunities({
  user, onSelect, onCreateNew
}: {
  user: any;
  onSelect: (c: Community) => void;
  onCreateNew: () => void;
}) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("communities").select("*")
        .eq("is_active", true)
        .order("member_count", { ascending: false });
      setCommunities((data || []) as Community[]);
      setLoading(false);
    })();
  }, []);

  const categories = ["all", ...Array.from(new Set(communities.map(c => c.category).filter(Boolean)))];

  const filtered = communities.filter(c => {
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = activeCategory === "all" || c.category === activeCategory;
    return matchSearch && matchCategory;
  });

  const featured = communities.slice(0, 3);

  return (
    <div>
      {/* Search */}
      <div className="p-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
          <input
            type="text"
            placeholder="Search communities..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-white/25 focus:border-primary/30 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Category pills */}
      {categories.length > 1 && (
        <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat || "all"}
              onClick={() => setActiveCategory(cat || "all")}
              className={cn("shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                activeCategory === cat
                  ? "bg-primary text-white"
                  : "bg-white/[0.04] text-white/30 hover:text-white/50"
              )}
            >
              {cat === "all" ? "All" : cat}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 text-white/10 animate-spin" />
        </div>
      ) : (
        <>
          {/* Featured — large cards */}
          {!search && featured.length > 0 && (
            <div className="px-4 pb-4">
              <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Featured</p>
              <div className="space-y-3">
                {featured.map(c => (
                  <CommunityCard key={c.id} community={c} onClick={() => onSelect(c)} variant="grid" />
                ))}
              </div>
            </div>
          )}

          {/* Create new */}
          <button
            onClick={onCreateNew}
            className="w-full flex items-center gap-3 px-4 py-3 border-y border-white/[0.04] hover:bg-white/[0.02] transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-bold text-white">Create a Community</p>
              <p className="text-[11px] text-white/25">Start your own crypto community</p>
            </div>
            <ChevronRight className="h-4 w-4 text-white/10" />
          </button>

          {/* All communities list */}
          <div className="px-4 pt-3 pb-1">
            <p className="text-xs font-bold text-white/40 uppercase tracking-wider">All Communities ({filtered.length})</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {filtered.map(c => (
              <CommunityCard key={c.id} community={c} onClick={() => onSelect(c)} variant="list" />
            ))}
          </div>
          {filtered.length === 0 && (
            <EmptyState
              icon={<Search className="h-8 w-8" />}
              title="No communities found"
              subtitle="Try a different search or create one"
            />
          )}
        </>
      )}
    </div>
  );
}

function CommunityCard({ community: c, onClick, variant = "list" }: { community: Community; onClick: () => void; variant?: "list" | "grid" | "compact" }) {
  // Deterministic gradient based on community name
  const gradients = [
    "from-blue-600/40 via-purple-600/30 to-pink-600/20",
    "from-emerald-600/40 via-teal-600/30 to-cyan-600/20",
    "from-amber-600/40 via-orange-600/30 to-red-600/20",
    "from-violet-600/40 via-fuchsia-600/30 to-pink-600/20",
    "from-cyan-600/40 via-blue-600/30 to-indigo-600/20",
    "from-rose-600/40 via-pink-600/30 to-purple-600/20",
  ];
  const gradIdx = c.name.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0) % gradients.length;

  if (variant === "compact") {
    return (
      <button onClick={onClick} className="flex flex-col items-center gap-1.5 shrink-0 w-[72px]">
        <div className={cn("w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-xl shadow-lg", gradients[gradIdx])}>
          {c.icon || c.name.charAt(0).toUpperCase()}
        </div>
        <span className="text-[10px] text-white/50 font-medium truncate w-full text-center">{c.name}</span>
      </button>
    );
  }

  if (variant === "grid") {
    return (
      <button onClick={onClick} className="group rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all hover:border-white/[0.12] w-full text-left">
        {/* Banner */}
        <div className={cn("h-20 w-full bg-gradient-to-br relative", gradients[gradIdx])}>
          {c.banner_url && (
            <img src={c.banner_url} className="w-full h-full object-cover" alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <div className="absolute -bottom-5 left-3">
            <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-base border-2 border-black shadow-lg", gradients[gradIdx])}>
              {c.icon || c.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
        <div className="pt-7 px-3 pb-3">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold text-white truncate">{c.name}</p>
            {c.privacy === "private" && <span className="text-[9px] text-white/30">🔒</span>}
          </div>
          {c.description && (
            <p className="text-[11px] text-white/30 line-clamp-2 mt-1 leading-relaxed">{c.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-white/20 flex items-center gap-1">
              <Users className="h-3 w-3" /> {c.member_count || 0}
            </span>
            {c.category && (
              <span className="text-[9px] text-primary/50 bg-primary/5 px-1.5 py-0.5 rounded-full">{c.category}</span>
            )}
          </div>
        </div>
      </button>
    );
  }

  // Default: list variant
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left">
      <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-lg shrink-0", gradients[gradIdx])}>
        {c.icon || c.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-bold text-white truncate">{c.name}</p>
          {c.privacy === "private" && <span className="text-[9px] text-white/20">🔒</span>}
        </div>
        {c.description && (
          <p className="text-xs text-white/30 truncate mt-0.5">{c.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] text-white/20 flex items-center gap-1">
            <Users className="h-3 w-3" /> {c.member_count || 0} members
          </span>
          {c.category && (
            <span className="text-[9px] text-primary/40">{c.category}</span>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-white/10 shrink-0" />
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   News Feed — Articles only
   ═══════════════════════════════════════════════════════════════ */

function NewsFeed({ user, onSelectPost }: { user: any; onSelectPost: (p: Post) => void }) {
  const [articles, setArticles] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("community_posts")
        .select("*")
        .eq("is_article", true)
        .order("created_at", { ascending: false })
        .limit(30);
      setArticles((data || []) as Post[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 text-white/10 animate-spin" />
        </div>
      ) : articles.length === 0 ? (
        <EmptyState
          icon={<Newspaper className="h-10 w-10" />}
          title="No articles yet"
          subtitle="Be the first to write an article for the community"
        />
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {articles.map(article => (
            <button
              key={article.id}
              onClick={() => onSelectPost(article)}
              className="w-full text-left p-4 hover:bg-white/[0.02] transition-colors"
            >
              {article.article_cover_url && (
                <div className="rounded-xl overflow-hidden mb-3 aspect-[2/1]">
                  <img src={article.article_cover_url} className="w-full h-full object-cover" alt="" />
                </div>
              )}
              <p className="text-base font-bold text-white leading-tight">
                {article.article_title || article.content.slice(0, 100)}
              </p>
              <p className="text-xs text-white/30 mt-1.5 line-clamp-2">
                {article.content.slice(0, 200)}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Avatar url={article.avatar_url} name={article.username} size="xs" />
                <span className="text-[10px] text-white/30">{article.username || "Anonymous"}</span>
                <span className="text-[10px] text-white/15">·</span>
                <span className="text-[10px] text-white/15">
                  {formatDistanceToNow(new Date(article.created_at), { addSuffix: true })}
                </span>
                <span className="text-[10px] text-white/15">·</span>
                <span className="text-[10px] text-white/15 flex items-center gap-0.5">
                  <Eye className="h-2.5 w-2.5" /> {article.views_count || 0}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Community Feed — Posts within a specific community
   ═══════════════════════════════════════════════════════════════ */

function CommunityFeed({
  community, user, onSelectPost, onCompose
}: {
  community: Community;
  user: any;
  onSelectPost: (p: Post) => void;
  onCompose: () => void;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "posts" | "articles" | "threads">("all");

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("community_posts")
      .select("*")
      .eq("community_id", community.id)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);

    if (filter === "articles") q = q.eq("is_article", true);
    else if (filter === "threads") q = q.eq("post_type", "thread").is("thread_id", null);
    else if (filter === "posts") q = q.eq("post_type", "post");

    const { data } = await q;
    let items = (data || []) as Post[];

    if (user && items.length > 0) {
      const ids = items.map(p => p.id);
      const [likes, reposts, bookmarks] = await Promise.all([
        supabase.from("community_post_likes").select("post_id").eq("user_id", user.id).in("post_id", ids),
        supabase.from("community_reposts").select("post_id").eq("user_id", user.id).in("post_id", ids),
        supabase.from("community_bookmarks").select("post_id").eq("user_id", user.id).in("post_id", ids),
      ]);
      const likeSet = new Set((likes.data || []).map(l => l.post_id));
      const repostSet = new Set((reposts.data || []).map(r => r.post_id));
      const bookmarkSet = new Set((bookmarks.data || []).map(b => b.post_id));
      items = items.map(p => ({
        ...p,
        liked: likeSet.has(p.id),
        reposted: repostSet.has(p.id),
        bookmarked: bookmarkSet.has(p.id),
      }));
    }

    setPosts(items);
    setLoading(false);
  }, [community.id, user, filter]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel(`cf-${community.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts", filter: `community_id=eq.${community.id}` }, () => fetchPosts())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [community.id, fetchPosts]);

  return (
    <div>
      {/* Community header — X-style with banner */}
      {(() => {
        const gradients = [
          "from-blue-600/60 via-purple-600/40 to-pink-600/30",
          "from-emerald-600/60 via-teal-600/40 to-cyan-600/30",
          "from-amber-600/60 via-orange-600/40 to-red-600/30",
          "from-violet-600/60 via-fuchsia-600/40 to-pink-600/30",
        ];
        const gIdx = community.name.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0) % gradients.length;
        return (
          <div className="border-b border-white/[0.06]">
            {/* Banner */}
            <div className={cn("h-28 w-full bg-gradient-to-br relative", gradients[gIdx])}>
              {community.banner_url && (
                <img src={community.banner_url} className="w-full h-full object-cover" alt=""
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
              <div className="absolute -bottom-7 left-4">
                <div className={cn("w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-2xl border-[3px] border-black shadow-xl", gradients[gIdx])}>
                  {community.icon || community.name.charAt(0)}
                </div>
              </div>
            </div>
            {/* Info */}
            <div className="pt-9 px-4 pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-white">{community.name}</h2>
                  {community.description && (
                    <p className="text-[13px] text-white/40 mt-1 leading-relaxed">{community.description}</p>
                  )}
                </div>
                <button
                  onClick={onCompose}
                  className="shrink-0 ml-3 px-4 py-1.5 rounded-full bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors"
                >
                  Post
                </button>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <span className="text-xs text-white/25 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> <span className="font-bold text-white/60">{community.member_count || 0}</span> members
                </span>
                {community.category && (
                  <span className="text-[10px] text-primary/50 bg-primary/5 px-2 py-0.5 rounded-full">{community.category}</span>
                )}
                {community.privacy === "private" && (
                  <span className="text-[10px] text-white/20">🔒 Private</span>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Filter tabs */}
      <div className="flex border-b border-white/[0.04]">
        {(["all", "posts", "threads", "articles"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn("flex-1 py-2.5 text-xs font-medium transition-colors relative capitalize",
              filter === f ? "text-white" : "text-white/25"
            )}
          >
            {f}
            {filter === f && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-[2px] rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 text-white/10 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<PenSquare className="h-8 w-8" />}
          title="No posts yet"
          subtitle="Start the conversation"
        />
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              user={user}
              onClick={() => onSelectPost(post)}
              onUpdate={fetchPosts}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Post Card — X/Twitter style
   ═══════════════════════════════════════════════════════════════ */

function PostCard({
  post, user, onClick, onUpdate, compact = false
}: {
  post: Post;
  user: any;
  onClick?: () => void;
  onUpdate?: () => void;
  compact?: boolean;
}) {
  const isArticle = post.is_article || post.post_type === "article";
  const isThread = post.post_type === "thread" && !post.thread_id;

  return (
    <article
      onClick={onClick}
      className={cn(
        "px-4 py-3 hover:bg-white/[0.015] transition-colors cursor-pointer",
        post.is_pinned && "bg-primary/[0.03]"
      )}
    >
      {/* Pinned label */}
      {post.is_pinned && (
        <div className="flex items-center gap-1 ml-12 mb-1 text-[10px] text-white/20">
          <Pin className="h-3 w-3" /> Pinned
        </div>
      )}

      <div className="flex gap-3">
        {/* Avatar */}
        <Avatar url={post.avatar_url} name={post.username} size="md" />

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-white truncate">
              {post.username || "Anonymous"}
            </span>
            <span className="text-xs text-white/15">·</span>
            <span className="text-xs text-white/15 shrink-0">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </span>
            {isThread && (
              <Badge className="text-[7px] bg-blue-500/10 text-blue-400 border-blue-500/20 ml-1">Thread</Badge>
            )}
            {isArticle && (
              <Badge className="text-[7px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 ml-1">Article</Badge>
            )}
          </div>

          {/* Article title */}
          {isArticle && post.article_title && (
            <p className="text-base font-bold text-white mt-1 leading-tight">{post.article_title}</p>
          )}

          {/* Content */}
          <div className={cn("mt-1 text-sm text-white/70 leading-relaxed whitespace-pre-wrap break-words",
            compact ? "line-clamp-3" : "line-clamp-6"
          )}>
            {post.content}
          </div>

          {/* Article cover image */}
          {isArticle && post.article_cover_url && (
            <div className="mt-2 rounded-xl overflow-hidden border border-white/[0.06]">
              <img src={post.article_cover_url} className="w-full aspect-[2/1] object-cover" alt=""
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}

          {/* Post image */}
          {!isArticle && post.image_url && (
            <div className="mt-2 rounded-xl overflow-hidden border border-white/[0.06]">
              <img src={post.image_url} className="w-full max-h-96 object-cover" alt=""
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex gap-1 mt-2">
              {post.tags.slice(0, 3).map((t, i) => (
                <span key={i} className="text-[9px] text-primary/60">#{t}</span>
              ))}
            </div>
          )}

          {/* Thread indicator */}
          {isThread && (
            <p className="text-xs text-primary mt-2 flex items-center gap-1">
              Show thread <ChevronRight className="h-3 w-3" />
            </p>
          )}

          {/* Action bar */}
          <PostActions post={post} user={user} onUpdate={onUpdate} />
        </div>
      </div>
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Post Actions — Like, Reply, Repost, Bookmark, Share
   ═══════════════════════════════════════════════════════════════ */

function PostActions({
  post, user, onUpdate
}: {
  post: Post;
  user: any;
  onUpdate?: () => void;
}) {
  const [liked, setLiked] = useState(post.liked || false);
  const [likeCount, setLikeCount] = useState(post.likes_count || 0);
  const [reposted, setReposted] = useState(post.reposted || false);
  const [repostCount, setRepostCount] = useState(post.reposts_count || 0);
  const [bookmarked, setBookmarked] = useState(post.bookmarked || false);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { toast.error("Sign in to like"); return; }
    try {
      if (liked) {
        await supabase.from("community_post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
        setLiked(false);
        setLikeCount(c => Math.max(0, c - 1));
        await supabase.from("community_posts").update({ likes_count: Math.max(0, likeCount - 1) }).eq("id", post.id);
      } else {
        await supabase.from("community_post_likes").insert({ post_id: post.id, user_id: user.id });
        setLiked(true);
        setLikeCount(c => c + 1);
        await supabase.from("community_posts").update({ likes_count: likeCount + 1 }).eq("id", post.id);
      }
    } catch {}
  };

  const handleRepost = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { toast.error("Sign in to repost"); return; }
    try {
      if (reposted) {
        await supabase.from("community_reposts").delete().eq("post_id", post.id).eq("user_id", user.id);
        setReposted(false);
        setRepostCount(c => Math.max(0, c - 1));
      } else {
        await supabase.from("community_reposts").insert({ post_id: post.id, user_id: user.id });
        setReposted(true);
        setRepostCount(c => c + 1);
      }
    } catch {}
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { toast.error("Sign in to bookmark"); return; }
    try {
      if (bookmarked) {
        await supabase.from("community_bookmarks").delete().eq("post_id", post.id).eq("user_id", user.id);
        setBookmarked(false);
      } else {
        await supabase.from("community_bookmarks").insert({ post_id: post.id, user_id: user.id });
        setBookmarked(true);
      }
      toast.success(bookmarked ? "Removed bookmark" : "Bookmarked!");
    } catch {}
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}?post=${post.id}`);
    toast.success("Link copied!");
  };

  return (
    <div className="flex items-center justify-between mt-2 -ml-2 max-w-sm" onClick={e => e.stopPropagation()}>
      {/* Reply */}
      <ActionBtn icon={<MessageSquare className="h-4 w-4" />} count={post.replies_count || 0} />
      {/* Repost */}
      <ActionBtn
        icon={<Repeat2 className="h-4 w-4" />}
        count={repostCount}
        active={reposted}
        activeColor="text-emerald-400"
        onClick={handleRepost}
      />
      {/* Like */}
      <ActionBtn
        icon={<Heart className={cn("h-4 w-4", liked && "fill-current")} />}
        count={likeCount}
        active={liked}
        activeColor="text-pink-400"
        onClick={handleLike}
      />
      {/* Views */}
      <ActionBtn icon={<Eye className="h-4 w-4" />} count={post.views_count || 0} />
      {/* Bookmark */}
      <button
        onClick={handleBookmark}
        className={cn("p-2 rounded-full hover:bg-primary/10 transition-colors",
          bookmarked ? "text-primary" : "text-white/20"
        )}
      >
        <Bookmark className={cn("h-4 w-4", bookmarked && "fill-current")} />
      </button>
      {/* Share */}
      <button onClick={handleShare} className="p-2 rounded-full text-white/20 hover:bg-primary/10 hover:text-primary transition-colors">
        <Share className="h-4 w-4" />
      </button>
    </div>
  );
}

function ActionBtn({
  icon, count, active, activeColor, onClick
}: {
  icon: React.ReactNode;
  count: number;
  active?: boolean;
  activeColor?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn("flex items-center gap-1 p-2 rounded-full hover:bg-white/[0.04] transition-colors",
        active ? activeColor : "text-white/20"
      )}
    >
      {icon}
      {count > 0 && <span className="text-[11px]">{count}</span>}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Post Detail — Full post with replies
   ═══════════════════════════════════════════════════════════════ */

function PostDetail({ post, user, onBack }: { post: Post; user: any; onBack: () => void }) {
  const [replies, setReplies] = useState<PostReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [threadPosts, setThreadPosts] = useState<Post[]>([]);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const isThread = post.post_type === "thread" && !post.thread_id;

  const fetchReplies = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("community_post_replies")
      .select("*")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    let items = (data || []) as PostReply[];

    if (user && items.length > 0) {
      const ids = items.map(r => r.id);
      const { data: likes } = await supabase.from("community_reply_likes")
        .select("reply_id").eq("user_id", user.id).in("reply_id", ids);
      const likedSet = new Set((likes || []).map(l => l.reply_id));
      items = items.map(r => ({ ...r, liked: likedSet.has(r.id) }));
    }

    setReplies(items);

    // If thread, fetch thread children
    if (isThread) {
      const { data: children } = await supabase.from("community_posts")
        .select("*")
        .eq("thread_id", post.id)
        .order("thread_order", { ascending: true });
      setThreadPosts((children || []) as Post[]);
    }

    setLoading(false);
  }, [post.id, user, isThread]);

  useEffect(() => { fetchReplies(); }, [fetchReplies]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel(`pr-${post.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_post_replies", filter: `post_id=eq.${post.id}` }, () => fetchReplies())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [post.id, fetchReplies]);

  // Increment views
  useEffect(() => {
    supabase.from("community_posts").update({ views_count: (post.views_count || 0) + 1 }).eq("id", post.id).then(() => {});
  }, [post.id]);

  const submitReply = async () => {
    if (!replyText.trim() || !user) return;
    setSending(true);
    try {
      const { data: profile } = await supabase.from("profiles")
        .select("username, avatar_url").eq("user_id", user.id).maybeSingle();
      await supabase.from("community_post_replies").insert({
        post_id: post.id,
        user_id: user.id,
        username: profile?.username || user.email?.split("@")[0] || "anon",
        avatar_url: profile?.avatar_url,
        content: replyText.trim(),
      });
      await supabase.from("community_posts").update({
        replies_count: (post.replies_count || 0) + 1
      }).eq("id", post.id);
      setReplyText("");
      fetchReplies();
      toast.success("Reply posted!");
    } catch (e: any) {
      toast.error("Failed to reply");
    } finally {
      setSending(false);
    }
  };

  const likeReply = async (reply: PostReply) => {
    if (!user) return;
    try {
      if (reply.liked) {
        await supabase.from("community_reply_likes").delete().eq("reply_id", reply.id).eq("user_id", user.id);
      } else {
        await supabase.from("community_reply_likes").insert({ reply_id: reply.id, user_id: user.id });
      }
      await supabase.from("community_post_replies").update({
        likes_count: reply.liked ? Math.max(0, reply.likes_count - 1) : reply.likes_count + 1
      }).eq("id", reply.id);
      fetchReplies();
    } catch {}
  };

  const deleteReply = async (replyId: string) => {
    if (!user) return;
    await supabase.from("community_post_replies").delete().eq("id", replyId);
    await supabase.from("community_posts").update({
      replies_count: Math.max(0, (post.replies_count || 0) - 1)
    }).eq("id", post.id);
    fetchReplies();
  };

  return (
    <div>
      {/* Main post */}
      <div className="px-4 pt-3 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 mb-3">
          <Avatar url={post.avatar_url} name={post.username} size="lg" />
          <div>
            <p className="text-sm font-bold text-white">{post.username || "Anonymous"}</p>
            <p className="text-xs text-white/20">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>

        {post.is_article && post.article_title && (
          <h2 className="text-xl font-bold text-white mb-2">{post.article_title}</h2>
        )}

        <div className="text-[15px] text-white/80 leading-relaxed whitespace-pre-wrap break-words">
          {post.content}
        </div>

        {post.image_url && (
          <div className="mt-3 rounded-xl overflow-hidden border border-white/[0.06]">
            <img src={post.image_url} className="w-full max-h-[500px] object-cover" alt=""
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
        )}

        {post.article_cover_url && (
          <div className="mt-3 rounded-xl overflow-hidden border border-white/[0.06]">
            <img src={post.article_cover_url} className="w-full aspect-[2/1] object-cover" alt="" />
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.04] text-xs text-white/20">
          <span>{post.replies_count || 0} replies</span>
          <span>{post.reposts_count || 0} reposts</span>
          <span>{post.likes_count || 0} likes</span>
          <span>{post.views_count || 0} views</span>
        </div>

        <PostActions post={post} user={user} />
      </div>

      {/* Thread posts */}
      {threadPosts.length > 0 && (
        <div className="border-b border-white/[0.06]">
          <div className="px-4 py-2 text-[10px] text-white/20 uppercase tracking-wider">Thread</div>
          {threadPosts.map((tp, i) => (
            <div key={tp.id} className="px-4 py-3 border-t border-white/[0.03]">
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <Avatar url={tp.avatar_url} name={tp.username} size="sm" />
                  {i < threadPosts.length - 1 && <div className="w-0.5 flex-1 bg-white/[0.06] mt-1" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">{tp.username}</span>
                    <span className="text-[10px] text-white/15">
                      {formatDistanceToNow(new Date(tp.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-white/70 mt-1 whitespace-pre-wrap">{tp.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply composer */}
      {user && (
        <div className="px-4 py-3 border-b border-white/[0.06] flex gap-3">
          <Avatar url={null} name={user.email} size="sm" />
          <div className="flex-1">
            <textarea
              ref={replyRef}
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Post your reply..."
              maxLength={5000}
              className="w-full bg-transparent text-sm text-white placeholder-white/20 resize-none outline-none min-h-[60px]"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-white/15">{replyText.length}/5,000</span>
              <Button
                size="sm"
                onClick={submitReply}
                disabled={!replyText.trim() || sending}
                className="h-8 px-4 rounded-full text-xs font-bold"
              >
                {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reply"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Replies */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 text-white/10 animate-spin" />
        </div>
      ) : replies.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-xs text-white/20">No replies yet</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.03]">
          {replies.map(reply => (
            <div key={reply.id} className="px-4 py-3 hover:bg-white/[0.01]">
              <div className="flex gap-3">
                <Avatar url={reply.avatar_url} name={reply.username} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">{reply.username || "Anonymous"}</span>
                    <span className="text-[10px] text-white/15">
                      {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-white/60 mt-0.5 whitespace-pre-wrap break-words">{reply.content}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <button
                      onClick={() => likeReply(reply)}
                      className={cn("flex items-center gap-1 text-[11px] transition-colors",
                        reply.liked ? "text-pink-400" : "text-white/15 hover:text-pink-400"
                      )}
                    >
                      <Heart className={cn("h-3.5 w-3.5", reply.liked && "fill-current")} />
                      {reply.likes_count > 0 && reply.likes_count}
                    </button>
                    {user && reply.user_id === user.id && (
                      <button onClick={() => deleteReply(reply.id)} className="text-white/10 hover:text-red-400">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Compose Modal — Create Post / Thread / Article
   ═══════════════════════════════════════════════════════════════ */

function ComposeModal({
  user, community, onClose
}: {
  user: any;
  community: Community | null;
  onClose: () => void;
}) {
  const [postType, setPostType] = useState<"post" | "thread" | "article">("post");
  const [content, setContent] = useState("");
  const [threadParts, setThreadParts] = useState<string[]>([""]);
  const [articleTitle, setArticleTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [tags, setTags] = useState("");
  const [selectedCommunityId, setSelectedCommunityId] = useState(community?.id || "");
  const [communities, setCommunities] = useState<Community[]>([]);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("communities").select("id, name, icon").eq("is_active", true);
      setCommunities((data || []) as Community[]);
      if (!selectedCommunityId && data && data.length > 0) {
        setSelectedCommunityId(data[0].id);
      }
    })();
  }, []);

  const handlePost = async () => {
    if (!user) { toast.error("Sign in first"); return; }
    if (!selectedCommunityId) { toast.error("Select a community"); return; }

    const mainContent = postType === "thread" ? threadParts[0] : content;
    if (!mainContent.trim()) { toast.error("Write something!"); return; }

    setPosting(true);
    try {
      const { data: profile } = await supabase.from("profiles")
        .select("username, avatar_url").eq("user_id", user.id).maybeSingle();
      const username = profile?.username || user.email?.split("@")[0] || "anon";
      const avatar = profile?.avatar_url || null;
      const tagArr = tags.split(",").map(t => t.trim()).filter(Boolean);

      if (postType === "thread") {
        // Create parent post
        const { data: parent } = await supabase.from("community_posts").insert({
          community_id: selectedCommunityId,
          user_id: user.id,
          username,
          avatar_url: avatar,
          content: threadParts[0].trim(),
          post_type: "thread",
          tags: tagArr,
        }).select().single();

        // Create thread children
        if (parent) {
          for (let i = 1; i < threadParts.length; i++) {
            if (threadParts[i].trim()) {
              await supabase.from("community_posts").insert({
                community_id: selectedCommunityId,
                user_id: user.id,
                username,
                avatar_url: avatar,
                content: threadParts[i].trim(),
                post_type: "thread",
                thread_id: parent.id,
                thread_order: i,
              });
            }
          }
        }
      } else {
        await supabase.from("community_posts").insert({
          community_id: selectedCommunityId,
          user_id: user.id,
          username,
          avatar_url: avatar,
          content: content.trim(),
          image_url: imageUrl || null,
          post_type: postType,
          is_article: postType === "article",
          article_title: postType === "article" ? articleTitle : null,
          article_cover_url: postType === "article" ? imageUrl : null,
          tags: tagArr,
        });
      }

      toast.success(postType === "article" ? "Article published! 📝" : postType === "thread" ? "Thread posted! 🧵" : "Posted! ✨");
      onClose();
    } catch (e: any) {
      toast.error("Failed to post: " + (e.message || "Unknown error"));
    } finally {
      setPosting(false);
    }
  };

  const addThreadPart = () => {
    if (threadParts.length < 20) {
      setThreadParts([...threadParts, ""]);
    }
  };

  const maxChars = postType === "article" ? 15000 : postType === "thread" ? 2000 : 5000;
  const currentLen = postType === "thread"
    ? threadParts.reduce((s, p) => s + p.length, 0)
    : content.length;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-12 px-4">
      <div className="bg-[#0a0a0f] border border-white/[0.08] rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <XIcon className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <Button
            onClick={handlePost}
            disabled={posting || currentLen === 0}
            className="px-4 h-8 rounded-full text-xs font-bold"
          >
            {posting ? <Loader2 className="h-3 w-3 animate-spin" /> : postType === "article" ? "Publish" : "Post"}
          </Button>
        </div>

        {/* Post type selector */}
        <div className="flex gap-1 px-4 pt-3">
          {(["post", "thread", "article"] as const).map(t => (
            <button
              key={t}
              onClick={() => setPostType(t)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize",
                postType === t ? "bg-primary/10 text-primary" : "text-white/20"
              )}
            >
              {t === "post" ? "📝 Post" : t === "thread" ? "🧵 Thread" : "📰 Article"}
            </button>
          ))}
        </div>

        {/* Community selector */}
        <div className="px-4 pt-3">
          <select
            value={selectedCommunityId}
            onChange={e => setSelectedCommunityId(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white appearance-none"
          >
            <option value="">Select community...</option>
            {communities.map(c => (
              <option key={c.id} value={c.id}>{c.icon || ""} {c.name}</option>
            ))}
          </select>
        </div>

        {/* Compose area */}
        <div className="p-4 space-y-3">
          {postType === "article" && (
            <input
              type="text"
              placeholder="Article title..."
              value={articleTitle}
              onChange={e => setArticleTitle(e.target.value)}
              className="w-full bg-transparent text-xl font-bold text-white placeholder-white/20 outline-none"
            />
          )}

          {postType === "thread" ? (
            <div className="space-y-2">
              {threadParts.map((part, i) => (
                <div key={i} className="flex gap-2">
                  <div className="flex flex-col items-center pt-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {i < threadParts.length - 1 && <div className="w-0.5 flex-1 bg-white/[0.06] mt-1" />}
                  </div>
                  <textarea
                    value={part}
                    onChange={e => {
                      const next = [...threadParts];
                      next[i] = e.target.value;
                      setThreadParts(next);
                    }}
                    placeholder={i === 0 ? "Start your thread..." : `Part ${i + 1}...`}
                    maxLength={2000}
                    className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 resize-none outline-none min-h-[80px] focus:border-primary/30"
                  />
                </div>
              ))}
              <button onClick={addThreadPart} className="ml-5 text-xs text-primary/60 hover:text-primary flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add part ({threadParts.length}/20)
              </button>
            </div>
          ) : (
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={postType === "article"
                ? "Write your article... (up to 15,000 characters)"
                : "What's happening?"}
              maxLength={maxChars}
              className="w-full bg-transparent text-sm text-white placeholder-white/20 resize-none outline-none min-h-[120px]"
            />
          )}

          {/* Image URL + preview */}
          <input
            type="text"
            placeholder="Image URL (paste link to image)..."
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white/50 placeholder-white/15 outline-none"
          />
          {imageUrl && (
            <div className="relative rounded-xl overflow-hidden border border-white/[0.08]">
              <img
                src={imageUrl}
                alt="Preview"
                className="w-full max-h-48 object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <button
                onClick={() => setImageUrl("")}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white/70 hover:text-white"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Tags */}
          <input
            type="text"
            placeholder="Tags (comma-separated)..."
            value={tags}
            onChange={e => setTags(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white/50 placeholder-white/15 outline-none"
          />

          {/* Footer */}
          <div className="flex items-center justify-between text-[10px] text-white/15">
            <span>{currentLen.toLocaleString()} / {maxChars.toLocaleString()}</span>
            {postType === "thread" && <span>{threadParts.length} parts</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Create Community Modal
   ═══════════════════════════════════════════════════════════════ */

function CreateCommunityModal({
  user, onClose, onCreated
}: {
  user: any;
  onClose: () => void;
  onCreated: (c: Community) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🚀");
  const [privacy, setPrivacy] = useState<"public" | "private">("public");
  const [creating, setCreating] = useState(false);

  const ICONS = ["🚀", "💎", "🔥", "📈", "🐸", "🤖", "⚡", "🎯", "🏆", "🌙", "💰", "🎮"];

  const handleCreate = async () => {
    if (!user) { toast.error("Sign in first"); return; }
    if (!name.trim()) { toast.error("Name required"); return; }
    setCreating(true);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: profile } = await supabase.from("profiles")
        .select("username, avatar_url").eq("user_id", user.id).maybeSingle();

      const { data, error } = await supabase.from("communities").insert({
        name: name.trim(),
        description: description.trim() || null,
        icon,
        privacy,
        created_by: user.id,
        creator_name: profile?.username || user.email?.split("@")[0],
        creator_avatar: profile?.avatar_url,
        invite_code: code,
        is_active: true,
        member_count: 1,
      }).select().single();

      if (error) throw error;

      // Add creator as member
      await supabase.from("community_members").insert({
        community_id: data.id,
        user_id: user.id,
        role: "creator",
      });

      toast.success("Community created! 🎉");
      onCreated(data as Community);
    } catch (e: any) {
      toast.error("Failed: " + (e.message || "Unknown error"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="bg-[#0a0a0f] border border-white/[0.08] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <XIcon className="h-5 w-5" />
          </button>
          <h3 className="text-sm font-bold text-white flex-1">Create Community</h3>
          <Button onClick={handleCreate} disabled={creating || !name.trim()} className="h-8 px-4 rounded-full text-xs font-bold">
            {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create"}
          </Button>
        </div>
        <div className="p-4 space-y-4">
          {/* Icon picker */}
          <div>
            <label className="text-[10px] text-white/20 uppercase tracking-wider mb-1 block">Icon</label>
            <div className="flex gap-1.5 flex-wrap">
              {ICONS.map(i => (
                <button key={i} onClick={() => setIcon(i)}
                  className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all",
                    icon === i ? "bg-primary/10 border-2 border-primary scale-110" : "bg-white/[0.04] border border-transparent"
                  )}>
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-white/20 uppercase tracking-wider mb-1 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Community name..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-primary/30"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/20 uppercase tracking-wider mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What's this community about?"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none resize-none h-20 focus:border-primary/30"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/20 uppercase tracking-wider mb-1 block">Privacy</label>
            <div className="flex gap-2">
              {(["public", "private"] as const).map(p => (
                <button key={p} onClick={() => setPrivacy(p)}
                  className={cn("flex-1 py-2 rounded-xl text-xs font-medium capitalize border transition-colors",
                    privacy === p ? "border-primary bg-primary/10 text-primary" : "border-white/[0.06] text-white/25"
                  )}>
                  {p === "public" ? "🌐 " : "🔒 "}{p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Shared Components
   ═══════════════════════════════════════════════════════════════ */

function Avatar({ url, name, size = "md" }: { url?: string | null; name?: string | null; size?: "xs" | "sm" | "md" | "lg" }) {
  const sizeClass = size === "xs" ? "w-5 h-5" : size === "sm" ? "w-8 h-8" : size === "lg" ? "w-12 h-12" : "w-10 h-10";
  const textSize = size === "xs" ? "text-[7px]" : size === "sm" ? "text-[9px]" : size === "lg" ? "text-sm" : "text-[10px]";
  if (url) {
    return <img src={url} className={cn(sizeClass, "rounded-full object-cover shrink-0")} alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />;
  }
  return (
    <div className={cn(sizeClass, "rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center shrink-0", textSize, "font-bold text-white/40")}>
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="py-16 text-center">
      <div className="text-white/[0.06] flex justify-center mb-3">{icon}</div>
      <p className="text-sm text-white/30 font-medium">{title}</p>
      <p className="text-xs text-white/15 mt-1">{subtitle}</p>
    </div>
  );
}

export default Communities;
