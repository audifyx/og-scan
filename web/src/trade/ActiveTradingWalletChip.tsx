/**
 * Compact active-wallet + mode indicator for Trade surfaces.
 */
import { Link } from "react-router-dom";
import { KeyRound, Wallet } from "lucide-react";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";
import { useTradeWalletPicker } from "./TradeWalletPicker";

type Props = {
  className?: string;
  showManage?: boolean;
};

export default function ActiveTradingWalletChip({ className = "", showManage = true }: Props) {
  const { localActive, ready, label, shortAddress, setMode, defaultWallet } =
    useActiveTradingWallet();
  const { openPicker, picker } = useTradeWalletPicker();

  return (
    <div className={`tx-wallet-chip ${className}`.trim()}>
      {picker}
      <div className="tx-wallet-chip__modes" role="group" aria-label="Trading wallet mode">
        <button
          type="button"
          onClick={() => setMode("connected")}
          className={`tx-wallet-chip__mode ${!localActive ? "tx-wallet-chip__mode--on" : ""}`}
        >
          Connected
        </button>
        <button
          type="button"
          onClick={() => setMode("local")}
          className={`tx-wallet-chip__mode ${localActive ? "tx-wallet-chip__mode--on" : ""}`}
        >
          Local
        </button>
      </div>
      <div className="tx-wallet-chip__meta">
        {ready && (label || shortAddress) ? (
          <span className="tx-wallet-chip__addr" title={label || shortAddress || undefined}>
            <span className={`tx-wallet-chip__dot ${localActive ? "tx-wallet-chip__dot--local" : ""}`} />
            {label || shortAddress}
          </span>
        ) : localActive ? (
          <span className="tx-wallet-chip__hint">
            {defaultWallet ? "Local wallet error" : "No default local wallet"}
          </span>
        ) : (
          <button type="button" onClick={openPicker} className="tx-wallet-chip__cta">
            <Wallet className="h-3 w-3" /> Connect wallet
          </button>
        )}
        {showManage ? (
          <Link to="/trade/wallets" className="tx-wallet-chip__manage">
            <KeyRound className="h-3 w-3" />
            Manage
          </Link>
        ) : null}
      </div>
    </div>
  );
}
