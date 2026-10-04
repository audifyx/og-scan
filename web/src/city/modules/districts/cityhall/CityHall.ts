/**
 * 8. CITY HALL — pay fines, register firms, run for mayor in person.
 *
 * - Fines: issued by the city (integrator calls `issueFine`), payable in
 *   paper CITY. Unpaid fines add wanted stars at a threshold.
 * - Firms: register a named firm for paper CITY (standard) or real ORBITX
 *   (premium, via DistrictsBilling when live). Firms persist to localStorage.
 * - Mayor: any player can register candidacy in person; voting costs a small
 *   paper-CITY fee (anti-spam). Election state persists locally for now —
 *   marked as "local prototype" until a shared backend lands (see MODULE.md).
 */
import * as THREE from "three";
import type { DoorTrigger, FineRecord, FirmRecord, MayorCandidate, Vec3T } from "../types";
import { paperWallet } from "../paper/PaperWallet";
import type { DistrictsBilling } from "../billing";
import { premiumPriceLabel } from "../billing";

export const CITYHALL_INTERIOR_ID = "city-hall";
/** Outdoor facade footprint center — the reserved city lot (see FACADE_PLOTS). */
export const CITYHALL_FACADE_CENTER: Vec3T = [0, 0, -78];
export const CITYHALL_DOOR: DoorTrigger = {
  id: "door:cityhall",
  label: "OrbitX City Hall",
  position: [0, 0, -60],
  radius: 5,
  prompt: "Enter City Hall",
  interiorId: CITYHALL_INTERIOR_ID,
  interiorSpawn: [0, 0, 14],
  exitPosition: [0, 0, -61],
};

export const FIRM_COST_CITY = 500; // paper CITY, standard
export const FIRM_COST_PREMIUM_ORBITX = 25; // real ORBITX, premium
export const VOTE_COST_CITY = 10; // paper CITY per vote
export const CANDIDACY_COST_CITY = 1000;

const FINES_KEY = "orbitxcity:fines:v1";
const FIRMS_KEY = "orbitxcity:firms:v1";
const MAYOR_KEY = "orbitxcity:mayor:v1";

/* ---------------------------------- fines ----------------------------------- */

export function issueFine(reason: string, amountCity: number): FineRecord {
  const fine: FineRecord = {
    id: crypto.randomUUID(), reason, amountCity, issuedAt: Date.now(), paid: false,
  };
  const fines = listFines();
  fines.unshift(fine);
  try { localStorage.setItem(FINES_KEY, JSON.stringify(fines)); } catch { /* noop */ }
  return fine;
}

export function listFines(): FineRecord[] {
  try {
    const raw = localStorage.getItem(FINES_KEY);
    if (raw) return JSON.parse(raw) as FineRecord[];
  } catch { /* noop */ }
  return [];
}

export function unpaidFinesTotal(): number {
  return listFines().filter((f) => !f.paid).reduce((s, f) => s + f.amountCity, 0);
}

export function payFine(id: string): { ok: boolean; message: string } {
  const fines = listFines();
  const fine = fines.find((f) => f.id === id);
  if (!fine) return { ok: false, message: "Fine not found." };
  if (fine.paid) return { ok: false, message: "Already paid." };
  if (!paperWallet.trySpend(fine.amountCity)) {
    return { ok: false, message: `Need ${fine.amountCity} paper CITY (have ${Math.floor(paperWallet.city)}).` };
  }
  fine.paid = true;
  try { localStorage.setItem(FINES_KEY, JSON.stringify(fines)); } catch { /* noop */ }
  return { ok: true, message: `Fine paid: ${fine.amountCity} paper CITY.` };
}

export function payAllFines(): { ok: boolean; message: string; paid: number } {
  const fines = listFines().filter((f) => !f.paid);
  const total = fines.reduce((s, f) => s + f.amountCity, 0);
  if (total === 0) return { ok: true, message: "No unpaid fines.", paid: 0 };
  if (!paperWallet.trySpend(total)) {
    return { ok: false, message: `Need ${total} paper CITY (have ${Math.floor(paperWallet.city)}).`, paid: 0 };
  }
  const all = listFines().map((f) => ({ ...f, paid: true }));
  try { localStorage.setItem(FINES_KEY, JSON.stringify(all)); } catch { /* noop */ }
  return { ok: true, message: `All fines cleared: ${total} paper CITY.`, paid: total };
}

/* ---------------------------------- firms ----------------------------------- */

export function listFirms(): FirmRecord[] {
  try {
    const raw = localStorage.getItem(FIRMS_KEY);
    if (raw) return JSON.parse(raw) as FirmRecord[];
  } catch { /* noop */ }
  return [];
}

export function registerFirm(name: string, owner: string): { ok: boolean; message: string; firm?: FirmRecord } {
  const clean = name.trim().slice(0, 40);
  if (clean.length < 2) return { ok: false, message: "Firm name too short." };
  if (listFirms().some((f) => f.name.toLowerCase() === clean.toLowerCase())) {
    return { ok: false, message: "That firm name is taken." };
  }
  if (!paperWallet.trySpend(FIRM_COST_CITY)) {
    return { ok: false, message: `Registration costs ${FIRM_COST_CITY} paper CITY.` };
  }
  const firm: FirmRecord = {
    id: crypto.randomUUID(), name: clean, owner, registeredAt: Date.now(), tier: "standard",
  };
  const firms = listFirms();
  firms.unshift(firm);
  try { localStorage.setItem(FIRMS_KEY, JSON.stringify(firms)); } catch { /* noop */ }
  return { ok: true, message: `“${clean}” registered.`, firm };
}

export async function registerFirmPremium(
  name: string, owner: string, billing: DistrictsBilling
): Promise<{ ok: boolean; message: string; firm?: FirmRecord }> {
  const clean = name.trim().slice(0, 40);
  if (clean.length < 2) return { ok: false, message: "Firm name too short." };
  if (billing.state !== "live") {
    return { ok: false, message: `Premium registration (${premiumPriceLabel(FIRM_COST_PREMIUM_ORBITX, billing)}) unavailable until billing is live.` };
  }
  if (listFirms().some((f) => f.name.toLowerCase() === clean.toLowerCase())) {
    return { ok: false, message: "That firm name is taken." };
  }
  const { signature } = await billing.spendPremium({
    amount: FIRM_COST_PREMIUM_ORBITX,
    reason: "city-hall:firm-premium",
    ref: crypto.randomUUID(),
  });
  const firm: FirmRecord = {
    id: crypto.randomUUID(), name: clean, owner, registeredAt: Date.now(), tier: "premium",
  };
  const firms = listFirms();
  firms.unshift(firm);
  try { localStorage.setItem(FIRMS_KEY, JSON.stringify(firms)); } catch { /* noop */ }
  return { ok: true, message: `“${clean}” registered (premium) · sig ${signature.slice(0, 8)}…`, firm };
}

/* ---------------------------------- mayor ----------------------------------- */

interface MayorState { candidates: MayorCandidate[]; termEnds: number; }

function loadMayor(): MayorState {
  try {
    const raw = localStorage.getItem(MAYOR_KEY);
    if (raw) return JSON.parse(raw) as MayorState;
  } catch { /* noop */ }
  return {
    candidates: [
      { id: "npc-ledger", name: "Ledger Lenny", platform: "Lower paper taxes. More streetlights.", votes: 12 },
      { id: "npc-chart", name: "Chartreuse", platform: "A ticker on every corner. Green only.", votes: 9 },
    ],
    termEnds: Date.now() + 7 * 24 * 3600 * 1000,
  };
}

function saveMayor(s: MayorState) {
  try { localStorage.setItem(MAYOR_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

export function listCandidates(): MayorCandidate[] {
  return loadMayor().candidates;
}

export function registerCandidacy(name: string, platform: string): { ok: boolean; message: string } {
  const state = loadMayor();
  const clean = name.trim().slice(0, 32);
  if (clean.length < 2) return { ok: false, message: "Name too short." };
  if (state.candidates.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
    return { ok: false, message: "Already running." };
  }
  if (!paperWallet.trySpend(CANDIDACY_COST_CITY)) {
    return { ok: false, message: `Candidacy costs ${CANDIDACY_COST_CITY} paper CITY.` };
  }
  state.candidates.push({ id: crypto.randomUUID(), name: clean, platform: platform.trim().slice(0, 120) || "Make OrbitXCity great.", votes: 0 });
  saveMayor(state);
  return { ok: true, message: `You're on the ballot, ${clean}.` };
}

export function voteForMayor(candidateId: string): { ok: boolean; message: string } {
  const state = loadMayor();
  const c = state.candidates.find((x) => x.id === candidateId);
  if (!c) return { ok: false, message: "Candidate not found." };
  if (!paperWallet.trySpend(VOTE_COST_CITY)) {
    return { ok: false, message: `A vote costs ${VOTE_COST_CITY} paper CITY.` };
  }
  c.votes += 1;
  saveMayor(state);
  return { ok: true, message: `Vote counted for ${c.name}.` };
}

export function currentMayor(): MayorCandidate | null {
  const cs = loadMayor().candidates;
  if (!cs.length) return null;
  return [...cs].sort((a, b) => b.votes - a.votes)[0];
}

export function mayorTermEnds(): number {
  return loadMayor().termEnds;
}

/* --------------------------------- interior --------------------------------- */

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.15, ...opts });
}
function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function makeTextPlane(text: string, w: number, h: number, color: string, x: number, y: number, z: number) {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#0a0c10";
  ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = color;
  ctx.font = "bold 72px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 512, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z);
  return m;
}

export interface CityHallInterior {
  group: THREE.Group;
  /** Clerk desk (fines/firms), ballot box (mayor). */
  clerkPosition: Vec3T;
  ballotPosition: Vec3T;
  dispose(): void;
}

export function buildCityHallInterior(): CityHallInterior {
  const g = new THREE.Group();
  const W = 46, D = 36, H = 11;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x8a7a66, { roughness: 0.35, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x1c1a16));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H; g.add(ceil);
  const wallM = mat(0xd8cdb8);
  const mkWall = (w: number, h: number, x: number, y: number, z: number, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallM);
    m.position.set(x, y, z); m.rotation.y = ry; g.add(m);
  };
  mkWall(W, H, 0, H / 2, -D / 2);
  mkWall(W, H, 0, H / 2, D / 2, Math.PI);
  mkWall(D, H, -W / 2, H / 2, 0, Math.PI / 2);
  mkWall(D, H, W / 2, H / 2, 0, -Math.PI / 2);

  // rotunda dome hint
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(8, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x3a3428, side: THREE.BackSide })
  );
  dome.position.y = H;
  g.add(dome);

  // clerk counters (fines + firms)
  for (const sx of [-1, 1]) {
    g.add(box(9, 1.15, 2.2, 0x6b5a44, sx * 10, 0.57, 10));
    g.add(box(9, 0.12, 2.2, 0x8a7558, sx * 10, 1.2, 10));
  }
  const clerkPosition: Vec3T = [0, 0, 8.4];

  // ballot box on a pedestal
  g.add(box(2, 1.1, 2, 0x3a3f4a, 0, 0.55, -6));
  const ballot = box(1.2, 1, 1.2, 0x1c2f5a, 0, 1.6, -6);
  g.add(ballot);
  const slot = box(0.7, 0.08, 0.15, 0x0a0a0a, 0, 2.12, -6);
  g.add(slot);
  const ballotPosition: Vec3T = [0, 0, -4.4];

  // flags
  for (const sx of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 8), mat(0x888888));
    pole.position.set(sx * 16, 3, -D / 2 + 1.5);
    g.add(pole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.6),
      new THREE.MeshStandardMaterial({ color: sx < 0 ? 0xf5c518 : 0x1c2f5a, side: THREE.DoubleSide })
    );
    flag.position.set(sx * 16 + 1.35, 5, -D / 2 + 1.5);
    g.add(flag);
  }

  for (let i = -1; i <= 1; i++) {
    const l = new THREE.PointLight(0xffe9b0, 500, 45);
    l.position.set(i * 13, H - 1.5, 0);
    g.add(l);
  }

  // marble floor inlay — center medallion + border ring
  const medal = new THREE.Mesh(new THREE.CircleGeometry(3.5, 28), mat(0xcfc3a8, { roughness: 0.25 }));
  medal.rotation.x = -Math.PI / 2; medal.position.set(0, 0.02, 0); medal.receiveShadow = true;
  g.add(medal);
  const inlayRing = new THREE.Mesh(new THREE.RingGeometry(3.5, 4.1, 28), mat(0x8a7a5a, { roughness: 0.3 }));
  inlayRing.rotation.x = -Math.PI / 2; inlayRing.position.set(0, 0.021, 0);
  g.add(inlayRing);

  // clerk desks behind the counters (visitor side stays clear at clerkPosition)
  for (const sx of [-1, 1]) {
    const dx = sx * 12, dz = 13.5;
    g.add(box(4.6, 0.14, 2, 0x6b5a44, dx, 1.02, dz));
    g.add(box(0.14, 1.0, 2, 0x54452f, dx - 2.2, 0.5, dz));
    g.add(box(0.14, 1.0, 2, 0x54452f, dx + 2.2, 0.5, dz));
    g.add(box(1.1, 0.8, 0.1, 0x1a1d22, dx, 1.55, dz - 0.6)); // monitor
    const scr = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x0a0f14, emissive: 0x9fd8ff, emissiveIntensity: 0.7 })
    );
    scr.position.set(dx, 1.55, dz - 0.53); // faces the clerk (+z)
    g.add(scr);
    g.add(box(0.9, 0.5, 0.35, 0xd8cdb8, dx - 1.2, 1.3, dz + 0.3)); // paper stack
    const chair = new THREE.Group();
    chair.position.set(dx, 0, dz + 1.4);
    chair.rotation.y = Math.PI; // face the desk
    chair.add(box(0.9, 0.12, 0.9, 0x3a3f4a, 0, 0.85, 0));
    chair.add(box(0.9, 1.0, 0.12, 0x3a3f4a, 0, 1.4, 0.42));
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.85, 8), mat(0x22262c));
    post.position.y = 0.42;
    chair.add(post);
    g.add(chair);
  }

  // ballot station: voting booth + pamphlet stand beside the ballot box
  g.add(box(2.4, 2.0, 0.1, 0x4a5468, 4.5, 1.0, -7.2));
  g.add(box(0.1, 2.0, 1.6, 0x4a5468, 3.4, 1.0, -6.4));
  g.add(box(0.1, 2.0, 1.6, 0x4a5468, 5.6, 1.0, -6.4));
  g.add(box(2.2, 0.1, 1.4, 0x6b7280, 4.5, 1.05, -6.4)); // booth shelf
  const pamphlet = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.5, 8), mat(0x555c66));
  pamphlet.position.set(-3.5, 0.75, -6); g.add(pamphlet);
  const pamBoard = box(1.4, 1.0, 0.1, 0x2b2118, -3.5, 1.8, -6);
  pamBoard.rotation.x = -0.25; g.add(pamBoard);

  // waiting benches
  for (const sx of [-1, 1]) {
    g.add(box(4, 0.5, 1.2, 0x5a4632, sx * 9, 0.55, 2));
    g.add(box(4, 0.9, 0.15, 0x5a4632, sx * 9, 1.2, 2.6)); // backrest (faces -z)
    g.add(box(0.3, 0.55, 1.0, 0x3a2f22, sx * 9 - 1.7, 0.27, 2));
    g.add(box(0.3, 0.55, 1.0, 0x3a2f22, sx * 9 + 1.7, 0.27, 2));
  }

  // CITY HALL seal on the back wall
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.25, 32), mat(0xd4af37, { metalness: 0.6, roughness: 0.35 }));
  seal.rotation.x = Math.PI / 2; seal.position.set(0, 5.5, -D / 2 + 0.2);
  g.add(seal);
  const sealRing = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.12, 8, 40), mat(0x8a6d2a, { metalness: 0.6 }));
  sealRing.position.set(0, 5.5, -D / 2 + 0.2);
  g.add(sealRing);
  g.add(makeTextPlane("CITY HALL", 12, 1.6, "#f5c518", 0, 9.6, -D / 2 + 0.25));

  // potted plants in the corners
  for (const [px, pz] of [[-19, -14], [19, -14], [-19, 14], [19, 14]] as [number, number][]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 0.9, 10), mat(0x8a4a2e));
    pot.position.set(px, 0.45, pz); pot.castShadow = true;
    g.add(pot);
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 0), mat(0x2e7a3a, { roughness: 0.9 }));
    leaf.position.set(px, 1.7, pz); leaf.castShadow = true;
    g.add(leaf);
  }

  // directory board near the entrance
  g.add(box(0.12, 1.8, 0.12, 0x555c66, -7, 0.9, 13));
  g.add(box(0.12, 1.8, 0.12, 0x555c66, -5, 0.9, 13));
  g.add(box(3.2, 2.0, 0.15, 0x2b2118, -6, 2.6, 13));
  g.add(makeTextPlane("FINES · FIRMS · MAYOR", 3.0, 0.8, "#f5c518", -6, 2.6, 13.1));

  return {
    group: g,
    clerkPosition,
    ballotPosition,
    dispose() {
      g.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
    },
  };
}

/** Exterior: columned civic hall with dome. */
export function buildCityHallExterior(): THREE.Group {
  const g = new THREE.Group();
  const W = 42, H = 15, D = 26;
  g.add(box(W, H, D, 0xd9d2c2, 0, H / 2, 0));
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(9, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(0x4a7a5a, { metalness: 0.5, roughness: 0.4 })
  );
  dome.position.y = H; dome.castShadow = true;
  g.add(dome);
  for (let i = -3; i <= 3; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, H, 10), mat(0xe8e0d0));
    col.position.set(i * 5.6, H / 2, D / 2 + 1.4);
    col.castShadow = true;
    g.add(col);
  }
  for (let i = 0; i < 4; i++) g.add(box(W * 0.55, 0.45, 3, 0xa89c86, 0, 0.22 + i * 0.45, D / 2 + 3 + i * 0.8));
  g.position.set(...CITYHALL_FACADE_CENTER);
  return g;
}
