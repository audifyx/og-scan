import { useMemo, useState } from "react";
import { Calculator, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGE_MCAPS = [10_000, 25_000, 100_000, 500_000, 2_000_000];
const STAGE_NAMES = ["Sprout", "Whelp", "Guardian", "Titan", "Cosmic"];
const INITIAL_SUPPLY = 1_000_000_000;

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}

/** "What if" calculator — value of your bag at each evolution stage. */
export function WhatIf({ price, mcap, burned }: { price: number | null | undefined; mcap: number | null | undefined; burned: number | null }) {
  const [amount, setAmount] = useState("1000000");
  const [mode, setMode] = useState<"tokens" | "usd">("tokens");

  const tokens = useMemo(() => {
    const a = parseFloat(amount);
    if (!isFinite(a) || a <= 0) return 0;
    if (mode === "tokens") return a;
    if (price == null || price <= 0) return 0;
    return a / price;
  }, [amount, mode, price]);

  const supply = INITIAL_SUPPLY - (burned ?? 0);

  const rows = useMemo(() => {
    return STAGE_MCAPS.map((mc, i) => {
      const priceAt = mc / supply;
      const value = tokens * priceAt;
      const mult = mcap != null && mcap > 0 ? mc / mcap : 0;
      return { mc, name: STAGE_NAMES[i], priceAt, value, mult, reached: mcap != null && mcap >= mc };
    });
  }, [tokens, supply, mcap]);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-400/15 text-teal-300">
          <Calculator className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-extrabold">What-if calculator</p>
          <p className="text-[11px] text-white/45">Your bag at every evolution stage</p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <div className="flex rounded-xl border border-white/10 bg-black/40 p-0.5">
          {(["tokens", "usd"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-bold transition",
                mode === m ? "bg-teal-400/20 text-teal-200" : "text-white/40 hover:text-white/70")}
            >
              {m === "tokens" ? <Coins className="mr-1 inline h-3 w-3" /> : "$"} {m === "tokens" ? "Tokens" : "USD"}
            </button>
          ))}
        </div>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={mode === "tokens" ? "1,000,000" : "100"}
          inputMode="decimal"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm font-bold text-white placeholder:text-white/25 focus:border-teal-300/40 focus:outline-none"
        />
      </div>

      {tokens > 0 && (
        <div className="mt-3 space-y-1.5">
          {rows.map((r) => (
            <div
              key={r.name}
              className={cn("flex items-center justify-between rounded-xl px-3 py-2 text-xs transition",
                r.reached ? "bg-emerald-400/10 border border-emerald-300/20" : "bg-white/[0.03] border border-transparent")}
            >
              <span className="font-bold text-white/70">
                {r.reached ? "✅ " : ""}{r.name} <span className="font-normal text-white/35">({fmtUsd(r.mc)})</span>
              </span>
              <span className="text-right">
                <span className={cn("font-extrabold", r.reached ? "text-emerald-300" : "text-teal-200")}>{fmtUsd(r.value)}</span>
                <span className="ml-1.5 text-[10px] text-white/35">{r.mult >= 1 ? `${r.mult.toFixed(1)}x` : ""}</span>
              </span>
            </div>
          ))}
          <p className="pt-1 text-center text-[10px] text-white/30">
            {tokens >= 1_000_000 ? `${(tokens / 1_000_000).toFixed(2)}M` : tokens >= 1_000 ? `${(tokens / 1_000).toFixed(1)}k` : tokens.toFixed(0)} tokens · not financial advice
          </p>
        </div>
      )}
    </div>
  );
}
