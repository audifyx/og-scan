import { useEffect, useMemo, useState } from "react";
import { BOUNTY_DURATIONS } from "./store";
import { useBountyStore } from "./useBounties";
import {
  CLAIM_ERROR_COPY,
  currencyLabel,
  currencySymbol,
  statusClass,
  statusCopy,
  shortDate,
  timeLeft,
} from "./ui";
import { PostBountyModal } from "./PostBountyModal";
import { ClaimBountyModal } from "./ClaimBountyModal";
import type { Bounty, BountyPlayer, OrbitxBillingProvider, PaperLedgerPort } from "./types";

export interface BountyBoardProps {
  /** Current signed-in player. */
  me: BountyPlayer;
  /** Paper-CITY ledger port (see types.ts — implemented by the integrator). */
  paper: PaperLedgerPort;
  /** ORBITX billing; when absent, ORBITX bounties are unavailable. */
  billing?: OrbitxBillingProvider;
  /** Optional display-name → player-id resolver (defaults to slug). */
  resolvePlayerId?: (displayName: string) => Promise<string | null>;
  /** Prefill the post form's target field (e.g. from a player interaction). */
  initialTarget?: string;
  onClose?: () => void;
}

type Tab = "open" | "mine" | "history";

const TABS: { id: Tab; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "mine", label: "My bounties" },
  { id: "history", label: "History" },
];

/**
 * Bounty board — browse open bounties, post new ones (paper or ORBITX),
 * claim flow for hunters. Mobile-friendly panel, mount as a modal/panel
 * (see MODULE.md for mount points).
 */
export function BountyBoard(props: BountyBoardProps): JSX.Element {
  const { me, paper, billing, resolvePlayerId, initialTarget, onClose } = props;
  const store = useBountyStore();
  const [tab, setTab] = useState<Tab>("open");
  const [posting, setPosting] = useState(false);
  const [claiming, setClaiming] = useState<Bounty | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Expiry sweep while the board is open.
  useEffect(() => {
    const stop = store.startSweep({ paper }, 30_000);
    void store.sweepExpired({ paper });
    return stop;
  }, [store, paper]);

  // Tick the countdowns.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const open = useMemo(() => store.open(), [store]);
  const mine = useMemo(() => store.mine(me.playerId), [store, me.playerId]);
  const history = useMemo(
    () => store.list().filter((b) => b.status !== "open"),
    [store]
  );
  const stats = useMemo(() => store.stats(), [store]);

  const rows: Bounty[] = tab === "open" ? open : tab === "mine" ? mine : history;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/80 backdrop-blur-sm">
      <div className="w-full sm:max-w-2xl max-h-[92dvh] flex flex-col bg-zinc-950/95 border border-zinc-800 rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.8)]">
        {/* header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-zinc-800">
          <div>
            <h2 className="text-xl font-black tracking-tight text-white">
              BOUNTY <span className="text-red-500">BOARD</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {stats.open} open · {stats.claimed} claimed · posted on heads, paid on proof
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPosting(true);
                setNotice(null);
              }}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white text-sm font-bold transition"
            >
              + Post bounty
            </button>
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close bounty board"
                className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-lg transition"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* tabs */}
        <div className="flex gap-1 px-4 pt-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition ${
                tab === t.id
                  ? "bg-zinc-900 text-white border-b-2 border-red-500"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.label}
              {t.id === "open" && (
                <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-red-600/20 text-red-400">
                  {open.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* notice */}
        {notice && (
          <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs">
            {notice}
          </div>
        )}

        {/* list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 bg-zinc-900/60">
          {rows.length === 0 ? (
            <EmptyState tab={tab} onPost={() => setPosting(true)} />
          ) : (
            rows.map((b) => (
              <BountyCard
                key={b.id}
                bounty={b}
                now={now}
                meId={me.playerId}
                onClaim={() => {
                  setNotice(null);
                  setClaiming(b);
                }}
                onCancel={async () => {
                  const res = await store.cancel(b.id, { me, paper, billing, resolvePlayerId });
                  if (res.ok === false) {
                    setNotice(
                      res.error === "backend_pending"
                        ? "Backend refund route unavailable — bounty stays open."
                        : "Couldn't cancel that bounty."
                    );
                  }
                }}
              />
            ))
          )}
        </div>

        {/* footer */}
        <div className="px-4 py-2.5 border-t border-zinc-800 text-[11px] text-zinc-500 flex justify-between">
          <span>
            ◉ CITY = paper, gameplay only · ◎ ORBITX = real, burned on post
          </span>
          <span>{timeLeftTick(now)}</span>
        </div>
      </div>

      {posting && (
        <PostBountyModal
          me={me}
          paper={paper}
          billing={billing}
          resolvePlayerId={resolvePlayerId}
          initialTarget={initialTarget}
          onClose={() => setPosting(false)}
        />
      )}
      {claiming && (
        <ClaimBountyModal
          bounty={claiming}
          me={me}
          paper={paper}
          billing={billing}
          onClose={() => setClaiming(null)}
        />
      )}
    </div>
  );
}

function timeLeftTick(now: number): string {
  return new Date(now).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function EmptyState({ tab, onPost }: { tab: Tab; onPost: () => void }): JSX.Element {
  const copy =
    tab === "open"
      ? "No open bounties. The city is quiet… for now."
      : tab === "mine"
        ? "You haven't posted any bounties yet."
        : "No settled bounties in history yet.";
  return (
    <div className="text-center py-14">
      <div className="text-5xl mb-3">🎯</div>
      <p className="text-zinc-400 text-sm mb-4">{copy}</p>
      {tab !== "history" && (
        <button
          onClick={onPost}
          className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition"
        >
          Post the first bounty
        </button>
      )}
    </div>
  );
}

interface BountyCardProps {
  bounty: Bounty;
  now: number;
  meId: string;
  onClaim: () => void;
  onCancel: () => void;
}

function BountyCard({ bounty: b, now, meId, onClaim, onCancel }: BountyCardProps): JSX.Element {
  const isMine = b.posterId === meId;
  const canClaim = b.status === "open" && b.expiresAt > now && !isMine;
  const isOrbitx = b.currency === "ORBITX";
  const duration = BOUNTY_DURATIONS.find((d) => b.expiresAt - b.createdAt === d.ms);

  return (
    <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3.5 hover:border-zinc-700 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-bold truncate">{b.target.displayName}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusClass(b)}`}>
              {statusCopy(b)}
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                isOrbitx
                  ? "text-violet-300 border-violet-500/40 bg-violet-500/10"
                  : "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
              }`}
            >
              {currencySymbol(b.currency)} {currencyLabel(b.currency)}
            </span>
          </div>
          {b.note && <p className="text-zinc-400 text-xs mt-1 italic line-clamp-2">“{b.note}”</p>}
          <p className="text-[11px] text-zinc-500 mt-1.5">
            posted by <span className="text-zinc-300">{isMine ? "you" : b.posterName}</span> ·{" "}
            {shortDate(b.createdAt)}
            {b.status === "open" && (
              <>
                {" "}· expires in <span className="text-amber-300 font-semibold">{timeLeft(b.expiresAt, now)}</span>
              </>
            )}
            {b.status === "claimed" && b.claimedByName && (
              <> · claimed by <span className="text-amber-300">{b.claimedByName}</span></>
            )}
            {duration && <> · {duration.label}</>}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-2xl font-black ${isOrbitx ? "text-violet-300" : "text-emerald-300"}`}>
            {currencySymbol(b.currency)}{b.amount.toLocaleString()}
          </div>
          <div className="mt-1.5 flex flex-col gap-1">
            {canClaim && (
              <button
                onClick={onClaim}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-bold transition"
              >
                Claim
              </button>
            )}
            {isMine && b.status === "open" && b.expiresAt > now && (
              <button
                onClick={onCancel}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
      {b.status === "open" && b.expiresAt <= now && (
        <p className="text-[11px] text-zinc-500 mt-2">Expiring — will sweep shortly.</p>
      )}
    </div>
  );
}

/** Re-export for integrator convenience (claim errors surfaced in custom claim UIs). */
export { CLAIM_ERROR_COPY };
