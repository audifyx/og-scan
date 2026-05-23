import { useState, useEffect } from "react";
import { Waves, Eye, Plus, Trash2, RefreshCw, ExternalLink, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getWalletOverview, getTransactions, formatAddress, formatUsd, WalletOverview, Transaction } from "@/lib/solana-api";
import { toast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { CreditBalance } from "@/components/credits/CreditBalance";
import { CREDIT_PRICING, formatCreditCost } from "@/lib/credit-pricing";

interface TrackedWhale {
  address: string;
  label: string;
  overview?: WalletOverview;
  recentTx?: Transaction[];
  lastUpdated?: Date;
}

const FAMOUS_WHALES = [
  { address: "9WzDXwBbmPdCBoccQ3jXfz9G3VDvCWNQnDmVTJJHxVbH", label: "Toly (Founder)" },
  { address: "CKs1E69a2e9TmH4mKKLrXFF8kD3ZnwKjoEuXa6sz9WqX", label: "Big Whale 1" },
  { address: "HN7cABqLq46Es1jh92dQQisAi5xscZr3VBd3JGzm1iua", label: "DeFi Whale" },
];

export const WhaleTracker = () => {
  const [whales, setWhales] = useState<TrackedWhale[]>([]);
  const [newAddress, setNewAddress] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { spendCredits, canAfford } = useCredits();

  const whaleCost = CREDIT_PRICING['whale-tracker'].cost;

  const addWhale = async (address: string, label: string) => {
    if (whales.find(w => w.address === address)) {
      toast({ title: "Whale already tracked" });
      return;
    }

    // Check credits
    if (!canAfford('whale-tracker')) {
      toast({ 
        title: "Insufficient Credits",
        description: `Adding a whale costs ${formatCreditCost(whaleCost)}`,
        variant: "destructive" 
      });
      return;
    }

    setIsLoading(true);
    try {
      // Spend credits
      const spent = await spendCredits('whale-tracker', `Track whale: ${formatAddress(address)}`);
      if (!spent) {
        setIsLoading(false);
        return;
      }

      const [overview, txData] = await Promise.all([
        getWalletOverview(address),
        getTransactions(address, 5),
      ]);

      setWhales(prev => [...prev, {
        address,
        label: label || formatAddress(address),
        overview,
        recentTx: txData.transactions || [],
        lastUpdated: new Date(),
      }]);

      setNewAddress("");
      setNewLabel("");
      toast({ title: `Now tracking ${label || formatAddress(address)}` });
    } catch (error) {
      toast({ title: "Failed to add whale", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const removeWhale = (address: string) => {
    setWhales(prev => prev.filter(w => w.address !== address));
    toast({ title: "Whale removed" });
  };

  const refreshWhale = async (address: string) => {
    // Check credits for refresh
    if (!canAfford('whale-tracker')) {
      toast({ 
        title: "Insufficient Credits",
        description: `Refreshing costs ${formatCreditCost(whaleCost)}`,
        variant: "destructive" 
      });
      return;
    }

    setIsLoading(true);
    try {
      const spent = await spendCredits('whale-tracker', `Refresh whale: ${formatAddress(address)}`);
      if (!spent) {
        setIsLoading(false);
        return;
      }

      const [overview, txData] = await Promise.all([
        getWalletOverview(address),
        getTransactions(address, 5),
      ]);

      setWhales(prev => prev.map(w => 
        w.address === address 
          ? { ...w, overview, recentTx: txData.transactions || [], lastUpdated: new Date() }
          : w
      ));
      toast({ title: "Whale data refreshed" });
    } catch (error) {
      toast({ title: "Failed to refresh", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add Whale */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Waves className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Whale Tracker</h2>
              <p className="text-sm text-muted-foreground">Monitor large wallets and their activity</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              <DollarSign className="h-3 w-3 mr-0.5" />
              {whaleCost.toFixed(2)}/query
            </Badge>
            <CreditBalance compact />
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          <Input
            placeholder="Wallet address..."
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            className="w-full"
          />
          <div className="flex gap-2">
            <Input
              placeholder="Label (optional)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="flex-1"
            />
            <Button onClick={() => addWhale(newAddress, newLabel)} disabled={isLoading || !newAddress}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </div>

        {/* Famous Whales */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground py-1">Quick add:</span>
          {FAMOUS_WHALES.map((whale) => (
            <Badge
              key={whale.address}
              variant="outline"
              className="cursor-pointer hover:bg-primary/10"
              onClick={() => addWhale(whale.address, whale.label)}
            >
              {whale.label}
            </Badge>
          ))}
        </div>
      </Card>

      {/* Tracked Whales */}
      {whales.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {whales.map((whale) => (
            <Card key={whale.address} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{whale.label}</h3>
                  <p className="text-xs font-mono text-muted-foreground">{formatAddress(whale.address, 6)}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refreshWhale(whale.address)}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => window.open(`https://solscan.io/account/${whale.address}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeWhale(whale.address)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {whale.overview && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="p-2 rounded bg-white/[0.04]">
                    <p className="text-xs text-muted-foreground">Portfolio</p>
                    <p className="font-semibold text-primary">{formatUsd(whale.overview.totalUsdValue)}</p>
                  </div>
                  <div className="p-2 rounded bg-white/[0.04]">
                    <p className="text-xs text-muted-foreground">SOL Balance</p>
                    <p className="font-semibold">{whale.overview.balance.toFixed(2)} SOL</p>
                  </div>
                </div>
              )}

              {whale.recentTx && whale.recentTx.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Recent Activity</p>
                  <div className="space-y-1">
                    {whale.recentTx.slice(0, 3).map((tx, i) => (
                      <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-white/[0.04]">
                        <div className="flex items-center gap-2">
                          {tx.type?.includes('SWAP') || tx.type?.includes('BUY') ? (
                            <TrendingUp className="h-3 w-3 text-green-500" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-500" />
                          )}
                          <span>{tx.type || 'Unknown'}</span>
                        </div>
                        <span className="text-muted-foreground">
                          {tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleDateString() : 'Recent'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {whale.lastUpdated && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  Updated: {whale.lastUpdated.toLocaleTimeString()}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {whales.length === 0 && (
        <div className="text-center py-12">
          <Eye className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="font-medium mb-2">No whales tracked yet</h3>
          <p className="text-sm text-muted-foreground">Add wallet addresses above to monitor their activity</p>
        </div>
      )}
    </div>
  );
};
