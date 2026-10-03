/**
 * OrbitX City — HUD wallet chip (board 11).
 *
 * Shows the connected hub wallet: short address + live ORBITX + SOL balances.
 * Tapping while disconnected starts the Phantom/Jupiter connect flow.
 * On mobile browsers without an injected wallet, deep-links into Phantom's
 * in-app browser (where window.phantom IS injected) instead of failing silently.
 * Drop-in for the rebuilt HUD's top ticker bar.
 */
import { useState } from "react";
import { Wallet, ExternalLink } from "lucide-react";
import { useCityWallet } from "./useCityWallet";
import { isInjectWalletReady } from "@/wallets/hub";
import "./economy.css";

function fmt(n: number | null, digits = 2): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default function CityWalletChip({ onTap }: { onTap?: () => void }) {
  const w = useCityWallet();
  const [err, setErr] = useState<string | null>(null);

  if (!w.connected) {
    const injectReady = isInjectWalletReady("phantom") || isInjectWalletReady("jupiter");
    // Mobile browser without an injected wallet: the in-page connect can never
    // succeed (no window.phantom). Deep-link into Phantom's in-app browser,
    // where the wallet is injected and connect works.
    if (isMobileBrowser() && !injectReady) {
      const deep = `https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}`;
      return (
        <a
          className="oxe-chip oxe-chip-action"
          href={deep}
          target="_blank"
          rel="noreferrer"
          aria-label="Open in Phantom wallet app"
          title="Opens this page inside Phantom, where you can connect"
        >
          <Wallet className="oxe-ic-sm" />
          <span>Open in Phantom</span>
          <ExternalLink className="oxe-ic-xs" />
        </a>
      );
    }
    return (
      <div className="oxe-chip-wrap">
        <button
          className="oxe-chip oxe-chip-action"
          onClick={() => {
            onTap?.();
            setErr(null);
            w.connect().catch((e: unknown) => {
              setErr(e instanceof Error ? e.message : "Wallet connect failed");
            });
          }}
          aria-label="Connect wallet"
        >
          <Wallet className="oxe-ic-sm" />
          <span>{w.connecting ? "Connecting…" : "Connect"}</span>
        </button>
        {err && (
          <span className="oxe-chip-err" role="alert">
            {err}
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
