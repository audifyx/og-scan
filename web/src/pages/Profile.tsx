import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  User, Settings, Twitter, Globe, MessageCircle, Trophy, TrendingUp, Users, Activity,
  Copy, Check, UserPlus, UserMinus, Wallet, Coins, ArrowUpRight, ArrowDownRight,
  RefreshCw, ExternalLink, Percent, Flame, Camera, Shield, Star, Hash, Lock,
  BarChart3, Crown, Medal, Award, Zap, Heart, Clock, ChevronRight, Edit3,
  Image as ImageIcon, CheckCircle, XCircle, AlertCircle, Bookmark, ChevronLeft,
  MapPin, Link as LinkIcon, Calendar, X as XIcon,
} from "lucide-react";
import { AvatarSelector, renderAvatar } from "@/components/avatars/AvatarSelector";
import { safeAvatarUrl } from "@/lib/utils";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { useFriends } from "@/hooks/useFriends";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  twitter_handle: string | null;
  discord_handle: string | null;
  website: string | null;
  total_pnl: number;
  win_rate: number;
  trades_count: number;
  followers_count: number;
  following_count: number;
  is_public: boolean;
  badge: string | null;
  wallet_address?: string;
  reputation_score?: number | null;
  current_level?: number | null;
  daily_streak?: number | null;
  total_xp?: number | null;
  xp?: number | null;
  is_pioneer?: boolean;
  referral_code?: string | null;
  holder_streak?: number | null;
  longest_streak?: number | null;
  sol_wallet?: string | null;
  website_url?: string | null;
  display_name?: string | null;
  verified?: boolean;
  location?: string | null;
  created_at?: string;
}

interface UserActivity {
  id: string;
  activity_type: string;
  title: string;
  description: string | null;
  data: any;
  created_at: string;
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
  content: { metadata: { name: string; symbol: string }; links?: { image?: string } };
  token_info?: { balance: number; decimals: number; price_info?: { price_per_token: number; total_price: number } };
}

interface WalletTransaction {
  signature: string;
  type: string;
  timestamp?: number;
  description?: string;
  fee?: number;
  feePayer?: string;
  source?: string;
  nativeTransfers?: Array<{ fromUserAccount: string; toUserAccount: string; amount: number }>;
  tokenTransfers?: Array<{ fromUserAccount: string; toUserAccount: string; tokenAmount: number; mint: string }>;
}

interface UserCommunity {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const shortUsd = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return formatUsd(n);
};

const shortNum = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
};

const getBadgeGradient = (badge: string | null) => {
  switch (badge) {
    case "whale":   return "from-blue-500 to-cyan-500";
    case "diamond": return "from-cyan-400 to-blue-400";
    case "gold":    return "from-yellow-500 to-amber-500";
    case "silver":  return "from-gray-400 to-slate-400";
    default:        return "from-primary to-secondary";
  }
};

const getLevelTitle = (level: number | null | undefined) => {
  const lvl = level || 1;
  if (lvl >= 50) return "Legend";
  if (lvl >= 30) return "Elite";
  if (lvl >= 20) return "Veteran";
  if (lvl >= 10) return "Trader";
  if (lvl >= 5)  return "Scout";
  return "Rookie";
};

const getPrivacyIcon = (privacy: string) => {
  switch (privacy) {
    case "private":     return <Lock className="h-3 w-3" />;
    case "invite_only": return <Shield className="h-3 w-3" />;
    case "holder_only": return <Star className="h-3 w-3" />;
    default:            return <Globe className="h-3 w-3" />;
  }
};

// ─── Main Component ───────────────────────────────────────────────────────────

const Profile = () => {
  const { userId } = useParams();
  const { user, profile: currentUserProfile } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<UserProfile>>({});
  const [copied, setCopied] = useState(false);
  const [walletStats, setWalletStats] = useState<WalletStats | null>(null);
  const [tokenHoldings, setTokenHoldings] = useState<TokenHolding[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [transactionCount, setTransactionCount] = useState(0);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [communities, setCommunities] = useState<UserCommunity[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryRow[]>([]);
  const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = !userId || userId === user?.id;
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (targetUserId) {
      fetchProfile();
      fetchActivities();
      fetchCommunities();
      fetchTradeHistory();
      fetchLeaderboardRank();
      if (!isOwnProfile && user) checkFollowStatus();
      if (isOwnProfile && user) fetchBookmarks();
    }
  }, [targetUserId, user]);

  // ── Data fetchers ──────────────────────────────────────────────────────────

  const fetchWalletData = async (walletAddress: string) => {
    if (!walletAddress) return;
    setLoadingStats(true);
    try {
      const { data: overviewData, error: overviewError } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getWalletOverview", walletAddress },
      });
      if (!overviewError && overviewData) {
        setWalletStats(overviewData);
        if (isOwnProfile && user)
          await supabase.from("profiles").update({ total_pnl: overviewData.totalUsdValue || 0 }).eq("user_id", user.id);
      }
      const { data: assetsData, error: assetsError } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getAssets", walletAddress, page: 1, limit: 20 },
      });
      if (!assetsError && assetsData?.assets) {
        setTokenHoldings(assetsData.assets.filter((i: any) => i.interface === "FungibleToken" || i.interface === "FungibleAsset").slice(0, 20));
      }
      const { data: txData, error: txError } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTransactions", walletAddress, limit: 30 },
      });
      if (!txError && txData?.transactions) {
        setWalletTransactions(txData.transactions);
        setTransactionCount(txData.signatures?.length || txData.transactions.length);
      }
    } catch {}
    finally { setLoadingStats(false); setRefreshing(false); }
  };

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", targetUserId).single();
      if (error && error.code === "PGRST116") {
        if (isOwnProfile && user) {
          const newProfile = { user_id: user.id, username: null, avatar_url: null, bio: null, twitter_handle: null, discord_handle: null, website: null, total_pnl: 0, win_rate: 0, trades_count: 0, followers_count: 0, following_count: 0, is_public: true, badge: null, wallet_address: null };
          const { data: cp, error: ce } = await supabase.from("profiles").insert(newProfile).select().single();
          if (!ce) { setProfile(cp); setEditedProfile(cp); toast.success("Profile created!"); setEditing(true); }
          else setProfile(null);
        } else setProfile(null);
      } else if (error) { throw error; }
      else { setProfile(data); setEditedProfile(data); }
    } catch { setProfile(null); }
    finally { setLoading(false); }
  };

  const fetchActivities = async () => {
    try {
      const { data } = await supabase.from("user_activity").select("*").eq("user_id", targetUserId).order("created_at", { ascending: false }).limit(30);
      if (data) setActivities(data);
    } catch {}
  };

  const fetchCommunities = async () => {
    try {
      const { data } = await supabase.from("community_members")
        .select("id, community_id, role, joined_at, communities:community_id(id, name, description, icon, banner_url, member_count, privacy, category)")
        .eq("user_id", targetUserId).limit(20);
      if (data) setCommunities(data.map((r: any) => ({ ...r, community: Array.isArray(r.communities) ? r.communities[0] : r.communities })));
    } catch {}
  };

  const fetchTradeHistory = async () => {
    try {
      const { data } = await supabase.from("trade_history").select("*").eq("user_id", targetUserId).order("created_at", { ascending: false }).limit(20);
      if (data) setTradeHistory(data);
    } catch {}
  };

  const fetchLeaderboardRank = async () => {
    try {
      const { data } = await supabase.from("leaderboard").select("user_id, total_pnl").order("total_pnl", { ascending: false });
      if (data) { const idx = data.findIndex((r: any) => r.user_id === targetUserId); setLeaderboardRank(idx >= 0 ? idx + 1 : null); }
    } catch {}
  };

  const checkFollowStatus = async () => {
    if (!user) return;
    const { data } = await supabase.from("followers").select("id").eq("follower_id", user.id).eq("followee_id", targetUserId).single();
    setIsFollowing(!!data);
  };

  const fetchBookmarks = async () => {
    if (!user) return;
    try {
      const { data: bks } = await supabase.from("community_post_bookmarks").select("post_id, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
      if (!bks?.length) { setBookmarks([]); return; }
      const postIds = bks.map((b: any) => b.post_id);
      const { data: posts } = await supabase.from("community_posts").select("id, content, image_url, likes_count, replies_count, created_at, user_id, username, avatar_url, community_id").in("id", postIds);
      const byId = new Map((posts || []).map((p: any) => [p.id, p]));
      setBookmarks(postIds.map((id: string) => byId.get(id)).filter(Boolean));
    } catch { setBookmarks([]); }
  };

  const handleFollow = async () => {
    if (!user) { navigate("/auth"); return; }
    try {
      if (isFollowing) {
        await supabase.from("followers").delete().eq("follower_id", user.id).eq("followee_id", targetUserId);
        setIsFollowing(false); toast("Unfollowed");
      } else {
        await supabase.from("followers").insert({ follower_id: user.id, followee_id: targetUserId });
        setIsFollowing(true); toast.success("Following!");
      }
      fetchProfile();
    } catch { toast.error("Failed"); }
  };

  const handleRefresh = () => {
    if (profile?.wallet_address) { setRefreshing(true); fetchWalletData(profile.wallet_address); }
  };

  useEffect(() => {
    if (profile?.wallet_address) fetchWalletData(profile.wallet_address);
  }, [profile?.wallet_address]);

  const saveProfile = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from("profiles").update({
        username: editedProfile.username, bio: editedProfile.bio,
        twitter_handle: editedProfile.twitter_handle, discord_handle: editedProfile.discord_handle,
        website: editedProfile.website, is_public: editedProfile.is_public,
        wallet_address: editedProfile.wallet_address,
      }).eq("user_id", user.id);
      if (error) throw error;
      setProfile({ ...profile, ...editedProfile } as UserProfile);
      setEditing(false);
      toast.success("Profile saved!");
      if (editedProfile.wallet_address) fetchWalletData(editedProfile.wallet_address);
    } catch { toast.error("Failed to save"); }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5 MB"); return; }
    setUploadingBanner(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/banner-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("profile-media").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("profile-media").getPublicUrl(path);
      await supabase.from("profiles").update({ banner_url: publicUrl }).eq("user_id", user.id);
      setProfile(p => p ? { ...p, banner_url: publicUrl } : p);
      toast.success("Banner updated!");
    } catch { toast.error("Upload failed"); }
    finally { setUploadingBanner(false); if (bannerFileRef.current) bannerFileRef.current.value = ""; }
  };

  const copyProfileLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/profile/${targetUserId}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    toast.success("Link copied!");
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
          <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center">
            <User className="h-8 w-8 text-white/30" />
          </div>
          <p className="text-white/50 text-sm">Profile not found</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/discover")} className="rounded-full">Discover Users</Button>
        </div>
      </AppLayout>
    );
  }

  const level    = profile.current_level || 1;
  const rep      = profile.reputation_score || 0;
  const levelPct = Math.min((rep % 1000) / 10, 100);
  const website  = profile.website_url || profile.website;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">

        {/* ── BANNER + AVATAR ──────────────────────────────────────────────── */}
        <div className="relative">
          {/* Back button — floating on banner */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="absolute top-3 left-3 z-20 flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-black/50 backdrop-blur-sm text-white/70 transition hover:bg-black/70 hover:text-white"
            aria-label="Go back"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {/* Banner */}
          <div className="h-32 sm:h-40 bg-gradient-to-br from-primary/40 via-secondary/20 to-primary/20 relative overflow-hidden">
            {safeAvatarUrl(profile.banner_url) && (
              <img src={safeAvatarUrl(profile.banner_url)} alt="" className="absolute inset-0 w-full h-full object-cover"
                onError={e => (e.target as HTMLImageElement).style.display = "none"} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f]/80 via-transparent to-transparent" />
            {isOwnProfile && (
              <>
                <button onClick={() => bannerFileRef.current?.click()}
                  className="absolute bottom-2 right-3 h-7 w-7 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center border border-white/20 transition-all">
                  {uploadingBanner ? <RefreshCw className="h-3.5 w-3.5 text-white animate-spin" /> : <Camera className="h-3.5 w-3.5 text-white" />}
                </button>
                <input ref={bannerFileRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
              </>
            )}
            {/* Rank badge */}
            {leaderboardRank && leaderboardRank <= 100 && (
              <div className="absolute top-2.5 left-3 flex items-center gap-1 bg-black/70 backdrop-blur-sm border border-amber-500/30 text-amber-400 text-[11px] font-bold px-2 py-0.5 rounded-full">
                {leaderboardRank === 1 ? <Crown className="h-3 w-3" /> : leaderboardRank <= 3 ? <Medal className="h-3 w-3" /> : <Trophy className="h-3 w-3" />}
                #{leaderboardRank}
              </div>
            )}
          </div>

          {/* Avatar row */}
          <div className="px-4 flex items-end justify-between -mt-10 mb-3 relative z-10">
            <div className="relative">
              {renderAvatar(profile.avatar_url, profile.username, "lg")}
              {isOwnProfile && (
                <div className="absolute -bottom-1 -right-1">
                  <AvatarSelector
                    currentAvatar={profile.avatar_url}
                    userId={user?.id}
                    onSelect={async (url) => {
                      await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user!.id);
                      setProfile({ ...profile, avatar_url: url });
                      toast.success("Avatar updated!");
                    }}
                    trigger={
                      <button className="h-6 w-6 rounded-full bg-primary flex items-center justify-center shadow-lg border-2 border-[#0a0a0f]">
                        <Camera className="h-3 w-3 text-white" />
                      </button>
                    }
                  />
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pb-1">
              <button onClick={copyProfileLink}
                className="h-8 w-8 rounded-full border border-white/20 bg-black/40 hover:bg-white/10 flex items-center justify-center transition-all">
                {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5 text-white/60" />}
              </button>
              {isOwnProfile ? (
                <Button size="sm" variant="outline" onClick={() => setEditing(!editing)}
                  className="rounded-full h-8 px-4 text-xs border-white/20 bg-transparent hover:bg-white/10">
                  {editing ? "Cancel" : "Edit profile"}
                </Button>
              ) : (
                <Button size="sm" onClick={handleFollow}
                  className={`rounded-full h-8 px-4 text-xs font-semibold ${isFollowing ? "bg-transparent border border-white/20 hover:border-red-500/50 hover:text-red-400 text-white" : "bg-white text-black hover:bg-white/90"}`}>
                  {isFollowing ? "Following" : "Follow"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── IDENTITY ─────────────────────────────────────────────────────── */}
        <div className="px-4 pb-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold leading-tight">{profile.display_name || profile.username || "Anonymous"}</h1>
            {profile.verified && <CheckCircle className="h-4.5 w-4.5 text-blue-400 shrink-0" />}
            {profile.is_pioneer && <span className="text-sm">⭐</span>}
            {profile.badge && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${getBadgeGradient(profile.badge)} text-white`}>
                {profile.badge.toUpperCase()}
              </span>
            )}
          </div>
          {profile.username && profile.display_name && (
            <p className="text-sm text-white/40 mt-0.5">@{profile.username}</p>
          )}
          {!profile.display_name && profile.username && (
            <p className="text-sm text-white/40 mt-0.5">@{profile.username}</p>
          )}

          {/* Level + streak badges */}
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            <span className="flex items-center gap-1 text-[11px] bg-white/[0.07] px-2 py-0.5 rounded-full text-white/70">
              <Zap className="h-3 w-3 text-yellow-400" /> Lv {level} {getLevelTitle(level)}
            </span>
            {(profile.daily_streak || 0) > 0 && (
              <span className="flex items-center gap-1 text-[11px] bg-orange-500/10 px-2 py-0.5 rounded-full text-orange-400">
                <Flame className="h-3 w-3" /> {profile.daily_streak}d
              </span>
            )}
            {(profile.holder_streak || 0) > 0 && (
              <span className="flex items-center gap-1 text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-full text-emerald-400">
                💎 {profile.holder_streak}d
              </span>
            )}
            {!profile.is_public && (
              <span className="flex items-center gap-1 text-[11px] bg-white/[0.05] px-2 py-0.5 rounded-full text-white/40">
                <Lock className="h-3 w-3" /> Private
              </span>
            )}
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm text-white/80 leading-relaxed mt-3">{profile.bio}</p>
          )}

          {/* Meta links */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3">
            {profile.location && (
              <span className="flex items-center gap-1 text-xs text-white/40">
                <MapPin className="h-3 w-3" /> {profile.location}
              </span>
            )}
            {website && (
              <a href={website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                <LinkIcon className="h-3 w-3" /> {website.replace(/^https?:\/\//, "").split("/")[0]}
              </a>
            )}
            {profile.twitter_handle && (
              <a href={`https://twitter.com/${profile.twitter_handle}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-white/40 hover:text-sky-400 transition-colors">
                <Twitter className="h-3 w-3" /> @{profile.twitter_handle}
              </a>
            )}
            {profile.created_at && (
              <span className="flex items-center gap-1 text-xs text-white/30">
                <Calendar className="h-3 w-3" /> Joined {format(new Date(profile.created_at), "MMM yyyy")}
              </span>
            )}
          </div>

          {/* XP bar */}
          {rep > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-[11px] text-white/30 mb-1">
                <span>XP Progress</span>
                <span>{rep.toLocaleString()} XP</span>
              </div>
              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all" style={{ width: `${levelPct}%` }} />
              </div>
            </div>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-5 mt-4">
            <button onClick={() => {}} className="text-left group">
              <span className="text-sm font-bold text-white">{shortNum(profile.followers_count || 0)}</span>
              <span className="text-xs text-white/40 ml-1 group-hover:text-white/60 transition-colors">Followers</span>
            </button>
            <button onClick={() => {}} className="text-left group">
              <span className="text-sm font-bold text-white">{shortNum(profile.following_count || 0)}</span>
              <span className="text-xs text-white/40 ml-1 group-hover:text-white/60 transition-colors">Following</span>
            </button>
            <span className="text-left">
              <span className="text-sm font-bold text-white">{communities.length}</span>
              <span className="text-xs text-white/40 ml-1">Communities</span>
            </span>
            {walletStats && (
              <span className="text-left ml-auto">
                <span className="text-sm font-bold text-primary">{shortUsd(walletStats.totalUsdValue || 0)}</span>
                <span className="text-xs text-white/40 ml-1">Portfolio</span>
              </span>
            )}
          </div>
        </div>

        {/* ── EDIT PANEL ───────────────────────────────────────────────────── */}
        {editing && (
          <div className="border-b border-white/[0.07] bg-white/[0.02]">
            <div className="px-4 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Edit Profile</h3>
                <button onClick={() => setEditing(false)} className="text-white/40 hover:text-white transition-colors">
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs text-white/50">Username</Label>
                  <Input value={editedProfile.username || ""} onChange={e => setEditedProfile({ ...editedProfile, username: e.target.value })} className="h-9 rounded-xl text-sm" placeholder="your_username" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-white/50">Twitter</Label>
                  <Input value={editedProfile.twitter_handle || ""} onChange={e => setEditedProfile({ ...editedProfile, twitter_handle: e.target.value })} className="h-9 rounded-xl text-sm" placeholder="@handle" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-white/50">Website</Label>
                  <Input value={editedProfile.website || ""} onChange={e => setEditedProfile({ ...editedProfile, website: e.target.value })} className="h-9 rounded-xl text-sm" placeholder="https://" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs text-white/50">Bio</Label>
                  <Textarea value={editedProfile.bio || ""} onChange={e => setEditedProfile({ ...editedProfile, bio: e.target.value })} className="rounded-xl text-sm resize-none" rows={2} placeholder="Tell the world who you are…" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs text-white/50 flex items-center gap-1"><Wallet className="h-3 w-3" /> Solana Wallet</Label>
                  <Input value={editedProfile.wallet_address || ""} onChange={e => setEditedProfile({ ...editedProfile, wallet_address: e.target.value })} className="h-9 rounded-xl text-sm font-mono" placeholder="Wallet address for live stats" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <Switch checked={editedProfile.is_public ?? true} onCheckedChange={c => setEditedProfile({ ...editedProfile, is_public: c })} />
                  <Label className="text-xs text-white/60">Public profile</Label>
                </div>
                <Button size="sm" onClick={saveProfile} className="rounded-full px-5 h-8 text-xs">Save</Button>
              </div>
            </div>
          </div>
        )}

        {/* ── TABS ─────────────────────────────────────────────────────────── */}
        <Tabs defaultValue="activity">
          <TabsList className="w-full flex overflow-x-auto bg-transparent border-b border-white/[0.07] rounded-none p-0 gap-0 h-auto">
            {[
              { value: "activity",  label: "Activity",  icon: <Activity className="h-3.5 w-3.5" /> },
              { value: "portfolio", label: "Portfolio", icon: <Wallet className="h-3.5 w-3.5" /> },
              { value: "social",    label: "Social",    icon: <Users className="h-3.5 w-3.5" /> },
              ...(isOwnProfile ? [{ value: "saved", label: "Saved", icon: <Bookmark className="h-3.5 w-3.5" /> }] : []),
              { value: "stats",     label: "Stats",     icon: <TrendingUp className="h-3.5 w-3.5" /> },
            ].map(t => (
              <TabsTrigger key={t.value} value={t.value}
                className="flex-1 min-w-[4.5rem] flex items-center justify-center gap-1.5 py-3 px-2 text-xs font-medium rounded-none border-b-2 border-transparent text-white/40 data-[state=active]:text-white data-[state=active]:border-primary bg-transparent data-[state=active]:bg-transparent hover:text-white/70 transition-all">
                {t.icon} <span className="hidden sm:inline">{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── ACTIVITY ──────────────────────────────────────────────────── */}
          <TabsContent value="activity" className="m-0">
            <div className="divide-y divide-white/[0.04]">
              {/* Wallet refresh strip */}
              {profile.wallet_address && (
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[11px] text-white/40">Live from wallet</span>
                  </div>
                  <button onClick={handleRefresh} disabled={refreshing}
                    className="text-[11px] text-white/40 hover:text-white flex items-center gap-1 transition-colors">
                    <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} /> Refresh
                  </button>
                </div>
              )}

              {/* Wallet transactions */}
              {profile.wallet_address && walletTransactions.length > 0 ? (
                walletTransactions.map((tx, i) => {
                  const isSwap     = tx.type === "SWAP";
                  const isIncoming = tx.nativeTransfers?.[0]?.toUserAccount === profile.wallet_address;
                  const isNft      = ["NFT_SALE","NFT_MINT","NFT_LISTING"].includes(tx.type);
                  const ts         = tx.timestamp ? new Date(tx.timestamp * 1000) : new Date();
                  const amt        = (tx.nativeTransfers?.[0]?.amount || 0) / 1e9;
                  return (
                    <div key={tx.signature || i}
                      className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors cursor-pointer group"
                      onClick={() => window.open(`https://solscan.io/tx/${tx.signature}`, "_blank")}>
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${isSwap ? "bg-violet-500/15 text-violet-400" : isIncoming ? "bg-green-500/15 text-green-400" : isNft ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`}>
                        {isSwap ? <RefreshCw className="h-4 w-4" /> : isIncoming ? <ArrowDownRight className="h-4 w-4" /> : isNft ? <Trophy className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{isSwap ? "Swap" : isNft ? tx.type.replace(/_/g," ") : isIncoming ? "Received" : "Sent"}</p>
                          <p className={`text-sm font-semibold ${isIncoming ? "text-green-400" : "text-white/60"}`}>
                            {amt > 0 ? `${isIncoming ? "+" : "-"}${amt.toFixed(4)} SOL` : ""}
                          </p>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-[11px] font-mono text-white/30">{tx.signature?.slice(0,8)}…{tx.signature?.slice(-4)}</p>
                          <p className="text-[11px] text-white/30">{formatDistanceToNow(ts, { addSuffix: true })}</p>
                        </div>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-white/20 opacity-0 group-hover:opacity-100 shrink-0" />
                    </div>
                  );
                })
              ) : activities.length > 0 ? (
                activities.map(a => (
                  <div key={a.id} className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${a.activity_type === "trade" ? "bg-primary/15 text-primary" : a.activity_type === "achievement" ? "bg-amber-500/15 text-amber-400" : "bg-white/[0.07] text-white/40"}`}>
                      {a.activity_type === "trade" ? <TrendingUp className="h-4 w-4" /> : a.activity_type === "achievement" ? <Trophy className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{a.title}</p>
                        <p className="text-[11px] text-white/30 shrink-0">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</p>
                      </div>
                      {a.description && <p className="text-[12px] text-white/40 mt-0.5 line-clamp-1">{a.description}</p>}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-16 text-center">
                  <Activity className="h-10 w-10 mx-auto mb-3 text-white/15" />
                  <p className="text-sm text-white/40">No activity yet</p>
                  {isOwnProfile && !profile.wallet_address && (
                    <Button size="sm" variant="outline" className="mt-4 rounded-full text-xs" onClick={() => setEditing(true)}>
                      <Wallet className="h-3.5 w-3.5 mr-1.5" /> Connect wallet
                    </Button>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── PORTFOLIO ─────────────────────────────────────────────────── */}
          <TabsContent value="portfolio" className="m-0">
            {profile.wallet_address ? (
              <div>
                {/* Stats strip */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.04]">
                  <div>
                    <p className="text-[11px] text-white/40">Total Portfolio</p>
                    {loadingStats ? (
                      <div className="h-6 w-24 bg-white/[0.07] rounded animate-pulse mt-0.5" />
                    ) : (
                      <p className="text-xl font-bold text-primary">{shortUsd(walletStats?.totalUsdValue || 0)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <p className="text-[11px] text-white/40">SOL</p>
                      <p className="text-sm font-semibold">{walletStats?.balance?.toFixed(3) || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-white/40">24h</p>
                      <p className={`text-sm font-semibold ${(walletStats?.priceChange24h || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {(walletStats?.priceChange24h || 0) >= 0 ? "+" : ""}{walletStats?.priceChange24h?.toFixed(1) || "0"}%
                      </p>
                    </div>
                    <button onClick={handleRefresh} disabled={refreshing}
                      className="h-8 w-8 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center transition-colors">
                      <RefreshCw className={`h-3.5 w-3.5 text-white/60 ${refreshing ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* Wallet address */}
                <div className="px-4 py-2.5 border-b border-white/[0.04]">
                  <a href={`https://solscan.io/account/${profile.wallet_address}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[11px] font-mono text-white/30 hover:text-white/60 transition-colors">
                    <Wallet className="h-3 w-3" />
                    {profile.wallet_address.slice(0,14)}…{profile.wallet_address.slice(-8)}
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </a>
                </div>

                {/* Token list */}
                {loadingStats ? (
                  <div className="divide-y divide-white/[0.04]">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="px-4 py-3 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-white/[0.07] animate-pulse shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-24 bg-white/[0.07] rounded animate-pulse" />
                          <div className="h-2.5 w-16 bg-white/[0.05] rounded animate-pulse" />
                        </div>
                        <div className="h-3 w-14 bg-white/[0.07] rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : tokenHoldings.length > 0 ? (
                  <div className="divide-y divide-white/[0.04]">
                    {tokenHoldings.map((token, i) => {
                      const bal = token.token_info?.balance ? token.token_info.balance / Math.pow(10, token.token_info.decimals || 0) : 0;
                      const val = token.token_info?.price_info?.total_price || 0;
                      const pct = walletStats?.totalUsdValue ? (val / walletStats.totalUsdValue * 100) : 0;
                      return (
                        <div key={token.id || i} className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center overflow-hidden shrink-0">
                            {token.content?.links?.image ? (
                              <img src={token.content.links.image} alt={token.content.metadata.symbol} className="w-full h-full object-cover" onError={e => (e.target as HTMLImageElement).style.display = "none"} />
                            ) : (
                              <span className="text-[10px] font-bold text-primary/80">{token.content.metadata.symbol?.slice(0,2) || "?"}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold truncate">{token.content.metadata.symbol || "Unknown"}</p>
                              <p className="text-sm font-semibold ml-2">{shortUsd(val)}</p>
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <p className="text-[11px] text-white/40">{bal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                              <p className="text-[11px] text-white/30">{pct.toFixed(1)}%</p>
                            </div>
                            {walletStats?.totalUsdValue && val > 0 && (
                              <div className="mt-1.5 h-0.5 rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full rounded-full bg-primary/50" style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Coins className="h-9 w-9 mx-auto mb-3 text-white/15" />
                    <p className="text-sm text-white/40">No tokens found</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-16 px-8 text-center">
                <div className="h-14 w-14 rounded-2xl bg-white/[0.05] flex items-center justify-center mx-auto mb-4">
                  <Wallet className="h-7 w-7 text-white/20" />
                </div>
                <p className="font-semibold text-sm mb-1">No wallet connected</p>
                <p className="text-xs text-white/40 mb-5 leading-relaxed">Connect a Solana wallet to see live portfolio, token holdings, and on-chain activity.</p>
                {isOwnProfile && (
                  <Button size="sm" onClick={() => setEditing(true)} className="rounded-full px-5 text-xs">Connect wallet</Button>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── SOCIAL ────────────────────────────────────────────────────── */}
          <TabsContent value="social" className="m-0">
            <SocialTab targetUserId={targetUserId!} isOwnProfile={isOwnProfile} />
          </TabsContent>

          {/* ── SAVED ─────────────────────────────────────────────────────── */}
          {isOwnProfile && (
            <TabsContent value="saved" className="m-0">
              <div className="divide-y divide-white/[0.04]">
                {bookmarks.length > 0 ? bookmarks.map((post: any) => (
                  <div key={post.id} className="px-4 py-3 flex gap-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => navigate("/communities")}>
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/25 to-secondary/25 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {(post.username || "U")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-semibold">@{post.username || "user"}</span>
                        <span className="text-[11px] text-white/30">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                      </div>
                      <p className="text-sm text-white/75 line-clamp-3 leading-relaxed">{post.content}</p>
                      {post.image_url && (
                        <img src={post.image_url} alt="" className="mt-2 rounded-xl max-h-32 w-full object-cover border border-white/10" onError={e => (e.target as HTMLImageElement).remove()} />
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1 text-[11px] text-white/30"><Heart className="h-3 w-3" />{post.likes_count || 0}</span>
                        <span className="flex items-center gap-1 text-[11px] text-white/30"><MessageCircle className="h-3 w-3" />{post.replies_count || 0}</span>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="py-16 text-center">
                    <Bookmark className="h-10 w-10 mx-auto mb-3 text-white/15" />
                    <p className="text-sm text-white/40">No saved posts yet</p>
                    <p className="text-xs text-white/25 mt-1">Bookmark posts in Communities</p>
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          {/* ── STATS ─────────────────────────────────────────────────────── */}
          <TabsContent value="stats" className="m-0">
            <div className="divide-y divide-white/[0.04]">

              {/* Leaderboard rank */}
              {leaderboardRank && (
                <div className="px-4 py-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    {leaderboardRank === 1 ? <Crown className="h-5 w-5 text-amber-400" /> : leaderboardRank <= 3 ? <Medal className="h-5 w-5 text-amber-400" /> : <Trophy className="h-5 w-5 text-amber-400" />}
                  </div>
                  <div>
                    <p className="text-xs text-white/40">Leaderboard Rank</p>
                    <p className="text-xl font-bold text-amber-400">#{leaderboardRank}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/leaderboard")} className="ml-auto rounded-full text-xs text-white/40 hover:text-white">
                    View <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                  </Button>
                </div>
              )}

              {/* Key numbers grid */}
              <div className="grid grid-cols-2 gap-px bg-white/[0.04]">
                {[
                  { label: "Portfolio",    value: shortUsd(walletStats?.totalUsdValue || profile.total_pnl || 0), accent: "text-primary" },
                  { label: "SOL Balance",  value: `${walletStats?.balance?.toFixed(3) || "0.000"}`, sub: "SOL", accent: "" },
                  { label: "Tokens",       value: walletStats?.tokenCount || tokenHoldings.length || 0, accent: "" },
                  { label: "Transactions", value: shortNum(transactionCount || walletTransactions.length || 0), accent: "" },
                  { label: "Followers",    value: shortNum(profile.followers_count || 0), accent: "" },
                  { label: "Following",    value: shortNum(profile.following_count || 0), accent: "" },
                  { label: "Communities",  value: communities.length, accent: "" },
                  { label: "Reputation",   value: shortNum(rep), sub: "XP", accent: "text-primary" },
                ].map((s, i) => (
                  <div key={i} className="bg-[#0a0a0f] px-4 py-3">
                    <p className="text-[11px] text-white/35 mb-0.5">{s.label}</p>
                    <p className={`text-lg font-bold ${s.accent}`}>{s.value}<span className="text-xs text-white/40 font-normal ml-0.5">{s.sub}</span></p>
                  </div>
                ))}
              </div>

              {/* Streak info */}
              {((profile.daily_streak || 0) > 0 || (profile.longest_streak || 0) > 0) && (
                <div className="px-4 py-4 flex items-center gap-4">
                  {(profile.daily_streak || 0) > 0 && (
                    <div className="flex items-center gap-2 text-orange-400">
                      <Flame className="h-4 w-4" />
                      <div>
                        <p className="text-xs text-white/40">Current streak</p>
                        <p className="text-base font-bold">{profile.daily_streak}d</p>
                      </div>
                    </div>
                  )}
                  {(profile.longest_streak || 0) > 0 && (
                    <div className="flex items-center gap-2 text-orange-300 ml-4">
                      <Zap className="h-4 w-4" />
                      <div>
                        <p className="text-xs text-white/40">Best streak</p>
                        <p className="text-base font-bold">{profile.longest_streak}d</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Portfolio breakdown */}
              {tokenHoldings.length > 0 && walletStats && (
                <div>
                  <p className="px-4 py-2.5 text-xs text-white/40 font-medium uppercase tracking-wider">Top Holdings</p>
                  <div className="divide-y divide-white/[0.04]">
                    {tokenHoldings.slice(0, 6).map((token, i) => {
                      const bal = token.token_info?.balance ? token.token_info.balance / Math.pow(10, token.token_info.decimals || 0) : 0;
                      const val = token.token_info?.price_info?.total_price || 0;
                      const pct = walletStats.totalUsdValue ? (val / walletStats.totalUsdValue * 100) : 0;
                      return (
                        <div key={token.id || i} className="px-4 py-2.5 flex items-center gap-3">
                          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center overflow-hidden shrink-0">
                            {token.content?.links?.image ? (
                              <img src={token.content.links.image} alt="" className="w-full h-full object-cover" onError={e => (e.target as HTMLImageElement).style.display = "none"} />
                            ) : (
                              <span className="text-[9px] font-bold text-primary/80">{token.content.metadata.symbol?.slice(0,2) || "?"}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                              <p className="text-xs font-semibold">{token.content.metadata.symbol}</p>
                              <p className="text-xs font-semibold">{shortUsd(val)}</p>
                            </div>
                            <div className="flex justify-between mt-0.5">
                              <p className="text-[10px] text-white/30">{bal.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
                              <p className="text-[10px] text-white/30">{pct.toFixed(1)}%</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Trade history */}
              {tradeHistory.length > 0 && (
                <div>
                  <p className="px-4 py-2.5 text-xs text-white/40 font-medium uppercase tracking-wider">Recent Trades</p>
                  <div className="divide-y divide-white/[0.04]">
                    {tradeHistory.slice(0, 8).map(trade => {
                      const isBuy = ["buy","BUY"].includes(trade.action);
                      return (
                        <div key={trade.id} className="px-4 py-2.5 flex items-center gap-3">
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${isBuy ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                            {isBuy ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between">
                              <p className="text-xs font-semibold">{trade.token_symbol} <span className={`font-medium ${isBuy ? "text-green-400" : "text-red-400"}`}>{trade.action.toUpperCase()}</span></p>
                              {trade.pnl != null && (
                                <p className={`text-xs font-semibold ${trade.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                                  {trade.pnl >= 0 ? "+" : ""}{shortUsd(trade.pnl)}
                                </p>
                              )}
                            </div>
                            <p className="text-[10px] text-white/30">{formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

// ─── Social Tab ───────────────────────────────────────────────────────────────

const SocialTab = ({ targetUserId, isOwnProfile }: { targetUserId: string; isOwnProfile: boolean }) => {
  const { followers, following, mutuals, follow, unfollow, isFollowing } = useFriends();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"followers" | "following" | "mutuals">("followers");
  const [otherFollowers, setOtherFollowers] = useState<any[]>([]);
  const [otherFollowing, setOtherFollowing] = useState<any[]>([]);

  useEffect(() => { if (!isOwnProfile) loadOther(); }, [targetUserId]);

  const loadOther = async () => {
    const { data: fRows } = await supabase.from("followers").select("follower_id").eq("followee_id", targetUserId);
    const { data: gRows } = await supabase.from("followers").select("followee_id").eq("follower_id", targetUserId);
    const fIds = fRows?.map((r: any) => r.follower_id) || [];
    const gIds = gRows?.map((r: any) => r.followee_id) || [];
    const allIds = [...new Set([...fIds, ...gIds])];
    if (!allIds.length) return;
    const { data: profiles } = await supabase.from("profiles").select("user_id, username, avatar_url, bio, badge").in("user_id", allIds);
    const pm = new Map(profiles?.map((p: any) => [p.user_id, p]) || []);
    setOtherFollowers(fIds.map((id: string) => ({ user_id: id, ...(pm.get(id) || {}) })));
    setOtherFollowing(gIds.map((id: string) => ({ user_id: id, ...(pm.get(id) || {}) })));
  };

  const df = isOwnProfile ? followers : otherFollowers;
  const dg = isOwnProfile ? following : otherFollowing;
  const dm = isOwnProfile ? mutuals : [];
  const list = tab === "followers" ? df : tab === "following" ? dg : dm;

  return (
    <div>
      {/* Sub-tab pills */}
      <div className="flex border-b border-white/[0.07]">
        {([
          { key: "followers" as const, label: "Followers", count: df.length },
          { key: "following" as const, label: "Following", count: dg.length },
          ...(isOwnProfile ? [{ key: "mutuals" as const, label: "Friends", count: dm.length }] : []),
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-xs font-medium border-b-2 transition-all ${tab === t.key ? "border-primary text-white" : "border-transparent text-white/40 hover:text-white/70"}`}>
            {t.label} <span className="text-white/30 ml-0.5">{t.count}</span>
          </button>
        ))}
      </div>

      {/* People list */}
      <div className="divide-y divide-white/[0.04]">
        {list.length > 0 ? list.map((p: any) => (
          <div key={p.user_id} className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/25 to-secondary/25 flex items-center justify-center text-sm font-bold overflow-hidden shrink-0">
              {safeAvatarUrl(p.avatar_url) ? (
                <img src={safeAvatarUrl(p.avatar_url)} className="w-full h-full object-cover rounded-full" alt="" onError={e => (e.target as HTMLImageElement).style.display = "none"} />
              ) : (
                (p.username || "?")[0].toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{p.username || "User"}</p>
              {p.bio && <p className="text-[12px] text-white/40 truncate mt-0.5">{p.bio}</p>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => navigate(`/profile/${p.user_id}`)}
                className="h-7 px-3 rounded-full text-[11px] text-white/50 hover:text-white border border-white/15">
                View
              </Button>
              {isOwnProfile && tab === "followers" && !isFollowing(p.user_id) && (
                <Button size="sm" onClick={() => follow(p.user_id)}
                  className="h-7 px-3 rounded-full text-[11px] bg-white text-black hover:bg-white/90">
                  Follow
                </Button>
              )}
              {isOwnProfile && tab === "following" && (
                <Button variant="ghost" size="sm" onClick={() => unfollow(p.user_id)}
                  className="h-7 px-3 rounded-full text-[11px] border border-white/15 hover:border-red-500/50 hover:text-red-400">
                  Unfollow
                </Button>
              )}
            </div>
          </div>
        )) : (
          <div className="py-14 text-center">
            <Users className="h-9 w-9 mx-auto mb-3 text-white/15" />
            <p className="text-sm text-white/40">{tab === "followers" ? "No followers yet" : tab === "following" ? "Not following anyone" : "No mutual friends"}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
