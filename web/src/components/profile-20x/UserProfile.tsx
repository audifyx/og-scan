import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  AudioLines,
  Award,
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
  Globe,
  Headphones,
  Heart,
  Image as ImageIcon,
  Link2,
  Loader2,
  LogOut,
  MapPin,
  Medal,
  MoreHorizontal,
  Radio,
  Search,
  Settings,
  Shield,
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

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  created_at: string;
  user_id: string | null;
  username: string | null;
  avatar_url: string | null;
  community_id: string | null;
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
  { id: "calls", label: "Calls" },
  { id: "holdings", label: "Holdings" },
  { id: "communities", label: "Communities" },
  { id: "spaces", label: "Spaces" },
  { id: "achievements", label: "Achievements" },
  { id: "media", label: "Media" },
  { id: "activity", label: "Activity" },
  { id: "saved", label: "Saved Alpha" },
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
      return "border-amber-400/35 bg-amber-400/12 text-amber-100 shadow-[0_0_24px_-14px_rgba(251,191,36,0.85)]";
    case "purple":
      return "border-violet-400/35 bg-violet-400/12 text-violet-100 shadow-[0_0_24px_-14px_rgba(167,139,250,0.85)]";
    case "green":
      return "border-emerald-400/35 bg-emerald-400/12 text-emerald-100 shadow-[0_0_24px_-14px_rgba(52,211,153,0.85)]";
    case "red":
      return "border-rose-400/35 bg-rose-400/12 text-rose-100 shadow-[0_0_24px_-14px_rgba(251,113,133,0.85)]";
    case "legendary":
      return "border-fuchsia-300/45 bg-[linear-gradient(135deg,rgba(236,72,153,0.18),rgba(34,211,238,0.14),rgba(251,191,36,0.12))] text-white shadow-[0_0_36px_-16px_rgba(217,70,239,0.95)]";
    case "blue":
    default:
      return "border-sky-400/35 bg-sky-400/12 text-sky-100 shadow-[0_0_24px_-14px_rgba(56,189,248,0.85)]";
  }
};

const getCommunityPrivacyLabel = (privacy: string | null | undefined) => {
  if (privacy === "private") return "Private";
  if (privacy === "invite_only") return "Invite Only";
  if (privacy === "holder_only") return "Holder Only";
  return "Open";
};

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section
      className={cn(
        "og-profile-panel relative overflow-hidden rounded-[28px] border border-white/[0.09] bg-[linear-gradient(180deg,rgba(8,16,27,0.95),rgba(8,16,27,0.76))] p-4 shadow-[0_30px_90px_-60px_rgba(34,211,238,0.35)] backdrop-blur-xl sm:p-5",
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
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
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
    <div className="group relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.04] p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-white/[0.055]">
      <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-80", accentClasses[accent])} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">{label}</p>
          <div className="mt-3 text-[26px] font-black leading-none tracking-tight text-white">
            <CountUp value={value} formatter={formatter} />
          </div>
          <p className="mt-2 text-xs leading-5 text-white/45">{hint}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/75 transition duration-300 group-hover:scale-105 group-hover:text-white">
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
    <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.025] px-5 py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
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
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] transition duration-300 hover:-translate-y-0.5 hover:brightness-110",
            getBadgeToneClasses(badge.tone),
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span>{badge.label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[220px] rounded-2xl border-white/10 bg-[#08101b] px-3 py-2 text-xs leading-5 text-white/80">
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
      className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 text-left transition duration-300 hover:border-white/[0.15] hover:bg-white/[0.05]"
    >
      <img src={avatar} alt="" className="h-11 w-11 rounded-2xl object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-white">{record.display_name || record.username || "OG User"}</p>
          {record.verified ? <Shield className="h-3.5 w-3.5 text-sky-400" /> : null}
          {isTeam ? <Crown className="h-3.5 w-3.5 text-amber-400" /> : null}
        </div>
        <p className="truncate text-xs text-white/40">{record.username ? `@${record.username}` : record.user_id}</p>
      </div>
    </button>
  );
}

function PostCard({ post }: { post: PostRecord }) {
  const avatar = safeAvatarUrl(post.avatar_url) || dices(post.username || post.user_id || "ogscan-post");

  return (
    <article className="border-b border-white/10 px-4 py-4 transition hover:bg-white/[0.02] sm:px-5">
      <div className="flex items-start gap-3">
        <img src={avatar} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <p className="font-bold text-white">{post.username ? `@${post.username}` : "OG Scan"}</p>
            <span className="text-white/35">·</span>
            <p className="text-white/40">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</p>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-6 text-white/82">{post.content || "No text attached."}</p>
          {post.image_url ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              <img src={post.image_url} alt="" className="h-auto max-h-[420px] w-full object-cover" />
            </div>
          ) : null}
          <div className="mt-3 flex items-center gap-6 text-sm text-white/40">
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
    <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.035] p-4 transition duration-300 hover:border-white/[0.14] hover:bg-white/[0.05]">
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
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Listeners</p>
          <p className="mt-2 text-sm font-semibold text-white">{compact(space.listener_count ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Peak</p>
          <p className="mt-2 text-sm font-semibold text-white">{compact(space.peak_listeners ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
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
    <div className="flex items-center gap-3 rounded-[22px] border border-white/[0.08] bg-white/[0.035] p-3 transition duration-300 hover:border-white/[0.14] hover:bg-white/[0.05]">
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05]">
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
    <div className={cn("rounded-[24px] border p-4", getBadgeToneClasses(tone))}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] opacity-75">Achievement</p>
          <h4 className="mt-2 text-sm font-bold text-white">{title}</h4>
          <p className="mt-2 text-xs leading-5 text-white/75">{body}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export const UserProfile: React.FC<Props> = ({ viewUserId }) => {
  const { user, signOut } = useAuth();
  const { isAdmin, isOwner } = useAdmin();
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
  const [savedAlpha, setSavedAlpha] = useState<SavedAlphaState>({ bookmarks: [], likes: [], reposts: [] });
  const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null);
  const [walletStats, setWalletStats] = useState<WalletStats | null>(null);
  const [tokenHoldings, setTokenHoldings] = useState<TokenHolding[]>([]);
  const [followerPreview, setFollowerPreview] = useState<FollowerRecord[]>([]);
  const [followingPreview, setFollowingPreview] = useState<FollowerRecord[]>([]);

  const [editUsername, setEditUsername] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editWallet, setEditWallet] = useState("");

  const hydrateEditors = useCallback((profile: ProfileData) => {
    setEditUsername(profile.username || "");
    setEditDisplayName(profile.display_name || "");
    setEditBio(profile.bio || "");
    setEditLocation(profile.location || "");
    setEditWebsite(profile.website_url || profile.website || "");
    setEditWallet(profile.wallet_address || profile.sol_wallet || "");
  }, []);

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
        supabase.from("community_members").select("id, community_id, role, joined_at, communities:community_id(id, name, description, icon, banner_url, member_count, privacy, category)").eq("user_id", targetUserId).limit(20),
        supabase.from("user_activity").select("id, activity_type, title, description, data, created_at").eq("user_id", targetUserId).order("created_at", { ascending: false }).limit(20),
        supabase.from("trade_history").select("id, token_symbol, token_name, action, amount, price, pnl, created_at").eq("user_id", targetUserId).order("created_at", { ascending: false }).limit(20),
        supabase.from("community_posts").select("id, content, image_url, likes_count, replies_count, created_at, user_id, username, avatar_url, community_id").eq("user_id", targetUserId).order("created_at", { ascending: false }).limit(20),
        supabase.from("leaderboard").select("user_id, total_pnl").order("total_pnl", { ascending: false }),
      ]);

      const [ubResult, pbResult, liveResult, scheduledResult, pastResult, communitiesResult, activitiesResult, tradesResult, postsResult, leaderboardResult] = results;

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

      if (leaderboardResult.status === "fulfilled") {
        const entries = leaderboardResult.value.data || [];
        const rank = entries.findIndex((entry: any) => entry.user_id === targetUserId);
        setLeaderboardRank(rank >= 0 ? rank + 1 : null);
      } else setLeaderboardRank(null);

      if (user && !isOwnProfile) {
        const { data: relationship } = await supabase
          .from("followers")
          .select("id")
          .eq("follower_id", user.id)
          .eq("followee_id", targetUserId)
          .single();
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

  const handleSignOut = async () => {
    await signOut();
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
  const bannerUrl = safeAvatarUrl(profileData?.banner_url);
  const displayName = profileData?.display_name || profileData?.username || "OG User";
  const handle = profileData?.username ? `@${profileData.username}` : "@ogscan";
  const website = profileData?.website_url || profileData?.website;
  const walletAddress = profileData?.wallet_address || profileData?.sol_wallet || null;
  const specialProfileMode = Boolean(profileData?.is_official_account || profileData?.affiliate_org_id || (isOwnProfile && (isAdmin || isOwner)));
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
  const mediaPosts = posts.filter((post) => Boolean(post.image_url));
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
        icon: Shield,
      });
    }
    if (isOwnProfile && isOwner) {
      list.push({
        key: "owner",
        label: "Owner",
        description: "Legendary owner identity treatment reserved for the platform owner account.",
        tone: "legendary",
        icon: Crown,
      });
    } else if (isOwnProfile && isAdmin) {
      list.push({
        key: "admin-control",
        label: "Admin",
        description: "Admin control badge for accounts with elevated OG Scan access.",
        tone: "gold",
        icon: Shield,
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
        icon: Crown,
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
        icon: Star,
      });
    }
    return list;
  }, [isAdmin, isOwnProfile, isOwner, leaderboardRank, profileData?.affiliate_org_id, profileData?.current_level, profileData?.is_official_account, profileData?.is_pioneer, profileData?.trades_count, profileData?.verified, userBadges, walletAddress]);

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
      <div className="mx-auto w-full max-w-[1520px] space-y-6 pb-10">
        <Panel className="overflow-hidden p-0">
          <div className="relative overflow-hidden rounded-[30px]">
            <div className={cn("og-profile-hero relative h-[180px] overflow-hidden sm:h-[240px] lg:h-[320px]", specialProfileMode && "og-profile-hero--official", isOwnProfile && isOwner && "og-profile-hero--owner")}>
              {bannerUrl ? (
                <img src={bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
              ) : (
                <div className="absolute inset-0 bg-[linear-gradient(135deg,#101827_0%,#18263b_45%,#0b111c_100%)]" />
              )}

              <div className="og-profile-grid absolute inset-0 opacity-20" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_28%),linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.24)_50%,rgba(8,16,27,0.9)_100%)]" />
              {specialProfileMode ? <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(250,204,21,0.08),transparent_38%,rgba(34,211,238,0.08)_100%)]" /> : null}
            </div>

            <div className="relative z-10 -mt-14 sm:-mt-16 lg:-mt-20">
              <div className={cn("border-t border-white/10 bg-[#08101b]/98", specialProfileMode && "og-profile-operator-shell")}>
                <div className="flex justify-end gap-2 px-4 pt-3 sm:px-6 sm:pt-4 lg:px-8">
                  {!isOwnProfile ? (
                    <Button
                      onClick={handleFollowToggle}
                      disabled={followBusy}
                      className={cn(
                        "h-10 rounded-full px-5 text-sm font-bold",
                        isFollowing ? "bg-white text-[#061019] hover:bg-white/90" : "bg-transparent text-white ring-1 ring-white/20 hover:bg-white/10",
                      )}
                    >
                      {followBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {isFollowing ? "Following" : "Follow"}
                    </Button>
                  ) : (
                    <Button onClick={() => setActiveTab("settings")} variant="outline" className="h-10 rounded-full border-white/15 bg-transparent px-5 text-sm font-bold text-white hover:bg-white/10 hover:text-white">
                      Edit profile
                    </Button>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-2xl border-white/10 bg-[#08101b] text-white">
                      <DropdownMenuItem onClick={copyProfileLink} className="cursor-pointer rounded-xl focus:bg-white/10 focus:text-white">
                        <Copy className="mr-2 h-4 w-4" /> Copy profile link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={openProfileLink} className="cursor-pointer rounded-xl focus:bg-white/10 focus:text-white">
                        <ExternalLink className="mr-2 h-4 w-4" /> Open public profile
                      </DropdownMenuItem>
                      {isOwnProfile ? (
                        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer rounded-xl text-rose-300 focus:bg-rose-500/10 focus:text-rose-200">
                          <LogOut className="mr-2 h-4 w-4" /> Sign out
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="-mt-12 px-4 pb-5 sm:-mt-16 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
                  <div className="relative inline-flex">
                    <div className="og-profile-avatar-ring rounded-full p-[4px]">
                      <div className="overflow-hidden rounded-full border-4 border-[#08101b] bg-[#08101b]">
                        <img src={avatarUrl} alt="" className="h-24 w-24 rounded-full object-cover sm:h-32 sm:w-32 lg:h-[140px] lg:w-[140px]" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 right-2 h-4 w-4 rounded-full border-2 border-[#08101b] bg-emerald-400" />
                  </div>

                  <div className="mt-4 space-y-3 sm:space-y-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-[28px] font-black leading-none tracking-tight text-white sm:text-[32px]">{displayName}</h1>
                        {identityBadges.map((badge) => (
                          <IdentityBadgeChip key={badge.key} badge={badge} />
                        ))}
                      </div>
                      <p className="mt-1 text-[15px] text-white/45">{handle}</p>
                    </div>

                    {profileData.bio ? <p className="max-w-4xl whitespace-pre-wrap text-[15px] leading-6 text-white/82">{profileData.bio}</p> : null}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px] text-white/55">
                      {profileData.location ? <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {profileData.location}</span> : null}
                      {website ? (
                        <a href={website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-cyan-300 transition hover:text-cyan-200">
                          <Link2 className="h-4 w-4" /> {website.replace(/^https?:\/\//, "")}
                        </a>
                      ) : null}
                      <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {profileData.created_at ? `Joined ${format(new Date(profileData.created_at), "MMMM yyyy")}` : "Joined OG Scan"}</span>
                      {walletAddress ? <span className="inline-flex items-center gap-1.5"><Wallet className="h-4 w-4" /> {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</span> : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-5 text-[15px] text-white/72">
                      <span><span className="font-bold text-white">{compact(followingCount)}</span> Following</span>
                      <span><span className="font-bold text-white">{compact(followerCount)}</span> Followers</span>
                      {mutualCount > 0 ? <span><span className="font-bold text-white">{compact(mutualCount)}</span> Mutuals</span> : null}
                      {leaderboardRank ? <span><span className="font-bold text-white">#{leaderboardRank}</span> Trending</span> : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 text-[12px] font-bold text-white/85">
                        <Zap className="h-3.5 w-3.5 text-cyan-300" /> Level {level}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 text-[12px] font-bold text-white/85">
                        <BarChart3 className="h-3.5 w-3.5 text-emerald-300" /> Reputation {compact(profileData.reputation_score ?? derivedOgScore)}
                      </span>
                      {profileData.is_official_account ? <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/12 px-3 py-1.5 text-[12px] font-bold text-amber-100"><Crown className="h-3.5 w-3.5" /> Official OG Scan</span> : null}
                      {profileData.affiliate_org_id ? <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/12 px-3 py-1.5 text-[12px] font-bold text-amber-100"><Shield className="h-3.5 w-3.5" /> Official Team</span> : null}
                      {walletAddress ? <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/12 px-3 py-1.5 text-[12px] font-bold text-emerald-100"><Wallet className="h-3.5 w-3.5" /> Holder linked</span> : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </Panel>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Panel className="overflow-hidden p-0">
              <div className="-mx-0 overflow-x-auto border-b border-white/10">
                <div className="flex min-w-max">
                  {PROFILE_TABS.filter((tab) => isOwnProfile || tab.id !== "saved").map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "relative min-w-[112px] shrink-0 border-b-2 border-transparent px-4 py-4 text-sm font-bold text-white/55 transition hover:bg-white/[0.03] hover:text-white",
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
                        "relative min-w-[112px] shrink-0 border-b-2 border-transparent px-4 py-4 text-sm font-bold text-white/55 transition hover:bg-white/[0.03] hover:text-white",
                        activeTab === "settings" && "border-cyan-300 text-white",
                      )}
                    >
                      Settings
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {activeTab === "posts" ? (
                  posts.length > 0 ? (
                    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.02]">
                      {posts.map((post) => <PostCard key={post.id} post={post} />)}
                    </div>
                  ) : (
                    <EmptyState icon={Radio} title="No posts yet" body="When this account publishes posts, they will appear here in the main profile feed." />
                  )
                ) : null}

                {activeTab === "calls" ? (
                  tradeHistory.length > 0 ? (
                    <div className="space-y-3">
                      <Panel className="border-white/10 bg-white/[0.03] p-4">
                        <SectionHeading icon={Target} title="Top signals" subtitle="Best callouts and strongest realized moves from synced trade history." />
                        {topTrade ? (
                          <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100/80">Legendary moment</p>
                            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                              <div>
                                <h4 className="text-2xl font-black tracking-tight text-white">{topTrade.token_symbol || topTrade.token_name || "Top signal"}</h4>
                                <p className="mt-2 text-sm text-white/70">{topTrade.action} · {formatDistanceToNow(new Date(topTrade.created_at), { addSuffix: true })}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-100/80">Best PNL</p>
                                <p className="mt-2 text-2xl font-black tracking-tight text-white">{formatUsd(topTrade.pnl)}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <EmptyState icon={TrendingUp} title="No positive calls yet" body="Calls populate here once profitable call history is detected." />
                        )}
                      </Panel>
                      {tradeHistory.map((trade) => (
                        <div key={trade.id} className="rounded-[24px] border border-white/[0.08] bg-white/[0.035] p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-lg font-bold text-white">{trade.token_symbol || trade.token_name || "Signal"}</p>
                              <p className="mt-1 text-xs text-white/45">{trade.action} · {formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/60">Size {compact(trade.amount)}</span>
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/60">Price {formatUsd(trade.price)}</span>
                              <span className={cn("rounded-full border px-3 py-1.5 font-semibold", (trade.pnl ?? 0) >= 0 ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-rose-400/20 bg-rose-400/10 text-rose-200")}>{trade.pnl != null ? formatUsd(trade.pnl) : "PNL pending"}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={Target} title="No calls synced yet" body="This section will turn into a full signal ledger once trade/call history is available for the profile." />
                  )
                ) : null}

                {activeTab === "holdings" ? (
                  walletAddress ? (
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Wallet value</p>
                          <p className="mt-2 text-xl font-black text-white">{walletStats ? formatUsd(walletStats.totalUsdValue) : walletLoading ? "Syncing…" : "—"}</p>
                          <p className="mt-2 text-xs text-white/45">Live wallet overview via on-chain sync.</p>
                        </div>
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Assets tracked</p>
                          <p className="mt-2 text-xl font-black text-white">{walletStats ? compact(walletStats.totalAssets) : walletLoading ? "Syncing…" : "—"}</p>
                          <p className="mt-2 text-xs text-white/45">Fungible + NFT footprint available from wallet sync.</p>
                        </div>
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">SOL balance</p>
                          <p className="mt-2 text-xl font-black text-white">{walletStats ? walletStats.balance.toFixed(2) : walletLoading ? "Syncing…" : "—"}</p>
                          <p className="mt-2 text-xs text-white/45">Wallet-linked identity balance.</p>
                        </div>
                      </div>
                      {walletLoading ? (
                        <div className="flex items-center gap-2 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/55"><Loader2 className="h-4 w-4 animate-spin" /> Syncing wallet data…</div>
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
                      <div key={entry.id} className="rounded-[24px] border border-white/[0.08] bg-white/[0.035] p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.05]">
                            {entry.community?.icon ? <img src={entry.community.icon} alt="" className="h-full w-full object-cover" /> : <Users className="h-5 w-5 text-white/45" />}
                          </div>
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
                  allBadges.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {allBadges.map((badge) => (
                        <AchievementCard key={badge.key} title={badge.title} body={badge.body} tone={badge.tone as IdentityBadge["tone"]} icon={badge.icon} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={Award} title="No achievements unlocked yet" body="As the profile gains badges, progression status, and activity milestones, they will appear here with rarity styling." />
                  )
                ) : null}

                {activeTab === "media" ? (
                  mediaPosts.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {mediaPosts.map((post) => (
                        <article key={post.id} className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.035]">
                          {post.image_url ? <img src={post.image_url} alt="" className="aspect-square w-full object-cover" /> : null}
                          <div className="p-4">
                            <p className="line-clamp-3 text-sm leading-6 text-white/72">{post.content || "Media post"}</p>
                            <p className="mt-3 text-xs text-white/40">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={ImageIcon} title="No media yet" body="Images, GIF posts, highlights, and other media will appear here once they are published." />
                  )
                ) : null}

                {activeTab === "activity" ? (
                  activities.length > 0 ? (
                    activities.map((activity) => (
                      <div key={activity.id} className="rounded-[24px] border border-white/[0.08] bg-white/[0.035] p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-cyan-300">
                            <Activity className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-white">{activity.title}</p>
                              <span className="text-xs text-white/40">{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</span>
                            </div>
                            {activity.description ? <p className="mt-2 text-sm leading-6 text-white/55">{activity.description}</p> : null}
                            <p className="mt-2 text-[11px] font-black uppercase tracking-[0.16em] text-white/30">{activity.activity_type}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState icon={Activity} title="No activity yet" body="Profile activity, achievements, and on-platform actions will stream here once there is activity to render." />
                  )
                ) : null}

                {activeTab === "saved" && isOwnProfile ? (
                  savedAlpha.bookmarks.length > 0 || savedAlpha.likes.length > 0 || savedAlpha.reposts.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Bookmarks</p>
                          <p className="mt-2 text-xl font-black text-white">{compact(savedAlpha.bookmarks.length)}</p>
                        </div>
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Likes</p>
                          <p className="mt-2 text-xl font-black text-white">{compact(savedAlpha.likes.length)}</p>
                        </div>
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
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
                      <SectionHeading icon={Sparkles} title="Upgrade paths" subtitle="Built for scalable backend-powered cosmetics and identity upgrades." />
                      <div className="space-y-3 text-sm text-white/60">
                        <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">Animated GIF banners and video banners can slot into the current banner surface using the existing `banner_url` pathway.</div>
                        <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">Tiered badges already support stacking, hover tooltips, and future frame/cosmetic unlocks.</div>
                        <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">Wallet connection feeds holder verification, on-chain stats, and future rarity/frame unlock logic.</div>
                      </div>
                    </Panel>
                  </div>
                ) : null}
              </div>
            </Panel>
          </div>

          <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
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
                <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Account status</p>
                  <p className="mt-2 text-lg font-black text-white">{profileData.is_online ? "Online" : "Offline"}</p>
                  <p className="mt-2 text-xs text-white/45">Presence, verification, and role signals appear on the main profile header.</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Badges</p>
                  <p className="mt-2 text-lg font-black text-white">{compact(allBadges.length)}</p>
                  <p className="mt-2 text-xs text-white/45">Earned verification, team, pioneer, and wallet-linked identity markers.</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Communities</p>
                  <p className="mt-2 text-lg font-black text-white">{compact(communities.length)}</p>
                  <p className="mt-2 text-xs text-white/45">Joined groups and roles tied to this account.</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
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
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Best reach</p>
                    <p className="mt-2 text-lg font-black text-white">{compact(totalListeners)}</p>
                    <p className="mt-2 text-xs text-white/45">Peak listeners across hosted spaces.</p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
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
                <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Wallet state</p>
                  <p className="mt-2 text-lg font-black text-white">{walletAddress ? "Connected" : "Disconnected"}</p>
                  <p className="mt-2 text-xs text-white/45">{walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "Connect a wallet to unlock holder badges and identity metrics."}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Token count</p>
                    <p className="mt-2 text-lg font-black text-white">{walletStats ? compact(walletStats.tokenCount) : "—"}</p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
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
