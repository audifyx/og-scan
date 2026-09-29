/**
 * ORBITXCITY — Factions module: persisted store.
 *
 * Single source of truth for all faction state. Persists to localStorage
 * (`orbitx-city-factions-v1`), ticks district yields on load, and rotates
 * election terms when overdue. React subscribes via `useFactions()`.
 *
 * Paper CITY ledger only — no chain, no keys. Real-ORBITX paths
 * (vote settlement) are exposed but inert until billing primitives land.
 */
import type { FactionsState, FactionId } from "./types";
import { buildDistricts, tickDistricts, declareWar, stakeBonds, resolveWarRound, activeWars } from "./turf";
import { buildWalls, tagWall, overpaintTags, challengeCrew, startWar, addWarTag, judgeWar, wallBuffPct } from "./graffiti";
import { newElection, rotateTerm, castVote, settleVotes, registerCandidate, setBurnTax, setFeeShareMultiplier } from "./elections";
import { blankProfile, joinFaction, leaveFaction, awardRep, contributeToFirm, FACTIONS } from "./factions";

const STORAGE_KEY = "orbitx-city-factions-v1";

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function initialState(): FactionsState {
  const election = newElection(1);
  return {
    version: 1,
    player: blankProfile(),
    districts: buildDistricts(),
    wars: [],
    walls: buildWalls(),
    tags: [],
    graffitiWars: [],
    election,
    office: {
      holderName: "—",
      holderCandidateId: null,
      termEndsAt: election.endsAt,
      burnTaxPct: 2,
      feeShareMultiplier: 1,
    },
    paperEarned: 0,
    feed: [{ at: Date.now(), text: "Welcome to OrbitXCity. Four firms run these streets — pick your colors." }],
  };
}

function load(): FactionsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const s = JSON.parse(raw) as FactionsState;
    if (s.version !== 1 || !s.districts?.length) return initialState();
    return s;
  } catch {
    return initialState();
  }
}

function save(s: FactionsState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage full/blocked — game continues in-memory */
  }
}

type Listener = () => void;

export class FactionsStore {
  private state: FactionsState;
  private listeners = new Set<Listener>();
  private lastTick = Date.now();

  constructor() {
    this.state = load();
    // catch-up: accrue district yields + rotate overdue election terms
    this.catchUp();
  }

  /* ------------------------------ core plumbing ------------------------------ */

  getState(): FactionsState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(patch: (s: FactionsState) => FactionsState, feedText?: string): void {
    let next = patch(this.state);
    if (feedText) {
      const feed = [{ at: Date.now(), text: feedText }, ...next.feed].slice(0, 60);
      next = { ...next, feed };
    }
    this.state = next;
    save(this.state);
    for (const l of this.listeners) l();
  }

  /** Accrue district yields since lastTick; rotate elections when overdue. */
  catchUp(): void {
    const now = Date.now();
    const dtHours = Math.min((now - this.lastTick) / 3600000, 24); // cap 24h
    this.lastTick = now;
    if (dtHours <= 0) return;
    const { districts, skim } = tickDistricts(
      this.state.districts,
      dtHours,
      this.state.office.feeShareMultiplier
    );
    // the player's cut of their firm's fee-share lands in paper earnings
    const myFirm = this.state.player.factionId;
    const myShare = myFirm ? Math.floor(skim[myFirm]) : 0;
    let election = this.state.election;
    let office = this.state.office;
    if (now >= election.endsAt) {
      const rotated = rotateTerm(election, now);
      election = rotated.election;
      office = rotated.office;
    }
    this.state = {
      ...this.state,
      districts,
      election,
      office,
      paperEarned: this.state.paperEarned + myShare,
    };
    if (myShare > 0) this.state.feed = [{ at: now, text: `Your firm skimmed ${myShare} CITY from its turf.` }, ...this.state.feed].slice(0, 60);
    save(this.state);
  }

  /**
   * Judge any live graffiti wars whose clock has expired (no new tags needed).
   * Integrators should call this on an interval (e.g. every 5s) and/or when
   * the module UI opens.
   */
  tickWarClocks(): void {
    const now = Date.now();
    let judgedId: string | null = null;
    let judgedNote: string | undefined;
    const graffitiWars = this.state.graffitiWars.map((w) => {
      if (w.status === "live" && w.startedAt && now - w.startedAt >= w.durationSec * 1000) {
        const j = judgeWar(w);
        judgedId = j.id;
        judgedNote = j.judgeNote;
        return j;
      }
      return w;
    });
    if (!judgedId) return;
    this.emit((s) => ({ ...s, graffitiWars }), judgedNote);
    this.applyGraffitiWarOutcome(judgedId);
  }

  /* ------------------------------ membership ------------------------------ */

  join(id: FactionId): void {
    const p = this.state.player;
    this.emit(
      (s) => ({ ...s, player: joinFaction(p, id) }),
      p.factionId === id ? undefined : `You run with the ${FACTIONS[id].name} now. ${FACTIONS[id].motto}`
    );
  }

  leave(): void {
    const p = this.state.player;
    if (!p.factionId) return;
    const name = FACTIONS[p.factionId].name;
    this.emit((s) => ({ ...s, player: leaveFaction(p) }), `You walked away from the ${name}.`);
  }

  addRep(amount: number): boolean {
    if (!this.state.player.factionId) return false;
    let promoted = false;
    this.emit((s) => {
      const r = awardRep(s.player, amount);
      promoted = r.promoted;
      return { ...s, player: r.profile };
    });
    return promoted;
  }

  /** Paper CITY → firm war chest (1 rep per 10 CITY). Returns paper owed by caller. */
  contribute(paperCity: number): number {
    const p = this.state.player;
    if (!p.factionId || paperCity <= 0) return 0;
    const owed = Math.floor(paperCity);
    this.emit(
      (s) => ({ ...s, player: contributeToFirm(p, owed).profile }),
      `Contributed ${owed} CITY to the ${FACTIONS[p.factionId!].name} war chest.`
    );
    return owed;
  }

  /* ------------------------------ turf wars ------------------------------ */

  declareTurfWar(districtId: string, stake: number): string | null {
    const p = this.state.player;
    const district = this.state.districts.find((d) => d.id === districtId);
    if (!p.factionId || !district) return null;
    if (activeWars(this.state.wars, districtId).length > 0) return null;
    if (district.controller === p.factionId) return null;
    const id = uid("war");
    this.emit(
      (s) => ({ ...s, wars: [...s.wars, declareWar(district, p.factionId!, stake, id)] }),
      `${FACTIONS[p.factionId].name} declared war for ${district.name} — ${stake} CITY staked.`
    );
    return id;
  }

  stakeWar(warId: string, amount: number): void {
    const p = this.state.player;
    if (!p.factionId || amount <= 0) return;
    this.emit((s) => {
      const war = s.wars.find((w) => w.id === warId);
      if (!war) return s;
      return { ...s, wars: s.wars.map((w) => (w.id === warId ? stakeBonds(w, p.factionId!, amount) : w)) };
    }, `${FACTIONS[p.factionId].name} added ${amount} CITY to the war bonds.`);
  }

  /** Advance one round of a war. Returns the war's new status. */
  advanceWar(warId: string): string | null {
    const war = this.state.wars.find((w) => w.id === warId);
    if (!war) return null;
    const district = this.state.districts.find((d) => d.id === war.districtId);
    if (!district) return null;
    const { war: w2, district: d2 } = resolveWarRound(war, district);
    this.emit((s) => ({
      ...s,
      wars: s.wars.map((w) => (w.id === warId ? w2 : w)),
      districts: s.districts.map((d) => (d.id === d2.id ? d2 : d)),
    }));
    const last = w2.log[w2.log.length - 1];
    if (last) this.emit((s) => s, last); // feed entry
    return w2.status;
  }

  /* ------------------------------ graffiti ------------------------------ */

  /** Tag a wall. Returns the paper CITY cost (caller deducts from their ledger). */
  tag(wallId: string, painterLabel: string): { cost: number; stolen: boolean } | null {
    const p = this.state.player;
    const wall = this.state.walls.find((w) => w.id === wallId);
    if (!p.factionId || !wall) return null;
    const { wall: w2, tag, cost, stolen } = tagWall(wall, p.factionId, painterLabel, p.rep, uid("tag"));
    let promoted = false;
    this.emit((s) => {
      const r = awardRep(p, tag.style);
      promoted = r.promoted;
      return {
        ...s,
        walls: s.walls.map((w) => (w.id === wallId ? w2 : w)),
        tags: overpaintTags([...s.tags, tag], wallId, p.factionId!),
        player: r.profile,
      };
    }, stolen
      ? `${painterLabel} overpainted ${wall.name} for the ${FACTIONS[p.factionId].name}!`
      : `${painterLabel} tagged ${wall.name} for the ${FACTIONS[p.factionId].name}.`);
    void promoted;
    return { cost, stolen };
  }

  playerWallBuff(): number {
    const p = this.state.player;
    if (!p.factionId) return 0;
    return wallBuffPct(p.factionId, this.state.walls);
  }

  /* ------------------------------ graffiti wars ------------------------------ */

  challenge(wallId: string, pot: number): string | null {
    const p = this.state.player;
    const wall = this.state.walls.find((w) => w.id === wallId);
    if (!p.factionId || !wall) return null;
    // pick the strongest rival crew (most walls held, not us)
    const counts = new Map<FactionId, number>();
    for (const wl of this.state.walls) if (wl.heldBy && wl.heldBy !== p.factionId)
      counts.set(wl.heldBy, (counts.get(wl.heldBy) ?? 0) + 1);
    const rival = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!rival) return null;
    const id = uid("gwar");
    this.emit(
      (s) => ({ ...s, graffitiWars: [...s.graffitiWars, challengeCrew(wall, p.factionId!, rival, pot, id)] }),
      `${FACTIONS[p.factionId].name} challenged ${FACTIONS[rival].name} to a tag-off at ${wall.name}!`
    );
    return id;
  }

  startGraffitiWar(warId: string): void {
    this.emit((s) => ({
      ...s,
      graffitiWars: s.graffitiWars.map((w) => (w.id === warId ? startWar(w) : w)),
    }), "The tag-off is live — the city is watching.");
  }

  /** Player paints during a live war. Returns style points added. */
  warTag(warId: string, painterLabel: string): number {
    const p = this.state.player;
    const war = this.state.graffitiWars.find((w) => w.id === warId);
    if (!p.factionId || !war || war.status !== "live") return 0;
    if (p.factionId !== war.crewA && p.factionId !== war.crewB) return 0;
    const style = 10 + Math.floor(Math.min(p.rep, 3000) / 100);
    let judged: string | null = null;
    this.emit((s) => {
      const w2 = addWarTag(war, p.factionId!, style);
      if (w2.status === "judged" && war.status !== "judged") judged = w2.judgeNote ?? null;
      return { ...s, graffitiWars: s.graffitiWars.map((x) => (x.id === warId ? w2 : x)) };
    });
    if (judged) {
      this.emit((s) => s, judged);
      this.applyGraffitiWarOutcome(warId);
    }
    void painterLabel;
    return style;
  }

  private applyGraffitiWarOutcome(warId: string): void {
    const war = this.state.graffitiWars.find((w) => w.id === warId);
    if (!war || war.status !== "judged" || !war.winner) return;
    this.emit((s) => ({
      ...s,
      walls: s.walls.map((w) =>
        w.id === war.wallId ? { ...w, heldBy: war.winner ?? null, style: war.winner === war.crewA ? war.tagsA : war.tagsB } : w
      ),
      paperEarned: s.paperEarned + (s.player.factionId === war.winner ? war.pot : 0),
    }), war.winner ? `${FACTIONS[war.winner].name} takes the wall and the ${war.pot} CITY pot!` : undefined);
  }

  /* ------------------------------ elections ------------------------------ */

  vote(candidateId: string, votes: number): number {
    if (votes <= 0) return 0;
    const { election, orbitxOwed } = castVote(this.state.election, candidateId, votes);
    const cand = election.candidates.find((c) => c.id === candidateId);
    this.emit(
      (s) => ({ ...s, election }),
      `You pledged ${orbitxOwed} ORBITX for ${cand?.name ?? "a candidate"}. Burns settle when billing lands.`
    );
    return orbitxOwed;
  }

  runForMayor(name: string, platform: string): string | null {
    const p = this.state.player;
    const { election, candidateId } = registerCandidate(this.state.election, name, p.factionId, platform);
    this.emit((s) => ({ ...s, election }), `${name} is running for mayor!`);
    return candidateId;
  }

  /** Mayor-only: set burn tax. Returns false when the caller isn't mayor. */
  mayorSetBurnTax(pct: number, isMayor: boolean): boolean {
    if (!isMayor) return false;
    this.emit(
      (s) => ({ ...s, office: setBurnTax(s.office, pct) }),
      `The mayor set the city burn tax to ${Math.min(5, Math.max(0, pct))}%.`
    );
    return true;
  }

  mayorSetFeeMult(mult: number, isMayor: boolean): boolean {
    if (!isMayor) return false;
    this.emit(
      (s) => ({ ...s, office: setFeeShareMultiplier(s.office, mult) }),
      `The mayor set the firm fee-share multiplier to ${Math.min(2, Math.max(1, mult))}×.`
    );
    return true;
  }

  /** Pending ORBITX across all candidates (unsettled votes). */
  pendingOrbitx(): number {
    return this.state.election.candidates.reduce((s, c) => s + c.pendingVotes, 0);
  }

  /**
   * INTEGRATOR WIRING (checklist item 5) — settle pending mayoral votes with
   * real ORBITX burns. `burn` is injected by the host (tokenomics billing
   * `spend()`); the module never touches @/tokenomics directly.
   * Fail-closed: a burn throw leaves every pledge in `pendingVotes`.
   */
  async settlePendingVotes(
    burn: (amount: number, reason: string) => Promise<{ signature: string }>
  ): Promise<{ settled: number; signature: string | null }> {
    const owed = this.pendingOrbitx();
    if (owed <= 0) return { settled: 0, signature: null };
    const { election, settled, signature } = await settleVotes(this.state.election, burn);
    this.emit(
      (s) => ({ ...s, election }),
      `Settled ${settled} ORBITX in mayoral votes — burn ${signature?.slice(0, 8)}…`
    );
    return { settled, signature };
  }

  /* ------------------------------ maintenance ------------------------------ */

  reset(): void {
    this.state = initialState();
    save(this.state);
    for (const l of this.listeners) l();
  }
}

let singleton: FactionsStore | null = null;

/** Module singleton. The integrator creates ONE and passes it via context. */
export function getFactionsStore(): FactionsStore {
  if (!singleton) singleton = new FactionsStore();
  return singleton;
}
