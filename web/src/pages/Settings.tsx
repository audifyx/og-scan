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
import { CreditsUsagePanel } from "@/components/credits/CreditsUsagePanel";
import { ThemePicker } from "@/components/settings/ThemePicker";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  DollarSign, Bell, User, Shield, Webhook, Palette, LogOut, Eye, EyeOff,
  Check, Loader2, KeyRound, Mail, Link, Twitter, MessageSquare, Globe,
  Wallet, Star, Copy, Flame, Trophy, Zap, Clock, ChevronRight,
} from "lucide-react";

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
  const [notifications, setNotifications] = useState({
    priceAlerts: true, whaleAlerts: true, walletActivity: true,
    creditWarnings: true, communityPosts: true, newFollowers: true,
    tradeSignals: true, lobbyInvites: true,
  });
  const [savingNotifs, setSavingNotifs] = useState(false);

  // Webhook state
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);

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
          setNotifications((prev) => ({ ...prev, ...data.notification_preferences }));
        }
      }
      setLoadingProfile(false);
    };
    loadProfile();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from("profiles").update({
        username: profile.username,
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
        <PageHeader title="Settings" description="Manage your account" />
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-white/30" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title="Settings" description="Manage your account and preferences" />
      <div className="p-4 lg:p-6 relative z-10">
        <Tabs defaultValue="profile" className="w-full">
          <div className="overflow-x-auto">
            <TabsList className="flex w-max min-w-full max-w-3xl bg-white/[0.04] mb-6">
              {[
                { value: "profile", icon: User, label: "Profile" },
                { value: "account", icon: Shield, label: "Account" },
                { value: "themes", icon: Palette, label: "Themes" },
                { value: "credits", icon: DollarSign, label: "Credits" },
                { value: "notifications", icon: Bell, label: "Alerts" },
                { value: "webhooks", icon: Webhook, label: "Webhooks" },
              ].map(({ value, icon: Icon, label }) => (
                <TabsTrigger key={value} value={value} className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* ── Profile Tab ── */}
          <TabsContent value="profile">
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

              {/* Referral */}
              {(profile as any)?.referral_code && (
                <Card className="p-6 glass-card">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Star className="h-5 w-5 text-[#eab308]" /> Referral Program
                  </h3>
                  <p className="text-xs text-white/40 mb-3">Share your referral link to earn credits when friends sign up</p>
                  <div className="flex gap-2">
                    <Input
                      value={`https://ogscan.fun?ref=${(profile as any).referral_code}`}
                      readOnly
                      className="font-mono text-xs bg-white/[0.03]"
                    />
                    <Button variant="outline" size="icon" onClick={copyReferral} className="shrink-0 border-white/10">
                      {copiedReferral ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  {(profile as any)?.is_pioneer && (
                    <Badge className="mt-3 bg-[#eab308]/10 text-[#eab308] border-[#eab308]/20">⭐ OG Pioneer</Badge>
                  )}
                </Card>
              )}

              <Button onClick={saveProfile} disabled={savingProfile} className="w-full btn-3d gap-2">
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {savingProfile ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </TabsContent>

          {/* ── Account Tab ── */}
          <TabsContent value="account">
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
          </TabsContent>

          <TabsContent value="themes">
            <div className="max-w-4xl"><ThemePicker /></div>
          </TabsContent>

          <TabsContent value="credits">
            <div className="max-w-3xl"><CreditsUsagePanel /></div>
          </TabsContent>

          {/* ── Notifications Tab ── */}
          <TabsContent value="notifications">
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
                    { key: "creditWarnings", label: "Credit Warnings", desc: "Alert when credits are running low" },
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
          </TabsContent>

          {/* ── Webhooks Tab ── */}
          <TabsContent value="webhooks">
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
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Settings;
