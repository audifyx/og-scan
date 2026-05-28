import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  Check,
  Coins,
  MessageCircle,
  MoonStar,
  Plus,
  Radio,
  Save,
  Shield,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from "@/lib/notificationSettings";
import { updateAppBadge } from "@/lib/appBadge";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  created_at: string;
}

interface PriceAlert {
  id: string;
  token_address: string;
  symbol: string | null;
  condition: string;
  target_price: number;
  is_active: boolean;
  triggered_at: string | null;
  created_at: string;
}

interface ProfileNotificationSettings {
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  notification_preferences?: Record<string, boolean> | null;
}

const preferenceSections: Array<{
  key: NotificationPreferenceKey;
  title: string;
  description: string;
  icon: typeof Bell;
}> = [
  { key: "directMessages", title: "Direct messages", description: "Message requests and new DMs", icon: MessageCircle },
  { key: "support", title: "Support chat", description: "Ticket replies and support updates", icon: Shield },
  { key: "spaces", title: "Spaces", description: "Live spaces, reminders, and mentions", icon: Radio },
  { key: "priceAlerts", title: "Price alerts", description: "Token price triggers and threshold hits", icon: AlertTriangle },
  { key: "whaleAlerts", title: "Whale alerts", description: "Large wallet moves and whale activity", icon: Zap },
  { key: "walletActivity", title: "Wallet activity", description: "Tracked wallet buys, sells, and moves", icon: Wallet },
  { key: "tradeSignals", title: "Trade signals", description: "Callouts, alpha, and trade setups", icon: TrendingUp },
  { key: "ourCoin", title: "OUR COIN", description: "OG coin buy alerts and token events", icon: Coins },
  { key: "communityPosts", title: "Community posts", description: "Community activity and new posts", icon: Bell },
  { key: "newFollowers", title: "Followers", description: "New follows and social growth", icon: BellRing },
  { key: "lobbyInvites", title: "Lobby invites", description: "Trading room and lobby invitations", icon: Bell },
  { key: "system", title: "System", description: "Platform updates and critical notices", icon: Shield },
];

const Notifications = () => {
  const { user } = useAuth();
  const {
    permission,
    supported,
    isRegistered,
    isSyncing,
    requestPermission,
    unsubscribe,
    sendTestPush,
  } = usePushNotifications();

  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [alertForm, setAlertForm] = useState({ address: "", symbol: "", condition: "above", targetPrice: "" });
  const [creatingAlert, setCreatingAlert] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [quietHoursStart, setQuietHoursStart] = useState("");
  const [quietHoursEnd, setQuietHoursEnd] = useState("");

  useEffect(() => {
    if (!user) return;

    void fetchNotifications();
    void fetchPriceAlerts();
    void fetchProfileSettings();
    const unsubscribeRealtime = subscribeToNotifications();

    return unsubscribeRealtime;
  }, [user]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);

  useEffect(() => {
    void updateAppBadge(unreadCount);
  }, [unreadCount]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPriceAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from("price_alerts")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPriceAlerts(data || []);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const fetchProfileSettings = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("notification_preferences, quiet_hours_start, quiet_hours_end")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Failed to load profile notification settings", error);
      return;
    }

    const settings = (data || {}) as ProfileNotificationSettings;
    setNotificationPreferences(normalizeNotificationPreferences(settings.notification_preferences));
    setQuietHoursStart(settings.quiet_hours_start || "");
    setQuietHoursEnd(settings.quiet_hours_end || "");
  };

  const subscribeToNotifications = () => {
    const channel = supabase
      .channel(`notifications-page-${user?.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user?.id}` },
        (payload) => {
          const n = payload.new as NotificationRow;
          setNotifications((prev) => (prev.some((existing) => existing.id === n.id) ? prev : [n, ...prev]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const saveNotificationSettings = async () => {
    if (!user) return;
    setSavingPreferences(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          notification_preferences: notificationPreferences,
          quiet_hours_start: quietHoursStart || null,
          quiet_hours_end: quietHoursEnd || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Notification delivery settings saved");
    } catch (error) {
      console.error(error);
      toast.error("Could not save notification settings");
    } finally {
      setSavingPreferences(false);
    }
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (!error) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    }
  };

  const markAllAsRead = async () => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user?.id)
      .eq("is_read", false);

    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success("All marked as read");
    }
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (!error) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }
  };

  const clearAll = async () => {
    const { error } = await supabase.from("notifications").delete().eq("user_id", user?.id);
    if (!error) {
      setNotifications([]);
      toast.success("All cleared");
    }
  };

  const createPriceAlert = async () => {
    if (!user || !alertForm.address || !alertForm.targetPrice) {
      toast.error("Fill all fields");
      return;
    }

    setCreatingAlert(true);
    try {
      let symbol = alertForm.symbol;
      if (!symbol) {
        try {
          const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${alertForm.address}`);
          const data = await res.json();
          symbol = data.pairs?.[0]?.baseToken?.symbol || "???";
        } catch {
          symbol = "???";
        }
      }

      const { error } = await supabase.from("price_alerts").insert({
        user_id: user.id,
        token_address: alertForm.address,
        symbol,
        condition: alertForm.condition,
        target_price: parseFloat(alertForm.targetPrice),
      });

      if (error) throw error;
      toast.success(`Alert created for ${symbol}`);
      setShowCreateAlert(false);
      setAlertForm({ address: "", symbol: "", condition: "above", targetPrice: "" });
      void fetchPriceAlerts();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to create alert");
    } finally {
      setCreatingAlert(false);
    }
  };

  const deletePriceAlert = async (id: string) => {
    const { error } = await supabase.from("price_alerts").delete().eq("id", id);
    if (!error) {
      setPriceAlerts((prev) => prev.filter((a) => a.id !== id));
      toast.success("Alert deleted");
    }
  };

  const handlePushToggle = async (checked: boolean) => {
    if (checked) {
      const granted = await requestPermission();
      if (granted) {
        toast.success("Push notifications enabled on this device");
      } else {
        toast.error("Push notifications were not enabled");
      }
      return;
    }

    const disabled = await unsubscribe();
    if (disabled) {
      toast.success("Push notifications disabled on this device");
    } else {
      toast.error("Could not disable push notifications");
    }
  };

  const handleTestPush = async () => {
    setTestingPush(true);
    const result = await sendTestPush();
    setTestingPush(false);

    if (!result.ok) {
      toast.error("Could not send test push");
      return;
    }

    if (result.reason === "preference_disabled") {
      toast.error("System notifications are turned off in your delivery settings");
      return;
    }

    if (result.reason === "quiet_hours") {
      toast.error("Quiet hours are active, so the push was saved silently");
      return;
    }

    if (result.total === 0 || result.reason === "no_tokens") {
      toast.error("This browser is not registered for push yet");
      return;
    }

    toast.success(result.sent > 0 ? "Rich test push sent" : "Push queued, but nothing was delivered");
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "wallet_sell":
        return <TrendingDown className="h-5 w-5 text-destructive" />;
      case "wallet_buy":
        return <TrendingUp className="h-5 w-5 text-[#22d3ee]" />;
      case "price_alert":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "new_token":
      case "our_coin_buy":
        return <Coins className="h-5 w-5 text-secondary" />;
      case "whale_alert":
        return <Zap className="h-5 w-5 text-accent" />;
      case "dm":
        return <MessageCircle className="h-5 w-5 text-og-lime" />;
      case "space_live":
        return <Radio className="h-5 w-5 text-primary" />;
      default:
        return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Alerts & Notifications" description="Manage push delivery, quiet hours, alerts, and your notification feed">
        {unreadCount > 0 && (
          <Badge variant="secondary" className="bg-primary text-primary-foreground">
            {unreadCount} unread
          </Badge>
        )}
      </PageHeader>

      <div className="space-y-4 p-4 lg:p-6">
        <Card className="og-glass-card border-primary/20">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  {supported && permission === "granted" && isRegistered ? (
                    <BellRing className="h-5 w-5 text-[#22d3ee]" />
                  ) : (
                    <BellOff className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">Push Notifications</p>
                  <p className="text-xs text-muted-foreground">
                    {!supported
                      ? "This browser is not ready for web push here yet. On iPhone, install OG Scan to the home screen, open the installed app, then enable notifications there."
                      : permission === "denied"
                        ? "Blocked in this browser — re-enable notifications in browser settings first"
                        : permission === "granted" && isRegistered
                          ? "This specific device is connected for rich push delivery with actions, grouping, and badge counts"
                          : permission === "granted"
                            ? "Permission granted, but this device is still syncing"
                            : "Enable real push notifications for this device for messages, spaces, alerts, and system updates"}
                  </p>
                </div>
              </div>

              <Switch
                checked={supported && permission === "granted" && isRegistered}
                disabled={!supported || permission === "denied" || isSyncing}
                onCheckedChange={handlePushToggle}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {!supported
                  ? "Unsupported here"
                  : permission === "granted"
                    ? isRegistered
                      ? "Connected"
                      : "Syncing"
                    : permission === "denied"
                      ? "Blocked"
                      : "Not enabled"}
              </Badge>
              <Badge variant="outline" className="text-xs">Rich notifications</Badge>
              <Badge variant="outline" className="text-xs">Per-device delivery</Badge>
              <Badge variant="outline" className="text-xs">Badge counter ready</Badge>
              {supported && permission === "granted" && isRegistered && (
                <Button variant="outline" size="sm" onClick={handleTestPush} disabled={testingPush || isSyncing}>
                  {testingPush ? "Sending test..." : "Send rich test push"}
                </Button>
              )}
            </div>

            {!supported ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-muted-foreground">
                Push is tied to the phone/browser itself. If you want phone notifications, open OG Scan on that device, install it if needed, and enable push from this page there.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="og-glass-card border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4 text-og-lime" />
                Delivery preferences
              </CardTitle>
              <CardDescription>
                Choose which notification categories can trigger push delivery on this device/account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {preferenceSections.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-white/[0.04] p-2">
                        <Icon className="h-4 w-4 text-white/80" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={notificationPreferences[item.key]}
                      onCheckedChange={(checked) =>
                        setNotificationPreferences((prev) => ({
                          ...prev,
                          [item.key]: checked,
                        }))
                      }
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="og-glass-card border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MoonStar className="h-4 w-4 text-og-lime" />
                Quiet hours / DND
              </CardTitle>
              <CardDescription>
                Notifications still save to your in-app feed, but push stays silent during your quiet window.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Start</Label>
                  <Input type="time" value={quietHoursStart} onChange={(e) => setQuietHoursStart(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>End</Label>
                  <Input type="time" value={quietHoursEnd} onChange={(e) => setQuietHoursEnd(e.target.value)} className="mt-1" />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-muted-foreground">
                Leave both fields blank to keep quiet hours off. Overnight windows work too, like 11:00 PM → 7:00 AM.
              </div>

              <Button onClick={saveNotificationSettings} disabled={savingPreferences} className="w-full gap-2 rounded-xl">
                <Save className="h-4 w-4" />
                {savingPreferences ? "Saving..." : "Save delivery settings"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="notifications" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-white/[0.04]">
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Price Alerts ({priceAlerts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{notifications.length} notifications</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={unreadCount === 0}>
                  <Check className="mr-1 h-4 w-4" />Mark all read
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAll}
                  disabled={notifications.length === 0}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-1 h-4 w-4" />Clear
                </Button>
              </div>
            </div>

            <Card className="og-glass-card">
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="py-12 text-center">
                      <Bell className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                      <p className="text-muted-foreground">No notifications yet</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Track wallets and set alerts to receive activity notifications.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {notifications.map((n) => (
                        <div key={n.id} className={`p-4 ${n.is_read ? "bg-transparent" : "bg-primary/5"}`}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className="rounded-lg bg-white/[0.04] p-2">{getNotificationIcon(n.type)}</div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{n.title}</p>
                                  {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary" />}
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {!n.is_read && (
                                <Button variant="ghost" size="icon" onClick={() => markAsRead(n.id)} className="h-8 w-8">
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteNotification(n.id)}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{priceAlerts.length} active alerts</span>
              <Dialog open={showCreateAlert} onOpenChange={setShowCreateAlert}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2 rounded-xl">
                    <Plus className="h-4 w-4" />Create Alert
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-[#22d3ee]" />Create Price Alert
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Token Address</Label>
                      <Input
                        placeholder="Paste Solana token address..."
                        value={alertForm.address}
                        onChange={(e) => setAlertForm((p) => ({ ...p, address: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Symbol (optional, auto-detected)</Label>
                      <Input
                        placeholder="e.g., BONK"
                        value={alertForm.symbol}
                        onChange={(e) => setAlertForm((p) => ({ ...p, symbol: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Condition</Label>
                        <Select value={alertForm.condition} onValueChange={(v) => setAlertForm((p) => ({ ...p, condition: v }))}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="above">Price Above</SelectItem>
                            <SelectItem value="below">Price Below</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Target Price ($)</Label>
                        <Input
                          type="number"
                          step="any"
                          placeholder="0.001"
                          value={alertForm.targetPrice}
                          onChange={(e) => setAlertForm((p) => ({ ...p, targetPrice: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <Button onClick={createPriceAlert} disabled={creatingAlert} className="w-full">
                      {creatingAlert ? "Creating..." : "Create Alert"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {priceAlerts.length === 0 ? (
              <Card className="og-glass-card">
                <CardContent className="py-16 text-center">
                  <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 font-semibold">No price alerts</h3>
                  <p className="text-sm text-muted-foreground">
                    Create alerts to get notified when tokens hit your target price.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {priceAlerts.map((alert) => (
                  <Card
                    key={alert.id}
                    className={`glass-card ${alert.triggered_at ? "border-yellow-500/30" : "border-primary/10"}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`rounded-lg p-2 ${alert.triggered_at ? "bg-yellow-500/10" : "bg-primary/10"}`}>
                            {alert.triggered_at ? (
                              <Check className="h-5 w-5 text-yellow-500" />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-[#22d3ee]" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{alert.symbol || "???"}</p>
                              <Badge variant="outline" className="text-xs">
                                {alert.condition === "above" ? "↑ Above" : "↓ Below"}
                              </Badge>
                              {alert.triggered_at && (
                                <Badge className="border-yellow-500/30 bg-yellow-500/20 text-xs text-yellow-500">Triggered</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">Target: ${alert.target_price}</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {alert.token_address.slice(0, 8)}...{alert.token_address.slice(-4)}
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deletePriceAlert(alert.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Notifications;
