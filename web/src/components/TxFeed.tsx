import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, Loader2 } from "lucide-react";
import { heliusTxs, shortAddr, timeAgo, fmtNum } from "@/lib/og";

type Props = { mint: string; compact?: boolean };

type TradeSide = "BUY" | "SELL" | "TRADE" | "TRANSFER" | "TX";

const getTradeSide = (
  tx: { type?: string; feePayer?: string; tokenTransfers?: { fromUserAccount?: string; toUserAccount?: string }[] },
  transfer: { fromUserAccount?: string; toUserAccount?: string } | undefined,
): TradeSide => {
  if (tx.type === "TRANSFER") return "TRANSFER";
  if (tx.type !== "SWAP") return tx.type ? "TX" : "TRADE";
  if (transfer?.toUserAccount && tx.feePayer && transfer.toUserAccount === tx.feePayer) return "BUY";
  if (transfer?.fromUserAccount && tx.feePayer && transfer.fromUserAccount === tx.feePayer) return "SELL";
  return "TRADE";
};

export const TxFeed = ({ mint, compact = false }: Props) => {
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["tx", mint],
    queryFn: () => heliusTxs(mint, compact ? 45 : 30),
    refetchInterval: 20_000,
    enabled: !!mint,
    retry: 1,
  });

  return (
    <section className="relative">
      <div>
        {!compact && (
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-og-gold">
                <span className="h-px w-10 bg-og-gold" /> THE TAPE
              </div>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
                <span className="text-og-gold text-glow-gold">LIVE</span>{" "}
                <span className="text-foreground">TX FEED</span>
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">Last 30 transactions touching this mint · streamed via Helius.</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              {isFetching && <Loader2 className="h-3 w-3 animate-spin text-og-lime" />}
              {isFetching ? "POLLING" : "IDLE"} · 20s
            </div>
          </div>
        )}

        <div className="overflow-hidden border border-og-grid bg-og-ink">
          <div className="hidden grid-cols-12 border-b border-og-grid bg-og-ink/80 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground md:grid">
            <div className="col-span-2">TIME</div>
            <div className="col-span-2">SIDE</div>
            <div className="col-span-3">SIG</div>
            <div className="col-span-3">FROM</div>
            <div className="col-span-2 text-right">AMT</div>
          </div>
          <div className={compact ? "max-h-[520px] overflow-y-auto" : "max-h-[460px] overflow-y-auto"}>
            {isLoading && (
              <div className="grid place-items-center p-10 text-xs uppercase tracking-widest text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-og-lime" />
                <span className="mt-3">CONNECTING TO HELIUS…</span>
              </div>
            )}
            {error && (
              <div className="p-6 text-center text-xs uppercase tracking-widest text-og-blood">FEED ERROR · {(error as Error).message}</div>
            )}
            {(data ?? []).map((tx, i) => {
              const transfer = tx.tokenTransfers?.find((tr) => tr.mint === mint) ?? tx.tokenTransfers?.[0];
              const side = getTradeSide(tx, transfer);
              const isBuy = side === "BUY" || side === "TRADE";
              const isSell = side === "SELL";
              return (
                <div
                  key={tx.signature}
                  className="border-b border-og-grid/60 p-3 text-xs hover:bg-og-lime/5 md:grid md:grid-cols-12 md:items-center md:gap-2 md:px-3 md:py-2"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <div className="flex items-center justify-between gap-3 md:contents">
                    <div className="font-mono text-muted-foreground md:col-span-2">{timeAgo(tx.timestamp)} ago</div>
                    <div className="md:col-span-2">
                      <span className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                        side === "BUY"
                          ? "border-og-lime/40 text-og-lime"
                          : side === "SELL"
                          ? "border-og-blood/50 text-og-blood"
                          : side === "TRANSFER"
                          ? "border-og-cyan/40 text-og-cyan"
                          : "border-og-grid text-muted-foreground"
                      }`}>
                        {(side === "BUY" || side === "SELL" || side === "TRADE") && <ArrowUpDown className="h-3 w-3" />}
                        {side}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 md:contents">
                    <div className="border border-og-grid/60 bg-og-ink/55 p-2 md:col-span-3 md:border-0 md:bg-transparent md:p-0">
                      <div className="mb-1 font-mono text-[8px] uppercase tracking-[0.22em] text-muted-foreground md:hidden">Sig</div>
                      <a href={`https://solscan.io/tx/${tx.signature}`} target="_blank" rel="noreferrer" className="font-mono text-muted-foreground hover:text-og-lime">
                        {shortAddr(tx.signature, 6)}
                      </a>
                    </div>
                    <div className="border border-og-grid/60 bg-og-ink/55 p-2 md:col-span-3 md:border-0 md:bg-transparent md:p-0">
                      <div className="mb-1 font-mono text-[8px] uppercase tracking-[0.22em] text-muted-foreground md:hidden">From</div>
                      <div className="font-mono text-muted-foreground">{shortAddr(tx.feePayer)}</div>
                    </div>
                    <div className="col-span-2 border border-og-grid/60 bg-og-ink/55 p-2 text-right md:col-span-2 md:border-0 md:bg-transparent md:p-0">
                      <div className="mb-1 text-left font-mono text-[8px] uppercase tracking-[0.22em] text-muted-foreground md:hidden">Amount</div>
                      <div className={`font-mono ${isSell ? "text-og-blood" : isBuy ? "text-og-lime" : "text-foreground"}`}>
                        {transfer?.tokenAmount != null ? fmtNum(transfer.tokenAmount) : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {!isLoading && !error && (data?.length ?? 0) === 0 && (
              <div className="p-10 text-center text-xs uppercase tracking-widest text-muted-foreground">
                NO RECENT ACTIVITY
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
