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
  Flame, Award, Gauge, Layers, Hash, Megaphone, Sparkles,
  Zap, Bell, Swords, AlertTriangle, TrendingDown, Wallet, Target,
  Activity, CheckCircle2, Clock, ArrowRight, RefreshCw, Radio,
  Headphones, Globe, Link2, Youtube, Mic2, ChevronDown, ChevronUp,
  ImageIcon, FilePlus2, FileVideo, MousePointerClick
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { CoinCommunityFull } from "@/components/CoinCommunityFull";
import { HELIUS_API_KEY, OGSCAN_TOKEN_MINT } from "@/lib/og";
import { trackActivity } from "@/lib/trackActivity";
import { CommunityReputation } from "@/components/communities-20x/CommunityReputation";
import SpaceLeaderboard from "@/components/spaces/SpaceLeaderboard";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface CommunityExternalLink {
  id: string;
  title: string;
  url: string;
  badge?: string | null;
}

interface Community {
  id: string;
  name: string;
  description: string | null;
  privacy: string;
  created_by: string;
  creator_name: string | null;
  member_count: number;
  post_count?: number;
  posts_count?: number;
  created_at: string;
  icon: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  category?: string | null;
  rules?: string | null;
  tags?: string[] | null;
  weekly_ama_schedule?: string | null;
  research_hub_summary?: string | null;
  quality_focus?: string | null;
  community_links?: CommunityExternalLink[] | null;
  is_active?: boolean;
  invite_code?: string | null;
  // Token gating
  holder_only?: boolean;
  gate_token_mint?: string | null;
  gate_minimum_balance?: number | null;
  gate_usd_minimum?: number | null;
  holder_token_mint?: string | null;
  holder_min_amount?: number | null;
  holder_token_symbol?: string | null;
  holder_token_name?: string | null;
  // CC integration
  cc_enabled?: boolean;
  cc_token_address?: string | null;
  // Verified / trending
  verified?: boolean;
  trending?: boolean;
  trending_score?: number | null;
  active_members_24h?: number | null;
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

/* ── Token gate check: verify wallet holds ≥ $8 worth via Helius + DexScreener ── */
async function checkTokenGate(
  walletAddress: string,
  tokenMint: string,
  minUsd: number,
): Promise<{ passes: boolean; balance: number; valueUsd: number; priceUsd: number }> {
  try {
    // 1. Get token accounts via Helius DAS
    const heliusRes = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "getTokenAccountsByOwner",
          params: [
            walletAddress,
            { mint: tokenMint },
            { encoding: "jsonParsed" },
          ],
        }),
      }
    );
    const heliusData = await heliusRes.json();
    const accounts = heliusData?.result?.value ?? [];
    let rawBalance = 0;
    let decimals = 6;
    for (const acc of accounts) {
      const parsed = acc?.account?.data?.parsed?.info?.tokenAmount;
      if (parsed) {
        rawBalance += parseFloat(parsed.uiAmountString || "0");
        decimals = parsed.decimals ?? decimals;
      }
    }

    // 2. Get token price from DexScreener
    let priceUsd = 0;
    try {
      const dexRes = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${tokenMint}`);
      const dexData = await dexRes.json();
      const pairs: any[] = dexData?.pairs ?? dexData ?? [];
      const bestPair = [...pairs].sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
      priceUsd = parseFloat(bestPair?.priceUsd ?? "0");
    } catch { /* price fetch failed, use 0 */ }

    const valueUsd = rawBalance * priceUsd;
    return { passes: valueUsd >= minUsd, balance: rawBalance, valueUsd, priceUsd };
  } catch {
    // If check fails, allow join (fail open to avoid blocking users with API errors)
    return { passes: true, balance: 0, valueUsd: 0, priceUsd: 0 };
  }
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

/* ── Post Badge Chip ── */
const POST_BADGES: Record<string, { emoji: string; label: string; className: string }> = {
  alpha:    { emoji: "⚡", label: "Alpha",    className: "border-og-cyan/30 bg-og-cyan/10 text-og-cyan" },
  signal:   { emoji: "🚨", label: "Signal",   className: "border-red-400/30 bg-red-400/10 text-red-300" },
  research: { emoji: "🧠", label: "Research", className: "border-violet-400/30 bg-violet-400/10 text-violet-300" },
  analysis: { emoji: "📊", label: "Analysis", className: "border-sky-400/30 bg-sky-400/10 text-sky-300" },
  news:     { emoji: "📰", label: "News",     className: "border-orange-400/30 bg-orange-400/10 text-orange-300" },
  call:     { emoji: "🎯", label: "Call",     className: "border-og-lime/30 bg-og-lime/10 text-og-lime" },
  idea:     { emoji: "💡", label: "Idea",     className: "border-yellow-400/30 bg-yellow-400/10 text-yellow-300" },
  gm:       { emoji: "☀️", label: "GM",       className: "border-og-gold/30 bg-og-gold/10 text-og-gold" },
  degen:    { emoji: "🎲", label: "Degen",    className: "border-pink-400/30 bg-pink-400/10 text-pink-300" },
  wen:      { emoji: "⏳", label: "Wen",      className: "border-white/20 bg-white/5 text-white/50" },
};

function PostBadgeChip({ badge }: { badge: string }) {
  const meta = POST_BADGES[badge] || { emoji: "🏷️", label: badge, className: "border-white/15 bg-white/[0.04] text-white/40" };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest", meta.className)}>
      <span>{meta.emoji}</span>
      {meta.label}
    </span>
  );
}

/* ── YouTube Card ── */
function YouTubeCard({ youtubeId, title }: { youtubeId: string; title?: string | null }) {
  const [playing, setPlaying] = useState(false);
  const thumbUrl = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
  if (playing) {
    return (
      <div className="relative w-full rounded-xl overflow-hidden border border-white/[0.06] bg-black" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
          className="absolute inset-0 w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={title || "YouTube video"}
        />
      </div>
    );
  }
  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-white/[0.06] cursor-pointer group" onClick={() => setPlaying(true)}>
      <img src={thumbUrl} alt={title || "YouTube"} className="w-full aspect-video object-cover" />
      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 group-hover:bg-black/50 transition-colors">
        <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
          <Play className="h-6 w-6 text-white fill-white ml-1" />
        </div>
        {title && <p className="text-white font-semibold text-sm text-center px-4 line-clamp-2 drop-shadow">{title}</p>}
      </div>
      <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-red-600/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
        <Play className="h-2.5 w-2.5 fill-white" /> YouTube
      </div>
    </div>
  );
}

/* ── X Space Card ── */
function XSpaceCard({ url, title, isLive }: { url: string; title?: string | null; isLive?: boolean }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-white/[0.01] px-4 py-3.5 hover:border-white/20 transition-colors group"
    >
      <div className="shrink-0 w-10 h-10 rounded-full bg-black border border-white/10 flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.213 5.567zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {isLive ? (
            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-red-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />LIVE
            </span>
          ) : (
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">X Space</span>
          )}
        </div>
        <p className="text-sm font-semibold text-white truncate">{title || "Join X Space"}</p>
        <p className="text-[10px] text-white/30 mt-0.5 truncate">{url.replace("https://", "")}</p>
      </div>
      <div className="shrink-0 flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white/50 group-hover:text-white group-hover:border-white/30 transition-colors">
        <Headphones className="h-3 w-3" /> Join
      </div>
    </a>
  );
}

/* ── Link Preview Card ── */
function LinkPreviewCard({ url, title, description, imageUrl, faviconUrl, domain }: {
  url: string; title?: string | null; description?: string | null;
  imageUrl?: string | null; faviconUrl?: string | null; domain?: string | null;
}) {
  const displayDomain = domain || (() => { try { return new URL(url).hostname.replace("www.", ""); } catch { return url; } })();
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-0 rounded-xl overflow-hidden border border-white/[0.08] hover:border-white/20 transition-colors group"
    >
      {imageUrl && (
        <div className="shrink-0 w-20 sm:w-24">
          <img src={imageUrl} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).parentElement!.remove(); }} />
        </div>
      )}
      <div className="flex-1 min-w-0 px-3 py-2.5 bg-white/[0.02] group-hover:bg-white/[0.04] transition-colors">
        <div className="flex items-center gap-1.5 mb-1">
          {faviconUrl ? (
            <img src={faviconUrl} alt="" className="w-3.5 h-3.5 rounded-sm object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <Globe className="h-3 w-3 text-white/30" />
          )}
          <span className="text-[9px] font-mono text-white/30 uppercase tracking-wide truncate">{displayDomain}</span>
        </div>
        {title && <p className="text-[13px] font-semibold text-white leading-tight line-clamp-2">{title}</p>}
        {description && <p className="text-[11px] text-white/40 mt-0.5 line-clamp-2 leading-snug">{description}</p>}
      </div>
    </a>
  );
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
  // Alpha call track record
  token_price_at_post?: number | null;
  token_24h_return?: number | null;
  token_7d_return?: number | null;
  // X cross-post
  tweet_id?: string | null;
  tweet_url?: string | null;
  // Author OG reputation
  og_score?: number | null;
  og_rank?: string | null;
  // Rich media v2
  link_url?: string | null;
  link_title?: string | null;
  link_description?: string | null;
  link_image_url?: string | null;
  link_favicon_url?: string | null;
  link_domain?: string | null;
  youtube_url?: string | null;
  youtube_id?: string | null;
  youtube_title?: string | null;
  x_space_url?: string | null;
  x_space_title?: string | null;
  x_space_live?: boolean | null;
  embed_space_id?: string | null;
  post_badge?: string | null;
  is_x_post?: boolean | null;
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

type MainView = "home" | "explore" | "news" | "community" | "smart_money" | "alerts" | "raids" | "dms" | "x_posts" | "x_spaces";
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
  { label: "Trending", Icon: TrendingUp, tone: "text-og-cyan", getValue: (c: Community) => `${c.post_count || 0} posts`, sort: (a: Community, b: Community) => (b.post_count || 0) - (a.post_count || 0) },
  { label: "Fastest Growing", Icon: BarChart3, tone: "text-og-lime", getValue: (c: Community) => `${c.member_count || 0} members`, sort: (a: Community, b: Community) => (b.member_count || 0) - (a.member_count || 0) },
  { label: "Hidden Gem", Icon: Star, tone: "text-og-gold", getValue: (c: Community) => `${getCommunityScore(c)}% quality`, sort: (a: Community, b: Community) => getCommunityScore(b) - getCommunityScore(a) },
];

const COMMUNITY_PLAYBOOK = [
  { key: "ama", label: "Weekly AMA", Icon: CalendarDays },
  { key: "research", label: "Research Hub", Icon: BookOpen },
  { key: "quality", label: "Quality Score", Icon: ClipboardCheck },
  { key: "topics", label: "Topic Channels", Icon: Hash },
] as const;

const COMMUNITY_LINK_BADGES = [
  { key: "website", label: "Website", emoji: "🌐", className: "border-sky-400/25 bg-sky-400/10 text-sky-200" },
  { key: "x", label: "X", emoji: "𝕏", className: "border-white/20 bg-white/10 text-white" },
  { key: "verified", label: "Verified", emoji: "✅", className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" },
  { key: "instagram", label: "Instagram", emoji: "📸", className: "border-pink-400/25 bg-pink-400/10 text-pink-200" },
  { key: "tiktok", label: "TikTok", emoji: "🎵", className: "border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-200" },
  { key: "discord", label: "Discord", emoji: "💬", className: "border-indigo-400/25 bg-indigo-400/10 text-indigo-200" },
  { key: "telegram", label: "Telegram", emoji: "✈️", className: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200" },
  { key: "youtube", label: "YouTube", emoji: "▶️", className: "border-red-400/25 bg-red-400/10 text-red-200" },
  { key: "docs", label: "Docs", emoji: "📚", className: "border-amber-400/25 bg-amber-400/10 text-amber-200" },
  { key: "news", label: "News", emoji: "📰", className: "border-orange-400/25 bg-orange-400/10 text-orange-200" },
  { key: "alpha", label: "Alpha", emoji: "⚡", className: "border-og-cyan/25 bg-og-cyan/10 text-og-cyan" },
  { key: "podcast", label: "Podcast", emoji: "🎙️", className: "border-violet-400/25 bg-violet-400/10 text-violet-200" },
  { key: "video", label: "Video", emoji: "🎬", className: "border-rose-400/25 bg-rose-400/10 text-rose-200" },
  { key: "art", label: "Art", emoji: "🎨", className: "border-purple-400/25 bg-purple-400/10 text-purple-200" },
  { key: "memes", label: "Memes", emoji: "😂", className: "border-yellow-400/25 bg-yellow-400/10 text-yellow-200" },
  { key: "calendar", label: "Calendar", emoji: "📅", className: "border-lime-400/25 bg-lime-400/10 text-lime-200" },
  { key: "events", label: "Events", emoji: "🎟️", className: "border-blue-400/25 bg-blue-400/10 text-blue-200" },
  { key: "launch", label: "Launch", emoji: "🚀", className: "border-og-gold/25 bg-og-gold/10 text-og-gold" },
  { key: "research", label: "Research", emoji: "🔬", className: "border-teal-400/25 bg-teal-400/10 text-teal-200" },
  { key: "guide", label: "Guide", emoji: "🧭", className: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" },
  { key: "market", label: "Market", emoji: "📈", className: "border-green-400/25 bg-green-400/10 text-green-200" },
  { key: "alerts", label: "Alerts", emoji: "🚨", className: "border-red-300/25 bg-red-300/10 text-red-100" },
  { key: "bot", label: "Bot", emoji: "🤖", className: "border-slate-400/25 bg-slate-400/10 text-slate-200" },
  { key: "form", label: "Form", emoji: "📝", className: "border-stone-400/25 bg-stone-400/10 text-stone-200" },
  { key: "shop", label: "Shop", emoji: "🛒", className: "border-orange-300/25 bg-orange-300/10 text-orange-100" },
  { key: "gaming", label: "Gaming", emoji: "🎮", className: "border-fuchsia-300/25 bg-fuchsia-300/10 text-fuchsia-100" },
  { key: "ai", label: "AI", emoji: "🧠", className: "border-sky-300/25 bg-sky-300/10 text-sky-100" },
  { key: "community", label: "Community", emoji: "👥", className: "border-white/15 bg-white/10 text-white/90" },
  { key: "music", label: "Music", emoji: "🎶", className: "border-pink-300/25 bg-pink-300/10 text-pink-100" },
  { key: "link", label: "Link", emoji: "🔗", className: "border-zinc-400/25 bg-zinc-400/10 text-zinc-200" },
] as const;

const DEFAULT_COMMUNITY_LINK_BADGE = "website";

type CommunityActionKey = typeof COMMUNITY_PLAYBOOK[number]["key"];

function getCommunityPostCount(c: Community) {
  return c.posts_count ?? c.post_count ?? 0;
}

function parseTopicChannels(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\\n,]/)
        .map(item => item.trim().replace(/^#/, ""))
        .filter(Boolean)
    )
  ).slice(0, 8);
}

function createCommunityLink(): CommunityExternalLink {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: "",
    url: "",
    badge: DEFAULT_COMMUNITY_LINK_BADGE,
  };
}

function normalizeCommunityUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[a-z]+:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getCommunityLinks(c: Community): CommunityExternalLink[] {
  if (!Array.isArray(c.community_links)) return [];
  return c.community_links
    .filter((item): item is CommunityExternalLink => Boolean(item && typeof item === "object"))
    .map(item => ({
      id: item.id || `${item.title || "link"}-${Math.random().toString(36).slice(2, 7)}`,
      title: item.title || "",
      url: item.url || "",
      badge: item.badge || DEFAULT_COMMUNITY_LINK_BADGE,
    }))
    .filter(item => item.title.trim() && item.url.trim());
}

function sanitizeCommunityLinks(links: CommunityExternalLink[]): CommunityExternalLink[] {
  return links
    .map(link => ({
      id: link.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: link.title.trim(),
      url: normalizeCommunityUrl(link.url),
      badge: COMMUNITY_LINK_BADGES.some(badge => badge.key === link.badge) ? link.badge : DEFAULT_COMMUNITY_LINK_BADGE,
    }))
    .filter(link => link.title && link.url)
    .slice(0, 8);
}

function getCommunityLinkBadge(badgeKey?: string | null) {
  return COMMUNITY_LINK_BADGES.find(badge => badge.key === badgeKey) || COMMUNITY_LINK_BADGES[0];
}

function getCommunityScore(c: Community) {
  const memberWeight = Math.min(38, Math.floor((c.member_count || 0) / 12));
  const postWeight = Math.min(22, getCommunityPostCount(c) * 2);
  const profileWeight = (c.avatar_url ? 8 : 0) + (c.banner_url ? 8 : 0) + (c.description ? 8 : 0) + (c.rules ? 6 : 0);
  const experienceWeight = (c.tags?.length ? Math.min(8, c.tags.length * 2) : 0) + (c.weekly_ama_schedule ? 6 : 0) + (c.research_hub_summary ? 6 : 0) + (c.quality_focus ? 4 : 0) + Math.min(8, getCommunityLinks(c).length * 2);
  return Math.min(98, 34 + memberWeight + postWeight + profileWeight + experienceWeight);
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

/* ── Enrich posts with username/avatar/og_rank from profiles table ── */
async function enrichPostProfiles(posts: Post[]): Promise<Post[]> {
  if (posts.length === 0) return posts;
  const userIds = [...new Set(posts.map(p => p.user_id))];
  const { data: profiles } = await supabase.from("profiles")
    .select("user_id, username, avatar_url, og_score, og_rank")
    .in("user_id", userIds);
  if (!profiles || profiles.length === 0) return posts;
  const profileMap = new Map(profiles.map(p => [p.user_id, p]));
  return posts.map(p => {
    const prof = profileMap.get(p.user_id);
    if (!prof) return p;
    return {
      ...p,
      username: (!p.username || p.username === "Anonymous" || p.username === "anon") ? (prof.username || p.username) : p.username,
      avatar_url: p.avatar_url || prof.avatar_url,
      og_score: prof.og_score,
      og_rank: prof.og_rank,
    };
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
      // ── Token gate enforcement ──────────────────────────────────────────────
      const { data: comm } = await supabase.from("communities")
        .select("holder_only, gate_token_mint, gate_usd_minimum, holder_token_mint, holder_min_amount, holder_token_symbol, name")
        .eq("id", cid).single();

      if (comm?.holder_only && (comm.gate_token_mint || comm.holder_token_mint)) {
        const tokenMint = comm.gate_token_mint || comm.holder_token_mint;
        const minUsd = comm.gate_usd_minimum || comm.holder_min_amount || 8;
        const symbol = comm.holder_token_symbol || "token";

        // Get user wallet from profile
        const { data: profile } = await supabase.from("profiles")
          .select("wallet_address, sol_wallet").eq("user_id", user.id).single();
        const wallet = profile?.wallet_address || profile?.sol_wallet;

        if (!wallet) {
          toast.error(`This community requires holding $${minUsd} worth of $${symbol.toUpperCase()}. Link your wallet in Settings → Profile first.`);
          return;
        }

        toast.message("Checking wallet balance…");
        const gateResult = await checkTokenGate(wallet, tokenMint, minUsd);

        if (!gateResult.passes) {
          const held = gateResult.valueUsd < 0.01 ? "0" : `$${gateResult.valueUsd.toFixed(2)}`;
          toast.error(`You need ≥ $${minUsd} worth of $${symbol.toUpperCase()} to join. Your balance: ${held}. Buy on DexScreener to qualify.`);
          return;
        }

        toast.success(`✅ Balance verified — $${gateResult.valueUsd.toFixed(2)} of $${symbol.toUpperCase()} found!`);
      }
      // ───────────────────────────────────────────────────────────────────────

      await supabase.from("community_members").insert({ community_id: cid, user_id: user.id, role: "member" });
      // increment member_count
      const { data: c } = await supabase.from("communities").select("member_count, name").eq("id", cid).single();
      await supabase.from("communities").update({ member_count: (c?.member_count || 0) + 1 }).eq("id", cid);
      const newMap = new Map(myMemberships);
      newMap.set(cid, { id: "", community_id: cid, user_id: user.id, role: "member", joined_at: new Date().toISOString() });
      setMyMemberships(newMap);
      // Track join activity
      trackActivity({
        user_id: user.id,
        activity_type: "community.joined",
        title: `Joined ${c?.name || "community"}`,
        data: { community_id: cid, community_name: c?.name },
        is_public: true,
      });
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

  const openUserProfile = useCallback((userId?: string | null) => {
    if (!userId) return;
    if (user && userId === user.id) {
      navigate("/profile");
      return;
    }
    navigate(`/profile/${userId}`);
  }, [navigate, user]);

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
        onCreateCommunity={() => setShowCreateCommunity(true)}
      />

      {/* ─── Content ─── */}
      {selectedPost ? (
        <PostDetail
          post={selectedPost}
          user={user}
          onBack={() => setSelectedPost(null)}
          onOpenProfile={openUserProfile}
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
          onOpenProfile={openUserProfile}
          onCompose={() => setShowCompose(true)}
          onJoin={() => joinCommunity(selectedCommunity.id)}
          onLeave={() => leaveCommunity(selectedCommunity.id)}
        />
      ) : mainView === "news" ? (
        <NewsFeed user={user} onSelectPost={openPost} onOpenProfile={openUserProfile} />
      ) : mainView === "explore" ? (
        <ExploreCommunities
          user={user}
          onSelect={openCommunity}
          onCreateNew={() => setShowCreateCommunity(true)}
        />
      ) : mainView === "x_posts" ? (
        <XPostsFeed user={user} onSelectPost={openPost} onOpenProfile={openUserProfile} />
      ) : mainView === "x_spaces" ? (
        <XSpacesCommunityFeed user={user} />
      ) : mainView === "smart_money" ? (
        <SmartMoneyFeed user={user} />
      ) : mainView === "alerts" ? (
        <AlertsHub user={user} />
      ) : mainView === "raids" ? (
        <RaidsHub user={user} />
      ) : mainView === "dms" ? (
        <DMsHub user={user} />
      ) : (
        <HomeFeed
          user={user}
          onSelectPost={openPost}
          onSelectCommunity={openCommunity}
          onOpenProfile={openUserProfile}
          joinedCommunityIds={Array.from(myMemberships.keys())}
        />
      )}

      {/* ─── FAB ─── */}
      <button
        onClick={() => setShowCompose(true)}
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 w-14 h-14 rounded-full bg-og-cyan shadow-lg shadow-og-cyan/20 flex items-center justify-center text-background hover:scale-105 active:scale-95 transition-all"
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
  mainView, setMainView, selectedCommunity, selectedPost, goBack, onCompose, onCreateCommunity
}: {
  mainView: MainView;
  setMainView: (v: MainView) => void;
  selectedCommunity: Community | null;
  selectedPost: Post | null;
  goBack: () => void;
  onCompose: () => void;
  onCreateCommunity: () => void;
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
          <div className="flex items-center gap-1">
            <button
              onClick={onCreateCommunity}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-og-lime/10 border border-og-lime/30 text-og-lime text-xs font-bold hover:bg-og-lime/20 hover:border-og-lime/50 transition-all"
            >
              <Plus className="h-3.5 w-3.5 stroke-[3]" />
              New
            </button>
            <button onClick={onCompose} className="p-2 rounded-full hover:bg-white/[0.06] text-white/40">
              <PenSquare className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Tab bar — only show on root views */}
      {!selectedPost && !selectedCommunity && (
        <div className="flex border-b border-white/[0.04]">
          {([
            { id: "home" as MainView, label: "Home", icon: <Home className="h-4 w-4" /> },
            { id: "explore" as MainView, label: "Explore", icon: <Search className="h-4 w-4" /> },
            { id: "x_posts" as MainView, label: "𝕏 Feed", icon: <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.213 5.567zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
            { id: "smart_money" as MainView, label: "Smart $", icon: <Zap className="h-4 w-4" /> },
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
  user, onSelectPost, onSelectCommunity, onOpenProfile, joinedCommunityIds
}: {
  user: any;
  onSelectPost: (p: Post) => void;
  onSelectCommunity: (c: Community) => void;
  onOpenProfile: (userId?: string | null) => void;
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
      {/* V2 network overview */}
      <div className="border-b border-white/[0.05] px-4 py-4">
        <div className="rounded-2xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_32%),rgba(255,255,255,0.025)] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-og-cyan/20 bg-og-cyan/10 text-og-cyan">
              <Layers className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-og-cyan/70">Communities V2</p>
              <h2 className="mt-1 text-xl font-black leading-tight text-white">Find your crypto crew and build reputation.</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-white/35">
                Badges, ranks, streaks, knowledge hubs, events, and cleaner discovery without token rewards or financial incentives.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "Reputation", value: "XP", Icon: Award },
              { label: "Events", value: "Live", Icon: CalendarDays },
              { label: "Research", value: "Hubs", Icon: BookOpen },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/[0.06] bg-black/20 p-2">
                <item.Icon className="mb-1 h-3.5 w-3.5 text-white/35" />
                <p className="text-xs font-black text-white">{item.value}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/20">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

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
                  onOpenProfile={onOpenProfile}
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

          {!search && communities.length > 0 && (
            <div className="px-4 pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Discovery Radar</p>
                <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Personalized</span>
              </div>
              {DISCOVERY_RAILS.map((rail) => {
                const picks = [...communities]
                  .sort(rail.sort)
                  .slice(0, 3);
                return (
                  <div key={rail.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <rail.Icon className={cn("h-4 w-4", rail.tone)} />
                      <p className="text-[11px] font-black uppercase tracking-widest text-white/65">{rail.label}</p>
                    </div>
                    <div className="space-y-2">
                      {picks.map(c => (
                        <button key={`${rail.label}-${c.id}`} onClick={() => onSelect(c)} className="flex w-full items-center gap-2 rounded-xl p-1.5 text-left hover:bg-white/[0.035]">
                          <CommunityAvatar community={c} size="xs" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-black uppercase tracking-wider text-white">{c.name}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-white/20">{rail.getValue(c)}</p>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-white/15" />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
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
    "from-og-cyan/25 via-og-cyan/10 to-transparent border-og-cyan/20",
    "from-og-gold/25 via-og-gold/10 to-transparent border-og-gold/20",
    "from-og-lime/25 via-og-lime/10 to-transparent border-og-lime/20",
    "from-blue-500/25 via-blue-500/10 to-transparent border-blue-500/20",
    "from-purple-500/25 via-purple-500/10 to-transparent border-purple-500/20",
    "from-pink-500/25 via-pink-500/10 to-transparent border-pink-500/20",
  ];
  const gradIdx = c.name.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0) % gradients.length;
  const isGated = c.holder_only && (c.gate_token_mint || c.holder_token_mint);
  const gateSymbol = c.holder_token_symbol || "OG";
  const minUsd = c.gate_usd_minimum || c.holder_min_amount || 0;
  const isCcEnabled = c.cc_enabled && c.cc_token_address;

  if (variant === "compact") {
    return (
      <button onClick={onClick} className="flex flex-col items-center gap-1.5 shrink-0 w-[72px] group">
        <div className="relative">
          <CommunityAvatar community={c} size="lg" className="group-hover:scale-105 group-active:scale-95 transition-all shadow-lg" />
          {isGated && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-og-gold border border-background flex items-center justify-center text-[8px]">🔒</span>
          )}
          {isCcEnabled && (
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-og-cyan border border-background flex items-center justify-center text-[8px]">⚡</span>
          )}
        </div>
        <span className="text-[10px] text-white/40 font-black uppercase tracking-tighter truncate w-full text-center">{c.name}</span>
      </button>
    );
  }

  if (variant === "grid") {
    return (
      <button onClick={onClick} className="group rounded-2xl overflow-hidden border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] transition-all hover:border-white/[0.14] hover:shadow-lg hover:shadow-black/30 w-full text-left">
        {/* Banner */}
        <div className={cn("h-24 w-full bg-gradient-to-br relative", gradients[gradIdx])}>
          {c.banner_url && (
            <img src={c.banner_url} className="w-full h-full object-cover" alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          {/* Badges top right */}
          <div className="absolute top-2.5 right-2.5 flex gap-1.5">
            {c.trending && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 text-[8px] font-black text-orange-400 uppercase tracking-widest backdrop-blur">
                <TrendingUp className="h-2.5 w-2.5" /> Hot
              </span>
            )}
            {isGated && (
              <span className="inline-flex items-center gap-1 rounded-full bg-og-gold/20 border border-og-gold/30 px-2 py-0.5 text-[8px] font-black text-og-gold uppercase tracking-widest backdrop-blur">
                🔒 ${minUsd}
              </span>
            )}
            {isCcEnabled && (
              <span className="inline-flex items-center gap-1 rounded-full bg-og-cyan/20 border border-og-cyan/30 px-2 py-0.5 text-[8px] font-black text-og-cyan uppercase tracking-widest backdrop-blur">
                <Zap className="h-2.5 w-2.5" /> Live
              </span>
            )}
          </div>
          {/* Avatar overlapping */}
          <div className="absolute -bottom-5 left-3">
            <CommunityAvatar community={c} size="sm" className="border-2 border-background shadow-xl" />
          </div>
        </div>
        <div className="pt-7 px-3 pb-3">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-black uppercase tracking-wider text-white truncate">{c.name}</p>
            {c.verified && <BadgeCheck className="h-3.5 w-3.5 text-og-cyan shrink-0" />}
          </div>
          {c.description && (
            <p className="text-[11px] text-white/35 line-clamp-2 mt-1 leading-relaxed">{c.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2.5">
            <span className="text-[9px] font-bold text-white/25 uppercase tracking-widest flex items-center gap-1">
              <Users className="h-3 w-3" /> {c.member_count || 0}
            </span>
            {c.active_members_24h != null && c.active_members_24h > 0 && (
              <span className="text-[9px] font-bold text-og-lime/60 uppercase tracking-widest flex items-center gap-1">
                <Activity className="h-3 w-3" /> {c.active_members_24h} active
              </span>
            )}
            {c.category && (
              <span className="text-[9px] font-black text-og-cyan/50 uppercase tracking-wider">{c.category}</span>
            )}
          </div>
          {isGated && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-og-gold/20 bg-og-gold/5 px-2 py-1.5">
              <span className="text-[8px] text-og-gold font-black uppercase tracking-widest">🔒 Requires ${minUsd} of ${gateSymbol}</span>
            </div>
          )}
        </div>
      </button>
    );
  }

  // Default: list variant — much more visual
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.025] active:bg-white/[0.04] transition-colors text-left group">
      <div className="relative shrink-0">
        <CommunityAvatar community={c} size="md" />
        {isGated && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-og-gold border border-background flex items-center justify-center text-[8px]">🔒</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-black uppercase tracking-wider text-white truncate group-hover:text-og-cyan transition-colors">{c.name}</p>
          {c.verified && <BadgeCheck className="h-3.5 w-3.5 text-og-cyan shrink-0" />}
          {c.trending && <TrendingUp className="h-3.5 w-3.5 text-orange-400 shrink-0" />}
          {isCcEnabled && <Zap className="h-3.5 w-3.5 text-og-cyan/60 shrink-0" />}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest flex items-center gap-1">
            <Users className="h-3 w-3" /> {(c.member_count || 0).toLocaleString()}
          </span>
          {c.active_members_24h != null && c.active_members_24h > 0 && (
            <span className="text-[10px] font-bold text-og-lime/50 uppercase tracking-widest flex items-center gap-1">
              <Activity className="h-3 w-3" /> {c.active_members_24h}
            </span>
          )}
          {c.category && (
            <span className="text-[9px] font-black uppercase text-og-cyan/50">{c.category}</span>
          )}
          {isGated && (
            <span className="text-[9px] font-black uppercase text-og-gold/60 flex items-center gap-0.5">
              🔒 ${minUsd} ${gateSymbol}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-white/10 group-hover:text-og-cyan group-hover:translate-x-0.5 transition-all" />
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   News Feed — Articles only
   ═══════════════════════════════════════════════════════════════ */

function NewsFeed({ user, onSelectPost, onOpenProfile }: { user: any; onSelectPost: (p: Post) => void; onOpenProfile: (userId?: string | null) => void }) {
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
                <Avatar url={article.avatar_url} name={article.username} size="xs" onClick={(event) => {
                  event.stopPropagation();
                  onOpenProfile(article.user_id);
                }} />
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenProfile(article.user_id);
                  }}
                  className="text-[10px] text-white/30 hover:text-white transition-colors"
                >
                  {article.username || "Anonymous"}
                </button>
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
  community, user, myRole, isMember, onSelectPost, onOpenProfile, onCompose, onJoin, onLeave
}: {
  community: Community;
  user: any;
  myRole: CommunityMember["role"] | null;
  isMember: boolean;
  onSelectPost: (p: Post) => void;
  onOpenProfile: (userId?: string | null) => void;
  onCompose: () => void;
  onJoin: () => void;
  onLeave: () => void;
}) {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "posts" | "articles" | "threads" | "members" | "settings" | "cc" | "about" | "events" | "reputation">("all");
  const [feedSort, setFeedSort] = useState<FeedSort>("latest");
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [scheduledSpaces, setScheduledSpaces] = useState<any[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [topMembers, setTopMembers] = useState<Array<{ user_id: string; username: string | null; avatar_url: string | null; posts: number; likes: number; role: string }>>([]);
  const [userReputation, setUserReputation] = useState<any | null>(null);
  const [communityState, setCommunityState] = useState<Community>(community);
  const [editRules, setEditRules] = useState(community.rules || "");
  const [editDesc, setEditDesc] = useState(community.description || "");
  const [editAma, setEditAma] = useState(community.weekly_ama_schedule || "");
  const [editResearchHub, setEditResearchHub] = useState(community.research_hub_summary || "");
  const [editTopicChannels, setEditTopicChannels] = useState((community.tags || []).join(", "));
  const [editQualityFocus, setEditQualityFocus] = useState(community.quality_focus || "");
  const [editLinks, setEditLinks] = useState<CommunityExternalLink[]>(getCommunityLinks(community));
  const [activeActionCard, setActiveActionCard] = useState<CommunityActionKey | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingActionCard, setSavingActionCard] = useState<CommunityActionKey | null>(null);
  const isAppOwner = user?.email?.toLowerCase() === "audifyx@gmail.com";
  const isAppTeam = isGlobalAdmin || isAppOwner;
  const canEditCommunity = myRole === "creator" || myRole === "moderator" || isAppTeam;
  const canManageModerators = myRole === "creator" || isAppTeam;
  const canModerate = myRole === "creator" || myRole === "moderator" || isAppTeam;
  const isCreator = myRole === "creator";

  useEffect(() => {
    setCommunityState(community);
    setEditRules(community.rules || "");
    setEditDesc(community.description || "");
    setEditAma(community.weekly_ama_schedule || "");
    setEditResearchHub(community.research_hub_summary || "");
    setEditTopicChannels((community.tags || []).join(", "));
    setEditQualityFocus(community.quality_focus || "");
    setEditLinks(getCommunityLinks(community));
    setActiveActionCard(null);
    setActiveTopic(null);
    setFeedSort("latest");
  }, [community]);

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
    if (filter !== "members" && filter !== "settings" && filter !== "about" && filter !== "reputation") return;
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

  // Fetch scheduled spaces for this community's topics/tags
  useEffect(() => {
    if (filter !== "events") return;
    (async () => {
      setScheduledLoading(true);
      const { data } = await supabase.from("spaces")
        .select("id, title, description, host_id, host_username, host_avatar, topic, scheduled_for, listener_count, is_live, tags, category")
        .is("ended_at", null)
        .not("scheduled_for", "is", null)
        .gte("scheduled_for", new Date().toISOString())
        .order("scheduled_for", { ascending: true })
        .limit(20);
      setScheduledSpaces(data || []);
      setScheduledLoading(false);
    })();
  }, [filter, community.id]);

  // Fetch top members by post activity for community leaderboard
  useEffect(() => {
    if (filter !== "about" && filter !== "reputation") return;
    (async () => {
      const { data: posts } = await supabase.from("community_posts")
        .select("user_id, likes_count")
        .eq("community_id", community.id)
        .limit(500);
      if (!posts || posts.length === 0) { setTopMembers([]); return; }
      const map = new Map<string, { posts: number; likes: number }>();
      for (const p of posts) {
        const e = map.get(p.user_id) || { posts: 0, likes: 0 };
        e.posts++;
        e.likes += p.likes_count || 0;
        map.set(p.user_id, e);
      }
      const sorted = Array.from(map.entries())
        .sort((a, b) => (b[1].posts * 5 + b[1].likes * 3) - (a[1].posts * 5 + a[1].likes * 3))
        .slice(0, 8);
      if (sorted.length === 0) { setTopMembers([]); return; }
      const uids = sorted.map(([uid]) => uid);
      const { data: profiles } = await supabase.from("profiles")
        .select("user_id, username, avatar_url").in("user_id", uids);
      const pMap = new Map((profiles || []).map(p => [p.user_id, p]));
      const { data: memberRoles } = await supabase.from("community_members")
        .select("user_id, role").eq("community_id", community.id).in("user_id", uids);
      const rMap = new Map((memberRoles || []).map(m => [m.user_id, m.role]));
      setTopMembers(sorted.map(([uid, stats]) => ({
        user_id: uid,
        username: pMap.get(uid)?.username || null,
        avatar_url: pMap.get(uid)?.avatar_url || null,
        posts: stats.posts,
        likes: stats.likes,
        role: rMap.get(uid) || "member",
      })));
    })();
  }, [filter, community.id]);

  // Build current user's reputation for this community
  useEffect(() => {
    if (!user || filter !== "reputation") return;
    (async () => {
      const { data: myPosts } = await supabase.from("community_posts")
        .select("id, likes_count, is_article, created_at")
        .eq("community_id", community.id)
        .eq("user_id", user.id)
        .limit(200);
      const posts = myPosts || [];
      const totalPosts = posts.length;
      const totalLikes = posts.reduce((s, p) => s + (p.likes_count || 0), 0);
      const xp = totalPosts * 8 + totalLikes * 2;
      const { data: profile } = await supabase.from("profiles")
        .select("username, avatar_url").eq("user_id", user.id).single();
      setUserReputation({
        userId: user.id,
        username: profile?.username || user.email?.split("@")[0] || "You",
        xp,
        level: Math.min(10, Math.floor(Math.log2(xp / 50 + 1)) + 1),
        title: "",
        badges: [],
        stats: {
          helpfulPosts: posts.filter(p => (p.likes_count || 0) >= 3).length,
          commentsReceived: 0,
          messagesPosted: totalPosts,
          likesReceived: totalLikes,
          daysActive: new Set(posts.map(p => p.created_at?.slice(0, 10))).size,
          eventsJoined: 0,
        },
        rank: 1,
        streak: 0,
      });
    })();
  }, [filter, user, community.id]);

  const toggleMod = async (member: CommunityMember) => {
    if (!canManageModerators) return;
    const newRole = member.role === "moderator" ? "member" : "moderator";
    const { error } = await supabase.from("community_members").update({ role: newRole }).eq("id", member.id);
    if (error) {
      console.error("Failed to update mod role:", error);
      toast.error("Failed to update role — please try again");
      return;
    }
    setMembers(members.map(m => m.id === member.id ? { ...m, role: newRole as any } : m));
    toast.success(newRole === "moderator" ? "Promoted to mod! 🛡️" : "Removed mod role");
  };

  const togglePin = async (postId: string, currentlyPinned: boolean) => {
    if (!canModerate) return;
    await supabase.from("community_posts").update({ is_pinned: !currentlyPinned }).eq("id", postId);
    toast.success(currentlyPinned ? "Unpinned" : "Pinned! 📌");
    fetchPosts();
  };

  const saveCommunityUpdate = async (updates: Partial<Community>, successMessage: string, actionKey?: CommunityActionKey) => {
    if (!canEditCommunity) return null;
    if (actionKey) setSavingActionCard(actionKey);
    const { data, error } = await supabase.from("communities")
      .update(updates)
      .eq("id", community.id)
      .select("*")
      .single();

    if (actionKey) setSavingActionCard(null);

    if (error) {
      console.error("Failed to update community:", error);
      toast.error(error.message || "Failed to save changes");
      return null;
    }

    const nextCommunity = { ...communityState, ...(data as Community), ...updates };
    setCommunityState(nextCommunity);
    setEditDesc(nextCommunity.description || "");
    setEditRules(nextCommunity.rules || "");
    setEditAma(nextCommunity.weekly_ama_schedule || "");
    setEditResearchHub(nextCommunity.research_hub_summary || "");
    setEditTopicChannels((nextCommunity.tags || []).join(", "));
    setEditQualityFocus(nextCommunity.quality_focus || "");
    setEditLinks(getCommunityLinks(nextCommunity));
    toast.success(successMessage);
    return nextCommunity;
  };

  const saveSettings = async () => {
    if (!canEditCommunity) return;
    setSavingSettings(true);
    await saveCommunityUpdate({
      description: editDesc.trim() || null,
      rules: editRules.trim() || null,
      community_links: sanitizeCommunityLinks(editLinks),
    }, "Settings saved ✨");
    setSavingSettings(false);
  };

  const saveActionCard = async (key: CommunityActionKey) => {
    if (!canModerate) return;
    if (key === "ama") {
      await saveCommunityUpdate({ weekly_ama_schedule: editAma.trim() || null }, "Weekly AMA updated", key);
      return;
    }
    if (key === "research") {
      await saveCommunityUpdate({ research_hub_summary: editResearchHub.trim() || null }, "Research hub updated", key);
      return;
    }
    if (key === "topics") {
      const tags = parseTopicChannels(editTopicChannels);
      await saveCommunityUpdate({ tags }, "Topic channels updated", key);
      setActiveTopic(tags[0] || null);
      return;
    }
    if (key === "quality") {
      await saveCommunityUpdate({ quality_focus: editQualityFocus.trim() || null }, "Quality score guidance updated", key);
    }
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

    if (activeTopic) {
      items = items.filter(post => (post.tags || []).some(tag => tag.toLowerCase() === activeTopic.toLowerCase()));
    }

    if (feedSort === "top") {
      items = [...items].sort((a, b) => {
        const aScore = (a.is_pinned ? 5000 : 0) + (a.likes_count || 0) * 3 + (a.replies_count || 0) * 5 + (a.views_count || 0);
        const bScore = (b.is_pinned ? 5000 : 0) + (b.likes_count || 0) * 3 + (b.replies_count || 0) * 5 + (b.views_count || 0);
        return bScore - aScore;
      });
    } else if (feedSort === "trending") {
      items = [...items].sort((a, b) => {
        const aScore = (a.is_pinned ? 5000 : 0) + (a.views_count || 0) * 3 + (a.likes_count || 0) * 4 + (a.replies_count || 0) * 6;
        const bScore = (b.is_pinned ? 5000 : 0) + (b.views_count || 0) * 3 + (b.likes_count || 0) * 4 + (b.replies_count || 0) * 6;
        return bScore - aScore;
      });
    }

    setPosts(items);
    setLoading(false);
  }, [community.id, user, filter, activeTopic, feedSort]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel(`cf-${community.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts", filter: `community_id=eq.${community.id}` }, () => fetchPosts())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [community.id, fetchPosts]);

  const currentCommunity = communityState;
  const level = getCommunityLevel(currentCommunity);
  const articleCount = posts.filter(post => post.is_article || post.post_type === "article").length;
  const topicCollections = (currentCommunity.tags && currentCommunity.tags.length > 0)
    ? currentCommunity.tags.slice(0, 6)
    : Array.from(new Set(posts.flatMap(post => post.tags || []))).slice(0, 6);
  const qualitySummary = currentCommunity.quality_focus?.trim() || "Helpful posts rise";
  const qualityScore = getCommunityScore(currentCommunity);
  const communityLinks = getCommunityLinks(currentCommunity);

  return (
    <div>
      {/* Community header — X-style with banner */}
      {(() => {
        const gradients = [
          "from-og-cyan/20 via-og-cyan/10 to-transparent",
          "from-og-gold/20 via-og-gold/10 to-transparent",
          "from-og-lime/20 via-og-lime/10 to-transparent",
        ];
        const gIdx = currentCommunity.name.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0) % gradients.length;
        return (
          <div className="border-b border-white/[0.06]">
            {/* Banner */}
            <div className={cn("h-28 w-full bg-gradient-to-br relative", gradients[gIdx])}>
              {community.banner_url && (
                <img src={community.banner_url} className="w-full h-full object-cover" alt=""
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
              <div className="absolute bottom-3 right-3 flex gap-1.5">
                <QualityScorePill community={currentCommunity} />
                <span className="inline-flex items-center gap-1 rounded-full border border-black/20 bg-black/45 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white/75 backdrop-blur">
                  <Flame className="h-3 w-3 text-og-lime" />
                  {level.label}
                </span>
              </div>
              <div className="absolute -bottom-7 left-4">
                <CommunityAvatar community={currentCommunity} size="lg" className="border-[3px] border-background shadow-xl" />
              </div>
            </div>
            {/* Info */}
            <div className="pt-9 px-4 pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-black uppercase tracking-widest text-white">{currentCommunity.name}</h2>
                  {currentCommunity.description && (
                    <p className="text-[11px] text-white/30 mt-1 leading-relaxed">{currentCommunity.description}</p>
                  )}
                  {communityLinks.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {communityLinks.map(link => {
                        const badge = getCommunityLinkBadge(link.badge);
                        return (
                          <a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-black tracking-wider text-white/80 transition-colors hover:border-og-cyan/30 hover:text-og-cyan"
                          >
                            <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px]", badge.className)}>{badge.emoji}</span>
                            <span className="truncate uppercase">{link.title}</span>
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {isMember ? (
                    <>
                      <button onClick={onCompose}
                        className="px-4 py-1.5 rounded-xl bg-og-cyan text-background text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)]">
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
                      className={cn("px-4 py-1.5 rounded-xl text-background text-[10px] font-black uppercase tracking-widest transition-all",
                        currentCommunity.holder_only
                          ? "bg-og-gold hover:bg-og-gold/80 shadow-[0_0_15px_rgba(251,191,36,0.2)]"
                          : "bg-og-cyan hover:bg-white shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                      )}>
                      {currentCommunity.holder_only ? "🔒 Join" : "Join"}
                    </button>
                  )}
                </div>
              </div>

              {/* Token gate info banner */}
              {currentCommunity.holder_only && (currentCommunity.gate_token_mint || currentCommunity.holder_token_mint) && !isMember && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-og-gold/25 bg-og-gold/[0.06] px-3 py-2.5">
                  <span className="text-og-gold text-sm">🔒</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-og-gold uppercase tracking-wide">Token Gated Community</p>
                    <p className="text-[10px] text-white/35 mt-0.5">
                      Hold ${currentCommunity.gate_usd_minimum || currentCommunity.holder_min_amount || 8} worth of ${currentCommunity.holder_token_symbol || "OG"} to join
                    </p>
                  </div>
                  <a
                    href={`https://dexscreener.com/solana/${currentCommunity.gate_token_mint || currentCommunity.holder_token_mint || OGSCAN_TOKEN_MINT}`}
                    target="_blank" rel="noreferrer"
                    className="shrink-0 text-[9px] font-black uppercase tracking-widest text-og-gold border border-og-gold/30 rounded-lg px-2.5 py-1 hover:bg-og-gold/10 transition-colors"
                  >
                    Buy →
                  </a>
                </div>
              )}

              {/* CC Communities badge */}
              {currentCommunity.cc_enabled && (
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-og-cyan/20 bg-og-cyan/[0.05] px-3 py-2">
                  <Zap className="h-3.5 w-3.5 text-og-cyan shrink-0" />
                  <p className="text-[10px] text-og-cyan/80 font-bold">Live CC Chat enabled — tap the ⚡ tab to chat</p>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {QUALITY_BADGES.map(badge => (
                  <ReputationBadge key={badge.label} {...badge} />
                ))}
              </div>
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest flex items-center gap-1.5">
                  <Users className="h-3 w-3" /> <span className="text-white/40">{(currentCommunity.member_count || 0).toLocaleString()} MEMBERS</span>
                </span>
                {currentCommunity.active_members_24h != null && currentCommunity.active_members_24h > 0 && (
                  <span className="text-[9px] font-bold text-og-lime/50 uppercase tracking-widest flex items-center gap-1.5">
                    <Activity className="h-3 w-3" /> <span className="text-og-lime/60">{currentCommunity.active_members_24h} ACTIVE TODAY</span>
                  </span>
                )}
                {currentCommunity.category && (
                  <span className="text-[9px] font-black text-og-cyan/40 bg-og-cyan/5 px-2 py-0.5 rounded-full border border-og-cyan/10 uppercase">{currentCommunity.category}</span>
                )}
              </div>
              <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-white">{level.title}</p>
                    <p className="text-[10px] text-white/25">Progress tracks activity, helpful content, consistency, and profile depth.</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-og-lime/20 bg-og-lime/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-og-lime">{level.progress}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-gradient-to-r from-og-cyan via-og-lime to-og-gold" style={{ width: `${level.progress}%` }} />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {COMMUNITY_PLAYBOOK.map(item => {
                  const detail = item.key === "ama"
                    ? (currentCommunity.weekly_ama_schedule?.trim() || "Set the AMA cadence")
                    : item.key === "research"
                      ? (currentCommunity.research_hub_summary?.trim() || (articleCount > 0 ? `${articleCount} articles ready` : "Guides and FAQs"))
                      : item.key === "quality"
                        ? qualitySummary
                        : topicCollections.length > 0
                          ? topicCollections.slice(0, 3).join(" • ")
                          : "Research • news • memes";

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setActiveActionCard(activeActionCard === item.key ? null : item.key);
                        if (item.key === "research") setFilter("articles");
                        if (item.key === "quality") {
                          setFilter("all");
                          setFeedSort("top");
                        }
                        if (item.key === "topics" && topicCollections.length > 0) {
                          setActiveTopic(topicCollections[0]);
                          setFilter("all");
                        }
                      }}
                      className={cn(
                        "rounded-xl border bg-black/20 p-2 text-left transition-all",
                        activeActionCard === item.key ? "border-og-cyan/40 shadow-[0_0_20px_rgba(34,211,238,0.12)]" : "border-white/[0.05] hover:border-og-cyan/20"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <item.Icon className="h-3.5 w-3.5 text-white/35" />
                        <ChevronRight className={cn("h-3.5 w-3.5 text-white/25 transition-transform", activeActionCard === item.key && "rotate-90 text-og-cyan")} />
                      </div>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-white/70">{item.label}</p>
                      <p className="mt-1 text-[9px] text-white/20 line-clamp-2">{detail}</p>
                    </button>
                  );
                })}
              </div>
              {activeActionCard && (
                <div className="mt-3 rounded-2xl border border-og-cyan/20 bg-black/25 p-3 space-y-3">
                  {activeActionCard === "ama" && (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-og-cyan/70">Weekly AMA</p>
                          <p className="mt-1 text-sm text-white/55">Set the live AMA schedule and jump straight into Spaces.</p>
                        </div>
                        <button type="button" onClick={() => navigate("/spaces")} className="text-[10px] font-black uppercase tracking-widest text-og-cyan hover:text-white transition-colors">Open Spaces</button>
                      </div>
                      <input
                        value={editAma}
                        onChange={e => setEditAma(e.target.value)}
                        readOnly={!canModerate}
                        placeholder="Every Thursday, 7PM EST · Host: Audifyx"
                        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-og-cyan/30 read-only:cursor-default read-only:text-white/45"
                      />
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] text-white/30">This updates the card immediately.</p>
                        {canModerate && (
                          <button type="button" onClick={() => saveActionCard("ama")} disabled={savingActionCard === "ama"} className="px-3 py-2 rounded-xl bg-og-cyan text-background text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50">
                            {savingActionCard === "ama" ? "Saving..." : "Save AMA"}
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {activeActionCard === "research" && (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-og-cyan/70">Research hub</p>
                          <p className="mt-1 text-sm text-white/55">Define what members should find here, then jump into article mode.</p>
                        </div>
                        <button type="button" onClick={() => setFilter("articles")} className="text-[10px] font-black uppercase tracking-widest text-og-cyan hover:text-white transition-colors">View articles</button>
                      </div>
                      <textarea
                        value={editResearchHub}
                        onChange={e => setEditResearchHub(e.target.value)}
                        readOnly={!canModerate}
                        placeholder="What should members find in this research hub?"
                        className="h-24 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none resize-none focus:border-og-cyan/30 read-only:cursor-default read-only:text-white/45"
                      />
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] text-white/30">Current article count: {articleCount}</p>
                        {canModerate && (
                          <button type="button" onClick={() => saveActionCard("research")} disabled={savingActionCard === "research"} className="px-3 py-2 rounded-xl bg-og-cyan text-background text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50">
                            {savingActionCard === "research" ? "Saving..." : "Save hub"}
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {activeActionCard === "quality" && (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-og-cyan/70">Quality score</p>
                          <p className="mt-1 text-sm text-white/55">Define the signal this community values and sort the feed live.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {(["latest", "top", "trending"] as FeedSort[]).map(option => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setFeedSort(option)}
                              className={cn("rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors", feedSort === option ? "border-og-cyan/40 bg-og-cyan/10 text-og-cyan" : "border-white/[0.08] text-white/35 hover:text-white")}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea
                        value={editQualityFocus}
                        onChange={e => setEditQualityFocus(e.target.value)}
                        readOnly={!canModerate}
                        placeholder="Helpful posts rise, low-effort shills sink, signal beats noise."
                        className="h-24 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none resize-none focus:border-og-cyan/30 read-only:cursor-default read-only:text-white/45"
                      />
                      <div className="grid grid-cols-3 gap-2 text-center text-[10px] uppercase tracking-widest">
                        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-2 py-3 text-white/55"><p className="text-white text-sm font-black">{qualityScore}%</p>Quality</div>
                        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-2 py-3 text-white/55"><p className="text-white text-sm font-black">{level.label}</p>Level</div>
                        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-2 py-3 text-white/55"><p className="text-white text-sm font-black">{posts.length}</p>Visible posts</div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] text-white/30">Switching sort updates the feed below immediately.</p>
                        {canModerate && (
                          <button type="button" onClick={() => saveActionCard("quality")} disabled={savingActionCard === "quality"} className="px-3 py-2 rounded-xl bg-og-cyan text-background text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50">
                            {savingActionCard === "quality" ? "Saving..." : "Save focus"}
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {activeActionCard === "topics" && (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-og-cyan/70">Topic channels</p>
                          <p className="mt-1 text-sm text-white/55">Set the main channels, then tap one to filter the feed instantly.</p>
                        </div>
                        <button type="button" onClick={() => setActiveTopic(null)} className="text-[10px] font-black uppercase tracking-widest text-og-cyan hover:text-white transition-colors">Clear filter</button>
                      </div>
                      <textarea
                        value={editTopicChannels}
                        onChange={e => setEditTopicChannels(e.target.value)}
                        readOnly={!canModerate}
                        placeholder="research, alpha, news, memes"
                        className="h-20 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none resize-none focus:border-og-cyan/30 read-only:cursor-default read-only:text-white/45"
                      />
                      <div className="flex flex-wrap gap-2">
                        {topicCollections.map(topic => (
                          <button
                            key={topic}
                            type="button"
                            onClick={() => {
                              setActiveTopic(topic);
                              setFilter("all");
                            }}
                            className={cn("rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors", activeTopic?.toLowerCase() === topic.toLowerCase() ? "border-og-cyan/40 bg-og-cyan/10 text-og-cyan" : "border-white/[0.08] bg-white/[0.03] text-white/55 hover:text-white")}
                          >
                            #{topic}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] text-white/30">Filtering by topic narrows the feed below.</p>
                        {canModerate && (
                          <button type="button" onClick={() => saveActionCard("topics")} disabled={savingActionCard === "topics"} className="px-3 py-2 rounded-xl bg-og-cyan text-background text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50">
                            {savingActionCard === "topics" ? "Saving..." : "Save topics"}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Filter tabs */}
      <div className="flex border-b border-white/[0.04] overflow-x-auto scrollbar-hide">
        {([
          "all",
          "posts",
          "threads",
          "articles",
          "about",
          "events",
          "reputation",
          ...(currentCommunity.cc_enabled ? ["cc" as const] : []),
          "members",
          ...(canEditCommunity ? ["settings" as const] : []),
        ] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={cn("shrink-0 py-2.5 text-xs font-medium transition-colors relative capitalize min-w-[2.5rem] px-2",
              filter === f ? "text-white" : "text-white/25"
            )}
          >
            {f === "members" ? <Users className="h-3.5 w-3.5 mx-auto" /> :
             f === "settings" ? <Settings className="h-3.5 w-3.5 mx-auto" /> :
             f === "cc" ? <span className="flex items-center justify-center gap-0.5"><Zap className="h-3 w-3" /><span className="text-[10px]">CC</span></span> :
             f === "about" ? <span className="flex items-center justify-center gap-0.5"><BookOpen className="h-3 w-3" /><span className="text-[10px] hidden sm:inline">About</span></span> :
             f === "events" ? <span className="flex items-center justify-center gap-0.5"><CalendarDays className="h-3 w-3" /><span className="text-[10px] hidden sm:inline">Events</span></span> :
             f === "reputation" ? <span className="flex items-center justify-center gap-0.5"><Award className="h-3 w-3" /><span className="text-[10px] hidden sm:inline">Rep</span></span> :
             f}
            {filter === f && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-[2px] rounded-full bg-og-cyan" />
            )}
          </button>
        ))}
      </div>

      {/* CC Communities panel — full embedded chat */}
      {filter === "cc" && currentCommunity.cc_enabled && currentCommunity.cc_token_address && (
        <div className="p-4">
          <CoinCommunityFull
            tokenAddress={currentCommunity.cc_token_address}
            tokenSymbol={currentCommunity.holder_token_symbol || "OG"}
            embedded={true}
          />
        </div>
      )}

      {filter !== "members" && filter !== "settings" && filter !== "cc" && filter !== "about" && filter !== "events" && filter !== "reputation" && (
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.04] px-4 py-2 flex-wrap">
          <div className="flex items-center gap-1">
            {(["latest", "top", "trending"] as FeedSort[]).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setFeedSort(option)}
                className={cn("rounded-lg border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors", feedSort === option ? "border-og-cyan/40 bg-og-cyan/10 text-og-cyan" : "border-transparent text-white/30 hover:text-white/60")}
              >
                {option}
              </button>
            ))}
          </div>
          {activeTopic ? (
            <button
              type="button"
              onClick={() => setActiveTopic(null)}
              className="text-[10px] font-black uppercase tracking-widest text-og-cyan hover:text-white transition-colors"
            >
              Clear #{activeTopic}
            </button>
          ) : (
            <span className="text-[10px] uppercase tracking-widest text-white/20">Sorted for signal</span>
          )}
        </div>
      )}

      {/* ─── ABOUT panel ─── */}
      {filter === "about" && (
        <div className="p-4 space-y-4">
          {/* Description */}
          {currentCommunity.description && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[10px] font-black text-white/25 uppercase tracking-wider mb-2 flex items-center gap-1.5"><BookOpen className="h-3 w-3" /> About</p>
              <p className="text-[13px] text-white/60 leading-relaxed">{currentCommunity.description}</p>
            </div>
          )}

          {/* Token gate info */}
          {currentCommunity.holder_only && (currentCommunity.gate_token_mint || currentCommunity.holder_token_mint) && (
            <div className="rounded-xl border border-og-gold/20 bg-og-gold/[0.04] p-4">
              <p className="text-[10px] font-black text-og-gold/70 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Shield className="h-3 w-3 text-og-gold" /> Token Gate</p>
              <p className="text-[12px] text-white/50">Hold <span className="text-og-gold font-bold">${currentCommunity.gate_usd_minimum || currentCommunity.holder_min_amount || 8}</span> worth of <span className="text-og-gold font-bold">${currentCommunity.holder_token_symbol || "OG"}</span> to join this community.</p>
              {(currentCommunity.gate_token_mint || currentCommunity.holder_token_mint) && (
                <a href={`https://dexscreener.com/solana/${currentCommunity.gate_token_mint || currentCommunity.holder_token_mint}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-[10px] font-black text-og-gold border border-og-gold/20 rounded-lg px-2.5 py-1 hover:bg-og-gold/10 transition-colors">
                  <ExternalLink className="h-2.5 w-2.5" /> View on DexScreener
                </a>
              )}
            </div>
          )}

          {/* Rules */}
          {currentCommunity.rules && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[10px] font-black text-white/25 uppercase tracking-wider mb-2 flex items-center gap-1.5"><ClipboardCheck className="h-3 w-3" /> Community Rules</p>
              <div className="space-y-1.5">
                {currentCommunity.rules.split("\n").filter(Boolean).map((rule, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-og-cyan/10 text-og-cyan text-[9px] font-black flex items-center justify-center mt-0.5">{i + 1}</span>
                    <p className="text-[12px] text-white/50 leading-relaxed">{rule}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* External links */}
          {getCommunityLinks(currentCommunity).length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[10px] font-black text-white/25 uppercase tracking-wider mb-2 flex items-center gap-1.5"><ExternalLink className="h-3 w-3" /> Links</p>
              <div className="space-y-2">
                {getCommunityLinks(currentCommunity).map(link => {
                  const badge = getCommunityLinkBadge(link.badge);
                  return (
                    <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-white/[0.05] bg-white/[0.015] hover:border-og-cyan/20 hover:bg-white/[0.03] transition-all">
                      <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full border text-sm shrink-0", badge.className)}>{badge.emoji}</span>
                      <span className="text-[12px] font-bold text-white/70 flex-1">{link.title}</span>
                      <ExternalLink className="h-3 w-3 text-white/20" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[10px] font-black text-white/25 uppercase tracking-wider mb-3 flex items-center gap-1.5"><BarChart3 className="h-3 w-3" /> Community Stats</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-black/20 p-3 text-center">
                <p className="text-lg font-black text-white">{(currentCommunity.member_count || 0).toLocaleString()}</p>
                <p className="text-[9px] text-white/25 uppercase tracking-widest mt-0.5">Members</p>
              </div>
              <div className="rounded-lg bg-black/20 p-3 text-center">
                <p className="text-lg font-black text-og-lime">{currentCommunity.active_members_24h ?? "—"}</p>
                <p className="text-[9px] text-white/25 uppercase tracking-widest mt-0.5">Active Today</p>
              </div>
              <div className="rounded-lg bg-black/20 p-3 text-center">
                <p className="text-lg font-black text-white">{posts.length}</p>
                <p className="text-[9px] text-white/25 uppercase tracking-widest mt-0.5">Posts</p>
              </div>
              <div className="rounded-lg bg-black/20 p-3 text-center">
                <p className="text-lg font-black text-og-cyan">{getCommunityScore(currentCommunity)}%</p>
                <p className="text-[9px] text-white/25 uppercase tracking-widest mt-0.5">Quality Score</p>
              </div>
            </div>
          </div>

          {/* Top Members widget */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[10px] font-black text-white/25 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Crown className="h-3 w-3 text-amber-400" /> Top Contributors</p>
            {membersLoading ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 text-white/10 animate-spin" /></div>
            ) : topMembers.length === 0 ? (
              <p className="text-[11px] text-white/20 text-center py-4">No activity data yet</p>
            ) : (
              <div className="space-y-2">
                {topMembers.map((m, i) => (
                  <div key={m.user_id} className="flex items-center gap-2.5 p-2 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                    <div className="w-6 text-center shrink-0">
                      {i === 0 ? <span className="text-base">🥇</span> : i === 1 ? <span className="text-base">🥈</span> : i === 2 ? <span className="text-base">🥉</span> : <span className="text-[11px] font-bold text-white/20">#{i + 1}</span>}
                    </div>
                    <div className="w-8 h-8 rounded-full border border-white/[0.08] bg-white/[0.04] flex items-center justify-center overflow-hidden shrink-0">
                      {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-white/30">{m.username?.[0]?.toUpperCase() || "?"}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <button type="button" onClick={() => onOpenProfile(m.user_id)} className="text-[11px] font-bold text-white/70 hover:text-og-cyan transition-colors truncate">{m.username || "User"}</button>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-white/20">{m.posts} posts</span>
                        <span className="text-[9px] text-white/20">·</span>
                        <span className="text-[9px] text-white/20">{m.likes} likes</span>
                      </div>
                    </div>
                    {m.role === "creator" && <span className="text-[8px] font-black text-og-gold bg-og-gold/10 px-1.5 py-0.5 rounded-full border border-og-gold/20">OWNER</span>}
                    {m.role === "moderator" && <span className="text-[8px] font-black text-og-cyan bg-og-cyan/10 px-1.5 py-0.5 rounded-full border border-og-cyan/20">MOD</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CommunityRooms link */}
          <button
            type="button"
            onClick={() => navigate("/rooms")}
            className="w-full flex items-center justify-between gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-og-cyan/20 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-og-cyan/10 border border-og-cyan/20 flex items-center justify-center">
                <Hash className="h-4 w-4 text-og-cyan" />
              </div>
              <div className="text-left">
                <p className="text-[12px] font-black text-white/70">Voice Rooms</p>
                <p className="text-[10px] text-white/25">Open real-time audio rooms</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-white/20" />
          </button>
        </div>
      )}

      {/* ─── EVENTS panel ─── */}
      {filter === "events" && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black text-white/25 uppercase tracking-wider flex items-center gap-1.5"><CalendarDays className="h-3 w-3" /> Upcoming Spaces</p>
            <button type="button" onClick={() => navigate("/spaces")} className="text-[10px] font-black text-og-cyan hover:text-white transition-colors">Open Spaces →</button>
          </div>
          {scheduledLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 text-white/10 animate-spin" /></div>
          ) : scheduledSpaces.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/[0.06] p-8 text-center">
              <CalendarDays className="h-8 w-8 mx-auto text-white/[0.06] mb-3" />
              <p className="text-sm font-bold text-white/40">No upcoming spaces scheduled</p>
              <p className="text-[11px] text-white/20 mt-1">Schedule a space from the Spaces tab to see it here</p>
              <button type="button" onClick={() => navigate("/spaces")} className="mt-4 px-4 py-2 rounded-xl bg-og-cyan/10 border border-og-cyan/20 text-og-cyan text-[10px] font-black uppercase tracking-widest hover:bg-og-cyan/15 transition-colors">
                Go to Spaces
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {scheduledSpaces.map(space => {
                const when = space.scheduled_for ? new Date(space.scheduled_for) : null;
                const dateStr = when ? when.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
                const timeStr = when ? when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
                return (
                  <div key={space.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-og-cyan/10 border border-og-cyan/20 flex items-center justify-center shrink-0">
                        <Radio className="h-4 w-4 text-og-cyan" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-white leading-tight">{space.title}</p>
                        {space.description && <p className="text-[11px] text-white/35 mt-0.5 line-clamp-2">{space.description}</p>}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {when && (
                            <span className="text-[10px] font-bold text-og-cyan flex items-center gap-1">
                              <CalendarDays className="h-2.5 w-2.5" /> {dateStr} at {timeStr}
                            </span>
                          )}
                          {space.host_username && (
                            <span className="text-[10px] text-white/25 flex items-center gap-1">
                              <Users className="h-2.5 w-2.5" /> @{space.host_username}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button type="button" onClick={() => navigate("/spaces")} className="px-3 py-1.5 rounded-lg bg-og-cyan/10 border border-og-cyan/20 text-og-cyan text-[10px] font-black hover:bg-og-cyan/15 transition-colors flex items-center gap-1">
                        <Bell className="h-3 w-3" /> Set Reminder
                      </button>
                      {space.topic && (
                        <span className="px-2 py-1 rounded-lg border border-white/[0.06] text-[9px] font-bold text-white/30">{space.topic}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Space leaderboard */}
          <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <SpaceLeaderboard compact={false} />
          </div>
        </div>
      )}

      {/* ─── REPUTATION panel ─── */}
      {filter === "reputation" && (
        <div className="p-4 space-y-4">
          {/* My reputation card */}
          {userReputation ? (
            <div>
              <p className="text-[10px] font-black text-white/25 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Star className="h-3 w-3 text-amber-400" /> Your Reputation</p>
              <CommunityReputation reputation={userReputation} />
            </div>
          ) : !user ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
              <Star className="h-8 w-8 mx-auto text-white/[0.06] mb-3" />
              <p className="text-sm font-bold text-white/40">Sign in to see your reputation</p>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 text-white/10 animate-spin" /></div>
          )}

          {/* Community leaderboard */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[10px] font-black text-white/25 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Crown className="h-3 w-3 text-amber-400" /> Top Contributors</p>
            {membersLoading ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 text-white/10 animate-spin" /></div>
            ) : topMembers.length === 0 ? (
              <div className="text-center py-6">
                <Award className="h-7 w-7 mx-auto text-white/[0.06] mb-2" />
                <p className="text-[11px] text-white/20">No activity data yet — start posting to earn XP!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {topMembers.map((m, i) => {
                  const xp = m.posts * 8 + m.likes * 2;
                  return (
                    <div key={m.user_id} className={cn("flex items-center gap-2.5 p-2.5 rounded-xl border transition-all",
                      i === 0 ? "border-amber-500/15 bg-amber-500/[0.03]" : "border-white/[0.04] bg-white/[0.01]"
                    )}>
                      <div className="w-6 text-center shrink-0">
                        {i === 0 ? <span className="text-base">🥇</span> : i === 1 ? <span className="text-base">🥈</span> : i === 2 ? <span className="text-base">🥉</span> : <span className="text-[11px] font-bold text-white/20">#{i + 1}</span>}
                      </div>
                      <div className="w-8 h-8 rounded-full border border-white/[0.08] bg-white/[0.04] flex items-center justify-center overflow-hidden shrink-0">
                        {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-white/30">{m.username?.[0]?.toUpperCase() || "?"}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <button type="button" onClick={() => onOpenProfile(m.user_id)} className={cn("text-[11px] font-bold transition-colors truncate", i === 0 ? "text-amber-400" : "text-white/70 hover:text-og-cyan")}>
                          {m.username || "User"}
                        </button>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-white/20">{xp.toLocaleString()} XP</span>
                          <span className="text-[9px] text-white/10">·</span>
                          <span className="text-[9px] text-white/20">{m.posts} posts</span>
                        </div>
                      </div>
                      {/* XP progress bar */}
                      <div className="w-16 shrink-0">
                        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className={cn("h-full rounded-full", i === 0 ? "bg-amber-400" : "bg-og-cyan/40")}
                            style={{ width: `${Math.min(100, (xp / ((topMembers[0]?.posts * 8 + topMembers[0]?.likes * 2) || 1)) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* How to earn XP */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[10px] font-black text-white/25 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Zap className="h-3 w-3 text-og-lime" /> Earn XP in this Community</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: "Post quality content", xp: 8, emoji: "📝" },
                { label: "Get a like on your post", xp: 2, emoji: "❤️" },
                { label: "Write an article", xp: 20, emoji: "📖" },
                { label: "Join a Space", xp: 5, emoji: "🎙️" },
                { label: "Daily activity", xp: 10, emoji: "🔥" },
                { label: "Host a Space", xp: 25, emoji: "👑" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.015] border border-white/[0.04]">
                  <span className="text-sm">{item.emoji}</span>
                  <span className="text-[9px] text-white/30 flex-1 leading-tight">{item.label}</span>
                  <span className="text-[9px] font-black text-og-lime">+{item.xp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {filter === "settings" && canEditCommunity ? (
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

          <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <label className="text-[10px] text-white/20 uppercase tracking-wider mb-1 block">Community Bio Links</label>
                <p className="text-[11px] text-white/30">Add clickable titles to the community bio and choose a badge for each one.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditLinks(prev => [...prev, createCommunityLink()].slice(0, 8))}
                className="px-3 py-1.5 rounded-xl border border-og-cyan/20 bg-og-cyan/10 text-[10px] font-black uppercase tracking-widest text-og-cyan hover:bg-og-cyan/15 transition-colors"
              >
                Add Link
              </button>
            </div>
            {editLinks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/[0.08] px-3 py-4 text-[11px] text-white/30">
                No bio links yet. Add titles like X, Website, Docs, Instagram, or TikTok.
              </div>
            ) : (
              <div className="space-y-3">
                {editLinks.map((link, index) => {
                  const badgeMeta = getCommunityLinkBadge(link.badge);
                  return (
                    <div key={link.id} className="rounded-2xl border border-white/[0.06] bg-black/20 p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm", badgeMeta.className)}>{badgeMeta.emoji}</span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Link {index + 1}</p>
                            <p className="text-[11px] text-white/35 truncate">{link.title || "Untitled link"}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditLinks(prev => prev.filter(item => item.id !== link.id))}
                          className="rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest text-red-300/70 hover:bg-red-400/10 hover:text-red-300 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          value={link.title}
                          onChange={e => setEditLinks(prev => prev.map(item => item.id === link.id ? { ...item, title: e.target.value } : item))}
                          placeholder="Title shown in bio"
                          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-og-cyan/30"
                        />
                        <input
                          value={link.url}
                          onChange={e => setEditLinks(prev => prev.map(item => item.id === link.id ? { ...item, url: e.target.value } : item))}
                          placeholder="https://..."
                          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-og-cyan/30"
                        />
                      </div>
                      <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)] items-start">
                        <select
                          value={link.badge || DEFAULT_COMMUNITY_LINK_BADGE}
                          onChange={e => setEditLinks(prev => prev.map(item => item.id === link.id ? { ...item, badge: e.target.value } : item))}
                          className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-og-cyan/30"
                        >
                          {COMMUNITY_LINK_BADGES.map(badge => (
                            <option key={badge.key} value={badge.key}>{badge.emoji} {badge.label}</option>
                          ))}
                        </select>
                        <div className="flex flex-wrap gap-2">
                          {COMMUNITY_LINK_BADGES.slice(0, 30).map(badge => (
                            <button
                              key={`${link.id}-${badge.key}`}
                              type="button"
                              onClick={() => setEditLinks(prev => prev.map(item => item.id === link.id ? { ...item, badge: badge.key } : item))}
                              className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors", link.badge === badge.key ? badge.className : "border-white/[0.08] bg-white/[0.03] text-white/35 hover:text-white/70")}
                            >
                              <span>{badge.emoji}</span>
                              {badge.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button onClick={saveSettings} disabled={savingSettings}
            className="px-4 py-2 rounded-xl bg-og-cyan text-background text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50">
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
                    <Avatar url={m.avatar_url} name={m.username} size="sm" onClick={() => onOpenProfile(m.user_id)} />
                    <div className="flex-1 min-w-0">
                      <button type="button" onClick={() => onOpenProfile(m.user_id)} className="text-sm font-bold text-white hover:text-og-cyan transition-colors">{m.username || "User"}</button>
                      <span className={cn("ml-2 text-[8px] font-black px-1.5 py-0.5 rounded-full border",
                        m.role === "creator" ? "text-og-gold bg-og-gold/10 border-og-gold/20" : "text-og-cyan bg-og-cyan/10 border-og-cyan/20"
                      )}>{m.role === "creator" ? "OWNER" : "MOD"}</span>
                    </div>
                    {canManageModerators && m.role === "moderator" && (
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
                      <Avatar url={m.avatar_url} name={m.username} size="sm" onClick={() => onOpenProfile(m.user_id)} />
                      <button type="button" onClick={() => onOpenProfile(m.user_id)} className="text-sm text-white/60 flex-1 text-left hover:text-white transition-colors">{m.username || "User"}</button>
                      {canManageModerators && (
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
                <Avatar url={m.avatar_url} name={m.username} size="md" onClick={() => onOpenProfile(m.user_id)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => onOpenProfile(m.user_id)} className="text-sm font-bold text-white truncate hover:text-og-cyan transition-colors">{m.username || "User"}</button>
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
                {canManageModerators && m.role !== "creator" && (
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
              onOpenProfile={onOpenProfile}
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
   Token Safety Panel — on-demand CA analysis popup
   ═══════════════════════════════════════════════════════════════ */

interface SafetyData {
  symbol: string;
  name: string;
  priceUsd: number | null;
  change24h: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  chartUrl: string | null;
  score: number;
  flags: string[];
}

async function fetchSafetyData(ca: string): Promise<SafetyData | null> {
  try {
    const r = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${ca}`);
    if (!r.ok) return null;
    const pairs = await r.json();
    if (!Array.isArray(pairs) || pairs.length === 0) return null;
    const pair = pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    const liq = pair.liquidity?.usd ?? 0;
    const vol = pair.volume?.h24 ?? 0;
    const mc = pair.marketCap ?? pair.fdv ?? 0;
    const flags: string[] = [];
    let score = 100;
    if (liq < 10000) { flags.push("⚠️ Very low liquidity"); score -= 35; }
    else if (liq < 50000) { flags.push("⚠️ Low liquidity"); score -= 15; }
    if (mc > 0 && liq / mc < 0.02) { flags.push("⚠️ Liq/MC ratio < 2%"); score -= 20; }
    if (vol < 1000) { flags.push("⚠️ Almost no volume"); score -= 20; }
    if (pairs.length === 1) { flags.push("ℹ️ Single trading pair"); score -= 5; }
    if (score >= 80) flags.unshift("✅ Passes basic checks");
    return {
      symbol: pair.baseToken?.symbol || "???",
      name: pair.baseToken?.name || "Unknown",
      priceUsd: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
      change24h: pair.priceChange?.h24 ?? null,
      marketCapUsd: mc || null,
      liquidityUsd: liq || null,
      volume24hUsd: vol || null,
      chartUrl: pair.url || `https://dexscreener.com/solana/${ca}`,
      score: Math.max(0, score),
      flags,
    };
  } catch { return null; }
}

function TokenSafetyPanel({ ca, onClose }: { ca: string; onClose: () => void }) {
  const [data, setData] = useState<SafetyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSafetyData(ca).then(d => { setData(d); setLoading(false); });
  }, [ca]);

  const scoreColor = !data ? "text-white/30"
    : data.score >= 75 ? "text-green-400"
    : data.score >= 45 ? "text-yellow-400"
    : "text-red-400";

  const scoreBg = !data ? "bg-white/[0.04]"
    : data.score >= 75 ? "bg-green-500/10 border-green-500/20"
    : data.score >= 45 ? "bg-yellow-500/10 border-yellow-500/20"
    : "bg-red-500/10 border-red-500/20";

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-end justify-center sm:items-center px-4 pb-4 sm:pb-0"
      onClick={onClose}>
      <div className="bg-[#0a0a10] border border-white/[0.08] rounded-2xl w-full max-w-sm shadow-2xl p-4 space-y-3"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/30 font-mono truncate max-w-[200px]">{ca.slice(0, 8)}...{ca.slice(-6)}</p>
          </div>
          <button onClick={onClose} className="text-white/25 hover:text-white"><XIcon className="h-4 w-4" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-white/20" />
          </div>
        ) : !data ? (
          <p className="text-xs text-white/30 text-center py-6">Token not found on DexScreener</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-black text-white">{data.symbol}</p>
                <p className="text-xs text-white/30">{data.name}</p>
              </div>
              <div className={cn("px-3 py-1.5 rounded-xl border text-center", scoreBg)}>
                <p className={cn("text-xl font-black leading-none", scoreColor)}>{data.score}</p>
                <p className="text-[9px] text-white/30 mt-0.5">Safety</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Price", value: data.priceUsd != null ? (data.priceUsd < 0.0001 ? `$${data.priceUsd.toExponential(2)}` : `$${data.priceUsd.toPrecision(4)}`) : "—" },
                { label: "24h", value: data.change24h != null ? `${data.change24h > 0 ? "+" : ""}${data.change24h.toFixed(1)}%` : "—", color: data.change24h != null ? (data.change24h >= 0 ? "text-green-400" : "text-red-400") : "" },
                { label: "Market Cap", value: data.marketCapUsd ? (data.marketCapUsd >= 1e6 ? `$${(data.marketCapUsd / 1e6).toFixed(2)}M` : `$${(data.marketCapUsd / 1e3).toFixed(0)}K`) : "—" },
                { label: "Liquidity", value: data.liquidityUsd ? (data.liquidityUsd >= 1e6 ? `$${(data.liquidityUsd / 1e6).toFixed(2)}M` : `$${(data.liquidityUsd / 1e3).toFixed(0)}K`) : "—" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white/[0.03] rounded-xl p-2.5">
                  <p className="text-[10px] text-white/25">{label}</p>
                  <p className={cn("text-sm font-bold text-white mt-0.5", color)}>{value}</p>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              {data.flags.map((f, i) => <p key={i} className="text-[11px] text-white/50">{f}</p>)}
            </div>

            <div className="flex gap-2 pt-1">
              <a href={data.chartUrl || "#"} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2 rounded-xl bg-og-cyan/10 border border-og-cyan/20 text-og-cyan text-xs font-bold text-center hover:bg-og-cyan/20 transition-colors">
                📊 View Chart
              </a>
              <button onClick={() => { navigator.clipboard.writeText(ca); toast.success("CA copied"); }}
                className="flex-1 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/40 text-xs font-bold hover:bg-white/[0.08] transition-colors">
                📋 Copy CA
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Solana CA regex ── */
const SOL_CA_REGEX = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

function PostContentRenderer({ content }: { content: string }) {
  const [activeCa, setActiveCa] = useState<string | null>(null);

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(SOL_CA_REGEX.source, "g");

  while ((match = regex.exec(content)) !== null) {
    const ca = match[0];
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push(
      <button
        key={match.index}
        onClick={e => { e.stopPropagation(); setActiveCa(ca); }}
        className="inline font-mono text-og-cyan/80 hover:text-og-cyan hover:underline underline-offset-2 transition-colors text-[12px] bg-og-cyan/5 px-1 rounded"
        title="Click to analyze token"
      >
        {ca.slice(0, 6)}…{ca.slice(-4)}
      </button>
    );
    lastIndex = match.index + ca.length;
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));

  return (
    <>
      <span className="whitespace-pre-wrap">{parts}</span>
      {activeCa && <TokenSafetyPanel ca={activeCa} onClose={() => setActiveCa(null)} />}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Post Card — X/Twitter style
   ═══════════════════════════════════════════════════════════════ */

function PostCard({
  post, user, onClick, onOpenProfile, onUpdate, compact = false, canModerate = false, communityOwnerId, isGlobalAdmin = false, onPin
}: {
  post: Post;
  user: any;
  onClick?: () => void;
  onOpenProfile?: (userId?: string | null) => void;
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
  const canDelete = isOwner || canModerate || isGlobalAdmin || (communityOwnerId && user && user.id === communityOwnerId);
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

  const handleCopyPostLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(`${window.location.origin}?post=${post.id}`);
    setShowMenu(false);
    toast.success("Post link copied");
  };

  const handleOpenPost = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onClick?.();
  };

  return (
    <article data-post-id={post.id} className={cn("px-4 py-3 hover:bg-white/[0.015] transition-colors relative", post.is_pinned && "bg-og-cyan/[0.03]")}>
      {post.is_pinned && (
        <div className="flex items-center gap-1 ml-12 mb-1 text-[10px] text-white/20"><Pin className="h-3 w-3" /> Pinned</div>
      )}
      <div className="flex gap-3">
        <Avatar url={post.avatar_url} name={post.username} size="md" onClick={onOpenProfile ? (event) => {
          event.stopPropagation();
          onOpenProfile(post.user_id);
        } : undefined} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpenProfile?.(post.user_id);
              }}
              className="truncate text-sm font-bold text-white transition-colors hover:text-og-cyan"
            >
              {post.username || "Anonymous"}
            </button>
            <span className="text-xs text-white/15">·</span>
            <span className="text-xs text-white/15 shrink-0">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
            {isThread && <Badge className="text-[7px] bg-blue-500/10 text-blue-400 border-blue-500/20 ml-1">Thread</Badge>}
            {isArticle && <Badge className="text-[7px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 ml-1">Article</Badge>}
            {/* X cross-post badge */}
            {post.tweet_id && (
              <a href={post.tweet_url || `https://x.com/i/web/status/${post.tweet_id}`} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/[0.08] hover:bg-white/[0.15] transition-colors"
                title="View on X">
                <span className="text-[9px] font-black text-white/50">𝕏</span>
              </a>
            )}
            {/* Alpha call return badge */}
            {post.token_24h_return != null && (
              <span className={cn("ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border",
                post.token_24h_return >= 0
                  ? "bg-green-500/10 border-green-500/20 text-green-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              )}>
                {post.token_24h_return >= 0 ? "+" : ""}{post.token_24h_return.toFixed(0)}%
              </span>
            )}
            {/* OG Rank badge */}
            {post.og_rank && post.og_rank !== "Newcomer" && (
              <span className={cn("ml-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wide",
                post.og_rank === "Legend" ? "bg-og-gold/10 border-og-gold/25 text-og-gold" :
                post.og_rank === "OG" ? "bg-purple-500/10 border-purple-500/25 text-purple-400" :
                post.og_rank === "Alpha" ? "bg-og-cyan/10 border-og-cyan/25 text-og-cyan" :
                "bg-og-lime/10 border-og-lime/25 text-og-lime"
              )}>{post.og_rank}</span>
            )}
            <div className="ml-auto relative">
              <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className="p-1 rounded-full text-white/15 hover:text-white/40 hover:bg-white/[0.04] transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-7 z-50 bg-[#111] border border-white/[0.1] rounded-xl shadow-2xl py-1 min-w-[160px]"
                  onClick={e => e.stopPropagation()}>
                  <button onClick={handleOpenPost}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/60 hover:bg-white/[0.04] hover:text-white transition-colors">
                    <ExternalLink className="h-3.5 w-3.5" /> Open post
                  </button>
                  <button onClick={handleCopyPostLink}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/60 hover:bg-white/[0.04] hover:text-white transition-colors">
                    <Copy className="h-3.5 w-3.5" /> Copy link
                  </button>
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
          </div>
          {isArticle && post.article_title && <p className="text-base font-bold text-white mt-1 leading-tight">{post.article_title}</p>}
          {editing ? (
            <div className="mt-2" onClick={e => e.stopPropagation()}>
              <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                className="w-full bg-white/[0.04] border border-og-cyan/30 rounded-xl px-3 py-2 text-sm text-white resize-none outline-none min-h-[80px]" />
              <div className="flex items-center gap-2 mt-1.5">
                <button onClick={handleSaveEdit} disabled={saving}
                  className="px-3 py-1 rounded-lg bg-og-cyan text-background text-[10px] font-black uppercase disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => setEditing(false)} className="px-3 py-1 rounded-lg text-white/30 text-[10px] font-black uppercase hover:text-white/60">Cancel</button>
              </div>
            </div>
          ) : (
            <div className={cn("mt-1 text-sm text-white/70 leading-relaxed break-words", compact ? "line-clamp-3" : "line-clamp-6")}>
              <PostContentRenderer content={post.content} />
            </div>
          )}
          {isArticle && post.article_cover_url && (
            <div className="mt-2 rounded-xl overflow-hidden border border-white/[0.06]">
              <img src={post.article_cover_url} className="w-full aspect-[2/1] object-cover" alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}
          {/* Post badge */}
          {post.post_badge && (
            <div className="mt-1.5">
              <PostBadgeChip badge={post.post_badge} />
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
          {/* YouTube embed */}
          {post.youtube_id && (
            <div className="mt-2 rounded-xl overflow-hidden border border-white/[0.06]" onClick={e => e.stopPropagation()}>
              <YouTubeCard youtubeId={post.youtube_id} title={post.youtube_title} />
            </div>
          )}
          {/* X Space card */}
          {post.x_space_url && (
            <div className="mt-2" onClick={e => e.stopPropagation()}>
              <XSpaceCard url={post.x_space_url} title={post.x_space_title} isLive={!!post.x_space_live} />
            </div>
          )}
          {/* Link preview card */}
          {post.link_url && !post.youtube_id && !post.x_space_url && (
            <div className="mt-2" onClick={e => e.stopPropagation()}>
              <LinkPreviewCard
                url={post.link_url}
                title={post.link_title}
                description={post.link_description}
                imageUrl={post.link_image_url}
                faviconUrl={post.link_favicon_url}
                domain={post.link_domain}
              />
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
      <span className="text-[11px]">{count}</span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Post Detail — Full post with replies
   ═══════════════════════════════════════════════════════════════ */

function PostDetail({ post, user, onBack, onOpenProfile, isGlobalAdmin = false, canModerate = false }: { post: Post; user: any; onBack: () => void; onOpenProfile: (userId?: string | null) => void; isGlobalAdmin?: boolean; canModerate?: boolean }) {
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
          <Avatar url={post.avatar_url} name={post.username} size="lg" onClick={() => onOpenProfile(post.user_id)} />
          <div className="flex-1 min-w-0">
            <button type="button" onClick={() => onOpenProfile(post.user_id)} className="text-sm font-bold text-white hover:text-og-cyan transition-colors">{post.username || "Anonymous"}</button>
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
              }} className="px-3 py-1 rounded-lg bg-og-cyan text-background text-[10px] font-black uppercase">Save</button>
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
                  <Avatar url={tp.avatar_url} name={tp.username} size="sm" onClick={() => onOpenProfile(tp.user_id)} />
                  {/* Line going down to next post */}
                  {i < threadPosts.length - 1 && (
                    <div className="w-0.5 flex-1 bg-white/[0.08] mt-1 min-h-[12px]" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => onOpenProfile(tp.user_id)} className="text-[13px] font-bold text-white hover:text-og-cyan transition-colors">{tp.username}</button>
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
                <Avatar url={reply.avatar_url} name={reply.username} size="sm" onClick={() => onOpenProfile(reply.user_id)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => onOpenProfile(reply.user_id)} className="text-xs font-bold text-white hover:text-og-cyan transition-colors">{reply.username || "Anonymous"}</button>
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
   Compose Modal v2 — Rich Post Creation
   ═══════════════════════════════════════════════════════════════ */

/* ── YouTube URL parser ── */
function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch {}
  return null;
}

/* ── Link metadata fetcher (via allorigins proxy) ── */
async function fetchLinkMeta(url: string): Promise<{
  title: string | null; description: string | null;
  image: string | null; favicon: string | null; domain: string;
}> {
  const domain = (() => { try { return new URL(url).hostname.replace("www.", ""); } catch { return url; } })();
  const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(5000) });
    const json = await resp.json() as { contents?: string };
    const html = json.contents || "";
    const getMeta = (prop: string, attr: string = "content") => {
      const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+${attr}=["']([^"']+)["']`, "i"))
                || html.match(new RegExp(`<meta[^>]+${attr}=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"));
      return m ? m[1] : null;
    };
    const titleM = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return {
      title: getMeta("og:title") || getMeta("twitter:title") || (titleM ? titleM[1].trim() : null),
      description: getMeta("og:description") || getMeta("twitter:description") || getMeta("description"),
      image: getMeta("og:image") || getMeta("twitter:image"),
      favicon,
      domain,
    };
  } catch {
    return { title: null, description: null, image: null, favicon, domain };
  }
}

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
  // Rich media v2
  const [postBadge, setPostBadge] = useState("");
  const [showBadges, setShowBadges] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkMeta, setLinkMeta] = useState<{ title: string | null; description: string | null; image: string | null; favicon: string | null; domain: string } | null>(null);
  const [fetchingLink, setFetchingLink] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeId, setYoutubeId] = useState<string | null>(null);
  const [xSpaceUrl, setXSpaceUrl] = useState("");
  const [xSpaceTitle, setXSpaceTitle] = useState("");
  const [xSpaceLive, setXSpaceLive] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showYouTubeInput, setShowYouTubeInput] = useState(false);
  const [showXSpaceInput, setShowXSpaceInput] = useState(false);
  // X cross-post
  const [crossPostToX, setCrossPostToX] = useState(false);
  const [xConnected] = React.useState(() => {
    try { return !!localStorage.getItem("x_user"); } catch { return false; }
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("communities").select("id, name, icon").eq("is_active", true).neq("name", "SolTools Feed");
      setCommunities((data || []) as Community[]);
      if (!selectedCommunityId && data && data.length > 0) setSelectedCommunityId(data[0].id);
    })();
  }, []);

  const handleFetchLink = async () => {
    if (!linkUrl.trim()) return;
    setFetchingLink(true);
    const meta = await fetchLinkMeta(linkUrl.trim());
    setLinkMeta(meta);
    setFetchingLink(false);
  };

  const handleYouTubeUrl = (url: string) => {
    setYoutubeUrl(url);
    const id = parseYouTubeId(url);
    setYoutubeId(id);
  };

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

      const tokenFields = postType === "call" && tokenData ? {
        token_address: tokenData.address, token_symbol: tokenData.symbol, token_name: tokenData.name,
        token_logo_url: tokenData.logoUrl, token_price_usd: tokenData.priceUsd,
        token_change_24h: tokenData.change24h, token_market_cap_usd: tokenData.marketCapUsd,
        token_liquidity_usd: tokenData.liquidityUsd, token_volume_24h_usd: tokenData.volume24hUsd,
        token_pair_address: tokenData.pairAddress,
      } : {};

      const richFields = {
        post_badge: postBadge || null,
        link_url: linkUrl || null,
        link_title: linkMeta?.title || null,
        link_description: linkMeta?.description || null,
        link_image_url: linkMeta?.image || null,
        link_favicon_url: linkMeta?.favicon || null,
        link_domain: linkMeta?.domain || null,
        youtube_url: youtubeUrl || null,
        youtube_id: youtubeId || null,
        x_space_url: xSpaceUrl || null,
        x_space_title: xSpaceTitle || null,
        x_space_live: xSpaceLive,
      };

      // Determine X cross-post flag upfront
      const willCrossPost = crossPostToX && xConnected && postType !== "article";

      if (postType === "thread") {
        const { data: parent } = await supabase.from("community_posts").insert({
          community_id: selectedCommunityId, user_id: user.id, username, avatar_url: avatar,
          content: threadParts[0].trim(), post_type: "thread", tags: tagArr,
          image_url: imageUrl || null, video_url: videoUrl || null,
          is_x_post: willCrossPost || null,
          ...richFields,
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
          tags: tagArr, ...tokenFields,
          is_x_post: willCrossPost || null,
          ...richFields,
        });
      }

      if (willCrossPost) {
        const tweetText = postType === "thread"
          ? threadParts.filter(Boolean).join("\n\n")
          : content.trim();
        try {
          const { data: xResult, error: xError } = await supabase.functions.invoke("post-to-x", {
            body: {
              text: tweetText,
              imageUrl: imageUrl || null,
              videoUrl: videoUrl || null,
              linkUrl: linkUrl || null,
              youtubeUrl: youtubeUrl || null,
              chartUrl: (postType === "call" && tokenData?.chartUrl) ? tokenData.chartUrl : null,
            },
          });
          if (!xError && xResult?.tweetId) toast.success("Also posted to X 🐦");
          else if (xError) toast.error("OG post saved ✓ but X post failed");
        } catch {}
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
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-start justify-center pt-6 px-3 pb-6" onClick={onClose}>
      <div
        className="bg-[#080810] border border-white/[0.1] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-black"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 border-b border-white/[0.07] bg-[#080810]/95 backdrop-blur">
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-all">
            <XIcon className="h-4 w-4" />
          </button>
          <div className="flex-1" />
          {xConnected && postType !== "article" && (
            <button onClick={() => setCrossPostToX(v => !v)}
              className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-all mr-1",
                crossPostToX ? "bg-white/10 border-white/30 text-white" : "border-white/[0.08] text-white/25 hover:text-white/50")}>
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current shrink-0"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.213 5.567zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              {crossPostToX ? "Posting to X" : "Also post to X"}
            </button>
          )}
          <Button onClick={handlePost} disabled={posting || currentLen === 0}
            className="px-5 h-9 rounded-full text-xs font-black bg-og-cyan text-black hover:bg-og-cyan/90">
            {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : postType === "article" ? "Publish" : "Post"}
          </Button>
        </div>

        {/* ── Post type selector ── */}
        <div className="flex gap-1.5 px-4 pt-4 pb-2 overflow-x-auto scrollbar-hide">
          {([
            { id: "post" as const, icon: "📝", label: "Post" },
            { id: "thread" as const, icon: "🧵", label: "Thread" },
            { id: "article" as const, icon: "📰", label: "Article" },
            { id: "call" as const, icon: "📈", label: "Call" },
          ]).map(t => (
            <button key={t.id} onClick={() => setPostType(t.id)}
              className={cn("flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all",
                postType === t.id ? "bg-og-cyan/10 border-og-cyan/40 text-og-cyan" : "border-white/[0.07] text-white/25 hover:text-white/60 hover:border-white/20")}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {/* ── Community selector ── */}
        <div className="px-4 pb-3">
          <select value={selectedCommunityId} onChange={e => setSelectedCommunityId(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white/70 appearance-none outline-none focus:border-og-cyan/30">
            <option value="">Select community...</option>
            {communities.map(c => <option key={c.id} value={c.id}>{c.icon || ""} {c.name}</option>)}
          </select>
        </div>

        {/* ── Compose area ── */}
        <div className="px-4 pb-4 space-y-3">

          {/* Article header */}
          {postType === "article" && (
            <div className="space-y-2">
              {bannerUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-white/[0.08]">
                  <img src={bannerUrl} alt="" className="w-full aspect-[2.5/1] object-cover" />
                  <button onClick={() => setBannerUrl("")}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white/70 hover:text-white">
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <ImageUploadBtn onUploaded={setBannerUrl} label="Upload banner" className="w-full justify-center py-5 border-dashed" />
              )}
              <input type="text" placeholder="Article title..." value={articleTitle} onChange={e => setArticleTitle(e.target.value)}
                className="w-full bg-transparent text-xl font-bold text-white placeholder-white/20 outline-none border-b border-white/[0.06] pb-2" />
            </div>
          )}

          {/* Thread compose */}
          {postType === "thread" ? (
            <div className="space-y-2">
              {threadParts.map((part, i) => (
                <div key={i} className="flex gap-2">
                  <div className="flex flex-col items-center pt-2.5">
                    <div className="w-2 h-2 rounded-full bg-og-cyan/70" />
                    {i < threadParts.length - 1 && <div className="w-px flex-1 bg-og-cyan/10 mt-1" />}
                  </div>
                  <textarea value={part} onChange={e => { const next = [...threadParts]; next[i] = e.target.value; setThreadParts(next); }}
                    placeholder={i === 0 ? "Start your thread..." : `Part ${i + 1}...`} maxLength={2000}
                    className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 resize-none outline-none min-h-[80px] focus:border-og-cyan/30 transition-colors" />
                </div>
              ))}
              <button onClick={addThreadPart} className="ml-5 text-xs text-og-cyan/50 hover:text-og-cyan flex items-center gap-1 transition-colors">
                <Plus className="h-3 w-3" /> Add part ({threadParts.length}/20)
              </button>
            </div>
          ) : (
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder={postType === "article" ? "Write your article..." : "What's on your mind?"}
              maxLength={maxChars} rows={4}
              className="w-full bg-transparent text-sm text-white placeholder-white/25 resize-none outline-none min-h-[100px]" />
          )}

          {/* Token call input */}
          {postType === "call" && (
            <div>
              <label className="text-[10px] text-white/20 uppercase tracking-wider mb-1.5 block">Contract Address (CA)</label>
              <div className="flex gap-2">
                <input type="text" value={tokenAddress} onChange={e => setTokenAddress(e.target.value)}
                  placeholder="Solana token address..."
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
                  <div className="flex items-center gap-2 mb-1">
                    {tokenData.logoUrl && <img src={tokenData.logoUrl} className="w-6 h-6 rounded-full" alt="" />}
                    <span className="font-black text-white text-sm">{tokenData.symbol}</span>
                    <span className="text-[10px] text-white/30">{tokenData.name}</span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-white/40">
                    <span>Price: <span className="text-og-cyan font-mono">{fmtPrice(tokenData.priceUsd)}</span></span>
                    <span>MCap: <span className="text-og-cyan font-mono">{fmtCompact(tokenData.marketCapUsd)}</span></span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Image & Video ── */}
          {postType !== "article" && (
            <div className="space-y-2">
              {imageUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-white/[0.08]">
                  <img src={imageUrl} alt="Preview" className="w-full max-h-48 object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <button onClick={() => setImageUrl("")}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white/70 hover:text-white">
                    <XIcon className="h-3 w-3" />
                  </button>
                </div>
              ) : videoUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-white/[0.08] bg-black">
                  <video src={videoUrl} controls preload="metadata" className="w-full max-h-40 object-contain" />
                  <button onClick={() => setVideoUrl("")}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white/70 hover:text-white">
                    <XIcon className="h-3 w-3" />
                  </button>
                </div>
              ) : null}

              {/* Image & video attachment buttons */}
              {!imageUrl && !videoUrl && (
                <div className="grid grid-cols-2 gap-2">
                  {/* Image column */}
                  <div className="space-y-1.5">
                    <p className="text-[9px] text-white/20 uppercase tracking-widest font-bold">Image</p>
                    <input type="url" placeholder="Paste image URL..."
                      onBlur={e => { if (e.target.value.trim()) { setImageUrl(e.target.value.trim()); e.target.value = ""; } }}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-2.5 py-2 text-[11px] text-white/60 placeholder-white/15 outline-none focus:border-white/20" />
                    <ImageUploadBtn onUploaded={setImageUrl} label="📎 Upload image" className="w-full justify-center" />
                  </div>
                  {/* Video column */}
                  <div className="space-y-1.5">
                    <p className="text-[9px] text-white/20 uppercase tracking-widest font-bold">Video</p>
                    <input type="url" placeholder="Paste video URL..."
                      onBlur={e => { if (e.target.value.trim()) { setVideoUrl(e.target.value.trim()); e.target.value = ""; } }}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-2.5 py-2 text-[11px] text-white/60 placeholder-white/15 outline-none focus:border-white/20" />
                    <MediaUploadBtn accept="video/*" label="📎 Upload video" onUploaded={(url, type) => { if (type === "video") setVideoUrl(url); else setImageUrl(url); }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Article image ── */}
          {postType === "article" && (
            <div>
              <label className="text-[10px] text-white/20 uppercase tracking-wider mb-1.5 block">Article image</label>
              {imageUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-white/[0.08]">
                  <img src={imageUrl} alt="" className="w-full max-h-48 object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
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

          {/* ── YouTube embed ── */}
          {postType !== "article" && (
            <div>
              <button onClick={() => setShowYouTubeInput(v => !v)}
                className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-bold transition-all w-full",
                  youtubeId ? "border-red-500/30 bg-red-500/10 text-red-400" : showYouTubeInput ? "border-white/20 bg-white/[0.04] text-white/60" : "border-white/[0.07] text-white/25 hover:text-white/60 hover:border-white/20")}>
                <Play className="h-3.5 w-3.5" />
                {youtubeId ? "✓ YouTube attached" : "Embed YouTube video"}
                {showYouTubeInput && !youtubeId ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
              </button>
              {(showYouTubeInput || youtubeUrl) && (
                <div className="mt-2 flex gap-2">
                  <input type="url" value={youtubeUrl} onChange={e => handleYouTubeUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white/60 placeholder-white/15 outline-none focus:border-red-500/30" />
                  {youtubeUrl && <button onClick={() => { setYoutubeUrl(""); setYoutubeId(null); setShowYouTubeInput(false); }} className="text-white/30 hover:text-white/60"><XIcon className="h-4 w-4" /></button>}
                </div>
              )}
              {youtubeId && (
                <div className="mt-2 rounded-xl overflow-hidden border border-white/[0.06]">
                  <YouTubeCard youtubeId={youtubeId} />
                </div>
              )}
            </div>
          )}

          {/* ── X Space embed ── */}
          {postType !== "article" && (
            <div>
              <button onClick={() => setShowXSpaceInput(v => !v)}
                className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-bold transition-all w-full",
                  xSpaceUrl ? "border-white/30 bg-white/[0.06] text-white" : showXSpaceInput ? "border-white/20 bg-white/[0.04] text-white/60" : "border-white/[0.07] text-white/25 hover:text-white/60 hover:border-white/20")}>
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.213 5.567zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                {xSpaceUrl ? "✓ X Space attached" : "Share X Space"}
                {showXSpaceInput ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
              </button>
              {(showXSpaceInput || xSpaceUrl) && (
                <div className="mt-2 space-y-2">
                  <input type="url" value={xSpaceUrl} onChange={e => setXSpaceUrl(e.target.value)}
                    placeholder="https://x.com/i/spaces/..."
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white/60 placeholder-white/15 outline-none focus:border-white/30" />
                  <input type="text" value={xSpaceTitle} onChange={e => setXSpaceTitle(e.target.value)}
                    placeholder="Space title (optional)..."
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white/60 placeholder-white/15 outline-none" />
                  <label className="flex items-center gap-2 cursor-pointer" onClick={() => setXSpaceLive(v => !v)}>
                    <div className={cn("w-8 h-4 rounded-full transition-colors relative", xSpaceLive ? "bg-red-500" : "bg-white/10")}>
                      <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform", xSpaceLive ? "translate-x-4" : "translate-x-0.5")} />
                    </div>
                    <span className="text-[10px] text-white/40">Mark as LIVE</span>
                  </label>
                  {xSpaceUrl && <XSpaceCard url={xSpaceUrl} title={xSpaceTitle || null} isLive={xSpaceLive} />}
                </div>
              )}
            </div>
          )}

          {/* ── Link preview ── */}
          {postType !== "article" && !youtubeId && !xSpaceUrl && (
            <div>
              <button onClick={() => setShowLinkInput(v => !v)}
                className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-bold transition-all w-full",
                  linkUrl ? "border-og-cyan/30 bg-og-cyan/10 text-og-cyan" : showLinkInput ? "border-white/20 bg-white/[0.04] text-white/60" : "border-white/[0.07] text-white/25 hover:text-white/60 hover:border-white/20")}>
                <Link2 className="h-3.5 w-3.5" />
                {linkUrl ? "✓ Link preview attached" : "Attach link (auto-preview title)"}
                {showLinkInput ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
              </button>
              {(showLinkInput || linkUrl) && (
                <div className="mt-2 space-y-2">
                  <div className="flex gap-2">
                    <input type="url" value={linkUrl}
                      onChange={e => { setLinkUrl(e.target.value); setLinkMeta(null); }}
                      onKeyDown={e => { if (e.key === "Enter") handleFetchLink(); }}
                      placeholder="https://example.com/article..."
                      className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white/60 placeholder-white/15 outline-none focus:border-og-cyan/30" />
                    <button onClick={handleFetchLink} disabled={fetchingLink || !linkUrl}
                      className="px-3 py-2 rounded-xl bg-og-cyan/10 text-og-cyan text-xs font-bold hover:bg-og-cyan/20 disabled:opacity-40 transition-colors whitespace-nowrap">
                      {fetchingLink ? <Loader2 className="h-3 w-3 animate-spin" /> : "Preview"}
                    </button>
                    {linkUrl && <button onClick={() => { setLinkUrl(""); setLinkMeta(null); setShowLinkInput(false); }} className="text-white/30 hover:text-white/60"><XIcon className="h-4 w-4" /></button>}
                  </div>
                  {linkMeta && (
                    <LinkPreviewCard url={linkUrl} title={linkMeta.title} description={linkMeta.description}
                      imageUrl={linkMeta.image} faviconUrl={linkMeta.favicon} domain={linkMeta.domain} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Post Badge ── */}
          <div>
            <button onClick={() => setShowBadges(v => !v)}
              className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-bold transition-all w-full",
                postBadge ? "border-og-lime/30 bg-og-lime/10 text-og-lime" : showBadges ? "border-white/20 bg-white/[0.04] text-white/60" : "border-white/[0.07] text-white/25 hover:text-white/60 hover:border-white/20")}>
              <span>{postBadge ? POST_BADGES[postBadge]?.emoji || "🏷️" : "🏷️"}</span>
              {postBadge ? `Badge: ${POST_BADGES[postBadge]?.label || postBadge}` : "Add post badge"}
              {showBadges ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
            </button>
            {showBadges && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {postBadge && (
                  <button onClick={() => setPostBadge("")}
                    className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[9px] font-bold text-white/30 hover:text-white/60 transition-colors">
                    <XIcon className="h-2.5 w-2.5" /> Remove
                  </button>
                )}
                {Object.entries(POST_BADGES).map(([key, badge]) => (
                  <button key={key} onClick={() => { setPostBadge(key); setShowBadges(false); }}
                    className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all",
                      postBadge === key ? badge.className : "border-white/[0.08] text-white/35 hover:text-white/70 bg-white/[0.02]")}>
                    <span>{badge.emoji}</span>{badge.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tags */}
          <input type="text" placeholder="Tags (comma-separated)..." value={tags} onChange={e => setTags(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white/50 placeholder-white/15 outline-none" />

          <div className="flex items-center justify-between text-[10px] text-white/15">
            <span>{currentLen.toLocaleString()} / {maxChars.toLocaleString()} chars</span>
            {postType === "thread" && <span>{threadParts.length} parts</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   𝕏 Posts Feed — posts cross-posted from X
   ═══════════════════════════════════════════════════════════════ */

function XPostsFeed({ user, onSelectPost, onOpenProfile }: {
  user: any;
  onSelectPost?: (post: Post) => void;
  onOpenProfile?: (username: string) => void;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("community_posts")
      .select("*")
      .eq("is_x_post", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(40);
    setPosts((data || []) as Post[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-black border border-white/15 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.213 5.567zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        </div>
        <div>
          <h2 className="text-sm font-black text-white">𝕏 Cross-Posts</h2>
          <p className="text-[9px] text-white/25">Posts also shared to X</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-white/20" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center px-6">
          <div className="w-12 h-12 rounded-2xl border border-white/[0.08] flex items-center justify-center mb-3">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white/20"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.213 5.567zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </div>
          <p className="text-white/30 text-sm font-semibold">No X cross-posts yet</p>
          <p className="text-white/15 text-xs mt-1">When community members cross-post to X, they appear here</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {posts.map(p => (
            <PostCard key={p.id} post={p} user={user} onClick={() => onSelectPost?.(p)} onOpenProfile={onOpenProfile} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   𝕏 Spaces Community Feed
   ═══════════════════════════════════════════════════════════════ */

interface CommunityXSpace {
  id: string;
  space_url: string;
  space_title: string | null;
  host_username: string | null;
  host_avatar_url: string | null;
  is_live: boolean;
  scheduled_at: string | null;
  listener_count: number | null;
  created_at: string;
  user_id: string;
}

function XSpacesCommunityFeed({ user }: { user: any }) {
  const [spaces, setSpaces] = useState<CommunityXSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [spaceUrl, setSpaceUrl] = useState("");
  const [spaceTitle, setSpaceTitle] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const xUser = React.useMemo(() => {
    try { const s = localStorage.getItem("x_user"); return s ? JSON.parse(s) : null; } catch { return null; }
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("community_x_spaces")
      .select("*")
      .order("is_live", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    setSpaces((data || []) as CommunityXSpace[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!user) { toast.error("Sign in to share a Space"); return; }
    if (!spaceUrl.trim()) { toast.error("Paste a Space URL"); return; }
    setSubmitting(true);
    try {
      await supabase.from("community_x_spaces").insert({
        space_url: spaceUrl.trim(),
        space_title: spaceTitle.trim() || null,
        is_live: isLive,
        user_id: user.id,
        host_username: xUser?.username || null,
        host_avatar_url: xUser?.profile_image_url || null,
      });
      toast.success("Space shared!");
      setSpaceUrl(""); setSpaceTitle(""); setIsLive(false); setShowForm(false);
      load();
    } catch (e: any) {
      toast.error("Failed: " + (e.message || "Unknown error"));
    } finally { setSubmitting(false); }
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Radio className="h-3.5 w-3.5 text-violet-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-black text-white">X Spaces</h2>
          <p className="text-[9px] text-white/25">Live & scheduled community spaces</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-violet-400 hover:bg-violet-500/20 transition-colors">
          <Plus className="h-3 w-3" /> Share Space
        </button>
      </div>

      {/* Submit form */}
      {showForm && (
        <div className="px-4 py-4 border-b border-white/[0.06] bg-white/[0.01] space-y-2">
          {!xUser && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-xs text-white/40 text-center">
              Connect your X account in Settings to host spaces
            </div>
          )}
          <input type="url" value={spaceUrl} onChange={e => setSpaceUrl(e.target.value)}
            placeholder="https://x.com/i/spaces/..."
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white/70 placeholder-white/15 outline-none focus:border-violet-500/30" />
          <input type="text" value={spaceTitle} onChange={e => setSpaceTitle(e.target.value)}
            placeholder="Space title (e.g. Alpha calls this Friday at 8pm)..."
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white/70 placeholder-white/15 outline-none" />
          <label className="flex items-center gap-2 cursor-pointer" onClick={() => setIsLive(v => !v)}>
            <div className={cn("w-8 h-4 rounded-full transition-colors relative", isLive ? "bg-red-500" : "bg-white/10")}>
              <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform", isLive ? "translate-x-4" : "translate-x-0.5")} />
            </div>
            <span className="text-[11px] text-white/40">Currently LIVE</span>
          </label>
          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={submitting || !spaceUrl}
              className="flex-1 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 py-2 text-xs font-black disabled:opacity-50 hover:bg-violet-500/30 transition-colors">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Share Space"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 rounded-xl border border-white/[0.08] text-white/30 text-xs hover:text-white/60 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-white/20" />
        </div>
      ) : spaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center px-6">
          <div className="w-12 h-12 rounded-2xl border border-white/[0.08] flex items-center justify-center mb-3">
            <Radio className="h-5 w-5 text-white/15" />
          </div>
          <p className="text-white/30 text-sm font-semibold">No spaces yet</p>
          <p className="text-white/15 text-xs mt-1">Share an X Space link for the community to join</p>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          {/* Live spaces first */}
          {spaces.filter(s => s.is_live).length > 0 && (
            <div>
              <p className="text-[9px] text-red-400 uppercase tracking-widest font-black mb-2 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />Live Now
              </p>
              <div className="space-y-2">
                {spaces.filter(s => s.is_live).map(space => (
                  <SpaceCard key={space.id} space={space} />
                ))}
              </div>
            </div>
          )}
          {spaces.filter(s => !s.is_live).length > 0 && (
            <div>
              <p className="text-[9px] text-white/25 uppercase tracking-widest font-black mb-2">Scheduled / Past</p>
              <div className="space-y-2">
                {spaces.filter(s => !s.is_live).map(space => (
                  <SpaceCard key={space.id} space={space} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SpaceCard({ space }: { space: CommunityXSpace }) {
  const timeAgo = (() => {
    const diff = Date.now() - new Date(space.created_at).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "just now";
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  })();

  return (
    <a href={space.space_url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-violet-500/[0.05] to-transparent px-4 py-3.5 hover:border-violet-500/25 hover:bg-violet-500/[0.08] transition-all group">
      <div className="shrink-0 w-10 h-10 rounded-full bg-black border border-white/10 flex items-center justify-center overflow-hidden">
        {space.host_avatar_url
          ? <img src={space.host_avatar_url} className="w-full h-full object-cover" alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          : <Radio className="h-4 w-4 text-violet-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {space.is_live ? (
            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-red-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />LIVE
            </span>
          ) : (
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/25">X Space</span>
          )}
          {space.host_username && (
            <span className="text-[9px] text-white/25">@{space.host_username}</span>
          )}
          <span className="text-[9px] text-white/15 ml-auto">{timeAgo}</span>
        </div>
        <p className="text-sm font-semibold text-white truncate">{space.space_title || "Unnamed Space"}</p>
        <p className="text-[10px] text-white/25 mt-0.5 truncate">{space.space_url.replace("https://", "")}</p>
      </div>
      <div className="shrink-0 flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-violet-400 group-hover:border-violet-500/40 group-hover:bg-violet-500/15 transition-colors">
        <Headphones className="h-3 w-3" /> Join
      </div>
    </a>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Smart Money Feed
   ═══════════════════════════════════════════════════════════════ */

interface SmartWallet {
  id: string;
  address: string;
  label: string;
  tier: string;
  description: string | null;
  twitter_handle: string | null;
  avatar_url: string | null;
  win_rate: number | null;
  avg_return: number | null;
}

interface SmartActivity {
  id: string;
  wallet_address: string;
  tx_type: string | null;
  token_ca: string | null;
  token_symbol: string | null;
  token_name: string | null;
  amount_sol: number | null;
  amount_usd: number | null;
  return_pct: number | null;
  created_at: string;
}

function SmartMoneyFeed({ user }: { user: any }) {
  const [wallets, setWallets] = useState<SmartWallet[]>([]);
  const [activity, setActivity] = useState<SmartActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWallet, setActiveWallet] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [{ data: ws }, { data: acts }] = await Promise.all([
        supabase.from("og_smart_wallets").select("*").eq("is_active", true).order("created_at"),
        supabase.from("smart_wallet_activity").select("*").order("created_at", { ascending: false }).limit(50),
      ]);
      setWallets(ws || []);
      setActivity(acts || []);
      setLoading(false);
    }
    load();
  }, []);

  const filteredActivity = activeWallet
    ? activity.filter(a => a.wallet_address === activeWallet)
    : activity;

  const tierColor = (tier: string) => ({
    whale: "text-og-gold border-og-gold/30 bg-og-gold/10",
    kol: "text-purple-400 border-purple-400/30 bg-purple-400/10",
    alpha: "text-og-cyan border-og-cyan/30 bg-og-cyan/10",
    insider: "text-red-400 border-red-400/30 bg-red-400/10",
    dev: "text-og-lime border-og-lime/30 bg-og-lime/10",
  }[tier] || "text-white/40 border-white/10 bg-white/5");

  return (
    <div className="divide-y divide-white/[0.04]">
      {/* Header */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="h-4 w-4 text-og-lime" />
          <h2 className="text-sm font-black text-white uppercase tracking-wide">Smart Money Tracker</h2>
        </div>
        <p className="text-[11px] text-white/30">Track alpha wallets and whale activity in real time</p>
      </div>

      {/* Wallet pills */}
      <div className="px-4 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setActiveWallet(null)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap transition-all shrink-0",
              !activeWallet ? "border-og-lime/60 bg-og-lime/10 text-og-lime" : "border-white/[0.06] text-white/30 hover:text-white/50"
            )}>
            All Wallets
          </button>
          {wallets.map(w => (
            <button key={w.address} onClick={() => setActiveWallet(w.address === activeWallet ? null : w.address)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap transition-all shrink-0",
                activeWallet === w.address ? "border-og-cyan/60 bg-og-cyan/10 text-og-cyan" : "border-white/[0.06] text-white/30 hover:text-white/50"
              )}>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full border font-bold uppercase"
                style={{ color: "inherit", borderColor: "inherit" }}>{w.tier}</span>
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Wallet cards */}
      {wallets.length > 0 && (
        <div className="px-4 py-3 grid grid-cols-2 gap-2">
          {wallets.map(w => (
            <button key={w.address} onClick={() => setActiveWallet(w.address === activeWallet ? null : w.address)}
              className={cn("text-left p-3 rounded-xl border transition-all",
                activeWallet === w.address ? "border-og-cyan/30 bg-og-cyan/5" : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.10]"
              )}>
              <div className="flex items-center justify-between mb-1">
                <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full border font-bold uppercase", tierColor(w.tier))}>{w.tier}</span>
                {w.win_rate != null && <span className="text-[10px] text-og-lime font-bold">{w.win_rate.toFixed(0)}% W</span>}
              </div>
              <p className="text-xs font-bold text-white truncate">{w.label}</p>
              <p className="text-[10px] font-mono text-white/20 mt-0.5">{w.address.slice(0, 6)}…{w.address.slice(-4)}</p>
              {w.avg_return != null && (
                <p className="text-[10px] text-og-cyan mt-1">avg {w.avg_return >= 0 ? "+" : ""}{w.avg_return.toFixed(0)}%</p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Activity feed */}
      <div>
        <div className="px-4 py-2.5 flex items-center justify-between">
          <p className="text-[10px] text-white/25 uppercase tracking-wider font-semibold">
            {activeWallet ? "Wallet Activity" : "Recent Activity"} · {filteredActivity.length}
          </p>
          <Activity className="h-3.5 w-3.5 text-white/15" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-white/20" /></div>
        ) : filteredActivity.length === 0 ? (
          <div className="py-12 text-center">
            <Activity className="h-8 w-8 text-white/10 mx-auto mb-2" />
            <p className="text-sm text-white/20">No activity yet</p>
            <p className="text-[11px] text-white/10 mt-1">Activity will appear as wallets transact</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {filteredActivity.map(act => {
              const wallet = wallets.find(w => w.address === act.wallet_address);
              const isBuy = act.tx_type === "buy";
              const isSell = act.tx_type === "sell";
              const tokenCA = act.token_ca || act.token_address;
              const dexUrl = tokenCA ? `https://dexscreener.com/solana/${tokenCA}` : null;
              return (
                <div key={act.id} className="px-4 py-3.5 flex items-start gap-3 hover:bg-white/[0.015] transition-colors group">
                  {/* Tx icon */}
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 border",
                    isBuy ? "bg-green-500/10 border-green-500/20" : isSell ? "bg-red-500/10 border-red-500/20" : "bg-white/[0.04] border-white/[0.06]"
                  )}>
                    {isBuy ? "📈" : isSell ? "📉" : "💫"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-white">{wallet?.label || `${act.wallet_address.slice(0, 6)}…${act.wallet_address.slice(-4)}`}</span>
                      <span className={cn("text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border",
                        isBuy ? "text-green-400 border-green-500/20 bg-green-500/10" : isSell ? "text-red-400 border-red-500/20 bg-red-500/10" : "text-white/30 border-white/10 bg-white/5"
                      )}>{act.tx_type || "swap"}</span>
                      {act.token_symbol && (
                        <span className="text-[10px] text-og-cyan font-mono font-bold">${act.token_symbol}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {act.amount_usd != null && (
                        <span className="text-[11px] text-white/50 font-bold">
                          ${act.amount_usd >= 1000 ? `${(act.amount_usd / 1000).toFixed(1)}K` : act.amount_usd.toFixed(0)}
                        </span>
                      )}
                      {act.return_pct != null && (
                        <span className={cn("text-[11px] font-black", act.return_pct >= 0 ? "text-green-400" : "text-red-400")}>
                          {act.return_pct >= 0 ? "+" : ""}{act.return_pct.toFixed(1)}%
                        </span>
                      )}
                      {tokenCA && (
                        <div className="flex items-center gap-1.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(tokenCA); toast.success("CA copied!"); }}
                            className="text-white/20 hover:text-og-cyan p-1 rounded-md hover:bg-og-cyan/10 transition-colors"
                            title="Copy CA"
                          ><Copy className="h-3 w-3" /></button>
                          {dexUrl && (
                            <a href={dexUrl} target="_blank" rel="noreferrer"
                              className="text-white/20 hover:text-og-lime p-1 rounded-md hover:bg-og-lime/10 transition-colors"
                              title="View on DexScreener"
                            ><ExternalLink className="h-3 w-3" /></a>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {tokenCA && (
                        <span className="text-[9px] font-mono text-white/15">{tokenCA.slice(0, 8)}…{tokenCA.slice(-4)}</span>
                      )}
                      <span className="text-[9px] text-white/20 ml-auto">
                        {formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Alerts Hub — Price Alerts + Wallet Alerts + Notifications
   ═══════════════════════════════════════════════════════════════ */

interface PriceAlertRow {
  id: string;
  token_ca?: string;
  token_address?: string;
  token_symbol?: string;
  symbol?: string;
  target_price: number;
  direction?: string;
  condition?: string;
  is_active: boolean;
  fired_at?: string | null;
  triggered_at?: string | null;
  created_at: string;
}

interface WalletAlertRow {
  id: string;
  wallet_address: string | null;
  label: string | null;
  is_active: boolean;
  last_activity: string | null;
  created_at: string;
}

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body?: string;
  message?: string;
  is_read?: boolean;
  read_at?: string | null;
  created_at: string;
}

function AlertsHub({ user }: { user: any }) {
  const [tab, setTab] = useState<"notifications" | "price" | "wallet">("notifications");
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlertRow[]>([]);
  const [walletAlerts, setWalletAlerts] = useState<WalletAlertRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Add price alert form
  const [showAddPrice, setShowAddPrice] = useState(false);
  const [pCA, setPCA] = useState("");
  const [pSymbol, setPSymbol] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pDir, setPDir] = useState<"above" | "below">("above");
  const [savingP, setSavingP] = useState(false);

  // Add wallet alert form
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [wAddr, setWAddr] = useState("");
  const [wLabel, setWLabel] = useState("");
  const [savingW, setSavingW] = useState(false);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const [{ data: notifs }, { data: pa }, { data: wa }] = await Promise.all([
        supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("price_alerts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("wallet_alerts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setNotifications(notifs || []);
      setPriceAlerts(pa || []);
      setWalletAlerts(wa || []);
      setLoading(false);
    }
    load();
  }, [user]);

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`alerts-notifs-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, payload => {
        setNotifications(prev => [payload.new as NotificationRow, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.is_read && !n.read_at).length;

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", user.id).is("read_at", null);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
  };

  const addPriceAlert = async () => {
    if (!user) { toast.error("Sign in first"); return; }
    if (!pCA.trim() || !pPrice) { toast.error("Fill all fields"); return; }
    setSavingP(true);
    try {
      const { data, error } = await supabase.from("price_alerts").insert({
        user_id: user.id,
        token_address: pCA.trim(),
        symbol: pSymbol || null,
        target_price: parseFloat(pPrice),
        condition: pDir === "above" ? "above" : "below",
        direction: pDir,
        is_active: true,
      }).select().single();
      if (error) throw error;
      setPriceAlerts(prev => [data, ...prev]);
      setPCA(""); setPSymbol(""); setPPrice(""); setShowAddPrice(false);
      toast.success("Price alert set! 🔔");
    } catch (e: any) { toast.error(e.message || "Failed"); }
    setSavingP(false);
  };

  const deletePriceAlert = async (id: string) => {
    await supabase.from("price_alerts").delete().eq("id", id);
    setPriceAlerts(prev => prev.filter(a => a.id !== id));
    toast.success("Alert removed");
  };

  const addWalletAlert = async () => {
    if (!user) { toast.error("Sign in first"); return; }
    if (!wAddr.trim()) { toast.error("Wallet address required"); return; }
    setSavingW(true);
    try {
      const { data, error } = await supabase.from("wallet_alerts").insert({
        user_id: user.id,
        wallet_address: wAddr.trim(),
        label: wLabel || null,
        is_active: true,
      }).select().single();
      if (error) throw error;
      setWalletAlerts(prev => [data, ...prev]);
      setWAddr(""); setWLabel(""); setShowAddWallet(false);
      toast.success("Wallet alert added! 👁️");
    } catch (e: any) { toast.error(e.message || "Failed"); }
    setSavingW(false);
  };

  const deleteWalletAlert = async (id: string) => {
    await supabase.from("wallet_alerts").delete().eq("id", id);
    setWalletAlerts(prev => prev.filter(a => a.id !== id));
    toast.success("Wallet alert removed");
  };

  const notifIcon = (type: string) => ({
    price_alert: "💰", wallet_alert: "👁️", like: "❤️",
    reply: "💬", mention: "@", dm: "✉️",
  }[type] || "🔔");

  return (
    <div>
      {/* Header */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-white/[0.04]">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-og-cyan" />
            <h2 className="text-sm font-black text-white uppercase tracking-wide">Alerts & Notifications</h2>
          </div>
          <p className="text-[11px] text-white/30 mt-0.5">Price alerts, wallet watchers, activity feed</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-[10px] text-og-cyan hover:underline">Mark all read</button>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-white/[0.04]">
        {([
          { id: "notifications" as const, label: "Feed", badge: unreadCount },
          { id: "price" as const, label: "Price", badge: priceAlerts.filter(a => a.is_active).length },
          { id: "wallet" as const, label: "Wallets", badge: walletAlerts.length },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex-1 py-2.5 text-xs font-medium transition-colors relative flex items-center justify-center gap-1.5",
              tab === t.id ? "text-white" : "text-white/30 hover:text-white/50"
            )}>
            {t.label}
            {t.badge > 0 && (
              <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold",
                tab === t.id ? "bg-og-cyan/20 text-og-cyan" : "bg-white/[0.06] text-white/30"
              )}>{t.badge}</span>
            )}
            {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-og-cyan" />}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-white/20" /></div>
      ) : tab === "notifications" ? (
        <div className="divide-y divide-white/[0.03]">
          {notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="h-8 w-8 text-white/10 mx-auto mb-2" />
              <p className="text-sm text-white/20">No notifications yet</p>
            </div>
          ) : notifications.map(n => (
            <div key={n.id} className={cn(
              "px-4 py-3.5 flex items-start gap-3 transition-colors hover:bg-white/[0.015] cursor-default",
              !n.is_read && !n.read_at ? "bg-og-cyan/[0.03] border-l-2 border-og-cyan/40" : ""
            )}>
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 border",
                !n.is_read && !n.read_at ? "bg-og-cyan/10 border-og-cyan/20" : "bg-white/[0.04] border-white/[0.06]"
              )}>
                {notifIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-xs font-bold", !n.is_read && !n.read_at ? "text-white" : "text-white/70")}>{n.title}</p>
                {(n.body || n.message) && <p className="text-[11px] text-white/35 mt-0.5 leading-relaxed line-clamp-2">{n.body || n.message}</p>}
                <p className="text-[10px] text-white/20 mt-1.5">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
              </div>
              {!n.is_read && !n.read_at && (
                <div className="w-2.5 h-2.5 rounded-full bg-og-cyan shadow-[0_0_6px_rgba(34,211,238,0.6)] shrink-0 mt-1" />
              )}
            </div>
          ))}
        </div>
      ) : tab === "price" ? (
        <div>
          {showAddPrice ? (
            <div className="p-4 space-y-3 border-b border-white/[0.06] bg-white/[0.02]">
              <p className="text-xs font-bold text-white">New Price Alert</p>
              <input value={pCA} onChange={e => setPCA(e.target.value)} placeholder="Token contract address (CA)..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-white/20 outline-none focus:border-og-cyan/40" />
              <div className="flex gap-2">
                <input value={pSymbol} onChange={e => setPSymbol(e.target.value)} placeholder="Symbol (optional)"
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-og-cyan/40" />
                <input type="number" value={pPrice} onChange={e => setPPrice(e.target.value)} placeholder="Target $"
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-og-cyan/40" />
              </div>
              <div className="flex gap-2">
                {(["above", "below"] as const).map(d => (
                  <button key={d} onClick={() => setPDir(d)}
                    className={cn("flex-1 py-2 rounded-xl border text-xs font-medium capitalize transition-colors",
                      pDir === d ? "border-og-lime/40 bg-og-lime/10 text-og-lime" : "border-white/[0.06] text-white/30"
                    )}>
                    {d === "above" ? "📈 Above" : "📉 Below"} ${pPrice || "..."}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button onClick={addPriceAlert} disabled={savingP} className="flex-1 h-8 text-xs">
                  {savingP ? <Loader2 className="h-3 w-3 animate-spin" /> : "Set Alert"}
                </Button>
                <button onClick={() => setShowAddPrice(false)} className="px-4 py-2 rounded-xl text-white/30 text-xs hover:text-white/60">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddPrice(true)}
              className="w-full px-4 py-3 flex items-center gap-2 text-xs text-og-cyan hover:bg-og-cyan/5 transition-colors border-b border-white/[0.04]">
              <Plus className="h-4 w-4" /> Add Price Alert
            </button>
          )}
          <div className="divide-y divide-white/[0.03]">
            {priceAlerts.length === 0 ? (
              <div className="py-10 text-center">
                <AlertTriangle className="h-8 w-8 text-white/10 mx-auto mb-2" />
                <p className="text-sm text-white/20">No price alerts yet</p>
              </div>
            ) : priceAlerts.map(a => (
              <div key={a.id} className="px-4 py-3 flex items-center gap-3">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm",
                  (a.direction || a.condition) === "above" ? "bg-green-500/10" : "bg-red-500/10"
                )}>
                  {(a.direction || a.condition) === "above" ? "📈" : "📉"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">{a.token_symbol || a.symbol || "Token"}</span>
                    <span className="text-[10px] text-white/30">{a.direction || a.condition} ${a.target_price}</span>
                  </div>
                  <p className="text-[10px] font-mono text-white/20 mt-0.5">
                    {(a.token_ca || a.token_address || "").slice(0, 8)}…{(a.token_ca || a.token_address || "").slice(-4)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {a.is_active ? (
                    <span className="text-[9px] text-og-lime bg-og-lime/10 px-2 py-0.5 rounded-full">Active</span>
                  ) : (
                    <span className="text-[9px] text-white/25 bg-white/[0.04] px-2 py-0.5 rounded-full">Fired</span>
                  )}
                  <button onClick={() => deletePriceAlert(a.id)}
                    className="text-white/20 hover:text-red-400 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          {showAddWallet ? (
            <div className="p-4 space-y-3 border-b border-white/[0.06] bg-white/[0.02]">
              <p className="text-xs font-bold text-white">Watch a Wallet</p>
              <input value={wAddr} onChange={e => setWAddr(e.target.value)} placeholder="Solana wallet address..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-white/20 outline-none focus:border-og-cyan/40" />
              <input value={wLabel} onChange={e => setWLabel(e.target.value)} placeholder="Label (e.g. 'Ansem's wallet')"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-og-cyan/40" />
              <div className="flex gap-2">
                <Button onClick={addWalletAlert} disabled={savingW} className="flex-1 h-8 text-xs">
                  {savingW ? <Loader2 className="h-3 w-3 animate-spin" /> : "Start Watching"}
                </Button>
                <button onClick={() => setShowAddWallet(false)} className="px-4 py-2 rounded-xl text-white/30 text-xs hover:text-white/60">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddWallet(true)}
              className="w-full px-4 py-3 flex items-center gap-2 text-xs text-og-cyan hover:bg-og-cyan/5 transition-colors border-b border-white/[0.04]">
              <Plus className="h-4 w-4" /> Watch a Wallet
            </button>
          )}
          <div className="divide-y divide-white/[0.03]">
            {walletAlerts.length === 0 ? (
              <div className="py-10 text-center">
                <Wallet className="h-8 w-8 text-white/10 mx-auto mb-2" />
                <p className="text-sm text-white/20">No wallets tracked yet</p>
                <p className="text-[11px] text-white/15 mt-1">Add a wallet to get notified on activity</p>
              </div>
            ) : walletAlerts.map(a => (
              <div key={a.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-og-cyan/10 flex items-center justify-center text-sm shrink-0">👁️</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white">{a.label || "Unnamed wallet"}</p>
                  <p className="text-[10px] font-mono text-white/25 mt-0.5">
                    {(a.wallet_address || "").slice(0, 8)}…{(a.wallet_address || "").slice(-4)}
                  </p>
                  {a.last_activity && (
                    <p className="text-[10px] text-white/20 mt-0.5">
                      Last: {formatDistanceToNow(new Date(a.last_activity), { addSuffix: true })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[9px] px-2 py-0.5 rounded-full", a.is_active ? "bg-og-lime/10 text-og-lime" : "bg-white/[0.04] text-white/25")}>
                    {a.is_active ? "Watching" : "Paused"}
                  </span>
                  <button onClick={() => deleteWalletAlert(a.id)} className="text-white/20 hover:text-red-400 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Raids Hub — Community Raids 2.0
   ═══════════════════════════════════════════════════════════════ */

interface Raid {
  id: string;
  title: string | null;
  target_url: string | null;
  goal_likes: number;
  goal_reposts: number;
  goal_replies: number;
  current_likes: number;
  current_reposts: number;
  current_replies: number;
  participants: number;
  status: string;
  ends_at: string | null;
  tweet_id: string | null;
  created_at: string;
  community_id: string | null;
  created_by: string | null;
}

function RaidsHub({ user }: { user: any }) {
  const [raids, setRaids] = useState<Raid[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Form
  const [rTitle, setRTitle] = useState("");
  const [rUrl, setRUrl] = useState("");
  const [rGoalLikes, setRGoalLikes] = useState("100");
  const [rGoalReposts, setRGoalReposts] = useState("50");
  const [rEndsIn, setREndsIn] = useState("24");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("community_raids").select("*").order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => { setRaids(data || []); setLoading(false); });
  }, []);

  const createRaid = async () => {
    if (!user) { toast.error("Sign in first"); return; }
    if (!rTitle.trim() || !rUrl.trim()) { toast.error("Title and URL required"); return; }
    setSaving(true);
    try {
      const endsAt = new Date(Date.now() + parseInt(rEndsIn) * 3600 * 1000).toISOString();
      // Extract tweet ID from URL
      const tweetMatch = rUrl.match(/status\/(\d+)/);
      const tweetId = tweetMatch?.[1] || null;
      const { data, error } = await supabase.from("community_raids").insert({
        created_by: user.id,
        title: rTitle.trim(),
        target_url: rUrl.trim(),
        goal_likes: parseInt(rGoalLikes) || 100,
        goal_reposts: parseInt(rGoalReposts) || 50,
        goal_replies: 20,
        current_likes: 0, current_reposts: 0, current_replies: 0,
        participants: 0,
        status: "active",
        ends_at: endsAt,
        tweet_id: tweetId,
      }).select().single();
      if (error) throw error;
      setRaids(prev => [data, ...prev]);
      setRTitle(""); setRUrl(""); setShowCreate(false);
      toast.success("Raid launched! ⚔️");
    } catch (e: any) { toast.error(e.message || "Failed"); }
    setSaving(false);
  };

  const joinRaid = async (raid: Raid) => {
    if (!user) { toast.error("Sign in first"); return; }
    try {
      await supabase.from("raid_participants").insert({ raid_id: raid.id, user_id: user.id });
      await supabase.from("community_raids").update({ participants: (raid.participants || 0) + 1 }).eq("id", raid.id);
      setRaids(prev => prev.map(r => r.id === raid.id ? { ...r, participants: (r.participants || 0) + 1 } : r));
      // Open tweet in new tab
      if (raid.target_url) window.open(raid.target_url, "_blank");
      toast.success("Joined raid! Go engage! 🚀");
    } catch (e: any) {
      if ((e as any).code === "23505") { 
        if (raid.target_url) window.open(raid.target_url, "_blank");
      } else {
        toast.error("Failed to join");
      }
    }
  };

  const progress = (current: number, goal: number) => goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;

  return (
    <div>
      <div className="px-4 py-4 flex items-center justify-between border-b border-white/[0.04]">
        <div>
          <div className="flex items-center gap-2">
            <Swords className="h-4 w-4 text-red-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-wide">Community Raids</h2>
          </div>
          <p className="text-[11px] text-white/30 mt-0.5">Coordinate engagement raids on target posts</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/15 transition-colors">
          <Plus className="h-3.5 w-3.5" /> New Raid
        </button>
      </div>

      {showCreate && (
        <div className="p-4 space-y-3 border-b border-white/[0.06] bg-red-500/[0.02]">
          <p className="text-xs font-bold text-white">🎯 Launch a Raid</p>
          <input value={rTitle} onChange={e => setRTitle(e.target.value)} placeholder="Raid name..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-red-400/40" />
          <input value={rUrl} onChange={e => setRUrl(e.target.value)} placeholder="Target tweet URL..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-red-400/40" />
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Like goal", value: rGoalLikes, set: setRGoalLikes },
              { label: "Repost goal", value: rGoalReposts, set: setRGoalReposts },
              { label: "Duration (h)", value: rEndsIn, set: setREndsIn },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label className="text-[9px] text-white/25 uppercase tracking-wider block mb-1">{label}</label>
                <input type="number" value={value} onChange={e => set(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-2.5 py-2 text-xs text-white outline-none focus:border-red-400/40" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={createRaid} disabled={saving} className="flex-1 h-8 text-xs bg-red-500/80 hover:bg-red-500 text-white">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "⚔️ Launch Raid"}
            </Button>
            <button onClick={() => setShowCreate(false)} className="px-4 text-white/30 text-xs hover:text-white/60">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-white/20" /></div>
      ) : raids.length === 0 ? (
        <div className="py-12 text-center">
          <Swords className="h-8 w-8 text-white/10 mx-auto mb-2" />
          <p className="text-sm text-white/20">No active raids</p>
          <p className="text-[11px] text-white/10 mt-1">Launch a raid to coordinate community engagement</p>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          {raids.map(raid => {
            const likePct = progress(raid.current_likes, raid.goal_likes);
            const repostPct = progress(raid.current_reposts, raid.goal_reposts);
            const isActive = raid.status === "active";
            const endsIn = raid.ends_at ? new Date(raid.ends_at).getTime() - Date.now() : null;
            const expired = endsIn != null && endsIn < 0;
            const totalProgress = Math.round((likePct + repostPct) / 2);

            // Format countdown
            let countdown = "";
            if (!expired && endsIn != null) {
              const h = Math.floor(endsIn / 3600000);
              const m = Math.floor((endsIn % 3600000) / 60000);
              countdown = h > 0 ? `${h}h ${m}m` : `${m}m`;
            }

            return (
              <div key={raid.id} className={cn("rounded-2xl border p-4 space-y-3 transition-all",
                isActive && !expired
                  ? "border-red-500/20 bg-red-500/[0.03] hover:border-red-500/30"
                  : "border-white/[0.06] bg-white/[0.02]"
              )}>
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border",
                    isActive && !expired ? "bg-red-500/15 border-red-500/25" : "bg-white/[0.04] border-white/[0.06]"
                  )}>
                    {isActive && !expired ? "⚔️" : "🏁"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-black text-white">{raid.title || "Unnamed Raid"}</p>
                      {isActive && !expired && (
                        <span className="text-[8px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest animate-pulse">
                          LIVE
                        </span>
                      )}
                      {expired && (
                        <span className="text-[8px] bg-white/[0.06] text-white/30 px-1.5 py-0.5 rounded-full font-black uppercase">ENDED</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-white/25 flex items-center gap-1">
                        <Users className="h-3 w-3" /> {raid.participants || 0} raiders
                      </span>
                      {countdown && (
                        <span className="text-[10px] text-orange-400/70 flex items-center gap-1 font-bold">
                          <Clock className="h-3 w-3" /> {countdown} left
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {/* Total progress ring */}
                    <span className={cn("text-[11px] font-black px-2 py-1 rounded-lg",
                      totalProgress >= 75 ? "text-og-lime bg-og-lime/10" : totalProgress >= 50 ? "text-og-gold bg-og-gold/10" : "text-white/40 bg-white/[0.04]"
                    )}>{totalProgress}%</span>
                    <button onClick={() => joinRaid(raid)}
                      disabled={expired || !isActive}
                      className={cn("px-3 py-1.5 rounded-xl text-xs font-black transition-all",
                        isActive && !expired
                          ? "bg-red-500/20 border border-red-500/35 text-red-400 hover:bg-red-500/30 hover:scale-105 active:scale-95"
                          : "bg-white/[0.04] border border-white/[0.06] text-white/20 cursor-not-allowed"
                      )}>
                      {isActive && !expired ? "🚀 Raid" : "✓"}
                    </button>
                  </div>
                </div>

                {/* Progress bars */}
                <div className="space-y-2">
                  {[
                    { label: "❤️ Likes", current: raid.current_likes || 0, goal: raid.goal_likes, pct: likePct, color: "bg-red-400" },
                    { label: "🔁 Reposts", current: raid.current_reposts || 0, goal: raid.goal_reposts, pct: repostPct, color: "bg-og-lime" },
                    ...(raid.goal_replies ? [{ label: "💬 Replies", current: raid.current_replies || 0, goal: raid.goal_replies, pct: progress(raid.current_replies || 0, raid.goal_replies), color: "bg-og-cyan" }] : []),
                  ].map(bar => (
                    <div key={bar.label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-white/30">{bar.label}</span>
                        <span className="text-[10px] font-bold text-white/40">{bar.current.toLocaleString()} / {bar.goal.toLocaleString()}</span>
                      </div>
                      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-700", bar.color)} style={{ width: `${bar.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {raid.target_url && (
                  <a href={raid.target_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[10px] text-og-cyan/60 hover:text-og-cyan hover:border-og-cyan/20 transition-colors">
                    <ExternalLink className="h-3 w-3" /> View target post
                    <ArrowRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DMs Hub — stub (DirectMessages.tsx handles the full UI)
   ═══════════════════════════════════════════════════════════════ */

function DMsHub({ user }: { user: any }) {
  return (
    <div className="px-4 py-12 text-center">
      <MessageSquare className="h-8 w-8 text-og-cyan/30 mx-auto mb-3" />
      <p className="text-sm text-white/30">Direct Messages are available via the DMs section in the main nav.</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Advanced Create Community Modal — 4-step wizard
   ═══════════════════════════════════════════════════════════════ */

const COMMUNITY_CATEGORIES = [
  { id: "meme", label: "Meme Coins", icon: "🐸" },
  { id: "alpha", label: "Alpha Calls", icon: "⚡" },
  { id: "defi", label: "DeFi", icon: "🏦" },
  { id: "nft", label: "NFTs", icon: "🎨" },
  { id: "trading", label: "Trading", icon: "📈" },
  { id: "gaming", label: "Gaming", icon: "🎮" },
  { id: "education", label: "Education", icon: "📚" },
  { id: "degen", label: "Degen Zone", icon: "💀" },
  { id: "dao", label: "DAO / Gov", icon: "🗳️" },
  { id: "other", label: "Other", icon: "🌐" },
];

const COMMUNITY_ICONS = ["🚀", "💎", "🔥", "📈", "🐸", "🤖", "⚡", "🎯", "🏆", "🌙", "💰", "🎮", "👑", "🦁", "🐉", "🌊", "🧠", "💥", "🎪", "🛸"];

const PRESET_RULES = [
  "No spam or self-promotion without approval",
  "Verified contract addresses only — no rugpulls",
  "DYOR — nothing posted here is financial advice",
  "Respect all members regardless of bag size",
  "No doxxing, harassment, or personal attacks",
  "Alpha stays in the community — don't leak outside",
];

function CreateCommunityModal({
  user, onClose, onCreated
}: {
  user: any;
  onClose: () => void;
  onCreated: (c: Community) => void;
}) {
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 4;

  // Step 1 — Identity
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("meme");
  const [icon, setIcon] = useState("🚀");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // Step 2 — Appearance
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [accentColor, setAccentColor] = useState("#00ffcc");

  // Step 3 — Settings
  const [privacy, setPrivacy] = useState<"public" | "private" | "invite">("public");
  const [tokenGateEnabled, setTokenGateEnabled] = useState(false);
  const [tokenGateCA, setTokenGateCA] = useState("");
  const [tokenGateMin, setTokenGateMin] = useState("1000");
  const [rules, setRules] = useState<string[]>([]);
  const [customRule, setCustomRule] = useState("");
  const [slowModeSeconds, setSlowModeSeconds] = useState(0);
  const [nsfw, setNsfw] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Step 4 — Links & Socials
  const [website, setWebsite] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [telegram, setTelegram] = useState("");
  const [discord, setDiscord] = useState("");
  const [amaSchedule, setAmaSchedule] = useState("");
  const [qualityFocus, setQualityFocus] = useState("");

  const [creating, setCreating] = useState(false);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (t && tags.length < 8 && !tags.includes(t)) { setTags([...tags, t]); setTagInput(""); }
  };

  const toggleRule = (r: string) => setRules(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);

  const canProceed = () => {
    if (step === 1) return name.trim().length >= 3;
    return true;
  };

  const handleCreate = async () => {
    if (!user) { toast.error("Sign in first"); return; }
    if (!name.trim()) { toast.error("Name required"); return; }
    setCreating(true);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: profile } = await supabase.from("profiles")
        .select("username, avatar_url").eq("user_id", user.id).maybeSingle();

      const links: CommunityExternalLink[] = [];
      if (website) links.push({ id: "website", title: "Website", url: website });
      if (xHandle) links.push({ id: "x", title: "X / Twitter", url: `https://x.com/${xHandle.replace("@", "")}`, badge: "X" });
      if (telegram) links.push({ id: "tg", title: "Telegram", url: telegram.startsWith("http") ? telegram : `https://t.me/${telegram.replace("@", "")}`, badge: "TG" });
      if (discord) links.push({ id: "dc", title: "Discord", url: discord, badge: "DC" });

      const allRules = [...rules, ...(customRule.trim() ? [customRule.trim()] : [])];

      const insertPayload: Record<string, any> = {
        name: name.trim(),
        description: description.trim() || null,
        icon,
        privacy: privacy === "invite" ? "private" : privacy,
        category,
        tags: tags.length > 0 ? tags : null,
        rules: allRules.length > 0 ? allRules.join("\n") : null,
        weekly_ama_schedule: amaSchedule.trim() || null,
        quality_focus: qualityFocus.trim() || null,
        created_by: user.id,
        creator_name: profile?.username || user.email?.split("@")[0],
        creator_avatar: profile?.avatar_url,
        invite_code: code,
        is_active: true,
        member_count: 1,
        avatar_url: avatarUrl || null,
        banner_url: bannerUrl || null,
        community_links: links.length > 0 ? links : null,
      };

      if (tokenGateEnabled && tokenGateCA.trim()) {
        insertPayload.research_hub_summary = JSON.stringify({
          token_gate: { ca: tokenGateCA.trim(), min_amount: parseFloat(tokenGateMin) || 0 }
        });
      }

      const { data, error } = await supabase.from("communities").insert(insertPayload).select().single();
      if (error) throw error;
      await supabase.from("community_members").insert({ community_id: data.id, user_id: user.id, role: "creator" });
      toast.success("Community launched! 🚀");
      onCreated(data as Community);
    } catch (e: any) { toast.error("Failed: " + (e.message || "Unknown error")); }
    finally { setCreating(false); }
  };

  const stepLabels = ["Identity", "Appearance", "Settings", "Links"];

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center px-4">
      <div className="bg-[#08080e] border border-white/[0.08] rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] shrink-0">
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors"><XIcon className="h-5 w-5" /></button>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white">Create Community</h3>
            <p className="text-[11px] text-white/25 mt-0.5">Step {step} of {TOTAL_STEPS} — {stepLabels[step - 1]}</p>
          </div>
          {step === TOTAL_STEPS ? (
            <Button onClick={handleCreate} disabled={creating || !name.trim()}
              className="h-8 px-5 rounded-full text-xs font-bold bg-og-lime text-black hover:bg-og-lime/90">
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : "🚀 Launch"}
            </Button>
          ) : (
            <Button onClick={() => canProceed() && setStep(s => s + 1)}
              disabled={!canProceed()}
              className="h-8 px-5 rounded-full text-xs font-bold">
              Next →
            </Button>
          )}
        </div>

        {/* ── Progress bar ── */}
        <div className="flex gap-1 px-5 pt-3 shrink-0">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <button key={i} onClick={() => i < step - 1 && setStep(i + 1)}
              className={cn("h-1 flex-1 rounded-full transition-all",
                i < step ? "bg-og-lime" : i === step - 1 ? "bg-og-lime/60" : "bg-white/[0.08]"
              )} />
          ))}
        </div>

        {/* ── Step content ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* ───── Step 1: Identity ───── */}
          {step === 1 && (
            <>
              <div>
                <label className="text-[10px] text-white/25 uppercase tracking-wider mb-1.5 block font-semibold">Community Name *</label>
                <input
                  autoFocus
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Degen Alpha Den"
                  maxLength={50}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-og-cyan/40 transition-colors"
                />
                <div className="flex justify-between mt-1">
                  {name.trim().length < 3 && name.length > 0 && <p className="text-[10px] text-red-400">Min 3 characters</p>}
                  <span className="text-[10px] text-white/20 ml-auto">{name.length}/50</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/25 uppercase tracking-wider mb-1.5 block font-semibold">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What's this community about? What kind of content will be shared here?"
                  maxLength={500}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none resize-none h-24 focus:border-og-cyan/40 transition-colors"
                />
                <p className="text-[10px] text-white/15 text-right mt-0.5">{description.length}/500</p>
              </div>

              <div>
                <label className="text-[10px] text-white/25 uppercase tracking-wider mb-2 block font-semibold">Category</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {COMMUNITY_CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={() => setCategory(cat.id)}
                      className={cn("flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all",
                        category === cat.id
                          ? "border-og-cyan/60 bg-og-cyan/10 text-white"
                          : "border-white/[0.05] bg-white/[0.02] text-white/30 hover:border-white/[0.12] hover:text-white/50"
                      )}>
                      <span className="text-base leading-none">{cat.icon}</span>
                      <span className="text-[9px] font-medium leading-tight">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/25 uppercase tracking-wider mb-2 block font-semibold">Emoji Icon</label>
                <div className="flex gap-1.5 flex-wrap">
                  {COMMUNITY_ICONS.map(i => (
                    <button key={i} onClick={() => setIcon(i)}
                      className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all",
                        icon === i ? "bg-og-cyan/15 border-2 border-og-cyan/80 scale-110" : "bg-white/[0.04] border border-transparent hover:bg-white/[0.07]"
                      )}>{i}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/25 uppercase tracking-wider mb-1.5 block font-semibold">Tags <span className="text-white/15 normal-case">(up to 8)</span></label>
                <div className="flex gap-2">
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())}
                    placeholder="solana, meme, alpha..."
                    className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-og-cyan/40 transition-colors"
                  />
                  <button onClick={addTag} className="px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/50 text-sm hover:bg-white/[0.10] transition-colors">Add</button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tags.map(t => (
                      <span key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-og-cyan/10 border border-og-cyan/20 text-og-cyan text-xs">
                        #{t}
                        <button onClick={() => setTags(tags.filter(x => x !== t))} className="text-og-cyan/50 hover:text-og-cyan ml-0.5"><XIcon className="h-2.5 w-2.5" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ───── Step 2: Appearance ───── */}
          {step === 2 && (
            <>
              {/* Banner */}
              <div>
                <label className="text-[10px] text-white/25 uppercase tracking-wider mb-2 block font-semibold">Banner Image</label>
                {bannerUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-white/[0.08] group">
                    <img src={bannerUrl} className="w-full aspect-[3/1] object-cover" alt="" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <ImageUploadBtn onUploaded={setBannerUrl} label="Replace" />
                      <button onClick={() => setBannerUrl("")}
                        className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-xs hover:bg-red-500/30 transition-colors">
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <ImageUploadBtn onUploaded={setBannerUrl} label="Upload banner (recommended 1500×500)" className="w-full justify-center py-8 border-dashed rounded-xl" />
                )}
              </div>

              {/* Avatar */}
              <div>
                <label className="text-[10px] text-white/25 uppercase tracking-wider mb-2 block font-semibold">Community Logo</label>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {avatarUrl ? (
                      <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/10 group">
                        <img src={avatarUrl} className="w-full h-full object-cover" alt="" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button onClick={() => setAvatarUrl("")} className="text-white/70"><XIcon className="h-5 w-5" /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-white/[0.04] border-2 border-dashed border-white/[0.10] flex items-center justify-center text-3xl">
                        {icon}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <ImageUploadBtn onUploaded={setAvatarUrl} label="Upload logo" />
                    <p className="text-[10px] text-white/20 mt-1.5">If no logo, the emoji icon will be used.</p>
                  </div>
                </div>
              </div>

              {/* Preview card */}
              <div>
                <label className="text-[10px] text-white/25 uppercase tracking-wider mb-2 block font-semibold">Preview</label>
                <div className="rounded-xl border border-white/[0.06] overflow-hidden bg-white/[0.02]">
                  {bannerUrl ? (
                    <div className="w-full aspect-[4/1] overflow-hidden">
                      <img src={bannerUrl} className="w-full h-full object-cover" alt="" />
                    </div>
                  ) : (
                    <div className="w-full aspect-[4/1] bg-gradient-to-r from-og-cyan/10 via-purple-500/10 to-og-lime/10" />
                  )}
                  <div className="px-4 pb-3 -mt-5 flex items-end gap-3">
                    <div className="w-12 h-12 rounded-xl border-2 border-[#08080e] overflow-hidden bg-[#0a0a10] shrink-0 flex items-center justify-center text-2xl">
                      {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" alt="" /> : icon}
                    </div>
                    <div className="pb-0.5 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{name || "Community Name"}</p>
                      <p className="text-[10px] text-white/30">{COMMUNITY_CATEGORIES.find(c => c.id === category)?.label}</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ───── Step 3: Settings ───── */}
          {step === 3 && (
            <>
              {/* Privacy */}
              <div>
                <label className="text-[10px] text-white/25 uppercase tracking-wider mb-2 block font-semibold">Privacy</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: "public", icon: "🌐", label: "Public", desc: "Anyone can join" },
                    { id: "private", icon: "🔒", label: "Private", desc: "Approval required" },
                    { id: "invite", icon: "📩", label: "Invite Only", desc: "Link required" },
                  ] as const).map(p => (
                    <button key={p.id} onClick={() => setPrivacy(p.id)}
                      className={cn("p-3 rounded-xl border text-left transition-all",
                        privacy === p.id ? "border-og-cyan/60 bg-og-cyan/10" : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                      )}>
                      <div className="text-lg mb-1">{p.icon}</div>
                      <div className="text-xs font-bold text-white">{p.label}</div>
                      <div className="text-[10px] text-white/30 mt-0.5">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Token gate */}
              <div className="rounded-xl border border-white/[0.06] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white">Token Gate</p>
                    <p className="text-[10px] text-white/30 mt-0.5">Require holding a token to join</p>
                  </div>
                  <button onClick={() => setTokenGateEnabled(!tokenGateEnabled)}
                    className={cn("w-10 h-5 rounded-full transition-all relative",
                      tokenGateEnabled ? "bg-og-lime" : "bg-white/[0.10]"
                    )}>
                    <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow",
                      tokenGateEnabled ? "right-0.5" : "left-0.5"
                    )} />
                  </button>
                </div>
                {tokenGateEnabled && (
                  <div className="space-y-2 pt-1 border-t border-white/[0.05]">
                    <div>
                      <label className="text-[10px] text-white/25 uppercase tracking-wider mb-1 block">Token Contract Address</label>
                      <input value={tokenGateCA} onChange={e => setTokenGateCA(e.target.value)}
                        placeholder="Solana CA..."
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-white/20 outline-none focus:border-og-cyan/40" />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/25 uppercase tracking-wider mb-1 block">Minimum Holding</label>
                      <input type="number" value={tokenGateMin} onChange={e => setTokenGateMin(e.target.value)}
                        placeholder="1000"
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-og-cyan/40" />
                    </div>
                  </div>
                )}
              </div>

              {/* Community Rules */}
              <div>
                <label className="text-[10px] text-white/25 uppercase tracking-wider mb-2 block font-semibold">Community Rules</label>
                <div className="space-y-1.5 mb-2">
                  {PRESET_RULES.map(r => (
                    <button key={r} onClick={() => toggleRule(r)}
                      className={cn("w-full text-left px-3 py-2.5 rounded-xl border text-xs transition-all flex items-start gap-2",
                        rules.includes(r)
                          ? "border-og-lime/30 bg-og-lime/[0.07] text-white"
                          : "border-white/[0.05] bg-white/[0.02] text-white/35 hover:text-white/55 hover:border-white/[0.10]"
                      )}>
                      <span className={cn("w-4 h-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center text-[9px]",
                        rules.includes(r) ? "border-og-lime bg-og-lime/20 text-og-lime" : "border-white/20"
                      )}>
                        {rules.includes(r) && "✓"}
                      </span>
                      {r}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={customRule} onChange={e => setCustomRule(e.target.value)}
                    placeholder="Add a custom rule..."
                    className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-og-cyan/40" />
                </div>
              </div>

              {/* Extra settings */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div>
                    <p className="text-xs font-medium text-white/60">Slow Mode</p>
                    <p className="text-[10px] text-white/25">Limit post frequency</p>
                  </div>
                  <select value={slowModeSeconds} onChange={e => setSlowModeSeconds(Number(e.target.value))}
                    className="bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white/60 outline-none">
                    <option value={0}>Off</option>
                    <option value={30}>30s</option>
                    <option value={60}>1 min</option>
                    <option value={300}>5 min</option>
                    <option value={3600}>1 hour</option>
                  </select>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div>
                    <p className="text-xs font-medium text-white/60">Wallet Verified Members Only</p>
                    <p className="text-[10px] text-white/25">Posts only from verified wallets</p>
                  </div>
                  <button onClick={() => setVerifiedOnly(!verifiedOnly)}
                    className={cn("w-10 h-5 rounded-full transition-all relative", verifiedOnly ? "bg-og-cyan" : "bg-white/[0.10]")}>
                    <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow", verifiedOnly ? "right-0.5" : "left-0.5")} />
                  </button>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div>
                    <p className="text-xs font-medium text-white/60">NSFW Content</p>
                    <p className="text-[10px] text-white/25">Allow explicit content</p>
                  </div>
                  <button onClick={() => setNsfw(!nsfw)}
                    className={cn("w-10 h-5 rounded-full transition-all relative", nsfw ? "bg-red-500/80" : "bg-white/[0.10]")}>
                    <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow", nsfw ? "right-0.5" : "left-0.5")} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ───── Step 4: Links & Socials ───── */}
          {step === 4 && (
            <>
              <div className="space-y-3">
                {[
                  { label: "Website", value: website, set: setWebsite, placeholder: "https://yoursite.com", icon: "🌐" },
                  { label: "X / Twitter", value: xHandle, set: setXHandle, placeholder: "@handle", icon: "𝕏" },
                  { label: "Telegram", value: telegram, set: setTelegram, placeholder: "@group or https://t.me/...", icon: "✈️" },
                  { label: "Discord", value: discord, set: setDiscord, placeholder: "https://discord.gg/...", icon: "💬" },
                ].map(({ label, value, set, placeholder, icon: linkIcon }) => (
                  <div key={label}>
                    <label className="text-[10px] text-white/25 uppercase tracking-wider mb-1.5 block font-semibold">{label}</label>
                    <div className="flex items-center gap-2">
                      <span className="text-base w-8 text-center shrink-0">{linkIcon}</span>
                      <input value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                        className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-og-cyan/40 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-[10px] text-white/25 uppercase tracking-wider mb-1.5 block font-semibold">Weekly AMA Schedule</label>
                <input value={amaSchedule} onChange={e => setAmaSchedule(e.target.value)}
                  placeholder="e.g. Every Friday 3PM UTC"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-og-cyan/40 transition-colors" />
              </div>

              <div>
                <label className="text-[10px] text-white/25 uppercase tracking-wider mb-1.5 block font-semibold">Community Focus / Vibe</label>
                <input value={qualityFocus} onChange={e => setQualityFocus(e.target.value)}
                  placeholder="e.g. High-conviction calls only, no noise"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-og-cyan/40 transition-colors" />
              </div>

              {/* Final summary card */}
              <div className="rounded-xl border border-og-lime/20 bg-og-lime/[0.04] p-4 space-y-2">
                <p className="text-xs font-bold text-og-lime mb-3">🚀 Ready to launch</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center text-xl">
                    {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover rounded-xl" alt="" /> : icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{name || "Unnamed"}</p>
                    <p className="text-[10px] text-white/30">{COMMUNITY_CATEGORIES.find(c => c.id === category)?.label} · {privacy === "invite" ? "Invite Only" : privacy === "private" ? "Private" : "Public"}</p>
                  </div>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {tags.map(t => <span key={t} className="text-[10px] text-og-cyan/70 bg-og-cyan/10 px-2 py-0.5 rounded-full">#{t}</span>)}
                  </div>
                )}
                {tokenGateEnabled && tokenGateCA && (
                  <p className="text-[10px] text-og-lime/60">🔐 Token gated · Min {Number(tokenGateMin).toLocaleString()} tokens</p>
                )}
                {rules.length > 0 && (
                  <p className="text-[10px] text-white/30">{rules.length} rule{rules.length !== 1 ? "s" : ""} set</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Footer nav ── */}
        {step > 1 && (
          <div className="px-5 pb-4 pt-2 border-t border-white/[0.04] shrink-0">
            <button onClick={() => setStep(s => s - 1)}
              className="text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          </div>
        )}
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
