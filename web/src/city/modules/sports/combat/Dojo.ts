/**
 * ORBITXCITY sports — 7. Dojo (fighting styles).
 * Pick a style, train it, take the mastery into the tournament.
 * Two drills: pad timing (Space in the green zone) and dummy sparring.
 * Mastery 0..100 per style persists locally; every 25 mastery = +5% stats
 * in tournament bouts via `masteryBonus()` (see combat/Fighter.ts).
 * "Shadow Fist" master style is a real-ORBITX premium unlock, billing-gated.
 */
import * as THREE from "three";
import { SportBase, animateRun } from "../base";
import { box, labelSprite, ringMesh } from "../venues";
import type { SportInput } from "../types";
import { premiumBilling, PREMIUM_CATALOG } from "../billing";
import {
  FIGHT_STYLES, loadDojoState, saveDojoState, masteryBonus,
  type FightStyleId, type DojoState,
} from "./Fighter";

type Drill = "pads" | "spar";

export class Dojo extends SportBase {
  meta = {
    id: "dojo" as const,
    name: "Dojo",
    tagline: "Master a style. Bring it to Fight Night.",
    icon: "🥋",
    venue: "Iron Palm Dojo",
    premium: { cost: PREMIUM_CATALOG.dojoMasterStyle.cost, label: PREMIUM_CATALOG.dojoMasterStyle.label },
  };

  private drill: Drill = "pads";
  private padPhase = 0;
  private padDir = 1;
  private padStreak = 0;
  private dummyHp = 100;
  private dummy: THREE.Group | null = null;
  private swingT = 0;
  private runT = 0;

  private state(): DojoState { return loadDojoState(); }

  // ---------------------------------------------------------------- venue

  buildVenue(): THREE.Object3D[] {
    const c = this.venues.dojoHall;
    const g: THREE.Object3D[] = [];

    // wooden hall + tatami mats
    g.push(box(26, 0.3, 20, 0x6b4a2f, c.x, -0.15, c.z));
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        g.push(box(5.4, 0.12, 5.4, (i + j) % 2 === 0 ? 0x2f6b4f : 0x2a5f46, c.x - 9 + i * 6, 0.06, c.z - 6 + j * 6));
      }
    }

    // style banners
    FIGHT_STYLES.forEach((s, i) => {
      const x = c.x - 10 + i * 4;
      g.push(box(3, 5, 0.2, 0x141a24, x, 4.5, c.z - 9.6));
      const b = labelSprite(`${s.icon} ${s.name.toUpperCase()}`, { size: 5 });
      b.position.set(x, 4.5, c.z - 9.3);
      g.push(b);
    });

    // training dummy (heavy bag on a stand)
    const dg = new THREE.Group();
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0x555c66, metalness: 0.7, roughness: 0.4 }));
    stand.position.y = 1.3;
    dg.add(stand);
    const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 6, 12), new THREE.MeshStandardMaterial({ color: 0x8a2f2f, roughness: 0.85 }));
    bag.position.y = 1.55;
    bag.castShadow = true;
    dg.add(bag);
    dg.position.set(c.x + 7, 0, c.z + 3);
    this.dummy = dg;
    g.push(dg);

    // pad drill target ring (visual metronome)
    const ring = ringMesh(1.1, 0x22d3ee);
    ring.position.set(c.x - 6, 1.6, c.z + 2);
    ring.rotation.y = Math.PI / 2;
    g.push(ring);

    const label = labelSprite("IRON PALM DOJO — TRAIN YOUR STYLE", { size: 12 });
    label.position.set(c.x, 8, c.z - 8);
    g.push(label);
    return g;
  }

  // ---------------------------------------------------------------- HUD actions

  /** HUD: pick the active fighting style. */
  selectStyle(id: FightStyleId): boolean {
    const s = loadDojoState();
    const style = FIGHT_STYLES.find((f) => f.id === id);
    if (!style) return false;
    if (style.premium && !s.shadowUnlocked) {
      this.toast("👤 Shadow Fist is a master style — unlock it with ORBITX first.");
      return false;
    }
    s.style = id;
    saveDojoState(s);
    this.toast(`${style.icon} Style set: ${style.name}. Mastery ${Math.round(s.mastery[id])}/100.`);
    this.bus.emit({ type: "tick", sport: "dojo", state: this.hudState() });
    return true;
  }

  /** HUD: switch drill. */
  setDrill(d: Drill): void {
    this.drill = d;
    this.toast(d === "pads" ? "Pad drill: hit Space when the marker is GREEN." : "Sparring: wail on the bag (Space = strike).");
    this.bus.emit({ type: "tick", sport: "dojo", state: this.hudState() });
  }

  /** HUD: unlock Shadow Fist (real ORBITX, burned). */
  async unlockShadow(): Promise<{ ok: boolean; reason: string }> {
    const s = loadDojoState();
    if (s.shadowUnlocked) return { ok: true, reason: "Already unlocked." };
    const item = PREMIUM_CATALOG.dojoMasterStyle;
    const res = await premiumBilling.spend(item.cost, "dojoMasterStyle");
    if (res.ok) {
      s.shadowUnlocked = true;
      s.style = "shadow";
      saveDojoState(s);
      this.toast("👤 SHADOW FIST mastered. The dojo fears you now.");
      this.bus.emit({ type: "tick", sport: "dojo", state: this.hudState() });
    } else {
      this.toast(res.reason);
    }
    return res;
  }

  // ---------------------------------------------------------------- lifecycle

  start(): void {
    this._active = true;
    const c = this.venues.dojoHall;
    this.spawnAthlete(new THREE.Vector3(c.x - 6, 0, c.z + 2), 0xf5f5f4);
    this.snapCam(
      new THREE.Vector3(c.x - 6, 4, c.z + 9),
      new THREE.Vector3(c.x - 2, 1.5, c.z)
    );
    this.padPhase = 0; this.padDir = 1; this.padStreak = 0;
    this.toast("Dojo. Pick a style in the HUD, then train: pads (timing) or spar (bag).");
    this.bus.emit({ type: "tick", sport: "dojo", state: this.hudState() });
  }

  stop(): void {
    if (!this._active) return;
    this._active = false;
    this.despawnAthlete();
  }

  private addMastery(pts: number): void {
    const s = loadDojoState();
    const cur = s.mastery[s.style] ?? 0;
    // diminishing returns near the cap
    const gain = pts * (1 - cur / 130);
    const next = Math.min(100, cur + gain);
    s.mastery[s.style] = next;
    saveDojoState(s);
    const crossed = Math.floor(next / 25) > Math.floor(cur / 25);
    if (crossed) {
      this.toast(`🔥 ${FIGHT_STYLES.find((f) => f.id === s.style)?.name} mastery ${Math.round(next)}! +${Math.round((masteryBonus(s.style) - 1) * 100)}% tournament stats.`);
      this.style(40, "dojo milestone");
    }
  }

  update(dt: number, input: SportInput): void {
    this.elapsed += dt;
    this.runT += dt;
    const c = this.venues.dojoHall;

    if (this.drill === "pads") {
      // metronome marker: padPhase sweeps 0..1 and back
      this.padPhase += this.padDir * dt * 0.9;
      if (this.padPhase >= 1) { this.padPhase = 1; this.padDir = -1; }
      if (this.padPhase <= 0) { this.padPhase = 0; this.padDir = 1; }
      const inZone = this.padPhase > 0.42 && this.padPhase < 0.58;
      if (input.pressed1) {
        if (this.swingT <= 0) this.swingT = 0.4;
        if (inZone) {
          this.padStreak++;
          const pts = 1.6 + Math.min(4, this.padStreak * 0.4);
          this.addMastery(pts);
          this.style(6 + this.padStreak * 2, "pad strike");
          this.toast(this.padStreak >= 5 ? `🔥 x${this.padStreak} streak! +${pts.toFixed(1)} mastery` : `Clean hit! +${pts.toFixed(1)} mastery`);
        } else {
          this.padStreak = 0;
          this.toast("Too early/late — wait for GREEN.");
        }
      }
      if (this.athlete) {
        this.athlete.position.set(c.x - 6, 0, c.z + 2);
        this.athlete.rotation.y = Math.PI / 2;
      }
    } else {
      // sparring: move around the bag, strike it
      if (input.pressed1 && this.swingT <= 0) {
        this.swingT = 0.45;
        this.dummyHp = Math.max(0, this.dummyHp - 8 - Math.random() * 8);
        this.addMastery(1.1);
        this.style(8, "bag hit");
        if (this.dummy) this.dummy.rotation.z = 0.25;
        if (this.dummyHp <= 0) {
          this.dummyHp = 100;
          this.addMastery(6);
          this.toast("💥 Bag DESTROYED! +6 mastery. (It has been replaced.)");
        }
      }
      if (this.dummy) this.dummy.rotation.z *= 1 - 3 * dt;
      if (this.athlete) {
        const ax = c.x + 7 - 1.6, az = c.z + 3;
        this.athlete.position.set(ax, 0, az);
        this.athlete.rotation.y = -Math.PI / 2;
        if (input.up || input.down || input.left || input.right) animateRun(this.athlete, this.runT, 0.5);
      }
    }

    if (this.swingT > 0) {
      this.swingT -= dt;
      if (this.athlete) {
        const { armR } = this.athlete.userData.limbs as Record<string, THREE.Mesh>;
        armR.rotation.x = -1.8;
      }
    }

    if (this.athlete) this.chase(this.athlete.position, 7, 3.2);

    this.bus.emit({
      type: "tick", sport: "dojo",
      state: {
        ...this.hudState(),
        padPhase: Math.round(this.padPhase * 100) / 100,
        padStreak: this.padStreak,
        dummyHp: Math.round(this.dummyHp),
      },
    });
  }

  private hudState() {
    const s = loadDojoState();
    return {
      drill: this.drill,
      style: s.style,
      shadowUnlocked: s.shadowUnlocked,
      styles: FIGHT_STYLES.map((f) => ({
        id: f.id, name: f.name, icon: f.icon, desc: f.desc,
        premium: !!f.premium, locked: !!f.premium && !s.shadowUnlocked,
        mastery: Math.round(s.mastery[f.id] ?? 0),
        bonusPct: Math.round((masteryBonus(f.id) - 1) * 100),
        active: f.id === s.style,
      })),
      billingReady: premiumBilling.available,
    };
  }
}
