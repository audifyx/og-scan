/**
 * 12. ORBITX MARKET — enterable corner shops: strip-mall storefront, stocked
 * aisles, checkout counter.
 *
 * - Exterior: storefront facade at SHOPS_FACADE_CENTER (reserved city lot —
 *   see FACADE_PLOTS) with glass front + "ORBITX MARKET" sign.
 * - Interior: 3 stocked aisles, checkout counter (interact point), neon OPEN.
 * - Sales: everyday items cost paper CITY (local ledger); the premium
 *   cosmetics burn real ORBITX through the injected DistrictsBilling
 *   (reason `city:districts:shop:<id>`). Inventory persists per device.
 */
import * as THREE from "three";
import type { DoorTrigger, Vec3T } from "../types";
import { paperWallet } from "../paper/PaperWallet";
import type { DistrictsBilling } from "../billing";

export const SHOPS_INTERIOR_ID = "shops";
/** Outdoor facade footprint center — the reserved city lot (see FACADE_PLOTS). */
export const SHOPS_FACADE_CENTER: Vec3T = [156, 0, 0];
export const SHOPS_DOOR: DoorTrigger = {
  id: "door:shops",
  label: "OrbitX Market",
  position: [156, 0, 15],
  radius: 4,
  prompt: "Enter OrbitX Market",
  interiorId: SHOPS_INTERIOR_ID,
  interiorSpawn: [0, 0, 10],
  exitPosition: [156, 0, 14],
};

export interface ShopItem {
  id: string;
  icon: string;
  name: string;
  blurb: string;
  /** Paper-CITY price (0 when premium-only). */
  priceCity: number;
  /** Real-ORBITX burn price (0 when paper-only). */
  priceOrbitx: number;
}

/** Store catalog — game items with honest prices, never mock market data. */
export const SHOP_CATALOG: ShopItem[] = [
  { id: "turbo-coffee", icon: "☕", name: "Turbo Coffee", blurb: "Sprint longer. Tastes like uptime.", priceCity: 50, priceOrbitx: 0 },
  { id: "repair-kit", icon: "🔧", name: "Repair Kit", blurb: "Patch up your ride curbside.", priceCity: 150, priceOrbitx: 0 },
  { id: "snack-run", icon: "🍜", name: "Midnight Snack Run", blurb: "Full spread for the crew.", priceCity: 120, priceOrbitx: 0 },
  { id: "neon-sign-pack", icon: "💡", name: "Neon Sign Pack", blurb: "Cosmetic: neon trim for your garage wall.", priceCity: 0, priceOrbitx: 5 },
  { id: "gold-cart", icon: "🛒", name: "Golden Cart", blurb: "Cosmetic: flex at every checkout, forever.", priceCity: 0, priceOrbitx: 15 },
];

export function shopBurnReason(id: string): string {
  return `city:districts:shop:${id}`;
}

const STORE_KEY = "orbitxcity:shops:v1";

function loadInv(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const p = raw ? JSON.parse(raw) : {};
    return p && typeof p === "object" ? p : {};
  } catch { return {}; }
}

function saveInv(inv: Record<string, number>): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(inv)); } catch { /* noop */ }
}

/** Persisted inventory (item id → count). */
export function shopInventory(): Record<string, number> { return loadInv(); }

/** Buy a paper-CITY item (local ledger). */
export function buyShopItemPaper(item: ShopItem): { ok: boolean; message: string } {
  if (!(item.priceCity > 0)) return { ok: false, message: "This item is ORBITX-only." };
  if (!paperWallet.trySpend(item.priceCity)) {
    return { ok: false, message: `Need ${item.priceCity} paper CITY (have ${Math.floor(paperWallet.city)})` };
  }
  const inv = loadInv();
  inv[item.id] = (inv[item.id] ?? 0) + 1;
  saveInv(inv);
  return { ok: true, message: `${item.icon} ${item.name} added to inventory.` };
}

/** Buy a premium item: burns real ORBITX through billing, then grants it. */
export async function buyShopItemPremium(
  item: ShopItem, billing: DistrictsBilling,
): Promise<{ ok: boolean; message: string; signature?: string }> {
  if (!(item.priceOrbitx > 0)) return { ok: false, message: "This item is paper-CITY only." };
  try {
    const { signature } = await billing.spendPremium({ amount: item.priceOrbitx, reason: shopBurnReason(item.id) });
    const inv = loadInv();
    inv[item.id] = (inv[item.id] ?? 0) + 1;
    saveInv(inv);
    return { ok: true, message: `${item.icon} ${item.name} unlocked — burn confirmed.`, signature };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Purchase failed — nothing was charged." };
  }
}

/* ---------------------------------- shared ---------------------------------- */

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2, ...opts });
}

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
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

/* --------------------------------- exterior --------------------------------- */

/** Strip-mall storefront. Integrator adds to the outdoor world group. */
export function buildShopsExterior(): THREE.Group {
  const g = new THREE.Group();
  const W = 40, H = 9, D = 20;

  g.add(box(W, H, D, 0x8a7f6a, 0, H / 2, 0));
  // glass storefront
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.9, H * 0.62),
    new THREE.MeshStandardMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.5, roughness: 0.2, emissive: 0xffd9a0, emissiveIntensity: 0.35 }),
  );
  glass.position.set(0, H * 0.42, D / 2 + 0.1);
  g.add(glass);
  // awning stripes
  for (let i = 0; i < 10; i++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.09, 0.18, 2.4),
      mat(i % 2 === 0 ? 0xc23b3b : 0xe8e8e8),
    );
    stripe.position.set(-W * 0.45 + i * W * 0.09 + W * 0.045, H * 0.78, D / 2 + 1.2);
    stripe.rotation.x = 0.25;
    g.add(stripe);
  }
  g.add(box(W * 0.72, 1.8, 0.6, 0x101418, 0, H - 1.4, D / 2 + 0.4));
  g.add(makeTextPlane("ORBITX MARKET", W * 0.64, 1.5, "#ffd166", 0, H - 1.4, D / 2 + 0.75));
  // door glow marker
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 4.4),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
  );
  glow.position.set(0, 2.2, D / 2 + 0.2);
  g.add(glow);

  g.position.set(...SHOPS_FACADE_CENTER);
  return g;
}

/* --------------------------------- interior --------------------------------- */

export interface ShopsInterior {
  group: THREE.Group;
  /** Checkout counter position (integrator proximity-opens <ShopsUI>). */
  checkoutPosition: Vec3T;
  dispose(): void;
}

const AISLE_COLORS = [0xc23b3b, 0x2a6bc2, 0x2e9e5a, 0xd8a02e, 0x7a3bc2, 0x22e5ff];

export function buildShopsInterior(): ShopsInterior {
  const g = new THREE.Group();
  const W = 44, D = 34, H = 8;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xd8d4c8, { roughness: 0.4 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  // checkerboard inlay
  for (let ix = 0; ix < 11; ix++) {
    for (let iz = 0; iz < 8; iz++) {
      if ((ix + iz) % 2 !== 0) continue;
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.5 }),
      );
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(-W / 2 + 2 + ix * 4, 0.02, -D / 2 + 2 + iz * 4);
      g.add(tile);
    }
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x111318));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  g.add(ceil);
  const wallMat = mat(0x3f4a3a);
  const mkWall = (w: number, h: number, x: number, y: number, z: number, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    g.add(m);
  };
  mkWall(W, H, 0, H / 2, -D / 2);
  mkWall(W, H, 0, H / 2, D / 2, Math.PI);
  mkWall(D, H, -W / 2, H / 2, 0, Math.PI / 2);
  mkWall(D, H, W / 2, H / 2, 0, -Math.PI / 2);

  const key = new THREE.PointLight(0xfff2d0, 800, 60);
  key.position.set(0, H - 1, 0);
  g.add(key);

  // 3 stocked aisles
  for (let a = 0; a < 3; a++) {
    const x = (a - 1) * 12;
    for (const sz of [-1, 1]) {
      const z = sz * 4 - 2;
      g.add(box(8, 2.2, 1.2, 0x6b6f76, x, 1.1, z));
      // product boxes
      for (let k = 0; k < 6; k++) {
        const prod = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.7 + (k % 3) * 0.3, 0.9),
          mat(AISLE_COLORS[(a * 6 + k) % AISLE_COLORS.length]),
        );
        prod.position.set(x - 3 + k * 1.2, 2.55 + ((k % 3) * 0.3) / 2, z);
        prod.castShadow = true;
        g.add(prod);
      }
    }
    g.add(makeTextPlane(`AISLE ${a + 1}`, 5, 1, "#ffffff", x, 5.4, -8.5));
  }

  // checkout counter near the entrance
  const checkoutPosition: Vec3T = [0, 0, 10];
  g.add(box(7, 1.1, 1.8, 0x3a2e20, 0, 0.55, 10));
  g.add(box(7, 0.15, 2, 0x1e1812, 0, 1.18, 10));
  const belt = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.1, 1), mat(0x1a1e24));
  belt.position.set(0, 1.28, 10);
  g.add(belt);
  g.add(makeTextPlane("CHECKOUT", 5, 1, "#ffd166", 0, 3, 9.9));
  // neon OPEN sign
  g.add(makeTextPlane("· OPEN ·", 4.4, 1.2, "#22ff88", -W / 2 + 3.4, 5.6, D / 2 - 0.4));

  g.add(makeTextPlane("◀ EXIT", 4, 1, "#ff5544", 0, 3.4, D / 2 - 0.3));

  return {
    group: g,
    checkoutPosition,
    dispose() {
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    },
  };
}

export { paperWallet };
