import { useMemo } from "react";
import { OrbitxMark } from "@/pages/onchain-world/dashboard/OrbitxMark";
import { EventKindGlyph } from "@/pages/onchain-world/dashboard/EventKindGlyph";
import { formatAddress, formatInt, formatPct, formatPrice, formatUsd } from "@/pages/onchain-world/lib/orbitx/format";
import { EVENT_META } from "@/pages/onchain-world/lib/orbitx/constants";
import { isOrbitxChainEvent, toLiveEvent } from "@/pages/onchain-world/lib/mapLive";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import { isOrbitxMint } from "../../../../../shared/orbitx-chain-intel.js";

export function OrbitxTokenView() {
  const ticker = useOrbitxStore((s) => s.snapshot.ticker);
  const ox = useOrbitxStore((s) => s.city.districts.orbitx);
  const raw = useOrbitxStore((s) => s.city.rawEvents);
  const ledger = useOrbitxStore((s) => s.city.orbitxEvents);
  const totals = useOrbitxStore((s) => s.city.orbitxTotals);
  const rows = useMemo(() => {
    const byId = new Map(ledger.filter(isOrbitxChainEvent).map((e) => [e.event_id, toLiveEvent(e)]));
    for (const e of raw) {
      if (isOrbitxChainEvent(e)) byId.set(e.event_id, toLiveEvent(e));
    }
    return [...byId.values()].sort((a, b) => b.ts - a.ts).slice(0, 250);
  }, [raw, ledger]);
  const buys = rows.filter((e) => e.kind === "orbitx_buy" || e.kind === "token_buy").length;
  const sells = rows.filter((e) => e.kind === "orbitx_sell" || e.kind === "token_sell").length;
  const swaps = rows.filter((e) => e.kind === "token_swap").length;
  const cards = [
    { label: "Price", value: formatPrice(ox?.price_usd ?? null) },
    { label: "Market cap", value: formatUsd(ox?.market_cap ?? null) },
    { label: "Liquidity", value: formatUsd(ox?.liquidity_usd ?? null) },
    { label: "Volume 24h", value: formatUsd(ox?.volume_24h ?? null) },
    { label: "Change 24h", value: formatPct(ox?.change_24h ?? null) },
    { label: "Buys (indexed)", value: formatInt(buys || ticker.orbitxBuys) },
    { label: "Sells (indexed)", value: formatInt(sells) },
    { label: "Swaps (indexed)", value: formatInt(swaps) },
    { label: "Burned", value: formatInt(totals?.burned ?? ticker.orbitxBurned) },
    { label: "Active wallets", value: formatInt(totals?.unique_wallets ?? ticker.activeWallets) },
    { label: "Buy USD (indexed)", value: formatUsd(totals?.buy_usd ?? null) },
    { label: "Sell USD (indexed)", value: formatUsd(totals?.sell_usd ?? null) },
  ];
  const mint = ox?.mint || "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
  const source = ox?.price_usd != null ? ox.source || "DexScreener" : null;

  return (
    <div className="ox-scroll min-h-0 flex-1 overflow-auto p-5">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-lg bg-accent-2/20">
          {ox?.image ? (
            <img src={ox.image} alt="" className="size-12 rounded-lg object-cover" />
          ) : (
            <OrbitxMark className="size-7" />
          )}
        </span>
        <div>
          <h3 className="font-display text-lg font-semibold tracking-[0.16em]">ORBITX</h3>
          <p className="text-xs text-muted">
            {source
              ? `${source} · ${mint.slice(0, 4)}…${mint.slice(-4)}`
              : "Token telemetry is empty until a feed is attached."}
            {isOrbitxMint(mint) ? " · full buy/sell ledger" : ""}
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-md border border-line bg-bg-sunken p-3">
            <p className="ox-kicker">{card.label}</p>
            <p className="ox-stat mt-1 text-xl text-fg">{card.value}</p>
          </div>
        ))}
      </div>
      <section className="mt-5">
        <h4 className="ox-kicker mb-2 text-fg">Buys, sells, swaps, transfers — {rows.length} rows</h4>
        {rows.length === 0 ? (
          <p className="text-2xs text-dim">No indexed OrbitX movement in this session yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {rows.map((e) => (
              <li key={e.id} className="flex items-center gap-2 px-3 py-2 text-2xs">
                <EventKindGlyph kind={e.kind} className="size-6" />
                <span className="w-16 text-dim">{new Date(e.ts).toISOString().slice(11, 19)}</span>
                <span className="w-24 text-accent">{EVENT_META[e.kind]?.label}</span>
                <span className="min-w-0 flex-1 truncate text-fg">
                  {e.amountLabel || e.title}
                  {e.wallet ? ` · ${formatAddress(e.wallet)}` : ""}
                </span>
                <span className="ox-stat text-muted">{formatUsd(e.usd ?? null)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
