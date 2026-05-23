import { useState, useEffect } from "react";
import { Bell, Plus, Trash2, TrendingUp, TrendingDown, Volume2, Send, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface PriceAlert {
  id: string;
  token_address: string;
  token_symbol: string | null;
  token_name: string | null;
  alert_type: string;
  target_value: number;
  current_value: number | null;
  is_active: boolean;
  is_triggered: boolean;
  notification_method: string | null;
  discord_webhook_url: string | null;
  created_at: string;
}

const POPULAR_TOKENS = [
  { address: "So11111111111111111111111111111111111111112", symbol: "SOL", name: "Solana" },
  { address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK", name: "Bonk" },
  { address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", symbol: "JUP", name: "Jupiter" },
  { address: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", symbol: "POPCAT", name: "Popcat" },
  { address: "JDkRjxdLjbyQyyy8m1tqCG29WRENxDdiyKUXU93Npump", symbol: "SOLTOOLS", name: "Sol Tools" },
];

export const PriceAlerts = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  // Form state
  const [selectedToken, setSelectedToken] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [condition, setCondition] = useState<"price_above" | "price_below">("price_above");
  const [targetPrice, setTargetPrice] = useState("");
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [useDiscord, setUseDiscord] = useState(false);

  useEffect(() => {
    if (user) fetchAlerts();
  }, [user]);

  const fetchAlerts = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('enhanced_price_alerts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      toast.error('Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  };

  const createAlert = async () => {
    if (!user) {
      toast.error('Please sign in to create alerts');
      return;
    }

    const tokenAddress = selectedToken || customAddress;
    if (!tokenAddress || !targetPrice) {
      toast.error("Please fill all required fields");
      return;
    }

    if (useDiscord && !discordWebhook) {
      toast.error("Please enter a Discord webhook URL");
      return;
    }

    setCreating(true);
    try {
      const token = POPULAR_TOKENS.find(t => t.address === tokenAddress);
      
      const { error } = await supabase
        .from('enhanced_price_alerts')
        .insert({
          user_id: user.id,
          token_address: tokenAddress,
          token_symbol: token?.symbol || customAddress.slice(0, 4).toUpperCase(),
          token_name: token?.name || 'Custom Token',
          alert_type: condition,
          target_value: parseFloat(targetPrice),
          notification_method: useDiscord ? 'discord' : 'in_app',
          discord_webhook_url: useDiscord ? discordWebhook : null,
        });
      
      if (error) throw error;
      
      toast.success('Alert created successfully!');
      fetchAlerts();
      
      // Reset form
      setSelectedToken("");
      setCustomAddress("");
      setTargetPrice("");
      setDiscordWebhook("");
      setUseDiscord(false);
    } catch (error) {
      console.error('Error creating alert:', error);
      toast.error('Failed to create alert');
    } finally {
      setCreating(false);
    }
  };

  const toggleAlert = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('enhanced_price_alerts')
        .update({ is_active: !isActive })
        .eq('id', id);
      
      if (error) throw error;
      
      setAlerts(prev => prev.map(a => 
        a.id === id ? { ...a, is_active: !isActive } : a
      ));
      toast.success(`Alert ${isActive ? 'paused' : 'activated'}`);
    } catch (error) {
      console.error('Error toggling alert:', error);
      toast.error('Failed to update alert');
    }
  };

  const deleteAlert = async (id: string) => {
    try {
      const { error } = await supabase
        .from('enhanced_price_alerts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setAlerts(prev => prev.filter(a => a.id !== id));
      toast.success('Alert deleted');
    } catch (error) {
      console.error('Error deleting alert:', error);
      toast.error('Failed to delete alert');
    }
  };

  const testDiscordWebhook = async () => {
    if (!discordWebhook) {
      toast.error('Please enter a Discord webhook URL');
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('discord-webhook', {
        body: {
          type: 'custom',
          message: '🔔 Test alert from Sol Tools! Your webhook is working correctly.',
          username: user?.email || 'Test User',
        }
      });

      if (error) throw error;
      toast.success('Test message sent to Discord!');
    } catch (error) {
      console.error('Error testing webhook:', error);
      toast.error('Failed to send test message');
    }
  };

  if (!user) {
    return (
      <Card className="p-8 text-center">
        <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="font-medium mb-2">Sign in required</h3>
        <p className="text-sm text-muted-foreground">Please sign in to create price alerts</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create Alert */}
      <Card className="p-6 glass-card-premium">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Price Alerts</h2>
            <p className="text-sm text-muted-foreground">Get notified when prices hit your targets</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Token Selection */}
            <div className="grid gap-3 grid-cols-1">
            <div>
              <Label className="text-sm mb-2 block">Select Token</Label>
              <Select value={selectedToken} onValueChange={(v) => { setSelectedToken(v); setCustomAddress(""); }}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Choose a token" />
                </SelectTrigger>
                <SelectContent>
                  {POPULAR_TOKENS.map((token) => (
                    <SelectItem key={token.address} value={token.address}>
                      {token.symbol} - {token.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm mb-2 block">Or Enter Token Address</Label>
              <Input
                placeholder="Token mint address..."
                value={customAddress}
                onChange={(e) => { setCustomAddress(e.target.value); setSelectedToken(""); }}
                className="font-mono rounded-xl"
              />
            </div>
          </div>

          {/* Condition & Price */}
          <div className="grid gap-3 grid-cols-1">
            <div>
              <Label className="text-sm mb-2 block">Condition</Label>
              <Select value={condition} onValueChange={(v) => setCondition(v as "price_above" | "price_below")}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price_above">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500" /> Price Above
                    </span>
                  </SelectItem>
                  <SelectItem value="price_below">
                    <span className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-500" /> Price Below
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm mb-2 block">Target Price ($)</Label>
              <Input
                type="number"
                placeholder="0.00001"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          {/* Discord Integration */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-secondary" />
                <span className="text-sm font-medium">Discord Notifications</span>
              </div>
              <Switch checked={useDiscord} onCheckedChange={setUseDiscord} />
            </div>

            {useDiscord && (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm mb-2 block">Discord Webhook URL</Label>
                  <Input
                    placeholder="https://discord.com/api/webhooks/..."
                    value={discordWebhook}
                    onChange={(e) => setDiscordWebhook(e.target.value)}
                    className="font-mono text-sm rounded-xl"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={testDiscordWebhook}
                  className="gap-2 rounded-xl"
                >
                  <Send className="h-4 w-4" />
                  Test Webhook
                </Button>
              </div>
            )}
          </div>

          {/* Create Button */}
          <Button 
            onClick={createAlert} 
            disabled={creating}
            className="w-full rounded-xl btn-premium"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Create Alert
          </Button>
        </div>
      </Card>

      {/* Active Alerts */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
        </div>
      ) : alerts.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Active Alerts ({alerts.filter(a => a.is_active).length})
          </h3>
          <div className="grid gap-3 grid-cols-1">
            {alerts.map((alert) => (
              <Card key={alert.id} className={`p-4 glass-card ${!alert.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={alert.is_active ? "default" : "secondary"} className="bg-primary/20 text-primary border-primary/30">
                      {alert.token_symbol}
                    </Badge>
                    {alert.alert_type === "price_above" ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    {alert.is_triggered && (
                      <Badge variant="destructive" className="text-xs">Triggered</Badge>
                    )}
                  </div>
                  <Switch 
                    checked={alert.is_active} 
                    onCheckedChange={() => toggleAlert(alert.id, alert.is_active)}
                  />
                </div>
                
                <p className="text-2xl font-bold mb-1">${alert.target_value.toFixed(6)}</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Alert when {alert.alert_type === "price_above" ? "above" : "below"} this price
                </p>

                <div className="flex items-center justify-between">
                  {alert.notification_method === 'discord' && (
                    <Badge variant="outline" className="text-xs gap-1 bg-secondary/10 text-secondary border-secondary/30">
                      <Send className="h-3 w-3" /> Discord
                    </Badge>
                  )}
                  <div className="flex gap-1 ml-auto">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      asChild
                    >
                      <a 
                        href={`https://dexscreener.com/solana/${alert.token_address}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteAlert(alert.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="font-medium mb-2">No alerts set</h3>
          <p className="text-sm text-muted-foreground">Create price alerts to get notified of market movements</p>
        </div>
      )}
    </div>
  );
};