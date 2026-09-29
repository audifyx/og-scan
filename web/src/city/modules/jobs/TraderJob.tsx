/**
 * Day trader — work the exchange on REAL market data.
 * Uses the app's live-price hook (DexScreener) for SOL/ORBITX/BONK/JUP/WIF.
 * Paper portfolio only: open paper positions, close them, and bank the PnL
 * as paper CITY. Premium (real ORBITX leverage) waits on the tokenomics
 * billing primitives — never a parallel path.
 */
import { useMemo, useState } from "react";
import { useLivePrices } from "@/hooks/useLivePrices";
import type { JobMeta, JobProps } from "./types";
import { JobChrome, PremiumButton, StatRow } from "./JobChrome";
import { earnCity, addXp, jobLevel, levelPayScale, fmtCity, pushToast } from "./wallet";

export const TRADER_META: JobMeta = {
  id: "trader",
  name: "Day Trader",
  icon: "📈",
  tagline: "Work the exchange on live feeds.",
  payInfo: "Bank position PnL as CITY",
  premium: "Real-ORBITX funded margin",
  howTo: "Pick a token, set a paper position size, buy in — then sell when the chart moves. Profits land as CITY; losses just shrink the day's book.",
};

const TOKENS = [
  { sym: "SOL", mint: "So11111111111111111111111111111111111111112" },
  { sym: "ORBITX", mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9" },
  { sym: "BONK", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPBAA7" },
  { sym: "JUP", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" },
  { sym: "WIF", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcwiUd5R8ZEWHz5MCFG4rq" },
];

interface Position {
  sym: string;
  entry: number;
  notional: number;
  dir: 1 | -1;
  at: number;
}

const SIZES = [50, 200, 1000];

export default function TraderJob({ onEndShift }: JobProps) {
  const mints = useMemo(() => TOKENS.map((t) => t.mint), []);
  const { prices, connected } = useLivePrices(mints, 10_000);
  const [sym, setSym] = useState("SOL");
  const [sizeIdx, setSizeIdx] = useState(1);
  const [dir, setDir] = useState<1 | -1>(1);
  const [pos, setPos] = useState<Position | null>(null);
  const [closed, setClosed] = useState(0);

  const live = prices[TOKENS.find((t) => t.sym === sym)!.mint];

  const open = () => {
    if (!live || live.price <= 0) {
      pushToast("No live price yet — wait for the feed", "warn");
      return;
    }
    if (pos) {
      pushToast("Close your position first", "warn");
      return;
    }
    setPos({ sym, entry: live.price, notional: SIZES[sizeIdx], dir, at: Date.now() });
    pushToast(`${dir === 1 ? "LONG" : "SHORT"} ${sym} @ ${live.price.toFixed(4)}`, "info");
  };

  const close = () => {
    if (!pos || !live || live.price <= 0) return;
    const move = (live.price - pos.entry) / pos.entry;
    const pnl = pos.dir * move * pos.notional;
    if (pnl >= 0) {
      earnCity(pnl * levelPayScale("trader"), `${pos.sym} ${pos.dir === 1 ? "long" : "short"} closed`);
      const { leveled } = addXp("trader", 20);
      if (leveled) pushToast("Trader level up!", "info");
    } else {
      pushToast(`${pos.sym} stopped out ${fmtCity(Math.abs(pnl))}`, "warn");
      addXp("trader", 8);
    }
    setClosed((n) => n + pnl);
    setPos(null);
  };

  const posPnl = pos && live && live.price > 0 ? pos.dir * ((live.price - pos.entry) / pos.entry) * pos.notional : 0;

  return (
    <JobChrome meta={TRADER_META} status={connected ? "🟢 Live feed" : "🟡 Connecting feed…"} onEnd={onEndShift}>
      <StatRow label="Trader level" value={jobLevel("trader")} />
      <StatRow label="Day PnL (CITY)" value={fmtCity(closed)} accent={closed >= 0} />
      <div className="oj-row">
        {TOKENS.map((t) => {
          const p = prices[t.mint];
          const ch = p?.priceChange24h ?? 0;
          return (
            <button
              key={t.sym}
              className={`oj-btn small ${sym === t.sym ? "primary" : ""}`}
              onClick={() => setSym(t.sym)}
              disabled={!!pos}
            >
              {t.sym}{" "}
              <span className={ch >= 0 ? "oj-trade-up" : "oj-trade-down"}>
                {p && p.price > 0 ? `$${p.price < 1 ? p.price.toFixed(4) : p.price.toFixed(2)}` : "—"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="oj-row">
        <button className={`oj-btn small ${dir === 1 ? "primary" : ""}`} onClick={() => setDir(1)} disabled={!!pos}>
          LONG
        </button>
        <button className={`oj-btn small ${dir === -1 ? "primary" : ""}`} onClick={() => setDir(-1)} disabled={!!pos}>
          SHORT
        </button>
        <button className="oj-btn small" onClick={() => setSizeIdx((i) => (i + 1) % SIZES.length)} disabled={!!pos}>
          ${SIZES[sizeIdx]}
        </button>
      </div>
      {!pos ? (
        <button className="oj-btn primary" onClick={open}>
          Open {dir === 1 ? "long" : "short"} {sym} · ${SIZES[sizeIdx]}
        </button>
      ) : (
        <>
          <StatRow label="Position" value={`${pos.dir === 1 ? "LONG" : "SHORT"} ${pos.sym} @ ${pos.entry.toFixed(4)}`} />
          <StatRow label="Open PnL" value={fmtCity(posPnl)} accent={posPnl >= 0} />
          <button className="oj-btn primary" onClick={close}>
            Close & bank PnL
          </button>
        </>
      )}
      <div className="oj-hint">Paper positions on real DexScreener data. Profits bank as CITY; losses just hurt the ego.</div>
      <PremiumButton label="Real margin" />
    </JobChrome>
  );
}
