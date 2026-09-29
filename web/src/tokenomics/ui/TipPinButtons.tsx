/**
 * Social tokenomics: tip + pin buttons for the feed (#2, #7).
 *
 * Tips burn ORBITX tagged to the recipient today; actual wallet-to-wallet
 * payout needs the backend `orbitx_app_send` transfer tool (BLOCKED —
 * no transfer tool exists yet). Pins burn for 24h placement.
 */
import { useState } from "react";
import { useOrbitxBilling } from "../useOrbitxBilling";
import { ORBITX_PRICES, formatOrbitx, spendReason } from "../constants";
import { pinPost } from "../../social/store/localSocialStore";

export function PinButton({ postId }: { postId: string }): JSX.Element {
  const { ready, spend, beginAuth } = useOrbitxBilling();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pin = async () => {
    if (!ready) {
      beginAuth();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await spend({ amount: ORBITX_PRICES.pinPost, reason: spendReason.pinPost(postId) });
      pinPost(postId, true);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (done) return <span style={{ fontSize: 12, color: "#4ade80" }}>📌 Pinned 24h</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <button
        type="button"
        aria-label="Pin post (burn ORBITX)"
        title={`Burn ${formatOrbitx(ORBITX_PRICES.pinPost)} to pin for 24h`}
        onClick={pin}
        disabled={busy}
        style={{ background: "none", border: "none", color: "#fbbf24", cursor: "pointer", fontSize: 16 }}
      >
        {busy ? "…" : "📌"}
      </button>
      {error ? <span style={{ fontSize: 11, color: "#f87171" }}>{error}</span> : null}
    </span>
  );
}

export function TipButton({
  recipient,
  recipientLabel,
}: {
  recipient: string;
  recipientLabel?: string;
}): JSX.Element {
  const { ready, spend, beginAuth } = useOrbitxBilling();
  const [amount, setAmount] = useState("10");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tip = async () => {
    if (!ready) {
      beginAuth();
      return;
    }
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n < ORBITX_PRICES.minTip) {
      setError(`Minimum tip is ${formatOrbitx(ORBITX_PRICES.minTip)}.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await spend({ amount: n, reason: spendReason.tip(recipient) });
      setDone(true);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (done) return <span style={{ fontSize: 12, color: "#4ade80" }}>💸 Tipped!</span>;
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-label={`Tip ${recipientLabel || recipient} in ORBITX`}
        title="Tip in ORBITX (seamless, backend-signed)"
        onClick={() => (ready ? setOpen((v) => !v) : beginAuth())}
        style={{ background: "none", border: "none", color: "#4ade80", cursor: "pointer", fontSize: 16 }}
      >
        💸
      </button>
      {open ? (
        <span
          style={{
            position: "absolute",
            bottom: "110%",
            left: 0,
            zIndex: 20,
            background: "#111827",
            border: "1px solid #374151",
            borderRadius: 10,
            padding: 10,
            display: "flex",
            gap: 6,
            alignItems: "center",
            whiteSpace: "nowrap",
          }}
        >
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            style={{ width: 70, padding: "6px 8px", borderRadius: 8, border: "1px solid #374151", background: "#030712", color: "#fff" }}
            aria-label="Tip amount in ORBITX"
          />
          <span style={{ fontSize: 12, color: "#9ca3af" }}>ORBITX</span>
          <button
            type="button"
            onClick={tip}
            disabled={busy}
            style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, cursor: "pointer" }}
          >
            {busy ? "…" : "Tip"}
          </button>
        </span>
      ) : null}
      {error ? <span style={{ fontSize: 11, color: "#f87171" }}>{error}</span> : null}
    </span>
  );
}
