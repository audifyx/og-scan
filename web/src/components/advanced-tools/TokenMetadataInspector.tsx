import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, RefreshCw, Shield, AlertTriangle, Check, X, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatAddress } from "@/lib/solana-api";
import { solanaTracker } from "@/lib/solana-tools";

export const TokenMetadataInspector = () => {
  const [tokenAddress, setTokenAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<any>(null);

  const inspect = async () => {
    if (!tokenAddress) return;
    setLoading(true);
    try {
      const { data } = await solanaTracker("analyzeToken", { tokenAddress });
      setMeta(data);
      toast({ title: "Inspection complete" });
    } catch {
      toast({ title: "Error inspecting token", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const riskColor = meta?.riskScore > 70 ? "text-red-400" : meta?.riskScore > 40 ? "text-yellow-400" : "text-green-400";
  const riskBg = meta?.riskScore > 70 ? "bg-red-500/10 border-red-500/20" : meta?.riskScore > 40 ? "bg-yellow-500/10 border-yellow-500/20" : "bg-green-500/10 border-green-500/20";
  const riskLabel = meta?.riskScore > 70 ? "HIGH RISK" : meta?.riskScore > 40 ? "MEDIUM RISK" : "LOW RISK";

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/[0.07] space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#22d3ee]/10 border border-[#22d3ee]/20">
          <FileText className="h-5 w-5 text-[#22d3ee]" />
        </div>
        <div>
          <h3 className="font-bold text-white">Token Metadata Inspector</h3>
          <p className="text-xs text-white/40">SPL token details, authorities, freeze status</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Enter token address..." value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)}
          className="flex-1 font-mono text-xs bg-white/[0.04] border-white/10" />
        <Button onClick={inspect} disabled={loading} className="btn-3d shrink-0 gap-1.5">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Inspect
        </Button>
      </div>

      {meta && (
        <div className="space-y-3">
          {/* Token identity */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Name", val: meta.name || "Unknown" },
              { label: "Symbol", val: meta.symbol || "???" },
              { label: "Decimals", val: meta.decimals ?? "N/A" },
              { label: "Total Supply", val: meta.supply ? Number(meta.supply).toLocaleString() : "N/A" },
            ].map((f) => (
              <div key={f.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-[10px] text-white/30 mb-0.5">{f.label}</p>
                <p className="text-sm font-semibold text-white truncate">{f.val}</p>
              </div>
            ))}
          </div>

          {/* Authority flags */}
          <div>
            <p className="text-xs font-semibold text-white/40 mb-2">SECURITY FLAGS</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Mint Authority", val: meta.mintAuthority, safe: !meta.mintAuthority },
                { label: "Freeze Authority", val: meta.freezeAuthority, safe: !meta.freezeAuthority },
                { label: "Mutable Metadata", val: meta.isMutable, safe: !meta.isMutable },
                { label: "Top10 > 50%", val: (meta.top10Percent || 0) > 50, safe: (meta.top10Percent || 0) <= 50 },
              ].map((flag) => (
                <div key={flag.label} className={`flex items-center gap-2 p-2.5 rounded-xl border ${flag.safe ? "bg-green-500/5 border-green-500/15" : "bg-red-500/10 border-red-500/20"}`}>
                  {flag.safe ? <Check className="h-3.5 w-3.5 text-green-400 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                  <span className={`text-xs ${flag.safe ? "text-green-400" : "text-red-400"}`}>{flag.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risk score */}
          {meta.riskScore !== undefined && (
            <div className={`p-3 rounded-xl border ${riskBg} flex items-center justify-between`}>
              <div>
                <p className="text-xs text-white/40">Risk Score</p>
                <p className={`text-2xl font-black ${riskColor}`}>{meta.riskScore}<span className="text-sm font-normal text-white/30">/100</span></p>
              </div>
              <Badge className={`${riskBg} ${riskColor}`}>{riskLabel}</Badge>
            </div>
          )}

          <a href={`https://solscan.io/token/${tokenAddress}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-[#22d3ee] transition-colors">
            <ExternalLink className="h-3 w-3" /> View on Solscan
          </a>
        </div>
      )}
    </div>
  );
};
