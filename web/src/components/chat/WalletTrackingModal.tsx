import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { formatAddress, formatUsd, formatNumber } from "@/lib/solana-api";
import {
  Wallet, TrendingUp, TrendingDown, Activity, History, Coins,
  ExternalLink, Copy, RefreshCw, PieChart, BarChart3, Clock,
  ArrowUpRight, ArrowDownRight, Zap, Shield, AlertTriangle, Send
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface WalletTrackingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: string | null;
}

interface WalletOverview {
  balance: number;
  usdValue: number;
  solPrice: number;
  priceChange24h: number;
  tokenCount: number;
  nftCount: number;
  totalUsdValue: number;
}

interface Transaction {
  signature: string;
  timestamp?: number;
  type: string;
  description?: string;
  fee?: number;
}

interface TokenHolding {
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
  image?: string;
}

export const WalletTrackingModal = ({ open, onOpenChange, walletAddress }: WalletTrackingModalProps) => {
  const [overview, setOverview] = useState<WalletOverview | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [sendingDiscord, setSendingDiscord] = useState(false);

  const sendToDiscord = async () => {
    if (!walletAddress || !overview) return;
    setSendingDiscord(true);
    try {
      const { error } = await supabase.functions.invoke("discord-webhook", {
        body: {
          type: "custom",
          walletAddress,
          usdValue: overview.totalUsdValue,
          message: `📊 Wallet Analysis: ${overview.balance.toFixed(4)} SOL ($${overview.totalUsdValue.toFixed(2)}) | ${overview.tokenCount} tokens | ${overview.nftCount} NFTs`,
          username: "Shared via Alpha Chat",
        },
      });
      if (error) throw error;
      toast({ title: "Sent to Discord!", description: "Wallet info shared with community" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to send to Discord", variant: "destructive" });
    } finally {
      setSendingDiscord(false);
    }
  };

  useEffect(() => {
    if (open && walletAddress) {
      fetchAllData();
    }
  }, [open, walletAddress]);

  const fetchAllData = async () => {
    if (!walletAddress) return;
    setLoading(true);

    try {
      // Fetch overview
      const { data: overviewData } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getWalletOverview", walletAddress },
      });
      if (overviewData) setOverview(overviewData);

      // Fetch transactions
      const { data: txData } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTransactions", walletAddress, limit: 50 },
      });
      if (txData?.transactions) setTransactions(txData.transactions);

      // Fetch assets/holdings
      const { data: assetsData } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getAssets", walletAddress },
      });
      
      // Handle both possible response formats (items or assets)
      const assetList = assetsData?.items || assetsData?.assets || [];
      if (assetList.length > 0) {
        const tokens = assetList
          .filter((item: any) => 
            item.interface === "FungibleToken" || 
            item.interface === "FungibleAsset" ||
            item.token_info?.balance > 0
          )
          .map((item: any) => ({
            symbol: item.content?.metadata?.symbol || item.symbol || "???",
            name: item.content?.metadata?.name || item.name || "Unknown Token",
            balance: (item.token_info?.balance || 0) / Math.pow(10, item.token_info?.decimals || 9),
            usdValue: item.token_info?.price_info?.total_price || 0,
            image: item.content?.links?.image || item.image,
          }))
          .filter((t: any) => t.balance > 0);
        setHoldings(tokens);
      }
    } catch (error) {
      console.error("Error fetching wallet data:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      toast({ title: "Copied!", description: "Wallet address copied to clipboard" });
    }
  };

  const openSolscan = () => {
    if (walletAddress) {
      window.open(`https://solscan.io/account/${walletAddress}`, "_blank");
    }
  };

  if (!walletAddress) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg">Wallet Analytics</DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs text-muted-foreground font-mono">
                    {formatAddress(walletAddress, 8)}
                  </code>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={copyAddress}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={openSolscan}>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={sendToDiscord} 
                disabled={sendingDiscord || !overview}
                className="gap-1 bg-[#5865F2]/10 border-[#5865F2]/30 hover:bg-[#5865F2]/20 text-[#5865F2]"
              >
                <Send className={`h-4 w-4 ${sendingDiscord ? "animate-pulse" : ""}`} />
                Discord
              </Button>
              <Button variant="outline" size="sm" onClick={fetchAllData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="overview" className="gap-1">
              <PieChart className="h-3 w-3" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="holdings" className="gap-1">
              <Coins className="h-3 w-3" />
              Holdings
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1">
              <History className="h-3 w-3" />
              History
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1">
              <BarChart3 className="h-3 w-3" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden mt-4">
            <TabsContent value="overview" className="h-full m-0">
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <Card key={i} className="p-4 animate-pulse">
                      <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                      <div className="h-6 bg-muted rounded w-3/4" />
                    </Card>
                  ))}
                </div>
              ) : overview && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">SOL Balance</p>
                      <p className="text-xl font-bold">{overview.balance.toFixed(4)}</p>
                      <p className="text-xs text-muted-foreground">{formatUsd(overview.usdValue)}</p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Total Value</p>
                      <p className="text-xl font-bold">{formatUsd(overview.totalUsdValue)}</p>
                      <div className={`flex items-center gap-1 text-xs ${overview.priceChange24h >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {overview.priceChange24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {overview.priceChange24h.toFixed(2)}% (24h)
                      </div>
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Tokens</p>
                      <p className="text-xl font-bold">{overview.tokenCount}</p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">NFTs</p>
                      <p className="text-xl font-bold">{overview.nftCount}</p>
                    </Card>
                  </div>

                  <Card className="p-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      Quick Stats
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">SOL Price</p>
                        <p className="font-medium">{formatUsd(overview.solPrice)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Assets</p>
                        <p className="font-medium">{overview.tokenCount + overview.nftCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">24h Change</p>
                        <p className={`font-medium ${overview.priceChange24h >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {overview.priceChange24h >= 0 ? "+" : ""}{overview.priceChange24h.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="holdings" className="h-full m-0">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {holdings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Coins className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No token holdings found</p>
                    </div>
                  ) : (
                    holdings.map((token, i) => (
                      <Card key={i} className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {token.image ? (
                            <img src={token.image} alt="" className="h-8 w-8 rounded-full" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                              <Coins className="h-4 w-4" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{token.symbol}</p>
                            <p className="text-xs text-muted-foreground">{token.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatNumber(token.balance)}</p>
                          <p className="text-xs text-muted-foreground">{formatUsd(token.usdValue)}</p>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="history" className="h-full m-0">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {transactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No transactions found</p>
                    </div>
                  ) : (
                    transactions.map((tx, i) => {
                      const isSwap = tx.type?.toLowerCase().includes("swap");
                      const isTransfer = tx.type?.toLowerCase().includes("transfer");
                      
                      return (
                        <Card key={i} className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${isSwap ? "bg-primary/10" : isTransfer ? "bg-blue-500/10" : "bg-muted"}`}>
                                {isSwap ? (
                                  <Zap className="h-4 w-4 text-primary" />
                                ) : isTransfer ? (
                                  <ArrowUpRight className="h-4 w-4 text-blue-500" />
                                ) : (
                                  <Activity className="h-4 w-4" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{tx.type || "Transaction"}</p>
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {tx.description || formatAddress(tx.signature, 8)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              {tx.timestamp && (
                                <p className="text-xs text-muted-foreground">
                                  {new Date(tx.timestamp * 1000).toLocaleDateString()}
                                </p>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                                onClick={() => window.open(`https://solscan.io/tx/${tx.signature}`, "_blank")}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="analytics" className="h-full m-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-500" />
                    Risk Analysis
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Wallet Age</span>
                      <span>Active</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transaction Count</span>
                      <span>{transactions.length}+</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Diversification</span>
                      <span>{holdings.length} tokens</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Trading Patterns
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Swap Activity</span>
                      <Badge variant="secondary">
                        {transactions.filter(t => t.type?.toLowerCase().includes("swap")).length} swaps
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transfers</span>
                      <Badge variant="secondary">
                        {transactions.filter(t => t.type?.toLowerCase().includes("transfer")).length}
                      </Badge>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
