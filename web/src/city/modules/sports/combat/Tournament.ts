/**
 * ORBITXCITY sports — 6. Gym fight tournaments.
 * 8-fighter single-elimination bracket. The player's bouts are real-time
 * duels (see combat/Fighter.ts); the rest of the bracket is simulated
 * instantly, skill-weighted. AI-vs-AI sims are multiplayer-ready: a
 * `createRemoteFighter` netcode slot can replace any AI entrant later.
 * Entry is a paper-CITY wager; prizes pay paper. Golden Bracket (2x prize)
 * is a real-ORBITX premium spend, billing-gated per BILLING_CONTRACT.md.
 */
import * as THREE from "three";
import { SportBase, animateRun, createAthlete } from "../base";
import { box, zoneDisc, labelSprite } from "../venues";
import type { SportInput } from "../types";
import { premiumBilling, PREMIUM_CATALOG } from "../billing";
import {
  Duel, buildAiOpponents, simulateAiFight, getPlayerFighterSpec, masteryBonus,
  type FighterSpec, type DuelCommand, type DuelEvent,
} from "./Fighter";

type TPhase = "idle" | "fight" | "champion" | "out";

interface BracketMatch {
  a: FighterSpec | null; b: FighterSpec | null;
  winner: FighterSpec | null;
  playedByPlayer: boolean;
}

const ENTRY_FEE = 20;
const ROUND_PRIZE = [40, 110, 300]; // QF, SF, Final
const ROUND_NAMES = ["Quarterfinal", "Semifinal", "FINAL"];

export class Tournament extends SportBase {
  meta = {
    id: "tournament" as const,
    name: "Fight Tournament",
    tagline: "8 fighters. One champion. Paper on the line.",
    icon: "🥊",
    venue: "Neon Gym Arena",
    premium: { cost: PREMIUM_CATALOG.tournamentGoldenBracket.cost, label: PREMIUM_CATALOG.tournamentGoldenBracket.label },
  };

  private phase: TPhase = "idle";
  private rounds: BracketMatch[][] = [];
  private roundIdx = 0;
  private duel: Duel | null = null;
  private golden = false;
  private runT = 0;
  private foeAthlete: THREE.Group | null = null;
  private resultMsg = "";

  // ---------------------------------------------------------------- venue

  buildVenue(): THREE.Object3D[] {
    const c = this.venues.gymArena;
    const g: THREE.Object3D[] = [];

    // canvas
    const canvas = new THREE.Mesh(new THREE.CircleGeometry(7.5, 40), new THREE.MeshStandardMaterial({ color: 0x3f4756, roughness: 0.95 }));
    canvas.rotation.x = -Math.PI / 2;
    canvas.position.set(c.x, 0.02, c.z);
    canvas.receiveShadow = true;
    g.push(canvas);

    // octagon cage: 8 posts + rails
    const postMat = new THREE.MeshStandardMaterial({ color: 0x9aa3b2, metalness: 0.8, roughness: 0.35 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const px = c.x + Math.cos(a) * 7.5, pz = c.z + Math.sin(a) * 7.5;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 10), postMat);
      post.position.set(px, 1.5, pz);
      post.castShadow = true;
      g.push(post);
      const a2 = ((i + 1) / 8) * Math.PI * 2 + Math.PI / 8;
      const qx = c.x + Math.cos(a2) * 7.5, qz = c.z + Math.sin(a2) * 7.5;
      const railLen = Math.hypot(qx - px, qz - pz);
      const railBar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, railLen, 8), postMat);
      railBar.position.set((px + qx) / 2, 2.6, (pz + qz) / 2);
      railBar.rotation.z = Math.PI / 2;
      railBar.rotation.y = -Math.atan2(qz - pz, qx - px);
      g.push(railBar);
    }

    // corner stools + gym floor
    g.push(box(30, 0.3, 26, 0x1d2430, c.x, -0.15, c.z));
    for (const [sx, sz, col] of [[-1, -1, 0x22d3ee], [1, 1, 0xef4444]] as const) {
      g.push(box(1, 0.6, 1, col, c.x + sx * 9, 0.3, c.z + sz * 9));
    }

    const disc = zoneDisc(9, 0xef4444);
    disc.position.set(c.x, 0.03, c.z);
    g.push(disc);

    const label = labelSprite("NEON GYM — FIGHT NIGHT", { size: 13, color: "#ef4444" });
    label.position.set(c.x, 9, c.z - 12);
    g.push(label);
    return g;
  }

  // ---------------------------------------------------------------- lifecycle

  start(): void {
    this._active = true;
    const c = this.venues.gymArena;
    this.spawnAthlete(new THREE.Vector3(c.x, 0, c.z), 0x22d3ee);
    this.snapCam(
      new THREE.Vector3(c.x, 8, c.z + 14),
      new THREE.Vector3(c.x, 1, c.z)
    );
    this.toast("Fight Night! Space = enter bracket (20 paper). Win 3 bouts to take the crown.");
    this.bus.emit({ type: "tick", sport: "tournament", state: this.hudState() });
  }

  stop(): void {
    if (!this._active) return;
    this._active = false;
    if (this.foeAthlete) { this.ctx?.scene.remove(this.foeAthlete); this.foeAthlete = null; }
    this.despawnAthlete();
    this.duel = null;
    this.phase = "idle";
  }

  /** HUD action: enter a new bracket (entry fee in paper). */
  enterBracket(): boolean {
    if (this.phase !== "idle" && this.phase !== "champion" && this.phase !== "out") return false;
    if (!this.ledger.spend(ENTRY_FEE, "tournament entry fee")) {
      this.toast(`Need ${ENTRY_FEE} paper CITY to enter. Go earn some first!`);
      return false;
    }
    const player = getPlayerFighterSpec();
    const foes = buildAiOpponents(player.skill, 7);
    const entrants = [player, ...foes].sort(() => Math.random() - 0.5);
    this.rounds = [];
    const qf: BracketMatch[] = [];
    for (let i = 0; i < 4; i++) {
      qf.push({ a: entrants[i * 2], b: entrants[i * 2 + 1], winner: null, playedByPlayer: false });
    }
    this.rounds.push(qf);
    this.roundIdx = 0;
    this.golden = false;
    this.phase = "fight";
    this.beginPlayerBout();
    return true;
  }

  /** HUD action: upgrade to the Golden Bracket (real ORBITX, 2x prizes). */
  async buyGoldenBracket(): Promise<{ ok: boolean; reason: string }> {
    // golden only applies to the current bracket (enterBracket resets it) —
    // never burn ORBITX when there's no live bracket to apply it to
    if (this.phase !== "fight") return { ok: false, reason: "Enter a bracket first — then go Golden." };
    if (this.golden) return { ok: true, reason: "Golden Bracket already active." };
    const item = PREMIUM_CATALOG.tournamentGoldenBracket;
    const res = await premiumBilling.spend(item.cost, "tournamentGoldenBracket");
    if (res.ok) {
      this.golden = true;
      this.toast("👑 GOLDEN BRACKET — all prizes doubled!");
      this.bus.emit({ type: "tick", sport: "tournament", state: this.hudState() });
    } else {
      this.toast(res.reason);
    }
    return res;
  }

  private playerMatch(): BracketMatch | null {
    for (const m of this.rounds[this.roundIdx]) {
      if (m.a?.name === "You" || m.b?.name === "You") return m;
    }
    return null;
  }

  private beginPlayerBout(): void {
    const m = this.playerMatch();
    if (!m || !m.a || !m.b) return;
    const foe = m.a.name === "You" ? m.b : m.a;
    const c = this.venues.gymArena;
    const player = getPlayerFighterSpec();
    const bonus = masteryBonus(player.style); // dojo mastery -> tournament stat bonus
    this.duel = new Duel(player, foe, new THREE.Vector3(c.x, 0, c.z), 6.4, bonus);
    m.playedByPlayer = true;
    // spawn the foe athlete
    if (this.foeAthlete) this.ctx?.scene.remove(this.foeAthlete);
    this.foeAthlete = this.spawnFoe(foe.shirt);
    this.resultMsg = "";
    this.toast(`${ROUND_NAMES[this.roundIdx]} — ${foe.name} (${foe.style.toUpperCase()}). Space=jab · 2=heavy · 3=block · 4=dodge`);
    this.bus.emit({ type: "tick", sport: "tournament", state: this.hudState() });
  }

  private spawnFoe(shirt: number): THREE.Group {
    const g = createAthlete(shirt, 0x8a5a3b);
    this.ctx?.scene.add(g);
    return g;
  }

  // ---------------------------------------------------------------- frame

  update(dt: number, input: SportInput): void {
    this.elapsed += dt;
    this.runT += dt;
    const c = this.venues.gymArena;

    if (this.phase === "idle" || this.phase === "champion" || this.phase === "out") {
      if (input.pressed1) this.enterBracket();
      if (this.athlete) this.chase(this.athlete.position, 9, 4);
      this.bus.emit({ type: "tick", sport: "tournament", state: this.hudState() });
      return;
    }

    const duel = this.duel;
    if (!duel) return;

    const cmd: DuelCommand = {
      mx: (input.left ? -1 : 0) + (input.right ? 1 : 0),
      mz: (input.up ? -1 : 0) + (input.down ? 1 : 0),
      light: input.pressed1,
      heavy: input.pressed2,
      block: input.action3,
      dodge: input.pressed4,
    };
    // normalize diagonal
    const ml = Math.hypot(cmd.mx, cmd.mz);
    if (ml > 1) { cmd.mx /= ml; cmd.mz /= ml; }
    const evts: DuelEvent[] = duel.update(dt, cmd);
    for (const e of evts) {
      this.toast(e.text);
      if (e.kind === "ko" || e.kind === "timeout") this.onBoutOver(duel.winner === 0);
    }

    // --- athletes mirror the duel ---
    if (this.athlete) {
      this.athlete.position.set(duel.px.x, 0, duel.px.z);
      const toFoe = new THREE.Vector3().subVectors(duel.fx, duel.px);
      this.athlete.rotation.y = Math.atan2(-toFoe.x, -toFoe.z) + Math.PI;
      const P = duel.player;
      if (P.attackT > 0) {
        const { armR } = this.athlete.userData.limbs as Record<string, THREE.Mesh>;
        armR.rotation.x = -1.6;
      } else if (P.blocking) {
        const { armL, armR } = this.athlete.userData.limbs as Record<string, THREE.Mesh>;
        armL.rotation.x = -1.2; armR.rotation.x = -1.2;
      } else if (ml > 0.1) animateRun(this.athlete, this.runT, 0.7);
    }
    if (this.foeAthlete) {
      this.foeAthlete.position.set(duel.fx.x, 0, duel.fx.z);
      const toP = new THREE.Vector3().subVectors(duel.px, duel.fx);
      this.foeAthlete.rotation.y = Math.atan2(-toP.x, -toP.z) + Math.PI;
      const F = duel.foe;
      if (F.attackT > 0) {
        const { armR } = this.foeAthlete.userData.limbs as Record<string, THREE.Mesh>;
        armR.rotation.x = -1.6;
      } else if (F.blocking) {
        const { armL, armR } = this.foeAthlete.userData.limbs as Record<string, THREE.Mesh>;
        armL.rotation.x = -1.2; armR.rotation.x = -1.2;
      }
      if (F.hitFlash > 0) {
        this.foeAthlete.rotation.z = 0.15;
      } else this.foeAthlete.rotation.z = 0;
    }

    const mid = new THREE.Vector3().addVectors(duel.px, duel.fx).multiplyScalar(0.5);
    this.chase(mid, 10, 4.5);

    this.bus.emit({
      type: "tick", sport: "tournament",
      state: {
        ...this.hudState(),
        playerHp: Math.round(duel.player.hpPct * 100),
        foeHp: Math.round(duel.foe.hpPct * 100),
        foeName: this.playerMatch()?.a?.name === "You" ? this.playerMatch()?.b?.name : this.playerMatch()?.a?.name,
        time: Math.max(0, Math.round(duel.time)),
      },
    });
    void c;
  }

  private onBoutOver(playerWon: boolean): void {
    const m = this.playerMatch();
    if (!m || !m.a || !m.b) return;
    const playerSpec = getPlayerFighterSpec();
    m.winner = playerWon ? playerSpec : (m.a.name === "You" ? m.b : m.a);
    // simulate the other matches of this round instantly
    for (const om of this.rounds[this.roundIdx]) {
      if (om === m || !om.a || !om.b) continue;
      om.winner = simulateAiFight(om.a, om.b);
    }
    if (!playerWon) {
      this.phase = "out";
      this.resultMsg = `Eliminated in the ${ROUND_NAMES[this.roundIdx]}. Train at the dojo and run it back!`;
      this.toast(this.resultMsg);
      this.bus.emit({ type: "tick", sport: "tournament", state: this.hudState() });
      return;
    }
    // prize for the round
    const prize = ROUND_PRIZE[this.roundIdx] * (this.golden ? 2 : 1);
    this.ledger.earn(prize, `tournament ${ROUND_NAMES[this.roundIdx]} win${this.golden ? " (golden x2)" : ""}`);
    this.toast(`💰 +${prize} paper for the ${ROUND_NAMES[this.roundIdx]} win!`);
    if (this.roundIdx === 2) {
      this.phase = "champion";
      this.resultMsg = `🏆 CHAMPION! You took the whole bracket${this.golden ? " (GOLDEN)" : ""}.`;
      this.bus.emit({ type: "tick", sport: "tournament", state: this.hudState() });
      return;
    }
    // build next round
    const winners = this.rounds[this.roundIdx].map((x) => x.winner).filter((w): w is FighterSpec => !!w);
    const next: BracketMatch[] = [];
    for (let i = 0; i < winners.length; i += 2) {
      next.push({ a: winners[i], b: winners[i + 1] ?? winners[i], winner: null, playedByPlayer: false });
    }
    this.rounds.push(next);
    this.roundIdx++;
    this.beginPlayerBout();
  }

  private hudState() {
    return {
      phase: this.phase,
      round: this.roundIdx,
      roundName: ROUND_NAMES[this.roundIdx] ?? null,
      golden: this.golden,
      entryFee: ENTRY_FEE,
      prizes: ROUND_PRIZE.map((p) => p * (this.golden ? 2 : 1)),
      bracket: this.rounds.map((r) => r.map((m) => ({
        a: m.a?.name ?? "?", b: m.b?.name ?? "?",
        winner: m.winner?.name ?? null,
        player: m.playedByPlayer,
      }))),
      result: this.resultMsg,
      billingReady: premiumBilling.available,
    };
  }
}
