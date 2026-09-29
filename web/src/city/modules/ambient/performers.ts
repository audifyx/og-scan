import * as THREE from "three";
import { buildFigure } from "./npcs";
import type { CityLedger } from "./ledger";
import type { AmbientAudio } from "./audio";
import type { Interactable } from "./types";

/**
 * Subway performers: buskers with tip jars. Interact to tip paper CITY;
 * ambient passersby also drop coins. All paper-CITY (local ledger).
 */

export interface Busker {
  pos: THREE.Vector3;
  name: string;
  instrument: "guitar" | "sax" | "drums";
  tips: number;
}

const INSTRUMENTS: Busker["instrument"][] = ["guitar", "sax", "drums"];
const NAMES = ["Dez", "Marlow", "Kiki", "Rook", "Sable", "Juno"];

function instrumentMesh(kind: Busker["instrument"]): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.6 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.7 });
  if (kind === "guitar") {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), wood);
    body.scale.set(1, 1.25, 0.5);
    body.position.set(0.18, 0, 0.18);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.7, 0.06), wood);
    neck.position.set(0.3, 0.35, 0.2);
    neck.rotation.z = -0.5;
    g.add(body, neck);
  } else if (kind === "sax") {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.75, 10), brass);
    tube.position.set(0.15, 0.05, 0.22);
    tube.rotation.x = 0.5;
    g.add(tube);
  } else {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.3, 14), wood);
    drum.position.set(0, -0.25, 0.35);
    g.add(drum);
  }
  g.traverse((o) => { (o as THREE.Mesh).castShadow = false; });
  return g;
}

const TIP_COST = 3;

export class PerformerManager {
  private scene: THREE.Scene;
  private ledger: CityLedger;
  private audio: AmbientAudio;
  private busksArr: { data: Busker; group: THREE.Group; jar: THREE.Mesh; fig: ReturnType<typeof buildFigure>; phase: number }[] = [];
  private tipTimer = 0;
  private onTip: (earned: number) => void;

  /** onTip fires whenever tips land (busker or crowd) so the host can toast. */
  constructor(scene: THREE.Scene, ledger: CityLedger, audio: AmbientAudio, onTip: (earned: number) => void) {
    this.scene = scene;
    this.ledger = ledger;
    this.audio = audio;
    this.onTip = onTip;
    const spots: [number, number][] = [[14, 26], [-22, 12], [30, -18]];
    for (let i = 0; i < spots.length; i++) {
      const [x, z] = spots[i];
      const data: Busker = {
        pos: new THREE.Vector3(x, 0, z),
        name: NAMES[i % NAMES.length],
        instrument: INSTRUMENTS[i % INSTRUMENTS.length],
        tips: 0,
      };
      const fig = buildFigure({ shirt: 0x6b4a8a, scale: 1.0 });
      fig.group.position.copy(data.pos);
      fig.group.rotation.y = Math.random() * Math.PI * 2;
      const inst = instrumentMesh(data.instrument);
      inst.position.set(0, 1.35, 0);
      fig.group.add(inst);
      // tip jar
      const jar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.26, 0.25, 12),
        new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.5, metalness: 0.6 }),
      );
      jar.position.set(data.pos.x + 0.9, 0.13, data.pos.z + 0.6);
      this.scene.add(fig.group, jar);
      this.busksArr.push({ data, group: fig.group, jar, fig, phase: Math.random() * 10 });
    }
  }

  /** Player tips a busker `TIP_COST` paper CITY. */
  tip(i: number): boolean {
    const b = this.busksArr[i];
    if (!b) return false;
    if (!this.ledger.spend(TIP_COST, `busker-tip:${b.data.name}`)) return false;
    this.credit(i, TIP_COST);
    return true;
  }

  private credit(i: number, amount: number) {
    const b = this.busksArr[i];
    b.data.tips += amount;
    this.ledger.earn(amount, `busker-tips:${b.data.name}`);
    this.audio.coin();
    // jar bounce
    b.jar.position.y = 0.13;
    (b as any).__bounce = 1;
    this.onTip(amount);
  }

  getInteractables(): Interactable[] {
    return this.busksArr.map((b, i) => ({
      x: b.data.pos.x,
      z: b.data.pos.z,
      radius: 3.2,
      label: `Tip ${b.data.name} (${b.data.instrument}) — ${TIP_COST} CITY`,
      act: () => { this.tip(i); },
    }));
  }

  update(dt: number) {
    this.tipTimer += dt;
    // Ambient crowd tips land on their own (~1 tip per busker per ~25s).
    if (this.tipTimer > 25) {
      this.tipTimer = 0;
      const i = (Math.random() * this.busksArr.length) | 0;
      this.credit(i, 1 + ((Math.random() * 3) | 0));
    }
    for (const b of this.busksArr) {
      b.phase += dt * 3;
      b.fig.update(dt, 0.12); // swaying while playing
      b.group.rotation.z = Math.sin(b.phase) * 0.04;
      const bounce = (b as any).__bounce as number | undefined;
      if (bounce && bounce > 0) {
        (b as any).__bounce = bounce - dt * 3;
        b.jar.position.y = 0.13 + Math.sin((1 - bounce) * Math.PI) * 0.35;
      }
    }
  }

  dispose() {
    for (const b of this.busksArr) {
      this.scene.remove(b.group, b.jar);
      b.fig.dispose();
    }
    this.busksArr = [];
  }
}

export const BUSK_TIP_COST = TIP_COST;
