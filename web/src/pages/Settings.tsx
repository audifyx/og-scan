import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
// Credits removed
import { ThemePicker } from "@/components/settings/ThemePicker";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  canUseReservedUsername,
  getReservedUsernameMessage,
  isReservedUsername,
  normalizeUsernameForPolicy,
} from "@/lib/usernamePolicy";
import { DEFAULT_NOTIFICATION_PREFERENCES, normalizeNotificationPreferences } from "@/lib/notificationSettings";
import {
  DollarSign, Bell, User, Shield, Webhook, Palette, LogOut, Eye, EyeOff,
  Check, Loader2, KeyRound, Mail, Link, Twitter, MessageSquare, Globe,
  Wallet, Star, Copy, Flame, Trophy, Zap, Clock, ChevronRight, Users, Gift, Share2,
  Code2, Radio, Maximize2, ExternalLink, Plug,
} from "lucide-react";
import {
  ccGetStoredUser,
  ccClearAuth,
  ccStartXLogin,
  type CCUser,
} from "@/lib/ccAuth";
import {
  xStartLogin,
  xGetStoredUser,
  xSetStoredUser,
  type XUser,
} from "@/lib/xAuth";

interface ProfileData {
  username?: string;
  display_name?: string;
  bio?: string;
  twitter_handle?: string;
  discord_handle?: string;
  website_url?: string;
  sol_wallet?: string;
  wallet_address?: string;
  digest_frequency?: string;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  discord_handle?: string;
  location?: string;
  notification_preferences?: Record<string, boolean>;
  theme_preset?: string;
}

const Settings = () => {
  const { user, signOut } = useAuth();

  // Profile state
  const [activeTab, setActiveTab] = useState("profile");
  const [profile, setProfile] = useState<ProfileData>({});
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  // Account/security state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATION_PREFERENCES);
  const [savingNotifs, setSavingNotifs] = useState(false);

  // Webhook state
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [inviteStats, setInviteStats] = useState<{ invited: number; xpEarned: number; recentInvites: { username: string; created_at: string }[] }>({ invited: 0, xpEarned: 0, recentInvites: [] });
  const [loadingInvite, setLoadingInvite] = useState(false);

  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      setLoadingProfile(true);
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setProfile(data);
        setDiscordWebhook(data.discord_handle || "");
        if (data.notification_preferences) {
          setNotifications(normalizeNotificationPreferences(data.notification_preferences));
        }
      }
      setLoadingProfile(false);
    };
    loadProfile();
  }, [user]);

  // Load invite stats
  useEffect(() => {
    if (!user) return;
    const loadInviteStats = async () => {
      setLoadingInvite(true);
      try {
        // Get referral leaderboard entry (it's a view)
        const { data: lb, error: leaderboardError } = await supabase
          .from("referral_leaderboard")
          .select("invited, xp_earned:credits_earned")
          .eq("inviter_id", user.id)
          .maybeSingle();
        if (leaderboardError) throw leaderboardError;

        // Get recent invites with usernames
        const { data: recent, error: recentError } = await supabase
          .from("referrals")
          .select("invitee_id, created_at")
          .eq("inviter_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);
        if (recentError) throw recentError;

        // Fetch usernames for recent invites
        let recentInvites: { username: string; created_at: string }[] = [];
        if (recent && recent.length > 0) {
          const ids = recent.map(r => r.invitee_id);
          const { data: profs, error: profilesError } = await supabase
            .from("profiles")
            .select("user_id, username")
            .in("user_id", ids);
          if (profilesError) throw profilesError;
          const nameMap = new Map((profs || []).map(p => [p.user_id, p.username || "Anonymous"]));
          recentInvites = recent.map(r => ({ username: nameMap.get(r.invitee_id) || "Anonymous", created_at: r.created_at }));
        }

        setInviteStats({ invited: lb?.invited || 0, xpEarned: lb?.xp_earned || 0, recentInvites });
      } catch (error) {
        console.error("Failed to load referral stats", error);
        setInviteStats({ invited: 0, xpEarned: 0, recentInvites: [] });
      } finally {
        setLoadingInvite(false);
      }
    };
    loadInviteStats();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;

    const cleanUsername = normalizeUsernameForPolicy(profile.username || "");
    if (cleanUsername && isReservedUsername(cleanUsername) && !canUseReservedUsername(user.email)) {
      toast.error(getReservedUsernameMessage());
      return;
    }

    setSavingProfile(true);
    try {
      const { error } = await supabase.from("profiles").update({
        username: cleanUsername || null,
        display_name: profile.display_name,
        bio: profile.bio,
        twitter_handle: profile.twitter_handle,
        discord_handle: profile.discord_handle,
        website_url: profile.website_url,
        sol_wallet: profile.sol_wallet,
        wallet_address: profile.sol_wallet,
        location: profile.location,
        digest_frequency: profile.digest_frequency,
        quiet_hours_start: profile.quiet_hours_start,
        quiet_hours_end: profile.quiet_hours_end,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);
      if (error) throw error;
      toast.success("Profile saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPwSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully");
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (e: any) {
      toast.error(e?.message || "Failed to change password");
    } finally {
      setChangingPw(false);
    }
  };

  const handleEmailChange = async () => {
    if (!newEmail || !newEmail.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    if (newEmail === user?.email) {
      toast.error("That's already your current email");
      return;
    }
    setChangingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast.success("Confirmation email sent — check both inboxes");
      setNewEmail("");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update email");
    } finally {
      setChangingEmail(false);
    }
  };

  const saveWebhook = async () => {
    if (!user) return;
    setSavingWebhook(true);
    try {
      await supabase.from("profiles").update({ discord_handle: discordWebhook }).eq("user_id", user.id);
      toast.success("Webhook saved");
    } catch {
      toast.error("Failed to save webhook");
    } finally {
      setSavingWebhook(false);
    }
  };

  const saveNotifications = async () => {
    if (!user) return;
    setSavingNotifs(true);
    try {
      await supabase.from("profiles").update({ notification_preferences: notifications }).eq("user_id", user.id);
      toast.success("Notification preferences saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSavingNotifs(false);
    }
  };

  const copyReferral = () => {
    const code = (profile as any)?.referral_code;
    if (code) {
      navigator.clipboard.writeText(`https://ogscan.fun?ref=${code}`);
      setCopiedReferral(true);
      setTimeout(() => setCopiedReferral(false), 2000);
      toast.success("Referral link copied!");
    }
  };

  const p = (field: keyof ProfileData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setProfile((prev) => ({ ...prev, [field]: e.target.value }));

  if (loadingProfile) {
    return (
      <AppLayout>
        <PageHeader title="OG SETTINGS" description="Manage your account" />
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-white/30" />
        </div>
      </AppLayout>
    );
  }

  const settingsNav = [
    { value: "profile",       icon: User,         label: "Profile",           mobileLabel: "Profile"   },
    { value: "connections",   icon: Plug,         label: "Connections",       mobileLabel: "Connect"   },
    { value: "account",       icon: Shield,       label: "Account",           mobileLabel: "Account"   },
    { value: "themes",        icon: Palette,      label: "Themes",            mobileLabel: "Themes"    },
    { value: "invite",        icon: Gift,         label: "Invite & Referrals",mobileLabel: "Invite"    },
    { value: "notifications", icon: Bell,         label: "Notifications",     mobileLabel: "Alerts"    },
    { value: "webhooks",      icon: Webhook,      label: "Webhooks",          mobileLabel: "Webhooks"  },
    { value: "embed",         icon: Code2,        label: "Embed",             mobileLabel: "Embed"     },
  ] as const;

  return (
    <AppLayout>
      <div className="relative z-10 flex min-h-screen">

        {/* ── Left sidebar nav (desktop only) ── */}
        <aside className="hidden lg:flex flex-col w-[240px] xl:w-[260px] shrink-0 border-r border-white/[0.06] pt-6 pb-10 px-2 sticky top-0 self-start h-screen overflow-y-auto">
          <div className="px-3 mb-6">
            <h1 className="text-[20px] font-extrabold tracking-tight">Settings</h1>
          </div>
          <nav className="flex flex-col gap-0.5">
            {settingsNav.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setActiveTab(value)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-full text-[16px] transition-all text-left
                  ${activeTab === value
                    ? "bg-white/[0.08] text-white font-bold"
                    : "text-white/55 font-medium hover:bg-white/[0.04] hover:text-white/80"}`}>
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Right pane: mobile tabs + content ── */}
        <div className="flex-1 min-w-0 flex flex-col">

          {/* Mobile tab bar */}
          <div className="lg:hidden overflow-x-auto border-b border-white/[0.06] sticky top-0 z-20 bg-background/90 backdrop-blur-xl">
            <div className="flex w-max">
              {settingsNav.map(({ value, icon: Icon, mobileLabel }) => (
                <button
                  key={value}
                  onClick={() => setActiveTab(value)}
                  className={`flex items-center gap-1.5 px-4 py-4 text-[13px] font-medium border-b-[3px] transition-all whitespace-nowrap
                    ${activeTab === value
                      ? "text-white border-white"
                      : "text-white/40 border-transparent hover:text-white/70 hover:bg-white/[0.03]"}`}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {mobileLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 px-4 lg:px-8 pt-6 pb-10">

          {/* ── Profile Tab ── */}
          {activeTab === "profile" && (<div className="tab-content">
            <div className="hidden lg:flex items-center gap-3 mb-6 border-b border-white/[0.06] pb-4">
              <User className="h-5 w-5 text-white/40" />
              <h2 className="text-[20px] font-bold">Profile</h2>
            </div>
            <div className="max-w-2xl space-y-4">
              {/* Stats strip */}
              <Card className="p-4 glass-card">
                <div className="grid grid-cols-4 gap-3 text-center">
                  {[
                    { label: "Level", value: (profile as any)?.current_level || 1, icon: Trophy, color: "text-[#eab308]" },
                    { label: "XP", value: ((profile as any)?.total_xp || 0).toLocaleString(), icon: Zap, color: "text-[#22d3ee]" },
                    { label: "Streak", value: `${(profile as any)?.daily_streak || 0}d`, icon: Flame, color: "text-orange-400" },
                    { label: "Rep", value: (profile as any)?.reputation_score || 0, icon: Star, color: "text-purple-400" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label}>
                      <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
                      <p className={`text-lg font-black ${color}`}>{value}</p>
                      <p className="text-[10px] text-white/30">{label}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Basic info */}
              <Card className="p-6 glass-card">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <User className="h-5 w-5 text-[#22d3ee]" /> Basic Info
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Username</Label>
                      <Input value={profile.username || ""} onChange={p("username")} className="mt-1" placeholder="@username" />
                    </div>
                    <div>
                      <Label>Display Name</Label>
                      <Input value={profile.display_name || ""} onChange={p("display_name")} className="mt-1" placeholder="Display name" />
                    </div>
                  </div>
                  <div>
                    <Label>Bio</Label>
                    <Textarea
                      value={profile.bio || ""}
                      onChange={p("bio")}
                      className="mt-1 resize-none"
                      rows={3}
                      placeholder="Tell the community about yourself..."
                      maxLength={200}
                    />
                    <p className="text-[10px] text-white/25 mt-1">{(profile.bio || "").length}/200</p>
                  </div>
                </div>
              </Card>

              {/* Social links */}
              <Card className="p-6 glass-card">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Link className="h-5 w-5 text-[#22d3ee]" /> Social Links
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label className="flex items-center gap-2"><Twitter className="h-3.5 w-3.5" /> Twitter / X</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">@</span>
                      <Input value={profile.twitter_handle || ""} onChange={p("twitter_handle")} className="pl-7" placeholder="handle" />
                    </div>
                  </div>
                  <div>
                    <Label className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5" /> Discord</Label>
                    <Input value={profile.discord_handle || ""} onChange={p("discord_handle")} className="mt-1" placeholder="username#0000" />
                  </div>
                  <div>
                    <Label className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Website</Label>
                    <Input value={profile.website_url || ""} onChange={p("website_url")} className="mt-1" placeholder="https://..." type="url" />
                  </div>
                  <div>
                    <Label className="flex items-center gap-2">📍 Location</Label>
                    <Input value={profile.location || ""} onChange={p("location")} className="mt-1" placeholder="City, Country" />
                  </div>
                </div>
              </Card>

              {/* Wallet */}
              <Card className="p-6 glass-card">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-[#22d3ee]" /> Solana Wallet
                </h3>
                <div>
                  <Label>Wallet Address</Label>
                  <p className="text-xs text-white/40 mb-2">Your public Solana wallet to display on your profile</p>
                  <Input
                    value={profile.sol_wallet || ""}
                    onChange={p("sol_wallet")}
                    className="font-mono text-xs"
                    placeholder="Solana wallet address..."
                  />
                </div>
              </Card>

              {/* Invite link moved to Invite tab */}

              <Button onClick={saveProfile} disabled={savingProfile} className="w-full btn-3d gap-2">
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {savingProfile ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </div>)}

          {/* ── Invite Tab ── */}
          {activeTab === "invite" && (<div className="tab-content">
            <div className="hidden lg:flex items-center gap-3 mb-6 border-b border-white/[0.06] pb-4">
              <Gift className="h-5 w-5 text-white/40" />
              <h2 className="text-[20px] font-bold">Invite &amp; Referrals</h2>
            </div>
            <div className="max-w-2xl space-y-4">
              {/* Invite Link Card */}
              <Card className="p-6 glass-card">
                <h3 className="font-semibold mb-1 flex items-center gap-2">
                  <Gift className="h-5 w-5 text-og-cyan" /> Your Invite Link
                </h3>
                <p className="text-xs text-white/40 mb-4">Share your unique link. When someone signs up, you earn <span className="text-amber-400 font-bold">+100 XP</span> per invite + milestone bonuses every 5!</p>
                <div className="flex gap-2">
                  <Input
                    value={`https://ogscan.fun?ref=${(profile as any)?.referral_code || "..."}`}
                    readOnly
                    className="font-mono text-xs bg-white/[0.03] border-white/[0.08]"
                  />
                  <Button variant="outline" size="icon" onClick={copyReferral} className="shrink-0 border-white/10 hover:border-og-cyan/40">
                    {copiedReferral ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                {(profile as any)?.is_pioneer && (
                  <Badge className="mt-3 bg-[#eab308]/10 text-[#eab308] border-[#eab308]/20">⭐ OG Pioneer</Badge>
                )}
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4 glass-card text-center">
                  <Users className="h-5 w-5 text-og-cyan mx-auto mb-1" />
                  <p className="text-2xl font-black text-white">{inviteStats.invited}</p>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">Invited</p>
                </Card>
                <Card className="p-4 glass-card text-center">
                  <Zap className="h-5 w-5 text-amber-400 mx-auto mb-1" />
                  <p className="text-2xl font-black text-amber-400">{inviteStats.xpEarned.toLocaleString()}</p>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">XP Earned</p>
                </Card>
              </div>

              {/* Points Breakdown */}
              <Card className="p-5 glass-card">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                  <Trophy className="h-4 w-4 text-amber-400" /> How Points Work
                </h3>
                <div className="space-y-2">
                  {[
                    { label: "Friend signs up with your link", xp: 100 },
                    { label: "Milestone bonus (every 5 invites)", xp: 50 },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                      <span className="text-xs text-white/60">{r.label}</span>
                      <span className="text-xs font-black text-amber-400">+{r.xp} XP</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Recent Invites */}
              {inviteStats.recentInvites.length > 0 && (
                <Card className="p-5 glass-card">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                    <Star className="h-4 w-4 text-og-cyan" /> Recent Invites
                  </h3>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                    {inviteStats.recentInvites.map((inv, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03]">
                        <span className="text-xs text-white/70 font-medium">@{inv.username}</span>
                        <span className="text-[10px] text-white/30">{new Date(inv.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {loadingInvite && (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-white/30" />
                </div>
              )}
            </div>
          </div>)}

          {/* ── Account Tab ── */}
          {activeTab === "connections" && (
            <ConnectionsTab />
          )}

          {activeTab === "account" && (<div className="tab-content">
            <div className="hidden lg:flex items-center gap-3 mb-6 border-b border-white/[0.06] pb-4">
              <Shield className="h-5 w-5 text-white/40" />
              <h2 className="text-[20px] font-bold">Account</h2>
            </div>
            <div className="max-w-2xl space-y-4">
              {/* Email */}
              <Card className="p-6 glass-card">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Mail className="h-5 w-5 text-[#22d3ee]" /> Email Address
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label className="text-white/60 text-xs uppercase tracking-wider">Current Email</Label>
                    <div className="mt-1 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white font-mono flex items-center justify-between">
                      <span>{user?.email || "—"}</span>
                      {(profile as any)?.is_email_verified && (
                        <Badge className="text-[9px] bg-green-500/10 text-green-400 border-green-500/20">Verified</Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>New Email Address</Label>
                    <Input type="email" placeholder="Enter new email..." value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="mt-1" />
                    <p className="text-xs text-white/30 mt-1">A confirmation link will be sent to both addresses.</p>
                  </div>
                  <Button onClick={handleEmailChange} disabled={changingEmail || !newEmail} className="btn-3d gap-2">
                    {changingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    Update Email
                  </Button>
                </div>
              </Card>

              {/* Password */}
              <Card className="p-6 glass-card">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-[#22d3ee]" /> Change Password
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label>New Password</Label>
                    <div className="relative mt-1">
                      <Input
                        type={showNewPw ? "text" : "password"}
                        placeholder="At least 6 characters..."
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pr-10"
                      />
                      <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                        {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label>Confirm Password</Label>
                    <Input type="password" placeholder="Repeat new password..." value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1" />
                  </div>
                  <Button
                    onClick={handlePasswordChange}
                    disabled={changingPw || !newPassword || !confirmPassword}
                    className={`btn-3d gap-2 ${pwSuccess ? "bg-green-500/20 text-green-400 border-green-500/30" : ""}`}
                  >
                    {changingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : pwSuccess ? <Check className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                    {pwSuccess ? "Updated!" : changingPw ? "Updating..." : "Change Password"}
                  </Button>
                </div>
              </Card>

              {/* Account info */}
              <Card className="p-6 glass-card">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <User className="h-5 w-5 text-[#22d3ee]" /> Account Info
                </h3>
                <div className="space-y-2 text-sm">
                  {[
                    { label: "Sign-up method", value: (profile as any)?.sign_up_method || "email" },
                    { label: "Member since", value: new Date((profile as any)?.created_at || Date.now()).toLocaleDateString() },
                    { label: "Last active", value: (profile as any)?.last_active_at ? new Date((profile as any).last_active_at).toLocaleDateString() : "—" },
                    { label: "Account status", value: (profile as any)?.is_banned ? "⛔ Banned" : (profile as any)?.is_suspended ? "⚠️ Suspended" : "✅ Active" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center py-2 border-b border-white/[0.04] last:border-0">
                      <span className="text-white/40">{label}</span>
                      <span className="text-white font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Sign out */}
              <Card className="p-6 glass-card border-red-500/20">
                <h3 className="font-semibold mb-4 flex items-center gap-2 text-red-400">
                  <LogOut className="h-5 w-5" /> Session
                </h3>
                <p className="text-sm text-white/40 mb-4">Sign out of your current session on this device.</p>
                <Button variant="outline" onClick={handleSignOut} className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 gap-2">
                  <LogOut className="h-4 w-4" /> Sign Out
                </Button>
              </Card>
            </div>
          </div>)}

          {activeTab === "themes" && (<div className="tab-content">
            <div className="hidden lg:flex items-center gap-3 mb-6 border-b border-white/[0.06] pb-4">
              <Palette className="h-5 w-5 text-white/40" />
              <h2 className="text-[20px] font-bold">Themes</h2>
            </div>
            <div className="max-w-4xl"><ThemePicker /></div>
          </div>)}

          {/* ── Notifications Tab ── */}
          {activeTab === "notifications" && (<div className="tab-content">
            <div className="hidden lg:flex items-center gap-3 mb-6 border-b border-white/[0.06] pb-4">
              <Bell className="h-5 w-5 text-white/40" />
              <h2 className="text-[20px] font-bold">Notifications</h2>
            </div>
            <div className="max-w-2xl space-y-4">
              <Card className="p-6 glass-card">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Bell className="h-5 w-5 text-[#22d3ee]" /> Notification Preferences
                </h3>
                <div className="space-y-3">
                  {[
                    { key: "priceAlerts", label: "Price Alerts", desc: "Get notified when token prices hit your targets" },
                    { key: "whaleAlerts", label: "Whale Alerts", desc: "Track large wallet movements" },
                    { key: "walletActivity", label: "Wallet Activity", desc: "Updates from tracked wallets" },

                    { key: "communityPosts", label: "Community Posts", desc: "New posts in communities you follow" },
                    { key: "newFollowers", label: "New Followers", desc: "When someone follows your profile" },
                    { key: "tradeSignals", label: "Trade Signals", desc: "Callouts and trade alerts from traders you follow" },
                    { key: "lobbyInvites", label: "Lobby Invites", desc: "Invitations to trading lobbies" },
                  ].map((n) => (
                    <div key={n.key} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                      <div>
                        <Label className="text-sm">{n.label}</Label>
                        <p className="text-xs text-white/30">{n.desc}</p>
                      </div>
                      <Switch
                        checked={notifications[n.key as keyof typeof notifications]}
                        onCheckedChange={(checked) => setNotifications({ ...notifications, [n.key]: checked })}
                      />
                    </div>
                  ))}
                </div>
                <Button onClick={saveNotifications} disabled={savingNotifs} className="mt-6 btn-3d gap-2 w-full">
                  {savingNotifs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save Preferences
                </Button>
              </Card>

              <Card className="p-6 glass-card">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-[#22d3ee]" /> Digest & Quiet Hours
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label>Digest Frequency</Label>
                    <Select value={profile.digest_frequency || "smart"} onValueChange={(v) => setProfile((p) => ({ ...p, digest_frequency: v }))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="smart">Smart (AI-curated)</SelectItem>
                        <SelectItem value="realtime">Real-time</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily digest</SelectItem>
                        <SelectItem value="off">Off</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Quiet Hours Start</Label>
                      <Input type="time" value={profile.quiet_hours_start || ""} onChange={p("quiet_hours_start")} className="mt-1" />
                    </div>
                    <div>
                      <Label>Quiet Hours End</Label>
                      <Input type="time" value={profile.quiet_hours_end || ""} onChange={p("quiet_hours_end")} className="mt-1" />
                    </div>
                  </div>
                  <Button onClick={saveProfile} disabled={savingProfile} className="btn-3d gap-2 w-full">
                    {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Save
                  </Button>
                </div>
              </Card>
            </div>
          </div>)}

          {/* ── Webhooks Tab ── */}
          {activeTab === "webhooks" && (<div className="tab-content">
            <div className="hidden lg:flex items-center gap-3 mb-6 border-b border-white/[0.06] pb-4">
              <Webhook className="h-5 w-5 text-white/40" />
              <h2 className="text-[20px] font-bold">Webhooks</h2>
            </div>
            <Card className="p-6 max-w-2xl glass-card">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Webhook className="h-5 w-5 text-[#22d3ee]" /> Discord Webhook
              </h3>
              <div className="space-y-4">
                <div>
                  <Label>Webhook URL</Label>
                  <p className="text-xs text-white/40 mb-2">Receive OG Scan alerts directly in your Discord server</p>
                  <Input placeholder="https://discord.com/api/webhooks/..." value={discordWebhook} onChange={(e) => setDiscordWebhook(e.target.value)} />
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/40 space-y-1">
                  <p className="font-bold text-white/60">What gets sent to Discord:</p>
                  <p>• Price alerts when your target is hit</p>
                  <p>• Whale wallet movements on tracked tokens</p>
                  <p>• New community callouts from traders you follow</p>
                  <p>• Rug pull risk alerts for tokens in your watchlist</p>
                </div>
                <Button onClick={saveWebhook} disabled={savingWebhook} className="btn-3d gap-2 w-full">
                  {savingWebhook ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save Webhook
                </Button>
              </div>
            </Card>
          </div>)}

          {/* ── Embed Settings Tab ── */}
          {activeTab === "embed" && (<div className="tab-content">
            <div className="hidden lg:flex items-center gap-3 mb-6 border-b border-white/[0.06] pb-4">
              <Code2 className="h-5 w-5 text-white/40" />
              <h2 className="text-[20px] font-bold">Embed</h2>
            </div>
            <EmbedSettingsTab username={profile.username} />
          </div>)}
          </div>{/* end content area */}
        </div>{/* end right pane */}
      </div>{/* end flex row */}
    </AppLayout>
  );
};

/* ─────────────────────────────────────────────────────────────
   Embed Settings Panel (inline component so it can use profile)
   ───────────────────────────────────────────────────────────── */
function EmbedSettingsTab({ username }: { username?: string }) {
  const [copiedProfile, setCopiedProfile] = useState(false);
  const [copiedSpaces, setCopiedSpaces] = useState(false);
  const [profileSize, setProfileSize] = useState<"compact" | "standard" | "tall">("standard");
  const [spacesSize, setSpacesSize] = useState<"compact" | "standard" | "wide">("compact");

  if (!username) {
    return (
      <div className="max-w-2xl">
        <Card className="p-6 glass-card">
          <p className="text-white/40 text-sm">Set a username in your Profile tab first to get your embed codes.</p>
        </Card>
      </div>
    );
  }

  const profileBaseUrl = `https://ogscan.fun/embed/profile/${username}`;
  const spacesBaseUrl = `https://ogscan.fun/embed/spaces/${username}`;

  const profileSizes = {
    compact: { width: 360, height: 560 },
    standard: { width: 440, height: 700 },
    tall: { width: 520, height: 860 },
  };
  const spacesSizes = {
    compact: { width: 360, height: 340 },
    standard: { width: 440, height: 420 },
    wide: { width: 560, height: 420 },
  };

  const ps = profileSizes[profileSize];
  const ss = spacesSizes[spacesSize];

  const profileCode = `<iframe
  src="${profileBaseUrl}"
  width="${ps.width}"
  height="${ps.height}"
  frameborder="0"
  scrolling="no"
  allow="autoplay"
  style="border-radius:16px;overflow:hidden;border:none;"
></iframe>`;

  const spacesCode = `<iframe
  src="${spacesBaseUrl}"
  width="${ss.width}"
  height="${ss.height}"
  frameborder="0"
  scrolling="no"
  allow="autoplay"
  style="border-radius:16px;overflow:hidden;border:none;"
></iframe>`;

  const copy = (code: string, which: "profile" | "spaces") => {
    navigator.clipboard.writeText(code);
    if (which === "profile") { setCopiedProfile(true); setTimeout(() => setCopiedProfile(false), 2000); }
    else { setCopiedSpaces(true); setTimeout(() => setCopiedSpaces(false), 2000); }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <Card className="p-5 glass-card">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-500/15 flex items-center justify-center flex-shrink-0">
            <Code2 className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h3 className="font-bold text-white mb-1">Embed Your Profile</h3>
            <p className="text-xs text-white/45 leading-relaxed">
              Paste these widgets on your website, blog, or X bio link.
              They update live — when you go live on a space, your site visitors see it instantly.
            </p>
          </div>
        </div>
      </Card>

      {/* ── Widget 1 — Full Profile ── */}
      <Card className="p-6 glass-card">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Radio className="h-4 w-4 text-violet-400" />
            Profile Widget
          </h3>
          <a
            href={`${profileBaseUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-white/30 hover:text-violet-400 transition-colors"
          >
            <ExternalLink className="h-3 w-3" /> Preview
          </a>
        </div>
        <p className="text-xs text-white/40 mb-4">
          Shows your banner, photo, bio, social links, live space (when active), and past spaces.
        </p>

        {/* Size picker */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] text-white/30 uppercase tracking-wider mr-1">Size</span>
          {(["compact", "standard", "tall"] as const).map(sz => (
            <button
              key={sz}
              onClick={() => setProfileSize(sz)}
              className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                profileSize === sz
                  ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                  : "bg-white/[0.04] border-white/[0.08] text-white/35 hover:text-white/60"
              }`}
            >
              {sz.charAt(0).toUpperCase() + sz.slice(1)}
              <span className="text-[9px] opacity-60 ml-1">
                {profileSizes[sz].width}×{profileSizes[sz].height}
              </span>
            </button>
          ))}
        </div>

        {/* Code block */}
        <div className="relative">
          <pre className="bg-black/40 border border-white/[0.08] rounded-xl p-4 text-[11px] text-white/60 font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
            {profileCode}
          </pre>
          <button
            onClick={() => copy(profileCode, "profile")}
            className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-semibold transition-all"
          >
            {copiedProfile ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copiedProfile ? "Copied!" : "Copy"}
          </button>
        </div>

        {/* Tips */}
        <div className="mt-3 text-[10px] text-white/25 space-y-0.5">
          <p>• Works on any website — paste the iframe code in your HTML or page builder</p>
          <p>• Auto-updates live — your visitors see when you go live without refreshing</p>
        </div>
      </Card>

      {/* ── Widget 2 — Spaces Only ── */}
      <Card className="p-6 glass-card">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Radio className="h-4 w-4 text-cyan-400" />
            Live Spaces Widget
          </h3>
          <a
            href={`${spacesBaseUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-white/30 hover:text-cyan-400 transition-colors"
          >
            <ExternalLink className="h-3 w-3" /> Preview
          </a>
        </div>
        <p className="text-xs text-white/40 mb-4">
          Spaces-only widget. Shows a bold LIVE card when you're hosting. Perfect for sidebars and footers.
        </p>

        {/* Size picker */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] text-white/30 uppercase tracking-wider mr-1">Size</span>
          {(["compact", "standard", "wide"] as const).map(sz => (
            <button
              key={sz}
              onClick={() => setSpacesSize(sz)}
              className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                spacesSize === sz
                  ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                  : "bg-white/[0.04] border-white/[0.08] text-white/35 hover:text-white/60"
              }`}
            >
              {sz.charAt(0).toUpperCase() + sz.slice(1)}
              <span className="text-[9px] opacity-60 ml-1">
                {spacesSizes[sz].width}×{spacesSizes[sz].height}
              </span>
            </button>
          ))}
        </div>

        {/* Code block */}
        <div className="relative">
          <pre className="bg-black/40 border border-white/[0.08] rounded-xl p-4 text-[11px] text-white/60 font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
            {spacesCode}
          </pre>
          <button
            onClick={() => copy(spacesCode, "spaces")}
            className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold transition-all"
          >
            {copiedSpaces ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copiedSpaces ? "Copied!" : "Copy"}
          </button>
        </div>

        {/* Tips */}
        <div className="mt-3 text-[10px] text-white/25 space-y-0.5">
          <p>• Ideal for embedding in your website sidebar or above-the-fold</p>
          <p>• Shows upcoming scheduled spaces when you're not live</p>
          <p>• Visitors can click straight into your live space</p>
        </div>
      </Card>

      {/* Your profile link */}
      <Card className="p-5 glass-card">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Maximize2 className="h-4 w-4 text-white/40" />
          Your Public Profile Page
        </h3>
        <p className="text-xs text-white/40 mb-3">
          Share your full profile page directly — anyone can follow you and see your spaces without embedding.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/[0.08] font-mono text-xs text-white/50 overflow-hidden text-ellipsis whitespace-nowrap">
            https://ogscan.fun/u/{username}
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(`https://ogscan.fun/u/${username}`); }}
            className="flex-shrink-0 px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-white/50 hover:text-white text-[11px] transition-all flex items-center gap-1.5"
          >
            <Copy className="h-3 w-3" /> Copy
          </button>
          <a
            href={`https://ogscan.fun/u/${username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-white/50 hover:text-white transition-all"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Connections Tab — global account integrations
   ───────────────────────────────────────────────────────────── */
const CC_CALLBACK_URL = `${window.location.origin}/cc-callback`;

function ConnectionsTab() {
  const [ccUser, setCcUser] = useState<CCUser | null>(() => ccGetStoredUser());
  const [xUser, setXUser] = useState<XUser | null>(() => xGetStoredUser());
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Listen for global X auth changes (e.g. from /x-callback redirect)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ user: XUser | null }>).detail;
      setXUser(detail.user);
      xSetStoredUser(detail.user);
    };
    window.addEventListener("x-auth-changed", handler);
    return () => window.removeEventListener("x-auth-changed", handler);
  }, []);

  const handleCCConnect = async () => {
    setAuthLoading(true);
    setAuthError(null);
    await ccStartXLogin(
      CC_CALLBACK_URL,
      (user) => {
        setCcUser(user);
        setAuthLoading(false);
        window.dispatchEvent(new CustomEvent("cc-auth-changed", { detail: { user } }));
        toast.success("X account connected to communities!");
      },
      (msg) => {
        setAuthLoading(false);
        setAuthError(msg);
      },
    );
  };

  const handleCCDisconnect = () => {
    ccClearAuth();
    setCcUser(null);
    window.dispatchEvent(new CustomEvent("cc-auth-changed", { detail: { user: null } }));
    toast.success("X communities disconnected");
  };

  const handleXConnect = () => {
    // Redirects to Twitter OAuth 2.0 PKCE flow → /x-callback
    xStartLogin();
  };

  const handleXDisconnect = () => {
    xSetStoredUser(null);
    setXUser(null);
    window.dispatchEvent(new CustomEvent("x-auth-changed", { detail: { user: null } }));
    toast.success("X posting disconnected");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="hidden lg:flex items-center gap-3 mb-6 border-b border-white/[0.06] pb-4">
        <Plug className="h-5 w-5 text-white/40" />
        <h2 className="text-[20px] font-bold">Connections</h2>
      </div>

      {/* Card 1: X Communities (CC OAuth — for posting in CC token communities) */}
      <Card className="p-5 glass-card">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-2xl bg-white/[0.07] border border-white/10 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.213 5.567zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-bold text-white text-[15px]">X Communities</h3>
              {ccUser ? (
                <span className="rounded-full bg-og-lime/15 border border-og-lime/25 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-og-lime">Connected</span>
              ) : (
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white/30">CC Feed</span>
              )}
            </div>
            {ccUser ? (
              <div className="flex items-center gap-2.5 mt-2">
                {ccUser.profileImageUrl && (
                  <img src={ccUser.profileImageUrl} alt={ccUser.displayName} className="w-8 h-8 rounded-full ring-1 ring-white/10" />
                )}
                <div>
                  <div className="text-white/80 text-[13px] font-semibold">{ccUser.displayName}</div>
                  <div className="text-white/40 font-mono text-[11px]">@{ccUser.username}</div>
                </div>
              </div>
            ) : (
              <p className="text-white/45 text-[13px] leading-relaxed mt-1">
                Post and interact in token communities on the CC Feed tab.
              </p>
            )}
            {authError && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-red-400 text-[11px]">
                <span className="shrink-0 mt-0.5">⚠</span>
                <span>{authError}</span>
              </div>
            )}
            <div className="flex items-center gap-2 mt-4">
              {ccUser ? (
                <Button variant="outline" size="sm" onClick={handleCCDisconnect}
                  className="text-red-400 border-red-400/20 hover:bg-red-400/10 hover:text-red-300 rounded-xl">
                  <LogOut className="h-3.5 w-3.5 mr-1.5" />
                  Disconnect
                </Button>
              ) : (
                <button onClick={handleCCConnect} disabled={authLoading}
                  className="flex items-center gap-2 rounded-xl bg-white text-black font-bold text-[13px] px-4 py-2 hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-60">
                  {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <svg viewBox="0 0 24 24" className="w-4 h-4 fill-black"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.213 5.567zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>}
                  {authLoading ? "Connecting…" : "Connect X"}
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Card 2: X Cross-Posting (native OAuth 2.0 — tweet.write for posting from OG Scan → X) */}
      <Card className="p-5 glass-card">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-2xl bg-og-lime/10 border border-og-lime/20 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-og-lime"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.213 5.567zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-bold text-white text-[15px]">X Cross-Posting</h3>
              {xUser ? (
                <span className="rounded-full bg-og-lime/15 border border-og-lime/25 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-og-lime">Connected</span>
              ) : (
                <span className="rounded-full bg-og-lime/[0.08] px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-og-lime/50">tweet.write</span>
              )}
            </div>
            {xUser ? (
              <div className="flex items-center gap-2.5 mt-2">
                {xUser.profileImageUrl && (
                  <img src={xUser.profileImageUrl} alt={xUser.displayName} className="w-8 h-8 rounded-full ring-1 ring-og-lime/20" />
                )}
                <div>
                  <div className="text-white/80 text-[13px] font-semibold">{xUser.displayName}</div>
                  <div className="text-og-lime/70 font-mono text-[11px]">@{xUser.username}</div>
                  <div className="text-white/30 text-[10px] mt-0.5">Posts you compose will appear on X when toggle is on</div>
                </div>
              </div>
            ) : (
              <p className="text-white/45 text-[13px] leading-relaxed mt-1">
                When composing a post, toggle "Also post to X" to cross-publish to your X feed. Requires tweet.write permission.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {xUser ? (
                <Button variant="outline" size="sm" onClick={handleXDisconnect}
                  className="text-red-400 border-red-400/20 hover:bg-red-400/10 hover:text-red-300 rounded-xl">
                  <LogOut className="h-3.5 w-3.5 mr-1.5" />
                  Disconnect
                </Button>
              ) : (
                <button onClick={handleXConnect}
                  className="flex items-center gap-2 rounded-xl bg-og-lime text-black font-bold text-[13px] px-4 py-2 hover:bg-og-lime/90 active:scale-[0.98] transition-all">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-black"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.213 5.567zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                  Connect for Cross-Posting
                </button>
              )}
            </div>
            {!xUser && (
              <ul className="mt-4 space-y-1.5">
                {[
                  "Your OG posts cross-publish to X in one tap",
                  "X icon badge on cross-posted community posts",
                  "View on X link for each cross-posted post",
                ].map(t => (
                  <li key={t} className="flex items-center gap-2 text-white/35 text-[12px]">
                    <Zap className="h-3 w-3 text-og-lime/50 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      {/* More integrations coming soon */}
      <Card className="p-5 glass-card border-white/[0.04] opacity-60">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
            <Zap className="h-5 w-5 text-white/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white/50 text-[14px]">More integrations</h3>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[8px] uppercase tracking-widest text-white/30">Soon</span>
            </div>
            <p className="text-white/30 text-[12px] mt-0.5">Telegram, Discord, and more on the way.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default Settings;
