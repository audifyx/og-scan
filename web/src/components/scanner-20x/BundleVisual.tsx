/**
 * BundleVisual — Bundle Detection Visual
 * Shows buy bundles as visual clusters. When multiple wallets buy within seconds,
 * draws them as connected groups with total bundle % of supply.
 *
 * Data comes from a live bundle scan (`BundleAnalysis` from @/crypto/bundle,
 * produced server-side by /api/ogdex/bundle). Pass `analysis` and the view
 * derives its clusters from it; the legacy `bundles` + `totalBundlePct`
 * props still work for callers that already have cluster data. When the
 * analysis state is "unknown" the card says so — it never claims "no
 * bundles" on missing data. A "partial" analysis is labeled as partial.
 */
import { useState, useMemo } from "react";
import { Zap, Users, Clock, AlertTriangle, ChevronDown, ChevronUp, Copy, Check, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { shortAddr } from "@/lib/og";
import { toast } from "sonner";
import { bundleToVisualData, type BundleAnalysis } from "@/crypto/bundle";

interface BundleWallet {
  address: string;
  buyAmount: number;
  buyTime: string;
  pctOfSupply: number;
}

interface BundleCluster {
  id: string;
  wallets: BundleWallet[];
  totalPctOfSupply: number;
  timeSpanSeconds: number;
  detectedAt: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  fundingSource: string | null;
}

interface Props {
  bundles: BundleCluster[];
  totalBundlePct: number;
  compact?: boolean;
  /**
   * Live scan result. When provided, clusters + total % come from it and the
   * card renders the honest unknown / partial states instead of guessing.
   */
  analysis?: BundleAnalysis | null;
}

// Theme: black / white / gold / silver (#e8b84a). Severity is gold intensity,
// never a rainbow of colors.
const riskColors = {
  low: "text-white/60 bg-white/[0.03] border-white/[0.08]",
  medium: "text-[#e8b84a] bg-[#e8b84a]/10 border-[#e8b84a]/25",
  high: "text-[#e8b84a] bg-[#e8b84a]/15 border-[#e8b84a]/40",
  critical: "text-white bg-[#e8b84a]/25 border-[#e8b84a]/60",
};

export const BundleVisual: React.FC<Props> = ({ bundles: bundlesProp, totalBundlePct: totalProp, compact = false, analysis = null }) => {
  const [expanded, setExpanded] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  // Live analysis wins over legacy props when provided.
  const derived = useMemo(
    () => (analysis ? bundleToVisualData(analysis) : null),
    [analysis],
  );
  const bundles = derived ? derived.bundles : bundlesProp;
  const totalBundlePct = derived ? derived.totalBundlePct : totalProp;
  const isUnknown = Boolean(analysis) && analysis?.state === "unknown";
  const isPartial = Boolean(analysis) && analysis?.state === "partial";
  const liveClusterById = useMemo(
    () => new Map((analysis?.clusters || []).map((c) => [c.id, c])),
    [analysis],
  );

  const severity = isUnknown ? "low" : totalBundlePct >= 30 ? "critical" : totalBundlePct >= 15 ? "high" : totalBundlePct >= 5 ? "medium" : "low";
  const severityLabel = isUnknown ? "Unknown" : severity === "critical" ? "Critical" : severity === "high" ? "High Risk" : severity === "medium" ? "Moderate" : "Clean";
  const rc = riskColors[severity];

  const copyAddr = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  if (isUnknown) {
    // Never claim "no bundles" on missing data — the scan did not run.
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
          <AlertTriangle className="h-3.5 w-3.5 text-white/60" />
        </div>
        <div>
          <p className="text-xs font-bold text-white/60">Bundle scan unavailable</p>
          <p className="text-[10px] text-white/60">{analysis?.reason || "The bundle scan did not return data — nothing is assumed clean."}</p>
        </div>
      </div>
    );
  }

  if (bundles.length === 0 && totalBundlePct === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#e8b84a]/10 border border-[#e8b84a]/25 flex items-center justify-center">
          <Zap className="h-3.5 w-3.5 text-[#e8b84a]" />
        </div>
        <div>
          <p className="text-xs font-bold text-white">No Bundles Detected</p>
          <p className="text-[10px] text-white/60">No coordinated buy patterns found</p>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <Badge className={cn("text-[9px] gap-1", rc)}>
        <Zap className="h-2.5 w-2.5" /> {totalBundlePct.toFixed(1)}% bundled · {bundles.length} cluster{bundles.length !== 1 ? "s" : ""}
      </Badge>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      {isPartial && (
        <div className="px-4 pt-3 pb-0 text-[11px] text-[#e8b84a]">
          Partial scan — some holders could not be traced. Bundled % is a lower bound, not a complete picture.
        </div>
      )}
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border", rc)}>
          <Zap className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold text-white">Bundle Detection</span>
            <Badge className={cn("text-[9px]", rc)}>{severityLabel}</Badge>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className={cn("font-bold", severity === "low" ? "text-white/80" : "text-[#e8b84a]")}>
              {totalBundlePct.toFixed(1)}% of supply in bundles
            </span>
            <span className="text-white/60">{bundles.length} cluster{bundles.length !== 1 ? "s" : ""}</span>
            <span className="text-white/15">{bundles.reduce((s, b) => s + b.wallets.length, 0)} wallets</span>
          </div>
        </div>

        {/* Visual indicator */}
        <div className="flex items-center gap-0.5">
          {bundles.slice(0, 5).map((b, i) => (
            <div
              key={b.id}
              className={cn(
                "rounded-full border",
                riskColors[b.riskLevel],
              )}
              style={{
                width: Math.max(12, Math.min(24, b.wallets.length * 6)),
                height: Math.max(12, Math.min(24, b.wallets.length * 6)),
              }}
              title={`${b.wallets.length} wallets · ${b.totalPctOfSupply.toFixed(1)}%`}
            />
          ))}
          {bundles.length > 5 && <span className="text-[9px] text-white/60">+{bundles.length - 5}</span>}
        </div>

        {expanded ? <ChevronUp className="h-4 w-4 text-white/60" /> : <ChevronDown className="h-4 w-4 text-white/60" />}
      </button>

      {/* Expanded clusters */}
      {expanded && (
        <div className="border-t border-white/[0.06] px-4 pb-4 pt-3 space-y-3">
          {bundles.map((cluster, ci) => {
            // Live cluster carries the kind + dev-link flags the legacy shape drops.
            const live = liveClusterById.get(cluster.id);
            const kindLabel = live
              ? live.kind === "funding+window"
                ? "funding + window"
                : live.kind
              : null;
            return (
            <div key={cluster.id} className={cn("rounded-lg border p-3", riskColors[cluster.riskLevel])}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-bold text-white">Cluster #{ci + 1}</span>
                {kindLabel && (
                  <Badge className="text-[8px] text-[#e8b84a] bg-[#e8b84a]/10 border-[#e8b84a]/25">
                    {kindLabel}
                  </Badge>
                )}
                <Badge className={cn("text-[8px]", riskColors[cluster.riskLevel])}>
                  {cluster.wallets.length} wallets · {cluster.totalPctOfSupply.toFixed(1)}% supply
                </Badge>
                <span className="text-[9px] opacity-50">
                  <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                  {cluster.timeSpanSeconds}s window
                </span>
                {cluster.fundingSource ? (
                  <span className="text-[9px] opacity-50">
                    Same funding: {shortAddr(cluster.fundingSource)}
                  </span>
                ) : (
                  <span className="text-[9px] text-white/60">Unlinked — no shared funding observed</span>
                )}
                {live?.devLinked && (
                  <span className="text-[9px] text-[#e8b84a]">dev-linked</span>
                )}
              </div>

              {/* Visual cluster — dots connected */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {cluster.wallets.map((w, wi) => (
                  <button
                    key={w.address}
                    onClick={() => copyAddr(w.address)}
                    className="group flex items-center gap-1 px-2 py-1 rounded-full bg-black/20 border border-white/[0.08] hover:border-white/[0.15] transition-all"
                    title={w.address}
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      w.pctOfSupply >= 5 ? "bg-[#e8b84a]" : w.pctOfSupply >= 1 ? "bg-white/70" : "bg-white/30"
                    )} />
                    <span className="text-[9px] font-mono opacity-60">{shortAddr(w.address)}</span>
                    <span className="text-[8px] opacity-40">{w.pctOfSupply.toFixed(1)}%</span>
                    {copiedAddr === w.address ? (
                      <Check className="h-2 w-2 text-[#e8b84a]" />
                    ) : (
                      <Copy className="h-2 w-2 opacity-0 group-hover:opacity-40" />
                    )}
                  </button>
                ))}
              </div>

              {/* Connection lines visual (ASCII art style) */}
              {cluster.fundingSource && (
                <div className="flex items-center gap-1 text-[9px] opacity-40 pl-2">
                  <span>└─</span>
                  <span>Common funding:</span>
                  <code className="font-mono">{shortAddr(cluster.fundingSource)}</code>
                  <a
                    href={`https://solscan.io/account/${cluster.fundingSource}`}
                    target="_blank"
                    rel="noopener"
                    className="hover:opacity-80"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BundleVisual;
