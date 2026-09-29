/**
 * Governance voting widget (#11).
 *
 * One vote = 1 ORBITX burned (backend-signed). Tallies are local until the
 * backend governance ledger ships (BLOCKED: no on-chain vote program /
 * backend tally endpoint yet — the burn receipt is the verifiable ballot).
 */
import { useMemo, useState } from "react";
import { useOrbitxBilling } from "../useOrbitxBilling";
import { ORBITX_PRICES, formatOrbitx, spendReason } from "../constants";

const VOTES_KEY = "orbitx.billing.votes.v1";

type VoteRecord = { proposalId: string; option: string; signature: string; at: number };

function readVotes(): VoteRecord[] {
  try {
    const raw = localStorage.getItem(VOTES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function VoteWidget({
  proposalId,
  title,
  options,
}: {
  proposalId: string;
  title: string;
  options: string[];
}): JSX.Element {
  const { ready, spend, beginAuth } = useOrbitxBilling();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const tally = useMemo(() => {
    const votes = tick >= 0 ? readVotes().filter((v) => v.proposalId === proposalId) : [];
    const counts: Record<string, number> = {};
    for (const o of options) counts[o] = 0;
    for (const v of votes) counts[v.option] = (counts[v.option] || 0) + 1;
    return { counts, total: votes.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId, tick, options.join("|")]);

  const vote = async (option: string) => {
    if (!ready) {
      beginAuth();
      return;
    }
    setBusy(option);
    setError(null);
    try {
      const { signature } = await spend({
        amount: ORBITX_PRICES.vote,
        reason: spendReason.vote(proposalId, option),
      });
      const next = [...readVotes(), { proposalId, option, signature, at: Date.now() }];
      try {
        localStorage.setItem(VOTES_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      setTick((t) => t + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ border: "1px solid #374151", borderRadius: 12, padding: 14, background: "#0b0f16" }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 10 }}>
        1 vote = {formatOrbitx(ORBITX_PRICES.vote)} burned · {tally.total} votes · burn receipt is the ballot
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {options.map((o) => {
          const pct = tally.total ? Math.round((tally.counts[o] / tally.total) * 100) : 0;
          return (
            <div key={o} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                onClick={() => vote(o)}
                disabled={busy != null}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid #4b5563",
                  background: "#1f2937",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                  minWidth: 140,
                  textAlign: "left",
                }}
              >
                {busy === o ? "Burning…" : o}
              </button>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: "#1f2937", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: "#f59e0b" }} />
              </div>
              <span style={{ fontSize: 12, color: "#9ca3af", minWidth: 64, textAlign: "right" }}>
                {tally.counts[o]} · {pct}%
              </span>
            </div>
          );
        })}
      </div>
      {error ? <div style={{ fontSize: 12, color: "#f87171", marginTop: 8 }}>{error}</div> : null}
    </div>
  );
}
