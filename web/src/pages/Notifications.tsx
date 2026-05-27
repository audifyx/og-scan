import { useState, useEffect } from "react";
import { Bell, Check, Trash2, Wallet, TrendingUp, TrendingDown, Coins, AlertTriangle, BellRing, BellOff, Plus, Search, Zap } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string; type: string; title: string; message: string; data: any; is_read: boolean; created_at: string;
}

interface PriceAlert {
  id: string; token_address: string; symbol: string | null; condition: string; target_price: number; is_active: boolean; triggered_at: string | null; created_at: string;
}

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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [alertForm, setAlertForm] = useState({ address: "", symbol: "", condition: "above", targetPrice: "" });
  const [creatingAlert, setCreatingAlert] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  useEffect(() => {
    if (!user) return;

    fetchNotifications();
    fetchPriceAlerts();
    const unsubscribeRealtime = subscribeToNotifications();

    return unsubscribeRealtime;
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase.from("notifications").select("*").eq("user_id", user?.id).order("created_at", { ascending: false });
      if (error) throw error;
      setNotifications(data || []);
    } catch (error) { console.error("Error:", error); }
    finally { setLoading(false); }
  };

  const fetchPriceAlerts = async () => {
    try {
      const { data, error } = await supabase.from("price_alerts").select("*").eq("user_id", user?.id).order("created_at", { ascending: false });
      if (error) throw error;
      setPriceAlerts(data || []);
    } catch (error) { console.error("Error:", error); }
  };

  const subscribeToNotifications = () => {
    const channel = supabase
      .channel(`notifications-page-${user?.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user?.id}` },
        (payload) => {
          const n = payload.new as Notification;
          setNotifications((prev) => (prev.some((existing) => existing.id === n.id) ? prev : [n, ...prev]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (!error) setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllAsRead = async () => {
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", user?.id).eq("is_read", false);
    if (!error) { setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true }))); toast.success("All marked as read"); }
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (!error) setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = async () => {
    const { error } = await supabase.from("notifications").delete().eq("user_id", user?.id);
    if (!error) { setNotifications([]); toast.success("All cleared"); }
  };

  const createPriceAlert = async () => {
    if (!user || !alertForm.address || !alertForm.targetPrice) { toast.error("Fill all fields"); return; }
    setCreatingAlert(true);
    try {
      // Try to fetch symbol from DexScreener
      let symbol = alertForm.symbol;
      if (!symbol) {
        try {
          const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${alertForm.address}`);
          const data = await res.json();
          symbol = data.pairs?.[0]?.baseToken?.symbol || '???';
        } catch { symbol = '???'; }
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
      fetchPriceAlerts();
    } catch (error) { console.error("Error:", error); toast.error("Failed to create alert"); }
    finally { setCreatingAlert(false); }
  };

  const deletePriceAlert = async (id: string) => {
    const { error } = await supabase.from("price_alerts").delete().eq("id", id);
    if (!error) { setPriceAlerts(prev => prev.filter(a => a.id !== id)); toast.success("Alert deleted"); }
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

    if (result.total === 0 || result.reason === "no_tokens") {
      toast.error("This browser is not registered for push yet");
      return;
    }

    toast.success(result.sent > 0 ? "Test push sent" : "Push queued, but nothing was delivered");
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "wallet_sell": return <TrendingDown className="h-5 w-5 text-destructive" />;
      case "wallet_buy": return <TrendingUp className="h-5 w-5 text-[#22d3ee]" />;
      case "price_alert": return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "new_token": return <Coins className="h-5 w-5 text-secondary" />;
      case "whale_alert": return <Zap className="h-5 w-5 text-accent" />;
      default: return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <AppLayout>
      <PageHeader title="Alerts & Notifications" description="Manage alerts, automations, and notification preferences">
        {unreadCount > 0 && <Badge variant="secondary" className="bg-primary text-primary-foreground">{unreadCount} unread</Badge>}
      </PageHeader>

      <div className="p-4 lg:p-6 space-y-4">
        {/* Push Notification Settings */}
        {supported && (
          <Card className="og-glass-card border-primary/20">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    {permission === "granted" && isRegistered ? (
                      <BellRing className="h-5 w-5 text-[#22d3ee]" />
                    ) : (
                      <BellOff className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Push Notifications</p>
                    <p className="text-xs text-muted-foreground">
                      {permission === "denied"
                        ? "Blocked in this browser — re-enable notifications in browser settings first"
                        : permission === "granted" && isRegistered
                          ? "This device is registered for real push delivery"
                          : permission === "granted"
                            ? "Permission granted, but this device is still syncing"
                            : "Enable real push notifications for messages, spaces, and alerts"}
                    </p>
                  </div>
                </div>

                <Switch
                  checked={permission === "granted" && isRegistered}
                  disabled={permission === "denied" || isSyncing}
                  onCheckedChange={handlePushToggle}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {permission === "granted" ? (isRegistered ? "Connected" : "Syncing") : permission === "denied" ? "Blocked" : "Not enabled"}
                </Badge>
                {permission === "granted" && isRegistered && (
                  <Button variant="outline" size="sm" onClick={handleTestPush} disabled={testingPush || isSyncing}>
                    {testingPush ? "Sending test..." : "Send real test push"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="notifications" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-white/[0.04]">
            <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" />Notifications</TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2"><AlertTriangle className="h-4 w-4" />Price Alerts ({priceAlerts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{notifications.length} notifications</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={unreadCount === 0}><Check className="h-4 w-4 mr-1" />Mark all read</Button>
                <Button variant="outline" size="sm" onClick={clearAll} disabled={notifications.length === 0} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4 mr-1" />Clear</Button>
              </div>
            </div>

            <Card className="og-glass-card">
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  {loading ? (
                    <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
                  ) : notifications.length === 0 ? (
                    <div className="text-center py-12"><Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">No notifications yet</p><p className="text-sm text-muted-foreground mt-2">Track wallets and set alerts to receive activity notifications</p></div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {notifications.map((n) => (
                        <div key={n.id} className={`p-4 ${n.is_read ? "bg-transparent" : "bg-primary/5"}`}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-white/[0.04]">{getNotificationIcon(n.type)}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{n.title}</p>
                                  {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary" />}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                                <p className="text-xs text-muted-foreground mt-2">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {!n.is_read && <Button variant="ghost" size="icon" onClick={() => markAsRead(n.id)} className="h-8 w-8"><Check className="h-4 w-4" /></Button>}
                              <Button variant="ghost" size="icon" onClick={() => deleteNotification(n.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
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
                  <Button size="sm" className="gap-2 rounded-xl"><Plus className="h-4 w-4" />Create Alert</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-[#22d3ee]" />Create Price Alert</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Token Address</Label>
                      <Input placeholder="Paste Solana token address..." value={alertForm.address} onChange={(e) => setAlertForm(p => ({ ...p, address: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label>Symbol (optional, auto-detected)</Label>
                      <Input placeholder="e.g., BONK" value={alertForm.symbol} onChange={(e) => setAlertForm(p => ({ ...p, symbol: e.target.value }))} className="mt-1" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Condition</Label>
                        <Select value={alertForm.condition} onValueChange={(v) => setAlertForm(p => ({ ...p, condition: v }))}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="above">Price Above</SelectItem>
                            <SelectItem value="below">Price Below</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Target Price ($)</Label>
                        <Input type="number" step="any" placeholder="0.001" value={alertForm.targetPrice} onChange={(e) => setAlertForm(p => ({ ...p, targetPrice: e.target.value }))} className="mt-1" />
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
              <Card className="og-glass-card"><CardContent className="py-16 text-center">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No price alerts</h3>
                <p className="text-sm text-muted-foreground">Create alerts to get notified when tokens hit your target price</p>
              </CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {priceAlerts.map((alert) => (
                  <Card key={alert.id} className={`glass-card ${alert.triggered_at ? 'border-yellow-500/30' : 'border-primary/10'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${alert.triggered_at ? 'bg-yellow-500/10' : 'bg-primary/10'}`}>
                            {alert.triggered_at ? <Check className="h-5 w-5 text-yellow-500" /> : <AlertTriangle className="h-5 w-5 text-[#22d3ee]" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{alert.symbol || '???'}</p>
                              <Badge variant="outline" className="text-xs">{alert.condition === 'above' ? '↑ Above' : '↓ Below'}</Badge>
                              {alert.triggered_at && <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 text-xs">Triggered</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">Target: ${alert.target_price}</p>
                            <p className="text-xs text-muted-foreground font-mono">{alert.token_address.slice(0, 8)}...{alert.token_address.slice(-4)}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deletePriceAlert(alert.id)}><Trash2 className="h-4 w-4" /></Button>
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
