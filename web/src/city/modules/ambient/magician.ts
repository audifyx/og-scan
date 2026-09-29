import * as THREE from "three";
import { buildFigure } from "./npcs";
import type { AmbientAudio } from "./audio";
import type { Interactable, Buff } from "./types";

/**
 * Street magician: grants random paper-CITY flavor buffs + lore drops.
 * Buffs are flavor only (UI badge + toast). Movement-speed / stat effects
 * need a core hook — documented in MODULE.md.
 */

const BUFF_POOL: { id: string; label: string; icon: string; note: string }[] = [
  { id: "luck", label: "Lucky Streak", icon: "🍀", note: "The next coin you flip feels rigged in your favor." },
  { id: "chart", label: "Chart Whisperer", icon: "📈", note: "Candles look… legible. Suspiciously legible." },
  { id: "siren", label: "Siren Bait", icon: "🚨", note: "Chaos finds you 20% faster. Sorry." },
  { id: "gold", label: "Midas Touch", icon: "✨", note: "Tips and finds sparkle a little more." },
  { id: "ghost", label: "Ghost Protocol", icon: "👻", note: "Peds give you a wider berth." },
  { id: "vault", label: "Vault Mind", icon: "🧠", note: "You remember every candle you've ever seen." },
];

const LORE_DROPS: string[] = [
  "They say the first block of OrbitXCity was mined from a parking ticket.",
  "The whales sleep under the marina. You can hear their algos at night.",
  "Every billboard here once advertised a rug. Now they advertise the memory of the rug.",
  "The subway performers aren't busking. They're broadcasting.",
  "Madame Zola saw the crash of '24 coming. She just didn't tell anyone.",
  "The radio host? Used to run a hedge fund. Now he runs his mouth.",
  "There's a vault under the exchange with one candle that never closes.",
  "Pigeons here front-run. Watch your crumbs.",
];

export class Magician {
  private scene: THREE.Scene;
  private audio: AmbientAudio;
  private fig: ReturnType<typeof buildFigure>;
  private pos = new THREE.Vector3(-8, 0, 34);
  private cooldownUntil = 0;
  private phase = 0;
  private onBuff: (b: Buff) => void;
  private onLore: (text: string) => void;

  constructor(scene: THREE.Scene, audio: AmbientAudio, onBuff: (b: Buff) => void, onLore: (text: string) => void) {
    this.scene = scene;
    this.audio = audio;
    this.onBuff = onBuff;
    this.onLore = onLore;
    this.fig = buildFigure({ shirt: 0x1a1a2e, pants: 0x1a1a2e, hair: 0x0c0c0c, scale: 1.02 });
    this.fig.group.position.copy(this.pos);
    this.fig.group.rotation.y = Math.PI * 0.25;
    // top hat
    const hat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.15, 0.28, 12),
      new THREE.MeshStandardMaterial({ color: 0x0c0c12, roughness: 0.5 }),
    );
    hat.position.y = 1.98;
    this.fig.group.add(hat);
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.03, 14),
      new THREE.MeshStandardMaterial({ color: 0x0c0c12, roughness: 0.5 }),
    );
    brim.position.y = 1.86;
    this.fig.group.add(brim);
    this.scene.add(this.fig.group);
  }

  /** Interact: random buff OR lore drop (70/30). 30s cooldown. */
  act(): void {
    const now = performance.now();
    if (now < this.cooldownUntil) return;
    this.cooldownUntil = now + 30000;
    this.audio.chime();
    if (Math.random() < 0.7) {
      const p = BUFF_POOL[(Math.random() * BUFF_POOL.length) | 0];
      this.onBuff({
        id: `magician:${p.id}`,
        label: p.label,
        icon: p.icon,
        endsAt: performance.now() + (45 + Math.random() * 45) * 1000,
        note: p.note,
      });
    } else {
      this.onLore(LORE_DROPS[(Math.random() * LORE_DROPS.length) | 0]);
    }
  }

  getInteractable(): Interactable {
    return {
      x: this.pos.x, z: this.pos.z, radius: 3.2,
      label: "🎩 Ask the magician for a trick",
      act: () => this.act(),
    };
  }

  update(dt: number) {
    this.phase += dt * 1.6;
    this.fig.update(dt, 0.05);
    this.fig.group.rotation.y = Math.PI * 0.25 + Math.sin(this.phase) * 0.15;
  }

  dispose() {
    this.scene.remove(this.fig.group);
    this.fig.dispose();
  }
}
