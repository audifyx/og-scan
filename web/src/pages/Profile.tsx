import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  User, Settings, Twitter, Globe, MessageCircle, Trophy, TrendingUp, Users, Activity,
  Copy, Check, UserPlus, UserMinus, Wallet, Coins, ArrowUpRight, ArrowDownRight,
  RefreshCw, ExternalLink, Percent, Flame, Camera, Shield, Star, Hash, Lock,
  BarChart3, Crown, Medal, Award, Zap, Heart, Clock, ChevronRight, Edit3,
  Image as ImageIcon, CheckCircle, XCircle, AlertCircle,
} from "lucide-react";
import { AvatarSelector, renderAvatar } from "@/components/avatars/AvatarSelector";
import { safeAvatarUrl } from "@/lib/utils";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDistanceToNow } from "date-fns";
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
  content: {
    metadata: { name: string; symbol: string };
    links?: { image?: string };
  };
  token_info?: {
    balance: number;
    decimals: number;
    price_info?: { price_per_token: number; total_price: number };
  };
}

interface WalletTransaction {
  signature: string;
  type: string;
  timestamp?: number;
  description?: string;
  fee?: number;
  feePayer?: string;
  source?: string;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  tokenTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    mint: string;
  }>;
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

const formatUsd = (num: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);

const getBadgeColor = (badge: string | null) => {
  switch (badge) {
    case "whale":   return "bg-blue-500";
    case "diamond": return "bg-cyan-400";
    case "gold":    return "bg-yellow-500";
    case "silver":  return "bg-gray-400";
    default:        return "bg-muted";
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
        if (isOwnProfile && user) {
          await supabase.from("profiles").update({ total_pnl: overviewData.totalUsdValue || 0 }).eq("user_id", user.id);
        }
      }
      const { data: assetsData, error: assetsError } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getAssets", walletAddress, page: 1, limit: 20 },
      });
      if (!assetsError && assetsData?.assets) {
        const tokens = assetsData.assets.filter((item: any) =>
          item.interface === "FungibleToken" || item.interface === "FungibleAsset"
        );
        setTokenHoldings(tokens.slice(0, 20));
      }
      const { data: txData, error: txError } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTransactions", walletAddress, limit: 30 },
      });
      if (!txError && txData?.transactions) {
        setWalletTransactions(txData.transactions);
        setTransactionCount(txData.signatures?.length || txData.transactions.length);
      }
    } catch (err) {
      console.error("Error fetching wallet data:", err);
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", targetUserId).single();
      if (error && error.code === "PGRST116") {
        if (isOwnProfile && user) {
          const newProfile = {
            user_id: user.id, username: null, avatar_url: null, bio: null,
            twitter_handle: null, discord_handle: null, website: null,
            total_pnl: 0, win_rate: 0, trades_count: 0, followers_count: 0,
            following_count: 0, is_public: true, badge: null, wallet_address: null,
          };
          const { data: createdProfile, error: createError } = await supabase
            .from("profiles").insert(newProfile).select().single();
          if (createError) { setProfile(null); }
          else {
            setProfile(createdProfile);
            setEditedProfile(createdProfile);
            toast.success("Profile created! Customize it below.");
            setEditing(true);
          }
        } else { setProfile(null); }
      } else if (error) {
        throw error;
      } else {
        setProfile(data);
        setEditedProfile(data);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase.from("user_activity").select("*")
        .eq("user_id", targetUserId).order("created_at", { ascending: false }).limit(30);
      if (!error) setActivities(data || []);
    } catch {}
  };

  const fetchCommunities = async () => {
    try {
      const { data } = await supabase.from("community_members")
        .select("id, community_id, role, joined_at, communities:community_id(id, name, description, icon, banner_url, member_count, privacy, category)")
        .eq("user_id", targetUserId)
        .limit(20);
      if (data) {
        const mapped = data.map((row: any) => ({
          ...row,
          community: Array.isArray(row.communities) ? row.communities[0] : row.communities,
        }));
        setCommunities(mapped);
      }
    } catch {}
  };

  const fetchTradeHistory = async () => {
    try {
      const { data } = await supabase.from("trade_history").select("*")
        .eq("user_id", targetUserId).order("created_at", { ascending: false }).limit(20);
      if (data) setTradeHistory(data);
    } catch {}
  };

  const fetchLeaderboardRank = async () => {
    try {
      const { data } = await supabase.from("leaderboard")
        .select("user_id, total_pnl").order("total_pnl", { ascending: false });
      if (data) {
        const idx = data.findIndex((r: any) => r.user_id === targetUserId);
        setLeaderboardRank(idx >= 0 ? idx + 1 : null);
      }
    } catch {}
  };

  const checkFollowStatus = async () => {
    if (!user) return;
    const { data } = await supabase.from("followers").select("id")
      .eq("follower_id", user.id).eq("following_id", targetUserId).single();
    setIsFollowing(!!data);
  };

  const handleFollow = async () => {
    if (!user) { navigate("/auth"); return; }
    try {
      if (isFollowing) {
        await supabase.from("followers").delete().eq("follower_id", user.id).eq("following_id", targetUserId);
        setIsFollowing(false);
        toast.success("Unfollowed");
      } else {
        await supabase.from("followers").insert({ follower_id: user.id, following_id: targetUserId });
        setIsFollowing(true);
        toast.success("Following!");
      }
      fetchProfile();
    } catch { toast.error("Failed to update follow status"); }
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
      toast.success("Profile updated!");
      if (editedProfile.wallet_address) fetchWalletData(editedProfile.wallet_address);
    } catch { toast.error("Failed to update profile"); }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Banner must be under 5 MB"); return; }
    setUploadingBanner(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/banner-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("profile-media").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("profile-media").getPublicUrl(path);
      await supabase.from("profiles").update({ banner_url: publicUrl }).eq("user_id", user.id);
      setProfile(prev => prev ? { ...prev, banner_url: publicUrl } : prev);
      toast.success("Banner updated!");
    } catch { toast.error("Failed to upload banner"); }
    finally {
      setUploadingBanner(false);
      if (bannerFileRef.current) bannerFileRef.current.value = "";
    }
  };

  const copyProfileLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/profile/${targetUserId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Profile link copied!");
  };

  // ── Loading / not found ────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <User className="h-16 w-16 text-muted-foreground" />
          <p className="text-muted-foreground">Profile not found</p>
          <Button onClick={() => navigate("/discover")}>Discover Users</Button>
        </div>
      </AppLayout>
    );
  }

  const level     = profile.current_level || 1;
  const rep       = profile.reputation_score || 0;
  const levelPct  = Math.min((rep % 1000) / 10, 100);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-5">

        {/* ── Profile Hero Card ─────────────────────────────────────────────── */}
        <Card className="glass-card overflow-hidden">
          {/* Banner */}
          <div className="h-44 bg-gradient-to-r from-primary/30 via-secondary/20 to-primary/30 relative overflow-hidden">
            {safeAvatarUrl(profile.banner_url) && (
              <img src={safeAvatarUrl(profile.banner_url)} alt="" className="absolute inset-0 w-full h-full object-cover"
                onError={e => (e.target as HTMLImageElement).style.display = "none"} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

            {isOwnProfile && (
              <button onClick={() => bannerFileRef.current?.click()}
                className="absolute bottom-2 right-3 flex items-center gap-1.5 bg-black/50 hover:bg-black/70 text-white/80 hover:text-white text-[11px] px-2.5 py-1 rounded-lg backdrop-blur-sm border border-white/10 transition-all">
                {uploadingBanner ? <span className="animate-spin">⟳</span> : <Camera className="h-3 w-3" />}
                {uploadingBanner ? "Uploading…" : "Edit banner"}
              </button>
            )}
            <input ref={bannerFileRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />

            {/* Rank badge top-left */}
            {leaderboardRank && leaderboardRank <= 100 && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm border border-og-gold/30 text-og-gold text-xs font-bold px-2.5 py-1 rounded-full">
                {leaderboardRank === 1 ? <Crown className="h-3.5 w-3.5" /> : leaderboardRank <= 3 ? <Medal className="h-3.5 w-3.5" /> : <Trophy className="h-3.5 w-3.5" />}
                #{leaderboardRank} Global
              </div>
            )}
          </div>

          <CardContent className="relative pt-0 pb-5">
            <div className="flex flex-col md:flex-row gap-4 -mt-12">
              {/* Avatar */}
              <div className="relative shrink-0">
                {renderAvatar(profile.avatar_url, profile.username, "lg")}
                {profile.badge && (
                  <div className={`absolute -bottom-1 -right-1 h-7 w-7 rounded-lg ${getBadgeColor(profile.badge)} flex items-center justify-center shadow-lg`}>
                    <Trophy className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                {isOwnProfile && (
                  <div className="absolute -top-2 -left-2">
                    <AvatarSelector
                      currentAvatar={profile.avatar_url}
                      userId={user?.id}
                      onSelect={async (url) => {
                        await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user!.id);
                        setProfile({ ...profile, avatar_url: url });
                        toast.success("Avatar updated!");
                      }}
                      trigger={
                        <button className="p-1.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform">
                          <Settings className="h-3 w-3" />
                        </button>
                      }
                    />
                  </div>
                )}
              </div>

              {/* Identity */}
              <div className="flex-1 pt-4 md:pt-10 min-w-0">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-2xl font-bold truncate">{profile.username || "Anonymous"}</h1>
                      {profile.badge && (
                        <Badge className={`${getBadgeColor(profile.badge)} text-white`}>
                          {profile.badge.toUpperCase()}
                        </Badge>
                      )}
                      {!profile.is_public && (
                        <Badge variant="outline" className="text-muted-foreground border-muted-foreground/40">
                          <Lock className="h-3 w-3 mr-1" /> Private
                        </Badge>
                      )}
                    </div>

                    {/* Level + XP */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Zap className="h-3 w-3 text-yellow-400" />
                        Lv {level} · {getLevelTitle(level)}
                      </Badge>
                      {profile.daily_streak && profile.daily_streak > 0 && (
                        <Badge variant="outline" className="text-xs gap-1 text-orange-400 border-orange-400/30">
                          <Flame className="h-3 w-3" /> {profile.daily_streak}d streak
                        </Badge>
                      )}
                    </div>

                    <p className="text-muted-foreground mt-2 text-sm line-clamp-2">{profile.bio || "No bio yet."}</p>

                    {/* Social links */}
                    <div className="flex items-center gap-4 mt-3">
                      {profile.twitter_handle && (
                        <a href={`https://twitter.com/${profile.twitter_handle}`} target="_blank" rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors">
                          <Twitter className="h-4 w-4" />
                        </a>
                      )}
                      {profile.discord_handle && (
                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                          <MessageCircle className="h-4 w-4" />
                          {profile.discord_handle}
                        </span>
                      )}
                      {profile.website && (
                        <a href={profile.website} target="_blank" rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors">
                          <Globe className="h-4 w-4" />
                        </a>
                      )}
                      {profile.created_at && (
                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                          <Clock className="h-3 w-3" />
                          Joined {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={copyProfileLink} className="rounded-xl">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    {isOwnProfile ? (
                      <Button onClick={() => setEditing(!editing)} className="rounded-xl gap-2">
                        <Edit3 className="h-4 w-4" />
                        {editing ? "Cancel" : "Edit Profile"}
                      </Button>
                    ) : (
                      <Button onClick={handleFollow} variant={isFollowing ? "outline" : "default"} className="rounded-xl">
                        {isFollowing ? (
                          <><UserMinus className="h-4 w-4 mr-2" />Unfollow</>
                        ) : (
                          <><UserPlus className="h-4 w-4 mr-2" />Follow</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* XP Progress bar */}
            {(profile.reputation_score || 0) > 0 && (
              <div className="mt-5 pt-5 border-t border-white/10">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground">XP / Reputation</span>
                  <span className="text-xs font-mono text-primary">{rep.toLocaleString()} XP</span>
                </div>
                <Progress value={levelPct} className="h-1.5" />
              </div>
            )}

            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5 pt-5 border-t border-white/10">
              <div className="text-center p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
                <p className="text-lg font-bold text-primary">
                  {walletStats ? formatUsd(walletStats.totalUsdValue) : formatUsd(profile.total_pnl || 0)}
                </p>
                <p className="text-[11px] text-muted-foreground">Portfolio</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-lg font-bold">{profile.trades_count || 0}</p>
                <p className="text-[11px] text-muted-foreground">Trades</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-lg font-bold">{profile.followers_count || 0}</p>
                <p className="text-[11px] text-muted-foreground">Followers</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-lg font-bold">{profile.following_count || 0}</p>
                <p className="text-[11px] text-muted-foreground">Following</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-lg font-bold">{communities.length}</p>
                <p className="text-[11px] text-muted-foreground">Communities</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Edit Form ─────────────────────────────────────────────────────── */}
        {editing && (
          <Card className="glass-card border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-primary" />
                Edit Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input value={editedProfile.username || ""} onChange={(e) => setEditedProfile({ ...editedProfile, username: e.target.value })} className="rounded-xl" placeholder="your_username" />
                </div>
                <div className="space-y-2">
                  <Label>Twitter Handle</Label>
                  <Input value={editedProfile.twitter_handle || ""} onChange={(e) => setEditedProfile({ ...editedProfile, twitter_handle: e.target.value })} placeholder="@handle" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Discord Handle</Label>
                  <Input value={editedProfile.discord_handle || ""} onChange={(e) => setEditedProfile({ ...editedProfile, discord_handle: e.target.value })} placeholder="username#0000" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input value={editedProfile.website || ""} onChange={(e) => setEditedProfile({ ...editedProfile, website: e.target.value })} placeholder="https://" className="rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Bio</Label>
                <Textarea value={editedProfile.bio || ""} onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })} placeholder="Tell others about yourself..." rows={3} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  Solana Wallet Address
                </Label>
                <Input value={editedProfile.wallet_address || ""} onChange={(e) => setEditedProfile({ ...editedProfile, wallet_address: e.target.value })} placeholder="Your Solana wallet for live portfolio stats" className="rounded-xl font-mono text-sm" />
                <p className="text-xs text-muted-foreground">Connect your wallet to display live portfolio value, SOL balance, token holdings and transaction history.</p>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <Switch checked={editedProfile.is_public ?? true} onCheckedChange={(checked) => setEditedProfile({ ...editedProfile, is_public: checked })} />
                  <Label>Public Profile</Label>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditing(false)} className="rounded-xl">Cancel</Button>
                  <Button onClick={saveProfile} className="rounded-xl">Save Changes</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Main Tabs ─────────────────────────────────────────────────────── */}
        <Tabs defaultValue="activity" className="w-full">
          <TabsList className="flex w-full overflow-x-auto bg-muted/40 border border-border/30 rounded-xl p-1 gap-1 mb-1">
            <TabsTrigger value="activity"   className="flex-1 min-w-fit rounded-lg text-xs sm:text-sm gap-1.5"><Activity className="h-3.5 w-3.5" /><span>Activity</span></TabsTrigger>
            <TabsTrigger value="portfolio"  className="flex-1 min-w-fit rounded-lg text-xs sm:text-sm gap-1.5"><Wallet className="h-3.5 w-3.5" /><span>Portfolio</span></TabsTrigger>
            <TabsTrigger value="trades"     className="flex-1 min-w-fit rounded-lg text-xs sm:text-sm gap-1.5"><BarChart3 className="h-3.5 w-3.5" /><span>Trades</span></TabsTrigger>
            <TabsTrigger value="communities" className="flex-1 min-w-fit rounded-lg text-xs sm:text-sm gap-1.5"><Hash className="h-3.5 w-3.5" /><span>Communities</span></TabsTrigger>
            <TabsTrigger value="social"     className="flex-1 min-w-fit rounded-lg text-xs sm:text-sm gap-1.5"><Users className="h-3.5 w-3.5" /><span>Social</span></TabsTrigger>
            <TabsTrigger value="stats"      className="flex-1 min-w-fit rounded-lg text-xs sm:text-sm gap-1.5"><TrendingUp className="h-3.5 w-3.5" /><span>Stats</span></TabsTrigger>
          </TabsList>

          {/* ── ACTIVITY TAB ──────────────────────────────────────────────── */}
          <TabsContent value="activity">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Recent Activity
                  {profile.wallet_address && walletTransactions.length > 0 && (
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse mr-1" />
                      Live from Wallet
                    </Badge>
                  )}
                  {profile.wallet_address && (
                    <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing} className="rounded-xl ml-1">
                      <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[480px]">
                  {profile.wallet_address && walletTransactions.length > 0 ? (
                    <div className="space-y-2">
                      {walletTransactions.map((tx, index) => {
                        const isSwap = tx.type === "SWAP";
                        const isIncoming = tx.nativeTransfers?.[0]?.toUserAccount === profile.wallet_address;
                        const isNftAction = ["NFT_SALE", "NFT_MINT", "NFT_LISTING"].includes(tx.type);
                        const timestamp = tx.timestamp ? new Date(tx.timestamp * 1000) : new Date();
                        const transferAmount = (tx.nativeTransfers?.[0]?.amount || 0) / 1e9;

                        return (
                          <div key={tx.signature || index}
                            className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all group cursor-pointer border border-transparent hover:border-white/10"
                            onClick={() => window.open(`https://solscan.io/tx/${tx.signature}`, "_blank")}>
                            <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${isSwap ? "bg-purple-500/20 text-purple-400" : isIncoming ? "bg-green-500/20 text-green-400" : isNftAction ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`}>
                              {isSwap ? <RefreshCw className="h-4 w-4" /> : isIncoming ? <ArrowDownRight className="h-4 w-4" /> : isNftAction ? <Trophy className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-medium text-sm">{isSwap ? "Token Swap" : isNftAction ? tx.type.replace(/_/g, " ") : isIncoming ? "Received" : "Sent"}</p>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDistanceToNow(timestamp, { addSuffix: true })}</span>
                              </div>
                              <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{tx.signature?.slice(0, 10)}…{tx.signature?.slice(-6)}</p>
                              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                {transferAmount > 0 && (
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${isIncoming ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                                    {isIncoming ? "+" : "-"}{transferAmount.toFixed(4)} SOL
                                  </span>
                                )}
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{tx.source || tx.type}</span>
                              </div>
                            </div>
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                          </div>
                        );
                      })}
                    </div>
                  ) : activities.length > 0 ? (
                    <div className="space-y-3">
                      {activities.map((activity, index) => (
                        <div key={activity.id}
                          className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all">
                          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                            activity.activity_type === "trade" ? "bg-primary/20 text-primary" :
                            activity.activity_type === "follow" ? "bg-secondary/20 text-secondary" :
                            activity.activity_type === "achievement" ? "bg-yellow-500/20 text-yellow-400" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {activity.activity_type === "trade" ? <TrendingUp className="h-4 w-4" /> :
                             activity.activity_type === "follow" ? <Users className="h-4 w-4" /> :
                             activity.activity_type === "achievement" ? <Trophy className="h-4 w-4" /> :
                             <Activity className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium text-sm">{activity.title}</p>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</span>
                            </div>
                            {activity.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{activity.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                      <p className="font-medium text-sm">No activity yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {profile.wallet_address ? "Loading transactions…" : "Connect a wallet to see live transaction history"}
                      </p>
                      {isOwnProfile && !profile.wallet_address && (
                        <Button size="sm" className="mt-4 rounded-xl" onClick={() => setEditing(true)}>
                          <Wallet className="h-4 w-4 mr-2" /> Connect Wallet
                        </Button>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PORTFOLIO TAB ─────────────────────────────────────────────── */}
          <TabsContent value="portfolio">
            <div className="space-y-4">
              {/* Wallet Overview */}
              {profile.wallet_address ? (
                <>
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-primary" />
                        Wallet Overview
                        <div className="flex items-center gap-1.5 ml-auto">
                          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-xs text-green-500">Live</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing} className="rounded-xl">
                          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 mb-4 p-2.5 rounded-xl bg-muted/30 border border-white/10">
                        <Wallet className="h-4 w-4 text-primary shrink-0" />
                        <a href={`https://solscan.io/account/${profile.wallet_address}`} target="_blank" rel="noopener noreferrer"
                          className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                          {profile.wallet_address.slice(0, 12)}…{profile.wallet_address.slice(-12)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>

                      {loadingStats ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />
                          ))}
                        </div>
                      ) : walletStats ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
                            <p className="text-xs text-muted-foreground mb-1.5">Total Portfolio</p>
                            <p className="text-xl font-bold text-primary">{formatUsd(walletStats.totalUsdValue || 0)}</p>
                          </div>
                          <div className="p-4 rounded-xl bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/10">
                            <p className="text-xs text-muted-foreground mb-1.5">SOL Balance</p>
                            <p className="text-xl font-bold text-secondary">{walletStats.balance?.toFixed(4)} SOL</p>
                            <p className="text-xs text-muted-foreground">≈ {formatUsd(walletStats.usdValue || 0)}</p>
                          </div>
                          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <p className="text-xs text-muted-foreground mb-1.5">Tokens</p>
                            <p className="text-xl font-bold">{walletStats.tokenCount || tokenHoldings.length || 0}</p>
                          </div>
                          <div className={`p-4 rounded-xl border ${(walletStats.priceChange24h || 0) >= 0 ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
                            <p className="text-xs text-muted-foreground mb-1.5">SOL 24h</p>
                            <p className={`text-xl font-bold ${(walletStats.priceChange24h || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {(walletStats.priceChange24h || 0) >= 0 ? "+" : ""}{walletStats.priceChange24h?.toFixed(2) || 0}%
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground text-sm">Loading wallet data…</div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Token Holdings */}
                  {tokenHoldings.length > 0 && (
                    <Card className="glass-card">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Coins className="h-5 w-5 text-primary" />
                          Token Holdings
                          <Badge variant="secondary" className="ml-auto">{tokenHoldings.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {tokenHoldings.map((token, index) => {
                            const balance = token.token_info?.balance
                              ? token.token_info.balance / Math.pow(10, token.token_info.decimals || 0)
                              : 0;
                            const value = token.token_info?.price_info?.total_price || 0;
                            const pct = walletStats?.totalUsdValue ? (value / walletStats.totalUsdValue * 100) : 0;

                            return (
                              <div key={token.id || index}
                                className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-white/10">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center overflow-hidden shrink-0">
                                  {token.content?.links?.image ? (
                                    <img src={token.content.links.image} alt={token.content.metadata.symbol}
                                      className="w-full h-full object-cover"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                  ) : (
                                    <span className="text-[10px] font-bold text-primary">
                                      {token.content.metadata.symbol?.slice(0, 2) || "?"}
                                    </span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <p className="font-medium text-sm truncate">{token.content.metadata.name || "Unknown"}</p>
                                    <p className="font-semibold text-sm ml-2">{formatUsd(value)}</p>
                                  </div>
                                  <div className="flex items-center justify-between mt-0.5">
                                    <span className="text-xs text-muted-foreground">{token.content.metadata.symbol} · {balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                    <span className="text-[11px] text-muted-foreground">{pct.toFixed(1)}%</span>
                                  </div>
                                  {walletStats?.totalUsdValue && value > 0 && (
                                    <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                                      <div className="h-full bg-primary/60 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card className="glass-card border-dashed">
                  <CardContent className="py-12 text-center">
                    <Wallet className="h-14 w-14 text-muted-foreground mx-auto mb-4 opacity-40" />
                    <h3 className="font-semibold mb-2">No Wallet Connected</h3>
                    <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
                      Connect a Solana wallet to view live portfolio value, token holdings, and on-chain activity.
                    </p>
                    {isOwnProfile && (
                      <Button onClick={() => setEditing(true)} className="rounded-xl">
                        <Wallet className="h-4 w-4 mr-2" /> Connect Wallet
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ── TRADES TAB ────────────────────────────────────────────────── */}
          <TabsContent value="trades">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Trade History
                  <Badge variant="secondary" className="ml-auto">{tradeHistory.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tradeHistory.length > 0 ? (
                  <div className="space-y-2">
                    {tradeHistory.map((trade) => {
                      const isBuy = trade.action === "buy" || trade.action === "BUY";
                      const hasPnl = trade.pnl !== null && trade.pnl !== undefined;
                      return (
                        <div key={trade.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${isBuy ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                            {isBuy ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm">{trade.token_symbol}</p>
                                <Badge variant="outline" className={`text-[10px] ${isBuy ? "text-green-400 border-green-400/30" : "text-red-400 border-red-400/30"}`}>
                                  {trade.action?.toUpperCase()}
                                </Badge>
                              </div>
                              {hasPnl && (
                                <p className={`font-semibold text-sm ${(trade.pnl || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                                  {(trade.pnl || 0) >= 0 ? "+" : ""}{formatUsd(trade.pnl || 0)}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-xs text-muted-foreground">
                                {trade.amount?.toLocaleString(undefined, { maximumFractionDigits: 4 })} @ {formatUsd(trade.price || 0)}
                              </span>
                              <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <p className="font-medium text-sm">No trades recorded yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Trade history will appear here once you start trading</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── COMMUNITIES TAB ───────────────────────────────────────────── */}
          <TabsContent value="communities">
            <div className="space-y-4">
              {communities.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {communities.map((mem) => {
                    const c = mem.community;
                    if (!c) return null;
                    return (
                      <Card key={mem.id} className="glass-card hover:border-primary/30 transition-colors cursor-pointer group"
                        onClick={() => navigate("/communities")}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            {/* Community icon / banner */}
                            <div className="h-12 w-12 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-xl">
                              {safeAvatarUrl(c.banner_url) ? (
                                <img src={safeAvatarUrl(c.banner_url)} alt={c.name} className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              ) : (
                                c.icon || "🏠"
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold text-sm truncate">{c.name}</p>
                                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                              </div>
                              {c.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.description}</p>}
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <Badge variant="outline" className="text-[10px] gap-1">
                                  {getPrivacyIcon(c.privacy)}
                                  {c.privacy.replace("_", " ")}
                                </Badge>
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <Users className="h-3 w-3" /> {c.member_count?.toLocaleString() || 0}
                                </span>
                                {mem.role && mem.role !== "member" && (
                                  <Badge className="text-[10px] bg-primary/20 text-primary border-0">
                                    {mem.role}
                                  </Badge>
                                )}
                                {c.category && (
                                  <Badge variant="secondary" className="text-[10px]">{c.category}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="glass-card border-dashed">
                  <CardContent className="py-12 text-center">
                    <Hash className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <p className="font-medium text-sm">No communities yet</p>
                    <p className="text-xs text-muted-foreground mt-1 mb-5">
                      {isOwnProfile ? "Join communities to connect with other traders" : "This user hasn't joined any communities"}
                    </p>
                    {isOwnProfile && (
                      <Button size="sm" className="rounded-xl" onClick={() => navigate("/communities")}>
                        Explore Communities
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ── SOCIAL TAB ────────────────────────────────────────────────── */}
          <TabsContent value="social">
            <SocialTab targetUserId={targetUserId!} isOwnProfile={isOwnProfile} />
          </TabsContent>

          {/* ── STATS TAB ─────────────────────────────────────────────────── */}
          <TabsContent value="stats">
            <div className="space-y-4">

              {/* Leaderboard rank highlight */}
              {leaderboardRank && (
                <Card className={`glass-card border-og-gold/20 bg-gradient-to-br from-og-gold/5 to-transparent`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-14 w-14 rounded-xl bg-og-gold/10 border border-og-gold/20 flex items-center justify-center shrink-0">
                      {leaderboardRank === 1 ? <Crown className="h-7 w-7 text-og-gold" /> :
                       leaderboardRank <= 3 ? <Medal className="h-7 w-7 text-og-gold" /> :
                       <Trophy className="h-7 w-7 text-og-gold" />}
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-og-gold">#{leaderboardRank}</p>
                      <p className="text-sm text-muted-foreground">Global Leaderboard Rank</p>
                    </div>
                    <Button variant="ghost" size="sm" className="ml-auto rounded-xl" onClick={() => navigate("/leaderboard")}>
                      View Board <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Main stats grid */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Trading Statistics
                    {profile.wallet_address && walletStats && (
                      <Badge variant="secondary" className="ml-auto text-[10px]">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse mr-1" />
                        Live Data
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Portfolio Value", value: formatUsd(walletStats?.totalUsdValue || profile.total_pnl || 0), icon: <Wallet className="h-4 w-4 text-primary" />, accent: "primary" },
                      { label: "SOL Balance",     value: `${walletStats?.balance?.toFixed(4) || "0.00"} SOL`, icon: <Coins className="h-4 w-4 text-secondary" />, accent: "secondary" },
                      { label: "Tokens Held",     value: walletStats?.tokenCount || tokenHoldings.length || 0, icon: <Flame className="h-4 w-4 text-orange-400" />, accent: "" },
                      { label: "NFTs",            value: walletStats?.nftCount || 0, icon: <ImageIcon className="h-4 w-4 text-blue-400" />, accent: "" },
                    ].map((item, i) => (
                      <div key={i} className={`p-4 rounded-xl ${item.accent ? `bg-gradient-to-br from-${item.accent}/10 to-${item.accent}/5 border border-${item.accent}/10` : "bg-white/5 border border-white/10"}`}>
                        <div className="flex items-center gap-2 mb-2">{item.icon}<span className="text-xs text-muted-foreground">{item.label}</span></div>
                        <p className={`text-xl font-bold ${item.accent ? `text-${item.accent}` : ""}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Wallet metrics */}
              <Card className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Percent className="h-4 w-4 text-primary" />
                    Wallet Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
                      <p className="text-xs text-muted-foreground mb-2">Transactions</p>
                      <p className="text-2xl font-bold text-primary">{transactionCount || walletTransactions.length || 0}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/10">
                      <p className="text-xs text-muted-foreground mb-2">SOL in USD</p>
                      <p className="text-2xl font-bold text-secondary">{formatUsd(walletStats?.usdValue || 0)}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-xs text-muted-foreground mb-2">Total Assets</p>
                      <p className="text-2xl font-bold">{walletStats?.totalAssets || ((walletStats?.tokenCount || 0) + (walletStats?.nftCount || 0))}</p>
                    </div>
                    <div className={`p-4 rounded-xl border ${(walletStats?.priceChange24h || 0) >= 0 ? "bg-green-500/5 border-green-500/15" : "bg-red-500/5 border-red-500/15"}`}>
                      <p className="text-xs text-muted-foreground mb-2">SOL 24h</p>
                      <p className={`text-2xl font-bold ${(walletStats?.priceChange24h || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {(walletStats?.priceChange24h || 0) >= 0 ? "+" : ""}{walletStats?.priceChange24h?.toFixed(2) || 0}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Social stats */}
              <Card className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Social Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Followers",    value: profile.followers_count || 0 },
                      { label: "Following",    value: profile.following_count || 0 },
                      { label: "Communities",  value: communities.length },
                      { label: "Reputation",   value: (profile.reputation_score || 0).toLocaleString() + " XP" },
                    ].map((s, i) => (
                      <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                        <p className="text-2xl font-bold">{s.value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Holdings breakdown */}
              {tokenHoldings.length > 0 && walletStats && (
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Coins className="h-4 w-4 text-primary" />
                      Portfolio Breakdown
                      <Badge variant="outline" className="ml-auto">{tokenHoldings.length} tokens</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {tokenHoldings.slice(0, 8).map((token, index) => {
                        const balance = token.token_info?.balance
                          ? token.token_info.balance / Math.pow(10, token.token_info.decimals || 0) : 0;
                        const value = token.token_info?.price_info?.total_price || 0;
                        const pct = walletStats.totalUsdValue ? (value / walletStats.totalUsdValue * 100) : 0;

                        return (
                          <div key={token.id || index} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center overflow-hidden shrink-0">
                              {token.content?.links?.image ? (
                                <img src={token.content.links.image} alt={token.content.metadata.symbol}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              ) : (
                                <span className="text-[10px] font-bold text-primary">
                                  {token.content.metadata.symbol?.slice(0, 2) || "?"}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm truncate">{token.content.metadata.symbol || "Unknown"}</p>
                                <p className="font-semibold text-sm ml-2">{formatUsd(value)}</p>
                              </div>
                              <div className="flex items-center justify-between text-xs text-muted-foreground mt-0.5">
                                <span>{balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                <span>{pct.toFixed(1)}%</span>
                              </div>
                              <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full bg-primary/50 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* No wallet CTA */}
              {!profile.wallet_address && (
                <Card className="glass-card border-dashed">
                  <CardContent className="py-8 text-center">
                    <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <h3 className="font-medium mb-1">No Wallet Connected</h3>
                    <p className="text-sm text-muted-foreground mb-4">Connect a wallet to see live trading statistics and portfolio data</p>
                    {isOwnProfile && (
                      <Button onClick={() => setEditing(true)} className="rounded-xl">
                        <Wallet className="h-4 w-4 mr-2" /> Connect Wallet
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

// ─── Social Tab Component ──────────────────────────────────────────────────────

const SocialTab = ({ targetUserId, isOwnProfile }: { targetUserId: string; isOwnProfile: boolean }) => {
  const { followers, following, mutuals, loading, follow, unfollow, isFollowing } = useFriends();
  const navigate = useNavigate();
  const [socialTab, setSocialTab] = useState<"followers" | "following" | "mutuals">("followers");
  const [otherFollowers, setOtherFollowers] = useState<any[]>([]);
  const [otherFollowing, setOtherFollowing] = useState<any[]>([]);

  useEffect(() => {
    if (!isOwnProfile) fetchOtherSocial();
  }, [targetUserId, isOwnProfile]);

  const fetchOtherSocial = async () => {
    const { data: fRows } = await supabase.from("followers").select("follower_id").eq("following_id", targetUserId);
    const { data: gRows } = await supabase.from("followers").select("following_id").eq("follower_id", targetUserId);
    const fIds = fRows?.map((r: any) => r.follower_id) || [];
    const gIds = gRows?.map((r: any) => r.following_id) || [];
    const allIds = [...new Set([...fIds, ...gIds])];
    if (!allIds.length) return;
    const { data: profiles } = await supabase.from("profiles").select("user_id, username, avatar_url, bio, badge").in("user_id", allIds);
    const pm = new Map(profiles?.map((p: any) => [p.user_id, p]) || []);
    setOtherFollowers(fIds.map((id: string) => ({ user_id: id, ...pm.get(id) })));
    setOtherFollowing(gIds.map((id: string) => ({ user_id: id, ...pm.get(id) })));
  };

  const displayFollowers = isOwnProfile ? followers : otherFollowers;
  const displayFollowing = isOwnProfile ? following : otherFollowing;
  const displayMutuals   = isOwnProfile ? mutuals : [];
  const currentList = socialTab === "followers" ? displayFollowers : socialTab === "following" ? displayFollowing : displayMutuals;

  return (
    <Card className="glass-card">
      <CardContent className="p-4 space-y-4">
        <div className="flex gap-1 p-0.5 bg-muted/20 rounded-full">
          {[
            { key: "followers" as const, label: `Followers (${displayFollowers.length})` },
            { key: "following" as const, label: `Following (${displayFollowing.length})` },
            ...(isOwnProfile ? [{ key: "mutuals" as const, label: `Friends (${displayMutuals.length})` }] : []),
          ].map((t) => (
            <button key={t.key} onClick={() => setSocialTab(t.key)}
              className={`flex-1 py-2 rounded-full text-xs font-semibold transition-colors ${socialTab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <ScrollArea className="h-[420px]">
          <div className="space-y-2">
            {currentList.map((person: any) => (
              <div key={person.user_id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/10 transition-colors group">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground text-sm font-bold overflow-hidden shrink-0">
                  {safeAvatarUrl(person.avatar_url) ? (
                    <img src={safeAvatarUrl(person.avatar_url)} className="w-full h-full rounded-full object-cover" alt=""
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    (person.username || "?")[0].toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{person.username || "User"}</p>
                  {person.bio && <p className="text-xs text-muted-foreground truncate">{person.bio}</p>}
                  {person.badge && <Badge className="text-[10px] mt-0.5">{person.badge}</Badge>}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/profile/${person.user_id}`)} className="rounded-full text-xs">
                    View
                  </Button>
                  {isOwnProfile && socialTab !== "followers" && (
                    <Button variant="outline" size="sm" onClick={() => unfollow(person.user_id)} className="rounded-full text-xs">
                      <UserMinus className="h-3 w-3" />
                    </Button>
                  )}
                  {isOwnProfile && socialTab === "followers" && !isFollowing(person.user_id) && (
                    <Button size="sm" onClick={() => follow(person.user_id)} className="rounded-full text-xs btn-3d">
                      <UserPlus className="h-3 w-3 mr-1" /> Follow Back
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {currentList.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-sm">
                  {socialTab === "followers" ? "No followers yet" : socialTab === "following" ? "Not following anyone" : "No mutual friends yet"}
                </p>
                <p className="text-xs mt-1 opacity-70">
                  {socialTab === "followers" ? "Share your profile to get followers!" : "Discover users on the Leaderboard"}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default Profile;
