import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, RefreshCw, Check, X, ExternalLink, AlertTriangle, ShieldCheck, ShieldX } from "lucide-react";
import { toast } from "sonner";

interface TokenMeta {
  name: string;
  symbol: string;
  decimals: number;
  supply: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  isMutable: boolean;
  top10Percent: number;
  riskScore: number;
  priceUsd?: number;
  mcap?: number;
}

export const TokenMetadataInspector = () => {
  const [tokenAddress, setTokenAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<TokenMeta | null>(null);

  const inspect = async () => {
    const mint = tokenAddress.trim();
    if (!mint) {
      toast.error("Enter a token address");
      return;
    }
    setLoading(true);
    setMeta(null);
    try {
      // Fetch token detail + safety in parallel from the real backend
      const [tokenRes, safetyRes] = await Promise.all([
        fetch(`/api/ogdex/token?mint=${encodeURIComponent(mint)}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/ogdex/safety?mint=${encodeURIComponent(mint)}`).then((r) => r.json()).catch(() => null),
      ]);

      const t = tokenRes?.token || tokenRes || {};
      const s = safetyRes?.safety || safetyRes || {};

      // Extract authorities from token data
      const mintAuth = t.mintAuthority ?? t.mint_authority ?? null;
      const freezeAuth = t.freezeAuthority ?? t.freeze_authority ?? null;
      // null/empty means renounced (safe)
      const mintRenounced = !mintAuth || mintAuth === "11111111111111111111111111111111";
      const freezeRenounced = !freezeAuth || freezeAuth === "11111111111111111111111111111111";

      const top10 = Number(s.topHoldersPct ?? s.top10Pct ?? t.top10Percent ?? 0);

      // Compute risk score: 0=safe, 100=dangerous
      let risk = 0;
      if (!mintRenounced) risk += 30;
      if (!freezeRenounced) risk += 25;
      if (top10 > 50) risk += 25;
      else if (top10 > 30) risk += 15;
      if (s.canSell === false) risk += 20;
      if (t.isMutable ?? s.mutable) risk += 10;
      risk = Math.min(100, risk);

      setMeta({
        name: t.name || t.baseToken?.name || "Unknown",
        symbol: t.symbol || t.baseToken?.symbol || "???",
        decimals: t.decimals ?? 9,
        supply: t.supply ? Number(t.supply).toLocaleString() : "N/A",
        mintAuthority: mintRenounced ? null : mintAuth,
        freezeAuthority: freezeRenounced ? null : freezeAuth,
        isMutable: !!(t.isMutable ?? s.mutable ?? true),
        top10Percent: top10,
        riskScore: risk,
        priceUsd: Number(t.priceUsd || t.price || 0),
        mcap: Number(t.mcap || t.marketCap || t.fdv || 0),
      });
      toast.success("Inspection complete");
    } catch (e) {
      console.error("inspect error:", e);
      toast.error("Failed to inspect token");
    } finally {
      setLoading(false);
    }
  };

  const riskColor = !meta ? "" : meta.riskScore > 70 ? "text-red-400" : meta.riskScore > 40 ? "text-yellow-400" : "text-green-400";
  const riskBg = !meta ? "" : meta.riskScore > 70 ? "bg-red-500/10 border-red-500/30" : meta.riskScore > 40 ? "bg-yellow-500/10 border-yellow-500/30" : "bg-green-500/10 border-green-500/30";
  const riskLabel = !meta ? "" : meta.riskScore > 70 ? "HIGH RISK" : meta.riskScore > 40 ? "MEDIUM RISK" : "LOW RISK";

  return (
    <div className="rounded-2xl border border-white/20 bg-black/60 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25">
          <FileText className="h-5 w-5 text-cyan-300" />
        </div>
        <div>
          <h3 className="font-bold text-white">Token Metadata Inspector</h3>
          <p className="text-xs text-white/60">SPL token details, authorities, freeze status</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Enter token address..."
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void inspect(); }}
          className="flex-1 font-mono text-xs bg-black/40 border-white/20 text-white placeholder:text-white/30"
        />
        <Button
          onClick={() => void inspect()}
          disabled={loading || !tokenAddress.trim()}
          className="shrink-0 bg-white text-black hover:bg-white/90 font-bold"
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Inspect
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 gap-2 text-white/60">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-sm">Fetching on-chain data…</span>
        </div>
      )}

      {meta && !loading && (
        <div className="space-y-3">
          {/* Token identity */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Name", val: meta.name },
              { label: "Symbol", val: meta.symbol },
              { label: "Decimals", val: String(meta.decimals) },
              { label: "Total Supply", val: meta.supply },
            ].map((f) => (
              <div key={f.label} className="p-3 rounded-xl bg-white/[0.06] border border-white/15">
                <p className="text-[10px] uppercase tracking-widest text-white/60 mb-1">{f.label}</p>
                <p className="text-sm font-bold text-white truncate">{f.val}</p>
              </div>
            ))}
          </div>

          {meta.priceUsd ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-white/[0.06] border border-white/15">
                <p className="text-[10px] uppercase tracking-widest text-white/60 mb-1">Price</p>
                <p className="text-sm font-bold text-white">${meta.priceUsd.toFixed(6)}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.06] border border-white/15">
                <p className="text-[10px] uppercase tracking-widest text-white/60 mb-1">Market Cap</p>
                <p className="text-sm font-bold text-white">
                  ${meta.mcap && meta.mcap >= 1e6 ? `${(meta.mcap / 1e6).toFixed(2)}M` : meta.mcap && meta.mcap >= 1e3 ? `${(meta.mcap / 1e3).toFixed(1)}K` : (meta.mcap || 0).toFixed(0)}
                </p>
              </div>
            </div>
          ) : null}

          {/* Authority flags */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/60 mb-2">Security Flags</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Mint Authority", safe: !meta.mintAuthority, detail: meta.mintAuthority ? "Active" : "Renounced" },
                { label: "Freeze Authority", safe: !meta.freezeAuthority, detail: meta.freezeAuthority ? "Active" : "Renounced" },
                { label: "Mutable Metadata", safe: !meta.isMutable, detail: meta.isMutable ? "Yes" : "No" },
                { label: "Top10 Concentration", safe: meta.top10Percent <= 50, detail: `${meta.top10Percent.toFixed(1)}%` },
              ].map((flag) => (
                <div
                  key={flag.label}
                  className={`flex items-center gap-2 p-3 rounded-xl border ${
                    flag.safe ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"
                  }`}
                >
                  {flag.safe ? (
                    <Check className="h-4 w-4 text-emerald-300 shrink-0" />
                  ) : (
                    <X className="h-4 w-4 text-red-300 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className={`text-xs font-bold ${flag.safe ? "text-emerald-200" : "text-red-200"}`}>{flag.label}</p>
                    <p className="text-[11px] text-white/60 truncate">{flag.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Risk score */}
          <div className={`p-4 rounded-2xl border ${riskBg} flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              {meta.riskScore > 70 ? (
                <ShieldX className="h-8 w-8 text-red-300" />
              ) : meta.riskScore > 40 ? (
                <AlertTriangle className="h-8 w-8 text-yellow-300" />
              ) : (
                <ShieldCheck className="h-8 w-8 text-emerald-300" />
              )}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/60">Risk Score</p>
                <p className={`text-2xl font-black ${riskColor}`}>
                  {meta.riskScore}
                  <span className="text-sm font-normal text-white/40">/100</span>
                </p>
              </div>
            </div>
            <Badge className={`${riskBg} ${riskColor} font-bold`}>{riskLabel}</Badge>
          </div>

          <a
            href={`https://solscan.io/token/${tokenAddress.trim()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-white/60 hover:text-cyan-300 transition-colors"
          >
            <ExternalLink className="h-3 w-3" /> View on Solscan
          </a>
        </div>
      )}
    </div>
  );
};
