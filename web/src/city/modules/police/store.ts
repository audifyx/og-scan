/**
 * OrbitXCity — Police module store.
 *
 * Framework-agnostic class (no React import). Owns:
 *  - wanted heat model: 0–100 heat ↔ 0–5 stars, with per-player memory.
 *    Repeat offenders heat up faster (multiplier grows with lifetime
 *    offenses); unwitnessed crimes add suspicion (25% heat).
 *  - heat decay: faster when cops have lost sight of you, slower in sight.
 *  - crimes log + rap sheet (offenses, convictions, escapes, bribes,
 *    acquittals, lifetime ORBITX burned / CITY fined).
 *  - bribes: burn REAL ORBITX via the injected billing provider to wipe
 *    heat. Fail-closed: billing absent/not-ready → `billing_not_ready`.
 *  - prison: busted → sentence (serve, attempt breakout minigame state, or
 *    pay crew bail in paper CITY). Breakout escape re-adds heat.
 *  - court: each conviction schedules a hearing; pay the paper-CITY fine or
 *    play the talk-your-way-out minigame before the hearing starts.
 *
 * Persistence: localStorage (heat, rap sheet, crimes, events, sentence,
 * court — never keys). The game never custodies funds; ORBITX burns happen
 * only through the injected `OrbitxBillingProvider` (backend-signed, no
 * popups) and are mirrored here by signature + ref.
 */

import type {
  BribeResult,
  CourtCase,
  CourtRound,
  CrimeKind,
  CrimeRecord,
  CrimeReport,
  FineResult,
  OrbitxBillingProvider,
  PaperLedgerPort,
  PoliceEvent,
  PoliceEventType,
  RapSheet,
  Sentence,
  WantedStars,
} from "./types";

export const POLICE_STORAGE_KEY = "orbitxcity:police:v1";

/** Base heat per crime kind (before repeat-offender / witnessed modifiers). */
export const CRIME_HEAT: Record<CrimeKind, number> = {
  petty_theft: 8,
  assault_ped: 12,
  grand_theft_auto: 18,
  assault_officer: 25,
  reckless_driving: 6,
  heist_offense: 35,
  kill_officer: 40,
  jailbreak: 22,
};

/** Unwitnessed crimes only seed suspicion (fraction of full heat). */
export const UNWITNESSED_FACTOR = 0.25;

/** Repeat-offender multiplier: 1 + 0.25 per prior offense, capped at ×2. */
export function repeatOffenderFactor(offenses: number): number {
  return 1 + 0.25 * Math.min(Math.max(offenses, 0), 4);
}

export function heatToStars(heat: number): WantedStars {
  if (heat <= 0) return 0;
  return Math.max(1, Math.min(5, Math.ceil(heat / 20))) as WantedStars;
}

/** ORBITX bribe price per star (whole tokens, burned). */
export const BRIBE_PRICE: Record<Exclude<WantedStars, 0>, number> = {
  1: 5,
  2: 12,
  3: 25,
  4: 50,
  5: 100,
};

/** Paper-CITY fine per star when busted / convicted. */
export const FINE_PER_STAR = 400;
/** Paper-CITY crew bail per star (friends break you out). */
export const CREW_BAIL_PER_STAR = 250;
/** Real seconds of sentence per star. */
export const SENTENCE_SEC_PER_STAR = 20;
/** Heat decay per second. */
export const DECAY_IN_SIGHT = 0.6;
export const DECAY_EVADED = 2.2;
/** Heat at/above this is "wanted" (1 star). */
export const WANTED_HEAT = 1;

export interface ReportCrimeResult {
  heat: number;
  stars: WantedStars;
  record: CrimeRecord;
}

/** Court minigame rounds: talk your way out. 3 prompts; reach the threshold. */
export const COURT_ROUNDS: CourtRound[] = [
  {
    prompt: "The judge asks: \"Why were you fleeing the scene?\"",
    options: [
      { id: "a", text: "Panic — I feared for my safety.", points: 3 },
      { id: "b", text: "I didn't see the officers.", points: 1 },
      { id: "c", text: "I plead the fifth.", points: 2 },
      { id: "d", text: "I was chasing a story for the press.", points: 4 },
    ],
  },
  {
    prompt: "The prosecutor cites your record. Your response?",
    options: [
      { id: "a", text: "I've turned my life around — check my clean months.", points: 4 },
      { id: "b", text: "Those were misunderstandings, your honor.", points: 1 },
      { id: "c", text: "I take full responsibility and I'm sorry.", points: 3 },
      { id: "d", text: "My lawyer advises silence.", points: 2 },
    ],
  },
  {
    prompt: "Final statement — convince the court:",
    options: [
      { id: "a", text: "I do community work and mentor new drivers.", points: 4 },
      { id: "b", text: "The city needs people like me.", points: 1 },
      { id: "c", text: "I'll accept community service, not jail.", points: 3 },
      { id: "d", text: "It won't happen again.", points: 2 },
    ],
  },
];

/**
 * Points needed to win the court minigame. Scaled by prior convictions —
 * the court remembers you too.
 */
export function courtThreshold(convictions: number): number {
  return 8 + Math.min(convictions, 3);
}

interface StoreShape {
  heat: number;
  lastTickAt: number;
  crimes: CrimeRecord[];
  events: PoliceEvent[];
  rap: RapSheet;
  sentence: Sentence | null;
  court: CourtCase | null;
}

function uid(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e9).toString(36)}`;
}

const EMPTY_RAP: RapSheet = {
  offenses: 0,
  convictions: 0,
  escapes: 0,
  bribes: 0,
  acquittals: 0,
  orbitxBurnedOnBribes: 0,
  cityPaidInFines: 0,
};

function load(): StoreShape {
  const fresh: StoreShape = {
    heat: 0,
    lastTickAt: Date.now(),
    crimes: [],
    events: [],
    rap: { ...EMPTY_RAP },
    sentence: null,
    court: null,
  };
  try {
    const raw = localStorage.getItem(POLICE_STORAGE_KEY);
    if (!raw) return fresh;
    const p = JSON.parse(raw) as Partial<StoreShape>;
    return {
      heat: typeof p.heat === "number" ? Math.max(0, Math.min(100, p.heat)) : 0,
      lastTickAt: typeof p.lastTickAt === "number" ? p.lastTickAt : Date.now(),
      crimes: Array.isArray(p.crimes) ? p.crimes.slice(-200) : [],
      events: Array.isArray(p.events) ? p.events.slice(-200) : [],
      rap: { ...EMPTY_RAP, ...(p.rap ?? {}) },
      sentence: p.sentence ?? null,
      court: p.court ?? null,
    };
  } catch {
    return fresh;
  }
}

type Listener = () => void;

export class PoliceStore {
  private s: StoreShape = load();
  private listeners = new Set<Listener>();
  /** True once cops have lost sight (integrator/AI sets this); speeds decay. */
  evaded = true;

  /* ------------------------------ snapshots ------------------------------ */

  get heat(): number {
    return this.s.heat;
  }
  get stars(): WantedStars {
    return heatToStars(this.s.heat);
  }
  get wanted(): boolean {
    return this.s.heat >= WANTED_HEAT;
  }
  get crimes(): CrimeRecord[] {
    return this.s.crimes;
  }
  get events(): PoliceEvent[] {
    return this.s.events;
  }
  get rapSheet(): RapSheet {
    return this.s.rap;
  }
  get sentence(): Sentence | null {
    return this.s.sentence;
  }
  get court(): CourtCase | null {
    return this.s.court;
  }
  get servingTime(): boolean {
    return this.s.sentence?.status === "serving";
  }
  get bribePrice(): number | null {
    const st = this.stars;
    return st === 0 ? null : BRIBE_PRICE[st];
  }
  /** Paper fine currently due (court case awaiting payment). */
  get fineDue(): number {
    if (this.s.court && (this.s.court.status === "pending" || this.s.court.status === "convicted" || this.s.court.status === "missed")) {
      return this.s.court.fineCity;
    }
    return 0;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.persist();
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore listener errors */
      }
    });
  }

  private persist() {
    try {
      localStorage.setItem(POLICE_STORAGE_KEY, JSON.stringify(this.s));
    } catch {
      /* storage full / private mode — game continues */
    }
  }

  private log(type: PoliceEventType, detail: string) {
    this.s.events.push({ id: uid("ev"), at: Date.now(), type, detail });
    if (this.s.events.length > 200) this.s.events = this.s.events.slice(-200);
  }

  /* ------------------------------ heat model ------------------------------ */

  /**
   * Report a crime. Other modules (heists, jobs, world systems) call this.
   * Witnessed crimes apply full heat × repeat-offender multiplier;
   * unwitnessed crimes add suspicion (25% heat, same multiplier).
   */
  reportCrime(report: CrimeReport): ReportCrimeResult {
    const base = CRIME_HEAT[report.kind] ?? 5;
    const factor = repeatOffenderFactor(this.s.rap.offenses);
    const witnessedFactor = report.witnessed ? 1 : UNWITNESSED_FACTOR;
    const added = Math.round(base * factor * witnessedFactor * 10) / 10;
    const record: CrimeRecord = {
      ...report,
      id: uid("crime"),
      at: Date.now(),
      heatAdded: added,
    };
    this.s.crimes.push(record);
    if (this.s.crimes.length > 200) this.s.crimes = this.s.crimes.slice(-200);
    this.s.rap.offenses += 1;
    const wasStars = this.stars;
    this.s.heat = Math.min(100, this.s.heat + added);
    this.log(
      "crime",
      `${report.label ?? report.kind}: +${added} heat${report.witnessed ? "" : " (unwitnessed)"}${
        factor > 1 ? ` · repeat-offender ×${factor.toFixed(2)}` : ""
      }`,
    );
    if (this.stars > wasStars) {
      this.log("heat_changed", `Wanted level rose to ${this.stars} star${this.stars > 1 ? "s" : ""}`);
    }
    this.emit();
    return { heat: this.s.heat, stars: this.stars, record };
  }

  /**
   * Per-frame / per-tick decay. Call from the game loop with elapsed
   * seconds. `inSight` = any cop currently sees the player.
   */
  tick(dtSec: number, inSight: boolean): void {
    if (this.s.heat <= 0) return;
    const rate = inSight ? DECAY_IN_SIGHT : DECAY_EVADED;
    const next = Math.max(0, this.s.heat - rate * dtSec);
    const wasStars = this.stars;
    this.s.heat = next;
    if (next === 0 && wasStars > 0) {
      this.log("wanted_cleared", "You laid low — the heat is off.");
    }
    this.persist();
    if (heatToStars(next) !== wasStars) {
      this.listeners.forEach((fn) => {
        try {
          fn();
        } catch {
          /* ignore */
        }
      });
    }
  }

  /** For tests / dev: set heat directly. */
  debugSetHeat(heat: number) {
    this.s.heat = Math.max(0, Math.min(100, heat));
    this.emit();
  }

  /* ------------------------------ bribes ------------------------------ */

  /**
   * Burn REAL ORBITX (backend-signed, no popups) to wipe the slate.
   * Paper-fines logic untouched — bribes are the premium escape hatch.
   */
  async bribe(billing: OrbitxBillingProvider | undefined): Promise<BribeResult> {
    if (this.stars === 0) return { ok: false, error: "not_wanted" };
    if (!billing || !billing.ready) {
      this.log("bribe_failed", "Bribe blocked — ORBITX billing not ready.");
      this.emit();
      return { ok: false, error: "billing_not_ready" };
    }
    const amount = this.bribePrice!;
    if (billing.balance != null && billing.balance < amount) {
      this.log("bribe_failed", `Bribe blocked — need ${amount} ORBITX, wallet holds ${billing.balance}.`);
      this.emit();
      return { ok: false, error: "insufficient_balance" };
    }
    const ref = uid("police-bribe");
    try {
      const { signature } = await billing.spend({
        amount,
        reason: "city:police-bribe",
        ref,
      });
      this.s.heat = 0;
      this.s.rap.bribes += 1;
      this.s.rap.orbitxBurnedOnBribes += amount;
      this.log("bribe_paid", `Burned ${amount} ORBITX (sig ${signature.slice(0, 12)}…) — the case files "disappeared".`);
      this.emit();
      return { ok: true, signature, amount };
    } catch {
      this.log("bribe_failed", "Bribe burn failed — heat unchanged.");
      this.emit();
      return { ok: false, error: "billing_failed" };
    }
  }

  /* ------------------------------ bust / prison ------------------------------ */

  /**
   * The integrator calls this when the pursuit AI (or scripted event) busts
   * the player. Heat resets; a conviction + sentence are recorded and a
   * court date is scheduled.
   */
  bust(location?: string): Sentence {
    const stars = Math.max(1, this.stars);
    this.s.heat = 0;
    this.s.rap.convictions += 1;
    const durationSec = stars * SENTENCE_SEC_PER_STAR;
    const sentence: Sentence = {
      id: uid("sentence"),
      stars,
      durationSec,
      remainingSec: durationSec,
      startedAt: Date.now(),
      location,
      status: "serving",
    };
    this.s.sentence = sentence;
    this.log("busted", `Busted — ${stars} star${stars > 1 ? "s" : ""}. Sentenced to ${durationSec}s inside.`);
    this.log("sentence_started", `Sentence ${sentence.id} started.`);
    this.scheduleCourt(stars);
    this.emit();
    return sentence;
  }

  /** Advance the sentence clock (call from the game loop while serving). */
  tickSentence(dtSec: number): void {
    const s = this.s.sentence;
    if (!s || s.status !== "serving") return;
    s.remainingSec = Math.max(0, s.remainingSec - dtSec);
    if (s.remainingSec === 0) {
      s.status = "served";
      this.log("sentence_served", "Time served — you're a free citizen. Stay clean.");
    }
    this.persist();
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
  }

  /**
   * Attempt a jailbreak. Success chance drops with star level.
   * Win → escaped (heat jumps to 3 stars, escape on record).
   * Lose → remaining time doubles.
   */
  attemptJailbreak(): { escaped: boolean; odds: number } {
    const s = this.s.sentence;
    if (!s || s.status !== "serving") return { escaped: false, odds: 0 };
    const odds = Math.max(0.1, 0.75 - 0.12 * s.stars); // 1★ ≈ 63%, 5★ ≈ 15%
    const escaped = Math.random() < odds;
    if (escaped) {
      s.status = "escaped";
      this.s.rap.escapes += 1;
      this.s.heat = 60; // 3 stars — the whole city is looking for you
      this.log("jailbreak", `You broke out! The city is hunting you — ${heatToStars(this.s.heat)} stars.`);
      this.reportCrime({ kind: "jailbreak", witnessed: true, label: "Jailbreak" });
    } else {
      s.remainingSec = Math.min(s.durationSec * 3, s.remainingSec * 2);
      this.log("jailbreak_failed", "Breakout failed — guards doubled your remaining time.");
    }
    this.emit();
    return { escaped, odds };
  }

  /**
   * Friends break you out — paper CITY crew bail (premium-free, gameplay).
   * `crewLabel` e.g. your faction/crew name from the social module.
   */
  async crewBail(paper: PaperLedgerPort, crewLabel = "your crew"): Promise<FineResult> {
    const s = this.s.sentence;
    if (!s || s.status !== "serving") return { ok: false, error: "no_fine_due" };
    const cost = s.stars * CREW_BAIL_PER_STAR;
    const paid = await paper.debit(cost, `Crew bail — ${crewLabel}`);
    if (!paid) return { ok: false, error: "insufficient_city" };
    s.status = "escaped";
    this.s.rap.escapes += 1;
    this.s.rap.cityPaidInFines += cost;
    this.s.heat = 40; // 2 stars — you walked out, but they know
    this.log("crew_bail", `${crewLabel} posted ${cost} CITY bail — you're out, 2 stars hot.`);
    this.emit();
    return { ok: true, amount: cost };
  }

  /* ------------------------------ court ------------------------------ */

  private scheduleCourt(stars: number) {
    const c: CourtCase = {
      id: uid("court"),
      stars,
      hearingAt: Date.now() + 24 * 3600_000, // next "day"
      fineCity: stars * FINE_PER_STAR,
      status: "pending",
    };
    this.s.court = c;
    this.log("court_scheduled", `Court date set (${new Date(c.hearingAt).toLocaleDateString()}). Fine if you just pay: ${c.fineCity} CITY.`);
  }

  /**
   * Pay the paper-CITY fine to settle the case. Clears the court record
   * without a stint or minigame.
   */
  async payFine(paper: PaperLedgerPort): Promise<FineResult> {
    const c = this.s.court;
    if (!c || (c.status !== "pending" && c.status !== "convicted" && c.status !== "missed")) {
      return { ok: false, error: "no_fine_due" };
    }
    const paid = await paper.debit(c.fineCity, `Court fine — case ${c.id}`);
    if (!paid) return { ok: false, error: "insufficient_city" };
    c.status = "paid";
    this.s.rap.cityPaidInFines += c.fineCity;
    this.log("court_paid", `Paid ${c.fineCity} CITY — case closed.`);
    this.emit();
    return { ok: true, amount: c.fineCity };
  }

  /**
   * Play the court minigame: answer 3 rounds, each choice scores points.
   * Reach `courtThreshold(convictions)` → acquitted. Otherwise → convicted
   * (fine stands, +50%).
   */
  playCourtRound(roundIdx: number, optionId: string): { total: number; threshold: number; done: boolean; acquitted?: boolean } {
    const c = this.s.court;
    const threshold = courtThreshold(this.s.rap.convictions);
    if (!c || c.status !== "pending") return { total: 0, threshold, done: true };
    const round = COURT_ROUNDS[roundIdx];
    const opt = round?.options.find((o) => o.id === optionId);
    const key = `__courtScore_${c.id}`;
    const prev = Number((this as unknown as Record<string, unknown>)[key] ?? 0);
    const total = prev + (opt?.points ?? 0);
    (this as unknown as Record<string, unknown>)[key] = total;
    const done = roundIdx >= COURT_ROUNDS.length - 1;
    if (done) {
      delete (this as unknown as Record<string, unknown>)[key];
      if (total >= threshold) {
        c.status = "acquitted";
        this.s.rap.acquittals += 1;
        this.log("court_acquitted", `Talked your way out (${total}/${threshold}) — charges dropped.`);
      } else {
        c.status = "convicted";
        c.fineCity = Math.round(c.fineCity * 1.5);
        this.log("court_convicted", `The jury wasn't buying it (${total}/${threshold}) — fine raised to ${c.fineCity} CITY.`);
      }
      this.emit();
      return { total, threshold, done, acquitted: c.status === "acquitted" };
    }
    this.emit();
    return { total, threshold, done };
  }

  /** Missed the hearing → convicted automatically, fine +50%. */
  markCourtMissed() {
    const c = this.s.court;
    if (!c || c.status !== "pending") return;
    if (Date.now() >= c.hearingAt) {
      c.status = "missed";
      this.log("court_missed", "You skipped court — bench warrant energy. Fine stands, pay up.");
      this.emit();
    }
  }

  /* ------------------------------ history ------------------------------ */

  eventsFor(limit = 50): PoliceEvent[] {
    return this.s.events.slice(-limit).reverse();
  }

  clearRecord(): void {
    // Dev/testing only — a fresh start.
    this.s = {
      heat: 0,
      lastTickAt: Date.now(),
      crimes: [],
      events: [],
      rap: { ...EMPTY_RAP },
      sentence: null,
      court: null,
    };
    this.emit();
  }
}

const SINGLETON_KEY = "__orbitxcity_police_store__";

export function getPoliceStore(): PoliceStore {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g[SINGLETON_KEY]) g[SINGLETON_KEY] = new PoliceStore();
  return g[SINGLETON_KEY] as PoliceStore;
}
