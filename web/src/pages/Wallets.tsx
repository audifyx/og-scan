/**
 * Wallets page — Phantom-style trading terminal.
 * Full-screen 3-panel layout: Token list | Chart + Trades | Swap + Info
 */

import { AppLayout } from "@/components/layout/AppLayout";
import { TradingTerminal } from "@/components/trading/TradingTerminal";

const Wallets = () => {
  return (
    <AppLayout>
      <TradingTerminal />
    </AppLayout>
  );
};

export default Wallets;
