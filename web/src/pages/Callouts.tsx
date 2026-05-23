import { useState, useEffect, useRef } from "react";
import { Send, Zap, Wallet, Coins, TrendingUp, Copy, ExternalLink, RefreshCw, Users, Bot, Sparkles, MessageSquare, AlertCircle, Shield } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { isValidSolanaAddress } from "@/lib/solana-api";

interface Callout {
  id: string;
  type: 'token' | 'wallet';
  address: string;
  symbol?: string;
  name?: string;
  price?: number;
  priceChange24h?: number;
  marketCap?: number;
  liquidity?: number;
  holders?: number;
  riskScore?: number;
  totalValue?: number;
  tokenCount?: number;
  username: string;
  avatar?: string;
  timestamp: Date;
  sentToDiscord: boolean;
}

const Callouts = () => {
  const { user } = useAuth();
  const { spendCredits, canAfford } = useCredits();
  const [input, setInput] = useState("");
  const [callouts, setCallouts] = useState<Callout[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'token' | 'wallet'>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCallouts();
    
    const channel = supabase
      .channel('callouts-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `message_type=in.(token_callout,wallet_callout)`,
        },
        (payload) => {
          const msg = payload.new as any;
          const callout = parseCalloutFromMessage(msg);
          if (callout) {
            setCallouts(prev => [callout, ...prev].slice(0, 50));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadCallouts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .in('message_type', ['token_callout', 'wallet_callout'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      const parsed = (data || []).map(parseCalloutFromMessage).filter(Boolean) as Callout[];
      setCallouts(parsed);
    } catch (error) {
      console.error('Error loading callouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseCalloutFromMessage = (msg: any): Callout | null => {
    if (!msg.metadata) return null;
    const meta = msg.metadata;
    return {
      id: msg.id,
      type: msg.message_type === 'token_callout' ? 'token' : 'wallet',
      address: meta.address || meta.tokenAddress || meta.walletAddress || '',
      symbol: meta.symbol,
      name: meta.name,
      price: meta.price,
      priceChange24h: meta.priceChange24h,
      marketCap: meta.marketCap,
      liquidity: meta.liquidity,
      holders: meta.holders,
      riskScore: meta.riskScore,
      totalValue: meta.totalValue,
      tokenCount: meta.tokenCount,
      username: msg.username || 'Anonymous',
      avatar: msg.avatar_url,
      timestamp: new Date(msg.created_at),
      sentToDiscord: meta.sentToDiscord || false,
    };
  };

  const analyzeAndPost = async () => {
    if (!input.trim()) return;
    
    const address = input.trim();
    if (!isValidSolanaAddress(address)) {
      toast({ title: "Invalid address", description: "Please enter a valid Solana address", variant: "destructive" });
      return;
    }

    if (!canAfford('token-metadata')) {
      toast({ title: "Insufficient credits", variant: "destructive" });
      return;
    }

    setAnalyzing(true);

    try {
      const spent = await spendCredits('token-metadata', `Callout analysis: ${address.slice(0, 8)}...`);
      if (!spent) {
        setAnalyzing(false);
        return;
      }

      const { data: tokenData, error: tokenError } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "analyzeToken", tokenAddress: address },
      });

      let calloutType: 'token' | 'wallet' = 'token';
      let calloutData: any = {};

      if (tokenData && tokenData.price > 0) {
        calloutData = {
          type: 'token_callout',
          address,
          symbol: tokenData.symbol,
          name: tokenData.name,
          price: tokenData.price,
          priceChange24h: tokenData.priceChange24h,
          marketCap: tokenData.marketCap,
          liquidity: tokenData.liquidity,
          holders: tokenData.totalHolders,
          riskScore: tokenData.riskScore,
        };
      } else {
        calloutType = 'wallet';
        const { data: walletData } = await supabase.functions.invoke("solana-tracker", {
          body: { action: "getWalletOverview", walletAddress: address },
        });

        calloutData = {
          type: 'wallet_callout',
          address,
          totalValue: walletData?.totalUsdValue || 0,
          tokenCount: walletData?.tokenCount || 0,
          solBalance: walletData?.balance || 0,
        };
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('user_id', user?.id)
        .single();

      const { data: savedMsg, error: saveError } = await supabase
        .from('chat_messages')
        .insert({
          content: `📊 ${calloutType === 'token' ? 'TOKEN' : 'WALLET'} CALLOUT: ${calloutData.symbol || address.slice(0, 8)}`,
          message_type: calloutType === 'token' ? 'token_callout' : 'wallet_callout',
          metadata: calloutData,
          username: profile?.username || user?.email?.split('@')[0] || 'Anonymous',
          avatar_url: profile?.avatar_url,
          user_id: user?.id,
        })
        .select()
        .single();

      if (saveError) throw saveError;

      if (calloutType === 'token') {
        await supabase.functions.invoke("discord-webhook", {
          body: {
            type: "token_callout",
            tokenAddress: address,
            tokenSymbol: calloutData.symbol,
            tokenName: calloutData.name,
            username: profile?.username || 'Anonymous',
            message: `💊 ${calloutData.symbol} [${formatNumber(calloutData.marketCap)}/${calloutData.priceChange24h >= 0 ? '+' : ''}${calloutData.priceChange24h?.toFixed(0)}%] $${calloutData.symbol} 🌐 Solana`,
            tokenData: {
              price: calloutData.price,
              priceChange24h: calloutData.priceChange24h,
              marketCap: calloutData.marketCap,
              liquidity: calloutData.liquidity,
              holders: calloutData.holders,
              riskScore: calloutData.riskScore,
            },
          },
        });
      } else {
        await supabase.functions.invoke("discord-webhook", {
          body: {
            type: "wallet_alert",
            walletAddress: address,
            username: profile?.username || 'Anonymous',
            message: `👛 Wallet Analysis`,
            walletData: {
              totalUsdValue: calloutData.totalValue,
              tokenCount: calloutData.tokenCount,
              balance: calloutData.solBalance,
            },
          },
        });
      }

      await supabase
        .from('chat_messages')
        .update({ metadata: { ...calloutData, sentToDiscord: true } })
        .eq('id', savedMsg.id);

      toast({ title: "Callout posted!", description: "Sent to chat and Discord" });
      setInput("");
      loadCallouts();
    } catch (error) {
      console.error('Error creating callout:', error);
      toast({ title: "Error", description: "Failed to create callout", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const formatNumber = (num?: number) => {
    if (!num) return 'N/A';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(2);
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast({ title: "Address copied" });
  };

  const filteredCallouts = callouts.filter(c => filter === 'all' || c.type === filter);
  const tokenCount = callouts.filter(c => c.type === 'token').length;
  const walletCount = callouts.filter(c => c.type === 'wallet').length;

  return (
    <AppLayout>
      <PageHeader 
        title="Callout Channel" 
        description="Post token & wallet callouts to the community"
      >
        <div className="flex items-center gap-2">
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30 gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live Feed
          </Badge>
          <Button variant="outline" size="sm" onClick={loadCallouts} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-col h-[calc(100vh-180px)]">
        {/* Stats Bar */}
        <div className="p-4 lg:px-6 border-b border-border/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{tokenCount} Tokens</span>
            </div>
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-secondary" />
              <span className="text-sm font-medium">{walletCount} Wallets</span>
            </div>
            <div className="flex-1" />
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-auto">
              <TabsList className="h-9 bg-muted/30">
                <TabsTrigger value="all" className="text-xs px-3">All</TabsTrigger>
                <TabsTrigger value="token" className="text-xs px-3">Tokens</TabsTrigger>
                <TabsTrigger value="wallet" className="text-xs px-3">Wallets</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Callouts Feed */}
        <div className="flex-1 p-4 lg:p-6 overflow-hidden">
          <Card className="glass-card h-full">
            <CardContent className="p-0 h-full">
              <ScrollArea className="h-full" ref={scrollRef}>
                {filteredCallouts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="p-5 rounded-full bg-primary/10 mb-4">
                      <Sparkles className="h-10 w-10 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No callouts yet</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Drop a token CA or wallet address below to post the first callout!
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {filteredCallouts.map((callout) => (
                      <div key={callout.id} className="p-4 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <div className="flex-shrink-0">
                            {callout.avatar ? (
                              <img src={callout.avatar} alt={callout.username} className="h-10 w-10 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-sm font-bold text-primary-foreground">
                                {callout.username[0]?.toUpperCase()}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="font-semibold">{callout.username}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(callout.timestamp, { addSuffix: true })}
                              </span>
                              {callout.sentToDiscord && (
                                <Badge variant="outline" className="text-[10px] bg-[#5865F2]/10 text-[#5865F2] border-[#5865F2]/30">
                                  Discord
                                </Badge>
                              )}
                            </div>

                            {/* Callout Card */}
                            <Card className={`${callout.type === 'token' ? 'border-primary/30 bg-primary/5' : 'border-secondary/30 bg-secondary/5'} overflow-hidden`}>
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl ${callout.type === 'token' ? 'bg-primary/20' : 'bg-secondary/20'}`}>
                                      {callout.type === 'token' ? (
                                        <Coins className="h-5 w-5 text-primary" />
                                      ) : (
                                        <Wallet className="h-5 w-5 text-secondary" />
                                      )}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <p className="font-bold text-lg">
                                          {callout.symbol || callout.address.slice(0, 8)}
                                        </p>
                                        {callout.priceChange24h !== undefined && (
                                          <Badge className={callout.priceChange24h >= 0 ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}>
                                            {callout.priceChange24h >= 0 ? "+" : ""}{callout.priceChange24h.toFixed(1)}%
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground">{callout.name || 'Wallet Analysis'}</p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyAddress(callout.address)}>
                                      <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                      <a href={`https://dexscreener.com/solana/${callout.address}`} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    </Button>
                                  </div>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                                  {callout.type === 'token' ? (
                                    <>
                                      <div className="p-2.5 rounded-lg bg-muted/30">
                                        <p className="text-xs text-muted-foreground">Price</p>
                                        <p className="font-semibold">${callout.price?.toFixed(8)}</p>
                                      </div>
                                      <div className="p-2.5 rounded-lg bg-muted/30">
                                        <p className="text-xs text-muted-foreground">Market Cap</p>
                                        <p className="font-semibold">${formatNumber(callout.marketCap)}</p>
                                      </div>
                                      <div className="p-2.5 rounded-lg bg-muted/30">
                                        <p className="text-xs text-muted-foreground">Liquidity</p>
                                        <p className="font-semibold">${formatNumber(callout.liquidity)}</p>
                                      </div>
                                      <div className="p-2.5 rounded-lg bg-muted/30">
                                        <p className="text-xs text-muted-foreground">Holders</p>
                                        <p className="font-semibold">{formatNumber(callout.holders)}</p>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="p-2.5 rounded-lg bg-muted/30">
                                        <p className="text-xs text-muted-foreground">Total Value</p>
                                        <p className="font-semibold">${formatNumber(callout.totalValue)}</p>
                                      </div>
                                      <div className="p-2.5 rounded-lg bg-muted/30">
                                        <p className="text-xs text-muted-foreground">Tokens</p>
                                        <p className="font-semibold">{callout.tokenCount}</p>
                                      </div>
                                    </>
                                  )}
                                </div>

                                {/* Risk Score */}
                                {callout.type === 'token' && callout.riskScore !== undefined && (
                                  <div className="mt-3 flex items-center gap-2">
                                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">Risk:</span>
                                    <Badge className={
                                      callout.riskScore < 30 ? "bg-green-500/10 text-green-500 border-green-500/20" :
                                      callout.riskScore < 60 ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                                      "bg-red-500/10 text-red-500 border-red-500/20"
                                    }>
                                      {callout.riskScore < 30 ? "Low" : callout.riskScore < 60 ? "Medium" : "High"} ({callout.riskScore}/100)
                                    </Badge>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Input Area */}
        <div className="p-4 lg:px-6 border-t border-border/50 bg-card/50 backdrop-blur-xl">
          <div className="flex gap-3 max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <Zap className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Enter token CA or wallet address..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && analyzeAndPost()}
                className="pl-12 h-12 text-base rounded-xl bg-muted/30 border-border/50 focus:border-primary"
                disabled={analyzing}
              />
            </div>
            <Button 
              onClick={analyzeAndPost} 
              disabled={!input.trim() || analyzing}
              className="h-12 px-6 gap-2 btn-premium rounded-xl"
            >
              {analyzing ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Post Callout
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Callouts are posted publicly and shared to Discord
          </p>
        </div>
      </div>
    </AppLayout>
  );
};

export default Callouts;
