import { TradingTerminal } from "@/components/trading/TradingTerminal";

export default function TradeDesk() {
  return (
    <div>
      <header className="oxc-hero" style={{ marginBottom: "0.75rem" }}>
        <h1>Trade desk</h1>
        <p>Real-time charts, Jupiter buy/sell, wallet balances, and transaction flow.</p>
      </header>
      <div className="oxc-trade-wrap">
        <TradingTerminal />
      </div>
    </div>
  );
}
