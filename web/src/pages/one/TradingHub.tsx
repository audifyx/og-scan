import { Suspense, lazy } from "react";
import TradeSection from "./TradeSection";

const TradeHome = lazy(() => import("../../trade/TradeHome"));

/**
 * Unified Trading section: DEX swap + market discovery combined.
 * No duplicated features — swap from DEX, discovery from Trade page.
 */
export default function TradingHub() {
  return (
    <div className="ox-trading-hub">
      <div className="ox-trading-hub__grid">
        {/* Swap widget */}
        <div className="ox-trading-hub__swap">
          <Suspense fallback={<div>Loading swap…</div>}>
            <TradeSection />
          </Suspense>
        </div>

        {/* Market discovery (trending, new, etc.) */}
        <div className="ox-trading-hub__discover">
          <Suspense fallback={<div>Loading markets…</div>}>
            <TradeHome />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
