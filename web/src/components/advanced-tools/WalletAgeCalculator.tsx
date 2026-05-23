import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Clock, RefreshCw, Calendar, Activity, Shield, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow, format, differenceInDays } from "date-fns";

export const WalletAgeCalculator = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<any>(null);

  const calculate = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTransactions", walletAddress, limit: 100 },
      });
      const txs = data?.transactions || [];
      const stamps = txs.filter((t: any) => t.timestamp).map((t: any) => t.timestamp);
      if (stamps.length > 0) {
        const oldest = Math.min(...stamps);
        const newest = Math.max(...stamps);
        const firstDate = new Date(oldest * 1000);
        const ageInDays = differenceInDays(new Date(), firstDate);
        const trustLevel = ageInDays > 365 ? "Veteran" : ageInDays > 180 ? "Established" : ageInDays > 30 ? "Active" : "New";
        const trustColor = ageInDays > 365 ? "text-[#eab308]" : ageInDays > 180 ? "text-green-400" : ageInDays > 30 ? "text-[#22d3ee]" : "text-orange-400";
        setInfo({
          firstDate,
          lastDate: new Date(newest * 1000),
          ageDisplay: formatDistanceToNow(firstDate),
          ageInDays,
          txCount: txs.length,
          trustLevel,
          trustColor,
        });
      } else {
        toast({ title: "No transaction history found", variant: "destructive" });
      }
      toast({ title: "Wallet age calculated" });
    } catch {
      toast({ title: "Error analyzing wallet", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/[0.07] space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <Clock className="h-5 w-5 text-indigo-400" />
        </div>
        <div>
          <h3 className="font-bold text-white">Wallet Age Calculator</h3>
          <p className="text-xs text-white/40">First transaction, activity history & trust level</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Enter wallet address..." value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)}
          className="flex-1 font-mono text-xs bg-white/[0.04] border-white/10" />
        <Button onClick={calculate} disabled={loading} className="btn-3d shrink-0 gap-1.5">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
          Calculate
        </Button>
      </div>

      {info && (
        <div className="space-y-3">
          {/* Trust badge */}
          <div className={`p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              {info.ageInDays > 180 ? <Shield className={`h-5 w-5 ${info.trustColor}`} /> : <AlertTriangle className={`h-5 w-5 ${info.trustColor}`} />}
              <div>
                <p className={`font-bold ${info.trustColor}`}>{info.trustLevel}</p>
                <p className="text-xs text-white/30">Trust Level</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-black ${info.trustColor}`}>{info.ageInDays}</p>
              <p className="text-[10px] text-white/30">days old</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="h-3.5 w-3.5 text-white/30" />
                <span className="text-[10px] text-white/30">First Activity</span>
              </div>
              <p className="text-sm font-semibold">{format(info.firstDate, "MMM d, yyyy")}</p>
              <p className="text-[10px] text-white/25">{info.ageDisplay} ago</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-1.5 mb-1">
                <Activity className="h-3.5 w-3.5 text-white/30" />
                <span className="text-[10px] text-white/30">Last Activity</span>
              </div>
              <p className="text-sm font-semibold">{format(info.lastDate, "MMM d, yyyy")}</p>
              <p className="text-[10px] text-white/25">{formatDistanceToNow(info.lastDate, { addSuffix: true })}</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-between">
            <span className="text-sm text-white/60">Transactions analyzed</span>
            <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">{info.txCount}+</Badge>
          </div>
        </div>
      )}
    </div>
  );
};
