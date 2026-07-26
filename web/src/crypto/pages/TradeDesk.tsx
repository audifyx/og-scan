import { TradingTerminal } from "@/components/trading/TradingTerminal";

export default function TradeDesk() {
  return (
    <div>
      <header className="oxc-hero" style={{ marginBottom: "0.75rem" }}>
        <h1>Trade desk</h1>
        <p>Live charts, wallet balances, and Phantom-routed buy/sell. Full Jupiter sign/send also available on OG DEX.</p>
      </header>
      <div className="oxc-trade-wrap">
        <TradingTerminal />
      </div>
    </div>
  );
}
