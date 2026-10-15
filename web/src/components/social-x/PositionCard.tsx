/**
 * PositionCard — a post that IS a position.
 * `[pos:long:<mint>]` / `[pos:short:<mint>]` markers render as a live P&L card:
 * direction, locked entry (15m candle at post time), live price, running P&L,
 * and a one-tap Mirror button. You can't lie about a position here.
 */
import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Loader2 } from "lucide-react";
import { fetchEntryPrice, fetchTokenQuote } from "./social-trade";
import TokenAvatar from "../../trade/TokenAvatar";
import { cn } from "@/lib/utils";

export type PosDirection = "long" | "short";

interface PositionCardProps {
  mint: string;
  direction: PosDirection;
  postIso: string;
  onMirror: (mint: string, symbol: string, direction: PosDirection) => void;
  onOpenToken: (mint: string) => void;
}

const fmt = (v: number | null) => {
  if (v == null) return "—";
  if (v === 0) return "$0";
  if (v < 0.0001) return "$" + v.toExponential(1);
  if (v < 1) return "$" + v.toFixed(4);
  return "$" + v.toLocaleString(undefined, { maximumFractionDigits: v < 100 ? 2 : 0 });
};

export default function PositionCard({ mint, direction, postIso, onMirror, onOpenToken }: PositionCardProps) {
  const [entry, setEntry] = useState<number | null>(null);
  const [quote, setQuote] = useState<{ price: number | null; symbol: string | null; icon: string | null }>({ price: null, symbol: null, icon: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    setLoading(true);
    Promise.all([fetchEntryPrice(mint, postIso), fetchTokenQuote(mint)])
      .then(([e, q]) => {
        if (!on) return;
        setEntry(e);
        setQuote({ price: q?.priceUsd ?? null, symbol: q?.symbol ?? null, icon: q?.icon ?? null });
        setLoading(false);
      })
      .catch(() => { if (on) setLoading(false); });
    const id = setInterval(() => {
      fetchTokenQuote(mint).then((q) => {
        if (on && q) setQuote((prev) => ({ ...prev, price: q.priceUsd ?? prev.price }));
      }).catch(() => {});
    }, 30_000);
    return () => { on = false; clearInterval(id); };
  }, [mint, postIso]);

  const isLong = direction === "long";
  const sym = quote.symbol || mint.slice(0, 4);
  const pnl = entry != null && entry > 0 && quote.price != null
    ? ((isLong ? quote.price - entry : entry - quote.price) / entry) * 100
    : null;
  const winning = pnl != null && pnl >= 0;

  return (
    <div className={cn("osc-pos", isLong ? "osc-pos--long" : "osc-pos--short")}>
      <div className="osc-pos__head">
        <span className={cn("osc-pos__dir", isLong ? "osc-pos__dir--long" : "osc-pos__dir--short")}>
          {isLong ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {isLong ? "LONG" : "SHORT"}
        </span>
        <button type="button" className="osc-pos__token" onClick={(e) => { e.stopPropagation(); onOpenToken(mint); }}>
          <TokenAvatar image={quote.icon} symbol={sym} mint={mint} size={26} className="rounded-full" />
          <span>${sym}</span>
        </button>
        <span className="osc-pos__locked">entry locked</span>
      </div>

      {loading ? (
        <div className="osc-pos__loading"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <>
          <div className="osc-pos__pnl-row">
            <span className={cn("osc-pos__pnl", pnl == null ? "" : winning ? "osc-pos__pnl--win" : "osc-pos__pnl--loss")}>
              {pnl == null ? "—" : `${winning ? "+" : ""}${pnl >= 1000 ? (pnl / 100).toFixed(1) + "x" : pnl.toFixed(1) + "%"}`}
            </span>
            <span className="osc-pos__prices">
              {fmt(entry)} → {fmt(quote.price)}
            </span>
          </div>
          <button
            type="button"
            className={cn("osc-pos__mirror", isLong ? "osc-pos__mirror--long" : "osc-pos__mirror--short")}
            onClick={(e) => { e.stopPropagation(); onMirror(mint, sym, direction); }}
          >
            Mirror this {direction}
          </button>
        </>
      )}
    </div>
  );
}
