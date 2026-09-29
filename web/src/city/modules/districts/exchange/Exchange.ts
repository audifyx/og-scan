/**
 * 1. STOCK EXCHANGE — walkable trading floor with in-game paper trading terminals.
 *
 * - Exterior: neoclassical facade (columns, steps, "ORBITX EXCHANGE" sign) at
 *   EXCHANGE_DOOR. The integrator places it on a city block corner.
 * - Interior: grand hall, ticker wall (live canvas texture), rows of trader
 *   desks with glowing monitors, 4 trade terminals (interact kiosks).
 * - Trading: paper CITY only, settled against live TokenQuote data fed in by
 *   the integrator from `useLivePrices`. No real funds move.
 */
import * as THREE from "three";
import type { DoorTrigger, TokenQuote, Vec3T } from "../types";
import { paperWallet } from "../paper/PaperWallet";

export const EXCHANGE_INTERIOR_ID = "stock-exchange";
export const EXCHANGE_DOOR: DoorTrigger = {
  id: "door:exchange",
  label: "OrbitX Stock Exchange",
  position: [60, 0, -40],
  radius: 4,
  prompt: "Enter Stock Exchange",
  interiorId: EXCHANGE_INTERIOR_ID,
  interiorSpawn: [0, 0, 14],
  exitPosition: [60, 0, -36],
};

/* ---------------------------------- shared ---------------------------------- */

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.25, ...opts });
}

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* --------------------------------- exterior --------------------------------- */

/** Neoclassical exchange facade. Integrator adds to the outdoor world group. */
export function buildExchangeExterior(): THREE.Group {
  const g = new THREE.Group();
  const W = 44, H = 16, D = 26;

  // main mass
  g.add(box(W, H, D, 0xd8cfc0, 0, H / 2, 0));
  // pediment
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.01, W * 0.62, 5, 4, 1), mat(0xcabfae));
  ped.position.set(0, H + 2.5, 0);
  ped.rotation.y = Math.PI / 4;
  ped.scale.set(1, 1, 0.6);
  g.add(ped);
  // columns
  for (let i = -3; i <= 3; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, H, 12), mat(0xe8e0d2));
    col.position.set(i * 6, H / 2, D / 2 + 1.5);
    col.castShadow = true;
    g.add(col);
  }
  // steps
  for (let i = 0; i < 4; i++) g.add(box(W + 6 - i * 1.5, 0.5, 4, 0x9a938a, 0, 0.25 + i * 0.5, D / 2 + 3.5 + i * 0.9));
  // sign band
  const sign = box(W * 0.7, 2.2, 0.6, 0x101418, 0, H - 2.5, D / 2 + 0.4);
  g.add(sign);
  g.add(makeTextPlane("ORBITX EXCHANGE", W * 0.62, 1.8, "#f5c518", 0, H - 2.5, D / 2 + 0.75));

  // door glow marker
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 6),
    new THREE.MeshBasicMaterial({ color: 0xf5c518, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
  );
  glow.position.set(0, 3, D / 2 + 0.2);
  g.add(glow);

  g.position.set(...EXCHANGE_DOOR.position);
  return g;
}

function makeTextPlane(text: string, w: number, h: number, color: string, x: number, y: number, z: number) {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = color;
  ctx.font = "bold 72px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 512, 68);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z);
  return m;
}

/* --------------------------------- interior --------------------------------- */

export interface ExchangeInterior {
  group: THREE.Group;
  /** Push fresh live quotes into the ticker wall + desk monitors. */
  updateQuotes(quotes: TokenQuote[]): void;
  /** Terminal kiosk world positions (integrator raycasts / proximity-checks these). */
  terminalPositions: Vec3T[];
  dispose(): void;
}

export function buildExchangeInterior(): ExchangeInterior {
  const g = new THREE.Group();
  const W = 60, D = 44, H = 12;

  // floor / ceiling / walls
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x2a2d34, { roughness: 0.3, metalness: 0.6 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x111318));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  g.add(ceil);
  const wallMat = mat(0x3a3f4a);
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

  // chandelier-ish light rigs
  for (let i = -1; i <= 1; i++) {
    const light = new THREE.PointLight(0xfff2d0, 900, 60);
    light.position.set(i * 18, H - 1.5, 0);
    g.add(light);
    g.add(box(6, 0.4, 2, 0x8a7a4a, i * 18, H - 0.4, 0));
  }

  // ticker wall (live canvas texture)
  const tickerCanvas = document.createElement("canvas");
  tickerCanvas.width = 2048; tickerCanvas.height = 128;
  const tickerTex = new THREE.CanvasTexture(tickerCanvas);
  tickerTex.colorSpace = THREE.SRGBColorSpace;
  const tickerWall = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.9, 4),
    new THREE.MeshBasicMaterial({ map: tickerTex })
  );
  tickerWall.position.set(0, H - 3.5, -D / 2 + 0.2);
  g.add(tickerWall);
  g.add(box(W * 0.94, 4.6, 0.4, 0x0a0c10, 0, H - 3.5, -D / 2 - 0.1));

  // trader desks with glowing monitors
  const monitorTexs: THREE.CanvasTexture[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      const x = (col - 2.5) * 8;
      const z = (row - 1) * 10 - 2;
      g.add(box(6, 1, 2.6, 0x4a3f2e, x, 0.5, z)); // desk
      g.add(box(6, 0.15, 2.6, 0x2b2419, x, 1.05, z)); // top
      for (let s = -1; s <= 1; s += 2) {
        const c = document.createElement("canvas");
        c.width = 128; c.height = 96;
        const tex = new THREE.CanvasTexture(c);
        monitorTexs.push(tex);
        const mon = new THREE.Mesh(
          new THREE.PlaneGeometry(1.8, 1.35),
          new THREE.MeshBasicMaterial({ map: tex })
        );
        mon.position.set(x + s * 1.4, 1.9, z - 0.8);
        mon.rotation.x = -0.12;
        g.add(mon);
        g.add(box(0.15, 0.8, 0.15, 0x111111, x + s * 1.4, 1.3, z - 0.9));
      }
      // stool
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 10), mat(0x7a1f1f));
      stool.position.set(x, 0.85, z + 1.6);
      g.add(stool);
    }
  }

  // 4 trade terminals (kiosks) near the entrance
  const terminalPositions: Vec3T[] = [];
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 5;
    const z = 14;
    terminalPositions.push([x, 0, z]);
    g.add(box(1.6, 2.6, 1, 0x101418, x, 1.3, z));
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.7),
      new THREE.MeshBasicMaterial({ color: 0x0e2a1a })
    );
    screen.position.set(x, 1.7, z - 0.55);
    screen.rotation.y = Math.PI;
    g.add(screen);
    const glowK = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.25),
      new THREE.MeshBasicMaterial({ color: 0x22ff88, transparent: true, opacity: 0.8 })
    );
    glowK.position.set(x, 0.13, z);
    glowK.rotation.x = -Math.PI / 2;
    g.add(glowK);
  }

  // exit sign over spawn
  g.add(makeTextPlane("◀ EXIT", 4, 1, "#ff5544", 0, 3.4, D / 2 - 0.3));

  function drawTicker(quotes: TokenQuote[]) {
    const ctx = tickerCanvas.getContext("2d")!;
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, 2048, 128);
    ctx.font = "bold 44px monospace";
    ctx.textBaseline = "middle";
    let x = 24;
    const items = quotes.length ? quotes : [{ symbol: "ORBITX", price: 0, change24h: 0 }];
    for (const q of items.slice(0, 10)) {
      const up = q.change24h >= 0;
      ctx.fillStyle = up ? "#22ff88" : "#ff4455";
      const px = q.price > 0 ? q.price.toFixed(q.price < 1 ? 5 : 2) : "—";
      const txt = `${q.symbol} ${px} ${up ? "▲" : "▼"}${Math.abs(q.change24h).toFixed(1)}%`;
      ctx.fillText(txt, x, 66);
      x += ctx.measureText(txt).width + 70;
    }
    tickerTex.needsUpdate = true;
  }

  function drawMonitors(quotes: TokenQuote[]) {
    for (let i = 0; i < monitorTexs.length; i++) {
      const c = monitorTexs[i].image as HTMLCanvasElement;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#0a1410";
      ctx.fillRect(0, 0, 128, 96);
      const q = quotes[i % Math.max(1, quotes.length)];
      ctx.fillStyle = q && q.change24h >= 0 ? "#22ff88" : "#ff4455";
      ctx.font = "bold 13px monospace";
      ctx.fillText(q ? q.symbol : "—", 8, 20);
      // fake candle sticks
      ctx.strokeStyle = ctx.fillStyle;
      let px = 10, py = 70;
      ctx.beginPath();
      ctx.moveTo(px, py);
      let seed = i * 7919;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      for (let k = 0; k < 12; k++) {
        py -= (rnd() - 0.45) * 14;
        px += 9;
        ctx.lineTo(px, Math.max(14, Math.min(88, py)));
      }
      ctx.stroke();
      monitorTexs[i].needsUpdate = true;
    }
  }

  drawTicker([]);
  drawMonitors([]);

  return {
    group: g,
    terminalPositions,
    updateQuotes(quotes: TokenQuote[]) {
      drawTicker(quotes);
      drawMonitors(quotes);
    },
    dispose() {
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      tickerTex.dispose();
      monitorTexs.forEach((t) => t.dispose());
    },
  };
}

/** Paper-trade helper used by the terminal UI. */
export function executePaperTrade(
  quote: TokenQuote,
  side: "buy" | "sell",
  notionalCity: number
) {
  return side === "buy"
    ? paperWallet.buy(quote.symbol, quote.price, notionalCity)
    : paperWallet.sell(quote.symbol, quote.price, notionalCity);
}

export { paperWallet };
