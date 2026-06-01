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
      return "border-amber-300/50 bg-[linear-gradient(135deg,rgba(251,191,36,0.28),rgba(245,158,11,0.12))] text-amber-100 shadow-[0_0_18px_-6px_rgba(251,191,36,0.85),inset_0_1px_0_rgba(251,191,36,0.15)]";
    case "purple":
      return "border-violet-300/50 bg-[linear-gradient(135deg,rgba(167,139,250,0.28),rgba(124,58,237,0.12))] text-violet-100 shadow-[0_0_18px_-6px_rgba(167,139,250,0.85),inset_0_1px_0_rgba(167,139,250,0.15)]";
    case "green":
      return "border-emerald-300/50 bg-[linear-gradient(135deg,rgba(52,211,153,0.28),rgba(20,184,166,0.12))] text-emerald-100 shadow-[0_0_18px_-6px_rgba(52,211,153,0.85),inset_0_1px_0_rgba(52,211,153,0.15)]";
    case "red":
      return "border-rose-300/50 bg-[linear-gradient(135deg,rgba(251,113,133,0.28),rgba(225,29,72,0.12))] text-rose-100 shadow-[0_0_18px_-6px_rgba(251,113,133,0.85),inset_0_1px_0_rgba(251,113,133,0.15)]";
    case "legendary":
      return "border-fuchsia-200/60 bg-[linear-gradient(135deg,rgba(236,72,153,0.30),rgba(34,211,238,0.20),rgba(251,191,36,0.18))] text-white shadow-[0_0_24px_-6px_rgba(217,70,239,1),inset_0_1px_0_rgba(255,255,255,0.18)]";
    case "blue":
    default:
      return "border-sky-300/50 bg-[linear-gradient(135deg,rgba(56,189,248,0.28),rgba(14,165,233,0.12))] text-sky-100 shadow-[0_0_18px_-6px_rgba(56,189,248,0.85),inset_0_1px_0_rgba(56,189,248,0.15)]";
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
  const isLegendary = badge.tone === "legendary";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition duration-300 hover:brightness-110 hover:scale-[1.04] active:scale-[0.97]",
            isLegendary && "animate-pulse-subtle",
            getBadgeToneClasses(badge.tone),
          )}
        >
          <Icon className="h-3 w-3 shrink-0" />
          <span className="text-[10px] font-bold tracking-wide uppercase leading-none">{badge.label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[220px] rounded-xl border-white/10 bg-[#08101b]/95 px-3 py-2 text-xs leading-5 text-white/80 backdrop-blur-sm">
        <p className="font-semibold text-white mb-0.5">{badge.label}</p>
        {badge.description}
      </TooltipContent>
    </Tooltip>
  );
}

function MiniFollowerCard({
  record,
  onOpen,
}: {
  record: FollowerRecord;
  onOpen: (userId: string) => void;
}) {
  const avatar = safeAvatarUrl(record.avatar_url) || dices(record.username || record.user_id);
  const isTeam = Boolean(record.is_official_account || record.affiliate_org_id);

  return (
    <button
      type="button"
      onClick={() => onOpen(record.user_id)}
      className="flex w-full items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.03] p-3 text-left transition duration-300 hover:border-white/[0.15] hover:bg-white/[0.05]"
    >
      <img src={avatar} alt="" className="h-11 w-11 rounded-lg object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-white">{record.display_name || record.username || "OG User"}</p>
          {isTeam ? <VerificationBadge tone="gold" className="h-3.5 w-3.5" /> : record.verified ? <VerificationBadge tone="blue" className="h-3.5 w-3.5" /> : null}
        </div>
        <p className="truncate text-xs text-white/40">{record.username ? `@${record.username}` : record.user_id}</p>
      </div>
    </button>
  );
}

function PostCard({
  post,
  authorOverride,
  showPinned = false,
}: {
  post: PostRecord;
  authorOverride?: {
    displayName: string;
    handle: string;
    avatarUrl: string;
    verified?: boolean | null;
    official?: boolean | null;
  };
  showPinned?: boolean;
}) {
  const avatar = authorOverride?.avatarUrl || safeAvatarUrl(post.avatar_url) || dices(post.username || post.user_id || "ogscan-post");
  const displayName = authorOverride?.displayName || post.username || "OG Scan";
  const handle = authorOverride?.handle || (post.username ? `@${post.username}` : "@ogscan");
  const official = Boolean(authorOverride?.official);
  const verified = Boolean(authorOverride?.verified) && !official;

  return (
    <article className="border-b border-white/10 bg-black px-4 py-4 transition sm:px-5">
      {showPinned ? (
        <div className="mb-3 flex items-center gap-2 pl-14 text-[13px] font-semibold text-white/45">
          <Star className="h-3.5 w-3.5" />
          <span>Pinned</span>
        </div>
      ) : null}
      <div className="flex items-start gap-3">
        <img src={avatar} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[15px] leading-none">
                <p className="truncate font-bold text-white">{displayName}</p>
                {official ? <VerificationBadge tone="gold" className="h-4 w-4" /> : verified ? <VerificationBadge tone="blue" className="h-4 w-4" /> : null}
                <p className="truncate text-white/40">{handle}</p>
                <span className="text-white/30">·</span>
                <p className="shrink-0 text-white/40">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</p>
              </div>
            </div>
            <button type="button" className="shrink-0 text-white/35 transition hover:text-white/70" aria-label="Post actions">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-6 text-white/88">{post.content || "No text attached."}</p>
          {post.image_url ? (
            <div className="mt-3 overflow-hidden rounded-none border border-white/10 bg-black">
              <img src={post.image_url} alt="" className="h-auto max-h-[420px] w-full object-cover" />
            </div>
          ) : null}
          <div className="mt-3 flex max-w-[420px] items-center justify-between text-sm text-white/40">
            <span className="inline-flex items-center gap-2"><MessageDots className="h-4 w-4" /> {compact(post.replies_count ?? 0)}</span>
            <span className="inline-flex items-center gap-2"><Heart className="h-4 w-4" /> {compact(post.likes_count ?? 0)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function MessageDots({ className }: { className?: string }) {
  return <Activity className={className} />;
}

function SpaceCard({ space }: { space: SpaceRecord }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4 transition duration-300 hover:border-white/[0.14] hover:bg-white/[0.05]">
      <div className="flex flex-wrap items-center gap-2">
        {space.is_live ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-rose-200">
            <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" /> Live
          </span>
        ) : space.scheduled_for && !space.ended_at ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-100">Scheduled</span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white/55">Archive</span>
        )}
        {space.topic ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold text-white/55">{space.topic}</span>
        ) : null}
      </div>
      <h4 className="mt-4 text-lg font-bold tracking-tight text-white">{space.title}</h4>
      {space.description ? <p className="mt-2 text-sm leading-6 text-white/55">{space.description}</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Listeners</p>
          <p className="mt-2 text-sm font-semibold text-white">{compact(space.listener_count ?? 0)}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Peak</p>
          <p className="mt-2 text-sm font-semibold text-white">{compact(space.peak_listeners ?? 0)}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Duration</p>
          <p className="mt-2 text-sm font-semibold text-white">{formatDuration(space.duration_seconds)}</p>
        </div>
      </div>
    </div>
  );
}

function WalletHoldingCard({ holding }: { holding: TokenHolding }) {
  const symbol = holding.content?.metadata?.symbol || holding.content?.metadata?.name || "Asset";
  const balanceRaw = holding.token_info?.balance ?? 0;
  const decimals = holding.token_info?.decimals ?? 0;
  const balance = decimals > 0 ? balanceRaw / 10 ** decimals : balanceRaw;
  const value = holding.token_info?.price_info?.total_price ?? null;
  const img = holding.content?.links?.image;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 transition duration-300 hover:border-white/[0.14] hover:bg-white/[0.05]">
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white/[0.05]">
        {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <Wallet className="h-5 w-5 text-white/45" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{symbol}</p>
        <p className="mt-1 truncate text-xs text-white/40">{balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} units</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-white">{value != null ? formatUsd(value) : "—"}</p>
        <p className="mt-1 text-xs text-white/40">Wallet synced</p>
      </div>
    </div>
  );
}

function AchievementCard({
  title,
  body,
  tone,
  icon: Icon,
}: {
  title: string;
  body: string;
  tone: IdentityBadge["tone"];
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className={cn("rounded-lg border p-4", getBadgeToneClasses(tone))}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] opacity-75">Achievement</p>
          <h4 className="mt-2 text-sm font-bold text-white">{title}</h4>
          <p className="mt-2 text-xs leading-5 text-white/75">{body}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/10">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export const UserProfile: React.FC<Props> = ({ viewUserId }) => {
  const { user } = useAuth();
  const { isAdmin, isOwner } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const friends = useFriends();

  const isOwnProfile = !viewUserId || viewUserId === user?.id;
  const targetUserId = viewUserId || user?.id || null;

  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [profileBadges, setProfileBadges] = useState<ProfileBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletLoading, setWalletLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingUser, setViewingUser] = useState<string | null>(null);

  const [liveSpace, setLiveSpace] = useState<SpaceRecord | null>(null);
  const [scheduledSpaces, setScheduledSpaces] = useState<SpaceRecord[]>([]);
  const [pastSpaces, setPastSpaces] = useState<SpaceRecord[]>([]);
  const [communities, setCommunities] = useState<CommunityRecord[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryRow[]>([]);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [replies, setReplies] = useState<ReplyRecord[]>([]);
  const [savedAlpha, setSavedAlpha] = useState<SavedAlphaState>({ bookmarks: [], likes: [], reposts: [] });
  const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null);
  const [walletStats, setWalletStats] = useState<WalletStats | null>(null);
  const [tokenHoldings, setTokenHoldings] = useState<TokenHolding[]>([]);
  const [followerPreview, setFollowerPreview] = useState<FollowerRecord[]>([]);
  const [followingPreview, setFollowingPreview] = useState<FollowerRecord[]>([]);
  const [presenceNow, setPresenceNow] = useState(() => Date.now());

  const [editUsername, setEditUsername] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editWallet, setEditWallet] = useState("");
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerFileRef = useRef<HTMLInputElement | null>(null);

  const hydrateEditors = useCallback((profile: ProfileData) => {
    setEditUsername(profile.username || "");
    setEditDisplayName(profile.display_name || "");
    setEditBio(profile.bio || "");
    setEditLocation(profile.location || "");
    setEditWebsite(profile.website_url || profile.website || "");
    setEditWallet(profile.wallet_address || profile.sol_wallet || "");
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setPresenceNow(Date.now()), PRESENCE_TICK_MS);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!targetUserId) return;

    const channel = supabase
      .channel(`profile-presence-${targetUserId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${targetUserId}` },
        (payload) => {
          const next = payload.new as Partial<ProfileData>;
          setPresenceNow(Date.now());
          setProfileData((current) => {
            if (!current) return current;
            return { ...current, ...next };
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [targetUserId]);

  const fetchSavedPosts = useCallback(async (table: "community_bookmarks" | "community_post_likes" | "community_reposts", field: string) => {
    if (!user) return [] as PostRecord[];
    try {
      const { data: rows } = await supabase.from(table).select(`${field}, created_at`).eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
      const ids = rows?.map((row: any) => row[field]).filter(Boolean) || [];
      if (ids.length === 0) return [] as PostRecord[];
      const { data: records } = await supabase
        .from("community_posts")
        .select("id, content, image_url, likes_count, replies_count, created_at, user_id, username, avatar_url, community_id")
        .in("id", ids);
      const byId = new Map((records || []).map((item: any) => [item.id, item]));
      return ids.map((id: string) => byId.get(id)).filter(Boolean) as PostRecord[];
    } catch {
      return [] as PostRecord[];
    }
  }, [user]);

  const fetchWalletData = useCallback(async (walletAddress: string) => {
    if (!walletAddress) {
      setWalletStats(null);
      setTokenHoldings([]);
      return;
    }

    setWalletLoading(true);
    try {
      const [overviewRes, assetsRes] = await Promise.all([
        supabase.functions.invoke("solana-tracker", { body: { action: "getWalletOverview", walletAddress } }),
        supabase.functions.invoke("solana-tracker", { body: { action: "getAssets", walletAddress, page: 1, limit: 20 } }),
      ]);

      setWalletStats((overviewRes.data as WalletStats) || null);
      setTokenHoldings((assetsRes.data?.assets || []).filter((item: any) => item.interface === "FungibleToken" || item.interface === "FungibleAsset"));
    } catch (error) {
      console.error("wallet sync failed", error);
      setWalletStats(null);
      setTokenHoldings([]);
    } finally {
      setWalletLoading(false);
    }
  }, []);

  const fetchFollowPreview = useCallback(async (userId: string) => {
    if (isOwnProfile) return;

    try {
      const [{ data: followerRows }, { data: followingRows }] = await Promise.all([
        supabase.from("followers").select("follower_id").eq("followee_id", userId).limit(10),
        supabase.from("followers").select("followee_id").eq("follower_id", userId).limit(10),
      ]);

      const followerIds = followerRows?.map((row) => row.follower_id) || [];
      const followingIds = followingRows?.map((row) => row.followee_id) || [];
      const allIds = [...new Set([...followerIds, ...followingIds])];

      if (allIds.length === 0) {
        setFollowerPreview([]);
        setFollowingPreview([]);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, bio, badge, verified, is_official_account, affiliate_org_id")
        .in("user_id", allIds);

      const profileMap = new Map((profiles || []).map((record: any) => [record.user_id, record]));
      const toRecord = (id: string): FollowerRecord => {
        const record = profileMap.get(id);
        return {
          id,
          user_id: id,
          username: record?.username || null,
          display_name: record?.display_name || null,
          avatar_url: record?.avatar_url || null,
          bio: record?.bio || null,
          badge: record?.badge || null,
          verified: Boolean(record?.verified),
          is_official_account: Boolean(record?.is_official_account),
          affiliate_org_id: record?.affiliate_org_id || null,
        };
      };

      setFollowerPreview(followerIds.map(toRecord));
      setFollowingPreview(followingIds.map(toRecord));
    } catch (error) {
      console.error("failed to fetch follow preview", error);
      setFollowerPreview([]);
      setFollowingPreview([]);
    }
  }, [isOwnProfile]);

  const fetchProfile = useCallback(async () => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: profile, error } = await supabase.from("profiles").select("*").eq("user_id", targetUserId).single();
      if (error) throw error;
      const profileRecord = profile as ProfileData;
      setProfileData(profileRecord);
      if (isOwnProfile) hydrateEditors(profileRecord);

      const results = await Promise.allSettled([
        supabase.from("user_badges").select("id, badge_id, badges(name, icon, rarity)").eq("user_id", targetUserId),
        supabase.from("profile_badges").select("id, label, color, icon, glow").eq("user_id", targetUserId),
        supabase.from("spaces").select("id, title, description, topic, is_live, listener_count, peak_listeners, scheduled_for, created_at, ended_at, duration_seconds, recording_url, tags").eq("host_id", targetUserId).eq("is_live", true).limit(1).single(),
        supabase.from("spaces").select("id, title, description, topic, is_live, listener_count, peak_listeners, scheduled_for, created_at, ended_at, duration_seconds, recording_url, tags").eq("host_id", targetUserId).eq("is_live", false).is("ended_at", null).not("scheduled_for", "is", null).gte("scheduled_for", new Date().toISOString()).order("scheduled_for", { ascending: true }).limit(6),
        supabase.from("spaces").select("id, title, description, topic, is_live, listener_count, peak_listeners, scheduled_for, created_at, ended_at, duration_seconds, recording_url, tags").eq("host_id", targetUserId).eq("is_live", false).not("ended_at", "is", null).order("ended_at", { ascending: false }).limit(10),
        supabase.from("community_members").select("id, community_id, role, joined_at, communities:community_id(id, name, description, icon, avatar_url, banner_url, member_count, privacy, category)").eq("user_id", targetUserId).limit(20),
        supabase.from("user_activity").select("id, activity_type, title, description, data, created_at").eq("user_id", targetUserId).order("created_at", { ascending: false }).limit(20),
        supabase.from("trade_history").select("id, token_symbol, token_name, action, amount, price, pnl, created_at").eq("user_id", targetUserId).order("created_at", { ascending: false }).limit(20),
        supabase.from("community_posts").select("id, content, image_url, likes_count, replies_count, reposts_count, views_count, created_at, user_id, username, avatar_url, community_id, post_type, thread_id, thread_order, is_article, article_title, article_cover_url, is_pinned, video_url").eq("user_id", targetUserId).order("created_at", { ascending: false }).limit(40),
        supabase.from("community_post_replies").select("id, post_id, user_id, username, avatar_url, content, likes_count, created_at").eq("user_id", targetUserId).order("created_at", { ascending: false }).limit(40),
        supabase.from("leaderboard").select("user_id, total_pnl").order("total_pnl", { ascending: false }),
      ]);

      const [ubResult, pbResult, liveResult, scheduledResult, pastResult, communitiesResult, activitiesResult, tradesResult, postsResult, repliesResult, leaderboardResult] = results;

      if (ubResult.status === "fulfilled") {
        setUserBadges((ubResult.value.data || []).map((row: any) => ({
          id: row.id,
          name: row.badges?.name ?? "Badge",
          icon: row.badges?.icon ?? null,
          rarity: row.badges?.rarity ?? null,
        })));
      } else setUserBadges([]);

      if (pbResult.status === "fulfilled") {
        setProfileBadges((pbResult.value.data || []).map((row: any) => ({
          id: row.id,
          label: row.label ?? "Badge",
          color: row.color ?? null,
          icon: row.icon ?? null,
          glow: row.glow ?? false,
        })));
      } else setProfileBadges([]);

      if (liveResult.status === "fulfilled") setLiveSpace((liveResult.value.data as SpaceRecord) || null);
      else setLiveSpace(null);

      if (scheduledResult.status === "fulfilled") setScheduledSpaces((scheduledResult.value.data as SpaceRecord[]) || []);
      else setScheduledSpaces([]);

      if (pastResult.status === "fulfilled") setPastSpaces((pastResult.value.data as SpaceRecord[]) || []);
      else setPastSpaces([]);

      if (communitiesResult.status === "fulfilled") {
        setCommunities(((communitiesResult.value.data || []) as any[]).map((row) => ({
          ...row,
          community: Array.isArray(row.communities) ? row.communities[0] : row.communities,
        })) as CommunityRecord[]);
      } else setCommunities([]);

      if (activitiesResult.status === "fulfilled") setActivities((activitiesResult.value.data as ActivityRecord[]) || []);
      else setActivities([]);

      if (tradesResult.status === "fulfilled") setTradeHistory((tradesResult.value.data as TradeHistoryRow[]) || []);
      else setTradeHistory([]);

      if (postsResult.status === "fulfilled") setPosts((postsResult.value.data as PostRecord[]) || []);
      else setPosts([]);

      if (repliesResult.status === "fulfilled") setReplies((repliesResult.value.data as ReplyRecord[]) || []);
      else setReplies([]);

      if (leaderboardResult.status === "fulfilled") {
        const entries = leaderboardResult.value.data || [];
        const rank = entries.findIndex((entry: any) => entry.user_id === targetUserId);
        setLeaderboardRank(rank >= 0 ? rank + 1 : null);
      } else setLeaderboardRank(null);

      if (user && !isOwnProfile) {
        const { data: relationship } = await supabase
          .from("followers")
          .select("follower_id")
          .eq("follower_id", user.id)
          .eq("followee_id", targetUserId)
          .maybeSingle();
        setIsFollowing(Boolean(relationship));
      } else {
        setIsFollowing(false);
      }

      if (isOwnProfile && user) {
        const [bookmarks, likes, reposts] = await Promise.all([
          fetchSavedPosts("community_bookmarks", "post_id"),
          fetchSavedPosts("community_post_likes", "post_id"),
          fetchSavedPosts("community_reposts", "post_id"),
        ]);
        setSavedAlpha({ bookmarks, likes, reposts });
      } else {
        setSavedAlpha({ bookmarks: [], likes: [], reposts: [] });
      }

      await Promise.all([
        fetchWalletData(profileRecord.wallet_address || profileRecord.sol_wallet || ""),
        fetchFollowPreview(targetUserId),
      ]);
    } catch (error) {
      console.error("failed to load profile", error);
      toast.error("Could not load profile");
      setProfileData(null);
      setUserBadges([]);
      setProfileBadges([]);
      setLiveSpace(null);
      setScheduledSpaces([]);
      setPastSpaces([]);
      setCommunities([]);
      setActivities([]);
      setTradeHistory([]);
      setPosts([]);
      setReplies([]);
      setSavedAlpha({ bookmarks: [], likes: [], reposts: [] });
      setLeaderboardRank(null);
      setWalletStats(null);
      setTokenHoldings([]);
      setFollowerPreview([]);
      setFollowingPreview([]);
    } finally {
      setLoading(false);
    }
  }, [fetchFollowPreview, fetchSavedPosts, fetchWalletData, hydrateEditors, isOwnProfile, targetUserId, user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleFollowToggle = async () => {
    if (!user || !targetUserId || isOwnProfile) return;

    setFollowBusy(true);
    try {
      if (isFollowing) {
        await supabase.from("followers").delete().eq("follower_id", user.id).eq("followee_id", targetUserId);
        setIsFollowing(false);
        toast.success("Unfollowed");
      } else {
        await supabase.from("followers").insert({ follower_id: user.id, followee_id: targetUserId });
        setIsFollowing(true);
        toast.success("Following");
      }
      fetchProfile();
    } catch {
      toast.error("Could not update follow state");
    } finally {
      setFollowBusy(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          username: editUsername.trim() || null,
          display_name: editDisplayName.trim() || null,
          bio: editBio.trim() || null,
          location: editLocation.trim() || null,
          website_url: editWebsite.trim() || null,
          wallet_address: editWallet.trim() || null,
        })
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success("Profile updated");
      fetchProfile();
    } catch (error) {
      console.error(error);
      toast.error("Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpdate = async (url: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
      if (error) throw error;
      setProfileData((current) => current ? { ...current, avatar_url: url } : current);
      toast.success("Profile image updated");
    } catch (error) {
      console.error(error);
      toast.error("Could not update profile image");
    }
  };

  const handleBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploadingBanner(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/banner-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("profile-media").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("profile-media").getPublicUrl(path);
      const bannerUrl = data.publicUrl;
      const { error: updateError } = await supabase.from("profiles").update({ banner_url: bannerUrl }).eq("user_id", user.id);
      if (updateError) throw updateError;

      setProfileData((current) => current ? { ...current, banner_url: bannerUrl } : current);
      toast.success("Banner updated");
    } catch (error) {
      console.error(error);
      toast.error("Could not update banner");
    } finally {
      setUploadingBanner(false);
      if (bannerFileRef.current) bannerFileRef.current.value = "";
    }
  };

  const getPublicProfileUrl = () => {
    if (typeof window === "undefined") return "";
    if (profileData?.username) return `${window.location.origin}/u/${profileData.username}`;
    return window.location.href;
  };

  const copyProfileLink = async () => {
    const url = getPublicProfileUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied");
    } catch {
      toast.error("Could not copy profile link");
    }
  };

  const openProfileLink = () => {
    const url = getPublicProfileUrl();
    if (!url || typeof window === "undefined") return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const networkFollowers = isOwnProfile ? friends.followers : followerPreview;
  const networkFollowing = isOwnProfile ? friends.following : followingPreview;
  const followerCount = isOwnProfile ? friends.followerCount : profileData?.followers_count ?? networkFollowers.length;
  const followingCount = isOwnProfile ? friends.followingCount : profileData?.following_count ?? networkFollowing.length;
  const mutualCount = isOwnProfile ? friends.mutualCount : networkFollowers.filter((follower) => networkFollowing.some((person) => person.user_id === follower.user_id)).length;

  const avatarUrl = safeAvatarUrl(profileData?.avatar_url) || dices(profileData?.username || profileData?.user_id || "ogscan");
  const specialProfileMode = Boolean(profileData?.is_official_account || profileData?.affiliate_org_id || (isOwnProfile && (isAdmin || isOwner)));
  const bannerUrl = safeAvatarUrl(profileData?.banner_url) || (specialProfileMode ? "/og-brand.jpg" : null);
  const displayName = profileData?.display_name || profileData?.username || "OG User";
  const handle = profileData?.username ? `@${profileData.username}` : "@ogscan";
  const website = profileData?.website_url || profileData?.website;
  const walletAddress = profileData?.wallet_address || profileData?.sol_wallet || null;
  const totalXp = profileData?.xp ?? profileData?.total_xp ?? null;
  const level = profileData?.current_level ?? 1;
  const levelProgress = getProgress(totalXp, level);
  const positiveCalls = tradeHistory.filter((trade) => (trade.pnl ?? 0) > 0);
  const topTrade = positiveCalls.reduce<TradeHistoryRow | null>((best, trade) => {
    if (!best) return trade;
    return (trade.pnl ?? 0) > (best.pnl ?? 0) ? trade : best;
  }, null);
  const totalListeners = [...scheduledSpaces, ...pastSpaces, ...(liveSpace ? [liveSpace] : [])].reduce((sum, space) => sum + (space.peak_listeners || 0), 0);
  const totalHostedSeconds = pastSpaces.reduce((sum, space) => sum + (space.duration_seconds || 0), 0);
  const totalHostedHours = totalHostedSeconds > 0 ? totalHostedSeconds / 3600 : 0;
  const articlePosts = posts.filter((post) => Boolean(post.is_article || post.post_type === "article" || post.article_title));
  const standardPosts = posts.filter((post) => !articlePosts.some((article) => article.id === post.id));
  const mediaPosts = posts.filter((post) => Boolean(post.image_url || post.article_cover_url || post.video_url));
  const highlightPosts = [...posts]
    .sort((a, b) => ((b.likes_count || 0) + (b.replies_count || 0) + (b.views_count || 0)) - ((a.likes_count || 0) + (a.replies_count || 0) + (a.views_count || 0)))
    .slice(0, 6);
  const derivedOgScore = useMemo(() => {
    const score =
      Math.min(35, (profileData?.current_level ?? 0) * 1.8) +
      Math.min(18, (profileData?.reputation_score ?? 0) / 6) +
      Math.min(16, followerCount / 20) +
      Math.min(12, communities.length * 2) +
      Math.min(10, (pastSpaces.length + (liveSpace ? 1 : 0)) * 2) +
      Math.min(9, (userBadges.length + profileBadges.length) * 1.5);
    return Math.round(Math.min(100, score));
  }, [communities.length, followerCount, liveSpace, pastSpaces.length, profileData?.current_level, profileData?.reputation_score, profileBadges.length, userBadges.length]);

  const diamondHandsScore = profileData?.holder_streak != null
    ? Math.min(100, Math.round((profileData.holder_streak / Math.max(profileData.longest_streak || profileData.holder_streak, 1)) * 100))
    : null;

  const identityBadges = useMemo<IdentityBadge[]>(() => {
    const list: IdentityBadge[] = [];
    if (profileData?.verified) {
      list.push({
        key: "verified",
        label: "Verified",
        description: "Blue verification for authenticated OG Scan accounts.",
        tone: "blue",
        icon: BadgeCheck,
      });
    }
    if (isOwnProfile && isOwner) {
      list.push({
        key: "owner",
        label: "Owner",
        description: "Legendary owner identity treatment reserved for the platform owner account.",
        tone: "legendary",
        icon: Gem,
      });
    } else if (isOwnProfile && isAdmin) {
      list.push({
        key: "admin-control",
        label: "Admin",
        description: "Admin control badge for accounts with elevated OG Scan access.",
        tone: "gold",
        icon: ShieldCheck,
      });
    }
    if (profileData?.is_official_account) {
      list.push({
        key: "og-team",
        label: "OG Team",
        description: "Gold team badge for official OG Scan accounts.",
        tone: "gold",
        icon: Crown,
      });
    } else if (profileData?.affiliate_org_id) {
      list.push({
        key: "official-team",
        label: "Official Team",
        description: "Gold affiliate/team status connected to an official org.",
        tone: "gold",
        icon: BadgeCheck,
      });
    }
    if (profileData?.is_pioneer) {
      list.push({
        key: "beta",
        label: "Early Beta",
        description: "Purple pioneer badge for early platform users.",
        tone: "purple",
        icon: Sparkles,
      });
    }
    if (walletAddress) {
      list.push({
        key: "holder",
        label: "Holder Verified",
        description: "Green wallet-linked identity badge once a holder wallet is attached.",
        tone: "green",
        icon: Wallet,
      });
    }
    if ((leaderboardRank != null && leaderboardRank <= 25) || (profileData?.trades_count ?? 0) >= 15) {
      list.push({
        key: "top-caller",
        label: "Top Caller",
        description: "Red performance badge derived from leaderboard placement and trade/call activity.",
        tone: "red",
        icon: Flame,
      });
    }
    if ((profileData?.current_level ?? 0) >= 42 || userBadges.some((badge) => badge.rarity?.toLowerCase().includes("legend"))) {
      list.push({
        key: "legendary-og",
        label: "Legendary OG",
        description: "Holographic prestige badge unlocked by high progression or legendary badge rarity.",
        tone: "legendary",
        icon: Gem,
      });
    }
    return list;
  }, [isAdmin, isOwnProfile, isOwner, leaderboardRank, profileData?.affiliate_org_id, profileData?.current_level, profileData?.is_official_account, profileData?.is_pioneer, profileData?.trades_count, profileData?.verified, userBadges, walletAddress]);

  const roleTags = identityBadges.slice(0, 5);
  const goldVerified = isGoldVerifiedProfile(profileData, Boolean(isOwnProfile && isOwner));
  const blueVerified = Boolean(profileData?.verified && !goldVerified);
  const profileIsOnline = isProfileCurrentlyOnline(profileData, presenceNow);
  const profilePresenceSubtitle = getPresenceSubtitle(profileData, presenceNow);

  const statCards = [
    { label: "Followers", value: followerCount, hint: "Social gravity across OG Scan", icon: Users, accent: "cyan" as const, formatter: compact },
    { label: "Following", value: followingCount, hint: "Curated signal graph", icon: User, accent: "violet" as const, formatter: compact },
    { label: "XP", value: totalXp, hint: `${levelProgress.toNext.toLocaleString()} XP until next unlock`, icon: Zap, accent: "amber" as const, formatter: compact },
    { label: "Level", value: level, hint: getLevelTitle(level), icon: Trophy, accent: "emerald" as const, formatter: (value: number) => Math.round(value).toString() },
    { label: "Win Rate", value: profileData?.win_rate ?? null, hint: "Performance synced from live trade history", icon: Target, accent: "emerald" as const, formatter: formatPercent },
    { label: "Calls Made", value: profileData?.trades_count ?? null, hint: "Trade/call records tracked on profile", icon: Radio, accent: "rose" as const, formatter: compact },
    { label: "Top Calls", value: positiveCalls.length || null, hint: "Positive call history detected", icon: TrendingUp, accent: "cyan" as const, formatter: compact },
    { label: "Reputation", value: profileData?.reputation_score ?? null, hint: "Community trust and profile strength", icon: Award, accent: "violet" as const, formatter: compact },
    { label: "OG Score", value: derivedOgScore, hint: "Derived from level, reach, spaces, and badges", icon: Crown, accent: "amber" as const, formatter: (value: number) => `${Math.round(value)}` },
    { label: "Wallet PNL", value: profileData?.total_pnl ?? null, hint: "Wallet performance linked into identity", icon: Wallet, accent: (profileData?.total_pnl ?? 0) >= 0 ? "emerald" as const : "rose" as const, formatter: formatUsdCompact },
    { label: "Diamond Hands", value: diamondHandsScore, hint: diamondHandsScore == null ? "Unlocks when holder streak data syncs" : "Based on holder streak retention", icon: Medal, accent: "amber" as const, formatter: (value: number) => `${Math.round(value)}` },
    { label: "Spaces Hosted", value: pastSpaces.length + (liveSpace ? 1 : 0), hint: `${compact(totalListeners)} total listeners reached`, icon: Headphones, accent: "cyan" as const, formatter: compact },
  ];

  const filteredFollowers = networkFollowers.filter((record) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return `${record.username || ""} ${record.display_name || ""} ${record.user_id}`.toLowerCase().includes(query);
  });

  const filteredFollowing = networkFollowing.filter((record) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return `${record.username || ""} ${record.display_name || ""} ${record.user_id}`.toLowerCase().includes(query);
  });

  const allBadges = [
    ...identityBadges.map((badge) => ({
      key: badge.key,
      title: badge.label,
      body: badge.description,
      tone: badge.tone,
      icon: badge.icon,
    })),
    ...userBadges.map((badge) => ({
      key: `user-${badge.id}`,
      title: badge.name,
      body: badge.rarity ? `${badge.rarity} rarity badge earned by this account.` : "User badge unlocked on OG Scan.",
      tone: badge.rarity?.toLowerCase().includes("legend") ? "legendary" : badge.rarity?.toLowerCase().includes("epic") ? "purple" : "blue",
      icon: Trophy,
    })),
    ...profileBadges.map((badge) => ({
      key: `profile-${badge.id}`,
      title: badge.label,
      body: "Custom profile badge surfaced from backend profile badge data.",
      tone: badge.glow ? "legendary" : badge.color?.toLowerCase().includes("gold") ? "gold" : "blue",
      icon: Sparkles,
    })),
  ];

  if (viewingUser) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setViewingUser(null)}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-bold text-white/60 transition hover:bg-white/[0.07] hover:text-white"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </button>
        <UserProfile viewUserId={viewingUser} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
          <p className="text-sm text-white/40">Rendering crypto identity…</p>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <EmptyState
        icon={User}
        title="Profile not found"
        body="This profile could not be loaded from OG Scan right now. Try refreshing again."
      />
    );
  }

  return (
    <TooltipProvider delayDuration={120}>
      <div className="w-full pb-16">
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-black/85 px-4 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => {
              if (viewingUser) {
                setViewingUser(null);
                return;
              }
              if (window.history.length > 1) {
                navigate(-1);
                return;
              }
              if (location.pathname.startsWith("/profile/")) {
                navigate("/profile");
                return;
              }
              navigate("/overview");
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/10"
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1 px-3 text-center">
            <p className="truncate text-[15px] font-semibold text-white">{displayName}</p>
            <p className="truncate text-[12px] text-white/40">{handle}</p>
          </div>

          <div className="h-9 w-9 shrink-0" />
        </div>

        <div className="relative">
          <div className="relative h-[176px] overflow-hidden bg-black sm:h-[210px]">
            {bannerUrl ? (
              <img src={bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-black" />
            )}
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black" />
            {isOwnProfile ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => bannerFileRef.current?.click()}
                  className="absolute bottom-3 right-3 h-9 rounded-full border-white/15 bg-black/70 px-3 text-white backdrop-blur hover:bg-black/90 hover:text-white"
                >
                  {uploadingBanner ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
                  Edit banner
                </Button>
                <input ref={bannerFileRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
              </>
            ) : null}
          </div>

          <div className="relative -mt-12 px-4 pb-4">
            <div className="relative h-[96px] w-[96px]">
              <div className="overflow-hidden rounded-full border-4 border-black bg-black">
                <img src={avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
              </div>
              <div className="absolute bottom-1.5 right-1.5 h-4 w-4 rounded-full border-2 border-black bg-emerald-400" />
              {isOwnProfile ? (
                <div className="absolute -bottom-2 -right-2">
                  <AvatarSelector
                    currentAvatar={profileData?.avatar_url}
                    userId={user?.id}
                    onSelect={(url) => void handleAvatarUpdate(url)}
                    trigger={
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/80 text-white backdrop-blur transition hover:bg-black"
                        aria-label="Edit profile image"
                      >
                        <ImageIcon className="h-4 w-4" />
                      </button>
                    }
                  />
                </div>
              ) : null}
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[32px] font-extrabold leading-none tracking-tight text-white">{displayName}</h1>
                  {goldVerified ? <VerificationBadge tone="gold" className="h-5 w-5" /> : blueVerified ? <VerificationBadge tone="blue" className="h-5 w-5" /> : null}
                </div>
                <p className="mt-1 text-[15px] text-white/40">{handle}</p>
              </div>

              {roleTags.length > 0 ? (
                <div className="flex flex-wrap gap-2.5">
                  {roleTags.map((badge) => {
                    const Icon = badge.icon;
                    return (
                      <Tooltip key={badge.key}>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              "group relative inline-flex h-9 items-center gap-2 overflow-hidden rounded-full border px-2.5 pr-3 text-[11px] font-black uppercase tracking-[0.12em] backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:brightness-110",
                              getBadgeToneClasses(badge.tone),
                            )}
                          >
                            <span className="pointer-events-none absolute inset-x-2 top-0 h-px bg-white/35" />
                            <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full border", getBadgeIconToneClasses(badge.tone))}>
                              <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
                            </span>
                            <span className="leading-none">{badge.label}</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[240px] rounded-md border-white/10 bg-[#08101b] px-3 py-2 text-xs leading-5 text-white/80">
                          {badge.description}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ) : null}

              {profileData.bio ? <p className="whitespace-pre-wrap text-[15px] leading-6 text-white/92">{profileData.bio}</p> : null}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px] text-white/50">
                {profileData.location ? <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {profileData.location}</span> : null}
                {website ? (
                  <a href={website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-cyan-300 transition hover:text-cyan-200">
                    <Link2 className="h-4 w-4" /> {website.replace(/^https?:\/\//, "")}
                  </a>
                ) : null}
                <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {profileData.created_at ? `Joined ${format(new Date(profileData.created_at), "MMMM yyyy")}` : "Joined OG Scan"}</span>
                {walletAddress ? <span className="inline-flex items-center gap-1.5"><Wallet className="h-4 w-4" /> {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</span> : null}
              </div>

              <div className="flex flex-wrap items-center gap-5 text-[15px] text-white/80">
                <span><span className="font-bold text-white">{compact(followingCount)}</span> Following</span>
                <span><span className="font-bold text-white">{compact(followerCount)}</span> Followers</span>
                <span><span className="font-bold text-white">{compact(posts.length)}</span> Posts</span>
                {totalXp > 0 ? <span><span className="font-bold text-white">{compact(totalXp)}</span> XP</span> : null}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {isOwnProfile ? (
                  <>
                    <Button onClick={() => setActiveTab("settings")} className="h-9 rounded-full bg-white px-4 text-sm font-bold text-black hover:bg-white/90">Edit profile</Button>
                    <Button variant="outline" onClick={copyProfileLink} className="h-9 rounded-full border-white/20 bg-transparent px-4 text-sm font-bold text-white hover:bg-white/10 hover:text-white">Share</Button>
                    <Button variant="outline" onClick={openProfileLink} className="h-9 rounded-full border-white/20 bg-transparent px-4 text-sm font-bold text-white hover:bg-white/10 hover:text-white">Open</Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={handleFollowToggle}
                      disabled={followBusy}
                      className={cn(
                        "h-9 rounded-full bg-white px-4 text-sm font-bold text-black hover:bg-white/90",
                        followBusy && "opacity-80",
                      )}
                    >
                      {followBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {isFollowing ? "Following" : "Follow"}
                    </Button>
                    <Button variant="outline" onClick={copyProfileLink} className="h-9 rounded-full border-white/20 bg-transparent px-4 text-sm font-bold text-white hover:bg-white/10 hover:text-white">Share</Button>
                    <Button variant="outline" onClick={openProfileLink} className="h-9 rounded-full border-white/20 bg-transparent px-4 text-sm font-bold text-white hover:bg-white/10 hover:text-white">View</Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="block">
          <div className="space-y-4">
            <Panel className="overflow-hidden rounded-none border-x-0 border-y border-white/10 bg-transparent p-0 shadow-none">
              <div className="-mx-0 overflow-x-auto border-b border-white/10">
                <div className="flex min-w-max">
                  {PROFILE_TABS.filter((tab) => isOwnProfile || tab.id !== "saved").map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "relative min-w-[94px] shrink-0 border-b-2 border-transparent px-3.5 py-4 text-[16px] font-semibold text-white/50 transition hover:bg-white/[0.02] hover:text-white",
                        activeTab === tab.id && "border-cyan-300 text-white",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                  {isOwnProfile ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab("settings")}
                      className={cn(
                        "relative min-w-[96px] shrink-0 border-b-2 border-transparent px-4 py-3 text-[15px] font-bold text-white/50 transition hover:bg-white/[0.02] hover:text-white",
                        activeTab === "settings" && "border-cyan-300 text-white",
                      )}
                    >
                      Settings
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                {activeTab === "posts" ? (
                  standardPosts.length > 0 ? (
                    <div className="overflow-hidden rounded-none bg-transparent">
                      {standardPosts.map((post, index) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          authorOverride={post.user_id === targetUserId ? {
                            displayName,
                            handle,
                            avatarUrl,
                            verified: profileData?.verified,
                            official: Boolean(profileData?.is_official_account || profileData?.affiliate_org_id),
                          } : undefined}
                          showPinned={index === 0 && Boolean(profileData?.is_official_account || profileData?.affiliate_org_id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={Radio} title="No posts yet" body="When this account publishes posts, they will appear here in the main profile feed." />
                  )
                ) : null}

                {activeTab === "calls" ? (
                  articlePosts.length > 0 ? (
                    <div className="border-y border-white/10">
                      {articlePosts.map((post, index) => (
                        <article key={post.id} className={cn("px-4 py-4 sm:px-5", index !== articlePosts.length - 1 && "border-b border-white/10")}>
                          {post.article_cover_url ? (
                            <div className="mb-3 overflow-hidden rounded-none bg-black">
                              <img src={post.article_cover_url} alt="" className="aspect-[2/1] w-full object-cover" />
                            </div>
                          ) : null}
                          <div className="flex items-start gap-3">
                            <img src={safeAvatarUrl(post.avatar_url) || dices(post.username || post.user_id || "ogscan-article")} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[15px] leading-none">
                                <p className="truncate font-bold text-white">{post.username || displayName}</p>
                                <p className="truncate text-white/40">{post.username ? `@${post.username}` : handle}</p>
                                <span className="text-white/30">·</span>
                                <p className="shrink-0 text-white/40">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</p>
                              </div>
                              <h4 className="mt-3 text-[20px] font-black tracking-tight text-white">{post.article_title || post.content || "Article"}</h4>
                              {post.content ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/58">{post.content}</p> : null}
                              <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/40">
                                <span>{compact(post.likes_count)} likes</span>
                                <span>{compact(post.replies_count)} replies</span>
                                <span>{compact(post.views_count)} views</span>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={Target} title="No articles yet" body="Published profile articles show here automatically when article posts exist for this account." />
                  )
                ) : null}

                {activeTab === "holdings" ? (
                  walletAddress ? (
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Wallet value</p>
                          <p className="mt-2 text-xl font-black text-white">{walletStats ? formatUsd(walletStats.totalUsdValue) : walletLoading ? "Syncing…" : "—"}</p>
                          <p className="mt-2 text-xs text-white/45">Live wallet overview via on-chain sync.</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Assets tracked</p>
                          <p className="mt-2 text-xl font-black text-white">{walletStats ? compact(walletStats.totalAssets) : walletLoading ? "Syncing…" : "—"}</p>
                          <p className="mt-2 text-xs text-white/45">Fungible + NFT footprint available from wallet sync.</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">SOL balance</p>
                          <p className="mt-2 text-xl font-black text-white">{walletStats ? walletStats.balance.toFixed(2) : walletLoading ? "Syncing…" : "—"}</p>
                          <p className="mt-2 text-xs text-white/45">Wallet-linked identity balance.</p>
                        </div>
                      </div>
                      {walletLoading ? (
                        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/55"><Loader2 className="h-4 w-4 animate-spin" /> Syncing wallet data…</div>
                      ) : tokenHoldings.length > 0 ? (
                        tokenHoldings.map((holding) => <WalletHoldingCard key={holding.id} holding={holding} />)
                      ) : (
                        <EmptyState icon={Wallet} title="Wallet connected, holdings pending" body="Holdings will appear here after the on-chain sync returns asset data for this wallet." />
                      )}
                    </div>
                  ) : (
                    <EmptyState icon={Wallet} title="No wallet connected" body="Connect a wallet to unlock holder badges, wallet reputation, holdings, PNL, and chain-linked profile identity." action={isOwnProfile ? <Button onClick={() => setActiveTab("settings")} className="rounded-2xl bg-cyan-300 text-[#061019] hover:bg-white">Connect wallet</Button> : undefined} />
                  )
                ) : null}

                {activeTab === "communities" ? (
                  communities.length > 0 ? (
                    communities.map((entry) => (
                      <div key={entry.id} className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
                        <div className="flex items-start gap-4">
                          <CommunityProfileImage community={entry.community} className="h-14 w-14" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-lg font-bold text-white">{entry.community?.name || "Community"}</h4>
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/55">{entry.role || "Member"}</span>
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/55">{getCommunityPrivacyLabel(entry.community?.privacy)}</span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-white/55">{entry.community?.description || "Community details will expand here as richer metadata is connected."}</p>
                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/45">
                              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {compact(entry.community?.member_count ?? 0)} members</span>
                              {entry.joined_at ? <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Joined {format(new Date(entry.joined_at), "MMM d, yyyy")}</span> : null}
                              {entry.community?.category ? <span className="inline-flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> {entry.community.category}</span> : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState icon={Users} title="No communities yet" body="Community memberships and roles will show up here once the user joins OG Scan communities." />
                  )
                ) : null}

                {activeTab === "spaces" ? (
                  liveSpace || scheduledSpaces.length > 0 || pastSpaces.length > 0 ? (
                    <div className="space-y-4">
                      {liveSpace ? (
                        <Panel className="border-cyan-400/15 bg-[linear-gradient(135deg,rgba(34,211,238,0.1),rgba(8,16,27,0.72))]">
                          <SectionHeading icon={Headphones} title="Live now" subtitle="Current live spaces and audience presence." />
                          <SpaceCard space={liveSpace} />
                        </Panel>
                      ) : null}
                      {scheduledSpaces.length > 0 ? (
                        <div className="space-y-3">
                          <SectionHeading icon={Calendar} title="Upcoming spaces" subtitle="Scheduled social audio sessions." />
                          {scheduledSpaces.map((space) => <SpaceCard key={space.id} space={space} />)}
                        </div>
                      ) : null}
                      {pastSpaces.length > 0 ? (
                        <div className="space-y-3">
                          <SectionHeading icon={Clock3} title="Archive" subtitle={`Hosted ${totalHostedHours.toFixed(1)} hours across recorded sessions.`} />
                          {pastSpaces.map((space) => <SpaceCard key={space.id} space={space} />)}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <EmptyState icon={Headphones} title="No spaces yet" body="Hosted spaces, archives, and listener stats will appear here when this profile starts using Spaces." />
                  )
                ) : null}

                {activeTab === "achievements" ? (
                  highlightPosts.length > 0 || topTrade || liveSpace || pastSpaces.length > 0 ? (
                    <div className="border-y border-white/10">
                      {highlightPosts.map((post, index) => (
                        <div key={post.id} className={cn("px-4 py-4 sm:px-5", (index !== highlightPosts.length - 1 || topTrade || liveSpace || pastSpaces.length > 0) && "border-b border-white/10")}>
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/30">Top post highlight</p>
                          <p className="mt-2 text-[16px] font-bold text-white">{post.article_title || post.content || "Profile highlight"}</p>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/45">
                            <span>{compact(post.likes_count)} likes</span>
                            <span>{compact(post.replies_count)} replies</span>
                            <span>{compact(post.views_count)} views</span>
                          </div>
                        </div>
                      ))}
                      {topTrade ? (
                        <div className={cn("px-4 py-4 sm:px-5", (liveSpace || pastSpaces.length > 0) && "border-b border-white/10")}>
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/30">Best trade highlight</p>
                          <p className="mt-2 text-[16px] font-bold text-white">{topTrade.token_symbol || topTrade.token_name || "Trade highlight"}</p>
                          <p className="mt-1 text-sm text-white/58">{topTrade.action} • {formatUsd(topTrade.pnl)} • {formatDistanceToNow(new Date(topTrade.created_at), { addSuffix: true })}</p>
                        </div>
                      ) : null}
                      {liveSpace ? (
                        <div className={cn("px-4 py-4 sm:px-5", pastSpaces.length > 0 && "border-b border-white/10")}>
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/30">Live space highlight</p>
                          <p className="mt-2 text-[16px] font-bold text-white">{liveSpace.title || "Live now"}</p>
                          <p className="mt-1 text-sm text-white/58">{compact(liveSpace.listener_count)} listening live right now.</p>
                        </div>
                      ) : null}
                      {pastSpaces[0] ? (
                        <div className="px-4 py-4 sm:px-5">
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/30">Top archive highlight</p>
                          <p className="mt-2 text-[16px] font-bold text-white">{pastSpaces[0].title || "Recorded space"}</p>
                          <p className="mt-1 text-sm text-white/58">{compact(pastSpaces[0].peak_listeners)} peak listeners • {formatDuration(pastSpaces[0].duration_seconds)}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <EmptyState icon={Award} title="No highlights yet" body="Highlights fill automatically from top posts, articles, trades, and spaces tied to this profile." />
                  )
                ) : null}

                {activeTab === "media" ? (
                  mediaPosts.length > 0 ? (
                    <div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-3 xl:grid-cols-4">
                      {mediaPosts.map((post) => (
                        <article key={post.id} className="bg-black">
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
