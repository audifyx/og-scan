import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { User, Settings, Twitter, Globe, MessageCircle, Trophy, TrendingUp, Users, Activity, Copy, Check, UserPlus, UserMinus, Wallet, Coins, ArrowUpRight, ArrowDownRight, RefreshCw, ExternalLink, Percent, Clock, Flame, Heart } from "lucide-react";
import { AvatarSelector, renderAvatar } from "@/components/avatars/AvatarSelector";
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
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useFriends } from "@/hooks/useFriends";

interface UserProfile {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
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
    metadata: {
      name: string;
      symbol: string;
    };
    links?: {
      image?: string;
    };
  };
  token_info?: {
    balance: number;
    decimals: number;
    price_info?: {
      price_per_token: number;
      total_price: number;
    };
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

  const isOwnProfile = !userId || userId === user?.id;
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (targetUserId) {
      fetchProfile();
      fetchActivities();
      if (!isOwnProfile && user) {
        checkFollowStatus();
      }
    }
  }, [targetUserId, user]);

  const fetchWalletData = async (walletAddress: string) => {
    if (!walletAddress) return;
    setLoadingStats(true);
    try {
      // Fetch wallet overview
      const { data: overviewData, error: overviewError } = await supabase.functions.invoke('solana-tracker', {
        body: { action: 'getWalletOverview', walletAddress },
      });
      
      if (!overviewError && overviewData) {
        setWalletStats(overviewData);
        
        // Update profile stats if it's own profile
        if (isOwnProfile && user) {
          await supabase.from("profiles").update({
            total_pnl: overviewData.totalUsdValue || 0,
          }).eq("user_id", user.id);
        }
      }

      // Fetch token holdings
      const { data: assetsData, error: assetsError } = await supabase.functions.invoke('solana-tracker', {
        body: { action: 'getAssets', walletAddress, page: 1, limit: 20 },
      });

      if (!assetsError && assetsData?.assets) {
        const tokens = assetsData.assets.filter((item: any) => 
          item.interface === 'FungibleToken' || item.interface === 'FungibleAsset'
        );
        setTokenHoldings(tokens.slice(0, 10));
      }

      // Fetch live transactions from wallet
      const { data: txData, error: txError } = await supabase.functions.invoke('solana-tracker', {
        body: { action: 'getTransactions', walletAddress, limit: 20 },
      });

      if (!txError && txData?.transactions) {
        setWalletTransactions(txData.transactions);
        setTransactionCount(txData.signatures?.length || txData.transactions.length);
      }
    } catch (err) {
      console.error('Error fetching wallet data:', err);
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    if (profile?.wallet_address) {
      setRefreshing(true);
      fetchWalletData(profile.wallet_address);
    }
  };

  useEffect(() => {
    if (profile?.wallet_address) {
      fetchWalletData(profile.wallet_address);
    }
  }, [profile?.wallet_address]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", targetUserId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist - create one for the current user if viewing own profile
        if (isOwnProfile && user) {
          const newProfile = {
            user_id: user.id,
            username: null,
            avatar_url: null,
            bio: null,
            twitter_handle: null,
            discord_handle: null,
            website: null,
            total_pnl: 0,
            win_rate: 0,
            trades_count: 0,
            followers_count: 0,
            following_count: 0,
            is_public: true,
            badge: null,
            wallet_address: null,
          };
          
          const { data: createdProfile, error: createError } = await supabase
            .from("profiles")
            .insert(newProfile)
            .select()
            .single();
          
          if (createError) {
            console.error("Error creating profile:", createError);
            setProfile(null);
          } else {
            setProfile(createdProfile);
            setEditedProfile(createdProfile);
            toast.success("Profile created! Customize it below.");
            setEditing(true);
          }
        } else {
          // Profile not found for another user
          setProfile(null);
        }
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
      const { data, error } = await supabase
        .from("user_activity")
        .select("*")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error("Error fetching activities:", error);
    }
  };

  const checkFollowStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("followers")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId)
      .single();
    
    setIsFollowing(!!data);
  };

  const handleFollow = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    try {
      if (isFollowing) {
        await supabase
          .from("followers")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId);
        setIsFollowing(false);
        toast.success("Unfollowed successfully");
      } else {
        await supabase
          .from("followers")
          .insert({ follower_id: user.id, following_id: targetUserId });
        setIsFollowing(true);
        toast.success("Following!");
      }
      fetchProfile();
    } catch (error) {
      console.error("Error following:", error);
      toast.error("Failed to update follow status");
    }
  };

  const saveProfile = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          username: editedProfile.username,
          bio: editedProfile.bio,
          twitter_handle: editedProfile.twitter_handle,
          discord_handle: editedProfile.discord_handle,
          website: editedProfile.website,
          is_public: editedProfile.is_public,
          wallet_address: editedProfile.wallet_address,
        })
        .eq("user_id", user.id);

      if (error) throw error;
      setProfile({ ...profile, ...editedProfile } as UserProfile);
      setEditing(false);
      toast.success("Profile updated!");
      
      // Fetch new wallet data if wallet address changed
      if (editedProfile.wallet_address) {
        fetchWalletData(editedProfile.wallet_address);
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    }
  };

  const copyProfileLink = () => {
    const url = `${window.location.origin}/profile/${targetUserId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Profile link copied!");
  };

  const getBadgeColor = (badge: string | null) => {
    switch (badge) {
      case "whale": return "bg-blue-500";
      case "diamond": return "bg-cyan-400";
      case "gold": return "bg-yellow-500";
      case "silver": return "bg-gray-400";
      default: return "bg-muted";
    }
  };

  const formatUsd = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

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

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Profile Header */}
        <Card className="glass-card overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-primary/30 via-secondary/20 to-primary/30 relative">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHoiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvZz48L3N2Zz4=')] opacity-30" />
          </div>
          <CardContent className="relative pt-0">
            <div className="flex flex-col md:flex-row gap-4 -mt-12">
              {/* Avatar */}
              <div className="relative">
                {renderAvatar(profile.avatar_url, profile.username, "lg")}
                {profile.badge && (
                  <div className={`absolute -bottom-1 -right-1 h-8 w-8 rounded-lg ${getBadgeColor(profile.badge)} flex items-center justify-center shadow-lg`}>
                    <Trophy className="h-4 w-4 text-white" />
                  </div>
                )}
                {isOwnProfile && (
                  <div className="absolute -top-2 -left-2">
                    <AvatarSelector 
                      currentAvatar={profile.avatar_url} 
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

              {/* Info */}
              <div className="flex-1 pt-4 md:pt-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold">{profile.username || "Anonymous"}</h1>
                      {profile.badge && (
                        <Badge className={getBadgeColor(profile.badge)}>
                          {profile.badge.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-1">{profile.bio || "No bio yet"}</p>
                    
                    {/* Social Links */}
                    <div className="flex items-center gap-4 mt-3">
                      {profile.twitter_handle && (
                        <a href={`https://twitter.com/${profile.twitter_handle}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                          <Twitter className="h-4 w-4" />
                        </a>
                      )}
                      {profile.discord_handle && (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <MessageCircle className="h-4 w-4" />
                          <span className="text-xs">{profile.discord_handle}</span>
                        </span>
                      )}
                      {profile.website && (
                        <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                          <Globe className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={copyProfileLink} className="rounded-xl">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    {isOwnProfile ? (
                      <Button onClick={() => setEditing(!editing)} className="rounded-xl">
                        <Settings className="h-4 w-4 mr-2" />
                        {editing ? "Cancel" : "Edit Profile"}
                      </Button>
                    ) : (
                      <Button onClick={handleFollow} variant={isFollowing ? "outline" : "default"} className="rounded-xl">
                        {isFollowing ? (
                          <>
                            <UserMinus className="h-4 w-4 mr-2" />
                            Unfollow
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Follow
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Connected Wallet Section */}
            {profile.wallet_address && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10">
                      <Wallet className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Connected Wallet</p>
                      <a 
                        href={`https://solscan.io/account/${profile.wallet_address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                      >
                        {profile.wallet_address.slice(0, 8)}...{profile.wallet_address.slice(-8)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs text-green-500">Live</span>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="rounded-xl"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                {/* Live Stats Grid */}
                {walletStats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Wallet className="h-4 w-4 text-primary" />
                        <span className="text-xs text-muted-foreground">Portfolio</span>
                      </div>
                      <p className="text-xl font-bold text-primary">
                        {formatUsd(walletStats.totalUsdValue || 0)}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Coins className="h-4 w-4 text-secondary" />
                        <span className="text-xs text-muted-foreground">SOL Balance</span>
                      </div>
                      <p className="text-xl font-bold text-secondary">
                        {walletStats.balance?.toFixed(4) || "0"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ≈ {formatUsd(walletStats.usdValue || 0)}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Flame className="h-4 w-4 text-orange-500" />
                        <span className="text-xs text-muted-foreground">Tokens</span>
                      </div>
                      <p className="text-xl font-bold">{walletStats.tokenCount || 0}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 mb-2">
                        {walletStats.priceChange24h >= 0 ? (
                          <ArrowUpRight className="h-4 w-4 text-green-500" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-xs text-muted-foreground">SOL 24h</span>
                      </div>
                      <p className={`text-xl font-bold ${walletStats.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {walletStats.priceChange24h >= 0 ? '+' : ''}{walletStats.priceChange24h?.toFixed(2) || 0}%
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Basic Stats (when no wallet) */}
            {!profile.wallet_address && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
                <div className="text-center p-4 rounded-xl bg-white/5">
                  <p className="text-2xl font-bold text-primary">{formatUsd(profile.total_pnl || 0)}</p>
                  <p className="text-xs text-muted-foreground">Portfolio Value</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-white/5">
                  <p className="text-2xl font-bold">{profile.trades_count || 0}</p>
                  <p className="text-xs text-muted-foreground">Trades</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-white/5">
                  <p className="text-2xl font-bold">{profile.followers_count || 0}</p>
                  <p className="text-xs text-muted-foreground">Followers</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-white/5">
                  <p className="text-2xl font-bold">{profile.following_count || 0}</p>
                  <p className="text-xs text-muted-foreground">Following</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Token Holdings Section (when wallet connected) */}
        {profile.wallet_address && tokenHoldings.length > 0 && !editing && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                Top Holdings
                <Badge variant="secondary" className="ml-2">{tokenHoldings.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tokenHoldings.map((token, index) => {
                  const balance = token.token_info?.balance 
                    ? token.token_info.balance / Math.pow(10, token.token_info.decimals || 0)
                    : 0;
                  const value = token.token_info?.price_info?.total_price || 0;

                  return (
                    <div 
                      key={token.id || index}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center overflow-hidden">
                        {token.content?.links?.image ? (
                          <img 
                            src={token.content.links.image} 
                            alt={token.content.metadata.symbol}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="text-xs font-bold text-primary">
                            {token.content.metadata.symbol?.slice(0, 2) || '?'}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{token.content.metadata.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{token.content.metadata.symbol}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{formatUsd(value)}</p>
                        <p className="text-xs text-muted-foreground">
                          {balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit Form or Activity Feed */}
        {editing ? (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Edit Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={editedProfile.username || ""}
                    onChange={(e) => setEditedProfile({ ...editedProfile, username: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Twitter Handle</Label>
                  <Input
                    value={editedProfile.twitter_handle || ""}
                    onChange={(e) => setEditedProfile({ ...editedProfile, twitter_handle: e.target.value })}
                    placeholder="@username"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Discord Handle</Label>
                  <Input
                    value={editedProfile.discord_handle || ""}
                    onChange={(e) => setEditedProfile({ ...editedProfile, discord_handle: e.target.value })}
                    placeholder="username#0000"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input
                    value={editedProfile.website || ""}
                    onChange={(e) => setEditedProfile({ ...editedProfile, website: e.target.value })}
                    placeholder="https://"
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Bio</Label>
                <Textarea
                  value={editedProfile.bio || ""}
                  onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                  placeholder="Tell others about yourself..."
                  rows={3}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  Connected Wallet Address
                </Label>
                <Input
                  value={editedProfile.wallet_address || ""}
                  onChange={(e) => setEditedProfile({ ...editedProfile, wallet_address: e.target.value })}
                  placeholder="Your Solana wallet address for live stats"
                  className="rounded-xl font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Connect your wallet to display live portfolio value, SOL balance, token holdings, and trading stats
                </p>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editedProfile.is_public}
                    onCheckedChange={(checked) => setEditedProfile({ ...editedProfile, is_public: checked })}
                  />
                  <Label>Public Profile</Label>
                </div>
                <Button onClick={saveProfile} className="rounded-xl">Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="activity" className="w-full">
            <TabsList className="grid w-full max-w-lg grid-cols-3 rounded-xl">
              <TabsTrigger value="activity" className="rounded-xl">
                <Activity className="h-4 w-4 mr-2" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="social" className="rounded-xl">
                <Users className="h-4 w-4 mr-2" />
                Social
              </TabsTrigger>
              <TabsTrigger value="stats" className="rounded-xl">
                <TrendingUp className="h-4 w-4 mr-2" />
                Stats
              </TabsTrigger>
            </TabsList>

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
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {/* Show live wallet transactions if wallet is connected */}
                    {profile.wallet_address && walletTransactions.length > 0 ? (
                      <div className="relative">
                        <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-secondary/50 to-transparent" />
                        
                        <div className="space-y-3">
                          {walletTransactions.map((tx, index) => {
                            const isSwap = tx.type === 'SWAP';
                            const isTransfer = tx.type === 'TRANSFER' || tx.type === 'SOL_TRANSFER';
                            const isNftAction = tx.type === 'NFT_SALE' || tx.type === 'NFT_MINT' || tx.type === 'NFT_LISTING';
                            const timestamp = tx.timestamp ? new Date(tx.timestamp * 1000) : new Date();
                            
                            // Calculate transfer amount
                            let transferAmount = 0;
                            let isIncoming = false;
                            if (tx.nativeTransfers?.[0]) {
                              transferAmount = tx.nativeTransfers[0].amount / 1e9;
                              isIncoming = tx.nativeTransfers[0].toUserAccount === profile.wallet_address;
                            }
                            
                            return (
                              <div 
                                key={tx.signature || index} 
                                className="relative flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-muted/40 to-muted/20 hover:from-muted/60 hover:to-muted/30 transition-all group cursor-pointer"
                                style={{ animationDelay: `${index * 50}ms` }}
                                onClick={() => window.open(`https://solscan.io/tx/${tx.signature}`, '_blank')}
                              >
                                <div className={`relative z-10 h-10 w-10 rounded-xl flex items-center justify-center shadow-lg ${
                                  isSwap 
                                    ? 'bg-gradient-to-br from-purple-500 to-purple-500/50' 
                                    : isIncoming
                                    ? 'bg-gradient-to-br from-green-500 to-green-500/50'
                                    : isNftAction
                                    ? 'bg-gradient-to-br from-yellow-500 to-yellow-500/50'
                                    : 'bg-gradient-to-br from-red-500 to-red-500/50'
                                }`}>
                                  {isSwap ? (
                                    <RefreshCw className="h-5 w-5 text-white" />
                                  ) : isIncoming ? (
                                    <ArrowDownRight className="h-5 w-5 text-white" />
                                  ) : isNftAction ? (
                                    <Trophy className="h-5 w-5 text-white" />
                                  ) : (
                                    <ArrowUpRight className="h-5 w-5 text-white" />
                                  )}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                        {isSwap ? 'Token Swap' : isNftAction ? tx.type.replace(/_/g, ' ') : isIncoming ? 'Received' : 'Sent'}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                                        {tx.signature?.slice(0, 8)}...{tx.signature?.slice(-8)}
                                      </p>
                                    </div>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      {formatDistanceToNow(timestamp, { addSuffix: true })}
                                    </span>
                                  </div>
                                  
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {transferAmount > 0 && (
                                      <span className={`text-xs px-2 py-1 rounded-full ${isIncoming ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                        {isIncoming ? '+' : '-'}{transferAmount.toFixed(4)} SOL
                                      </span>
                                    )}
                                    <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                                      {tx.source || tx.type}
                                    </span>
                                    {tx.fee && (
                                      <span className="text-xs px-2 py-1 rounded-full bg-muted/50 text-muted-foreground">
                                        Fee: {(tx.fee / 1e9).toFixed(6)} SOL
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : activities.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="relative inline-block">
                          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 blur-xl rounded-full" />
                          <Activity className="h-16 w-16 text-muted-foreground mx-auto mb-4 relative" />
                        </div>
                        <h3 className="font-medium mb-2">No activity yet</h3>
                        <p className="text-sm text-muted-foreground">
                          {profile.wallet_address 
                            ? "Loading transactions from wallet..." 
                            : "Connect a wallet address to see live transaction history"}
                        </p>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-secondary/50 to-transparent" />
                        
                        <div className="space-y-4">
                          {activities.map((activity, index) => (
                            <div 
                              key={activity.id} 
                              className="relative flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-muted/40 to-muted/20 hover:from-muted/60 hover:to-muted/30 transition-all group"
                              style={{ animationDelay: `${index * 50}ms` }}
                            >
                              <div className={`relative z-10 h-10 w-10 rounded-xl flex items-center justify-center shadow-lg ${
                                activity.activity_type === 'trade' 
                                  ? 'bg-gradient-to-br from-primary to-primary/50' 
                                  : activity.activity_type === 'follow'
                                  ? 'bg-gradient-to-br from-secondary to-secondary/50'
                                  : activity.activity_type === 'achievement'
                                  ? 'bg-gradient-to-br from-yellow-500 to-yellow-500/50'
                                  : 'bg-gradient-to-br from-muted to-muted/50'
                              }`}>
                                {activity.activity_type === 'trade' ? (
                                  <TrendingUp className="h-5 w-5 text-white" />
                                ) : activity.activity_type === 'follow' ? (
                                  <Users className="h-5 w-5 text-white" />
                                ) : activity.activity_type === 'achievement' ? (
                                  <Trophy className="h-5 w-5 text-white" />
                                ) : (
                                  <Activity className="h-5 w-5 text-white" />
                                )}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                      {activity.title}
                                    </p>
                                    {activity.description && (
                                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                        {activity.description}
                                      </p>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                                  </span>
                                </div>
                                
                                {activity.data && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {activity.data.amount && (
                                      <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                                        ${activity.data.amount}
                                      </span>
                                    )}
                                    {activity.data.token && (
                                      <span className="text-xs px-2 py-1 rounded-full bg-secondary/10 text-secondary">
                                        {activity.data.token}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="social">
              <SocialTab targetUserId={targetUserId!} isOwnProfile={isOwnProfile} />
            </TabsContent>

            <TabsContent value="stats">
              <div className="space-y-4">
                {/* Main Stats Overview */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Trading Statistics
                      {profile.wallet_address && (
                        <Badge variant="secondary" className="ml-auto">
                          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse mr-1.5" />
                          Live Data
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Wallet className="h-4 w-4 text-primary" />
                          <span className="text-xs text-muted-foreground">Portfolio Value</span>
                        </div>
                        <p className="text-xl font-bold text-primary">
                          {formatUsd(walletStats?.totalUsdValue || profile.total_pnl || 0)}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Coins className="h-4 w-4 text-secondary" />
                          <span className="text-xs text-muted-foreground">SOL Balance</span>
                        </div>
                        <p className="text-xl font-bold text-secondary">
                          {walletStats?.balance?.toFixed(4) || "0.00"} SOL
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Flame className="h-4 w-4 text-orange-500" />
                          <span className="text-xs text-muted-foreground">Tokens Held</span>
                        </div>
                        <p className="text-xl font-bold">{walletStats?.tokenCount || tokenHoldings.length || 0}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="h-4 w-4 text-blue-500" />
                          <span className="text-xs text-muted-foreground">NFTs</span>
                        </div>
                        <p className="text-xl font-bold">{walletStats?.nftCount || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Performance Metrics */}
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Percent className="h-4 w-4 text-primary" />
                      Wallet Metrics
                      {profile.wallet_address && walletStats && (
                        <Badge variant="outline" className="ml-auto text-[10px]">
                          <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse mr-1" />
                          Live
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="h-4 w-4 text-primary" />
                          <span className="text-xs text-muted-foreground">Transactions</span>
                        </div>
                        <p className="text-2xl font-bold text-primary">
                          {transactionCount || walletTransactions.length || 0}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Coins className="h-4 w-4 text-secondary" />
                          <span className="text-xs text-muted-foreground">SOL in USD</span>
                        </div>
                        <p className="text-2xl font-bold text-secondary">
                          {formatUsd(walletStats?.usdValue || 0)}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="h-4 w-4 text-blue-500" />
                          <span className="text-xs text-muted-foreground">Total Assets</span>
                        </div>
                        <p className="text-2xl font-bold">{walletStats?.totalAssets || (walletStats?.tokenCount || 0) + (walletStats?.nftCount || 0)}</p>
                      </div>
                      <div className={`p-4 rounded-xl border ${(walletStats?.priceChange24h || 0) >= 0 ? 'bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/10' : 'bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/10'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          {(walletStats?.priceChange24h || 0) >= 0 ? (
                            <ArrowUpRight className="h-4 w-4 text-green-500" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-xs text-muted-foreground">SOL 24h</span>
                        </div>
                        <p className={`text-2xl font-bold ${(walletStats?.priceChange24h || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {(walletStats?.priceChange24h || 0) >= 0 ? '+' : ''}{walletStats?.priceChange24h?.toFixed(2) || 0}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Current Holdings Breakdown */}
                {profile.wallet_address && tokenHoldings.length > 0 && (
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Coins className="h-4 w-4 text-primary" />
                        Current Holdings
                        <Badge variant="outline" className="ml-auto">{tokenHoldings.length} tokens</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {tokenHoldings.slice(0, 6).map((token, index) => {
                          const balance = token.token_info?.balance 
                            ? token.token_info.balance / Math.pow(10, token.token_info.decimals || 0)
                            : 0;
                          const value = token.token_info?.price_info?.total_price || 0;
                          const percentage = walletStats?.totalUsdValue ? (value / walletStats.totalUsdValue * 100) : 0;

                          return (
                            <div 
                              key={token.id || index}
                              className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                            >
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center overflow-hidden">
                                {token.content?.links?.image ? (
                                  <img 
                                    src={token.content.links.image} 
                                    alt={token.content.metadata.symbol}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <span className="text-[10px] font-bold text-primary">
                                    {token.content.metadata.symbol?.slice(0, 2) || '?'}
                                  </span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium text-sm truncate">{token.content.metadata.symbol || 'Unknown'}</p>
                                  <p className="font-semibold text-sm">{formatUsd(value)}</p>
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                  <span>{percentage.toFixed(1)}% of portfolio</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Social Stats */}
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      Social Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                        <p className="text-2xl font-bold">{profile.followers_count || 0}</p>
                        <p className="text-xs text-muted-foreground">Followers</p>
                      </div>
                      <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                        <p className="text-2xl font-bold">{profile.following_count || 0}</p>
                        <p className="text-xs text-muted-foreground">Following</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* No Wallet Connected Message */}
                {!profile.wallet_address && (
                  <Card className="glass-card border-dashed">
                    <CardContent className="py-8 text-center">
                      <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <h3 className="font-medium mb-1">No Wallet Connected</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Connect a wallet to see live trading statistics and portfolio data
                      </p>
                      {isOwnProfile && (
                        <Button onClick={() => setEditing(true)} className="rounded-xl">
                          <Wallet className="h-4 w-4 mr-2" />
                          Connect Wallet
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
};

const SocialTab = ({ targetUserId, isOwnProfile }: { targetUserId: string; isOwnProfile: boolean }) => {
  const { followers, following, mutuals, loading, follow, unfollow, isFollowing } = useFriends();
  const navigate = useNavigate();
  const [socialTab, setSocialTab] = useState<"followers" | "following" | "mutuals">("followers");

  // For other users' profiles, fetch their followers/following
  const [otherFollowers, setOtherFollowers] = useState<any[]>([]);
  const [otherFollowing, setOtherFollowing] = useState<any[]>([]);

  useEffect(() => {
    if (!isOwnProfile) {
      fetchOtherSocial();
    }
  }, [targetUserId, isOwnProfile]);

  const fetchOtherSocial = async () => {
    const { data: fRows } = await supabase.from("followers").select("follower_id").eq("following_id", targetUserId);
    const { data: gRows } = await supabase.from("followers").select("following_id").eq("follower_id", targetUserId);
    const fIds = fRows?.map(r => r.follower_id) || [];
    const gIds = gRows?.map(r => r.following_id) || [];
    const allIds = [...new Set([...fIds, ...gIds])];
    if (allIds.length === 0) return;
    const { data: profiles } = await supabase.from("profiles").select("user_id, username, avatar_url, bio, badge").in("user_id", allIds);
    const pm = new Map(profiles?.map(p => [p.user_id, p]) || []);
    setOtherFollowers(fIds.map(id => ({ user_id: id, ...pm.get(id) })));
    setOtherFollowing(gIds.map(id => ({ user_id: id, ...pm.get(id) })));
  };

  const displayFollowers = isOwnProfile ? followers : otherFollowers;
  const displayFollowing = isOwnProfile ? following : otherFollowing;
  const displayMutuals = isOwnProfile ? mutuals : [];

  const currentList = socialTab === "followers" ? displayFollowers : socialTab === "following" ? displayFollowing : displayMutuals;

  return (
    <Card className="glass-card">
      <CardContent className="p-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 p-0.5 bg-muted/20 rounded-full">
          {[
            { key: "followers" as const, label: `Followers (${displayFollowers.length})` },
            { key: "following" as const, label: `Following (${displayFollowing.length})` },
            ...(isOwnProfile ? [{ key: "mutuals" as const, label: `Friends (${displayMutuals.length})` }] : []),
          ].map(t => (
            <button key={t.key} onClick={() => setSocialTab(t.key)} className={`flex-1 py-2 rounded-full text-xs font-semibold transition-colors ${socialTab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* List */}
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {currentList.map((person: any) => (
              <div key={person.user_id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/10 transition-colors group">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground text-sm font-bold overflow-hidden shrink-0">
                  {person.avatar_url ? (
                    <img src={person.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                  ) : (
                    (person.username || "?")[0].toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{person.username || "User"}</p>
                  {person.bio && <p className="text-xs text-muted-foreground truncate">{person.bio}</p>}
                  {person.badge && <Badge className="text-[7px] mt-0.5">{person.badge}</Badge>}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/profile/${person.user_id}`)}
                    className="rounded-full text-xs"
                  >
                    View
                  </Button>
                  {isOwnProfile && socialTab !== "followers" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unfollow(person.user_id)}
                      className="rounded-full text-xs"
                    >
                      <UserMinus className="h-3 w-3" />
                    </Button>
                  )}
                  {isOwnProfile && socialTab === "followers" && !isFollowing(person.user_id) && (
                    <Button
                      size="sm"
                      onClick={() => follow(person.user_id)}
                      className="rounded-full text-xs btn-3d"
                    >
                      <UserPlus className="h-3 w-3 mr-1" /> Follow Back
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {currentList.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">
                  {socialTab === "followers" ? "No followers yet" : socialTab === "following" ? "Not following anyone yet" : "No mutual friends yet"}
                </p>
                <p className="text-sm mt-1">
                  {socialTab === "followers" ? "Share your profile to get followers!" : "Discover users to follow on the Leaderboard"}
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
