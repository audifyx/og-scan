import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  AudioLines,
  Award,
  BadgeCheck,
  BarChart3,
  BookMarked,
  Calendar,
  Check,
  ChevronLeft,
  Clock3,
  Copy,
  Crown,
  ExternalLink,
  Flame,
  Gem,
  Globe,
  Headphones,
  Heart,
  Image as ImageIcon,
  Link2,
  Loader2,
  MapPin,
  Medal,
  MoreHorizontal,
  Radio,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  TrendingUp,
  User,
  Users,
  Wallet,
  Waves,
  Zap,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { AvatarSelector } from "@/components/avatars/AvatarSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocation, useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { FollowerRecord, useFriends } from "@/hooks/useFriends";
import { supabase } from "@/lib/supabase";
import { cn, safeAvatarUrl } from "@/lib/utils";

type ProfileTab =
  | "posts"
  | "calls"
  | "holdings"
  | "communities"
  | "spaces"
  | "achievements"
  | "media"
  | "activity"
  | "saved"
  | "settings";

interface ProfileData {
  user_id: string;
  username: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  bio?: string | null;
  badge?: string | null;
  location?: string | null;
  website_url?: string | null;
  website?: string | null;
  twitter_handle?: string | null;
  discord_handle?: string | null;
  followers_count?: number | null;
  following_count?: number | null;
  created_at?: string | null;
  is_online?: boolean | null;
  last_seen_at?: string | null;
  last_active_at?: string | null;
  xp?: number | null;
  total_xp?: number | null;
  current_level?: number | null;
  total_pnl?: number | null;
  trades_count?: number | null;
  verified?: boolean | null;
  is_official_account?: boolean | null;
  affiliate_org_id?: string | null;
  reputation_score?: number | null;
  daily_streak?: number | null;
  holder_streak?: number | null;
  longest_streak?: number | null;
  is_pioneer?: boolean | null;
  wallet_address?: string | null;
  sol_wallet?: string | null;
  referral_code?: string | null;
  page_accent?: string | null;
  volume_usd?: number | null;
  win_rate?: number | null;
  pnl_pct?: number | null;
  is_public?: boolean | null;
}

interface UserBadge {
  id: string;
  name: string;
  icon: string | null;
  rarity: string | null;
}

interface ProfileBadge {
  id: string;
  label: string;
  color: string | null;
  icon: string | null;
  glow: boolean | null;
}

interface CommunityRecord {
  id: string;
  community_id: string;
  role: string | null;
  joined_at: string | null;
  community: {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    avatar_url?: string | null;
    banner_url: string | null;
    member_count: number;
    privacy: string;
    category: string | null;
  } | null;
}

interface ActivityRecord {
  id: string;
  activity_type: string;
  title: string;
  description: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
}

interface TradeHistoryRow {
  id: string;
  token_symbol: string;
  token_name: string | null;
  action: string;
  amount: number;
  price: number;
  pnl: number | null;
  created_at: string;
}

interface PostRecord {
  id: string;
  content: string | null;
  image_url: string | null;
  likes_count: number | null;
  replies_count: number | null;
  reposts_count?: number | null;
  views_count?: number | null;
  created_at: string;
  user_id: string | null;
  username: string | null;
  avatar_url: string | null;
  community_id: string | null;
  post_type?: string | null;
  thread_id?: string | null;
  thread_order?: number | null;
  is_article?: boolean | null;
  article_title?: string | null;
  article_cover_url?: string | null;
  is_pinned?: boolean | null;
  video_url?: string | null;
}

interface ReplyRecord {
  id: string;
  post_id: string;
  user_id: string | null;
  username: string | null;
  avatar_url: string | null;
  content: string;
  likes_count: number | null;
  created_at: string;
}

interface SpaceRecord {
  id: string;
  title: string;
  description: string | null;
  topic: string | null;
  is_live: boolean;
  listener_count: number;
  peak_listeners: number;
  scheduled_for: string | null;
  created_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  tags: string[] | null;
}

interface WalletStats {
  balance: number;
  usdValue: number;
  solPrice: number;
  priceChange24h: number;
  totalUsdValue: number;
  tokenCount: number;
  nftCount: number;
  totalAssets: number;
}

interface TokenHolding {
  id: string;
  content?: {
    metadata?: {
      name?: string;
      symbol?: string;
    };
    links?: {
      image?: string;
    };
  };
  token_info?: {
    balance?: number;
    decimals?: number;
    price_info?: {
      price_per_token?: number;
      total_price?: number;
    };
  };
}

interface SavedAlphaState {
  bookmarks: PostRecord[];
  likes: PostRecord[];
  reposts: PostRecord[];
}

interface IdentityBadge {
  key: string;
  label: string;
  description: string;
  tone: "blue" | "gold" | "purple" | "green" | "red" | "legendary";
  icon: React.ComponentType<{ className?: string }>;
}

interface Props {
  viewUserId?: string;
}

const PROFILE_TABS: Array<{ id: ProfileTab; label: string }> = [
  { id: "posts", label: "Posts" },
  { id: "activity", label: "Replies" },
  { id: "achievements", label: "Highlights" },
  { id: "calls", label: "Articles" },
  { id: "media", label: "Media" },
  { id: "spaces", label: "Spaces" },
  { id: "communities", label: "Communities" },
  { id: "holdings", label: "Holdings" },
  { id: "saved", label: "Saved" },
];

const dices = (seed: string) => `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(seed)}`;

const compact = (value: number | null | undefined) => {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
};

const formatUsdCompact = (value: number | null | undefined) => {
  if (value == null) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${value < 0 ? "-" : value > 0 ? "+" : ""}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${value < 0 ? "-" : value > 0 ? "+" : ""}$${(abs / 1_000).toFixed(1)}K`;
  return `${value < 0 ? "-" : value > 0 ? "+" : ""}$${abs.toFixed(0)}`;
};

const formatUsd = (value: number | null | undefined) => {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatPercent = (value: number | null | undefined) => {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
};

const formatDuration = (seconds: number | null | undefined) => {
  if (!seconds) return "—";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
};

const getLevelTitle = (level: number | null | undefined) => {
  const lvl = level ?? 1;
  if (lvl >= 42) return "LEGENDARY OG";
  if (lvl >= 30) return "META ARCHITECT";
  if (lvl >= 18) return "CHAIN STALKER";
  if (lvl >= 7) return "SIGNAL HUNTER";
  return "OG SCOUT";
};

const getProgress = (xp: number | null | undefined, level: number | null | undefined) => {
  const totalXp = Math.max(0, xp ?? 0);
  const currentLevel = Math.max(1, level ?? 1);
  const band = 800 + currentLevel * 120;
  const progress = Math.min(100, Math.round(((totalXp % band) / band) * 100));
  const toNext = Math.max(0, band - (totalXp % band));
  return { progress, toNext };
};

const getBadgeToneClasses = (tone: IdentityBadge["tone"]) => {
  switch (tone) {
    case "gold":
      return "border-amber-300/35 bg-[linear-gradient(135deg,rgba(251,191,36,0.2),rgba(245,158,11,0.09))] text-amber-100 shadow-[0_0_28px_-14px_rgba(251,191,36,0.9)]";
    case "purple":
      return "border-violet-300/35 bg-[linear-gradient(135deg,rgba(167,139,250,0.2),rgba(124,58,237,0.09))] text-violet-100 shadow-[0_0_28px_-14px_rgba(167,139,250,0.9)]";
    case "green":
      return "border-emerald-300/35 bg-[linear-gradient(135deg,rgba(52,211,153,0.2),rgba(20,184,166,0.09))] text-emerald-100 shadow-[0_0_28px_-14px_rgba(52,211,153,0.9)]";
    case "red":
      return "border-rose-300/35 bg-[linear-gradient(135deg,rgba(251,113,133,0.2),rgba(225,29,72,0.09))] text-rose-100 shadow-[0_0_28px_-14px_rgba(251,113,133,0.9)]";
    case "legendary":
      return "border-fuchsia-200/45 bg-[linear-gradient(135deg,rgba(236,72,153,0.22),rgba(34,211,238,0.15),rgba(251,191,36,0.14))] text-white shadow-[0_0_38px_-15px_rgba(217,70,239,0.95)]";
    case "blue":
    default:
      return "border-sky-300/35 bg-[linear-gradient(135deg,rgba(56,189,248,0.2),rgba(14,165,233,0.09))] text-sky-100 shadow-[0_0_28px_-14px_rgba(56,189,248,0.9)]";
  }
};

const getBadgeIconToneClasses = (tone: IdentityBadge["tone"]) => {
  switch (tone) {
    case "gold":
      return "border-amber-200/35 bg-amber-300/18 text-amber-100";
    case "purple":
      return "border-violet-200/35 bg-violet-300/18 text-violet-100";
    case "green":
      return "border-emerald-200/35 bg-emerald-300/18 text-emerald-100";
    case "red":
      return "border-rose-200/35 bg-rose-300/18 text-rose-100";
    case "legendary":
      return "border-white/25 bg-white/15 text-white";
    case "blue":
    default:
      return "border-sky-200/35 bg-sky-300/18 text-sky-100";
  }
};

const getCommunityPrivacyLabel = (privacy: string | null | undefined) => {
  if (privacy === "private") return "Private";
  if (privacy === "invite_only") return "Invite Only";
  if (privacy === "holder_only") return "Holder Only";
  return "Open";
};

function CommunityProfileImage({
  community,
  className,
}: {
  community: CommunityRecord["community"];
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const rawIcon = community?.icon?.trim() || "";
  const emojiIcon = rawIcon && rawIcon.length <= 4 && !safeAvatarUrl(rawIcon) ? rawIcon : null;
  const imageUrl = imageFailed
    ? undefined
    : safeAvatarUrl(community?.avatar_url) || safeAvatarUrl(rawIcon);
  const initial = (community?.name || "Community").trim().charAt(0).toUpperCase() || "C";

  return (
    <div className={cn("flex items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white/[0.05] text-white/55", className)}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={community?.name || "Community"}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : emojiIcon ? (
        <span className="text-xl leading-none">{emojiIcon}</span>
      ) : (
        <span className="text-base font-black">{initial}</span>
      )}
    </div>
  );
}

const isGoldVerifiedProfile = (profile: Pick<ProfileData, "is_official_account" | "affiliate_org_id"> | null | undefined, isOwnerProfile = false) => {
  return Boolean(profile?.is_official_account || profile?.affiliate_org_id || isOwnerProfile);
};

function VerificationBadge({ tone = "blue", className }: { tone?: "blue" | "gold"; className?: string }) {
  return (
    <svg
      viewBox="0 0 22 22"
      className={cn(
        "shrink-0",
        tone === "gold"
          ? "text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.4)]"
          : "text-sky-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.35)]",
        className,
      )}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.274-.586-.705-1.084-1.246-1.439-.54-.354-1.17-.551-1.816-.569-.646.018-1.275.215-1.816.57-.54.354-.972.852-1.246 1.438-.607-.223-1.264-.27-1.897-.14-.634.131-1.218.437-1.687.882-.445.47-.75 1.053-.882 1.687-.13.633-.083 1.29.14 1.897-.586.274-1.084.705-1.439 1.246-.354.54-.551 1.17-.569 1.816.018.646.215 1.275.57 1.816.354.54.852.972 1.438 1.246-.223.607-.27 1.264-.14 1.897.131.634.437 1.218.882 1.687.47.445 1.053.75 1.687.882.633.13 1.29.083 1.897-.14.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.646-.018 1.275-.215 1.816-.57.54-.354.972-.852 1.246-1.438.607.223 1.264.27 1.897.14.634-.131 1.218-.437 1.687-.882.445-.47.75-1.053.882-1.687.13-.633.083-1.29-.14-1.897.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
    </svg>
  );
}

const PRESENCE_STALE_MS = 45_000;
const PRESENCE_TICK_MS = 15_000;

function getPresenceTimestamp(profile?: Pick<ProfileData, "last_active_at" | "last_seen_at"> | null) {
  return profile?.last_active_at || profile?.last_seen_at || null;
}

function isProfileCurrentlyOnline(profile?: Pick<ProfileData, "is_online" | "last_active_at" | "last_seen_at"> | null, now = Date.now()) {
  if (!profile) return false;

  const timestamp = getPresenceTimestamp(profile);
  if (!timestamp) return Boolean(profile.is_online);

  const seenAt = new Date(timestamp).getTime();
  if (Number.isNaN(seenAt)) return Boolean(profile.is_online);
  if (profile.is_online === false) return false;

  return now - seenAt <= PRESENCE_STALE_MS;
}

function getPresenceSubtitle(profile?: Pick<ProfileData, "is_online" | "last_active_at" | "last_seen_at"> | null, now = Date.now()) {
  if (!profile) return "Presence updates automatically while the account is active.";
  if (isProfileCurrentlyOnline(profile, now)) return "Presence updates in real time while the account is active.";

  const timestamp = getPresenceTimestamp(profile);
  if (!timestamp) return "Presence updates automatically while the account is active.";

  const seenAt = new Date(timestamp).getTime();
  if (Number.isNaN(seenAt)) return "Presence updates automatically while the account is active.";

  return `Last active ${formatDistanceToNow(new Date(timestamp), { addSuffix: true })}.`;
}

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section
      className={cn(
        "og-profile-panel relative overflow-hidden rounded-none border border-white/10 bg-black p-4 shadow-none sm:p-5",
        className,
      )}
    >
      {children}
    </section>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04]">
          <Icon className="h-[18px] w-[18px] text-cyan-300" />
        </div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.12em] text-white">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs leading-5 text-white/45">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function CountUp({
  value,
  formatter,
  className,
}: {
  value: number | null | undefined;
  formatter?: (value: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value == null || !Number.isFinite(value)) {
      setDisplay(0);
      return;
    }

    const target = value;
    const start = performance.now();
    let frame = 0;
    const duration = 700;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setDisplay(target * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  if (value == null || !Number.isFinite(value)) {
    return <span className={className}>—</span>;
  }

  return <span className={className}>{formatter ? formatter(display) : Math.round(display).toString()}</span>;
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "cyan",
  formatter,
}: {
  label: string;
  value: number | null | undefined;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "cyan" | "violet" | "amber" | "emerald" | "rose";
  formatter?: (value: number) => string;
}) {
  const accentClasses = {
    cyan: "from-cyan-400/18 to-cyan-400/0 text-cyan-200",
    violet: "from-violet-400/18 to-violet-400/0 text-violet-200",
    amber: "from-amber-400/18 to-amber-400/0 text-amber-200",
    emerald: "from-emerald-400/18 to-emerald-400/0 text-emerald-200",
    rose: "from-rose-400/18 to-rose-400/0 text-rose-200",
  } as const;

  return (
    <div className="group relative overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.03] p-4 transition duration-300 hover:border-white/[0.16] hover:bg-white/[0.05]">
      <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-80", accentClasses[accent])} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">{label}</p>
          <div className="mt-3 text-[26px] font-black leading-none tracking-tight text-white">
            <CountUp value={value} formatter={formatter} />
          </div>
          <p className="mt-2 text-xs leading-5 text-white/45">{hint}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/75 transition duration-300 group-hover:text-white">
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-5 py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md border border-white/10 bg-white/[0.04]">
        <Icon className="h-6 w-6 text-white/45" />
      </div>
      <h4 className="mt-4 text-sm font-bold text-white">{title}</h4>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/45">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function IdentityBadgeChip({ badge }: { badge: IdentityBadge }) {
  const Icon = badge.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-6 w-6 item…16737 tokens truncated…"bg-black">
                          {post.image_url ? <img src={post.image_url} alt="" className="aspect-square w-full object-cover" /> : post.article_cover_url ? <img src={post.article_cover_url} alt="" className="aspect-square w-full object-cover" /> : <div className="flex aspect-square items-center justify-center text-white/35"><Activity className="h-6 w-6" /></div>}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={ImageIcon} title="No media yet" body="Media from posts and articles shows here automatically once this profile publishes images or covers." />
                  )
                ) : null}

                {activeTab === "activity" ? (
                  replies.length > 0 ? (
                    <div className="border-y border-white/10">
                      {replies.map((reply, index) => (
                        <article key={reply.id} className={cn("bg-black px-4 py-4 sm:px-5", index !== replies.length - 1 && "border-b border-white/10")}>
                          <div className="flex items-start gap-3">
                            <img src={safeAvatarUrl(reply.avatar_url) || dices(reply.username || reply.user_id || "ogscan-reply")} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[15px] leading-none">
                                <p className="truncate font-bold text-white">{reply.username || displayName}</p>
                                <p className="truncate text-white/40">{reply.username ? `@${reply.username}` : handle}</p>
                                <span className="text-white/30">·</span>
                                <p className="shrink-0 text-white/40">{formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}</p>
                              </div>
                              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-6 text-white">{reply.content}</p>
                              <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/40">
                                <span>{compact(reply.likes_count)} likes</span>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={Activity} title="No replies yet" body="Real replies from community conversations show here automatically when this profile has posted replies." />
                  )
                ) : null}

                {activeTab === "saved" && isOwnProfile ? (
                  savedAlpha.bookmarks.length > 0 || savedAlpha.likes.length > 0 || savedAlpha.reposts.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Bookmarks</p>
                          <p className="mt-2 text-xl font-black text-white">{compact(savedAlpha.bookmarks.length)}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Likes</p>
                          <p className="mt-2 text-xl font-black text-white">{compact(savedAlpha.likes.length)}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Reposts</p>
                          <p className="mt-2 text-xl font-black text-white">{compact(savedAlpha.reposts.length)}</p>
                        </div>
                      </div>
                      {[...savedAlpha.bookmarks.slice(0, 4), ...savedAlpha.likes.slice(0, 2), ...savedAlpha.reposts.slice(0, 2)].slice(0, 6).map((post) => (
                        <PostCard key={`saved-${post.id}`} post={post} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={BookMarked} title="Saved alpha is empty" body="Bookmarks, liked posts, and reposts will appear here privately when you start saving market alpha." />
                  )
                ) : null}

                {activeTab === "settings" && isOwnProfile ? (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                    <Panel className="border-white/10 bg-white/[0.03]">
                      <SectionHeading icon={Settings} title="Profile settings" subtitle="Edit the core identity fields that power your premium profile experience." />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-1">
                          <label className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Username</label>
                          <Input value={editUsername} onChange={(event) => setEditUsername(event.target.value)} className="h-12 rounded-2xl border-white/10 bg-white/[0.05] text-white" />
                        </div>
                        <div className="space-y-2 sm:col-span-1">
                          <label className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Display name</label>
                          <Input value={editDisplayName} onChange={(event) => setEditDisplayName(event.target.value)} className="h-12 rounded-2xl border-white/10 bg-white/[0.05] text-white" />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <label className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Bio</label>
                          <Textarea value={editBio} onChange={(event) => setEditBio(event.target.value)} className="min-h-[140px] rounded-[24px] border-white/10 bg-white/[0.05] text-white" />
                        </div>
                        <div className="space-y-2 sm:col-span-1">
                          <label className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Location</label>
                          <Input value={editLocation} onChange={(event) => setEditLocation(event.target.value)} className="h-12 rounded-2xl border-white/10 bg-white/[0.05] text-white" />
                        </div>
                        <div className="space-y-2 sm:col-span-1">
                          <label className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Website</label>
                          <Input value={editWebsite} onChange={(event) => setEditWebsite(event.target.value)} className="h-12 rounded-2xl border-white/10 bg-white/[0.05] text-white" />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <label className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Wallet</label>
                          <Input value={editWallet} onChange={(event) => setEditWallet(event.target.value)} className="h-12 rounded-2xl border-white/10 bg-white/[0.05] text-white" />
                        </div>
                      </div>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <Button onClick={saveProfile} disabled={saving} className="rounded-2xl bg-cyan-300 px-5 text-[#061019] hover:bg-white">
                          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Save profile
                        </Button>
                        <Button variant="outline" onClick={() => hydrateEditors(profileData)} className="rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white">
                          Reset changes
                        </Button>
                      </div>
                    </Panel>

                    <Panel className="border-white/10 bg-white/[0.03]">
                      <SectionHeading icon={Sparkles} title="Profile media" subtitle="Update the main visuals shown across your profile and embeds." />
                      <div className="space-y-3 text-sm text-white/60">
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/40">Profile image</p>
                              <p className="mt-2 text-sm text-white/65">Upload a new avatar or pick one from the selector.</p>
                            </div>
                            <AvatarSelector
                              currentAvatar={profileData?.avatar_url}
                              userId={user?.id}
                              onSelect={(url) => void handleAvatarUpdate(url)}
                              trigger={<Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white">Edit image</Button>}
                            />
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/40">Banner</p>
                              <p className="mt-2 text-sm text-white/65">Replace the cover image used at the top of your profile.</p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => bannerFileRef.current?.click()}
                              className="rounded-full border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white"
                            >
                              {uploadingBanner ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
                              Edit banner
                            </Button>
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">Wallet connection feeds holder verification, on-chain stats, and future rarity/frame unlock logic.</div>
                      </div>
                    </Panel>
                  </div>
                ) : null}
              </div>
            </Panel>
          </div>

          <div className="hidden space-y-6 xl:sticky xl:top-6 xl:self-start">
            <Panel>
              <SectionHeading icon={BarChart3} title="Profile overview" subtitle="Live stats from profile, wallet, trade, community, and spaces data." />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {statCards.map((card) => (
                  <MetricCard key={card.label} {...card} />
                ))}
              </div>
            </Panel>

            <Panel>
              <SectionHeading icon={Waves} title="Profile highlights" subtitle="Key trust, rank, and account signals." />
              <div className="space-y-3">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Account status</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 rounded-full", profileIsOnline ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" : "bg-white/20")} />
                    <p className="text-lg font-black text-white">{profileIsOnline ? "Online" : "Offline"}</p>
                  </div>
                  <p className="mt-2 text-xs text-white/45">{profilePresenceSubtitle}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Badges</p>
                  <p className="mt-2 text-lg font-black text-white">{compact(allBadges.length)}</p>
                  <p className="mt-2 text-xs text-white/45">Earned verification, team, pioneer, and wallet-linked identity markers.</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Communities</p>
                  <p className="mt-2 text-lg font-black text-white">{compact(communities.length)}</p>
                  <p className="mt-2 text-xs text-white/45">Joined groups and roles tied to this account.</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Weekly trend</p>
                  <p className="mt-2 text-lg font-black text-white">{leaderboardRank ? `#${leaderboardRank}` : "Unranked"}</p>
                  <p className="mt-2 text-xs text-white/45">Leaderboard placement appears automatically when rank data exists.</p>
                </div>
              </div>
            </Panel>

            <Panel>
              <SectionHeading icon={Crown} title="Signature showcase" subtitle="Flex area for best calls, rare moments, and social proof." />
              <div className="space-y-3">
                <div className="rounded-[22px] border border-amber-400/20 bg-amber-400/10 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/80">Top signal</p>
                  <p className="mt-2 text-lg font-black text-white">{topTrade?.token_symbol || "No signal locked in yet"}</p>
                  <p className="mt-2 text-sm text-white/70">{topTrade?.pnl != null ? `${formatUsd(topTrade.pnl)} realized from best detected trade.` : "This panel auto-fills from real trade history once standout calls are detected."}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Best reach</p>
                    <p className="mt-2 text-lg font-black text-white">{compact(totalListeners)}</p>
                    <p className="mt-2 text-xs text-white/45">Peak listeners across hosted spaces.</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Community footprint</p>
                    <p className="mt-2 text-lg font-black text-white">{compact(communities.length)}</p>
                    <p className="mt-2 text-xs text-white/45">Joined communities and ecosystem roles.</p>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel>
              <SectionHeading icon={Users} title="Network preview" subtitle="Followers, following, and mutual signal relationships." />
              <div className="space-y-3">
                <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-3">
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <Search className="h-4 w-4 text-white/35" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search network"
                      className="w-full bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Followers</p>
                    {filteredFollowers.slice(0, 4).map((record) => (
                      <MiniFollowerCard key={`follower-${record.user_id}`} record={record} onOpen={setViewingUser} />
                    ))}
                    {filteredFollowers.length === 0 ? <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-4 text-xs text-white/40">No followers matched yet.</p> : null}
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Following</p>
                    {filteredFollowing.slice(0, 4).map((record) => (
                      <MiniFollowerCard key={`following-${record.user_id}`} record={record} onOpen={setViewingUser} />
                    ))}
                    {filteredFollowing.length === 0 ? <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-4 text-xs text-white/40">No following matches yet.</p> : null}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel>
              <SectionHeading icon={Wallet} title="On-chain wallet system" subtitle="Wallet presence, holder verification, and asset sync state." />
              <div className="space-y-3">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Wallet state</p>
                  <p className="mt-2 text-lg font-black text-white">{walletAddress ? "Connected" : "Disconnected"}</p>
                  <p className="mt-2 text-xs text-white/45">{walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "Connect a wallet to unlock holder badges and identity metrics."}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Token count</p>
                    <p className="mt-2 text-lg font-black text-white">{walletStats ? compact(walletStats.tokenCount) : "—"}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">NFT count</p>
                    <p className="mt-2 text-lg font-black text-white">{walletStats ? compact(walletStats.nftCount) : "—"}</p>
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default UserProfile;

