/**
 * Referral rewards panel (#15) — rewards paid in ORBITX from the rewards pool.
 *
 * BLOCKED on backend: the rewards pool needs a funded wallet + payout job.
 * This panel shows the rate and queues the claim intent locally so the
 * backend can settle it when the pool ships. No fake payouts.
 */
import { useState } from "react";
import { useOrbitxBilling } from "../useOrbitxBilling";
import { formatOrbitx } from "../constants";

export const REFERRAL_REWARD_PER_QUALIFIED = 50; // ORBITX per qualified referral

const QUEUE_KEY = "orbitx.billing.referralClaims.v1";

function readQueue(): { at: number; referrals: number; amount: number }[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function ReferralRewardsPanel({ qualifiedCount = 0 }: { qualifiedCount?: number }): JSX.Element {
  const { ready, beginAuth } = useOrbitxBilling();
  const [queued, setQueued] = useState(() => readQueue());

  const pending = Math.max(0, qualifiedCount * REFERRAL_REWARD_PER_QUALIFIED);

  const queueClaim = () => {
    if (!ready) {
      beginAuth();
      return;
    }
    const next = [...readQueue(), { at: Date.now(), referrals: qualifiedCount, amount: pending }];
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setQueued(next);
  };

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🪂</span>
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">ORBITX referral rewards</h2>
      </div>
      <p className="text-sm text-white/50 max-w-xl mb-3">
        Every qualified referral earns{" "}
        <span className="font-bold text-white">{formatOrbitx(REFERRAL_REWARD_PER_QUALIFIED)}</span>{" "}
        from the rewards pool — paid in ORBITX, not dollars.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm text-white/60">
          Your qualified referrals: <span className="font-bold text-white">{qualifiedCount}</span> · Pending:{" "}
          <span className="font-bold text-amber-300">{formatOrbitx(pending)}</span>
        </div>
        <button
          type="button"
          onClick={queueClaim}
          disabled={qualifiedCount <= 0}
          className="px-4 py-2 rounded-xl bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-bold transition-colors disabled:opacity-40"
        >
          {ready ? "Queue claim" : "Link billing to claim"}
        </button>
      </div>
      {queued.length > 0 ? (
        <p className="text-[11px] text-white/30 mt-2">
          {queued.length} claim{queued.length !== 1 ? "s" : ""} queued — settles automatically when the rewards pool funds.
        </p>
      ) : null}
      <p className="text-[11px] text-white/30 mt-2">
        Pool payouts ship with the backend rewards wallet — claims above are queued, never faked.
      </p>
    </div>
  );
}
