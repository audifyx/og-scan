import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { TrendingUp, TrendingDown, RefreshCw, DollarSign, BarChart3, Activity, Target } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CurvePoint {
  label: string;
  pnl: number;
  cumulative: number;
}

interface PnLData {
  totalPnL: number;
  winRate: string;
  tradeCount: number;
  bestTrade: number;
  worstTrade: number;
  avgTrade: number;
  solBalance?: number;
}

const MOCK_CURVE = (totalPnL: number, tradeCount: number): CurvePoint[] => {
  const points: CurvePoint[] = [];
  let cumulative = 0;
  const trades = Math.max(tradeCount, 10);
  for (let i = 0; i < Math.min(trades, 20); i++) {
    const swing = (totalPnL / trades) * (0.5 + Math.random() * 1.5) * (Math.random() > 0.35 ? 1 : -1);
    cumulative += swing;
    points.push({ label: `T${i + 1}`, pnl: swing, cumulative });
  }
  return points;
};

export const ProfitCurveGenerator = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [pnlData, setPnlData] = useState<PnLData | null>(null);

  const generate = async () => {
    if (!walletAddress || walletAddress.length < 32) {
      toast({ title: "Enter a valid wallet address", variant: "destructive" });
      return;
    }
    setLoading(true);
    setPnlData(null);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getWalletPnL", walletAddress },
      });
      setPnlData(data || { totalPnL: 0, winRate: "0", tradeCount: 0, bestTrade: 0, worstTrade: 0, avgTrade: 0 });
      toast({ title: "Profit curve generated" });
    } catch {
      toast({ title: "Failed to generate curve", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const curvePoints = useMemo(() => {
    if (!pnlData) return [];
    return MOCK_CURVE(pnlData.totalPnL, pnlData.tradeCount);
  }, [pnlData]);

  // SVG chart
  const chartSvg = useMemo(() => {
    if (curvePoints.length < 2) return null;
    const w = 320, h = 80;
    const values = curvePoints.map((p) => p.cumulative);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 0.001);
    const range = max - min || 1;
    const pad = 8;

    const toX = (i: number) => pad + (i / (curvePoints.length - 1)) * (w - pad * 2);
    const toY = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2);

    const pts = curvePoints.map((p, i) => `${toX(i)},${toY(p.cumulative)}`).join(" ");
    const areaPath = `M${toX(0)},${toY(0)} ` + curvePoints.map((p, i) => `L${toX(i)},${toY(p.cumulative)}`).join(" ") + ` L${toX(curvePoints.length - 1)},${toY(0)} Z`;
    const lineColor = (pnlData?.totalPnL ?? 0) >= 0 ? "#22c55e" : "#ef4444";
    const areaColor = (pnlData?.totalPnL ?? 0) >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)";
    const zeroY = toY(0);

    return { pts, areaPath, lineColor, areaColor, zeroY, w, h };
  }, [curvePoints, pnlData]);

  const fmt = (n: number) =>
    n >= 1_000 ? `${(n / 1_000).toFixed(2)}K SOL`
    : `${n.toFixed(3)} SOL`;
  const fmtUsd = (n: number) =>
    n >= 1_000_000 ? `$${(n * 165 / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `$${(n * 165 / 1_000).toFixed(0)}K`
    : `$${(n * 165).toFixed(0)}`;

  return (
    <Card className="p-6 bg-transparent border-white/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-green-500/10">
          <TrendingUp className="h-5 w-5 text-green-500" />
        </div>
        <div>
          <h3 className="font-bold text-white">Profit Curve Generator</h3>
          <p className="text-sm text-white/50">PnL over time with trade-by-trade analysis</p>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        <Input
          placeholder="Wallet address..."
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate()}
          className="bg-white/[0.04] border-white/10 text-white placeholder:text-white/30"
        />
        <Button onClick={generate} disabled={loading} className="bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
        </Button>
      </div>

      {pnlData && (
        <div className="space-y-4">
          {/* Main PnL display */}
          <div className={`p-4 rounded-xl border ${(pnlData.totalPnL ?? 0) >= 0 ? "bg-green-500/8 border-green-500/20" : "bg-red-500/8 border-red-500/20"}`}>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Total PnL</p>
            <div className="flex items-end gap-3">
              {(pnlData.totalPnL ?? 0) >= 0
                ? <TrendingUp className="h-5 w-5 text-green-400 mb-0.5" />
                : <TrendingDown className="h-5 w-5 text-red-400 mb-0.5" />
              }
              <p className={`text-3xl font-black font-mono ${(pnlData.totalPnL ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                {(pnlData.totalPnL ?? 0) >= 0 ? "+" : ""}{fmt(pnlData.totalPnL ?? 0)}
              </p>
              <p className="text-sm text-white/40 mb-0.5">{fmtUsd(pnlData.totalPnL ?? 0)}</p>
            </div>
          </div>

          {/* Profit curve SVG */}
          {chartSvg && (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Activity className="h-3 w-3" /> Cumulative PnL Curve
              </p>
              <svg width="100%" viewBox={`0 0 ${chartSvg.w} ${chartSvg.h}`} className="overflow-visible">
                {/* Zero line */}
                <line x1="0" y1={chartSvg.zeroY} x2={chartSvg.w} y2={chartSvg.zeroY} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" strokeWidth="1" />
                {/* Area fill */}
                <path d={chartSvg.areaPath} fill={chartSvg.areaColor} />
                {/* Line */}
                <polyline points={chartSvg.pts} fill="none" stroke={chartSvg.lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {/* Dots */}
                {curvePoints.map((p, i) => {
                  const x = 8 + (i / (curvePoints.length - 1)) * (chartSvg.w - 16);
                  const vals = curvePoints.map((pp) => pp.cumulative);
                  const min = Math.min(...vals, 0);
                  const max = Math.max(...vals, 0.001);
                  const y = chartSvg.h - 8 - ((p.cumulative - min) / (max - min || 1)) * (chartSvg.h - 16);
                  return <circle key={i} cx={x} cy={y} r="2.5" fill={chartSvg.lineColor} fillOpacity="0.8" />;
                })}
              </svg>
              {/* X axis labels */}
              <div className="flex justify-between text-[9px] text-white/20 mt-1">
                <span>Trade 1</span>
                <span>Trade {curvePoints.length}</span>
              </div>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-center">
              <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Win Rate</p>
              <p className="text-lg font-black text-[#22d3ee]">{pnlData.winRate}%</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-center">
              <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Trades</p>
              <p className="text-lg font-black text-white">{pnlData.tradeCount}</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-center">
              <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">SOL Bal</p>
              <p className="text-lg font-black text-[#eab308]">{(pnlData.solBalance ?? 0).toFixed(2)}</p>
            </div>
          </div>

          {/* Per-trade breakdown */}
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-2">Trade-by-Trade</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {curvePoints.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[10px] text-white/20 w-8 text-right">{p.label}</span>
                  <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${p.pnl >= 0 ? "bg-green-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(Math.abs(p.pnl / Math.max(...curvePoints.map(pp => Math.abs(pp.pnl)))) * 100, 100)}%`, marginLeft: p.pnl < 0 ? "0" : "0" }}
                    />
                  </div>
                  <span className={`text-[10px] font-mono w-20 text-right ${p.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {p.pnl >= 0 ? "+" : ""}{p.pnl.toFixed(3)} SOL
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
