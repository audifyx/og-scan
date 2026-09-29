/**
 * 7. LIGHTHOUSE — panoramic screenshot spot.
 *
 * A striped lighthouse on the coast with a walkable gallery deck at the top.
 * The integrator teleports the player to LIGHTHOUSE_DECK when they climb it.
 * `capturePanorama` grabs the current WebGL canvas as a PNG data URL so the
 * player can save/share the view; `renderPanoramaStrip` stitches N yaw
 * captures into one wide strip (the integrator rotates the camera between
 * captures).
 *
 * NOTE: canvas capture requires the renderer be created with
 * `preserveDrawingBuffer: true`, OR capture immediately after a render in the
 * same frame. See MODULE.md.
 */
import * as THREE from "three";
import type { DoorTrigger, Vec3T } from "../types";

export const LIGHTHOUSE_INTERIOR_ID = "lighthouse";
/** The "door" here is the lighthouse base — climbing teleports to the deck. */
export const LIGHTHOUSE_DOOR: DoorTrigger = {
  id: "door:lighthouse",
  label: "OrbitX Lighthouse",
  position: [150, 0, 130],
  radius: 5,
  prompt: "Climb Lighthouse",
  interiorId: LIGHTHOUSE_INTERIOR_ID,
  interiorSpawn: [0, 0, 0],
  exitPosition: [150, 0, 125],
};

/** Deck viewpoint (world coords) — best panorama vantage. */
export const LIGHTHOUSE_DECK: Vec3T = [150, 26, 130];
export const LIGHTHOUSE_DECK_HEADING = Math.PI; // face the city

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, ...opts });
}

/** Striped tower + gallery deck + rotating beacon. Integrator adds to world. */
export function buildLighthouse(): THREE.Group {
  const g = new THREE.Group();
  const H = 26;

  // striped tower
  const stripes = 7;
  for (let i = 0; i < stripes; i++) {
    const h = H / stripes;
    const rTop = 3.4 - (i / stripes) * 0.9;
    const rBot = 3.4 - ((i + 1) / stripes) * 0.9;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBot, h + 0.05, 18),
      mat(i % 2 === 0 ? 0xf2ede2 : 0xc23b3b)
    );
    seg.position.y = i * h + h / 2;
    seg.castShadow = true;
    g.add(seg);
  }

  // gallery deck
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.5, 18), mat(0x4a4f55));
  deck.position.y = H + 0.25;
  g.add(deck);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), mat(0x2a2e33));
    rail.position.set(Math.cos(a) * 4.9, H + 1, Math.sin(a) * 4.9);
    g.add(rail);
  }
  const railTop = new THREE.Mesh(new THREE.TorusGeometry(4.9, 0.08, 8, 24), mat(0x2a2e33));
  railTop.rotation.x = Math.PI / 2;
  railTop.position.y = H + 1.55;
  g.add(railTop);

  // lamp room + beacon
  const lampGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 2.6, 12),
    new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.45, roughness: 0.1 })
  );
  lampGlass.position.y = H + 1.8;
  g.add(lampGlass);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 12), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  beacon.position.y = H + 1.8;
  beacon.name = "lighthouse-beacon";
  g.add(beacon);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(3.5, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
  );
  beam.rotation.z = Math.PI / 2;
  beam.position.set(15, H + 1.8, 0);
  beam.name = "lighthouse-beam";
  g.add(beam);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3, 2.2, 12), mat(0x2a2e33));
  roof.position.y = H + 4.2;
  g.add(roof);

  // rocks at the base
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.4 + (i % 3) * 0.5),
      mat(0x5a5f66, { roughness: 0.95 })
    );
    rock.position.set(Math.cos(a) * 6.5, 0.6, Math.sin(a) * 6.5);
    rock.rotation.set(i, i * 2, i * 3);
    g.add(rock);
  }

  g.position.set(LIGHTHOUSE_DOOR.position[0], 0, LIGHTHOUSE_DOOR.position[2]);
  return g;
}

/** Spin the beacon + beam. Call every frame with elapsed time. */
export function updateLighthouseBeacon(group: THREE.Group, t: number): void {
  const beacon = group.getObjectByName("lighthouse-beacon");
  const beam = group.getObjectByName("lighthouse-beam");
  if (beacon) {
    const m = beacon as THREE.Mesh;
    (m.material as THREE.MeshBasicMaterial).color.setHSL(0.13, 0.9, 0.55 + Math.sin(t * 4) * 0.25);
  }
  if (beam) beam.rotation.y = t * 0.6;
}

/* ------------------------------ screenshot ---------------------------------- */

/**
 * Capture the WebGL canvas as a PNG data URL. Works reliably when called
 * synchronously right after a render (same frame), or any time if the
 * renderer uses preserveDrawingBuffer:true.
 */
export function capturePanorama(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}

/** Download helper for the "save this view" button. */
export function downloadPanorama(canvas: HTMLCanvasElement, filename = "orbitxcity-panorama.png"): void {
  const url = capturePanorama(canvas);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export interface PanoramaSpot {
  id: string;
  name: string;
  position: Vec3T;
  heading: number;
  hint: string;
}

/** Curated screenshot spots (integrator wires the camera/teleport). */
export const PANORAMA_SPOTS: PanoramaSpot[] = [
  {
    id: "spot:lighthouse-deck",
    name: "Lighthouse Deck",
    position: LIGHTHOUSE_DECK,
    heading: LIGHTHOUSE_DECK_HEADING,
    hint: "Full city skyline + harbor at golden hour. Best at dayT ≈ 0.75.",
  },
  {
    id: "spot:exchange-steps",
    name: "Exchange Steps",
    position: [60, 2, -28],
    heading: Math.PI,
    hint: "Neoclassical columns with the ticker glow behind.",
  },
  {
    id: "spot:observatory-hill",
    name: "Observatory Hill",
    position: [-110, 4, -100],
    heading: 0.6,
    hint: "City lights below, dome behind. Best at night.",
  },
];
