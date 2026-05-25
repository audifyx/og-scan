import { useState } from "react";
import { Coins, Brain, Loader2, ExternalLink, TrendingUp, TrendingDown, Send, Shield, Users, Droplets, DollarSign } from "lucide-react";
import { TokenAsset, formatNumber, formatUsd } from "@/lib/solana-api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface TokenListProps {
  tokens: TokenAsset[];
}

export function TokenList({ tokens }: TokenListProps) {
  const [selectedToken, setSelectedToken] = useState<TokenAsset | null>(null);
  const [analysis, setAnalysis] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [sendingWebhook, setSendingWebhook] = useState(false);

  const fungibleTokens = tokens.filter(
    (t) => t.interface === 'FungibleToken' || t.interface === 'FungibleAsset'
  );

  const analyzeToken = async (token: TokenAsset) => {
    setSelectedToken(token);
    setAnalysis("");
    setAnalyzing(true);

    try {
      const tokenInfo = {
        name: token.content?.metadata?.name || 'Unknown',
        symbol: token.content?.metadata?.symbol || '???',
        balance: (token.token_info?.balance || 0) / Math.pow(10, token.token_info?.decimals || 0),
        pricePerToken: token.token_info?.price_info?.price_per_token || 0,
        totalValue: token.token_info?.price_info?.total_price || 0,
        mint: token.id,
      };

      // AI analyzer — coming soon, show basic info for now
      setAnalysis(`## ${tokenInfo.name} (${tokenInfo.symbol})\n\n- **Balance:** ${formatNumber(tokenInfo.balance, 4)}\n- **Price:** $${tokenInfo.pricePerToken.toFixed(6)}\n- **Value:** ${formatUsd(tokenInfo.totalValue)}\n- **Contract:** \`${tokenInfo.mint}\`\n\n*AI analysis coming soon.*`);
    } catch (error) {
      console.error("Error analyzing token:", error);
      setAnalysis("Failed to analyze token. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const sendTokenToDiscord = async () => {
    if (!selectedToken) return;
    
    setSendingWebhook(true);
    try {
      const name = selectedToken.content?.metadata?.name || 'Unknown Token';
      const symbol = selectedToken.content?.metadata?.symbol || '???';
      const balance = (selectedToken.token_info?.balance || 0) / Math.pow(10, selectedToken.token_info?.decimals || 0);
      const pricePerToken = selectedToken.token_info?.price_info?.price_per_token || 0;
      const totalValue = selectedToken.token_info?.price_info?.total_price || 0;
      const image = selectedToken.content?.links?.image;

      // Discord webhook removed — feature coming soon
      toast.info("Discord sharing coming soon!");
    } catch (error) {
      console.error("Discord webhook error:", error);
      toast.error("Failed to send to Discord");
    } finally {
      setSendingWebhook(false);
    }
  };

  if (fungibleTokens.length === 0) {
    return (
      <div className="og-glass-card p-8 text-center">
        <Coins className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No tokens found in this wallet</p>
      </div>
    );
  }

  return (
    <>
      <div className="og-glass-card overflow-hidden animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="p-4 md:p-6 border-b border-border">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Top Holdings
            <Badge variant="secondary" className="ml-2">{fungibleTokens.length}</Badge>
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Click any token for full details & Discord callout</p>
        </div>
        <div className="divide-y divide-border max-h-[400px] overflow-y-auto scrollbar-thin">
          {fungibleTokens.map((token, index) => (
            <TokenRow 
              key={token.id} 
              token={token} 
              index={index} 
              onAnalyze={() => analyzeToken(token)}
            />
          ))}
        </div>
      </div>

      {/* Token Detail Dialog */}
      <Dialog open={!!selectedToken} onOpenChange={() => setSelectedToken(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-3">
              {selectedToken?.content?.links?.image ? (
                <img 
                  src={selectedToken.content.links.image} 
                  alt="" 
                  className="h-12 w-12 rounded-full ring-2 ring-primary/50"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Coins className="h-6 w-6 text-primary" />
                </div>
              )}
              <div>
                <span className="text-xl">{selectedToken?.content?.metadata?.name || 'Token'}</span>
                <Badge variant="outline" className="ml-2">
                  {selectedToken?.content?.metadata?.symbol}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="mx-6 grid grid-cols-3 w-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
              <TabsTrigger value="links">Links</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[50vh] px-6 pb-6">
              <TabsContent value="overview" className="mt-4 space-y-4">
                {/* Main Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Coins className="h-4 w-4" />
                      <span className="text-xs">Balance</span>
                    </div>
                    <p className="text-xl font-bold">
                      {selectedToken && formatNumber(
                        (selectedToken.token_info?.balance || 0) / 
                        Math.pow(10, selectedToken.token_info?.decimals || 0), 
                        4
                      )}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-xs">Price</span>
                    </div>
                    <p className="text-xl font-bold">
                      ${(selectedToken?.token_info?.price_info?.price_per_token || 0).toFixed(6)}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="text-xs">Total Value</span>
                    </div>
                    <p className="text-xl font-bold text-primary">
                      {formatUsd(selectedToken?.token_info?.price_info?.total_price || 0)}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Shield className="h-4 w-4" />
                      <span className="text-xs">Decimals</span>
                    </div>
                    <p className="text-xl font-bold">
                      {selectedToken?.token_info?.decimals || 0}
                    </p>
                  </div>
                </div>

                {/* Contract Info */}
                <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                  <p className="text-xs text-muted-foreground mb-2">Contract Address</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono bg-background/50 px-2 py-1 rounded flex-1 truncate">
                      {selectedToken?.id}
                    </code>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedToken?.id || '');
                        toast.success("Address copied!");
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="h-auto py-4" asChild>
                    <a 
                      href={`https://dexscreener.com/solana/${selectedToken?.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <span>View Chart</span>
                        <span className="text-xs text-muted-foreground">DexScreener</span>
                      </div>
                    </a>
                  </Button>
                  <Button variant="outline" className="h-auto py-4" asChild>
                    <a 
                      href={`https://solscan.io/token/${selectedToken?.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <ExternalLink className="h-5 w-5 text-secondary" />
                        <span>Solscan</span>
                        <span className="text-xs text-muted-foreground">Explorer</span>
                      </div>
                    </a>
                  </Button>
                </div>

                {/* Discord Button */}
                <Button 
                  className="w-full h-12"
                  onClick={sendTokenToDiscord}
                  disabled={sendingWebhook}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sendingWebhook ? 'Sending...' : 'Send Token Callout to Discord'}
                </Button>
              </TabsContent>

              <TabsContent value="analysis" className="mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="h-5 w-5 text-secondary" />
                  <h4 className="font-semibold">AI-Powered Analysis</h4>
                </div>
                
                {analyzing ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                    <span className="text-muted-foreground">Analyzing token on-chain data...</span>
                  </div>
                ) : analysis ? (
                  <div className="prose prose-invert prose-sm max-w-none bg-white/[0.04] rounded-xl p-4">
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => <h1 className="text-lg font-bold text-foreground mt-4 mb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-semibold text-foreground mt-3 mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-2 mb-1">{children}</h3>,
                        p: ({ children }) => <p className="text-sm text-muted-foreground mb-2">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2">{children}</ul>,
                        li: ({ children }) => <li className="text-sm text-muted-foreground">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                      }}
                    >
                      {analysis}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Brain className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">Analysis will appear here</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="links" className="mt-4 space-y-3">
                <a 
                  href={`https://dexscreener.com/solana/${selectedToken?.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-xl bg-white/[0.04] hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">DexScreener</p>
                      <p className="text-xs text-muted-foreground">Live chart & trading</p>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </a>
                <a 
                  href={`https://solscan.io/token/${selectedToken?.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-xl bg-white/[0.04] hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-secondary" />
                    <div>
                      <p className="font-medium">Solscan</p>
                      <p className="text-xs text-muted-foreground">Token explorer</p>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </a>
                <a 
                  href={`https://birdeye.so/token/${selectedToken?.id}?chain=solana`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-xl bg-white/[0.04] hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Birdeye</p>
                      <p className="text-xs text-muted-foreground">Market analytics</p>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </a>
                <a 
                  href={`https://rugcheck.xyz/tokens/${selectedToken?.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-xl bg-white/[0.04] hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Droplets className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="font-medium">Rugcheck</p>
                      <p className="text-xs text-muted-foreground">Safety analysis</p>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </a>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface TokenRowProps {
  token: TokenAsset;
  index: number;
  onAnalyze: () => void;
}

function TokenRow({ token, index, onAnalyze }: TokenRowProps) {
  const name = token.content?.metadata?.name || 'Unknown Token';
  const symbol = token.content?.metadata?.symbol || '???';
  const image = token.content?.links?.image;
  const balance = token.token_info?.balance || 0;
  const decimals = token.token_info?.decimals || 0;
  const displayBalance = balance / Math.pow(10, decimals);
  const pricePerToken = token.token_info?.price_info?.price_per_token || 0;
  const totalValue = token.token_info?.price_info?.total_price || 0;

  return (
    <div 
      className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors cursor-pointer group"
      style={{ animationDelay: `${index * 0.05}s` }}
      onClick={onAnalyze}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden ring-2 ring-transparent group-hover:ring-primary/50 transition-all">
          {image ? (
            <img src={image} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-muted-foreground">
              {symbol.slice(0, 2)}
            </span>
          )}
        </div>
        <div>
          <p className="font-semibold group-hover:text-primary transition-colors">{name}</p>
          <p className="text-sm text-muted-foreground font-mono">{symbol}</p>
        </div>
      </div>
      
      <div className="text-right flex items-center gap-4">
        <div>
          {totalValue > 0 && (
            <p className="font-semibold text-primary">{formatUsd(totalValue)}</p>
          )}
          <p className="text-sm text-muted-foreground">{formatNumber(displayBalance, 4)}</p>
        </div>
        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}
