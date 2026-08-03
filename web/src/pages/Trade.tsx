/**
 * /trade — full-bleed Phantom-style OrbitX trading terminal.
 * Markets from OGDex screener; buy/sell via /api/ogdex/trade + wallet sign.
 */

import { Link, useParams, useSearchParams } from "react-router-dom";
import { TradingTerminal } from "@/components/trading/TradingTerminal";

export default function Trade() {
  const { mint: mintParam } = useParams<{ mint?: string }>();
  const [search] = useSearchParams();
  const mint = mintParam || search.get("mint") || undefined;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#0a0a14] text-white">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#0d0d1a] px-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm font-bold tracking-tight text-white hover:text-[#ab9ff2]">
            OrbitX
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-xs font-medium text-white/70">Trade</span>
        </div>
        <a
          href="/ORBITX_DEX"
          className="text-[11px] text-white/40 transition-colors hover:text-[#ab9ff2]"
        >
          Open DEX →
        </a>
      </header>
      <div className="min-h-0 flex-1">
        <TradingTerminal initialMint={mint} />
      </div>
    </div>
  );
}
