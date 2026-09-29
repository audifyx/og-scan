/**
 * ORBITXCITY — Factions module: mayoral elections.
 *
 * Players vote with REAL ORBITX (burned, ties to tokenomics #11).
 * Billing primitives (web/src/tokenomics/*) do NOT exist yet, so every
 * cast vote is recorded as a paper pledge (`pendingVotes`) and converts
 * to a real ORBITX vote the moment settlement is possible. The mayor
 * sets the city burn tax (0–5%) on premium burns and the paper
 * fee-share multiplier for firms.
 *
 * HARD RULE: nothing here imports @/tokenomics/*. The `settleVotes`
 * hook is the single integration point — the integrator wires it to
 * the billing primitive when it lands.
 */
import type {
  Election,
  ElectionCandidate,
  FactionId,
  MayorOffice,
} from "./types";

export const TERM_MS = 7 * 24 * 60 * 60 * 1000; // 1 week terms
export const VOTE_COST_ORBITX = 1; // 1 ORBITX = 1 vote, burned
export const MAX_BURN_TAX_PCT = 5;
export const MAX_FEE_MULT = 2;

/** Default NPC candidates seeded each term (firms endorse one each). */
export function seedCandidates(term: number): ElectionCandidate[] {
  const roster: Array<{ name: string; factionId: FactionId; platform: string }> = [
    { name: "Vex Marlowe", factionId: "bulls", platform: "Zero burn tax. Let the firms run the streets." },
    { name: "Rosa Kade", factionId: "bears", platform: "5% burn tax. Fund the city walls, starve the hype." },
    { name: "Ilya Voss", factionId: "whales", platform: "2% tax, double fee-shares. Deep water for everyone." },
    { name: "Juno Park", factionId: "apes", platform: "Graffiti is free speech — walls over wallets." },
  ];
  return roster.map((r, i) => ({
    id: `term${term}-cand${i}`,
    name: r.name,
    factionId: r.factionId,
    platform: r.platform,
    votes: 0,
    pendingVotes: 0,
  }));
}

export function newElection(term: number, now = Date.now()): Election {
  return {
    id: `term-${term}`,
    term,
    startsAt: now,
    endsAt: now + TERM_MS,
    candidates: seedCandidates(term),
    status: "open",
  };
}

/** A player may also run: adds a candidate record. */
export function registerCandidate(
  election: Election,
  name: string,
  factionId: FactionId | null,
  platform: string
): { election: Election; candidateId: string } {
  const candidateId = `term${election.term}-player-${Date.now().toString(36)}`;
  const candidate: ElectionCandidate = {
    id: candidateId,
    name,
    factionId,
    platform: platform.slice(0, 140),
    votes: 0,
    pendingVotes: 0,
  };
  return { election: { ...election, candidates: [...election.candidates, candidate] }, candidateId };
}

export interface CastVoteResult {
  election: Election;
  orbitxOwed: number; // real ORBITX to burn/settle later (1 per vote)
}

/**
 * Cast votes. Each vote pledges VOTE_COST_ORBITX real ORBITX (burned).
 * Until billing primitives land, they sit in `pendingVotes`.
 */
export function castVote(
  election: Election,
  candidateId: string,
  votes: number
): CastVoteResult {
  const n = Math.max(1, Math.floor(votes));
  const election2: Election = {
    ...election,
    candidates: election.candidates.map((c) =>
      c.id === candidateId ? { ...c, pendingVotes: c.pendingVotes + n } : c
    ),
  };
  return { election: election2, orbitxOwed: n * VOTE_COST_ORBITX };
}

/**
 * INTEGRATION POINT — wire to `spend()` from the tokenomics billing
 * primitive when it lands. On success, move pendingVotes → votes.
 *
 * `burn(orbitx, reason)` is injected so this module never touches
 * @/tokenomics directly (and never will).
 */
export async function settleVotes(
  election: Election,
  burn: (amount: number, reason: string) => Promise<{ signature: string }>
): Promise<{ election: Election; settled: number; signature: string | null }> {
  const owed = election.candidates.reduce((s, c) => s + c.pendingVotes, 0);
  if (owed <= 0) return { election, settled: 0, signature: null };
  const { signature } = await burn(owed, `city:mayoral-votes:${election.id}`);
  const election2: Election = {
    ...election,
    candidates: election.candidates.map((c) => ({
      ...c,
      votes: c.votes + c.pendingVotes,
      pendingVotes: 0,
    })),
  };
  return { election: election2, settled: owed, signature };
}

/** Tally: winner = most (settled) votes; ties → most pending, then earliest. */
export function tally(election: Election): Election {
  if (election.status === "closed") return election;
  const ranked = [...election.candidates].sort(
    (a, b) => b.votes - a.votes || b.pendingVotes - a.pendingVotes
  );
  const winner = ranked[0];
  return { ...election, status: "closed", winnerId: winner?.id };
}

/** Seat the winner as mayor. Returns the new office state. */
export function seatMayor(election: Election, now = Date.now()): MayorOffice {
  const winner = election.candidates.find((c) => c.id === election.winnerId);
  return {
    holderName: winner ? winner.name : "—",
    holderCandidateId: election.winnerId ?? null,
    termEndsAt: election.endsAt,
    burnTaxPct: 2, // new mayors start at 2%; they can move it
    feeShareMultiplier: 1,
  };
}

/** Mayor sets the city burn tax (0–5%). Clamped. */
export function setBurnTax(office: MayorOffice, pct: number): MayorOffice {
  return { ...office, burnTaxPct: Math.min(MAX_BURN_TAX_PCT, Math.max(0, pct)) };
}

/** Mayor sets the paper fee-share multiplier (1.0–2.0). Clamped. */
export function setFeeShareMultiplier(office: MayorOffice, mult: number): MayorOffice {
  return { ...office, feeShareMultiplier: Math.min(MAX_FEE_MULT, Math.max(1, mult)) };
}

/** ms until the current term ends (negative = overdue, call rotateTerm). */
export function msUntilTermEnd(election: Election, now = Date.now()): number {
  return election.endsAt - now;
}

/** Rotate to the next term: tally, seat mayor, open a fresh election. */
export function rotateTerm(election: Election, now = Date.now()): { election: Election; office: MayorOffice } {
  const tallied = tally(election);
  const office = seatMayor(tallied, now);
  const next = newElection(tallied.term + 1, now);
  return { election: next, office };
}
