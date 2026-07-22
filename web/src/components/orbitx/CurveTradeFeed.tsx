// Realtime trade feed for a curve token (Supabase realtime + polling fallback).
import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ExternalLink } from "lucide-react";
import { explorerTxUrl, type ChainDef } from "@/lib/orbitx/chains";
import {
  listCurveTrades, subscribeCurveTrades, fmtUnits, shortWallet, type CurveTradeRow,
} from "@/lib/orbitx/curveData";

export default function CurveTradeFeed({
  token, chain, symbol, onTrades,
}: { token: string; chain: ChainDef; symbol?: string; onTrades?: (t: CurveTradeRow[]) => void }) {
  const [trades, setTrades] = useState<CurveTradeRow[]>([]);

  useEffect(() => {
    let on = true;
    const load = async () => {
      const rows = await listCurveTrades(token, 50);
      if (!on) return;
      setTrades(rows);
      onTrades?.(rows);
    };
    load();
    const unsub = subscribeCurveTrades(token, () => load());
    const poll = setInterval(load, 8000); // fallback if realtime isn't enabled
    return () => { on = false; unsub(); clearInterval(poll); };
  }, [token, onTrades]);

  const recent = [...trades].reverse().slice(0, 20);

  return (
    <div className="lpx-panel p-4">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Live trades</div>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">No trades yet.</p>
      ) : (
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {recent.map((t) => {
            const buy = t.side === "buy";
            return (
              <div key={t.id ?? t.tx_hash} className="flex items-center justify-between rounded-md border border-white/5 px-2 py-1 text-xs">
                <span className={`inline-flex items-center gap-1 font-bold ${buy ? "text-[hsl(var(--og-lime))]" : "text-red-400"}`}>
                  {buy ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {buy ? "Buy" : "Sell"}
                </span>
                <span className="font-mono text-muted-foreground">{fmtUnits(BigInt(t.token_amount), 18, 2)} {symbol ?? ""}</span>
                <span className="font-mono">{fmtUnits(BigInt(t.native_amount), 18, 4)} {chain.symbol}</span>
                <span className="text-muted-foreground/70">{shortWallet(t.trader_wallet)}</span>
                <a href={explorerTxUrl(chain, t.tx_hash)} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
