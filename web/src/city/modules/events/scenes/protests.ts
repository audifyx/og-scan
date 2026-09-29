/**
 * OrbitXCity — Events module: protest marches.
 *
 * NPC crowds gather outside the HQs of rugged / crashed tokens and march
 * in place with signs and chants. The player chooses: JOIN the protest
 * (paper-CITY solidarity payout + crowd grows) or COUNTER-PROTEST
 * (spawns a rival crowd, risk/reward: bigger payout if your side "wins"
 * the noise war, nothing if it fizzles). The integrator records the
 * choice via `EventsContext.onProtestChoice` and owns any reputation
 * effects — this module only runs the crowd and the payouts.
 *
 * HQ positions come from the integrator's real rugged-token registry
 * (`EventsContext.ruggedHqs`). No fabricated HQs.
 */

import * as THREE from "three";
import type {
  CityEffectHandle,
  EventReward,
  EventsSceneHost,
  EventsWallet,
  ProtestPayload,
} from "../types";

export interface ProtestOptions {
  wallet: EventsWallet | null;
  onReward?: (reward: EventReward) => void;
}

interface Protester {
  group: THREE.Group;
  sign: THREE.Mesh;
  phase: number;
  side: "pro" | "counter";
}

const PRO_SIGNS = [
  "RUG PULLED",
  "WHERE'S THE LP?",
  "DEV DOXX NOW",
  "MY BAGS 📉",
  "SCAM!",
  "REFUND US",
];

const COUNTER_SIGNS = [
  "DIAMOND HANDS",
  "BUY THE DIP",
  "FUD OFF",
  "STILL EARLY",
  "HODL",
];

const JOIN_PAYOUT: [number, number] = [300, 900];
const COUNTER_WIN_PAYOUT: [number, number] = [800, 2000];

export function startProtest(
  host: EventsSceneHost,
  payload: ProtestPayload,
  opts: ProtestOptions
): ProtestHandle {
  const group = new THREE.Group();
  host.scene.add(group);
  const { x: hx, z: hz } = payload.hq;

  const protesters: Protester[] = [];
  const signMats: THREE.Material[] = [];

  function makeSignTexture(text: string, bg: string, fg: string): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 248, 120);
    ctx.fillStyle = fg;
    ctx.font = "bold 34px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const words = text.split(" ");
    if (words.length > 2) {
      ctx.fillText(words.slice(0, 2).join(" "), 128, 44);
      ctx.fillText(words.slice(2).join(" "), 128, 86);
    } else {
      ctx.fillText(text, 128, 64);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeProtester(side: "pro" | "counter", index: number): Protester {
    const g = new THREE.Group();
    const coat = side === "pro" ? 0xb91c1c : 0x1d4ed8;
    const mat = new THREE.MeshStandardMaterial({ color: coat, roughness: 0.75 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 4, 10), mat);
    torso.position.y = 1.15;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), skin);
    head.position.y = 1.95;
    g.add(head);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.55, 4, 8), mat);
      leg.position.set(s * 0.16, 0.45, 0);
      g.add(leg);
    }
    // sign on a stick
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2f })
    );
    stick.position.set(0.45, 2.1, 0);
    g.add(stick);
    const pool = side === "pro" ? PRO_SIGNS : COUNTER_SIGNS;
    const text = pool[index % pool.length];
    const tex = makeSignTexture(text, side === "pro" ? "#111111" : "#0b1e4b", "#ffffff");
    const signMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    signMats.push(signMat);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), signMat);
    sign.position.set(0.45, 3.0, 0);
    g.add(sign);

    // ring formation around the HQ, facing it
    const angle = (index / payload.crowdSize) * Math.PI * 2 + (side === "counter" ? 0.5 : 0);
    const radius = side === "pro" ? 14 + (index % 3) * 3 : 24 + (index % 2) * 3;
    g.position.set(hx + Math.cos(angle) * radius, 0, hz + Math.sin(angle) * radius);
    g.rotation.y = Math.atan2(hx - g.position.x, hz - g.position.z);
    group.add(g);
    return { group: g, sign, phase: Math.random() * Math.PI * 2, side };
  }

  for (let i = 0; i < payload.crowdSize; i++) {
    protesters.push(makeProtester("pro", i));
  }

  host.playSound("protest-chant", 0.6);

  let elapsed = 0;
  let choice: "join" | "counter" | null = null;
  let chantTimer = 0;
  const durationMs = 15 * 60 * 1000;

  function addCrowd(side: "counter" | "pro", count: number) {
    for (let i = 0; i < count; i++) {
      protesters.push(makeProtester(side, protesters.length + i));
    }
  }

  function payout(range: [number, number], label: string): EventReward | null {
    if (!opts.wallet) return null;
    const amount = Math.round(range[0] + Math.random() * (range[1] - range[0]));
    const balance = opts.wallet.earn(amount, label, "events:protest");
    const reward: EventReward = {
      kind: "city",
      amount,
      label: `${amount} CITY — ${label} (balance ${balance})`,
    };
    if (opts.onReward) opts.onReward(reward);
    return reward;
  }

  const handle: ProtestHandle = {
    update(dt: number): boolean {
      elapsed += dt;
      chantTimer -= dt;
      if (chantTimer <= 0) {
        chantTimer = 6 + Math.random() * 4;
        host.playSound("protest-chant", 0.35);
      }
      const t = elapsed * 5;
      for (const p of protesters) {
        // march in place + pump sign
        p.group.position.y = Math.abs(Math.sin(t + p.phase)) * 0.22;
        p.group.rotation.y += Math.sin(t * 0.5 + p.phase) * dt * 0.6;
        p.sign.rotation.z = Math.sin(t * 1.4 + p.phase) * 0.22;
        p.sign.position.y = 3.0 + Math.abs(Math.sin(t + p.phase)) * 0.3;
      }
      return elapsed * 1000 < durationMs;
    },
    dispose() {
      host.scene.remove(group);
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | undefined;
        if (mat) {
          const m = mat as THREE.MeshBasicMaterial;
          if (m.map) m.map.dispose();
          if (!signMats.includes(mat)) mat.dispose();
        }
      });
      signMats.forEach((m) => m.dispose());
    },
    /** Player joins the protest: crowd swells, solidarity payout. */
    join(): EventReward | null {
      if (choice) return null;
      choice = "join";
      addCrowd("pro", Math.ceil(payload.crowdSize * 0.4));
      host.playSound("crowd-cheer", 0.7);
      return payout(JOIN_PAYOUT, `Joined the $${payload.tokenSymbol} protest`);
    },
    /** Player counter-protests: rival crowd, noise-war gamble. */
    counterProtest(): EventReward | null {
      if (choice) return null;
      choice = "counter";
      const rivals = Math.ceil(payload.crowdSize * 0.5);
      addCrowd("counter", rivals);
      host.playSound("crowd-cheer", 0.5);
      // noise war: counter side wins if it out-shouts (55% odds, seeded by crowd)
      const win = Math.random() < 0.55;
      if (win) return payout(COUNTER_WIN_PAYOUT, "Counter-protest won the noise war");
      return null; // fizzled — no payout, crowd disperses visually via timer
    },
    getChoice: () => choice,
    protesterCount: () => protesters.length,
  };
  return handle;
}

export interface ProtestHandle extends CityEffectHandle {
  join(): EventReward | null;
  counterProtest(): EventReward | null;
  getChoice(): "join" | "counter" | null;
  protesterCount(): number;
}

/** HUD copy for the protest. */
export function protestCopy(payload: ProtestPayload): { title: string; subtitle: string } {
  const why =
    payload.reason === "rug"
      ? "rugged"
      : payload.reason === "scam"
        ? "exposed as a scam"
        : "crashed hard";
  return {
    title: `📢 PROTEST — $${payload.tokenSymbol}`,
    subtitle: `$${payload.tokenSymbol} ${why}. Holders march on HQ — join them or counter-protest. "${payload.chant}"`,
  };
}
