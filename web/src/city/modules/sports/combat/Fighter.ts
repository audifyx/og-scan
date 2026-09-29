/**
 * ORBITXCITY sports — shared combat model (Tournament + Dojo).
 *
 * One `Combatant` + `Duel` engine drives both the gym tournament bracket
 * and dojo sparring. The player fighter's style/mastery is owned by the
 * Dojo sim (persisted); the Tournament reads it structurally through
 * `getPlayerFighterSpec()` so the two sims stay decoupled.
 */
import * as THREE from "three";

export type FightStyleId = "street" | "boxing" | "karate" | "muaythai" | "judo" | "shadow";

export interface FightStyle {
  id: FightStyleId;
  name: string;
  icon: string;
  power: number;   // damage multiplier
  speed: number;   // attack speed / move multiplier
  defense: number; // damage reduction
  desc: string;
  premium?: boolean;
}

export const FIGHT_STYLES: FightStyle[] = [
  { id: "street",   name: "Street Brawl", icon: "🥊", power: 1.0,  speed: 1.0,  defense: 1.0,  desc: "No rules. No mercy. The default." },
  { id: "boxing",   name: "Boxing",       icon: "🥊", power: 1.1,  speed: 1.05, defense: 1.1,  desc: "Hands of stone. Great guard." },
  { id: "karate",   name: "Karate",       icon: "🥋", power: 1.15, speed: 1.1,  defense: 0.95, desc: "Crisp strikes, blinding counters." },
  { id: "muaythai", name: "Muay Thai",    icon: "🦵", power: 1.25, speed: 0.95, defense: 0.9,  desc: "Eight limbs. Elbows and knees." },
  { id: "judo",     name: "Judo",         icon: "🤼", power: 0.9,  speed: 1.15, defense: 1.25, desc: "Throws and trips. Outlast them." },
  { id: "shadow",   name: "Shadow Fist",  icon: "👤", power: 1.45, speed: 1.3,  defense: 1.15, desc: "Master style. Banned in 12 gyms.", premium: true },
];

export function fightStyle(id: FightStyleId): FightStyle {
  return FIGHT_STYLES.find((s) => s.id === id) ?? FIGHT_STYLES[0];
}

// ------------------------------------------------------------------ dojo state

const DOJO_KEY = "orbitxcity:sports:dojo:v1";

export interface DojoState {
  style: FightStyleId;
  mastery: Record<FightStyleId, number>; // 0..100 per style
  shadowUnlocked: boolean;
}

export function loadDojoState(): DojoState {
  try {
    const raw = localStorage.getItem(DOJO_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<DojoState>;
      return {
        style: p.style ?? "street",
        mastery: { street: 0, boxing: 0, karate: 0, muaythai: 0, judo: 0, shadow: 0, ...(p.mastery ?? {}) },
        shadowUnlocked: p.shadowUnlocked ?? false,
      };
    }
  } catch { /* fresh */ }
  return { style: "street", mastery: { street: 0, boxing: 0, karate: 0, muaythai: 0, judo: 0, shadow: 0 }, shadowUnlocked: false };
}

export function saveDojoState(s: DojoState): void {
  try { localStorage.setItem(DOJO_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

/** Mastery -> stat bonus: +0.2% per point, capped at +20%. */
export function masteryBonus(style: FightStyleId): number {
  return 1 + Math.min(100, loadDojoState().mastery[style] ?? 0) * 0.002;
}

export interface FighterSpec {
  name: string;
  skill: number; // 0..1, AI quality + base power
  style: FightStyleId;
  shirt: number;
}

/** The player's tournament fighter: dojo style + mastery bonus applied. */
export function getPlayerFighterSpec(name = "You"): FighterSpec & { masteryPct: number } {
  const d = loadDojoState();
  const st = fightStyle(d.style);
  const masteryPct = Math.min(100, d.mastery[d.style] ?? 0);
  return {
    name,
    style: d.style,
    shirt: 0x22d3ee,
    // skill = base 0.55 scaled by style mastery + style speed
    skill: Math.min(0.98, 0.55 + masteryPct / 100 * 0.3 + (st.speed - 1) * 0.2),
    masteryPct,
  };
}

// ------------------------------------------------------------------ combatants

export class Combatant {
  readonly spec: FighterSpec;
  readonly style: FightStyle;
  maxHp = 100;
  hp = 100;
  stamina = 100;
  blockT = 0;      // seconds of active block
  dodgeT = 0;      // i-frames remaining
  dodgeCd = 0;
  attackT = 0;     // attack animation lock
  attackCd = 0;
  hitFlash = 0;

  constructor(spec: FighterSpec) {
    this.spec = spec;
    this.style = fightStyle(spec.style);
    // skilled fighters are a little tankier
    this.maxHp = 100 + Math.round(spec.skill * 30);
    this.hp = this.maxHp;
  }

  get alive(): boolean { return this.hp > 0; }
  get hpPct(): number { return this.hp / this.maxHp; }
  get blocking(): boolean { return this.blockT > 0 && this.stamina > 5; }

  reset(): void {
    this.hp = this.maxHp;
    this.stamina = 100;
    this.blockT = 0; this.dodgeT = 0; this.dodgeCd = 0;
    this.attackT = 0; this.attackCd = 0; this.hitFlash = 0;
  }

  tick(dt: number): void {
    if (this.blockT > 0) this.blockT -= dt;
    if (this.dodgeT > 0) this.dodgeT -= dt;
    if (this.dodgeCd > 0) this.dodgeCd -= dt;
    if (this.attackT > 0) this.attackT -= dt;
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    this.stamina = Math.min(100, this.stamina + (this.blocking ? -18 : 14) * dt);
  }
}

export interface StrikeResult {
  damage: number;
  blocked: boolean;
  dodged: boolean;
  ko: boolean;
  heavy: boolean;
}

/** Resolve one strike. Call when attackT crosses the hit frame. */
export function resolveStrike(att: Combatant, def: Combatant, heavy: boolean, bonusMult = 1): StrikeResult {
  if (def.dodgeT > 0) return { damage: 0, blocked: false, dodged: true, ko: false, heavy };
  const base = heavy ? 20 + Math.random() * 12 : 9 + Math.random() * 7;
  const raw = base * att.style.power * (0.7 + att.spec.skill * 0.6) * bonusMult;
  let dmg = raw / def.style.defense;
  let blocked = false;
  if (def.blocking) {
    dmg *= 0.28;
    blocked = true;
    def.stamina = Math.max(0, def.stamina - (heavy ? 22 : 10));
  }
  dmg = Math.max(1, Math.round(dmg));
  def.hp = Math.max(0, def.hp - dmg);
  def.hitFlash = 0.18;
  return { damage: dmg, blocked, dodged: false, ko: !def.alive, heavy };
}

export type AiMove = "advance" | "retreat" | "circle" | "light" | "heavy" | "block" | "dodge" | "wait";

/** Simple but spicy AI: closes distance, mixes lights/heavies, blocks and dodges by skill. */
export function aiDecide(self: Combatant, foe: Combatant, dist: number, rng: () => number = Math.random): AiMove {
  const s = self.spec.skill;
  if (self.attackT > 0 || self.attackCd > 0) return "wait";
  // react to incoming: block or dodge
  if (foe.attackT > 0.12 && foe.attackT < 0.3 && dist < 2.6 && rng() < 0.35 + s * 0.45) {
    if (self.dodgeCd <= 0 && rng() < 0.4) return "dodge";
    return "block";
  }
  if (dist > 2.2) return rng() < 0.75 ? "advance" : "circle";
  if (dist < 0.9) return rng() < 0.5 ? "retreat" : "circle";
  const r = rng();
  if (r < 0.42 * s + 0.18) return "light";
  if (r < 0.42 * s + 0.18 + 0.22 * s && self.stamina > 35) return "heavy";
  if (r < 0.85) return "block";
  return "circle";
}

// ------------------------------------------------------------------ duel

export interface DuelCommand {
  mx: number; mz: number;      // movement dir (player)
  light: boolean; heavy: boolean; // edge-triggered
  block: boolean;             // held
  dodge: boolean;             // edge-triggered
}

export interface DuelEvent {
  kind: "hit" | "block" | "dodge" | "ko" | "timeout";
  byPlayer: boolean;
  damage: number;
  heavy: boolean;
  text: string;
}

export const DUEL_ROUND_TIME = 75;

/**
 * 2D arena duel. Player is index 0. Positions are world XZ; the engine
 * moves the AI. Reach: light 1.7m, heavy 2.0m.
 */
export class Duel {
  readonly player = new Combatant(this.playerSpec);
  readonly foe = new Combatant(this.foeSpec);
  px = new THREE.Vector3();
  fx = new THREE.Vector3();
  time = DUEL_ROUND_TIME;
  over = false;
  winner: 0 | 1 | -1 = -1; // -1 undecided
  private hitDone = false;
  private foeHitDone = false;
  private rng: () => number;

  constructor(
    private playerSpec: FighterSpec,
    private foeSpec: FighterSpec,
    private center: THREE.Vector3,
    private radius: number,
    private playerBonus = 1,
    rng?: () => number,
  ) {
    this.rng = rng ?? Math.random;
    this.px.set(center.x - 2.5, 0, center.z);
    this.fx.set(center.x + 2.5, 0, center.z);
  }

  reset(): void {
    this.player.reset();
    this.foe.reset();
    this.time = DUEL_ROUND_TIME;
    this.over = false;
    this.winner = -1;
    this.hitDone = false;
    this.foeHitDone = false;
    this.px.set(this.center.x - 2.5, 0, this.center.z);
    this.fx.set(this.center.x + 2.5, 0, this.center.z);
  }

  update(dt: number, cmd: DuelCommand): DuelEvent[] {
    const evts: DuelEvent[] = [];
    if (this.over) return evts;
    this.time -= dt;
    const P = this.player, F = this.foe;
    P.tick(dt); F.tick(dt);

    const moveSpeed = 4.6 * P.style.speed;
    // --- player movement ---
    P.blockT = cmd.block ? 0.2 : 0;
    if (!cmd.block && P.attackT <= 0) {
      this.px.x += cmd.mx * moveSpeed * dt;
      this.px.z += cmd.mz * moveSpeed * dt;
    }
    if (cmd.dodge && P.dodgeCd <= 0 && P.stamina > 20) {
      P.dodgeT = 0.45; P.dodgeCd = 1.1; P.stamina -= 20;
    }
    if (cmd.light && P.attackCd <= 0 && P.attackT <= 0) {
      P.attackT = 0.34 / P.style.speed; P.attackCd = 0.5 / P.style.speed; this.hitDone = false;
    }
    if (cmd.heavy && P.attackCd <= 0 && P.attackT <= 0 && P.stamina > 25) {
      P.attackT = 0.55 / P.style.speed; P.attackCd = 0.95 / P.style.speed; P.stamina -= 25; this.hitDone = false;
    }

    // --- AI ---
    const dist = this.px.distanceTo(this.fx);
    const mv = aiDecide(F, P, dist, this.rng);
    const aiSpeed = 4.2 * F.style.speed * (0.8 + F.spec.skill * 0.4);
    const toPlayer = new THREE.Vector3().subVectors(this.px, this.fx).setY(0);
    const dLen = Math.max(0.001, toPlayer.length());
    toPlayer.divideScalar(dLen);
    F.blockT = mv === "block" ? 0.35 : 0;
    if (mv === "advance") this.fx.addScaledVector(toPlayer, aiSpeed * dt);
    else if (mv === "retreat") this.fx.addScaledVector(toPlayer, -aiSpeed * 0.8 * dt);
    else if (mv === "circle") {
      const side = this.rng() < 0.5 ? 1 : -1;
      this.fx.x += -toPlayer.z * side * aiSpeed * 0.6 * dt;
      this.fx.z += toPlayer.x * side * aiSpeed * 0.6 * dt;
    } else if (mv === "dodge" && F.dodgeCd <= 0) {
      F.dodgeT = 0.45; F.dodgeCd = 1.2;
    } else if (mv === "light" && F.attackCd <= 0) {
      F.attackT = 0.36 / F.style.speed; F.attackCd = 0.55 / F.style.speed; this.foeHitDone = false;
    } else if (mv === "heavy" && F.attackCd <= 0 && F.stamina > 25) {
      F.attackT = 0.6 / F.style.speed; F.attackCd = 1.0 / F.style.speed; F.stamina -= 25; this.foeHitDone = false;
    }

    // --- strike resolution (hit lands mid-swing) ---
    const strike = (att: Combatant, def: Combatant, from: THREE.Vector3, to: THREE.Vector3, heavy: boolean, done: { v: boolean }, byPlayer: boolean) => {
      if (att.attackT > 0 && !done.v) {
        const total = heavy ? 0.55 / att.style.speed : 0.34 / att.style.speed;
        if (att.attackT < total * 0.55) {
          done.v = true;
          const reach = heavy ? 2.0 : 1.7;
          if (from.distanceTo(to) <= reach) {
            const r = resolveStrike(att, def, heavy, byPlayer ? this.playerBonus : 1);
            evts.push({
              kind: r.dodged ? "dodge" : r.blocked ? "block" : "hit",
              byPlayer, damage: r.damage, heavy,
              text: r.dodged ? "Dodged!" : r.blocked ? `Blocked (${r.damage})` : `${heavy ? "HEAVY" : "Hit"} ${r.damage}`,
            });
            if (r.ko) { this.finish(byPlayer ? 0 : 1, evts, true); }
          }
        }
      }
    };
    const hd = { v: this.hitDone }, fd = { v: this.foeHitDone };
    const pHeavy = P.attackT > 0 && P.attackCd > 0.5;
    strike(P, F, this.px, this.fx, pHeavy, hd, true);
    this.hitDone = hd.v;
    const fHeavy = F.attackT > 0 && F.attackCd > 0.55;
    strike(F, P, this.fx, this.px, fHeavy, fd, false);
    this.foeHitDone = fd.v;

    // --- arena bounds ---
    for (const p of [this.px, this.fx]) {
      const dx = p.x - this.center.x, dz = p.z - this.center.z;
      const d = Math.hypot(dx, dz);
      if (d > this.radius) { p.x = this.center.x + (dx / d) * this.radius; p.z = this.center.z + (dz / d) * this.radius; }
    }

    if (this.time <= 0 && !this.over) {
      this.finish(P.hpPct >= F.hpPct ? 0 : 1, evts, false);
    }
    return evts;
  }

  private finish(winner: 0 | 1, evts: DuelEvent[], byKo: boolean): void {
    this.over = true;
    this.winner = winner;
    evts.push({
      kind: byKo ? "ko" : "timeout", byPlayer: winner === 0, damage: 0, heavy: false,
      text: byKo ? (winner === 0 ? "🏆 KNOCKOUT! You win!" : "💀 Knocked out!") : (winner === 0 ? "⏱ Decision: you win!" : "⏱ Decision: you lose."),
    });
  }
}

/** Instant AI-vs-AI result for bracket matches the player isn't in. */
export function simulateAiFight(a: FighterSpec, b: FighterSpec, rng: () => number = Math.random): FighterSpec {
  const pa = 0.5 + (a.skill - b.skill) * 1.6 + (fightStyle(a.style).power - fightStyle(b.style).power) * 0.25;
  return rng() < THREE.MathUtils.clamp(pa, 0.08, 0.92) ? a : b;
}

export const AI_FIGHTER_NAMES: [string, FightStyleId, number][] = [
  ["Rico Vane", "boxing", 0.62], ["Mama Odessa", "judo", 0.55], ["Kenji Ro", "karate", 0.68],
  ["Big Tuna", "street", 0.5], ["Sable Cross", "muaythai", 0.74], ["Petit Loup", "boxing", 0.58],
  ["Iron Mabel", "judo", 0.66], ["Ghost Peppa", "karate", 0.6], ["Domino Rex", "muaythai", 0.71],
  ["Quiet Sal", "street", 0.57], ["Beto Fuego", "boxing", 0.64], ["Ayo Bankz", "karate", 0.69],
];

const SHIRTS = [0xef4444, 0xf59e0b, 0x10b981, 0x8b5cf6, 0xec4899, 0x06b6d4, 0xeab308, 0x64748b];

/** Build 7 AI opponents scaled to the player's skill. */
export function buildAiOpponents(playerSkill: number, count: number, rng: () => number = Math.random): FighterSpec[] {
  const pool = [...AI_FIGHTER_NAMES].sort(() => rng() - 0.5);
  const out: FighterSpec[] = [];
  for (let i = 0; i < count; i++) {
    const [name, style] = pool[i % pool.length];
    const jitter = (rng() - 0.5) * 0.24;
    out.push({
      name,
      style,
      skill: THREE.MathUtils.clamp(playerSkill + jitter + i * 0.015, 0.3, 0.97),
      shirt: SHIRTS[i % SHIRTS.length],
    });
  }
  // sort later rounds a touch harder (bracket seeds)
  return out;
}
