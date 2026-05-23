import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { formatAddress } from "@/lib/solana-api";
import { toast } from "@/hooks/use-toast";
import { useAdmin } from "@/hooks/useAdmin";
import { WebhookDashboard } from "@/components/webhooks/WebhookDashboard";
import {
  Webhook, Send, Bell, Wallet, Coins, TrendingUp, TrendingDown,
  AlertTriangle, Zap, Plus, Trash2, RefreshCw, History, Settings,
  Globe, Check, X, Activity, Target, Shield, Radio, LayoutDashboard, Lock
} from "lucide-react";

interface TrackedAlert {
  id: string;
  type: "wallet" | "token" | "whale" | "price";
  address: string;
  label?: string;
  enabled: boolean;
  lastTriggered?: Date;
  conditions?: {
    priceAbove?: number;
    priceBelow?: number;
    balanceChange?: number;
  };
}

interface WebhookLog {
  id: string;
  type: string;
  message: string;
  timestamp: Date;
  success: boolean;
}

const Webhooks = () => {
  const navigate = useNavigate();
  const { isOwner, loading: adminLoading } = useAdmin();
  const [alerts, setAlerts] = useState<TrackedAlert[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [newWallet, setNewWallet] = useState("");
  const [newToken, setNewToken] = useState("");
  const [sending, setSending] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  
  // Real-time tracking states
  const [whaleAlerts, setWhaleAlerts] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [tradeAlerts, setTradeAlerts] = useState(true);
  const [newTokenAlerts, setNewTokenAlerts] = useState(false);

  // Check if user is owner - if not, redirect
  useEffect(() => {
    if (!adminLoading && !isOwner) {
      navigate("/wallets");
      toast({
        title: "Access Denied",
        description: "This feature is only available to the platform owner",
        variant: "destructive",
      });
    }
  }, [isOwner, adminLoading, navigate]);

  // If still loading or not owner, show loading/access denied
  if (adminLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!isOwner) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <Lock className="h-16 w-16 text-destructive" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">This feature is only available to the platform owner.</p>
          <Button onClick={() => navigate("/wallets")}>Go Home</Button>
        </div>
      </AppLayout>
    );
  }

  const sendTestWebhook = async () => {
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("discord-webhook", {
        body: {
          type: "custom",
          message: testMessage || "🧪 Test alert from SolanaHub! Your webhook is working correctly.",
          username: "SolanaHub Bot",
        },
      });
      if (error) throw error;
      
      const newLog: WebhookLog = {
        id: Date.now().toString(),
        type: "test",
        message: testMessage || "Test webhook sent",
        timestamp: new Date(),
        success: true,
      };
      setLogs(prev => [newLog, ...prev].slice(0, 50));
      toast({ title: "Sent!", description: "Test message delivered to Discord" });
    } catch (error) {
      const newLog: WebhookLog = {
        id: Date.now().toString(),
        type: "test",
        message: "Failed to send test",
        timestamp: new Date(),
        success: false,
      };
      setLogs(prev => [newLog, ...prev].slice(0, 50));
      toast({ title: "Error", description: "Failed to send webhook", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const sendWalletAlert = async (address: string) => {
    setSending(true);
    try {
      const { data: overview } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getWalletOverview", walletAddress: address },
      });
      
      const { error } = await supabase.functions.invoke("discord-webhook", {
        body: {
          type: "wallet_alert",
          walletAddress: address,
          balance: overview?.balance || 0,
          usdValue: overview?.totalUsdValue || 0,
          tokenCount: overview?.tokenCount || 0,
          message: `📊 Wallet Update: ${overview?.balance?.toFixed(4) || 0} SOL ($${overview?.totalUsdValue?.toFixed(2) || 0})`,
        },
      });
      if (error) throw error;
      
      const newLog: WebhookLog = {
        id: Date.now().toString(),
        type: "wallet",
        message: `Wallet alert: ${formatAddress(address)}`,
        timestamp: new Date(),
        success: true,
      };
      setLogs(prev => [newLog, ...prev].slice(0, 50));
      toast({ title: "Alert Sent!", description: "Wallet info sent to Discord" });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const sendTokenAlert = async (address: string) => {
    setSending(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "analyzeToken", tokenAddress: address },
      });
      
      const { error } = await supabase.functions.invoke("discord-webhook", {
        body: {
          type: "token_alert",
          tokenAddress: address,
          tokenName: data?.name || "Unknown",
          price: data?.price || 0,
          priceChange: data?.priceChange24h || 0,
          holders: data?.holders || 0,
          message: `🪙 Token Alert: ${data?.name || address} - $${data?.price?.toFixed(6) || 0} (${data?.priceChange24h >= 0 ? '+' : ''}${data?.priceChange24h?.toFixed(2) || 0}%)`,
        },
      });
      if (error) throw error;
      
      const newLog: WebhookLog = {
        id: Date.now().toString(),
        type: "token",
        message: `Token alert: ${data?.name || formatAddress(address)}`,
        timestamp: new Date(),
        success: true,
      };
      setLogs(prev => [newLog, ...prev].slice(0, 50));
      toast({ title: "Alert Sent!", description: "Token info sent to Discord" });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const addWalletAlert = () => {
    if (!newWallet) return;
    const alert: TrackedAlert = {
      id: Date.now().toString(),
      type: "wallet",
      address: newWallet,
      enabled: true,
    };
    setAlerts(prev => [...prev, alert]);
    setNewWallet("");
    toast({ title: "Wallet Added", description: "Now tracking for Discord alerts" });
  };

  const addTokenAlert = () => {
    if (!newToken) return;
    const alert: TrackedAlert = {
      id: Date.now().toString(),
      type: "token",
      address: newToken,
      enabled: true,
    };
    setAlerts(prev => [...prev, alert]);
    setNewToken("");
    toast({ title: "Token Added", description: "Now tracking for Discord alerts" });
  };

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
    toast({ title: "Alert Removed" });
  };

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const sendWhaleAlert = async () => {
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("discord-webhook", {
        body: {
          type: "whale_alert",
          message: "🐋 WHALE ALERT: Large movement detected on Solana network!",
          amount: Math.floor(Math.random() * 10000) + 1000,
        },
      });
      if (error) throw error;
      toast({ title: "Whale Alert Sent!" });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader 
        title="Webhooks & Alerts" 
        description="Send real-time alerts to Discord (Owner Only)"
      >
        <Badge className="bg-[#5865F2]/20 text-[#5865F2] border-[#5865F2]/30">
          <Globe className="h-3 w-3 mr-1" />
          Discord Connected
        </Badge>
        <Badge className="bg-destructive/20 text-destructive border-destructive/30 ml-2">
          <Shield className="h-3 w-3 mr-1" />
          Owner Only
        </Badge>
      </PageHeader>

      <div className="p-4 lg:p-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#5865F2]/20">
                <Webhook className="h-5 w-5 text-[#5865F2]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{alerts.length}</p>
                <p className="text-xs text-muted-foreground">Active Alerts</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Check className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{logs.filter(l => l.success).length}</p>
                <p className="text-xs text-muted-foreground">Sent Today</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{alerts.filter(a => a.type === 'wallet').length}</p>
                <p className="text-xs text-muted-foreground">Wallets</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary/20">
                <Coins className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{alerts.filter(a => a.type === 'token').length}</p>
                <p className="text-xs text-muted-foreground">Tokens</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-5">
            <TabsTrigger value="dashboard" className="gap-1">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="send" className="gap-1">
              <Send className="h-4 w-4" />
              Send
            </TabsTrigger>
            <TabsTrigger value="track" className="gap-1">
              <Target className="h-4 w-4" />
              Track
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1">
              <History className="h-4 w-4" />
              Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <WebhookDashboard />
          </TabsContent>

          <TabsContent value="send" className="mt-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    Test Webhook
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Custom message (optional)"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                  />
                  <Button onClick={sendTestWebhook} disabled={sending} className="w-full">
                    {sending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    Send Test
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    Wallet Alert
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Wallet address..."
                    value={newWallet}
                    onChange={(e) => setNewWallet(e.target.value)}
                  />
                  <Button onClick={() => sendWalletAlert(newWallet)} disabled={sending || !newWallet} className="w-full">
                    {sending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    Send Wallet Info
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Coins className="h-4 w-4 text-secondary" />
                    Token Alert
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Token address..."
                    value={newToken}
                    onChange={(e) => setNewToken(e.target.value)}
                  />
                  <Button onClick={() => sendTokenAlert(newToken)} disabled={sending || !newToken} className="w-full">
                    {sending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    Send Token Info
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Quick Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button onClick={sendWhaleAlert} disabled={sending} variant="outline" className="w-full justify-start">
                    <Activity className="h-4 w-4 mr-2 text-blue-500" />
                    Send Whale Alert
                  </Button>
                  <Button 
                    onClick={() => {
                      supabase.functions.invoke("discord-webhook", {
                        body: { type: "custom", message: "🚀 New token launch detected! Check the charts now." }
                      });
                      toast({ title: "Alert Sent!" });
                    }} 
                    variant="outline" 
                    className="w-full justify-start"
                  >
                    <Zap className="h-4 w-4 mr-2 text-yellow-500" />
                    New Token Alert
                  </Button>
                  <Button 
                    onClick={() => {
                      supabase.functions.invoke("discord-webhook", {
                        body: { type: "custom", message: "⚠️ Price movement alert! Major volatility detected." }
                      });
                      toast({ title: "Alert Sent!" });
                    }} 
                    variant="outline" 
                    className="w-full justify-start"
                  >
                    <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
                    Price Alert
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="track" className="mt-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Track Wallet</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Wallet address to track..."
                    value={newWallet}
                    onChange={(e) => setNewWallet(e.target.value)}
                  />
                  <Button onClick={addWalletAlert} disabled={!newWallet} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Wallet Alert
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Track Token</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Token address to track..."
                    value={newToken}
                    onChange={(e) => setNewToken(e.target.value)}
                  />
                  <Button onClick={addTokenAlert} disabled={!newToken} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Token Alert
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Active Tracking Alerts</span>
                  <Badge variant="secondary">{alerts.length} alerts</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {alerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bell className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No alerts configured</p>
                    <p className="text-sm">Add wallets or tokens to start tracking</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {alerts.map((alert) => (
                        <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-3">
                            {alert.type === "wallet" ? (
                              <Wallet className="h-4 w-4 text-primary" />
                            ) : (
                              <Coins className="h-4 w-4 text-secondary" />
                            )}
                            <div>
                              <p className="font-mono text-sm">{formatAddress(alert.address)}</p>
                              <p className="text-xs text-muted-foreground capitalize">{alert.type}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch checked={alert.enabled} onCheckedChange={() => toggleAlert(alert.id)} />
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeAlert(alert.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Alert Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Whale Alerts</Label>
                    <p className="text-xs text-muted-foreground">Large transactions (&gt;1000 SOL)</p>
                  </div>
                  <Switch checked={whaleAlerts} onCheckedChange={setWhaleAlerts} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Price Alerts</Label>
                    <p className="text-xs text-muted-foreground">Significant price movements</p>
                  </div>
                  <Switch checked={priceAlerts} onCheckedChange={setPriceAlerts} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Trade Alerts</Label>
                    <p className="text-xs text-muted-foreground">Your tracked wallet trades</p>
                  </div>
                  <Switch checked={tradeAlerts} onCheckedChange={setTradeAlerts} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>New Token Alerts</Label>
                    <p className="text-xs text-muted-foreground">New launches on tracked platforms</p>
                  </div>
                  <Switch checked={newTokenAlerts} onCheckedChange={setNewTokenAlerts} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Webhook History</span>
                  <Badge variant="secondary">{logs.length} entries</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No webhook logs yet</p>
                    <p className="text-sm">Send a test to see activity</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {logs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-3">
                            {log.success ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <X className="h-4 w-4 text-destructive" />
                            )}
                            <div>
                              <p className="text-sm">{log.message}</p>
                              <p className="text-xs text-muted-foreground">
                                {log.timestamp.toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          <Badge variant={log.success ? "default" : "destructive"} className="capitalize">
                            {log.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Webhooks;