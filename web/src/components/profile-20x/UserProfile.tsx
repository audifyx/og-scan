import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Search,
  X,
  Calendar,
  MapPin,
  Link2,
  Settings,
  MoreHorizontal,
  LogOut,
  Copy,
  Check,
  Star,
  Shield,
  Crown,
  Zap,
  BarChart3,
  TrendingUp,
  MessageSquare,
  ChevronLeft,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useFriends, FollowerRecord } from "@/hooks/useFriends";

type ProfileTab = "overview" | "followers" | "following" | "settings";

interface ProfileData {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  badge: string | null;
  location: string | null;
  website_url: string | null;
  followers_count: number;
  following_count: number;
  created_at: string | null;
  is_online: boolean;
  xp: number | null;
  current_level: number | null;
  total_pnl: number | null;
  trades_count: number | null;
  verified: boolean;
  is_official_account?: boolean | null;
  affiliate_org_id?: string | null;
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

interface Props {
  viewUserId?: string;
}

const dicebear = (seed: string) =>
  `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(seed)}`;

const compact = (value: number | null | undefined) => {
  if (value == null) return "0";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
};

const formatPnl = (value: number | null | undefined) => {
  if (value == null || value === 0) return "0 SOL";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)} SOL`;
};

const isTeamMember = (profile?: {
  is_official_account?: boolean | null;
  affiliate_org_id?: string | null;
} | null) => Boolean(profile?.is_official_account || profile?.affiliate_org_id);

function VerifyMark({ tone = "blue", className }: { tone?: "blue" | "gold"; className?: string }) {
  return (
    <svg
      viewBox="0 0 22 22"
      className={cn(
        "shrink-0",
        tone === "blue"
          ? "text-sky-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.35)]"
          : "text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.4)]",
        className,
      )}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.274-.586-.705-1.084-1.246-1.439-.54-.354-1.17-.551-1.816-.569-.646.018-1.275.215-1.816.57-.54.354-.972.852-1.246 1.438-.607-.223-1.264-.27-1.897-.14-.634.131-1.218.437-1.687.882-.445.47-.75 1.053-.882 1.687-.13.633-.083 1.29.14 1.897-.586.274-1.084.705-1.439 1.246-.354.54-.551 1.17-.569 1.816.018.646.215 1.275.57 1.816.354.54.852.972 1.438 1.246-.223.607-.27 1.264-.14 1.897.131.634.437 1.218.882 1.687.47.445 1.053.75 1.687.882.633.13 1.29.083 1.897-.14.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.646-.018 1.275-.215 1.816-.57.54-.354.972-.852 1.246-1.438.607.223 1.264.27 1.897.14.634-.131 1.218-.437 1.687-.882.445-.47.75-1.053.882-1.687.13-.633.083-1.29-.14-1.897.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
    </svg>
  );
}

function TeamPill({ official }: { official?: boolean | null }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]",
        official
          ? "border-amber-400/35 bg-gradient-to-r from-amber-400/18 to-yellow-300/10 text-amber-200"
          : "border-amber-400/28 bg-amber-400/10 text-amber-100",
      )}
    >
      <Crown className="h-3.5 w-3.5" />
      {official ? "Official OG Scan" : "Official Team"}
    </span>
  );
}

function Surface({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-5 shadow-[0_18px_60px_-42px_rgba(0,0,0,0.8)]", className)}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
        <Icon className="h-[18px] w-[18px] text-white/70" />
      </div>
      <div>
        <h3 className="text-sm font-black text-white">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-white/38">{subtitle}</p>}
      </div>
    </div>
  );
}

export const UserProfile: React.FC<Props> = ({ viewUserId }) => {
  const { user, signOut } = useAuth();
  const friends = useFriends();

  const isOwnProfile = !viewUserId || viewUserId === user?.id;
  const refreshFriends = friends.refresh;

  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [profileBadges, setProfileBadges] = useState<ProfileBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [viewFollowers, setViewFollowers] = useState<FollowerRecord[]>([]);
  const [viewFollowing, setViewFollowing] = useState<FollowerRecord[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [viewingUser, setViewingUser] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    const targetId = viewUserId || user?.id;
    if (!targetId) return;

    setLoading(true);

    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, banner_url, bio, badge, location, website_url, followers_count, following_count, created_at, is_online, xp, current_level, total_pnl, trades_count, verified, is_official_account, affiliate_org_id")
      .eq("user_id", targetId)
      .single();

    if (data) {
      setProfileData(data as ProfileData);
      if (isOwnProfile) {
        setEditName(data.username || "");
        setEditDisplayName(data.display_name || "");
        setEditBio(data.bio || "");
        setEditLocation(data.location || "");
        setEditWebsite(data.website_url || "");
      }
    }

    const { data: ubData } = await supabase
      .from("user_badges")
      .select("id, badge_id, badges(name, icon, rarity)")
      .eq("user_id", targetId);

    if (ubData) {
      setUserBadges(ubData.map((ub: any) => ({
        id: ub.id,
        name: ub.badges?.name ?? "Badge",
        icon: ub.badges?.icon ?? null,
        rarity: ub.badges?.rarity ?? null,
      })));
    } else {
      setUserBadges([]);
    }

    const { data: pbData } = await supabase
      .from("profile_badges")
      .select("id, label, color, icon, glow")
      .eq("user_id", targetId);

    if (pbData) {
      setProfileBadges(pbData.map((pb: any) => ({
        id: pb.id,
        label: pb.label ?? "Badge",
        color: pb.color ?? null,
        icon: pb.icon ?? null,
        glow: pb.glow ?? false,
      })));
    } else {
      setProfileBadges([]);
    }

    setLoading(false);
  }, [viewUserId, user?.id, isOwnProfile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const fetchViewFollows = useCallback(async () => {
    const targetId = viewUserId || user?.id;
    if (!targetId) return;

    setViewLoading(true);

    const { data: followerRows } = await supabase.from("followers").select("follower_id").eq("followee_id", targetId);
    const followerIds = followerRows?.map(r => r.follower_id) || [];

    const { data: followingRows } = await supabase.from("followers").select("followee_id").eq("follower_id", targetId);
    const followingIds = followingRows?.map(r => r.followee_id) || [];

    const allIds = [...new Set([...followerIds, ...followingIds])];
    let profileMap = new Map<string, any>();

    if (allIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, bio, badge, verified, is_official_account, affiliate_org_id")
        .in("user_id", allIds);
      profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
    }

    const toRecord = (ids: string[]): FollowerRecord[] => ids.map(id => {
      const p = profileMap.get(id);
      return {
        id,
        user_id: id,
        username: p?.username || null,
        display_name: p?.display_name || null,
        avatar_url: p?.avatar_url || null,
        bio: p?.bio || null,
        badge: p?.badge || null,
        verified: Boolean(p?.verified),
        is_official_account: Boolean(p?.is_official_account),
        affiliate_org_id: p?.affiliate_org_id || null,
      };
    });

    setViewFollowers(toRecord(followerIds));
    setViewFollowing(toRecord(followingIds));
    setViewLoading(false);
  }, [viewUserId, user?.id]);

  useEffect(() => {
    if (activeTab === "followers" || activeTab === "following") {
      if (isOwnProfile) refreshFriends();
      else fetchViewFollows();
    }
  }, [activeTab, isOwnProfile, refreshFriends, fetchViewFollows]);

  const saveSettings = async () => {
    if (!user) return;

    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      username: editName.trim() || null,
      display_name: editDisplayName.trim() || null,
      bio: editBio.trim() || null,
      location: editLocation.trim() || null,
      website_url: editWebsite.trim() || null,
    }).eq("user_id", user.id);
    setSaving(false);

    if (error) toast.error("Failed to save");
    else {
      toast.success("Profile updated!");
      fetchProfile();
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(profileData?.user_id || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (viewingUser) {
    return (
      <div>
        <button
          onClick={() => setViewingUser(null)}
          className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-bold text-white/55 transition hover:bg-white/[0.06] hover:text-white"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </button>
        <UserProfile viewUserId={viewingUser} />
      </div>
    );
  }

  const avatarUrl = profileData?.avatar_url || dicebear(profileData?.username || "og");
  const displayName = profileData?.display_name || profileData?.username || "OG User";
  const handle = profileData?.username ? `@${profileData.username}` : null;
  const followerCount = isOwnProfile ? friends.followerCount : viewFollowers.length;
  const followingCount = isOwnProfile ? friends.followingCount : viewFollowing.length;
  const followersList = isOwnProfile ? friends.followers : viewFollowers;
  const followingList = isOwnProfile ? friends.following : viewFollowing;
  const teamMember = isTeamMember(profileData);
  const teamLabel = profileData?.is_official_account ? "Official OG Scan" : teamMember ? "Official Team" : null;

  const tabs: { id: ProfileTab; label: string; count?: number }[] = [
    { id: "overview", label: "Posts" },
    { id: "followers", label: "Followers", count: followerCount },
    { id: "following", label: "Following", count: followingCount },
    ...(isOwnProfile ? [{ id: "settings" as ProfileTab, label: "Settings" }] : []),
  ];

  const filterList = (list: FollowerRecord[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(r =>
      (r.username || "").toLowerCase().includes(q) ||
      (r.display_name || "").toLowerCase().includes(q) ||
      r.user_id.toLowerCase().includes(q),
    );
  };

  const userBadgeNames = new Set(userBadges.map(b => b.name.toLowerCase()));
  const uniqueProfileBadges = profileBadges.filter(b => !userBadgeNames.has(b.label.toLowerCase()));

  const summaryStats = [
    { label: "Following", value: compact(profileData?.following_count ?? followingCount) },
    { label: "Followers", value: compact(profileData?.followers_count ?? followerCount) },
    { label: "Level", value: profileData?.current_level ? `${profileData.current_level}` : "—" },
    { label: "XP", value: profileData?.xp ? compact(profileData.xp) : "—" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-og-lime border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <section className="overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#08101b] shadow-[0_24px_80px_-50px_rgba(0,0,0,0.9)]">
        <div className="relative h-48 sm:h-60 lg:h-72 xl:h-80 overflow-hidden">
          {profileData?.banner_url ? (
            <img src={profileData.banner_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.25),transparent_32%),radial-gradient(circle_at_top_right,rgba(250,204,21,0.18),transparent_28%),linear-gradient(135deg,#08101b_0%,#0d1727_38%,#0b1220_100%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#08101b] via-[#08101b]/45 to-transparent" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,16,27,0.45)_0%,transparent_35%,transparent_65%,rgba(8,16,27,0.32)_100%)]" />

          <div className="absolute right-4 top-4 z-10 flex items-center gap-2 sm:right-6 sm:top-6">
            {isOwnProfile ? (
              <button
                onClick={() => setActiveTab("settings")}
                className="rounded-full border border-white/15 bg-[#08101b]/75 px-4 py-2 text-[12px] font-bold text-white/80 backdrop-blur-xl transition hover:bg-white/[0.12]"
              >
                Edit profile
              </button>
            ) : user && (
              <>
                <button className="rounded-full border border-white/15 bg-[#08101b]/75 p-2 text-white/60 backdrop-blur-xl transition hover:bg-white/[0.12] hover:text-white">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                <button
                  onClick={() => friends.isFollowing(profileData?.user_id || "") ? friends.unfollow(profileData?.user_id || "") : friends.follow(profileData?.user_id || "")}
                  className={cn(
                    "rounded-full px-5 py-2 text-[12px] font-bold transition",
                    friends.isFollowing(profileData?.user_id || "")
                      ? "border border-white/20 bg-[#08101b]/70 text-white/80 backdrop-blur-xl hover:border-red-500/35 hover:text-red-400"
                      : "bg-white text-black hover:bg-white/90",
                  )}
                >
                  {friends.isFollowing(profileData?.user_id || "") ? "Following" : "Follow"}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="relative px-4 pb-0 sm:px-6 lg:px-8">
          <div className="absolute -top-16 left-4 sm:-top-20 sm:left-6 lg:left-8">
            <div className="relative">
              <img
                src={avatarUrl}
                alt=""
                className="h-32 w-32 rounded-full border-4 border-[#08101b] object-cover bg-[#0f1520] shadow-[0_0_0_10px_rgba(8,16,27,0.85),0_20px_50px_-24px_rgba(0,0,0,0.9)] sm:h-40 sm:w-40"
                onError={e => { (e.target as HTMLImageElement).src = dicebear(profileData?.user_id || "og"); }}
              />
              {profileData?.is_online && (
                <div className="absolute bottom-3 right-3 h-5 w-5 rounded-full border-[3px] border-[#08101b] bg-og-lime shadow-[0_0_14px_hsl(var(--og-lime)/0.7)]" />
              )}
            </div>
          </div>

          <div className="pt-20 sm:pt-24 lg:pt-28">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-2xl font-black tracking-tight text-white sm:text-3xl xl:text-[2.15rem]">{displayName}</h1>
                  {profileData?.verified && <VerifyMark tone="blue" className="h-5 w-5 sm:h-6 sm:w-6" />}
                  {teamMember && <VerifyMark tone="gold" className="h-5 w-5 sm:h-6 sm:w-6" />}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/38">
                  {handle && <span>{handle}</span>}
                  {profileData?.created_at && (
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Joined {new Date(profileData.created_at).toLocaleDateString("en", { month: "long", year: "numeric" })}
                    </span>
                  )}
                </div>

                {profileData?.bio && (
                  <p className="mt-4 max-w-4xl text-sm leading-7 text-white/72 sm:text-[15px]">{profileData.bio}</p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {teamLabel && <TeamPill official={profileData?.is_official_account} />}
                  {profileData?.badge && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-bold text-white/68">
                      <Star className="h-3.5 w-3.5 text-og-gold" />
                      {profileData.badge}
                    </span>
                  )}
                  {profileData?.location && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-bold text-white/58">
                      <MapPin className="h-3.5 w-3.5" />
                      {profileData.location}
                    </span>
                  )}
                  {profileData?.website_url && (
                    <a
                      href={profileData.website_url.startsWith("http") ? profileData.website_url : `https://${profileData.website_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/18 bg-sky-400/[0.08] px-3 py-1 text-[11px] font-bold text-sky-300 transition hover:bg-sky-400/[0.12]"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      {profileData.website_url.replace(/^https?:\/\//, "").slice(0, 40)}
                    </a>
                  )}
                </div>
              </div>

              <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[420px]">
                {summaryStats.map(stat => (
                  <div key={stat.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/25">{stat.label}</p>
                    <p className="mt-1 text-lg font-black text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {(userBadges.length > 0 || uniqueProfileBadges.length > 0) && (
              <div className="mt-5 flex flex-wrap items-center gap-2 pb-1">
                {userBadges.map(b => {
                  const rarityColors: Record<string, string> = {
                    legendary: "border-amber-400/30 bg-amber-400/12 text-amber-200",
                    epic: "border-purple-400/30 bg-purple-400/12 text-purple-200",
                    rare: "border-sky-400/28 bg-sky-400/12 text-sky-200",
                    common: "border-white/10 bg-white/[0.04] text-white/60",
                  };
                  const cls = rarityColors[(b.rarity ?? "common").toLowerCase()] ?? rarityColors.common;
                  return (
                    <span key={b.id} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em]", cls)}>
                      {b.icon && <span>{b.icon}</span>}
                      {b.name}
                    </span>
                  );
                })}

                {uniqueProfileBadges.map(b => (
                  <span
                    key={b.id}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em]",
                      b.glow ? "shadow-[0_0_14px_rgba(251,191,36,0.18)]" : "",
                    )}
                    style={{
                      backgroundColor: b.color ? `${b.color}20` : "rgba(255,255,255,0.04)",
                      color: b.color || "rgba(255,255,255,0.68)",
                      borderColor: b.color ? `${b.color}45` : "rgba(255,255,255,0.1)",
                    }}
                  >
                    {b.icon && <span>{b.icon}</span>}
                    {b.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 flex overflow-x-auto border-t border-white/[0.07]">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSearchQuery(""); }}
                className={cn(
                  "relative min-w-[120px] flex-1 px-4 py-4 text-center text-[13px] font-black transition",
                  activeTab === tab.id ? "text-white" : "text-white/35 hover:bg-white/[0.03] hover:text-white/60",
                )}
              >
                {tab.label}
                {tab.count !== undefined && <span className="ml-1 text-[11px] text-white/25">{tab.count}</span>}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-1/2 h-[4px] w-16 -translate-x-1/2 rounded-full bg-white shadow-[0_0_16px_rgba(255,255,255,0.35)]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-5">
          {activeTab === "overview" && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-5">
                <Surface>
                  <SectionTitle icon={MessageSquare} title="Profile overview" subtitle="OG Scan profile layout with team status and account identity built in." />
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/[0.08] bg-[#0b1420] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/28">Followers</p>
                      <p className="mt-1 text-2xl font-black text-white">{compact(profileData?.followers_count ?? followerCount)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-[#0b1420] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/28">Following</p>
                      <p className="mt-1 text-2xl font-black text-white">{compact(profileData?.following_count ?? followingCount)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-[#0b1420] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/28">Trades</p>
                      <p className="mt-1 text-2xl font-black text-white">{compact(profileData?.trades_count)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-[#0b1420] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/28">PnL</p>
                      <p className={cn(
                        "mt-1 text-2xl font-black",
                        (profileData?.total_pnl || 0) > 0 ? "text-emerald-400" : (profileData?.total_pnl || 0) < 0 ? "text-red-400" : "text-white",
                      )}>
                        {formatPnl(profileData?.total_pnl)}
                      </p>
                    </div>
                  </div>
                </Surface>

                <Surface>
                  <SectionTitle icon={Shield} title="Achievements & identity" subtitle="Team markers, badges, and OG account presence." />
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      {
                        label: "Verified",
                        active: Boolean(profileData?.verified),
                        icon: <VerifyMark tone="blue" className="h-6 w-6" />,
                      },
                      {
                        label: "Gold Team",
                        active: teamMember,
                        icon: <VerifyMark tone="gold" className="h-6 w-6" />,
                      },
                      {
                        label: "Level",
                        active: Boolean(profileData?.current_level),
                        icon: <Star className="h-6 w-6 text-og-gold" />,
                      },
                      {
                        label: "Trader",
                        active: Boolean(profileData?.trades_count),
                        icon: <BarChart3 className="h-6 w-6 text-og-cyan" />,
                      },
                    ].map(item => (
                      <div
                        key={item.label}
                        className={cn(
                          "rounded-2xl border p-4 text-center transition",
                          item.active
                            ? "border-white/[0.12] bg-white/[0.05]"
                            : "border-white/[0.05] bg-white/[0.02] opacity-45 grayscale",
                        )}
                      >
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#0b1420]">
                          {item.icon}
                        </div>
                        <p className="mt-3 text-[11px] font-black uppercase tracking-[0.14em] text-white/72">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </Surface>
              </div>

              <div className="space-y-5">
                <Surface>
                  <SectionTitle icon={TrendingUp} title="OG stats" subtitle="Quick numbers surfaced like a proper desktop profile rail." />
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-og-lime/15 bg-og-lime/[0.05] px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-og-lime/70">Current level</p>
                      <p className="mt-1 text-xl font-black text-white">{profileData?.current_level ? `Lvl ${profileData.current_level}` : "Not ranked yet"}</p>
                    </div>
                    <div className="rounded-2xl border border-sky-400/15 bg-sky-400/[0.05] px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-300/70">XP</p>
                      <p className="mt-1 text-xl font-black text-white">{profileData?.xp ? `${compact(profileData.xp)} XP` : "No XP yet"}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-200/70">Team status</p>
                      <p className="mt-1 text-xl font-black text-white">{teamLabel || "Community member"}</p>
                    </div>
                  </div>
                </Surface>
              </div>
            </div>
          )}

          {(activeTab === "followers" || activeTab === "following") && (
            <div className="space-y-4">
              <Surface className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/22" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={`Search ${activeTab}…`}
                    className="w-full rounded-full border border-white/[0.08] bg-white/[0.03] py-3 pl-10 pr-10 text-sm text-white/75 placeholder:text-white/25 outline-none focus:border-white/18"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 transition hover:text-white/60">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </Surface>

              <Surface className="p-0 overflow-hidden">
                {viewLoading || friends.loading ? (
                  <div className="flex justify-center py-10">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-og-lime border-t-transparent" />
                  </div>
                ) : filterList(activeTab === "followers" ? followersList : followingList).length === 0 ? (
                  <div className="py-14 text-center">
                    <Users className="mx-auto h-9 w-9 text-white/[0.08]" />
                    <p className="mt-3 text-sm text-white/28">No {activeTab} yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.06]">
                    {filterList(activeTab === "followers" ? followersList : followingList).map(record => {
                      const isMe = record.user_id === user?.id;
                      const amFollowing = friends.isFollowing(record.user_id);
                      const isMutual = friends.isMutual(record.user_id);
                      const recordDisplayName = record.display_name || record.username || "Anon";
                      const recordTeamMember = isTeamMember(record);

                      return (
                        <div key={record.user_id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                          <button onClick={() => !isMe && setViewingUser(record.user_id)} className="shrink-0 self-start">
                            <img
                              src={record.avatar_url || dicebear(record.username || record.user_id)}
                              alt=""
                              className="h-12 w-12 rounded-full object-cover"
                              onError={e => { (e.target as HTMLImageElement).src = dicebear(record.user_id); }}
                            />
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <button onClick={() => !isMe && setViewingUser(record.user_id)} className="truncate text-sm font-black text-white hover:underline">
                                {recordDisplayName}
                              </button>
                              {record.verified && <VerifyMark tone="blue" className="h-4 w-4" />}
                              {recordTeamMember && <VerifyMark tone="gold" className="h-4 w-4" />}
                              {recordTeamMember && <TeamPill official={record.is_official_account} />}
                              {isMutual && <span className="rounded-full border border-og-lime/25 bg-og-lime/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-og-lime">Follows you</span>}
                            </div>
                            <p className="mt-1 text-sm text-white/35">@{record.username || record.user_id.slice(0, 8)}</p>
                            {record.bio && <p className="mt-2 text-sm text-white/52">{record.bio}</p>}
                          </div>

                          {!isMe && user && (
                            <button
                              onClick={() => amFollowing ? friends.unfollow(record.user_id) : friends.follow(record.user_id)}
                              className={cn(
                                "shrink-0 rounded-full px-4 py-2 text-[12px] font-bold transition",
                                amFollowing
                                  ? "border border-white/15 text-white/75 hover:border-red-500/30 hover:text-red-400"
                                  : "bg-white text-black hover:bg-white/90",
                              )}
                            >
                              {amFollowing ? "Following" : "Follow"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Surface>
            </div>
          )}

          {activeTab === "settings" && isOwnProfile && (
            <Surface>
              <SectionTitle icon={Settings} title="Profile settings" subtitle="Full-width desktop editor instead of the narrow old profile panel." />
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-white/38">Display name</label>
                  <Input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} placeholder="Your display name" className="h-12 rounded-2xl border-white/[0.08] bg-white/[0.03] text-sm" />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-white/38">Username</label>
                  <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4">
                    <span className="text-sm text-white/30">@</span>
                    <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="username" className="h-12 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-white/38">Bio</label>
                  <textarea
                    value={editBio}
                    onChange={e => setEditBio(e.target.value)}
                    maxLength={160}
                    rows={5}
                    placeholder="Tell the world about yourself"
                    className="w-full resize-none rounded-[22px] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-white/18"
                  />
                  <p className="mt-1 text-right text-[11px] text-white/24">{editBio.length}/160</p>
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-white/38">Location</label>
                  <Input value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="Where are you based?" className="h-12 rounded-2xl border-white/[0.08] bg-white/[0.03] text-sm" />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-white/38">Website</label>
                  <Input value={editWebsite} onChange={e => setEditWebsite(e.target.value)} placeholder="https://yoursite.com" className="h-12 rounded-2xl border-white/[0.08] bg-white/[0.03] text-sm" />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className="rounded-full bg-white px-6 py-3 text-[13px] font-black text-black transition hover:bg-white/90 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save profile"}
                </button>
                <button
                  onClick={() => { signOut(); toast.success("Signed out"); }}
                  className="rounded-full border border-red-500/18 bg-red-500/[0.05] px-6 py-3 text-[13px] font-black text-red-300 transition hover:bg-red-500/[0.1]"
                >
                  <span className="inline-flex items-center gap-2"><LogOut className="h-4 w-4" /> Sign out</span>
                </button>
              </div>
            </Surface>
          )}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          <Surface>
            <SectionTitle icon={Zap} title="Highlights" subtitle="The right rail gives the profile real desktop weight, closer to X." />
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/[0.08] bg-[#0b1420] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/28">Verification</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {profileData?.verified ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/28 bg-sky-400/[0.12] px-3 py-1 text-[11px] font-bold text-sky-200">
                      <VerifyMark tone="blue" className="h-4 w-4" /> Verified
                    </span>
                  ) : (
                    <span className="text-sm text-white/38">No blue verification</span>
                  )}
                  {teamMember ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/28 bg-amber-400/[0.12] px-3 py-1 text-[11px] font-bold text-amber-100">
                      <VerifyMark tone="gold" className="h-4 w-4" /> Gold team badge
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#0b1420] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/28">Account ID</p>
                <button onClick={copyId} className="mt-2 flex w-full items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 transition hover:bg-white/[0.05]">
                  <span className="truncate font-mono text-[11px] text-white/48">{profileData?.user_id}</span>
                  {copied ? <Check className="h-4 w-4 shrink-0 text-og-lime" /> : <Copy className="h-4 w-4 shrink-0 text-white/28" />}
                </button>
              </div>
            </div>
          </Surface>
        </aside>
      </div>
    </div>
  );
};

export default UserProfile;
