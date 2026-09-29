/**
 * 5. LIBRARY — the actual history of OrbitX and famous trades.
 *
 * A grand reading room with archive shelves. Entries are data (`ARCHIVE`),
 * readable from the LibraryTerminal UI. "Famous trades" are real events from
 * OrbitX history (first on-chain MCP trade, the copy-trade mirror, launchpad
 * pushes). The archive is append-only — the integrator can add entries at
 * runtime via `addArchiveEntry`.
 */
import * as THREE from "three";
import type { ArchiveEntry, DoorTrigger, Vec3T } from "../types";

export const LIBRARY_INTERIOR_ID = "library";
export const LIBRARY_DOOR: DoorTrigger = {
  id: "door:library",
  label: "OrbitX Library",
  position: [-30, 0, -90],
  radius: 4,
  prompt: "Enter Library",
  interiorId: LIBRARY_INTERIOR_ID,
  interiorSpawn: [0, 0, 14],
  exitPosition: [-30, 0, -86],
};

/** The canon. Curated from real OrbitX history. */
export const ARCHIVE: ArchiveEntry[] = [
  {
    id: "origin",
    title: "The Origin: Sol Tools → OG Scan → OrbitX",
    date: "2024–2026",
    body: [
      "OrbitX began as a personal tool. None of the existing token-rug scanners were good enough — no data, covered in ads, horrible flashy UI — so a solo web dev built a better one for his own use.",
      "It started as Sol Tools, became OG Scan, and finally OrbitX: from a personal scanner to token tracking and a sniping tracker, then social features (community, leaderboard, voice lobbies) into a social trading hub.",
      "Shared with friends, went public on X, and was rebuilt as a full website version.",
    ],
    tags: ["history", "origin"],
  },
  {
    id: "mcp",
    title: "The Agent MCP: the fastest way to trade on Solana",
    date: "2026-09",
    body: [
      "The OrbitX Agent MCP — the builder's favorite — lets an AI agent buy and sell in seconds, faster than any wallet, with group chat inside Claude/Grok apps and detailed track-and-analysis.",
      "One-line pitch: as easy as plugging the MCP into any tool — in seconds you're connected and running.",
      "Free for community use. The $25/week or $100/month dev-API tier is burned in ORBITX.",
    ],
    tags: ["history", "mcp", "trading"],
  },
  {
    id: "first-trade",
    title: "Famous trade #1: the first on-chain agent trade",
    date: "2026-09-24",
    body: [
      "The first OrbitX trade needed two auths: the OAuth bearer alone returned phantom successes — signatures that never landed on-chain.",
      "After the dashboard auth-code flow, a $0.20 ORBITX buy landed on-chain for real.",
      "Lesson carved into the wall: backend-signed trades need the second (dashboard) auth. Verify the signature on-chain. Never trust ok:true alone.",
    ],
    tags: ["famous-trades", "mcp"],
  },
  {
    id: "copy-trade",
    title: "Famous trade #2: the Rasmr mirror",
    date: "2026-09-26",
    body: [
      "The copy-trading engine began mirroring Rasmr's FOMO wallet (#45 all-time, +$1.11M) — buys mirror at $0.50 each, sells dump 100% of position.",
      "The engine dust floor is $0.50: anything smaller never fires.",
      "The mirror fell out of sync on STONK and $CATE buys. Root cause still open — the honest kind of history.",
    ],
    tags: ["famous-trades", "copy-trading"],
  },
  {
    id: "launchpad",
    title: "The Launchpad & the Product Law",
    date: "2026-09-27",
    body: [
      "The launchpad shipped on one product law, stamped by the builder himself: the platform never funds user launches.",
      "Launches are always handled by the user: they pay gas from their own wallet, the token deploys from their own dev wallet, and fee claims accrue to them. No platform desk-wallet funding of launches, ever.",
    ],
    tags: ["history", "launchpad"],
  },
  {
    id: "city-born",
    title: "OrbitXCity is born",
    date: "2026-09-29",
    body: [
      "The GTA-style open world: a walkable, drivable 3D city on the OrbitX platform, built in the browser with Three.js. Realistic style — never blocky.",
      "Districts grew as the platform shipped: a stock exchange with paper trading on live data, a hospital that wipes your record for a bill, a museum for dead tokens, and a second island across the bridge.",
      "Currency law of the city: paper CITY for gameplay, real ORBITX for premium — and every in-game purchase burns.",
    ],
    tags: ["history", "city"],
  },
];

export function addArchiveEntry(entry: ArchiveEntry): void {
  if (!ARCHIVE.some((e) => e.id === entry.id)) ARCHIVE.unshift(entry);
}

export function searchArchive(query: string): ArchiveEntry[] {
  const q = query.toLowerCase();
  return ARCHIVE.filter(
    (e) =>
      e.title.toLowerCase().includes(q) ||
      e.body.some((b) => b.toLowerCase().includes(q)) ||
      e.tags.some((t) => t.includes(q))
  );
}

/* --------------------------------- interior --------------------------------- */

export interface LibraryInterior {
  group: THREE.Group;
  /** Reading terminals (open the archive UI). */
  terminalPositions: Vec3T[];
  dispose(): void;
}

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...opts });
}
function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** Grand reading room: double-height, shelf walls, long oak tables, green lamps. */
export function buildLibraryInterior(): LibraryInterior {
  const g = new THREE.Group();
  const W = 52, D = 40, H = 14;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x4a3a28, { roughness: 0.4 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x2a2118));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H; g.add(ceil);
  const wallM = mat(0x3a2f22);
  const mkWall = (w: number, h: number, x: number, y: number, z: number, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallM);
    m.position.set(x, y, z); m.rotation.y = ry; g.add(m);
  };
  mkWall(W, H, 0, H / 2, -D / 2);
  mkWall(W, H, 0, H / 2, D / 2, Math.PI);
  mkWall(D, H, -W / 2, H / 2, 0, Math.PI / 2);
  mkWall(D, H, W / 2, H / 2, 0, -Math.PI / 2);

  // shelf walls: rows of book spines (instanced-ish boxes with varied color)
  const spineColors = [0x7a2e2e, 0x2e5a7a, 0x3d6b35, 0x8a6b2e, 0x5a3d7a, 0x7a4a2e];
  for (const side of [-1, 1]) {
    for (let shelf = 0; shelf < 5; shelf++) {
      const y = 1.6 + shelf * 2.2;
      g.add(box(W * 0.9, 0.18, 0.9, 0x2e2418, 0, y, side * (D / 2 - 0.6)));
      for (let i = 0; i < 46; i++) {
        const bw = 0.55 + (i % 3) * 0.18;
        const bh = 1.5 + ((i * 7) % 5) * 0.12;
        const book = box(bw, bh, 0.7, spineColors[(i + shelf) % spineColors.length],
          -W * 0.42 + i * (W * 0.84 / 46), y + bh / 2 + 0.1, side * (D / 2 - 0.6));
        g.add(book);
      }
    }
  }

  // long reading tables + green banker's lamps
  const terminalPositions: Vec3T[] = [];
  for (let t = -1; t <= 1; t++) {
    const z = t * 11;
    g.add(box(20, 0.25, 3.4, 0x5a4028, 0, 1, z));
    for (const lx of [-8, 8]) for (const lz of [-1.2, 1.2]) g.add(box(0.35, 1, 0.35, 0x3a2a18, lx, 0.5, z + lz));
    for (let l = -2; l <= 2; l++) {
      const x = l * 4;
      g.add(box(0.18, 0.9, 0.18, 0x8a7a3a, x, 1.55, z));
      const shade = new THREE.Mesh(
        new THREE.ConeGeometry(0.7, 0.55, 10, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x1e6b3a, side: THREE.DoubleSide })
      );
      shade.position.set(x, 2.1, z);
      g.add(shade);
      const lampLight = new THREE.PointLight(0xffe9b0, 120, 12);
      lampLight.position.set(x, 1.9, z);
      g.add(lampLight);
      if (t === 0 && Math.abs(l) <= 1) terminalPositions.push([x, 0, z + 2.4]);
    }
    // chairs
    for (let l = -2; l <= 2; l++) {
      const x = l * 4;
      g.add(box(1, 0.15, 1, 0x4a3423, x, 0.75, z + 2.6));
      g.add(box(1, 1.1, 0.15, 0x4a3423, x, 1.3, z + 3.05));
    }
  }

  // central atrium skylight glow
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshBasicMaterial({ color: 0x9fc8e8, transparent: true, opacity: 0.5 })
  );
  sky.rotation.x = Math.PI / 2; sky.position.y = H - 0.1;
  g.add(sky);

  return {
    group: g,
    terminalPositions,
    dispose() {
      g.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
    },
  };
}

/** Exterior: stone library with columns and a wide stair. */
export function buildLibraryExterior(): THREE.Group {
  const g = new THREE.Group();
  const W = 36, H = 13, D = 22;
  g.add(box(W, H, D, 0xcfc4b2, 0, H / 2, 0));
  for (let i = -2; i <= 2; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, H, 10), mat(0xe6dcc8));
    col.position.set(i * 6.5, H / 2, D / 2 + 1.2);
    col.castShadow = true;
    g.add(col);
  }
  for (let i = 0; i < 3; i++) g.add(box(W * 0.6, 0.45, 3, 0xa89c86, 0, 0.22 + i * 0.45, D / 2 + 3 + i * 0.8));
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#2a2419"; ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = "#f5c518"; ctx.font = "bold 68px Georgia"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("ORBITX LIBRARY", 512, 68);
  const tex = new THREE.CanvasTexture(c);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.75), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(0, H - 2, D / 2 + 0.3);
  g.add(sign);
  g.position.set(...LIBRARY_DOOR.position);
  return g;
}
