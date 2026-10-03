/**
 * OrbitX City — HUD wallet chip (board 11).
 *
 * Shows the connected hub wallet: short address + live ORBITX + SOL balances.
 * Tapping while disconnected starts the Phantom/Jupiter connect flow.
 * Drop-in for the rebuilt HUD's top ticker bar.
 */
import { Wallet } from "lucide-react";
import { useCityWallet } from "./useCityWallet";

function fmt(n: number | null, digits = 2): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export default function CityWalletChip({ onTap }: { onTap?: () => void }) {
  const w = useCityWallet();

  if (!w.connected) {
    return (
      <button
        className="oxe-chip oxe-chip-action"
        onClick={() => {
          onTap?.();
          w.connect().catch(() => {});
        }}
        aria-label="Connect wallet"
      >
        <Wallet className="oxe-ic-sm" />
        <span>{w.connecting ? "Connecting…" : "Connect"}</span>
      </button>
    );
  }

  return (
    <button
      className="oxe-chip"
      onClick={() => {
        onTap?.();
        w.refresh();
      }}
      aria-label={`Wallet ${w.short}, refresh balances`}
      title={w.address ?? ""}
    >
      <Wallet className="oxe-ic-sm" />
      <span className="oxe-chip-addr">{w.short}</span>
      <span className="oxe-chip-bal">
        {fmt(w.orbitx, 0)} <em>ORBITX</em>
      </span>
      <span className="oxe-chip-bal oxe-dim">
        {fmt(w.sol, 3)} <em>SOL</em>
      </span>
    </button>
  );
}
