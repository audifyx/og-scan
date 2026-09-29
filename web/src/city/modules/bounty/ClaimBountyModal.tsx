import { useState } from "react";
import { useBountyStore } from "./useBounties";
import { CLAIM_ERROR_COPY, currencyLabel, currencySymbol, timeLeft } from "./ui";
import type {
  Bounty,
  BountyPlayer,
  OrbitxBillingProvider,
  PaperLedgerPort,
} from "./types";

export interface ClaimBountyModalProps {
  bounty: Bounty;
  me: BountyPlayer;
  paper: PaperLedgerPort;
  billing?: OrbitxBillingProvider;
  onClose: () => void;
}

/**
 * Claim flow for a hunter. Confirm → store pays out: paper CITY credits
 * immediately from the local escrow record; ORBITX routes through the
 * backend-signed claim endpoint. Fail-closed: if the backend payout isn't
 * confirmed, the bounty stays OPEN and no credit happens.
 */
export function ClaimBountyModal(props: ClaimBountyModalProps): JSX.Element {
  const { bounty, me, paper, billing, onClose } = props;
  const store = useBountyStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const live = store.get(bounty.id);
  const expired = !live || live.status !== "open" || live.expiresAt <= Date.now();

  async function handleClaim(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await store.claim(bounty.id, { me, paper, billing });
    setBusy(false);
    if (res.ok === false) {
      setError(CLAIM_ERROR_COPY[res.error]);
    } else {
      setDone(true);
      setTimeout(onClose, 1400);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center bg-black/85 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-zinc-950 border border-zinc-800 rounded-t-2xl sm:rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-lg font-black text-white">
            CLAIM <span className="text-red-500">BOUNTY</span>
          </h3>
          <button
            onClick={onClose}
            aria-label="Close claim bounty"
            className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-lg transition"
          >
            ×
          </button>
        </div>

        <div className="px-5 pb-5">
          {done ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-3">💰</div>
              <p className="text-emerald-300 font-bold text-lg">Bounty claimed</p>
              <p className="text-zinc-400 text-sm mt-1">
                {currencySymbol(bounty.currency)}
                {bounty.amount.toLocaleString()} {currencyLabel(bounty.currency)} — nice work, hunter.
              </p>
            </div>
          ) : expired ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-3">⌛</div>
              <p className="text-zinc-300 font-bold">Too late</p>
              <p className="text-zinc-500 text-sm mt-1">This bounty is no longer open.</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-white font-bold text-lg">{bounty.target.displayName}</span>
                  <span
                    className={`text-2xl font-black ${
                      bounty.currency === "ORBITX" ? "text-violet-300" : "text-emerald-300"
                    }`}
                  >
                    {currencySymbol(bounty.currency)}
                    {bounty.amount.toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  posted by {bounty.posterName} · expires in{" "}
                  {timeLeft(bounty.expiresAt, Date.now())}
                </p>
                {bounty.note && (
                  <p className="text-zinc-400 text-xs mt-2 italic">“{bounty.note}”</p>
                )}
              </div>

              <p className="text-zinc-300 text-sm mb-4">
                Confirm you took down <span className="font-bold text-white">{bounty.target.displayName}</span>.
                {bounty.currency === "ORBITX"
                  ? " The backend pays you once the claim is confirmed — no wallet popup."
                  : " The paper payout lands in your CITY wallet immediately."}
              </p>

              {error && (
                <div className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/40 text-red-200 text-sm mb-4">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-sm transition"
                >
                  Back
                </button>
                <button
                  onClick={handleClaim}
                  disabled={busy}
                  className={`flex-1 py-3 rounded-xl font-black text-base transition active:scale-[0.99] ${
                    busy
                      ? "bg-zinc-800 text-zinc-500 cursor-wait"
                      : "bg-red-600 hover:bg-red-500 text-white"
                  }`}
                >
                  {busy ? "Claiming…" : "Confirm the kill"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
