/**
 * 4. MUSEUM OF RUGS — hall of fame / hall of shame for dead tokens.
 *
 * The museum takes REAL token data (integrator feeds TokenQuote[] from
 * `useLivePrices`, plus optional known-dead exhibits) and curates exhibits:
 *
 * - "confirmed-rug": drawdown ≤ -90% — Hall of Shame, red velvet room
 * - "slow-bleed": drawdown between -50% and -90% — the Bleeding Corridor
 * - "comeback?": green 24h after a deep drawdown — the Hope Alcove
 * - "hall-of-fame": positive 24h majors (ORBITX etc.) — the Winners' Gallery
 *
 * Exhibits persist to localStorage so the shame is permanent.
 */
import * as THREE from "three";
import type { DoorTrigger, RugExhibit, TokenQuote, Vec3T } from "../types";

export const MUSEUM_INTERIOR_ID = "museum-of-rugs";
export const MUSEUM_DOOR: DoorTrigger = {
  id: "door:museum",
  label: "Museum of Rugs",
  position: [30, 0, 90],
  radius: 4,
  prompt: "Enter Museum of Rugs",
  interiorId: MUSEUM_INTERIOR_ID,
  interiorSpawn: [0, 0, 16],
  exitPosition: [30, 0, 86],
};

const EXHIBITS_KEY = "orbitxcity:rug-exhibits:v1";

/** Known-dead hall of shame — real, permanent, never delisted. */
export const PERMANENT_EXHIBITS: RugExhibit[] = [
  {
    mint: "dead:bitconnect",
    symbol: "BCC",
    name: "BitConnect",
    peakPrice: 463.31,
    lastPrice: 0.0,
    drawdown: -1,
    verdict: "confirmed-rug",
    epitaph: "Lending platform. Carlos Matos yelled. The chart never recovered.",
  },
  {
    mint: "dead:squid",
    symbol: "SQUID",
    name: "Squid Game Token",
    peakPrice: 2861.8,
    lastPrice: 0.0,
    drawdown: -1,
    verdict: "confirmed-rug",
    epitaph: "Could not sell. The devs could. -99.99% in minutes.",
  },
  {
    mint: "dead:luna",
    symbol: "LUNA",
    name: "Terra Luna",
    peakPrice: 119.18,
    lastPrice: 0.0,
    drawdown: -1,
    verdict: "confirmed-rug",
    epitaph: "Algorithmic stablecoin. The algorithm was hope.",
  },
];

export function loadCustomExhibits(): RugExhibit[] {
  try {
    const raw = localStorage.getItem(EXHIBITS_KEY);
    if (raw) return JSON.parse(raw) as RugExhibit[];
  } catch { /* noop */ }
  return [];
}

export function saveCustomExhibit(ex: RugExhibit): void {
  const list = loadCustomExhibits().filter((e) => e.mint !== ex.mint);
  list.push(ex);
  try { localStorage.setItem(EXHIBITS_KEY, JSON.stringify(list)); } catch { /* noop */ }
}

/**
 * Curate live exhibits from real quotes. `peakPrices` is the integrator's
 * rolling peak-price memory (symbol → all-time-high in the session).
 * Pure function — safe to call every tick.
 */
export function curateExhibits(
  quotes: TokenQuote[],
  peakPrices: Record<string, number>
): RugExhibit[] {
  const exhibits: RugExhibit[] = [...PERMANENT_EXHIBITS, ...loadCustomExhibits()];
  for (const q of quotes) {
    if (exhibits.some((e) => e.mint === q.mint)) continue;
    const peak = peakPrices[q.symbol] ?? q.price;
    if (!(peak > 0) || !(q.price > 0)) continue;
    const drawdown = (q.price - peak) / peak;
    if (drawdown <= -0.9) {
      exhibits.push({
        mint: q.mint ?? q.symbol, symbol: q.symbol, name: q.symbol,
        peakPrice: peak, lastPrice: q.price, drawdown,
        verdict: "confirmed-rug",
        epitaph: `Down ${Math.abs(drawdown * 100).toFixed(1)}% from peak. Pour one out.`,
      });
    } else if (drawdown <= -0.5 && q.change24h > 5) {
      exhibits.push({
        mint: q.mint ?? q.symbol, symbol: q.symbol, name: q.symbol,
        peakPrice: peak, lastPrice: q.price, drawdown,
        verdict: "comeback?",
        epitaph: `Down bad, but +${q.change24h.toFixed(1)}% today. Hope is a strategy?`,
      });
    } else if (drawdown <= -0.5) {
      exhibits.push({
        mint: q.mint ?? q.symbol, symbol: q.symbol, name: q.symbol,
        peakPrice: peak, lastPrice: q.price, drawdown,
        verdict: "slow-bleed",
        epitaph: `Bleeding ${Math.abs(drawdown * 100).toFixed(0)}% from peak. Still listed. Still coping.`,
      });
    } else if (q.change24h > 0 && ["ORBITX", "SOL"].includes(q.symbol)) {
      exhibits.push({
        mint: q.mint ?? q.symbol, symbol: q.symbol, name: q.symbol,
        peakPrice: peak, lastPrice: q.price, drawdown,
        verdict: "hall-of-fame",
        epitaph: `Survivor. +${q.change24h.toFixed(1)}% today. Study this one.`,
      });
    }
  }
  return exhibits;
}

export interface MuseumInterior {
  group: THREE.Group;
  /** Rebuild plaques from fresh exhibits. */
  updateExhibits(exhibits: RugExhibit[]): void;
  /** Plaque positions for proximity reading (integrator shows the epitaph UI). */
  plaquePositions: Vec3T[];
  dispose(): void;
}

const VERDICT_STYLE: Record<RugExhibit["verdict"], { room: string; color: string; label: string }> = {
  "confirmed-rug": { room: "HALL OF SHAME", color: "#ff3344", label: "CONFIRMED RUG" },
  "slow-bleed": { room: "BLEEDING CORRIDOR", color: "#ff8833", label: "SLOW BLEED" },
  "comeback?": { room: "HOPE ALCOVE", color: "#ffdd44", label: "COMEBACK?" },
  "hall-of-fame": { room: "WINNERS' GALLERY", color: "#22ff88", label: "HALL OF FAME" },
};

function plaqueTexture(ex: RugExhibit): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 320;
  const ctx = c.getContext("2d")!;
  const style = VERDICT_STYLE[ex.verdict];
  ctx.fillStyle = "#101010"; ctx.fillRect(0, 0, 512, 320);
  ctx.strokeStyle = style.color; ctx.lineWidth = 8; ctx.strokeRect(8, 8, 496, 304);
  ctx.fillStyle = style.color; ctx.font = "bold 28px Arial"; ctx.textAlign = "center";
  ctx.fillText(style.label, 256, 52);
  ctx.fillStyle = "#fff"; ctx.font = "bold 64px Arial";
  ctx.fillText(ex.symbol, 256, 130);
  ctx.fillStyle = "#bbb"; ctx.font = "30px Arial";
  ctx.fillText(`${ex.name}`, 256, 175);
  ctx.fillStyle = "#888"; ctx.font = "26px Arial";
  ctx.fillText(`Peak $${ex.peakPrice.toFixed(ex.peakPrice < 1 ? 5 : 2)} → $${ex.lastPrice.toFixed(ex.lastPrice < 1 ? 5 : 2)}`, 256, 215);
  ctx.fillStyle = style.color; ctx.font = "bold 30px Arial";
  ctx.fillText(`${(ex.drawdown * 100).toFixed(1)}%`, 256, 255);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildMuseumInterior(): MuseumInterior {
  const g = new THREE.Group();
  const W = 56, D = 48, H = 10;
  const texs: THREE.CanvasTexture[] = [];
  const plaquePositions: Vec3T[] = [];

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ color: 0x1a1414, roughness: 0.4, metalness: 0.3 })
  );
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: 0x0c0a0a }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H; g.add(ceil);

  // room dividers by verdict
  const rooms: RugExhibit["verdict"][] = ["confirmed-rug", "slow-bleed", "comeback?", "hall-of-fame"];
  rooms.forEach((verdict, i) => {
    const x = (i - 1.5) * 14;
    const style = VERDICT_STYLE[verdict];
    const divider = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, H, D * 0.8),
      new THREE.MeshStandardMaterial({ color: 0x2a2222 })
    );
    divider.position.set(x + 7, H / 2, 0);
    g.add(divider);
    // room label
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 96;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 1024, 96);
    ctx.fillStyle = style.color; ctx.font = "bold 56px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(style.room, 512, 50);
    const t = new THREE.CanvasTexture(c);
    texs.push(t);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.94), new THREE.MeshBasicMaterial({ map: t }));
    label.position.set(x, H - 1.6, -D * 0.32);
    g.add(label);
    const spot = new THREE.PointLight(new THREE.Color(style.color).getHex(), 300, 26);
    spot.position.set(x, H - 2, -D * 0.2);
    g.add(spot);
  });

  const plaquesGroup = new THREE.Group();
  g.add(plaquesGroup);

  function updateExhibits(exhibits: RugExhibit[]) {
    while (plaquesGroup.children.length) plaquesGroup.remove(plaquesGroup.children[0]);
    texs.push(...plaquesGroup.children as never[]);
    plaquePositions.length = 0;
    const byRoom: Record<string, RugExhibit[]> = {};
    for (const e of exhibits) (byRoom[e.verdict] ||= []).push(e);
    rooms.forEach((verdict, ri) => {
      const list = (byRoom[verdict] ?? []).slice(0, 6);
      const x = (ri - 1.5) * 14;
      list.forEach((ex, pi) => {
        const z = -D * 0.32 + 3 + pi * 4.2;
        const tex = plaqueTexture(ex);
        texs.push(tex);
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(3.4, 2.2, 0.18),
          new THREE.MeshStandardMaterial({ color: 0x6b5a2e, metalness: 0.7, roughness: 0.35 })
        );
        frame.position.set(x, 2.4, z);
        plaquesGroup.add(frame);
        const plaque = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.875), new THREE.MeshBasicMaterial({ map: tex }));
        plaque.position.set(x, 2.4, z + 0.11);
        plaquesGroup.add(plaque);
        const candle = new THREE.PointLight(0xffaa55, 40, 8);
        candle.position.set(x, 3.6, z + 1);
        plaquesGroup.add(candle);
        plaquePositions.push([x, 0, z + 1.4]);
      });
    });
  }

  updateExhibits(PERMANENT_EXHIBITS);

  return {
    group: g,
    plaquePositions,
    updateExhibits,
    dispose() {
      g.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
      texs.forEach((t) => t.dispose());
    },
  };
}

/** Exterior: dark granite block, "MUSEUM OF RUGS" sign, red-carpet steps. */
export function buildMuseumExterior(): THREE.Group {
  const g = new THREE.Group();
  const W = 40, H = 14, D = 24;
  const granite = new THREE.MeshStandardMaterial({ color: 0x232028, roughness: 0.85 });
  const block = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), granite);
  block.position.y = H / 2;
  block.castShadow = true; block.receiveShadow = true;
  g.add(block);
  // portico columns
  for (let i = -2; i <= 2; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, H, 10), granite);
    col.position.set(i * 7, H / 2, D / 2 + 1.4);
    col.castShadow = true;
    g.add(col);
  }
  // red-carpet steps
  for (let i = 0; i < 4; i++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(10 - i * 1.2, 0.4, 3),
      new THREE.MeshStandardMaterial({ color: 0x7a1010, roughness: 0.95 })
    );
    step.position.set(0, 0.2 + i * 0.4, D / 2 + 3.5 + i * 0.85);
    g.add(step);
  }
  // sign band
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = "#ff3344"; ctx.font = "bold 64px Georgia"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("MUSEUM OF RUGS", 512, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 2), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(0, H - 2.4, D / 2 + 0.3);
  g.add(sign);
  // tombstone marker
  const stone = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 3, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.9 })
  );
  stone.position.set(8, 1.5, D / 2 + 4);
  g.add(stone);
  g.position.set(...MUSEUM_DOOR.position);
  return g;
}

/** React-free epitaph card data for the integrator's HUD prompt. */
export function epitaphCard(ex: RugExhibit): { title: string; lines: string[] } {
  const style = VERDICT_STYLE[ex.verdict];
  return {
    title: `${ex.symbol} — ${style.label}`,
    lines: [
      ex.name,
      `Peak $${ex.peakPrice} → now $${ex.lastPrice}`,
      `Drawdown ${(ex.drawdown * 100).toFixed(1)}%`,
      `“${ex.epitaph}”`,
    ],
  };
}
