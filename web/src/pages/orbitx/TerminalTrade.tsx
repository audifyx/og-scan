/**
 * Terminal Trade — wired to the real OrbitX TradingTerminal
 * (charts, Jupiter routes, balances, live trades).
 */

import { TradingTerminal } from "@/components/trading/TradingTerminal";

export default function TerminalTrade() {
  return (
    <div className="h-full min-h-[70vh] -m-2">
      <TradingTerminal />
    </div>
  );
}
