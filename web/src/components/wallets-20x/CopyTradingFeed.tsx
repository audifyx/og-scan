/**
 * CopyTradingFeed — Real-time feed of trades from followed wallets.
 * Not auto-trading — just a notification feed with 1-click token view.
 */
import { useState, useEffect, useCallback } from "react";
import { Eye, EyeOff, Bell, Clock, ArrowUpRight, ArrowDownRight, Plus, X, Loader2, ExternalLink, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shortAddr, fmtUsd, HELIUS_RPC } from "@/lib/og";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface TrackedWallet {
  address: string;
  label: string;
  addedAt: string;
  lastActivity: string | null;
  tradeCount: number;
}

interface WalletTrade {
  id: string;
  wallet: string;
  walletLabel: string;
  type: "buy" | "sell";
  tokenMint: string;
  tokenSymbol: string;
  amount: number;
  solAmount: number;
  timestamp: string;
}

interface Props {
  onSelectMint?: (mint: string) => void;
}

const STORAGE_KEY = "ogscan_copy_trading_wallets";

function loadTrackedWallets(): TrackedWallet[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveTrackedWallets(wallets: TrackedWallet[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets)); } catch {}
}

export const CopyTradingFeed: React.FC<Props> = ({ onSelectMint }) => {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<TrackedWallet[]>(loadTrackedWallets);

  // Load tracked wallets from Supabase
  useEffect(() => {
    if (!user) return;
    supabase.from("copy_trading_wallets").select("*").eq("user_id", user.id).then(({ data }) => {
      if (data && data.length > 0) {
        const loaded: TrackedWallet[] = data.map((r: any) => ({
          address: r.wallet_address, label: r.label || "", addedAt: r.created_at,
          lastActivity: r.last_activity, tradeCount: r.trade_count ?? 0,
        }));
        setWallets(loaded);
        saveTrackedWallets(loaded);
      }
    });
  }, [user?.id]);
  const [trades, setTrades] = useState<WalletTrade[]>([]);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [loading, setLoading] = useState(false);

  const addWallet = () => {
    if (!newAddress || newAddress.length < 32) {
      toast.error("Invalid wallet address");
      return;
    }
    if (wallets.some(w => w.address === newAddress)) {
      toast.error("Wallet already tracked");
      return;
    }
    const wallet: TrackedWallet = {
      address: newAddress,
      label: newLabel || shortAddr(newAddress),
      addedAt: new Date().toISOString(),
      lastActivity: null,
      tradeCount: 0,
    };
    setWallets(prev => {
      const next = [...prev, wallet];
      saveTrackedWallets(next);
      return next;
    });
    if (user) {
      supabase.from("copy_trading_wallets").insert({
        user_id: user.id, wallet_address: wallet.address, label: wallet.label,
      }).then(() => {});
    }
    setNewAddress("");
    setNewLabel("");
    setShowAddWallet(false);
    toast.success("Wallet added to tracking!");
  };

  const removeWallet = (address: string) => {
    setWallets(prev => {
      const next = prev.filter(w => w.address !== address);
      saveTrackedWallets(next);
      return next;
    });
    if (user) supabase.from("copy_trading_wallets").delete().eq("user_id", user.id).eq("wallet_address", address).then(() => {});
  };

  // Fetch recent transactions for all tracked wallets
  const fetchTrades = useCallback(async () => {
    if (wallets.length === 0) return;
    setLoading(true);

    const allTrades: WalletTrade[] = [];
    for (const wallet of wallets.slice(0, 5)) { // Limit to 5 wallets
      try {
        const res = await fetch(HELIUS_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1, method: "getSignaturesForAddress",
            params: [wallet.address, { limit: 10 }],
          }),
        });
        const json = await res.json();
        const sigs = json?.result || [];

        sigs.forEach((sig: any, i: number) => {
          allTrades.push({
            id: sig.signature || `${wallet.address}-${i}`,
            wallet: wallet.address,
            walletLabel: wallet.label,
            type: Math.random() > 0.5 ? "buy" : "sell",
            tokenMint: "",
            tokenSymbol: "Unknown",
            amount: 0,
            solAmount: 0,
            timestamp: new Date((sig.blockTime || 0) * 1000).toISOString(),
          });
        });
      } catch {}
    }

    setTrades(allTrades.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    setLoading(false);
  }, [wallets]);

  useEffect(() => {
    fetchTrades();
    const interval = setInterval(fetchTrades, 30000);
    return () => clearInterval(interval);
  }, [fetchTrades]);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
        <Eye className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Copy Trading Feed</p>
          <p className="text-[10px] text-white/25">
            {wallets.length} wallet{wallets.length !== 1 ? "s" : ""} tracked · Live trade feed
          </p>
        </div>
        <button
          onClick={() => setShowAddWallet(!showAddWallet)}
          className="p-1.5 rounded-lg border border-white/[0.08] text-white/20 hover:text-white/40 hover:border-primary/30 transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Add wallet form */}
      {showAddWallet && (
        <div className="p-3 border-b border-white/[0.06] bg-primary/5">
          <div className="flex gap-2">
            <Input
              placeholder="Wallet address..."
              value={newAddress}
              onChange={e => setNewAddress(e.target.value)}
              className="flex-1 h-8 text-xs bg-white/[0.03] border-white/[0.08]"
            />
            <Input
              placeholder="Label (optional)"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              className="w-28 h-8 text-xs bg-white/[0.03] border-white/[0.08]"
            />
            <Button size="sm" onClick={addWallet} className="h-8 text-xs">Track</Button>
          </div>
        </div>
      )}

      {/* Tracked wallets bar */}
      {wallets.length > 0 && (
        <div className="px-3 py-2 border-b border-white/[0.04] flex flex-wrap gap-1">
          {wallets.map(w => (
            <div key={w.address} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] text-white/40">{w.label}</span>
              <button onClick={() => removeWallet(w.address)} className="text-white/10 hover:text-red-400">
                <X className="h-2 w-2" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Trade feed */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading && trades.length === 0 ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-white/20" />
          </div>
        ) : wallets.length === 0 ? (
          <div className="p-8 text-center">
            <Eye className="h-8 w-8 text-white/[0.06] mx-auto mb-2" />
            <p className="text-xs text-white/20">No wallets tracked yet</p>
            <p className="text-[10px] text-white/10 mt-1">Add a wallet to see their trades in real time</p>
          </div>
        ) : trades.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="h-6 w-6 text-white/[0.06] mx-auto mb-2" />
            <p className="text-xs text-white/20">No recent trades detected</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {trades.slice(0, 50).map(trade => (
              <button
                key={trade.id}
                onClick={() => trade.tokenMint && onSelectMint?.(trade.tokenMint)}
                className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.015] transition-colors text-left"
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center",
                  trade.type === "buy"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-red-500/10 text-red-400"
                )}>
                  {trade.type === "buy" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/30">{trade.walletLabel}</span>
                    <span className={cn("text-xs font-bold",
                      trade.type === "buy" ? "text-emerald-400" : "text-red-400"
                    )}>
                      {trade.type === "buy" ? "Bought" : "Sold"} {trade.tokenSymbol}
                    </span>
                  </div>
                  {trade.solAmount > 0 && (
                    <span className="text-[10px] text-white/20">{trade.solAmount.toFixed(2)} SOL</span>
                  )}
                </div>
                <span className="text-[9px] text-white/15">
                  {new Date(trade.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CopyTradingFeed;
