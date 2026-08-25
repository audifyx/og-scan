import { OrbitxMark } from "@/pages/onchain-world/dashboard/OrbitxMark";
import { formatInt, formatUsd } from "@/pages/onchain-world/lib/orbitx/format";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";

export function OrbitxTokenView() {
  const ticker = useOrbitxStore((s) => s.snapshot.ticker);
  const cards = [
    { label: "Buys (session)", value: formatInt(ticker.orbitxBuys) },
    { label: "Burned", value: formatInt(ticker.orbitxBurned) },
    { label: "Whale flow", value: formatUsd(ticker.whaleActivityUsd) },
    { label: "Active wallets", value: formatInt(ticker.activeWallets) },
  ];

  return (
    <div className="ox-scroll min-h-0 flex-1 overflow-auto p-5">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-lg bg-accent-2/20">
          <OrbitxMark className="size-7" />
        </span>
        <div>
          <h3 className="font-display text-lg font-semibold tracking-[0.16em]">ORBITX</h3>
          <p className="text-xs text-muted">Token telemetry is empty until a feed is attached.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <div key={card.label} className="rounded-md border border-line bg-bg-sunken p-3">
            <p className="ox-kicker">{card.label}</p>
            <p className="ox-stat mt-1 text-xl text-fg">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
