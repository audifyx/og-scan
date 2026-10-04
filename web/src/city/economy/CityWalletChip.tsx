/**
 * OrbitX City — HUD wallet chip (board 11).
 *
 * Shows the linked in-app (desk) wallet: short address + live ORBITX + SOL
 * balances. Tapping while unlinked starts the one-time in-app wallet link
 * flow (dashboard auth code) — no Phantom, no injected wallets, works on
 * mobile. Drop-in for the rebuilt HUD's top ticker bar.
 *
 * Sign-in aware: the link needs a Supabase session. If the user isn't
 * signed in, the chip routes them to /auth (returning to /Orbitxcity)
 * and auto-completes the link when they're back — instead of failing
 * with a confusing error.
 */
import { Wallet } from "lucide-react";
import { CITY_PENDING_LINK_KEY, useCityWallet } from "./useCityWallet";
import "./economy.css";

function fmt(n: number | null, digits = 2): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/** Where the city lives — used as the post-sign-in return target. */
const CITY_PATH = "/Orbitxcity";

function sendToSignIn(): void {
  try {
    sessionStorage.setItem(CITY_PENDING_LINK_KEY, "1");
  } catch {
    /* storage unavailable — link just won't auto-retry */
  }
  window.location.href = "/auth?next=" + encodeURIComponent(CITY_PATH);
}

export default function CityWalletChip({ onTap }: { onTap?: () => void }) {
  const w = useCityWallet();

  const handleTap = async () => {
    onTap?.();
    // Sign-in gate: no session -> /auth first (returns to the city).
    // Re-check when state is still unknown so first tap works.
    let signed = w.signedIn;
    if (signed === null) {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data } = await supabase.auth.getSession();
        signed = !!data.session;
      } catch {
        signed = false;
      }
    }
    if (!signed) {
      sendToSignIn();
      return;
    }
    w.connect().catch(() => {});
  };

  if (!w.connected) {
    const needsSignIn = w.signedIn === false;
    return (
      <div className="oxe-chip-wrap">
        <button
          className="oxe-chip oxe-chip-action"
          onClick={handleTap}
          aria-label={needsSignIn ? "Sign in to connect your wallet" : "Link in-app wallet"}
        >
          <Wallet className="oxe-ic-sm" />
          <span>{needsSignIn ? "Sign in to connect" : "Link in-app wallet"}</span>
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
