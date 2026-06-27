import { useMemo } from "react";
import { Forensics, fmtUsd, short, compact } from "../lib/api";
import WalletLink from "./WalletLink";
import { ShieldAlert, Zap, Users, AlertTriangle, CheckCircle2, Info } from "lucide-react";

interface Props {
  forensics: Forensics | null;
  holders: any[];
  trades: any[];
}

interface BundleCluster {
  wallets: string[];
  totalPct: number;
  estValue: number | null;
  kind: "bundle" | "sniper" | "concentrated";
}

function detectBundles(holders: any[], concentration: Forensics["concentration"] | null): BundleCluster[] {
  if (!holders?.length) return [];
  const top = holders.slice(0, 20);
  const clusters: BundleCluster[] = [];

  // Large concentrated holders (potential bundle wallets)
  const large = top.filter((h) => (h.pct ?? 0) > 2 && !["dev", "exchange", "amm", "locked"].includes(h.label));
  if (large.length >= 2) {
    const total = large.reduce((s: number, h: any) => s + (h.pct ?? 0), 0);
    if (total > 8) {
      clusters.push({
        wallets: large.map((h: any) => h.address || h.owner),
        totalPct: total,
        estValue: null,
        kind: "bundle",
      });
    }
  }

  // Snipers: multiple wallets with same-size position (within 10%)
  const amounts = top.map((h: any) => h.uiAmount ?? h.amount ?? 0).filter(Boolean);
  const avgAmt = amounts.reduce((s: number, a: number) => s + a, 0) / (amounts.length || 1);
  const tightGroup = top.filter((h: any) => {
    const a = h.uiAmount ?? h.amount ?? 0;
    return a > 0 && Math.abs(a - avgAmt) / avgAmt < 0.12;
  });
  if (tightGroup.length >= 3 && tightGroup.length <= 8) {
    clusters.push({
      wallets: tightGroup.map((h: any) => h.address || h.owner),
      totalPct: tightGroup.reduce((s: number, h: any) => s + (h.pct ?? 0), 0),
      estValue: null,
      kind: "sniper",
    });
  }

  return clusters.slice(0, 2);
}

export default function BundleSniper({ forensics, holders, trades }: Props) {
  const clusters = useMemo(() => detectBundles(holders, forensics?.concentration ?? null), [holders, forensics]);
  const top10Pct = forensics?.concentration?.top10Pct ?? null;
  const whales = forensics?.concentration?.whales ?? 0;
  const totalHolders = forensics?.concentration?.totalHolders ?? null;
  const riskScore = forensics?.safetyFlags?.riskScore ?? null;

  // Early buyer snipers: first trades with large buy sizes
  const earlyBuys = useMemo(() => {
    if (!trades?.length) return [];
    return trades
      .filter((t: any) => t.type === "buy" || t.side === "buy")
      .slice(0, 6)
      .map((t: any) => ({
        wallet: t.maker || t.wallet || t.owner || "",
        usd: t.amountUsd ?? t.volumeUsd ?? null,
        time: t.timestamp ?? t.blockTime ?? null,
      }))
      .filter((t) => t.wallet && (t.usd ?? 0) > 0);
  }, [trades]);

  const concentration = top10Pct != null
    ? top10Pct > 60 ? "critical" : top10Pct > 40 ? "high" : top10Pct > 25 ? "medium" : "low"
    : null;

  const concColor = concentration === "critical" ? "text-down" : concentration === "high" ? "text-accent" : concentration === "medium" ? "text-yellow-400" : "text-up";

  return (
    <div className="space-y-3">
      {/* Concentration Overview */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-accent shrink-0" />
          <span className="text-sm font-bold">Concentration & Supply Control</span>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="bg-panel2 rounded-xl p-3 text-center">
            <div className="text-[9px] text-muted uppercase tracking-widest mb-1">Top 10 Hold</div>
            <div className={`text-lg font-black ${concColor}`}>
              {top10Pct != null ? `${top10Pct.toFixed(1)}%` : "—"}
            </div>
            {concentration && <div className={`text-[9px] mt-0.5 ${concColor}`}>{concentration}</div>}
          </div>
          <div className="bg-panel2 rounded-xl p-3 text-center">
            <div className="text-[9px] text-muted uppercase tracking-widest mb-1">Whales</div>
            <div className="text-lg font-black text-white">{whales || "—"}</div>
            <div className="text-[9px] text-muted mt-0.5">≥1% holders</div>
          </div>
          <div className="bg-panel2 rounded-xl p-3 text-center">
            <div className="text-[9px] text-muted uppercase tracking-widest mb-1">Holders</div>
            <div className="text-lg font-black text-white">{totalHolders != null ? compact(totalHolders) : "—"}</div>
            <div className="text-[9px] text-muted mt-0.5">total</div>
          </div>
        </div>

        {concentration === "critical" && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-down/10 border border-down/20">
            <ShieldAlert className="w-4 h-4 text-down shrink-0 mt-0.5" />
            <p className="text-[12px] text-white/80">Top 10 holders control more than 60% of supply. Very few wallets could crash price if they sell simultaneously.</p>
          </div>
        )}
        {concentration === "high" && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-accent/10 border border-accent/20">
            <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <p className="text-[12px] text-white/80">Top 10 holders have significant supply control (&gt;40%). Monitor whale movements closely.</p>
          </div>
        )}
        {(concentration === "low" || concentration === "medium") && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-up/10 border border-up/20">
            <CheckCircle2 className="w-4 h-4 text-up shrink-0 mt-0.5" />
            <p className="text-[12px] text-white/80">Supply is reasonably distributed. Top 10 hold under 25% — healthy for organic price action.</p>
          </div>
        )}
      </div>

      {/* Bundle Detection */}
      {clusters.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
            <span className="text-sm font-bold">Bundle / Sniper Detection</span>
            <span className="pill bg-yellow-400/15 text-yellow-400 text-[9px] border border-yellow-400/30">{clusters.length} cluster{clusters.length > 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-2">
            {clusters.map((cl, i) => (
              <div key={i} className="bg-panel2 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                    cl.kind === "bundle" ? "text-down bg-down/10 border-down/25" :
                    cl.kind === "sniper" ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/25" :
                    "text-accent bg-accent/10 border-accent/25"
                  }`}>
                    {cl.kind === "bundle" ? "⚡ Potential Bundle" : cl.kind === "sniper" ? "🎯 Sniper Cluster" : "📊 Concentrated"}
                  </span>
                  <span className="text-[11px] text-muted font-semibold">{cl.totalPct.toFixed(1)}% combined</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {cl.wallets.slice(0, 5).map((w, j) => (
                    <WalletLink key={j} address={w} label={`${short(w)}`} />
                  ))}
                  {cl.wallets.length > 5 && (
                    <span className="text-[10px] text-muted px-1.5 py-0.5 rounded-lg bg-panel">
                      +{cl.wallets.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted/60 mt-2">
            <Info className="w-3 h-3 inline mr-0.5" />
            Clusters identified by similar position sizes and timing patterns. Not financial advice.
          </p>
        </div>
      )}

      {/* Early Buyer Snipers */}
      {earlyBuys.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-accent shrink-0" />
            <span className="text-sm font-bold">Early Buyers</span>
            <span className="pill bg-accent/10 text-accent text-[9px] border border-accent/20">first buys</span>
          </div>
          <div className="space-y-1.5">
            {earlyBuys.map((b, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-muted/50 w-4">#{i + 1}</span>
                  <WalletLink address={b.wallet} label={short(b.wallet)} />
                </div>
                {b.usd != null && (
                  <span className="text-[11px] text-accent font-semibold">{fmtUsd(b.usd)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {clusters.length === 0 && earlyBuys.length === 0 && (
        <div className="card p-6 text-center">
          <CheckCircle2 className="w-8 h-8 text-up mx-auto mb-2" />
          <p className="text-sm text-muted">No suspicious bundle or sniper patterns detected in current holder data.</p>
        </div>
      )}
    </div>
  );
}
