/**
 * PaperTrading — Simulated trading with virtual SOL balance.
 * Practice trading without risk. Track portfolio, P&L, win rate.
 */
import { useState, useEffect } from "react";
import { Wallet, TrendingUp, TrendingDown, DollarSign, BarChart3, History, Plus, Minus, Loader2, Search, ArrowUpRight, ArrowDownRight, Trophy, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { jupSearchToken, fmtUsd, type JupTokenInfo } from "@/lib/og";
import { toast } from "sonner";

interface PaperTrade {
  id: string;
  type: "buy" | "sell";
  mint: string;
  symbol: string;
  amount: number; // token amount
  price: number; // price per token at time of trade
  solAmount: number;
  timestamp: string;
}

interface PaperPosition {
  mint: string;
  symbol: string;
  name: string;
  logoURI?: string;
  totalBought: number;
  avgBuyPrice: number;
  currentPrice: number;
  holdingAmount: number;
  unrealizedPnl: number;
  pnlPct: number;
}

interface PaperPortfolio {
  solBalance: number;
  positions: PaperPosition[];
  trades: PaperTrade[];
  totalValue: number;
  totalPnl: number;
  winCount: number;
  lossCount: number;
}

const STORAGE_KEY = "ogscan_paper_trading";
const INITIAL_BALANCE = 100; // 100 SOL starting balance

function loadPortfolio(): PaperPortfolio {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    solBalance: INITIAL_BALANCE,
    positions: [],
    trades: [],
    totalValue: INITIAL_BALANCE,
    totalPnl: 0,
    winCount: 0,
    lossCount: 0,
  };
}
function savePortfolio(p: PaperPortfolio) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export const PaperTrading: React.FC<{ onSelectMint?: (m: string) => void }> = ({ onSelectMint }) => {
  const [portfolio, setPortfolio] = useState<PaperPortfolio>(loadPortfolio);
  const [showTrade, setShowTrade] = useState(false);
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JupTokenInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedToken, setSelectedToken] = useState<JupTokenInfo | null>(null);
  const [solAmount, setSolAmount] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const totalPositionValue = portfolio.positions.reduce((s, p) => s + (p.holdingAmount * p.currentPrice), 0);
  const totalPortfolioValue = portfolio.solBalance + totalPositionValue;
  const totalPnl = totalPortfolioValue - INITIAL_BALANCE;
  const pnlPct = ((totalPortfolioValue / INITIAL_BALANCE) - 1) * 100;

  const search = async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try { setResults((await jupSearchToken(q)).slice(0, 6)); }
    catch { setResults([]); }
    setSearching(false);
  };

  const executeTrade = () => {
    if (!selectedToken || !solAmount || Number(solAmount) <= 0) return;
    const sol = Number(solAmount);
    const price = (selectedToken as any).price || 0.0001;
    const tokenAmount = sol / price;

    if (tradeType === "buy" && sol > portfolio.solBalance) {
      toast.error("Insufficient SOL balance!");
      return;
    }

    const trade: PaperTrade = {
      id: crypto.randomUUID(),
      type: tradeType,
      mint: selectedToken.address,
      symbol: selectedToken.symbol || "???",
      amount: tokenAmount,
      price,
      solAmount: sol,
      timestamp: new Date().toISOString(),
    };

    setPortfolio(prev => {
      const updated = { ...prev };
      updated.trades = [trade, ...prev.trades];

      if (tradeType === "buy") {
        updated.solBalance -= sol;
        const existing = updated.positions.find(p => p.mint === selectedToken.address);
        if (existing) {
          const newTotal = existing.holdingAmount + tokenAmount;
          existing.avgBuyPrice = ((existing.avgBuyPrice * existing.holdingAmount) + (price * tokenAmount)) / newTotal;
          existing.holdingAmount = newTotal;
          existing.currentPrice = price;
        } else {
          updated.positions.push({
            mint: selectedToken.address,
            symbol: selectedToken.symbol || "???",
            name: selectedToken.name || "",
            logoURI: selectedToken.logoURI,
            totalBought: tokenAmount,
            avgBuyPrice: price,
            currentPrice: price,
            holdingAmount: tokenAmount,
            unrealizedPnl: 0,
            pnlPct: 0,
          });
        }
      } else {
        const existing = updated.positions.find(p => p.mint === selectedToken.address);
        if (existing) {
          existing.holdingAmount = Math.max(0, existing.holdingAmount - tokenAmount);
          if (existing.holdingAmount === 0) {
            updated.positions = updated.positions.filter(p => p.mint !== selectedToken.address);
            const pnl = sol - (existing.avgBuyPrice * tokenAmount);
            if (pnl > 0) updated.winCount++;
            else updated.lossCount++;
          }
          updated.solBalance += sol;
        }
      }

      savePortfolio(updated);
      return updated;
    });

    toast.success(`${tradeType === "buy" ? "Bought" : "Sold"} ${tokenAmount.toFixed(2)} ${selectedToken.symbol} for ${sol} SOL`);
    setSelectedToken(null);
    setSolAmount("");
    setShowTrade(false);
  };

  const resetPortfolio = () => {
    const fresh = {
      solBalance: INITIAL_BALANCE,
      positions: [],
      trades: [],
      totalValue: INITIAL_BALANCE,
      totalPnl: 0,
      winCount: 0,
      lossCount: 0,
    };
    setPortfolio(fresh);
    savePortfolio(fresh);
    toast.success("Portfolio reset to 100 SOL");
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Paper Trading</p>
            <p className="text-[10px] text-white/25">Practice with virtual SOL — no real money</p>
          </div>
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px]">
            Simulation
          </Badge>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-lg bg-black/20 p-2 text-center">
            <p className="text-[8px] text-white/20">Balance</p>
            <p className="text-sm font-black text-white">{portfolio.solBalance.toFixed(2)}</p>
            <p className="text-[8px] text-white/15">SOL</p>
          </div>
          <div className="rounded-lg bg-black/20 p-2 text-center">
            <p className="text-[8px] text-white/20">Portfolio</p>
            <p className="text-sm font-black text-white">{totalPortfolioValue.toFixed(2)}</p>
            <p className="text-[8px] text-white/15">SOL</p>
          </div>
          <div className="rounded-lg bg-black/20 p-2 text-center">
            <p className="text-[8px] text-white/20">P&L</p>
            <p className={cn("text-sm font-black", totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
              {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}
            </p>
            <p className={cn("text-[8px]", pnlPct >= 0 ? "text-emerald-400" : "text-red-400")}>
              {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
            </p>
          </div>
          <div className="rounded-lg bg-black/20 p-2 text-center">
            <p className="text-[8px] text-white/20">Win Rate</p>
            <p className="text-sm font-black text-white">
              {portfolio.winCount + portfolio.lossCount > 0
                ? `${Math.round((portfolio.winCount / (portfolio.winCount + portfolio.lossCount)) * 100)}%`
                : "—"
              }
            </p>
            <p className="text-[8px] text-white/15">{portfolio.winCount}W {portfolio.lossCount}L</p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 p-3 border-b border-white/[0.06]">
        <Button
          size="sm"
          onClick={() => { setTradeType("buy"); setShowTrade(true); }}
          className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 gap-1"
        >
          <ArrowUpRight className="h-3 w-3" /> Buy
        </Button>
        <Button
          size="sm"
          onClick={() => { setTradeType("sell"); setShowTrade(true); }}
          className="flex-1 h-8 text-xs bg-red-600 hover:bg-red-700 gap-1"
          disabled={portfolio.positions.length === 0}
        >
          <ArrowDownRight className="h-3 w-3" /> Sell
        </Button>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="p-2 rounded-lg border border-white/[0.08] text-white/20 hover:text-white/40"
        >
          <History className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={resetPortfolio}
          className="p-2 rounded-lg border border-white/[0.08] text-white/20 hover:text-red-400"
          title="Reset"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Trade form */}
      {showTrade && (
        <div className="p-3 border-b border-white/[0.06] bg-primary/5">
          <p className="text-xs font-bold text-white mb-2">{tradeType === "buy" ? "Buy" : "Sell"} Token</p>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/20" />
            <Input
              placeholder="Search token..."
              value={query}
              onChange={e => { setQuery(e.target.value); search(e.target.value); }}
              className="pl-8 h-8 text-xs bg-white/[0.03] border-white/[0.08]"
              autoFocus
            />
          </div>
          {results.length > 0 && !selectedToken && (
            <div className="space-y-0.5 mb-2">
              {results.map(r => (
                <button
                  key={r.address}
                  onClick={() => { setSelectedToken(r); setResults([]); setQuery(r.symbol || ""); }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/[0.04] text-left"
                >
                  {r.logoURI && <img src={r.logoURI} className="w-5 h-5 rounded-full" alt="" />}
                  <span className="text-[11px] font-bold text-white">{r.symbol}</span>
                  <span className="text-[9px] text-white/20 flex-1 truncate">{r.name}</span>
                </button>
              ))}
            </div>
          )}
          {selectedToken && (
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="SOL amount"
                value={solAmount}
                onChange={e => setSolAmount(e.target.value)}
                className="flex-1 h-8 text-xs bg-white/[0.03] border-white/[0.08]"
              />
              <Button size="sm" onClick={executeTrade} className={cn("h-8 text-xs",
                tradeType === "buy" ? "bg-emerald-600" : "bg-red-600"
              )}>
                {tradeType === "buy" ? "Buy" : "Sell"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowTrade(false); setSelectedToken(null); }} className="h-8 text-xs">
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Positions */}
      <div className="max-h-[250px] overflow-y-auto">
        {portfolio.positions.length === 0 && !showHistory ? (
          <div className="p-6 text-center">
            <BarChart3 className="h-6 w-6 text-white/[0.06] mx-auto mb-2" />
            <p className="text-xs text-white/20">No positions yet</p>
            <p className="text-[10px] text-white/10">Start paper trading to practice</p>
          </div>
        ) : showHistory ? (
          <div className="divide-y divide-white/[0.03]">
            {portfolio.trades.slice(0, 30).map(trade => (
              <div key={trade.id} className="flex items-center gap-2 p-2.5">
                <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center",
                  trade.type === "buy" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                )}>
                  {trade.type === "buy" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                </div>
                <span className={cn("text-[10px] font-bold", trade.type === "buy" ? "text-emerald-400" : "text-red-400")}>
                  {trade.type.toUpperCase()}
                </span>
                <span className="text-[10px] text-white">{trade.symbol}</span>
                <span className="text-[9px] text-white/20">{trade.solAmount.toFixed(2)} SOL</span>
                <span className="text-[8px] text-white/10 ml-auto">
                  {new Date(trade.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {portfolio.positions.map(pos => (
              <button
                key={pos.mint}
                onClick={() => onSelectMint?.(pos.mint)}
                className="w-full flex items-center gap-2 p-3 hover:bg-white/[0.015] transition-colors text-left"
              >
                {pos.logoURI ? (
                  <img src={pos.logoURI} className="w-7 h-7 rounded-full" alt="" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-[9px] font-bold text-white/20">
                    {pos.symbol.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-white">{pos.symbol}</span>
                  <span className="text-[9px] text-white/20 ml-1">{pos.holdingAmount.toFixed(2)} tokens</span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-white">{(pos.holdingAmount * pos.currentPrice).toFixed(2)} SOL</p>
                  <p className="text-[9px] text-white/20">avg {pos.avgBuyPrice < 0.001 ? pos.avgBuyPrice.toExponential(1) : pos.avgBuyPrice.toFixed(4)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaperTrading;
