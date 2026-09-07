import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { WalletTokenRow } from "@/pages/onchain-world/api";
import { packBubbles, volumeBubbleRadius } from "@/pages/onchain-world/universeLayout";
import { formatAddress, formatUsd } from "@/pages/onchain-world/lib/orbitx/format";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";

export function HolderBubbles({ buyers }: { buyers: WalletTokenRow[] }) {
  const nav = useNavigate();
  const trackWallet = useOrbitxStore((s) => s.trackWallet);
  const setView = useOrbitxStore((s) => s.setActiveView);
  const nodes = useMemo(() => {
    const seed = buyers.slice(0, 28).map((b, i) => {
      const usd = Math.max(Number(b.bought_usd || b.bought_amount || 12), 12);
      const angle = (i / Math.max(buyers.length, 1)) * Math.PI * 2;
      const orbit = 18 + (i % 5) * 4.2;
      return {
        wallet: b.wallet || b.token_ca || `w-${i}`,
        usd,
        x: 50 + Math.cos(angle) * orbit,
        y: 50 + Math.sin(angle) * orbit * 0.72,
        r: volumeBubbleRadius(usd, 1, 7.2),
      };
    });
    return packBubbles(seed, 0.55, 24, { min: 8, max: 92 });
  }, [buyers]);

  if (nodes.length === 0) return null;

  return (
    <section className="border-b border-line px-3 py-2.5">
      <h3 className="ox-kicker mb-2 text-fg">Holder bubble map</h3>
      <svg viewBox="0 0 100 72" className="h-40 w-full overflow-visible" role="img" aria-label="Holder bubbles">
        {nodes.map((n) => (
          <g
            key={n.wallet}
            className="cursor-pointer"
            onClick={() => {
              trackWallet(n.wallet);
              setView("wallets");
              nav(`/on-chain/wallet/${n.wallet}`);
            }}
          >
            <circle cx={n.x} cy={n.y} r={n.r} fill="#111" stroke="#f5f5f5" strokeWidth="0.28" opacity="0.92" />
            <text
              x={n.x}
              y={n.y + 0.4}
              textAnchor="middle"
              fill="#f5f5f5"
              fontSize="1.8"
              fontFamily="IBM Plex Mono, monospace"
            >
              {formatAddress(n.wallet).slice(0, 6)}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-1 text-2xs text-dim">
        Sized by observed buy USD · {nodes.length} wallets · tap to open account
        {buyers[0]?.bought_usd != null ? ` · top ${formatUsd(buyers[0].bought_usd)}` : ""}
      </p>
    </section>
  );
}
