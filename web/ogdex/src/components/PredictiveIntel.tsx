import { useMemo } from "react";
import { TokenDetailData, fmtUsd } from "../lib/api";
import { computePredictive } from "../lib/predict";
import { Brain, ShieldCheck, TrendingUp, Info, Check, AlertTriangle, Activity } from "lucide-react";

export default function PredictiveIntel({ d }: { d: TokenDetailData }) {
  const p = useMemo(() => computePredictive(d), [d]);
  const survColor = (v: number) => (v >= 0.7 ? "#16c784" : v >= 0.4 ? "#22d3a6" : v >= 0.15 ? "#f0b90b" : "#ea3943");
  const hazardTone = p.hazardLabel === "Low" ? "text-up" : p.hazardLabel === "Moderate" ? "text-accent" : p.hazardLabel === "High" ? "text-yellow-400" : "text-down";

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {/* Survival modeling */}
      <div className="card p-5">
        <div className="text-sm font-semibold mb-1 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-accent" /> Survival Modeling</div>
        <div className="text-xs text-muted mb-4">Probability the token remains active (liquidity intact, not rugged) over time, from an on-chain hazard model.</div>
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <div className="text-3xl font-bold" style={{ color: survColor(p.survivalScore / 100) }}>{p.survivalScore}<span className="text-base text-muted">/100</span></div>
            <div className="text-[11px] uppercase tracking-wide text-muted">30-day resilience</div>
          </div>
          <div className={`pill bg-panel2 ${hazardTone} font-semibold`}>Risk: {p.hazardLabel}</div>
        </div>
        <div className="space-y-3">
          {p.survival.map((s) => (
            <div key={s.days}>
              <div className="flex justify-between text-xs mb-1"><span className="text-muted">{s.days}-day survival</span><span className="font-semibold" style={{ color: survColor(s.prob) }}>{(s.prob * 100).toFixed(0)}%</span></div>
              <div className="h-2 rounded-full bg-panel2 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${s.prob * 100}%`, background: survColor(s.prob), transition: "width .6s" }} /></div>
            </div>
          ))}
        </div>
      </div>

      {/* Market-cap probability */}
      <div className="card p-5">
        <div className="text-sm font-semibold mb-1 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-accent" /> Market-Cap Probability</div>
        <div className="text-xs text-muted mb-4">Modeled odds of reaching a market-cap multiple within ~30 days, conditioned on survival.</div>
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <div className="text-3xl font-bold text-accent">{p.upsideScore}<span className="text-base text-muted">/100</span></div>
            <div className="text-[11px] uppercase tracking-wide text-muted">Growth potential</div>
          </div>
        </div>
        <div className="space-y-3">
          {p.upside.map((u) => (
            <div key={u.label}>
              <div className="flex justify-between text-xs mb-1"><span className="text-muted">Reach {u.label} market cap</span><span className="font-semibold text-white">{(u.prob * 100).toFixed(0)}%</span></div>
              <div className="h-2 rounded-full bg-panel2 overflow-hidden"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(u.prob * 100, 100)}%`, transition: "width .6s" }} /></div>
            </div>
          ))}
        </div>
        {p.expectedMcap30d.base != null && (
          <div className="mt-4 pt-4 border-t border-line">
            <div className="text-[11px] uppercase tracking-wide text-muted mb-2 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Projected 30d market cap</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Scenario label="Bear" value={fmtUsd(p.expectedMcap30d.low, { compact: true })} tone="text-down" />
              <Scenario label="Base" value={fmtUsd(p.expectedMcap30d.base, { compact: true })} tone="text-white" />
              <Scenario label="Bull" value={fmtUsd(p.expectedMcap30d.high, { compact: true })} tone="text-up" />
            </div>
          </div>
        )}
      </div>

      {/* Drivers */}
      <div className="card p-5 lg:col-span-2">
        <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Brain className="w-4 h-4 text-accent" /> Model Drivers
          <span className="ml-auto pill bg-panel2 text-muted text-[10px] capitalize">{p.confidence} confidence</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          {p.drivers.length ? p.drivers.map((dr, i) => (
            <div key={i} className="flex items-start gap-2 text-xs bg-panel2/50 rounded-lg px-3 py-2">
              <span className={`mt-0.5 shrink-0 ${dr.impact === "pos" ? "text-up" : dr.impact === "neg" ? "text-down" : "text-muted"}`}>
                {dr.impact === "pos" ? <Check className="w-3.5 h-3.5" /> : dr.impact === "neg" ? <AlertTriangle className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
              </span>
              <span><span className="text-white font-medium">{dr.label}</span><span className="text-muted"> — {dr.detail}</span></span>
            </div>
          )) : <div className="text-muted text-xs">Not enough on-chain data to model this token.</div>}
        </div>
        <div className="mt-4 flex items-start gap-2 text-[11px] text-muted">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Statistical estimates from current on-chain signals. Probabilistic, not guarantees, and not financial advice. Always do your own research.</span>
        </div>
      </div>
    </div>
  );
}

function Scenario({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="bg-panel2 rounded-lg py-2"><div className={`text-sm font-bold ${tone}`}>{value}</div><div className="text-[10px] uppercase tracking-wide text-muted">{label}</div></div>;
}
