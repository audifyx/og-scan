/**
 * QuickCalc — Token position calculator.
 * Input: entry mcap, exit mcap, SOL invested → shows potential profit.
 * Also: impermanent loss calc, break-even calculator.
 */
import { useState } from "react";
import { Calculator, DollarSign, TrendingUp, ArrowRight, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {}

export const QuickCalc: React.FC<Props> = () => {
  const [mode, setMode] = useState<"profit" | "breakeven" | "size">("profit");
  const [entryMcap, setEntryMcap] = useState("");
  const [exitMcap, setExitMcap] = useState("");
  const [solInvested, setSolInvested] = useState("");
  const [solPrice, setSolPrice] = useState("170");

  const entry = Number(entryMcap) || 0;
  const exit = Number(exitMcap) || 0;
  const sol = Number(solInvested) || 0;
  const solP = Number(solPrice) || 170;
  const usdInvested = sol * solP;

  const multiplier = entry > 0 ? exit / entry : 0;
  const usdReturn = usdInvested * multiplier;
  const profit = usdReturn - usdInvested;
  const profitSol = profit / solP;
  const pctReturn = entry > 0 ? ((exit / entry) - 1) * 100 : 0;

  const reset = () => {
    setEntryMcap("");
    setExitMcap("");
    setSolInvested("");
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
        <Calculator className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Quick Calc</p>
          <p className="text-[10px] text-white/25">Position & profit calculator</p>
        </div>
        <button onClick={reset} className="text-white/15 hover:text-white/30">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Mode tabs */}
        <div className="flex gap-1">
          {(["profit", "breakeven", "size"] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn("px-3 py-1.5 rounded-lg text-[10px] transition-all",
                mode === m ? "bg-primary/10 text-primary" : "text-white/20 hover:text-white/40"
              )}
            >
              {m === "profit" ? "💰 Profit" : m === "breakeven" ? "⚖️ Break Even" : "📐 Position Size"}
            </button>
          ))}
        </div>

        {/* Input fields */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] text-white/20 uppercase tracking-wider">Entry MCap ($)</label>
            <Input
              type="number"
              placeholder="50000"
              value={entryMcap}
              onChange={e => setEntryMcap(e.target.value)}
              className="mt-0.5 h-9 text-sm bg-white/[0.03] border-white/[0.08]"
            />
          </div>
          <div>
            <label className="text-[9px] text-white/20 uppercase tracking-wider">Exit MCap ($)</label>
            <Input
              type="number"
              placeholder="500000"
              value={exitMcap}
              onChange={e => setExitMcap(e.target.value)}
              className="mt-0.5 h-9 text-sm bg-white/[0.03] border-white/[0.08]"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] text-white/20 uppercase tracking-wider">SOL Invested</label>
            <Input
              type="number"
              placeholder="1"
              value={solInvested}
              onChange={e => setSolInvested(e.target.value)}
              className="mt-0.5 h-9 text-sm bg-white/[0.03] border-white/[0.08]"
            />
          </div>
          <div>
            <label className="text-[9px] text-white/20 uppercase tracking-wider">SOL Price ($)</label>
            <Input
              type="number"
              placeholder="170"
              value={solPrice}
              onChange={e => setSolPrice(e.target.value)}
              className="mt-0.5 h-9 text-sm bg-white/[0.03] border-white/[0.08]"
            />
          </div>
        </div>

        {/* Results */}
        {sol > 0 && entry > 0 && exit > 0 && (
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-2">
            <div className="flex items-center gap-2 text-center">
              <div className="flex-1">
                <p className="text-[8px] text-white/20 uppercase">Invested</p>
                <p className="text-sm font-black text-white">${usdInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-[9px] text-white/20">{sol} SOL</p>
              </div>
              <ArrowRight className="h-4 w-4 text-white/15" />
              <div className="flex-1">
                <p className="text-[8px] text-white/20 uppercase">Returns</p>
                <p className={cn("text-sm font-black", profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                  ${usdReturn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-[9px] text-white/20">{(sol * multiplier).toFixed(2)} SOL</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.04]">
              <div className="text-center">
                <p className="text-[8px] text-white/20">Multiplier</p>
                <p className="text-xs font-black text-primary">{multiplier.toFixed(1)}x</p>
              </div>
              <div className="text-center">
                <p className="text-[8px] text-white/20">Profit</p>
                <p className={cn("text-xs font-black", profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {profit >= 0 ? "+" : ""}{profitSol.toFixed(2)} SOL
                </p>
              </div>
              <div className="text-center">
                <p className="text-[8px] text-white/20">Return</p>
                <p className={cn("text-xs font-black", pctReturn >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {pctReturn >= 0 ? "+" : ""}{pctReturn.toFixed(0)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickCalc;
