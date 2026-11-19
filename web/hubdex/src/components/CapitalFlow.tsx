import { useMemo } from "react";
import { TokenDetailData, fmtUsd, compact, short } from "../lib/api";
import { computeCapitalFlow } from "../lib/predict";
import { timeAgo } from "../lib/format";
import WalletLink from "./WalletLink";
import { Banknote, ArrowDownRight, ArrowUpRight, Crown, Waves } from "lucide-react";

export default function CapitalFlow({ d }: { d: TokenDetailData }) {
  const f = useMemo(() => computeCapitalFlow(d), [d]);
  const scoreColor = f.smartScore >= 60 ? "#16c784" : f.smartScore <= 40 ? "#ea3943" : "#f0b90b";

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {/* Smart-money summary */}
      <div className="card p-5">
        <div className="text-sm font-semibold mb-1 flex items-center gap-2"><Waves className="w-4 h-4 text-accent" /> Capital Flow</div>
        <div className="text-xs text-muted mb-4">Net capital direction and smart-money posture from 24h volume and the live trade feed.</div>
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <div className="text-3xl font-bold" style={{ color: scoreColor }}>{f.smartScore}<span className="text-base text-muted">/100</span></div>
            <div className="text-[11px] uppercase tracking-wide text-muted">Accumulation index</div>
          </div>
          <div className="pill font-semibold" style={{ background: scoreColor + "26", color: scoreColor }}>{f.flowLabel}</div>
        </div>
        {f.buyPct != null && (
          <>
            <div className="text-xs text-muted mb-1 flex justify-between"><span>Buy / sell pressure (24h)</span><span>{f.buyPct.toFixed(0)}% buys</span></div>
            <div className="h-2.5 rounded-full overflow-hidden flex bg-panel2 mb-4"><div className="bg-up h-full" style={{ width: `${f.buyPct}%` }} /><div className="bg-down h-full" style={{ width: `${100 - f.buyPct}%` }} /></div>
          </>
        )}
        <div className="space-y-1.5">
          {f.metrics.map((m, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-line/40 last:border-0 text-sm">
              <span className="text-muted">{m.label}</span>
              <span className={`font-medium ${m.tone === "pos" ? "text-up" : m.tone === "neg" ? "text-down" : ""}`}>{m.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Whale wallets */}
      <div className="card p-5">
        <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Crown className="w-4 h-4 text-accent" /> Whale & Large Holders</div>
        {f.whales.length ? (
          <div className="space-y-2">
            {f.whales.map((w, i) => (
              <div key={i} className="flex items-center justify-between bg-panel2/50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2"><span className={`pill text-[10px] ${w.label === "whale" ? "bg-down/15 text-down" : "bg-yellow-500/15 text-yellow-400"}`}>{w.label}</span><WalletLink address={w.owner} className="text-xs" /></div>
                <div className="text-right"><div className="text-sm font-semibold">{w.pct.toFixed(2)}%</div>{w.usd != null && <div className="text-[10px] text-muted">{fmtUsd(w.usd, { compact: true })}</div>}</div>
              </div>
            ))}
          </div>
        ) : <div className="text-muted text-sm">No whale-sized wallets detected — broad distribution.</div>}
      </div>

      {/* Largest recent flows */}
      <div className="card p-5 lg:col-span-2">
        <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Banknote className="w-4 h-4 text-accent" /> Largest Recent Trades <span className="text-muted font-normal text-xs">({f.recentBuys} buys / {f.recentSells} sells in feed)</span></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <FlowList title="Top buys" tone="up" trades={f.topBuys} icon={<ArrowUpRight className="w-3.5 h-3.5 text-up" />} />
          <FlowList title="Top sells" tone="down" trades={f.topSells} icon={<ArrowDownRight className="w-3.5 h-3.5 text-down" />} />
        </div>
      </div>
    </div>
  );
}

function FlowList({ title, tone, trades, icon }: { title: string; tone: "up" | "down"; trades: any[]; icon: any }) {
  return (
    <div>
      <div className="text-xs text-muted mb-2 flex items-center gap-1.5">{icon} {title}</div>
      {trades.length ? (
        <div className="space-y-1.5">
          {trades.map((t, i) => (
            <div key={i} className="flex items-center justify-between text-sm bg-panel2/40 rounded-lg px-3 py-1.5">
              <span className={`font-semibold ${tone === "up" ? "text-up" : "text-down"}`}>{fmtUsd(t.volumeUsd, { compact: true })}</span>
              <span className="text-xs text-muted">{t.owner ? <WalletLink address={t.owner} icon={false} /> : "—"}</span>
              <span className="text-xs text-muted">{t.time ? timeAgo(t.time) + " ago" : "—"}</span>
            </div>
          ))}
        </div>
      ) : <div className="text-muted text-xs">No data.</div>}
    </div>
  );
}
