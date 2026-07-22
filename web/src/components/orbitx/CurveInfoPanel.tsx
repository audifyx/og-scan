// Holders (approximated from the ledger) + estimated creator earnings.
import { useMemo } from "react";
import { Coins, Users } from "lucide-react";
import type { ChainDef } from "@/lib/orbitx/chains";
import {
  aggregateHolders, creatorEarnings, fmtUnits, shortWallet, type CurveTradeRow,
} from "@/lib/orbitx/curveData";

export default function CurveInfoPanel({
  trades, chain, symbol, creatorFeeBps = 50, creatorWallet,
}: { trades: CurveTradeRow[]; chain: ChainDef; symbol?: string; creatorFeeBps?: number; creatorWallet?: string }) {
  const holders = useMemo(() => aggregateHolders(trades).slice(0, 10), [trades]);
  const earnings = useMemo(() => creatorEarnings(trades, creatorFeeBps), [trades, creatorFeeBps]);
  const totalHeld = useMemo(() => holders.reduce((a, h) => a + h.tokens, 0n), [holders]);

  return (
    <div className="lpx-panel space-y-4 p-4">
      <div className="flex items-center justify-between rounded-md border border-[hsl(var(--og-gold))]/20 bg-[hsl(var(--og-gold))]/5 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Coins className="h-4 w-4 text-[hsl(var(--og-gold))]" /> Creator earnings (est.)</span>
        <span className="font-mono text-sm">{fmtUnits(earnings, 18, 5)} {chain.symbol}</span>
      </div>
      <p className="-mt-2 text-[10px] text-muted-foreground/70">
        Creator fees are paid on-chain to {creatorWallet ? shortWallet(creatorWallet) : "the creator"} on every trade (auto-settled, nothing to claim). Estimated from the trade ledger.
      </p>

      <div>
        <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Top holders <span className="text-muted-foreground/60">(from ledger)</span>
        </div>
        {holders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No holders yet.</p>
        ) : (
          <div className="space-y-1">
            {holders.map((h) => {
              const pct = totalHeld > 0n ? Number((h.tokens * 10000n) / totalHeld) / 100 : 0;
              return (
                <div key={h.wallet} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-muted-foreground">{shortWallet(h.wallet)}</span>
                  <span className="font-mono">{fmtUnits(h.tokens, 18, 2)} {symbol ?? ""}</span>
                  <span className="w-12 text-right text-muted-foreground/70">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
