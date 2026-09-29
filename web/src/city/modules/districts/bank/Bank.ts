/**
 * 10. ORBITX BANK — enterable bank: marble hall, teller row, vault, ATMs.
 *
 * - Exterior: stone bank facade with columns + "ORBITX BANK" sign at
 *   BANK_FACADE_CENTER (reserved city lot — see FACADE_PLOTS).
 * - Interior: teller counters, a vault door, 2 ATM kiosks (interact points),
 *   and a live ORBITX ticker strip fed by the integrator from `useLivePrices`.
 * - Money: paper CITY for safe-deposit boxes (local ledger); the vault
 *   membership burns real ORBITX through the injected DistrictsBilling
 *   (reason `city:districts:bank-vault`) — dry-run safe, never on-chain here.
 */
import * as THREE from "three";
import type { DoorTrigger, TokenQuote, Vec3T } from "../types";
import { paperWallet } from "../paper/PaperWallet";

export const BANK_INTERIOR_ID = "bank";
/** Outdoor facade footprint center — the reserved city lot (see FACADE_PLOTS). */
export const BANK_FACADE_CENTER: Vec3T = [0, 0, 10];
export const BANK_DOOR: DoorTrigger = {
  id: "door:bank",
  label: "ORBITX Bank",
  position: [0, 0, 27],
  radius: 4,
  prompt: "Enter ORBITX Bank",
  interiorId: BANK_INTERIOR_ID,
  interiorSpawn: [0, 0, 12],
  exitPosition: [0, 0, 26],
};

/** Premium vault membership: 10 ORBITX burned via the burn adapter. */
export const VAULT_COST_ORBITX = 10;
export const VAULT_BURN_REASON = "city:districts:bank-vault";
/** Safe-deposit box: paper CITY (local ledger). */
export const SAFE_BOX_COST_CITY = 500;

const STORE_KEY = "orbitxcity:bank:v1";

export interface BankState {
  vaultMember: boolean;
  boxes: number;
}

function loadBank(): BankState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<BankState>;
      return { vaultMember: p.vaultMember === true, boxes: Math.max(0, p.boxes ?? 0) | 0 };
    }
  } catch { /* noop */ }
  return { vaultMember: false, boxes: 0 };
}

function saveBank(s: BankState): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

/** Persisted bank state (vault membership survives reloads). */
export function getBankState(): BankState { return loadBank(); }

/** Buy a safe-deposit box with paper CITY. */
export function buySafeBox(): { ok: boolean; message: string } {
  if (!paperWallet.trySpend(SAFE_BOX_COST_CITY)) {
    return { ok: false, message: `Need ${SAFE_BOX_COST_CITY} paper CITY (have ${Math.floor(paperWallet.city)})` };
  }
  const s = loadBank();
  s.boxes += 1;
  saveBank(s);
  return { ok: true, message: `Safe-deposit box #${s.boxes} is yours.` };
}

/** Record a completed vault-membership burn (called after spendPremium resolves). */
export function markVaultMember(): BankState {
  const s = loadBank();
  s.vaultMember = true;
  saveBank(s);
  return s;
}

/* ---------------------------------- shared ---------------------------------- */

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3, ...opts });
}

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function makeTextPlane(text: string, w: number, h: number, color: string, x: number, y: number, z: number, bg = "#0a0c10") {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = bg;
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

/* --------------------------------- exterior --------------------------------- */

/** Stone bank facade. Integrator adds to the outdoor world group. */
export function buildBankExterior(): THREE.Group {
  const g = new THREE.Group();
  const W = 36, H = 16, D = 24;

  g.add(box(W, H, D, 0xcfc8b8, 0, H / 2, 0));
  // entablature + cornice
  g.add(box(W + 2, 1.6, D + 2, 0xbfb6a2, 0, H + 0.8, 0));
  // columns
  for (let i = -2; i <= 2; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, H, 12), mat(0xe6ddca));
    col.position.set(i * 6.5, H / 2, D / 2 + 1.6);
    col.castShadow = true;
    g.add(col);
  }
  // steps
  for (let i = 0; i < 4; i++) g.add(box(W * 0.6 - i * 1.2, 0.5, 3.4, 0x9a938a, 0, 0.25 + i * 0.5, D / 2 + 3 + i * 0.85));
  // brass sign band
  g.add(box(W * 0.66, 2.2, 0.6, 0x2a2118, 0, H - 2.6, D / 2 + 0.4));
  g.add(makeTextPlane("ORBITX BANK", W * 0.6, 1.9, "#f5c518", 0, H - 2.6, D / 2 + 0.75));
  // vault emblem (circle) above the doors
  const emblem = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 24),
    new THREE.MeshStandardMaterial({ color: 0x8a7a2a, metalness: 0.8, roughness: 0.3 }),
  );
  emblem.position.set(0, 8.5, D / 2 + 0.1);
  g.add(emblem);
  // door glow marker
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 6),
    new THREE.MeshBasicMaterial({ color: 0xf5c518, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
  );
  glow.position.set(0, 3, D / 2 + 0.2);
  g.add(glow);

  g.position.set(...BANK_FACADE_CENTER);
  return g;
}

/* --------------------------------- interior --------------------------------- */

export interface BankInterior {
  group: THREE.Group;
  /** Push fresh live quotes into the ORBITX ticker strip. */
  updateQuotes(quotes: TokenQuote[]): void;
  /** ATM kiosk positions (integrator proximity-opens <BankUI>). */
  atmPositions: Vec3T[];
  dispose(): void;
}

export function buildBankInterior(): BankInterior {
  const g = new THREE.Group();
  const W = 52, D = 40, H = 11;

  // marble floor / walls
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xd8d4c8, { roughness: 0.25, metalness: 0.1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x111318));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  g.add(ceil);
  const wallMat = mat(0x4a4438);
  const mkWall = (w: number, h: number, x: number, y: number, z: number, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    g.add(m);
  };
  mkWall(W, H, 0, H / 2, -D / 2);
  mkWall(W, H, 0, H / 2, D / 2, Math.PI);
  mkWall(D, H, -W / 2, H / 2, 0, Math.PI / 2);
  mkWall(D, H, W / 2, H / 2, 0, -Math.PI / 2);

  // skylight glow
  const sky = new THREE.PointLight(0xfff2d0, 1100, 70);
  sky.position.set(0, H - 1, 0);
  g.add(sky);

  // teller counter row (3 windows)
  for (let i = -1; i <= 1; i++) {
    const x = i * 10;
    g.add(box(7, 1.15, 1.6, 0x3a2e20, x, 0.58, -6));
    g.add(box(7, 0.18, 1.9, 0x1e1812, x, 1.2, -6));
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x9fc4d8, transparent: true, opacity: 0.3, roughness: 0.1 }),
    );
    glass.position.set(x, 2.6, -6);
    g.add(glass);
    g.add(makeTextPlane(`TELLER ${i + 2}`, 4.6, 0.9, "#f5c518", x, 4.6, -5.9));
  }

  // vault door at the back
  const vaultFrame = new THREE.Mesh(new THREE.BoxGeometry(9, 9, 1.2), mat(0x2a2e33, { metalness: 0.7 }));
  vaultFrame.position.set(0, 4.5, -D / 2 + 0.8);
  g.add(vaultFrame);
  const vaultDoor = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.4, 0.8, 28),
    mat(0x8a8f96, { metalness: 0.85, roughness: 0.35 }),
  );
  vaultDoor.rotation.x = Math.PI / 2;
  vaultDoor.position.set(0, 4.5, -D / 2 + 1.6);
  g.add(vaultDoor);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.16, 10, 24), mat(0x3a3e44, { metalness: 0.7 }));
  wheel.position.set(0, 4.5, -D / 2 + 2.2);
  g.add(wheel);
  g.add(makeTextPlane("VAULT", 6, 1.2, "#f5c518", 0, 9.6, -D / 2 + 0.9));

  // live ORBITX ticker strip above the tellers
  const tickerCanvas = document.createElement("canvas");
  tickerCanvas.width = 2048; tickerCanvas.height = 128;
  const tickerTex = new THREE.CanvasTexture(tickerCanvas);
  tickerTex.colorSpace = THREE.SRGBColorSpace;
  const ticker = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.8, 3.4), new THREE.MeshBasicMaterial({ map: tickerTex }));
  ticker.position.set(0, H - 2.4, -D / 2 + 0.3);
  g.add(ticker);

  // 2 ATM kiosks near the entrance
  const atmPositions: Vec3T[] = [];
  for (let i = 0; i < 2; i++) {
    const x = (i === 0 ? -1 : 1) * 12;
    const z = 12;
    atmPositions.push([x, 0, z]);
    g.add(box(1.8, 2.8, 1.1, 0x1a2a3a, x, 1.4, z));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), new THREE.MeshBasicMaterial({ color: 0x0e3a2a }));
    screen.position.set(x, 1.8, z - 0.6);
    screen.rotation.y = Math.PI;
    g.add(screen);
    g.add(makeTextPlane("ATM", 1.5, 0.5, "#22ff88", x, 2.9, z - 0.58));
  }

  g.add(makeTextPlane("◀ EXIT", 4, 1, "#ff5544", 0, 3.4, D / 2 - 0.3));

  function drawTicker(quotes: TokenQuote[]) {
    const ctx = tickerCanvas.getContext("2d")!;
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, 2048, 128);
    ctx.font = "bold 44px monospace";
    ctx.textBaseline = "middle";
    const orbitx = quotes.find((q) => q.symbol === "ORBITX") ?? quotes[0];
    const items = orbitx ? [orbitx, ...quotes.filter((q) => q !== orbitx)] : [];
    let x = 24;
    for (const q of items.slice(0, 8)) {
      const up = q.change24h >= 0;
      ctx.fillStyle = up ? "#22ff88" : "#ff4455";
      const px = q.price > 0 ? q.price.toFixed(q.price < 1 ? 5 : 2) : "—";
      const txt = `${q.symbol} ${px} ${up ? "▲" : "▼"}${Math.abs(q.change24h).toFixed(1)}%`;
      ctx.fillText(txt, x, 66);
      x += ctx.measureText(txt).width + 70;
    }
    if (!items.length) {
      ctx.fillStyle = "#f5c518";
      ctx.fillText("ORBITX BANK · awaiting live quotes…", 24, 66);
    }
    tickerTex.needsUpdate = true;
  }
  drawTicker([]);

  return {
    group: g,
    atmPositions,
    updateQuotes: drawTicker,
    dispose() {
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      tickerTex.dispose();
    },
  };
}

export { paperWallet };
