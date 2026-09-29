import { useMemo, useState } from "react";
import {
  BOUNTY_DURATIONS,
  MAX_CITY_BOUNTY,
  MAX_ORBITX_BOUNTY,
  MIN_CITY_BOUNTY,
  MIN_ORBITX_BOUNTY,
} from "./store";
import type { BountyDurationId } from "./store";
import { useBountyStore } from "./useBounties";
import { POST_ERROR_COPY, currencyLabel, currencySymbol } from "./ui";
import type {
  BountyCurrency,
  BountyPlayer,
  OrbitxBillingProvider,
  PaperLedgerPort,
} from "./types";

export interface PostBountyModalProps {
  me: BountyPlayer;
  paper: PaperLedgerPort;
  billing?: OrbitxBillingProvider;
  resolvePlayerId?: (displayName: string) => Promise<string | null>;
  initialTarget?: string;
  onClose: () => void;
}

/**
 * Post a bounty on a rival's head. Paper CITY bounties debit the local paper
 * wallet; ORBITX bounties run a backend-signed burn spend (no popup, ever).
 * Success → the bounty appears on the board immediately.
 */
export function PostBountyModal(props: PostBountyModalProps): JSX.Element {
  const { me, paper, billing, resolvePlayerId, initialTarget, onClose } = props;
  const store = useBountyStore();

  const [target, setTarget] = useState(initialTarget ?? "");
  const [currency, setCurrency] = useState<BountyCurrency>("CITY");
  const [amount, setAmount] = useState<string>("100");
  const [durationId, setDurationId] = useState<BountyDurationId>("24h");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isOrbitx = currency === "ORBITX";
  const min = isOrbitx ? MIN_ORBITX_BOUNTY : MIN_CITY_BOUNTY;
  const max = isOrbitx ? MAX_ORBITX_BOUNTY : MAX_CITY_BOUNTY;
  const amountNum = Math.floor(Number(amount) || 0);
  const validAmount = Number.isInteger(amountNum) && amountNum >= min && amountNum <= max;
  const orbitxBlocked = isOrbitx && (!billing || !billing.ready);
  const canSubmit = !busy && !done && target.trim().length > 0 && validAmount && !orbitxBlocked;
  const paperBalance = useMemo(() => {
    try {
      return paper.getBalance();
    } catch {
      return 0;
    }
  }, [paper]);

  async function handleSubmit(): Promise<void> {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const res = await store.post(
      {
        targetDisplayName: target.trim(),
        currency,
        amount: amountNum,
        note,
        durationId,
      },
      { me, paper, billing, resolvePlayerId }
    );
    setBusy(false);
    if (res.ok === false) {
      setError(POST_ERROR_COPY[res.error]);
    } else {
      setDone(true);
      setTimeout(onClose, 900);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center bg-black/85 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-zinc-950 border border-zinc-800 rounded-t-2xl sm:rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-lg font-black text-white">
            POST A <span className="text-red-500">BOUNTY</span>
          </h3>
          <button
            onClick={onClose}
            aria-label="Close post bounty"
            className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-lg transition"
          >
            ×
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {done ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-3">🎯</div>
              <p className="text-emerald-300 font-bold text-lg">Bounty posted</p>
              <p className="text-zinc-400 text-sm mt-1">
                {amountNum} {currencyLabel(currency)} on {target.trim()}'s head.
              </p>
            </div>
          ) : (
            <>
              {/* currency toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-900">
                {(["CITY", "ORBITX"] as BountyCurrency[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setCurrency(c);
                      setError(null);
                    }}
                    className={`py-2.5 rounded-lg text-sm font-bold transition ${
                      currency === c
                        ? c === "CITY"
                          ? "bg-emerald-600 text-white"
                          : "bg-violet-600 text-white"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {currencySymbol(c)} {currencyLabel(c)}
                    <span className="block text-[10px] font-normal opacity-80">
                      {c === "CITY" ? "paper · gameplay" : "real · burned on post"}
                    </span>
                  </button>
                ))}
              </div>

              {/* target */}
              <div>
                <label htmlFor="bounty-target" className="text-xs font-semibold text-zinc-400">
                  Rival's name
                </label>
                <input
                  id="bounty-target"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="e.g. NeonViper"
                  maxLength={48}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-base outline-none focus:border-red-500"
                />
              </div>

              {/* amount */}
              <div>
                <div className="flex justify-between items-baseline">
                  <label htmlFor="bounty-amount" className="text-xs font-semibold text-zinc-400">
                    Bounty amount ({currencyLabel(currency)})
                  </label>
                  <span className="text-[11px] text-zinc-500">
                    {isOrbitx
                      ? billing
                        ? billing.balance === null
                          ? "balance…"
                          : `${billing.balance.toLocaleString()} ◎ available`
                        : "billing unavailable"
                      : `${paperBalance.toLocaleString()} ◉ paper`}
                  </span>
                </div>
                <div className="mt-1 flex gap-2">
                  <input
                    id="bounty-amount"
                    type="number"
                    inputMode="numeric"
                    min={min}
                    max={max}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-base outline-none focus:border-red-500"
                  />
                  <button
                    onClick={() => setAmount(String(max))}
                    className="px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
                  >
                    MAX
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Min {min.toLocaleString()} · max {max.toLocaleString()} {currencyLabel(currency)}
                </p>
              </div>

              {/* duration */}
              <div>
                <label htmlFor="bounty-duration" className="text-xs font-semibold text-zinc-400">
                  Bounty lasts
                </label>
                <select
                  id="bounty-duration"
                  value={durationId}
                  onChange={(e) => setDurationId(e.target.value as BountyDurationId)}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-base outline-none focus:border-red-500"
                >
                  {BOUNTY_DURATIONS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* note */}
              <div>
                <label htmlFor="bounty-note" className="text-xs font-semibold text-zinc-400">
                  Terms / taunt <span className="text-zinc-600">(optional)</span>
                </label>
                <input
                  id="bounty-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Catch me if you can."
                  maxLength={140}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-base outline-none focus:border-red-500"
                />
              </div>

              {/* ORBITX auth gate */}
              {isOrbitx && !billing?.ready && billing?.beginAuth && (
                <div className="px-3 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/40">
                  <p className="text-violet-200 text-xs mb-2">
                    Auth once so the backend can sign your burn. No wallet popup — ever.
                  </p>
                  <button
                    onClick={() => billing.beginAuth()}
                    className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition"
                  >
                    Auth ORBITX billing
                  </button>
                </div>
              )}

              {error && (
                <div className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/40 text-red-200 text-sm">
                  {error}
                </div>
              )}

              {isOrbitx && (
                <p className="text-[11px] text-zinc-500">
                  ⚠️ Posting burns <span className="text-violet-300 font-semibold">{validAmount ? amountNum : "—"} ORBITX</span> via
                  backend-signed tx. The backend escrows the value and pays the hunter on claim.
                </p>
              )}

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`w-full py-3 rounded-xl font-black text-base transition active:scale-[0.99] ${
                  canSubmit
                    ? "bg-red-600 hover:bg-red-500 text-white"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                }`}
              >
                {busy ? "Posting…" : `Post ${validAmount ? amountNum.toLocaleString() : "—"} ${currencyLabel(currency)} bounty`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
