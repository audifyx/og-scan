/**
 * Communities — X/Twitter-style social feed for crypto communities.
 * Features: Posts, Threads, Articles, News tab, Comments, Likes, Reposts, Bookmarks.
 * Rendered inline inside Index.tsx — no AppLayout wrapper.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Users, Plus, Search, MessageSquare, Heart, Trash2, ArrowLeft,
  Repeat2, Bookmark, Share, Eye, ChevronRight, MoreHorizontal,
  X as XIcon, Loader2, Newspaper, Home, PenSquare, Pin,
  Edit, Shield, LogOut, Crown, ImagePlus, Upload, Video,
  Settings, TrendingUp, ExternalLink, Copy, Play
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

interface CommunityMember {
  id: string;
  community_id: string;
  user_id: string;
  role: "creator" | "moderator" | "member";
  joined_at: string;
  username?: string | null;
  avatar_url?: string | null;
}

/* ── Upload helper — uploads file to Supabase storage, returns public URL ── */
const UPLOAD_BUCKET = "profile-media";
async function uploadImage(file: File, folder: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(UPLOAD_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(UPLOAD_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/* ── Image upload button component ── */
function ImageUploadBtn({ onUploaded, label = "Upload image", className = "" }: {
  onUploaded: (url: string) => void; label?: string; className?: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    setUploading(true);
    try {
      const url = await uploadImage(file, "community");
      onUploaded(url);
    } catch (err: any) {
      toast.error(err.message?.includes("Bucket not found") ? "Storage not configured" : "Upload failed");
    }
    setUploading(false);
    if (ref.current) ref.current.value = "";
  };
  return (
    <>
      <input ref={ref} type="file" accept="image/*" onChange={handle} className="hidden" />
      <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
        className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-xs text-white/40 hover:text-white/60 hover:border-white/[0.15] transition-colors disabled:opacity-50", className)}>
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
        {uploading ? "Uploading..." : label}
      </button>
    </>
  );
}

/* ── Video upload helper ── */
function MediaUploadBtn({ onUploaded, accept = "image/*,video/*", label = "Upload media", className = "" }: {
  onUploaded: (url: string, type: "image" | "video") => void; accept?: string; label?: string; className?: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) { toast.error(isVideo ? "Max 50MB for videos" : "Max 5MB for images"); return; }
    setUploading(true);
    try {
      const url = await uploadImage(file, isVideo ? "community-videos" : "community");
      onUploaded(url, isVideo ? "video" : "image");
    } catch (err: any) {
      toast.error(err.message?.includes("Bucket not found") ? "Storage not configured" : "Upload failed");
    }
    setUploading(false);
    if (ref.current) ref.current.value = "";
  };
  return (
    <>
      <input ref={ref} type="file" accept={accept} onChange={handle} className="hidden" />
      <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
        className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-xs text-white/40 hover:text-white/60 hover:border-white/[0.15] transition-colors disabled:opacity-50", className)}>
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {uploading ? "Uploading..." : label}
      </button>
    </>
  );
}

/* ── DexScreener token fetch helper ── */
interface DexTokenData {
  address: string;
  symbol: string;
  name: string;
  logoUrl: string | null;
  priceUsd: number | null;
  change24h: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  pairAddress: string | null;
  chartUrl: string | null;
}

async function fetchTokenByCA(address: string): Promise<DexTokenData | null> {
  try {
    const resp = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${encodeURIComponent(address)}`);
    if (!resp.ok) return null;
    const pairs = await resp.json();
    if (!Array.isArray(pairs) || pairs.length === 0) return null;
    // Pick the highest liquidity pair
    const pair = pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    return {
      address,
      symbol: pair.baseToken?.symbol || "???",
      name: pair.baseToken?.name || "Unknown",
      logoUrl: pair.info?.imageUrl || null,
      priceUsd: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
      change24h: pair.priceChange?.h24 ?? null,
      marketCapUsd: pair.marketCap ?? pair.fdv ?? null,
      liquidityUsd: pair.liquidity?.usd ?? null,
      volume24hUsd: pair.volume?.h24 ?? null,
      pairAddress: pair.pairAddress || null,
      chartUrl: pair.url || `https://dexscreener.com/solana/${address}`,
    };
  } catch { return null; }
}

/* ── Format helpers for token stats ── */
function fmtCompact(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  if (n < 0.0001) return `$${n.toExponential(2)}`;
  if (n < 1) return `$${n.toPrecision(4)}`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/* ── Live Chart Card component for posts ── */
function TokenChartCard({ post, className = "" }: { post: Post; className?: string }) {
  if (!post.token_address) return null;
  const chartEmbedUrl = post.token_pair_address
    ? `https://dexscreener.com/solana/${post.token_pair_address}?embed=1&theme=dark&trades=0&info=0`
    : `https://dexscreener.com/solana/${post.token_address}?embed=1&theme=dark&trades=0&info=0`;
  const change = post.token_change_24h;
  const isPositive = change != null && change >= 0;

  return (
    <div className={cn("mt-3 rounded-xl border border-white/[0.08] overflow-hidden bg-white/[0.02]", className)}>
      {/* Token header bar */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-white/[0.06]">
        {post.token_logo_url && (
          <img src={post.token_logo_url} className="w-7 h-7 rounded-full" alt=""
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-black text-white">{post.token_symbol || "???"}</span>
            <span className="text-[10px] text-white/30 truncate">{post.token_name}</span>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-white/60 font-mono">{fmtPrice(post.token_price_usd)}</span>
            {change != null && (
              <span className={cn("font-bold", isPositive ? "text-emerald-400" : "text-red-400")}>
                {isPositive ? "+" : ""}{change.toFixed(2)}%
              </span>
            )}
          </div>
        </div>
        <a href={post.token_pair_address ? `https://dexscreener.com/solana/${post.token_pair_address}` : `https://dexscreener.com/solana/${post.token_address}`}
          target="_blank" rel="noopener noreferrer"
          className="p-1.5 rounded-lg text-white/20 hover:text-og-cyan hover:bg-og-cyan/10 transition-colors"
          onClick={e => e.stopPropagation()}>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      {/* Stats row */}
      <div className="flex items-center gap-4 px-3 py-2 border-b border-white/[0.06] text-[9px] text-white/30 uppercase tracking-wider">
        <span>MCap <span className="text-white/50 font-mono">{fmtCompact(post.token_market_cap_usd)}</span></span>
        <span>Liq <span className="text-white/50 font-mono">{fmtCompact(post.token_liquidity_usd)}</span></span>
        <span>Vol 24h <span className="text-white/50 font-mono">{fmtCompact(post.token_volume_24h_usd)}</span></span>
      </div>
      {/* Embedded chart */}
      <div className="relative w-full" style={{ height: 300 }}>
        <iframe src={chartEmbedUrl} className="w-full h-full border-0" title="Chart"
          sandbox="allow-scripts allow-same-origin" loading="lazy" />
      </div>
    </div>
  );
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
  video_url?: string | null;
  // Token / live chart fields
  token_address?: string | null;
  token_symbol?: string | null;
  token_name?: string | null;
  token_logo_url?: string | null;
  token_price_usd?: number | null;
  token_change_24h?: number | null;
  token_market_cap_usd?: number | null;
  token_liquidity_usd?: number | null;
  token_volume_24h_usd?: number | null;
  token_pair_address?: string | null;
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

/* ─── Standard Forensic Constants ─── */
const ACCENT_GOLD = "hsl(var(--og-gold))";
const ACCENT_LIME = "hsl(var(--og-lime))";
const ACCENT_CYAN = "hsl(var(--og-cyan))";

/* ── Enrich posts with missing username/avatar from profiles table ── */
async function enrichPostProfiles(posts: Post[]): Promise<Post[]> {
  const missing = posts.filter(p => !p.username || p.username === "Anonymous" || p.username === "anon");
  if (missing.length === 0) return posts;
  const userIds = [...new Set(missing.map(p => p.user_id))];
  const { data: profiles } = await supabase.from("profiles")
    .select("user_id, username, avatar_url")
    .in("user_id", userIds);
  if (!profiles || profiles.length === 0) return posts;
  const profileMap = new Map(profiles.map(p => [p.user_id, p]));
  return posts.map(p => {
    if (p.username && p.username !== "Anonymous" && p.username !== "anon") return p;
    const prof = profileMap.get(p.user_id);
    if (!prof) return p;
    return { ...p, username: prof.username || p.username, avatar_url: prof.avatar_url || p.avatar_url };
  });
}

const Communities = () => {
  const { user, profile } = useAuth();
  const [mainView, setMainView] = useState<MainView>("home");
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [myMemberships, setMyMemberships] = useState<Map<string, CommunityMember>>(new Map());
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);

  // Check global admin status
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("admin_roles").select("role").eq("user_id", user.id).limit(1);
      if (data && data.length > 0 && ["owner","superadmin","admin"].includes(data[0].role)) setIsGlobalAdmin(true);
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("community_members").select("*").eq("user_id", user.id);
      if (data) {
        const map = new Map<string, CommunityMember>();
        data.forEach((m: any) => map.set(m.community_id, m as CommunityMember));
        setMyMemberships(map);
      }
    })();
  }, [user]);

  const myRoleIn = (cid: string): CommunityMember["role"] | null => myMemberships.get(cid)?.role || null;

  const joinCommunity = async (cid: string) => {
    if (!user) { toast.error("Sign in first"); return; }
    try {
      await supabase.from("community_members").insert({ community_id: cid, user_id: user.id, role: "member" });
      // increment member_count
      const { data: c } = await supabase.from("communities").select("member_count").eq("id", cid).single();
      await supabase.from("communities").update({ member_count: (c?.member_count || 0) + 1 }).eq("id", cid);
      const newMap = new Map(myMemberships);
      newMap.set(cid, { id: "", community_id: cid, user_id: user.id, role: "member", joined_at: new Date().toISOString() });
      setMyMemberships(newMap);
      toast.success("Joined! 🎉");
    } catch (e: any) {
      if (e.message?.includes("duplicate") || e.code === "23505") toast.error("Already a member");
      else toast.error("Failed to join");
    }
  };

  const leaveCommunity = async (cid: string) => {
    if (!user) return;
    if (myRoleIn(cid) === "creator") { toast.error("Creators can't leave their own community"); return; }
    try {
      await supabase.from("community_members").delete().eq("community_id", cid).eq("user_id", user.id);
      const { data: c } = await supabase.from("communities").select("member_count").eq("id", cid).single();
      await supabase.from("communities").update({ member_count: Math.max(0, (c?.member_count || 1) - 1) }).eq("id", cid);
      const newMap = new Map(myMemberships);
      newMap.delete(cid);
      setMyMemberships(newMap);
      if (selectedCommunity?.id === cid) { setSelectedCommunity(null); setMainView("home"); }
      toast.success("Left community");
    } catch { toast.error("Failed to leave"); }
  };

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
          isGlobalAdmin={isGlobalAdmin}
          canModerate={(() => { const r = myMemberships.get(selectedPost.community_id)?.role; return r === "creator" || r === "moderator" || isGlobalAdmin; })()}
        />
      ) : mainView === "community" && selectedCommunity ? (
        <CommunityFeed
          community={selectedCommunity}
          user={user}
          myRole={myRoleIn(selectedCommunity.id)}
          isMember={myMemberships.has(selectedCommunity.id)}
          onSelectPost={openPost}
          onCompose={() => setShowCompose(true)}
          onJoin={() => joinCommunity(selectedCommunity.id)}
          onLeave={() => leaveCommunity(selectedCommunity.id)}
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
          joinedCommunityIds={Array.from(myMemberships.keys())}
        />
      )}

      {/* ─── FAB ─── */}
      <button
        onClick={() => setShowCompose(true)}
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 w-14 h-14 rounded-full bg-og-cyan shadow-lg shadow-og-cyan/20 flex items-center justify-center text-[#070d14] hover:scale-105 active:scale-95 transition-all"
      >
        <Plus className="h-6 w-6 stroke-[3]" />
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
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-og-cyan shadow-[0_0_8px_hsl(var(--og-cyan)/0.6)]" />
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
  user, onSelectPost, onSelectCommunity, joinedCommunityIds
}: {
  user: any;
  onSelectPost: (p: Post) => void;
  onSelectCommunity: (c: Community) => void;
  joinedCommunityIds: string[];
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<FeedSort>("latest");
  const [communityNames, setCommunityNames] = useState<Map<string, Community>>(new Map());

  // Fetch trending communities for the horizontal scroll
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("communities").select("*")
        .eq("is_active", true).neq("name", "SolTools Feed").order("member_count", { ascending: false }).limit(20);
      const items = (data || []) as Community[];
      setCommunities(items);
      const map = new Map<string, Community>();
      items.forEach(c => map.set(c.id, c));
      setCommunityNames(map);
    })();
  }, []);

  const fetchHomeFeed = useCallback(async () => {
    setLoading(true);
    try {
      // Aggregated feed: only posts from communities the user has joined
      let q = supabase.from("community_posts").select("*").is("thread_id", null).limit(50);

      if (joinedCommunityIds.length > 0) {
        q = q.in("community_id", joinedCommunityIds);
      }

      if (sort === "latest") q = q.order("created_at", { ascending: false });
      else if (sort === "top") q = q.order("likes_count", { ascending: false });
      else q = q.order("views_count", { ascending: false });

      const { data } = await q;
      let items = await enrichPostProfiles((data || []) as Post[]);

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
  }, [user, sort, joinedCommunityIds]);

  useEffect(() => { fetchHomeFeed(); }, [fetchHomeFeed]);

  return (
    <div>
      {/* Trending Communities — horizontal scroll */}
      {communities.length > 0 && (
        <div className="py-3 border-b border-white/[0.04]">
          <div className="flex items-center justify-between px-4 mb-2.5">
            <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Trending Communities</p>
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
            className={cn("px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors border",
              sort === s ? "bg-og-cyan/10 text-og-cyan border-og-cyan/30" : "text-white/25 border-transparent hover:text-white/40"
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
      ) : !user || joinedCommunityIds.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="Your feed is empty"
          subtitle="Join communities to see their posts here"
        />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-10 w-10" />}
          title="No posts yet"
          subtitle="Your communities haven't posted yet — check back soon!"
        />
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {posts.map(post => {
            const comm = communityNames.get(post.community_id);
            return (
              <div key={post.id}>
                {comm && (
                  <button onClick={() => onSelectCommunity(comm)}
                    className="flex items-center gap-1.5 px-4 pt-2.5 pb-0 text-[10px] text-white/25 hover:text-white/40 transition-colors">
                    <span>{comm.icon || "✨"}</span>
                    <span className="font-bold">{comm.name}</span>
                  </button>
                )}
                <PostCard
                  post={post}
                  user={user}
                  onClick={() => onSelectPost(post)}
                  onUpdate={fetchHomeFeed}
                />
              </div>
            );
          })}
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
        .neq("name", "SolTools Feed")
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
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-white/25 focus:border-og-cyan/30 focus:outline-none transition-colors"
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
                  ? "bg-og-cyan text-white"
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
            <div className="w-12 h-12 rounded-xl bg-og-cyan/10 border border-og-cyan/20 flex items-center justify-center">
              <Plus className="h-5 w-5 text-og-cyan" />
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

/* ── Community avatar helper — avatar_url image > emoji icon > initial letter ── */
function CommunityAvatar({ community: c, size = "md", className = "" }: { community: Community; size?: "xs" | "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizeMap = { xs: "w-8 h-8 text-xs", sm: "w-10 h-10 text-sm", md: "w-12 h-12 text-lg", lg: "w-14 h-14 text-xl", xl: "w-16 h-16 text-2xl" };
  const gradients = [
    "from-og-cyan/30 to-og-cyan/10 border-og-cyan/20",
    "from-og-gold/30 to-og-gold/10 border-og-gold/20",
    "from-og-lime/30 to-og-lime/10 border-og-lime/20",
    "from-blue-500/30 to-blue-500/10 border-blue-500/20",
    "from-purple-500/30 to-purple-500/10 border-purple-500/20",
  ];
  const gIdx = c.name.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0) % gradients.length;
  const hasAvatar = c.avatar_url && c.avatar_url !== "null" && c.avatar_url !== "";
  const hasIcon = c.icon && c.icon !== "null" && c.icon !== "default" && c.icon !== "" && c.icon.length <= 4;

  return (
    <div className={cn("rounded-2xl overflow-hidden bg-gradient-to-br border flex items-center justify-center shrink-0", sizeMap[size], gradients[gIdx], className)}>
      {hasAvatar ? (
        <img src={c.avatar_url!} className="w-full h-full object-cover" alt={c.name}
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
      ) : hasIcon ? (
        <span>{c.icon}</span>
      ) : (
        <span className="font-black text-white/60">{c.name.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}

function CommunityCard({ community: c, onClick, variant = "list" }: { community: Community; onClick: () => void; variant?: "list" | "grid" | "compact" }) {
  const gradients = [
    "from-og-cyan/20 to-og-cyan/5 border-og-cyan/20 text-og-cyan",
    "from-og-gold/20 to-og-gold/5 border-og-gold/20 text-og-gold",
    "from-og-lime/20 to-og-lime/5 border-og-lime/20 text-og-lime",
    "from-blue-500/20 to-blue-500/5 border-blue-500/20 text-blue-400",
    "from-purple-500/20 to-purple-500/5 border-purple-500/20 text-purple-400",
  ];
  const gradIdx = c.name.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0) % gradients.length;

  if (variant === "compact") {
    return (
      <button onClick={onClick} className="flex flex-col items-center gap-1.5 shrink-0 w-[72px] group">
        <CommunityAvatar community={c} size="lg" className="group-hover:scale-105 group-active:scale-95 transition-all shadow-lg" />
        <span className="text-[10px] text-white/40 font-black uppercase tracking-tighter truncate w-full text-center">{c.name}</span>
      </button>
    );
  }

  if (variant === "grid") {
    return (
      <button onClick={onClick} className="group rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all hover:border-white/[0.12] w-full text-left">
        {/* Banner */}
        <div className={cn("h-20 w-full bg-gradient-to-br relative border-b", gradients[gradIdx])}>
          {c.banner_url && (
            <img src={c.banner_url} className="w-full h-full object-cover" alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <div className="absolute -bottom-5 left-3">
            <CommunityAvatar community={c} size="sm" className="border-2 border-[#070d14] shadow-lg" />
          </div>
        </div>
        <div className="pt-7 px-3 pb-3">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-black uppercase tracking-wider text-white truncate">{c.name}</p>
            {c.privacy === "private" && <span className="text-[9px] text-white/30">🔒</span>}
          </div>
          {c.description && (
            <p className="text-[11px] text-white/30 line-clamp-2 mt-1 leading-relaxed">{c.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest flex items-center gap-1">
              <Users className="h-3 w-3" /> {c.member_count || 0} MEMBERS
            </span>
          </div>
        </div>
      </button>
    );
  }

  // Default: list variant
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left group">
      <CommunityAvatar community={c} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black uppercase tracking-wider text-white truncate group-hover:text-og-cyan transition-colors">{c.name}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest flex items-center gap-1">
            <Users className="h-3 w-3" /> {c.member_count || 0}
          </span>
          {c.category && (
            <span className="text-[9px] font-black uppercase text-og-cyan/60">{c.category}</span>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-white/10 group-hover:text-white transition-all" />
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
      setArticles(await enrichPostProfiles((data || []) as Post[]));
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
  community, user, myRole, isMember, onSelectPost, onCompose, onJoin, onLeave
}: {
  community: Community;
  user: any;
  myRole: CommunityMember["role"] | null;
  isMember: boolean;
  onSelectPost: (p: Post) => void;
  onCompose: () => void;
  onJoin: () => void;
  onLeave: () => void;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "posts" | "articles" | "threads" | "members" | "settings">("all");
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [editRules, setEditRules] = useState(community.rules || "");
  const [editDesc, setEditDesc] = useState(community.description || "");
  const [savingSettings, setSavingSettings] = useState(false);
  const canModerate = myRole === "creator" || myRole === "moderator" || isGlobalAdmin;
  const isCreator = myRole === "creator";

  // Check if user is a global platform admin
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("admin_roles").select("role").eq("user_id", user.id).limit(1);
      if (data && data.length > 0) {
        const role = data[0].role;
        if (["owner", "superadmin", "admin"].includes(role)) setIsGlobalAdmin(true);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (filter !== "members" && filter !== "settings") return;
    (async () => {
      setMembersLoading(true);
      const { data } = await supabase.from("community_members")
        .select("*").eq("community_id", community.id).order("joined_at", { ascending: true });
      let items = (data || []) as CommunityMember[];
      if (items.length > 0) {
        const uids = items.map(m => m.user_id);
        const { data: profiles } = await supabase.from("profiles")
          .select("user_id, username, avatar_url").in("user_id", uids);
        const pMap = new Map((profiles || []).map(p => [p.user_id, p]));
        items = items.map(m => ({ ...m, username: pMap.get(m.user_id)?.username || null, avatar_url: pMap.get(m.user_id)?.avatar_url || null }));
      }
      setMembers(items);
      setMembersLoading(false);
    })();
  }, [filter, community.id]);

  const toggleMod = async (member: CommunityMember) => {
    if (myRole !== "creator" && !isGlobalAdmin) return;
    const newRole = member.role === "moderator" ? "member" : "moderator";
    await supabase.from("community_members").update({ role: newRole }).eq("id", member.id);
    setMembers(members.map(m => m.id === member.id ? { ...m, role: newRole as any } : m));
    toast.success(newRole === "moderator" ? "Promoted to mod! 🛡️" : "Removed mod role");
  };

  const togglePin = async (postId: string, currentlyPinned: boolean) => {
    if (!canModerate) return;
    await supabase.from("community_posts").update({ is_pinned: !currentlyPinned }).eq("id", postId);
    toast.success(currentlyPinned ? "Unpinned" : "Pinned! 📌");
    fetchPosts();
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    await supabase.from("communities").update({
      description: editDesc.trim() || null,
      rules: editRules.trim() || null,
    }).eq("id", community.id);
    toast.success("Settings saved ✨");
    setSavingSettings(false);
  };

  const kickMember = async (member: CommunityMember) => {
    if (!canModerate || member.role === "creator") return;
    await supabase.from("community_members").delete().eq("id", member.id);
    const { data: c } = await supabase.from("communities").select("member_count").eq("id", community.id).single();
    await supabase.from("communities").update({ member_count: Math.max(0, (c?.member_count || 1) - 1) }).eq("id", community.id);
    setMembers(members.filter(m => m.id !== member.id));
    toast.success("Member removed");
  };

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
    else q = q.is("thread_id", null);

    const { data } = await q;
    let items = await enrichPostProfiles((data || []) as Post[]);

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
          "from-og-cyan/20 via-og-cyan/10 to-transparent",
          "from-og-gold/20 via-og-gold/10 to-transparent",
          "from-og-lime/20 via-og-lime/10 to-transparent",
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
                <CommunityAvatar community={community} size="lg" className="border-[3px] border-[#070d14] shadow-xl" />
              </div>
            </div>
            {/* Info */}
            <div className="pt-9 px-4 pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-black uppercase tracking-widest text-white">{community.name}</h2>
                  {community.description && (
                    <p className="text-[11px] text-white/30 mt-1 leading-relaxed">{community.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {isMember ? (
                    <>
                      <button onClick={onCompose}
                        className="px-4 py-1.5 rounded-xl bg-og-cyan text-[#070d14] text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                        Post
                      </button>
                      {myRole !== "creator" && (
                        <button onClick={onLeave} title="Leave community"
                          className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                          <LogOut className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  ) : (
                    <button onClick={onJoin}
                      className="px-4 py-1.5 rounded-xl bg-og-cyan text-[#070d14] text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all">
                      Join
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest flex items-center gap-1.5">
                  <Users className="h-3 w-3" /> <span className="text-white/40">{community.member_count || 0} MEMBERS</span>
                </span>
                {community.category && (
                  <span className="text-[9px] font-black text-og-cyan/40 bg-og-cyan/5 px-2 py-0.5 rounded-full border border-og-cyan/10 uppercase">{community.category}</span>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Filter tabs */}
      <div className="flex border-b border-white/[0.04]">
        {(["all", "posts", "threads", "articles", "members", ...(canModerate || isCreator ? ["settings" as const] : [])] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={cn("flex-1 py-2.5 text-xs font-medium transition-colors relative capitalize",
              filter === f ? "text-white" : "text-white/25"
            )}
          >
            {f === "members" ? <Users className="h-3.5 w-3.5 mx-auto" /> : f === "settings" ? <Settings className="h-3.5 w-3.5 mx-auto" /> : f}
            {filter === f && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-[2px] rounded-full bg-og-cyan" />
            )}
          </button>
        ))}
      </div>

      {filter === "settings" && (isCreator || canModerate) ? (
        <div className="p-4 space-y-6">
          {/* Description */}
          <div>
            <label className="text-[10px] text-white/20 uppercase tracking-wider mb-1.5 block">Description</label>
            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none resize-none h-20 focus:border-og-cyan/30"
              placeholder="What's this community about?" />
          </div>
          {/* Rules */}
          <div>
            <label className="text-[10px] text-white/20 uppercase tracking-wider mb-1.5 block">Community Rules</label>
            <textarea value={editRules} onChange={e => setEditRules(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none resize-none h-32 focus:border-og-cyan/30"
              placeholder="Add community rules..." />
          </div>
          <button onClick={saveSettings} disabled={savingSettings}
            className="px-4 py-2 rounded-xl bg-og-cyan text-[#070d14] text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50">
            {savingSettings ? "Saving..." : "Save Settings"}
          </button>

          {/* Moderator Management */}
          <div>
            <label className="text-[10px] text-white/20 uppercase tracking-wider mb-3 block">Moderators</label>
            {membersLoading ? (
              <Loader2 className="h-5 w-5 text-white/10 animate-spin" />
            ) : (
              <div className="space-y-2">
                {members.filter(m => m.role === "moderator" || m.role === "creator").map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <Avatar url={m.avatar_url} name={m.username} size="sm" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-white">{m.username || "User"}</span>
                      <span className={cn("ml-2 text-[8px] font-black px-1.5 py-0.5 rounded-full border",
                        m.role === "creator" ? "text-og-gold bg-og-gold/10 border-og-gold/20" : "text-og-cyan bg-og-cyan/10 border-og-cyan/20"
                      )}>{m.role === "creator" ? "OWNER" : "MOD"}</span>
                    </div>
                    {(isCreator || isGlobalAdmin) && m.role === "moderator" && (
                      <button onClick={() => toggleMod(m)}
                        className="text-[10px] text-red-400/60 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-400/10 transition-colors">
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {/* Regular members list for quick mod assignment */}
                <div className="mt-4">
                  <label className="text-[10px] text-white/20 uppercase tracking-wider mb-2 block">All Members</label>
                  {members.filter(m => m.role === "member").slice(0, 20).map(m => (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.02] rounded-lg">
                      <Avatar url={m.avatar_url} name={m.username} size="sm" />
                      <span className="text-sm text-white/60 flex-1">{m.username || "User"}</span>
                      {(isCreator || isGlobalAdmin) && (
                        <button onClick={() => toggleMod(m)}
                          className="p-1.5 rounded-lg text-white/15 hover:text-og-cyan hover:bg-og-cyan/10 transition-colors" title="Make moderator">
                          <Shield className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : filter === "members" ? (
        membersLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 text-white/10 animate-spin" /></div>
        ) : members.length === 0 ? (
          <EmptyState icon={<Users className="h-8 w-8" />} title="No members yet" subtitle="Be the first to join!" />
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02]">
                <Avatar url={m.avatar_url} name={m.username} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white truncate">{m.username || "User"}</span>
                    {m.role === "creator" && (
                      <span className="flex items-center gap-0.5 text-[8px] font-black text-og-gold bg-og-gold/10 px-1.5 py-0.5 rounded-full border border-og-gold/20">
                        <Crown className="h-2.5 w-2.5" /> OWNER
                      </span>
                    )}
                    {m.role === "moderator" && (
                      <span className="flex items-center gap-0.5 text-[8px] font-black text-og-cyan bg-og-cyan/10 px-1.5 py-0.5 rounded-full border border-og-cyan/20">
                        <Shield className="h-2.5 w-2.5" /> MOD
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-white/20">Joined {formatDistanceToNow(new Date(m.joined_at), { addSuffix: true })}</p>
                </div>
                {(myRole === "creator" || isGlobalAdmin) && m.role !== "creator" && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleMod(m)} title={m.role === "moderator" ? "Remove mod" : "Make mod"}
                      className={cn("p-1.5 rounded-lg transition-colors", m.role === "moderator" ? "text-og-cyan hover:bg-og-cyan/10" : "text-white/15 hover:text-og-cyan hover:bg-og-cyan/10")}>
                      <Shield className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => kickMember(m)} className="p-1.5 rounded-lg text-white/15 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {myRole === "moderator" && m.role === "member" && (
                  <button onClick={() => kickMember(m)} className="p-1.5 rounded-lg text-white/15 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      ) : loading ? (
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
              canModerate={canModerate}
              communityOwnerId={community.created_by}
              isGlobalAdmin={isGlobalAdmin}
              onPin={togglePin}
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
  post, user, onClick, onUpdate, compact = false, canModerate = false, communityOwnerId, isGlobalAdmin = false, onPin
}: {
  post: Post;
  user: any;
  onClick?: () => void;
  onUpdate?: () => void;
  compact?: boolean;
  canModerate?: boolean;
  communityOwnerId?: string;
  isGlobalAdmin?: boolean;
  onPin?: (postId: string, pinned: boolean) => void;
}) {
  const isArticle = post.is_article || post.post_type === "article";
  const isThread = post.post_type === "thread" && !post.thread_id;
  const isOwner = user && post.user_id === user.id;
  const canDelete = canModerate || isGlobalAdmin || (communityOwnerId && user && user.id === communityOwnerId);
  const canPin = canModerate || isGlobalAdmin || (communityOwnerId && user && user.id === communityOwnerId);
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [saving, setSaving] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this post?")) return;
    try {
      if (isThread) {
        await supabase.from("community_posts").delete().eq("thread_id", post.id);
      }
      // Delete related data first, then the post
      await Promise.allSettled([
        supabase.from("community_post_likes").delete().eq("post_id", post.id),
        supabase.from("community_reposts").delete().eq("post_id", post.id),
        supabase.from("community_bookmarks").delete().eq("post_id", post.id),
        supabase.from("community_post_replies").delete().eq("post_id", post.id),
      ]);
      const { error } = await supabase.from("community_posts").delete().eq("id", post.id);
      if (error) {
        console.error("Delete error:", error);
        toast.error("Failed to delete post: " + error.message);
      } else {
        toast.success("Post deleted");
        // Hide immediately from UI
        const el = (e.target as HTMLElement).closest("[data-post-id]");
        if (el) (el as HTMLElement).style.display = "none";
        onUpdate?.();
      }
    } catch (err: any) { toast.error("Failed to delete: " + (err.message || "")); }
    setShowMenu(false);
  };

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      await supabase.from("community_posts").update({ content: editContent.trim() }).eq("id", post.id);
      toast.success("Post updated");
      setEditing(false);
      onUpdate?.();
    } catch { toast.error("Failed to update"); }
    setSaving(false);
  };

  return (
    <article data-post-id={post.id} className={cn("px-4 py-3 hover:bg-white/[0.015] transition-colors relative", post.is_pinned && "bg-og-cyan/[0.03]")}>
      {post.is_pinned && (
        <div className="flex items-center gap-1 ml-12 mb-1 text-[10px] text-white/20"><Pin className="h-3 w-3" /> Pinned</div>
      )}
      <div className="flex gap-3">
        <Avatar url={post.avatar_url} name={post.username} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-white truncate">{post.username || "Anonymous"}</span>
            <span className="text-xs text-white/15">·</span>
            <span className="text-xs text-white/15 shrink-0">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
            {isThread && <Badge className="text-[7px] bg-blue-500/10 text-blue-400 border-blue-500/20 ml-1">Thread</Badge>}
            {isArticle && <Badge className="text-[7px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 ml-1">Article</Badge>}
            {(canDelete || canPin) && (
              <div className="ml-auto relative">
                <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                  className="p-1 rounded-full text-white/15 hover:text-white/40 hover:bg-white/[0.04] transition-colors">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-7 z-50 bg-[#111] border border-white/[0.1] rounded-xl shadow-2xl py-1 min-w-[140px]"
                    onClick={e => e.stopPropagation()}>
                    {isOwner && (
                      <button onClick={(e) => { e.stopPropagation(); setEditing(true); setEditContent(post.content); setShowMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/60 hover:bg-white/[0.04] hover:text-white transition-colors">
                        <Edit className="h-3.5 w-3.5" /> Edit
                      </button>
                    )}
                    {canPin && onPin && (
                      <button onClick={(e) => { e.stopPropagation(); onPin(post.id, !!post.is_pinned); setShowMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/60 hover:bg-white/[0.04] hover:text-white transition-colors">
                        <Pin className="h-3.5 w-3.5" /> {post.is_pinned ? "Unpin" : "Pin"}
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={handleDelete}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400/70 hover:bg-red-400/10 hover:text-red-400 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          {isArticle && post.article_title && <p className="text-base font-bold text-white mt-1 leading-tight">{post.article_title}</p>}
          {editing ? (
            <div className="mt-2" onClick={e => e.stopPropagation()}>
              <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                className="w-full bg-white/[0.04] border border-og-cyan/30 rounded-xl px-3 py-2 text-sm text-white resize-none outline-none min-h-[80px]" />
              <div className="flex items-center gap-2 mt-1.5">
                <button onClick={handleSaveEdit} disabled={saving}
                  className="px-3 py-1 rounded-lg bg-og-cyan text-[#070d14] text-[10px] font-black uppercase disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => setEditing(false)} className="px-3 py-1 rounded-lg text-white/30 text-[10px] font-black uppercase hover:text-white/60">Cancel</button>
              </div>
            </div>
          ) : (
            <div className={cn("mt-1 text-sm text-white/70 leading-relaxed whitespace-pre-wrap break-words", compact ? "line-clamp-3" : "line-clamp-6")}>
              {post.content}
            </div>
          )}
          {isArticle && post.article_cover_url && (
            <div className="mt-2 rounded-xl overflow-hidden border border-white/[0.06]">
              <img src={post.article_cover_url} className="w-full aspect-[2/1] object-cover" alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}
          {!isArticle && post.image_url && (
            <div className="mt-2 rounded-xl overflow-hidden border border-white/[0.06]">
              <img src={post.image_url} className="w-full max-h-96 object-cover" alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}
          {/* Video support */}
          {post.video_url && (
            <div className="mt-2 rounded-xl overflow-hidden border border-white/[0.06] bg-black" onClick={e => e.stopPropagation()}>
              <video src={post.video_url} controls preload="metadata" playsInline
                className="w-full max-h-96 object-contain" />
            </div>
          )}
          {/* Live Chart Card for token/call posts */}
          {post.token_address && (
            <div onClick={e => e.stopPropagation()}>
              <TokenChartCard post={post} />
            </div>
          )}
          {post.tags && post.tags.length > 0 && (
            <div className="flex gap-1 mt-2">{post.tags.slice(0, 3).map((t, i) => <span key={i} className="text-[9px] text-og-cyan/60">#{t}</span>)}</div>
          )}
          {isThread && (
            <button onClick={onClick} className="text-xs text-og-cyan mt-2 flex items-center gap-1 hover:underline">
              Show thread <ChevronRight className="h-3 w-3" />
            </button>
          )}
          <PostActions post={post} user={user} onUpdate={onUpdate} onComment={onClick} />
        </div>
      </div>
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Post Actions — Like, Reply, Repost, Bookmark, Share
   ═══════════════════════════════════════════════════════════════ */

function PostActions({
  post, user, onUpdate, onComment
}: {
  post: Post;
  user: any;
  onUpdate?: () => void;
  onComment?: () => void;
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
      {/* Reply / Comment — navigates to post detail */}
      <ActionBtn icon={<MessageSquare className="h-4 w-4" />} count={post.replies_count || 0} onClick={onComment ? (e) => { e.stopPropagation(); onComment(); } : undefined} />
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
        className={cn("p-2 rounded-full hover:bg-og-cyan/10 transition-colors",
          bookmarked ? "text-og-cyan" : "text-white/20"
        )}
      >
        <Bookmark className={cn("h-4 w-4", bookmarked && "fill-current")} />
      </button>
      {/* Share */}
      <button onClick={handleShare} className="p-2 rounded-full text-white/20 hover:bg-og-cyan/10 hover:text-og-cyan transition-colors">
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

function PostDetail({ post, user, onBack, isGlobalAdmin = false, canModerate = false }: { post: Post; user: any; onBack: () => void; isGlobalAdmin?: boolean; canModerate?: boolean }) {
  const [replies, setReplies] = useState<PostReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [threadPosts, setThreadPosts] = useState<Post[]>([]);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const [editingMain, setEditingMain] = useState(false);
  const [editMainContent, setEditMainContent] = useState(post.content);

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
      setThreadPosts(await enrichPostProfiles((children || []) as Post[]));
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
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">{post.username || "Anonymous"}</p>
            <p className="text-xs text-white/20">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</p>
          </div>
          {user && (canModerate || post.user_id === user.id) && (
            <div className="flex items-center gap-1">
              {post.user_id === user.id && (
                <button onClick={() => { setEditingMain(true); setEditMainContent(post.content); }}
                  className="p-1.5 rounded-lg text-white/15 hover:text-white/40 hover:bg-white/[0.04]"><Edit className="h-4 w-4" /></button>
              )}
              {canModerate && (
                <button onClick={async () => {
                  if (!confirm("Delete this post?")) return;
                  if (isThread) await supabase.from("community_posts").delete().eq("thread_id", post.id);
                  await supabase.from("community_posts").delete().eq("id", post.id);
                  toast.success("Post deleted"); onBack();
                }} className="p-1.5 rounded-lg text-white/15 hover:text-red-400 hover:bg-red-400/10"><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
          )}
        </div>

        {post.is_article && post.article_title && (
          <h2 className="text-xl font-bold text-white mb-2">{post.article_title}</h2>
        )}

        {editingMain ? (
          <div>
            <textarea value={editMainContent} onChange={e => setEditMainContent(e.target.value)}
              className="w-full bg-white/[0.04] border border-og-cyan/30 rounded-xl px-3 py-2 text-[15px] text-white resize-none outline-none min-h-[100px]" />
            <div className="flex items-center gap-2 mt-2">
              <button onClick={async () => {
                await supabase.from("community_posts").update({ content: editMainContent.trim() }).eq("id", post.id);
                post.content = editMainContent.trim(); setEditingMain(false); toast.success("Updated!");
              }} className="px-3 py-1 rounded-lg bg-og-cyan text-[#070d14] text-[10px] font-black uppercase">Save</button>
              <button onClick={() => setEditingMain(false)} className="px-3 py-1 rounded-lg text-white/30 text-[10px] font-black uppercase">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="text-[15px] text-white/80 leading-relaxed whitespace-pre-wrap break-words">{post.content}</div>
        )}

        {post.image_url && (
          <div className="mt-3 rounded-xl overflow-hidden border border-white/[0.06]">
            <img src={post.image_url} className="w-full max-h-[500px] object-cover" alt=""
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
        )}

        {post.video_url && (
          <div className="mt-3 rounded-xl overflow-hidden border border-white/[0.06] bg-black">
            <video src={post.video_url} controls preload="metadata" playsInline className="w-full max-h-[500px] object-contain" />
          </div>
        )}

        {post.token_address && <TokenChartCard post={post} />}

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

      {/* Thread posts — X-style connected */}
      {threadPosts.length > 0 && (
        <div className="border-b border-white/[0.06]">
          {threadPosts.map((tp, i) => (
            <div key={tp.id} className="relative px-4">
              {/* Vertical connecting line from previous post's avatar to this avatar */}
              {i === 0 && (
                <div className="absolute left-[34px] -top-3 bottom-[calc(50%-16px)] w-0.5 bg-white/[0.08]" />
              )}
              <div className="flex gap-3 py-3">
                <div className="flex flex-col items-center relative z-10">
                  <Avatar url={tp.avatar_url} name={tp.username} size="sm" />
                  {/* Line going down to next post */}
                  {i < threadPosts.length - 1 && (
                    <div className="w-0.5 flex-1 bg-white/[0.08] mt-1 min-h-[12px]" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-bold text-white">{tp.username}</span>
                    <span className="text-[10px] text-white/20">·</span>
                    <span className="text-[10px] text-white/20">
                      {formatDistanceToNow(new Date(tp.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-[14px] text-white/70 mt-0.5 whitespace-pre-wrap leading-relaxed">{tp.content}</p>
                  {tp.image_url && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-white/[0.06]">
                      <img src={tp.image_url} className="w-full max-h-80 object-cover" alt="" />
                    </div>
                  )}
                  {tp.video_url && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-white/[0.06] bg-black">
                      <video src={tp.video_url} controls preload="metadata" playsInline className="w-full max-h-80 object-contain" />
                    </div>
                  )}
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
                    {user && (canModerate || reply.user_id === user.id) && (
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
  const [postType, setPostType] = useState<"post" | "thread" | "article" | "call">("post");
  const [content, setContent] = useState("");
  const [threadParts, setThreadParts] = useState<string[]>([""]);
  const [articleTitle, setArticleTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [tags, setTags] = useState("");
  const [selectedCommunityId, setSelectedCommunityId] = useState(community?.id || "");
  const [communities, setCommunities] = useState<Community[]>([]);
  const [posting, setPosting] = useState(false);
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenData, setTokenData] = useState<DexTokenData | null>(null);
  const [fetchingToken, setFetchingToken] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("communities").select("id, name, icon").eq("is_active", true).neq("name", "SolTools Feed");
      setCommunities((data || []) as Community[]);
      if (!selectedCommunityId && data && data.length > 0) setSelectedCommunityId(data[0].id);
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

      // Token data for "call" posts
      const tokenFields = postType === "call" && tokenData ? {
        token_address: tokenData.address,
        token_symbol: tokenData.symbol,
        token_name: tokenData.name,
        token_logo_url: tokenData.logoUrl,
        token_price_usd: tokenData.priceUsd,
        token_change_24h: tokenData.change24h,
        token_market_cap_usd: tokenData.marketCapUsd,
        token_liquidity_usd: tokenData.liquidityUsd,
        token_volume_24h_usd: tokenData.volume24hUsd,
        token_pair_address: tokenData.pairAddress,
      } : {};

      if (postType === "thread") {
        const { data: parent } = await supabase.from("community_posts").insert({
          community_id: selectedCommunityId, user_id: user.id, username, avatar_url: avatar,
          content: threadParts[0].trim(), post_type: "thread", tags: tagArr,
          image_url: imageUrl || null, video_url: videoUrl || null,
        }).select().single();
        if (parent) {
          for (let i = 1; i < threadParts.length; i++) {
            if (threadParts[i].trim()) {
              await supabase.from("community_posts").insert({
                community_id: selectedCommunityId, user_id: user.id, username, avatar_url: avatar,
                content: threadParts[i].trim(), post_type: "thread", thread_id: parent.id, thread_order: i,
              });
            }
          }
        }
      } else {
        await supabase.from("community_posts").insert({
          community_id: selectedCommunityId, user_id: user.id, username, avatar_url: avatar,
          content: content.trim(), image_url: imageUrl || null, video_url: videoUrl || null,
          post_type: postType === "call" ? "call" : postType,
          is_article: postType === "article",
          article_title: postType === "article" ? articleTitle : null,
          article_cover_url: postType === "article" ? (bannerUrl || imageUrl || null) : null,
          tags: tagArr,
          ...tokenFields,
        });
      }
      toast.success(postType === "article" ? "Article published! 📝" : postType === "thread" ? "Thread posted! 🧵" : "Posted! ✨");
      onClose();
    } catch (e: any) {
      toast.error("Failed: " + (e.message || "Unknown error"));
    } finally { setPosting(false); }
  };

  const addThreadPart = () => { if (threadParts.length < 20) setThreadParts([...threadParts, ""]); };
  const maxChars = postType === "article" ? 15000 : postType === "thread" ? 2000 : 5000;
  const currentLen = postType === "thread" ? threadParts.reduce((s, p) => s + p.length, 0) : content.length;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-12 px-4">
      <div className="bg-[#0a0a0f] border border-white/[0.08] rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
          <button onClick={onClose} className="text-white/40 hover:text-white"><XIcon className="h-5 w-5" /></button>
          <div className="flex-1" />
          <Button onClick={handlePost} disabled={posting || currentLen === 0} className="px-4 h-8 rounded-full text-xs font-bold">
            {posting ? <Loader2 className="h-3 w-3 animate-spin" /> : postType === "article" ? "Publish" : "Post"}
          </Button>
        </div>

        {/* Post type selector */}
        <div className="flex gap-1 px-4 pt-3">
          {(["post", "thread", "article", "call"] as const).map(t => (
            <button key={t} onClick={() => setPostType(t)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize",
                postType === t ? "bg-og-cyan/10 text-og-cyan" : "text-white/20"
              )}>
              {t === "post" ? "📝 Post" : t === "thread" ? "🧵 Thread" : t === "article" ? "📰 Article" : "📈 Call"}
            </button>
          ))}
        </div>

        {/* Community selector */}
        <div className="px-4 pt-3">
          <select value={selectedCommunityId} onChange={e => setSelectedCommunityId(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white appearance-none">
            <option value="">Select community...</option>
            {communities.map(c => <option key={c.id} value={c.id}>{c.icon || ""} {c.name}</option>)}
          </select>
        </div>

        {/* Compose area */}
        <div className="p-4 space-y-3">
          {/* Article: Banner upload + title */}
          {postType === "article" && (
            <>
              {/* Banner */}
              <div>
                <label className="text-[10px] text-white/20 uppercase tracking-wider mb-1.5 block">Article Banner</label>
                {bannerUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-white/[0.08] mb-2">
                    <img src={bannerUrl} alt="" className="w-full aspect-[2.5/1] object-cover" />
                    <button onClick={() => setBannerUrl("")}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white/70 hover:text-white">
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <ImageUploadBtn onUploaded={setBannerUrl} label="Upload banner" className="w-full justify-center py-6 border-dashed" />
                )}
              </div>
              {/* Title */}
              <input type="text" placeholder="Article title..." value={articleTitle} onChange={e => setArticleTitle(e.target.value)}
                className="w-full bg-transparent text-xl font-bold text-white placeholder-white/20 outline-none" />
            </>
          )}

          {/* Thread compose */}
          {postType === "thread" ? (
            <div className="space-y-2">
              {threadParts.map((part, i) => (
                <div key={i} className="flex gap-2">
                  <div className="flex flex-col items-center pt-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-og-cyan" />
                    {i < threadParts.length - 1 && <div className="w-0.5 flex-1 bg-white/[0.06] mt-1" />}
                  </div>
                  <textarea value={part} onChange={e => { const next = [...threadParts]; next[i] = e.target.value; setThreadParts(next); }}
                    placeholder={i === 0 ? "Start your thread..." : `Part ${i + 1}...`} maxLength={2000}
                    className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 resize-none outline-none min-h-[80px] focus:border-og-cyan/30" />
                </div>
              ))}
              <button onClick={addThreadPart} className="ml-5 text-xs text-og-cyan/60 hover:text-og-cyan flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add part ({threadParts.length}/20)
              </button>
            </div>
          ) : (
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder={postType === "article" ? "Write your article... (up to 15,000 characters)" : "What's happening?"}
              maxLength={maxChars}
              className="w-full bg-transparent text-sm text-white placeholder-white/20 resize-none outline-none min-h-[120px]" />
          )}

          {/* Token address input for Call posts */}
          {postType === "call" && (
            <div>
              <label className="text-[10px] text-white/20 uppercase tracking-wider mb-1.5 block">Contract Address (CA)</label>
              <div className="flex gap-2">
                <input type="text" value={tokenAddress} onChange={e => setTokenAddress(e.target.value)}
                  placeholder="Paste Solana token address..."
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-og-cyan/30 font-mono" />
                <button onClick={async () => {
                  if (!tokenAddress.trim()) return;
                  setFetchingToken(true);
                  const data = await fetchTokenByCA(tokenAddress.trim());
                  setTokenData(data);
                  if (!data) toast.error("Token not found on DexScreener");
                  setFetchingToken(false);
                }} disabled={fetchingToken || !tokenAddress.trim()}
                  className="px-3 py-2 rounded-xl bg-og-cyan/10 text-og-cyan text-xs font-bold hover:bg-og-cyan/20 transition-colors disabled:opacity-50">
                  {fetchingToken ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Fetch"}
                </button>
              </div>
              {tokenData && (
                <div className="mt-2 rounded-xl border border-og-cyan/20 bg-og-cyan/[0.03] p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    {tokenData.logoUrl && <img src={tokenData.logoUrl} className="w-6 h-6 rounded-full" alt="" />}
                    <span className="text-sm font-black text-white">{tokenData.symbol}</span>
                    <span className="text-[10px] text-white/30">{tokenData.name}</span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-white/40">
                    <span>Price: <span className="text-white/60 font-mono">{fmtPrice(tokenData.priceUsd)}</span></span>
                    <span>MCap: <span className="text-white/60 font-mono">{fmtCompact(tokenData.marketCapUsd)}</span></span>
                    <span>Vol: <span className="text-white/60 font-mono">{fmtCompact(tokenData.volume24hUsd)}</span></span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Media upload — image or video */}
          {postType !== "article" && (
            <div className="flex gap-2">
              {imageUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-white/[0.08] flex-1">
                  <img src={imageUrl} alt="Preview" className="w-full max-h-48 object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <button onClick={() => setImageUrl("")}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white/70 hover:text-white">
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : videoUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-white/[0.08] flex-1 bg-black">
                  <video src={videoUrl} controls preload="metadata" className="w-full max-h-48 object-contain" />
                  <button onClick={() => setVideoUrl("")}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white/70 hover:text-white">
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <ImageUploadBtn onUploaded={setImageUrl} label="Image" />
                  <MediaUploadBtn accept="video/*" label="Video" onUploaded={(url, type) => { if (type === "video") setVideoUrl(url); else setImageUrl(url); }} />
                </div>
              )}
            </div>
          )}

          {/* Article image upload */}
          {postType === "article" && (
            <div>
              <label className="text-[10px] text-white/20 uppercase tracking-wider mb-1.5 block">Article Icon / Image</label>
              {imageUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-white/[0.08]">
                  <img src={imageUrl} alt="Preview" className="w-full max-h-48 object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <button onClick={() => setImageUrl("")}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white/70 hover:text-white">
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <ImageUploadBtn onUploaded={setImageUrl} label="Upload image" />
              )}
            </div>
          )}

          {/* Tags */}
          <input type="text" placeholder="Tags (comma-separated)..." value={tags} onChange={e => setTags(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white/50 placeholder-white/15 outline-none" />

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
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

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
        name: name.trim(), description: description.trim() || null, icon, privacy,
        created_by: user.id, creator_name: profile?.username || user.email?.split("@")[0],
        creator_avatar: profile?.avatar_url, invite_code: code, is_active: true, member_count: 1,
        avatar_url: avatarUrl || null, banner_url: bannerUrl || null,
      }).select().single();
      if (error) throw error;
      await supabase.from("community_members").insert({ community_id: data.id, user_id: user.id, role: "creator" });
      toast.success("Community created! 🎉");
      onCreated(data as Community);
    } catch (e: any) { toast.error("Failed: " + (e.message || "Unknown error")); }
    finally { setCreating(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="bg-[#0a0a0f] border border-white/[0.08] rounded-2xl w-full max-w-md shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
          <button onClick={onClose} className="text-white/40 hover:text-white"><XIcon className="h-5 w-5" /></button>
          <h3 className="text-sm font-bold text-white flex-1">Create Community</h3>
          <Button onClick={handleCreate} disabled={creating || !name.trim()} className="h-8 px-4 rounded-full text-xs font-bold">
            {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create"}
          </Button>
        </div>
        <div className="p-4 space-y-4">
          {/* Banner upload */}
          <div>
            <label className="text-[10px] text-white/20 uppercase tracking-wider mb-1.5 block">Banner</label>
            {bannerUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-white/[0.08]">
                <img src={bannerUrl} className="w-full aspect-[3/1] object-cover" alt="" />
                <button onClick={() => setBannerUrl("")}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white/70 hover:text-white">
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <ImageUploadBtn onUploaded={setBannerUrl} label="Upload banner" className="w-full justify-center py-4 border-dashed" />
            )}
          </div>

          {/* Avatar upload */}
          <div>
            <label className="text-[10px] text-white/20 uppercase tracking-wider mb-1.5 block">Community Image</label>
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-white/[0.1]">
                  <img src={avatarUrl} className="w-full h-full object-cover" alt="" />
                  <button onClick={() => setAvatarUrl("")}
                    className="absolute top-0 right-0 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center text-white/60">
                    <XIcon className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <ImageUploadBtn onUploaded={setAvatarUrl} label="Upload" />
              )}
            </div>
          </div>

          {/* Icon picker */}
          <div>
            <label className="text-[10px] text-white/20 uppercase tracking-wider mb-1 block">Emoji Icon</label>
            <div className="flex gap-1.5 flex-wrap">
              {ICONS.map(i => (
                <button key={i} onClick={() => setIcon(i)}
                  className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all",
                    icon === i ? "bg-og-cyan/10 border-2 border-og-cyan scale-110" : "bg-white/[0.04] border border-transparent"
                  )}>{i}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-white/20 uppercase tracking-wider mb-1 block">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Community name..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-og-cyan/30" />
          </div>
          <div>
            <label className="text-[10px] text-white/20 uppercase tracking-wider mb-1 block">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this community about?"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none resize-none h-20 focus:border-og-cyan/30" />
          </div>
          <div>
            <label className="text-[10px] text-white/20 uppercase tracking-wider mb-1 block">Privacy</label>
            <div className="flex gap-2">
              {(["public", "private"] as const).map(p => (
                <button key={p} onClick={() => setPrivacy(p)}
                  className={cn("flex-1 py-2 rounded-xl text-xs font-medium capitalize border transition-colors",
                    privacy === p ? "border-og-cyan bg-og-cyan/10 text-og-cyan" : "border-white/[0.06] text-white/25"
                  )}>{p === "public" ? "🌐 " : "🔒 "}{p}</button>
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
    <div className={cn(sizeClass, "rounded-full bg-gradient-to-br from-og-cyan/20 to-purple-500/10 flex items-center justify-center shrink-0 border border-white/10", textSize, "font-black text-white/40 uppercase")}>
      {(name || "?").charAt(0)}
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
