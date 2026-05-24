/**
 * UserProfile — Full profile page with real Supabase data,
 * followers/following lists, settings, activity, and public profile viewing.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  User, Users, UserPlus, UserMinus, Star, Trophy, Shield, Flame,
  Settings, History, Bell, Eye, Moon, Copy, Check, LogOut,
  ChevronLeft, Search, X, Heart, MessageSquare, Target, ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useFriends, FollowerRecord } from "@/hooks/useFriends";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

type ProfileTab = "overview" | "followers" | "following" | "settings" | "activity";

interface ProfileData {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  badge: string | null;
  followers_count: number;
  following_count: number;
  created_at: string | null;
}

interface Props {
  /** If set, view another user's profile. Otherwise, show own profile. */
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
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // For viewing another user's followers/following
  const [viewFollowers, setViewFollowers] = useState<FollowerRecord[]>([]);
  const [viewFollowing, setViewFollowing] = useState<FollowerRecord[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  // Settings state (own profile only)
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [saving, setSaving] = useState(false);

  // Search within followers/following
  const [searchQuery, setSearchQuery] = useState("");

  // Sub-profile view (click on a follower to see their profile)
  const [viewingUser, setViewingUser] = useState<string | null>(null);

  /* ─── Fetch profile data ─── */
  const fetchProfile = useCallback(async () => {
    const targetId = viewUserId || user?.id;
    if (!targetId) return;
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, avatar_url, bio, badge, followers_count, following_count, created_at")
      .eq("user_id", targetId)
      .single();
    if (data) {
      setProfileData(data as ProfileData);
      if (isOwnProfile) {
        setEditName(data.username || "");
        setEditBio(data.bio || "");
      }
    }
    setLoading(false);
  }, [viewUserId, user?.id, isOwnProfile]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  /* ─── Fetch followers/following for viewed user ─── */
  const fetchViewFollows = useCallback(async () => {
    const targetId = viewUserId || user?.id;
    if (!targetId) return;
    setViewLoading(true);

    // People who follow this user
    const { data: followerRows } = await supabase
      .from("followers")
      .select("follower_id")
      .eq("followee_id", targetId);
    const followerIds = followerRows?.map(r => r.follower_id) || [];

    // People this user follows
    const { data: followingRows } = await supabase
      .from("followers")
      .select("followee_id")
      .eq("follower_id", targetId);
    const followingIds = followingRows?.map(r => r.followee_id) || [];

    const allIds = [...new Set([...followerIds, ...followingIds])];
    let profileMap = new Map<string, any>();
    if (allIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, bio, badge")
        .in("user_id", allIds);
      profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
    }

    const mapToRecord = (ids: string[]): FollowerRecord[] =>
      ids.map(id => {
        const p = profileMap.get(id);
        return {
          id, user_id: id,
          username: p?.username || null,
          avatar_url: p?.avatar_url || null,
          bio: p?.bio || null,
          badge: p?.badge || null,
        };
      });

    setViewFollowers(mapToRecord(followerIds));
    setViewFollowing(mapToRecord(followingIds));
    setViewLoading(false);
  }, [viewUserId, user?.id]);

  useEffect(() => {
    if (activeTab === "followers" || activeTab === "following") {
      if (isOwnProfile) {
        friends.refresh();
      } else {
        fetchViewFollows();
      }
    }
  }, [activeTab]);

  /* ─── Save profile settings ─── */
  const saveSettings = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username: editName.trim() || null, bio: editBio.trim() || null })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error("Failed to save");
    else { toast.success("Profile updated!"); fetchProfile(); }
  };

  const copyUserId = () => {
    const id = profileData?.user_id || "";
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ─── If viewing a sub-profile (clicked user) ─── */
  if (viewingUser) {
    return (
      <div>
        <button
          onClick={() => setViewingUser(null)}
          className="flex items-center gap-1.5 mb-3 text-[11px] font-bold text-og-cyan hover:text-og-lime transition"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back to profile
        </button>
        <UserProfile viewUserId={viewingUser} />
      </div>
    );
  }

  const avatarUrl = profileData?.avatar_url || dicebear(profileData?.username || "og");
  const displayName = profileData?.username || "OG User";
  const followerCount = isOwnProfile ? friends.followerCount : viewFollowers.length;
  const followingCount = isOwnProfile ? friends.followingCount : viewFollowing.length;
  const followersList = isOwnProfile ? friends.followers : viewFollowers;
  const followingList = isOwnProfile ? friends.following : viewFollowing;

  const TABS: { id: ProfileTab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "followers", label: "Followers", count: followerCount },
    { id: "following", label: "Following", count: followingCount },
    ...(isOwnProfile ? [
      { id: "settings" as ProfileTab, label: "Settings" },
      { id: "activity" as ProfileTab, label: "Activity" },
    ] : []),
  ];

  /* ─── Filter list by search ─── */
  const filterList = (list: FollowerRecord[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(r =>
      (r.username || "").toLowerCase().includes(q) ||
      r.user_id.toLowerCase().includes(q)
    );
  };

  /* ─── Render a user card ─── */
  const renderUserCard = (record: FollowerRecord) => {
    const isMe = record.user_id === user?.id;
    const amFollowing = friends.isFollowing(record.user_id);
    const isMutual = friends.isMutual(record.user_id);

    return (
      <div
        key={record.user_id}
        className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition hover:bg-white/[0.04]"
      >
        {/* Avatar */}
        <button onClick={() => !isMe && setViewingUser(record.user_id)} className="shrink-0">
          <img
            src={record.avatar_url || dicebear(record.username || record.user_id)}
            alt=""
            className="h-10 w-10 rounded-full border border-white/10 object-cover"
            onError={e => { (e.target as HTMLImageElement).src = dicebear(record.user_id); }}
          />
        </button>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <button
            onClick={() => !isMe && setViewingUser(record.user_id)}
            className="flex items-center gap-1.5 text-left"
          >
            <span className="truncate text-xs font-bold text-og-cyan hover:text-og-lime transition">
              @{record.username || "anon"}
            </span>
            {record.badge && (
              <span className="rounded-full bg-og-gold/15 px-1.5 py-0.5 text-[8px] font-bold text-og-gold">{record.badge}</span>
            )}
            {isMutual && (
              <span className="rounded-full bg-og-lime/15 px-1.5 py-0.5 text-[8px] font-bold text-og-lime">Mutual</span>
            )}
            {isMe && (
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[8px] font-bold text-white/40">You</span>
            )}
          </button>
          {record.bio && (
            <p className="mt-0.5 truncate text-[10px] text-white/25">{record.bio}</p>
          )}
        </div>

        {/* Follow/Unfollow button */}
        {!isMe && user && (
          <button
            onClick={() => amFollowing ? friends.unfollow(record.user_id) : friends.follow(record.user_id)}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition",
              amFollowing
                ? "border border-white/10 text-white/40 hover:border-red-500/30 hover:text-red-400"
                : "bg-og-lime/15 text-og-lime hover:bg-og-lime/25",
            )}
          >
            {amFollowing ? (
              <><UserMinus className="h-3 w-3" /> Unfollow</>
            ) : (
              <><UserPlus className="h-3 w-3" /> Follow</>
            )}
          </button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-og-lime border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      {/* ─── Profile Header ─── */}
      <div className="relative">
        {/* Banner */}
        <div className="h-20 bg-gradient-to-r from-og-lime/10 via-og-cyan/10 to-og-gold/10" />

        {/* Avatar + info */}
        <div className="px-4 pb-4">
          <div className="flex items-end gap-3 -mt-8">
            <div className="relative">
              <img
                src={avatarUrl}
                alt=""
                className="h-16 w-16 rounded-2xl border-4 border-[#0a1018] object-cover bg-white/5"
                onError={e => { (e.target as HTMLImageElement).src = dicebear("og"); }}
              />
              {profileData?.badge && (
                <span className="absolute -bottom-1 -right-1 rounded-full bg-og-gold/20 px-1.5 py-0.5 text-[8px] font-bold text-og-gold border border-og-gold/30">
                  {profileData.badge}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white truncate">{displayName}</h2>
                {!isOwnProfile && user && (
                  <button
                    onClick={() => friends.isFollowing(profileData?.user_id || "") ? friends.unfollow(profileData?.user_id || "") : friends.follow(profileData?.user_id || "")}
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-bold transition",
                      friends.isFollowing(profileData?.user_id || "")
                        ? "border border-white/10 text-white/40 hover:border-red-500/30 hover:text-red-400"
                        : "bg-og-lime/15 text-og-lime hover:bg-og-lime/25",
                    )}
                  >
                    {friends.isFollowing(profileData?.user_id || "") ? (
                      <><UserMinus className="h-3 w-3" /> Unfollow</>
                    ) : (
                      <><UserPlus className="h-3 w-3" /> Follow</>
                    )}
                  </button>
                )}
              </div>
              {profileData?.bio && (
                <p className="text-[11px] text-white/35 mt-0.5 truncate">{profileData.bio}</p>
              )}
              <button onClick={copyUserId} className="flex items-center gap-1 text-[9px] text-white/20 hover:text-white/40 mt-0.5 transition">
                ID: {(profileData?.user_id || "").slice(0, 12)}...
                {copied ? <Check className="h-2.5 w-2.5 text-og-lime" /> : <Copy className="h-2.5 w-2.5" />}
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2 mt-3">
            <button
              onClick={() => setActiveTab("followers")}
              className={cn(
                "rounded-xl p-2.5 text-center transition border",
                activeTab === "followers"
                  ? "border-og-lime/30 bg-og-lime/[0.06]"
                  : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]",
              )}
            >
              <p className="text-sm font-black text-white">{profileData?.followers_count ?? followerCount}</p>
              <p className="text-[8px] font-semibold text-white/30">Followers</p>
            </button>
            <button
              onClick={() => setActiveTab("following")}
              className={cn(
                "rounded-xl p-2.5 text-center transition border",
                activeTab === "following"
                  ? "border-og-cyan/30 bg-og-cyan/[0.06]"
                  : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]",
              )}
            >
              <p className="text-sm font-black text-white">{profileData?.following_count ?? followingCount}</p>
              <p className="text-[8px] font-semibold text-white/30">Following</p>
            </button>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-center">
              <p className="text-sm font-black text-white">{isOwnProfile ? friends.mutualCount : 0}</p>
              <p className="text-[8px] font-semibold text-white/30">Mutuals</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-center">
              <p className="text-sm font-black text-white">
                {profileData?.created_at ? new Date(profileData.created_at).toLocaleDateString("en", { month: "short", year: "2-digit" }) : "—"}
              </p>
              <p className="text-[8px] font-semibold text-white/30">Joined</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tab navigation ─── */}
      <div className="flex border-y border-white/[0.06] overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearchQuery(""); }}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide transition",
              activeTab === tab.id
                ? "text-og-lime border-b-2 border-og-lime"
                : "text-white/25 hover:text-white/45",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[8px] font-bold",
                activeTab === tab.id ? "bg-og-lime/15 text-og-lime" : "bg-white/[0.05] text-white/25",
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Tab content ─── */}
      <div className="p-4">
        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Achievements */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-3">Achievements</p>
              <div className="flex gap-2.5 flex-wrap">
                {[
                  { emoji: "🔍", label: "First Scan" },
                  { emoji: "⭐", label: "Early Adopter" },
                  { emoji: "🗺️", label: "Explorer" },
                  { emoji: "🎙️", label: "Voice Chat" },
                  { emoji: "👥", label: "Community" },
                  { emoji: "🏆", label: "Top Trader" },
                ].map(a => (
                  <div key={a.label} className="flex flex-col items-center gap-1">
                    <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-lg hover:scale-110 transition" title={a.label}>
                      {a.emoji}
                    </div>
                    <span className="text-[7px] font-semibold text-white/20">{a.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mutual friends preview */}
            {isOwnProfile && friends.mutualCount > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-3">
                  Mutual Friends — {friends.mutualCount}
                </p>
                <div className="space-y-1.5">
                  {friends.mutuals.slice(0, 5).map(m => renderUserCard(m))}
                  {friends.mutualCount > 5 && (
                    <p className="text-center text-[10px] text-white/20 pt-1">
                      +{friends.mutualCount - 5} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Quick actions (own profile) */}
            {isOwnProfile && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setActiveTab("settings")}
                  className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:bg-white/[0.04]"
                >
                  <Settings className="h-4 w-4 text-white/30" />
                  <span className="text-[11px] font-bold text-white/50">Edit Profile</span>
                </button>
                <button
                  onClick={signOut}
                  className="flex items-center gap-2 rounded-xl border border-red-500/10 bg-red-500/[0.03] p-3 transition hover:bg-red-500/[0.06]"
                >
                  <LogOut className="h-4 w-4 text-red-400/50" />
                  <span className="text-[11px] font-bold text-red-400/60">Sign Out</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* FOLLOWERS */}
        {activeTab === "followers" && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
                <input
                  type="text"
                  placeholder="Search followers..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 pl-8 pr-3 text-[11px] text-white placeholder:text-white/20 outline-none focus:border-og-lime/30"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <X className="h-3 w-3 text-white/30" />
                  </button>
                )}
              </div>
              <span className="text-[10px] font-bold text-white/25">{followerCount} total</span>
            </div>

            {(friends.loading || viewLoading) ? (
              <div className="flex justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-og-lime border-t-transparent" />
              </div>
            ) : filterList(followersList).length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-8 w-8 text-white/[0.06] mx-auto mb-2" />
                <p className="text-xs text-white/20">{searchQuery ? "No results" : "No followers yet"}</p>
                <p className="text-[10px] text-white/10 mt-1">
                  {isOwnProfile ? "Share your profile to get followers" : "This user has no followers yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filterList(followersList).map(record => renderUserCard(record))}
              </div>
            )}
          </div>
        )}

        {/* FOLLOWING */}
        {activeTab === "following" && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
                <input
                  type="text"
                  placeholder="Search following..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 pl-8 pr-3 text-[11px] text-white placeholder:text-white/20 outline-none focus:border-og-cyan/30"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <X className="h-3 w-3 text-white/30" />
                  </button>
                )}
              </div>
              <span className="text-[10px] font-bold text-white/25">{followingCount} total</span>
            </div>

            {(friends.loading || viewLoading) ? (
              <div className="flex justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-og-cyan border-t-transparent" />
              </div>
            ) : filterList(followingList).length === 0 ? (
              <div className="text-center py-8">
                <Heart className="h-8 w-8 text-white/[0.06] mx-auto mb-2" />
                <p className="text-xs text-white/20">{searchQuery ? "No results" : "Not following anyone yet"}</p>
                <p className="text-[10px] text-white/10 mt-1">
                  {isOwnProfile ? "Discover and follow other traders" : "This user isn't following anyone yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filterList(followingList).map(record => renderUserCard(record))}
              </div>
            )}
          </div>
        )}

        {/* SETTINGS (own profile only) */}
        {activeTab === "settings" && isOwnProfile && (
          <div className="space-y-4">
            {/* Edit fields */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">Edit Profile</p>
              <div>
                <label className="text-[10px] font-semibold text-white/30">Display Name</label>
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Your display name"
                  className="mt-1 h-9 text-xs bg-white/[0.03] border-white/[0.08]"
                  maxLength={30}
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-white/30">Bio</label>
                <textarea
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white placeholder:text-white/20 outline-none focus:border-og-lime/30 resize-none"
                  rows={3}
                  maxLength={160}
                />
                <p className="text-right text-[9px] text-white/15">{editBio.length}/160</p>
              </div>
              <button
                onClick={saveSettings}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-og-lime/15 py-2.5 text-[11px] font-bold text-og-lime transition hover:bg-og-lime/25 disabled:opacity-50"
              >
                {saving ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-og-lime border-t-transparent" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Save Changes
              </button>
            </div>

            {/* Preferences */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1">Preferences</p>
              {[
                { label: "Notifications", icon: <Bell className="h-3.5 w-3.5" />, key: "notifications" },
                { label: "Public Profile", icon: <Eye className="h-3.5 w-3.5" />, key: "publicProfile" },
                { label: "Sound Effects", icon: <Target className="h-3.5 w-3.5" />, key: "soundEffects" },
              ].map(toggle => {
                const val = localStorage.getItem("ogscan_user_profile");
                const settings = val ? JSON.parse(val) : {};
                const isOn = settings[toggle.key] ?? true;
                return (
                  <button
                    key={toggle.key}
                    onClick={() => {
                      const updated = { ...settings, [toggle.key]: !isOn };
                      localStorage.setItem("ogscan_user_profile", JSON.stringify(updated));
                      toast.success(`${toggle.label} ${!isOn ? "enabled" : "disabled"}`);
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-white/[0.06] hover:bg-white/[0.03] transition"
                  >
                    <span className="text-white/25">{toggle.icon}</span>
                    <span className="text-[11px] text-white/50 flex-1 text-left">{toggle.label}</span>
                    <div className={cn("w-8 h-4 rounded-full transition", isOn ? "bg-og-lime" : "bg-white/10")}>
                      <div className={cn("w-3 h-3 rounded-full bg-white transition-all mt-0.5", isOn ? "ml-[18px]" : "ml-0.5")} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Danger zone */}
            <div className="rounded-xl border border-red-500/10 bg-red-500/[0.02] p-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-red-400/40 mb-2">Account</p>
              <button
                onClick={signOut}
                className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-[11px] font-bold text-red-400 transition hover:bg-red-500/20"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign Out
              </button>
            </div>
          </div>
        )}

        {/* ACTIVITY */}
        {activeTab === "activity" && (
          <div className="text-center py-8">
            <History className="h-10 w-10 text-white/[0.06] mx-auto mb-2" />
            <p className="text-sm font-bold text-white/15">Activity feed coming soon</p>
            <p className="text-[10px] text-white/10 mt-1">Your scans, trades, voice sessions, and follows will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
