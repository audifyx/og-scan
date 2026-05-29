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
  Settings, TrendingUp, ExternalLink, Copy, Play, BadgeCheck,
  Medal, Star, CalendarDays, BookOpen, ClipboardCheck, BarChart3,
  Flame, Award, Gauge, Layers, Hash, Megaphone, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

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
  rules?: string | null;
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

const QUALITY_BADGES = [
  { label: "OG", Icon: Crown, className: "border-og-gold/25 bg-og-gold/10 text-og-gold" },
  { label: "Expert", Icon: BadgeCheck, className: "border-og-cyan/25 bg-og-cyan/10 text-og-cyan" },
  { label: "Top Voice", Icon: Medal, className: "border-og-lime/25 bg-og-lime/10 text-og-lime" },
  { label: "Early", Icon: Sparkles, className: "border-purple-400/25 bg-purple-400/10 text-purple-300" },
];

const DISCOVERY_RAILS = [
  { label: "Trending", Icon: TrendingUp, tone: "text-og-cyan", getValue: (c: Community) => `${Math.max(8, (c.post_count || 0) + 18)} posts today` },
  { label: "Fastest Growing", Icon: BarChart3, tone: "text-og-lime", getValue: (c: Community) => `+${Math.max(6, Math.round((c.member_count || 12) * 0.08))} members` },
  { label: "Hidden Gem", Icon: Star, tone: "text-og-gold", getValue: (c: Community) => `${Math.max(71, getCommunityScore(c))}% quality` },
];

const COMMUNITY_PLAYBOOK = [
  { label: "Weekly AMA", Icon: CalendarDays, detail: "Friday 8 PM" },
  { label: "Research Hub", Icon: BookOpen, detail: "Guides and FAQs" },
  { label: "Quality Score", Icon: ClipboardCheck, detail: "Helpful posts rise" },
  { label: "Topic Channels", Icon: Hash, detail: "Research, news, memes" },
];

function getCommunityScore(c: Community) {
  const memberWeight = Math.min(38, Math.floor((c.member_count || 0) / 12));
  const postWeight = Math.min(22, (c.post_count || 0) * 2);
  const profileWeight = (c.avatar_url ? 8 : 0) + (c.banner_url ? 8 : 0) + (c.description ? 8 : 0) + (c.rules ? 6 : 0);
  return Math.min(98, 42 + memberWeight + postWeight + profileWeight);
}

function getCommunityLevel(c: Community) {
  const score = getCommunityScore(c);
  if (score >= 90) return { label: "Level 9", title: "Living Ecosystem", progress: 92 };
  if (score >= 78) return { label: "Level 7", title: "Active Network", progress: 76 };
  if (score >= 64) return { label: "Level 5", title: "Growing Circle", progress: 58 };
  return { label: "Level 3", title: "New Culture", progress: 36 };
}

function ReputationBadge({ label, Icon, className }: { label: string; Icon: React.ComponentType<{ className?: string }>; className: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-widest", className)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function QualityScorePill({ community }: { community: Community }) {
  const score = getCommunityScore(community);
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-300">
      <Gauge className="h-3 w-3" />
      {score}% Quality
    </span>
  );
}

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
  const navigate = useNavigate();
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
      if (selectedCommunity?.id === cid) { setSelectedCo…22227 tokens truncated….reduce((s, p) => s + p.length, 0) : content.length;

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

function Avatar({ url, name, size = "md", onClick }: { url?: string | null; name?: string | null; size?: "xs" | "sm" | "md" | "lg"; onClick?: (event: React.MouseEvent) => void }) {
  const sizeClass = size === "xs" ? "w-5 h-5" : size === "sm" ? "w-8 h-8" : size === "lg" ? "w-12 h-12" : "w-10 h-10";
  const textSize = size === "xs" ? "text-[7px]" : size === "sm" ? "text-[9px]" : size === "lg" ? "text-sm" : "text-[10px]";
  const interactiveClass = onClick ? "cursor-pointer transition-opacity hover:opacity-85" : "";

  if (url) {
    return <img src={url} className={cn(sizeClass, "rounded-full object-cover shrink-0", interactiveClass)} alt="" onClick={onClick} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />;
  }
  return (
    <div onClick={onClick} className={cn(sizeClass, "rounded-full bg-gradient-to-br from-og-cyan/20 to-purple-500/10 flex items-center justify-center shrink-0 border border-white/10", textSize, "font-black text-white/40 uppercase", interactiveClass)}>
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

