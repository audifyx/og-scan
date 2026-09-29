/**
 * Bounties (#8) + trading competitions (#9) panels.
 *
 * Bounties are posted in ORBITX (burned on posting; the poster pays the
 * hunter off-chain for now). Competition entries burn into the prize pool
 * accounting — the pool itself is a burn ledger until the backend escrow
 * ships (BLOCKED: no backend escrow for prize pools).
 */
import { useState } from "react";
import { useOrbitxBilling } from "../useOrbitxBilling";
import { BurnButton, BillingBanner } from "./BurnButton";
import { ORBITX_PRICES, formatOrbitx, spendReason } from "../constants";

type Bounty = { id: string; title: string; detail: string; amount: number; signature: string; at: number; claimed: boolean };
const BOUNTIES_KEY = "orbitx.billing.bounties.v1";

function readBounties(): Bounty[] {
  try {
    const raw = localStorage.getItem(BOUNTIES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function BountyBoard(): JSX.Element {
  const { ready } = useOrbitxBilling();
  const [bounties, setBounties] = useState<Bounty[]>(() => readBounties());
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [amount, setAmount] = useState("500");

  const post = (signature: string) => {
    const bounty: Bounty = {
      id: `bnty-${Date.now()}`,
      title: title.trim() || "Untitled bounty",
      detail: detail.trim(),
      amount: Math.floor(Number(amount) || 0),
      signature,
      at: Date.now(),
      claimed: false,
    };
    const next = [bounty, ...readBounties()];
    try {
      localStorage.setItem(BOUNTIES_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setBounties(next);
    setTitle("");
    setDetail("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <BillingBanner compact />
      <div style={{ border: "1px solid #374151", borderRadius: 12, padding: 14, background: "#0b0f16" }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Post a bounty</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bounty title (bug, alpha, design…)"
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #374151", background: "#030712", color: "#fff" }} />
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Details, acceptance criteria…"
            rows={3} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #374151", background: "#030712", color: "#fff" }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric"
              style={{ width: 110, padding: "8px 10px", borderRadius: 8, border: "1px solid #374151", background: "#030712", color: "#fff" }}
              aria-label="Bounty amount in ORBITX" />
            <span style={{ fontSize: 12, color: "#9ca3af" }}>ORBITX (min {formatOrbitx(ORBITX_PRICES.minBounty)}, burned on post)</span>
            <BurnButton amount={Math.max(ORBITX_PRICES.minBounty, Math.floor(Number(amount) || 0))}
              reason={spendReason.bounty("new")} label="Post bounty" onDone={post} disabled={!ready || !title.trim()} />
          </div>
        </div>
      </div>
      {bounties.map((b) => (
        <div key={b.id} style={{ border: "1px solid #1f2937", borderRadius: 10, padding: 12, background: "#0b0f16" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700 }}>{b.title}</div>
            <div style={{ fontWeight: 700, color: "#fbbf24" }}>{formatOrbitx(b.amount)}</div>
          </div>
          {b.detail ? <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>{b.detail}</div> : null}
          <a href={`https://solscan.io/tx/${b.signature}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#4ade80" }}>
            bounty burn tx
          </a>
        </div>
      ))}
      {bounties.length === 0 ? <div style={{ fontSize: 13, color: "#6b7280" }}>No bounties yet — post the first one.</div> : null}
    </div>
  );
}

type Competition = { id: string; name: string; entries: { entrant: string; signature: string; at: number }[]; prizePool: number; at: number };
const COMPS_KEY = "orbitx.billing.competitions.v1";

function readComps(): Competition[] {
  try {
    const raw = localStorage.getItem(COMPS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

const SEED_COMPS: Competition[] = [
  { id: "comp-weekly-sprint", name: "Weekly PnL Sprint", entries: [], prizePool: 0, at: Date.now() },
  { id: "comp-meme-royale", name: "Meme Coin Royale", entries: [], prizePool: 0, at: Date.now() },
];

export function CompetitionBoard(): JSX.Element {
  const { ready, wallet, spend } = useOrbitxBilling();
  const [comps, setComps] = useState<Competition[]>(() => {
    const existing = readComps();
    return existing.length ? existing : SEED_COMPS;
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enter = async (comp: Competition) => {
    setBusy(comp.id);
    setError(null);
    try {
      const { signature } = await spend({ amount: ORBITX_PRICES.competitionEntry, reason: spendReason.competition(comp.id) });
      const list = (readComps().length ? readComps() : SEED_COMPS).map((c) =>
        c.id === comp.id
          ? { ...c, prizePool: c.prizePool + ORBITX_PRICES.competitionEntry, entries: [...c.entries, { entrant: wallet || "you", signature, at: Date.now() }] }
          : c,
      );
      try {
        localStorage.setItem(COMPS_KEY, JSON.stringify(list));
      } catch {
        /* ignore */
      }
      setComps(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <BillingBanner compact />
      <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
        Burn {formatOrbitx(ORBITX_PRICES.competitionEntry)} to enter — entries feed the prize pool ledger.
        Pool escrow ships with the backend (prize accounting is burn-verified).
      </p>
      {comps.map((c) => (
        <div key={c.id} style={{ border: "1px solid #374151", borderRadius: 12, padding: 14, background: "#0b0f16" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontWeight: 700 }}>🏆 {c.name}</div>
            <div style={{ fontSize: 13, color: "#fbbf24", fontWeight: 700 }}>Pool: {formatOrbitx(c.prizePool)}</div>
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>{c.entries.length} entered</div>
          <button type="button" disabled={!ready || busy === c.id} onClick={() => enter(c)}
            style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#b45309", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            {busy === c.id ? "Burning…" : `Enter — burn ${formatOrbitx(ORBITX_PRICES.competitionEntry)}`}
          </button>
        </div>
      ))}
      {error ? <div style={{ fontSize: 12, color: "#f87171" }}>{error}</div> : null}
    </div>
  );
}
