import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, Bell, Loader2, Radio } from "lucide-react";
import { heliusTxs, fmtNum, shortAddr, timeAgo, type HeliusTx } from "@/lib/og";
import { cn } from "@/lib/utils";
import { notifyUser } from "@/lib/notifications";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";

type TradeSide = "BUY" | "SELL" | "TRADE" | "TRANSFER" | "TX";

type FeedItem = {
  signature: string;
  timestamp: number;
  feePayer?: string;
  amount?: number;
  side: TradeSide;
};

type Props = {
  mint: string;
  limit?: number;
  compact?: boolean;
  buysOnly?: boolean;
  alertOnNewBuys?: boolean;
  className?: string;
  title?: string;
  subtitle?: string;
};

const getTradeSide = (
  tx: Pick<HeliusTx, "type" | "feePayer" | "tokenTransfers">,
  transfer: { fromUserAccount?: string; toUserAccount?: string } | undefined,
): TradeSide => {
  if (tx.type === "TRANSFER") return "TRANSFER";
  if (tx.type !== "SWAP") return tx.type ? "TX" : "TRADE";
  if (transfer?.toUserAccount && tx.feePayer && transfer.toUserAccount === tx.feePayer) return "BUY";
  if (transfer?.fromUserAccount && tx.feePayer && transfer.fromUserAccount === tx.feePayer) return "SELL";
  return "TRADE";
};

export const OurCoinBuyFeed = ({
  mint,
  limit = 24,
  compact = true,
  buysOnly = true,
  alertOnNewBuys = false,
  className,
  title = "Live buy feed",
  subtitle = "Fresh fills pulled from the official mint.",
}: Props) => {
  const { user } = useAuth();
  const { permission, isRegistered } = usePushNotifications();
  const bootedRef = useRef(false);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["our-coin-buy-feed", mint, limit],
    queryFn: () => heliusTxs(mint, limit),
    refetchInterval: 15_000,
    enabled: Boolean(mint),
    retry: 1,
  });

  const items = useMemo<FeedItem[]>(() => {
    const mapped = (data ?? []).map((tx) => {
      const transfer = tx.tokenTransfers?.find((tr) => tr.mint === mint) ?? tx.tokenTransfers?.[0];
      return {
        signature: tx.signature,
        timestamp: tx.timestamp,
        feePayer: tx.feePayer,
        amount: transfer?.tokenAmount,
        side: getTradeSide(tx, transfer),
      } satisfies FeedItem;
    });

    return buysOnly ? mapped.filter((item) => item.side === "BUY" || item.side === "TRADE") : mapped;
  }, [data, mint, buysOnly]);

  useEffect(() => {
    if (!alertOnNewBuys || !user || permission !== "granted" || !isRegistered || items.length === 0) return;

    const buys = items.filter((item) => item.side === "BUY" || item.side === "TRADE");
    if (buys.length === 0) return;

    const newestSignature = buys[0]?.signature;
    if (!newestSignature) return;

    const storageKey = `ogscan.our-coin.last-buy.${mint}`;
    const previousSignature = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;

    if (!bootedRef.current) {
      bootedRef.current = true;
      if (typeof window !== "undefined") window.localStorage.setItem(storageKey, newestSignature);
      return;
    }

    const pending: FeedItem[] = [];
    for (const item of buys) {
      if (item.signature === previousSignature) break;
      pending.push(item);
    }

    if (pending.length === 0) {
      if (!previousSignature && typeof window !== "undefined") window.localStorage.setItem(storageKey, newestSignature);
      return;
    }

    const newestBatch = pending.slice(0, 3).reverse();
    newestBatch.forEach((item) => {
      void notifyUser({
        userId: user.id,
        type: "our_coin_buy",
        title: "$ORBITX buy detected",
        message: `${item.amount != null ? fmtNum(item.amount) : "New"} bought by ${shortAddr(item.feePayer, 5)}`,
        url: "/our-coin",
        data: {
          mint,
          signature: item.signature,
          buyer: item.feePayer,
          amount: item.amount,
        },
      });
    });

    if (typeof window !== "undefined") window.localStorage.setItem(storageKey, newestSignature);
  }, [alertOnNewBuys, user, permission, isRegistered, items, mint]);

  return (
    <section className={cn("overflow-hidden border border-og-grid bg-og-ink", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-og-grid px-3 py-2.5">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-og-gold">
            <Radio className="h-3.5 w-3.5" /> {title}
          </div>
          {!compact && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-white/35">
          {alertOnNewBuys && permission === "granted" && isRegistered && (
            <span className="inline-flex items-center gap-1 text-og-lime"><Bell className="h-3 w-3" /> alerts on</span>
          )}
          {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-og-lime" />}
        </div>
      </div>

      <div className={compact ? "max-h-[260px] overflow-y-auto" : "max-h-[520px] overflow-y-auto"}>
        {isLoading && (
          <div className="grid place-items-center p-6 text-xs uppercase tracking-widest text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-og-lime" />
            <span className="mt-2">Loading feed…</span>
          </div>
        )}

        {error && !isLoading && (
          <div className="p-4 text-xs uppercase tracking-widest text-og-blood">Feed error · {(error as Error).message}</div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="p-6 text-center text-xs uppercase tracking-widest text-muted-foreground">No recent buys found</div>
        )}

        {items.map((item) => (
          <div key={item.signature} className="border-b border-og-grid/60 px-3 py-2.5 last:border-b-0 hover:bg-og-lime/5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className={cn(
                  "inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest",
                  item.side === "SELL"
                    ? "border-og-blood/50 text-og-blood"
                    : "border-og-lime/40 text-og-lime",
                )}>
                  <ArrowUpDown className="h-3 w-3" />
                  {item.side === "TRADE" ? "BUY" : item.side}
                </span>
                <span className="truncate font-mono text-[11px] text-white/70">{shortAddr(item.feePayer, 5)}</span>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-white/35">{timeAgo(item.timestamp)} ago</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <a
                href={`https://solscan.io/tx/${item.signature}`}
                target="_blank"
                rel="noreferrer"
                className="truncate font-mono text-[10px] text-og-cyan transition hover:text-og-lime"
              >
                {shortAddr(item.signature, 6)}
              </a>
              <div className="shrink-0 font-mono text-xs font-semibold text-white">
                {item.amount != null ? fmtNum(item.amount) : "—"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default OurCoinBuyFeed;
