import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { BurnAnnouncementCard, type BurnAnnouncementData } from "./BurnAnnouncementCard";

const AUTO_DISMISS_MS = 8000;
const MAX_STACK = 3;

type Row = {
  id: string;
  mint: string;
  token_name: string | null;
  token_symbol: string | null;
  token_logo_url: string | null;
  wallet: string;
  amount_burned: number;
  supply_before: number;
  supply_after: number;
  percent_of_supply: number;
  tx_signature: string;
  created_at: string;
};

const rowToData = (r: Row): BurnAnnouncementData => ({
  id: r.id,
  mint: r.mint,
  tokenName: r.token_name || "Unknown Token",
  tokenSymbol: r.token_symbol || "TOKEN",
  tokenLogoUrl: r.token_logo_url,
  wallet: r.wallet,
  amountBurned: Number(r.amount_burned),
  supplyBefore: Number(r.supply_before),
  supplyAfter: Number(r.supply_after),
  percentOfSupply: Number(r.percent_of_supply),
  txSignature: r.tx_signature,
  createdAt: r.created_at,
});

/**
 * Mounted once near the root of the app (App.tsx). Because this app is a
 * single React tree serving both the public landing page (`/`) and the
 * in-app routes (`/app/...`), mounting it once here surfaces verified burn
 * announcements on every page without any per-route wiring.
 */
export function BurnAnnouncementListener() {
  const [queue, setQueue] = useState<BurnAnnouncementData[]>([]);
  const [closingIds, setClosingIds] = useState<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = (id: string) => {
    setClosingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setQueue((prev) => prev.filter((d) => d.id !== id));
      setClosingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 350);
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  };

  useEffect(() => {
    const channel = supabase
      .channel("burn-events-broadcast")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "burn_events" },
        (payload) => {
          const data = rowToData(payload.new as Row);
          setQueue((prev) => [...prev.slice(-(MAX_STACK - 1)), data]);
          const t = setTimeout(() => dismiss(data.id), AUTO_DISMISS_MS);
          timers.current.set(data.id, t);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
    };
  }, []);

  if (typeof document === "undefined" || queue.length === 0) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[9999] flex flex-col items-center gap-2 px-3 sm:top-4">
      {queue.map((data) => (
        <BurnAnnouncementCard
          key={data.id}
          data={data}
          closing={closingIds.has(data.id)}
          onDismiss={() => dismiss(data.id)}
        />
      ))}
    </div>,
    document.body
  );
}
