import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wallet, Eye, TrendingUp, TrendingDown, Activity, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatAddress, formatUsd } from "@/lib/solana-api";

interface TrackedWallet {
  id: string;
  wallet_address: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
}

interface WalletData {
  balance: number;
  usdValue: number;
  change24h?: number;
}

interface TrackedWalletsSidebarProps {
  wallets: TrackedWallet[];
  onWalletClick: (address: string) => void;
}

export const TrackedWalletsSidebar = ({ wallets, onWalletClick }: TrackedWalletsSidebarProps) => {
  const [walletData, setWalletData] = useState<Record<string, WalletData>>({});
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    // Fetch data for all wallets
    wallets.forEach(wallet => {
      fetchWalletData(wallet.wallet_address);
    });
  }, [wallets]);

  const fetchWalletData = async (address: string) => {
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getBalance", walletAddress: address },
      });

      if (data) {
        setWalletData(prev => ({
          ...prev,
          [address]: {
            balance: data.balance || 0,
            usdValue: data.usdValue || 0,
            change24h: data.priceChange24h || 0,
          },
        }));
      }
    } catch (error) {
      console.error("Error fetching wallet data:", error);
    }
  };

  const refreshWallet = async (address: string) => {
    setLoading(address);
    await fetchWalletData(address);
    setLoading(null);
  };

  return (
    <Card className="h-full flex flex-col">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Tracked Wallets</h3>
          <Badge variant="secondary" className="ml-auto">{wallets.length}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Click to view full analytics</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {wallets.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No wallets tracked yet</p>
              <p className="text-xs mt-1">Add a wallet to start tracking</p>
            </div>
          )}

          {wallets.map((wallet) => {
            const data = walletData[wallet.wallet_address];
            const isUp = (data?.change24h || 0) >= 0;

            return (
              <div
                key={wallet.id}
                className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => onWalletClick(wallet.wallet_address)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <Wallet className="h-3 w-3 text-primary" />
                    </div>
                    <span className="font-mono text-sm">
                      {formatAddress(wallet.wallet_address)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      refreshWallet(wallet.wallet_address);
                    }}
                  >
                    <RefreshCw className={`h-3 w-3 ${loading === wallet.wallet_address ? "animate-spin" : ""}`} />
                  </Button>
                </div>

                {data && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {data.balance.toFixed(4)} SOL
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{formatUsd(data.usdValue)}</span>
                      {data.change24h !== undefined && (
                        <span className={`flex items-center ${isUp ? "text-green-500" : "text-red-500"}`}>
                          {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {!data && (
                  <div className="h-4 bg-muted/50 rounded animate-pulse" />
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
};
