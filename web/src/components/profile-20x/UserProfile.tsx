/**
 * UserProfile — X/Twitter-inspired profile page.
 * Full-width banner, round avatar, bio, follower/following counts,
 * tabs for Overview, Followers, Following, Settings (own profile only).
 * Wired to Supabase profiles + followers tables.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  User, Users, UserPlus, UserMinus, Star, Shield, Copy, Check,
  LogOut, ChevronLeft, Search, X, Calendar, MapPin, Link2,
  Settings, Edit3, Camera, MoreHorizontal, MessageSquare,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useFriends, FollowerRecord } from "@/hooks/useFriends";
import { formatDistanceToNow } from "date-fns";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */

export const UserProfile: React.FC<Props> = ({ viewUserId }) => {
  const { user, profile: authProfile, signOut } = useAuth();
  const friends = useFriends();

  const isOwnProfile = !viewUserId || viewUserId === user?.id;

  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [profileBadges, setProfileBadges] = useState<ProfileBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Followers/following for viewed user
  const [viewFollowers, setViewFollowers] = useState<FollowerRecord[]>([]);
  const [viewFollowing, setViewFollowing] = useState<FollowerRecord[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  // Settings state
  const [editName, setEditName] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [saving, setSaving] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Sub-profile
  const [viewingUser, setViewingUser] = useState<string | null>(null);

  /* ─── Fetch profile ─── */
  const fetchProfile = useCallback(async () => {
    const targetId = viewUserId || user?.id;
    if (!targetId) return;
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, banner_url, bio, badge, location, website_url, followers_count, following_count, created_at, is_online, xp, current_level, total_pnl, trades_count, verified")
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

    // Fetch user badges (from badges table via user_badges)
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
    }

    // Fetch profile badges (custom admin-assigned badges)
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
    }

    setLoading(false);
  }, [viewUserId, user?.id, isOwnProfile]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  /* ─── Fetch followers/following for viewed user ─── */
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
      const { data: profiles } = await supabase.from("profiles").select("user_id, username, avatar_url, bio, badge").in("user_id", allIds);
      profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
    }
    const toRecord = (ids: string[]): FollowerRecord[] => ids.map(id => {
      const p = profileMap.get(id);
      return { id, user_id: id, username: p?.username || null, avatar_url: p?.avatar_url || null, bio: p?.bio || null, badge: p?.badge || null };
    });
    setViewFollowers(toRecord(followerIds));
    setViewFollowing(toRecord(followingIds));
    setViewLoading(false);
  }, [viewUserId, user?.id]);

  useEffect(() => {
    if (activeTab === "followers" || activeTab === "following") {
      if (isOwnProfile) friends.refresh();
      else fetchViewFollows();
    }
  }, [activeTab]);

  /* ─── Save settings ─── */
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
    else { toast.success("Profile updated!"); fetchProfile(); }
  };

  const copyId = () => {
    navigator.clipboard.writeText(profileData?.user_id || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ─── Sub-profile navigation ─── */
  if (viewingUser) {
    return (
      <div>
        <button onClick={() => setViewingUser(null)} className="flex items-center gap-1.5 mb-3 text-[11px] font-bold text-white/50 hover:text-og-lime transition">
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

  const TABS: { id: ProfileTab; label: string; count?: number }[] = [
    { id: "overview", label: "Profile" },
    { id: "followers", label: "Followers", count: followerCount },
    { id: "following", label: "Following", count: followingCount },
    ...(isOwnProfile ? [{ id: "settings" as ProfileTab, label: "Settings" }] : []),
  ];

  const filterList = (list: FollowerRecord[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(r => (r.username || "").toLowerCase().includes(q) || r.user_id.toLowerCase().includes(q));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-og-lime border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* ═══ Banner ═══ */}
      <div className="relative">
        <div className={cn(
          "h-40 sm:h-52 w-full rounded-t-xl overflow-hidden",
          !profileData?.banner_url && "bg-gradient-to-br from-og-lime/15 via-og-cyan/10 to-og-gold/15",
        )}>
          {profileData?.banner_url && (
            <img src={profileData.banner_url} alt="" className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a1018] via-[#0a1018]/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent" />
        </div>

        {/* Avatar — overlapping banner */}
        <div className="absolute -bottom-[48px] left-4 sm:left-5">
          <div className="relative">
            <img
              src={avatarUrl}
              alt=""
              className="h-24 w-24 sm:h-28 sm:w-28 rounded-full border-4 border-[#0a1018] object-cover bg-[#0f1520] shadow-[0_0_20px_rgba(0,0,0,0.5)]"
              onError={e => { (e.target as HTMLImageElement).src = dicebear("og"); }}
            />
            {profileData?.is_online && (
              <div className="absolute bottom-1.5 right-1.5 h-4 w-4 rounded-full border-[3px] border-[#0a1018] bg-og-lime shadow-[0_0_8px_hsl(var(--og-lime)/0.6)]" />
            )}
          </div>
        </div>

        {/* Action buttons — top right of banner overlap area */}
        <div className="absolute -bottom-10 right-4 flex items-center gap-2">
          {isOwnProfile ? (
            <button
              onClick={() => setActiveTab("settings")}
              className="rounded-full border border-white/20 bg-[#0a1018] px-4 py-1.5 text-[11px] font-bold text-white/80 transition hover:bg-white/[0.08]"
            >
              Edit profile
            </button>
          ) : user && (
            <>
              <button className="rounded-full border border-white/15 bg-[#0a1018] p-2 text-white/50 transition hover:bg-white/[0.08]">
                <MoreHorizontal className="h-4 w-4" />
              </button>
              <button
                onClick={() => friends.isFollowing(profileData?.user_id || "") ? friends.unfollow(profileData?.user_id || "") : friends.follow(profileData?.user_id || "")}
                className={cn(
                  "rounded-full px-5 py-1.5 text-[12px] font-bold transition",
                  friends.isFollowing(profileData?.user_id || "")
                    ? "border border-white/20 bg-transparent text-white/80 hover:border-red-500/40 hover:text-red-400"
                    : "bg-white text-black hover:bg-white/90 shadow-[0_0_16px_rgba(255,255,255,0.15)]",
                )}
              >
                {friends.isFollowing(profileData?.user_id || "") ? "Following" : "Follow"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ═══ Profile Info ═══ */}
      <div className="mt-16 px-4 sm:px-5">
        {/* Name + verification */}
        <div className="flex items-center gap-1.5">
          <h1 className="text-xl font-black text-white truncate">{displayName}</h1>
          {profileData?.verified && (
            <svg viewBox="0 0 22 22" className="h-5 w-5 text-og-cyan" fill="currentColor">
              <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.274-.586-.705-1.084-1.246-1.439-.54-.354-1.17-.551-1.816-.569-.646.018-1.275.215-1.816.57-.54.354-.972.852-1.246 1.438-.607-.223-1.264-.27-1.897-.14-.634.131-1.218.437-1.687.882-.445.47-.75 1.053-.882 1.687-.13.633-.083 1.29.14 1.897-.586.274-1.084.705-1.439 1.246-.354.54-.551 1.17-.569 1.816.018.646.215 1.275.57 1.816.354.54.852.972 1.438 1.246-.223.607-.27 1.264-.14 1.897.131.634.437 1.218.882 1.687.47.445 1.053.75 1.687.882.633.13 1.29.083 1.897-.14.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.646-.018 1.275-.215 1.816-.57.54-.354.972-.852 1.246-1.438.607.223 1.264.27 1.897.14.634-.131 1.218-.437 1.687-.882.445-.47.75-1.053.882-1.687.13-.633.083-1.29-.14-1.897.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
            </svg>
          )}

        </div>

        {/* Handle */}
        {handle && (
          <p className="text-[13px] text-white/35">{handle}</p>
        )}

        {/* Badges row — deduplicate across user_badges and profile_badges */}
        {(userBadges.length > 0 || profileBadges.length > 0) && (() => {
          const userBadgeNames = new Set(userBadges.map(b => b.name.toLowerCase()));
          const uniqueProfileBadges = profileBadges.filter(b => !userBadgeNames.has(b.label.toLowerCase()));
          if (userBadges.length === 0 && uniqueProfileBadges.length === 0) return null;
          return (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {userBadges.map(b => {
                const rarityColors: Record<string, string> = {
                  legendary: "bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.15)]",
                  epic: "bg-purple-500/20 text-purple-300 border-purple-500/30",
                  rare: "bg-blue-500/20 text-blue-300 border-blue-500/30",
                  common: "bg-white/[0.08] text-white/60 border-white/10",
                };
                const cls = rarityColors[(b.rarity ?? "common").toLowerCase()] ?? rarityColors.common;
                return (
                  <span key={b.id} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold", cls)}>
                    {b.icon && <span className="text-[11px]">{b.icon}</span>}
                    {b.name}
                  </span>
                );
              })}
              {uniqueProfileBadges.map(b => (
                <span
                  key={b.id}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                    b.glow ? "shadow-[0_0_8px_rgba(190,242,100,0.2)]" : "",
                  )}
                  style={{
                    backgroundColor: b.color ? `${b.color}20` : "rgba(255,255,255,0.06)",
                    color: b.color || "rgba(255,255,255,0.6)",
                    borderColor: b.color ? `${b.color}40` : "rgba(255,255,255,0.1)",
                  }}
                >
                  {b.icon && <span className="text-[11px]">{b.icon}</span>}
                  {b.label}
                </span>
              ))}
            </div>
          );
        })()}

        {/* Bio */}
        {profileData?.bio && (
          <p className="mt-2 text-[13px] leading-relaxed text-white/65">{profileData.bio}</p>
        )}

        {/* Meta row — location, link, join date */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-white/30">
          {profileData?.location && (
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{profileData.location}</span>
          )}
          {profileData?.website_url && (
            <a href={profileData.website_url.startsWith("http") ? profileData.website_url : `https://${profileData.website_url}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-og-cyan hover:underline">
              <Link2 className="h-3.5 w-3.5" />{profileData.website_url.replace(/^https?:\/\//, "").slice(0, 30)}
            </a>
          )}
          {profileData?.created_at && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Joined {new Date(profileData.created_at).toLocaleDateString("en", { month: "long", year: "numeric" })}
            </span>
          )}
        </div>

        {/* Follower / Following counts */}
        <div className="mt-3 flex items-center gap-5">
          <button onClick={() => setActiveTab("following")} className="group text-[13px]">
            <span className="font-bold text-white">{profileData?.following_count ?? followingCount}</span>
            <span className="ml-1 text-white/35 group-hover:text-white/50 transition">Following</span>
          </button>
          <button onClick={() => setActiveTab("followers")} className="group text-[13px]">
            <span className="font-bold text-white">{profileData?.followers_count ?? followerCount}</span>
            <span className="ml-1 text-white/35 group-hover:text-white/50 transition">Followers</span>
          </button>
          {isOwnProfile && friends.mutualCount > 0 && (
            <span className="text-[13px]">
              <span className="font-bold text-white">{friends.mutualCount}</span>
              <span className="ml-1 text-white/35">Mutuals</span>
            </span>
          )}
        </div>

        {/* Stats badges — XP, Level, PnL */}
        {(profileData?.current_level || profileData?.xp || profileData?.trades_count) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {profileData?.current_level != null && profileData.current_level > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-og-lime/25 bg-og-lime/[0.08] px-3 py-1.5 text-[11px] font-bold text-og-lime shadow-[0_0_12px_hsl(var(--og-lime)/0.15)]">
                <Star className="h-3.5 w-3.5" /> Lvl {profileData.current_level}
              </span>
            )}
            {profileData?.xp != null && profileData.xp > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-og-cyan/20 bg-og-cyan/[0.06] px-2.5 py-1 text-[10px] font-bold text-og-cyan">
                ⚡ {profileData.xp.toLocaleString()} XP
              </span>
            )}
            {profileData?.trades_count != null && profileData.trades_count > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-og-gold/20 bg-og-gold/[0.06] px-2.5 py-1 text-[10px] font-bold text-og-gold">
                📊 {profileData.trades_count} trades
              </span>
            )}
            {profileData?.total_pnl != null && profileData.total_pnl !== 0 && (
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold",
                profileData.total_pnl >= 0
                  ? "border-green-500/20 bg-green-500/[0.06] text-green-400"
                  : "border-red-500/20 bg-red-500/[0.06] text-red-400",
              )}>
                💰 {profileData.total_pnl >= 0 ? "+" : ""}{profileData.total_pnl.toFixed(2)} SOL
              </span>
            )}
          </div>
        )}
      </div>

      {/* ═══ Tab Bar — X-style underline tabs ═══ */}
      <div className="mt-5 flex border-b border-white/[0.07] bg-white/[0.01]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearchQuery(""); }}
            className={cn(
              "relative flex-1 py-3 text-center text-[13px] font-bold transition",
              activeTab === tab.id ? "text-white" : "text-white/35 hover:text-white/55 hover:bg-white/[0.03]",
            )}
          >
            {tab.label}
            {tab.count !== undefined && <span className="ml-1 text-[11px] text-white/25">{tab.count}</span>}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-1/2 h-[3px] w-14 -translate-x-1/2 rounded-full bg-og-lime shadow-[0_0_8px_hsl(var(--og-lime)/0.4)]" />
            )}
          </button>
        ))}
      </div>

      {/* ═══ Tab Content ═══ */}
      <div className="px-4 py-4 sm:px-5">
        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Achievements / badges placeholder */}
            <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5">
              <h3 className="text-[13px] font-black text-white/70 mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Shield className="h-4 w-4 text-og-gold" /> Achievements
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {[
                  { emoji: "🚀", label: "Early Adopter", active: true },
                  { emoji: "🎯", label: "Token Scanner", active: (profileData?.trades_count || 0) > 0 },
                  { emoji: "💬", label: "Social Butterfly", active: (profileData?.following_count || 0) >= 5 },
                  { emoji: "🔥", label: "Streak Master", active: false },
                  { emoji: "👑", label: "OG Status", active: !!profileData?.badge },
                  { emoji: "🏆", label: "Top Trader", active: (profileData?.total_pnl || 0) > 0 },
                  { emoji: "🎙️", label: "Voice Regular", active: false },
                  { emoji: "💎", label: "Diamond Hands", active: false },
                ].map(a => (
                  <div
                    key={a.label}
                    className={cn(
                      "group relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all duration-300",
                      a.active
                        ? "border-og-gold/25 bg-gradient-to-b from-og-gold/[0.08] to-og-gold/[0.02] shadow-[0_0_16px_hsl(var(--og-gold)/0.1)] hover:shadow-[0_0_24px_hsl(var(--og-gold)/0.2)] hover:border-og-gold/40"
                        : "border-white/[0.05] bg-white/[0.01] opacity-25 grayscale",
                    )}
                  >
                    {a.active && <div className="absolute -top-px -right-px h-2 w-2 rounded-full bg-og-lime shadow-[0_0_6px_hsl(var(--og-lime)/0.8)]" />}
                    <span className="text-2xl drop-shadow-lg">{a.emoji}</span>
                    <span className={cn("text-[9px] font-bold", a.active ? "text-og-gold/80" : "text-white/40")}>{a.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* User ID card */}
            <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5">
              <h3 className="text-[13px] font-black text-white/70 mb-3 uppercase tracking-wider">Account</h3>
              <button onClick={copyId} className="flex w-full items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 transition hover:bg-white/[0.06]">
                <span className="font-mono text-[11px] text-white/40 truncate">{profileData?.user_id}</span>
                {copied ? <Check className="h-3.5 w-3.5 text-og-lime shrink-0" /> : <Copy className="h-3.5 w-3.5 text-white/25 shrink-0" />}
              </button>
              {isOwnProfile && (
                <button
                  onClick={() => { signOut(); toast.success("Signed out"); }}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/15 bg-red-500/[0.04] py-2 text-[11px] font-bold text-red-400/60 transition hover:bg-red-500/[0.08]"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
              )}
            </div>
          </div>
        )}

        {/* FOLLOWERS / FOLLOWING */}
        {(activeTab === "followers" || activeTab === "following") && (
          <div className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeTab}…`}
                className="w-full rounded-full border border-white/[0.08] bg-white/[0.03] py-2 pl-9 pr-4 text-[12px] text-white/70 placeholder:text-white/20 outline-none focus:border-white/15"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* List */}
            {viewLoading || friends.loading ? (
              <div className="flex justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-og-lime border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-1">
                {filterList(activeTab === "followers" ? followersList : followingList).length === 0 ? (
                  <div className="py-10 text-center">
                    <Users className="mx-auto h-8 w-8 text-white/[0.06] mb-2" />
                    <p className="text-[12px] text-white/20">No {activeTab} yet</p>
                  </div>
                ) : (
                  filterList(activeTab === "followers" ? followersList : followingList).map(record => {
                    const isMe = record.user_id === user?.id;
                    const amFollowing = friends.isFollowing(record.user_id);
                    const isMutual = friends.isMutual(record.user_id);
                    return (
                      <div key={record.user_id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/[0.03]">
                        <button onClick={() => !isMe && setViewingUser(record.user_id)} className="shrink-0">
                          <img
                            src={record.avatar_url || dicebear(record.username || record.user_id)}
                            alt=""
                            className="h-10 w-10 rounded-full object-cover"
                            onError={e => { (e.target as HTMLImageElement).src = dicebear(record.user_id); }}
                          />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => !isMe && setViewingUser(record.user_id)} className="truncate text-[13px] font-bold text-white hover:underline">
                              {record.username || "Anon"}
                            </button>
                            {isMutual && <span className="shrink-0 rounded-full bg-og-lime/10 px-1.5 py-0.5 text-[8px] font-bold text-og-lime">Follows you</span>}
                          </div>
                          <p className="text-[12px] text-white/30">@{record.username || record.user_id.slice(0, 8)}</p>
                          {record.bio && <p className="mt-0.5 text-[11px] text-white/20 truncate">{record.bio}</p>}
                        </div>
                        {!isMe && user && (
                          <button
                            onClick={() => amFollowing ? friends.unfollow(record.user_id) : friends.follow(record.user_id)}
                            className={cn(
                              "shrink-0 rounded-full px-4 py-1.5 text-[11px] font-bold transition",
                              amFollowing
                                ? "border border-white/15 text-white/70 hover:border-red-500/30 hover:text-red-400"
                                : "bg-white text-black hover:bg-white/90",
                            )}
                          >
                            {amFollowing ? "Following" : "Follow"}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === "settings" && isOwnProfile && (
          <div className="space-y-4 max-w-md">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold text-white/40">Display Name</label>
              <Input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} placeholder="Your display name" className="bg-white/[0.03] border-white/[0.08] text-sm" />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold text-white/40">Username</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-white/30">@</span>
                <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="username" className="bg-white/[0.03] border-white/[0.08] text-sm" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold text-white/40">Bio</label>
              <textarea
                value={editBio}
                onChange={e => setEditBio(e.target.value)}
                maxLength={160}
                rows={3}
                placeholder="Tell the world about yourself"
                className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-white/15"
              />
              <p className="text-right text-[10px] text-white/20">{editBio.length}/160</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold text-white/40">Location</label>
              <Input value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="Where are you based?" className="bg-white/[0.03] border-white/[0.08] text-sm" />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold text-white/40">Website</label>
              <Input value={editWebsite} onChange={e => setEditWebsite(e.target.value)} placeholder="https://yoursite.com" className="bg-white/[0.03] border-white/[0.08] text-sm" />
            </div>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="w-full rounded-full bg-white py-2.5 text-[13px] font-bold text-black transition hover:bg-white/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
