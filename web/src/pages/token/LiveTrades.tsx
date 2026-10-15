import { ArrowDownRight, ArrowUpRight, ExternalLink, Radio } from "lucide-react";
import { shortSig, timeAgo, useRpcTrades, type RpcTrade } from "./rpcFeed";
import { cn } from "@/lib/utils";

function TradeRow({ t }: { t: RpcTrade }) {
  const isBuy = t.side === "BUY";
  const isSell = t.side === "SELL";
  return (
    <a
      href={`https://solscan.io/tx/${t.signature}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.06]"
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          isBuy && "bg-emerald-500/20 text-emerald-300",
          isSell && "bg-rose-500/20 text-rose-300",
          !isBuy && !isSell && "bg-white/10 text-white/50",
        )}
      >
        {isBuy ? <ArrowUpRight className="h-5 w-5" /> : isSell ? <ArrowDownRight className="h-5 w-5" /> : <Radio className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">
          <span className={cn(isBuy ? "text-emerald-300" : isSell ? "text-rose-300" : "text-white/70")}>
            {t.side}
          </span>{" "}
          <span className="text-white/85">{t.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} ORBITX</span>
        </p>
        <p className="truncate font-mono text-[11px] text-white/40">
          {shortSig(t.wallet)} · {t.solAmount > 0 ? `${t.solAmount.toFixed(4)} SOL` : "—"} · {timeAgo(t.timestamp)}
        </p>
      </div>
      <ExternalLink className="h-4 w-4 shrink-0 text-white/30" />
    </a>
  );
}

export function LiveTrades({ mint }: { mint: string }) {
  const { trades, loading, error, refresh } = useRpcTrades(mint, 15, 20000);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-extrabold">Live trades</h3>
          <p className="text-xs text-white/40">Every fill on the official mint, as it happens.</p>
        </div>
        <button
          onClick={() => void refresh()}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/10"
        >
          Refresh
        </button>
      </div>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />)}
        </div>
      ) : error && trades.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-sm font-semibold text-white/60">Feed temporarily unavailable</p>
          <p className="mt-1 text-xs text-white/35">{error} — retrying automatically.</p>
        </div>
      ) : trades.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-sm font-semibold text-white/60">No recent trades</p>
          <p className="mt-1 text-xs text-white/35">New fills appear here live.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trades.map((t) => <TradeRow key={t.signature} t={t} />)}
        </div>
      )}
    </div>
  );
}
