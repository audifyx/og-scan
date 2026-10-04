/**
 * OrbitX City — HUD wallet chip (board 11).
 *
 * Shows the linked in-app (desk) wallet: short address + live ORBITX + SOL
 * balances. Tapping while unlinked starts the one-time in-app wallet link
 * flow (dashboard auth code) — no Phantom, no injected wallets, works on
 * mobile. Drop-in for the rebuilt HUD's top ticker bar.
 */
import { Wallet } from "lucide-react";
import { useCityWallet } from "./useCityWallet";
import "./economy.css";

function fmt(n: number | null, digits = 2): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export default function CityWalletChip({ onTap }: { onTap?: () => void }) {
  const w = useCityWallet();

  if (!w.connected) {
    return (
      <div className="oxe-chip-wrap">
        <button
          className="oxe-chip oxe-chip-action"
          onClick={() => {
            onTap?.();
            w.connect().catch(() => {});
          }}
          aria-label="Link in-app wallet"
        >
          <Wallet className="oxe-ic-sm" />
          <span>Link in-app wallet</span>
        </button>
        {w.error && (
          <span className="oxe-chip-err" role="alert">
            {w.error}
          </span>
        )}
      </div>
    );
  }

  return (
    <button
      className="oxe-chip"
      onClick={() => {
        onTap?.();
        w.refresh();
      }}
      aria-label={`In-app wallet ${w.short}, refresh balances`}
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
