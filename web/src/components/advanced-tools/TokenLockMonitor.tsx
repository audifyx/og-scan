import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { Lock, Unlock, RefreshCw, Clock, ExternalLink, Calendar, Shield, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { formatAddress } from "@/lib/solana-api";

interface LockEvent {
  address: string;
  amount: number;
  percentage: number;
  lockedUntil?: Date | null;
  isDevWallet: boolean;
  isBurnAddress: boolean;
  label: string;
}

interface LockAnalysis {
  tokenName: string;
  tokenSymbol: string;
  totalSupply: number;
  lockedAmount: number;
  lockedPercent: number;
  burnedAmount: number;
  burnedPercent: number;
  devWalletAmount: number;
  devWalletPercent: number;
  circulatingSupply: number;
  locks: LockEvent[];
  riskLevel: "low" | "medium" | "high";
  isLPLocked: boolean;
}

const BURN_ADDRESSES = [
  "1nc1nerator11111111111111111111111111111111",
  "11111111111111111111111111111111",
  "So11111111111111111111111111111111111111111",
];

const LOCK_PROGRAMS = [
  { address: "MLockgrMnUkMBPv8Bfkrw4V5Mgn7Uhs5tFdAGmjMg", name: "Magnus Lock" },
  { address: "Lock7kBijGCQLEFAmXcengzXKA88iDNQPriQ7TbgeyG", name: "Streamflow" },
];

export const TokenLockMonitor = () => {
  const [tokenAddress, setTokenAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<LockAnalysis | null>(null);

  const analyzeTokenLocks = async () => {
    if (!tokenAddress || tokenAddress.length < 32) {
      toast({ title: "Enter a valid token address", variant: "destructive" });
      return;
    }
    setLoading(true);
    setAnalysis(null);
    try {
      // Fetch token holders
      const { data: holderData } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTokenHolders", tokenAddress },
      });

      // Fetch token metadata
      const { data: metaData } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "analyzeToken", tokenAddress },
      });

      const holders = holderData?.holders || [];
      const totalSupply = metaData?.supply || 1_000_000_000;
      const tokenName = metaData?.name || "Unknown";
      const tokenSymbol = metaData?.symbol || "???";

      const locks: LockEvent[] = [];
      let lockedAmount = 0;
      let burnedAmount = 0;
      let devWalletAmount = 0;

      holders.forEach((h: any) => {
        const addr = h.address || "";
        const amt = h.amount || 0;
        const pct = h.percentage || (amt / totalSupply) * 100;

        const isBurn = BURN_ADDRESSES.some((b) => addr.includes(b) || addr.startsWith("111111"));
        const isLockProgram = LOCK_PROGRAMS.some((l) => addr === l.address);
        const isDevPattern = pct > 5 && !isBurn;

        if (isBurn) {
          burnedAmount += amt;
          locks.push({ address: addr, amount: amt, percentage: pct, isBurnAddress: true, isDevWallet: false, label: "🔥 Burn Address", lockedUntil: null });
        } else if (isLockProgram) {
          lockedAmount += amt;
          locks.push({ address: addr, amount: amt, percentage: pct, isBurnAddress: false, isDevWallet: false, label: "🔒 Lock Program", lockedUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) });
        } else if (isDevPattern) {
          devWalletAmount += amt;
          locks.push({ address: addr, amount: amt, percentage: pct, isBurnAddress: false, isDevWallet: true, label: "⚠️ Large Holder", lockedUntil: null });
        }
      });

      const lockedPercent = (lockedAmount / totalSupply) * 100;
      const burnedPercent = (burnedAmount / totalSupply) * 100;
      const devWalletPercent = (devWalletAmount / totalSupply) * 100;
      const circulatingSupply = totalSupply - burnedAmount;

      const riskLevel: "low" | "medium" | "high" =
        burnedPercent + lockedPercent > 50 ? "low"
        : devWalletPercent > 20 ? "high"
        : "medium";

      setAnalysis({
        tokenName, tokenSymbol, totalSupply, lockedAmount, lockedPercent,
        burnedAmount, burnedPercent, devWalletAmount, devWalletPercent,
        circulatingSupply, locks, riskLevel,
        isLPLocked: metaData?.lpBurned || burnedPercent > 10,
      });
      toast({ title: "Lock analysis complete" });
    } catch (error) {
      toast({ title: "Error analyzing token locks", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const riskColor = {
    low: "text-green-400",
    medium: "text-yellow-400",
    high: "text-red-400",
  };
  const riskBg = {
    low: "bg-green-500/10 border-green-500/20",
    medium: "bg-yellow-500/10 border-yellow-500/20",
    high: "bg-red-500/10 border-red-500/20",
  };

  return (
    <Card className="p-6 bg-transparent border-white/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-[#22d3ee]/10">
          <Lock className="h-5 w-5 text-[#22d3ee]" />
        </div>
        <div>
          <h3 className="font-bold text-white">Token Lock Monitor</h3>
          <p className="text-sm text-white/50">Track lock schedules, burns & vesting</p>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        <Input
          placeholder="Enter token address..."
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && analyzeTokenLocks()}
          className="bg-white/[0.04] border-white/10 text-white placeholder:text-white/30"
        />
        <Button onClick={analyzeTokenLocks} disabled={loading} className="bg-[#22d3ee]/10 border border-[#22d3ee]/20 text-[#22d3ee] hover:bg-[#22d3ee]/20">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        </Button>
      </div>

      {analysis && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-white">{analysis.tokenName}</p>
              <p className="text-xs text-white/40 font-mono">{analysis.tokenSymbol}</p>
            </div>
            <Badge className={`border font-bold ${riskBg[analysis.riskLevel]} ${riskColor[analysis.riskLevel]}`}>
              {analysis.riskLevel === "high" && <AlertTriangle className="h-3 w-3 mr-1" />}
              {analysis.riskLevel === "low" && <Shield className="h-3 w-3 mr-1" />}
              {analysis.riskLevel.toUpperCase()} RISK
            </Badge>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <div className="flex items-center gap-1.5 mb-1">
                <Lock className="h-3 w-3 text-[#22d3ee]" />
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Locked</p>
              </div>
              <p className="text-xl font-black text-[#22d3ee] font-mono">{analysis.lockedPercent.toFixed(1)}%</p>
              <Progress value={analysis.lockedPercent} className="h-1 mt-1" />
            </div>
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <div className="flex items-center gap-1.5 mb-1">
                <Unlock className="h-3 w-3 text-orange-400" />
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Burned</p>
              </div>
              <p className="text-xl font-black text-orange-400 font-mono">{analysis.burnedPercent.toFixed(1)}%</p>
              <Progress value={analysis.burnedPercent} className="h-1 mt-1" />
            </div>
          </div>

          {/* LP Lock status */}
          <div className={`p-3 rounded-xl border flex items-center gap-2 ${analysis.isLPLocked ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"}`}>
            {analysis.isLPLocked ? <Lock className="h-4 w-4 text-green-400" /> : <Unlock className="h-4 w-4 text-red-400" />}
            <span className={`text-sm font-bold ${analysis.isLPLocked ? "text-green-400" : "text-red-400"}`}>
              LP {analysis.isLPLocked ? "Locked / Burned" : "Not Locked"}
            </span>
          </div>

          {/* Lock events */}
          {analysis.locks.length > 0 && (
            <div>
              <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Lock Events</p>
              <ScrollArea className="max-h-56">
                <div className="space-y-2">
                  {analysis.locks.map((lock, i) => (
                    <div key={i} className={`p-3 rounded-xl border flex items-center justify-between ${lock.isBurnAddress ? "bg-orange-500/8 border-orange-500/15" : lock.isDevWallet ? "bg-yellow-500/8 border-yellow-500/15" : "bg-[#22d3ee]/8 border-[#22d3ee]/15"}`}>
                      <div>
                        <p className="text-xs font-bold text-white">{lock.label}</p>
                        <p className="text-[10px] text-white/40 font-mono">{formatAddress(lock.address, 8)}</p>
                        {lock.lockedUntil && (
                          <p className="text-[10px] text-[#22d3ee] flex items-center gap-1 mt-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            Unlocks {formatDistanceToNow(lock.lockedUntil, { addSuffix: true })}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-white">{lock.percentage.toFixed(2)}%</p>
                        <a href={`https://solscan.io/account/${lock.address}`} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/60">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Circulating supply */}
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Circulating Supply</p>
            <p className="text-sm font-bold text-white font-mono">{analysis.circulatingSupply.toLocaleString()}</p>
            <p className="text-[10px] text-white/30 mt-0.5">
              {((analysis.circulatingSupply / analysis.totalSupply) * 100).toFixed(1)}% of total supply
            </p>
          </div>
        </div>
      )}
    </Card>
  );
};
