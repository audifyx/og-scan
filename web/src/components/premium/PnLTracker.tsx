import { useState } from "react";
import { DollarSign, Plus, TrendingUp, TrendingDown, Trash2, Calculator, Search, Wallet, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { formatUsd, getWalletOverview, getAssets, getTransactions } from "@/lib/solana-api";
import { useCredits } from "@/hooks/useCredits";
import { CreditBalance } from "@/components/credits/CreditBalance";
import { CREDIT_PRICING, formatCreditCost } from "@/lib/credit-pricing";

interface Position {
  id: string;
  token: string;
  symbol: string;
  buyPrice: number;
  currentPrice: number;
  amount: number;
  createdAt: Date;
}

interface WalletTrade {
  signature: string;
  type: string;
  timestamp: string;
  token?: string;
  amount?: number;
  value?: number;
  pnl?: number;
}

interface WalletStats {
  totalValue: number;
  solBalance: number;
  tokenCount: number;
  trades: WalletTrade[];
  estimatedPnL: number;
}

export const PnLTracker = () => {
  const [activeTab, setActiveTab] = useState("wallet");
  const [positions, setPositions] = useState<Position[]>([]);
  const [symbol, setSymbol] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [amount, setAmount] = useState("");
  
  // Wallet-based PnL
  const [walletAddress, setWalletAddress] = useState("");
  const [walletStats, setWalletStats] = useState<WalletStats | null>(null);
  const [loading, setLoading] = useState(false);
  const { spendCredits, canAfford } = useCredits();

  const analyzerCost = CREDIT_PRICING['wallet-analyzer'].cost;

  const fetchWalletPnL = async () => {
    if (!walletAddress || walletAddress.length < 32) {
      toast.error("Please enter a valid Solana wallet address");
      return;
    }

    // Check credits
    if (!canAfford('wallet-analyzer')) {
      toast.error(`Insufficient credits. Analysis costs ${formatCreditCost(analyzerCost)}`);
      return;
    }

    setLoading(true);
    try {
      // Spend credits
      const spent = await spendCredits('wallet-analyzer', `PnL Analysis: ${walletAddress.slice(0, 8)}...`);
      if (!spent) {
        setLoading(false);
        return;
      }
      const [overview, assetsData, txData] = await Promise.all([
        getWalletOverview(walletAddress),
        getAssets(walletAddress),
        getTransactions(walletAddress),
      ]);

      // Calculate token positions and estimate PnL
      const tokens = (assetsData.assets || [])
        .filter((a: any) => a.interface === 'FungibleToken' || a.interface === 'FungibleAsset')
        .map((asset: any) => ({
          symbol: asset.content?.metadata?.symbol || '???',
          name: asset.content?.metadata?.name || 'Unknown',
          balance: (asset.token_info?.balance || 0) / Math.pow(10, asset.token_info?.decimals || 0),
          value: asset.token_info?.price_info?.total_price || 0,
        }));

      // Process recent transactions for trade history
      const trades: WalletTrade[] = (txData.transactions || []).slice(0, 20).map((tx: any) => ({
        signature: tx.signature,
        type: tx.type || 'UNKNOWN',
        timestamp: tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : 'Unknown',
        token: tx.token_transfers?.[0]?.token_symbol,
        amount: tx.token_transfers?.[0]?.amount,
        value: tx.token_transfers?.[0]?.usd_amount,
      }));

      // Estimate total PnL (simplified - would need historical data for accurate calc)
      const estimatedPnL = overview.totalUsdValue * 0.1; // Placeholder

      setWalletStats({
        totalValue: overview.totalUsdValue,
        solBalance: overview.balance,
        tokenCount: tokens.length,
        trades,
        estimatedPnL,
      });

      toast.success("Wallet data loaded!");
    } catch (error) {
      console.error("Error fetching wallet PnL:", error);
      toast.error("Failed to fetch wallet data");
    } finally {
      setLoading(false);
    }
  };

  const addPosition = () => {
    if (!symbol || !buyPrice || !currentPrice || !amount) {
      toast.error("Please fill all fields");
      return;
    }

    const newPosition: Position = {
      id: Date.now().toString(),
      token: symbol.toUpperCase(),
      symbol: symbol.toUpperCase(),
      buyPrice: parseFloat(buyPrice),
      currentPrice: parseFloat(currentPrice),
      amount: parseFloat(amount),
      createdAt: new Date(),
    };

    setPositions(prev => [...prev, newPosition]);
    setSymbol("");
    setBuyPrice("");
    setCurrentPrice("");
    setAmount("");
    toast.success("Position added");
  };

  const updateCurrentPrice = (id: string, price: string) => {
    setPositions(prev => prev.map(p => 
      p.id === id ? { ...p, currentPrice: parseFloat(price) || 0 } : p
    ));
  };

  const deletePosition = (id: string) => {
    setPositions(prev => prev.filter(p => p.id !== id));
    toast.success("Position removed");
  };

  const calculatePnL = (position: Position) => {
    const invested = position.buyPrice * position.amount;
    const current = position.currentPrice * position.amount;
    const pnl = current - invested;
    const pnlPercent = invested > 0 ? ((current - invested) / invested) * 100 : 0;
    return { invested, current, pnl, pnlPercent };
  };

  const totalStats = positions.reduce(
    (acc, pos) => {
      const { invested, current, pnl } = calculatePnL(pos);
      return {
        totalInvested: acc.totalInvested + invested,
        totalCurrent: acc.totalCurrent + current,
        totalPnL: acc.totalPnL + pnl,
      };
    },
    { totalInvested: 0, totalCurrent: 0, totalPnL: 0 }
  );

  const totalPnLPercent = totalStats.totalInvested > 0 
    ? ((totalStats.totalCurrent - totalStats.totalInvested) / totalStats.totalInvested) * 100 
    : 0;

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="wallet" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Wallet P&L
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Manual Tracker
          </TabsTrigger>
        </TabsList>

        {/* Wallet-based P&L */}
        <TabsContent value="wallet" className="space-y-4 mt-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">Wallet P&L Analyzer</h2>
                  <p className="text-sm text-muted-foreground">Enter any wallet to see trading performance</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  <DollarSign className="h-3 w-3 mr-0.5" />
                  {analyzerCost.toFixed(2)}/scan
                </Badge>
                <CreditBalance compact />
              </div>
            </div>

            <div className="flex gap-2">
              <Input
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="Enter Solana wallet address"
                className="font-mono flex-1"
              />
              <Button onClick={fetchWalletPnL} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
              {walletStats && (
                <Button variant="outline" onClick={fetchWalletPnL} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </div>
          </Card>

          {walletStats && (
            <>
              {/* Wallet Stats */}
              <div className="grid gap-4 sm:grid-cols-4">
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Portfolio Value</p>
                  <p className="text-2xl font-bold text-primary">{formatUsd(walletStats.totalValue)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">SOL Balance</p>
                  <p className="text-2xl font-bold">{walletStats.solBalance.toFixed(4)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Tokens Held</p>
                  <p className="text-2xl font-bold">{walletStats.tokenCount}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Recent Trades</p>
                  <p className="text-2xl font-bold">{walletStats.trades.length}</p>
                </Card>
              </div>

              {/* Trade History */}
              <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Recent Transaction History
                </h3>
                <ScrollArea className="h-[300px]">
                  {walletStats.trades.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No recent trades found
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {walletStats.trades.map((trade, i) => (
                        <div 
                          key={trade.signature} 
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              trade.type.includes('BUY') || trade.type.includes('SWAP') 
                                ? 'bg-primary/20' 
                                : 'bg-secondary/20'
                            }`}>
                              {trade.type.includes('BUY') ? (
                                <TrendingUp className="h-4 w-4 text-primary" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-secondary" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {trade.type}
                                {trade.token && <span className="text-muted-foreground ml-2">{trade.token}</span>}
                              </p>
                              <p className="text-xs text-muted-foreground">{trade.timestamp}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            {trade.value && (
                              <p className="font-medium">${trade.value.toFixed(2)}</p>
                            )}
                            <a 
                              href={`https://solscan.io/tx/${trade.signature}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              View Tx
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </Card>
            </>
          )}

          {!walletStats && !loading && (
            <div className="text-center py-12">
              <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-medium mb-2">Enter a wallet address</h3>
              <p className="text-sm text-muted-foreground">View portfolio value, token holdings, and trade history for any Solana wallet</p>
            </div>
          )}
        </TabsContent>

        {/* Manual Tracking */}
        <TabsContent value="manual" className="space-y-4 mt-4">
          {/* Summary */}
          {positions.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Invested</p>
                <p className="text-2xl font-bold">{formatUsd(totalStats.totalInvested)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Current Value</p>
                <p className="text-2xl font-bold">{formatUsd(totalStats.totalCurrent)}</p>
              </Card>
              <Card className={`p-4 ${totalStats.totalPnL >= 0 ? 'border-primary/50' : 'border-destructive/50'}`}>
                <p className="text-xs text-muted-foreground mb-1">Total P&L</p>
                <div className="flex items-center gap-2">
                  <p className={`text-2xl font-bold ${totalStats.totalPnL >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {totalStats.totalPnL >= 0 ? '+' : ''}{formatUsd(totalStats.totalPnL)}
                  </p>
                  <Badge variant={totalStats.totalPnL >= 0 ? "default" : "destructive"}>
                    {totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%
                  </Badge>
                </div>
              </Card>
            </div>
          )}

          {/* Add Position */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">Manual P&L Tracker</h2>
                <p className="text-sm text-muted-foreground">Add trades manually to track performance</p>
              </div>
            </div>

            <div className="grid gap-3 grid-cols-1">
              <Input
                placeholder="Token symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  placeholder="Buy price ($)"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Current price ($)"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Input
                  type="number"
                  placeholder="Amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={addPosition}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </div>
          </Card>

          {/* Positions */}
          {positions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Your Positions ({positions.length})</h3>
              <div className="grid gap-3">
                {positions.map((position) => {
                  const { invested, current, pnl, pnlPercent } = calculatePnL(position);
                  return (
                    <Card key={position.id} className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex items-center gap-3 min-w-[100px]">
                          {pnl >= 0 ? (
                            <TrendingUp className="h-5 w-5 text-primary" />
                          ) : (
                            <TrendingDown className="h-5 w-5 text-destructive" />
                          )}
                          <div>
                            <p className="font-bold">{position.symbol}</p>
                            <p className="text-xs text-muted-foreground">{position.amount} tokens</p>
                          </div>
                        </div>

                        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Buy Price</p>
                            <p className="font-medium">${position.buyPrice.toFixed(4)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Current</p>
                            <Input
                              type="number"
                              value={position.currentPrice}
                              onChange={(e) => updateCurrentPrice(position.id, e.target.value)}
                              className="h-8 w-24"
                            />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Invested</p>
                            <p className="font-medium">{formatUsd(invested)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">P&L</p>
                            <p className={`font-bold ${pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                              {pnl >= 0 ? '+' : ''}{formatUsd(pnl)} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
                            </p>
                          </div>
                        </div>

                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-destructive"
                          onClick={() => deletePosition(position.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {positions.length === 0 && (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-medium mb-2">No positions tracked</h3>
              <p className="text-sm text-muted-foreground">Add your trades to track profit and loss</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
